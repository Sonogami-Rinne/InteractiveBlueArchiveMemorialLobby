import { bloomSettings, getBloomPyramid } from './util.js';

// Internal passes fill their own target, even when it is smaller than the input.
// Pixi's ordinary filter vertex shader sizes the quad from the input instead.
const fullscreenVertex = `
    in vec2 aPosition;
    out vec2 vUV;
    void main() {
        gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
        vUV = aPosition;
    }
`;
const outputVertex = `
    in vec2 aPosition;
    out vec2 vUV;
    uniform vec4 uOutputFrame;
    uniform vec4 uOutputTexture;
    void main() {
        vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
        position.x = position.x * 2.0 / uOutputTexture.x - 1.0;
        position.y = position.y * 2.0 * uOutputTexture.z / uOutputTexture.y - uOutputTexture.z;
        gl_Position = vec4(position, 0.0, 1.0);
        vUV = aPosition;
    }
`;
const header = `
    precision highp float;
    in vec2 vUV;
    out vec4 finalColor;
    uniform sampler2D uTexture;
    uniform vec2 uSourceScale;
    uniform vec2 uSourceStep;

    vec4 box4(sampler2D source, vec2 uv, vec2 d) {
        // Clamp to texel centers; no mipmaps or implicit wrap at image edges.
        vec2 halfTexel = 0.5 / vec2(textureSize(source, 0));
        return 0.25 * (
            texture(source, clamp(uv + vec2( d.x, -d.y), halfTexel, 1.0 - halfTexel)) +
            texture(source, clamp(uv + vec2(-d.x, -d.y), halfTexel, 1.0 - halfTexel)) +
            texture(source, clamp(uv + vec2(-d.x,  d.y), halfTexel, 1.0 - halfTexel)) +
            texture(source, clamp(uv + vec2( d.x,  d.y), halfTexel, 1.0 - halfTexel))
        );
    }
`;
const encodeSRGB = `
    vec3 linearToSRGB(vec3 color) {
        color = max(color, vec3(0.0));
        return mix(12.92 * color,
            1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
            step(vec3(0.0031308), color));
    }
`;
const gradeFragment = `${header}
    uniform sampler2D uLut;
    uniform float uPostExposure;
    uniform float uChromaticIntensity;

    vec3 lookupLut(vec3 color) {
        // Captured 32^3 strip: red within a tile, blue selects tile, green is Y.
        vec3 p = clamp(color, 0.0, 1.0) * 31.0;
        float slice = floor(p.b);
        vec2 uv = vec2((slice * 32.0 + p.r + 0.5) / 1024.0, (p.g + 0.5) / 32.0);
        vec3 lo = texture(uLut, uv).rgb;
        vec3 hi = texture(uLut, uv + vec2(1.0 / 32.0, 0.0)).rgb;
        return mix(lo, hi, p.b - slice);
    }
    void main() {
        vec2 p = vUV * 2.0 - 1.0;
        vec2 d = p * dot(p, p) * uChromaticIntensity;
        vec2 halfTexel = 0.5 * uSourceStep;
        vec2 limit = uSourceScale - halfTexel;
        vec3 color = vec3(
            texture(uTexture, clamp(vUV * uSourceScale, halfTexel, limit)).r,
            texture(uTexture, clamp((vUV - d / 3.0) * uSourceScale, halfTexel, limit)).g,
            texture(uTexture, clamp((vUV - d * (2.0 / 3.0)) * uSourceScale, halfTexel, limit)).b
        ) * exp2(uPostExposure);
        // Captured UberPost, user-LUT blend=0: preserve each channel's HDR range.
        // The internal LUT contains the captured grading, so don't grade twice.
        color = lookupLut(color) * max(color, vec3(1.0));
        finalColor = vec4(color, texture(uTexture, vUV * uSourceScale).a);
    }
`;
const prefilterFragment = `${header}
    uniform vec4 uThreshold;
    uniform float uClamp;
    void main() {
        vec4 color = min(box4(uTexture, vUV * uSourceScale, uSourceStep), vec4(uClamp));
        float brightness = max(color.r, max(color.g, color.b));
        float soft = clamp(brightness - uThreshold.y, 0.0, uThreshold.z);
        soft = soft * soft * uThreshold.w;
        float contribution = max(brightness - uThreshold.x, soft) / max(brightness, 1e-5);
        finalColor = color * contribution;
    }
`;
const downsampleFragment = `${header}
    void main() { finalColor = box4(uTexture, vUV * uSourceScale, uSourceStep); }
`;
const upsampleFragment = `${header}
    uniform sampler2D uLarger;
    uniform float uSampleScale;
    void main() {
        finalColor = box4(uTexture, vUV * uSourceScale, uSourceStep * uSampleScale * 0.5)
            + texture(uLarger, vUV);
    }
`;
const outputFragment = `${header}
    uniform sampler2D uBloom;
    uniform vec2 uBloomStep;
    uniform float uSampleScale;
    uniform float uBloomIntensity;
    uniform vec3 uBloomTint;
    ${encodeSRGB}
    void main() {
        vec4 base = texture(uTexture, vUV * uSourceScale);
        vec3 bloom = box4(uBloom, vUV, uBloomStep * uSampleScale * 0.5).rgb;
        // This is the only output encoding. Bloom alpha never scales its RGB.
        finalColor = vec4(linearToSRGB(base.rgb + bloom * uBloomIntensity * uBloomTint), base.a);
    }
`;

function makeOptions(name, fragment, uniforms = {}, resources = {}, vertex = fullscreenVertex) {
    return {
        glProgram: PIXI.GlProgram.from({ name,
            vertex: `#version 300 es\n${vertex}`,
            fragment: `#version 300 es\n${fragment}`,
        }),
        antialias: false,
        resolution: 'inherit',
        blendMode: 'none',
        resources: {
            ...resources,
            passUniforms: {
                uSourceScale: { value: [1, 1], type: 'vec2<f32>' },
                uSourceStep: { value: [1, 1], type: 'vec2<f32>' },
                ...uniforms,
            },
        },
    };
}

function applyPass(manager, filter, input, output, clear = true) {
    const uniforms = filter.resources.passUniforms.uniforms;
    uniforms.uSourceScale = [input.frame.width / input.source.width, input.frame.height / input.source.height];
    uniforms.uSourceStep = [1 / input.source.pixelWidth, 1 / input.source.pixelHeight];
    manager.applyFilter(filter, input, output, clear);
}

export default class MXPostProcessingFilter extends PIXI.Filter {
    constructor(textures, lut) {
        super(makeOptions('mx-bloom-output', outputFragment, {
            uBloomStep: { value: [1, 1], type: 'vec2<f32>' },
            uSampleScale: { value: 1, type: 'f32' },
            uBloomIntensity: { value: 0, type: 'f32' },
            uBloomTint: { value: [...bloomSettings.tint], type: 'vec3<f32>' },
        }, { uBloom: PIXI.Texture.EMPTY.source }, outputVertex));
        this.textures = textures;
        this.grade = new PIXI.Filter(makeOptions('mx-captured-lut', gradeFragment, {
            uPostExposure: { value: 0, type: 'f32' },
            uChromaticIntensity: { value: 0, type: 'f32' },
        }, { uLut: lut.source }));
        this.prefilter = new PIXI.Filter(makeOptions('mx-bloom-prefilter', prefilterFragment, {
            uThreshold: { value: [1, 0.99999, 0.00002, 25000], type: 'vec4<f32>' },
            uClamp: { value: 65504, type: 'f32' },
        }));
        this.downsample = new PIXI.Filter(makeOptions('mx-bloom-downsample', downsampleFragment));
        this.upsample = new PIXI.Filter(makeOptions('mx-bloom-upsample', upsampleFragment, {
            uSampleScale: { value: 1, type: 'f32' },
        }, { uLarger: PIXI.Texture.EMPTY.source }));
    }

    updateParameters(state) {
        const uniforms = this.grade.resources.passUniforms.uniforms;
        uniforms.uPostExposure = state.postExposure;
        // URP's Volume intensity is scaled before being sent to UberPost.
        uniforms.uChromaticIntensity = state.intensity * 0.05;
    }

    apply(manager, input, output, clear) {
        // Release sampler references before a resize can destroy their sources.
        // A one-level pyramid never executes the upsample pass to replace them.
        this.resources.uBloom = PIXI.Texture.EMPTY.source;
        this.upsample.resources.uLarger = PIXI.Texture.EMPTY.source;
        const width = input.source.pixelWidth;
        const height = input.source.pixelHeight;
        const pyramid = getBloomPyramid(width, height);
        const getTarget = (index, w, h) => this.textures.getTexture(index, w, h, 1, false);
        // Slots 0/1 belong to the stage filter provider. These targets use pixels.
        // Keep the scene's logical frame for the final Pixi output quad at DPR > 1.
        const graded = this.textures.getTexture(2, input.frame.width, input.frame.height,
            input.source.resolution, false);
        applyPass(manager, this.grade, input, graded);
        this.prefilter.resources.passUniforms.uniforms.uThreshold = pyramid.threshold;
        this.upsample.resources.passUniforms.uniforms.uSampleScale = pyramid.sampleScale;
        const levels = [];
        let source = graded;
        for (const [i, size] of pyramid.levels.entries()) {
            const target = getTarget(3 + i, size.width, size.height);
            applyPass(manager, i === 0 ? this.prefilter : this.downsample, source, target);
            levels.push(target);
            source = target;
        }
        for (let i = levels.length - 2; i >= 0; i--) {
            const size = pyramid.levels[i];
            const target = getTarget(19 + i, size.width, size.height);
            this.upsample.resources.uLarger = levels[i].source;
            applyPass(manager, this.upsample, source, target);
            source = target;
        }
        this.resources.uBloom = source.source;
        const uniforms = this.resources.passUniforms.uniforms;
        uniforms.uBloomStep = [1 / source.source.pixelWidth, 1 / source.source.pixelHeight];
        uniforms.uSampleScale = pyramid.sampleScale;
        uniforms.uBloomIntensity = pyramid.intensity;
        // Release levels made obsolete by a resize (e.g. 4K -> 1080p).
        this.textures.retain(new Set([0, 1, 2,
            ...levels.map((_, i) => 3 + i),
            ...levels.slice(1).map((_, i) => 19 + i),
        ]));
        applyPass(manager, this, graded, output, clear);
    }

    destroy() {
        for (const filter of [this.grade, this.prefilter, this.downsample, this.upsample]) filter.destroy();
        super.destroy();
    }
}
