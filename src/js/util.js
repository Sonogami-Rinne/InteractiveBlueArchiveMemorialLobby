export function applyBlendInfo(gl, info, slotBlendMode) {
    if (!info) return;
    const factors = [gl.ZERO, gl.ONE, gl.DST_COLOR, gl.SRC_COLOR, gl.ONE_MINUS_DST_COLOR,
        gl.SRC_ALPHA, gl.ONE_MINUS_SRC_COLOR, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA,
        gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA];
    const operations = [gl.FUNC_ADD, gl.FUNC_SUBTRACT, gl.FUNC_REVERSE_SUBTRACT, gl.MIN, gl.MAX];
    let { srcBlend, dstBlend, srcBlendAlpha, dstBlendAlpha } = info;
    if (slotBlendMode === 1) {
        dstBlend = 1;
        srcBlendAlpha = 0;
        dstBlendAlpha = 1;
    } else if (slotBlendMode === 2) {
        srcBlend = 2;
        dstBlend = 10;
    } else if (slotBlendMode === 3) {
        srcBlend = 1;
        dstBlend = 6;
    }
    gl.blendFuncSeparate(factors[srcBlend], factors[dstBlend], factors[srcBlendAlpha], factors[dstBlendAlpha]);
    gl.blendEquationSeparate(operations[info.blendOp], operations[info.blendOpAlpha]);
    const mask = info.colMask ?? 15;
    gl.colorMask(!!(mask & 8), !!(mask & 4), !!(mask & 2), !!(mask & 1));
}

const materialComponents = { r: 0, g: 1, b: 2, a: 3, x: 0, y: 1, z: 2, w: 3 };

export function isMaterialProperty(name) {
    return name.startsWith('material') || name.startsWith('_');
}

export function setMaterialProperty(materials, property, value) {
    const name = property.replace(/^material\.?/, '');
    const component = name.match(/\.([rgbaxyzw])$/);
    const uniformName = component ? name.slice(0, -2) : name;
    const targets = (Array.isArray(materials) ? materials : [materials])
        .map(material => material.localUniform)
        .filter(localUniform => Object.hasOwn(localUniform.uniforms, uniformName));
    if (targets.length === 0) throw new Error(`Uniform ${uniformName} was not found`);
    for (const localUniform of targets) {
        const uniforms = localUniform.uniforms;
        if (component) {
            const index = materialComponents[component[1]];
            if ((uniforms[uniformName]?.length ?? 0) <= index) {
                throw new Error(`Uniform ${uniformName} does not have component ${component[1]}`);
            }
            uniforms[uniformName][index] = value;
        } else uniforms[uniformName] = value;
        localUniform.update();
    }
}



// Restore the Pixi pixel-snap switch in converted Sprites/Default programs.
// Keep this in the runtime so re-exporting shader assets preserves the fix.
export function prepareSpriteVertexShader(code) {
    if (!/\buniform\s+float\s+uRound\s*;/.test(code)) {
        code = code.replace(/\buniform\s+vec2\s+uResolution\s*;/, '$&\nuniform float uRound;');
    }
    return code.replace(/gl_Position\.xy\s*=\s*roundPixels\(gl_Position\.xy,\s*uResolution\);/g,
        'if (uRound == 1.0) { $& }');
}

// Color textures decode from sRGB before the shader multiplies them by vertex color.
// The fire shader's _MainTex is a scalar mask and must remain linear.
export function getParticleTextureFormat(shaderName, slot) {
    return slot === '_Texture' || (shaderName === 'Mobile/Particles/Additive' && slot === '_MainTex')
        ? 'rgba8unorm-srgb' : 'rgba8unorm';
}

// Unity ParticleSystemRenderer converts the final vertex RGB to the active
// linear space when m_ApplyActiveColorSpace is enabled. Alpha is coverage.
// Legacy exports omit the flag; the inspected lobby renderers enable it.
export function prepareParticleVertexShader(code, applyActiveColorSpace = true) {
    if (!applyActiveColorSpace) return code;
    const main = /\bvoid\s+main\s*\(\s*(?:void\s*)?\)\s*\{/;
    if (!main.test(code) || !/\bvarying\s+vec4\s+vColor\s*;/.test(code)) {
        throw new Error('Particle vertex shader must provide main() and vColor');
    }
    // Run after the exported vertex program, before interpolation. This also
    // covers trail vertex colors without changing simulation/gradient values.
    return code.replace(main, 'void particleMain() {') + `
void main() {
    particleMain();
    vec3 rgb = max(vColor.rgb, vec3(0.0));
    vColor.rgb = mix(rgb / 12.92,
        pow((rgb + 0.055) / 1.055, vec3(2.4)),
        step(vec3(0.04045), rgb));
}
`;
}

// OBJ and Unity FX UVs retain Unity's bottom-left origin. Convert each final sample to
// the exported PNG's top-left origin, after tiling, scrolling and distortion.
// Flipping the incoming UV instead would also reverse authored ST/CustomData.
export function prepareParticleFragmentShader(code, unityUV = false) {
    if (!unityUV) return code;
    return code.replace(/\btexture2D\s*\(/g, 'sampleUnityParticleTexture(')
        .replace(/\bvoid\s+main\s*\(/, `
vec4 sampleUnityParticleTexture(sampler2D source, vec2 uv) {
    return texture2D(source, vec2(uv.x, 1.0 - uv.y));
}
void main(`);
}

// Unity Volume parameters are blended before trackball preparation and grading.
export const postProcessingDefaults = {
    postExposure: 0, contrast: 0, saturation: 0, hueShift: 0, intensity: 0,
    colorFilter: [1, 1, 1, 1],
    lift: [1, 1, 1, 0], gamma: [1, 1, 1, 0], gain: [1, 1, 1, 0],
};

export function gammaToLinear(value) {
    if (value <= 0.04045) return value / 12.92;
    if (value < 1) return ((value + 0.055) / 1.055) ** 2.4;
    return value ** 2.2;
}

export function prepareTrackball(value, kind) {
    const scale = kind === 'lift' ? 0.15 : 0.8;
    const rgb = value.slice(0, 3).map(v => gammaToLinear(v) * scale);
    const luma = rgb[0] * 0.2126729 + rgb[1] * 0.7151522 + rgb[2] * 0.072175;
    return rgb.map(v => {
        const prepared = v - luma + (value[3] ?? 0) + (kind === 'lift' ? 0 : 1);
        return kind === 'gamma' ? 1 / Math.max(prepared, 0.001) : prepared;
    });
}

export function blendProfiles(profiles) {
    const state = Object.fromEntries(Object.entries(postProcessingDefaults).map(([key, value]) =>
        [key, Array.isArray(value) ? [...value] : value]));
    for (const profile of [...profiles].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))) {
        if (profile.enabled === false || profile.active === false) continue;
        const weight = Math.min(1, Math.max(0, profile.weight ?? 1));
        for (const key of profile.overrides ?? Object.keys(postProcessingDefaults)) {
            const target = profile[key];
            if (!(key in postProcessingDefaults) || target === undefined) continue;
            state[key] = Array.isArray(state[key])
                ? state[key].map((v, i) => v + ((target[i] ?? v) - v) * weight)
                : state[key] + (target - state[key]) * weight;
        }
    }
    return {
        ...state,
        colorFilter: state.colorFilter.slice(0, 3).map(gammaToLinear),
        lift: prepareTrackball(state.lift, 'lift'),
        gamma: prepareTrackball(state.gamma, 'gamma'),
        gain: prepareTrackball(state.gain, 'gain'),
    };
}

// MXBloomSettings captured from GraphicsManager / UIRenderPass (2026-10-29).
export const bloomSettings = Object.freeze({
    intensity: 1.7, diffusion: 7, threshold: 1, softKnee: 0,
    clamp: 65472, tint: [1, 1, 1],
});

export function getBloomPyramid(width, height, settings = bloomSettings) {
    let w = Math.max(1, Math.floor(width / 2));
    let h = Math.max(1, Math.floor(height / 2));
    const logs = Math.log2(Math.max(w, h)) + Math.min(settings.diffusion, 10) - 10;
    const whole = Math.floor(logs);
    const count = Math.max(1, Math.min(16, whole));
    const levels = [];
    for (let i = 0; i < count; i++) {
        levels.push({ width: w, height: h });
        w = Math.max(1, Math.floor(w / 2));
        h = Math.max(1, Math.floor(h / 2));
    }
    const knee = settings.threshold * settings.softKnee + 1e-5;
    return {
        levels,
        sampleScale: 0.5 + logs - whole,
        intensity: 2 ** (settings.intensity / 10) - 1,
        threshold: [settings.threshold, settings.threshold - knee, 2 * knee, 0.25 / knee],
    };
}


// A material owns its Shader/resources; only immutable program descriptions are
// shared. Source variants include runtime changes for Spine, particles and UVs.
const programsByName = new Map();

export function getShaderProgram(name, vertex, fragment) {
    let variants = programsByName.get(name);
    if (!variants) programsByName.set(name, variants = new Map());
    const key = JSON.stringify([vertex, fragment]);
    let program = variants.get(key);
    if (!program) {
        program = PIXI.GlProgram.from({ name, vertex, fragment });
        variants.set(key, program);
    }
    return program;
}

export async function warmupShaderPrograms(renderer) {
    const programs = new Set([...programsByName.values()].flatMap(variants => [...variants.values()]));
    for (const program of programs) {
        // Pixi's context-owned cache is also used by normal shader binding.
        // Preparing metadata here does not bind uniforms/textures or draw.
        renderer.shader._getProgramData(program);
        // Allow loading UI to update between synchronous program compilations.
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

export function createLobbyAudio() {
    const context = new (window.AudioContext || window.webkitAudioContext)()
    const output = context.createGain()
    output.connect(context.destination)
    return { context, output }
}