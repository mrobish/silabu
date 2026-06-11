import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep the entire React ecosystem AND anything that depends on React
          // (lucide-react, scheduler, jsx-runtime) in ONE chunk.
          // Splitting them causes cross-chunk circular imports where lucide
          // evaluates before React is initialized -> "Cannot read properties
          // of null (reading 'useRef')" -> blank white screen.
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/scheduler') ||
            id.includes('node_modules/lucide-react')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
});
