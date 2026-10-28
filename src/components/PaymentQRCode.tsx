import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Copy,
  Check,
  Smartphone,
  Building2,
  ExternalLink,
  PhoneCall,
  Info,
  QrCode as QrIcon,
  ShieldCheck,
} from 'lucide-react';

export interface PaymentQRCodeProps {
  amountEtb: number;
  orderNumber: string;
  defaultMethod?: 'telebirr' | 'cbe_birr';
  compact?: boolean;
  receiverName?: string;
  customTelebirrPhone?: string;
  customCbeAccount?: string;
}

export const PaymentQRCode: React.FC<PaymentQRCodeProps> = ({
  amountEtb,
  orderNumber,
  defaultMethod = 'telebirr',
  compact = false,
  receiverName = 'Korcha Logistics (ኮርቻ ሎጂስቲክስ)',
  customTelebirrPhone,
  customCbeAccount,
}) => {
  const [method, setMethod] = useState<'telebirr' | 'cbe_birr'>(defaultMethod);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showHowToScan, setShowHowToScan] = useState<boolean>(false);

  // Default Ethiopian payment accounts
  const telebirrPhone =
    customTelebirrPhone ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEBIRR_PHONE) ||
    '+251-996237800';

  const cleanTelebirrDigits = telebirrPhone.replace(/[^0-9]/g, '');
  const cbeAccount =
    customCbeAccount ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CBE_ACCOUNT) ||
    '10001116390';

  // USSD Quick Dial Strings
  const telebirrUssdCode = `*127*1*${cleanTelebirrDigits.slice(-9)}*${Math.round(amountEtb)}#`;

  useEffect(() => {
    generateQR();
  }, [method, amountEtb, orderNumber, telebirrPhone, cbeAccount]);

  const generateQR = async () => {
    try {
      // Telebirr & CBE payment payloads
      // Formatted with universal mobile payment URIs and deep links supported by Ethiopian banking scanners
      let payload = '';

      if (method === 'telebirr') {
        // Telebirr merchant/peer payment payload
        payload = `telebirr://pay?phone=${encodeURIComponent(telebirrPhone)}&amount=${Math.round(amountEtb)}&order=${encodeURIComponent(orderNumber)}&receiver=${encodeURIComponent(receiverName)}`;
      } else {
        // Commercial Bank of Ethiopia (CBE / CBE Birr) payload
        payload = `cbebirr://pay?account=${encodeURIComponent(cbeAccount)}&amount=${Math.round(amountEtb)}&order=${encodeURIComponent(orderNumber)}&receiver=${encodeURIComponent(receiverName)}`;
      }

      const url = await QRCode.toDataURL(payload, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: method === 'telebirr' ? '#065f46' : '#581c87', // Telebirr Emerald or CBE Deep Purple
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Error generating payment QR code:', err);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `Korcha-Payment-${method === 'telebirr' ? 'Telebirr' : 'CBE'}-${orderNumber}.png`;
    link.click();
  };

  return (
    <div className={`w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center space-y-4 shadow-xl ${compact ? 'max-w-md' : 'max-w-lg'}`}>
      
      {/* Header and Method Segmented Control */}
      <div className="w-full flex items-center justify-between text-left">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <QrIcon className="w-4 h-4 text-emerald-400" />
            <span>የቅድመ ክፍያ QR ኮድ ጀነሬተር (Payment QR)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            ስካን በማድረግ በቀላሉ በቴሌብር ወይም በንግድ ባንክ (CBE) ይክፈሉ
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 block">የሚከፈል መጠን</span>
          <span className="text-sm font-black text-amber-400 font-mono">
            {amountEtb.toLocaleString()} ETB
          </span>
        </div>
      </div>

      {/* Segmented Switcher: Telebirr vs CBE */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-slate-800 w-full">
        <button
          type="button"
          onClick={() => setMethod('telebirr')}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            method === 'telebirr'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>ቴሌብር (Telebirr)</span>
        </button>

        <button
          type="button"
          onClick={() => setMethod('cbe_birr')}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            method === 'cbe_birr'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>ንግድ ባንክ (CBE / CBE Birr)</span>
        </button>
      </div>

      {/* QR Code Presentation Box */}
      <div className="relative group bg-white p-3.5 rounded-2xl shadow-2xl border-4 border-slate-800 flex flex-col items-center">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`${method === 'telebirr' ? 'Telebirr' : 'CBE'} Payment QR Code`}
            className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
          />
        ) : (
          <div className="w-48 h-48 sm:w-52 sm:h-52 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
            <span className="text-xs text-slate-400">QR በማመንጨት ላይ...</span>
          </div>
        )}

        {/* Scan Badge */}
        <div className={`mt-2 py-1 px-3 rounded-md text-[11px] font-bold tracking-wide flex items-center gap-1.5 ${
          method === 'telebirr'
            ? 'bg-emerald-50 text-emerald-800'
            : 'bg-purple-50 text-purple-800'
        }`}>
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>
            {method === 'telebirr' ? '📱 Scan with Telebirr SuperApp' : '🏛️ Scan with CBE Mobile / CBE Birr'}
          </span>
        </div>
      </div>

      {/* Account Details & Quick 1-Click Copy Cards */}
      <div className="w-full space-y-2 text-left">
        {/* Account / Phone row */}
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">
              {method === 'telebirr' ? 'የቴሌብር ስልክ ቁጥር (Phone):' : 'የንግድ ባንክ ሒሳብ ቁጥር (Account):'}
            </span>
            <div className="font-mono font-bold text-white text-xs sm:text-sm truncate">
              {method === 'telebirr' ? telebirrPhone : cbeAccount}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              handleCopy(
                method === 'telebirr' ? telebirrPhone : cbeAccount,
                'account'
              )
            }
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            title="Copy Account Number"
          >
            {copiedKey === 'account' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">ኮፒ ተደርጓል</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>ኮፒ</span>
              </>
            )}
          </button>
        </div>

        {/* Amount & Reference row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Amount */}
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <span className="text-[10px] text-slate-400 block">መጠን (Amount):</span>
              <span className="font-mono font-bold text-amber-400 text-xs">
                {amountEtb.toLocaleString()} ETB
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(String(Math.round(amountEtb)), 'amount')}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Copy Amount"
            >
              {copiedKey === 'amount' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Reference / Order ID */}
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <span className="text-[10px] text-slate-400 block">የትዕዛዝ ቁጥር (Ref):</span>
              <span className="font-mono font-bold text-sky-400 text-xs truncate block">
                {orderNumber}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(orderNumber, 'order')}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Copy Order Reference"
            >
              {copiedKey === 'order' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Receiver metadata */}
        <div className="text-[11px] text-slate-400 text-center pt-0.5">
          የተቀባይ ስም (Beneficiary): <b className="text-slate-200">{receiverName}</b>
        </div>
      </div>

      {/* Action Buttons: Save to Gallery & Direct App / USSD Launch */}
      <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-slate-800/80">
        {/* Save QR button */}
        <button
          type="button"
          onClick={downloadQR}
          className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-sky-400 hover:text-white flex items-center gap-1.5 font-medium transition-all cursor-pointer shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>የ QR ምስሉን አስቀምጥ (Save QR)</span>
        </button>

        {/* Direct Deep link if Telebirr */}
        {method === 'telebirr' ? (
          <a
            href={`telebirr://pay?phone=${encodeURIComponent(telebirrPhone)}&amount=${Math.round(amountEtb)}`}
            className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-xs text-emerald-300 hover:text-white flex items-center gap-1.5 font-medium transition-all"
            title="Open Telebirr App on this phone"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>በቴሌብር አፕ ክፈት (Open App)</span>
          </a>
        ) : (
          <a
            href="https://www.combanketh.et"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600 border border-purple-500/40 text-xs text-purple-300 hover:text-white flex items-center gap-1.5 font-medium transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>CBE Mobile</span>
          </a>
        )}

        {/* Toggle How to Scan on Single Phone */}
        <button
          type="button"
          onClick={() => setShowHowToScan(!showHowToScan)}
          className="py-1 px-2 text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Info className="w-3 h-3" />
          <span>በራሱ ስልክ እንዴት ይከፈላል?</span>
        </button>
      </div>

      {/* Helpful Single-Phone Gallery Scan Instructions */}
      {showHowToScan && (
        <div className="w-full text-left bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 text-xs space-y-1.5 text-slate-300 animate-fadeIn">
          <div className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
            <span>💡 በስልክዎ ላይ ሆነው ስካን ለማድረግ (Scan from Gallery)፦</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
            <li>ከላይ ያለውን <b>"የ QR ምስሉን አስቀምጥ (Save QR)"</b> ይጫኑ ወይም ስክሪኑን Screenshot ያንሱ።</li>
            <li>የ <b>{method === 'telebirr' ? 'ቴሌብር (Telebirr)' : 'CBE'}</b> አፕሊኬሽንዎን ይክፈቱ።</li>
            <li>የ <b>Scan (ስካን)</b> ምልክቱን ነክተው ከስልክዎ <b>Gallery (ጋለሪ)</b> ፎቶውን ይምረጡ፤ በቀጥታ ዋጋውና ትዕዛዝ ቁጥሩ ሞልቶ ይመጣልዎታል!</li>
          </ol>
          {method === 'telebirr' && (
            <div className="pt-1.5 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800 mt-1">
              <span>USSD ፈጣን መክፈያ ኮድ፦ <code className="text-emerald-400">{telebirrUssdCode}</code></span>
              <a
                href={`tel:${telebirrUssdCode.replace(/#/g, '%23')}`}
                className="text-sky-400 hover:underline flex items-center gap-1"
              >
                <PhoneCall className="w-3 h-3" />
                <span>ደውል</span>
              </a>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
