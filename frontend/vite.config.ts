import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        // Inside the compose network the backend is "backend:8000"; a dev
        // server run on the host can point at the published port instead:
        //   VITE_PROXY_TARGET=http://localhost:9001 npm run dev
        target: process.env.VITE_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
});
