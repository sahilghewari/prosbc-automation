import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss(),
],
  server: {
    proxy: {
      '/backend': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
        secure: false
      },
      '/api/files': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/files/, '/api/files'),
        secure: false,
      },
      // Add proxy for /file_dbs to ProSBC
      '/file_dbs': {
        target: 'https://prosbc2tpa2.dipvtel.com:12358',
        changeOrigin: true,
        secure: false, // set to true if using valid SSL certs
        rewrite: (path) => path,
        timeout: 180000,
        proxyTimeout: 180000,
      },
      // All other /api requests go to the remote ProSBC server
      '/api': {
        target: process.env.PROSBC_URL || 'https://prosbc2tpa2.dipvtel.com:12358',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        timeout: 180000,
        proxyTimeout: 180000,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        followRedirects: false,
      },
    }
  }
})
