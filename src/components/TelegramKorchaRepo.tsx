import React, { useState } from 'react';
import {
  Github,
  Copy,
  Check,
  Terminal,
  Server,
  ExternalLink,
  Search,
  CheckCircle2,
  Camera,
  Scale,
  MessageCircle,
} from 'lucide-react';

export const TelegramKorchaRepo: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const pushCommand = `# In your local terminal or VPS:
git remote set-url origin https://<YOUR_GITHUB_TOKEN>@github.com/Hailegiorgisy/telegram_korcha.git
git push origin main`;

  const ethioDeployCommand = `git clone https://github.com/Hailegiorgisy/telegram_korcha.git /var/www/telegram_korcha
cd /var/www/telegram_korcha
npm install
npm install -g pm2
pm2 start bot.js --name korcha-bot
pm2 save
pm2 startup systemd`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Github className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                የቴሌግራም ቦት (E-Commerce Telegram Bot)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pushed to GitHub (0e3fe0e)</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              telegram_korcha ሪፖዚቶሪ
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              ወደ GitHub ዋና ቅርንጫፍ (<code>main</code>) በተሳካ ሁኔታ ፑሽ ተደርጓል። በ <b>Python Scraper</b> የተደገፈ፣ በ HKD 30 ተመን፣ በካርጎ ክብደት (1000 ETB/ኪ.ግ)፣ በስክሪንሾት ማንበቢያ እና በቀጥታ ሰራተኛ ቻት የተዘጋጀ።
            </p>
          </div>

          <a
            href="https://github.com/Hailegiorgisy/telegram_korcha"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <span>GitHub Repo ክፈት (Live)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Feature Highlights: 6 Rules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-sm">
            1
          </span>
          <h4 className="text-sm font-bold text-white">Python Scraper</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            በ <code>scraper.py</code> ከ Shein፣ Temu እና AliExpress ምርቶችን፣ ፎቶዎችንና ዋጋዎችን በቀጥታ ያነባል።
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
            2
          </span>
          <h4 className="text-sm font-bold text-white">HKD 30 & የካርጎ ክብደት</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            በ HKD 30 ተመን፣ 27% ለአቅራቢ፣ 54% ለማድረሻ እና 1 ኪ.ግ = 1000 ETB የካርጎ ክፍያ (እስከ 50×50 ሳ.ሜ)።
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
            3
          </span>
          <h4 className="text-sm font-bold text-white">ስክሪንሾት & የቀጥታ ቻት</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            ደንበኞች የስክሪንሾት ፎቶ ሲልኩ ዋጋውን ወዲያው ያሰላል፤ እንዲሁም ከአስተናጋጅ ጋር በቀጥታ ያወያያል።
          </p>
        </div>
      </div>

      {/* How to Push to telegram_korcha */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Terminal className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">
            ወደ GitHub «telegram_korcha» ሪፖዚቶሪ ፑሽ የማድረጊያ ትዕዛዞች
          </h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          ሁሉንም አዳዲስ ፋይሎች (<code>bot.js</code>, <code>scraper.py</code>, <code>README.md</code>) ወደ GitHub main ቅርንጫፍ ፑሽ ለማድረግ:
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 relative">
          <pre className="whitespace-pre-wrap">{pushCommand}</pre>
          <button
            onClick={() => handleCopy(pushCommand, 'push-cmd')}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Copy command"
          >
            {copiedId === 'push-cmd' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Simple 1-command Server Deploy on Ethio Telecom */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Server className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-bold text-white">
            በኢትዮ ቴሌኮም ሰርቨር ላይ 24/7 የማስኬጃ ትዕዛዝ
          </h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          በኢትዮ ቴሌኮም Linux VPS ሰርቨርዎ ላይ በ SSH ገብተው ቦቱን በ PM2 ለማስነሳት ይህንን ትዕዛዝ ያስኪዱ:
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-amber-300 relative">
          <pre className="whitespace-pre-wrap">{ethioDeployCommand}</pre>
          <button
            onClick={() => handleCopy(ethioDeployCommand, 'deploy-cmd')}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Copy command"
          >
            {copiedId === 'deploy-cmd' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
