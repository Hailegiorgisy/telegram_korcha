// src/components/MerchantPortal.tsx: Merchant Intake Portal for local suppliers
import React, { useState } from 'react';
import { Package, Send, Upload, Clock, ShoppingBag } from 'lucide-react';

interface MerchantPortalProps {
  onOpenChatWithWorker?: (ticketCode: string) => void;
  workerUsername?: string;
}

export const MerchantPortal: React.FC<MerchantPortalProps> = ({
  onOpenChatWithWorker,
  workerUsername = 'korcha_support',
}) => {
  const [productName, setProductName] = useState('');
  const [askingPriceEtb, setAskingPriceEtb] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !askingPriceEtb || !phone.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/merchant/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim(),
          askingPriceEtb: Number(askingPriceEtb),
          quantityAtHand: Number(quantity),
          merchantPhone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmittedCode(data.ticketCode);
      }
    } catch (_) {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-2xl shadow-xs border border-stone-200 space-y-3">
      <div className="flex items-center space-x-2 border-b border-stone-100 pb-2">
        <ShoppingBag className="w-4 h-4 text-amber-600" />
        <h3 className="font-extrabold text-xs text-stone-900">የነጋዴ እና የአቅራቢ እቃ ማስገቢያ (Merchant Portal)</h3>
      </div>
      {submittedCode ? (
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
          <p className="font-bold text-emerald-900">እቃዎ በተሳካ ሁኔታ ተመዝግቧል!</p>
          <p>ኮድ፡ <b>{submittedCode}</b></p>
          <p className="text-[11px] text-emerald-700">ሰራተኛችን @{workerUsername} ገምግሞ ምላሽ ይሰጥዎታል።</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-stone-700 mb-0.5">የእቃ ስም</label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="ምሳሌ፡ የሴቶች ጫማ"
              className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-stone-700 mb-0.5">ዋጋ በብር (ETB)</label>
              <input
                type="number"
                required
                value={askingPriceEtb}
                onChange={(e) => setAskingPriceEtb(e.target.value)}
                placeholder="2500"
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-700 mb-0.5">ያለዎት ብዛት</label>
              <input
                type="number"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-stone-700 mb-0.5">ስልክ ቁጥር</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09... / 07..."
              className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl"
          >
            {isSubmitting ? 'እየተመዘገበ ነው...' : 'እቃውን አስገባ'}
          </button>
        </form>
      )}
    </div>
  );
};

export default MerchantPortal;
