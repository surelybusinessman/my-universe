import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages отдаёт сайт из подпапки /my-universe/, Cloudflare Pages — с корня
// домена. VITE_BASE_PATH задаётся только в workflow для GitHub Pages.
// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
})
