const UV_GROUPS = {
    single: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
    quarter: [
        [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]],
        [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]],
        [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]],
        [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]],
    ],
};

// An image's vertex-stream data is shared across all shaders and properties.
export const additionalUVImages = {
    'sakura': UV_GROUPS.quarter,
    'sakura_00': UV_GROUPS.quarter,
    'FX_TEX_Bokhe_Source_00': UV_GROUPS.quarter,
    'FX_TEX_Bokhe_Source_00_M': UV_GROUPS.quarter,
    'FX_TEX_Cloud_Dust_01': UV_GROUPS.quarter,
    'FX_TEX_Cloud_Dust_02': UV_GROUPS.quarter,
    'Leaf_01': UV_GROUPS.quarter,
    'FX_TEX_Wakamo_Lobby_Fire_04': UV_GROUPS.quarter,
    'FX_TEX_9999_PT_01': UV_GROUPS.quarter,
    'FX_TEX_9999_PT_02': UV_GROUPS.quarter,
    'FX_TEX_dust_Source_03': UV_GROUPS.quarter,

    'Spine_TEX_Star_Source_01': UV_GROUPS.single,
    'Spine_TEX_Star_Source_B': UV_GROUPS.single,
    'Spine_boke_01': UV_GROUPS.single,
    'Spine_boke_03': UV_GROUPS.single,
    'Spine_boke_04': UV_GROUPS.single,
    'FX_Star_01_F_03': UV_GROUPS.single,
    'Spine_TEX_Star_Source_s': UV_GROUPS.single,
    'FX_Bokhe_01_F_02': UV_GROUPS.single,
    'FX_Bokhe_01_F_01': UV_GROUPS.single,
    'FX_Bokhe_02_F_01': UV_GROUPS.single,
    'FX_TEX_Lobby_Dirt': UV_GROUPS.single,
    'Flare_00_Glow_02': UV_GROUPS.single,
    'Default-Particle': UV_GROUPS.single,
    'Spine_TEX_Bubble_1': UV_GROUPS.quarter,
    'Spine_TEX_Noise_1': UV_GROUPS.single,
    'FX_TEX_Circle_Glow_01': UV_GROUPS.single,
    'FX_TEX_Circle_Glow_09': UV_GROUPS.single,
    'Spine_TEX_Trail_01': UV_GROUPS.single,
    'FX_TEX_Gra_W_Line_01': UV_GROUPS.single,
    'FX_TEX_Bokhe_Source_01': UV_GROUPS.single,
    'FX_TEX_Stretch_Scroll_04': UV_GROUPS.single,
    'FX_TEX_Top_light_01': UV_GROUPS.single,
    'FX_TEX_Circle_Glow_04': UV_GROUPS.single,
    'FX_TEX_Noise_17': UV_GROUPS.single,
    'FX_TEX_Gra_L_01_clamp': UV_GROUPS.single,
    'FX_TEX_Noise_26': UV_GROUPS.single,
    'FX_TEX_Wakamo_Lobby_Fire_03': UV_GROUPS.single,
    // Fire_01's four frames are selected by UVModule (aUV). Fire_02 is
    // a continuous mask. Neither should add a second random atlas selection.
    'FX_TEX_Wakamo_Lobby_Fire_01': UV_GROUPS.single,
    'FX_TEX_Wakamo_Lobby_Fire_02': UV_GROUPS.single,
    'white': UV_GROUPS.single,
    'FX_Dirt_01_F_01': UV_GROUPS.single,
    'FX_TEX_White_01': UV_GROUPS.single,
    'FX_TEX_Rainbow_Gra_05': UV_GROUPS.single,
    'FX_TEX_Gra_W_17': UV_GROUPS.single,
    'FX_TEX_Gra_W_18': UV_GROUPS.single,
    'FX_TEX_Triangle_05': UV_GROUPS.single,
    'FX_TEX_Gra_02b': UV_GROUPS.single,
    'FX_TEX_Gra_L_03_UI': UV_GROUPS.single,
    'FX_TEX_Mask_08': UV_GROUPS.single,
    'Spine_boke_00': UV_GROUPS.single,
    'FX_Star_01_F_01': UV_GROUPS.single

};

// Each property selects one entry in its shader's attributes list.
export const additionalTexcoordConfig = {
    'DSFX/FX_SHADER_Additive_0': {
        attributes: [{ slot: 1, componentOffset: 0 }],
        properties: { _Texture: { attribute: 0 } },
    },
    'DSFX/FX_SHADER_AlphaBlend_0': {
        attributes: [{ slot: 1, componentOffset: 0 }],
        properties: { _Texture: { attribute: 0 } },
    },
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
    'DSFX/FX_SHADER_AlphaBlend_Add_Mask_0': {
        attributes: [{ slot: 1, componentOffset: 0 }, { slot: 1, componentOffset: 2 }],
        properties: {
            _Tex_Main: { attribute: 0 },
            _Tex_Mask: { attribute: 1 },
        },
    },
};

export function getAdditionalTexcoordConfig(material, configs = additionalTexcoordConfig, images = additionalUVImages, fallbackGroups) {
    const config = configs[material.shaderName];
    if (config == null) return undefined;

    const properties = [];
    for (const [name, property] of Object.entries(config.properties ?? {})) {
        const texture = material.getTextureName(name);
        const groups = texture == null ? undefined : images[texture] ?? fallbackGroups;
        if (texture != null && groups == null) {
            throw new Error(`Missing additional UV config: shader=${material.shaderName}, property=${name}, texture=${texture}`);
        }
        // The particle library accepts an array of targets; the configuration has one target per property.
        if (groups != null) properties.push({ attribute: [property.attribute], groups });
    }
    return { attributes: config.attributes, properties };
}

export function getPackedAdditionalTexcoordConfig(material) {
    // Uncatalogued images use the whole texture until their atlas layout is known.
    return getAdditionalTexcoordConfig(material, additionalTexcoordConfig, additionalUVImages, UV_GROUPS.single);
}
