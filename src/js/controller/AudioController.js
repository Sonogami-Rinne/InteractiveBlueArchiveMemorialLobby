const { context: audioCtx, output } = window.frameElement?.lobbyAudio ?? createLobbyAudio()

class CAudio {
    constructor(buffer, options = {}, destination = output) {
        this._destination = destination
        this._source = buffer
        this._loop = options.loop ?? false
        this._volume = options.volume ?? 1.
        this._duration = options.duration
        this._loopStart = options.loopStart ?? 0
        this._loopEnd = options.loopEnd ?? 0
        this._offset = options.offset ?? 0
        this._transition = options.transition ?? 0
        this._instances = {}
        this._instanceId = 0
        this._gainNode = audioCtx.createGain()
        this._gainNode.connect(this._destination)
        this._gainNode.gain.value = this._volume
    }
    play(delay, duration, volume) {
        this.playAtTime(audioCtx.currentTime + (delay ?? 0), duration, volume)
    }
    playAtTime(time, duration, volume) {
        const source = audioCtx.createBufferSource()
        const instanceId = this._instanceId++
        source.buffer = this._source
        source.loop = this._loop
        source.loopStart = this._loopStart
        if (this._loopEnd > this._loopStart) {
            source.loopEnd = this._loopEnd
        }
        const gainNode = volume === undefined ? this._gainNode : audioCtx.createGain()
        if (gainNode !== this._gainNode) {
            gainNode.gain.value = volume
            gainNode.connect(this._destination)
        }
        source.connect(gainNode)
        const disconnect = () => {
            source.disconnect()
            if (gainNode !== this._gainNode) gainNode.disconnect()
            delete this._instances[instanceId]
        }
        this._instances[instanceId] = { source, disconnect }
        source.addEventListener('ended', disconnect)
        source.addEventListener('error', disconnect)
        const startTime = time ?? audioCtx.currentTime
        if (this._transition > 0) {
            gainNode.gain.cancelScheduledValues(startTime)
            gainNode.gain.setValueAtTime(0, startTime)
            gainNode.gain.linearRampToValueAtTime(volume ?? this._volume, startTime + this._transition)
        }
        source.start(startTime, this._offset)
        if (duration || this._duration) {
            source.stop(startTime + (duration || this._duration))
        }
    }
    clear() {
        for (const { source, disconnect } of Object.values(this._instances)) {
            try {
                source.stop()
            }
            catch (error) {
                if (error.name !== 'InvalidStateError') {
                    throw error
                }
            }
            disconnect()
        }
        delete this._instances
        this._instances = {}
    }
    destroy() {
        this.clear()
        this._gainNode.disconnect()
    }
    setVolume(volume) {
        this._gainNode.gain.value = volume
    }

}
export class AudioController {
    constructor(loadResource = name => dynamicResourceLoad(name)) {
        this.loadResource = loadResource
        this._audioMap = {}
        this._loadingMap = {}
        this._preLoadAudios = new Set()
        this._mixerBuses = new Map()
    }
    _getMixerBus(group) {
        let bus = this._mixerBuses.get(group)
        if (!bus) {
            const node = audioCtx.createGain()
            node.connect(output)
            bus = { node, fromDb: 0, toDb: 0, start: 0, end: 0 }
            this._mixerBuses.set(group, bus)
        }
        return bus.node
    }

    applyMixerSnapshot(groups, volumes, transition = 0) {
        const time = audioCtx.currentTime
        for (const [group, bus] of this._mixerBuses) {
            let targetDb = 0
            for (let name = group; name != null; name = groups[name]) {
                targetDb += volumes[name] ?? 0
            }
            const { gain } = bus.node
            gain.cancelScheduledValues(time)
            if (transition > 0) {
                const currentDb = time >= bus.end ? bus.toDb
                    : bus.fromDb + (bus.toDb - bus.fromDb) * (time - bus.start) / (bus.end - bus.start)
                gain.setValueAtTime(10 ** (currentDb / 20), time)
                gain.exponentialRampToValueAtTime(10 ** (targetDb / 20), time + transition)
                bus.fromDb = currentDb
            }
            else {
                gain.setValueAtTime(10 ** (targetDb / 20), time)
                bus.fromDb = targetDb
            }
            bus.toDb = targetDb
            bus.start = time
            bus.end = time + transition
        }
    }

    async _loadData(fileName, audioName, options, destination) {
        const path = await this.loadResource(fileName)
        const response = await fetch(path)
        if (!response.ok) {
            throw new Error(`Failed to load audio ${fileName}: ${response.status} ${response.statusText}`)
        }
        const data = await response.arrayBuffer()
        const decoded = await audioCtx.decodeAudioData(data)
        if (this._disposed) return
        const audio = new CAudio(decoded, options, destination)
        this._audioMap[audioName] = audio
        return audio
    }

    registerAudios(audioNames, appendix = '', options = {}) {
        if (this._disposed) return;
        const destination = options.mixerGroup ? this._getMixerBus(options.mixerGroup) : output
        for (const audioName of audioNames) {
            if (!Object.hasOwn(this._loadingMap, audioName)) {
                const loading = this._loadData(`${audioName}${appendix}`, audioName, options, destination)
                this._loadingMap[audioName] = loading
                void loading.catch(error => {
                    if (!this._disposed) console.warn(`Could not prepare audio ${audioName}`, error)
                })
            }
            if (options.preload) this.requireAudios([audioName])
        }
    }

    pendingAudios(names) {
        return names.flatMap(name => this._audioMap[name] || !this._loadingMap[name] ? [] : [this._loadingMap[name]])
    }

    requireAudios(names) {
        for (const loading of this.pendingAudios(names)) this._preLoadAudios.add(loading)
    }

    get disposed() {
        return this._disposed
    }

    destroy() {
        this._disposed = true
        for (const audio of Object.values(this._audioMap)) audio.destroy()
        for (const { node } of this._mixerBuses.values()) node.disconnect()
        this._mixerBuses.clear()
        this._audioMap = {}
    }

    async init() {
        await Promise.all(this._preLoadAudios)
    }
    /**
     * 
     *  如果浏览器的自动播放策略阻止了音频的自动播放，那么就暂停整个进程，保证音乐和画面同步
     */
    async waitForPlaybackPermission() {
        if (audioCtx.state === 'running') {
            return
        }
        if (audioCtx.state === 'closed') {
            throw new Error('AudioContext is closed')
        }

        await Promise.race([
            audioCtx.resume().catch(() => undefined),
            new Promise(resolve => setTimeout(resolve, 100)),
        ])
        if (audioCtx.state === 'running') {
            return
        }

        await new Promise(resolve => {
            let isResuming = false
            const eventOptions = { capture: true }
            const cleanup = () => {
                window.removeEventListener('pointerdown', unlock, eventOptions)
                window.removeEventListener('keydown', unlock, eventOptions)
                audioCtx.removeEventListener('statechange', handleStateChange)
            }
            const finishIfRunning = () => {
                if (audioCtx.state !== 'running') {
                    return false
                }
                cleanup()
                resolve()
                return true
            }
            const handleStateChange = () => {
                finishIfRunning()
            }
            const unlock = async () => {
                if (isResuming || finishIfRunning()) {
                    return
                }
                isResuming = true
                try {
                    await audioCtx.resume()
                }
                catch (error) {
                    console.debug('AudioContext could not be resumed', error)
                }
                finally {
                    isResuming = false
                }
                finishIfRunning()
            }

            audioCtx.addEventListener('statechange', handleStateChange)
            window.addEventListener('pointerdown', unlock, eventOptions)
            window.addEventListener('keydown', unlock, eventOptions)
            finishIfRunning()
        })
    }

    async resume() {
        if (audioCtx.state === 'suspended') {
            try {
                await audioCtx.resume()
            }
            catch (error) {
                console.debug('AudioContext will resume after a user gesture', error)
            }
        }
    }

    play(audioName, delay, duration, volume) {
        void this.resume()
        this._audioMap[audioName]?.play(delay, duration, volume)
    }
    playAtTime(audioName, time) {
        this._audioMap[audioName]?.playAtTime(time)
    }

    stop(audioName) {
        this._audioMap[audioName]?.clear()
    }

    setVolume(audioName, volume) {
        this._audioMap[audioName]?.setVolume(volume)
    }

    playSoundFixTimeline(soundFixTimeline) {
        const time = audioCtx.currentTime
        for (const audio of soundFixTimeline) {
            this.playAtTime(audio.audios[0], time + audio.start)
        }
    }

    notifyAudioEvent(event) {
        switch (event.name) {
            case 'volume': {
                this._audioMap[event.target].setVolume(event.value)
            }
            default: {
                console.warn(`Unsupported event: ${event.name} for AudioController`)
            }
        }
    }
    backgroundAudioEnd() {

    }

}

export function createLobbyAudio() {
    const context = new (window.AudioContext || window.webkitAudioContext)()
    const output = context.createGain()
    output.connect(context.destination)
    return { context, output }
}