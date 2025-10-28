import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import pak from '../package.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {find: pak.name, replacement: path.join(__dirname, '..', pak.source)},
    ],
  },
  define: {
    __SDK_VERSION__: JSON.stringify(pak.version),
  },
})
