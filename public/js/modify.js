// Project-specific Pixi and Spine extensions.
var dynamicResourceLoad = null
let SpineTexture = spine.SpineTexture;
let import_pixi2 = PIXI;
const __defProp = Object.defineProperty;
const __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
const __publicField = (obj, key, value) => {
    __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
    return value;
};

__publicField(SpineTexture, "textureMap", /* @__PURE__ */ new Map());

// spine-pixi-v8/src/assets/atlasLoader.ts
const spineTextureAtlasLoader1 = {
    extension: import_pixi2.ExtensionType.Asset,
    resolver: {
        test: (value) => (0, import_pixi2.checkExtension)(value, ".atlas1"),
        parse: (value) => {
            const split = value.split(".");
            return {
                resolution: parseFloat(import_pixi2.Resolver.RETINA_PREFIX?.exec(value)?.[1] ?? "1"),
                format: 'atlas1',
                src: value
            };
        }
    },
    loader: {
        extension: {
            type: import_pixi2.ExtensionType.LoadParser,
            priority: import_pixi2.LoaderParserPriority.Normal,
            name: "spineTextureAtlasLoader1"
        },
        test(url) {
            return (0, import_pixi2.checkExtension)(url, ".atlas1");
        },
        async load(nurl) {
            let url = nurl.substring(nurl.lastIndexOf("/") + 1)
            // const txt = resource[url.substring(0, url.indexOf("."))]["atlas"]
            //const raw = await import(`@atlas/${url.substring(0, url.indexOf("."))}.atlas?raw`)
            //const txt = raw;
            const raw = await dynamicResourceLoad(`${url.substring(0, url.indexOf("."))}.atlas`)
            return raw
        },
        testParse(asset, options) {
            const isExtensionRight = (0, import_pixi2.checkExtension)(options.src, ".atlas1");
            const isString = typeof asset === "string";
            return Promise.resolve(isExtensionRight && isString);
        },
        unload(atlas) {
            atlas.dispose();
        },
        async parse(asset, options, loader) {
            const metadata = options.data || {};
            const retval = new spine.TextureAtlas(asset);
            if (metadata.images instanceof import_pixi2.TextureSource || typeof metadata.images === "string") {
                const pixiTexture = metadata.images;
                metadata.images = {};
                metadata.images[retval.pages[0].name] = pixiTexture;
            }
            const textureLoadingPromises = [];
            for (const page of retval.pages) {
                const pageName = page.name;
                const material = metadata.spineMaterials?.[pageName];
                const straightAlpha = material?.properties?._StraightAlphaInput?.value ?? (page.pma ? 0 : 1);
                const providedPage = metadata?.images ? metadata.images[pageName] : void 0;
                if (providedPage instanceof import_pixi2.TextureSource) {
                    page.setTexture(spine.SpineTexture.from(providedPage));
                } else {
                    //const url = providedPage ?? import_pixi2.path.normalize([...basePath.split(import_pixi2.path.sep), pageName].join(import_pixi2.path.sep));
                    //const url = options.src.substring(0, options.src.indexOf(".")) + "/" + pageName + ".png1";
                    const url = pageName + "1";
                    const assetsToLoadIn = {
                        src: (0, import_pixi2.copySearchParams)(url, options.src),
                        data: {
                            ...metadata.imageMetadata,
                            // Decode color before scene blending. Premultiplication is
                            // performed by this page's material shader in linear space.
                            format: straightAlpha ? 'rgba8unorm-srgb' : 'rgba8unorm',
                            // In Pixi this flag also selects the blend factors. The
                            // page shader outputs PMA, so use ONE rather than SRC_ALPHA.
                            // 'premultiplied-alpha' leaves the uploaded bytes untouched;
                            // it does not premultiply the straight sRGB atlas on upload.
                            alphaMode: 'premultiplied-alpha'
                        }
                    };
                    const pixiPromise = loader.load(assetsToLoadIn).then((texture) => {
                        page.setTexture(spine.SpineTexture.from(texture.source));
                    });
                    textureLoadingPromises.push(pixiPromise);
                }
            }
            await Promise.all(textureLoadingPromises);
            return retval;
        }
    }
};
import_pixi2.extensions.add(spineTextureAtlasLoader1);

const loadResourceBuffer = async (resourceName) => {
    const resourceUrl = await dynamicResourceLoad(resourceName);
    const response = await fetch(resourceUrl);

    if (!response.ok) {
        throw new Error(`Failed to load ${resourceName}: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
};

// spine-pixi-v8/src/assets/skeletonLoader.ts
let import_pixi3 = PIXI;
const isJson = (resource) => {
    return Object.prototype.hasOwnProperty.call(resource, "bones");
}
const isBuffer = (resource) => {
    return resource instanceof Uint8Array;
}
const spineLoaderExtension = {
    extension: import_pixi3.ExtensionType.Asset,
    loader: {
        extension: {
            type: import_pixi3.ExtensionType.LoadParser,
            priority: import_pixi3.LoaderParserPriority.Normal,
            name: "spineSkeletonLoader1"
        },
        test(url) {
            return (0, import_pixi3.checkExtension)(url, ".skel1");
        },
        async load(nurl) {
            let url = nurl.substring(nurl.lastIndexOf("/") + 1)
            const buffer = await loadResourceBuffer(`${url.substring(0, url.indexOf("."))}.skel`);
            return new Uint8Array(buffer);
        },
        testParse(asset, options) {
            const isBinarySpineModel = (0, import_pixi3.checkExtension)(options.src, ".skel1") && isBuffer(asset);
            return Promise.resolve(isBinarySpineModel);
        }
    }
};
import_pixi3.extensions.add(spineLoaderExtension);


const __defProp$D = Object.defineProperty;
const __getOwnPropSymbols$D = Object.getOwnPropertySymbols;
const __hasOwnProp$D = Object.prototype.hasOwnProperty;
const __propIsEnum$D = Object.prototype.propertyIsEnumerable;
const __defNormalProp$D = (obj, key, value) => key in obj ? __defProp$D(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
const __spreadValues$D = (a, b) => {
    for (var prop in b || (b = {}))
        if (__hasOwnProp$D.call(b, prop))
            __defNormalProp$D(a, prop, b[prop]);
    if (__getOwnPropSymbols$D)
        for (var prop of __getOwnPropSymbols$D(b)) {
            if (__propIsEnum$D.call(b, prop))
                __defNormalProp$D(a, prop, b[prop]);
        }
    return a;
};

const preparedImageBitmaps = new Map();
const prepareLobbyTexture = (name, loadResource = dynamicResourceLoad) => {
    if (typeof name !== 'string' || name === 'white') return;
    if (!preparedImageBitmaps.has(name)) {
        const loading = decodeLobbyTexture(name, loadResource).catch(error => {
            preparedImageBitmaps.delete(name);
            throw error;
        });
        preparedImageBitmaps.set(name, loading);
    }
    return preparedImageBitmaps.get(name);
};

async function decodeLobbyTexture(name, loadResource) {
    const url = await loadResource(`${name}.png`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${name}.png: ${response.status} ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    const imageBlob = new Blob([buffer], { type: "image/png" });
    return createImageBitmap(imageBlob, {
        // Unity textures are sampled with v = 0 at the bottom edge.
        imageOrientation: 'flipY',
        premultiplyAlpha: 'none', colorSpaceConversion: 'none',
    });
}

async function loadImageBitmap(nurl) {
    const fileName = nurl.substring(nurl.lastIndexOf("/") + 1).split("?")[0];
    const name = decodeURIComponent(fileName.substring(0, fileName.lastIndexOf(".")));
    try {
        return await prepareLobbyTexture(name);
    } finally {
        preparedImageBitmaps.delete(name);
    }
}

const loadTextures1 = {
    name: "loadTextures1",
    extension: {
        type: import_pixi3.ExtensionType.LoadParser,
        priority: import_pixi3.LoaderParserPriority.High,
        name: "loadTextures1"
    },
    config: {
        preferWorkers: true,
        preferCreateImageBitmap: true,
        crossOrigin: "anonymous"
    },
    test(url) {
        return import_pixi3.checkExtension(url, ".png1");
    },
    async load(url, asset, loader) {
        let _a;
        let src = await loadImageBitmap(url);
        const base = new PIXI.ImageSource(__spreadValues$D({
            resource: src,
            alphaMode: "premultiply-alpha-on-upload",
            resolution: ((_a = asset.data) == null ? void 0 : _a.resolution) || 1
        }, asset.data));
        return PIXI.createTexture(base, loader, url);
    },
    unload(texture) {
        texture.destroy(true);
    }
};
import_pixi3.extensions.add(loadTextures1);


// PIXI.Assets.loader.load = newLoad;
const newGetLoadPromiseAndParser = function (url, data) {
    const result = {
        promise: null,
        parser: null
    };
    const isFake = url.endsWith("1");
    if (isFake) {

        result.promise = (async () => {
            const file = url.split("/").pop();
            const [characterName, type] = file.split(".");
            const pureType = type.replace(/1$/, "");

            // const raw = resource?.[characterName]?.[pureType];
            const raw = dynamicResourceLoad(`${characterName}.${pureType}`)
            if (!raw) throw new Error(`No resource found for ${url}`);
            let parser = null;
            for (let i = 0; i < PIXI.Assets.loader.parsers.length; i++) {
                const parserX = PIXI.Assets.loader.parsers[i];
                if (parserX.load && ((_a = parserX.test) == null ? void 0 : _a.call(parserX, url, data, PIXI.Assets.loader))) {
                    parser = parserX;
                    break;
                }
            }
            if (!parser) {
                warn(`[Assets] ${url} could not be loaded as we don't know how to parse it, ensure the correct parser has been added`);
                return null;
            }
            let asset = await parser.load(url, data, PIXI.Assets.loader);
            result.parser = parser;

            for (let i = 0; i < PIXI.Assets.loader.parsers.length; i++) {
                const parser2 = PIXI.Assets.loader.parsers[i];
                if (parser2.parse) {
                    if (parser2.parse && await ((_b = parser2.testParse) == null ? void 0 : _b.call(parser2, asset, data, PIXI.Assets.loader))) {
                        asset = await parser2.parse(asset, data, PIXI.Assets.loader) || asset;
                        result.parser = parser2;
                    }
                }
            }

            return asset;
        })();

        return result;
    }

    //正常加载路径

    result.promise = (async () => {
        var _a, _b;
        let asset = null;
        let parser = null;
        if (data.loadParser) {
            parser = PIXI.Assets.loader._parserHash[data.loadParser];
            if (!parser) {
                warn(`[Assets] specified load parser "${data.loadParser}" not found while loading ${url}`);
            }
        }
        if (!parser) {
            for (let i = 0; i < PIXI.Assets.loader.parsers.length; i++) {
                const parserX = PIXI.Assets.loader.parsers[i];
                if (parserX.load && ((_a = parserX.test) == null ? void 0 : _a.call(parserX, url, data, PIXI.Assets.loader))) {
                    parser = parserX;
                    break;
                }
            }
            if (!parser) {
                warn(`[Assets] ${url} could not be loaded as we don't know how to parse it, ensure the correct parser has been added`);
                return null;
            }
        }
        asset = await parser.load(url, data, PIXI.Assets.loader);
        result.parser = parser;
        for (let i = 0; i < PIXI.Assets.loader.parsers.length; i++) {
            const parser2 = PIXI.Assets.loader.parsers[i];
            if (parser2.parse) {
                if (parser2.parse && await ((_b = parser2.testParse) == null ? void 0 : _b.call(parser2, asset, data, PIXI.Assets.loader))) {
                    asset = await parser2.parse(asset, data, PIXI.Assets.loader) || asset;
                    result.parser = parser2;
                }
            }
        }
        return asset;
    })();
    return result;
}
PIXI.Assets.loader._getLoadPromiseAndParser = newGetLoadPromiseAndParser;



// Inserts a scene-space container into Spine draw order without attaching it to a bone.
// The container stays under the same scene parent, so its existing particle coordinates
// and timeline visibility remain unchanged.
spine.Spine.prototype.addSceneLayerBeforeSlot = function (slotRef, container) {
    if (container.parent !== this.parent) {
        throw new Error('Scene layer and Spine must share a parent container');
    }
    const slot = this.getSlotFromRef(slotRef);
    this.removeSceneLayer(container);
    this._sceneLayers ??= new Map();
    const layers = this._sceneLayers.get(slot.data.name) ?? [];
    layers.push(container);
    this._sceneLayers.set(slot.data.name, layers);
    container.includeInBuild = false;
    this.spineAttachmentsDirty = true;
    this.onViewUpdate();
};

spine.Spine.prototype.removeSceneLayer = function (container) {
    if (!this._sceneLayers) return;
    for (const [slotName, layers] of this._sceneLayers) {
        const index = layers.indexOf(container);
        if (index < 0) continue;
        layers.splice(index, 1);
        if (layers.length === 0) this._sceneLayers.delete(slotName);
        container.includeInBuild = true;
        this.spineAttachmentsDirty = true;
        this.onViewUpdate();
        return;
    }
};

// Give each atlas page its own batcher and shader program. The default programs
// keep Pixi's color calculation; a page can supply a shader factory later.
let atlasPageBatcherId = 0;
spine.Spine.prototype.setAtlasPageShaders = function (pages, shaderFactories = {}) {
    this._atlasPageBatchers = new Map();
    for (const page of pages) {
        const batcherName = `spineAtlasPage${++atlasPageBatcherId}`;
        const shaderFactory = shaderFactories[page.name];
        const programTag = `// ${batcherName}`;
        class AtlasPageBatcher extends PIXI.DefaultBatcher {
            static extension = { type: [PIXI.ExtensionType.Batcher], name: batcherName };
            constructor() {
                super();
                this.name = batcherName;
                const base = this.shader;
                const finalColorStatement = 'finalColor = outColor * vColor;';
                if (!base.glProgram.fragment.includes(finalColorStatement)) {
                    throw new Error('Unsupported Pixi batch fragment for linear Spine color');
                }
                // PMA atlas bytes need unpremultiplication before sRGB decoding.
                // Straight atlas textures use hardware sRGB decoding on sampling.
                const linearColor = page.pma ? `
                    vec3 straight = outColor.a > 0.0 ? outColor.rgb / outColor.a : vec3(0.0);
                    outColor.rgb = mix(straight / 12.92,
                        pow((max(straight, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)),
                        step(vec3(0.04045), straight)) * outColor.a;
                ` : 'outColor.rgb *= outColor.a;';
                const linearFragment = base.glProgram.fragment.replace(finalColorStatement,
                    `${linearColor}\n${finalColorStatement}`);
                this.shader = shaderFactory?.(base, this.maxTextures) ?? new PIXI.Shader({
                    glProgram: PIXI.GlProgram.from({
                        name: batcherName,
                        vertex: `${base.glProgram.vertex}\n${programTag}`,
                        fragment: `${linearFragment}\n${programTag}`,
                    }),
                    gpuProgram: PIXI.GpuProgram.from({
                        name: batcherName,
                        vertex: { ...base.gpuProgram.vertex, source: `${base.gpuProgram.vertex.source}\n${programTag}` },
                        fragment: { ...base.gpuProgram.fragment, source: `${base.gpuProgram.fragment.source}\n${programTag}` },
                    }),
                    resources: { batchSamplers: PIXI.getBatchSamplersUniformGroup(this.maxTextures) },
                });
            }
        }
        PIXI.extensions.add(AtlasPageBatcher);
        this._atlasPageBatchers.set(page.name, batcherName);
    }
    this.spineAttachmentsDirty = true;
    this.onViewUpdate();
};

// Render scene-space layers between Spine slots. Split the original draw order
// at atlas-page changes, so page shaders never reorder overlapping attachments.
const addSpineRenderable = spine.SpinePipe.prototype.addRenderable;
spine.SpinePipe.prototype.addRenderable = function (spineObject, instructionSet) {
    const layersBySlot = spineObject._sceneLayers;
    const pageBatchers = spineObject._atlasPageBatchers;
    if (!layersBySlot?.size && !pageBatchers?.size) {
        return addSpineRenderable.call(this, spineObject, instructionSet);
    }

    spineObject._validateAndTransformAttachments();
    const skeleton = spineObject.skeleton;
    const drawOrder = skeleton.drawOrder;
    const batcher = this.renderer.renderPipes.batch;
    const addToBatch = batcher.addToBatch;
    let page = null;
    let start = 0;
    const renderRange = (end) => {
        if (end === start) return;
        skeleton.drawOrder = drawOrder.slice(start, end);
        addSpineRenderable.call(this, spineObject, instructionSet);
        start = end;
    };
    batcher.addToBatch = function (element, set) {
        if (element.renderable === spineObject && pageBatchers?.has(page?.name)) {
            element.batcherName = pageBatchers.get(page.name);
        }
        return addToBatch.call(this, element, set);
    };
    try {
        for (let i = 0; i < drawOrder.length; i++) {
            const slot = drawOrder[i];
            const slotPage = slot.getAttachment()?.region?.page;
            if (slotPage && page && slotPage !== page) {
                renderRange(i);
            }
            if (slotPage) page = slotPage;
            const layers = layersBySlot?.get(slot.data.name);
            if (!layers?.length) continue;

            renderRange(i);
            for (const container of layers) {
                container.includeInBuild = true;
                try {
                    PIXI.collectAllRenderables(container, instructionSet, this.renderer);
                } finally {
                    container.includeInBuild = false;
                }
            }
            start = i;
        }
        renderRange(drawOrder.length);
    } finally {
        skeleton.drawOrder = drawOrder;
        batcher.addToBatch = addToBatch;
    }
};

// Pixi 8.9.2: let a filter effect own persistent input/swap textures.
// Ordinary effects keep the original FilterSystem implementation and texture pool.
(() => {
    const filterSystem = PIXI.FilterSystem.prototype;
    const pushFilter = filterSystem.push;
    const popFilter = filterSystem.pop;

    filterSystem.push = function (instruction) {
        const effect = instruction.filterEffect;
        const textureProvider = effect.textureProvider;
        if (!textureProvider) return pushFilter.call(this, instruction);

        const renderer = this.renderer;
        const filters = effect.filters;
        const index = this._filterStackIndex++;
        const filterData = this._filterStack[index] ??= this._getFilterData();
        if (filters.length === 0) {
            filterData.skip = true;
            return;
        }

        const bounds = filterData.bounds;
        if (instruction.renderables) {
            PIXI.getGlobalRenderableBounds(instruction.renderables, bounds);
        } else if (effect.filterArea) {
            bounds.clear();
            bounds.addRect(effect.filterArea);
            bounds.applyMatrix(instruction.container.worldTransform);
        } else {
            instruction.container.getFastGlobalBounds(true, bounds);
        }
        if (instruction.container) {
            const renderGroup = instruction.container.renderGroup || instruction.container.parentRenderGroup;
            if (renderGroup.cacheToLocalTransform) bounds.applyMatrix(renderGroup.cacheToLocalTransform);
        }

        const colorSource = renderer.renderTarget.renderTarget.colorTexture.source;
        let resolution = Infinity;
        let padding = 0;
        let antialias = true;
        let blendRequired = false;
        let enabled = false;
        let clipToViewport = true;
        for (const filter of filters) {
            resolution = Math.min(resolution, filter.resolution === 'inherit' ? colorSource._resolution : filter.resolution);
            padding += filter.padding;
            if (filter.antialias === 'off') antialias = false;
            else if (filter.antialias === 'inherit') antialias &&= colorSource.antialias;
            if (!filter.clipToViewport) clipToViewport = false;
            if (!(filter.compatibleRenderers & renderer.type)) {
                enabled = false;
                break;
            }
            if (filter.blendRequired && !(renderer.backBuffer?.useBackBuffer ?? true)) {
                PIXI.warn('Blend filter requires backBuffer on WebGL renderer to be enabled. Set `useBackBuffer: true` in the renderer options.');
                enabled = false;
                break;
            }
            enabled ||= filter.enabled;
            blendRequired ||= filter.blendRequired;
        }
        if (!enabled) {
            filterData.skip = true;
            return;
        }
        if (clipToViewport) {
            const viewport = renderer.renderTarget.rootViewPort;
            const rootResolution = renderer.renderTarget.renderTarget.resolution;
            bounds.fitBounds(0, viewport.width / rootResolution, 0, viewport.height / rootResolution);
        }
        bounds.scale(resolution).ceil().scale(1 / resolution).pad(padding | 0);
        if (!bounds.isPositive) {
            filterData.skip = true;
            return;
        }

        filterData.skip = false;
        filterData.blendRequired = blendRequired;
        filterData.container = instruction.container;
        filterData.filterEffect = effect;
        filterData.previousRenderSurface = renderer.renderTarget.renderSurface;
        filterData.inputTexture = textureProvider.getTexture(0, bounds.width, bounds.height, resolution, antialias);
        renderer.renderTarget.bind(filterData.inputTexture, true);
        renderer.globalUniforms.push({ offset: bounds });
    };

    filterSystem.pop = function () {
        const filterData = this._filterStack[this._filterStackIndex - 1];
        const textureProvider = filterData.filterEffect?.textureProvider;
        if (filterData.skip || !textureProvider) return popFilter.call(this);

        const renderer = this.renderer;
        this._filterStackIndex--;
        this._activeFilterData = filterData;
        const input = filterData.inputTexture;
        const bounds = filterData.bounds;
        renderer.renderTarget.finishRenderPass();
        let backTexture = PIXI.Texture.EMPTY;
        if (filterData.blendRequired) {
            const previousBounds = this._filterStackIndex > 0 ? this._filterStack[this._filterStackIndex - 1].bounds : null;
            const target = renderer.renderTarget.getRenderTarget(filterData.previousRenderSurface);
            backTexture = this.getBackTexture(target, bounds, previousBounds);
        }
        filterData.backTexture = backTexture;
        this._globalFilterBindGroup.setResource(input.source.style, 2);
        this._globalFilterBindGroup.setResource(backTexture.source, 3);
        renderer.globalUniforms.pop();

        const filters = filterData.filterEffect.filters;
        let flip = input;
        if (filters.length > 1) {
            let flop = textureProvider.getTexture(1, bounds.width, bounds.height, input.source._resolution, false);
            for (let i = 0; i < filters.length - 1; i++) {
                filters[i].apply(this, flip, flop, true);
                const previous = flip;
                flip = flop;
                flop = previous;
            }
        }
        filters[filters.length - 1].apply(this, flip, filterData.previousRenderSurface, false);
        if (filterData.blendRequired) PIXI.TexturePool.returnTexture(backTexture);
    };
})();

// Prepare programs on the Lobby's WebGL context and keep Pixi's normal render cache.
(() => {
    const shaderSystem = PIXI.GlShaderSystem.prototype;
    const createProgramData = shaderSystem._createProgramData;
    const contexts = new WeakMap();

    function submitProgram(gl, program) {
        const vertex = PIXI.compileShader(gl, gl.VERTEX_SHADER, program.vertex);
        const fragment = PIXI.compileShader(gl, gl.FRAGMENT_SHADER, program.fragment);
        const linked = gl.createProgram();
        gl.attachShader(linked, vertex);
        gl.attachShader(linked, fragment);
        if (program.transformFeedbackVaryings) {
            if (typeof gl.transformFeedbackVaryings === 'function') {
                gl.transformFeedbackVaryings(linked, program.transformFeedbackVaryings.names,
                    program.transformFeedbackVaryings.bufferMode === 'separate' ? gl.SEPARATE_ATTRIBS : gl.INTERLEAVED_ATTRIBS);
            } else {
                PIXI.warn('Transform feedback is not supported on this WebGL context.');
            }
        }
        gl.linkProgram(linked);
        return { linked, vertex, fragment, attributesCollected: false };
    }

    function collectAttributes(gl, program, submission) {
        const { linked, vertex, fragment } = submission;
        if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
            PIXI.logProgramError(gl, linked, vertex, fragment);
        }
        // Pixi relinks legacy shaders after assigning sorted attribute locations.
        const relinks = !/^[ \t]*#[ \t]*version[ \t]+300[ \t]+es[ \t]*$/m.test(program.vertex);
        program._attributeData = PIXI.extractAttributesFromGlProgram(linked, gl, relinks);
        submission.attributesCollected = true;
        return relinks;
    }

    shaderSystem._createProgramData = function (program) {
        const context = contexts.get(this);
        const key = program._key;
        const submission = context?.cache === this._programDataHash
            ? context.pending.get(key)?.submission
            : null;
        if (!submission) return createProgramData.call(this, program);

        const gl = context.gl;
        const { linked, vertex, fragment } = submission;
        if (!submission.attributesCollected) collectAttributes(gl, program, submission);
        program._uniformData = PIXI.getUniformData(linked, gl);
        program._uniformBlockData = PIXI.getUboData(linked, gl);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);

        const uniforms = {};
        for (const [name, data] of Object.entries(program._uniformData)) {
            uniforms[name] = {
                location: gl.getUniformLocation(linked, name),
                value: PIXI.defaultValue(data.type, data.size),
            };
        }
        const result = new PIXI.GlProgramData(linked, uniforms);
        context.cache[key] = result;
        return result;
    };

    shaderSystem.prepareProgram = function (program) {
        const key = program._key;
        const cache = this._programDataHash;
        if (cache[key]) return Promise.resolve(cache[key]);

        const gl = this._gl;
        let context = contexts.get(this);
        if (context?.cache !== cache) {
            context = { cache, gl, pending: new Map(), parallel: gl.getExtension('KHR_parallel_shader_compile') };
            contexts.set(this, context);
        }
        const existing = context.pending.get(key);
        if (existing) return existing.ready;

        const request = { submission: context.parallel ? submitProgram(gl, program) : null };
        const checkContext = () => {
            if (this._gl !== gl || this._programDataHash !== cache || gl.isContextLost()) {
                throw new Error('WebGL context changed during shader preparation');
            }
        };
        const waitForLink = async () => {
            while (!cache[key]) {
                checkContext();
                if (gl.getProgramParameter(request.submission.linked, context.parallel.COMPLETION_STATUS_KHR)) return;
                await new Promise(resolve => setTimeout(resolve, 4));
            }
        };
        context.pending.set(key, request);
        request.ready = (async () => {
            if (context.parallel) {
                await waitForLink();
                checkContext();
                if (!cache[key] && collectAttributes(gl, program, request.submission)) await waitForLink();
            } else {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            checkContext();
            return this._getProgramData(program);
        })().finally(() => {
            context.pending.delete(key);
            if (request.submission && !cache[key] && !gl.isContextLost()) {
                const { linked, vertex, fragment } = request.submission;
                gl.deleteProgram(linked);
                gl.deleteShader(vertex);
                gl.deleteShader(fragment);
            }
        });
        return request.ready;
    };
})();
