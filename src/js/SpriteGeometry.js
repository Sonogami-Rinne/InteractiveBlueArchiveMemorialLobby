// Bounds of the already cropped/unpacked PNG, in Pixi local coordinates.
// Unity's pivot and trim offsets use a bottom-left origin and Y pointing up.
export function getSpriteBounds(sprite) {
    if (!sprite?.rect || !(sprite.pixelsToUnits > 0)) return [-0.5, -0.5, 0.5, 0.5];
    const { rect, pivot = [0.5, 0.5], pixelsToUnits: units, renderData = {} } = sprite;
    const [offsetX, offsetY] = renderData.textureRectOffset ?? [0, 0];
    let [, , width, height] = renderData.textureRect ?? rect;
    // UnityPy has already undone packing rotation in the exported PNG.
    if (renderData.packed && renderData.packingRotation === 4) [width, height] = [height, width];
    const left = (offsetX - pivot[0] * rect[2]) / units;
    const bottom = (pivot[1] * rect[3] - offsetY) / units;
    return [left, bottom - height / units, left + width / units, bottom];
}
