import path from 'path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: false,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    minify: false,
    sourcemap: false,
    cssMinify: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'leaflet': ['leaflet', 'react-leaflet'],
          'vendor': ['react', 'react-dom', 'react-router-dom', 'motion', 'lucide-react'],
          'country-state-city': ['country-state-city'],
        }
      }
    }
  }
})
