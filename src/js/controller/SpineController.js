import { observePreparation } from '../loader/common.js';
import { applySpineMaterials, getSpinePageMaterials, prepareSpinePrograms } from '../rendering/SpineMaterialRenderer.js';
import { getRenderOrder, isMaterialProperty, setMaterialProperty } from '../rendering/common.js'

class SpineController {
    constructor(offsetX, offsetY, scale, clips, audioController, preparation) {
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
        this.audioPreparation = clips && observePreparation(clips.then(data => {
            if (!audioController.disposed) this.prepareAudio(audioController, data);
        }));
        this.resources = clips && observePreparation(clips.then(data => Promise.all(
            this.getSkeletonOrder(data.skeletons).map(({ data }) => this.prepareSkeleton(data, preparation)))));
    }
    getRenderQueue(data) {
        const queues = (data.materialInfo ?? data.atlas?.flatMap(atlas => atlas.materialInfo ?? []) ?? [])
            .map(material => material.renderQueue);
        return queues.length ? Math.min(...queues) : data.renderQueue;
    }
    prepareAudio(audioController, data) {
        for (const clip of data.clips) {
            for (const soundKey of clip.soundKeys) {
                audioController.registerAudios(soundKey.audios, '.wav', {
                    loop: soundKey.loop,
                    volume: soundKey.volume,
                });
            }
        }
        for (const audioInfo of Object.values(data.eventAudioMap ?? {})) {
            for (const [index, path] of (audioInfo.path ?? []).entries()) {
                audioController.registerAudios([path], '', { volume: audioInfo.volume?.[index] ?? 1 });
            }
        }
    }

    getSkeletonOrder(skeletons) {
        return skeletons.map((data, index) => ({ data, index }))
            .sort((a, b) => (a.data.sortingLayer ?? 0) - (b.data.sortingLayer ?? 0)
                || (a.data.sortingOrder ?? 0) - (b.data.sortingOrder ?? 0)
                || this.getRenderQueue(a.data) - this.getRenderQueue(b.data)
                || a.index - b.index);
    }

    async prepareSkeleton(data, preparation) {
        const skel = data.skeleton;
        const atlas = data.atlas[0];
        const pageMaterials = getSpinePageMaterials(data, atlas);
        PIXI.Assets.add({ alias: skel, src: `${skel}1` });
        PIXI.Assets.add({ alias: atlas.atlas, src: `${atlas.atlas}1`, data: {
            spineMaterials: Object.fromEntries(pageMaterials.map(binding => [binding.pageName, binding.materialInfo])),
        } });
        const skeleton = PIXI.Assets.load(skel);
        const loadedAtlas = PIXI.Assets.load(atlas.atlas);
        const programs = preparation && loadedAtlas.then(value => prepareSpinePrograms(value, pageMaterials, preparation));
        const uploaded = preparation && Promise.all([loadedAtlas, preparation.renderer]).then(async ([value, renderer]) => {
            for (const page of value.pages) {
                await new Promise(resolve => setTimeout(resolve, 0));
                if (preparation.isDisposed()) return;
                renderer.texture.initSource(page.texture.texture.source);
            }
        });
        const extraTextures = preparation && Promise.all(pageMaterials.flatMap(binding =>
            Object.entries(binding.materialInfo.properties).filter(([slot, property]) => slot !== '_MainTex' && property.type === 'Texture2D')
                .map(([slot, property]) => {
                    const name = Array.isArray(property.value) ? property.value[0] : property.value;
                    return preparation.texture(binding.texInfo[slot]?.name ?? name);
                })));
        const [value, preparedPrograms] = await Promise.all([loadedAtlas, programs, skeleton, uploaded, extraTextures]);
        return { atlas: value, pageMaterials, programs: preparedPrograms };
    }

    async init(audioController, container, hierarchy, tmp) {
        this.clips = tmp.clips;
        this.spineObjs = tmp.skeletons;
        this.eventAudioMap = tmp.eventAudioMap ?? {};
        this.talkGroups = Object.values(tmp.text?.UILobbySpecial ?? {})
            .map(group => group
                .filter(config => config.type === 'Talk' && config.animation)
                .map(config => config.animation))
            .filter(group => group.length > 0);

        this.audioController = audioController;
        if (this.audioPreparation) await this.audioPreparation;
        else this.prepareAudio(audioController, tmp);
        this.parentContainer = container;
        container.sortableChildren = true;
        const clipCounts = new Array(this.spineObjs.length).fill(0);

        for (const [index, clip] of this.clips.entries()) {
            clipCounts[clip.skeleton]++;
            this.clipIndexMap[`${clip.skeleton}:${clip.clipName}`] = index;
        }
        const mainSpineIndices = this.spineObjs.flatMap((skeleton, index) => skeleton.isMainSpine ? [index] : []);
        if (mainSpineIndices.length > 1) {
            throw new Error(`Multiple main Spine skeletons: ${mainSpineIndices.join(', ')}`);
        }
        this.mainSpineIndex = mainSpineIndices[0] ?? clipCounts.indexOf(Math.max(...clipCounts));

        const spines = new Array(this.spineObjs.length);
        const renderOrder = this.getSkeletonOrder(this.spineObjs);
        const resources = await this.resources;
        for (const [order, { data, index }] of renderOrder.entries()) {
            const skel = data.skeleton;
            const { atlas, pageMaterials, programs } = resources?.[order] ?? await this.prepareSkeleton(data);
            if (audioController.disposed) return;
            const spineObj = await spine.Spine.from({
                skeleton: skel,
                atlas: data.atlas[0].atlas,
                scale: data.skeletonScale ?? 1
            });
            // Timeline owns the frame order so particle prewarm sees this frame's bones.
            spineObj.autoUpdate = false;
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


            if (audioController.disposed) {
                spineObj.destroy();
                return;
            }
            if (!hierarchy?.attach(data.gameObject, spineObj, true)) container.addChild(spineObj);
            await applySpineMaterials(spineObj, atlas, pageMaterials, container, programs, () => audioController.disposed);
            if (audioController.disposed) return;
            spines[index] = spineObj;
            this.gameObjectMap[data.gameObject] = spineObj;

            if (index != this.mainSpineIndex) {
                spineObj.state.addListener({
                    complete: entry => {
                        if (entry.m_oriTrack < 0 && !entry.loop && !entry.m_holdLastFrame) {
                            spineObj.visible = false;
                        }
                    }
                })
            }
        }
        this.spineObjs = spines;
        this.prepareTalkGroups();
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
    update(deltaTime) {
        for (const view of this.spineObjs) view.update(deltaTime);
    }
    playClip(clipIndex, duration, delay, { immediate = false, holdLastFrame = false } = {}) {
        const clip = this.clips[clipIndex];
        if (!clip) {
            console.warn(`Unknown Spine clip index: ${clipIndex}`);
            return null;
        }
        const audioController = this.audioController;
        const state = this.spineObjs[clip.skeleton].state;
        const track = Math.max(clip.track, 0);
        const trackEntry = immediate
            ? state.setAnimation(track, clip.clipName, clip.loop)
            : state.addAnimation(track, clip.clipName, clip.loop, delay);
        trackEntry.m_oriTrack = clip.track;
        trackEntry.m_holdLastFrame = holdLastFrame && !clip.loop;
        // Non-looping entries keep applying their last frame until replaced.
        // Do not queue an empty animation while the interaction is held.
        // Timeline clip length is independent of the authored loop period.
        if (!clip.loop && duration != null) {
            trackEntry.animationEnd = duration;
        }
        if (!clip.useDefaultIntroMix) {
            trackEntry.mixDuration = clip.introMix;
        }
        if (!clip.loop && !holdLastFrame && (!clip.useDefaultIntroMix || !clip.useDefaultOutroMix)){
            state.addEmptyAnimation(track, clip.useDefaultOutroMix ? state.data.defaultMix : clip.outroMix);
        }
        clip.soundKeys.forEach(soundKey => {
            soundKey.audios.forEach(audio => {
                audioController.play(audio, soundKey.delay);
            });
        });
        clip.syncPlays.forEach(syncPlay => {
            this.playClip(syncPlay, null, 0, { immediate, holdLastFrame });
        });
        return trackEntry;
    }
    prepareTalkGroups() {
        const mainAnimations = this.spineObjs[this.mainSpineIndex].skeleton.data.animations;
        const eventPaths = new Map(mainAnimations.map(animation => [animation.name,
            animation.timelines.flatMap(timeline => (timeline.events ?? []).flatMap(event =>
                this.eventAudioMap[event.stringValue]?.path ?? []))]));
        this.talkAudio = this.talkGroups.map(animations => {
            const paths = new Set();
            const seen = new Set();
            const collect = index => {
                const clip = this.clips[index];
                if (!clip || seen.has(index)) return;
                seen.add(index);
                if (clip.skeleton === this.mainSpineIndex) {
                    for (const path of eventPaths.get(clip.clipName) ?? []) paths.add(path);
                }
                for (const soundKey of clip.soundKeys) {
                    for (const path of soundKey.audios) paths.add(path);
                }
                for (const sync of clip.syncPlays) collect(sync);
            };
            for (const animation of animations) collect(this.clipIndexMap[`${this.mainSpineIndex}:${animation}`]);
            return paths;
        });
        const talkAnimations = new Set(this.talkGroups.flat());
        // Event sounds shared with ordinary animations still have to be ready at startup.
        this.audioController.requireAudios([...eventPaths].flatMap(([name, paths]) =>
            talkAnimations.has(name) ? [] : paths));
    }

    playTalkAnimation() {
        if (!this.talkGroups.length || this.talkPending) return;
        const index = this.currentTalkGroupIndex;
        const animations = this.talkGroups[index];
        const pending = this.audioController.pendingAudios([...this.talkAudio[index]]);
        this.currentTalkGroupIndex = (index + 1) % this.talkGroups.length;
        this.onDisableInteractionEvent();
        if (pending.length) {
            this.talkPending = true;
            void Promise.allSettled(pending).then(() => {
                this.talkPending = false;
                if (!this.audioController.disposed) this.playTalkGroup(animations);
            });
        } else {
            this.playTalkGroup(animations);
        }
    }

    playTalkGroup(animations) {
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
