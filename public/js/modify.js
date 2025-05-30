var fun = null
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
                format: split[split.length - 2],
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
            const raw = await fun(`${url.substring(0, url.indexOf("."))}.atlas`)
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
                            alphaMode: page.pma ? "premultiplied-alpha" : "premultiply-alpha-on-upload"
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
            // const base64 = resource[url.substring(0, url.indexOf("."))]["skel"]
            //const rawdata = await import(`@base64/${url.substring(0, url.indexOf("."))}.base64?raw`)
            const data = await fun(`${url.substring(0, url.indexOf("."))}.skel`)
            const buffer = Uint8Array.from(data, c => c.charCodeAt(0))
            return buffer;
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

const loadImageBitmap = async (nurl, asset) => {
    let url = nurl.substring(nurl.lastIndexOf("/") + 1)
    let _a;
    const tmp = url.substring(0, url.indexOf("."))
    const data = await fun(`${tmp}.png`)
    const buffer = Uint8Array.from(data, c => c.charCodeAt(0))
    const imageBlob = new Blob([buffer], { type: "image/png" });
    return ((_a = asset == null ? void 0 : asset.data) == null ? void 0 : _a.alphaMode) === "premultiplied-alpha" ? createImageBitmap(imageBlob, { premultiplyAlpha: "none" }) : createImageBitmap(imageBlob);
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
        let src = await loadImageBitmap(url, asset);
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
            const raw = fun(`${characterName}.${pureType}`)
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