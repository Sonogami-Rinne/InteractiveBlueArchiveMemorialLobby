const frameRate = 60
const frameInterval = 1 / frameRate

class Track {
    constructor(trackInfo, pptrObjectMapping) {
        this._gameObject = trackInfo.gameObject
        this._property = trackInfo.property
        this.isPPtrCurve = trackInfo.isPPtrCurve
        this._frames = trackInfo.curve
        this.duration = this.curve[this.curve.length - 1].time
        this._pptrObjectMapping = null
        if (this.isPPtrCurve) {
            this._pptrObjectMapping = pptrObjectMapping
        }
        this._lastValue = null
        this._currentFrame = 0
    }
    reset() {
        this._currentFrame = 0
        this._lastValue = null
    }

    evaluate(time) {
        let cFrame = this._currentFrame
        if (cFrame >= this._frames.length - 1) {
            return null
        }
        while (this._frames[cFrame + 1].time < time) {
            ++cFrame
            if (cFrame >= this._frames.length - 1) {
                this._currentFrame = cFrame
                this._lastValue = this._frames[cFrame].value
                return {
                    name: this._property,
                    target: this._gameObject,
                    value: this._lastValue
                }
            }
        }
        this._currentFrame = cFrame
        if (this._frames[cFrame + 1].inSlope === null) {
            if (this._frames[cFrame].value !== this._lastValue) {
                this._lastValue = this._frames[cFrame].value
                return {
                    name: this._property,
                    target: this._gameObject,
                    value: this._lastValue
                }
            }
            else {
                return null
            }
        }
        else {
            const frame0 = this._frames[cFrame]
            const frame1 = this._frames[cFrame + 1]

            const _dt = frame1.time - frame0.time
            const _t = (time - frame0.time) / _dt
            const _t2 = _t * _t
            const _t3 = _t2 * _t
            const _t4 = 2 * _t3 - 3 * _t2
            const _h0 = _t3 - 2 * _t2 + _t
            const _h1 = _t3 - _t2

            this._lastValue = (_t4 + 1) * frame0.value - _t4 * frame1.value + _h0 * frame0.outSlope * _dt + _h1 * frame1.inSlope * _dt
            return {
                name: this._property,
                target: this._gameObject,
                value: this._lastValue
            }
        }
    }
}

class AnimationClip {
    constructor(loop, trackInfos) {
        this._loop = loop
        this._tracks = []
        this.duration = 0
        this._timeInTurn = 0.
        for (const trackInfo of trackInfos) {
            const track = new Track(trackInfo)
            if (this.duration < track.duration) {
                this.duration = track.duration
            }
            this._tracks.push(track)
        }
        this.play = true
        // this.tracks = trackInfos.map(i => new Track(i))
    }
    reset() {
        this._timeInTurn = 0
        this.play = true
        for (const track of this._tracks) {
            track.reset()
        }
    }
    update(time) {
        const events = []
        if (this._loop) {
            time = time % this.duration
            if (time < this._timeInTurn) {
                for (const track of this._tracks) {
                    track.reset()
                    const tmp = track.evacuate(time)
                    if (tmp !== null) {
                        events.psuh(tmp)
                    }
                }
            }
            else {
                for (const track of this._tracks) {
                    track.reset()
                    const tmp = track.evacuate(time)
                    if (tmp !== null) {
                        events.psuh(tmp)
                    }
                }
            }
            this._timeInTurn = time
        }
        else if (this.play && time <= this.duration) {
            if (time >= this.duration) {
                this.play = false
            }
            for (const track of this._tracks) {
                const tmp = track.evaluate(time)
                if (tmp !== null) {
                    events.push(tmp)
                }
            }
        }
        return events
    }

}

class TimelineController {
    constructor() {
        this.spineController = null
        this.interactiveController = null
        this.audioController = null
        this.spriteController = null
        this.postProcessingController = null
        this.particleController = null
        this._spineTimeline = null
        this._soundFixTimeline = []
        this._attributeTimeline = []
        this._currentTime = 0
        this._ambientAudio = null
        this._backgroundMusic = null
        this._time = 0.
        this._gameObjectMap = {}
    }

    async init() {
        let tmp = null
        await fetch('@assets/AmbientAudio.json').
            then(res => res.json()).
            then(data => tmp = data)
        if (tmp.length > 0) {
            tmp = tmp[0]
            this._ambientAudio = tmp.name
            this.audioController.registerAudios(tmp.name, 'other', tmp.loop, tmp.volume)
        }

        await fetch('@assets/Timeline.json').
            then(res => res.json()).
            then(data => tmp = data)

        for (const animationClip of tmp.animationClip) {
            this._attributeTimeline.push(new AnimationClip(animationClip))
        }

        this._soundFixTimeline = tmp.soundFix

        for (const audio of tmp.soundFix) {
            this.audioController.registerAudios(audio.audios[0], 'other', false, audio.volume, audio.start < 5.)
        }

        const foo = {}
        for (const item of tmp.spineAnimation) {
            if (!foo.hasOwnProperty(item.start)) {
                foo[item.start] = []
            }
            foo[item.start].push({
                duration: item.ifCustomDuration ? item.duration : null,
                clipIndex: item.spineClip
            })
        }
        this._spineTimeline = Object.entries(foo).map((time, items) => { return { time: time, items: items } })

        this._backgroundMusic = tmp.backgroundMusic
        this.audioController.registerAudios(tmp.backgroundMusic, null, true, 1., true)
    }
    update(deltaTime) {
        this._time += deltaTime
        const events = []
        for (const animationClip of this._attributeTimeline) {
            events += animationClip.update(this._time)
        }
        for (const event of events) {
            this._gameObjectMap[event.target]?.notifyGameObjectEvent(event)
        }
    }
    registerController(controller, type) {
        switch (type) {
            case 'Audio': {
                this.audioController = controller
                return
            }
            case 'Intera': {
                this.interactiveController = controller
                break
            }
            case 'PostP': {
                this.postProcessingController = controller
                break
            }
            case 'Spine': {
                this.spineController = controller
                break
            }
            case 'Sprite': {
                this.spriteController = controller
                break
            }
        }
        for (const gameObject of controller.getGameObjectId()) {
            this._gameObjectMap[gameObject] = controller
        }
    }
    start() {
        this.audioController.playSoundFixTimeline(this._soundFixTimeline)
        if (this._ambientAudio) {
            this.audioController.play(this._ambientAudio)
        }
        this.audioController.play(this._backgroundMusic)
        this.postProcessingController.apply()
        //this.postProcessingController.apply(PIXI.stage)
        this._playSpineAnimation(0)
        this.update(0)
    }
    _playSpineAnimation(index) {
        //第一个时间一定为0
        for (const spineClip of this._spineTimeline[index].items) {
            this.spineController.playAnimation(spineClip.clipIndex, undefined, spineClip.duration)
        }
        if (index < this._spineTimeline.length - 1) {
            setTimeout((index) => {
                this._playSpineAnimation(index + 1)
            }, 1000 * (this._spineTimeline[index + 1].time - this._spineTimeline[index].time) - 3)
        }

    }
}

export default TimelineController