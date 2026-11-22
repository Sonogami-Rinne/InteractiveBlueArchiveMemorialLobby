import textureUVConfig from '../../assets/additionalUVConfig.json' with { type: 'json' };

const UV_GROUPS = Object.freeze({
    single: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
    quarter: [
        [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]],
        [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]],
        [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]],
        [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]],
    ],
});

const additionalUVImages = Object.fromEntries(
    Object.entries(textureUVConfig).map(([texture, layout]) => [texture, UV_GROUPS[layout]]),
);

// Each property selects one entry in its shader's attributes list.
const additionalTexcoordConfig = Object.freeze({
    'DSFX/FX_SHADER_Additive_0': {
        attributes: [{ slot: 1, componentOffset: 0 }],
        properties: { _Texture: { attribute: 0 } },
    },
    'DSFX/FX_SHADER_AlphaBlend_0': {
        attributes: [{ slot: 1, componentOffset: 0 }],
        properties: { _Texture: { attribute: 0 } },
    },
    'DSFX/FX_SHADER_AlphaBlend_2_Roz': { },
    'DSFX/FX_SHADER_AlphaBlend_Add': {
        attributes: [{ slot: 1, componentOffset: 0 }],
        properties: { _Texture: { attribute: 0 } },
    },
    'DSFX/FX_SHADER_AlphaBlend_Add_Distort_0': {
        attributes: [
            { slot: 1, componentOffset: 0 },
            { slot: 1, componentOffset: 2 },
            { slot: 2, componentOffset: 0 },
        ],
        properties: {
            _Tex_Distort: { attribute: 2 },
            _Tex_Main: { attribute: 0 },
            _Tex_Mask: { attribute: 1 },
        },
    },
    'DSFX/FX_SHADER_AlphaBlend_Add_Distort_1a': {
        attributes: [
            {slot: 1, componentOffset: 0},
            {slot: 1, componentOffset: 2},
            {slot: 2, componentOffset: 0},
            {slot: 2, componentOffset: 2}
        ],
        properties: {}
    },
    'DSFX/FX_SHADER_AlphaBlend_Add_Double_Distort_1a': {
        attributes: [
            {slot: 1, componentOffset: 0},
            {slot: 1, componentOffset: 2},
            {slot: 2, componentOffset: 0},
            {slot: 2, componentOffset: 2}
        ],
        properties: {}
    },
    'DSFX/FX_SHADER_AlphaBlend_Add_Mask_0': {
        attributes: [{ slot: 1, componentOffset: 0 }, { slot: 1, componentOffset: 2 }],
        properties: {
            _Tex_Main: { attribute: 0 },
            _Tex_Mask: { attribute: 1 },
        },
    },
    'DSFX/FX_SHADER_AlphaBlend_Add_Mask_Channel_0': {
        attribute: [
            {slot: 1, componentOffset: 0},
            {slot: 1, componentOffset: 2}
        ],
        properties: {
            _Tex_Main: {attribute: 0}
        }
    },
    'DSFX/FX_SHADER_AlphaBlend_Add': {
        attributes: [{slot: 1, componentOffset: 0}],
        properties: {
            _Texture: {attribute: 0}
        }
    },
    'DSFX/FX_SHADER_AlwaysView_Add': {},
    'DSFX/FX_SHADER_Explosion_Smoke_Blur_0':{
        attributes: [
            {slot: 1, componentOffset: 0},
            {slot: 1, componentOffset: 2},
            {slot: 2, componentOffset: 0},
            {slot: 2, componentOffset: 2}
        ],
        properties: {
            _Tex_Main: {attribute: 0}
        }
    },
    'DSFX/FX_SHADER_Explosion_Smoke_Blur_Flowmap_0':{
        attributes: [
            {slot: 1, componentOffset: 0},
            {slot: 1, componentOffset: 2},
            {slot: 2, componentOffset: 0},
            {slot: 2, componentOffset: 2}
        ],
        properties: {}
    },
    'DSFX/FX_SHADER_Matcap_0': {},
    'DSFX/FX_SHADER_Step_0_MXChar': {
        attributes: [
            {slot: 1, componentOffset: 0},
            {slot: 1, componentOffset: 2},
            {slot: 2, componentOffset: 0}
        ],
        properties: {
            _Tex_Main: {attribute: 0},
            _Tex_Mask: {attribute: 2}
        }
    },
    'DSFX/FX_SHADER_Step_0': {
        attributes: [
            {slot: 1, componentOffset: 0},
            {slot: 1, componentOffset: 2},
            {slot: 2, componentOffset: 0}
        ],
        properties: {
            _Tex_Main: {attribute: 1},
            _Tex_Mask: {attribute: 2}
        }
    },
    'DSFX/FX_SHADER_Step_Distort_0': {
        attributes: [{slot: 2, componentOffset: 0}, {slot: 2, componentOffset: 2}, {slot: 1, componentOffset: 0}, {slot: 1, componentOffset: 2}],
        properties: {
            _Tex_Mask: {attribute: 1},
            _Tex_Main: {attribute: 3}
        }
    },
    'FX/FX_SHADER_Lobby_Order': {},
    'FX/FX_SHADER_WAKAMOFire_Ptcle': {},
    'FX/General Unlit VertexColor': {}    
});

function getAdditionalTexcoordShaderConfig(shaderName, configs = additionalTexcoordConfig) {
    if (!Object.hasOwn(configs, shaderName)) {
        throw new Error(`Missing additional UV shader config: shader=${shaderName}`);
    }
    return configs[shaderName];
}

export function getAdditionalTexcoordConfig(material, configs = additionalTexcoordConfig, images = additionalUVImages) {
    const config = getAdditionalTexcoordShaderConfig(material.shaderName, configs);
    if (!config.attributes?.length) return undefined;

    const properties = [];
    for (const [name, property] of Object.entries(config.properties ?? {})) {
        const texture = material.getTextureName(name);
        if (texture == null) continue;
        if (!Object.hasOwn(images, texture)) {
            throw new Error(`Missing additional UV config: shader=${material.shaderName}, property=${name}, texture=${texture}`);
        }
        // The particle library accepts an array of targets; the configuration has one target per property.
        properties.push({ attribute: [property.attribute], groups: images[texture] });
    }
    return { attributes: config.attributes, properties };
}
