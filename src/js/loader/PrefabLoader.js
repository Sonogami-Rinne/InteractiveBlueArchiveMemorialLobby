import { lobbyList } from './common.js';
import prefabResources from '../../assets/prefabResources.js';

export function resolvePrefab(name) {
    const key = name?.toLowerCase()
    return Object.hasOwn(prefabResources, key) ? key : undefined
}

export async function openPrefab(prefab) {
    const key = resolvePrefab(prefab)
    if (!key) throw new Error(`Unknown prefab: ${prefab}`)
    const { default: resources } = await prefabResources[key]()
    const pending = new Map()
    const load = async name => {
        const loadResource = resources[name]
        if (!Object.hasOwn(resources, name)) throw new Error(`Missing exported resource in ${prefab}: ${name}`)
        if (!pending.has(name)) {
            pending.set(name, loadResource().then(module => module.default).catch(error => {
                pending.delete(name)
                throw error
            }))
        }
        return pending.get(name)
    }
    load.names = Object.keys(resources)
    return load
}

export async function loadPrefabConfig(resources, name) {
    const url = await resources(`${name}.json`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Cannot load prefab config ${name} (${response.status})`)
    return response.json()
}

export async function loadLobbyList() {
    const { default: icons } = await import('../../assets/iconResource.js')
    // const lobbies = lobbyList.filter(({ prefab }) => Object.hasOwn(prefabResources, prefab))
    const lobbies = lobbyList;

    return Promise.all(lobbies.map(async entry => {
        const image = entry.icon ? await icons[`${entry.icon}.png`]?.() : undefined
        return { ...entry, iconUrl: image?.default }
    }))
}
