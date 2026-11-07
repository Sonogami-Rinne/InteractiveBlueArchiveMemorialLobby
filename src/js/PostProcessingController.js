import { blendProfiles } from './util.js';
import PostProcessingTextures from './PostProcessingTextures.js';
import MXPostProcessingFilter from './MXPostProcessingFilter.js';

class PostProcessingController {
    constructor() {
        this._filterMap = {};
        this._profiles = [];
        this._filters = [];
        this._pixiContainer = null;
        this._textures = null;
    }

    async init(pixiContainer, filterArea, renderer) {
        if (!filterArea) throw new Error("Post-processing requires a viewport filterArea");
        const response = await fetch(`${import.meta.env.BASE_URL}postprocessing/captured-lut.png`);
        if (!response.ok) throw new Error(`Cannot load captured LUT: ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob(), {
            premultiplyAlpha: 'none', colorSpaceConversion: 'none',
        });
        if (bitmap.width !== 1024 || bitmap.height !== 32) {
            bitmap.close();
            throw new Error('Captured LUT must be a 1024 x 32 strip');
        }
        this._lut = new PIXI.Texture({ source: new PIXI.ImageSource({
            resource: bitmap, format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha',
            scaleMode: 'linear', addressMode: 'clamp-to-edge', autoGenerateMipmaps: false,
        }) });
        this._pixiContainer = pixiContainer;
        // Custom particle geometry does not contribute to Pixi container bounds.
        this._pixiContainer.filterArea = filterArea;
        this._textures = new PostProcessingTextures(renderer);
        this._pixiContainer._filterEffect.textureProvider = this._textures;
        const { default: data } = await import('@assets/PostProcessing.json');
        this._initialProfiles = data.map(profile => ({ ...profile }));
        this._filter = new MXPostProcessingFilter(this._textures, this._lut);
        this._filters = [this._filter];
        this._resetProfiles();
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

export default PostProcessingController;
