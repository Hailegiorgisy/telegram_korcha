module.exports = {
  apps: [
    {
      name: 'korcha-telegram-bot',
      script: './app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      wait_ready: true,
      listen_timeout: 4000,
      kill_timeout: 2500,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
