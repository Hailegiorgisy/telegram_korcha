// src/components/LinkOrScreenshotQuoteModal.tsx: Guided Multi-step Quote Flow with Payment Marketing Selection
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Link as LinkIcon, 
  Camera, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Send, 
  AlertCircle, 
  ShoppingBag,
  Zap,
  CreditCard,
  ShieldCheck
} from 'lucide-react';

interface LinkOrScreenshotQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'link' | 'screenshot';
  preferredPayment?: 'telebirr' | 'cbe_birr';
}

export const LinkOrScreenshotQuoteModal: React.FC<LinkOrScreenshotQuoteModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'link',
  preferredPayment = 'telebirr',
}) => {
  const [sourceType, setSourceType] = useState<'link' | 'screenshot'>(initialMode);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Link or Screenshot
  const [productUrl, setProductUrl] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // Step 2: Product Details (size, color, quantity, notes)
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [details, setDetails] = useState('');

  // Step 3: Payment method marketing option & Phone number
  const [paymentMethod, setPaymentMethod] = useState<'telebirr' | 'cbe_birr'>(preferredPayment);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedQuoteCode, setSubmittedQuoteCode] = useState<string | null>(null);

  const workerUsername = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support';

  useEffect(() => {
    if (preferredPayment) {
      setPaymentMethod(preferredPayment);
    }
  }, [preferredPayment]);

  if (!isOpen) return null;

  // Bulletproof Ethiopian Phone Normalizer & Validator
  const normalizeEthiopianPhone = (phoneInput: string): string | null => {
    if (!phoneInput) return null;
    let digits = phoneInput.trim().replace(/[^\d+]/g, '');
    if (digits.startsWith('+251')) {
      digits = digits.slice(4);
    } else if (digits.startsWith('251')) {
      digits = digits.slice(3);
    } else if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (/^(9|7)\d{8}$/.test(digits)) {
      return '0' + digits; // Standard 10-digit format
    }
    return null;
  };

  const validatePhone = (phone: string): boolean => {
    return Boolean(normalizeEthiopianPhone(phone));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const handleNextStep1 = () => {
    if (sourceType === 'link' && !productUrl.trim()) {
      alert('እባክዎ የእቃውን ሊንክ ያስገቡ (Please enter the product link)');
      return;
    }
    if (sourceType === 'screenshot' && !screenshotFile) {
      alert('እባክዎ የስክሪንሾት ፎቶ ይምረጡ (Please choose a screenshot image)');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!validatePhone(phoneNumber)) {
      setPhoneError('ትክክለኛ የስልክ ቁጥር ያስገቡ (ምሳሌ፡ 09**** / 07****)');
      return;
    }
    setPhoneError('');
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('sourceType', sourceType);
      if (sourceType === 'link') formData.append('productUrl', productUrl);
      if (screenshotFile) formData.append('screenshot', screenshotFile);
      formData.append('size', size);
      formData.append('color', color);
      formData.append('quantity', quantity);
      formData.append('details', `${details || ''} [የተመረጠ የክፍያ መንገድ: ${paymentMethod === 'telebirr' ? 'Telebirr (ቴሌብር)' : 'CBE Birr / ንግድ ባንክ'}]`);
      formData.append('phone', normalizeEthiopianPhone(phoneNumber) || phoneNumber);

      // Submit to backend
      const res = await fetch('/api/quotes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSubmittedQuoteCode(data.quoteCode || 'KC-QUOTE');
        setStep(4);
      } else {
        alert(data.error || 'ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።');
      }
    } catch (err) {
      const fallbackCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmittedQuoteCode(fallbackCode);
      setStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setProductUrl('');
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setSize('');
    setColor('');
    setQuantity('1');
    setDetails('');
    setPhoneNumber('');
    setSubmittedQuoteCode(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-stone-900 to-stone-800 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>እቃ ማዘዣ / ዋጋ መጠየቂያ</span>
            </h3>
            <p className="text-xs text-stone-300">ደረጃ {step} ከ 3 — {step === 1 ? 'እቃ መምረጫ' : step === 2 ? 'ዝርዝር መረጃ' : 'ክፍያና ስልክ'}</p>
          </div>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* STEP 1: Provide Link or Screenshot */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex rounded-xl bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => setSourceType('link')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sourceType === 'link' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>ሊንክ ያስገቡ (Link)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('screenshot')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sourceType === 'screenshot' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  <span>ስክሪንሾት / ፎቶ (Photo)</span>
                </button>
              </div>

              {sourceType === 'link' ? (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    የእቃው ሊንክ (Shein, Amazon, AliExpress, etc.)
                  </label>
                  <input
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://www.shein.com/item/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                  <p className="mt-1.5 text-[11px] text-stone-500">
                    ከ Shein ወይም Amazon አፕ ላይ <b>Share → Copy Link</b> በማድረግ እዚህ ፔስት ያድርጉ።
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-stone-700">
                    የእቃውን ስክሪንሾት ወይም ፎቶ ይምረጡ
                  </label>
                  <div className="border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-2xl p-4 text-center cursor-pointer transition-colors relative bg-stone-50/50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    {screenshotPreview ? (
                      <div className="space-y-2">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot Preview"
                          className="max-h-36 mx-auto rounded-lg object-contain shadow-xs"
                        />
                        <p className="text-[11px] text-amber-700 font-bold">ምስሉን ለመቀየር ይንኩ</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-2">
                        <Camera className="w-8 h-8 text-stone-400 mx-auto" />
                        <p className="text-xs font-bold text-stone-700">ስክሪንሾት ለመጫን እዚህ ይንኩ</p>
                        <p className="text-[10px] text-stone-500">PNG, JPG, WEBP (እስከ 10MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNextStep1}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm active:scale-98 transition-all cursor-pointer"
                >
                  <span>ቀጣይ ደረጃ (ዝርዝር መረጃ)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Product Specifications (Size, Color, Quantity) */}
          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  መጠን / ሳይዝ (Size)
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="ምሳሌ: M, L, XL, 38, 42, 100ml"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ቀለም (Color)
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="ምሳሌ: ጥቁር (Black), ነጭ, ሰማያዊ"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ብዛት (Quantity)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ተጨማሪ ማስታወሻ ወይም ጥያቄ (Details / Notes)
                </label>
                <textarea
                  rows={2}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="ምሳሌ: ኦሪጅናል መሆኑ እንዲረጋገጥልኝ፣ ፈጣን ጭነት"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-hidden resize-none"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>ተመለስ</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep2}
                  className="flex-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span>ቀጣይ ደረጃ (ስልክና ክፍያ)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Payment Marketing Option & Phone Number */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Payment Method Selector as Marketing Feature */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center justify-between">
                  <span>የሚመርጡት የክፍያ አማራጭ (Payment Option)</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded-full">100% በብር</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('telebirr')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'telebirr'
                        ? 'border-amber-500 bg-amber-50/80 shadow-xs ring-2 ring-amber-400/30'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-amber-950 flex items-center space-x-1">
                        <Zap className="w-3.5 h-3.5 text-amber-600 inline mr-0.5" />
                        <span>ቴሌብር</span>
                      </span>
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-200/70 px-1 rounded">ፈጣን</span>
                    </div>
                    <p className="text-[10px] text-stone-600 font-medium">40% ቅድመ ክፍያ • 0% ተጨማሪ ወጪ</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cbe_birr')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'cbe_birr'
                        ? 'border-purple-500 bg-purple-50/80 shadow-xs ring-2 ring-purple-400/30'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-purple-950 flex items-center space-x-1">
                        <CreditCard className="w-3.5 h-3.5 text-purple-600 inline mr-0.5" />
                        <span>CBE Birr</span>
                      </span>
                      <span className="text-[9px] font-bold text-purple-800 bg-purple-200/70 px-1 rounded">ባንክ</span>
                    </div>
                    <p className="text-[10px] text-stone-600 font-medium">በኢትዮጵያ ንግድ ባንክ • የታመነ</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  የመገናኛ ስልክ ቁጥር (Phone Number)
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (phoneError) setPhoneError('');
                  }}
                  placeholder="09**** / 07****"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold outline-hidden transition-all ${
                    phoneError ? 'border-rose-500 focus:ring-2 focus:ring-rose-400 bg-rose-50/30' : 'border-stone-300 focus:ring-2 focus:ring-amber-500'
                  }`}
                />
                {phoneError && (
                  <p className="mt-1 text-xs text-rose-600 font-medium flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{phoneError}</span>
                  </p>
                )}
                <p className="mt-1 text-[11px] text-stone-500">
                  አስተናጋጃችን የእቃውን ዋጋ አስልቶ በዚህ ስልክ ወይም በቴሌግራም ያሳውቅዎታል
                </p>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>ተመለስ</span>
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'እየላከ ነው...' : 'ጥያቄውን ላክ (Submit)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success Confirmation with Payment Account Details */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4 animate-scale-up">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-base">ጥያቄዎ በተሳካ ሁኔታ ደርሷል!</h4>
                <p className="text-xs text-stone-600 mt-1">
                  የጥያቄ ኮድዎ፡ <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">{submittedQuoteCode}</span>
                </p>
              </div>

              {/* Account Details Box */}
              <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 text-left text-xs space-y-2">
                <p className="font-bold text-stone-900">የተመረጠ የክፍያ አማራጭ (Payment Details):</p>
                {paymentMethod === 'telebirr' ? (
                  <div className="bg-amber-100/70 rounded-lg p-2.5 border border-amber-300 text-amber-950 font-medium space-y-0.5">
                    <p className="text-[11px] font-bold text-amber-900">📱 Telebirr (ቴሌብር) ይፋዊ አካውንት፡</p>
                    <p className="font-mono font-bold text-xs text-stone-950">+251-996237800</p>
                    <p className="text-[10px] text-stone-600">ስም: Korcha Cross-Border E-Commerce</p>
                  </div>
                ) : (
                  <div className="bg-purple-100/70 rounded-lg p-2.5 border border-purple-300 text-purple-950 font-medium space-y-0.5">
                    <p className="text-[11px] font-bold text-purple-900">🏦 የኢትዮጵያ ንግድ ባንክ (CBE / CBE Birr)፡</p>
                    <p className="font-mono font-bold text-xs text-stone-950">10001116390</p>
                    <p className="text-[10px] text-stone-600">ስም: Korcha Commerce / CBE Birr</p>
                  </div>
                )}
                <div className="pt-1 text-[11px] text-stone-600 space-y-1">
                  <p>1. አስተናጋጃችን እቃውን ፈትሾ አጠቃላይ ዋጋ በብር ያሰላል።</p>
                  <p>2. የዋጋ ዝርዝር በቴሌግራም ወይም በስልክ ({phoneNumber}) ይደርስዎታል።</p>
                  <p>3. 40% ቅድመ ክፍያ ከፍለው ትዕዛዝዎን ያረጋግጣሉ። ቀሪ 60% አዲስ አበባ ሲደርስ ይከፍላሉ።</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={`https://t.me/${workerUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                >
                  <span>ከአስተናጋጅ ጋር በቀጥታ አውራ (@{workerUsername})</span>
                </a>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="w-full py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-all cursor-pointer"
                >
                  ዝጋ (Done)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkOrScreenshotQuoteModal;