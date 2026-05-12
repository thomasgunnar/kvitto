module.exports = {
  apps: [{
    name: 'kvitto-api',
    script: './backend/src/index.js',
    cwd: '/opt/kvitto/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    error_file: '/var/log/kvitto/error.log',
    out_file: '/var/log/kvitto/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
