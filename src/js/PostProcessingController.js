class UnityPostProcessingFilter extends PIXI.Filter {
    constructor(options = {}) {
        const frag = `
        precision mediump float;

        uniform sampler2D uTexture;
        uniform float postExposure;
        uniform float contrast;
        uniform float saturation;
        uniform float hueShift;
        uniform vec3 colorFilter;

        uniform vec3 lift;
        uniform vec3 gamma;
        uniform vec3 gain;

        uniform float intensity;

        varying vec2 vTextureCoord;

        mat3 hueRotationMatrix(float hue) {
            float c = cos(hue);
            float s = sin(hue);
            return mat3(
                vec3(0.213 + c*0.787 - s*0.213, 0.715 - c*0.715 - s*0.715, 0.072 - c*0.072 + s*0.928),
                vec3(0.213 - c*0.213 + s*0.143, 0.715 + c*0.285 + s*0.140, 0.072 - c*0.072 - s*0.283),
                vec3(0.213 - c*0.213 - s*0.787, 0.715 - c*0.715 + s*0.715, 0.072 + c*0.928 + s*0.072)
            );
        }

        void main(void) {
            vec2 center = vec2(0.5, 0.5);
            vec2 dir = vTextureCoord - center;
            vec2 offset = normalize(dir) * intensity * length(dir);

            vec4 texR = texture2D(uTexture, vTextureCoord + offset);
            vec4 texG = texture2D(uTexture, vTextureCoord);
            vec4 texB = texture2D(uTexture, vTextureCoord - offset);

            vec3 color = vec3(texR.r, texG.g, texB.b);

            // PostExposure
            color *= pow(2.0, postExposure);

            // Contrast
            color = (color - 0.5) * contrast + 0.5;

            // Saturation
            float luma = dot(color, vec3(0.299, 0.587, 0.114));
            color = mix(vec3(luma), color, saturation);

            // Hue Shift (degrees -> radians)
            color = hueRotationMatrix(radians(hueShift)) * color;

            // Color Filter
            color *= colorFilter;

            // LiftGammaGain
            color = color + lift;
            color = pow(color, 1.0 / gamma);
            color *= gain;

            gl_FragColor = vec4(color, 1.0);
        }
        `;

        const uniforms = {
            uTexture: PIXI.Texture.WHITE,
            postExposure: options.postExposure ?? 0.0,        // EV stops
            contrast: options.contrast ?? 1.0,        // 1 = no change
            saturation: options.saturation ?? 1.0,    // 1 = no change
            hueShift: options.hueShift ?? 0.0,        // degrees
            colorFilter: options.colorFilter ?? [1.0, 1.0, 1.0],

            lift: options.lift ?? [0.0, 0.0, 0.0],
            gamma: options.gamma ?? [1.0, 1.0, 1.0],
            gain: options.gain ?? [1.0, 1.0, 1.0],

            intensity: options.intensity ?? 0.005
        };

        super(undefined, frag, uniforms);
    }

    // === ColorAdjustments ===
    set exposure(v) { this.uniforms.exposure = v; }
    get exposure() { return this.uniforms.exposure; }

    set contrast(v) { this.uniforms.contrast = v; }
    get contrast() { return this.uniforms.contrast; }

    set saturation(v) { this.uniforms.saturation = v; }
    get saturation() { return this.uniforms.saturation; }

    set hueShift(v) { this.uniforms.hueShift = v; }
    get hueShift() { return this.uniforms.hueShift; }

    set colorFilter(v) { this.uniforms.colorFilter = v; }
    get colorFilter() { return this.uniforms.colorFilter; }

    // === LiftGammaGain ===
    set lift(v) { this.uniforms.lift = v; }
    get lift() { return this.uniforms.lift; }

    set gamma(v) { this.uniforms.gamma = v; }
    get gamma() { return this.uniforms.gamma; }

    set gain(v) { this.uniforms.gain = v; }
    get gain() { return this.uniforms.gain; }

    // === ChromaticAberration ===
    set chromaStrength(v) { this.uniforms.chromaStrength = v; }
    get chromaStrength() { return this.uniforms.chromaStrength; }
}


class PostProcessingController {
    constructor(pixiContainer) {
        this._filterMap = {}
        this._filters = null
        this._pixiContainer = pixiContainer
    }
    async init() {
        let tmp = null
        await fetch('@assets/PostProcessing.json').
            then(res => res.json()).
            then(data => tmp = data)
        for (const filter of tmp) {
            this._filterMap[filter.gameObject] = new UnityPostProcessingFilter(filter)
        }
        this._filters = Object.values(this._filterMap)
    }
    apply() {
        // pixiObject?.filters = this._filters
        this._pixiContainer.filters = this._filters
    }
    clear() {
        this._filters = []
    }
    getGameObjectId() {
        return Object.keys(this._filterMap)
    }
    notifyGameObjectEvent(event) {
        switch (event.name) {
            case 'm_IsActive': {
                const target = this._filterMap[event.target]
                index = this._filters.indexOf(target)
                if (event.value && index < 0) {
                    this._filters.push(target)
                }
                else if (!event.value && index >= 0) {
                    this._filters.splice(index)
                }
            }
        }
    }
}

export default PostProcessingController