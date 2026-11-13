<script setup>
import GameObjectHierarchy from "./js/GameObjectHierarchy";
import { warmupShaderPrograms } from "./js/util";
import { loadPrefabConfig, openPrefab } from "./js/LobbyPack";
import AudioController from "./js/AudioController";
import InteractionController from "./js/InteractionController";
import MaterialRendererController from "./js/MaterialRendererController";
import ParticleController from "./js/ParticleController";
import PostProcessingController from "./js/PostProcessingController";
import SpineController from "./js/SpineController";
import TimelineController from "./js/TimelineController";
import { onBeforeUnmount, onMounted, ref } from 'vue';
import WindowManager from "./js/WindowManager";
const { prefab } = defineProps({ prefab: { type: String, required: true } });
const emit = defineEmits(['ready', 'error']);
const canvasHost = ref(null);
const app = new PIXI.Application();
const viewport = new PIXI.Container();
const viewportMask = new PIXI.Graphics();
const viewportArea = new PIXI.Rectangle();
const scene = new PIXI.Container();
scene.sortableChildren = true;
const backdrop = new PIXI.Graphics();
const offsetX = 0;
const offsetY = 0;
WindowManager.resize();
const audioController = new AudioController();
const particleController = new ParticleController(offsetX, offsetY);
const materialRendererController = new MaterialRendererController(offsetX, offsetY);
const postProcessingController = new PostProcessingController();
const spineController = new SpineController(offsetX, offsetY, 1);
const interactiveController = new InteractionController(spineController, offsetX, offsetY);
const timelineController = new TimelineController(spineController, interactiveController, postProcessingController,
    audioController, particleController, materialRendererController);

const updateViewportOffset = () => {
    const { width, height, scale, x, y, viewWidth, viewHeight } = WindowManager.resize();
    viewportArea.x = x;
    viewportArea.y = y;
    viewportArea.width = viewWidth;
    viewportArea.height = viewHeight;
    viewportMask.clear().rect(x, y, viewWidth, viewHeight).fill(0xffffff);
    // Opaque black belongs inside the filtered lobby; the outer frame stays blue.
    backdrop.clear().rect(x, y, viewWidth, viewHeight).fill(0x000000);
    scene.position.set(width * 0.5, height * 0.5);
    scene.scale.set(scale);
    scene.hitArea = new PIXI.Rectangle(
        -viewWidth / (2 * scale), -viewHeight / (2 * scale),
        viewWidth / scale, viewHeight / scale
    );
};


let disposed = false;

async function start() {
    await app.init({
        preference: 'webgl',
        preferWebGLVersion: 2,
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        resizeTo: window,
        backgroundColor: WindowManager.frameColor,
        hello: true,
    })
    canvasHost.value.appendChild(app.canvas);
    app.stage.addChild(viewport);
    app.stage.addChild(viewportMask);
    viewport.addChild(backdrop, scene);
    viewport.mask = viewportMask;
    updateViewportOffset();
    window.addEventListener('resize', updateViewportOffset);
    const [resources, objects, clips, particles, meshes, sprites, interaction, profiles, timeline] =
        await Promise.all([
            openPrefab(prefab),
            ...['GameObject', 'SpineClips', 'Particle', 'MeshRender', 'SpriteRender',
                'InteractionConfig', 'PostProcessing', 'Timeline']
                .map(name => loadPrefabConfig(prefab, `${name}.json`)),
        ]);
    dynamicResourceLoad = resources;
    const hierarchy = new GameObjectHierarchy(scene, objects);
    await spineController.init(audioController, scene, hierarchy, clips);
    await Promise.all([
        particleController.init(scene, hierarchy, particles),
        materialRendererController.init(scene, hierarchy, meshes, sprites),
        interactiveController.init(scene, interaction),
        postProcessingController.init(viewport, viewportArea, app.renderer, profiles),
    ]);

    hierarchy.initialize(spineController);
    for (const owner of new Set(hierarchy.bones.map(binding => binding.owner))) {
        spineController.addAfterUpdateTransform(() => {
            hierarchy.updateTransforms();
            particleController.updateBoneEmitters(owner);
        }, owner);
    }
    await timelineController.init(hierarchy, timeline);
    await Promise.all([
        warmupShaderPrograms(app.renderer),
        audioController.init()
    ])
    updateViewportOffset();
    if (disposed) return;
    postProcessingController.apply();
    emit('ready');
    await audioController.waitForPlaybackPermission();
    if (disposed) return;
    timelineController.start();
    app.ticker.add((ticker) => {
        const deltaSeconds = ticker.deltaMS * 0.001;
        timelineController.update(deltaSeconds);
        particleController.update(deltaSeconds);
    });
}

const dispose = () => {
    disposed = true;
    audioController.destroy();
};
onMounted(() => {
    window.addEventListener('pagehide', dispose);
    window.addEventListener('lobby-dispose', dispose);
    start().catch(error => {
        if (!disposed) emit('error', error);
    });
});

onBeforeUnmount(() => {
    window.removeEventListener('pagehide', dispose);
    window.removeEventListener('lobby-dispose', dispose);
    dispose();
    window.removeEventListener('resize', updateViewportOffset);
    app.stop?.();
    timelineController.stop();
    materialRendererController.destroy();
    particleController.destroy();
    postProcessingController.destroy();
});

</script>

<template>
    <div ref="canvasHost" class="main-container"></div>
</template>

<style scoped>
.main-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: -1;
}

.bone-drag-display {
    position: absolute;
    z-index: 4;
    background-color: rgba(200, 200, 200, 0.5);
}
</style>
