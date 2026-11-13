
class SpineInteraction {
    constructor(data, offsetX, offsetY) {
        this.gameObject = data.gameObject;
        this.active = true;
        this.name = data.name;
        const collider = { ...data.collider };
        collider.centerX = collider.centerX ?? collider.X ?? 0;
        collider.centerY = -(collider.centerY ?? collider.Y ?? 0);
        collider.oriCenterX = collider.centerX;
        collider.oriCenterY = collider.centerY;
        collider.halfWidth *= collider.scaleX;
        collider.halfHeight *= collider.scaleY;
        collider.centerX += offsetX;
        collider.centerY += offsetY;
        collider.cover = collider.halfHeight * collider.halfWidth;
        this.cover = collider.cover;
        collider.rotation = -(collider.theta ?? 0);
        collider.cos = Math.cos(collider.rotation);
        collider.sin = Math.sin(collider.rotation);
        delete collider.scaleX;
        delete collider.scaleY;
        delete collider.theta;
        delete collider.X;
        delete collider.Y;
        this.collider = collider;
        data = data.data;
        if (data != undefined) {
            this.dragBounds = {
                minLocalX: -data.bounds.maxLocalY,
                maxLocalX: -data.bounds.minLocalY,
                minLocalY: -data.bounds.maxLocalX,
                maxLocalY: -data.bounds.minLocalX,
            };
            this.dragSpeed = data.followDragSpeed;
            this.dragInitPos = { ...data.initPos };
            this.dragStart = { x: -data.initPos.y, y: -data.initPos.x };
            this.boneName = data.bone.name;
            this.inSpineClip = data.in;
            this.endSpineClip = data.end;
            this.bone = null;

            this.isBodyTouch = false;
        }
        else {
            this.isBodyTouch = true;
        }
    }
    setOffset(offsetX, offsetY) {
        const collider = this.collider;
        collider.centerX = collider.oriCenterX + offsetX;
        collider.centerY = collider.oriCenterY + offsetY;
    }
}


class InteractionController {
    constructor(spineController, offsetX, offsetY, debug = false) {
        this.container = null;
        this._debug = Boolean(debug);
        this.debugContainer = null;
        this.spineController = spineController;
        this.interactions = [];
        this.pointerDownX = 0;
        this.pointerDownY = 0;
        this.colliders = [];
        this.pointerTrailParticle = null;
        this.currentInteraction = -1;
        this.activePointerId = null;
        this.gameObjectMap = {};
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        //
        //app.stage.hitArea = app.screen
        //
        //
        //
        this.spineController.onDisableInteractionEvent = () => {
            this.onPointerDownPlaceholder = this.onPointerDownType1;
        }
        this.spineController.onEnableInteractionEvent = () => {
            this.onPointerDownPlaceholder = this.onPointerDownType2;
        }
        this.onPointerDownType1 = this.onPointerDownType1.bind(this);
        this.onPointerDownType2 = this.onPointerDownType2.bind(this);
        this.onPointerMoveType1 = this.onPointerMoveType1.bind(this);
        this.onPointerMoveType2 = this.onPointerMoveType2.bind(this);
        this.onPointerUpType1 = this.onPointerUpType1.bind(this);
        this.onPointerUpType2 = this.onPointerUpType2.bind(this);
        this.setBonePosition = this.setBonePosition.bind(this);
        this.onPointerDownPlaceholder = this.onPointerDownType1;
        this.onPointerMovePlaceholder = InteractionController.dummy;
        this.onPointerUpPlaceholder = InteractionController.dummy;
    }
    async init(container, data) {
        this.container = container;
        let tmp = [];
        for (const da of data) {
            const interaction = new SpineInteraction(da, this.offsetX, this.offsetY);
            this.interactions.push(interaction);
            if (!interaction.isBodyTouch) {
                tmp.push(interaction.boneName);
            }
            this.gameObjectMap[interaction.gameObject] = interaction;
        }
        this.interactions.sort((a, b) => a.cover - b.cover);
        tmp = this.spineController.getBones(tmp);
        for (const interaction of this.interactions) {
            interaction.bone = tmp[interaction.boneName];
            if (!interaction.isBodyTouch && !interaction.bone) {
                throw new Error(`Spine bone ${interaction.boneName} was not found for interaction ${interaction.name}`);
            }
            this.colliders.push(interaction.collider);
        }

        this.updateDebugRegions();
        container.eventMode = "static";
        container.on("pointerdown", e => this.onPointerDownPlaceholder(e)
        ).on("pointermove", e => this.onPointerMovePlaceholder(e)
        ).on("pointerup", e => this.onPointerUpPlaceholder(e)
        ).on("pointerupoutside", e => {
            this.onPointerUpPlaceholder(e);
        }).on("pointerout", (e) => {
        });
    }
    get debug() {
        return this._debug;
    }
    set debug(value) {
        this._debug = Boolean(value);
        this.updateDebugRegions();
    }
    updateDebugRegions() {
        if (this.debugContainer) {
            this.debugContainer.destroy({ children: true });
            this.debugContainer = null;
        }
        if (!this.debug || !this.container) return;

        const overlay = new PIXI.Container();
        overlay.eventMode = 'none';
        overlay.zIndex = Infinity;
        for (const interaction of this.interactions) {
            const collider = interaction.collider;
            const rectangle = new PIXI.Rectangle(
                -collider.halfWidth, -collider.halfHeight,
                collider.halfWidth * 2, collider.halfHeight * 2,
            );
            const region = new PIXI.Graphics()
                .rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
                .fill({ color: 0x00ff88, alpha: 0.15 })
                .stroke({ color: 0x00ff88, width: 2 });
            region.position.set(collider.centerX, collider.centerY);
            region.rotation = collider.rotation;
            region.visible = interaction.active;
            overlay.addChild(region);
        }
        this.debugContainer = overlay;
        this.container.addChild(overlay);
    }
    setOffset(offsetX, offsetY) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.interactions.forEach(interaction => interaction.setOffset(offsetX, offsetY));
        this.updateDebugRegions();
    }
    onPointerDownPlaceholder(e) { }
    onPointerDownType1(e) {
        //this.mouseTrailParticle
    }
    onPointerDownType2(e) {
        //this.mouseTrailParticle
        if (this.currentInteraction !== -1) {
            return;
        }
        let index = 0;
        const local = this.container.toLocal(e.global ?? e.data.global);
        for (let collider of this.colliders) {
            if (!this.interactions[index].active) {
                index++;
                continue;
            }
            let x = local.x - collider.centerX;
            let y = local.y - collider.centerY;
            const cos = collider.cos;
            const sin = collider.sin;
            const _x = x * cos + y * sin;
            const _y = -x * sin + y * cos;
            if (Math.abs(_x) <= collider.halfWidth && Math.abs(_y) <= collider.halfHeight) {
                this.currentInteraction = index;
                this.activePointerId = e.pointerId;
                const interaction = this.interactions[index];
                if (!interaction.isBodyTouch) {
                    this.spineController.playClip(interaction.inSpineClip, null, 0, {
                        immediate: true, holdLastFrame: true,
                    });
                    const spineScale = this.spineController.getMainSpineScale();
                    this.__dragSpeedX = interaction.dragSpeed / spineScale.y;
                    this.__dragSpeedY = interaction.dragSpeed / spineScale.x;
                    this.__dragBounds = interaction.dragBounds;
                    this.__bone = interaction.bone;
                    this.__x = interaction.dragStart.x;
                    this.__y = interaction.dragStart.y;
                    this.pointerDownX = local.x;
                    this.pointerDownY = local.y;
                    this.onPointerMovePlaceholder = this.onPointerMoveType1;
                    this.onPointerUpPlaceholder = this.onPointerUpType1;
                    this.spineController.setBeforeUpdateTransform(this.setBonePosition);
                }
                else {
                    this.spineController.handleInteractionEvent('Talk');
                    this.onPointerMovePlaceholder = this.onPointerMoveType2;
                    this.onPointerUpPlaceholder = this.onPointerUpType2;
                }
                break;
            }
            index++;
        }
    }
    onPointerMovePlaceholder(e) { }
    onPointerMoveType1(e) {
        if (e.pointerId !== this.activePointerId) {
            return;
        }
        const local = this.container.toLocal(e.global ?? e.data.global);
        const _x = local.x;
        const _y = local.y;
        //this.mouseTrailParticle
        const bo = this.__dragBounds;

        const initial = this.interactions[this.currentInteraction].dragStart;
        const __x = initial.x + this.__dragSpeedX * (_x - this.pointerDownX);
        const __y = initial.y + this.__dragSpeedY * (_y - this.pointerDownY);
        this.__x = Math.max(Math.min(__x, bo.maxLocalX), bo.minLocalX);
        this.__y = Math.max(Math.min(__y, bo.maxLocalY), bo.minLocalY);

    }
    onPointerMoveType2(e) {
        if (e.pointerId !== this.activePointerId) {
            return;
        }
        // this.mouseTrailParticle
    }
    onPointerUpPlaceholder(e) { }
    onPointerUpType1(e) {
        if (e.pointerId !== this.activePointerId) {
            return;
        }
        // this.pointerTrailParticle
        const interaction = this.interactions[this.currentInteraction];
        this.currentInteraction = -1;
        this.activePointerId = null;
        this.spineController.playClip(interaction.endSpineClip, null, 0, { immediate: true });
        const bone = this.__bone;
        const initialX = interaction.dragInitPos.x;
        const initialY = interaction.dragInitPos.y;

        this.onPointerMovePlaceholder = InteractionController.dummy;
        this.onPointerUpPlaceholder = InteractionController.dummy;
        this.spineController.setBeforeUpdateTransform(() => {
            bone.x = initialX;
            bone.y = initialY;
            this.spineController.setBeforeUpdateTransform(InteractionController.dummy);
        });
        this.__x = undefined;
        this.__y = undefined;
        this.__bone = null;
    }
    onPointerUpType2(e) {
        if (e.pointerId !== this.activePointerId) {
            return;
        }
        // this.mouseTrailParticle
        this.onPointerMovePlaceholder = InteractionController.dummy;
        this.onPointerUpPlaceholder = InteractionController.dummy;
        this.currentInteraction = -1;
        this.activePointerId = null;
    }
    static dummy(e) { }
    setBonePosition() {
        this.__bone.x = -this.__y;
        this.__bone.y = -this.__x;
    }
    handleTimelineEvent(gameObject, eventName, value) {
        if (eventName === 'm_IsActive' || eventName === 'm_Enabled') {
            this.gameObjectMap[gameObject].active = Boolean(value);
            this.updateDebugRegions();
        } else throw new Error(`Unsupported interaction timeline property ${eventName}`);
    }
}

export default InteractionController


