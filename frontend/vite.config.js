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
        secure: false
      },
      '/prosbc-upload': {
        target: 'http://localhost:3001/prosbc-upload',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/prosbc-upload/, '')
      },
      // All /api and /file_dbs requests go to ProSBC
      '/file_dbs': {
        target: 'http://prosbc5tpa2.dipvtel.com:12358',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
      '/api': {
        target: process.env.PROSBC_URL || 'http://prosbc5tpa2.dipvtel.com:12358',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
      },
    }
  }
})
