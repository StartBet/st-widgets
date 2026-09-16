import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { htmlEntries } from './build/htmlEntries';
import { stripStCoreUiFontLayer } from './build/stripStCoreUiFontLayer';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [stripStCoreUiFontLayer(), vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5180
  },
  preview: {
    port: 5180
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: htmlEntries(root, ['index.html'])
    }
  }
});
