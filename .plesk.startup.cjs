<<<<<<< HEAD
// .plesk.startup.cjs: Official Plesk Phusion Passenger ES Module bootstrap with crash logging
const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'startup_error.txt');

async function main() {
  try {
    fs.writeFileSync(logPath, `[${new Date().toISOString()}] Starting application via .plesk.startup.cjs...\n`);
    await import('./bot.js');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ✅ bot.js booted cleanly and is listening for requests.\n`);
  } catch (err) {
    const errorText = `[${new Date().toISOString()}] ❌ CRASH ON BOOT:\n${err.stack || err.message || err}\n`;
    fs.writeFileSync(logPath, errorText);
    console.error(errorText);
    process.exit(1);
  }
}

main();
=======
import('./bot.js').catch((err) => {
  console.error('[Plesk Startup Error]:', err);
  process.exit(1);
});
>>>>>>> eb981920930fbc86e21a6b9264634519f3a3d4e7
