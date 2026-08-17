/**
 * game.js — "Hopper": an endless low-poly river-crossing game.
 *
 * A ground-up WebGL2 rewrite of the classic Frogger assignment, built to
 * showcase graphics techniques rather than fixed-function-style drawing.
 * This module is the gameplay: frog state, hopping, collisions, HUD,
 * input and the frame loop. Everything else is split out:
 *
 *   renderer.js  — all WebGL: shadow / scene / post passes, camera, light
 *   shaders.js   — GLSL sources
 *   meshes.js    — procedural vertex-colored box geometry + GPU upload
 *   world.js     — seeded lane generation and lane-object movement
 *   particles.js — CPU particle sim packed for the GPU point-sprite pass
 *   audio.js     — WebAudio synth sound effects
 *   constants.js — tuning knobs and palette
 */
/* global mat4 */

import {createRenderer} from './renderer.js';
import {createWorld} from './world.js';
import {sfx} from './audio.js';
import {
    spawnSplash, spawnDust, clearParticles, updateParticles,
} from './particles.js';
import {MINX, MAXX, LOG_TOP, HOP_TIME, HOP_HEIGHT, clamp, lerp}
    from './constants.js';

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */

let renderer;
let world;

const state = {
    seed: 0,
    fixedSeed: false,
    time: 0,
    mode: 'play', // 'play' | 'dead'
    deathCause: null,
    score: 0,
    best: 0,
    deathTimer: 0,
    deathFade: 0,
    frog: null,
};

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

/** HUD score/best readouts. */
function updateHud() {
    document.getElementById('hud-score').textContent = String(state.score);
    document.getElementById('hud-best').textContent = String(state.best);
}

/** HUD status line. */
function setStatus(msg) {
    document.getElementById('hud-status').textContent = msg;
}

/* ------------------------------------------------------------------ */
/* Frog + gameplay                                                     */
/* ------------------------------------------------------------------ */

/** Reset everything and start a fresh run. */
function resetGame() {
    if (!state.fixedSeed) state.seed = (Math.random() * 1e9) >>> 0;
    world.reset(state.seed);
    state.frog = {
        x: 0, z: 0, y: 0, row: 0,
        mode: 'idle', hopT: 0,
        from: {x: 0, z: 0, y: 0}, to: {x: 0, z: 0},
        yaw: 0, targetYaw: 0, squash: 0, buffered: null,
    };
    state.mode = 'play';
    state.deathCause = null;
    state.score = 0;
    state.time = 0;
    state.deathTimer = 0;
    state.deathFade = 0;
    clearParticles();
    world.ensureRows(0);
    updateHud();
    setStatus('Arrow keys to hop');
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
    const target = world.getRow(toRow);
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
    const row = world.getRow(f.row);
    if (row.type === 'water') {
        if (!world.findLog(row, f.x)) {
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

    const row = world.getRow(f.row);
    if (row.type === 'water') {
        const log = world.findLog(row, f.x);
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

/* ------------------------------------------------------------------ */
/* Draw list                                                           */
/* ------------------------------------------------------------------ */

const frameDraws = [];

/** Collect this frame's {gpu, model} pairs for the renderer. */
function buildDraws() {
    const {gpu, poolMat, IDENTITY} = renderer;
    frameDraws.length = 0;
    renderer.beginFrame();

    for (const [, row] of world.rows) {
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
    return frameDraws;
}

/** Camera focus for the current frog position. */
function cameraTarget() {
    const f = state.frog;
    return [clamp(f.x, -5, 5) * 0.7, 0, f.z];
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

    world.update(dt);
    updateFrog(dt);
    world.ensureRows(state.frog.row);
    // The camera freezes where it was when the frog dies.
    renderer.updateCamera(state.mode === 'play' ? cameraTarget() : null, dt);
    renderer.updateLight();
    const particles = updateParticles(dt);

    renderer.render({
        draws: buildDraws(),
        time: state.time,
        deathFade: state.deathFade,
        particleData: particles.data,
        particleCount: particles.count,
    });
    requestAnimationFrame(frame);
}

/** Boot: renderer, world, saved best, input, loop. */
function main() {
    renderer = createRenderer(document.getElementById('glCanvas'));
    if (!renderer) {
        setStatus('WebGL2 is not available in this browser.');
        return;
    }
    world = createWorld(renderer.gl);

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
            seed: state.seed, cause: state.deathCause,
            time: state.time,
            frog: {x: f.x, y: f.y, z: f.z, row: f.row, anim: f.mode}};
    },
    rowInfo(r) {
        const row = world.getRow(r);
        return {type: row.type, dir: row.dir, speed: row.speed,
            trees: [...row.treeCols],
            objs: row.objs.map((o) => ({x: o.x, halfLen: o.halfLen,
                kind: o.kind}))};
    },
    hop: tryHop,
    reset: resetGame,
    /** Test-only: force world generation up to the given row. */
    extend(upTo) {
        world.extend(upTo);
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
        world.ensureRows(row);
        renderer.cam.desired = cameraTarget();
        renderer.cam.focus = renderer.cam.desired.slice();
    },
};

main();
