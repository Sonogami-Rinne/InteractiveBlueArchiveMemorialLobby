// Unity affine matrices are column-major, with translation at indices 12–14.
export function fromTRS([px, py, pz = 0], [x, y, z, w], [sx, sy, sz = 1]) {
    const length = Math.hypot(x, y, z, w) || 1;
    x /= length; y /= length; z /= length; w /= length;
    return [
        (1 - 2 * (y*y + z*z)) * sx, 2 * (x*y + w*z) * sx, 2 * (x*z - w*y) * sx, 0,
        2 * (x*y - w*z) * sy, (1 - 2 * (x*x + z*z)) * sy, 2 * (y*z + w*x) * sy, 0,
        2 * (x*z + w*y) * sz, 2 * (y*z - w*x) * sz, (1 - 2 * (x*x + y*y)) * sz, 0,
        px, py, pz, 1,
    ];
}

export function fromAffine2D([a, b, c, d, x, y]) {
    return [a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
}

export function multiply(a, b) {
    const result = new Array(16);
    for (let column = 0; column < 16; column += 4) {
        for (let row = 0; row < 4; row++) {
            result[column + row] = a[row] * b[column] + a[4 + row] * b[column + 1]
                + a[8 + row] * b[column + 2] + a[12 + row] * b[column + 3];
        }
    }
    return result;
}

export function inverse(m) {
    const [a,b,c,, d,e,f,, g,h,i,, x,y,z] = m;
    const j = e*i - f*h, k = c*h - b*i, l = b*f - c*e;
    const determinant = a*j + d*k + g*l;
    if (Math.abs(determinant) < 1e-12) return null;
    const result = [
        j, k, l, 0, g*f - d*i, a*i - c*g, c*d - a*f, 0,
        d*h - e*g, b*g - a*h, a*e - b*d, 0, 0, 0, 0, determinant,
    ].map(value => value / determinant);
    for (let row = 0; row < 3; row++) {
        result[12 + row] = -(result[row]*x + result[4 + row]*y + result[8 + row]*z);
    }
    return result;
}

export function project(matrix, pixiMatrix) {
    return pixiMatrix.set(matrix[0], -matrix[1], -matrix[4], matrix[5], matrix[12], -matrix[13]);
}