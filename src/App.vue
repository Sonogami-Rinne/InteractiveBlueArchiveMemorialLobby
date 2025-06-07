<script setup>
import { onBeforeMount, ref } from 'vue'
import SpineCanvas from '@/SpineCanvas.vue'


const currentPlay = ref(null)//当前播放
const studentId = 16

const fetchData = async () => {
  fetch('./json/student.json').then((res) => res.json()).then((data) => {
    currentPlay.value={sid:data[studentId].id, resourceId: data[studentId].resource}
  });
}

onBeforeMount(async () => {
  await fetchData()
})

</script>

<template>
  <SpineCanvas :currentPlay="currentPlay" v-if="currentPlay"/>
</template>
