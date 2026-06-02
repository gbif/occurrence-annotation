import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Use /annotations/ base path only for production builds
  // Dev server runs at root /
  base: mode === 'production' ? '/annotations/' : '/',
  server: {
    port: 3000,
    open: true
  }
}))

