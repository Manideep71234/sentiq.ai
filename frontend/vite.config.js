import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/system': 'http://127.0.0.1:8000',
      '/chat': 'http://127.0.0.1:8000',
      '/documents': 'http://127.0.0.1:8000',
      '/email': 'http://127.0.0.1:8000',
      '/calendar': 'http://127.0.0.1:8000',
      '/notes': 'http://127.0.0.1:8000',
      '/tasks': 'http://127.0.0.1:8000',
      '/scheduled-tasks': 'http://127.0.0.1:8000',
    }
  }
})
