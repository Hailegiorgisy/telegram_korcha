import React, { useState } from 'react';
import {
  Settings,
  Key,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
  HelpCircle,
  Save,
  Building2,
  Percent,
} from 'lucide-react';
import { testTelegramBotToken, sendLiveTelegramWorkerAlert } from '../services/telegramApiService';

interface BotSettingsModalProps {
  botToken: string;
  setBotToken: (token: string) => void;
  workerChatId: string;
  setWorkerChatId: (id: string) => void;
  officialRate: number;
  setOfficialRate: (rate: number) => void;
  onClose?: () => void;
}

export const BotSettingsModal: React.FC<BotSettingsModalProps> = ({
  botToken,
  setBotToken,
  workerChatId,
  setWorkerChatId,
  officialRate,
  setOfficialRate,
  onClose,
}) => {
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const [sendAlertStatus, setSendAlertStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const handleTestToken = async () => {
    if (!botToken.trim()) {
      setTestStatus({ loading: false, success: false, message: 'እባክዎ መጀመሪያ ቦት ቶከን ያስገቡ።' });
      return;
    }

    setTestStatus({ loading: true });
    const result = await testTelegramBotToken(botToken);
    setTestStatus({
      loading: false,
      success: result.success,
      message: result.message,
    });
  };

  const handleSendTestAlert = async () => {
    if (!botToken.trim() || !workerChatId.trim()) {
      setSendAlertStatus({
        loading: false,
        success: false,
        message: 'Bot Token እና Worker Chat ID ሁለቱንም ማስገባት ያስፈልጋል።',
      });
      return;
    }

    setSendAlertStatus({ loading: true });
    const testMessage =
      `🧪 <b>የኮርቻ ሰራተኞች ቴሌግራም ግሩፕ የሙከራ መልእክት (TEST MESSAGE)</b>\n\n` +
      `✅ የኮርቻ ቴሌግራም ቦት ከሰርቨርዎ ጋር በተሳካ ሁኔታ ተገናኝቷል!\n` +
      `📈 <b>የበር ላይ ቀመር:</b> 1.88× Original Price\n` +
      `💵 <b>ይፋዊ የባንክ ምንዛሬ:</b> 1 USD = ${officialRate} ETB\n` +
      `🇪🇹 <b>የተላከበት ሰዓት:</b> ${new Date().toLocaleTimeString()} (Addis Ababa)`;

    const result = await sendLiveTelegramWorkerAlert(botToken, workerChatId, testMessage);
    setSendAlertStatus({
      loading: false,
      success: result.success,
      message: result.success
        ? '✅ የሙከራ መልእክቱ በተሳካ ሁኔታ ወደ ሰራተኞች ቴሌግራም ግሩፕ ተልኳል!'
        : `❌ አልተላከም: ${result.error}`,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Settings className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              የቦት እና የሰርቨር ማስተካከያ (Bot Configuration)
            </span>
          </div>
          <h2 className="text-2xl font-black text-white">
            የቴሌግራም ቦት ቶከን እና የሰራተኞች ግሩፕ ማገናኛ
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            በ @BotFather የተፈጠረውን እውነተኛ የቦት ቶከን እዚህ በማስገባት በቀጥታ ከቴሌግራም ጋር መሞከር ይችላሉ።
          </p>
        </div>

        {/* Telegram Bot Token Input */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              1. Telegram Bot Token (ከ @BotFather የሚገኝ)
            </span>
            <span className="text-[10px] text-slate-500">ምሳሌ: 7129849201:AAHk...</span>
          </label>

          <div className="flex gap-2">
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Paste TELEGRAM_BOT_TOKEN here..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleTestToken}
              disabled={testStatus.loading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors shrink-0"
            >
              {testStatus.loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
              <span>ቶከን መርምር (Test)</span>
            </button>
          </div>

          {testStatus.message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                testStatus.success
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40'
                  : 'bg-red-950/40 text-red-300 border border-red-900/40'
              }`}
            >
              {testStatus.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        {/* Worker Telegram Group Chat ID */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-400" />
              2. Korcha Workers Telegram Group Chat ID
            </span>
            <span className="text-[10px] text-slate-500">ምሳሌ: -100238192019</span>
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              value={workerChatId}
              onChange={(e) => setWorkerChatId(e.target.value)}
              placeholder="Paste TELEGRAM_WORKER_CHAT_ID (e.g. -100xxxxxxxxxx)..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleSendTestAlert}
              disabled={sendAlertStatus.loading}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 flex items-center gap-2 transition-colors shrink-0"
            >
              {sendAlertStatus.loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>የሙከራ መልእክት ላክ (Send Alert)</span>
            </button>
          </div>

          {sendAlertStatus.message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                sendAlertStatus.success
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40'
                  : 'bg-red-950/40 text-red-300 border border-red-900/40'
              }`}
            >
              {sendAlertStatus.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{sendAlertStatus.message}</span>
            </div>
          )}
        </div>

        {/* Global Rate & Multiplier Defaults */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            3. የዋጋ ስሌት ቅንብሮች (Pricing Configuration)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400">ይፋዊ የኢትዮጵያ ባንክ ምንዛሬ (ETB/USD):</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={officialRate}
                  onChange={(e) => setOfficialRate(parseFloat(e.target.value) || 145.50)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs font-bold text-slate-400">ብር</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-slate-400">የኮርቻ በር ላይ ማድረሻ ብዜት (Multiplier):</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled
                  value="1.88×"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-amber-400 cursor-not-allowed"
                />
                <span className="text-xs font-bold text-slate-500">ቋሚ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
