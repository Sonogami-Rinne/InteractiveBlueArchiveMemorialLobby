<script setup>
import { inject, onBeforeMount, onMounted, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import base64Loader from '@js/resource.js'
import SpineCanvas from '@/SpineCanvas.vue'

//modify.js中获取数据的函数入口
fun = async (str) => {
  const raw = await base64Loader[str]()
  return raw.default
}

const language = inject('language')
//<---vue+html
let localization = null;
const drawer = ref(false)//菜单显示与否
const academyValue = ref(null)//v-model
const clubValue = ref(null)//v-model
let academyNameList = {}//auto-complete的suggestion
let clubNameList = {}//auto-complete的suggestion
const ifRandom = ref(true)//v-model
const duration = ref(5)//v-model
const playList = ref([])//播放列表
const studentList = ref([])//全部学生
let objectLastModifyTime = [0, 0, 0, 0, 0]//debug,
const filteredStudentList = ref([])//经过学校和社团过滤后的结果
const currentPlay = ref(null)//当前播放
// let playRule = null//播放规则
let deleteArea = null
const deleteAreaWasted = ref([])
const spineCanvas = ref(null)
//--->

//--->spineDebug
// const ifSpineDebug = false;
// const spineDebugger = new spine.SpineDebugRenderer();
//--->

//--->pixi + spine
// const spineScale = 1
// const spineAnimationDefaultMix = 0.2;
// let app = new PIXI.Application()
// let spineStudent = null
// let setBonePosition = (ev) => { }
// let spineOriginalBounds = null;
// let isDragging = false
// let touchBoneList = []
// let currentTouchBoneInfo = []
// const backgroundAudio = new Audio();
// let voiceAudioMap = {};
// let infoMap = null;
// let disableTouchEvent = true;
// let talkSentenceList = [];
// let currentSentenceIndex = 0;
// let currentPlayRule = null;

//--->

//<---base


const fetchData = async () => {
  let data = await import('@json/localization.json')
  localization = data.default[language]
  data = await import('@json/academy.json')
  data.default.forEach((item) => {
    academyNameList[item['name'][language]] = item['id']
  })

  data = await import('@json/club.json')
  data.default.forEach((item) => {
    clubNameList[item['name'][language]] = { id: item['id'], academy: item['academy'] }
  })

  data = await import('@json/student.json')
  studentList.value = data.default.map(item => ({
    id: item['id'],
    sid: item['id'],
    name: item['name'][language].substring(item['name'][language].indexOf(' ') + 1),
    academy: item['academy'],
    club: item['club'],
    resourceId: item['resource']
  }));

  filteredStudentList.value = studentList.value

  // data = await import('@json/playRule.json')
  // playRule = data.default

  // data = await import('@json/info.json')
  // infoMap = data.default

  data = localStorage.getItem('currentPlay')
  currentPlay.value = JSON.parse(data || '{}')

  data = localStorage.getItem('playList')
  playList.value = JSON.parse(data || '[]')

  data = localStorage.getItem('ifRandom')
  ifRandom.value = data == 'true'

  data = localStorage.getItem('duration')
  duration.value = parseInt(data || '0')
}

const cloneItem = (obj) => {
  return { ...obj, id: Date.now(), name: obj.name, resourceId: obj.resourceId, multiLobby: obj.multiLobby }
}

const saveData = (key, value) => {
  if (typeof value == 'object') {
    localStorage.setItem(key, JSON.stringify(value))
  }
  else {
    localStorage.setItem(key, value.toString())
  }
}
const getAcademySuggestion = (query, cb) => {
  const result = Object.keys(academyNameList)
    .filter(item => item.toLowerCase().includes(query.toLowerCase())).map(item => ({
      value: item,
    }))
  cb(result);
}
const getClubSuggestion = (query, cb) => {
  const result = Object.keys(clubNameList)
    .filter(item => ((academyValue.value && academyValue.value != "") ? clubNameList[item]['academy'] === academyNameList[academyValue.value] : true) && item.toLowerCase().includes(query.toLowerCase())).map(item => ({
      value: item,
    }))
  cb(result);
}
const refreshStudentFilter = () => {
  filteredStudentList.value = studentList.value.filter(item => {
    return (academyValue.value && academyValue.value != "") ? (item.academy == academyNameList[academyValue.value] && ((clubValue.value && clubValue.value != "") ? item.club == clubNameList[clubValue.value].id : true)) : ((clubValue.value && clubValue.value != "") ? item.club == clubNameList[clubValue.value].id : true)
  })
}
const clubSelected = () => {

  if ((academyValue.value == null || academyValue.value == "") && clubValue.value) {
    //真的服了
    Object.entries(academyNameList).forEach(([key, value]) => {
      if (value === clubNameList[clubValue.value].academy) {
        academyValue.value = key
        return
      }
    })
  }
  refreshStudentFilter()
}

const playListOnStart = (eve) => {
  if (deleteArea == null) deleteArea = document.getElementById("deleteArea")
  deleteArea.classList.remove("deleteArea-hidden")
}
const playListOnMove = (eve) => {
  // if (checkOnArea(eve.item)) {
  //   //添加class实现动画
  deleteArea.classList.add("deleteArea-alert")
}
const playListOnEnd = (eve) => {
  // if (checkOnArea(eve.item)) {
  //   const index = playList.findIndex(
  //     item => item.id === evt.draggedContext.element.id
  //   )
  //   playList.splice(index, 1)
  // }
  deleteArea.classList.add("deleteArea-hidden")
}
const playListOnChoose = (ev) => {
  playList.value.forEach((item) => {
    if (item.id === ev.item.getAttribute("value")) {
      currentPlay.value = item
      return;
    }
  })
}
const test = async () => {
  currentPlay.value = cloneItem(studentList.value[0])
}




const initialize = async () => {
  await fetchData();
  watch(currentPlay, async (value) => {
    if (Date.now() - objectLastModifyTime[0] > 1000) {
      saveData('currentPlay', value)
    }
    objectLastModifyTime[0] = Date.now();
  })
  watch(ifRandom, async (value) => {

    if (Date.now() - objectLastModifyTime[1] > 1000) {
      saveData('ifRandom', value)
    }
    objectLastModifyTime[1] = Date.now();
  })
  watch(duration, async (value) => {

    if (Date.now() - objectLastModifyTime[2] > 1000) {
      saveData('duration', value)
    }
    objectLastModifyTime[2] = Date.now();
  })
  watch(playList, async (value) => {
    if (Date.now() - objectLastModifyTime[3] > 5000) {
      saveData('playList', value)
    }
    objectLastModifyTime[3] = Date.now();
  })
  test()
}


onBeforeMount(() => {
  initialize();
})
onMounted(() => {
  deleteArea = document.getElementById('deleteArea')
})

//--->

</script>

<template>
  <SpineCanvas ref="spineCanvas" :currentPlay="currentPlay" :playList =  "playList" v-if="currentPlay && playList"/>
  <svg class="expand-icon" id="expand-icon" @click="drawer = true" xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1024 1024">
    <path fill="currentColor"
      d="M389.44 768a96.064 96.064 0 0 1 181.12 0H896v64H570.56a96.064 96.064 0 0 1-181.12 0H128v-64zm192-288a96.064 96.064 0 0 1 181.12 0H896v64H762.56a96.064 96.064 0 0 1-181.12 0H128v-64zm-320-288a96.064 96.064 0 0 1 181.12 0H896v64H442.56a96.064 96.064 0 0 1-181.12 0H128v-64z">
    </path>
  </svg>
  <el-drawer v-model="drawer" :with-header="false" size="70%">

    <el-container style="height: 100%">
      <el-aside class="drawer-asides">
        <el-row>
          <el-col :span="2"></el-col>
          <el-col :span="6">
            <el-switch v-model="ifRandom" inline-prompt :active-text="localization['text-random']" size="large"
              :inactive-text="localization['text-sequence']"></el-switch>
          </el-col>
          <el-col :span="6"></el-col>
          <el-col :span="6">
            <el-input-number v-model="duration"></el-input-number>
          </el-col>
        </el-row>
        <div style="width:100%;flex:1;height:0px;overflow-y: auto;">
          <VueDraggable v-model="playList" :animation="150" group="student" :onStart="playListOnStart"
            :onChoose="playListOnChoose" :onEnd="playListOnEnd" :onMove="playListOnMove" class="grid-draggable"
            style="grid-template-columns: repeat(4, 90px);overflow-x: hidden;">
            <div v-for="item in playList" :key="item.id" class="grid-draggable-item" :value="item.id">
              <img :src="'./portrait/' + item.resource + '.png'" style="width:100%;object-fit: cover;">
              <p style="text-align: center;padding: 0px;margin:0px;font-size: small;">{{ item.name }}</p>
            </div>
          </VueDraggable>
        </div>
        <el-row>
          <el-col :span="11"></el-col>
          <el-col :span="6">
            <el-button
              @click="() => { filteredStudentList.forEach((item) => { playList.push(cloneItem(item)) }) }">{{ localization['text-addAll'] }}</el-button>
          </el-col>
          <el-col :span="1"></el-col>
          <el-col :span="6">
            <el-button @click="playList = []">{{ localization['text-removeAll'] }}</el-button>
          </el-col>
        </el-row>

      </el-aside>
      <el-main class="drawer-main">
        <el-container style="height: 100%;">
          <el-header style="padding-right: 0px;padding-bottom: 0px;">
            <el-row>
              <el-col :span="11">
                <el-autocomplete v-model="academyValue" :fetch-suggestions="getAcademySuggestion" clearable
                  class="inline-input w-50" :placeholder="localization['text-autoComplete1-placeholder']" @clear="refreshStudentFilter"
                  @select="() => { clubValue = null; refreshStudentFilter() }" value-key="value" />
              </el-col>
              <div style="width: 10px;"></div>
              <el-col :span="11">
                <el-autocomplete v-model="clubValue" :fetch-suggestions="getClubSuggestion" clearable
                  class="inline-input w-50" :placeholder="localization['text-autoComplete2-placeholder']" @clear="refreshStudentFilter" @select="clubSelected" />
              </el-col>
            </el-row>
          </el-header>
          <el-main style="height: 0px;flex:1;padding-right: 0px;padding-bottom: 0px;">
            <div style="display: flex; flex-direction: column; height: 100%;">
              <VueDraggable v-model="filteredStudentList" :animation="150" scroll :onChoose="studentListOnChoose"
                :group="{ name: 'student', pull: 'clone', put: false }" :onStart="(ev) => { asideVisible = true }"
                :clone="cloneItem" :sort="false" :onEnd="(ev) => { asideVisible = playList.length != 0 }"
                class="grid-draggable">
                <div v-for="item in filteredStudentList" :key="item.id" class="grid-draggable-item" :value="item.id">
                  <img :src="'./portrait/' + item.resourceId + '.png'" style="width:100%;object-fit: cover;">
                  <p class="grid-draggable-item-text">{{ item.name }}</p>
                </div>
              </VueDraggable>
            </div>
          </el-main>
        </el-container>
      </el-main>
      <el-main class="drawer-main deleteArea-hidden" id="deleteArea">
        <VueDraggable v-model="deleteAreaWasted" :group="{ name: 'student', pull: false }"
          :onAdd="(ev) => { deleteAreaWasted = [] }" onmouseover="(ev) => {console.log('a')}" style="height:100%">

        </VueDraggable>
      </el-main>
    </el-container>



  </el-drawer>
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
  position: relative;
  width: 40%;
  flex-shrink: 1;
  display: flex;
  flex-direction: column;
}

.drawer-main {
  height: 100%;
  overflow: hidden;
  position: relative;
  width: 60%;
  display: flex;
  flex-direction: column;
  padding-right: 0px;
  padding-bottom: 0px;
}

.deleteArea-hidden {
  display: none;
  z-index: -1;
}

.deleteArea-show {
  z-index: 3000;
  position: absolute;
  right: 0;
  top: 0;
}

.deleteArea-alert {
  color: red;
}

.grid-draggable {
  display: grid;
  flex: 1;
  overflow-y: auto;
  grid-template-columns: repeat(6, 90px);
  grid-auto-rows: 120px;
  height: 100%;
}

.grid-draggable-item {
  height: 120px;
  display: flex;
  flex-direction: column;
}

.grid-draggable-item-text {
  text-align: center;
  padding: 0px;
  margin: 0px;
  font-size: small;
}
</style>
