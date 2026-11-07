import { isMaterialProperty, setMaterialProperty } from './util.js';
import { applySpineMaterials, getSpinePageMaterials } from './SpineMaterialRenderer.js';
import { getRenderQueue, getRenderOrder } from './Material.js';

class SpineController {
    constructor(offsetX, offsetY, scale) {
        this.spineObjs = null;
        this.gameObjectMap = {};
        this.clips = null;
        this.audioController = null;
        this.audios = [];
        this.onDisableInteractionEvent = () => { };
        this.onEnableInteractionEvent = () => { };
        this.mainSpineIndex = 0;
        this.currentTalkGroupIndex = 0;
        this.talkGroups = [];
        this.clipIndexMap = {};
        this.eventAudioMap = {};
        this.parentContainer = null;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.scale = scale;
    }
    getRenderQueue(data) {
        const queues = (data.materialInfo ?? data.atlas?.flatMap(atlas => atlas.materialInfo ?? []) ?? [])
            .map(material => getRenderQueue(material.renderQueue, getRenderQueue(data.renderQueue)));
        return queues.length ? Math.min(...queues) : getRenderQueue(data.renderQueue);
    }
    async init(audioController, container, hierarchy) {
        let tmp = null
        await import('@assets/SpineClips.json').
            then(res => res.default).
            then(data => tmp = data);
        this.clips = tmp.clips;
        this.spineObjs = tmp.skeletons;
        this.eventAudioMap = tmp.eventAudioMap ?? {};
        this.talkGroups = Object.values(tmp.text?.UILobbySpecial ?? {})
            .map(group => group
                .filter(config => config.type === 'Talk' && config.animation)
                .map(config => config.animation))
            .filter(group => group.length > 0);

        this.audioController = audioController;
        this.parentContainer = container;
        container.sortableChildren = true;
        const clipCounts = new Array(this.spineObjs.length).fill(0);

        for (const [index, clip] of this.clips.entries()) {
            clipCounts[clip.skeleton]++;
            this.clipIndexMap[`${clip.skeleton}:${clip.clipName}`] = index;
            clip.soundKeys.forEach(soundKey => {
                audioController.registerAudios(soundKey.audios, '.wav', {
                    loop: soundKey.loop,
                    volume: soundKey.volume,
                });
            });
        }
        const mainSpineIndices = this.spineObjs.flatMap((skeleton, index) => skeleton.isMainSpine ? [index] : []);
        if (mainSpineIndices.length > 1) {
            throw new Error(`Multiple main Spine skeletons: ${mainSpineIndices.join(', ')}`);
        }
        this.mainSpineIndex = mainSpineIndices[0] ?? clipCounts.indexOf(Math.max(...clipCounts));

        for (const audioInfo of Object.values(this.eventAudioMap)) {
            const paths = audioInfo.path ?? [];
            paths.forEach((path, index) => {
                audioController.registerAudios([path], '', {
                    volume: audioInfo.volume?.[index] ?? 1,
                    preload: true,
                });
            });
        }

        const skeletonData = this.spineObjs;
        const spines = new Array(skeletonData.length);
        const renderOrder = skeletonData.map((data, index) => ({ data, index }))
            .sort((a, b) => (a.data.sortingLayer ?? 0) - (b.data.sortingLayer ?? 0)
                || (a.data.sortingOrder ?? 0) - (b.data.sortingOrder ?? 0)
                || this.getRenderQueue(a.data) - this.getRenderQueue(b.data) || a.index - b.index);
        for (const { data, index } of renderOrder) {
            const skel = data.skeleton;
            const atlas = data.atlas[0];
            const pageMaterials = getSpinePageMaterials(data, atlas);
            PIXI.Assets.add({ alias: skel, src: `${skel}1` });
            PIXI.Assets.add({ alias: atlas.atlas, src: `${atlas.atlas}1`, data: {
                spineMaterials: Object.fromEntries(pageMaterials.map(binding => [binding.pageName, binding.materialInfo])),
            } });
            await PIXI.Assets.load([skel, atlas.atlas]);
            const spineObj = await spine.Spine.from({
                skeleton: skel,
                atlas: atlas.atlas,
                scale: data.skeletonScale ?? 1
            });
            const scaleX = data.gameObjectScale?.[0] ?? 1;
            const scaleY = data.gameObjectScale?.[1] ?? 1;
            spineObj.m_gameObjectScaleX = scaleX;
            spineObj.m_gameObjectScaleY = scaleY;
            spineObj.scale.set(scaleX, scaleY);
            spineObj.skeleton.updateWorldTransform(spine.Physics.pose);
            const bounds = spineObj.skeleton.getBoundsRect();
            if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)
                || bounds.width <= 0 || bounds.height <= 0) {
                throw new Error(`Invalid setup bounds for Spine skeleton ${skel}`);
            }
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            spineObj.pivot.set(centerX, centerY);
            // Preserve the imported scene placement after moving the Pixi origin to the setup bounds center.
            spineObj.rotation = -(data.rotation ?? 0);
            const cos = Math.cos(spineObj.rotation), sin = Math.sin(spineObj.rotation);
            const position = data.translate;
            spineObj.m_oriX = position[0] + cos * centerX * scaleX - sin * centerY * scaleY;
            spineObj.m_oriY = -position[1] + sin * centerX * scaleX + cos * centerY * scaleY;
            spineObj.position.set(spineObj.m_oriX + this.offsetX, spineObj.m_oriY + this.offsetY);
            spineObj.zIndex = getRenderOrder(this.getRenderQueue(data), data.translate?.[2],
                data.sortingOrder, data.sortingLayer);
            spineObj.m_OriginalBounds = bounds;
            spineObj.state.data.defaultMix = data.defaultMix;


            if (!hierarchy?.attach(data.gameObject, spineObj, true)) container.addChild(spineObj);
            await applySpineMaterials(spineObj, PIXI.Assets.get(atlas.atlas), pageMaterials, container);
            spines[index] = spineObj;
            this.gameObjectMap[data.gameObject] = spineObj;

            if (index != this.mainSpineIndex) {
                spineObj.state.addListener({
                    complete: entry => {
                        if (entry.m_oriTrack < 0 && !entry.loop) {
                            spineObj.visible = false;
                        }
                    }
                })
            }
        }
        this.spineObjs = spines;
        this.spineObjs[this.mainSpineIndex].state.addListener({
            start: entry => {
                const clipIndex = this.clipIndexMap[`${this.mainSpineIndex}:${entry.animation.name}`];
                if (this.clips[clipIndex]?.isTrackMainIdle) {
                    this.onEnableInteractionEvent();
                }
            },
            event: (_, event) => this.playEventAudio(event.stringValue),
            complete: entry => {
                if (entry.__isTalkSequenceEnd) {
                    this.onEnableInteractionEvent();
                }
            },
        });
    }
    onWindowUpdate(offsetX, offsetY, scale) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        if (!this.spineObjs) {
            return;
        }
        this.spineObjs.forEach(spineObj => {
            spineObj.x = spineObj.m_oriX + offsetX;
            spineObj.y = spineObj.m_oriY + offsetY;
            spineObj.scale.set(spineObj.m_gameObjectScaleX * scale, spineObj.m_gameObjectScaleY * scale);
        });
    }
    getBones(boneNames) {
        const tmpMap = {};
        const spineObj = this.spineObjs[this.mainSpineIndex];
        boneNames.forEach(boneName => {
            tmpMap[boneName] = spineObj.skeleton.findBone(boneName);
        })
        return tmpMap;
    }
    getMainSpineScale() {
        return this.mainSpineObj.scale;
    }

    get mainSpineObj() {
        return this.spineObjs?.[this.mainSpineIndex];
    }

    addAfterUpdateTransform(listener, owner = this.mainSpineObj) {
        if (!owner) throw new Error('Main Spine object was not found');
        const previous = owner.afterUpdateWorldTransforms;
        let active = true;
        const callback = spineObject => {
            previous.call(owner, spineObject);
            if (active) listener(spineObject);
        };
        owner.afterUpdateWorldTransforms = callback;
        return () => {
            active = false;
            if (owner.afterUpdateWorldTransforms === callback) owner.afterUpdateWorldTransforms = previous;
        };
    }
    playClip(clipIndex, duration, delay) {
        const clip = this.clips[clipIndex];
        if (!clip) {
            console.warn(`Unknown Spine clip index: ${clipIndex}`);
            return null;
        }
        const audioController = this.audioController;
        let trackEntry = this.spineObjs[clip.skeleton].state.addAnimation(Math.max(clip.track, 0), clip.clipName, clip.loop, delay);
        trackEntry.m_oriTrack = clip.track;
        // Timeline clip length is independent of the authored loop period.
        if (!clip.loop && duration != null) {
            trackEntry.animationEnd = duration;
        }
        if (!clip.useDefaultIntroMix) {
            trackEntry.mixDuration = clip.introMix;
        }
        if (!clip.loop && (!clip.useDefaultIntroMix || !clip.useDefaultOutroMix)){
            this.spineObjs[clip.skeleton].state.addEmptyAnimation(clip.track, clip.useDefaultOutroMix ? this.spineObjs[clip.skeleton].state.data.defaultMix : clip.outroMix);
        }
        clip.soundKeys.forEach(soundKey => {
            soundKey.audios.forEach(audio => {
                audioController.play(audio, soundKey.delay);
            });
        });
        clip.syncPlays.forEach(syncPlay => {
            this.playClip(syncPlay, null, 0);
        });
        return trackEntry;
    }
    playTalkAnimation() {
        if (this.talkGroups.length === 0) {
            return;
        }
        const animations = this.talkGroups[this.currentTalkGroupIndex];
        this.currentTalkGroupIndex = (this.currentTalkGroupIndex + 1) % this.talkGroups.length;
        this.onDisableInteractionEvent();
        let lastEntry = null;
        for (const animation of animations) {
            const clipIndex = this.clipIndexMap[`${this.mainSpineIndex}:${animation}`];
            if (clipIndex === undefined) {
                console.warn(`Talk animation not found in Spine clips: ${animation}`);
                continue;
            }
            lastEntry = this.playClip(clipIndex, null, 0);
        }
        if (lastEntry) {
            lastEntry.__isTalkSequenceEnd = true;
        }
        else {
            this.onEnableInteractionEvent();
        }
    }
    handleInteractionEvent(eventType) {
        if (eventType === 'Talk') {
            this.playTalkAnimation();
        }
    }
    playEventAudio(eventValue) {
        const audioInfo = this.eventAudioMap[eventValue];
        if (!audioInfo) {
            return;
        }
        (audioInfo.path ?? []).forEach((path, index) => {
            this.audioController.setVolume(path, audioInfo.volume?.[index] ?? 1);
            this.audioController.play(path, 0);
        });
    }
    handleTimelineEvent(gameObject, eventName, value) {
        const view = this.gameObjectMap[gameObject];
        if (eventName === 'm_IsActive' || eventName === 'm_Enabled') {
            view.visible = Boolean(value);
        } else if (isMaterialProperty(eventName)) {
            setMaterialProperty(view.materialPages.map(page => page.material), eventName, value);
        } else {
            throw new Error(`Unsupported timeline property ${eventName} for SpineController`);
        }
    }
    setBeforeUpdateTransform(fun) {
        this.spineObjs[this.mainSpineIndex].beforeUpdateWorldTransforms = fun;
    }
}


export default SpineController;
