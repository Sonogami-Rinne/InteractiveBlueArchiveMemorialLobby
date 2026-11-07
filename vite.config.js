import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: { target: 'esnext' },
  plugins: [
    vue(),
    vueDevTools()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@assets':fileURLToPath(new URL('./src/assets', import.meta.url)),
      '@image': fileURLToPath(new URL('./src/assets/image', import.meta.url)),
      '@mesh': fileURLToPath(new URL('./src/assets/mesh', import.meta.url)),
      '@audio': fileURLToPath(new URL('./src/assets/audio', import.meta.url)),
      '@shader': fileURLToPath(new URL('./src/assets/shader', import.meta.url)),
      '@js':fileURLToPath(new URL('./src/js', import.meta.url))
    },
  },
})
