<script setup>


import { ref, onMounted } from 'vue'

const app = new PIXI.Application();
const test1 = async () => {
    const texture = await PIXI.Assets.load('/effects/FX_TEX_Fire_09.png')

    const atlasData = {
        frames: {
            flame0: {
                frame: { x: 0, y: 0, w: 64, h: 256 },
                sourceSize: { w: 256, h: 256 },
                spriteSourceSize: { x: 0, y: 0, w: 32, h: 256 }
            },
            flame1: {
                frame: { x: 64, y: 0, w: 64, h: 256 },
                sourceSize: { w: 256, h: 256 },
                spriteSourceSize: { x: 0, y: 0, w: 32, h: 256 }
            },
            flame2: {
                frame: { x: 128, y: 0, w: 64, h: 256 },
                sourceSize: { w: 256, h: 256 },
                spriteSourceSize: { x: 0, y: 0, w: 32, h: 256 }
            },
            flame3: {
                frame: { x: 192, y: 0, w: 64, h: 256 },
                sourceSize: { w: 256, h: 256 },
                spriteSourceSize: { x: 0, y: 0, w: 32, h: 256 }
            },
        },
        meta: {
            image: '/effects/FX_TEX_Fire_09.png',
            format: 'RGBA8888',
            size: { w: 256, h: 256 },
            scale: 1
        },
        animations: {
            enemy: ['flame0', 'flame1', 'flame2', 'flame3'] //array of frames by name
        }
    }

    const spritesheet = new PIXI.Spritesheet(
        texture,
        atlasData
    );
    await spritesheet.parse();

    // spritesheet is ready to use!
    const anim = new PIXI.AnimatedSprite(spritesheet.animations.enemy);

    // set the animation speed
    anim.animationSpeed = 0.1666;
    // play the animation on a loop
    anim.play();

    anim.scale.set(2, 0.5);
    // add it to the stage to render
    app.stage.addChild(anim);
}

onMounted(async () => {
    await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        resizeTo: window,
        backgroundColor: 0x000011,
        hello: true,
    })
    document.getElementById("test1").appendChild(app.canvas);
    await PIXI.Assets.load('./effects/particle.png')
    await PIXI.Assets.load('./effects/particle1.png')
    const texture = PIXI.Texture.from('./effects/particle.png')
    const texture1 = PIXI.Texture.from('./effects/particle1.png')
    const container = new PIXI.Container()
    app.stage.addChild(container)
    app.stage.eventMode = 'static'
    const emitter = new PIXI.particles.Emitter(container, PIXI.particles.upgradeConfig(
        {
            "alpha": {
                "start": 1,
                "end": 0
            },
            "scale": {
                "start": 0.15,
                "end": 0.01,
                "minimumScaleMultiplier": 1
            },
            "color": {
                "start": "#9dcfe3",
                "end": "#50bce3"
            },
            "speed": {
                "start": 1,
                "end": 0,
                "minimumSpeedMultiplier": 1
            },
            "acceleration": {
                "x": 0,
                "y": 0
            },
            "maxSpeed": 0,
            "startRotation": {
                "min": 0,
                "max": 360
            },
            "noRotation": false,
            "rotationSpeed": {
                "min": 0,
                "max": 0
            },
            "lifetime": {
                "min": 0.05,
                "max": 0.05
            },
            "blendMode": "normal",
            "frequency": 0.001,
            "emitterLifetime": -1,
            "maxParticles": 1000,
            "pos": {
                "x": 0,
                "y": 0
            },
            "addAtBack": false,
            "spawnType": "point",
        }, [texture]))
    emitter.emit = true;

    const emitter1 = new PIXI.particles.Emitter(container, {
        lifetime: {
            min: 0.2,
            max: 0.3
        },
        frequency: 0.03,
        spawnChance: 0.7,
        particlesPerWave: 2,
        emitterLifeTime: -1,
        maxParticles: 50,
        pos: {
            x: 0,
            y: 0
        },
        addAtBack: false,
        interval: 30,
        behaviors: [
            {
                type: "alpha",
                config: {
                    alpha: {
                        list: [
                            {
                                value: 0.6,
                                time: 0
                            },
                            {
                                value: 0.1,
                                time: 1
                            }
                        ],
                    },
                }
            },
            {
                type: "scale",
                config: {
                    scale: {
                        list: [
                            {
                                value: 0.2,
                                time: 0
                            },
                            {
                                value: 0.15,
                                time: 1
                            }
                        ],
                    },
                }
            },
            {
                type: 'moveSpeed',
                config: {
                    speed: {
                        list: [
                            {
                                value: 50,
                                time: 0
                            },
                            {
                                value: 20,
                                time: 1
                            }
                        ],
                        isStepped: false
                    },
                }
            },
            {
                type: 'rotation',
                config: {
                    minStart: 0,
                    maxStart: 360,
                    minSpeed: 180,
                    maxSpeed: 270,
                    accel: 1
                }
            },
            {
                type: 'spawnShape',
                config: {
                    type: 'torus',
                    data: {
                        x: 0,
                        y: 0,
                        radius: 20
                    }
                }
            },
            {
                type: 'textureSingle',
                config: {
                    texture: texture1
                }
            }
        ]
    })

    const emitter2 = new PIXI.particles.Emitter(container,
        {
            lifetime: {
                min: 0.4,
                max: 0.4
            },
            frequency: 0.001,
            spawnChance: 1,
            particlesPerWave: 5,
            emitterLifeTime: -1,
            maxParticles: 400,
            pos: {
                x: 0,
                y: 0
            },
            addAtBack: false,
            behaviors: [
                {
                    type: "alpha",
                    config: {
                        alpha: {
                            list: [
                                {
                                    value: 1,
                                    time: 0
                                },
                                {
                                    value: 0.1,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: 'color',
                    config: {
                        color: {
                            list: [
                                {
                                    value: "#9dcfe3",
                                    time: 0
                                },
                                {
                                    value: "#50bce3",
                                    time: 1
                                }
                            ],
                        }
                    }
                },
                {
                    type: "scale",
                    config: {
                        scale: {
                            list: [
                                {
                                    value: 0.07,
                                    time: 0
                                },
                                {
                                    value: 0.01,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: 'moveSpeed',
                    config: {
                        speed: {
                            list: [
                                {
                                    value: 15,
                                    time: 0
                                },
                                {
                                    value: 1,
                                    time: 1
                                }
                            ],
                            isStepped: false
                        },
                    }
                },
                {
                    type: 'spawnBurst',
                    config: {
                        spacing: 1,
                        start: 0,
                        distance: 10
                    }
                },
                {
                    type: 'textureSingle',
                    config: {
                        texture: texture
                    }
                }
            ]
        })

    const emitter3 = new PIXI.particles.Emitter(container,
        {
            lifetime: {
                min: 0.2,
                max: 0.3
            },
            frequency: 0.1,
            spawnChance: 0.8,
            particlesPerWave: 1,
            emitterLifeTime: -1,
            maxParticles: 50,
            pos: {
                x: 0,
                y: 0
            },
            addAtBack: false,
            behaviors: [
                {
                    type: "alpha",
                    config: {
                        alpha: {
                            list: [
                                {
                                    value: 0.6,
                                    time: 0
                                },
                                {
                                    value: 0.1,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: "scale",
                    config: {
                        scale: {
                            list: [
                                {
                                    value: 0.1,
                                    time: 0
                                },
                                {
                                    value: 0.05,
                                    time: 1
                                }
                            ],
                        },
                    }
                },
                {
                    type: 'moveSpeed',
                    config: {
                        speed: {
                            list: [
                                {
                                    value: 15,
                                    time: 0
                                },
                                {
                                    value: 1,
                                    time: 1
                                }
                            ],
                            isStepped: false
                        },
                    }
                },
                {
                    type: 'rotation',
                    config: {
                        minStart: 0,
                        maxStart: 360,
                        minSpeed: 180,
                        maxSpeed: 270,
                        accel: 0
                    }
                },
                {
                    type: 'spawnBurst',
                    config: {
                        spacing: 3,
                        start: 0,
                        distance: 15
                    }
                },
                {
                    type: 'textureSingle',
                    config: {
                        texture: texture1
                    }
                }
            ]
        })
    emitter._emit = false;

    emitter1.emit = true;

    emitter.addEmitter(emitter1, {
        spawnWhenDrag: true,
        updateTrail: true
    })

    app.stage.hitArea = app.screen;

    emitter2.emit = false;
    emitter3.emit = false;


    app.ticker.add((delta) => {
        emitter.updateTrail(delta.deltaTime * 0.01, 2);
        //emitter1.update(delta * 0.016);
        emitter2.update(delta.deltaTime * 0.016);
        emitter3.update(delta.deltaTime * 0.016);
    })
    let isDragging = false;
    let isOutSide = false;

    app.stage.eventMode = "static"
    app.stage.on("pointermove", (ev) => {
        emitter.updateOwnerPos(ev.data.global.x, ev.data.global.y)
        //emitter1.updateOwnerPos(ev.data.global.x, ev.data.global.y)
    })
    app.stage.on("pointerdown", (ev) => {
        emitter2.updateOwnerPos(ev.data.global.x, ev.data.global.y)
        emitter3.updateOwnerPos(ev.data.global.x, ev.data.global.y)
        emitter2._prevPosIsValid = false;
        const rotation = Math.random() * Math.PI;
        emitter2.emits(90, null, null, rotation)
        emitter2.emits(90, null, null, rotation + Math.PI)
        emitter3.emits(45, null, null, rotation)
        emitter3.emits(45, null, null, rotation + Math.PI)
        isDragging = true;
        emitter.updateOwnerPos(ev.data.global.x, ev.data.global.y)
        emitter._prevPosIsValid = false;
        emitter._emit = true;
    })
    app.stage.on("pointerup", (ev) => {
        isDragging = false;
        emitter._emit = false;
    })
    app.stage.on("pointerupoutside", (ev) => {
        isDragging = false;
        emitter._emit = false;
    })
    app.stage.on("pointerout", (ev) => {
        isOutSide = true;
    })
    app.stage.on("pointerover", (ev) => {
        if (isOutSide) {
            emitter.updateOwnerPos(ev.data.global.x, ev.data.global.y)
            emitter._prevPosIsValid = false;
            emitter1.updateOwnerPos(ev.data.global.x, ev.data.global.y)
            emitter1._prevPosIsValid = false;
            isOutSide = false;
        }
    })
    container.interactive = false;

    //test1();
})
</script>


<template>
    <div id="test1" class="test"></div>
</template>

<style scoped>
.test {
    width: 100%;
    height: 100%;
}
</style>