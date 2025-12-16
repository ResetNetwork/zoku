import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8789',
        changeOrigin: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Forward original host so backend knows the client's URL
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || 'localhost:3000');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
          });
        }
      },
      '/mcp': {
        target: 'http://localhost:8789',
        changeOrigin: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || 'localhost:3000');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
          });
        }
      },
      '/.well-known': {
        target: 'http://localhost:8789',
        changeOrigin: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || 'localhost:3000');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
          });
        }
      },
      '/oauth': {
        target: 'http://localhost:8789',
        changeOrigin: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || 'localhost:3000');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
