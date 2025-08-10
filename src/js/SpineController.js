
class SpineController {
    constructor(correctScale, originalWindowWidth, originalWindowHeight, pixiContainer) {
        this._spineClips = []
        this._spineSkeletons = []
        this._correctScale = correctScale || 1
        this._originalWindowWidth = originalWindowWidth
        this._originalWindowHeight = originalWindowHeight
        this._mainObject = null
        this.interactiveController = null
        this.audioController = null
        this._voiceClipList = []
        this._mainIdleClips = []
        this._sentenceIndex = 0
        this._voiceRedirect = null
        this._gameObjectMap = {}
        this._pixiContainer = pixiContainer
    }

    async init() {
        let tmp = await fetch('@asset/SpineClips.json')
        tmp = tmp.json()
        const toLoadResource = []
        tmp = tmp.default
        this.audioController.registerAudios(tmp.bgm, null, true)
        for (const skel of tmp.skeletons) {
            this._spineSkeletons.push({
                defaultMix: skel.defaultMix,
                scale: item.scale,
                // gameObject: item.gameObject,
                viewBound: item.viewBounds,
                transform: item.transform,
                target: null,
                active: true
            })
            this._gameObjectMap[item.gameObject] = index
            toLoadResource.push(item.skeleton)
            toLoadResource.push(item.atlas[0].atlas)
        }

        for (const clip of tmp.clips) {
            this._spineClips.push(clip)
            if (clip.isTrackMainIdle) {
                this._mainIdleClips.push(index)
            }
            else if (clip.clipName.startsWith('Talk') && clip.clipName.endsWith('M')) {
                this._voiceClipList.push({
                    index: index,
                    name: clip.clipName.replace('Talk_', '')
                })
            }
            if (clip.soundKeys.length > 0) {
                for (const soundKey of clip.soundKeys) {
                    this.audioController.registerAudios(soundKey.audios, 'other', soundKey.loop, soundKey.volume)
                }
                //this.audioController.registerAudios(clip.soundKeys, 'other', clip[''])
            }
        }

        this._voiceClipList.sort((a, b) => a.name <= b.name)
        this.audioController.registerAudios(this._voiceClipList.map(item => item.name), 'voice')

        this._voiceRedirect = tmp.voiceRedirect

        toLoadResource.forEach(item => {
            PIXI.Assets.add({ alias: item, src: item + '1' })
        })

        await PIXI.Assets.load(toLoadResource)

        for (let i = 0; i < toLoadResource.length / 2; i += 2) {
            const spineObject = await spine.Spine.from({
                skeleton: toLoadResource[i],
                atlas: toLoadResource[i + 1],
                scale: 1,
                autoUpdate: false
            })
            const skeletonData = this._spineSkeletons[i]
            spineObject.modifyOriginalBounds = spineObject.getBounds()
            spineObject.modifyScale = skeletonData.scale
            spineObject.modifyViewBounds = skeletonData.viewBounds
            if (toLoadResource[i].toLowerCase().includes('home')) {
                this._mainObject = spineObject
            }
            spineObject.state.data.defaultMix = skeletonData.defaultMix

            spineObject.state.addListener({
                event: (_, event) => {
                    //this._eventString(event.stringValue)
                    this.audioController.play(this._voiceRedirect?.hasOwnProperty(event.stringValue) ? this._voiceRedirect[event.stringValue] : event.stringValue)
                },
                end: (entry) => {
                    // if (entry.hasOwnProperty('modifyNextClip')) {
                    //     this.playAnimation(entry.modifyNextClip)
                    // }
                    if (entry.hasOwnProperty('modifyCallBack')) {
                        this.interactiveController.animationEndCallback(entry.modifyCallBack)
                        if (entry.modifyCallBack === null) {
                            this.playEmptyAnimation(this._voiceClipList[this._sentenceIndex].index)
                            this._sentenceIndex = (this._sentenceIndex + 1) % this._voiceClipList.length
                        }
                    }
                },
                complete: (entry) => {
                    // if (entry.hasOwnProperty('modifyNextClip')) {
                    //     this.playAnimation(entry.modifyNextClip)
                    // }
                    if (entry.hasOwnProperty('modifyCallBack')) {
                        this.interactiveController.animationEndCallback(entry.modifyCallBack)
                        if (entry.modifyCallBack === null) {
                            this.playEmptyAnimation(this._voiceClipList[this._sentenceIndex].index)
                            this._sentenceIndex = (this._sentenceIndex + 1) % this._voiceClipList.length
                        }
                    }
                }
            })

            this._pixiContainer.addChild(spineObject)

        }
        if (this._mainObject == null) {
            this._mainObject == this.SpineData[0].target
            console.warn('Normal method to get the main spine object failed')
        }

        for (const event of this._mainObject.skeleton.data.events) {
            if (event.audioPath?.length > 0) {
                audioName = event.audioPath.substring(event.audioPath.lastIndexOf('/') + 1).replace('.wav', '.ogg').toLowerCase()
            }
        }
    }

    getGameObjectId() {
        return Object.keys(this._gameObjectMap)
    }

    notifyTimelineEvent(event) {
        switch (event.name) {
            case 'm_IsActive': {
                this._spineSkeletons[this._gameObjectMap[event.target]].target.visible = event.data == 1
                break
            }
            default: {
                console.error(`Unsupported event ${event.name} for SpineController`)
            }
        }
    }
    resize() {
        for (const entry of Object.values(this._spineSkeletons)) {
            const target = entry.target

            const spineOriginalBounds = target.modifyOriginalBounds;
            // const visibleBounds = viewBounds ?? [0, 0, spineOriginalBounds.width, spineOriginalBounds.height
            const visibleBounds = viewBounds ?? { left: 0, top: 0, width: spineOriginalBounds.width, height: spineOriginalBounds.height }

            const visibleWidth = visibleBounds.width * target.modifyScale * this._correctScale;
            const visibleHeight = visibleBounds.height * target.modifyScale * this._correctScale;
            const scaleX = this._originalWindowWidth / visibleWidth;
            const scaleY = this._originalWindowHeight / visibleHeight;
            const scale = Math.max(scaleX, scaleY);
            target.scale.set(scale);

            const centerX = originalWindowWidth / 2;
            const centerY = originalWindowHeight / 2;

            const localCenterX = spineOriginalBounds.x + visibleBounds.left + visibleBounds.width / 2;
            const localCenterY = spineOriginalBounds.y + visibleBounds.top + visibleBounds.height / 2;

            target.x = centerX - localCenterX * scale;
            target.y = centerY - localCenterY * scale;
        }
    }

    getTransform() {
        return {
            scale: this._mainObject.scale.x,
            x: this._mainObject.x,
            y: this._mainObject.y,
            // 'transform': this._mainObject.transform
        }
    }

    playAnimation(clipIndex, callBack, duration) {
        const clip = this._spineClips[clipIndex]
        const skeleton = this._spineSkeletons[clip.skeleton].target
        const trackEntry = skeleton.addAnimation(clip.track, clip.clipName, clip.loop, 0.)
        if (callBack !== undefined) {
            trackEntry.modifyCallBack = clipIndex
        }
        if (!clip.useDefaultIntroMix) {
            trackEntry.mixDuration = clip.introMix
        }
        if (clip.outroStartOffset != 0.) {
            trackEntry.animationEnd = trackEntry.animationLast - clip.outroStartOffset
        }
        // if (clip.nextClip) {
        //     trackEntry.modifyNextClip = clip.nextClip
        // }
        if (clip.syncPlays.length > 0) {
            for (const index of clip.syncPlays) {
                this.playAnimation(index)
            }
        }
        if (clip.soundKeys.length > 0) {
            //this._playSound(clip.soundKeys)
            const time = Date.now()
            // this.audioController.play(clip.soundKeys)
            for (const soundKey of clip.soundKeys) {
                setTimeout(() => {
                    this.audioController.play(soundKey.audios)
                }, Math.max(0, soundKey.delay - Date.now() + time - 3))
            }
        }
    }
    playEmptyAnimation(clipIndex) {
        const clip = this._spineClips[clipIndex]
        const target = this._spineSkeletons[clip.skeleton]
        const trackEntry = target.target.addEmptyAnimation(clip.track)
        if (!clip.useDefaultOutroMix) {
            trackEntry.mixDuration = clip.outroMix
        }
    }

    /*
    由InteractiveController调用
    */
    playTalkAnimation() {
        this.playAnimation(this._voiceClipList[this._sentenceIndex].index, null)
    }
    // _playSound(sounds){
    //     this.
    // }
    reset() {
        for (const skeleton of this._spineSkeletons) {
            skeleton.target.state.clearTracks()
            skeleton.target.skeleton.setToSetupPose()
        }
    }
    /*
    由InteractiveController调用
    */
    getSpineBone(bone) {
        bone = this._mainObject.skeleton.findBone(bone)
        return {
            bone: bone,
            x: this._mainObject.x + bone.worldX * this._mainObject.scale.x,
            y: this._mainObject.y + bone.worldY * this._mainObject.scale.y,
        }
    }

    setBoneUpdateFun(fun) {
        this._mainObject.beforeUpdateWorldTransforms = fun
    }

}
export default SpineController