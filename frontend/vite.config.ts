import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: {
    // React + Recharts vendor chunk is ~550 kB minified (~160 kB gzipped) and cached across deploys.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom', 'recharts'] } },
    },
  },
  test: { environment: 'node' },
})
