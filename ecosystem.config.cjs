const path = require('path');
require('dotenv').config({ path: '/var/www/signalmash-connect/packages/server/.env' });

module.exports = {
  apps: [{
    name: 'signalmash-api',
    cwd: '/var/www/signalmash-connect/packages/server',
    script: 'dist/index.js',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '/var/www/signalmash-connect/packages/server/.env',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
