import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID,
} = process.env;

function isConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  const { to } = req.body ?? {};
  if (typeof to !== 'string' || !/^\+\d{10,15}$/.test(to)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
    await client.verify.v2
      .services(TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to, channel: 'sms' });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('send-phone-otp failed:', error);
    return res.status(400).json({ error: 'Unable to process request' });
  }
}
