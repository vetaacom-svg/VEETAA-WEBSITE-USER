import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Clock, CheckCircle, MessageSquare, Ticket } from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../constants';
import { fetchUserTickets, SupportTicket } from '../lib/ticketService';

interface TicketsListProps {
  language: Language;
  user: UserProfile | null;
  onBack: () => void;
}

const TicketsList: React.FC<TicketsListProps> = ({ language, user, onBack }) => {
  const navigate = useNavigate();
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchUserTickets(user.id).then((res) => {
      setTickets(res);
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500 font-bold p-6 text-center">
        Veuillez vous connecter pour voir vos tickets.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50/50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-slate-200/60 shadow-sm sticky top-4 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-slate-800 hover:scale-105 active:scale-95 transition-all outline-none"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-md">
                  <Ticket className="w-5 h-5 text-white" />
               </div>
               <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Support Tickets</h2>
            </div>
          </div>

          <button
            onClick={() => navigate('/tickets/new')}
            className="p-3 bg-gradient-to-tr from-orange-500 to-orange-600 rounded-2xl text-white shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 flex items-center gap-2 font-bold text-sm tracking-wide"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nouveau</span>
          </button>
        </div>

        {/* Tickets List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
               <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-center space-y-4">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <MessageSquare className="w-10 h-10" />
               </div>
               <h4 className="text-lg font-black text-slate-800">Aucun ticket</h4>
               <p className="text-sm font-medium text-slate-500 max-w-[250px] mx-auto">Vous n'avez ouvert aucune réclamation ou discussion pour le moment.</p>
               <button
                 onClick={() => navigate('/tickets/new')}
                 className="mt-4 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl active:scale-95 transition-transform text-sm"
               >
                 Ouvrir un ticket
               </button>
            </div>
          ) : (
            tickets.map((tck) => {
              const isOpen = tck.status === 'open';
              const isResolved = tck.status === 'resolved';

              return (
                <button
                  key={tck.id}
                  onClick={() => navigate(`/tickets/${tck.id}`)}
                  className="w-full bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center text-left active:scale-[0.98] group"
                >
                  <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center shadow-inner ${
                    isResolved ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-orange-50 text-orange-500 border-orange-100'
                  } border`}>
                    {isResolved ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  
                  <div className="flex-1 space-y-1 w-full">
                    <div className="flex justify-between items-start gap-4">
                       <h3 className="font-bold text-slate-800 line-clamp-1">{tck.description}</h3>
                       <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg shrink-0 ${
                          isResolved ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                       }`}>
                          {isResolved ? 'Résolu' : 'En cours'}
                       </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                      <span>Ref: #{tck.id.split('-')[0]}</span>
                      <span>•</span>
                      <span>{new Date(tck.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};

export default TicketsList;
