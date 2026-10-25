import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/bank-app/',
  build: {
    outDir: resolve(__dirname, '../decoy/static/bank-app'),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2017',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-fonts': [
            '@fontsource/inter',
            '@fontsource/playfair-display',
            '@fontsource/noto-sans-ethiopic',
          ],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },
})
