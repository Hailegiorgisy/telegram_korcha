const { execSync } = require('child_process');

// Paste your actual token between the single quotes (do NOT include < or >)
const GITHUB_TOKEN = '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';
const REPO_URL = `https://${GITHUB_TOKEN}@github.com/Hailegiorgisy/telegram_korcha.git`;

try {
  console.log('1. Setting main branch...');
  execSync('git branch -M main', { stdio: 'inherit' });

  console.log('2. Configuring remote origin...');
  try {
    execSync(`git remote add origin ${REPO_URL}`, { stdio: 'inherit' });
  } catch (_) {
    execSync(`git remote set-url origin ${REPO_URL}`, { stdio: 'inherit' });
  }

  console.log('3. Staging and committing files...');
  execSync('git config user.name "Korcha Admin"', { stdio: 'inherit' });
  execSync('git config user.email "admin@korcha.com.et"', { stdio: 'inherit' });
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git commit -m "Sync updates from Plesk"', { stdio: 'inherit' });

  console.log('4. Pushing to GitHub...');
  execSync('git push -u origin main --force', { stdio: 'inherit' });

  console.log('✅ Successfully pushed to GitHub!');
} catch (error) {
  console.error('❌ Push failed:', error.message);
}