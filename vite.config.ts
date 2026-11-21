import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 3000),
    strictPort: true,
    // The preview is served through a tunnel host (e.g. *.freecode.build) that
    // changes per workspace, so restricting hosts would break it. Dev-only setting.
    allowedHosts: true,
    // HMR is derived from the page URL (wss:443 behind an https tunnel), so no override.
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.API_PORT || 8787}`, changeOrigin: false },
    },
  },
  preview: { host: '0.0.0.0', port: Number(process.env.PORT || 3000), allowedHosts: true },
  build: { outDir: 'dist', sourcemap: false },
})
