import { execSync } from 'child_process';

try {
  console.log('Installing Python packages...');
  const output = execSync('pip3 install --user requests beautifulsoup4', { encoding: 'utf-8' });
  console.log('Success:\n', output);
} catch (err) {
  console.error('Installation failed:\n', err.message);
}