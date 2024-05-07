import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {'@wavecx/wavecx-react': '..'},
    preserveSymlinks: true,
  },
  optimizeDeps: {include: ['@wavecx/wavecx-react']},
})
