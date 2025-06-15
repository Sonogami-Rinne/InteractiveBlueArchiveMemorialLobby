export class MouseParticle {
    constructor(container) {
        this.container = container;
        container.interactive = false;
        this._trailEmitter = null;
        this._trailAccessoryEmitter = null;
        this._clickEmitter = null;
        this._clickAccessoryEmitter = null;
        this._isDragging = false;
        this._isOutSide = false;
        this.textures = ['./effects/particle.png', './effects/particle1.png'];
        this.trailEffect = true;
        this.clickEffect = true;
        this.ready = false;
    }
    async init() {
        this.container.zIndex = 200
        await Promise.all(this.textures.map(texture => PIXI.Assets.load(texture)))
        for (let i = 0; i < this.textures.length; ++i) {
            this.textures[i] = PIXI.Texture.from(this.textures[i]);
        }

        this._trailEmitter = new PIXI.particles.Emitter(this.container, {
            lifetime: {
                min: 0.05,
                max: 0.05
            },
            frequency: 0.001,
            spawnChance: 1,
            emitterLifeTime: -1,
            maxParticles: 1500,
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
                                    value: 0,
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
                                    value: 0.1,
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
                    type: 'spawnPoint',
                    config: {}
                },
                {
                    type: 'textureSingle',
                    config: {
                        texture: this.textures[0]
                    }
                }
            ]
        })
        this._trailAccessoryEmitter = new PIXI.particles.Emitter(this.container, {
            lifetime: {
                min: 0.15,
                max: 0.2
            },
            frequency: 0.03,
            spawnChance: 0.7,
            particlesPerWave: 1,
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
                        texture: this.textures[1]
                    }
                }
            ]
        })
        this._clickEmitter = new PIXI.particles.Emitter(this.container,
            {
                lifetime: {
                    min: 0.4,
                    max: 0.4
                },
                frequency: 0.001,
                spawnChance: 1,
                particlesPerWave: 120,
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
                            texture: this.textures[0]
                        }
                    }
                ]
            })
        this._clickAccessoryEmitter = new PIXI.particles.Emitter(this.container,
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
                            texture: this.textures[1]
                        }
                    }
                ]
            })
        
        this._trailEmitter._emit = false;

        this._trailAccessoryEmitter.emit = this.trailEffect;

        this._trailEmitter.addEmitter(this._trailAccessoryEmitter, {
            spawnWhenDrag: true,
            updateTrail: true
        })

        this._clickEmitter.emit = false;
        this._clickAccessoryEmitter.emit = false;
        this.ready = true;
    }
    update(dt) {
        if(!this.ready) return;
        const delta = dt * 0.016;
        if (this.trailEffect) {
            this._trailEmitter.updateTrail(delta, 2);
        }
        if (this.clickEffect) {
            this._clickEmitter.update(delta);
            this._clickAccessoryEmitter.update(delta);
        }
    }
    pointermove(ev) {
        if(!this.ready) return;
        if (this.trailEffect) {
            this._trailEmitter.updateOwnerPos(ev.data.global.x, ev.data.global.y);
        }
    }
    pointerDown(ev) {
        if(!this.ready) return;
        if (this.clickEffect) {
            this._clickEmitter.teleport(ev.data.global.x, ev.data.global.y)
            this._clickAccessoryEmitter.teleport(ev.data.global.x, ev.data.global.y)

            const rotation = Math.random() * Math.PI;
            this._clickEmitter.emits(90, null, null, rotation)
            this._clickEmitter.emits(90, null, null, rotation + Math.PI)
            this._clickAccessoryEmitter.emits(45, null, null, rotation)
            this._clickAccessoryEmitter.emits(45, null, null, rotation + Math.PI)
        }
        if (this.trailEffect) {
            this._trailEmitter.teleport(ev.data.global.x, ev.data.global.y)
            this._trailEmitter._emit = true;
        }

        this._isDragging = true;


    }
    pointerUp() {
        if(!this.ready) return;
        this._isDragging = false;
        this._trailEmitter._emit = false;
    }
    pointerUpOutside() {
        if(!this.ready) return;
        this.pointerUp()
    }
    pointerOut() {
        if(!this.ready) return;
        this._isOutSide = true;
    }
    pointerOver(ev) {
        if(!this.ready) return;
        if (this._isOutSide) {
            if (this.trailEffect) {
                this._trailEmitter.teleport(ev.data.global.x, ev.data.global.y)
                this._trailAccessoryEmitter.teleport(ev.data.global.x, ev.data.global.y)
            }
            this._isOutSide = false;
        }
    }
}