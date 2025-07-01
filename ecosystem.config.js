module.exports = {
  apps: [
    {
      name: 'prosbc-nap-ui',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 3000',
      cwd: '/path/to/your/prosbc-nap-ui',
      env: {
        NODE_ENV: 'production'
      },
      restart_delay: 5000,
      max_restarts: 3,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
