import React, { useState } from 'react';
import {
  Server,
  FileCode,
  Copy,
  Check,
  AlertTriangle,
  Terminal,
  ShieldCheck,
  Download,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Cpu,
  Layers,
} from 'lucide-react';
import {
  GITHUB_AUDIT_REPORT,
  PRODUCTION_BOT_CODE,
  SYSTEMD_SERVICE_FILE,
  PM2_ECOSYSTEM_FILE,
  DEPLOY_SCRIPT_SHELL,
  ENV_TEMPLATE,
} from '../data/deploymentGuide';

export const EthioTelecomDeployCenter: React.FC = () => {
  const [activeCodeTab, setActiveCodeTab] = useState<
    'bot.js' | 'ecosystem.config.cjs' | 'korcha.service' | 'deploy.sh' | '.env'
  >('bot.js');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopy = (content: string, filename: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2500);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getActiveCode = () => {
    switch (activeCodeTab) {
      case 'bot.js':
        return PRODUCTION_BOT_CODE;
      case 'ecosystem.config.cjs':
        return PM2_ECOSYSTEM_FILE;
      case 'korcha.service':
        return SYSTEMD_SERVICE_FILE;
      case 'deploy.sh':
        return DEPLOY_SCRIPT_SHELL;
      case '.env':
        return ENV_TEMPLATE;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Server className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                ኢትዮ ቴሌኮም ሰርቨር ማሰማሪያ (Ethio Telecom Hosting & VPS Guide)
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              የጊትሀብ ፕሮጀክት ግምገማ እና የሰርቨር ማሰማሪያ ማዕከል
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              የ <b>https://github.com/Hailegiorgisy/korcha</b> ፕሮጀክት ዝርዝር ግምገማ፣ የተስተካከሉ የምንጭ ኮዶች (Source Codes) እና በኢትዮ ቴሌኮም ሰርቨር ላይ 24/7 የማስኬጃ ሙሉ መመሪያ።
            </p>
          </div>

          <a
            href="https://github.com/Hailegiorgisy/korcha"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          >
            <span>ክፈት: Hailegiorgisy/korcha</span>
            <ExternalLink className="w-4 h-4 text-amber-400" />
          </a>
        </div>
      </div>

      {/* GitHub Repository Audit & Corrections Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase text-amber-400 tracking-wider">
              የኮድ ምርመራ ውጤት (Audit Diagnostics)
            </span>
            <h3 className="text-xl font-bold text-white mt-1">
              በ Hailegiorgisy/korcha ሪፖዚቶሪ ውስጥ የታዩ ዋና ዋና ክፍተቶች እና ማስተካከያዎች
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {GITHUB_AUDIT_REPORT.currentStatus}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GITHUB_AUDIT_REPORT.keyFindings.map((finding, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-bold text-amber-400">
                    {idx + 1}
                  </span>
                  {finding.title}
                </h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    finding.severity === 'Critical'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : finding.severity === 'High'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {finding.severity}
                </span>
              </div>

              <div className="text-xs text-slate-400 leading-relaxed">
                <b className="text-slate-300">ያለበት ችግር:</b> {finding.description}
              </div>

              <div className="text-xs text-emerald-400/90 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40">
                <b className="text-emerald-300">የተደረገ ማስተካከያ:</b> {finding.solution}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Production Source Codes & File Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-amber-400" />
              የተዘጋጁ የፕሮዳክሽን ኮዶች (Ready-to-Deploy Code Files)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              እነዚህን ፋይሎች በኢትዮ ቴሌኮም ሰርቨርዎ ላይ በቀጥታ በመጫን ቦቱን ወዲያውኑ ማሰማራት ይችላሉ።
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(getActiveCode(), activeCodeTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              {copiedFile === activeCodeTab ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ተገልብጧል (Copied)</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>ኮፒ አድርግ (Copy)</span>
                </>
              )}
            </button>

            <button
              onClick={() => downloadFile(activeCodeTab, getActiveCode())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ዳውንሎድ</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-950 px-6 py-2 border-b border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'bot.js', label: 'bot.js (ዋናው ቴሌግራም ቦት)' },
            { id: 'ecosystem.config.cjs', label: 'ecosystem.config.cjs (PM2)' },
            { id: 'korcha.service', label: 'korcha-bot.service (Systemd)' },
            { id: 'deploy.sh', label: 'deploy_ethiotelecom.sh (1-Command Script)' },
            { id: '.env', label: '.env (ምስጢራዊ ቁልፎች)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCodeTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap ${
                activeCodeTab === tab.id
                  ? 'bg-slate-800 text-amber-400 font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code Block Container */}
        <div className="p-6 bg-[#0d1117] overflow-x-auto">
          <pre className="text-xs font-mono text-slate-200 leading-relaxed">
            <code>{getActiveCode()}</code>
          </pre>
        </div>
      </div>

      {/* Step-by-Step Ethio Telecom Hosting Setup Walkthrough */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="pb-4 border-b border-slate-800">
          <span className="text-xs font-bold uppercase text-amber-400 tracking-wider">
            ደረጃ በደረጃ የማሰማራት ሂደት (Step-by-Step Server Setup)
          </span>
          <h3 className="text-xl font-bold text-white mt-1">
            በኢትዮ ቴሌኮም ሰርቨር (Ethio Telecom Linux VPS) ላይ ቦቱን 24/7 የማስኬድ መመሪያ
          </h3>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center shrink-0 border border-amber-500/30">
              1
            </div>
            <div className="space-y-2 flex-1">
              <h4 className="text-sm font-bold text-white">
                ደረጃ 1: በ SSH አማካኝነት ወደ ኢትዮ ቴሌኮም ሰርቨርዎ ይግቡ
              </h4>
              <p className="text-xs text-slate-400">
                ኢትዮ ቴሌኮም የሰጣችሁን የሰርቨር IP አድራሻ ተጠቅማችሁ በተርሚናል ይግቡ:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 flex items-center justify-between">
                <code>ssh root@&lt;YOUR_ETHIO_TELECOM_IP&gt;</code>
                <button
                  onClick={() => handleCopy('ssh root@<YOUR_ETHIO_TELECOM_IP>', 'step-1')}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center shrink-0 border border-amber-500/30">
              2
            </div>
            <div className="space-y-2 flex-1">
              <h4 className="text-sm font-bold text-white">
                ደረጃ 2: የቴሌግራም ቦት ቶከን እና የሰራተኞች ግሩፕ Chat ID ማዘጋጀት
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                1. ቴሌግራም ላይ <b>@BotFather</b> ጋር በመሄድ <code>/newbot</code> ብለው ቦት ይፍጠሩ እና የተሰጣችሁን <b>Bot Token</b> ይቅዱ።<br />
                2. የኮርቻ ሰራተኞች የሚገኙበትን የቴሌግራም ግሩፕ ይፍጠሩ፣ ቦቱን ወደ ግሩፑ አድሚን አድርገው ያስገቡ።<br />
                3. የግሩፑን ID ለማወቅ <b>@RawDataBot</b>ን ለጥቂት ሰከንድ ግሩፑ ውስጥ ጨምረው የቻቱን ID (ለምሳሌ: <code>-100238192019</code>) ያውቁ።
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center shrink-0 border border-amber-500/30">
              3
            </div>
            <div className="space-y-2 flex-1">
              <h4 className="text-sm font-bold text-white">
                ደረጃ 3: በሰርቨሩ ላይ ፕሮጀክቱን መጫን እና ማዋቀር
              </h4>
              <p className="text-xs text-slate-400">
                ሰርቨሩ ላይ ሆነው ይህንን አንድ መስመር ትዕዛዝ በማስኬድ ሙሉውን ፕሮጀክት በራስ-ሰር ይጫኑ:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-amber-300 space-y-1">
                <div>git clone https://github.com/Hailegiorgisy/korcha.git /var/www/korcha</div>
                <div>cd /var/www/korcha && npm install telegraf dotenv</div>
                <div>nano .env  # የቴሌግራም ቶከንዎን እዚህ ያስገቡ</div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center shrink-0 border border-amber-500/30">
              4
            </div>
            <div className="space-y-2 flex-1">
              <h4 className="text-sm font-bold text-white">
                ደረጃ 4: ቦቱን በ PM2 አማካኝነት 24/7 ማብራት
              </h4>
              <p className="text-xs text-slate-400">
                ሰርቨሩ ቢጠፋ ወይም ዳግም ቢነሳ እንኳ ቦቱ ሳይቋረጥ እንዲሰራ PM2ን ያስነሱ:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 space-y-1">
                <div>npm install -g pm2</div>
                <div>pm2 start bot.js --name korcha-bot</div>
                <div>pm2 startup systemd</div>
                <div>pm2 save</div>
              </div>
              <p className="text-[11px] text-emerald-400/90 mt-1">
                💡 <b>ጠቃሚ ምክር:</b> የቴሌግራም ቦቱ በ <b>Polling Mode</b> ስለሚሰራ ምንም አይነት የዶሜይን ስም (Domain) ወይም SSL ሰርተፊኬት ሳያስፈልገው በኢትዮ ቴሌኮም ሰርቨር ላይ ወዲያውኑ ስራ ይጀምራል!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
