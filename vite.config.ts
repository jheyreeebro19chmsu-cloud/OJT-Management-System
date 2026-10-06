import path from 'path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    {
      name: 'dev-api-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && (req.url.startsWith('/api/geofence-zones') || req.url.startsWith('/api/time-records') || req.url.startsWith('/api/employees'))) {
            const apiPath = req.url.startsWith('/api/geofence-zones')
              ? './api/geofence-zones.js'
              : req.url.startsWith('/api/time-records')
              ? './api/time-records.js'
              : './api/employees.js';
            try {
              const { default: handler } = await import(apiPath);
              let body = '';
              req.on('data', (chunk) => { body += chunk; });
              req.on('end', async () => {
                if (body) {
                  try {
                    (req as any).body = JSON.parse(body);
                  } catch {
                    (req as any).body = body;
                  }
                }
                const parsedUrl = new URL(req.url || '', 'http://localhost');
                (req as any).query = Object.fromEntries(parsedUrl.searchParams.entries());
                const mockedRes = {
                  setHeader: (k: string, v: string) => res.setHeader(k, v),
                  status: (code: number) => {
                    res.statusCode = code;
                    return {
                      json: (data: any) => {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                      },
                      end: () => res.end(),
                    };
                  },
                };
                await handler(req, mockedRes);
              });
              return;
            } catch (e: any) {
              console.error(`Error in dev server ${apiPath}:`, e);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
              return;
            }
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: false,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    minify: 'esbuild',
    sourcemap: false,
    cssMinify: true,
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
