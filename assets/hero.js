/**
 * hero.js — ray-marched metaball backdrop for the landing page.
 *
 * A single fullscreen fragment shader sphere-traces a smooth-min union of
 * signed-distance spheres, shades them with a rim/fresnel light in the
 * per-project accent hues, and adds a soft halo from the closest-approach
 * distance of missed rays. Blob positions are animated on the CPU
 * (Lissajous drift + cursor attraction + click repulsion) and passed as
 * uniforms. Renders at reduced resolution — the blobs are soft, so it
 * upscales cleanly. GLSL lives in hero-shaders.js; GL boilerplate in
 * gl-utils.js.
 */

import {createProgram, hexToRgb} from './gl-utils.js';
import {heroFragmentSource, HERO_VERTEX_SOURCE} from './hero-shaders.js';

const BLOB_COUNT = 12;

const ACCENTS = [
    [0.478, 0.635, 1.0], // site accent
    [1.0, 0.706, 0.329], // p1
    [0.365, 0.827, 0.620], // p2
    [0.400, 0.702, 1.0], // p3
    [0.710, 0.549, 1.0], // p4
    [1.0, 0.494, 0.714], // p5
    [0.478, 0.635, 1.0],
    [1.0, 0.706, 0.329],
    [0.365, 0.827, 0.620],
    [0.400, 0.702, 1.0],
    [0.710, 0.549, 1.0],
    [1.0, 0.494, 0.714],
];

/** Boot the hero; silently does nothing without WebGL2. */
function initHero() {
    const canvas = document.getElementById('hero-gl');
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', {antialias: false, alpha: false});
    if (!gl) return;

    let program;
    try {
        program = createProgram(gl, HERO_VERTEX_SOURCE,
            heroFragmentSource(BLOB_COUNT));
    } catch (err) {
        console.error(err);
        return;
    }
    const {prog, u} = program;
    gl.useProgram(prog);
    const {uRes, uTime, uBlobs, uColors, uBg, uLight} = u;
    gl.bindVertexArray(gl.createVertexArray());

    const bgHex = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg').trim() || '#0b0e14';
    gl.uniform3fv(uBg, hexToRgb(bgHex));
    gl.uniform3fv(uColors, ACCENTS.flat());

    // Blob motion: a base center, Lissajous drift, cursor pull, and an
    // eased velocity so interaction feels weighty rather than snappy.
    const blobs = [];
    for (let i = 0; i < BLOB_COUNT; i++) {
        const a = (i / BLOB_COUNT) * Math.PI * 2 + (i % 2) * 0.3;
        const ring = i % 2 ? 2.2 : 3.8; // inner and outer rings
        blobs.push({
            cx: Math.cos(a) * ring + 1.9, cy: Math.sin(a) * ring * 0.42 + 0.6,
            cz: (i % 3) * 0.6 - 0.6,
            ax: 0.5 + (i % 3) * 0.25, ay: 0.35 + (i % 2) * 0.3,
            fx: 0.17 + i * 0.019, fy: 0.13 + i * 0.027, ph: i * 1.7,
            r: 0.30 + (i % 3) * 0.10,
            x: 0, y: 0, z: 0, vx: 0, vy: 0,
        });
    }
    const blobData = new Float32Array(BLOB_COUNT * 4);

    // Cursor in scene units on the z = 0 plane (matches the shader camera).
    const mouse = {x: 0, y: 0, active: false, kick: 0};
    const lightPos = [2.5, 1.5, 2.5]; // eases toward the cursor
    const toScene = (px, py) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const nx = (2 * px - w) / h;
        const ny = -(2 * py - h) / h;
        return [nx * 0.5 * 6, ny * 0.5 * 6]; // rd.xy*0.5 scaled to depth 6
    };
    window.addEventListener('pointermove', (e) => {
        [mouse.x, mouse.y] = toScene(e.clientX, e.clientY);
        mouse.active = true;
    }, {passive: true});
    window.addEventListener('pointerdown', (e) => {
        [mouse.x, mouse.y] = toScene(e.clientX, e.clientY);
        mouse.active = true;
        mouse.kick = 1;
    }, {passive: true});
    window.addEventListener('pointerleave', () => {
        mouse.active = false;
    });
    document.addEventListener('mouseleave', () => {
        mouse.active = false;
    });

    const reduceMotion =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    const renderScale = isMobile ? 0.4 : 0.55;

    const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(window.innerWidth * dpr * renderScale);
        const h = Math.round(window.innerHeight * dpr * renderScale);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
    };
    window.addEventListener('resize', resize, {passive: true});
    resize();

    let start = 0;
    let last = 0;
    const frame = (now) => {
        if (!start) start = now;
        const time = (now - start) / 1000;
        const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
        last = now;
        // Ease-out intro: blobs swell in from nothing over ~1.8 s.
        const intro = reduceMotion ? 1 :
            1 - Math.pow(1 - Math.min(time / 1.8, 1), 3);
        mouse.kick *= Math.exp(-dt * 4);

        for (let i = 0; i < BLOB_COUNT; i++) {
            const b = blobs[i];
            const t = time + b.ph;
            const tx = b.cx + Math.sin(t * b.fx * Math.PI * 2) * b.ax;
            const ty = b.cy + Math.cos(t * b.fy * Math.PI * 2) * b.ay;
            let goalX = tx;
            let goalY = ty;
            if (mouse.active) {
                const dx = mouse.x - tx;
                const dy = mouse.y - ty;
                const dist2 = dx * dx + dy * dy;
                const pull = 0.55 * Math.exp(-dist2 / 7);
                goalX += dx * pull;
                goalY += dy * pull;
                if (mouse.kick > 0.01) {
                    const dist = Math.sqrt(dist2) + 0.3;
                    const push = mouse.kick * 1.4 * Math.exp(-dist2 / 5);
                    goalX -= dx / dist * push;
                    goalY -= dy / dist * push;
                }
            }
            // Critically-damped-ish spring toward the goal.
            b.vx += (goalX - b.x) * 9 * dt;
            b.vy += (goalY - b.y) * 9 * dt;
            b.vx *= Math.exp(-dt * 5);
            b.vy *= Math.exp(-dt * 5);
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.z = b.cz + Math.sin(t * 0.21) * 0.35;
            blobData[i * 4] = b.x;
            blobData[i * 4 + 1] = b.y;
            blobData[i * 4 + 2] = b.z;
            blobData[i * 4 + 3] = b.r * intro;
        }

        // Light: follows the cursor (hovering in front of the blobs); when
        // the cursor is away it slowly circles so the scene never goes flat.
        const lx = mouse.active ? mouse.x : Math.cos(time * 0.25) * 2.5 + 1.4;
        const ly = mouse.active ? mouse.y : Math.sin(time * 0.31) * 1.2 + 0.6;
        const lk = 1 - Math.exp(-dt * 10);
        lightPos[0] += (lx - lightPos[0]) * lk;
        lightPos[1] += (ly - lightPos[1]) * lk;
        lightPos[2] = 2.2;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, time);
        gl.uniform4fv(uBlobs, blobData);
        gl.uniform3fv(uLight, lightPos);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (!reduceMotion) requestAnimationFrame(frame);
    };
    // Snap the blobs to their first goal so they don't fly in from origin.
    for (const b of blobs) {
        b.x = b.cx + Math.sin(b.ph * b.fx * Math.PI * 2) * b.ax;
        b.y = b.cy + Math.cos(b.ph * b.fy * Math.PI * 2) * b.ay;
    }
    if (reduceMotion) {
        frame(0); // one static frame, no animation loop
    } else {
        requestAnimationFrame(frame);
    }
    canvas.classList.add('is-ready');
}

initHero();
