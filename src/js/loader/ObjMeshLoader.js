// UnityPy OBJ exports negate X. Restore Unity coordinates here; callers choose Y reflection.
function parseObjMesh(text, name = 'mesh') {
    const sourcePositions = [], sourceUVs = [], sourceNormals = [];
    const positions = [], uvs = [], normals = [], indices = [], submeshes = [];
    const vertices = new Map();
    let groupStart = 0;
    const fail = message => { throw new Error(`Invalid OBJ ${name}: ${message}`); };
    const closeGroup = () => {
        if (indices.length > groupStart) submeshes.push({ start: groupStart, count: indices.length - groupStart });
        groupStart = indices.length;
    };
    const resolve = (value, source) => {
        const number = Number(value);
        const index = number < 0 ? source.length + number : number - 1;
        if (!Number.isInteger(number) || number === 0 || !source[index]) fail(`invalid index ${value}`);
        return source[index];
    };
    const lines = text.split(/\r?\n/);
    // Legacy UnityPy exports can reference UVs even when the OBJ has no UV channel.
    const hasUVs = lines.some(line => /^\s*vt(?:\s|#|$)/.test(line));
    const hasNormals = lines.some(line => /^\s*vn(?:\s|#|$)/.test(line));
    for (const line of lines) {
        const [kind, ...values] = line.split('#')[0].trim().split(/\s+/);
        if (kind === 'v' || kind === 'vt' || kind === 'vn') {
            const count = kind === 'vt' ? 2 : 3;
            const numbers = values.slice(0, count).map(Number);
            if (numbers.length !== count || numbers.some(v => !Number.isFinite(v))) fail(`invalid ${kind}`);
            (kind === 'v' ? sourcePositions : kind === 'vt' ? sourceUVs : sourceNormals).push(numbers);
        } else if (kind === 'g' || kind === 'usemtl') closeGroup();
        else if (kind === 'f') {
            if (values.length < 3) fail('face needs at least three vertices');
            const face = values.map(token => {
                // Resolve before deduplicating, because negative indices are relative to the current list.
                const [positionIndex, uvIndex, normalIndex] = token.split('/');
                const position = resolve(positionIndex, sourcePositions);
                const uv = hasUVs && uvIndex ? resolve(uvIndex, sourceUVs) : [0, 0];
                const normal = hasNormals && normalIndex ? resolve(normalIndex, sourceNormals) : [0, 0, 0];
                const key = `${sourcePositions.indexOf(position)}/${sourceUVs.indexOf(uv)}/${sourceNormals.indexOf(normal)}`;
                if (!vertices.has(key)) {
                    vertices.set(key, positions.length / 3);
                    positions.push(-position[0], position[1], position[2]);
                    uvs.push(...uv);
                    normals.push(-normal[0], normal[1], normal[2]);
                }
                return vertices.get(key);
            });
            // Undo the exporter winding reversal as well as its X reflection.
            for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i + 1], face[i]);
        }
    }
    closeGroup();
    if (!indices.length) fail('no faces');
    return { positions: new Float32Array(positions), uvs: new Float32Array(uvs),
        ...(hasNormals ? { normals: new Float32Array(normals) } : {}),
        indices: positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), submeshes };
}

const caches = new WeakMap();
export function loadObjMesh(name, loadResource = dynamicResourceLoad) {
    if (!caches.has(loadResource)) caches.set(loadResource, new Map());
    const cache = caches.get(loadResource);
    if (!cache.has(name)) {
        const loading = loadResource(`${name}.obj`).then(text => parseObjMesh(text, name)).catch(error => {
            cache.delete(name);
            throw error;
        });
        cache.set(name, loading);
    }
    return cache.get(name);
}
