import { Material, getRenderQueue, getMaterialRenderQueue, getRenderOrder } from './Material.js';
import { applyBlendInfo, isMaterialProperty, setMaterialProperty, prepareSpriteVertexShader } from './util.js';
import { getSpriteBounds } from './SpriteGeometry.js';
import { loadObjMesh } from './ObjMeshLoader.js';

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
        aUV: { buffer: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), format: 'float32x2' },
    };
    // Converted FX shaders use the particle-style layout for static meshes too.
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
    const positions = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        positions[i * 2] = mesh.positions[i * 3];
        positions[i * 2 + 1] = -mesh.positions[i * 3 + 1];
    }
    return new PIXI.Geometry({ attributes: {
        aPosition: { buffer: new Float32Array(count * 2), format: 'float32x2' },
        aVertex: { buffer: positions, format: 'float32x2' },
        aUV: { buffer: mesh.uvs, format: 'float32x2' },
        aColor: { buffer: new Float32Array(count * 4).fill(1), format: 'float32x4' },
        aRotation: { buffer: new Float32Array(count), format: 'float32' },
        atexcoord1: { buffer: new Float32Array(count * 4), format: 'float32x4' },
        atexcoord2: { buffer: new Float32Array(count * 4), format: 'float32x4' },
    }, indexBuffer: mesh.indices });
}

function colorToTint(color) {
    const channel = index => Math.round(Math.max(0, Math.min(1, color[index] ?? 1)) * 255);
    return (channel(0) << 16) | (channel(1) << 8) | channel(2);
}

class MaterialQuad extends PIXI.RenderContainer {
    constructor(material, queue, rendererType, color = [1, 1, 1, 1], spriteInfo, mesh, submesh) {
        const bounds = getSpriteBounds(spriteInfo);
        if (mesh) {
            bounds[0] = bounds[1] = Infinity; bounds[2] = bounds[3] = -Infinity;
            for (let i = 0; i < mesh.positions.length; i += 3) {
                bounds[0] = Math.min(bounds[0], mesh.positions[i]);
                bounds[1] = Math.min(bounds[1], -mesh.positions[i + 1]);
                bounds[2] = Math.max(bounds[2], mesh.positions[i]);
                bounds[3] = Math.max(bounds[3], -mesh.positions[i + 1]);
            }
        }
        super({ label: 'Material Renderer Quad', addBounds: target => target.addFrame(...bounds) });
        this.material = material;
        this.rendererType = rendererType;
        this.rendererColor = [...color];
        this.tint = colorToTint(this.rendererColor);
        this.alpha = this.rendererColor[3] ?? 1;
        this.zIndex = queue;
        this.geometry = mesh ? createMeshGeometry(mesh) : createQuadGeometry(rendererType, spriteInfo);
        this.drawRange = submesh ?? { start: 0, count: mesh?.indices.length ?? 6 };
        this.state = PIXI.State.for2d();
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
        const restore = applyBlendInfo(gl, this.material.blendInfo);
        try {
            const bytes = this.geometry.indexBuffer.data.BYTES_PER_ELEMENT;
            gl.drawElements(gl.TRIANGLES, this.drawRange.count, bytes === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, this.drawRange.start * bytes);
        } finally {
            restore();
        }
    }

    destroy() {
        if (this.destroyed) return;
        this.geometry.destroy(true);
        this.material.shader.destroy();
        super.destroy();
    }
}

export default class MaterialRendererController {
    constructor(offsetX = 0, offsetY = 0) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.gameObjectMap = {};
    }

    async init(scene, hierarchy) {
        this.hierarchy = hierarchy;
        const [{ default: meshes }, { default: sprites }] = await Promise.all([
            import('@assets/MeshRender.json'),
            import('@assets/SpriteRender.json'),
        ]);
        scene.sortableChildren = true;
        for (const [rendererType, renderables] of [
            ['MeshRenderer', meshes],
            ['SpriteRenderer', sprites],
        ]) {
            for (const renderable of renderables) {
                await this.#addRenderable(scene, renderable, rendererType);
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

    async #addRenderable(scene, renderable, rendererType) {
        const views = this.gameObjectMap[renderable.gameObject] ?? [];
        if (rendererType === 'SpriteRenderer') await this.#loadTexture(renderable.sprite);
        const mesh = rendererType === 'MeshRenderer' ? await loadObjMesh(renderable.mesh) : null;
        for (const [index, info] of (renderable.materialInfo ?? []).entries()) {
            for (const property of Object.values(info.properties ?? {})) {
                if (property.type !== 'Texture2D') continue;
                const name = Array.isArray(property.value) ? property.value[0] : property.value;
                await this.#loadTexture(name);
            }
            const material = new Material(info, renderable.texInfo?.[index] ?? {});
            if (rendererType === 'SpriteRenderer' && material.textureSources._MainTex) {
                const source = PIXI.Texture.from(renderable.sprite).source;
                material.textureSources._MainTex = source;
                material.textureNames._MainTex = renderable.sprite;
            }
            let [vertex, fragment] = await Promise.all(['vert', 'frag'].map(extension =>
                dynamicResourceLoad(`${material.shaderWithVariant}.${extension}`)));
            if (rendererType === 'SpriteRenderer' && material.shaderName === 'Sprites/Default') {
                vertex = prepareSpriteVertexShader(vertex);
            }
            material.setupShader(vertex, fragment);
            const view = new MaterialQuad(material,
                getRenderOrder(getMaterialRenderQueue(info, getRenderQueue(renderable.renderQueue)),
                    renderable.position[2], renderable.sortingOrder, renderable.sortingLayer),
                rendererType, renderable.color, rendererType === 'SpriteRenderer' ? renderable : undefined, mesh,
                mesh?.submeshes[index]);
            view.label = `${rendererType} ${renderable.mesh ?? renderable.sprite}: ${renderable.gameObject}`;
            view.position.set(renderable.position[0] + this.offsetX, -renderable.position[1] + this.offsetY);
            view.rotation = -renderable.rotation;
            const flipX = rendererType === 'SpriteRenderer' && renderable.flip?.[0] ? -1 : 1;
            const flipY = rendererType === 'SpriteRenderer' && renderable.flip?.[1] ? -1 : 1;
            view.scale.set(renderable.scale[0] * flipX, renderable.scale[1] * flipY);
            if (!this.hierarchy?.attach(renderable.gameObject, view, true)) scene.addChild(view);
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
        for (const views of Object.values(this.gameObjectMap)) for (const view of views) view.destroy();
        this.gameObjectMap = {};
    }
}
