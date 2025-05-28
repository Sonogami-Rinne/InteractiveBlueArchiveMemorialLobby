<script setup>
import { effect, onMounted, watch } from 'vue';

const props = defineProps(['currentPlay', 'preLoadPlay', 'duration'])
const emit = defineEmits(['updateCurrentPlay', 'askForPreload'])

const app = new PIXI.Application()
const spineScale = 1
const spineAnimationDefaultMix = 0.2;
let isDragging = false
let currentTouchBoneInfo = []
let infoMap = null;
let disableTouchEvent = true;
let activeCharacter = null;
let playRule = null;
const windowOriginalWidth = window.innerWidth;
const windowOriginalHeight = window.innerHeight;
let schedule = null;


class CharacterObject {
  constructor(data) {
    this.resourceId = data.resourceId
    this.sid = data.sid
    this.spineStudent = null;
    this.spineScenes = {};
    this.touchBoneList = [];
    this.talkSentences = [];
    this.currentSentenceIndex = 0;
    //this.originalBounds = [];
    this.backgroundAudio = new Audio();
    this.voiceAudioMap = {};
    this.playRule = null
  }
  destroy() {
    app.stage.removeChild(this.spineStudent);
    this.spineStudent.destroy({ children: true, texture: true, baseTexture: true });
    if (this.spineScenes) {
      app.stage.removeChild(this.spineScene);
      this.spineScenes.destroy({ children: true, texture: true, baseTexture: true });
    }
    this.backgroundAudio.pause();
    this.voiceAudioMap[this.talkSentences[this.currentSentenceIndex]].pause();
  }
  async __spineObjectCreate__(resourceName) {
    PIXI.Assets.add({ alias: `${resourceName}skel`, src: `${resourceName}.base641` });
    PIXI.Assets.add({ alias: `${resourceName}atlas`, src: `${resourceName}.atlas1` });
    await PIXI.Assets.load([`${resourceName}skel`, `${resourceName}atlas`]);
    const spineStudent = spine.Spine.from({
      skeleton: `${resourceName}skel`,
      atlas: `${resourceName}atlas`,
      scale: 1,
    });
    //app.stage.addChild(spineStudent);
    spineStudent.modifyOriginalBounds = spineStudent.getBounds();
    this.__spineResize__(spineStudent);
    return spineStudent;
  }
  __spineResize__(spineObject) {
    const spineOriginalBounds = spineObject.modifyOriginalBounds;
    const visibleWidth = spineOriginalBounds.width * spineScale;
    const visibleHeight = spineOriginalBounds.height * spineScale;
    const scaleX = windowOriginalWidth / visibleWidth;
    const scaleY = windowOriginalHeight / visibleHeight;
    const scale = Math.max(scaleX, scaleY);
    spineObject.scale.set(scale);

    const centerX = windowOriginalWidth / 2;
    const centerY = windowOriginalHeight / 2;
    const localCenterX = spineOriginalBounds.x + spineOriginalBounds.width / 2;
    const localCenterY = spineOriginalBounds.y + spineOriginalBounds.height / 2;

    spineObject.x = centerX - localCenterX * scale;
    spineObject.y = centerY - localCenterY * scale;
  }
  __spineAnimationInit__() {
    const sid = this.sid.toString();
    this.playRule = {
      home: playRule[sid] ? playRule[sid]['home'] || playRule['-1']['home'] : playRule['-1']['home'],
      pat: playRule[sid] ? playRule[sid]['pat'] || playRule['-1']['pat'] : playRule['-1']['pat'],
      look: playRule[sid] ? playRule[sid]['look'] || playRule['-1']['look'] : playRule['-1']['look'],
      chin: playRule[sid] ? playRule[sid]['chin'] || playRule['-1']['chin'] : playRule['-1']['chin']
    }

    //currentPlayRule = (props.currentPlay == null || playRule[props.currentPlay['sid']] == null) ? playRule['-1'] : playRule[props.currentPlay['sid'].toString()];
    this.spineStudent.state.addListener({
      event: (_, event) => {
        this.__audioControl__(event.stringValue)
      },
      end: (entry) => {
        if (entry.animation.name.includes('Start')) {
          disableTouchEvent = false;
        }
      },
      complete: (entry) => {
        const name = entry.animation.name;
        if (!name.includes('Idle') && this.talkSentences.includes(name.substring(0, name.lastIndexOf('_')))) {
          disableTouchEvent = false;
        }
        else if (entry.modifySceneName && entry.modifyDisposable) {
          this.spineScenes[entry.modifySceneName].scale.set(0);
        }
      },
    });
    this.spineStudent.state.data.defaultMix = spineAnimationDefaultMix;
    ["Hip", "Touch_Point_Key", "Touch_Eye_Key", "Right_Chin"].forEach(name => {
      const bone = this.spineStudent.skeleton.findBone(name);
      if (!bone) return;
      const point = { x: this.spineStudent.x + bone.worldX * this.spineStudent.scale.x, y: this.spineStudent.y + bone.worldY * this.spineStudent.scale.y }
      this.touchBoneList.push({ bone, point });
    });

    this.currentSentenceIndex = 0;
    //disableTouchEvent = true;
    this.spineStudent.skeleton.data.animations.forEach(animation => {
      const name = animation.name;
      if (name.startsWith('Talk_') && this.talkSentences.includes(name.substring(0, name.lastIndexOf('_'))) == false) {
        this.talkSentences.push(name.substring(0, name.lastIndexOf('_')));
      }
    });

    this.spineStudent.beforeUpdateWorldTransforms = () => {
      if (currentTouchBoneInfo.length > 0) {
        currentTouchBoneInfo[0].y -= clamp((currentTouchBoneInfo[2] - currentTouchBoneInfo[1].x) * 150 / windowOriginalWidth, -100, 100)
        currentTouchBoneInfo[0].x -= clamp((currentTouchBoneInfo[3] - currentTouchBoneInfo[1].y) * 150 / windowOriginalHeight, -100, 100)
      }
    }
  }
  spineAnimationControl(name, status) {
    const type = name == 'Touch_Point_Key' ? 'pat' : name == 'Touch_Eye_Key' ? 'look' : name == 'None' ? 'home' : name == 'Chin' ? 'chin' : name;
    this.__spinePlayAnimation__(this.playRule[type][status]);
  }
  spineTalkAnimationControl() {
    const target = [
      { name: this.talkSentences[this.currentSentenceIndex] + '_A', slot: 1 },
      { name: this.talkSentences[this.currentSentenceIndex] + '_M', slot: 2 }
    ]
    this.currentSentenceIndex = (this.currentSentenceIndex + 1) % this.talkSentences.length;
    this.__spinePlayAnimation__(target);
  }
  __spinePlayAnimation__(data) {
    data.forEach((item) => {
      let trackEntry = null;
      if (item.name != 'None') {
        trackEntry = (this.spineScenes[item.scene] || this.spineStudent).state.addAnimation(item.slot, item.name, item.loop || false, item.delay || 0.)
        if (item.scene) {
          this.__spineResize__(this.spineScenes[item.scene])
          trackEntry.modifySceneName = item.scene
          trackEntry.modifyDisposable = item.disposable || false
        }
        if (item.mix) trackEntry.mixDuration = item.mix;
        if (item.duration) trackEntry.animationEnd = item.duration;
      }
      else {
        trackEntry = this.spineStudent.state.addEmptyAnimation(item.slot, item.mix || spineAnimationDefaultMix, item.delay || 0.)
      }
      if (item.audio) {
        this.__audioControl__(item.audio.name, item.audio, trackEntry)
      }
      if (item.effect) {
        this.animationEffectControl(item.effect, trackEntry)
      }
    });
  }
  animationEffectControl(effects, trackEntry) {
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
      }, Math.max(value.delay || 0. - trackEntry.trackTime || 0., 0) * 1000)
    })
  }
  __audioControl__(name, info, trackEntry) {
    const tmp = name ? this.voiceAudioMap[name] : this.backgroundAudio;
    if (info && info.delay && trackEntry) {
      setTimeout(() => {
        tmp.play();
      }, Math.max(info.delay - trackEntry.trackTime, 0));
    }
    else tmp.play();
  }
  async __audioInit__() {
    const events = this.spineStudent.skeleton.data.events;
    let count = 1;

    this.backgroundAudio.src = `./bgm/${infoMap[this.sid]['bgm']}`;
    this.backgroundAudio.addEventListener('canplaythrough', () => { count-- }, { once: true });
    this.backgroundAudio.addEventListener('error', () => { console.log('error'); count-- });
    this.backgroundAudio.loop = true;

    events.forEach(event => {
      if (event.audioPath && event.audioPath.length > 0) {
        count++;
        const path = `./voice/${event.audioPath.replace(".wav", ".ogg").toLowerCase()}`;
        const audio = new Audio();
        audio.addEventListener('canplaythrough', () => { count--; }, { once: true });
        audio.addEventListener('error', () => { count--; console.warn(`Failed to load audio for event ${event.name}`) }, { once: true });
        audio.src = path;
        this.voiceAudioMap[event.name] = audio;
      }
    });
    const timeout = 5000;
    const start = Date.now();
    while (count > 0 && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  async spineInit() {
    await this.__spineObjectCreate__(this.resourceId + '_home').then(async (spineObject) => {
      this.spineStudent = spineObject;
      await Promise.all([this.__spineAnimationInit__(), this.__audioInit__()])
    })
    const scenes = infoMap[this.sid].extraScenes || [];
    scenes.forEach(async (scene) => {
      await this.__spineObjectCreate__(scene).then(async (spineObject) => {
        this.spineScenes[scene] = spineObject;
      })
    })
    // isDragging = false;
    // disableTouchEvent = true;
    // currentTouchBoneInfo = [];

    //return character;
  }
  addToStage() {
    app.stage.addChild(this.spineStudent)
    Object.entries(this.spineScenes).forEach(([_, value]) => {
      this.spineStage.addChild(value);
      value.scale.set(0)
    })

  }
  begin() {
    this.spineAnimationControl('None', 'main')
  }
}
class Schedule {
  constructor() {
    this.characterObjects = new Array(2);
    this.timerId = null;
    this.duration = props.duration || 5;
    this.beginTImeStamp = 0;
  }
  async notifyCurrentPlayChange() {
    this.endCurrentPlay();
    if (props.currentPlay) {
      activeCharacter = new CharacterObject(props.currentPlay);
      await activeCharacter.spineInit().then(() => {
        activeCharacter.addToStage();
        this.characterObjects[0] = activeCharacter;
        //activeCharacter.begin();
      });
    }
  }
  notifyDurationChange(duration) {
    clearTimeout(this.timerId);
    this.duration = duration;
    this.begin();
  }
  async notifyPreLoadChange() {
    if (props.preload) {
      this.characterObjects[1] = new CharacterObject(props.preload);
      await this.characterObjects[1].spineInit();
    }
  }
  endCurrentPlay() {
    if (this.characterObjects[0]) {
      this.characterObjects[0].animationEffectControl({ "fadeOut": { duration: 0 } }, {})
      this.characterObjects[0].destroy()
    }
  }
  changePlay() {
    if (this.characterObjects[1]) {
      this.characterObjects[0].animationEffectControl({ "fadeOut": { duration: 0.2 } }, {})
      this.characterObjects[0].destroy()
      this.characterObjects[1].addToStage()
      this.characterObjects.splice(0, 1)
      this.begin();
    }
  }
  begin() {
    //activeCharacter = this.characterObjects[0]
    isDragging = false;
    disableTouchEvent = true;
    currentTouchBoneInfo = [];
    this.characterObjects[0].begin()
    this.beginTImeStamp = Date.now()
    this.timerId = setTimeout(() => {
      emit('askForPreload')
      this.timerId = setTimeout(() => {
        this.changePlay();
      }, this.duration - Date.now() + this.beginTImeStamp)
    }, this.duration - 10000)
  }
}


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
      activeCharacter.spineAnimationControl(currentTouchBoneInfo[0].data.name, 'after');
      currentTouchBoneInfo = [];
    }
  });
}

const setBonePosition = (ev) => {
  if (disableTouchEvent) return;
  const pointx = ev.data.global.x;
  const pointy = ev.data.global.y;
  if (currentTouchBoneInfo.length > 0) {
    currentTouchBoneInfo[2] = pointx;
    currentTouchBoneInfo[3] = pointy;
    return;
  }
  let flag = true;
  const bounds = [infoMap[props.currentPlay.sid].talkBounds || [300, 500, 0, -300], infoMap[props.currentPlay.sid].patBounds || [140, 60, 0, -50], infoMap[props.currentPlay.sid].lookBounds || [140, 50, 0, 10], infoMap[props.currentPlay.sid].chinBounds || [70, 70, 0, 0]]
  const touchBoneList = activeCharacter.touchBoneList;
  for (let i = 1; i < 4; i++) {
    if (touchBoneList[i]) {
      const point = touchBoneList[i].point;
      if (checkInBounds(pointx, pointy, point.x, point.y, bounds[i][0], bounds[i][1], bounds[i][2], bounds[i][3])) {
        currentTouchBoneInfo = [touchBoneList[i].bone, touchBoneList[i].point, pointx, pointy]
        activeCharacter.spineAnimationControl(touchBoneList[i].bone.data.name, 'main')
        flag = false;
        return;
      }
    }
  }
  if (flag) {
    const point = touchBoneList[0].point;
    if (checkInBounds(pointx, pointy, point.x, point.y, bounds[0][0], bounds[0][1], bounds[0][2], bounds[0][3])) {
      disableTouchEvent = true;
      activeCharacter.spineTalkAnimationControl();
      //currentSentenceIndex = (activeCharacter.currentSentenceIndex + 1) % activeCharacter.talkSentenceList.length;
      return;
    }
  }
}



// isDragging = false;
// disableTouchEvent = true;
// currentTouchBoneInfo = [];



onMounted(async () => {
  await fetchData();
  await PIXIInitialize();
  schedule = new Schedule();
  await schedule.notifyCurrentPlayChange();
  schedule.begin();
  window.addEventListener('resize', () => {
    window.location.reload();
  })
  watch(props.duration, async (value) => {
    schedule.notifyDurationChange(value)
  })
  watch(props.currentPlay, async () => {
    schedule.notifyCurrentPlayChange();
  })
  watch(props.preLoadPlay, async () => {
    schedule.notifyPreLoadChange();
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