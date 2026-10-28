module.exports = {
  apps: [
    {
      name: 'korcha-telegram-bot',
      script: './bot.js',
      instances: 1,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'uploads', '.git'],
      max_memory_restart: '350M',
      // Zero-downtime & instant restart configuration
      wait_ready: true,
      listen_timeout: 4000,
      kill_timeout: 2500,
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
