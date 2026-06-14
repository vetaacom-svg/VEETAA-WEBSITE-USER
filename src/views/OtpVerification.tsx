
import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase-client';

interface OtpProps {
  phone: string;
  password?: string; // Password for signup
  onVerified: () => void;
  onBack: () => void;
}

const OtpVerification: React.FC<OtpProps> = ({ phone, password, onVerified, onBack }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value !== '' && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  useEffect(() => {
    // Auto-verify when all 6 digits are entered, but only once
    if (otp.every(v => v !== '') && !isLoading && !error) {
      handleVerify();
    }
  }, [otp]);

  const handleVerify = async () => {
    if (isLoading) return;
    
    const token = otp.join('');
    if (token.length !== 6) {
      setError('Le code doit contenir 6 chiffres');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // If password is provided, this is a signup - verify and update user with password
      if (password) {
        const { data, error: otpError } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms'
        });

        if (otpError) {
          setIsLoading(false);
          setError(otpError.message || 'Code invalide. Veuillez réessayer.');
          // Reset OTP on error
          setOtp(['', '', '', '', '', '']);
          document.getElementById('otp-0')?.focus();
          return;
        }

        // Now update the user with the password
        if (data?.user) {
          const { error: updateError } = await supabase.auth.updateUser({
            password: password
          });

          if (updateError) {
            setIsLoading(false);
            setError(updateError.message || 'Erreur lors de la création du mot de passe.');
            setOtp(['', '', '', '', '', '']);
            document.getElementById('otp-0')?.focus();
            return;
          }
        }
      } else {
        // This is password reset - just verify OTP
        const { error: otpError } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms'
        });

        if (otpError) {
          setIsLoading(false);
          setError(otpError.message || 'Code invalide. Veuillez réessayer.');
          // Reset OTP on error
          setOtp(['', '', '', '', '', '']);
          document.getElementById('otp-0')?.focus();
          return;
        }
      }

      setIsLoading(false);
      onVerified();
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Une erreur est survenue. Vérifiez votre configuration Supabase.');
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col justify-center animate-in fade-in duration-500">
      <button onClick={onBack} className="absolute top-8 left-8 p-2 bg-slate-100 rounded-full">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="text-center mb-12 space-y-4">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-600">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-slate-800">Vérification</h2>
        <p className="text-slate-500">
          Entrez le code envoyé au <span className="text-slate-900 font-bold">{phone}</span>
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-6">
        {otp.map((digit, i) => (
          <input 
            key={i}
            id={`otp-${i}`}
            type="tel"
            maxLength={1}
            className="w-12 h-14 text-center text-2xl font-bold bg-slate-100 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all"
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-xs text-center mb-4 font-medium">{error}</p>
      )}

      <div className="text-center">
        {isLoading ? (
          <div className="flex justify-center">
            <div className="w-6 h-6 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">
            Vous n'avez pas reçu de code ?{' '}
            <button
              onClick={async () => {
                if (isResending) return;
                setIsResending(true);
                setError('');
                setOtp(['', '', '', '', '', '']);
                
                try {
                  // If password exists, this is signup; otherwise password reset
                  const { error: resendError } = await supabase.auth.signInWithOtp({ 
                    phone,
                    options: {
                      shouldCreateUser: !!password // Create user only if password exists (signup)
                    }
                  });
                  setIsResending(false);
                  
                  if (resendError) {
                    if (resendError.message.includes('429')) {
                      setError('Trop de tentatives. Veuillez attendre quelques minutes.');
                    } else if (resendError.message.includes('403')) {
                      setError('Authentification par téléphone non configurée dans Supabase.');
                    } else {
                      setError(resendError.message);
                    }
                  }
                } catch (err: any) {
                  setIsResending(false);
                  setError('Erreur réseau. Vérifiez votre connexion.');
                }
                
                document.getElementById('otp-0')?.focus();
              }}
              className="text-orange-600 font-bold disabled:opacity-60"
              disabled={isResending}
            >
              {isResending ? '...' : 'Renvoyer'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default OtpVerification;
