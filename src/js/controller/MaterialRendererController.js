import { Material } from '../rendering/Material.js';
import { observePreparation } from '../loader/common.js';
import { loadObjMesh } from '../loader/ObjMeshLoader.js';
import { getRenderOrder, isMaterialProperty, setMaterialProperty, applyBlendInfo } from '../rendering/common.js'

const unityToPixi = new PIXI.Matrix(1, 0, 0, -1, 0, 0);

// Bounds of the already cropped/unpacked PNG, in Pixi local coordinates.
// Unity's pivot and trim offsets use a bottom-left origin and Y pointing up.
export function getSpriteBounds(sprite) {
    if (!sprite?.rect || !(sprite.pixelsToUnits > 0)) return [-0.5, -0.5, 0.5, 0.5];
    const { rect, pivot = [0.5, 0.5], pixelsToUnits: units, renderData = {} } = sprite;
    const [offsetX, offsetY] = renderData.textureRectOffset ?? [0, 0];
    let [, , width, height] = renderData.textureRect ?? rect;
    // UnityPy has already undone packing rotation in the exported PNG.
    if (renderData.packed && renderData.packingRotation === 4) [width, height] = [height, width];
    const left = (offsetX - pivot[0] * rect[2]) / units;
    const bottom = (pivot[1] * rect[3] - offsetY) / units;
    return [left, bottom - height / units, left + width / units, bottom];
}



export function createQuadGeometry(rendererType = 'MeshRenderer', spriteInfo) {
    const spriteLayout = rendererType === 'SpriteRenderer';
    const [left, top, right, bottom] = getSpriteBounds(spriteInfo);
    const positions = new Float32Array(spriteLayout && spriteInfo?.rect
        ? [left, bottom, right, bottom, right, top, left, top]
        : [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]);
    const attributes = {
        aPosition: {
            buffer: spriteLayout ? new Float32Array(8) : positions,
            format: 'float32x2',
        },
        aUV: { buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), format: 'float32x2' },
    };
    attributes.aVertex = { buffer: positions, format: 'float32x2' };
    attributes.aColor = { buffer: new Float32Array(16).fill(1), format: 'float32x4' };
    attributes.aRotation = { buffer: new Float32Array(4), format: 'float32' };
    attributes.atexcoord1 = { buffer: new Float32Array(16), format: 'float32x4' };
    attributes.atexcoord2 = { buffer: new Float32Array(16), format: 'float32x4' };
    return new PIXI.Geometry({
        attributes,
        indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
    });
}

export function createMeshGeometry(mesh) {
    const count = mesh.positions.length / 3;
    return new PIXI.Geometry({ attributes: {
        ScaledTranslation_vertex: { buffer: mesh.positions, format: 'float32x3' },
        Translation_particle: { buffer: new Float32Array(count * 3), format: 'float32x3' },
        Rotation_particle: { buffer: new Float32Array(count * 3), format: 'float32x3' },
        aUV: { buffer: mesh.uvs, format: 'float32x2' },
        aColor: { buffer: new Float32Array(count * 4).fill(1), format: 'float32x4' },
        atexcoord0: { buffer: new Float32Array(count * 4), format: 'float32x4' },
        atexcoord1: { buffer: new Float32Array(count * 4), format: 'float32x4' },
        atexcoord2: { buffer: new Float32Array(count * 4), format: 'float32x4' },
        atexcoord3: { buffer: new Float32Array(count * 4), format: 'float32x4' },
    }, indexBuffer: mesh.indices });
}

function colorToTint(color) {
    const channel = index => Math.round(Math.max(0, Math.min(1, color[index] ?? 1)) * 255);
    return (channel(0) << 16) | (channel(1) << 8) | channel(2);
}

class MaterialQuad extends PIXI.RenderContainer {
    constructor(material, queue, rendererType, color = [1, 1, 1, 1], spriteInfo, mesh, submesh) {
        const bounds = getSpriteBounds(spriteInfo);
        super({ label: 'Material Renderer Quad', addBounds: target => target.addFrame(...bounds) });
        this.material = material;
        this.mesh = mesh;
        this.projectedBounds = bounds;
        this.rendererType = rendererType;
        this.rendererColor = [...color];
        this.tint = colorToTint(this.rendererColor);
        this.alpha = this.rendererColor[3] ?? 1;
        this.zIndex = queue;
        this.geometry = mesh ? createMeshGeometry(mesh) : createQuadGeometry(rendererType, spriteInfo);
        this.drawRange = submesh ?? { start: 0, count: mesh?.indices.length ?? 6 };
        this.state = PIXI.State.for2d();
    }

    setMeshWorldTransform(world) {
        if (this.meshWorld?.every((value, i) => value === world[i])) return;
        this.meshWorld = world;
        const model = this.material.localUniform.uniforms.uTransform;
        model.set(world);

        const { positions } = this.mesh;
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (let i = 0; i < positions.length; i += 3) {
            const x = model[0] * positions[i] + model[4] * positions[i + 1] + model[8] * positions[i + 2] + model[12];
            const y = -(model[1] * positions[i] + model[5] * positions[i + 1] + model[9] * positions[i + 2] + model[13]);
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
        this.projectedBounds.splice(0, 4, left, top, right, bottom);
        this.zIndex = getRenderOrder(this.renderQueue, world[14], this.sortingOrder, this.sortingLayer);
        this.onViewUpdate();
    }

    setRendererColor(channel, value) {
        const index = { r: 0, g: 1, b: 2, a: 3 }[channel];
        if (index === undefined) return;
        this.rendererColor[index] = value;
        if (index === 3) this.alpha = value;
        else this.tint = colorToTint(this.rendererColor);
    }

    setSpriteTexture(name) {
        const source = PIXI.Texture.from(name).source;
        const textureProperty = this.material.textureSources._MainTex ? '_MainTex'
            : Object.keys(this.material.textureSources)[0];
        if (!textureProperty) return;
        this.material.textureSources[textureProperty] = source;
        this.material.textureNames[textureProperty] = name;
        this.material.shader.resources[textureProperty] = source;
    }

    render(renderer) {
        const uniforms = this.material.localUniform.uniforms;
        this.worldTransform.copyTo(uniforms.uTranslationMatrix);
        if (this.mesh) uniforms.uTranslationMatrix.append(unityToPixi);
        uniforms.uTranslationMatrix.prepend(renderer.globalUniforms.globalUniformData.projectionMatrix);
        PIXI.color32BitToUniform(this.groupColorAlpha, uniforms.uColor, 0);
        uniforms.uResolution = renderer.globalUniforms.globalUniformData.resolution;
        uniforms.uRound = uniforms.PixelSnap > 0.5 ? 1 : 0;
        if (this.rendererType === 'SpriteRenderer' && uniforms._RendererColor) {
            // Pixi supplies PMA tint, but Sprites/Default premultiplies in its
            // fragment program. Feed its per-renderer uniform straight color.
            const alpha = uniforms.uColor[3];
            for (let i = 0; i < 3; i++) {
                uniforms._RendererColor[i] = alpha > 0 ? uniforms.uColor[i] / alpha : 0;
            }
            uniforms._RendererColor[3] = alpha;
        }
        this.material.localUniform.update();
        renderer.shader.bind(this.material.shader);
        renderer.state.set(this.state);
        renderer.geometry.bind(this.geometry, this.material.shader.glProgram);
        const gl = renderer.gl;
        applyBlendInfo(gl, this.material.blendInfo);
        const bytes = this.geometry.indexBuffer.data.BYTES_PER_ELEMENT;
        gl.drawElements(gl.TRIANGLES, this.drawRange.count, bytes === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, this.drawRange.start * bytes);
    }

    destroy() {
        if (this.destroyed) return;
        this.geometry.destroy(true);
        this.material.shader.destroy();
        super.destroy();
    }
}

export default class MaterialRendererController {
    constructor(offsetX = 0, offsetY = 0, renderables, preparation) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.gameObjectMap = {};
        this.resources = renderables && observePreparation(renderables.then(([meshes, sprites]) =>
            Promise.all([meshes, sprites].map((items, index) => Promise.all(
                items.map(item => this.prepareResources(item, index === 1, preparation)))))));
    }

    async prepareResources(renderable, isSprite, preparation) {
        const textures = new Set(isSprite ? [renderable.sprite] : []);
        const programs = Promise.all((renderable.materialInfo ?? []).map(info => {
            for (const property of Object.values(info.properties ?? {})) {
                if (property.type === 'Texture2D') {
                    textures.add(Array.isArray(property.value) ? property.value[0] : property.value);
                }
            }
            return preparation.program(info.shaderWithVariant);
        }));
        const mesh = isSprite ? null : loadObjMesh(renderable.mesh, preparation.loadResource);
        const [loadedPrograms, loadedMesh] = await Promise.all([programs, mesh, Promise.all([...textures].map(preparation.texture))]);
        return { programs: loadedPrograms, mesh: loadedMesh };
    }

    async init(scene, hierarchy, meshes, sprites) {
        this.hierarchy = hierarchy;
        scene.sortableChildren = true;
        const resources = await this.resources;
        for (const [typeIndex, [rendererType, renderables]] of [
            ['MeshRenderer', meshes],
            ['SpriteRenderer', sprites],
        ].entries()) {
            for (const [index, renderable] of renderables.entries()) {
                if (this.disposed) return;
                await this.#addRenderable(scene, renderable, rendererType, resources?.[typeIndex][index]);
            }
        }
    }

    async #loadTexture(name) {
        if (typeof name !== 'string' || name === 'white') return;
        await PIXI.Assets.load({
            alias: name,
            src: `${name}.png1`,
            data: { format: 'rgba8unorm-srgb', alphaMode: 'no-premultiply-alpha' },
        });
    }

    async #addRenderable(scene, renderable, rendererType, prepared) {
        const views = this.gameObjectMap[renderable.gameObject] ?? [];
        if (rendererType === 'SpriteRenderer') await this.#loadTexture(renderable.sprite);
        const mesh = prepared ? prepared.mesh : rendererType === 'MeshRenderer' ? await loadObjMesh(renderable.mesh) : null;
        for (const [index, info] of (renderable.materialInfo ?? []).entries()) {
            for (const property of Object.values(info.properties ?? {})) {
                if (property.type !== 'Texture2D') continue;
                const name = Array.isArray(property.value) ? property.value[0] : property.value;
                await this.#loadTexture(name);
            }
            const material = new Material(info, renderable.texInfo?.[index] ?? {}, Boolean(mesh));
            if (rendererType === 'SpriteRenderer' && material.textureSources._MainTex) {
                const source = PIXI.Texture.from(renderable.sprite).source;
                material.textureSources._MainTex = source;
                material.textureNames._MainTex = renderable.sprite;
            }
            if (this.disposed) return;
            if (prepared) material.setProgram(prepared.programs[index]);
            else {
                const [vertex, fragment] = await Promise.all(['vert', 'frag'].map(extension =>
                    dynamicResourceLoad(`${material.shaderWithVariant}.${extension}`)));
                material.setupShader(vertex, fragment);
            }
            const queue = material.renderQueue;
            const view = new MaterialQuad(material,
                getRenderOrder(queue,
                    renderable.position[2], renderable.sortingOrder, renderable.sortingLayer),
                rendererType, renderable.color, rendererType === 'SpriteRenderer' ? renderable : undefined, mesh,
                mesh?.submeshes[index]);
            view.label = `${rendererType} ${renderable.mesh ?? renderable.sprite}: ${renderable.gameObject}`;
            if (mesh) {
                view.renderQueue = queue;
                view.sortingOrder = renderable.sortingOrder;
                view.sortingLayer = renderable.sortingLayer;
                view.position.set(this.offsetX, this.offsetY);
                if (!this.hierarchy.attachSpatial(renderable.gameObject, view)) {
                    view.destroy();
                    throw new Error(`Missing GameObject transform for mesh ${renderable.gameObject}`);
                }
            } else {
                view.position.set(renderable.position[0] + this.offsetX, -renderable.position[1] + this.offsetY);
                view.rotation = -renderable.rotation;
                const flipX = renderable.flip?.[0] ? -1 : 1;
                const flipY = renderable.flip?.[1] ? -1 : 1;
                view.scale.set(renderable.scale[0] * flipX, renderable.scale[1] * flipY);
                if (!this.hierarchy?.attach(renderable.gameObject, view, true)) scene.addChild(view);
            }
            views.push(view);
        }
        this.gameObjectMap[renderable.gameObject] = views;
    }


    handleTimelineEvent(gameObject, name, value) {
        const views = this.gameObjectMap[gameObject];
        if (!views) throw new Error(`No material renderer registered for gameObject ${gameObject}`);
        if (name === 'm_IsActive' || name === 'm_Enabled') {
            views.forEach(view => { view.visible = Boolean(value); });
        } else if (name === 'm_Sprite') {
            views.filter(view => view.rendererType === 'SpriteRenderer')
                .forEach(view => view.setSpriteTexture(value));
        } else if (name.startsWith('m_Color.')) {
            const channel = name.slice('m_Color.'.length);
            views.filter(view => view.rendererType === 'SpriteRenderer')
                .forEach(view => view.setRendererColor(channel, value));
        } else if (isMaterialProperty(name)) {
            setMaterialProperty(views.map(view => view.material), name, value);
        } else {
            throw new Error(`Unsupported material renderer timeline property ${name}`);
        }
    }

    destroy() {
        this.disposed = true;
        for (const views of Object.values(this.gameObjectMap)) for (const view of views) view.destroy();
        this.gameObjectMap = {};
    }
}
