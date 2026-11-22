

export function createLobbyAudio() {
    const context = new (window.AudioContext || window.webkitAudioContext)()
    const output = context.createGain()
    output.connect(context.destination)
    return { context, output }
}


