import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Inside the compose network the backend is "backend:8000"; a dev server run on
// the host can point at the published port instead:
//   VITE_PROXY_TARGET=http://localhost:9001 npm run dev
const backend = process.env.VITE_PROXY_TARGET || 'http://backend:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      // Server-rendered public share pages + crawler files live on the backend
      // (mirrors the nginx routing in prod so shared /lost links work in dev).
      '/lost': { target: backend, changeOrigin: true },
      '/sitemap.xml': { target: backend, changeOrigin: true },
      '/robots.txt': { target: backend, changeOrigin: true },
    },
  },
});
