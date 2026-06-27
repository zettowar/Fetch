import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    // Force the shop into demo mode so tests are deterministic regardless of
    // any Shopify creds in the developer's local .env.
    env: {
      VITE_SHOPIFY_DOMAIN: '',
      VITE_SHOPIFY_STOREFRONT_TOKEN: '',
    },
  },
});
