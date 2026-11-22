// A material owns its Shader/resources; only immutable program descriptions are
// shared. Source variants include runtime changes for Spine, particles and UVs.
const programsByName = new Map();

export function getShaderProgram(name, vertex, fragment) {
    let variants = programsByName.get(name);
    if (!variants) programsByName.set(name, variants = new Map());
    const key = JSON.stringify([vertex, fragment]);
    let program = variants.get(key);
    if (!program) {
        program = PIXI.GlProgram.from({ name, vertex, fragment });
        variants.set(key, program);
    }
    return program;
}