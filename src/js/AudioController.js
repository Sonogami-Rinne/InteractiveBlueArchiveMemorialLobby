const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class CAudio {
    constructor(buffer, options = {}) {
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
        this._gainNode.connect(audioCtx.destination)
        this._gainNode.gain.value = this._volume
    }
    play(delay, duration) {
        this.playAtTime(audioCtx.currentTime + (delay ?? 0), duration)
    }
    playAtTime(time, duration) {
        const source = audioCtx.createBufferSource()
        const instanceId = this._instanceId++
        source.buffer = this._source
        source.loop = this._loop
        source.loopStart = this._loopStart
        if (this._loopEnd > this._loopStart) {
            source.loopEnd = this._loopEnd
        }
        source.connect(this._gainNode)
        this._instances[instanceId] = source
        source.addEventListener('ended', () => {
            source.disconnect()
            delete this._instances[instanceId]
        })
        source.addEventListener('error', () => {
            source.disconnect()
            delete this._instances[instanceId]
        })
        const startTime = time ?? audioCtx.currentTime
        if (this._transition > 0) {
            this._gainNode.gain.cancelScheduledValues(startTime)
            this._gainNode.gain.setValueAtTime(0, startTime)
            this._gainNode.gain.linearRampToValueAtTime(this._volume, startTime + this._transition)
        }
        source.start(startTime, this._offset)
        if (duration || this._duration) {
            source.stop(startTime + (duration || this._duration))
        }
    }
    clear() {
        for (const instance of Object.values(this._instances)) {
            try {
                instance.stop()
            }
            catch (error) {
                if (error.name !== 'InvalidStateError') {
                    throw error
                }
            }
            instance.disconnect()
        }
        delete this._instances
        this._instances = {}
    }
    setVolume(volume) {
        this._gainNode.gain.value = volume
    }

}
class AudioController {
    constructor() {
        this._audioMap = {}
        this._loadingMap = {}
        this._preLoadAudios = []
    }
    async _loadData(fileName, audioName, options) {
        const path = await dynamicResourceLoad(fileName)
        const response = await fetch(path)
        if (!response.ok) {
            throw new Error(`Failed to load audio ${fileName}: ${response.status} ${response.statusText}`)
        }
        const data = await response.arrayBuffer()
        const decoded = await audioCtx.decodeAudioData(data)
        const audio = new CAudio(decoded, options)
        this._audioMap[audioName] = audio
        return audio
    }

    registerAudios(audioNames, appendix = '', options = {}) {
        for (const audioName of audioNames) {
            if (Object.hasOwn(this._loadingMap, audioName)) continue
            const loading = this._loadData(`${audioName}${appendix}`, audioName, options)
            this._loadingMap[audioName] = loading
            if (options.preload) {
                this._preLoadAudios.push(loading)
            }
        }
    }

    async init() {
        await Promise.all(this._preLoadAudios)
    }

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

    play(audioName, delay, duration) {
        void this.resume()
        this._audioMap[audioName]?.play(delay, duration)
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

export default AudioController
