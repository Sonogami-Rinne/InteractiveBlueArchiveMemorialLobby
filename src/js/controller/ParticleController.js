import { CParticleContainer } from 'pixi-unity-particle';
import { loadObjMesh } from '../loader/ObjMeshLoader.js';
import { Material } from '../rendering/Material.js';
import { observePreparation } from '../loader/common.js';
import { getAdditionalTexcoordConfig } from '../rendering/AdditionalTexcoord.js';
import { LOBBY_ROOT_WORLD_SCALE } from '../ViewManager.js';
import { getRenderOrder, isMaterialProperty, setMaterialProperty, getParticleTextureFormat, prepareParticleVertexShader } from '../rendering/common.js'


function getSimulationData(data) {
    const copy = structuredClone(data);
    copy.translate = copy.position;
    return copy;
}

function createParticleRandom(seed) {
    let state = seed >>> 0;
    return () => {
        // Mulberry32 mixes each counter value before particle sampling.
        state = (state + 0x6D2B79F5) >>> 0;
        let value = Math.imul(state ^ (state >>> 15), state | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function withParticleRandom(random, simulate) {
    if (!random) return simulate();
    const previous = Math.random;
    try {
        Math.random = random;
        return simulate();
    } finally {
        Math.random = previous;
    }
}

function applyParticleScale(emitter, data) {
    const factor = data.InitialModule.scalingMode === 1 ? 1 / LOBBY_ROOT_WORLD_SCALE : 1;

    // pixi-unity-particle copies these modifiers into each newly born particle.
    // Its container scale must stay intact for emission positions and motion.
    emitter._particleScaleModifierX = factor;
    emitter._particleScaleModifierY = factor;
}

export default class ParticleController {
    constructor(offsetX, offsetY, particles, preparation) {
        this.parentContainer = null;
        this.particleContainers = [];
        this.particleResources = [];
        this.gameObjectMap = {};
        this.materials = [];
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.particleSystems = new Set();
        this.elapsedTime = 0;
        this.resources = particles && observePreparation(particles.then(data =>
            Promise.all(data.map(particle => this.prepareResources(particle, preparation)))));
    }

    async prepareResources(particle, preparation) {
        const { materialInfo, texInfo, applyActiveColorSpace = true } = particle.RendererModule;
        if (!materialInfo.length) return;
        const textures = new Set(texInfo.flatMap(slots => Object.values(slots).map(slot => slot.name)));
        const materials = [materialInfo[0]];
        if (materialInfo[1] || particle.TrailModule) materials.push(materialInfo[1] ?? materialInfo[0]);
        const shaderPrograms = Promise.all(materials.map(material => preparation.program(
            material.shaderWithVariant, vertex => prepareParticleVertexShader(vertex, applyActiveColorSpace))));
        const meshNames = CParticleContainer.getMeshNames(particle);
        const meshes = Promise.all(meshNames.map(async name => [name, await loadObjMesh(name, preparation.loadResource)]));
        const [programs, meshEntries] = await Promise.all([
            shaderPrograms, meshes, Promise.all([...textures].map(preparation.texture)),
        ]);
        return { programs, meshes: Object.fromEntries(meshEntries) };
    }

    async init(container, hierarchy, data) {
        this.container = container;
        this.hierarchy = hierarchy;
        container.sortableChildren = true;
        this.particleSystems = new Set(data.map(particle => particle.gameObject));

        const resources = await this.resources;
        if (this.disposed) return;
        const byIndex = new Map();
        for (const [index, par] of data.entries()) {
            if (par.RendererModule.materialInfo.length == 0) {
                continue;
            }
            // for (const { shader } of par.RendererModule.materialInfo) {
            //     getAdditionalTexcoordShaderConfig(shader);
            // }
            let textures = {};
            for (const [materialIndex, tex] of par.RendererModule.texInfo.entries()) {
                for (const [slot, texInfo] of Object.entries(tex)) {
                    const texName = texInfo.name;
                    const shaderName = par.RendererModule.materialInfo[materialIndex].shader;
                    PIXI.Assets.add({ alias: texName, src: `${texName}.png1`, data: {
                        format: getParticleTextureFormat(shaderName, slot),
                        alphaMode: 'no-premultiply-alpha',
                    } });
                    textures[texName] = null;
                }
            }
            textures = Object.keys(textures);
            const loads = new Array(textures.length);
            for (let i = 0; i < textures.length; i++) {
                loads[i] = PIXI.Assets.load(textures[i]);
            }
            await Promise.all(loads);
            if (this.disposed) return;
            const { materialInfo, texInfo, applyActiveColorSpace = true } = par.RendererModule;
            const mainMaterial = new Material(materialInfo[0], texInfo[0], true);
            const additionalTexcoordConfig = getAdditionalTexcoordConfig(mainMaterial);
            // A trail draw needs its own shader even when it shares the main material's properties.
            const trailMaterial = materialInfo[1] || par.TrailModule
                ? new Material(materialInfo[1] ?? materialInfo[0], texInfo[1] ?? texInfo[0], true) : null;
            const prepared = resources?.[index];
            const materials = [mainMaterial, trailMaterial].filter(Boolean);
            let meshes;
            if (prepared) {
                materials.forEach((material, index) => material.setProgram(prepared.programs[index]));
                meshes = prepared.meshes;
            } else {
                await Promise.all(materials.map(async material => {
                    const [vertex, fragment] = await Promise.all(['vert', 'frag'].map(extension =>
                        dynamicResourceLoad(`${material.shaderWithVariant}.${extension}`)));
                    material.setupShader(prepareParticleVertexShader(vertex, applyActiveColorSpace), fragment);
                }));
                const meshNames = CParticleContainer.getMeshNames(par);
                meshes = Object.fromEntries(await Promise.all(
                    meshNames.map(async name => [name, await loadObjMesh(name)])));
            }
            if (this.disposed) return;
            const renderQueue = materialInfo[0].renderQueue;
            const info = {
                gameObject: par.gameObject,
                data: getSimulationData(par),
                meshes,
                additionalTexcoordConfig,
                renderQueue,
                subEmitters: [],
                material: mainMaterial,
                trailMaterial: trailMaterial,
                rendererEnabled: par.RendererModule.enabled ?? true,
            };
            byIndex.set(index, info);
            this.particleResources.push(info);
            this.gameObjectMap[par.gameObject] = info;
            // Older exports omit parent for standalone systems.
            if ((par.parent ?? -1) !== -1) continue;
            const initial = par.InitialModule;
            if (initial.autoRandomSeed === false) info.random = createParticleRandom(initial.randomSeed);
            const view = withParticleRandom(info.random, () => this.createParticleContainer(info));
            view.setOffset(this.offsetX, this.offsetY);
            view.zIndex = getRenderOrder(renderQueue, par.position?.[2],
                par.RendererModule.sortingOrder, par.RendererModule.sortingLayer, par.RendererModule.sortingFudge);
            info.particleContainer = view;
            container.addChild(view);
            this.particleContainers.push(info);
        }

        for (const [index, info] of byIndex) {
            if (!info.particleContainer) continue;
            for (const entry of info.data.SubModule ?? []) {
                const child = byIndex.get(entry.emitter);
                if (!child || child.data.parent !== index) continue;
                child.parentInfo = info;
                info.subEmitters.push({ entry, child });
            }
            this.registerSubEmitters(info.particleContainer, info);
        }
    }

    createParticleContainer(info) {
        const view = CParticleContainer.create(info.data, 0, info.material,
            info.trailMaterial, info.additionalTexcoordConfig, info.meshes);
        applyParticleScale(view.mainEmitter, info.data);
        view.mainRendererVisible = info.rendererEnabled;
        view.simulationTransform.set(1, 0, 0, -1, 0, 0);
        return view;
    }

    registerSubEmitters(view, info) {
        for (const { entry, child } of info.subEmitters) {
            view.addSubEmitter(entry, {
                data: child.data,
                gameObject: child.gameObject,
                material: child.material,
                trailMaterial: child.trailMaterial,
                additionalTexcoordConfig: child.additionalTexcoordConfig,
                meshes: child.meshes,
                canRender: () => child.rendererEnabled && (this.hierarchy?.active(child.gameObject) ?? true),
                getWorldMatrix: () => this.hierarchy?.getWorldTransform?.(child.gameObject),
                place: emitter => {
                    applyParticleScale(emitter, child.data);
                    const initial = child.data.InitialModule;
                    emitter.simulationSpeed = initial.simulationSpeed;
                    const color = initial.startColor;
                    const rgba = color.state === 0 ? color.color : color.state === 2 ? color.maxColor : null;
                    if (rgba) {
                        const target = color.state === 0 ? emitter.startColor.color0 : emitter.startColor.color1;
                        [target.r, target.g, target.b, target.a] = rgba;
                    }
                },
            });
        }
    }

    isControlParticle(gameObject, root, searchHierarchy) {
        if (!searchHierarchy && !this.particleSystems.has(Number(root))) return false;
        return this.hierarchy.contains(root, gameObject);
    }

    manageControlParticles(root, searchHierarchy) {
        for (const info of this.particleContainers) {
            if (this.isControlParticle(info.gameObject, root, searchHierarchy)) info.timelineControlled = true;
        }
    }

    getControlTargets() {
        return this.particleContainers.map(info => ({
            gameObject: info.gameObject,
            getVisible: () => info.particleContainer.visible && (this.hierarchy?.active(info.gameObject) ?? true),
            setVisible: visible => { info.particleContainer.visible = visible; },
            isManagedBy: (root, hierarchy) => this.isControlParticle(info.gameObject, root, hierarchy),
            seek: (time, clip, epoch) => this.seekControlParticle(info, time, clip, epoch),
        }));
    }

    seekControlParticle(info, time, clip, epoch) {
        this.updateEmitter(info);
        const step = 1 / 60;
        const steps = Math.max(0, Math.floor(time / step + 1e-8));
        if (info.controlClip !== clip || info.controlEpoch !== epoch || steps < info.controlSteps) {
            info.controlClip = clip;
            info.controlEpoch = epoch;
            info.controlSteps = 0;
            const initial = info.data.InitialModule;
            info.random = createParticleRandom(initial.autoRandomSeed === false ? initial.randomSeed : clip.particleRandomSeed);
            const old = info.particleContainer;
            const parent = old.parent;
            const index = parent?.getChildIndex(old);
            withParticleRandom(info.random, () => {
                const view = this.createParticleContainer(info);
                this.registerSubEmitters(view, info);
                view.position.copyFrom(old.position);
                view.zIndex = old.zIndex;
                view.visible = old.visible;
                old.destroy();
                info.particleContainer = view;
                if (parent) parent.addChildAt(view, index);
                this.updateEmitter(info);
                // World-space prewarm/bursts must use the new view's bound matrix.
                view.begin();
            });
        }
        withParticleRandom(info.random, () => {
            while (info.controlSteps < steps) {
                info.particleContainer.updateParticle(step);
                info.controlSteps++;
            }
        });
    }

    updateBoneEmitters(owner) {
        const hierarchy = this.hierarchy;
        if (!hierarchy) return;
        for (const { node, owner: boneOwner } of hierarchy.bones) {
            if (owner !== boneOwner) continue;
            for (const info of this.particleContainers) {
                if (hierarchy.contains(node.id, info.gameObject)) this.updateEmitter(info);
            }
        }
    }

    setOffset(offsetX, offsetY) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        for (const { particleContainer } of this.particleContainers) {
            particleContainer.setOffset(offsetX, offsetY);
        }
        for (const info of this.particleContainers) this.updateEmitter(info);
    }


    handleTimelineEvent(gameObject, eventName, value) {
        const info = this.gameObjectMap[gameObject];
        const view = info.particleContainer;
        const updateEmitters = update => {
            if (view) {
                update(view.mainEmitter);
                return;
            }
            info.parentInfo?.particleContainer.forEachEmitter((emitter, slot) => {
                if (slot >= 0 && emitter.gameObject === info.gameObject) update(emitter);
            });
        };
        const initial = info.data.InitialModule;
        const channel = /^InitialModule\.startColor\.maxColor\.([rgba])$/.exec(eventName)?.[1];
        if (eventName === 'm_Enabled') {
            info.rendererEnabled = Boolean(value);
            if (view) view.mainRendererVisible = info.rendererEnabled;
        } else if (eventName === 'm_IsActive') {
            if (view) view.visible = Boolean(value);
        } else if (eventName === 'simulationSpeed') {
            initial.simulationSpeed = value;
            updateEmitters(emitter => { emitter.simulationSpeed = value; });
        } else if (channel && (initial.startColor.state === 0 || initial.startColor.state === 2)) {
            const [dataKey, runtimeKey] = initial.startColor.state === 0 ? ['color', 'color0'] : ['maxColor', 'color1'];
            initial.startColor[dataKey]['rgba'.indexOf(channel)] = value;
            updateEmitters(emitter => { emitter.startColor[runtimeKey][channel] = value; });
        } else if (isMaterialProperty(eventName)) {
            setMaterialProperty([info.material, info.trailMaterial].filter(Boolean), eventName, value);
        } else {
            throw new Error(`Unsupported timeline property ${eventName} for ParticleController`);
        }
    }

    updateEmitter(info) {
        const depth = this.hierarchy.updateParticle(info);
        const renderer = info.data.RendererModule;
        info.particleContainer.zIndex = getRenderOrder(info.renderQueue, depth ?? info.data.position?.[2],
            renderer.sortingOrder, renderer.sortingLayer, renderer.sortingFudge);
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;
        // Shader scrolling continues for Timeline-controlled and hidden systems.
        for (const info of this.particleResources) {
            info.material.setTime(this.elapsedTime);
            info.trailMaterial?.setTime(this.elapsedTime);
        }
        for (const par of this.particleContainers) {
            this.updateEmitter(par);
            const active = this.hierarchy?.active(par.gameObject) ?? true;
            par.particleContainer.renderable = active;
            if (par.timelineControlled || !par.particleContainer.visible || !active) continue;
            withParticleRandom(par.random, () => par.particleContainer.updateParticle(deltaTime));
        }
    }

    destroy() {
        this.disposed = true;
        for (const info of this.particleContainers) info.particleContainer.destroy();
        for (const info of this.particleResources) {
            info.material.shader.destroy();
            info.trailMaterial?.shader.destroy();
        }
        this.particleContainers = [];
        this.particleResources = [];
        this.gameObjectMap = {};
    }
}
