import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev runs on :5178 under pm2 (`oficina-dev`). `base: './'` keeps the build
// working under the GitHub Pages sub-path (/oficina-dcapiu/).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: { host: true, port: 5178, strictPort: true },
  preview: { host: true, port: 5178, strictPort: true },
  // three + drei make one ~1 MB chunk; it is the whole app, not worth splitting.
  build: { chunkSizeWarningLimit: 1500 },
})
