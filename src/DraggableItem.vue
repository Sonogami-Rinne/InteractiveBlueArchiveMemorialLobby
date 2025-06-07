<script setup>
import { computed, ref } from 'vue'

const props = defineProps(['imgURL', 'name', 'index'])
const emit = defineEmits(['itemDragStart'])

const shortName = computed(() => props.name.substring(props.name.indexOf(' ') + 1))
console.log(props.imgURL)
</script>

<template>
    <div @dragstart="(ev) => { emit('itemDragStart', props.index) }" >
        <div class="img-container" :style="{ backgroundImage: 'url(' + imgURL + ')' }"></div>
        <img :src="imgURL" class="card-img">
        <div class="divide-line"></div>
        <p class="name">
            {{ name }}
        </p>
        <p class="short-name">{{ shortName }}</p>
    </div>
</template>



<style scoped>
.studentList-item {
    border-radius: 5px;
    background-color: white;
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
    width: auto;
    height: min-content;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.studentList-item .divide-line {
    width: 100%;
    height: 1px;
    background-color: #E5E5E5;
    pointer-events: none;
    display: show;
}

.studentList-item .img-container {
    display: none;
}

.studentList-item .card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    overflow: hidden;
    display: show;
}

.studentList-item .short-name {
    text-align: center;
    padding: 0px;
    margin: 0px;
    font-size: auto;
    pointer-events: none;
}

.studentList-item .name {
    display: none;
}

.playList-item {
    height: 60px;
    display: flex;
    align-items: center;
    flex-direction: row;
    border-bottom: 1px;
    border-bottom-style: solid;
    border-bottom-color: #ddd;
}

.playList-item:last-child {
    border-bottom: none;
}

.playList-item .img-container {
    height: 100%;
    width: 60px;
    display: inline-block;
    background-repeat: no-repeat;
    background-size: cover;
    display: show;
}

.playList-item .card-img {
    display: none;
}

.playList-item .divide-line {
    display: none;
}

.playList-item .name {
    margin-left: 20px;
    font-size: auto;
}

.playList-item .short-name {
    display: none;
}

.ghost-item {
    height: 60px;
    display: flex;
    align-items: center;
    flex-direction: row;
    border-bottom: 1px;
    border-bottom-style: solid;
    border-bottom-color: #ddd;
}

.ghost-item:last-child {
    border-bottom: none;
}

.ghost-item .img-container {
    height: 100%;
    width: 60px;
    display: inline-block;
    background-repeat: no-repeat;
    background-size: cover;
    display: show;
}

.ghost-item .card-img {
    display: none;
}

.ghost-item .divide-line {
    display: none;
}

.ghost-item .name {
    margin-left: 20px;
    font-size: auto;
    display: show;
}

.ghost-item .short-name {
    display: none;
}

</style>
