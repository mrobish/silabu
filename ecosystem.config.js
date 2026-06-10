module.exports = {
  apps: [
    {
      name: 'silabu-api',
      script: './apps/api/dist/server.js',
      cwd: '/root/silabu-digi',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
        DATABASE_URL: 'postgresql://silabu:@localhost:5432/silabu',
        JWT_SECRET: 'silabu-dev-secret-change-in-prod',
        CORS_ORIGIN: 'https://silabu.ondesa.id',
      },
    },
  ],
};
