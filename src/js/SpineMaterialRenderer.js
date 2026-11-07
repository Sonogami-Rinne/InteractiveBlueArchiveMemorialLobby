import { applyBlendInfo } from './util.js';
import { Material, getRenderQueue, getMaterialRenderQueue, getRenderOrder } from './Material.js';

const textureName = name => name?.replace(/\.(png|jpe?g)$/i, '');
const mainTexture = material => {
    const value = material?.properties?._MainTex?.value;
    return textureName(Array.isArray(value) ? value[0] : value);
};

// Renderer materials can be in a different order from the atlas pages.
export function getSpinePageMaterials(skeleton, atlas) {
    return atlas.textures.map((pageName, pageIndex) => {
        const name = atlas.materialNames?.[pageIndex];
        let index = name == null ? -1 : (skeleton.materialNames ?? []).indexOf(name);
        if (index < 0) {
            index = (skeleton.materialInfo ?? []).findIndex(material => mainTexture(material) === textureName(pageName));
        }
        const materialInfo = skeleton.materialInfo?.[index] ?? atlas.materialInfo?.[pageIndex];
        if (!materialInfo) {
            throw new Error(`Spine material was not exported for ${skeleton.skeleton} / ${pageName}`);
        }
        return {
            pageName,
            subMeshIndex: index < 0 ? pageIndex : index,
            materialInfo,
            texInfo: skeleton.texInfo?.[index] ?? atlas.texInfo?.[pageIndex] ?? {},
            renderQueue: getMaterialRenderQueue(materialInfo, getRenderQueue(skeleton.renderQueue)),
            sortingOrder: skeleton.sortingOrder ?? 0,
            sortingLayer: skeleton.sortingLayer ?? 0,
            depth: (skeleton.translate?.[2] ?? 0) + (skeleton.subMeshPositionZ?.[index] ?? 0),
        };
    });
}

// Spine shaders consume PMA colors. Decode atlas color before multiplying its
// alpha, just as the default page shader does, while keeping the exported shader.
function prepareFragment(code, material, page) {
    if (material.shaderName !== 'Spine/Skeleton') return code;
    const straight = material.getPropertyValue('_StraightAlphaInput') ?? (page.pma ? 0 : 1);
    const convert = straight ? 'color.rgb *= color.a;' : `
        vec3 rgb = color.a > 0.0 ? color.rgb / color.a : vec3(0.0);
        color.rgb = mix(rgb / 12.92, pow((max(rgb, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)),
            step(vec3(0.04045), rgb)) * color.a;`;
    const sample = `
vec4 sampleSpineMainTex(vec2 uv) {
    vec4 color = texture2D(_MainTex, uv);
    ${convert}
    return color;
}
`;
    return code.replace(/texture2D\(\s*_MainTex\s*,/g, 'sampleSpineMainTex(')
        .replace(/void\s+main\s*\(/, `${sample}\nvoid main(`);
}

class SpineMaterialPage extends PIXI.RenderContainer {
    constructor(spineObject, page, binding, material) {
        super({
            label: `Spine material: ${page.name}`,
            addBounds: bounds => bounds.addBounds(spineObject.bounds),
        });
        this.spineObject = spineObject;
        this.page = page;
        this.material = material;
        this.zIndex = getRenderOrder(binding.renderQueue, binding.depth, binding.sortingOrder, binding.sortingLayer);
        this.state = PIXI.State.for2d();
        this.vertices = new PIXI.Buffer({
            data: new Float32Array(8), shrinkToFit: false,
            usage: PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST,
        });
        this.indices = new PIXI.Buffer({
            data: new Uint32Array(1), shrinkToFit: false,
            usage: PIXI.BufferUsage.INDEX | PIXI.BufferUsage.COPY_DST,
        });
        this.geometry = new PIXI.Geometry({
            attributes: {
                aPosition: { buffer: this.vertices, format: 'float32x2', stride: 32, offset: 0 },
                aUV: { buffer: this.vertices, format: 'float32x2', stride: 32, offset: 8 },
                aColor: { buffer: this.vertices, format: 'float32x4', stride: 32, offset: 16 },
            },
            indexBuffer: this.indices,
        });
    }

    render(renderer) {
        const owner = this.spineObject;
        // Validate the complete draw order first, including clipping attachments
        // that can start on one page and end on another.
        owner._validateAndTransformAttachments();
        const entries = [];
        let vertexCount = 0;
        let indexCount = 0;
        for (const slot of owner.skeleton.drawOrder) {
            const attachment = slot.getAttachment();
            if (attachment?.region?.page !== this.page) continue;
            const data = owner._getCachedData(slot, attachment);
            if (data.skipRender) continue;
            const geometry = data.clipped ? data.clippedData : data;
            const vertices = data.clipped ? geometry.vertexCount : geometry.vertices.length / 2;
            const indices = data.clipped ? geometry.indicesCount : geometry.indices.length;
            entries.push({ data, geometry, vertices, indices, blendMode: slot.data.blendMode });
            vertexCount += vertices;
            indexCount += indices;
        }
        if (indexCount === 0) return;
        if (this.vertices.data.length < vertexCount * 8) this.vertices.data = new Float32Array(vertexCount * 8);
        if (this.indices.data.length < indexCount) this.indices.data = new Uint32Array(indexCount);
        const vertexData = this.vertices.data;
        const indexData = this.indices.data;
        const tint = this.groupColor;
        const red = (tint & 255) / 255;
        const green = (tint >> 8 & 255) / 255;
        const blue = (tint >> 16 & 255) / 255;
        let vertexOffset = 0;
        let indexOffset = 0;
        const runs = [];
        for (const entry of entries) {
            const { data, geometry, vertices, indices, blendMode } = entry;
            const alpha = data.color.a * this.groupAlpha;
            for (let i = 0; i < vertices; i++) {
                const offset = (vertexOffset + i) * 8;
                vertexData[offset] = geometry.vertices[i * 2];
                vertexData[offset + 1] = geometry.vertices[i * 2 + 1];
                vertexData[offset + 2] = geometry.uvs[i * 2];
                vertexData[offset + 3] = geometry.uvs[i * 2 + 1];
                vertexData[offset + 4] = data.color.r * red * alpha;
                vertexData[offset + 5] = data.color.g * green * alpha;
                vertexData[offset + 6] = data.color.b * blue * alpha;
                vertexData[offset + 7] = alpha;
            }
            for (let i = 0; i < indices; i++) indexData[indexOffset + i] = geometry.indices[i] + vertexOffset;
            const lastRun = runs[runs.length - 1];
            if (lastRun?.blendMode === blendMode) lastRun.count += indices;
            else runs.push({ start: indexOffset, count: indices, blendMode });
            vertexOffset += vertices;
            indexOffset += indices;
        }
        this.vertices.update();
        this.indices.update();
        const material = this.material;
        const uniforms = material.localUniform.uniforms;
        this.worldTransform.copyTo(uniforms.uTranslationMatrix);
        uniforms.uTranslationMatrix.prepend(renderer.globalUniforms.globalUniformData.projectionMatrix);
        uniforms.uResolution = renderer.globalUniforms.globalUniformData.resolution;
        uniforms.uRound = renderer._roundPixels | this._roundPixels;
        PIXI.color32BitToUniform(this.groupColorAlpha, uniforms.uColor, 0);
        material.localUniform.update();
        renderer.shader.bind(material.shader);
        renderer.geometry.bind(this.geometry, material.shader.glProgram);
        const gl = renderer.gl;
        for (const run of runs) {
            this.state.blendMode = ['normal', 'add', 'multiply', 'screen'][run.blendMode] ?? 'normal';
            renderer.state.set(this.state);
            const restore = applyBlendInfo(gl, material.blendInfo, run.blendMode);
            try {
                gl.drawElements(gl.TRIANGLES, run.count, gl.UNSIGNED_INT, run.start * 4);
            } finally {
                restore();
            }
        }
    }

    destroy() {
        if (this.destroyed) return;
        this.geometry.destroy(true);
        this.material.shader.destroy();
        super.destroy();
    }
}

export async function applySpineMaterials(spineObject, atlas, bindings, scene) {
    const pages = [];
    // Equal queue/depth layers retain insertion order. Use MeshRenderer material
    // slots (submeshes), since atlas page order can be the reverse of draw order.
    const orderedBindings = [...bindings].sort((a, b) => (a.subMeshIndex ?? 0) - (b.subMeshIndex ?? 0));
    for (const binding of orderedBindings) {
        const page = atlas.pages.find(page => page.name === binding.pageName);
        if (!page) throw new Error(`Atlas page not found: ${binding.pageName}`);
        for (const [slot, property] of Object.entries(binding.materialInfo.properties)) {
            if (property.type !== 'Texture2D') continue;
            const name = Array.isArray(property.value) ? property.value[0] : property.value;
            if (typeof name !== 'string' || name === 'white') continue;
            const info = binding.texInfo[slot];
            if (slot === '_MainTex') {
                PIXI.Assets.cache.set(name, page.texture.texture);
            } else {
                await PIXI.Assets.load({ alias: name, src: `${info?.name ?? name}.png1`, data: {
                    format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha',
                } });
            }
        }
        // Reuse Pixi's built-in white texture. Material's special 'white' branch
        // stores a Texture instead of a source, which breaks sampler setup when
        // texInfo is present. A cache alias takes its normal TextureSource path.
        const properties = Object.fromEntries(Object.entries(binding.materialInfo.properties).map(([slot, property]) => {
            if (property.type !== 'Texture2D') return [slot, property];
            const name = Array.isArray(property.value) ? property.value[0] : property.value;
            if (name !== 'white') return [slot, property];
            PIXI.Assets.cache.set('__spineUnityWhite', PIXI.Texture.WHITE);
            return [slot, { ...property, value: '__spineUnityWhite' }];
        }));
        const material = new Material({ ...binding.materialInfo, properties }, binding.texInfo);
        const [vertex, fragment] = await Promise.all([
            dynamicResourceLoad(`${material.shaderWithVariant}.vert`),
            dynamicResourceLoad(`${material.shaderWithVariant}.frag`),
        ]);
        material.setupShader(vertex, prepareFragment(fragment, material, page));
        const view = new SpineMaterialPage(spineObject, page, binding, material);
        spineObject.addChild(view);
        const layer = new PIXI.RenderLayer();
        layer.label = view.label;
        layer.zIndex = getRenderOrder(binding.renderQueue, binding.depth, binding.sortingOrder, binding.sortingLayer);
        scene.addChild(layer);
        layer.attach(view);
        pages.push({ view, layer, material, pageName: page.name, subMeshIndex: binding.subMeshIndex });
    }
    // Keep the original skeleton, state, bounds and children. Its page views now
    // supply all drawing; the original SpinePipe must not draw the skeleton again.
    spineObject.renderPipeId = 'customRender';
    spineObject.render = () => {};
    spineObject.batched = false;
    spineObject.materialPages = pages;
    spineObject.once('destroyed', () => {
        for (const { view, layer } of pages) {
            layer.destroy();
            view.destroy();
        }
    });
    return pages;
}
