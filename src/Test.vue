<script setup>


import { ref, onMounted } from 'vue'
// import * as particles from '@barvynkoa/particle-emitter'
// class CParticle extends PIXI.Particle {
//     constructor(config) {
//         super(config);
//         this.relativeScaleX = config.relativeScaleX;
//         this.relativeScaleY = config.relativeScaleY;
//         this.updateFun = config.updateFun;
//         this.elapsed = 0;
//         this.lifeSpan = config.lifeSpan || Infinity;
//         this.parentContainer = config.parentContainer;
//         this.indexOfParent = config.index;
//     }
//     update(deltaTime) {
//         this.lifeSpan -= deltaTime;
//         if (this.lifeSpan <= 0) {
//             this.parentContainer.removeElement(this.indexOfParent);
//             return true;
//         }
//         if (this.updateFun) {
//             return this.updateFun(deltaTime);
//         }
//         return false;
//     }
//     reset(config) {
//         this.lifeSpan = this.lifeSpan || 1000;
//         this.indexOfParent = this.parent.children.length;
//         //to-do
//     }
// }

// class CParticleContainer extends PIXI.ParticleContainer {
//     constructor(config) {
//         super(config)
//         this.maxCounts = config.maxCounts
//         this.particleList = []
//         this.reservedParticleList = []
//     }
//     addElement(config) {
//         let particle = null;
//         if (this.reservedParticleList.length > 0) {
//             particle = this.reservedParticleList.pop();
//             particle.reset(config)
//         }
//         else {
//             particle = new CParticle(config)
//         }
//         this.particleList.push(particle)
//         if (this.particleList.length > this.maxCounts) {
//             this.particleList.shift();
//         }
//     }
//     __addElement__(config) {

//     }
//     addElements(configs) {
//         configs.forEach(config => {
//             this.__addElement__(config)
//         });
//         if (this.particleList.length > this.maxCounts) {
//             this.particleList.splice(0, this.particleList.length - this.maxCounts)
//         }
//     }
//     removeElement(index) {

//     }
// }


// onMounted(async () => {
//     const app = new PIXI.Application();
//     await app.init({
//         width: window.innerWidth,
//         height: window.innerHeight,
//         resolution: window.devicePixelRatio || 1,
//         autoDensity: true,
//         resizeTo: window,
//         backgroundColor: 0x000011,
//         hello: true,
//     })
//     document.getElementById("test1").appendChild(app.canvas);
//     await PIXI.Assets.load('./effects/particle.png')
//     const texture = PIXI.Texture.from('./effects/particle.png')
//     const container = new PIXI.ParticleContainer({
//         dynamicProperties: {
//             position: true, // default
//             scale: false,
//             rotation: false,
//             color: false,
//         },
//     });
//     for (let i = 0; i < 100; i++) {
//         const particle = new PIXI.Particle({
//             texture,
//             x: Math.random() * 800,
//             y: Math.random() * 600,
//         });

//         container.addParticle(particle);
//     }

//     app.stage.addChild(container);
//     app.ticker.add(() => {
//         container.update();
//     });
// })
onMounted(async () => {
    const app = new PIXI.Application();
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
    const texture = PIXI.Texture.from('./effects/particle.png')
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
                "start": "#50bce3",
                "end": "#9dcfe3"
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
    app.ticker.add((delta) => {
        emitter.updateTrail(delta.deltaTime * 0.01, 2);
    })
    app.stage.eventMode = "dynamic"
    app.stage.on("globalpointermove", (ev) => {
        emitter.updateOwnerPos(ev.data.global.x, ev.data.global.y)
    })
    container.eventMode = "none";
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