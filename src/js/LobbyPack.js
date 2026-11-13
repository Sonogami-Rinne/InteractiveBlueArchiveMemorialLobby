import prefabNames from 'virtual:lobby-prefabs'

const namesByLowerCase = new Map(prefabNames.map(name => [name.toLowerCase(), name]))
const exactNames = new Set(prefabNames)
const packRoot = new URL(`${import.meta.env.BASE_URL}pack/`, document.baseURI)
const resourceEntry = /^\s*("(?:[^"\\]|\\.)*"):\s*\(\)\s*=>\s*import\(("(?:[^"\\]|\\.)*")\),?\s*$/gm

export const defaultPrefab = exactNames.has('LobbyWakamo') ? 'LobbyWakamo' : prefabNames[0]

export function resolvePrefab(name) {
    return exactNames.has(name) ? name : namesByLowerCase.get(name?.toLowerCase())
}

function packUrl(file) {
    return new URL(file.split('/').map(encodeURIComponent).join('/'), packRoot).href
}

async function fetchFile(url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Cannot load ${url} (${response.status})`)
    return response
}

function prefabFile(prefab, file) {
    return `prefab/${prefab}/${file}`
}

export async function loadPrefabConfig(prefab, file) {
    return (await fetchFile(packUrl(prefabFile(prefab, file)))).json()
}

// The exporter writes literal Vite imports. Resolve their aliases against the
// served pack so the source tables can be consumed without evaluating scripts.
async function readResourceTable(file, prefab) {
    const text = await (await fetchFile(packUrl(file))).text()
    const entries = new Map()
    for (const [, key, specifier] of text.matchAll(resourceEntry)) {
        const [, alias, relative, mode] = JSON.parse(specifier).match(/^@(assets|audio|image|mesh|shader)\/(.+)\?(raw|url)$/) ?? []
        if (!alias) throw new Error(`Invalid resource import ${specifier} in ${file}`)
        const target = alias === 'assets' ? prefabFile(prefab, relative) : `${alias}/${relative}`
        entries.set(JSON.parse(key), { url: packUrl(target), mode })
    }
    if (entries.size === 0 && !/^\s*const resourceLoader = \{\s*\};/.test(text)) {
        throw new Error(`Invalid resource table ${file}`)
    }
    return entries
}

export async function openPrefab(prefab) {
    const resources = await readResourceTable(prefabFile(prefab, 'resource.js'), prefab)
    return async name => {
        const asset = resources.get(name)
        if (!asset) throw new Error(`Missing exported resource in ${prefab}: ${name}`)
        if (asset.mode === 'url') return asset.url
        return asset.text ??= fetchFile(asset.url).then(response => response.text())
    }
}

export async function loadLobbyList() {
    const [list, icons] = await Promise.all([
        fetchFile(packUrl('list.json')).then(response => response.json()),
        readResourceTable('iconResource.js'),
    ])
    return list.map(entry => {
        const prefab = resolvePrefab(entry.prefab)
        const icon = entry.icon?.split('/').at(-1)
        return { ...entry, prefab, iconUrl: icons.get(`${icon}.png`)?.url }
    }).filter(entry => entry.prefab)
}
