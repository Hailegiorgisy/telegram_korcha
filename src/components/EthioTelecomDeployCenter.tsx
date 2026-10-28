import React, { useState } from 'react';
import {
  Server,
  FileCode,
  Copy,
  Check,
  Terminal,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  PRODUCTION_BOT_CODE,
  SYSTEMD_SERVICE_FILE,
  PM2_ECOSYSTEM_FILE,
  DEPLOY_SCRIPT_SHELL,
  ENV_TEMPLATE,
} from '../data/deploymentGuide';

export const EthioTelecomDeployCenter: React.FC = () => {
  const [activeCodeTab, setActiveCodeTab] = useState<'bot.js' | 'ecosystem.config.cjs' | 'korcha.service' | 'deploy.sh' | '.env'>('bot.js');
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
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Server className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Ethio Telecom Hosting & VPS Guide</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Server & Deployment Guide</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">For security reasons public repository links were removed from the UI. Use your private admin channels for repository access and cloning instructions.</p>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-950 text-slate-200 font-bold text-xs flex items-center gap-1.5">
            <span>Repository links hidden</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Terminal className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">Deployment Commands (placeholder)</h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">Below are generic deployment commands — replace <code>&lt;YOUR_REPO_URL&gt;</code> with your private repository URL or use your internal deployment mechanism.</p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 relative">
          <pre className="whitespace-pre-wrap">git clone &lt;YOUR_REPO_URL&gt; /var/www/your_project
cd /var/www/your_project
npm install
npm install -g pm2
pm2 start bot.js --name korcha-bot
pm2 save
pm2 startup systemd</pre>
          <button onClick={() => handleCopy('git clone <YOUR_REPO_URL> /var/www/your_project && cd /var/www/your_project && npm install', 'deploy-placeholder')} className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer" title="Copy command">{copiedFile === 'deploy-placeholder' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileCode className="w-5 h-5 text-amber-400" /> Ready-to-Deploy Code Files</h3>
            <p className="text-xs text-slate-400 mt-0.5">Download configuration templates and environment examples for local installation.</p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => handleCopy(getActiveCode(), activeCodeTab)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors">{copiedFile === activeCodeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}<span>{copiedFile === activeCodeTab ? 'Copied' : 'Copy'}</span></button>

            <button onClick={() => downloadFile(activeCodeTab, getActiveCode())} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 transition-colors"><Download className="w-3.5 h-3.5" /><span>Download</span></button>
          </div>
        </div>

        <div className="bg-slate-950 px-6 py-2 border-b border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'bot.js', label: 'bot.js (Main Bot)' },
            { id: 'ecosystem.config.cjs', label: 'ecosystem.config.cjs (PM2)' },
            { id: 'korcha.service', label: 'korcha-bot.service (Systemd)' },
            { id: 'deploy.sh', label: 'deploy.sh (Deploy Script)' },
            { id: '.env', label: '.env (Env Template)' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveCodeTab(tab.id as any)} className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap ${activeCodeTab === tab.id ? 'bg-slate-800 text-amber-400 font-bold border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-6 bg-[#0d1117] overflow-x-auto"><pre className="text-xs font-mono text-slate-200 leading-relaxed"><code>{getActiveCode()}</code></pre></div>
      </div>
    </div>
  );
};
