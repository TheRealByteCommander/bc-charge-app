/** PM2-Produktionskonfiguration – siehe scripts/deploy/setup-server.sh */
module.exports = {
  apps: [
    {
      name: 'bc-charge-api',
      script: 'server/start.mjs',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        BC_SERVER_PORT: '3001',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      error_file: '/var/log/bc-charge/error.log',
      out_file: '/var/log/bc-charge/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
