import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import legacy from '@vitejs/plugin-legacy'
import binaryAsAsciiPlugin from './public/js/vite-plugin-binary-as-ascii.js'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueDevTools(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
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
      '@json':fileURLToPath(new URL('./src/assets/json', import.meta.url)),
      '@skel':fileURLToPath(new URL('./src/assets/skel', import.meta.url)),
      '@atlas':fileURLToPath(new URL('./src/assets/atlas', import.meta.url)),
      '@png':fileURLToPath(new URL('./src/assets/png', import.meta.url)),
      '@js':fileURLToPath(new URL('./src/js', import.meta.url)),
    },
  },
})
