<script setup>
import { onMounted, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import base64Loader from '@js/resource.js'

fun = async (str) => {
  const raw = await base64Loader[str]()
  return raw.default
}

const ifSpineDebug = true;
const spineDebugger = new spine.SpineDebugRenderer();

const language = 'chs'
const spineScale = 1
const drawer = ref(false)//菜单显示与否
const academyValue = ref(null)//v-model
const clubValue = ref(null)//v-model
let academyNameList = {}//auto-complete的suggestion
let clubNameList = {}//auto-complete的suggestion
const ifRandom = ref(true)//v-model
const duration = ref(5)//v-model
const playList = ref([])//播放列表
const studentList = ref([])//全部学生
const filteredStudentList = ref([])//经过学校和社团过滤后的结果
const currentPlay = ref(null)//当前播放
const isPlaying = ref(false)//播放状态
let playRule = null//播放规则
let deleteArea = null
const deleteAreaWasted = ref([])
let app = new PIXI.Application()
let spineStudent = null
let setBonePosition = (ev) => { }
let isDragging = false
let touchBoneList = []
let currentTouchBoneInfo = []
let spineAnimationListener = null;
let currentTalkSentence = 0;


//<---base

const clamp = (value, min, max) => {
  return value < min ? min : (value > max ? max : value);
}
const checkInBounds = (x, y, px, py, halfWidth, halfHeight) => {
  return Math.abs(x - px) < halfWidth && Math.abs(y - py) < halfHeight;
}
const fetchData = async () => {
  let data = await import('@json/academy.json')
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
    name: item['name'][language].substring(item['name'][language].indexOf(' ')+1),
    academy: item['academy'],
    club: item['club'],
    resource: item['resource']
  }));

  filteredStudentList.value = studentList.value

  data = await import('@json/playRule.json')
  playRule = data.default

  data = localStorage.getItem('currentPlay')
  currentPlay.value = JSON.parse(data || '{}')

  data = localStorage.getItem('playList')
  playList.value = JSON.parse(data || '[]')

  data = localStorage.getItem('ifRandom')
  ifRandom.value = data == 'true'

  data = localStorage.getItem('duration')
  duration.value = parseInt(data || '0')
}

const saveData = (key, value) => {
  if (typeof value == 'object') {
    localStorage.setItem(key, JSON.stringify(value))
  }
  else {
    localStorage.setItem(key, value.toString())
  }
}

//--->

//<---vue相关的

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
const cloneItem = (obj) => {
  return { ...obj, id: Date.now(), name: obj.name, resource: obj.resource, multiLobby: obj.multiLobby }
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

//--->

//<---pixi/spine

const PIXIInitialize = async () => {
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: window,
    backgroundColor: 0x000000,
    hello: true,
  })
  document.getElementById("canvas").appendChild(app.view);

  app.stage.hitArea = app.screen;
  app.stage.eventMode = "dynamic";
  isDragging = false;

  app.stage.on("pointerdown", (e) => {
    isDragging = true;
    setBonePosition(e);
  });

  app.stage.on("globalpointermove", (e) => {
    if (isDragging) setBonePosition(e);
  });

  app.stage.on("pointerup", (e) => {
    isDragging = false;
    if (currentTouchBoneInfo.length > 0) {
      currentTouchBoneInfo[0].x = 0;
      currentTouchBoneInfo[0].y = 0;
      spineAnimationControl(currentTouchBoneInfo[0].data.name, 'end');
      currentTouchBoneInfo = [];
    }
  });
}
const spineInit = async (name) => {
  if (spineStudent) {
    app.stage.removeChild(spineStudent);
    spineStudent.destroy({ children: true, texture: true, baseTexture: true });
  }
  PIXI.Assets.add({ alias: `${name}skel`, src: `${name}_home.base641` });
  PIXI.Assets.add({ alias: `${name}atlas`, src: `${name}_home.atlas1` });
  await PIXI.Assets.load([`${name}skel`, `${name}atlas`]);
  spineStudent = spine.Spine.from({
    skeleton: `${name}skel`,
    atlas: `${name}atlas`,
    scale: 1,
  });
  spineStudent.state.data.defaultMix = 0.2;
  app.stage.addChild(spineStudent);

  if(ifSpineDebug) spineDebug();

  //animationListener

  spineResize();

  touchBoneList = [];
  ["Touch_Point_Key", "Touch_Eye_Key"].forEach(name => {
    const bone = spineStudent.skeleton.findBone(name);
    const point = { x: spineStudent.x + bone.worldX * spineStudent.scale.x, y: spineStudent.y + bone.worldY * spineStudent.scale.y }
    touchBoneList.push({ bone, point });
  });
  setBonePosition = (ev) => {
    const pointx = ev.data.global.x;
    const pointy = ev.data.global.y;
    if (currentTouchBoneInfo.length > 0) {
      currentTouchBoneInfo[2] = pointx;
      currentTouchBoneInfo[3] = pointy;
      return;
    }
    let isFirst = true;
    for (let { bone, point } of touchBoneList) {
      if (checkInBounds(pointx, pointy, point.x, point.y, 50, 20)) {
        currentTouchBoneInfo = [bone, point, pointx, pointy]
        spineAnimationControl(bone.data.name, 'start')
        return;
      }
      isFirst = false;
    }
  }
  spineStudent.beforeUpdateWorldTransforms = () => {
    if (currentTouchBoneInfo.length > 0) {
      currentTouchBoneInfo[0].y -= clamp((currentTouchBoneInfo[2] - currentTouchBoneInfo[1].x) * 150 / window.innerWidth, -100, 100)
      currentTouchBoneInfo[0].x -= clamp((currentTouchBoneInfo[3] - currentTouchBoneInfo[1].y) * 150 / window.innerHeight, -100, 100)
    }
  }

  currentTalkSentence = 0;

  spineAnimationControl('None','start')
}
const spineResize = () => {
  if (spineStudent == null) return;
  const originalBounds = spineStudent.getBounds();
  const visibleWidth = originalBounds.width * spineScale;
  const visibleHeight = originalBounds.height * spineScale;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const scaleX = screenWidth / visibleWidth;
  const scaleY = screenHeight / visibleHeight;
  const scale = Math.max(scaleX, scaleY);
  spineStudent.scale.set(scale);

  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  const localCenterX = originalBounds.x + originalBounds.width / 2;
  const localCenterY = originalBounds.y + originalBounds.height / 2;

  spineStudent.x = centerX - localCenterX * scale;
  spineStudent.y = centerY - localCenterY * scale;
}
//idle和startIdle在0，A在1,M在2
const spinePlayAnimation = (data) => {
  let isFirst = true;
  //0:slot,1:loop,2:delay
  Object.entries(data).forEach(([name, value]) => {
    console.log(name, value)
    if (isFirst && name != 'None') {
      isFirst = false;
      spineStudent.state.setAnimation(value[0], name, value[1]);
      console.log("a")
    }
    else if (name == 'None') {
      spineStudent.state.addEmptyAnimation(value[0], 0.1, value[1])
    }
    else {
      spineStudent.state.addAnimation(value[0], name, value[1], value[2]);
    }
  });
}

const spineAnimationControl = (name, status) => {
  const type = name == 'Touch_Point_Key' ? 'pat' : name == 'Touch_Eye_Key' ? 'look' : name == 'None' ? 'home' : 'chin';
  const currentRule = (currentPlay.value == null || playRule[currentPlay.value['sid']] == null) ? playRule['-1'] : playRule[currentPlay.value['sid'].toString()];
  const target = {}
  if (status == 'start') {
    const before = currentRule[type]['before'] || {};
    Object.entries(before).forEach(([key, value]) => {
      target[key] = [value['slot'], value['loop'] == 'true', value['delay']]
    });
  }
  const main = currentRule[type]['main'];
  Object.entries(main).forEach(([key, value]) => {
    target[key] = [value['slot'], value['loop'] == 'true', value['delay']]
  });
  if (status == 'end') {
    const after = currentRule[type]['after'] || {};
    Object.entries(after).forEach(([key, value]) => {
      target[key] = [value['slot'], value['loop'] == 'true', value['delay']]
    });
  }
  console.log(target)
  spinePlayAnimation(target);
}

//--->







//<---other

const test = async () => {
  currentPlay.value = cloneItem(studentList.value[0])
  await spineInit(currentPlay.value['resource'])
  //spineResize()
  //spinePlayAnimation({ "Idle_01": [0] });
}

const spineDebug = () =>{
  spineDebugger.drawClipping = false;
  spineDebugger.drawBoundingBoxes = false;
  spineDebugger.drawRegionAttachments = false;
  spineDebugger.drawMeshHull = false;
  spineDebugger.drawMeshTriangles = false;
  spineDebugger.drawPaths = false;
  spineDebugger.registerSpine(spineStudent)
}


const initialize = async() => {
  await fetchData();
  deleteArea = document.getElementById('deleteArea')
  await PIXIInitialize()
  test()
  window.addEventListener('resize', () => {
    spineResize()
  })
}

onMounted(() => {
  initialize();
})

//--->

</script>

<template>
  <el-container class="main-container" id="canvas">
  </el-container>
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
            <el-switch v-model="ifRandom" inline-prompt active-text="随机" size="large" inactive-text="顺序"></el-switch>
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
              <img :src="'/portrait/' + item.resource + '.png'" style="width:100%;object-fit: cover;">
              <p style="text-align: center;padding: 0px;margin:0px;font-size: small;">{{ item.name }}</p>
            </div>
          </VueDraggable>
        </div>
        <el-row>
          <el-col :span="11"></el-col>
          <el-col :span="6">
            <el-button
              @click="() => { filteredStudentList.forEach((item) => { playList.push(cloneItem(item)) }) }">添加全部</el-button>
          </el-col>
          <el-col :span="1"></el-col>
          <el-col :span="6">
            <el-button @click="playList = []">移除全部</el-button>
          </el-col>
        </el-row>

      </el-aside>
      <el-main class="drawer-main">
        <el-container style="height: 100%;">
          <el-header style="padding-right: 0px;padding-bottom: 0px;">
            <el-row>
              <el-col :span="11">
                <el-autocomplete v-model="academyValue" :fetch-suggestions="getAcademySuggestion" clearable
                  class="inline-input w-50" placeholder="输入学院名称" @clear="refreshStudentFilter"
                  @select="() => { clubValue = null; refreshStudentFilter() }" value-key="value" />
              </el-col>
              <div style="width: 10px;"></div>
              <el-col :span="11">
                <el-autocomplete v-model="clubValue" :fetch-suggestions="getClubSuggestion" clearable
                  class="inline-input w-50" placeholder="输入社团姓名" @clear="refreshStudentFilter" @select="clubSelected" />
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
                  <img :src="'/portrait/' + item.resource + '.png'" style="width:100%;object-fit: cover;">
                  <p style="text-align: center;padding: 0px;margin:0px;font-size: small;">{{ item.name }}</p>
                </div>
              </VueDraggable>
            </div>
          </el-main>
        </el-container>
      </el-main>
      <el-main class="drawer-main deleteArea-hidden" id="deleteArea"
        style="z-index:3000;position: absolute;right: 0;top: 0;">
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
</style>
