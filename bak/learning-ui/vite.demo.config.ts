import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@taylordb/learning-ui': path.resolve(__dirname, './src/index.ts'),
    },
  },
  plugins: [
    tanstackStart({
      srcDirectory: 'demo/app',
      router: {
        entry: 'core/router.tsx',
      },
    }),
    react(),
  ],
  ssr: {
    noExternal: ['@uiw/react-md-editor', 'react-markdown', '@uiw/react-markdown-preview'], // Forces Vite to handle the CSS
  },
})
