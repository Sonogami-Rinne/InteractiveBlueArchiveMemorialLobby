<script setup>
import GameObjectHierarchy from "./js/transform/GameObjectHierarchy";
import { observePreparation } from "./js/loader/common";
import { loadPrefabConfig, openPrefab } from "./js/loader/PrefabLoader";
import { AudioController } from "./js/controller/AudioController";
import InteractionController from "./js/controller/InteractionController";
import MaterialRendererController from "./js/controller/MaterialRendererController";
import ParticleController from "./js/controller/ParticleController";
import PostProcessingController from "./js/controller/PostProcessingController";
import SpineController from "./js/controller/SpineController";
import TimelineController from "./js/controller/TimelineController";
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ViewManager, { frameColor } from "./js/ViewManager";
import { readLobbyPreferences } from "./js/LobbyPreferences";
import { getShaderProgram } from './js/rendering/ShaderProgram';
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
function updateViewportTargets() {
    const { targetViewWidth, targetViewHeight } = window.frameElement?.lobbyGraphics ?? readLobbyPreferences();
    ViewManager.targetViewWidth = targetViewWidth;
    ViewManager.targetViewHeight = targetViewHeight;
}

updateViewportTargets();
ViewManager.resize();
const resources = observePreparation(openPrefab(prefab).then(load => {
    // The classic Pixi asset parsers use this scene's loader.
    dynamicResourceLoad = load;
    for (const name of load.names) {
        if (/\.(vert|frag)$/.test(name)) observePreparation(load(name));
    }
    return load;
}));
const loadResource = async name => (await resources)(name);
const config = name => observePreparation(resources.then(load => loadPrefabConfig(load, name)));
const objects = config('GameObject');
const clips = config('SpineClips');
const particles = config('Particle');
const meshes = config('MeshRender');
const sprites = config('SpriteRender');
const interaction = config('InteractionConfig');
const profiles = config('PostProcessing');
const timeline = config('Timeline');

const rendererReady = observePreparation(app.init({
    preference: 'webgl',
    preferWebGLVersion: 2,
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: window,
    autoStart: false,
    backgroundColor: frameColor,
    hello: true,
}).then(() => app.renderer));

const preparation = {
    loadResource,
    renderer: rendererReady,
    isDisposed: () => disposed,
    texture: name => prepareLobbyTexture(name, loadResource),
    async program(name, prepareVertex = vertex => vertex, prepareFragment = fragment => fragment) {
        const [vertex, fragment, renderer] = await Promise.all([
            loadResource(`${name}.vert`), loadResource(`${name}.frag`), rendererReady,
        ]);
        if (disposed) return;
        const program = getShaderProgram(name, prepareVertex(vertex), prepareFragment(fragment));
        await renderer.shader.prepareProgram(program);
        return program;
    },
};
const audioController = new AudioController(loadResource);
const particleController = new ParticleController(offsetX, offsetY, particles, preparation);
const materialRendererController = new MaterialRendererController(offsetX, offsetY, Promise.all([meshes, sprites]), preparation);
const postProcessingController = new PostProcessingController();
const spineController = new SpineController(offsetX, offsetY, 1, clips, audioController, preparation);
const interactiveController = new InteractionController(spineController, offsetX, offsetY);
const timelineController = new TimelineController(spineController, interactiveController, postProcessingController,
    audioController, particleController, materialRendererController, timeline);

const updateViewportOffset = () => {
    const { width, height, scale, x, y, viewWidth, viewHeight } = ViewManager.resize();
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

function updateGraphics() {
    updateViewportTargets();
    updateViewportOffset();
}

let disposed = false;

async function start() {
    const renderer = await rendererReady;
    if (disposed) return;
    canvasHost.value.appendChild(app.canvas);
    app.stage.addChild(viewport);
    app.stage.addChild(viewportMask);
    viewport.addChild(backdrop, scene);
    viewport.mask = viewportMask;
    updateGraphics();
    window.addEventListener('resize', updateViewportOffset);
    window.addEventListener('lobby-graphics-change', updateGraphics);
    const postProcessingReady = observePreparation(profiles.then(data =>
        postProcessingController.init(viewport, viewportArea, renderer, data)));
    const hierarchy = new GameObjectHierarchy(scene, await objects);
    if (disposed) return;
    await spineController.init(audioController, scene, hierarchy, await clips);
    if (disposed) return;
    await Promise.all([
        particleController.init(scene, hierarchy, await particles),
        materialRendererController.init(scene, hierarchy, await meshes, await sprites),
        interaction.then(data => interactiveController.init(scene, data)),
        postProcessingReady,
    ]);
    if (disposed) return;

    hierarchy.initialize(spineController);
    for (const owner of new Set(hierarchy.bones.map(binding => binding.owner))) {
        spineController.addAfterUpdateTransform(() => {
            hierarchy.updateTransforms();
            particleController.updateBoneEmitters(owner);
        }, owner);
    }
    await timelineController.init(hierarchy, await timeline);
    await audioController.init();
    updateViewportOffset();
    if (disposed) return;
    postProcessingController.apply();
    app.render();
    app.start();
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
    window.removeEventListener('lobby-graphics-change', updateGraphics);
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
