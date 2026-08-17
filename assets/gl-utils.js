/**
 * gl-utils.js — tiny shared WebGL2 helpers used by the landing-page hero
 * and Project 5.
 */

/** Compile one shader stage; throws with the driver's log on failure. */
export function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('shader compile: ' + log);
    }
    return shader;
}

/**
 * Compile + link a program and cache its active uniform locations.
 * Returns {prog, u} where u maps uniform name → location (array uniforms
 * are keyed without the trailing "[0]").
 */
export function createProgram(gl, vsSource, fsSource) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('program link: ' + gl.getProgramInfoLog(prog));
    }
    const u = {};
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(prog, i);
        u[info.name.replace('[0]', '')] =
            gl.getUniformLocation(prog, info.name);
    }
    return {prog, u};
}

/** Parse "#rrggbb" into [r, g, b] floats. */
export function hexToRgb(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}
