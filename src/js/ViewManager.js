export default class ViewManager {
    static scale = 1;
    static defaultTargetViewHeight = 1570;
    static defaultTargetViewWidth = 2790;
    static targetViewHeight = ViewManager.defaultTargetViewHeight;
    static targetViewWidth = ViewManager.defaultTargetViewWidth;

    static resize(width = window.innerWidth, height = window.innerHeight) {
        width = Math.max(1, Number.isFinite(width) ? width : 1);
        height = Math.max(1, Number.isFinite(height) ? height : 1);
        const fit = Math.min(width / this.targetViewWidth, height / this.targetViewHeight);
        const cover = Math.max(width / this.targetViewWidth, height / this.targetViewHeight);
        this.scale = Math.min(cover, fit * maxViewportZoom);
        const viewWidth = Math.min(width, this.targetViewWidth * this.scale);
        const viewHeight = Math.min(height, this.targetViewHeight * this.scale);
        return {
            width, height, scale: this.scale,
            x: (width - viewWidth) / 2, y: (height - viewHeight) / 2,
            viewWidth, viewHeight,
        };
    }
}

// Web viewport policy, not a reconstruction of UIManualScaleByAspect.Refresh.
const maxViewportZoom = 1.15;
// Measured on the active Lobby*(Clone) instances. Keep the 2790 x 1570
// scene coordinates; do not infer a camera projection or post-process zoom.
export const LOBBY_ROOT_WORLD_SCALE = 0.00120120123;

export const frameColor = 0x80d8f7;