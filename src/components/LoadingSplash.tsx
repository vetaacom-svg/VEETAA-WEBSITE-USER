import React from 'react';

const LoadingSplash: React.FC = () => (
  <div className="fixed inset-0 bg-white z-[99999] flex flex-col items-center justify-center gap-8 animate-in fade-in duration-500">
    <div className="relative">
      <div className="w-24 h-24 border-8 border-slate-100 border-t-orange-500 rounded-full animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
          <div className="w-6 h-6 bg-orange-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
    <div className="space-y-2 text-center">
      <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase animate-pulse">Veetaa</h2>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Initialisation du catalogue...</p>
    </div>
  </div>
);

export default LoadingSplash;
