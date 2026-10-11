import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, requests to /api are forwarded to the Express server.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
