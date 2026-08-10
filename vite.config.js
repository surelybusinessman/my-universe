import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Единственный хостинг — Cloudflare Pages, отдаёт сайт с корня домена.
// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
})
