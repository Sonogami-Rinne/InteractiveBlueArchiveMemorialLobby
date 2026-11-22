import ViewManager from './ViewManager.js'
import prefabResources from '../assets/prefabResources.js';
const cookieName = 'ba-lobby-preferences'
const cookieLifetime = 365 * 24 * 60 * 60
export const defaultPrefab = Object.keys(prefabResources)[0];
export const defaultGraphics = Object.freeze({
    targetViewWidth: ViewManager.defaultTargetViewWidth,
    targetViewHeight: ViewManager.defaultTargetViewHeight,
})

export function validViewSize(value) {
    return Number.isSafeInteger(value) && value > 0
}

export function readLobbyPreferences() {
    let saved
    try {
        const prefix = `${cookieName}=`
        const entry = document.cookie.split(';').map(part => part.trim())
            .find(part => part.startsWith(prefix))
        if (entry) saved = JSON.parse(decodeURIComponent(entry.slice(prefix.length)))
    } catch {
        // A malformed or unavailable cookie falls back to defaults.
    }
    return {
        prefab: typeof saved?.prefab === 'string' ? saved.prefab : undefined,
        prefabIndex: Number.isSafeInteger(saved?.prefabIndex) && saved.prefabIndex >= 0
            ? saved.prefabIndex : undefined,
        volume: Number.isInteger(saved?.volume) && saved.volume >= 0 && saved.volume <= 100
            ? saved.volume : 100,
        targetViewWidth: validViewSize(saved?.targetViewWidth)
            ? saved.targetViewWidth : defaultGraphics.targetViewWidth,
        targetViewHeight: validViewSize(saved?.targetViewHeight)
            ? saved.targetViewHeight : defaultGraphics.targetViewHeight,
    }
}

export function writeLobbyPreferences(preferences) {
    try {
        const path = new URL('.', location.href).pathname
        const value = encodeURIComponent(JSON.stringify(preferences))
        document.cookie = `${cookieName}=${value}; Path=${path}; Max-Age=${cookieLifetime}; SameSite=Lax`
    } catch {
        // Preferences still apply for this session when cookies are unavailable.
    }
}
