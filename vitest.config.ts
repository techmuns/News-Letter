import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts: unit tests here are pure-function/DOM-guard
// tests and don't need the React or Cloudflare build plugins.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
