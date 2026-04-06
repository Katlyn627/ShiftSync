import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // Load .env.mobile for the 'mobile' build mode
  envDir: '.',
  ...(mode === 'mobile' ? { envPrefix: ['VITE_'] } : {}),
  server: {
    host: true, // listen on 0.0.0.0 so the dev server is reachable from other devices on the same network
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res) {
              const response = res as import('http').ServerResponse;
              if (!response.headersSent) {
                response.writeHead(503, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'Backend server is unavailable. Start it with: npm run dev (from the project root)' }));
              }
            }
          });
        },
      },
    },
  },
}));
