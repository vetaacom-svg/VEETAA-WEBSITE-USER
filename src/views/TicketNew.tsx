import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Ticket, Send, AlertTriangle } from 'lucide-react';
import { UserProfile, Language } from '../types';
import { createTicket } from '../lib/ticketService';
import { TRANSLATIONS } from '../constants';
import { sanitizePlainText } from '../lib/security';

interface TicketNewProps {
  language: Language;
  user: UserProfile | null;
  onBack: () => void;
}

const TicketNew: React.FC<TicketNewProps> = ({ language, user, onBack }) => {
  const navigate = useNavigate();
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeDescription = sanitizePlainText(description, 2000).trim();
    if (!safeDescription) return;

    setLoading(true);
    setError(null);

    const res = await createTicket(
      user.id!,
      user.fullName,
      user.phone || '',
      safeDescription
    );

    setLoading(false);

    if (res.success && res.ticketId) {
      // Redirect to the newly created ticket chat
      navigate(`/tickets/${res.ticketId}`, { replace: true });
    } else {
      setError(res.error || 'Erreur lors de la création du ticket.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50/50 py-4 md:py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        
        {/* Header Options */}
        <div className="flex items-center gap-3 md:gap-4 bg-white/60 backdrop-blur-md p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200/60 shadow-sm">
          <button 
            onClick={() => navigate('/tickets')} 
            className="p-2 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-slate-800 hover:scale-105 active:scale-95 transition-all outline-none"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 md:gap-3">
             <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg md:rounded-xl flex items-center justify-center shadow-md">
                <Ticket className="w-4 h-4 md:w-5 md:h-5 text-white" />
             </div>
             <h2 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight">Nouvelle Réclamation</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-4 md:space-y-6">
          <div className="space-y-3 md:space-y-4">
            <label className="block text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest pl-2">Description du problème</label>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(sanitizePlainText(e.target.value, 2000))}
                placeholder="Expliquez en détail votre problème ou vôtre demande..."
                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-6 min-h-[150px] md:min-h-[200px] outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-y text-slate-800 placeholder:text-slate-400 text-sm md:text-[15px] font-medium leading-relaxed shadow-inner"
              ></textarea>
            </div>
            <p className="pl-2 md:pl-4 text-[10px] md:text-xs font-bold text-slate-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-400" />
              Vos coordonnées seront automatiquement envoyées.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 font-bold p-3 md:p-4 rounded-xl md:rounded-2xl border border-red-100 text-[12px] md:text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !description.trim()}
            className="w-full py-4 md:py-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl md:rounded-[2rem] font-black text-[10px] md:text-sm uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 md:gap-3"
          >
            {loading ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                Envoyer la demande
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};

export default TicketNew;
