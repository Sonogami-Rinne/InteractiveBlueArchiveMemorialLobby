<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createLobbyAudio } from './js/controller/AudioController'
import { loadLobbyList, resolvePrefab } from './js/loader/PrefabLoader'
import { defaultGraphics, readLobbyPreferences, validViewSize, writeLobbyPreferences, defaultPrefab } from './js/LobbyPreferences'
import menuIcon from './common_menu.png'

const frame = ref(null)
const dialog = ref(null)
const menuVisible = ref(false)
const panel = ref('main')
const saved = readLobbyPreferences()
const selected = ref(resolvePrefab(saved.prefab) ?? defaultPrefab)
const loading = ref(true)
const sceneError = ref('')
const list = ref(null)
const listError = ref('')
const volume = ref(saved.volume)
let graphics = { targetViewWidth: saved.targetViewWidth, targetViewHeight: saved.targetViewHeight }
const graphicsDraft = ref({ ...graphics })
const audio = createLobbyAudio()
audio.output.gain.value = volume.value / 100
let hideTimer

function showMenuButton() {
  menuVisible.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { menuVisible.value = false }, 2000)
}

function mouseActivity(event) {
  if (event.pointerType === 'mouse') showMenuButton()
}

function unlockAudio() {
  if (audio.context.state === 'suspended') void audio.context.resume().catch(console.debug)
}

function openMenu() {
  panel.value = 'main'
  dialog.value.showModal()
}

function openSettings() {
  graphicsDraft.value = { ...graphics }
  panel.value = 'settings'
}

function closeMenu() {
  dialog.value.close()
}

async function openLobbyList() {
  panel.value = 'lobbies'
  if (list.value) return
  listError.value = ''
  try {
    list.value = await loadLobbyList()
  } catch (error) {
    console.error(error)
    listError.value = '无法加载大厅列表'
  }
}

function changeVolume(event) {
  volume.value = event.target.valueAsNumber
  audio.output.gain.value = volume.value / 100
  savePreferences()
}

function savePreferences() {
  writeLobbyPreferences({
    prefab: selected.value,
    volume: volume.value,
    ...graphics,
  })
}

function applyGraphics(next) {
  if (!validViewSize(next.targetViewWidth) || !validViewSize(next.targetViewHeight)) return
  graphics = { ...next }
  graphicsDraft.value = { ...graphics }
  frame.value.lobbyGraphics = graphics
  frame.value.contentWindow.dispatchEvent(new Event('lobby-graphics-change'))
  savePreferences()
}

function loadScene(prefab) {
  selected.value = prefab
  savePreferences()
  sceneError.value = ''
  loading.value = true
  const url = new URL(location.href)
  url.searchParams.set('scene', prefab)
  url.hash = ''
  frame.value.contentWindow.location.replace(url.href)
}

function selectLobby(prefab) {
  unlockAudio()
  closeMenu()
  if (prefab === selected.value && !sceneError.value) return
  frame.value.contentWindow.dispatchEvent(new Event('lobby-dispose'))
  loadScene(prefab)
}

onMounted(() => {
  frame.value.lobbyAudio = audio
  frame.value.lobbyGraphics = graphics
  frame.value.addEventListener('lobby-mouse', showMenuButton)
  frame.value.addEventListener('lobby-activate', unlockAudio)
  frame.value.addEventListener('lobby-ready', () => { loading.value = false })
  frame.value.addEventListener('lobby-error', event => {
    loading.value = false
    sceneError.value = event.detail
  })
  window.addEventListener('pointermove', mouseActivity, { passive: true })
  window.addEventListener('pointerdown', mouseActivity)
  window.addEventListener('pointerdown', unlockAudio, true)
  window.addEventListener('keydown', unlockAudio, true)
  loadScene(selected.value)
})

onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  window.removeEventListener('pointermove', mouseActivity)
  window.removeEventListener('pointerdown', mouseActivity)
  window.removeEventListener('pointerdown', unlockAudio, true)
  window.removeEventListener('keydown', unlockAudio, true)
  void audio.context.close()
})
</script>

<template>
  <iframe ref="frame" class="lobby-frame" title="回忆大厅" allow="autoplay"></iframe>
  <p v-if="loading" class="scene-status" role="status">正在加载大厅…</p>
  <p v-else-if="sceneError" class="scene-status" role="alert">大厅加载失败：{{ sceneError }}</p>

  <button type="button" class="menu-toggle" :class="{ visible: menuVisible }"
    aria-label="打开菜单" aria-haspopup="dialog" @click="openMenu">
    <img :src="menuIcon" alt="">
  </button>

  <dialog ref="dialog" class="menu-dialog" :class="panel" aria-labelledby="menu-title"
    @click.self="closeMenu">
    <div class="dialog-surface">
      <header class="dialog-header">
        <button v-if="panel !== 'main'" class="header-button back" type="button"
          aria-label="返回菜单" @click="panel = 'main'">‹</button>
        <h1 id="menu-title">{{ { main: '菜单', settings: '设置', lobbies: '大厅选择' }[panel] }}</h1>
        <button class="header-button close" type="button" aria-label="关闭" @click="closeMenu">×</button>
      </header>

      <div v-if="panel === 'main'" class="menu-actions">
        <button type="button" class="menu-action" @click="openSettings">
          <span class="icon-placeholder" aria-hidden="true"></span>设置
        </button>
        <button type="button" class="menu-action" @click="openLobbyList">
          <span class="icon-placeholder" aria-hidden="true"></span>大厅选择
        </button>
      </div>

      <div v-else-if="panel === 'settings'" class="settings-layout">
        <div class="settings-section">音量</div>
        <label class="setting">
          <span>主音量</span>
          <input type="range" min="0" max="100" :value="volume" @input="changeVolume">
          <output>{{ volume }}%</output>
        </label>
        <div id="graphics-title" class="settings-section">图形</div>
        <form class="graphics-settings" aria-labelledby="graphics-title"
          @submit.prevent="applyGraphics(graphicsDraft)">
          <label>
            <span>目标视图宽度（px）</span>
            <input v-model.number="graphicsDraft.targetViewWidth" type="number" required
              min="1" :max="Number.MAX_SAFE_INTEGER" step="1">
          </label>
          <label>
            <span>目标视图高度（px）</span>
            <input v-model.number="graphicsDraft.targetViewHeight" type="number" required
              min="1" :max="Number.MAX_SAFE_INTEGER" step="1">
          </label>
          <div class="graphics-actions">
            <button type="button" @click="applyGraphics(defaultGraphics)">重置</button>
            <button type="submit">应用</button>
          </div>
        </form>
      </div>

      <div v-else class="lobby-picker">
        <div class="current-lobby">{{ selected }}</div>
        <p v-if="listError" class="picker-status" role="alert">{{ listError }}</p>
        <p v-else-if="!list" class="picker-status" role="status">正在加载列表…</p>
        <div v-else class="lobby-grid">
          <button v-for="entry in list" :key="entry.prefab" type="button" class="lobby-card"
            :class="{ current: entry.prefab === selected }" :aria-current="entry.prefab === selected"
            :title="entry.prefab" @click="selectLobby(entry.prefab)">
            <span class="lobby-portrait">
              <img v-if="entry.iconUrl" :src="entry.iconUrl" alt="" loading="lazy" decoding="async">
            </span>
            <span class="lobby-name">{{ entry.prefab.replace(/^lobby/, '') || entry.prefab }}</span>
          </button>
        </div>
        <footer class="picker-footer">
          <button type="button" @click="closeMenu">关闭</button>
        </footer>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.lobby-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #1c354e;
}
.scene-status {
  position: absolute;
  inset: auto 1rem 1rem;
  margin: 0;
  padding: .65rem 1rem;
  color: #fff;
  background: #27374ae8;
  width: fit-content;
  max-width: calc(100% - 4rem);
  overflow-wrap: anywhere;
  font: 14px/1.4 system-ui, sans-serif;
}
button {
  cursor: pointer;
  font: inherit;
}
button:focus-visible {
  outline: 3px solid #1999cd;
  outline-offset: 2px;
}
.menu-toggle {
  position: absolute;
  top: clamp(12px, 3vh, 32px);
  left: clamp(12px, 3vw, 38px);
  width: 48px;
  height: 44px;
  padding: 8px;
  border: 1px solid #fff;
  border-radius: 7px;
  background: #f7fbffea;
  box-shadow: 0 2px 5px #10223570;
  opacity: 0;
  pointer-events: none;
  transition: opacity .35s ease;
}
.menu-toggle.visible, .menu-toggle:focus-visible {
  opacity: 1;
  pointer-events: auto;
}
.menu-toggle img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.menu-dialog {
  width: min(420px, calc(100vw - 28px));
  max-height: calc(100dvh - 28px);
  max-width: none;
  padding: 0;
  overflow: auto;
  color: #27374a;
  border: 1px solid #fff;
  border-radius: 9px;
  box-shadow: 0 5px 0 #2230447a, 0 12px 32px #15203266;
  background: #f7f9fb;
  font: 600 16px/1.35 system-ui, sans-serif;
}
.menu-dialog::backdrop {
  background: #09142791;
}
.menu-dialog.settings {
  width: min(740px, calc(100vw - 28px));
}
.menu-dialog.lobbies {
  width: min(660px, calc(100vw - 28px));
}
.dialog-header {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 52px;
  background: linear-gradient(55deg, #c5e0ef 8%, transparent 8%),
    linear-gradient(120deg, #d9edf9 16%, #f2f7fa 16%);
  border-bottom: 1px solid #dbe4e9;
}
.dialog-header h1 {
  position: relative;
  margin: 0;
  font-size: 21px;
}
.dialog-header h1::after {
  content: '';
  position: absolute;
  inset: auto -4px -5px;
  height: 3px;
  border-radius: 4px;
  background: #f5e481;
}
.header-button {
  position: absolute;
  inset-block: 0;
  width: 48px;
  border: 0;
  background: none;
  color: #26394e;
  font-size: 28px;
  line-height: 1;
}
.header-button:hover {
  background: #c4dfed80;
}
.header-button.close { right: 0; }
.header-button.back { left: 0; }
.menu-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 12px;
  background: #c7c9cb;
}
.menu-action {
  min-height: 65px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 8px;
  border: 1px solid #fff;
  border-radius: 6px;
  background: #fafafa;
  color: inherit;
  box-shadow: 0 2px 0 #68727c90;
}
.menu-action:hover { background: #e7f6ff; }
.icon-placeholder {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  background: #e2edf4;
}
.settings-layout {
  display: grid;
  grid-template-columns: minmax(60px, 22%) minmax(0, 1fr);
  gap: 8px;
  padding: 10px;
}
.settings-section {
  padding: 12px 6px;
  background: #c9e9fa;
  text-align: center;
  color: #175477;
}
.setting {
  align-self: start;
  display: grid;
  grid-template-columns: auto minmax(40px, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d7e3eb;
  background: white;
}
.setting input { width: 100%; accent-color: #279bc8; }
.graphics-settings {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d7e3eb;
  background: white;
}
.graphics-settings label {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
  align-items: center;
  gap: 6px 12px;
}
.graphics-settings input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid #a3c7db;
  border-radius: 5px;
  color: inherit;
  font: inherit;
}
.graphics-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 8px;
}
.graphics-actions button {
  padding: 7px 14px;
  border: 1px solid #a3c7db;
  border-radius: 5px;
  color: #24475b;
  background: #f7f9fb;
}
.graphics-actions button[type="submit"] { background: #d9edf8; }
.lobby-picker { padding: 8px 10px 0; }
.current-lobby {
  padding: 4px 6px 8px;
  font-size: 13px;
  color: #49647a;
}
.lobby-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  max-height: min(48dvh, 390px);
  overflow-y: auto;
  padding: 5px;
  background: #dde4e9;
  scrollbar-color: #849bac #dde4e9;
}
.lobby-card {
  display: grid;
  gap: 4px;
  min-width: 0;
  border: 2px solid #f5fafc;
  padding: 3px;
  border-radius: 7px;
  background: #f6f9fb;
  box-shadow: 0 1px 2px #31445680;
}
.lobby-card:hover { border-color: #67c7e9; }
.lobby-card.current { border-color: #afda47; }
.lobby-portrait {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 4px;
  background: #dbe9f2;
}
.lobby-portrait img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lobby-name {
  background: #3c536a;
  border-radius: 4px;
  padding: 3px;
  color: #fff;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-status { padding: 12px; }
.picker-footer {
  display: flex;
  justify-content: center;
  padding: 10px;
}
.picker-footer button {
  min-width: 124px;
  padding: 8px 12px;
  border: 1px solid #a3c7db;
  border-radius: 6px;
  background: #d9edf8;
  color: #24475b;
}
@media (max-width: 480px) {
  .lobby-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
