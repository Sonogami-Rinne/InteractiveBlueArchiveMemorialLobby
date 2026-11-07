<script setup>
import GameObjectHierarchy from "./js/GameObjectHierarchy";
import { loadGameObjects } from "./js/util";
import AudioController from "./js/AudioController";
import InteractionController from "./js/InteractionController";
import MaterialRendererController from "./js/MaterialRendererController";
import ParticleController from "./js/ParticleController";
import PostProcessingController from "./js/PostProcessingController";
import SpineController from "./js/SpineController";
import TimelineController from "./js/TimelineController";
import { onBeforeUnmount, onMounted } from 'vue';
import WindowManager from "./js/WindowManager";
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


onMounted(async () => {
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
    document.getElementById("canvas").appendChild(app.canvas);
    app.stage.addChild(viewport);
    app.stage.addChild(viewportMask);
    viewport.addChild(backdrop, scene);
    viewport.mask = viewportMask;
    updateViewportOffset();
    window.addEventListener('resize', updateViewportOffset);
    await loadGameObjects();
    const hierarchy = new GameObjectHierarchy(scene);
    await spineController.init(audioController, scene, hierarchy);
    await Promise.all([
        particleController.init(scene, hierarchy),
        materialRendererController.init(scene, hierarchy),
        interactiveController.init(scene),
        postProcessingController.init(viewport, viewportArea, app.renderer),
    ]);

    hierarchy.initialize(spineController);
    for (const owner of new Set(hierarchy.bones.map(binding => binding.owner))) {
        spineController.addAfterUpdateTransform(() => {
            hierarchy.updateTransforms();
            particleController.updateBoneEmitters(owner);
        }, owner);
    }
    await timelineController.init(hierarchy);
    await audioController.init();
    updateViewportOffset();
    await audioController.waitForPlaybackPermission();
    timelineController.start();
    postProcessingController.apply();
    app.ticker.add((ticker) => {
        const deltaSeconds = ticker.deltaMS * 0.001;
        timelineController.update(deltaSeconds);
        particleController.update(deltaSeconds);
    });
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', updateViewportOffset);
    app.stop?.();
    timelineController.stop();
    materialRendererController.destroy();
    particleController.destroy();
    postProcessingController.destroy();
});

</script>

<template>
    <el-container class="main-container" id="canvas">
    </el-container>
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
