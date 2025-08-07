
class SpineController {
    SpineController(correctScale, originalWindowWidth, originalWindowHeight) {
        this.spineClips = {}
        this.spineSkeletons = {}
        this.correctScale = correctScale || 1
        this.scale = 1
        this.originalWindowWidth = originalWindowWidth
        this.originalWindowHeight = originalWindowHeight
        this.mainObject = null
        this.interactiveController = null
        this.audioController = null
        this.voiceClipList = []
        this.sounds = []
        this.mainIdleClips = []
        this.sentenceIndex = 0
        this.voiceRedirect = null
    }

    async init() {
        let tmp = await import('@asset/SpineClips.json')
        const toLoadResource = []
        tmp = tmp.default
        this.audioController.registerAudios(tmp.bgm, null, true)
        tmp.skeletons.forEach(item, index => {
            this.spineSkeletons[index] = {
                defaultMix: item.defaultMix,
                scale: item.scale,
                gameObject: item.gameObject,
                viewBound: item.viewBounds,
                transform: item.transform,
                target: null,
                active: true
            }
            toLoadResource.push(item.skeleton)
            toLoadResource.push(item.atlas[0].atlas)
        });

        tmp.clips.forEach(clip, index => {
            this.SpineData[index] = clip

            if (clip.isTrackMainIdle) {
                this.mainIdleClips.push(index)
            }
            else if (clip.clipName.startsWith('Talk') && clip.clipName.endsWith('M')) {
                this.voiceClipList.push({
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
        })
        this.voiceClipList.sort((a, b) => a.name <= b.name)
        this.audioController.registerAudios(this.voiceClipList.map(item => item.name), 'voice')

        this.voiceRedirect = tmp.voiceRedirect

        toLoadResource.forEach(item => {
            PIXI.Assets.add({ alias: item, src: item + '1' })
        })

        await PIXI.Assets.load(toLoadResource)

        for (let i = 0; i < toLoadResource.length / 2; i += 2) {
            const spineObject = await spine.Spine.from({
                skeleton: toLoadResource[i],
                atlas: toLoadResource[i + 1],
                scale: 1
            })
            const spineData = this.SpineData[i]
            spineObject.modifyOriginalBounds = spineObject.getBounds()
            spineObject.modifyScale = spineData.scale
            spineObject.modifyViewBounds = spineData.viewBounds
            if (toLoadResource[i].toLowerCase().includes('home')) {
                this.mainObject = spineObject
            }
            spineObject.state.data.defaultMix = spineData.defaultMix

            spineObject.state.addListener({
                event: (_, event) => {
                    //this._eventString(event.stringValue)
                    this.audioController.play(this.voiceRedirect?.hasOwnProperty(event.stringValue) ? this.voiceRedirect[event.stringValue] : event.stringValue)
                },
                end: (entry) => {
                    if (entry.hasOwnProperty('modifyNextClip')) {
                        this.playAnimation(entry.modifyNextClip)
                    }
                    if (entry.hasOwnProperty('modifyCallBack')) {
                        this.interactiveController.animationEndCallback(entry.modifyCallBack)
                        if (entry.modifyCallBack === null) {
                            this.playEmptyAnimation(this.voiceClipList[this.sentenceIndex].index)
                            this.sentenceIndex = (this.sentenceIndex + 1) % this.voiceClipList.length
                        }
                    }
                },
                complete: (entry) => {
                    if (entry.hasOwnProperty('modifyNextClip')) {
                        this.playAnimation(entry.modifyNextClip)
                    }
                    if (entry.hasOwnProperty('modifyCallBack')) {
                        this.interactiveController.animationEndCallback(entry.modifyCallBack)
                        if (entry.modifyCallBack === null) {
                            this.playEmptyAnimation(this.voiceClipList[this.sentenceIndex].index)
                            this.sentenceIndex = (this.sentenceIndex + 1) % this.voiceClipList.length
                        }
                    }
                }
            })

        }
        if (this.mainObject == null) {
            this.mainObject == this.SpineData[0].target
            console.warn('Normal method to get the main spine object failed')
        }

        for (const event of this.mainObject.skeleton.data.events) {
            if (event.audioPath?.length > 0) {
                audioName = event.audioPath.substring(event.audioPath.lastIndexOf('/') + 1).replace('.wav', '.ogg').toLowerCase()
            }
        }
    }

    getGameObjectId() {
        return Object.values(this.SpineData).map(item => item.gameObject)
    }

    notifyTimelineEvent(event) {
        for (const target of Object.values(this.SpineData)) {
            if (target.gameObject == event.gameObjectId) {

                switch (event.name) {
                    case 'm_IsActive': {
                        target.target.visible = event.data == 1
                        break
                    }
                    default: {
                        console.error(`Unsupported event${event.name} for SpineController`)
                    }
                }
                break
            }
        }
    }
    resize() {
        for (const entry of Object.values(this.SpineData)) {
            const target = entry.target

            const spineOriginalBounds = target.modifyOriginalBounds;
            // const visibleBounds = viewBounds ?? [0, 0, spineOriginalBounds.width, spineOriginalBounds.height
            const visibleBounds = viewBounds ?? { left: 0, top: 0, width: spineOriginalBounds.width, height: spineOriginalBounds.height }

            const visibleWidth = visibleBounds.width * target.modifyScale * this.correctScale;
            const visibleHeight = visibleBounds.height * target.modifyScale * this.correctScale;
            const scaleX = this.originalWindowWidth / visibleWidth;
            const scaleY = this.originalWindowHeight / visibleHeight;
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
            scale: this.mainObject.scale.x,
            x: this.mainObject.x,
            y: this.mainObject.y,
            // 'transform': this.mainObject.transform
        }
    }

    playAnimation(clipIndex, callBack) {
        const clip = this.spineClips[clipIndex]
        const skeleton = this.SpineData[clip.skeleton].target
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
        if (clip.nextClip) {
            trackEntry.modifyNextClip = clip.nextClip
        }
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
        const clip = this.spineClips[clipIndex]
        const target = this.spineData[clip.skeleton]
        const trackEntry = target.target.addEmptyAnimation(clip.track)
        if (!clip.useDefaultOutroMix) {
            trackEntry.mixDuration = clip.outroMix
        }
    }

    /*
    由InteractiveController调用
    */
    playTalkAnimation() {
        this.playAnimation(this.voiceClipList[this.sentenceIndex].index, null)
    }
    // _playSound(sounds){
    //     this.
    // }
    reset() {
        for (const skeleton of this.spineSkeletons) {
            skeleton.target.state.clearTracks()
            skeleton.target.skeleton.setToSetupPose()
        }
    }
    /*
    由InteractiveController调用
    */
    getSpineBone(bone) {
        bone = this, this.mainObject.skeleton.findBone(bone)
        return {
            bone: bone,
            x: this.mainObject.x + bone.worldX * this.mainObject.scale.x,
            y: this.mainObject.y + bone.worldY * this.mainObject.scale.y,
        }
    }

}
export default SpineController