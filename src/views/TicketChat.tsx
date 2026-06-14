import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, Clock } from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../constants';
import { fetchTicketMessages, sendTicketMessage, SupportMessage, fetchUserTickets, SupportTicket } from '../lib/ticketService';
import { supabase } from '../lib/supabase-client';
import { Db } from '../data/tables';
import { sanitizePlainText } from '../lib/security';

interface TicketChatProps {
  language: Language;
  user: UserProfile | null;
  onBack: () => void;
}

const TicketChat: React.FC<TicketChatProps> = ({ language, user, onBack }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user?.id || !id) return;

    const loadData = async () => {
      // Fetch ticket info to get status/description
      const userTickets = await fetchUserTickets(user.id!);
      const tck = userTickets.find(t => t.id === id);
      if (tck) setTicket(tck);

      // Fetch messages
      const msgs = await fetchTicketMessages(id);
      setMessages(msgs);
      setLoading(false);
    };

    loadData();
    
    // Real-time subscriptions
    const channel = supabase
      .channel(`ticket-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: Db.supportMessages, filter: `ticket_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as SupportMessage]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: Db.supportTickets, filter: `id=eq.${id}` },
        (payload) => {
          setTicket(payload.new as SupportTicket);
        }
      )
      .subscribe();

    // Fallback polling just in case real-time is disabled on the table
    const interval = setInterval(async () => {
      const msgs = await fetchTicketMessages(id);
      setMessages(msgs);
      const userTickets = await fetchUserTickets(user.id!);
      const tck = userTickets.find(t => t.id === id);
      if (tck) setTicket(tck);
    }, 10000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeMessage = sanitizePlainText(newMessage, 1200).trim();
    if (!safeMessage || !id) return;

    setSending(true);
    const success = await sendTicketMessage(id, safeMessage);
    if (success) {
      setNewMessage('');
      const msgs = await fetchTicketMessages(id);
      setMessages(msgs);
    }
    setSending(false);
  };

  if (!user || !id) return null;

  const isResolved = ticket?.status === 'resolved';
  const isClosed = ticket?.status === 'closed';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50/50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md p-4 sm:px-6 border-b border-slate-200/60 shadow-sm sticky top-0 z-10 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/tickets')} 
              className="p-2 sm:p-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 hover:text-slate-800 active:scale-95 transition-all outline-none"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="space-y-0.5">
               <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-tight leading-none line-clamp-1 max-w-[200px] sm:max-w-xs">
                 {ticket?.description || 'Ticket...'}
               </h2>
               <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <span>Ref: #{id.split('-')[0]}</span>
                  {isResolved && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle className="w-3 h-3" /> Résolu</span>}
                  {isClosed && <span className="flex items-center gap-1 text-slate-500">Fermé</span>}
                  {ticket?.status === 'open' && <span className="flex items-center gap-1 text-orange-500"><Clock className="w-3 h-3" /> En Cours</span>}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages View */}
      <div className="flex-1 overflow-y-auto p-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-4 pb-4">
          {loading ? (
             <div className="flex justify-center p-10">
                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
             </div>
          ) : messages.length === 0 ? (
             <p className="text-center text-sm font-medium text-slate-400 p-10">Aucun message</p>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_type === 'driver';
              return (
                <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-3xl text-sm font-medium leading-relaxed shadow-sm ${
                    isMe 
                      ? 'bg-gradient-to-tr from-orange-500 to-orange-600 text-white rounded-tr-sm shadow-orange-500/10' 
                      : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100 shadow-slate-200/50'
                  }`}>
                    {msg.message}
                  </div>
                  <span className={`text-[10px] font-bold mt-1 tracking-widest uppercase ${isMe ? 'text-orange-400 mr-2' : 'text-slate-400 ml-2'}`}>
                     {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-100 p-4 sm:p-6 shrink-0 z-10 shadow-up">
        {isClosed || isResolved ? (
           <div className="max-w-2xl mx-auto flex flex-col items-center justify-center gap-3 p-2">
             <p className="text-sm font-bold text-slate-500 text-center">Ce ticket est {isResolved ? 'résolu' : 'fermé'}. Vous ne pouvez plus envoyer de messages.</p>
             <button
                onClick={() => navigate('/tickets/new')}
                className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl active:scale-95 transition-transform text-sm shadow-xl shadow-slate-900/20"
             >
                Créer un nouveau ticket
             </button>
           </div>
        ) : (
          <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-end gap-3 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(sanitizePlainText(e.target.value, 1200))}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                 }
              }}
              placeholder="Écrivez votre message..."
              disabled={sending}
              className="flex-1 max-h-32 min-h-[56px] bg-slate-50/50 border border-slate-200 rounded-[1.5rem] py-4 px-6 outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none text-slate-800 placeholder:text-slate-400 text-sm font-medium disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/20 active:scale-95 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Send className="w-5 h-5 ml-1" />}
            </button>
          </form>
        )}
      </div>

    </div>
  );
};

export default TicketChat;
