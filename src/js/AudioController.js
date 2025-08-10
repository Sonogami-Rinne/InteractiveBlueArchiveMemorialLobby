const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class CAudio {
    constructor(buffer, loop, volume, duration) {
        this._source = buffer
        this._loop = loop ?? false
        this._volume = volume ?? 1.
        this._duration = duration
        this._instances = {}
        this._instanceId = 0
        this._gainNode = audioCtx.createGain()
        this._gainNode.connect(audioCtx.destination)
        this._gainNode.gain.value = this._volume
    }
    play(delay, duration) {
        this.playAtTime(audioCtx.currentTime + delay, duration)
    }
    playAtTime(time, duration) {
        const source = audioCtx.createBufferSource()
        const instanceId = this._instanceId++
        source.buffer = this._source
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
        source.start(time + delay ?? 0.)
        if (duration || this._duration) {
            source.stop(time + delay ?? 0. + (duration || this._duration))
        }
    }
    clear() {
        for (const [instanceId, instance] of Object.entries(this._instances)) {
            instance.stop()
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
        this._preparingCount = 0
        this._preLoadAudios = []
    }
    async _loadData(path, audioName, loop, volume) {
        fetch(path).
            then(res => res.arrayBuffer()).
            then(decoded => {
                this._audioMap[audioName] = new CAudio(decoded, loop, volume)
            })
    }

    registerAudios(audioName, folder, loop, volume, ifPreload) {
        const basepath = '@audio/' + folder ? folder + '/' : ''
        if (typeof (audioName) == 'string') {
            const item = this._loadData(basepath + audioName, audioName, loop, volume)
            if (ifPreload) {
                this._preLoadAudios.push(item)
            }
        }
        else {
            for (const _audioName of audioName) {
                const item = this._loadData(basepath + audioName, audioName, loop, volume)
                if (ifPreload) {
                    this._preLoadAudios.push(item)
                }
            }
        }
    }

    async prepared() {
        await Promise.all(this._preLoadAudios)
    }

    play(audioName, delay) {
        this._audioMap[audioName]?.play(delay)
    }
    playAtTime(audioName, time) {
        this._audioMap[audioName]?.playAtTime(time)
    }

    setVolume(audioName, volume) {
        this._audioMap[audioName]?.setVolume(volume)
    }

    playSoundFixTimeline(soundFixTimeline) {
        const time = audioCtx.currentTime
        for (const audio of soundFixTimeline) {
            this.play(audio.audios[0], time + audio.start)
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