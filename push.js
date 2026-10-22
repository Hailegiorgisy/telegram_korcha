// push.js: Push server files to GitHub via Node.js
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

console.log('--- Starting Git Push to GitHub ---');

// 1. Ensure .gitignore protects sensitive credentials
const gitignore = `node_modules/\n.env\nuploads/\ndist/\n.DS_Store\n`;
fs.writeFileSync('.gitignore', gitignore);

// 2. Configure Git Author
run('git config user.name "Hailegiorgisy"');
run('git config user.email "hgyirgu1@gmail.com"');

// 3. Untrack .env so secrets are never pushed
run('git rm --cached .env 2>/dev/null || true');

// 4. Ensure we are on branch 'main'
run('git checkout -B main');

// 5. Stage all files
run('git add -A');

// 6. Commit
run('git commit -m "Full update: bot, mini app, and dependencies from plesk" || true');

// 7. Push to GitHub
run('git push -u -f origin main');

console.log('--- Finished Git Push ---');