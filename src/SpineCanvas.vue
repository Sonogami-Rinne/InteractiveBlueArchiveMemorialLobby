<script setup>
import { onMounted } from 'vue';

const props = defineProps(['currentPlay', 'playList'])
const emit = defineEmits(['updateCurrentPlay'])

const app = new PIXI.Application()
const spineScale = 1
const spineAnimationDefaultMix = 0.2;
let spineStudent = null
let setBonePosition = (ev) => { }
let spineOriginalBounds = null;
let isDragging = false
let touchBoneList = []
let currentTouchBoneInfo = []
const backgroundAudio = new Audio();
let voiceAudioMap = {};
let infoMap = null;
let disableTouchEvent = true;
let talkSentenceList = [];
let currentSentenceIndex = 0;
let currentPlayRule = null;
let playRule = null;

const ifSpineDebug = false;
const spineDebugger = new spine.SpineDebugRenderer();


const clamp = (value, min, max) => {
  return value < min ? min : (value > max ? max : value);
}
const checkInBounds = (x, y, px, py, halfWidth, halfHeight, offsetX, offsetY) => {
  return Math.abs(x - px - offsetX) < halfWidth && Math.abs(y - py - offsetY) < halfHeight;
}
const fetchData = async () => {
  let data = await import('@json/playRule.json')
  playRule = data.default

  data = await import('@json/info.json')
  infoMap = data.default

}



const PIXIInitialize = async () => {
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: window,
    backgroundColor: 0x000011,
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
      spineAnimationControl(currentTouchBoneInfo[0].data.name, 'after');
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
  app.stage.addChild(spineStudent);

  if (ifSpineDebug) spineDebug();

  //animationListener
  spineStudent.state.addListener({
    event: (entry, event) => {
      audioControl(event.stringValue)
    },
    end: (entry) => {
      if (entry.animation.name.includes('Start')) {
        disableTouchEvent = false;
      }
    },
    complete: (entry) => {
      const name = entry.animation.name;
      if (!name.includes('Idle') && talkSentenceList.includes(name.substring(0, name.lastIndexOf('_')))) {
        disableTouchEvent = false;
      }
    },
  });

  spineOriginalBounds = spineStudent.getBounds();
  spineResize();

  await spineAnimationInit();
  await audioInit();

  spineAnimationControl('None', 'main')
}
const spineResize = () => {
  if (spineStudent == null) return;
  const visibleWidth = spineOriginalBounds.width * spineScale;
  const visibleHeight = spineOriginalBounds.height * spineScale;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const scaleX = screenWidth / visibleWidth;
  const scaleY = screenHeight / visibleHeight;
  const scale = Math.max(scaleX, scaleY);
  spineStudent.scale.set(scale);

  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  const localCenterX = spineOriginalBounds.x + spineOriginalBounds.width / 2;
  const localCenterY = spineOriginalBounds.y + spineOriginalBounds.height / 2;

  spineStudent.x = centerX - localCenterX * scale;
  spineStudent.y = centerY - localCenterY * scale;
}

const spineAnimationInit = async () => {
  currentPlayRule = (props.currentPlay == null || playRule[props.currentPlay['sid']] == null) ? playRule['-1'] : playRule[props.currentPlay['sid'].toString()];
  spineStudent.state.data.defaultMix = spineAnimationDefaultMix;
  touchBoneList = [];
  ["Hip", "Touch_Point_Key", "Touch_Eye_Key", "Right_Chin"].forEach(name => {
    const bone = spineStudent.skeleton.findBone(name);
    if (!bone) return;
    const point = { x: spineStudent.x + bone.worldX * spineStudent.scale.x, y: spineStudent.y + bone.worldY * spineStudent.scale.y }
    touchBoneList.push({ bone, point });
  });

  currentSentenceIndex = 0;
  talkSentenceList = [];
  disableTouchEvent = true;
  spineStudent.skeleton.data.animations.forEach(animation => {
    const name = animation.name;
    if (name.startsWith('Talk_') && talkSentenceList.includes(name.substring(0, name.lastIndexOf('_'))) == false) {
      talkSentenceList.push(name.substring(0, name.lastIndexOf('_')));
    }
  });


  setBonePosition = (ev) => {
    if (disableTouchEvent) return;
    const pointx = ev.data.global.x;
    const pointy = ev.data.global.y;
    if (currentTouchBoneInfo.length > 0) {
      currentTouchBoneInfo[2] = pointx;
      currentTouchBoneInfo[3] = pointy;
      return;
    }
    let flag = true;
    const bounds = [infoMap[props.currentPlay.sid].TalkBounds || [300, 500, 0, -300], infoMap[props.currentPlay.sid].patBounds || [140, 60, 0, -50], infoMap[props.currentPlay.sid].lookBounds || [140, 50, 0, 10], infoMap[props.currentPlay.sid].chinBounds || [70, 70, 0, 0]]
    for (let i = 1; i < 4; i++) {
      if (touchBoneList[i]) {
        const point = touchBoneList[i].point;
        if (checkInBounds(pointx, pointy, point.x, point.y, bounds[i][0], bounds[i][1], bounds[i][2], bounds[i][3])) {
          currentTouchBoneInfo = [touchBoneList[i].bone, touchBoneList[i].point, pointx, pointy]
          spineAnimationControl(touchBoneList[i].bone.data.name, 'main')
          flag = false;
          return;
        }
      }
    }
    if (flag) {
      const point = touchBoneList[0].point;
      if (checkInBounds(pointx, pointy, point.x, point.y, bounds[0][0], bounds[0][1], bounds[0][2], bounds[0][3])) {
        disableTouchEvent = true;
        spineTalkAnimationControl(talkSentenceList[currentSentenceIndex]);
        currentSentenceIndex = (currentSentenceIndex + 1) % talkSentenceList.length;
        return;
      }
    }
  }
  spineStudent.beforeUpdateWorldTransforms = () => {
    if (currentTouchBoneInfo.length > 0) {
      currentTouchBoneInfo[0].y -= clamp((currentTouchBoneInfo[2] - currentTouchBoneInfo[1].x) * 150 / window.innerWidth, -100, 100)
      currentTouchBoneInfo[0].x -= clamp((currentTouchBoneInfo[3] - currentTouchBoneInfo[1].y) * 150 / window.innerHeight, -100, 100)
    }
    if (ifSpineDebug && Date.now() - objectLastModifyTime[0] > 100) {
      spineDebugger.renderDebug(spineStudent);
      objectLastModifyTime[0] = Date.now();
    }
  }
}
//互动动画+入场
const spineAnimationControl = (name, status) => {
  const type = name == 'Touch_Point_Key' ? 'pat' : name == 'Touch_Eye_Key' ? 'look' : name == 'None' ? 'home' : name == 'Chin' ? 'chin' : name;
  //const currentRule = (currentPlay.value == null || playRule[currentPlay.value['sid']] == null) ? playRule['-1'] : playRule[currentPlay.value['sid'].toString()];
  const target = {}
  Object.entries(currentPlayRule[type][status]).forEach(([key, value]) => {
    target[key] = value;
  })
  spinePlayAnimation(target);
}
const spineTalkAnimationControl = (name) => {
  const target = {
    [name + '_A']: { slot: 1 },
    [name + '_M']: { slot: 2 }
  }
  spinePlayAnimation(target);
}
const spinePlayAnimation = (data) => {
  Object.entries(data).forEach(([name, value]) => {
    let trackEntry = null;
    if (name != 'None') {
      trackEntry = spineStudent.state.addAnimation(value.slot, name, value.loop || false, value.delay || 0.)
      if (value.mix) trackEntry.mixDuration = value.mix;
      if (value.duration) trackEntry.animationEnd = value.duration;
    }
    else {
      trackEntry = spineStudent.state.addEmptyAnimation(value.slot, value.mix || spineAnimationDefaultMix, value[1])
    }
    if (value.audio) {
      audioControl(value.audio.name, value.audio, trackEntry)
    }
    if (value.effect) {
      animationEffectControl(value.effect, trackEntry)
    }
  });
}

const animationEffectControl = (effects, trackEntry) => {
  Object.entries(effects).forEach(([name, value]) => {
    setTimeout(() => {
      switch (name) {
        case 'fadeIn':
          effectArea.style.transition = ''
          effectArea.style.opacity = '1'
          effectArea.style.transition = `opacity ${value.duration || 0.2}s ${value.curve || 'ease-in-out'}`
          effectArea.style.opacity = '0'
          break;
        case 'fadeOut':
          effectArea.style.transition = ''
          effectArea.style.opacity = '0'
          effectArea.style.transition = `opacity ${value.duration || 0.2}s ${value.curve || 'ease-in-out'}`
          effectArea.style.opacity = '1'
          break;
      }
    }, Math.max(value.delay || 0 - trackEntry.trackTime, 0) * 1000)
  })
}

//--->

//<---音频控制
const audioControl = (name, info, trackEntry) => {
  const tmp = name ? voiceAudioMap[name] : backgroundAudio;
  if (info && info.delay && trackEntry) {
    setTimeout(() => {
      tmp.play();
    }, Math.max(info.delay - trackEntry.trackTime, 0));
  }
  else tmp.play();
}

const audioInit = async () => {
  const events = spineStudent.skeleton.data.events;
  let count = 1;

  backgroundAudio.pause();
  backgroundAudio.src = "";
  backgroundAudio.load();

  backgroundAudio.src = `./bgm/${infoMap[props.currentPlay.sid]['bgm']}`;
  backgroundAudio.addEventListener('canplaythrough', () => { count-- }, { once: true });
  backgroundAudio.addEventListener('error', () => count--);

  voiceAudioMap = {};
  events.forEach(event => {
    if (event.audioPath && event.audioPath.length > 0) {
      count++;

      const path = `./voice/${event.audioPath.replace(".wav", ".ogg").toLowerCase()}`;
      const audio = new Audio();
      audio.addEventListener('canplaythrough', () => { count--; }, { once: true });
      audio.addEventListener('error', () => { count--; console.warn(`Failed to load audio for event ${event.name}`) }, { once: true });
      audio.src = path;
      voiceAudioMap[event.name] = audio;
    }
  });
  const timeout = 5000;
  const start = Date.now();
  while (count > 0 && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

const spineDebug = () => {
  spineDebugger.drawClipping = false;
  spineDebugger.drawBoundingBoxes = false;
  spineDebugger.drawRegionAttachments = false;
  spineDebugger.drawMeshHull = false;
  spineDebugger.drawMeshTriangles = false;
  spineDebugger.drawPaths = false;
  spineDebugger.registerSpine(spineStudent)
}

onMounted(async () => {
  await fetchData();
  await PIXIInitialize();
  await spineInit(props.currentPlay.resourceId);
  window.addEventListener('resize', () => {
    spineResize();
  })
})





</script>

<template>
  <el-container class="main-container" id="canvas">
  </el-container>
  <div class="main-container main-container-effect" id="effectArea"></div>
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
</style>