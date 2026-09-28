import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Unitarias de lógica pura (src/domain, src/lib). Los E2E viven en tests/e2e (Playwright).
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
})
