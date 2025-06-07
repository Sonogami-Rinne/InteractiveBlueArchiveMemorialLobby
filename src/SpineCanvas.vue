<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps(['currentPlay', 'preLoadPlay', 'duration'])
const emit = defineEmits(['updateCurrentPlay', 'askForPreload'])

const app = new PIXI.Application()
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
const effectArea = ref(null)
const debugShowDragArea = false;
const voiceRegion = 'jp'


class CharacterObject {
  constructor(data) {
    this.resourceId = data.resourceId;
    this.sid = data.sid;
    this.spineStudent = null;
    this.spineScenes = {};
    this.touchBoneMap = { hip: null, touch_point_key: null, touch_eye_key: null, right_chin: null };
    this.talkSentences = [];
    this.currentSentenceIndex = 0;
    this.touchBounds = {};
    this.backgroundAudio = new Audio();
    this.voiceAudioMap = {};
    this.playRule = null;
    this.boneRedirectMap = {};
    this.voiceRedirect = data.voice;
  }
  destroy() {
    app.stage.removeChild(this.spineStudent);
    this.spineStudent.destroy({ children: true, texture: true, baseTexture: true });
    if (this.spineScenes) {
      Object.entries(this.spineScenes).forEach(([key, spineObject]) => {
        spineObject.destroy({ children: true, texture: true, baseTexture: true });
      });
    }
    this.backgroundAudio.pause();
    this.voiceAudioMap[this.talkSentences[this.currentSentenceIndex]].pause();
  }
  async __spineObjectCreate__(resourceName) {
    PIXI.Assets.add({ alias: `${resourceName}skel`, src: `${resourceName}.skel1` });
    PIXI.Assets.add({ alias: `${resourceName}atlas`, src: `${resourceName}.atlas1` });
    await PIXI.Assets.load([`${resourceName}skel`, `${resourceName}atlas`]);
    const spineObject = await spine.Spine.from({
      skeleton: `${resourceName}skel`,
      atlas: `${resourceName}atlas`,
      scale: 1,
    });
    spineObject.modifyOriginalBounds = spineObject.getBounds();
    this.__spineResize__(spineObject);
    return spineObject;
  }
  __spineResize__(spineObject, spineScale = 1, viewBounds = null) {
    const spineOriginalBounds = spineObject.modifyOriginalBounds;
    const visibleBounds = viewBounds || [0, 0, spineOriginalBounds.width, spineOriginalBounds.height]

    const visibleWidth = visibleBounds[2] * spineScale;
    const visibleHeight = visibleBounds[3] * spineScale;
    const scaleX = windowOriginalWidth / visibleWidth;
    const scaleY = windowOriginalHeight / visibleHeight;
    const scale = Math.max(scaleX, scaleY);
    spineObject.scale.set(scale);

    const centerX = windowOriginalWidth / 2;
    const centerY = windowOriginalHeight / 2;

    const localCenterX = spineOriginalBounds.x + visibleBounds[0] + visibleBounds[2] / 2;
    const localCenterY = spineOriginalBounds.y + visibleBounds[1] + visibleBounds[3] / 2;

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

    this.touchBounds = {
      hip: infoMap[this.sid]['talkBounds'] = boundsTransform(infoMap[this.sid]['talkBounds']),
      touch_point_key: infoMap[this.sid]['patBounds'] = boundsTransform(infoMap[this.sid]['patBounds']),
      touch_eye_key: infoMap[this.sid]['lookBounds'] = boundsTransform(infoMap[this.sid]['lookBounds']),
      right_chin: infoMap[this.sid]['chinBounds'] = boundsTransform(infoMap[this.sid]['chinBounds'])
    }

    this.boneRedirectMap = infoMap[this.sid].redirect && infoMap[this.sid].redirect.bone ? infoMap[this.sid].redirect.bone : {};

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
        if (entry.modifyNextStatus) {
          this.spineAnimationControl(entry.modifyName, entry.modifyNextStatus)
        }
      },
    });
    this.spineStudent.state.data.defaultMix = spineAnimationDefaultMix;
    this.spineStudent.skeleton.data.bones.forEach((bone) => {
      const foo = bone.name.toLowerCase();
      const name = this.boneRedirectMap[foo] || foo;
      if (this.touchBoneMap[name] !== undefined) {
        const tmp = this.spineStudent.skeleton.findBone(bone.name);
        this.touchBoneMap[name] = {
          bone: tmp,
          point: { x: this.spineStudent.x + tmp.worldX * this.spineStudent.scale.x, y: this.spineStudent.y + tmp.worldY * this.spineStudent.scale.y }
        }
      }
    })
    this.currentSentenceIndex = 0;
    this.spineStudent.skeleton.data.animations.forEach(animation => {
      const name = animation.name;
      if (name.startsWith('Talk_') && this.talkSentences.includes(name.substring(0, name.lastIndexOf('_'))) == false) {
        this.talkSentences.push(name.substring(0, name.lastIndexOf('_')));
      }
    });

    this.spineStudent.beforeUpdateWorldTransforms = () => {
      if (currentTouchBoneInfo.length > 0) {
        currentTouchBoneInfo[0].y = -clamp((currentTouchBoneInfo[2] - currentTouchBoneInfo[1].x) * 150 / windowOriginalWidth, -100, 100)
        currentTouchBoneInfo[0].x = -clamp((currentTouchBoneInfo[3] - currentTouchBoneInfo[1].y) * 150 / windowOriginalHeight, -100, 100)
      }
    }

    if (debugShowDragArea) {
      effectArea.value.style.opacity = 1;
      effectArea.value.style.backgroundColor = 'rgba(0, 0, 0, 0)';
      Object.entries(this.touchBoneMap).forEach(([key, value]) => {
        if (value == null) return;
        let newDiv = document.createElement('div')
        newDiv.style.width = this.touchBounds[key][0] * 2 + 'px'
        newDiv.style.height = this.touchBounds[key][1] * 2 + 'px';
        newDiv.style.left = value.point.x - this.touchBounds[key][0] + 'px'
        newDiv.style.top = value.point.y - this.touchBounds[key][1] + 'px'
        newDiv.style.transform = `translate(${this.touchBounds[key][2] || 0}px,${this.touchBounds[key][3] || 0}px) rotate(${this.touchBounds[key][4] || 0}rad)`
        newDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.5)'
        newDiv.style.position = 'absolute'
        newDiv.style.zIndex = 4
        effectArea.value.appendChild(newDiv)

      })
    }
  }
  spineAnimationControl(name, status) {
    const lowerName = name.toLowerCase();
    const tmp = this.boneRedirectMap[lowerName] || lowerName
    const type = tmp == 'touch_point_key' ? 'pat' : tmp == 'touch_eye_key' ? 'look' : tmp == 'none' ? 'home' : tmp == 'right_chin' ? 'chin' : tmp;
    this.__spinePlayAnimation__(this.playRule[type][status], name);
  }
  spineTalkAnimationControl() {
    const target = [
      { name: this.talkSentences[this.currentSentenceIndex] + '_A', slot: 1 },
      { name: this.talkSentences[this.currentSentenceIndex] + '_M', slot: 2 }
    ]
    this.currentSentenceIndex = (this.currentSentenceIndex + 1) % this.talkSentences.length;
    this.__spinePlayAnimation__(target);
  }
  __spinePlayAnimation__(data, name) {
    data.forEach((item) => {
      let trackEntry = null;
      if (item.name != 'None') {
        trackEntry = (this.spineScenes[item.scene] || this.spineStudent).state.addAnimation(item.slot, item.name, item.loop || false, item.delay || 0.)
        if (item.scene) {
          trackEntry.modifySceneName = item.scene
        }
        if (item.mix) trackEntry._mixDuration = item.mix;
        if (item.duration) trackEntry.animationLast = item.duration;
        if (item.start) trackEntry.animationStart = item.start
        if (item.end) trackEntry.animationEnd = item.end
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
      if (item.nextStatus) {
        this.spineScenes[item.scene].state.addListener({
          end: (entry) => {
            this.spineAnimationControl(entry.modifyName, entry.modifyNextStatus)
          },
          complete: (entry) => {
            this.spineAnimationControl(entry.modifyName, entry.modifyNextStatus)
          },
        })
        trackEntry.modifyNextStatus = item.nextStatus
      }
      trackEntry.modifyName = name;
    });
  }
  animationEffectControl(effects, trackEntry) {

    Object.entries(effects).forEach(([name, value]) => {
      setTimeout(() => {
        switch (name) {
          case 'objectShow':
            value.target.forEach(scene => {
              if (this.spineScenes[scene] === undefined) {
                this.spineStudent.visible = true
              }
              else {
                this.spineScenes[scene].visible = true
              }
            })
            break;
          case 'objectHide':
            value.target.forEach(scene => {
              if (this.spineScenes[scene] === undefined) {
                this.spineStudent.visible = false
              }
              else {
                this.spineScenes[scene].visible = false
              }
            })
            break;
          case 'fadeIn':
            if (debugShowDragArea) return;
            effectArea.value.style.transition = ''
            effectArea.value.style.opacity = '1'
            effectArea.value.style.transition = `opacity ${value.duration || 0.2}s ${value.curve || 'ease-in-out'}`
            effectArea.value.style.opacity = '0'
            break;
          case 'fadeOut':
            if (debugShowDragArea) return;
            effectArea.value.style.transition = ''
            effectArea.value.style.opacity = '0'
            effectArea.value.style.transition = `opacity ${value.duration || 0.2}s ${value.curve || 'ease-in-out'}`
            effectArea.value.style.opacity = '1'
            break;
        }
      }, Math.max(value.delay || 0. - trackEntry.trackTime || 0., 0) * 1000)
    })
  }
  __audioControl__(name, info, trackEntry) {
    const tmp = name ? this.voiceAudioMap[name] : this.backgroundAudio;
    if (tmp == null) {
      console.error(`unKnown audio ${name}, current audioMap is`)
      console.log(this.voiceAudioMap)
      return
    }
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
    const audioPathRedirect = infoMap[this.sid].redirect && infoMap[this.sid].redirect.audioPath ? infoMap[this.sid].redirect.audioPath : {};
    const audioNameRedrect = infoMap[this.sid].redirect && infoMap[this.sid].redirect.audioName ? infoMap[this.sid].redirect.audioName : {};

    events.forEach(event => {
      if (event.audioPath && event.audioPath.length > 0) {
        count++;
        //const path = `./voice/${voiceRegion}/${this.resourceId}/${event.audioPath.replace(".wav", ".ogg").toLowerCase().replace('sound/', '')}`;
        const tmpName = event.audioPath.substring(event.audioPath.lastIndexOf('/') + 1).replace(".wav", ".ogg").toLowerCase();
        const path = `./voice/${voiceRegion}/${this.voiceRedirect || this.resourceId}/${audioPathRedirect[tmpName] || tmpName}`;
        const audio = new Audio();
        audio.addEventListener('canplaythrough', () => { count--; }, { once: true });
        audio.addEventListener('error', () => { count--; console.warn(`Failed to load audio for event ${event.name}, path${path}`) }, { once: true });
        audio.src = path;
        const index = event.name.lastIndexOf('/')
        const name = index > 0 ? event.name.substring(index + 1) : event.name;
        this.voiceAudioMap[audioNameRedrect[name] || name] = audio;
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
      if (infoMap[this.sid].scale || infoMap[this.sid].viewBounds) this.__spineResize__(this.spineStudent, infoMap[this.sid].scale, infoMap[this.sid].viewBounds)
      await Promise.all([this.__spineAnimationInit__(), this.__audioInit__()])
    })
    const scenes = infoMap[this.sid].extraScenes || {};
    await Promise.all(
      Object.entries(scenes).map(async ([key, value]) => {
        const spineObject = await this.__spineObjectCreate__(key);
        spineObject.zIndex = value.zIndex;
        if (value.scale || value.viewBounds) this.__spineResize__(spineObject, value.scale, value.viewBounds)
        this.spineScenes[key] = spineObject;
      })
    );
  }
  addToStage() {
    Object.entries(this.spineScenes).forEach(([key, value]) => {
      app.stage.addChild(value);
    });
    app.stage.addChild(this.spineStudent)
  }
  begin() {
    this.spineAnimationControl('none', 'main')
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
    if (debugShowDragArea) return;
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

const boundsTransform = (bounds) => {
  if (bounds == null) return null;
  bounds[0] = bounds[0] * windowOriginalWidth;
  bounds[1] = bounds[1] * windowOriginalHeight;
  bounds[2] = bounds[2] * windowOriginalWidth;
  bounds[3] = bounds[3] * windowOriginalHeight;
  return bounds;
}

const clamp = (value, min, max) => {
  return value < min ? min : (value > max ? max : value);
}
const checkInBounds = (x, y, px, py, halfWidth, halfHeight, offsetX, offsetY, angle = 0) => {
  const translatedX = x - px - offsetX;
  const translatedY = y - py - offsetY;
  if (angle !== 0) {
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rotatedX = translatedX * cos - translatedY * sin;
    const rotatedY = translatedX * sin + translatedY * cos;
    return Math.abs(rotatedX) < halfWidth && Math.abs(rotatedY) < halfHeight;
  }
  return Math.abs(translatedX) < halfWidth && Math.abs(translatedY) < halfHeight;
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

  const bounds = activeCharacter.touchBounds;
  let flag = false;
  Object.entries(activeCharacter.touchBoneMap).forEach(([boneName, value]) => {
    if (value == null || flag) return;

    if (checkInBounds(pointx, pointy, value.point.x, value.point.y, bounds[boneName][0], bounds[boneName][1], bounds[boneName][2] || 0, bounds[boneName][3] || 0, bounds[boneName][4] || 0)) {
      if (boneName == 'hip') {
        disableTouchEvent = true;
        activeCharacter.spineTalkAnimationControl();
      }
      else {
        currentTouchBoneInfo = [value.bone, value.point, pointx, pointy];
        activeCharacter.spineAnimationControl(boneName, 'main')
      }
      flag = true;
    }
  });
}




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
  <div class="main-container main-container-effect" ref="effectArea"></div>
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

.bone-drag-display {
  position: absolute;
  z-index: 4;
  background-color: rgba(200, 200, 200, 0.5);
}
</style>