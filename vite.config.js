import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueDevTools(),
    legacy({
      targets: ['ie>=11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
    binaryAsAsciiPlugin()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@assets':fileURLToPath(new URL('./src/assets', import.meta.url)),
      '@image': fileURLToPath(new URL('./src/assets/image', import.meta.url)),
      '@mesh': fileURLToPath(new URL('./src/assets/mesh', import.meta.url)),
      '@audio': fileURLToPath(new URL('./src/assets/audio'. import.meta.url))
    },
  },
})
