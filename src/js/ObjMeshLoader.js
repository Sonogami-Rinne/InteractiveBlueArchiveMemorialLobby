// UnityPy OBJ exports negate X. Restore Unity coordinates here; callers choose Y reflection.
function parseObjMesh(text, name = 'mesh') {
    const sourcePositions = [], sourceUVs = [], positions = [], uvs = [], indices = [], submeshes = [];
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
    for (const line of text.split(/\r?\n/)) {
        const [kind, ...values] = line.split('#')[0].trim().split(/\s+/);
        if (kind === 'v' || kind === 'vt') {
            const count = kind === 'v' ? 3 : 2;
            const numbers = values.slice(0, count).map(Number);
            if (numbers.length !== count || numbers.some(v => !Number.isFinite(v))) fail(`invalid ${kind}`);
            (kind === 'v' ? sourcePositions : sourceUVs).push(numbers);
        } else if (kind === 'g' || kind === 'usemtl') closeGroup();
        else if (kind === 'f') {
            if (values.length < 3) fail('face needs at least three vertices');
            const face = values.map(token => {
                // Resolve before deduplicating, because negative indices are relative to the current list.
                const [positionIndex, uvIndex] = token.split('/');
                const position = resolve(positionIndex, sourcePositions);
                const uv = uvIndex ? resolve(uvIndex, sourceUVs) : [0, 0];
                const key = `${sourcePositions.indexOf(position)}/${uvIndex ? sourceUVs.indexOf(uv) : -1}`;
                if (!vertices.has(key)) {
                    vertices.set(key, positions.length / 3);
                    positions.push(-position[0], position[1], position[2]);
                    uvs.push(...uv);
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
        indices: positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), submeshes };
}

const cache = new Map();
export function loadObjMesh(name) {
    if (!cache.has(name)) {
        cache.set(name, (async () => {
            return parseObjMesh(await dynamicResourceLoad(`${name}.obj`), name);
        })());
    }
    return cache.get(name);
}
