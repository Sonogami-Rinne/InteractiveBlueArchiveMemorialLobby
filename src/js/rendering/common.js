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
        } 
        else uniforms[uniformName] = value;
        localUniform.update();
    }
}
export function isMaterialProperty(name) {
    return name.startsWith('material');
}
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
