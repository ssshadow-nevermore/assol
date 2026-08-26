/**
 * PM2 template for the VINEXT standalone Node server.
 *
 * Keep credentials out of this file. Supply SQLite/Yandex/auth secrets through
 * the protected PM2/server environment when deploying to a VPS.
 */
module.exports = {
  apps: [
    {
      name: "assol-site",
      cwd: __dirname,
      script: "./dist/standalone/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
      },
    },
  ],
};
