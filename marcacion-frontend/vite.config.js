import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', 
    port: 5173,
    strictPort: true,
    // --- AGREGA ESTA SECCIÓN DE PROXY ---
    proxy: {
      '/api': {
        target: 'http://10.15.1.11:5000', // La IP de tu backend
        changeOrigin: true,
        secure: false,
        // Si tu backend NO espera recibir "/api" en la ruta, descomenta la siguiente línea:
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
    // ------------------------------------
  }
})