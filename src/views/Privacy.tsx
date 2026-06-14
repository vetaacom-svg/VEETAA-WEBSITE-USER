import React from 'react';
import { Shield, Lock, Eye, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface PrivacyProps {
  language: Language;
  onBack: () => void;
}

const Privacy: React.FC<PrivacyProps> = ({ language, onBack }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const sections = [
    {
      icon: <Database className="w-5 h-5" />,
      title: language === 'ar' ? 'جمع البيانات' : language === 'en' ? 'Data Collection' : 'Collecte de données',
      items: language === 'ar' ? [
        'نجمع معلوماتك الشخصية (الاسم، الهاتف، البريد الإلكتروني)',
        'نسجل موقع التسليم الخاص بك لكل طلب',
        'نحفظ سجل طلباتك وتفضيلاتك',
        'نستخدم ملفات تعريف الارتباط لتحسين التجربة'
      ] : language === 'en' ? [
        'We collect your personal information (name, phone, email)',
        'We record your delivery location for each order',
        'We save your order history and preferences',
        'We use cookies to improve your experience'
      ] : [
        'Nous collectons vos informations personnelles (nom, téléphone, email)',
        'Nous enregistrons votre localisation de livraison pour chaque commande',
        'Nous sauvegardons votre historique de commandes et préférences',
        'Nous utilisons des cookies pour améliorer votre expérience'
      ]
    },
    {
      icon: <Lock className="w-5 h-5" />,
      title: language === 'ar' ? 'حماية البيانات' : language === 'en' ? 'Data Protection' : 'Protection des données',
      items: language === 'ar' ? [
        'جميع بياناتك مشفرة وآمنة',
        'نستخدم بروتوكولات SSL/TLS آمنة',
        'الوصول مقيد بموظفين معتمدين فقط',
        'نطبق أفضل ممارسات الأمان الصناعية'
      ] : language === 'en' ? [
        'All your data is encrypted and secure',
        'We use secure SSL/TLS protocols',
        'Access is restricted to authorized personnel only',
        'We apply industry-best security practices'
      ] : [
        'Toutes vos données sont chiffrées et sécurisées',
        'Nous utilisons des protocoles SSL/TLS sécurisés',
        'L\'accès est restreint au personnel autorisé uniquement',
        'Nous appliquons les meilleures pratiques de sécurité'
      ]
    },
    {
      icon: <Eye className="w-5 h-5" />,
      title: language === 'ar' ? 'استخدام البيانات' : language === 'en' ? 'Data Usage' : 'Utilisation des données',
      items: language === 'ar' ? [
        'لمعالجة وتوصيل طلباتك',
        'لتحسين خدماتنا وتجربة المستخدم',
        'لإرسال إشعارات حول طلباتك',
        'لن نبيع بياناتك أبدًا لأطراف ثالثة'
      ] : language === 'en' ? [
        'To process and deliver your orders',
        'To improve our services and user experience',
        'To send notifications about your orders',
        'We will never sell your data to third parties'
      ] : [
        'Pour traiter et livrer vos commandes',
        'Pour améliorer nos services et l\'expérience utilisateur',
        'Pour envoyer des notifications sur vos commandes',
        'Nous ne vendrons jamais vos données à des tiers'
      ]
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: language === 'ar' ? 'حقوقك' : language === 'en' ? 'Your Rights' : 'Vos droits',
      items: language === 'ar' ? [
        'الوصول إلى بياناتك الشخصية',
        'تعديل أو حذف معلوماتك',
        'إلغاء الاشتراك في الإشعارات',
        'طلب نسخة من بياناتك'
      ] : language === 'en' ? [
        'Access your personal data',
        'Modify or delete your information',
        'Unsubscribe from notifications',
        'Request a copy of your data'
      ] : [
        'Accéder à vos données personnelles',
        'Modifier ou supprimer vos informations',
        'Se désabonner des notifications',
        'Demander une copie de vos données'
      ]
    }
  ];

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 px-1">
        <div className="p-3 bg-emerald-100 rounded-xl">
          <Shield className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800">{t('privacy')}</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            {language === 'ar' ? 'آخر تحديث: 5 فبراير 2026' : language === 'en' ? 'Last updated: February 5, 2026' : 'Dernière mise à jour : 5 février 2026'}
          </p>
        </div>
      </div>

      {/* Alert Box */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mx-1">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-900 mb-1">
              {language === 'ar' ? 'خصوصيتك مهمة بالنسبة لنا' : language === 'en' ? 'Your privacy matters to us' : 'Votre vie privée nous importe'}
            </p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              {language === 'ar' 
                ? 'نحن ملتزمون بحماية معلوماتك الشخصية والحفاظ على خصوصيتك في جميع الأوقات.'
                : language === 'en'
                ? 'We are committed to protecting your personal information and maintaining your privacy at all times.'
                : 'Nous nous engageons à protéger vos informations personnelles et à préserver votre vie privée en tout temps.'}
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Sections */}
      <div className="space-y-4 px-1">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                {section.icon}
              </div>
              <h3 className="font-black text-slate-800 text-base">{section.title}</h3>
            </div>
            <ul className="space-y-2.5">
              {section.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Contact Section */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 mx-1 border border-slate-200">
        <h3 className="font-black text-slate-800 mb-2">
          {language === 'ar' ? 'أسئلة حول الخصوصية؟' : language === 'en' ? 'Privacy Questions?' : 'Questions sur la confidentialité?'}
        </h3>
        <p className="text-sm text-slate-600 mb-3 leading-relaxed">
          {language === 'ar' 
            ? 'إذا كان لديك أي أسئلة حول سياسة الخصوصية الخاصة بنا، يرجى الاتصال بنا.'
            : language === 'en'
            ? 'If you have any questions about our privacy policy, please contact us.'
            : 'Si vous avez des questions sur notre politique de confidentialité, veuillez nous contacter.'}
        </p>
        <a 
          href="mailto:privacy@veetaa.ma" 
          className="inline-block bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform"
        >
          {language === 'ar' ? 'اتصل بنا' : language === 'en' ? 'Contact Us' : 'Nous contacter'}
        </a>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400 px-1">
        {language === 'ar' 
          ? '© 2026 Veetaa. جميع الحقوق محفوظة.'
          : language === 'en'
          ? '© 2026 Veetaa. All rights reserved.'
          : '© 2026 Veetaa. Tous droits réservés.'}
      </p>
    </div>
  );
};

export default Privacy;
