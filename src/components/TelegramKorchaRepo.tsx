import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export const TelegramKorchaRepo: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                የቴሌግራም ቦት (E-Commerce Telegram Bot)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span>Repository details removed from UI</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Korcha • Bot Information</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              For security and privacy the direct repository links and clone commands have been removed from the public user interface. If you need deployment instructions or code access, use your private admin dashboard or the project maintainer's internal channels.
            </p>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1.5">
            <span>Repository links hidden</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <h4 className="text-sm font-bold text-white">Python Scraper</h4>
          <p className="text-xs text-slate-400 leading-relaxed">The scraper ingests marketplace product pages and extracts images, titles and prices for worker review.</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <h4 className="text-sm font-bold text-white">Pricing Rules</h4>
          <p className="text-xs text-slate-400 leading-relaxed">Pricing uses the configured landed multiplier and official exchange rate to estimate doorstep ETB values.</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <h4 className="text-sm font-bold text-white">Support Chat</h4>
          <p className="text-xs text-slate-400 leading-relaxed">Customers can message the in-app worker chat for support and price verification.</p>
        </div>
      </div>
    </div>
  );
};
