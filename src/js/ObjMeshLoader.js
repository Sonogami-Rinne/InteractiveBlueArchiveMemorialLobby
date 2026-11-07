import { parseObjMesh } from './ObjMesh.js';

const meshFiles = import.meta.glob('../assets/mesh/*.obj', { query: '?raw', import: 'default' });
const cache = new Map();
export function loadObjMesh(name) {
    if (!cache.has(name)) {
        cache.set(name, (async () => {
            const load = meshFiles[`../assets/mesh/${name}.obj`];
            if (!load) throw new Error(`Missing exported mesh: ${name}.obj`);
            return parseObjMesh(await load(), name);
        })());
    }
    return cache.get(name);
}
