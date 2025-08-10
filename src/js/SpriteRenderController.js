class SpriteRenderController {
    constructor(glowObjectDOM) {
        this.glowObjectDOM = glowObjectDOM
        this.spriteData = {}
        this.gameObjectMap = {}
    }

    async init() {
        let tmp = await fetch('@assets/SpriteRenderer.json')
        tmp = tmp.json()

        tmp.forEach(async (spriteData, index) => {
            if (spriteData.gameObjectName === 'Glow') {
                this.glowObjectDOM.style.width = '100%'
                this.glowObjectDOM.style.height = '100%'
                this.glowObjectDOM.style.position = 'absolute'
                this.glowObjectDOM.style.zIndex = '5'
                this.glowObjectDOM.style.opacity = '1'
                this.glowObjectDOM.style.backgroundColor = 'rgba(128, 128,128, 1)'
                this.gameObjectMap[sprite.gameObject] = {
                    target: this.glowObjectDOM,
                    ifGlow: true,
                }
            }
            else if (spriteData.gameObject >= 0) {
                PIXI.Assets.add({ alias: spriteData.sprite, src: spriteData.sprite + '.png1' })
                const texture = await PIXI.Assets.load(spriteData.sprite)
                const sprite = new PIXI.Sprite(texture);
                sprite.position.set(spriteData.translate.x, spriteData.translate.y)
                sprite.anchor.set(0.5)
                sprite.rotation = spriteData.rotation
                sprite.scale.x = spriteData.scale.x
                sprite.scale.y = spriteData.scale.y
                this.spriteData[index] = sprite
                this.gameObjectMap[spriteData.gameObject] = {
                    target: sprite,
                    ifGlow: false,
                }
            }
            else{
                console.error(`Unsupported Spriterenderer`)
            }
        });
    }

    notifyTimelineEvent(event) {
        switch (event.name) {
            case 'm_Color.a': {
                item = this.gameObjectMap[event.target]
                if (item.ifGlow) {
                    item.target.style.opacity = '' + event.value
                }
                else {
                    item.target.alpha = event.value
                }
                break
            }
            case 'm_Sprite': {
                item = this.gameObjectMap[event.target]
                item.target.texture = PIXI.Assets.get(event.value)
                break
            }
            default: {
                console.error(`Unsupported event ${event.name} for SpriteRenderer`)
            }
        }
    }
    getGameObjectId(){
        return Object.keys(this.gameObjectMap)
    }
}


export default SpriteRenderController