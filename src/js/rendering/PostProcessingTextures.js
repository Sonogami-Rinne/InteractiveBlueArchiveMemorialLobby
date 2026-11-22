const uploadMethodId = 'unity-post-processing';

// Pixi 8.9.2 allocates ordinary empty textures as RGBA8 regardless of format.
// This uploader is used only by the textures owned by this post-processing pass.
const uploadRenderTexture = {
    upload(source, texture, gl) {
        gl.texImage2D(
            texture.target, 0, texture.internalFormat,
            source.pixelWidth, source.pixelHeight, 0,
            texture.format, texture.type, null
        );
    },
};

export default class PostProcessingTextures {
    constructor(renderer) {
        this._textures = [];
        const supportsFloat = renderer.context.webGLVersion === 2
            && renderer.context.extensions.colorBufferFloat;
        this.format = supportsFloat ? 'rgba16float' : 'rgba8unorm';
        if (!supportsFloat){
            console.warn("Float color texture is not supported in this device, fallback to unorm. There may be some render issues!")
        }
        renderer.texture._uploads[uploadMethodId] = uploadRenderTexture;
    }

    getTexture(index, width, height, resolution, antialias) {
        const pixelWidth = Math.ceil(width * resolution - 1e-6);
        const pixelHeight = Math.ceil(height * resolution - 1e-6);
        let texture = this._textures[index];
        const source = texture?.source;
        if (!source || source.pixelWidth !== pixelWidth || source.pixelHeight !== pixelHeight
            || source.resolution !== resolution || source.antialias !== antialias) {
            texture?.destroy(true);
            texture = PIXI.RenderTexture.create({
                width: pixelWidth / resolution,
                height: pixelHeight / resolution,
                resolution,
                format: this.format,
                antialias,
                autoGarbageCollect: false,
                label: `post-processing-${index}`,
            });
            texture.source.uploadMethodId = uploadMethodId;
            this._textures[index] = texture;
        }
        if (texture.frame.width !== width || texture.frame.height !== height) {
            texture.frame.width = width;
            texture.frame.height = height;
            texture.updateUvs();
        }
        return texture;
    }

    destroy() {
        for (const texture of this._textures) texture?.destroy(true);
        this._textures = [];
    }

    retain(indices) {
        for (const [index, texture] of this._textures.entries()) {
            if (texture && !indices.has(index)) {
                texture.destroy(true);
                delete this._textures[index];
            }
        }
    }
}
