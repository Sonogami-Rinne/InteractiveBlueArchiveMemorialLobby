import { createApp } from 'vue'
import { resolvePrefab } from './loader/PrefabLoader.js'
import { defaultPrefab } from './LobbyPreferences.js'

const scene = new URLSearchParams(location.search).get('scene')
if (scene === null) {
  const { default: App } = await import('../App.vue')
  createApp(App).mount('#app')
} else {
  const { default: LobbyScene } = await import('../LobbyScene.vue')
  createApp(LobbyScene, { prefab: resolvePrefab(scene) ?? defaultPrefab })
    .provide('language', 'jp')
    .mount('#app')
}
