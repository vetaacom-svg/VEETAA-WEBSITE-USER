import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Linkedin, Youtube, MapPin, Phone, Clock, Smartphone, Mail, Globe, ArrowRight } from 'lucide-react';
import { getSupportInfo, SupportInfo, getSocialLinks, SocialLink } from '../lib/ribService';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const SOCIAL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  whatsapp: WhatsAppIcon,
  default: Globe,
};

export default function Footer() {
  const [supportInfo, setSupportInfo] = useState<SupportInfo | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    getSupportInfo().then(setSupportInfo);
    getSocialLinks().then(setSocialLinks);
  }, []);

  const phoneNumber = supportInfo?.phone || '+212600000000';
  const displayPhone = supportInfo?.phone || '+212 600 000 000';
  const waLink = `https://wa.me/${phoneNumber.replace(/[\s+]/g, '')}`;

  return (
    <footer className="veetaa-footer overflow-hidden relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      <div className="veetaa-container py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
          {/* Brand & Mission */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
               <img src="/logo.png" alt="Veetaa" className="h-10 w-auto" />
               <span className="text-2xl font-black tracking-tighter">VEETAA</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm">
              Votre partenaire de livraison quotidien au Maroc. 
              Qualité, rapidité et service client exceptionnel à chaque commande.
            </p>
            <div className="flex items-center gap-4">
               {socialLinks.length > 0 ? (
                 socialLinks.map((link) => {
                   const IconComponent = link.icon_name && SOCIAL_ICONS[link.icon_name.toLowerCase()] ? SOCIAL_ICONS[link.icon_name.toLowerCase()] : SOCIAL_ICONS.default;
                   return (
                     <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-orange-600 hover:border-orange-600 transition-all duration-300">
                       <IconComponent className="w-4 h-4" />
                     </a>
                   );
                 })
               ) : (
                 <>
                   <a href="https://instagram.com" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-orange-600 hover:border-orange-600 transition-all duration-300"><Instagram size={18} /></a>
                   <a href="https://facebook.com" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-orange-600 hover:border-blue-600 transition-all duration-300"><Facebook size={18} /></a>
                   <a href={waLink} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-orange-600 hover:border-orange-600 transition-all duration-300"><WhatsAppIcon className="w-4 h-4" /></a>
                 </>
               )}
            </div>
          </div>

          {/* Luxury Links */}
          <div className="space-y-8">
            <h4 className="text-sm font-black uppercase tracking-widest text-orange-600">Company</h4>
            <ul className="space-y-4">
              <li><Link to="/home" className="text-slate-300 hover:text-white flex items-center gap-2 group text-sm"><ArrowRight size={12} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" /> Accueil</Link></li>
              <li><Link to="/stores" className="text-slate-300 hover:text-white flex items-center gap-2 group text-sm"><ArrowRight size={12} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" /> Tous les magasins</Link></li>
              <li><Link to="/orders" className="text-slate-300 hover:text-white flex items-center gap-2 group text-sm"><ArrowRight size={12} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" /> Mes commandes</Link></li>
              <li><Link to="/favorites" className="text-slate-300 hover:text-white flex items-center gap-2 group text-sm"><ArrowRight size={12} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" /> Favoris</Link></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-8">
            <h4 className="text-sm font-black uppercase tracking-widest text-orange-600">Contact</h4>
            <ul className="space-y-5">
              <li className="flex gap-4">
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><MapPin size={18} className="text-orange-600" /></div>
                 <div><p className="text-xs font-bold text-slate-500 uppercase">Localisation</p><p className="text-sm text-slate-300">Kenitra, Maroc</p></div>
              </li>
              <li className="flex gap-4">
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Phone size={18} className="text-orange-600" /></div>
                 <div><p className="text-xs font-bold text-slate-500 uppercase">Téléphone</p><a href={`tel:${phoneNumber}`} className="text-sm text-slate-300 hover:text-orange-600 hover:underline">{displayPhone}</a></div>
              </li>
              <li className="flex gap-4">
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Clock size={18} className="text-orange-600" /></div>
                 <div><p className="text-xs font-bold text-slate-500 uppercase">Horaires</p><p className="text-sm text-slate-300">7j/7 · 8h00 – 22h00</p></div>
              </li>
            </ul>
          </div>

          {/* Call to action App */}
          <div className="space-y-8">
             <h4 className="text-sm font-black uppercase tracking-widest text-orange-600">Mobile Experience</h4>
             <p className="text-slate-400 text-sm leading-relaxed">Téléchargez notre application pour profiter d'une expérience encore plus rapide.</p>
             <a href="/veetaa.apk" className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group border border-white/5">
                <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Smartphone /></div>
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-500">Android App</p>
                   <p className="font-bold text-sm">Download APK</p>
                </div>
             </a>
          </div>
        </div>

        <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
           <p className="text-slate-500 text-sm">© 2026 Veetaa. Designé avec excellence.</p>
           <div className="flex items-center gap-8">
              <Link to="/settings/privacy" className="text-slate-500 hover:text-white text-sm transition-colors">Politique de confidentialité</Link>
           </div>
        </div>
      </div>
    </footer>
  );
}
