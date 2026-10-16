import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Polling: the native Windows watcher occasionally missed edits in this folder,
  // serving stale modules until a restart.
  server: { port: 5173, strictPort: false, watch: { usePolling: true, interval: 250 } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
