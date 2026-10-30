import('./bot.js').catch((err) => {
  console.error('[Plesk Startup Error]:', err);
  process.exit(1);
});