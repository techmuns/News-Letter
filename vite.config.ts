import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

// https://vitejs.dev/config/
// The Cloudflare plugin builds worker/index.ts (see wrangler.jsonc) alongside
// the client, so `vite build` produces a deployable Worker + static assets.
export default defineConfig({
  plugins: [react(), cloudflare()],
})
