/**
 * vite.config.js — Vite Build & Dev Server Configuration
 *
 * Configures the Vite bundler for the DayScape React frontend.
 *
 * plugins:
 *  @vitejs/plugin-react — Enables JSX transform, Fast Refresh (HMR), and
 *  Babel-based transforms for React components during development and build.
 *
 * server.port:
 *  The dev server runs on port 5173 (Vite default).
 *  Open http://localhost:5173 during development.
 *
 * server.proxy:
 *  All requests starting with /api are transparently forwarded to the
 *  Express backend at http://localhost:5000. This avoids CORS errors during
 *  development — the browser only ever talks to the same origin (5173).
 *  changeOrigin: true rewrites the Host header to match the target server.
 *
 *  Example: fetch('/api/places') in the frontend → http://localhost:5000/api/places
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Register the React plugin for JSX support and Fast Refresh
  plugins: [react()],

  server: {
    port: 5173, // Dev server listens on this port

    proxy: {
      // Forward all /api/* requests to the Express backend (avoids CORS in dev)
      '/api': {
        target: 'http://localhost:5000', // Express server address
        changeOrigin: true,              // Rewrite Host header to target origin
      }
    }
  }
})
