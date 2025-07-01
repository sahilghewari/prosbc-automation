import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss(),
],
  server: {
    proxy: {
      '/api': {
        target: process.env.PROSBC_URL || 'https://prosbc2tpa2.dipvtel.com:12358',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        timeout: 180000, // 3 minutes timeout
        proxyTimeout: 180000, // 3 minutes proxy timeout
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        followRedirects: false, // Don't follow redirects that could bypass proxy
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
          'Access-Control-Allow-Credentials': 'true'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
            if (res && !res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Proxy error: ' + err.message);
            }
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending request to:', proxyReq.getHeader('host') + proxyReq.path);
            console.log('Request method:', req.method);
            console.log('Request headers:', proxyReq.getHeaders());
            
            // Handle FormData properly
            if (req.method === 'POST' && req.headers['content-type']?.includes('multipart/form-data')) {
              console.log('FormData request detected');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received response with status:', proxyRes.statusCode);
            console.log('Response headers:', proxyRes.headers);
            
            // Remove or modify CORS headers from the target server
            delete proxyRes.headers['access-control-allow-origin'];
            delete proxyRes.headers['access-control-allow-credentials'];
            delete proxyRes.headers['access-control-allow-methods'];
            delete proxyRes.headers['access-control-allow-headers'];
            
            // Set our own CORS headers
            proxyRes.headers['access-control-allow-origin'] = 'http://localhost:5173';
            proxyRes.headers['access-control-allow-credentials'] = 'true';
            proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['access-control-allow-headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
          });
        }
      }
    }
  }
})
