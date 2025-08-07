class AudioController {
    AudioController() {
        this.audioMap = {}
        this.preparingCount = 0
    }
    /*
    注册音频文件，以使用它们。
    */
    registerAudios(audioName, folder, loop, volume) {
        const basepath = './audio/' + folder ? folder + '/' : ''
        this.preparingCount++
        if (typeof (audioName) == 'string') {
            const newAudio = new Audio(basepath + audioName)
            newAudio.addEventListener('canplaythrough', () => this.preparingCount--)
            newAudio.addEventListener('error', () => { console.error(`Failed to load ${audioName}`); this.preparingCount-- })
            if (loop) {
                newAudio.loop = true
            }
            if (volume) {
                newAudio.volume = volume
            }
            if (folder == null) {
                newAudio.addEventListener('ended', () => {
                    this.backgroundAudioEnd()
                })
            }
            this.audioMap[audioName] = newAudio
        }
        else {
            this.preparingCount += audioName.length
            for (const _audioName of audioName) {
                const newAudio = new Audio(basepath + _audioName)
                newAudio.addEventListener('canplaythrough', () => this.preparingCount--)
                newAudio.addEventListener('error', () => { console.error(`Failed to load ${_audioName}`); this.preparingCount-- })
                if (loop) {
                    newAudio.loop = true
                }
                if (volume) {
                    newAudio.volume = volume
                }
                this.audioMap[_audioName] = newAudio
            }
        }
    }
    async prepared() {
        const time = Date.now()
        while (this.preparingCount > 0 && Date.now() - time < 3000) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }
    play(audioName, volume) {
        if (typeof (audioName) == 'string') {
            this.audioMap[audioName].play()
            if(volume){
                this.audioMap[audioName].volume = volume
            }
        }
    }
    notifyAudioEvent(event){
        switch(event.name){
            case 'pause':{
                this.audioMap[event.audioName].pause()
                break
            }
            case 'mute':{
                this.audioMap[event.audioName].volume = 0
                break
            }
            default:{
                console.warn(`Unsupported event: ${event.name} for AudioController`)
            }
        }
    }
    backgroundAudioEnd(){
        
    }

}

export default AudioController