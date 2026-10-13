import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src/web'),
      '@shared': path.resolve(import.meta.dirname, './src/shared'),
    },
  },
  server: {
    // /MAKER usa 5180; aqui 5181 pra poder rodar os dois juntos.
    port: 5181,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
})
