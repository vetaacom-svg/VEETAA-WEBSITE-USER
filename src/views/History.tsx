
import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, Language } from '../types';
import { Package, RefreshCcw, ChevronRight, CheckCircle2, Clock, XCircle, PhoneCall, ArrowRight, ShoppingBag, Phone } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { getSupportNumber } from '../lib/settingsService';

interface HistoryProps {
  language: Language;
  orders: Order[];
  onOrderAgain: (order: Order) => void;
  onTrack?: (order: Order) => void;
}

const History: React.FC<HistoryProps> = ({ language, orders, onOrderAgain, onTrack }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const [supportNumber, setSupportNumber] = useState('+212600000000');

  useEffect(() => {
    // Fetch support number
    getSupportNumber().then(setSupportNumber);
  }, []);

  const FINAL_STATUSES: OrderStatus[] = ['delivered', 'livree', 'refused', 'refusee', 'unavailable', 'indisponible'];
  const isOrderFinal = (status: OrderStatus) => FINAL_STATUSES.includes(status);
  const activeOrders = orders.filter((o) => !isOrderFinal(o.status));
  const historyOrders = orders.filter((o) => isOrderFinal(o.status));

  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'delivered':
      case 'livree':
        return {
          label: t('statusDelivered'),
          color: 'text-emerald-500 bg-emerald-50 border-emerald-100',
          icon: <CheckCircle2 className="w-3 h-3" />,
          isFinal: true,
          badgeColor: 'bg-emerald-500'
        };
      case 'refused':
      case 'refusee':
        return {
          label: t('statusRefused'),
          color: 'text-red-500 bg-red-50 border-red-100',
          icon: <XCircle className="w-3 h-3" />,
          isFinal: true,
          badgeColor: 'bg-red-500'
        };
      case 'unavailable':
      case 'indisponible':
        return {
          label: t('indisponible'),
          color: 'text-amber-600 bg-amber-50 border-amber-100',
          icon: <XCircle className="w-3 h-3" />,
          isFinal: true,
          badgeColor: 'bg-amber-500'
        };
      default:
        return {
          label: t('statusInProgress'),
          color: 'text-orange-500 bg-orange-50 border-orange-100',
          icon: <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />,
          isFinal: false,
          badgeColor: 'bg-orange-500'
        };
    }
  };

  const renderOrderCard = (order: Order) => {
    const config = getStatusConfig(order.status);
    return (
      <div key={order.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm space-y-5 transition-all hover:shadow-md">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${config.badgeColor} text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg`}>
              {order.storeName ? order.storeName[0] : 'V'}
            </div>
            <div>
              <h3 className="font-black text-slate-800 tracking-tight">{order.storeName || 'Veetaa Express'}</h3>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                <Clock className="w-3 h-3" />
                ID: <span className="text-slate-900 font-bold">{String(order.id).slice(0, 8)}</span> • {new Date(order.timestamp).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-1 justify-end text-[9px] font-black px-2 py-0.5 rounded-full border ${config.color}`}>
              {config.icon}
              {config.label}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">{t('orderProducts')}</p>
          <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-50 space-y-3">
            {order.items.length > 0 ? order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">{item.quantity}x {item.product?.name}</span>
                </div>
                <span className="text-xs font-black text-slate-400">{(item.product?.price || 0) * item.quantity} DH</span>
              </div>
            )) : (
              <p className="text-xs font-bold text-slate-500 italic">Commande par texte/image</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {!config.isFinal ? (
            <>
              <button
                onClick={() => onTrack?.(order)}
                className="flex-1 bg-orange-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-orange-100"
              >
                {t('trackDelivery')}
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={`tel:${supportNumber}`}
                className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-xl gap-2 px-6"
              >
                <Phone className="w-4 h-4 text-orange-400" />
                <span className="text-[9px] font-black uppercase tracking-widest">{t('support')}</span>
              </a>
            </>
          ) : (
            <button
              onClick={() => onOrderAgain(order)}
              className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-slate-100"
            >
              <RefreshCcw className="w-4 h-4" />
              {t('reorder')}
            </button>
          )}
        </div>
      </div>
    );
  };

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 opacity-50">
      <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center">
        <ShoppingBag className="w-10 h-10 text-slate-300" />
      </div>
      <p className="text-slate-500 font-bold max-w-[200px]">{t('startOrdering')}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-24">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('myOrdersHistory')}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeOrders.length + historyOrders.length} {t('orders')}</p>
        </div>
      </div>

      {activeOrders.length === 0 && historyOrders.length === 0 ? (
        emptyState
      ) : (
        <div className="space-y-8">
          {/* Active orders (in progress) – Track / Support */}
          {activeOrders.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest px-1">{t('activeOrders')}</h3>
              <div className="space-y-6">{activeOrders.map(renderOrderCard)}</div>
            </div>
          )}

          {/* History (delivered / refused) – Reorder only */}
          {historyOrders.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest px-1">
                {language === 'ar' ? 'السجل' : language === 'en' ? 'History' : 'Historique'}
              </h3>
              <div className="space-y-6">{historyOrders.map(renderOrderCard)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default History;
