// Timeline data is evaluated in seconds.
import ControlTrackController from './ControlTrackController.js';

class Track {
    constructor(trackInfo, pptrObjectMapping) {
        this._gameObject = trackInfo.gameObject
        this._property = trackInfo.property
        this.isPPtrCurve = trackInfo.isPPtrCurve
        this._frames = trackInfo.frames ?? trackInfo.curve ?? []
        this.duration = this._frames[this._frames.length - 1]?.time ?? 0
        this._pptrObjectMapping = null
        if (this.isPPtrCurve) {
            this._pptrObjectMapping = pptrObjectMapping
        }
        this._lastValue = undefined
        this._currentFrame = -1
    }
    reset() {
        this._currentFrame = -1
        this._lastValue = undefined
    }

    evaluate(time) {
        if (this._frames.length === 0 || time < this._frames[0].time) {
            return null
        }

        let cFrame = Math.max(this._currentFrame, 0)
        while (cFrame + 1 < this._frames.length && this._frames[cFrame + 1].time <= time) {
            ++cFrame
        }
        this._currentFrame = cFrame

        const frame0 = this._frames[cFrame]
        const frame1 = this._frames[cFrame + 1]
        let value
        if (!frame1 || frame1.inSlope === null) {
            value = frame0.value
        }
        else {
            const _dt = frame1.time - frame0.time
            const _t = _dt === 0 ? 1 : (time - frame0.time) / _dt
            const _t2 = _t * _t
            const _t3 = _t2 * _t
            const _t4 = 2 * _t3 - 3 * _t2
            const _h0 = _t3 - 2 * _t2 + _t
            const _h1 = _t3 - _t2
            value = (_t4 + 1) * frame0.value - _t4 * frame1.value + _h0 * frame0.outSlope * _dt + _h1 * frame1.inSlope * _dt
        }

        if (this.isPPtrCurve) {
            value = this._pptrObjectMapping?.[value] ?? value
        }
        if (Object.is(value, this._lastValue)) {
            return null
        }
        this._lastValue = value
        return {
            name: this._property,
            target: this._gameObject,
            value: this._lastValue
        }
    }
}

class AnimationClip {
    constructor(clipInfo) {
        this._loop = clipInfo.loop
        this._pptrMapping = clipInfo.PPtrMapping
        this._tracks = []
        this.duration = 0
        this._timeInTurn = 0.
        for (const trackInfo of clipInfo.data) {
            if (trackInfo.gameObject == null) continue;
            const track = new Track(trackInfo, this._pptrMapping)
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
        if (!this.play) {
            return events
        }
        if (this._loop && this.duration > 0) {
            time = time % this.duration
            if (time < this._timeInTurn) {
                for (const track of this._tracks) {
                    track.reset()
                }
            }
            this._timeInTurn = time
        }
        else {
            if (time >= this.duration) {
                time = this.duration
                this.play = false
            }
        }
        for (const track of this._tracks) {
            const tmp = track.evaluate(time)
            if (tmp !== null) {
                events.push(tmp)
            }
        }
        return events
    }

}

class TimelineController {
    constructor(spineController, interactiveController, postProcessingController, audioController, particleController, materialRendererController) {
        this.spineController = spineController;
        this.interactiveController = interactiveController;
        this.audioController = audioController;
        this.postProcessingController = postProcessingController;
        this.particleController = particleController;
        this.materialRendererController = materialRendererController;
        this._spineTimeline = [];
        this._soundFixTimeline = [];
        this._attributeTimeline = [];
        this._spineTimelineCurrent = 0;
        this._soundFixTimelineCurrent = 0;
        this._backgroundMusic = []
        this._time = 0.;
        this._gameObjectMap = {};

    }
    async init(hierarchy) {
        this.hierarchy = hierarchy;
        this.profileActivation = new Map();
        const timelineModule = await import('@assets/Timeline.json');
        const data = timelineModule.default ?? timelineModule;

        this._attributeTimeline = [];
        for (const animationClip of data.animationClip ?? []) {
            this._attributeTimeline.push(new AnimationClip(animationClip))
        }
        this._soundFixTimeline = [...(data.soundFix ?? [])];
        for (const audio of this._soundFixTimeline) {
            this.audioController.registerAudios(audio.audios, '.wav', {
                volume: audio.volume,
                preload: audio.start < 5.,
            })
        }
        this._spineTimeline = [...(data.spineAnimation ?? [])];
        this._backgroundMusic = [];
        const bgm = data.bgm ?? {};
        for (const [index, path] of (bgm.path ?? []).entries()) {
            this._backgroundMusic.push(path);
            this.audioController.registerAudios([path], '', {
                loop: true,
                volume: bgm.volume?.[index] ?? 1,
                loopStart: bgm.loopStart?.[index] ?? 0,
                loopEnd: bgm.loopEnd?.[index] ?? 0,
                transition: bgm.transition?.[index] ?? 0,
                offset: bgm.loopOffset?.[index] ?? 0,
                preload: true,
            });
        }
        this._soundFixTimeline.sort((a, b) => a.start - b.start);
        this._spineTimeline.sort((a, b) => a.start - b.start);
        this._gameObjectMap = {};
        for (const controller of [
            this.spineController,
            this.interactiveController,
            this.postProcessingController,
            this.audioController,
            this.particleController,
            this.materialRendererController,
        ]) {
            const gameObjects = controller?.getGameObjectId?.()
                ?? Object.keys(controller?.gameObjectMap ?? {});
            for (const gameObject of gameObjects) {
                this._gameObjectMap[gameObject] = controller;
            }
        }
        this._controlTracks = new ControlTrackController(data.controlTrack ?? [], hierarchy,
            [this.particleController].filter(Boolean));
    }
    update(deltaTime) {
        this._time += deltaTime;

        for (const animationClip of this._attributeTimeline) {
            for (const event of animationClip.update(this._time)) {
                const isVolumeToggle = event.name === 'm_Enabled' && this.postProcessingController.hasGameObject(event.target);
                if (event.name === 'weight' || isVolumeToggle) {
                    // Only exported profiles have post-processing filters.
                    if (this.postProcessingController.hasGameObject(event.target)) {
                        this.postProcessingController.handleTimelineEvent(event.target, event.name, event.value);
                    }
                    continue;
                }
                if (this.hierarchy?.handleTimelineEvent(event.target, event.name, event.value)) continue;
                const controller = this._gameObjectMap[event.target];
                if (!controller) {
                    throw new Error(`No controller registered for gameObject ${event.target}`);
                }
                controller.handleTimelineEvent(event.target, event.name, event.value);
            }
        }
        let spineIndex = this._spineTimelineCurrent;
        while (spineIndex < this._spineTimeline.length) {
            const target = this._spineTimeline[spineIndex];
            if (target.start > this._time) break;
            this.spineController.playClip(target.spineClip, target.ifCustomDuration ? target.duration : null, 0);
            spineIndex++;
        }
        this._spineTimelineCurrent = spineIndex;
        // Apply selected animations before binding emitters or seeking particles.
        // World-space particles retain their birth pose, including during prewarm.
        this.spineController.update?.(deltaTime);
        this.hierarchy?.updateTransforms();
        this._controlTracks?.update(this._time);
        if (this._controlTracks?.hasActivation) this.hierarchy?.updateTransforms();
        if (this.hierarchy) {
            for (const id of this.postProcessingController.getGameObjectId()) {
                const active = this.hierarchy.active(id);
                if (active === this.profileActivation.get(id)) continue;
                this.profileActivation.set(id, active);
                this.postProcessingController.handleTimelineEvent(id, 'm_IsActive', active);
            }
        }
        let cur = this._soundFixTimelineCurrent;
        let length = this._soundFixTimeline.length;
        while (cur < length) {
            const target = this._soundFixTimeline[cur];
            if (target.start <= this._time) {
                for (const audio of target.audios) {
                    this.audioController.setVolume(audio, target.volume);
                    this.audioController.play(audio, 0, target.duration);
                }
            }
            else {
                break;
            }
            cur++;
        }
        this._soundFixTimelineCurrent = cur;

    }

    start() {
        this._controlTracks?.reset();
        this._time = 0;
        this._soundFixTimelineCurrent = 0;
        this._spineTimelineCurrent = 0;
        for (const animationClip of this._attributeTimeline) {
            animationClip.reset();
        }
        this.postProcessingController.apply();
        for (const bgm of this._backgroundMusic) {
            this.audioController.stop(bgm);
            this.audioController.play(bgm, 0);
        }
        this.update(0);
    }

    stop() {
        this._controlTracks?.stop();
    }
}

export default TimelineController
