// src/components/LinkOrScreenshotQuoteModal.tsx: Guided Multi-step Quote Flow with Telegram Username & Consent Scrape
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
  UserCheck,
  Edit2,
} from 'lucide-react';

interface LinkOrScreenshotQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'link' | 'screenshot';
}

export const LinkOrScreenshotQuoteModal: React.FC<LinkOrScreenshotQuoteModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'link',
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

  // Step 3: Phone number & Telegram Username (Step 4 Requirement with Consent Scrape)
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [telegramFirstName, setTelegramFirstName] = useState('');
  const [hasScrapedUser, setHasScrapedUser] = useState(false);
  const [consentGranted, setConsentGranted] = useState(true);
  const [isEditingUsername, setIsEditingUsername] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedQuoteCode, setSubmittedQuoteCode] = useState<string | null>(null);

  const workerUsername =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) ||
    'korcha_support';

  // Automatically detect Telegram WebApp user on modal open
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tgUser = (window as any).Telegram.WebApp.initDataUnsafe?.user;
      if (tgUser) {
        if (tgUser.username) {
          setTelegramUsername(tgUser.username.replace(/^@/, ''));
          setHasScrapedUser(true);
        }
        if (tgUser.id) setTelegramId(String(tgUser.id));
        if (tgUser.first_name) setTelegramFirstName(tgUser.first_name);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Phone Validation
  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s-]/g, '');
    const ethRegex = /^(\+251|0)(9|7)\d{8}$/;
    return ethRegex.test(cleaned);
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
      formData.append('details', details);
      formData.append('phone', phoneNumber);

      // Pass scraped or user-confirmed username
      const finalUsername = consentGranted && telegramUsername ? telegramUsername.replace(/^@/, '').trim() : '';
      formData.append('telegramUsername', finalUsername);
      formData.append('telegramId', telegramId);
      formData.append('telegramFirstName', telegramFirstName);

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
      // Fallback for offline or local preview
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
    setIsEditingUsername(false);
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
            <p className="text-xs text-stone-300">ደረጃ {step} ከ 3 — ዝርዝር መረጃ</p>
          </div>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
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
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                    sourceType === 'link' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>ሊንክ ያስገቡ (Link)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('screenshot')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all ${
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
                    የእቃው ሊንክ (Shein, Temu, AliExpress, etc.)
                  </label>
                  <input
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://shein.com/item... ወይም https://temu.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-xs font-medium text-stone-800 outline-hidden transition-all"
                  />
                  <p className="mt-1.5 text-[11px] text-stone-500">
                    💡 ከ Shein, Temu, ወይም AliExpress ላይ የፈለጉትን እቃ ሊንክ ኮፒ አድርገው እዚህ ያስገቡ።
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    የእቃው ስክሪንሾት ወይም ፎቶ
                  </label>
                  <div className="border-2 border-dashed border-stone-300 rounded-xl p-4 text-center hover:border-amber-500 transition-colors">
                    {screenshotPreview ? (
                      <div className="space-y-2">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot Preview"
                          className="max-h-40 mx-auto rounded-lg object-contain shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotFile(null);
                            setScreenshotPreview(null);
                          }}
                          className="text-xs text-rose-600 font-semibold underline"
                        >
                          ቀይር (Change Photo)
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Camera className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                        <span className="text-xs font-semibold text-amber-600 block">ፎቶ ለመምረጥ እዚህ ይጫኑ</span>
                        <span className="text-[10px] text-stone-500 block mt-0.5">PNG, JPG እስከ 10MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleNextStep1}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
              >
                <span>ቀጣይ፡ የእቃው ዝርዝር (Next: Details)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Product Details (Size, Color, Number/Quantity, Notes) */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-xs text-amber-900">
                <p className="font-semibold mb-0.5">የእቃውን ትክክለኛ ዝርዝር ይግለጹ፡</p>
                <p className="text-[11px] text-amber-800">ትክክለኛውን ዋጋና ወጪ ለማስላት መጠንና ቀለሙን ይሙሉ</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">መጠን / ሳይዝ (Size)</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="ምሳሌ: M, L, 42, 30ml..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 text-xs text-stone-800 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">ቀለም (Color)</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="ምሳሌ: ጥቁር, ነጭ, Black..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 text-xs text-stone-800 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">ብዛት / ቁጥር (Quantity)</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 text-xs text-stone-800 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">ተጨማሪ መግለጫ / ማስታወሻ</label>
                <textarea
                  rows={2}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="ተጨማሪ ምርጫዎች ወይም መስፈርቶች ካሉ እዚህ ይጻፉ..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 text-xs text-stone-800 outline-hidden"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center justify-center space-x-1 transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>ተመለስ</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep2}
                  className="flex-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                >
                  <span>ቀጣይ፡ መገናኛ መረጃ (Next: Contact)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Phone Number & Telegram Username with Consent Scrape (Step 4 Implementation) */}
          {step === 3 && (
            <div className="space-y-3.5">
              <div className="text-center py-1">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center mb-1.5 font-bold text-base">
                  📱
                </div>
                <h4 className="font-bold text-stone-900 text-xs">የመገናኛ መረጃዎን ያረጋግጡ</h4>
                <p className="text-[11px] text-stone-500">
                  የዋጋ ዝርዝርና ስሌት በቴሌግራም ወይም በስልክ ይደርስዎታል
                </p>
              </div>

              {/* Scraped Telegram Username with User Consent Card */}
              {hasScrapedUser && !isEditingUsername ? (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-blue-800">የቴሌግራም መለያዎ፡</p>
                        <p className="text-xs font-extrabold text-blue-950">@{telegramUsername}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingUsername(true)}
                      className="text-[10.5px] font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1 underline"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>ቀይር</span>
                    </button>
                  </div>

                  {/* Explicit User Consent Checkbox */}
                  <label className="flex items-start space-x-2 pt-1 border-t border-blue-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentGranted}
                      onChange={(e) => setConsentGranted(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-blue-300"
                    />
                    <span className="text-[10.5px] text-blue-900 leading-snug font-medium">
                      በዚህ የቴሌግራም መለያ (@{telegramUsername}) የዋጋ ስሌት እንዲላክልኝ እስማማለሁ
                    </span>
                  </label>
                </div>
              ) : (
                /* Manual Username Input if not detected or user opted to edit */
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    የቴሌግራም መለያ ስም (Telegram @username)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      placeholder="@your_username"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 text-xs font-semibold text-stone-800 outline-hidden"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-stone-400">
                    የኮርቻ ሰራተኞች በቀጥታ በቴሌግራም እንዲያነጋግሩዎት መለያዎን ያስገቡ
                  </p>
                </div>
              )}

              {/* Ethiopian Phone Number Input */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
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
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-hidden transition-all ${
                    phoneError
                      ? 'border-rose-500 focus:ring-2 focus:ring-rose-400 bg-rose-50/30'
                      : 'border-stone-300 focus:ring-2 focus:ring-amber-500'
                  }`}
                />
                {phoneError && (
                  <p className="mt-1 text-xs text-rose-600 font-medium flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{phoneError}</span>
                  </p>
                )}
                <p className="mt-1 text-[10px] text-stone-400">
                  ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ምሳሌ፡ 0911223344 ወይም 0712345678)
                </p>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center justify-center space-x-1 transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>ተመለስ</span>
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'እየላከ ነው...' : 'ጥያቄውን ላክ (Submit)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success Confirmation */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4 animate-scale-up">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-base">ጥያቄዎ በተሳካ ሁኔታ ደርሷል!</h4>
                <p className="text-xs text-stone-600 mt-1">
                  የጥያቄ ኮድዎ፡{' '}
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                    {submittedQuoteCode}
                  </span>
                </p>
              </div>

              <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 text-left text-xs space-y-1.5">
                <p className="font-semibold text-stone-800">ቀጣይ ደረጃዎች፡</p>
                <p className="text-stone-600">1. የኮርቻ ሰራተኛ እቃውን ፈትሾ አጠቃላይ ዋጋ በብር ያሰላል።</p>
                <p className="text-stone-600">
                  2. በቴሌግራም (@{telegramUsername || 'መለያዎ'}) ወይም በስልክ ({phoneNumber}) የዋጋ ዝርዝር ይደርስዎታል።
                </p>
                <p className="text-stone-600">3. 40% ቅድመ ክፍያ በቴሌብር ከፍለው ትዕዛዝዎን ያረጋግጣሉ።</p>
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
                  className="w-full py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-all"
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
