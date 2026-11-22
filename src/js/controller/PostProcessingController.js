import { observePreparation } from '../loader/common.js';
import PostProcessingTextures from '../rendering/PostProcessingTextures.js';
import MXPostProcessingFilter from '../rendering/MXPostProcessingFilter.js';

export default class PostProcessingController {
    constructor() {
        this._filterMap = {};
        this._profiles = [];
        this._filters = [];
        this._pixiContainer = null;
        this._textures = null;
        this._lutPreparation = observePreparation(this.loadLut());
    }

    async loadLut() {
        const response = await fetch(`${import.meta.env.BASE_URL}postprocessing/captured-lut.png`);
        if (!response.ok) throw new Error(`Cannot load captured LUT: ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob(), {
            premultiplyAlpha: 'none', colorSpaceConversion: 'none',
        });
        if (bitmap.width !== 1024 || bitmap.height !== 32) {
            bitmap.close();
            throw new Error('Captured LUT must be a 1024 x 32 strip');
        }
        return bitmap;
    }

    async init(pixiContainer, filterArea, renderer, data) {
        if (!filterArea) throw new Error("Post-processing requires a viewport filterArea");
        const bitmap = await this._lutPreparation;
        if (this._disposed) return;
        this._lut = new PIXI.Texture({ source: new PIXI.ImageSource({
            resource: bitmap, format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha',
            scaleMode: 'linear', addressMode: 'clamp-to-edge', autoGenerateMipmaps: false,
        }) });
        this._pixiContainer = pixiContainer;
        // Custom particle geometry does not contribute to Pixi container bounds.
        this._pixiContainer.filterArea = filterArea;
        this._textures = new PostProcessingTextures(renderer);
        this._pixiContainer._filterEffect.textureProvider = this._textures;
        this._initialProfiles = data.map(profile => ({ ...profile }));
        this._filter = new MXPostProcessingFilter(this._textures, this._lut);
        this._filters = [this._filter];
        this._resetProfiles();
        await Promise.all([this._filter, this._filter.grade, this._filter.prefilter,
            this._filter.downsample, this._filter.upsample]
            .map(filter => renderer.shader.prepareProgram(filter.glProgram)));
    }

    _resetProfiles() {
        this._profiles = this._initialProfiles.map(profile => ({ ...profile }));
        this._filterMap = Object.fromEntries(this._profiles.map(profile => [profile.gameObject, profile]));
        this._updateParameters();
    }

    _updateParameters() {
        this._filter.updateParameters(blendProfiles(this._profiles));
    }

    apply() {
        this._resetProfiles();
        this._pixiContainer.filters = this._filters;
    }

    clear() {
        this._pixiContainer.filters = [];
    }

    destroy() {
        this._disposed = true;
        if (!this._lut) void this._lutPreparation.then(bitmap => bitmap.close(), () => {});
        if (this._pixiContainer) {
            this.clear();
            delete this._pixiContainer._filterEffect.textureProvider;
        }
        for (const filter of this._filters) filter.destroy();
        this._textures?.destroy();
        this._lut?.source.resource.close();
        this._lut?.destroy(true);
        this._lut = null;
        this._filterMap = {};
        this._filters = [];
        this._profiles = [];
        this._initialProfiles = [];
        this._filter = null;
        this._textures = null;
        this._pixiContainer = null;
    }

    getGameObjectId() {
        return Object.keys(this._filterMap);
    }

    hasGameObject(gameObject) {
        return Object.hasOwn(this._filterMap, gameObject);
    }

    handleTimelineEvent(gameObject, eventName, value) {
        const filter = this._filterMap[gameObject];
        if (!filter) {
            throw new Error(`No post-processing profile for gameObject ${gameObject}`);
        }
        switch (eventName) {
            case 'm_IsActive':
                filter.active = Boolean(value);
                break;
            case 'm_Enabled':
                filter.enabled = Boolean(value);
                break;
            case 'weight':
                filter.weight = value;
                break;
            default:
                throw new Error(`Unsupported timeline property ${eventName} for PostProcessingController`);
        }
        this._updateParameters();
    }
}

// Unity Volume parameters are blended before trackball preparation and grading.
const postProcessingDefaults = {
    postExposure: 0, contrast: 0, saturation: 0, hueShift: 0, intensity: 0,
    colorFilter: [1, 1, 1, 1],
    lift: [1, 1, 1, 0], gamma: [1, 1, 1, 0], gain: [1, 1, 1, 0],
};

function gammaToLinear(value) {
    if (value <= 0.04045) return value / 12.92;
    if (value < 1) return ((value + 0.055) / 1.055) ** 2.4;
    return value ** 2.2;
}

function prepareTrackball(value, kind) {
    const scale = kind === 'lift' ? 0.15 : 0.8;
    const rgb = value.slice(0, 3).map(v => gammaToLinear(v) * scale);
    const luma = rgb[0] * 0.2126729 + rgb[1] * 0.7151522 + rgb[2] * 0.072175;
    return rgb.map(v => {
        const prepared = v - luma + (value[3] ?? 0) + (kind === 'lift' ? 0 : 1);
        return kind === 'gamma' ? 1 / Math.max(prepared, 0.001) : prepared;
    });
}

function blendProfiles(profiles) {
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
