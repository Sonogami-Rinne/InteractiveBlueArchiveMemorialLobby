import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { lobbyPack } from './lobbyPackPlugin.js'

const defaultPack = fileURLToPath(new URL('../../Python/pythonProject3/save/pack/', import.meta.url))

export default defineConfig({
  base: './',
  build: { target: 'esnext' },
  optimizeDeps: { entries: ['index.html'] },
  plugins: [
    vue(),
    vueDevTools(),
    lobbyPack(path.resolve(process.env.LOBBY_PACK_DIR || defaultPack)),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@js': fileURLToPath(new URL('./src/js', import.meta.url)),
    },
  },
})
