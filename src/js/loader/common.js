// import prefabResources from '../../assets/prefabResources.js'
import _lobbyList from '../../assets/list.json' with { type: 'json' }

// Initialization can consume this promise later. Its rejection still reaches that caller.
export function observePreparation(promise) {
    void promise.catch(() => {});
    return promise;
}

export const lobbyList = _lobbyList;