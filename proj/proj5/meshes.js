/**
 * meshes.js — procedural low-poly geometry.
 *
 * Everything in the game is built from axis-aligned boxes with per-face
 * flat normals and per-face vertex colors, appended into flat arrays and
 * uploaded once as an interleaved [position, normal, color] buffer.
 */

/* Corner tables per face, CCW from outside, for a unit box (±1). */
const FACES = [
    {key: 'px', n: [1, 0, 0],
        c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]},
    {key: 'nx', n: [-1, 0, 0],
        c: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]},
    {key: 'top', n: [0, 1, 0],
        c: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]},
    {key: 'bottom', n: [0, -1, 0],
        c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]},
    {key: 'pz', n: [0, 0, 1],
        c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]},
    {key: 'nz', n: [0, 0, -1],
        c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]},
];

/** Start a new mesh accumulator. */
export function newMesh() {
    return {verts: []};
}

/**
 * Append an axis-aligned box centered at (x, y, z) with full extents
 * (sx, sy, sz). `colors` is either one [r, g, b] for all faces or a map
 * like {top, bottom, side, px, nx, pz, nz} (most specific key wins).
 */
export function addBox(mesh, x, y, z, sx, sy, sz, colors) {
    const flat = Array.isArray(colors) ? colors : null;
    for (const face of FACES) {
        const col = flat ||
            colors[face.key] || colors.side || colors.top || [1, 0, 1];
        const quad = face.c.map((corner) => [
            x + corner[0] * sx / 2,
            y + corner[1] * sy / 2,
            z + corner[2] * sz / 2,
        ]);
        for (const idx of [0, 1, 2, 0, 2, 3]) {
            mesh.verts.push(
                quad[idx][0], quad[idx][1], quad[idx][2],
                face.n[0], face.n[1], face.n[2],
                col[0], col[1], col[2]);
        }
    }
}

/** Multiply a color by a scalar (cheap shade variation). */
export function shade(color, k) {
    return [color[0] * k, color[1] * k, color[2] * k];
}

/* ------------------------------------------------------------------ */
/* Characters & props                                                  */
/* ------------------------------------------------------------------ */

const FROG_GREEN = [0.36, 0.78, 0.38];
const FROG_DARK = [0.22, 0.55, 0.25];
const FROG_BELLY = [0.85, 0.93, 0.70];

/** The player: a chunky frog facing -Z. */
export function buildFrog() {
    const m = newMesh();
    // Body.
    addBox(m, 0, 0.30, 0.02, 0.62, 0.34, 0.72,
        {top: FROG_GREEN, side: shade(FROG_GREEN, 0.85), bottom: FROG_BELLY});
    // Back stripe.
    addBox(m, 0, 0.485, 0.10, 0.30, 0.05, 0.44, FROG_DARK);
    // Eyes.
    for (const s of [-1, 1]) {
        addBox(m, s * 0.18, 0.52, -0.20, 0.18, 0.18, 0.18, [0.95, 0.97, 0.9]);
        addBox(m, s * 0.18, 0.53, -0.30, 0.08, 0.09, 0.04, [0.05, 0.05, 0.06]);
    }
    // Front feet and back thighs.
    for (const s of [-1, 1]) {
        addBox(m, s * 0.27, 0.09, -0.24, 0.16, 0.18, 0.22,
            shade(FROG_GREEN, 0.75));
        addBox(m, s * 0.29, 0.13, 0.26, 0.20, 0.26, 0.30,
            shade(FROG_GREEN, 0.7));
    }
    return m;
}

/** A little sedan facing +X. `body` is its paint color. */
export function buildCar(body) {
    const m = newMesh();
    const glass = [0.62, 0.80, 0.90];
    addBox(m, 0, 0.30, 0, 1.30, 0.28, 0.64,
        {top: shade(body, 1.05), side: body, bottom: shade(body, 0.5)});
    addBox(m, -0.05, 0.55, 0, 0.62, 0.24, 0.56,
        {top: shade(body, 0.95), side: glass, bottom: body});
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            addBox(m, sx * 0.40, 0.13, sz * 0.30, 0.24, 0.22, 0.10,
                [0.13, 0.13, 0.15]);
        }
    }
    return m;
}

/** A two-cell delivery truck facing +X. */
export function buildTruck(cab) {
    const m = newMesh();
    const box = [0.92, 0.90, 0.86];
    addBox(m, 0.78, 0.38, 0, 0.66, 0.44, 0.68,
        {top: shade(cab, 1.05), side: cab, bottom: shade(cab, 0.5)});
    addBox(m, -0.35, 0.50, 0, 1.50, 0.72, 0.72,
        {top: shade(box, 0.96), side: box, bottom: shade(box, 0.55)});
    for (const sx of [-0.85, 0.15, 0.78]) {
        for (const sz of [-1, 1]) {
            addBox(m, sx, 0.13, sz * 0.32, 0.26, 0.24, 0.10,
                [0.13, 0.13, 0.15]);
        }
    }
    return m;
}

/** A unit-length log along X; scaled to length by its model matrix. */
export function buildLog() {
    const m = newMesh();
    const bark = [0.48, 0.33, 0.19];
    const rings = [0.74, 0.60, 0.40];
    addBox(m, 0, -0.02, 0, 1.0, 0.24, 0.58,
        {top: [0.56, 0.39, 0.22], side: bark, bottom: shade(bark, 0.6),
            px: rings, nx: rings});
    return m;
}

/**
 * A fir tree; `rng` in [0, 1) varies height and hue.
 * Appended straight into a row's static mesh at (x, z).
 */
export function addTree(mesh, x, z, rng) {
    const trunk = [0.45, 0.31, 0.20];
    const leaf = [0.16 + rng * 0.10, 0.50 + rng * 0.14, 0.26 + rng * 0.08];
    const tiers = 2 + Math.floor(rng * 2);
    addBox(mesh, x, 0.35, z, 0.26, 0.7, 0.26,
        {top: trunk, side: trunk, bottom: shade(trunk, 0.6)});
    let y = 0.62;
    let size = 0.95;
    for (let t = 0; t < tiers; t++) {
        const h = 0.42;
        addBox(mesh, x, y + h / 2, z, size, h, size,
            {top: shade(leaf, 1.1), side: leaf, bottom: shade(leaf, 0.55)});
        y += h * 0.78;
        size *= 0.68;
    }
}

/* ------------------------------------------------------------------ */
/* GPU upload                                                          */
/* ------------------------------------------------------------------ */

/**
 * Upload an accumulated mesh as one interleaved VAO
 * (location 0 = position, 1 = normal, 2 = color; stride 9 floats).
 * Returns {vao, buffer, count} or null for an empty mesh.
 */
export function uploadMesh(gl, mesh) {
    if (mesh.verts.length === 0) return null;
    const data = new Float32Array(mesh.verts);
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
    gl.bindVertexArray(null);
    return {vao, buffer, count: data.length / 9};
}

/** Delete a mesh created by uploadMesh. */
export function deleteMesh(gl, gpuMesh) {
    if (!gpuMesh) return;
    gl.deleteVertexArray(gpuMesh.vao);
    gl.deleteBuffer(gpuMesh.buffer);
}

/** A flat (N+1)² grid of XZ positions for the water, indexed triangles. */
export function buildWaterGrid(gl, cells, cellSize) {
    const side = cells + 1;
    const pos = new Float32Array(side * side * 2);
    const half = cells * cellSize / 2;
    let p = 0;
    for (let j = 0; j < side; j++) {
        for (let i = 0; i < side; i++) {
            pos[p++] = i * cellSize - half;
            pos[p++] = j * cellSize - half;
        }
    }
    const idx = new Uint16Array(cells * cells * 6);
    let q = 0;
    for (let j = 0; j < cells; j++) {
        for (let i = 0; i < cells; i++) {
            const a = j * side + i;
            idx[q++] = a;
            idx[q++] = a + side;
            idx[q++] = a + 1;
            idx[q++] = a + 1;
            idx[q++] = a + side;
            idx[q++] = a + side + 1;
        }
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return {vao, count: idx.length};
}
