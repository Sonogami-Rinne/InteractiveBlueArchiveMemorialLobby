class WindowManager {
    static scale = 1;
    static targetViewHeight = 1570;
    static targetViewWidth = 2790;
    // Web viewport policy, not a reconstruction of UIManualScaleByAspect.Refresh.
    static maxViewportZoom = 1.15;
    static frameColor = 0x80d8f7;

    static resize(width = window.innerWidth, height = window.innerHeight) {
        width = Math.max(1, Number.isFinite(width) ? width : 1);
        height = Math.max(1, Number.isFinite(height) ? height : 1);
        const fit = Math.min(width / this.targetViewWidth, height / this.targetViewHeight);
        const cover = Math.max(width / this.targetViewWidth, height / this.targetViewHeight);
        this.scale = Math.min(cover, fit * this.maxViewportZoom);
        const viewWidth = Math.min(width, this.targetViewWidth * this.scale);
        const viewHeight = Math.min(height, this.targetViewHeight * this.scale);
        return {
            width, height, scale: this.scale,
            x: (width - viewWidth) / 2, y: (height - viewHeight) / 2,
            viewWidth, viewHeight,
        };
    }
}

export default WindowManager;
