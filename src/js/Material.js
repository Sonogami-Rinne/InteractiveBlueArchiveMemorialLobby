const WrapModeMap = {
    0: "repeat",
    1: "clamp-to-edge",
    2: "mirror-repeat",
    3: 'mirror-repeat'
};
export class Material {
    shaderName;
    shaderWithVariant;
    blendInfo;
    properties;
    shader; // PIXI.Shader
    textureSources; // TextureSource
    textureNames;
    localUniform;
    constructor(matInfo, texInfo) {
        this.shaderName = matInfo.shader;
        this.shaderWithVariant = matInfo.shaderWithVariant;
        this.blendInfo = matInfo.blendInfo ?? null;
        this.properties = {};
        this.textureSources = {};
        this.textureNames = {};
        const properties = matInfo.properties;
        for (const [k, v] of Object.entries(properties)) {
            if (v.type == 'Float') {
                this.properties[k] = { value: v.value, type: 'f32' };
            }
            else if (v.type == 'Color' || v.type == 'Vector') {
                this.properties[k] = { value: new Float32Array(v.value), type: 'vec4<f32>' };
            }
            else if (v.type == 'Texture2D') {
                const textureName = Array.isArray(v.value) ? v.value[0] : v.value;
                if (typeof textureName !== 'string')
                    continue;
                this.textureNames[k] = textureName;
                if (textureName == 'white')
                    this.textureSources[k] = PIXI.Texture.WHITE.source;
                else
                    this.textureSources[k] = PIXI.Texture.from(textureName).source;
            }
        }
        for (const [k, v] of Object.entries(texInfo)) {
            this.properties[k + '_ST'] = { value: new Float32Array([v.scalar.x, v.scalar.y, v.offset.x, v.offset.y]), type: 'vec4<f32>' };
            const style = this.textureSources[k].style;
            const samplerInfo = v.sampler;
            style.maxAnisotropy = samplerInfo.aniso;
            style.addressModeU = WrapModeMap[samplerInfo.wrapU];
            style.addressModeV = WrapModeMap[samplerInfo.wrapV];
            style.addressModeW = WrapModeMap[samplerInfo.wrapW];
        }
        this.properties['uTranslationMatrix'] = { value: new PIXI.Matrix(), type: "mat3x3<f32>" };
        this.properties['uColor'] = { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" };
        this.properties['uRound'] = { value: 1, type: "f32" };
        this.properties['uResolution'] = { value: [0, 0], type: "vec2<f32>" };
        this.properties['_Time'] = { value: new Float32Array(4), type: 'vec4<f32>' };
        this.localUniform = new PIXI.UniformGroup(this.properties);
    }
    setTime(seconds) {
        // Unity's shader clock is shared scene time, independent of particle age.
        this.localUniform.uniforms._Time.set([seconds / 20, seconds, seconds * 2, seconds * 3]);
        this.localUniform.update();
    }
    getPropertyValue(name) {
        return this.properties[name]?.value;
    }
    getTextureName(name) {
        return this.textureNames[name];
    }
    setupShader(glVertCode, glFragCode) {
        const resources = {
            uniforms: this.localUniform
        };
        Object.assign(resources, this.textureSources);
        this.shader = new PIXI.Shader({
            glProgram: new PIXI.GlProgram({
                vertex: glVertCode,
                fragment: glFragCode
            }),
            resources: resources
        });
    }
}

export function getRenderQueue(queue, fallback = 3000) {
    return Number.isFinite(queue) && queue >= 0 ? queue : fallback;
}

export function getMaterialRenderQueue(material, fallback) {
    return getRenderQueue(material.renderQueue,
        getRenderQueue(material.shaderRenderQueue ?? material.shaderInfo?.renderQueue, fallback));
}

// The exporter provides the numeric layer order, not a SortingLayer ID.
// Layer precedes signed 16-bit Order in Layer, then queue (0..5000) and depth.
// Keep layer/order zero compatible with the existing queue/depth keys.
export function getRenderOrder(queue, z = 0, sortingOrder = 0, sortingLayer = 0, sortingFudge = 0) {
    const order = Number.isFinite(sortingOrder) ? sortingOrder : 0;
    const layer = Number.isFinite(sortingLayer) ? sortingLayer : 0;
    const depth = Number.isFinite(z) ? z : 0;
    const fudge = Number.isFinite(sortingFudge) ? sortingFudge : 0;
    // Lower Sorting Fudge draws the whole particle system in front at equal queue/order.
    return layer * 1000000000 + order * 10000 + queue - Math.atan(depth + fudge) / Math.PI;
}
