import React, { useState } from 'react';
import { UserProfile, Language } from '../types';
import { Mail, Phone as PhoneIcon, User } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { sanitizeEmailInput, sanitizePhoneInput, sanitizePlainText } from '../lib/security';

interface ProfileEditProps {
  user: UserProfile | null;
  language: Language;
  onBack: () => void;
  onSave: (fullName: string, email: string, phone: string) => Promise<void>;
}

const ProfileEdit: React.FC<ProfileEditProps> = ({ user, language, onBack, onSave }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateForm = () => {
    if (!fullName.trim()) {
      setError(t('nameRequired') || 'Name is required');
      return false;
    }
    if (!phone.trim()) {
      setError(t('phoneRequired') || 'Phone is required');
      return false;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('invalidEmail') || 'Invalid email format');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    setError('');
    setSuccess(false);
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      await onSave(
        sanitizePlainText(fullName, 80).trim(),
        sanitizeEmailInput(email),
        sanitizePhoneInput(phone).trim()
      );
      setSuccess(true);
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (err) {
      let errMsg = err instanceof Error ? err.message : 'An error occurred';
      if (
        errMsg.includes('profiles_phone_key') ||
        errMsg.includes('profiles_phone_unique') ||
        (errMsg.includes('phone') && (errMsg.includes('unique') || errMsg.includes('duplicate')))
      ) {
        errMsg =
          language === 'ar'
            ? 'رقم الهاتف هذا مسجل بالفعل لصالح حساب آخر.'
            : language === 'en'
              ? 'This phone number is already registered with another account.'
              : 'Ce numéro de téléphone est déjà associé à un autre compte.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{t('edit')}</h2>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl mx-1">
          <p className="text-red-700 text-xs sm:text-sm font-bold">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-xl sm:rounded-2xl mx-1">
          <p className="text-green-700 text-xs sm:text-sm font-bold">{t('saved') || 'Profile updated successfully!'}</p>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4 sm:space-y-5 px-1">
        {/* Name Field */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-0.5">
            {t('name')}
          </label>
          <div className="relative">
            <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-slate-400" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(sanitizePlainText(e.target.value, 80))}
              placeholder={t('enterName')}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-lg sm:rounded-2xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-medium text-slate-800 text-sm"
            />
          </div>
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-0.5">
            {t('email')} <span className="text-slate-300">(Optional)</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(sanitizeEmailInput(e.target.value))}
              placeholder={t('enterEmail')}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-lg sm:rounded-2xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-medium text-slate-800 text-sm"
            />
          </div>
        </div>

        {/* Phone Field */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-0.5">
            {t('phone')}
          </label>
          <div className="relative">
            <PhoneIcon className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-slate-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              placeholder={t('enterPhone')}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-lg sm:rounded-2xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-medium text-slate-800 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full mt-6 sm:mt-8 flex items-center justify-center gap-2 p-3 sm:p-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl sm:rounded-2xl font-black active:scale-95 transition-all uppercase tracking-widest text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mx-1"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t('saving') || 'Saving...'}
          </>
        ) : (
          `✓ ${t('save') || 'Save Changes'}`
        )}
      </button>

      {/* Cancel Button */}
      <button
        onClick={onBack}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 p-3 sm:p-4 bg-slate-100 text-slate-700 rounded-xl sm:rounded-2xl font-black active:scale-95 transition-all uppercase tracking-widest text-xs sm:text-sm disabled:opacity-50 mx-1"
      >
        {t('cancel')}
      </button>
    </div>
  );
};

export default ProfileEdit;
