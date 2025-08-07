<script setup>
import { onBeforeMount } from 'vue'
import resourceLoader from '@assets/resource.js'
import SpineCanvas from '@/SpineCanvas.vue'
//modify.js中获取数据的函数入口
fun = async (str) => {
  const raw = await resourceLoader[str]()
  return raw.default
}

//<---vue+html

const fetchData = async () => {

}

const test = async () => {
  currentPlay.value = cloneItem(studentList.value[83])
}

const initialize = async () => {
  test()
}


onBeforeMount(() => {
  initialize();
})


//--->

</script>

<template>
  <!---<TestParticle></TestParticle>--->
  <SpineCanvas :currentPlay="currentPlay" :preLoadPlay="preLoadPlay" :duration="duration" v-if="currentPlay" />
</template>

<style scoped>
.main-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: -1;
}

.main-container.main-container-effect {
  z-index: 3;
  background-color: white;
  opacity: 1;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.expand-icon {
  position: absolute;
  top: 0;
  right: 0;
  width: 50px;
  height: 50px;
  cursor: pointer;
  z-index: 3001;
  opacity: 0;
  transition: opacity 0.5s ease-in-out;
}

.expand-icon:hover {
  opacity: 1;
  transition: opacity 0.5s ease-in-out;
}

.drawer-asides {
  height: 100%;
  overflow: hidden;
  position: absolute;
  bottom: 0px;
  left: 0px;
  padding: 0px;
  padding-top: 20px;
  width: 40%;
  flex-shrink: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
}

.drawer-main {
  height: 100%;
  overflow: hidden;
  position: absolute;
  right: 0px;
  bottom: 0px;
  width: 60%;
  display: flex;
  flex-direction: column;
  padding: 0px;
  padding-top: 20px;
  background-color: white;
  border-width: 0px;
  border-left: 1px;
  border-style: solid;
  border-color: black;
}

.deleteAreaContainer-hidden {
  display: none;
  z-index: -1;
}

.deleteAreaContainer-show {
  z-index: 3000;
  position: absolute;
  right: 0;
  top: 0;
  transition: background-color 0.5s ease-in-out;
}

.grid-draggable {
  display: grid;
  overflow-y: auto;
  grid-template-columns: repeat(5, calc((100% - 20px) / 5));
  grid-row-gap: 5px;
  grid-column-gap: 5px;
  height: auto
}


.playList-container {
  width: 100%;
  flex: 1;
  height: 0px;
  overflow-y: auto;
}

.grid-container-container {
  height: 0px;
  flex: 1;
  padding-right: 0px;
  padding-bottom: 20px;
}

.grid-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-x: hidden;
}

.drawer {
  background-color: rgba(0, 0, 0, 0);
  box-shadow: none;
}

.list-draggable {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  margin-right: 20px;
}

.deleteAreaContainer-delete-effect {
  background-color: red;
  transition: all 0.3s ease-in-out;
}
</style>
