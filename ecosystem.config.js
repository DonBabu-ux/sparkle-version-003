module.exports = {
  apps: [
    {
      name: 'sparkle-api',
      script: './server.js',
      instances: 'max', // Scale to all available CPU cores
      exec_mode: 'cluster', // Enable load balancing across instances
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 3000,
      max_memory_restart: '512M', // Prevent memory leaks from crashing the server
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
    {
      name: 'sparkle-media-worker',
      script: './workers/mediaWorker.js',
      instances: 1, // Start with 1 background worker to not overload DB/CPU
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
    }
  ],
};
