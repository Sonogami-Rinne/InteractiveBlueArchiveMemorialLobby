<script setup>
import { inject, onBeforeMount, onMounted, ref, watch, toRaw } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import resourceLoader from '@js/resource.js'
import SpineCanvas from '@/SpineCanvas.vue'
import DraggableItem from '@/DraggableItem.vue'

//modify.js中获取数据的函数入口
fun = async (str) => {
  const raw = await resourceLoader[str]()
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
let objectLastStablevalue = [null, null, null, null];
const filteredStudentList = ref([])//经过学校和社团过滤后的结果
const currentPlay = ref(null)//当前播放

const deleteAreaContainer = ref(null)
const preLoadPlay = ref({})
let dragItemIndex = null;

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
    name: item['name'][language],
    academy: item['academy'],
    club: item['club'],
    resourceId: item['resource'],
    portrait: item['portrait'],
    voice: item['voice']
  }));

  filteredStudentList.value = studentList.value

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
  return { ...obj, id: Date.now(), name: obj.name, resourceId: obj.resourceId, parent: 'playList' }
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

const getPreloadPlay = () => {
  if (playList.value.length > 1) {
    if (ifRandom.value) {
      let tmp = playList.value[Math.floor(Math.random() * playList.value.length - 1) + 1];
      preLoadPlay.value = tmp == currentPlay.value ? playList.value[0] : tmp;
    }
    else {
      preLoadPlay.value = playList.value[(playList.value.indexOf(currentPlay.value) + 1) % playList.value.length];
    }
  }
}
const playListOnStart = (index) => {
  dragItemIndex = index
  deleteAreaContainer.value.$el.classList.remove("deleteAreaContainer-hidden")
  deleteAreaContainer.value.$el.classList.add("deleteAreaContainer-show")
}
const playListOnEnd = (ev) => {
  //dragItem = null;
  deleteAreaContainer.value.$el.classList.remove("deleteAreaContainer-delete-effect")
  deleteAreaContainer.value.$el.classList.add("deleteAreaContainer-hidden")
  deleteAreaContainer.value.$el.classList.remove("deleteAreaContainer-show")
}
const deleteAreaDragEnter = (ev) => {
  ev.preventDefault();
  deleteAreaContainer.value.$el.classList.add("deleteAreaContainer-delete-effect")
}

const deleteAreaDragLeave = (ev) => {
  ev.preventDefault();
  deleteAreaContainer.value.$el.classList.remove("deleteAreaContainer-delete-effect")
}
const deleteAreaDrop = async (ev) => {
  ev.preventDefault()
  setTimeout(() => {
    playList.value.splice(dragItemIndex, 1)
    dragItemIndex = null;
  }, 10)


}

const test = async () => {
  currentPlay.value = cloneItem(studentList.value[64])
}

const checkSave = async (index, valueObject, target, compare = (a, b) => { return a == b }, copy = (a) => { return a }) => {
  const inner = () => {
    if (compare(objectLastStablevalue[index], valueObject.value)) {
      saveData(target, valueObject.value)
      objectLastStablevalue[index] = null
    }
    else {
      objectLastStablevalue[index] = copy(valueObject.value);
      setTimeout(inner, 1000)
    }
  }
  if (objectLastStablevalue[index] == null) {
    objectLastStablevalue[index] = copy(valueObject.value);
    setTimeout(inner, 1000)
  }
}
const saveData = (key, value) => {
  if (typeof value == 'object') {
    localStorage.setItem(key, JSON.stringify(value))
  }
  else {
    localStorage.setItem(key, value.toString())
  }
}

const initialize = async () => {
  await fetchData();
  watch(currentPlay, () => {
    checkSave(0, currentPlay, 'currentPlay', (a, b) => { return a.id == b.id }, (a) => { return toRaw(a) })
  })
  watch(ifRandom, () => {
    checkSave(1, ifRandom, 'ifRandom')
  })
  watch(duration, () => {
    checkSave(2, duration, 'duration')
  })
  watch(playList, () => {
    checkSave(3, playList, 'playList', (a, b) => { return a == toRaw(b) }, (a) => { return toRaw(a) })
  })
  test()
}


onBeforeMount(() => {
  initialize();
})


//--->

</script>

<template>
  <SpineCanvas :currentPlay="currentPlay" :preLoadPlay="preLoadPlay" :duration="duration" v-if="currentPlay"
    @updateCurrentPlay="() => { console.warn('Unimplemented') }" @askForPreload="getPreloadPlay" />
  <svg class="expand-icon" id="expand-icon" @click="drawer = true" xmlns="http://www.w3.org/2000/svg" v-show="!drawer"
    viewBox="0 0 1024 1024">
    <path fill="currentColor"
      d="M389.44 768a96.064 96.064 0 0 1 181.12 0H896v64H570.56a96.064 96.064 0 0 1-181.12 0H128v-64zm192-288a96.064 96.064 0 0 1 181.12 0H896v64H762.56a96.064 96.064 0 0 1-181.12 0H128v-64zm-320-288a96.064 96.064 0 0 1 181.12 0H896v64H442.56a96.064 96.064 0 0 1-181.12 0H128v-64z">
    </path>
  </svg>
  <el-drawer v-model="drawer" :with-header="false" size="60%" class="drawer">

    <el-container style="height: 100%">
      <el-aside class="drawer-asides">
        <el-container style="height: 100%;flex-direction: column;">
          <el-header style="align-items: center;flex-direction: row;display: flex;">
            <el-row style="width:100%">
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
          </el-header>
          <el-main class="grid-container-container">
            <div class="grid-container">
              <VueDraggable v-model="playList" :animation="150" group="student" :onEnd="playListOnEnd"
                ghostClass="ghost-item" class="list-draggable">
                <DraggableItem v-for="(item, index) in playList" :key="playList.length + item.id"
                  :imgURL="`./portrait/${item.portrait || item.resourceId}.png`" :name="item.name"
                  @dblclick="(ev) => { console.log(ev) }" class="playList-item" ghost-class="ghost-item" :index="index"
                  @itemDragStart="playListOnStart">
                </DraggableItem>
              </VueDraggable>
            </div>
          </el-main>
          <el-footer>
            <el-row>
              <el-col :span="11"></el-col>
              <el-col :span="6">
                <el-button
                  @click="() => { filteredStudentList.forEach((item) => { playList.push(cloneItem(item)) }) }">{{
                    localization['text-addAll'] }}</el-button>
              </el-col>
              <el-col :span="1"></el-col>
              <el-col :span="6">
                <el-button @click="playList = []">{{ localization['text-removeAll'] }}</el-button>
              </el-col>
            </el-row>
          </el-footer>
        </el-container>

      </el-aside>
      <el-main class="drawer-main">
        <el-container style="height: 100%;">
          <el-header
            style="padding-right: 0px;padding-bottom: 0px;align-items: center;flex-direction: row;display: flex;">
            <el-row style="width:100%">
              <el-col :span="11">
                <el-autocomplete v-model="academyValue" :fetch-suggestions="getAcademySuggestion" clearable
                  class="inline-input w-50" :placeholder="localization['text-autoComplete1-placeholder']"
                  @clear="refreshStudentFilter" @select="() => { clubValue = null; refreshStudentFilter() }"
                  value-key="value" />
              </el-col>
              <div style="width: 10px;"></div>
              <el-col :span="11">
                <el-autocomplete v-model="clubValue" :fetch-suggestions="getClubSuggestion" clearable
                  class="inline-input w-50" :placeholder="localization['text-autoComplete2-placeholder']"
                  @clear="refreshStudentFilter" @select="clubSelected" />
              </el-col>
            </el-row>
          </el-header>
          <el-main class="grid-container-container">
            <div class="grid-container">
              <VueDraggable v-model="filteredStudentList" :animation="150" scroll
                :group="{ name: 'student', pull: 'clone', put: false }" :clone="cloneItem" :sort="false"
                :onEnd="(ev) => { asideVisible = playList.length != 0 }" class="grid-draggable">
                <DraggableItem v-for="item in filteredStudentList" :key="item.id" class="studentList-item"
                  :imgURL="`./portrait/${item.portrait || item.resourceId}.png`" :name="item.name" :parent="'filteredStudentList'"
                  @dblclick="(ev) => { console.log(ev) }"></DraggableItem>
              </VueDraggable>
            </div>
          </el-main>
        </el-container>
      </el-main>
      <el-main class="drawer-main deleteAreaContainer-hidden" id="deleteAreaContainer" ref="deleteAreaContainer"
        @drop="deleteAreaDrop" @dragenter="deleteAreaDragEnter" @dragleave="deleteAreaDragLeave"
        @dragover="(ev) => { ev.preventDefault() }">
        <!-- <VueDraggable v-model="deleteAreaWasted" :group="{ name: 'student', pull: false }" :animation="150"
          :onAdd="(ev) => { deleteAreaWasted = [] }" style="height:100%" ghostClass="delete-item" id="deleteArea">

        </VueDraggable> -->
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
