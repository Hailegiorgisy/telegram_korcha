module.exports = {
  apps: [
    {
      name: 'korcha-telegram-bot',
      script: './bot.js',
      instances: 1,
      autorestart: true,
      watch: false,
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> eb981920930fbc86e21a6b9264634519f3a3d4e7
      ignore_watch: ['node_modules', 'dist', 'uploads', '.git'],
      max_memory_restart: '350M',
      // Zero-downtime & instant restart configuration
      wait_ready: true,
      listen_timeout: 4000,
      kill_timeout: 2500,
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,
<<<<<<< HEAD
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
=======
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
=======
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
>>>>>>> 6b9085509255e81cb82a0ceba8286e72df6635b4
>>>>>>> eb981920930fbc86e21a6b9264634519f3a3d4e7
      },
    },
  ],
};
