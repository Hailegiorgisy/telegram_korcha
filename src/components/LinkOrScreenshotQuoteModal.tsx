// src/components/LinkOrScreenshotQuoteModal.tsx: Modal for ordering via link or photo
import React, { useState } from 'react';
import { X, Link as LinkIcon, Camera, Send, Sparkles, AlertCircle, ShoppingBag, CheckCircle2 } from 'lucide-react';

interface LinkOrScreenshotQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'link' | 'screenshot';
  preferredPayment?: 'telebirr' | 'cbe_birr';
  onQuoteSubmitted?: (quoteCode: string, phone: string) => void;
  onOpenMessagesTab?: (quoteCode: string) => void;
}

export const LinkOrScreenshotQuoteModal: React.FC<LinkOrScreenshotQuoteModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'link',
  preferredPayment = 'telebirr',
  onQuoteSubmitted,
  onOpenMessagesTab,
}) => {
  const [mode, setMode] = useState<'link' | 'screenshot'>(initialMode);
  const [productUrl, setProductUrl] = useState('');
  const [marketplace, setMarketplace] = useState('Shein');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [details, setDetails] = useState('');
  const [phone, setPhone] = useState(() => {
    try { return localStorage.getItem('korcha_customer_phone') || ''; } catch { return ''; }
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdQuoteCode, setCreatedQuoteCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert('እባክዎ ስልክ ቁጥርዎን ያስገቡ (Please enter phone number)');
      return;
    }
    if (mode === 'link' && !productUrl.trim()) {
      alert('እባክዎ የእቃውን ሊንክ ያስገቡ (Please enter product link)');
      return;
    }
    if (mode === 'screenshot' && !photoFile) {
      alert('እባክዎ የእቃውን ፎቶ ወይም ስክሪንሾት ይጫኑ (Please attach screenshot)');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('sourceType', mode);
      formData.append('productUrl', productUrl.trim());
      formData.append('marketplace', marketplace);
      formData.append('size', size.trim());
      formData.append('color', color.trim());
      formData.append('quantity', quantity);
      formData.append('details', details.trim());
      formData.append('phone', phone.trim());

      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (tgUser?.id) formData.append('telegramId', String(tgUser.id));
      if (tgUser?.username) formData.append('telegramUsername', tgUser.username);

      if (photoFile) {
        formData.append('screenshot', photoFile);
      }

      const res = await fetch('/api/quotes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        localStorage.setItem('korcha_customer_phone', phone.trim());
        setCreatedQuoteCode(data.quoteCode);
        if (onQuoteSubmitted) {
          onQuoteSubmitted(data.quoteCode, phone.trim());
        }
      } else {
        alert(data.error || 'ስህተት ተከስቷል');
      }
    } catch (err: any) {
      alert('ስህተት ተከስቷል: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3.5 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-stone-900">
                {createdQuoteCode ? 'የዋጋ ጥያቄዎ ተመዝግቧል!' : 'አዲስ እቃ እዘዝ (New Order)'}
              </h3>
              <p className="text-[10px] text-stone-500">ከ Shein, Amazon ወይም AliExpress</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {createdQuoteCode ? (
          /* SUCCESS SCREEN */
          <div className="space-y-3 text-center py-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="font-black text-sm text-stone-900">
              የእቃ ማዘዣ ጥያቄዎ ደርሶናል!
            </h4>
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-left text-xs space-y-1">
              <p>🏷️ የጥያቄ ኮድ: <b className="font-mono text-amber-700">{createdQuoteCode}</b></p>
              <p>📱 ስልክ ቁጥር: <b>{phone}</b></p>
              <p>🛍️ ዓይነት: <b>{mode === 'link' ? 'የእቃ ሊንክ' : 'ስክሪንሾት / ፎቶ'}</b></p>
              <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-200">
                ሰራተኛችን ወጪውን አስልቶ ዋጋ በቴሌግራም ይልክልዎታል። በዋጋው ሲስማሙ 40% ቅድመ ክፍያ በቴሌብር ወይም በንግድ ባንክ ከፍለው እቃዎ ይረጋገጣል!
              </p>
            </div>

            <div className="pt-2 flex items-center space-x-2">
              <button
                onClick={() => {
                  onClose();
                  if (onOpenMessagesTab) onOpenMessagesTab(createdQuoteCode);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs"
              >
                ከሰራተኛ ጋር አውራ (መልዕክት ክፈት)
              </button>
            </div>
          </div>
        ) : (
          /* FORM */
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('link')}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  mode === 'link' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
                <span>በሊንክ እዘዝ</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('screenshot')}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  mode === 'screenshot' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-amber-600" />
                <span>በፎቶ/ስክሪንሾት እዘዝ</span>
              </button>
            </div>

            {/* Link Input or Photo Upload */}
            {mode === 'link' ? (
              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  የእቃው ድረ-ገጽ ሊንክ (Product Link) <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://www.shein.com/... ወይም amazon.com/..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-hidden bg-stone-50/50"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  የእቃው ፎቶ ወይም ስክሪንሾት <span className="text-red-500">*</span>
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-xl p-3 cursor-pointer transition-all bg-stone-50/70 hover:bg-amber-50/30">
                  {photoPreview ? (
                    <div className="relative w-full h-32 flex items-center justify-center">
                      <img src={photoPreview} alt="Preview" className="max-h-full rounded-lg object-contain" />
                      <span className="absolute bottom-1 right-1 bg-stone-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
                        ቀይር
                      </span>
                    </div>
                  ) : (
                    <div className="text-center space-y-1 py-1.5">
                      <Camera className="w-6 h-6 text-amber-600 mx-auto" />
                      <p className="text-xs font-bold text-stone-700">ስክሪንሾቱን እዚህ ይጫኑ</p>
                      <p className="text-[10px] text-stone-500">JPG, PNG ወይም WEBP</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </label>
              </div>
            )}

            {/* Marketplace */}
            <div className="grid grid-cols-3 gap-1.5">
              {['Shein', 'Amazon', 'AliExpress'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarketplace(m)}
                  className={`py-1 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                    marketplace === m
                      ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-500'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Sizes & Colors */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-stone-700 mb-0.5">መጠን / ሳይዝ (Size)</label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="M, L, 42..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 text-xs bg-stone-50/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-700 mb-0.5">ቀለም (Color)</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="ጥቁር, ነጭ..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 text-xs bg-stone-50/50"
                />
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-[11px] font-bold text-stone-800 mb-1">
                ስልክ ቁጥርዎን ያስገቡ (Phone Number) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09**** / 07****"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden bg-stone-50/50"
              />
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'እየተላከ ነው...' : 'እቃውን እዘዝ (Submit Order Request)'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LinkOrScreenshotQuoteModal;
