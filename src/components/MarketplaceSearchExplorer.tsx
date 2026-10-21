import React, { useState } from 'react';
import {
  Search,
  ExternalLink,
  ArrowRight,
  ShoppingBag,
  Tag,
  Copy,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { Marketplace, ParsedProduct } from '../types';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { calculateDoorstepPricing } from '../services/pricingEngine';

interface MarketplaceSearchExplorerProps {
  officialRate: number;
  onSelectProductForEstimation: (product: ParsedProduct) => void;
}

export const MarketplaceSearchExplorer: React.FC<MarketplaceSearchExplorerProps> = ({
  officialRate,
  onSelectProductForEstimation,
}) => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredProducts = SAMPLE_PRODUCTS.filter((product) => {
    const matchesMarketplace =
      selectedMarketplace === 'all' || product.marketplace === selectedMarketplace;
    const matchesCategory =
      activeCategory === 'all' || product.category.toLowerCase().includes(activeCategory.toLowerCase());
    const matchesQuery =
      searchQuery.trim() === '' ||
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.titleAmharic && product.titleAmharic.toLowerCase().includes(searchQuery.toLowerCase())) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesMarketplace && matchesCategory && matchesQuery;
  });

  const getDirectSearchUrl = (marketplace: Marketplace, query: string) => {
    const encoded = encodeURIComponent(query.trim() || 'trending');
    if (marketplace === 'shein') {
      return `https://www.shein.com/search?keyword=${encoded}`;
    }
    if (marketplace === 'temu') {
      return `https://www.temu.com/search_result.html?search_key=${encoded}`;
    }
    return `https://www.aliexpress.com/wholesale?SearchText=${encoded}`;
  };

  const copyProductLink = (url: string, id: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner & Search Options */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              የገበያ ቦታዎች መፈለጊያ (Search Shein • Temu • AliExpress)
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            የሚፈልጉትን እቃ ከተለያዩ የዓለም አቀፍ ገበያ ሱቆች ይፈልጉ
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            ከተለያዩ የገበያ ቦታዎች የሚፈልጉትን እቃ ይፈልጉ። እቃውን ከመረጡ በኋላ ሊንኩን ኮፒ (Copy) አድርገው ወደ <b>«ዋጋ ማስያ»</b> ወይም ወደ <b>«ቴሌግራም ቦት»</b> በመውሰድ የኢትዮጵያ ብር ዋጋውን በቅጽበት ማወቅ ይችላሉ።
          </p>
        </div>

        {/* 3 Marketplace Search Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6">
          <button
            onClick={() => setSelectedMarketplace('all')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
              selectedMarketplace === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <span className="text-xs sm:text-sm font-bold block">ሁሉም ሱቆች (All)</span>
            <span className="text-[10px] opacity-80">Shein, Temu, AliExpress</span>
          </button>

          <button
            onClick={() => setSelectedMarketplace('shein')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
              selectedMarketplace === 'shein'
                ? 'bg-pink-600 text-white font-bold border-pink-400 shadow-lg shadow-pink-600/20'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-pink-500/30 flex items-center justify-center text-xs">👗</span>
              <span className="text-xs sm:text-sm font-bold">Shein Search</span>
            </div>
            <span className="text-[10px] text-pink-300/80">ፋሽን፣ ቀሚስ፣ ጫማ</span>
          </button>

          <button
            onClick={() => setSelectedMarketplace('temu')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
              selectedMarketplace === 'temu'
                ? 'bg-orange-600 text-white font-bold border-orange-400 shadow-lg shadow-orange-600/20'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-orange-500/30 flex items-center justify-center text-xs">⚡</span>
              <span className="text-xs sm:text-sm font-bold">Temu Search</span>
            </div>
            <span className="text-[10px] text-orange-300/80">ኤሌክትሮኒክስ፣ የቤት እቃ</span>
          </button>

          <button
            onClick={() => setSelectedMarketplace('aliexpress')}
            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
              selectedMarketplace === 'aliexpress'
                ? 'bg-red-600 text-white font-bold border-red-400 shadow-lg shadow-red-600/20'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-red-500/30 flex items-center justify-center text-xs">📱</span>
              <span className="text-xs sm:text-sm font-bold">AliExpress Search</span>
            </div>
            <span className="text-[10px] text-red-300/80">ቴክኖሎጂ፣ ጋጄት፣ ሰዓት</span>
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products (e.g. dress, sneakers, wireless earbuds, watch, ቀሚስ, ጫማ)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Direct Search on Marketplace External Link */}
          {selectedMarketplace !== 'all' ? (
            <a
              href={getDirectSearchUrl(selectedMarketplace, searchQuery)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all whitespace-nowrap"
            >
              <span>በ {selectedMarketplace.toUpperCase()} ላይ ፈልግ (Reroute)</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href={`https://www.shein.com/search?keyword=${encodeURIComponent(searchQuery || 'trending')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-pink-300 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <span>👗 Shein</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://www.temu.com/search_result.html?search_key=${encodeURIComponent(searchQuery || 'trending')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-orange-300 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <span>⚡ Temu</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(searchQuery || 'trending')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-red-300 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <span>📱 Ali</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Quick Category Filters */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto no-scrollbar pb-1 text-xs">
          <span className="text-slate-400 shrink-0 flex items-center gap-1 font-semibold">
            <Tag className="w-3.5 h-3.5 text-amber-400" /> ፈጣን ምርጫ:
          </span>
          {[
            { id: 'all', label: 'ሁሉም (All)' },
            { id: 'dress', label: 'ቀሚሶች (Dresses)' },
            { id: 'hoodie', label: 'ሁዲዎችና ሸሚዝ' },
            { id: 'electronics', label: 'ኤሌክትሮኒክስ (Electronics)' },
            { id: 'kitchen', label: 'የቤትና ኩሽና' },
            { id: 'watch', label: 'የእጅ ሰዓቶች' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                  : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product Results Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>የተገኙ እቃዎች ({filteredProducts.length})</span>
            <span className="text-xs font-normal text-slate-400">
              የመረጡትን እቃ ሊንክ ይቅዱ ወይም ወደ ዋጋ ማስያ ይውሰዱ
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((product) => {
            const pricing = calculateDoorstepPricing(product.originalPriceUsd, officialRate);
            const isCopied = copiedId === product.id;

            return (
              <div
                key={product.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg transition-all group flex flex-col justify-between"
              >
                <div>
                  {/* Product Image */}
                  <div className="relative h-52 bg-slate-950 overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-sm text-[11px] font-bold uppercase tracking-wider text-amber-300 border border-slate-800">
                      {product.marketplace}
                    </div>
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-sm text-[11px] font-semibold text-slate-300">
                      {product.category}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-5">
                    <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug">
                      {product.title}
                    </h4>
                    {product.titleAmharic && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {product.titleAmharic}
                      </p>
                    )}

                    {/* Clean Customer Pricing (No confusing math) */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-400 font-medium">የበር ላይ ጠቅላላ ዋጋ:</span>
                        <span className="text-base font-black text-amber-400">
                          {pricing.totalPriceEtb.toLocaleString()} ብር
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                        <span className="text-emerald-400 font-medium">የ {pricing.depositPercent || 40}% ቅድመ ክፍያ:</span>
                        <span className="font-bold text-emerald-400">
                          {pricing.depositAmountEtb.toLocaleString()} ብር
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>ቀሪ {pricing.codPercent || 60}% እቃው ሲደርስ:</span>
                        <span className="font-semibold text-slate-300">
                          {pricing.codAmountEtb.toLocaleString()} ብር
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions: Send to Estimator, Copy Link, Open External Site */}
                <div className="p-5 pt-0 space-y-2">
                  <button
                    onClick={() => onSelectProductForEstimation(product)}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <span>የሰራተኛ ዋጋ ስሌት ጠይቅ (Request Worker Quote)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyProductLink(product.url, product.id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700/60 transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">ሊንኩ ተቀድቷል!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>ሊንኩን ቅዳ (Copy Link)</span>
                        </>
                      )}
                    </button>

                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
                      title="Open on Marketplace"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
