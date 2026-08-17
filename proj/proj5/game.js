/**
 * game.js — "Hopper": an endless low-poly river-crossing game.
 *
 * A ground-up WebGL2 rewrite of the classic Frogger assignment, built to
 * showcase graphics techniques rather than fixed-function-style drawing:
 *
 *   - shadow mapping (depth texture, hardware PCF, texel-snapped ortho sun)
 *   - sum-of-sines water displaced in the vertex shader w/ analytic normals
 *   - hemisphere ambient + Blinn-Phong direct lighting, distance fog
 *   - MSAA offscreen framebuffer resolved into a post-process pass
 *     (tonemap, vignette, death desaturation)
 *   - GPU point-sprite particles, procedural vertex-colored meshes,
 *     seeded procedural world generation (append ?seed=N for determinism)
 *
 * Uses the class copy of gl-matrix (global mat3/mat4/vec3/vec4).
 */
/* global mat3, mat4, vec4 */
/* eslint-disable valid-jsdoc */

import {
    SCENE_VS, SCENE_FS, SHADOW_VS, SHADOW_FS, WATER_VS, WATER_FS,
    SKY_VS, SKY_FS, PARTICLE_VS, PARTICLE_FS, POST_VS, POST_FS,
} from './shaders.js';
import {
    newMesh, addBox, shade, addTree, buildFrog, buildCar, buildTruck,
    buildLog, uploadMesh, deleteMesh, buildWaterGrid,
} from './meshes.js';

/* ------------------------------------------------------------------ */
/* Tuning constants                                                    */
/* ------------------------------------------------------------------ */

const MINX = -5; // playable column range
const MAXX = 5;
const SLAB_COLS = 8; // terrain spans x in [-8, 8]
const RING = 22; // moving objects wrap over x in [-11, 11]
const WATER_Y = -0.16;
const LOG_TOP = 0.10;
const HOP_TIME = 0.14;
const HOP_HEIGHT = 0.45;
const SHADOW_SIZE = 2048;

const SUN_DIR = [0.50, 1.0, 0.42];
const SUN_COLOR = [1.12, 1.04, 0.92];
const SKY_AMBIENT = [0.40, 0.47, 0.56];
const GROUND_AMBIENT = [0.26, 0.23, 0.21];
const ZENITH = [0.30, 0.56, 0.92];
const HORIZON = [0.78, 0.88, 0.96];
const FOG_DENSITY = 0.030;

const GRASS_A = [0.45, 0.74, 0.35];
const GRASS_B = [0.40, 0.68, 0.31];
const DIRT = [0.42, 0.30, 0.20];
const ASPHALT = [0.23, 0.24, 0.28];
const DASH = [0.85, 0.80, 0.55];
const CAR_COLORS = [
    [0.93, 0.42, 0.38], [0.30, 0.75, 0.70], [0.95, 0.78, 0.30],
    [0.68, 0.55, 0.90], [0.35, 0.55, 0.90], [0.92, 0.92, 0.95],
];

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

/** Deterministic PRNG (mulberry32) so runs are reproducible via ?seed=. */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Compile + link a program and cache its active uniform locations. */
function createProgram(gl, vsSrc, fsSrc) {
    const make = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            throw new Error('shader: ' + gl.getShaderInfoLog(sh));
        }
        return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, make(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, make(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('link: ' + gl.getProgramInfoLog(prog));
    }
    const u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i);
        const name = info.name.replace('[0]', '');
        u[name] = gl.getUniformLocation(prog, info.name);
    }
    return {prog, u};
}

/* ------------------------------------------------------------------ */
/* Procedural sound (tiny WebAudio synth — no audio assets)            */
/* ------------------------------------------------------------------ */

const sfx = {
    ctx: null,
    /** Create the AudioContext (must be after a user gesture). */
    ensure() {
        if (!this.ctx) {
            try {
                const AC = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AC();
            } catch (e) {
                // audio unavailable — stay silent
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    /** One enveloped oscillator sweep. */
    blip(f0, f1, dur, type, vol, delay = 0) {
        if (!this.ctx) return;
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    },
    /** Filtered noise burst (splashes). */
    noise(dur, vol, freq) {
        if (!this.ctx) return;
        const t0 = this.ctx.currentTime;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        src.connect(filt).connect(gain).connect(this.ctx.destination);
        src.start(t0);
    },
    hop() {
        this.blip(330, 540, 0.07, 'square', 0.10);
    },
    thud() {
        this.blip(150, 90, 0.09, 'triangle', 0.18);
    },
    tick() {
        this.blip(880, 1350, 0.05, 'sine', 0.07);
    },
    splash() {
        this.noise(0.4, 0.25, 900);
    },
    squash() {
        this.blip(220, 55, 0.25, 'sawtooth', 0.2);
    },
    gameOver() {
        this.blip(392, 392, 0.14, 'square', 0.10, 0.25);
        this.blip(330, 330, 0.14, 'square', 0.10, 0.42);
        this.blip(262, 220, 0.30, 'square', 0.10, 0.59);
    },
};

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */

let gl;
let canvas;
const progs = {};
const fbos = {};
const gpu = {}; // uploaded archetype meshes
let waterGrid;

const state = {
    seed: 0,
    rng: null,
    fixedSeed: false,
    time: 0,
    mode: 'play', // 'play' | 'dead'
    score: 0,
    best: 0,
    deathTimer: 0,
    deathFade: 0,
    rows: new Map(),
    gen: null,
    frog: null,
};

const cam = {
    pos: [0, 8.6, 6.4],
    focus: [0, 0, 2.4],
    proj: mat4.create(),
    view: mat4.create(),
    sunScreen: [-10, -10],
};

const light = {vp: mat4.create()};

/* Matrix scratch pool, reset each frame. */
const matPool = [];
let matPoolUsed = 0;
/** Get a scratch mat4 valid for the current frame. */
function poolMat() {
    if (matPoolUsed === matPool.length) matPool.push(mat4.create());
    return mat4.identity(matPool[matPoolUsed++]);
}
const IDENTITY = mat4.create();
const IDENTITY3 = mat3.create();
const normalMat = mat3.create();

/* ------------------------------------------------------------------ */
/* World generation                                                    */
/* ------------------------------------------------------------------ */

/** Build the static terrain mesh for one row (baked in world coords). */
function buildRowMesh(row) {
    const m = newMesh();
    const z = -row.r;
    if (row.type === 'grass') {
        for (let x = -SLAB_COLS; x <= SLAB_COLS; x++) {
            let top = (row.r + x) % 2 === 0 ? GRASS_A : GRASS_B;
            if (x < MINX || x > MAXX) top = shade(top, 0.82);
            addBox(m, x, -0.3, z, 1, 0.6, 1,
                {top, side: DIRT, bottom: shade(DIRT, 0.5)});
        }
        for (const t of row.trees) {
            addTree(m, t.x, z, t.rng);
        }
    } else if (row.type === 'road') {
        addBox(m, 0, -0.3, z, SLAB_COLS * 2 + 1, 0.6, 1,
            {top: ASPHALT, side: DIRT, bottom: shade(DIRT, 0.5)});
        for (let k = -3; k <= 3; k++) {
            addBox(m, k * 2.3, 0.011, z, 0.7, 0.022, 0.08, DASH);
        }
    }
    // water rows have no slab — the global ocean shows through the gap
    row.gpu = uploadMesh(gl, m);
}

/** Populate a road or water row with its moving objects. */
function fillRowObjects(row, rng) {
    row.dir = rng() < 0.5 ? -1 : 1;
    const speedScale = Math.min(1.6, 1 + row.r * 0.008);
    row.objs = [];
    if (row.type === 'road') {
        row.speed = (1.5 + rng() * 1.8) * speedScale;
        let x = -RING / 2 + rng() * 2;
        while (x < RING / 2 - 1.5) {
            const truck = rng() < 0.25;
            const halfLen = truck ? 1.25 : 0.72;
            row.objs.push({
                x: x + halfLen,
                halfLen,
                kind: truck ? 'truck' : 'car',
                meshIdx: Math.floor(rng() * CAR_COLORS.length),
            });
            x += halfLen * 2 + 2.2 + rng() * 3.6;
        }
    } else if (row.type === 'water') {
        row.speed = (0.9 + rng() * 1.4) * speedScale;
        let x = -RING / 2 + rng() * 1.5;
        while (x < RING / 2 - 2) {
            const len = 2.1 + rng() * 1.5;
            row.objs.push({
                x: x + len / 2,
                halfLen: len / 2,
                kind: 'log',
                len,
                bob: rng() * Math.PI * 2,
            });
            x += len + 1.3 + rng() * 2.1;
        }
    }
}

/** Generate the next row (rows are created strictly in order). */
function genRow() {
    const g = state.gen;
    const r = g.nextRow++;
    const rng = state.rng;
    let type = 'grass';
    if (r > 3) {
        if (g.runLeft > 0) {
            g.runLeft--;
            type = g.runType;
        } else {
            const roll = rng();
            if (g.lastType !== 'road' && roll < 0.40) {
                type = 'road';
                g.runLeft = Math.floor(rng() * 3); // up to 3 lanes total
            } else if (g.lastType !== 'water' && roll < 0.68) {
                type = 'water';
                g.runLeft = rng() < 0.4 ? 1 : 0; // up to 2 lanes total
            } else {
                type = 'grass';
                g.runLeft = rng() < 0.3 ? 1 : 0;
            }
            g.runType = type;
        }
    }
    g.lastType = type;

    const row = {r, type, trees: [], treeCols: new Set(), objs: [],
        dir: 0, speed: 0, gpu: null};

    if (type === 'grass') {
        // Guaranteed corridor: the walkable path column drifts by ±1.
        g.pathCol = clamp(g.pathCol + Math.floor(rng() * 3) - 1, MINX, MAXX);
        for (let x = -SLAB_COLS; x <= SLAB_COLS; x++) {
            const inBounds = x >= MINX && x <= MAXX;
            const nearSpawn = r >= -1 && r <= 2 && Math.abs(x) <= 1;
            const p = inBounds ? (r <= 3 ? 0.10 : 0.24) : 0.55;
            if (x !== g.pathCol && !nearSpawn && rng() < p) {
                row.trees.push({x, rng: rng()});
                if (inBounds) row.treeCols.add(x);
            }
        }
    } else {
        fillRowObjects(row, rng);
    }
    buildRowMesh(row);
    state.rows.set(r, row);
}

/** Keep a sliding window of rows around the frog; drop far-behind rows. */
function ensureRows() {
    const frogRow = state.frog.row;
    while (state.gen.nextRow < frogRow + 24) genRow();
    for (const [r, row] of state.rows) {
        if (r < frogRow - 10) {
            deleteMesh(gl, row.gpu);
            state.rows.delete(r);
        }
    }
}

/** Row lookup with a safe fallback (should not normally trigger). */
function getRow(r) {
    return state.rows.get(r) ||
        {r, type: 'grass', trees: [], treeCols: new Set(), objs: []};
}

/** The log (if any) under board position x on a water row. */
function findLog(row, x) {
    return row.objs.find((o) => Math.abs(o.x - x) < o.halfLen + 0.35) || null;
}

/* ------------------------------------------------------------------ */
/* Frog + gameplay                                                     */
/* ------------------------------------------------------------------ */

/** Reset everything and start a fresh run. */
function resetGame() {
    if (!state.fixedSeed) state.seed = (Math.random() * 1e9) >>> 0;
    state.rng = mulberry32(state.seed);
    for (const [, row] of state.rows) deleteMesh(gl, row.gpu);
    state.rows.clear();
    state.gen = {nextRow: -8, lastType: 'grass', runType: 'grass',
        runLeft: 0, pathCol: 0};
    state.frog = {
        x: 0, z: 0, y: 0, row: 0,
        mode: 'idle', hopT: 0,
        from: {x: 0, z: 0, y: 0}, to: {x: 0, z: 0},
        yaw: 0, targetYaw: 0, squash: 0, buffered: null,
    };
    state.mode = 'play';
    state.score = 0;
    state.time = 0;
    state.deathTimer = 0;
    state.deathFade = 0;
    particles.length = 0;
    ensureRows();
    updateHud();
    setStatus('Arrow keys to hop');
}

/** HUD score/best readouts. */
function updateHud() {
    document.getElementById('hud-score').textContent = String(state.score);
    document.getElementById('hud-best').textContent = String(state.best);
}

/** HUD status line. */
function setStatus(msg) {
    document.getElementById('hud-status').textContent = msg;
}

/** Attempt a one-cell hop; dRow=+1 is forward, dx=±1 sideways. */
function tryHop(dx, dRow) {
    const f = state.frog;
    if (state.mode !== 'play') return;
    if (f.mode === 'hop') {
        f.buffered = [dx, dRow]; // queue it — makes rapid input feel snappy
        return;
    }
    const toRow = f.row + dRow;
    if (toRow < Math.max(0, state.score - 3)) return; // don't run home
    const toX = clamp(Math.round(f.x) + dx, MINX, MAXX);
    if (dx !== 0 && toX === Math.round(f.x)) return; // at the board edge
    const target = getRow(toRow);
    if (target.type === 'grass' && target.treeCols.has(toX)) {
        sfx.thud();
        f.squash = 0.7;
        return;
    }
    f.mode = 'hop';
    f.hopT = 0;
    f.from = {x: f.x, z: f.z, y: f.y};
    f.to = {x: toX, z: -toRow};
    f.targetYaw = Math.atan2(-(toX - f.x), -((-toRow) - f.z));
    sfx.hop();
}

/** Kill the frog. cause: 'squash' | 'splash' | 'swept'. */
function die(cause) {
    if (state.mode === 'dead') return;
    state.mode = 'dead';
    state.deathCause = cause;
    state.deathTimer = 0;
    state.best = Math.max(state.best, state.score);
    try {
        localStorage.setItem('csc561-hopper-best', String(state.best));
    } catch (e) {
        // private browsing — fine
    }
    updateHud();
    const label = {squash: 'Squashed!', splash: 'Splash!',
        swept: 'Swept away!'}[cause];
    setStatus(label + ' Score ' + state.score + ' — press R to hop again');
    if (cause === 'squash') {
        sfx.squash();
    } else {
        sfx.splash();
        spawnSplash(state.frog.x, state.frog.z);
    }
    sfx.gameOver();
}

/** Landing resolution at the end of a hop. */
function landFrog() {
    const f = state.frog;
    f.mode = 'idle';
    f.x = f.to.x;
    f.z = f.to.z;
    f.row = Math.round(-f.z);
    f.squash = 1;
    const row = getRow(f.row);
    if (row.type === 'water') {
        const log = findLog(row, f.x);
        if (!log) {
            f.y = 0;
            die('splash');
            return;
        }
        f.y = LOG_TOP;
    } else {
        f.y = 0;
        spawnDust(f.x, f.z);
    }
    if (f.row > state.score) {
        state.score = f.row;
        updateHud();
        sfx.tick();
        if (state.score === 1) setStatus('');
    }
    if (f.buffered) {
        const b = f.buffered;
        f.buffered = null;
        tryHop(b[0], b[1]);
    }
}

/** Per-frame frog simulation. */
function updateFrog(dt) {
    const f = state.frog;

    // Yaw eases toward the last hop direction (shortest arc).
    let d = f.targetYaw - f.yaw;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) -
        Math.PI;
    f.yaw += d * Math.min(1, dt * 16);
    f.squash = Math.max(0, f.squash - dt * 7);

    if (state.mode === 'dead') {
        state.deathTimer += dt;
        state.deathFade = clamp((state.deathTimer - 0.25) / 0.7, 0, 1);
        if (state.deathCause !== 'squash' && f.y > -1.0) {
            f.y -= dt * 1.6; // sink beneath the waves
        }
        return;
    }

    if (f.mode === 'hop') {
        f.hopT += dt / HOP_TIME;
        const t = Math.min(f.hopT, 1);
        f.x = lerp(f.from.x, f.to.x, t);
        f.z = lerp(f.from.z, f.to.z, t);
        f.y = lerp(f.from.y, 0, t) + Math.sin(t * Math.PI) * HOP_HEIGHT;
        if (f.hopT >= 1) landFrog();
        return;
    }

    const row = getRow(f.row);
    if (row.type === 'water') {
        const log = findLog(row, f.x);
        if (!log) {
            die('splash');
            return;
        }
        f.x += row.dir * row.speed * dt; // the river carries you
        f.y = LOG_TOP + Math.sin(state.time * 2.2 + log.bob) * 0.03;
        if (Math.abs(f.x) > 7.3) {
            die('swept');
            return;
        }
    } else if (row.type === 'road') {
        for (const o of row.objs) {
            if (Math.abs(o.x - f.x) < o.halfLen + 0.38) {
                die('squash');
                return;
            }
        }
    }
}

/** Move cars and logs along their lanes, wrapping around the ring. */
function updateRows(dt) {
    for (const [, row] of state.rows) {
        if (!row.speed) continue;
        const dx = row.dir * row.speed * dt;
        for (const o of row.objs) {
            o.x += dx;
            if (o.x > RING / 2) o.x -= RING;
            else if (o.x < -RING / 2) o.x += RING;
        }
    }
}

/** Smooth camera chase; freezes on death. */
function updateCamera(dt) {
    if (state.mode === 'play') {
        const f = state.frog;
        cam.desired = [clamp(f.x, -5, 5) * 0.7, 0, f.z];
    }
    if (!cam.desired) cam.desired = [0, 0, 0];
    const k = 1 - Math.exp(-dt * 4.5);
    for (let i = 0; i < 3; i++) {
        cam.focus[i] = lerp(cam.focus[i], cam.desired[i], k);
    }
    // Camera sits behind/above the frog, aimed a few rows ahead so the frog
    // lands about a third of the way up the frame.
    cam.pos = [cam.focus[0] + 2.5, cam.focus[1] + 8.5, cam.focus[2] + 6.5];
    mat4.lookAt(cam.view, cam.pos,
        [cam.focus[0], cam.focus[1], cam.focus[2] - 3.6], [0, 1, 0]);

    // Project the sun for the sky glow.
    const p = vec4.fromValues(
        cam.pos[0] + SUN_DIR[0] * 50,
        cam.pos[1] + SUN_DIR[1] * 50,
        cam.pos[2] + SUN_DIR[2] * 50, 1);
    vec4.transformMat4(p, p, cam.view);
    vec4.transformMat4(p, p, cam.proj);
    cam.sunScreen = p[3] > 0 ?
        [p[0] / p[3] * 0.5 + 0.5, p[1] / p[3] * 0.5 + 0.5] : [-10, -10];
}

/** Texel-snapped orthographic sun matrix following the camera focus. */
function updateLight() {
    const cx = cam.focus[0];
    const cz = cam.focus[2] - 5;
    const eye = [cx + SUN_DIR[0] * 30, SUN_DIR[1] * 30, cz + SUN_DIR[2] * 30];
    const view = poolMat();
    mat4.lookAt(view, eye, [cx, 0, cz], [0, 1, 0]);
    const proj = poolMat();
    mat4.ortho(proj, -16, 16, -16, 16, 1, 70);
    mat4.multiply(light.vp, proj, view);
    // Snap the projected origin to the shadow texel grid (kills shimmer).
    const o = vec4.fromValues(0, 0, 0, 1);
    vec4.transformMat4(o, o, light.vp);
    const half = SHADOW_SIZE / 2;
    light.vp[12] += (Math.round(o[0] * half) - o[0] * half) / half;
    light.vp[13] += (Math.round(o[1] * half) - o[1] * half) / half;
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

const MAX_PARTICLES = 512;
const particles = [];
const particleData = new Float32Array(MAX_PARTICLES * 8);
let particleVao;
let particleVbo;

/** Add one particle if there's room. */
function addParticle(p) {
    if (particles.length < MAX_PARTICLES) particles.push(p);
}

/** Water splash burst at board position (x, z). */
function spawnSplash(x, z) {
    for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.3;
        const blue = 0.75 + Math.random() * 0.25;
        addParticle({
            x: x + Math.cos(a) * r, y: WATER_Y + 0.05, z: z + Math.sin(a) * r,
            vx: Math.cos(a) * (0.5 + Math.random()),
            vy: 1.6 + Math.random() * 2.2,
            vz: Math.sin(a) * (0.5 + Math.random()),
            life: 0, ttl: 0.5 + Math.random() * 0.4, grav: 9,
            size: 0.14 + Math.random() * 0.16,
            r: 0.75 * blue, g: 0.9 * blue, b: blue,
        });
    }
}

/** Little dust poof on landing. */
function spawnDust(x, z) {
    for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        addParticle({
            x: x + Math.cos(a) * 0.2, y: 0.06, z: z + Math.sin(a) * 0.2,
            vx: Math.cos(a) * 0.7, vy: 0.4 + Math.random() * 0.4,
            vz: Math.sin(a) * 0.7,
            life: 0, ttl: 0.3 + Math.random() * 0.2, grav: 1.5,
            size: 0.10 + Math.random() * 0.10,
            r: 0.9, g: 0.88, b: 0.8,
        });
    }
}

/** Integrate particles and stream them into the dynamic VBO. */
function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life > p.ttl) {
            particles[i] = particles[particles.length - 1];
            particles.pop();
            continue;
        }
        p.vy -= p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
    }
    let off = 0;
    for (const p of particles) {
        const fade = 1 - p.life / p.ttl;
        particleData[off++] = p.x;
        particleData[off++] = p.y;
        particleData[off++] = p.z;
        particleData[off++] = p.size * (0.6 + 0.4 * fade);
        particleData[off++] = p.r;
        particleData[off++] = p.g;
        particleData[off++] = p.b;
        particleData[off++] = fade;
    }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const frameDraws = [];

/** Collect this frame's (mesh, modelMatrix) pairs for both passes. */
function buildDraws() {
    frameDraws.length = 0;
    matPoolUsed = 0;

    for (const [, row] of state.rows) {
        if (row.gpu) frameDraws.push({gpu: row.gpu, model: IDENTITY});
        for (const o of row.objs) {
            const m = poolMat();
            let y = 0;
            if (o.kind === 'log') {
                y = -0.04 + Math.sin(state.time * 2.2 + o.bob) * 0.03;
            }
            mat4.translate(m, m, [o.x, y, -row.r]);
            if (row.dir < 0) mat4.rotateY(m, m, Math.PI);
            if (o.kind === 'log') mat4.scale(m, m, [o.len, 1, 1]);
            const mesh = o.kind === 'log' ? gpu.log :
                o.kind === 'truck' ? gpu.trucks[o.meshIdx % gpu.trucks.length] :
                    gpu.cars[o.meshIdx];
            frameDraws.push({gpu: mesh, model: m});
        }
    }

    // Frog: squash & stretch via nonuniform scale.
    const f = state.frog;
    const m = poolMat();
    mat4.translate(m, m, [f.x, f.y, f.z]);
    mat4.rotateY(m, m, f.yaw);
    if (state.mode === 'dead' && state.deathCause === 'squash') {
        mat4.scale(m, m, [1.35, 0.09, 1.35]);
    } else {
        const sy = f.mode === 'hop' ?
            1 + Math.sin(Math.min(f.hopT, 1) * Math.PI) * 0.18 :
            1 - 0.24 * f.squash;
        const sxz = 1 + 0.16 * f.squash;
        mat4.scale(m, m, [sxz, sy, sxz]);
    }
    frameDraws.push({gpu: gpu.frog, model: m});
}

/** Pass 1: scene depth from the sun into the shadow map. */
function renderShadow() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.shadow.fbo);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT); // front-face culling reduces shadow acne
    const p = progs.shadow;
    gl.useProgram(p.prog);
    gl.uniformMatrix4fv(p.u.uLightVP, false, light.vp);
    for (const d of frameDraws) {
        gl.uniformMatrix4fv(p.u.uModel, false, d.model);
        gl.bindVertexArray(d.gpu.vao);
        gl.drawArrays(gl.TRIANGLES, 0, d.gpu.count);
    }
    gl.cullFace(gl.BACK);
}

/** Pass 2: the lit scene into the (possibly multisampled) offscreen FBO. */
function renderScene() {
    const target = fbos.msaa ? fbos.msaa.fbo : fbos.resolve.fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(HORIZON[0], HORIZON[1], HORIZON[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Sky gradient (attribute-less fullscreen triangle behind everything).
    gl.disable(gl.DEPTH_TEST);
    const sky = progs.sky;
    gl.useProgram(sky.prog);
    gl.uniform3fv(sky.u.uZenith, ZENITH);
    gl.uniform3fv(sky.u.uHorizon, HORIZON);
    gl.uniform2fv(sky.u.uSunScreen, cam.sunScreen);
    gl.bindVertexArray(fbos.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fbos.shadow.tex);

    // Opaque geometry.
    const sc = progs.scene;
    gl.useProgram(sc.prog);
    gl.uniformMatrix4fv(sc.u.uProj, false, cam.proj);
    gl.uniformMatrix4fv(sc.u.uView, false, cam.view);
    gl.uniformMatrix4fv(sc.u.uLightVP, false, light.vp);
    gl.uniform3fv(sc.u.uSunDir, SUN_DIR);
    gl.uniform3fv(sc.u.uSunColor, SUN_COLOR);
    gl.uniform3fv(sc.u.uSkyAmbient, SKY_AMBIENT);
    gl.uniform3fv(sc.u.uGroundAmbient, GROUND_AMBIENT);
    gl.uniform3fv(sc.u.uCamPos, cam.pos);
    gl.uniform3fv(sc.u.uFogColor, HORIZON);
    gl.uniform1f(sc.u.uFogDensity, FOG_DENSITY);
    gl.uniform1f(sc.u.uShadowTexel, 1 / SHADOW_SIZE);
    gl.uniform1i(sc.u.uShadowMap, 1);
    for (const d of frameDraws) {
        gl.uniformMatrix4fv(sc.u.uModel, false, d.model);
        if (d.model === IDENTITY) {
            gl.uniformMatrix3fv(sc.u.uNormalMat, false, IDENTITY3);
        } else {
            mat3.normalFromMat4(normalMat, d.model);
            gl.uniformMatrix3fv(sc.u.uNormalMat, false, normalMat);
        }
        gl.bindVertexArray(d.gpu.vao);
        gl.drawArrays(gl.TRIANGLES, 0, d.gpu.count);
    }

    // Water: one big animated plane under the whole world.
    const wt = progs.water;
    gl.useProgram(wt.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const wm = poolMat();
    mat4.translate(wm, wm,
        [Math.round(cam.focus[0]), WATER_Y, Math.round(cam.focus[2])]);
    gl.uniformMatrix4fv(wt.u.uProj, false, cam.proj);
    gl.uniformMatrix4fv(wt.u.uView, false, cam.view);
    gl.uniformMatrix4fv(wt.u.uModel, false, wm);
    gl.uniformMatrix4fv(wt.u.uLightVP, false, light.vp);
    gl.uniform1f(wt.u.uTime, state.time);
    gl.uniform3fv(wt.u.uSunDir, SUN_DIR);
    gl.uniform3fv(wt.u.uSunColor, SUN_COLOR);
    gl.uniform3fv(wt.u.uCamPos, cam.pos);
    gl.uniform3fv(wt.u.uDeepColor, [0.13, 0.46, 0.66]);
    gl.uniform3fv(wt.u.uShallowColor, [0.22, 0.64, 0.78]);
    gl.uniform3fv(wt.u.uSkyReflect, [0.75, 0.88, 0.95]);
    gl.uniform3fv(wt.u.uFogColor, HORIZON);
    gl.uniform1f(wt.u.uFogDensity, FOG_DENSITY);
    gl.uniform1f(wt.u.uShadowTexel, 1 / SHADOW_SIZE);
    gl.uniform1i(wt.u.uShadowMap, 1);
    gl.bindVertexArray(waterGrid.vao);
    gl.drawElements(gl.TRIANGLES, waterGrid.count, gl.UNSIGNED_SHORT, 0);

    // Particles.
    if (particles.length > 0) {
        const pp = progs.particle;
        gl.useProgram(pp.prog);
        gl.depthMask(false);
        gl.uniformMatrix4fv(pp.u.uProj, false, cam.proj);
        gl.uniformMatrix4fv(pp.u.uView, false, cam.view);
        gl.uniform1f(pp.u.uPointScale, canvas.height * 0.5 * cam.proj[5]);
        gl.bindVertexArray(particleVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0,
            particleData.subarray(0, particles.length * 8));
        gl.drawArrays(gl.POINTS, 0, particles.length);
        gl.depthMask(true);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
}

/** Pass 3: resolve MSAA and run the post-process onto the canvas. */
function renderPost() {
    if (fbos.msaa) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbos.msaa.fbo);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbos.resolve.fbo);
        gl.blitFramebuffer(0, 0, canvas.width, canvas.height,
            0, 0, canvas.width, canvas.height,
            gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    const p = progs.post;
    gl.useProgram(p.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbos.resolve.tex);
    gl.uniform1i(p.u.uScene, 0);
    gl.uniform1f(p.u.uDeathFade, state.deathFade);
    gl.bindVertexArray(fbos.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ------------------------------------------------------------------ */
/* GL setup                                                            */
/* ------------------------------------------------------------------ */

/** Shadow map, MSAA scene buffer, and resolve texture. */
function setupFramebuffers() {
    // Depth-only shadow FBO with hardware depth comparison.
    const shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24,
        SHADOW_SIZE, SHADOW_SIZE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE,
        gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D, shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    fbos.shadow = {fbo: shadowFbo, tex: shadowTex};

    // Resolve target (also the direct target if MSAA is unavailable).
    const resolveTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, resolveTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, canvas.width, canvas.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const resolveFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, resolveTex, 0);
    fbos.resolve = {fbo: resolveFbo, tex: resolveTex};
    let depthRb = null;

    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    if (samples > 1) {
        const colorRb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, colorRb);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples,
            gl.RGBA8, canvas.width, canvas.height);
        depthRb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples,
            gl.DEPTH_COMPONENT24, canvas.width, canvas.height);
        const msaaFbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.RENDERBUFFER, colorRb);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER, depthRb);
        fbos.msaa = {fbo: msaaFbo};
    } else {
        // No MSAA: the resolve FBO needs its own depth buffer.
        depthRb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24,
            canvas.width, canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER, depthRb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Empty VAO for attribute-less fullscreen triangles.
    fbos.emptyVao = gl.createVertexArray();
}

/** Upload the archetype meshes and the particle stream buffer. */
function setupMeshes() {
    gpu.frog = uploadMesh(gl, buildFrog());
    gpu.cars = CAR_COLORS.map((c) => uploadMesh(gl, buildCar(c)));
    gpu.trucks = [[0.85, 0.35, 0.32], [0.33, 0.52, 0.78], [0.9, 0.62, 0.25]]
        .map((c) => uploadMesh(gl, buildTruck(c)));
    gpu.log = uploadMesh(gl, buildLog());

    waterGrid = buildWaterGrid(gl, 96, 1.0);

    particleVao = gl.createVertexArray();
    particleVbo = gl.createBuffer();
    gl.bindVertexArray(particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, particleVbo);
    gl.bufferData(gl.ARRAY_BUFFER, particleData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

const KEY_HOPS = {
    ArrowUp: [0, 1], KeyW: [0, 1],
    ArrowDown: [0, -1], KeyS: [0, -1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0],
};

/** Keyboard: hops, plus R (or Enter/Space when dead) to restart. */
function onKeyDown(ev) {
    sfx.ensure();
    const hop = KEY_HOPS[ev.code];
    if (hop) {
        ev.preventDefault();
        tryHop(hop[0], hop[1]);
        return;
    }
    if (ev.code === 'KeyR' ||
        (state.mode === 'dead' &&
            (ev.code === 'Enter' || ev.code === 'Space'))) {
        ev.preventDefault();
        resetGame();
    }
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

let lastNow = 0;

/** Per-frame driver. */
function frame(now) {
    const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0;
    lastNow = now;
    state.time += dt;

    updateRows(dt);
    updateFrog(dt);
    ensureRows();
    updateCamera(dt);
    updateLight();
    updateParticles(dt);

    buildDraws();
    renderShadow();
    renderScene();
    renderPost();
    requestAnimationFrame(frame);
}

/** Boot: GL context, programs, buffers, world, input, loop. */
function main() {
    canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl2', {antialias: false, alpha: false});
    if (!gl) {
        setStatus('WebGL2 is not available in this browser.');
        return;
    }

    progs.scene = createProgram(gl, SCENE_VS, SCENE_FS);
    progs.shadow = createProgram(gl, SHADOW_VS, SHADOW_FS);
    progs.water = createProgram(gl, WATER_VS, WATER_FS);
    progs.sky = createProgram(gl, SKY_VS, SKY_FS);
    progs.particle = createProgram(gl, PARTICLE_VS, PARTICLE_FS);
    progs.post = createProgram(gl, POST_VS, POST_FS);

    setupFramebuffers();
    setupMeshes();

    mat4.perspective(cam.proj, 46 * Math.PI / 180,
        canvas.width / canvas.height, 0.1, 120);

    const urlSeed = new URLSearchParams(location.search).get('seed');
    if (urlSeed !== null) {
        state.seed = Number(urlSeed) >>> 0;
        state.fixedSeed = true;
    }
    try {
        state.best = Number(localStorage.getItem('csc561-hopper-best')) || 0;
    } catch (e) {
        // no localStorage — fine
    }

    resetGame();
    window.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(frame);
}

/* Debug/test hook: lets the automated playtest read state and steer. */
window.HOPPER = {
    get state() {
        const f = state.frog;
        return {mode: state.mode, score: state.score, best: state.best,
            seed: state.seed, cause: state.deathCause || null,
            time: state.time,
            frog: {x: f.x, y: f.y, z: f.z, row: f.row, anim: f.mode}};
    },
    rowInfo(r) {
        const row = getRow(r);
        return {type: row.type, dir: row.dir, speed: row.speed,
            trees: [...row.treeCols],
            objs: row.objs.map((o) => ({x: o.x, halfLen: o.halfLen,
                kind: o.kind}))};
    },
    hop: tryHop,
    reset: resetGame,
    /** Test-only: force world generation up to the given row. */
    extend(upTo) {
        while (state.gen.nextRow < upTo) genRow();
    },
    /** Test-only teleport: set the frog down at (x, row) immediately. */
    place(x, row) {
        const f = state.frog;
        f.mode = 'idle';
        f.buffered = null;
        f.x = x;
        f.z = -row;
        f.y = 0;
        f.row = row;
        ensureRows();
        cam.desired = [clamp(x, -5, 5) * 0.7, 0, -row];
        cam.focus = cam.desired.slice();
    },
};

main();
