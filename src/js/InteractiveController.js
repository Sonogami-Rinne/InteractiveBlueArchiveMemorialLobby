class InteractiveController {
    constructor(originalWindowWidth, originalWindowHeight, interactiveDOMContainer) {
        this._interactiveInfo = {}
        this.spineController = null
        //this.spineBones = null
        this._originalWindowWidth = originalWindowWidth
        this._originalWindowHeight = originalWindowHeight
        this.currentObject = null
        this.interactiveDOMContainer = interactiveDOMContainer
        this._ifDragging = false
        this._lastMousePosX = null
        this._lastMousePosY = null
        this._gameObjectMap = {}
        this._localBonePositionX = 0
        this._localBonePositionY = 0
        this._clearBoneReference = false
        this.baseTransformInfo = null // 根据那两个骨骼在unity中的位置和当前的位置，计算出scale和translate,从而使得其他gameObject能够定位
    }
    async init() {
        let tmp = await fetch('@assets/InteractiveConfig.json')
        tmp = tmp.json()
        const base = Math.min(this._originalWindowHeight, this._originalWindowWidth) / 500
        const boneTransfromInfo = []

        for (const item of tmp) {

            const inta_item = {
                name: item.name,
                collider: this._colliderCorrect(item.collider),
                active: true,
                isTalk: true
            }
            this._gameObjectMap[item.gameObject] = inta_item
            if (item.hasOwnProperty('data')) {
                const data = item.data
                inta_item.followDragSpeed = data.followDragSpeed / base
                inta_item.bounds = data.bounds
                inta_item.initPos = data.initPos
                inta_item.in = item.in
                inta_item.out = item.out

                _boneData = this.spineController.getSpineBone(item.bone.name)
                inta_item.target = _boneData.bone
                boneTransfromInfo.push({
                    x: _boneData.x,
                    y: _boneData.y,
                    ox: item.bone.translate[0],
                    oy: item.bone.translate[1],
                })
                inta_item.collider.centerX += _boneData.x
                inta_item.collider.centerY += _boneData.y
                inta_item.isTalk = false

                this._gameObjectMap[item.bone.gameObject] = inta_item
            }
            this._interactiveInfo[item.name] = inta_item
        }

        //初始化交互相关的Div
        this.interactiveDOMContainer.style.width = '100%'
        this.interactiveDOMContainer.style.height = '100%'
        this.interactiveDOMContainer.style.position = 'absolute'
        this.interactiveDOMContainer.style.opacity = '0'
        this.interactiveDOMContainer.style.zIndex = '10'
        this.interactiveDOMContainer.addEventListener('mousedown', (event) => {
            this._ifDragging = true
            this._lastMousePosX = event.clientX
            this._lastMousePosY = event.clientY
        })
        this.interactiveDOMContainer.addEventListener('mouseup', () => {
            this.notifyInteractiveEventEnd()
        })
        this.interactiveDOMContainer.addEventListener('mouseleave', () => {
            this.notifyInteractiveEventEnd()
        })
        this.interactiveDOMContainer.addEventListener('mousemove', (event) => {
            if (this._ifDragging) {
                this.notifyMouseDrag(event.clientX, event.clientY, event.clientX - this._lastMousePosX, event.clientY - this._lastMousePosY)
                this._lastMousePosX = event.clientX
                this._lastMousePosY = event.clientY
            }
        })

        //计算变换
        bone0 = boneTransfromInfo[0]
        bone1 = boneTransfromInfo[1]
        _d0 = Math.hypot(bone0.x - bone1.x, bone0.y - bone1.y)
        _d1 = Math.hypot(bone0.ox - bone1.ox, bone0.oy - bone1.oy)
        scale = _d1 / d0
        this.baseTransformInfo = {
            scale: scale,
            translateX: bone0.ox / scale - bone0.x,
            translateY: bone0.oy / scale - bone0.y
        }

        //设置骨骼变换更新函数
        this.spineController.setBoneUpdateFun(() => {
            if(this.currentObject){
                this.currentObject.target.x = this._localBonePositionX
                this.currentObject.target.y = this._localBonePositionY
                if(this._clearBoneReference){
                    this._clearBoneReference = false
                    this.currentObject = null
                }
            }
        })
    }

    getGameObjectId() {
        return Object.keys(this._gameObjectMap)
    }

    _checkForCollide(collider, px, py) {
        const translatedX = collider.centerX - px
        const translatedY = collider.centerY - py

        const rotatedX = translatedX * collider.cos - translatedY * collider.sin
        const rotatedY = translatedX * collider.sin + translatedY * collider.cos

        return Math.abs(rotatedX) < collider.halfWidth && Math.abs(rotatedY) < collider.halfHeight
    }

    _colliderCorrect(collider) {
        collider.halfWidth *= this._originalWindowWidth * collider.scaleX
        collider.halfHeight *= this._originalWindowHeight * collider.scaleY
        collider.centerX *= this._originalWindowWidth
        collider.centerY *= this._originalWindowHeight
        if (collider.angle !== 0) {
            collider.cos = collider.theta / 180 * Math.PI
            collider.sin = Math.sin(collider.cos)
            collider.cos = Math.cos(collider.cos)
        }
        else {
            collider.sin = 0.
            collider.cos = 1.
        }
    }

    notifyMouseDrag(px, py, dx, dy) {
        if (this.currentObject) {
            if (!this.currentObject.isTalk) {
                //let tmp = this.currentObject.target.x
                let tmp = this._localBonePositionX
                let bounds = this.currentObject.bounds
                tmp += dx * this.currentObject.followDragSpeed
                if (tmp < bounds.minLocalX) {
                    tmp = bounds.minLocalX
                }
                else if (tmp > bounds.maxLocalX) {
                    tmp = bounds.maxLocalX
                }
                this._localBonePositionX = tmp

                tmp = this._localBonePositionY
                tmp += dy * this.currentObject.followDragSpeed
                if (tmp < bounds.minLocalY) {
                    tmp = bounds.minLocalY
                }
                else if (tmp > bounds.maxLocalY) {
                    tmp = bounds.maxLocalY
                }
                this._localBonePositionY = tmp
            }
        }
        else {
            for (const item of Object.values(this._interactiveInfo)) {
                if (item.active && this._checkForCollide(item.collider, px, py)) {
                    this.currentObject = item
                    if (item.isTalk) {
                        this.spineController.playTalkAnimation()
                    }
                    else {
                        this.spineController.playAnimation(item.in)
                        this._localBonePositionX = item.initPos.x
                        this._localBonePositionY = item.initPos.y
                    }
                    return
                }
            }
        }
    }

    notifyInteractiveEventEnd() {
        this._ifDragging = false
        this._lastMousePosX = null
        this._lastMousePosY = null
        if (!this.currentObject.isTalk) {
            this.spineController.playAnimation(this.currentObject.out, this.currentObject.name)
            // this.currentObject.target.x = 0
            // this.currentObject.target.y = 0
            this._localBonePositionX = 0
            this._localBonePositionY = 0
            this._clearBoneReference = true
        }
    }

    animationEndCallBack(name) {
        this.currentObject = null
        if (name) {
            //当然，确保in,out都会存在的前提下
            this.spineController.playAnimation(this._interactiveInfo[name].out, null)
        }
    }

    notifyGameObjectEvent(event) {
        switch (event.name) {
            case 'm_IsActive': {
                for (const item of Object.values(this._interactiveInfo)) {
                    if (item.gameObject.includes(event.gameObject)) {
                        item.active = event.value
                        if (event.value === false && item === this.currentObject) {
                            this.notifyInteractiveEventEnd()
                        }
                        break
                    }
                }
                break
            }
            default: {
                console.warn(`Unsupported event ${event.name} for InteractiveController`)
            }
        }
    }

    debugDrawCollider() {
        if (this.interactiveDOMContainer.children.length > 0) {
            return
        }
        for (const collider of Object.values(this._interactiveInfo).map(item => item.collider)) {
            const newDiv = document.createElement('div')
            newDiv.style.position = 'absolute'
            newDiv.style.top = collider.centerY
            newDiv.style.left = collider.centerX
            newDiv.style.transform = `rotation(${collider.theta}deg) scale(${collider.scaleX} ${collider.scaleY}) translate(-50% -50%)`
            newDiv.style.pointerEvents = 'none'
            newDiv.style.backgroundColor = 'rgba(200, 0, 0, 0.4)'
            this.interactiveDOMContainer.append(newDiv)
        }
    }

}

export default InteractiveController