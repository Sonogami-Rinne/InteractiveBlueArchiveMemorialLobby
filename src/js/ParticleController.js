import { CParticleContainer } from 'pixi-unity-particle';
import { loadObjMesh } from './ObjMeshLoader.js';
import { Material, getMaterialRenderQueue, getRenderOrder } from './Material.js';
import { applyParticleScale, prepareParticleVertexShader, prepareParticleFragmentShader, isMaterialProperty, setMaterialProperty, getParticleTextureFormat } from './util.js';
import { getAdditionalTexcoordConfig } from './AdditionalUV.js';

export { getAdditionalTexcoordConfig } from './AdditionalUV.js';

function getSimulationData(data) {
    const copy = structuredClone(data);
    copy.translate = copy.position;
    return copy;
}

class ParticleController {
    constructor(offsetX, offsetY) {
        this.parentContainer = null;
        this.particleContainers = [];
        this.gameObjectMap = {};
        this.materials = [];
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.particleSystems = new Set();
        this.elapsedTime = 0;
    }
    async init(container, hierarchy) {
        this.container = container;
        this.hierarchy = hierarchy;
        container.sortableChildren = true;
        let data = null;
        await import('@assets/Particle.json').
            then(res => res.default).
            then(json => data = json);
        this.particleSystems = new Set(data.map(particle => particle.gameObject));

        const codes = [null, null, null, null];
        for (const par of data) {
            if (par.rendererModule.materialInfo.length == 0) {
                continue;
            }
            let textures = {};
            for (const [materialIndex, tex] of par.rendererModule.texInfo.entries()) {
                for (const [slot, texInfo] of Object.entries(tex)) {
                    const texName = texInfo.name;
                    const shaderName = par.rendererModule.materialInfo[materialIndex].shader;
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
            const mainMaterial = new Material(par.rendererModule.materialInfo[0], par.rendererModule.texInfo[0]);
            let trailMaterial = null;
            if (par.rendererModule.materialInfo[1] != undefined) {
                trailMaterial = new Material(par.rendererModule.materialInfo[1], par.rendererModule.texInfo[1]);
            }
            
            await Promise.all([dynamicResourceLoad(`${mainMaterial.shaderWithVariant}.vert`).then((data) => codes[0] = data),
                                dynamicResourceLoad(`${mainMaterial.shaderWithVariant}.frag`).then((data) => codes[1] = data),
                                trailMaterial != null ? dynamicResourceLoad(`${trailMaterial.shaderWithVariant}.vert`).then((data) => codes[2] = data) : true,
                                trailMaterial != null ? dynamicResourceLoad(`${trailMaterial.shaderWithVariant}.frag`).then((data) => codes[3] = data) : true
            ]);
            const applyActiveColorSpace = par.rendererModule.applyActiveColorSpace ?? true;
            mainMaterial.setupShader(prepareParticleVertexShader(codes[0], applyActiveColorSpace),
                prepareParticleFragmentShader(codes[1], par.rendererModule.renderMode === 4));
            if (trailMaterial != null) {
                trailMaterial.setupShader(prepareParticleVertexShader(codes[2], applyActiveColorSpace), codes[3]);
            }
            const additionalTexcoordConfig = getAdditionalTexcoordConfig(mainMaterial);
            const meshNames = par.rendererModule.meshes ?? [];
            const meshes = par.rendererModule.renderMode === 4
                ? await Promise.all(meshNames.map(name => loadObjMesh(name))) : undefined;
            const particleContainer = applyParticleScale(CParticleContainer.create(
                getSimulationData(par), 0, mainMaterial, trailMaterial, additionalTexcoordConfig, meshes), par);
            particleContainer.simulationTransform.set(1, 0, 0, -1, 0, 0);
            particleContainer.setOffset(this.offsetX, this.offsetY);
            const renderQueue = getMaterialRenderQueue(par.rendererModule.materialInfo[0]);
            particleContainer.zIndex = getRenderOrder(renderQueue, par.position?.[2],
                par.rendererModule.sortingOrder, par.rendererModule.sortingLayer, par.rendererModule.sortingFudge);
            const info = {
                gameObject: par.gameObject,
                data: structuredClone(par),
                meshes,
                renderQueue,
                particleContainer: particleContainer,
                material: mainMaterial,
                trailMaterial: trailMaterial,
            };
            container.addChild(particleContainer);
            this.particleContainers.push(info);
            this.gameObjectMap[par.gameObject] = info;

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
            const initial = info.data.initialModule;
            let seed = (initial.autoRandomSeed === false ? initial.randomSeed : clip.particleRandomSeed) >>> 0;
            info.random = () => {
                seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
                return seed / 4294967296;
            };
            const old = info.particleContainer;
            const parent = old.parent;
            const index = parent?.getChildIndex(old);
            const random = Math.random;
            try {
                Math.random = info.random;
                const view = applyParticleScale(CParticleContainer.create(getSimulationData(info.data), 0, info.material,
                    info.trailMaterial, getAdditionalTexcoordConfig(info.material), info.meshes), info.data);
                view.simulationTransform.set(1, 0, 0, -1, 0, 0);
                view.position.copyFrom(old.position);
                view.zIndex = old.zIndex;
                view.visible = old.visible;
                old.destroy();
                info.particleContainer = view;
                if (parent) parent.addChildAt(view, index);
                this.updateEmitter(info);
                // World-space prewarm/bursts must use the new view's bound matrix.
                view.begin();
            } finally {
                Math.random = random;
            }
        }
        const random = Math.random;
        try {
            Math.random = info.random;
            while (info.controlSteps < steps) {
                info.particleContainer.updateParticle(step);
                info.controlSteps++;
            }
        } finally {
            Math.random = random;
        }
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
        const initial = info.data.initialModule;
        const channel = /^InitialModule\.startColor\.maxColor\.([rgba])$/.exec(eventName)?.[1];
        if (eventName === 'm_IsActive' || eventName === 'm_Enabled') {
            view.visible = Boolean(value);
        } else if (eventName === 'simulationSpeed') {
            initial.simulationSpeed = value;
            view.simulationSpeed = value;
        } else if (channel && (initial.startColor.state === 0 || initial.startColor.state === 2)) {
            const [dataKey, runtimeKey] = initial.startColor.state === 0 ? ['color', 'color0'] : ['maxColor', 'color1'];
            initial.startColor[dataKey]['rgba'.indexOf(channel)] = value;
            view.startColor[runtimeKey][channel] = value;
        } else if (isMaterialProperty(eventName)) {
            setMaterialProperty([info.material, info.trailMaterial].filter(Boolean), eventName, value);
        } else {
            throw new Error(`Unsupported timeline property ${eventName} for ParticleController`);
        }
    }

    updateEmitter(info) {
        const depth = this.hierarchy.updateParticle(info);
        const renderer = info.data.rendererModule;
        info.particleContainer.zIndex = getRenderOrder(info.renderQueue, depth ?? info.data.position?.[2],
            renderer.sortingOrder, renderer.sortingLayer, renderer.sortingFudge);
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;
        for (const par of this.particleContainers) {
            // Shader scrolling continues for Timeline-controlled and hidden systems.
            par.material.setTime(this.elapsedTime);
            par.trailMaterial?.setTime(this.elapsedTime);
            this.updateEmitter(par);
            par.particleContainer.renderable = this.hierarchy?.active(par.gameObject) ?? true;
            if (par.timelineControlled || !par.particleContainer.visible || !par.particleContainer.renderable) continue;
            par.particleContainer.updateParticle(deltaTime);
        }
    }

    destroy() {
        for (const info of this.particleContainers) {
            info.particleContainer.destroy();
            info.material.shader.destroy();
            info.trailMaterial?.shader.destroy();
        }
        this.particleContainers = [];
        this.gameObjectMap = {};
    }
}

export default ParticleController;
