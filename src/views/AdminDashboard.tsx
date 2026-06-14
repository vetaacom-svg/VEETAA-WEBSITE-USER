
import React, { useState } from 'react';
import { Order } from '../types';
import { Package, Clock, CheckCircle2, Users, MapPin, Eye } from 'lucide-react';
import { base64ToDataUrl } from '../lib/imageUtils';

interface AdminDashboardProps {
  orders: Order[];
  onUpdateStatus: (id: string, status: 'pending' | 'delivered') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ orders, onUpdateStatus }) => {
  const [tab, setTab] = useState<'new' | 'history' | 'clients'>('new');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const uniqueClients = Array.from(new Set(orders.map(o => o.phone))).map(phone => {
    return orders.find(o => o.phone === phone);
  });

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800">Admin Dashboard</h2>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
        <button
          onClick={() => setTab('new')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === 'new' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
        >
          <Package className="w-4 h-4" />
          Nouveaux ({pendingOrders.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === 'history' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
        >
          <Clock className="w-4 h-4" />
          Historique
        </button>
        <button
          onClick={() => setTab('clients')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === 'clients' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
        >
          <Users className="w-4 h-4" />
          Clients
        </button>
      </div>

      <div className="space-y-4">
        {tab === 'new' && (
          <div className="space-y-4">
            {pendingOrders.map(order => (
              <div key={order.id} className="bg-white border-2 border-orange-100 p-4 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full w-fit mb-1 uppercase tracking-tighter">Nouvelle Commande</p>
                    <h3 className="font-bold text-slate-800">#{String(order.id).slice(0, 8)} - {order.customerName}</h3>
                    <p className="text-xs text-slate-400">{new Date(order.timestamp).toLocaleString()}</p>
                  </div>
                  <span className="text-sm font-black text-slate-900">{order.total + 15} DH</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded-lg uppercase">{order.category}</span>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg uppercase">{order.paymentMethod}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" /> Détails
                  </button>
                  <button
                    onClick={() => onUpdateStatus(order.id, 'delivered')}
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Livré
                  </button>
                </div>
              </div>
            ))}
            {pendingOrders.length === 0 && <div className="text-center py-20 text-slate-400 font-medium italic">Aucune commande en attente</div>}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {deliveredOrders.map(order => (
              <div key={order.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-800">#{String(order.id).slice(0, 8)}</h4>
                  <p className="text-[10px] text-slate-400">{new Date(order.timestamp).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p>{order.total + 15} DH</p>
                  <span className="text-[10px] text-emerald-600 font-bold">LIVRÉ</span>
                </div>
              </div>
            ))}
            {deliveredOrders.length === 0 && <div className="text-center py-20 text-slate-400 font-medium italic">Historique vide</div>}
          </div>
        )}

        {tab === 'clients' && (
          <div className="space-y-3">
            {uniqueClients.map(client => client && (
              <div key={client.phone} className="bg-white border border-slate-100 p-4 rounded-3xl flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800">{client.customerName}</h4>
                  <p className="text-xs text-slate-400">{client.phone}</p>
                </div>
                <a href={`tel:${client.phone}`} className="p-3 bg-slate-100 rounded-2xl text-slate-600">
                  <Clock className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Détails */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800">Détails Commande</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 p-2">✕</button>
            </div>

            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase">Client</p>
                <p className="font-bold text-lg text-slate-800">{selectedOrder.customerName}</p>
                <p className="text-sm text-slate-500">{selectedOrder.phone}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase">Localisation</p>
                <a
                  href={`https://www.google.com/maps?q=${selectedOrder.location?.lat},${selectedOrder.location?.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-blue-600 font-bold text-sm bg-blue-50 p-3 rounded-xl border border-blue-100"
                >
                  <MapPin className="w-4 h-4" /> Ouvrir dans Google Maps
                </a>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Contenu</p>
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="py-3 border-b border-slate-100 last:border-0 space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-tighter">{item.storeName}</p>
                          <h4 className="font-bold text-slate-800 text-sm">{item.quantity}x {item.product?.name}</h4>
                        </div>
                        <span className="font-black text-slate-900 text-sm">{(item.product?.price || 0) * item.quantity} DH</span>
                      </div>

                      {item.note && (
                        <div className="bg-white p-2 rounded-xl border border-dashed border-slate-200">
                          <p className="text-[10px] text-slate-500 italic">"{item.note}"</p>
                        </div>
                      )}

                      {item.image_base64 && (
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                          <img src={base64ToDataUrl(item.image_base64)} className="w-full h-full object-cover" alt="Item photo" />
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedOrder.textOrder && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-[10px] font-bold text-slate-400 mb-1">NOTES/TEXTE</p>
                      <p className="text-xs text-slate-700 italic">"{selectedOrder.textOrder}"</p>
                    </div>
                  )}
                  {selectedOrder.prescriptionImage && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-[10px] font-bold text-slate-400 mb-1">ORDONNANCE</p>
                      <img src={base64ToDataUrl(selectedOrder.prescriptionImage)} className="w-full h-40 object-cover rounded-xl" alt="Presc" />
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
