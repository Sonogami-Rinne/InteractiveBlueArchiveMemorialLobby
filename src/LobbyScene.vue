<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import SpineCanvas from './SpineCanvas.vue'

defineProps({ prefab: { type: String, required: true } })

const errorMessage = ref('')
const frame = window.frameElement
const notify = (type, detail) => frame?.dispatchEvent(new CustomEvent(type, { detail }))
const mouseActivity = event => {
  if (event.pointerType === 'mouse') notify('lobby-mouse')
}

function activate(event) {
  mouseActivity(event)
  notify('lobby-activate')
}

function showError(error) {
  console.error(error)
  errorMessage.value = error.message
  notify('lobby-error', error.message)
}

onMounted(() => {
  window.addEventListener('pointermove', mouseActivity, { passive: true })
  window.addEventListener('pointerdown', activate, { passive: true })
  window.addEventListener('keydown', activate)
})
onUnmounted(() => {
  window.removeEventListener('pointermove', mouseActivity)
  window.removeEventListener('pointerdown', activate)
  window.removeEventListener('keydown', activate)
})
</script>

<template>
  <SpineCanvas :prefab="prefab" @ready="notify('lobby-ready')" @error="showError" />
  <p v-if="errorMessage && !frame" class="scene-error">{{ errorMessage }}</p>
</template>

<style scoped>
.scene-error {
  position: absolute;
  inset: 1rem 1rem auto;
  color: #fff;
  background: #27374a;
  padding: 1rem;
  overflow-wrap: anywhere;
}
</style>
