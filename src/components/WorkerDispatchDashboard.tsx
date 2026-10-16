import React, { useState } from 'react';
import {
  Users,
  Bell,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  ExternalLink,
  ShieldCheck,
  Send,
  Search,
  Filter,
  DollarSign,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Wrench,
  Calculator,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { calculateDoorstepPricing } from '../services/pricingEngine';

interface WorkerDispatchDashboardProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, txnId?: string) => void;
  botToken: string;
  workerChatId: string;
}

export const WorkerDispatchDashboard: React.FC<WorkerDispatchDashboardProps> = ({
  orders,
  onUpdateOrderStatus,
  botToken,
  workerChatId,
}) => {
  const [filterMarketplace, setFilterMarketplace] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(orders[0] || null);
  const [telebirrInput, setTelebirrInput] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick Worker Calculation Helper (/calc) tool state
  const [showWorkerCalc, setShowWorkerCalc] = useState<boolean>(true);
  const [calcUsd, setCalcUsd] = useState<number>(14.50);
  const [calcWeight, setCalcWeight] = useState<number>(0.35);

  const calcPricing = calculateDoorstepPricing(calcUsd, calcWeight);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesMarketplace =
      filterMarketplace === 'all' || order.item.product.marketplace === filterMarketplace;
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch =
      searchQuery === '' ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerPhone.includes(searchQuery) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.deliveryLandmark.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMarketplace && matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending_deposit':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            25% ቴሌብር ይጠበቃል
          </span>
        );
      case 'deposit_verified':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            ተረጋግጧል (Verified)
          </span>
        );
      case 'procured_in_china':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
            <Package className="w-3 h-3" />
            ከቻይና ተገዝቷል
          </span>
        );
      case 'freight_in_transit':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <Truck className="w-3 h-3" />
            በበረራ ላይ (Air Cargo)
          </span>
        );
      case 'customs_clearing':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            ቦሌ ጉምሩክ ክሊራንስ
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            ቤት ለቤት በመጓዝ ላይ
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            ተረክቧል (Delivered)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Users className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              የኮርቻ ሰራተኞች ዴስክ (Korcha Dispatch Desk)
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            የደንበኞች ትዕዛዝና ማሳሰቢያ ክፍል
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ደንበኞች በቴሌግራም ቦት ላይ ደንቦቹን እንደተስማሙ ወዲያውኑ የሚደርሱ ትዕዛዞች እዚህ ይሰባሰባሉ።
          </p>
        </div>

        {/* Worker Telegram Group Connection Status */}
        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <span className="text-slate-400 block text-[10px]">የሰራተኞች ቴሌግራም ግሩፕ:</span>
            <span className="font-bold text-white">
              {workerChatId ? `Linked (${workerChatId})` : 'Active / Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* 🛠️ Worker Calculation Helper Panel (/calc command & estimator helper) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <button
          type="button"
          onClick={() => setShowWorkerCalc(!showWorkerCalc)}
          className="w-full p-4 bg-slate-850 hover:bg-slate-800/80 border-b border-slate-800 flex items-center justify-between text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Calculator className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🧮 የሰራተኛ ዋጋ ማስያ ረዳት (Worker /calc Helper Panel)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  Tool
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                ደንበኛው የላከውን ሊንክ ወይም ስክሪንሾት ዋጋ እዚህ በማስላት የደጃፍ ዋጋውን ወዲያውኑ ወደ ደንበኛው ይላኩ
              </p>
            </div>
          </div>
          {showWorkerCalc ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showWorkerCalc && (
          <div className="p-5 space-y-4 bg-slate-900/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  የእቃው ዶላር ዋጋ (USD Price in $):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    value={calcUsd}
                    onChange={(e) => setCalcUsd(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  የእቃው ክብደት በኪሎግራም (Weight in kg):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(parseFloat(e.target.value) || 0.1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">kg</span>
                </div>
              </div>
            </div>

            {/* Live calculation breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">የመሰረት ዋጋ:</span>
                <span className="text-sm font-mono font-bold text-sky-400">{calcPricing.baseEtbAmount.toLocaleString()} ETB</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">+27% አቅራቢ:</span>
                <span className="text-sm font-mono font-bold text-amber-400">+{calcPricing.supplierFeeEtb.toLocaleString()} ETB</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">ካርጎ (1,000/kg):</span>
                <span className="text-sm font-mono font-bold text-sky-400">+{calcPricing.cargoCostEtb.toLocaleString()} ETB</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">+54% ማድረሻ:</span>
                <span className="text-sm font-mono font-bold text-amber-400">+{calcPricing.deliveryFeeEtb.toLocaleString()} ETB</span>
              </div>
            </div>

            {/* Total and 25% Deposit */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block font-semibold">ጠቅላላ የደጃፍ ዋጋ (Door Price):</span>
                <span className="text-2xl font-black text-amber-400">{calcPricing.totalPriceEtb.toLocaleString()} ብር</span>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-emerald-400 block font-bold">25% ቅድመ ክፍያ:</span>
                  <span className="text-xl font-black text-emerald-300">{calcPricing.depositAmountEtb.toLocaleString()} ብር</span>
                </div>
                <div>
                  <span className="text-xs text-sky-400 block font-bold">75% በር ላይ (COD):</span>
                  <span className="text-xl font-black text-white">{calcPricing.codAmountEtb.toLocaleString()} ብር</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const snippet = `🧮 የዋጋ ስሌት ረዳት ውጤት:\n💵 የእቃ ዋጋ: $${calcUsd} USD (~${calcPricing.baseEtbAmount.toLocaleString()} ETB)\n📦 ክብደት: ${calcWeight} kg (ጭነት: ${calcPricing.cargoCostEtb.toLocaleString()} ETB)\n💰 ጠቅላላ የደጃፍ ዋጋ: ${calcPricing.totalPriceEtb.toLocaleString()} ብር\n💳 25% ቅድመ ክፍያ: ${calcPricing.depositAmountEtb.toLocaleString()} ብር\n🚚 75% ቀሪ ክፍያ: ${calcPricing.codAmountEtb.toLocaleString()} ብር`;
                  handleCopy(snippet, 'calc-snippet');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === 'calc-snippet' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'calc-snippet' ? 'ተቀድቷል!' : 'ስሌቱን ለቴሌግራም ቅዳ'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="የትዕዛዝ ቁጥር፣ ስልክ፣ አድራሻ ይፈልጉ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">ሱቅ:</span>
          <select
            value={filterMarketplace}
            onChange={(e) => setFilterMarketplace(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none"
          >
            <option value="all">ሁሉም ሱቆች</option>
            <option value="shein">Shein (ሼይን)</option>
            <option value="temu">Temu (ቴሙ)</option>
            <option value="aliexpress">AliExpress</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">ሁኔታ:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none"
          >
            <option value="all">ሁሉም ደረጃዎች</option>
            <option value="pending_deposit">ቅድመ ክፍያ በመጠባበቅ ላይ</option>
            <option value="deposit_verified">ክፍያ ተረጋግጧል</option>
            <option value="procured_in_china">ከቻይና ተገዝቷል</option>
            <option value="freight_in_transit">በበረራ ላይ</option>
            <option value="customs_clearing">ቦሌ ጉምሩክ</option>
            <option value="out_for_delivery">ቤት ለቤት በመጓዝ ላይ</option>
            <option value="delivered">ተረክቧል</option>
          </select>
        </div>
      </div>

      {/* Orders Grid & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Orders List (5 cols) */}
        <div className="lg:col-span-5 space-y-3 max-h-[700px] overflow-y-auto pr-1">
          {filteredOrders.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-500" />
              <p className="text-sm font-semibold">ምንም ትዕዛዝ አልተገኘም</p>
              <p className="text-xs text-slate-500 mt-1">
                በቴሌግራም ቦት ላይ እቃ መርምረው ትዕዛዝ ሲያረጋግጡ እዚህ ይታያል።
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-850 border-amber-500 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        #{order.orderNumber}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-950 text-slate-300 border border-slate-800">
                        {order.item.product.marketplace}
                      </span>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <h4 className="text-xs font-bold text-white line-clamp-1 mb-1">
                    {order.item.product.title}
                  </h4>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                    <span>📏 {order.item.selectedSize || 'Std'}</span>
                    <span>•</span>
                    <span>🎨 {order.item.selectedColor || 'Default'}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      {order.customerPhone}
                    </span>
                    <span className="font-bold text-amber-400">
                      {order.item.pricing.totalPriceEtb.toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Order Detailed Workspace (7 cols) */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Order Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">
                      ትዕዛዝ #{selectedOrder.orderNumber}
                    </h3>
                    <button
                      onClick={() => handleCopy(selectedOrder.orderNumber, 'ord-num')}
                      className="text-slate-400 hover:text-white"
                      title="Copy Order ID"
                    >
                      {copiedId === 'ord-num' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <span className="text-xs text-slate-400">
                    የተመዘገበበት ቀን: {new Date(selectedOrder.createdAt).toLocaleString()}
                  </span>
                </div>

                <div>{getStatusBadge(selectedOrder.status)}</div>
              </div>

              {/* Product Info & Image */}
              <div className="flex gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <img
                  src={selectedOrder.item.product.imageUrl}
                  alt={selectedOrder.item.product.title}
                  className="w-24 h-24 rounded-lg object-cover border border-slate-700/80"
                />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider">
                      {selectedOrder.item.product.marketplace} • {selectedOrder.item.product.category}
                    </span>
                    <h4 className="text-sm font-bold text-white line-clamp-2 mt-0.5">
                      {selectedOrder.item.product.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedOrder.item.product.titleAmharic}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-400">
                      ብዛት: <b className="text-white">{selectedOrder.item.quantity}x</b>
                    </span>
                    <a
                      href={selectedOrder.item.product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      <span>የቻይና ሊንክ ክፈት</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Size, Color, and Choices badges for Worker */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 mt-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-medium text-amber-300">
                      📏 መጠን: <b>{selectedOrder.item.selectedSize || 'Standard'}</b>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-[11px] font-medium text-sky-300">
                      🎨 ቀለም: <b>{selectedOrder.item.selectedColor || 'Default'}</b>
                    </span>
                    {selectedOrder.notes && (
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300">
                        📝 {selectedOrder.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Customer Contact & Landmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    የደንበኛ መረጃ (Customer)
                  </span>
                  <div className="text-sm font-semibold text-white">
                    {selectedOrder.customerName}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{selectedOrder.customerPhone}</span>
                  </div>
                  <div className="text-xs text-sky-400 font-mono">
                    {selectedOrder.customerTelegramUser || '@ethio_customer'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    የማድረሻ አድራሻና ምልክት (Delivery Landmark)
                  </span>
                  <div className="text-sm font-semibold text-white">
                    {selectedOrder.deliveryCity}፣ {selectedOrder.deliverySubcity}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{selectedOrder.deliveryLandmark}</span>
                  </div>
                </div>
              </div>

              {/* Pricing Math Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  የዋጋና የክፍያ ስሌት (1.88x Landed Formula)
                </span>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">የእቃው ዶላር</span>
                    <span className="text-xs font-bold text-white">
                      ${selectedOrder.item.pricing.originalPriceUsd} USD
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-emerald-400 block">{selectedOrder.item.pricing.depositPercent || 40}% ቴሌብር ቅድመ</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {selectedOrder.item.pricing.depositAmountEtb.toLocaleString()} ብር
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-amber-400 block">ጠቅላላ የበር ላይ ዋጋ</span>
                    <span className="text-xs font-bold text-amber-400">
                      {selectedOrder.item.pricing.totalPriceEtb.toLocaleString()} ብር
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions & Status Changer for Korcha Workers */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  የትዕዛዝ ሁኔታ መቀየሪያ (Update Lifecycle Status)
                </h4>

                {/* Telebirr Verification Box if Pending */}
                {selectedOrder.status === 'pending_deposit' && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      placeholder="የቴሌብር ትራንዛክሽን ቁጥር (ለምሳሌ: TB98231902)"
                      value={telebirrInput}
                      onChange={(e) => setTelebirrInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => {
                        onUpdateOrderStatus(
                          selectedOrder.id,
                          'deposit_verified',
                          telebirrInput || 'TB-CONFIRMED'
                        );
                        setTelebirrInput('');
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap transition-colors"
                    >
                      የቅድመ ክፍያ አረጋግጥ
                    </button>
                  </div>
                )}

                {/* Status Advancement Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'procured_in_china')}
                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 text-xs font-medium transition-colors"
                  >
                    1. ከቻይና ታዘዘ (Procured)
                  </button>
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'freight_in_transit')}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 text-xs font-medium transition-colors"
                  >
                    2. በበረራ ላይ (Air Cargo)
                  </button>
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'customs_clearing')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-medium transition-colors"
                  >
                    3. ቦሌ ጉምሩክ ደረሰ (Customs)
                  </button>
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'out_for_delivery')}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 text-xs font-medium transition-colors"
                  >
                    4. ደጃፍ ማድረስ (Out for Delivery)
                  </button>
                  <button
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, 'delivered')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium transition-colors"
                  >
                    5. ተጠናቀቀ (Delivered)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              ዝርዝር ለማየት ከግራ በኩል ትዕዛዝ ይምረጡ
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
