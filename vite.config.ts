import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> regular build in dist/ (hosting, Capacitor, Tauri)
// `npm run build:single` -> everything in ONE HTML file in dist-single/ (quick sharing)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
  },
}));
