import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Enable proper sourcemaps for production builds
    sourcemap: true,
  },
  css: {
    // Enable proper sourcemaps for CSS in development
    devSourcemap: true,
  },
});
