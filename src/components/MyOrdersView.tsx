import React, { useState } from 'react';
import {
  Package,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  ShieldCheck,
  Calendar,
  Phone,
  ArrowRight,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface OrderTrackerProps {
  orders: Order[];
  onSelectOrder?: (order: Order) => void;
}

export const OrderTracker: React.FC<OrderTrackerProps> = ({ orders }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(orders[0] || null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toLowerCase();
    const found = orders.find(
      (o) =>
        o.orderNumber.toLowerCase() === query ||
        o.orderNumber.toLowerCase().replace('kc-', '') === query ||
        o.customerPhone.includes(query)
    );

    if (found) {
      setSelectedOrder(found);
      setSearchError(null);
    } else {
      setSearchError('የትዕዛዝ ቁጥሩ ወይም ስልኩ አልተገኘም። እባክዎ በትክክል መፃፉን ያረጋግጡ።');
    }
  };

  const stages: {
    key: OrderStatus;
    titleAmharic: string;
    titleEnglish: string;
    icon: any;
    desc: string;
  }[] = [
    {
      key: 'pending_deposit',
      titleAmharic: 'የቅድመ ክፍያ ማረጋገጫ',
      titleEnglish: 'Deposit Verification',
      icon: Clock,
      desc: 'የቴሌብር ወይም የባንክ ክፍያ በኮርቻ ሰራተኞች በመረጋገጥ ላይ ነው።',
    },
    {
      key: 'deposit_verified',
      titleAmharic: 'ክፍያ ተረጋግጧል',
      titleEnglish: 'Payment Confirmed',
      icon: CheckCircle2,
      desc: 'ቅድመ ክፍያው ተረጋግጦ ትዕዛዝዎ ወደ ግዢ ክፍል ተላልፏል።',
    },
    {
      key: 'procured_in_china',
      titleAmharic: 'ከዓለም አቀፍ ገበያዎች ተገዝቷል',
      titleEnglish: 'Procured from Global Markets',
      icon: Package,
      desc: 'እቃው ከፋብሪካው ተገዝቶ ወደ ጓንግዡ መጋዘን ገብቷል።',
    },
    {
      key: 'freight_in_transit',
      titleAmharic: 'በአየር ጭነት በረራ ላይ',
      titleEnglish: 'Air Cargo to Bole Addis',
      icon: Truck,
      desc: 'የኢትዮጵያ አየር መንገድ ጭነት በረራ ወደ ቦሌ አየር ማረፊያ በመብረር ላይ ነው።',
    },
    {
      key: 'customs_clearing',
      titleAmharic: 'ቦሌ ጉምሩክ ክሊራንስ',
      titleEnglish: 'Customs Clearance',
      icon: ShieldCheck,
      desc: 'የጉምሩክ ፍተሻና የክሊራንስ ሰነዶች በማጠናቀቅ ላይ ናቸው።',
    },
    {
      key: 'out_for_delivery',
      titleAmharic: 'ቤት ለቤት በመጓዝ ላይ',
      titleEnglish: 'Out for Door Delivery',
      icon: MapPin,
      desc: 'የኮርቻ አሽከርካሪ እቃውን ወደ መኖሪያ ምልክትዎ ይዞ ወጥቷል።',
    },
    {
      key: 'delivered',
      titleAmharic: 'ተረክቧል',
      titleEnglish: 'Delivered',
      icon: CheckCircle2,
      desc: 'እቃው ደርሶ ቀሪ 75% ክፍያ ተፈጽሟል።',
    },
  ];

  const getStageIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending_deposit':
        return 0;
      case 'deposit_verified':
        return 1;
      case 'procured_in_china':
        return 2;
      case 'freight_in_transit':
        return 3;
      case 'customs_clearing':
        return 4;
      case 'out_for_delivery':
        return 5;
      case 'delivered':
        return 6;
      default:
        return 0;
    }
  };

  const currentStageIdx = selectedOrder ? getStageIndex(selectedOrder.status) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Search Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
            የትዕዛዝ መከታተያ (Live Order Tracker)
          </span>
          <h2 className="text-2xl font-black text-white">የእቃዎን ጉዞ ይከታተሉ</h2>
          <p className="text-xs text-slate-400 mt-1">
            የትዕዛዝ መለያ ቁጥርዎን (ለምሳሌ: KC-849102) ወይም ስልክ ቁጥርዎን በማስገባት እቃዎ የት እንደደረሰ በቅጽበት ይወስኑ።
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="የትዕዛዝ ቁጥር (e.g. KC-849102) ወይም ስልክ ያስገቡ..."
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>ፈልግ (Track)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {searchError && (
          <div className="p-3 rounded-xl bg-red-950/40 text-red-300 border border-red-900/40 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Quick select from recent orders */}
        <div className="pt-2 border-t border-slate-800 flex items-center gap-2 flex-wrap text-xs text-slate-400">
          <span>የሙከራ ትዕዛዞች:</span>
          {orders.slice(0, 3).map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setSelectedOrder(o);
                setSearchError(null);
              }}
              className={`px-3 py-1 rounded-xl transition-colors ${
                selectedOrder?.id === o.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              #{o.orderNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Order Tracking Card */}
      {selectedOrder ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
          {/* Top Status & Item Summary */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <img
                src={selectedOrder.item.product.imageUrl}
                alt={selectedOrder.item.product.title}
                className="w-20 h-20 rounded-2xl object-cover border border-slate-800"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-black text-amber-400">
                    #{selectedOrder.orderNumber}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                    {selectedOrder.item.product.marketplace}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white line-clamp-1 mt-0.5">
                  {selectedOrder.item.product.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  የማድረሻ አድራሻ: {selectedOrder.deliveryCity}፣ {selectedOrder.deliverySubcity} ({selectedOrder.deliveryLandmark})
                </p>
              </div>
            </div>

            {/* Clean Landed Birr Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center gap-6 min-w-[220px]">
              <div>
                <span className="text-[11px] text-slate-400 block">ጠቅላላ የበር ላይ ዋጋ:</span>
                <span className="text-lg font-black text-amber-400">
                  {selectedOrder.item.pricing.totalPriceEtb.toLocaleString()} ብር
                </span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-[11px] text-slate-400 block">ቀሪ ሲደርስ:</span>
                <span className="text-sm font-bold text-slate-200">
                  {selectedOrder.item.pricing.codAmountEtb.toLocaleString()} ብር
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Timeline Progress */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              የትዕዛዝ ሂደት ደረጃዎች (Shipment Progress Timeline)
            </h4>

            <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
              {stages.map((stg, idx) => {
                const isCompleted = idx <= currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                const Icon = stg.icon;

                return (
                  <div key={stg.key} className="relative flex items-start gap-4">
                    {/* Circle Node */}
                    <div
                      className={`absolute -left-6 sm:-left-8 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950 font-bold ring-4 ring-amber-500/20'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-950 text-slate-600 border border-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    {/* Stage Content */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h5
                          className={`text-sm font-bold ${
                            isCurrent
                              ? 'text-amber-400'
                              : isCompleted
                              ? 'text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          {stg.titleAmharic}
                        </h5>
                        <span className="text-[10px] text-slate-400">
                          ({stg.titleEnglish})
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            የአሁኑ ደረጃ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {stg.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Need help footer */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              ትዕዛዝዎን በተመለከተ ተጨማሪ ጥያቄ አለዎት?
            </span>
            <a
              href="https://t.me/korcha_support"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>የደንበኞች ድጋፍ (@korcha_support)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
          የትዕዛዝ ቁጥርዎን በማስገባት ፈልግ የሚለውን ይጫኑ
        </div>
      )}
    </div>
  );
};

