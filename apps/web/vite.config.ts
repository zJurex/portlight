import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // en desarrollo, /api va al Worker local (wrangler dev)
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
