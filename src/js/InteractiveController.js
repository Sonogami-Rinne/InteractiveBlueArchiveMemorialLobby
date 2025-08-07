class InteractiveController {
    InteractiveController(originalWindowWidth, originalWindowHeight, interactiveDOMContainer) {
        this.interactiveInfo = {}
        this.spineController = null
        //this.spineBones = null
        this.originalWindowWidth = originalWindowWidth
        this.originalWindowHeight = originalWindowHeight
        this.currentObject = null
        this.interactiveDOMContainer = interactiveDOMContainer
        this.ifDragging = false
        this.lastMousePosX = null
        this.lastMousePosY = null
    }
    async init() {
        let tmp = await import('@assets/InteractiveConfig.json')
        tmp = tmp.default
        base = Math.min(this.originalWindowHeight, this.originalWindowWidth) / 500

        for (const item of tmp) {

            const inta_item = {
                name: item.name,
                gameObject: [
                    item.gameObject,
                ],
                collider: this._colliderCorrect(item.collider),
                active: true,
                isTalk: true
            }
            if (item.hasOwnProperty('data')) {
                const data = item.data
                inta_item.followDragSpeed = data.followDragSpeed / base
                inta_item.bounds = data.bounds
                inta_item.initPos = data.initPos
                inta_item.gameObject.push(item.bone[1])
                inta_item.in = item.in
                inta_item.out = item.out

                _boneData = this.spineController.getSpineBone(item.bone[0])
                inta_item.target = _boneData.bone
                inta_item.collider.centerX += _boneData.x
                inta_item.collider.centerY += _boneData.y
                inta_item.isTalk = false
            }
            this.interactiveInfo[item.name] = inta_item
        }

        //initialize the interactive dom container
        this.interactiveDOMContainer.style.width = '100%'
        this.interactiveDOMContainer.style.height = '100%'
        this.interactiveDOMContainer.style.position = 'absolute'
        this.interactiveDOMContainer.style.opacity = '0'
        this.interactiveDOMContainer.style.zIndex = '10'
        this.interactiveDOMContainer.addEventListener('mousedown', (event) => {
            this.ifDragging = true
            this.lastMousePosX = event.clientX
            this.lastMousePosY = event.clientY
        })
        this.interactiveDOMContainer.addEventListener('mouseup', () => {
            this.notifyInteractiveEventEnd()
        })
        this.interactiveDOMContainer.addEventListener('mouseleave', () => {
            this.notifyInteractiveEventEnd()
        })
        this.interactiveDOMContainer.addEventListener('mousemove', (event) => {
            if (this.ifDragging) {
                this.notifyMouseDrag(event.clientX, event.clientY, event.clientX - this.lastMousePosX, event.clientY - this.lastMousePosY)
                this.lastMousePosX = event.clientX
                this.lastMousePosY = event.clientY
            }
        })
    }

    _checkForCollide(collider, px, py) {
        const translatedX = collider.centerX - px
        const translatedY = collider.centerY - py

        const rotatedX = translatedX * collider.cos - translatedY * collider.sin
        const rotatedY = translatedX * collider.sin + translatedY * collider.cos

        return Math.abs(rotatedX) < collider.halfWidth && Math.abs(rotatedY) < collider.halfHeight
    }

    _colliderCorrect(collider) {
        collider.halfWidth *= this.originalWindowWidth * collider.scaleX
        collider.halfHeight *= this.originalWindowHeight * collider.scaleY
        collider.centerX *= this.originalWindowWidth
        collider.centerY *= this.originalWindowHeight
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

    // getDebugColliderInfo() {
    //     return Object.values(this.interactiveInfo).map(item => item.collider)
    // }

    notifyMouseDrag(px, py, dx, dy) {
        if (this.currentObject) {
            if (!this.currentObject.isTalk) {
                let tmp = this.currentObject.target.x
                let bounds = this.currentObject.bounds
                tmp += dx * this.currentObject.followDragSpeed
                if (tmp < bounds.minLocalX) {
                    tmp = bounds.minLocalX
                }
                else if (tmp > bounds.maxLocalX) {
                    tmp = bounds.maxLocalX
                }
                this.currentObject.target.x = tmp

                tmp = this.currentObject.target.y
                tmp += dy * this.currentObject.followDragSpeed
                if (tmp < bounds.minLocalY) {
                    tmp = bounds.minLocalY
                }
                else if (tmp > bounds.maxLocalY) {
                    tmp = bounds.maxLocalY
                }
                this.currentObject.y = tmp
            }
        }
        else {
            for (const item of Object.values(this.interactiveInfo)) {
                if (item.active && this._checkForCollide(item.collider, px, py)) {
                    this.currentObject = item
                    if (item.isTalk) {
                        this.spineController.playTalkAnimation()
                    }
                    else {
                        this.spineController.playAnimation(item.in)
                        item.target.x = item.initPos.x
                        item.target.y = item.initPos.y
                    }
                    return
                }
            }
        }
    }
    notifyInteractiveEventEnd() {
        this.ifDragging = false
        this.lastMousePosX = null
        this.lastMousePosY = null
        if (!this.currentObject.isTalk) {
            this.spineController.playAnimation(this.currentObject.out, this.currentObject.name)
            this.currentObject.target.x = 0
            this.currentObject.target.y = 0
        }
        this.currentObject = null
    }
    animationEndCallBack(name) {
        this.currentObject = null
        if (name) {
            //当然，确保in,out都会存在的前提下
            this.spineController.playAnimation(this.interactiveInfo[name].out, null)
        }
    }

    notifyGameObjectEvent(event) {
        switch (event.name) {
            case 'm_IsActive': {
                for (const item of Object.values(this.interactiveInfo)) {
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
        for (const collider of Object.values(this.interactiveInfo).map(item => item.collider)) {
            const newDiv = document.createElement('div')
            newDiv.style.position = 'absolute'
            newDiv.style.top = collider.centerY
            newDiv.style.left = collider.centerX
            newDiv.style.translate = '-50% -50%'
            newDiv.style.transform = `rotation(${collider.theta}deg) scale(${collider.scaleX} ${collider.scaleY})`
            newDiv.style.pointerEvents = 'none'
            newDiv.style.backgroundColor = 'rgba(200, 0, 0, 0.4)'
            this.interactiveDOMContainer.append(newDiv)
        }
    }

}

export default InteractiveController