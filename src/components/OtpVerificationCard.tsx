import React, { useMemo, useRef, useState } from 'react';

interface OtpVerificationCardProps {
  titleTop?: string;
  titleBottom?: string;
  message: string;
  actionLabel: string;
  isLoading?: boolean;
  onVerify: (code: string) => void;
  onResend?: () => void;
  resendSecondsLeft?: number;
  resendLabel?: string;
}

const OTP_LENGTH = 6;

const OtpVerificationCard: React.FC<OtpVerificationCardProps> = ({
  titleTop = 'OTP',
  titleBottom = 'Verification Code',
  message,
  actionLabel,
  isLoading = false,
  onVerify,
  onResend,
  resendSecondsLeft = 0,
  resendLabel = 'Renvoyer code',
}) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const code = useMemo(() => digits.join(''), [digits]);
  const isComplete = code.length === OTP_LENGTH && !digits.some((d) => d === '');

  const handleChange = (index: number, rawValue: string) => {
    const value = rawValue.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="otp-form-card">
      <div className="otp-title">{titleTop}</div>
      <div className="otp-title">{titleBottom}</div>
      <p className="otp-message">{message}</p>
      <div className="otp-inputs">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => { inputRefs.current[idx] = el; }}
            className={digit ? 'otp-digit-filled' : ''}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            disabled={isLoading}
          />
        ))}
      </div>
      <button
        className="otp-action"
        type="button"
        disabled={!isComplete || isLoading}
        onClick={() => onVerify(code)}
      >
        {isLoading ? '...' : actionLabel}
      </button>
      {onResend && (
        <button
          type="button"
          className="otp-resend"
          disabled={resendSecondsLeft > 0 || isLoading}
          onClick={onResend}
        >
          {resendSecondsLeft > 0 ? `${resendLabel} (${resendSecondsLeft}s)` : resendLabel}
        </button>
      )}
    </div>
  );
};

export default OtpVerificationCard;
