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
        configure: (proxy, options) => {
          // Handle OPTIONS preflight requests
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending request to:', proxyReq.getHeader('host') + proxyReq.path);
            console.log('Request method:', req.method);
            console.log('Request headers:', proxyReq.getHeaders());
            
            // For OPTIONS requests, don't send them to the server
            if (req.method === 'OPTIONS') {
              console.log('Intercepting OPTIONS request for CORS preflight');
              res.writeHead(200, {
                'Access-Control-Allow-Origin': 'http://localhost:5173',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
              });
              res.end();
              return;
            }
            
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
            delete proxyRes.headers['access-control-max-age'];
            
            // Set our own CORS headers
            proxyRes.headers['access-control-allow-origin'] = 'http://localhost:5173';
            proxyRes.headers['access-control-allow-credentials'] = 'true';
            proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['access-control-allow-headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token';
            proxyRes.headers['access-control-max-age'] = '86400';
          });
          
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
            if (res && !res.headersSent) {
              res.writeHead(500, { 
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': 'http://localhost:5173',
                'Access-Control-Allow-Credentials': 'true'
              });
              res.end('Proxy error: ' + err.message);
            }
          });
        }
      }
    }
  }
})
