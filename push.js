// push.js: Push server files to GitHub securely
import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    if (output) console.log(output.trim());
  } catch (err) {
    if (err.stdout) console.log(err.stdout.toString().trim());
    if (err.stderr) console.error(err.stderr.toString().trim());
  }
}

console.log('--- Starting Git Push ---');

// 1. Ensure .gitignore protects push.js, .env, and node_modules
const gitignore = `node_modules/\n.env\nuploads/\ndist/\npush.js\n.DS_Store\n`;
fs.writeFileSync('.gitignore', gitignore);

// 2. Configure Git Author
run('git config user.name "Hailegiorgisy"');
run('git config user.email "hgyirgu1@gmail.com"');

// 3. Remove push.js and .env from Git staging
run('git rm --cached push.js .env 2>/dev/null || true');

// 4. Reset previous commit containing the token
run('git reset --soft HEAD~1 2>/dev/null || true');

// 5. Stage only safe files
run('git add -A');

// 6. Commit clean files
run('git commit -m "Update from server: clean build and bot" || true');
run('git push -u -f origin main');

// 7. Push with token in memory (never written to Git history)
const GITHUB_TOKEN = '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'; // <-- Paste token here
run(`git remote set-url origin https://${GITHUB_TOKEN}@github.com/Hailegiorgisy/telegram_korcha.git`);
run('git push -u origin main');

console.log('--- Finished Git Push ---');