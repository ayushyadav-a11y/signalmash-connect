// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'signalmash-server',
      cwd: './packages/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_file: './logs/server-combined.log',
      time: true,
    },
  ],
};
