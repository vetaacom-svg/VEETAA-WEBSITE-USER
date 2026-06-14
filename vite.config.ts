import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import twilio from 'twilio';

const supabaseProxy = (env: Record<string, string>) => {
  const target = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (!target) {
    return {} as Record<string, never>;
  }
  return {
    '/rest/v1': { target, changeOrigin: true, secure: true },
    '/auth/v1': { target, changeOrigin: true, secure: true },
    '/storage/v1': { target, changeOrigin: true, secure: true },
    '/realtime/v1': { target, changeOrigin: true, secure: true, ws: true },
    '/functions/v1': { target, changeOrigin: true, secure: true },
  } as const;
};

const readBody = (req: import('http').IncomingMessage) =>
  new Promise<any>((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

const twilioDevOtpPlugin = (env: Record<string, string>) => ({
  name: 'twilio-dev-otp-api',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(async (req, res, next) => {
      const isPasswordValidation = req.url === '/api/validate-phone-password' && req.method === 'POST';
      const isSend = req.url === '/api/send-phone-otp' && req.method === 'POST';
      const isVerify = req.url === '/api/verify-phone-otp' && req.method === 'POST';
      if (!isPasswordValidation && !isSend && !isVerify) return next();

      const body = await readBody(req);
      if (isPasswordValidation) {
        const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Supabase auth env missing in local dev (.env).' }));
          return;
        }
        const email = typeof body?.email === 'string' ? body.email : '';
        const password = typeof body?.password === 'string' ? body.password : '';
        if (!email || !password) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing credentials' }));
          return;
        }
        try {
          const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnonKey,
            },
            body: JSON.stringify({ email, password }),
          });
          if (!response.ok) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid phone or password' }));
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to validate credentials' }));
        }
        return;
      }

      const accountSid = env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
      const authToken = env.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
      const serviceSid = env.TWILIO_VERIFY_SERVICE_SID || process.env.TWILIO_VERIFY_SERVICE_SID;
      if (!accountSid || !authToken || !serviceSid) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Twilio env missing in local dev (.env).' }));
        return;
      }

      const to = typeof body?.to === 'string' ? body.to : '';
      if (!/^\+\d{10,15}$/.test(to)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid phone number format' }));
        return;
      }

      try {
        const client = twilio(accountSid, authToken);
        if (isSend) {
          await client.verify.v2.services(serviceSid).verifications.create({ to, channel: 'sms' });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        const code = typeof body?.code === 'string' ? body.code : '';
        if (!/^\d{4,8}$/.test(code)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid OTP code format' }));
          return;
        }
        const check = await client.verify.v2.services(serviceSid).verificationChecks.create({ to, code });
        if (check.status !== 'approved') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'OTP code is invalid or expired' }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Twilio request failed' }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const proxy = supabaseProxy(env);

  return {
    server: {
      port: 3001,
      host: '0.0.0.0',
      /** Accès via http://192.168.x.x:3001 (téléphone / LAN) sans « Invalid Host header » */
      allowedHosts: true,
      /** Dev : même origine → Brave n’interdit plus les appels « tiers » vers Supabase */
      proxy,
    },
    /** `vite preview` après build : même proxy que le dev server */
    preview: {
      port: 4173,
      allowedHosts: true,
      proxy,
    },
    plugins: [react(), twilioDevOtpPlugin(env)],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    optimizeDeps: {
      include: ['@supabase/supabase-js']
    }
  };
});
