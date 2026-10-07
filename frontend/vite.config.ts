import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const api = process.env.API_TARGET ?? '127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Listen on the LAN too: the host lobby's QR code points phones at this
    // machine's network address, which only works if the dev server accepts it.
    host: true,
    proxy: {
      '/api': `http://${api}`,
      // /admin is both an API prefix and an SPA route prefix. Browser page
      // loads (Accept: text/html) get the SPA; fetch/XHR calls reach the API.
      '/admin': {
        target: `http://${api}`,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/uploads': `http://${api}`,
      '/ws': {
        target: `ws://${api}`,
        ws: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 2000
  }
})

