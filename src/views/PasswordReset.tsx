
import React, { useState } from 'react';
import { Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

interface PasswordResetProps {
  language: Language;
  phone: string;
  onSuccess: () => void;
  onBack: () => void;
}

const PasswordReset: React.FC<PasswordResetProps> = ({ language, phone, onSuccess, onBack }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(t('passwordTooShort') || 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      alert('Mot de passe modifié avec succès ! Vous pouvez maintenant vous connecter.');
      onSuccess();
    } catch (err: any) {
      setIsLoading(false);
      setError('Erreur lors de la modification du mot de passe');
    }
  };

  return (
    <div className="veetaa-login-page">
      <div className="veetaa-login-card">
        <button onClick={onBack} className="absolute top-8 left-8 p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>

        <div className="veetaa-login-header">
           <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto text-orange-600 mb-8 shadow-xl shadow-orange-100">
              <Lock className="w-10 h-10" />
           </div>
           <h2 className="veetaa-login-title">{t('resetPassword') || 'New Password'}</h2>
           <p className="veetaa-login-subtitle">{t('chooseNewPasswordFor') || 'Choose a new password for'} <span className="text-slate-900 font-black">{phone}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="veetaa-login-form">
          <div className="veetaa-field">
            <label className="veetaa-label">{t('password')}</label>
            <div className="veetaa-input-wrap">
              <Lock className="veetaa-input-icon" />
              <input 
                type="password" 
                placeholder="••••••••"
                className="veetaa-input"
                value={password}
                onChange={(e) => {setPassword(e.target.value); setError('');}}
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="veetaa-field">
            <label className="veetaa-label">{t('confirmPassword') || 'Confirm Password'}</label>
            <div className="veetaa-input-wrap">
              <Lock className="veetaa-input-icon" />
              <input 
                type="password" 
                placeholder="••••••••"
                className="veetaa-input"
                value={confirmPassword}
                onChange={(e) => {setConfirmPassword(e.target.value); setError('');}}
                required
                minLength={6}
              />
            </div>
            {error && <p className="veetaa-error">{error}</p>}
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="veetaa-btn-primary"
          >
            {isLoading ? t('loading') : (t('resetPassword') || 'Update Password')}
            <ArrowRight className="veetaa-btn-icon" />
          </button>
        </form>

        <div className="veetaa-login-links">
          <button onClick={onBack} className="veetaa-link text-sm">{t('back')}</button>
        </div>
      </div>
    </div>
  );
};

export default PasswordReset;
