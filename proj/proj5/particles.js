/**
 * particles.js — CPU-simulated particles packed into a Float32Array that
 * the renderer streams to a dynamic VBO each frame.
 *
 * Layout per particle (8 floats): x, y, z, size, r, g, b, alpha.
 */

import {WATER_Y} from './constants.js';

export const MAX_PARTICLES = 512;
export const FLOATS_PER_PARTICLE = 8;

const particles = [];
const data = new Float32Array(MAX_PARTICLES * FLOATS_PER_PARTICLE);

/** Add one particle if there's room. */
function add(p) {
    if (particles.length < MAX_PARTICLES) particles.push(p);
}

/** Water splash burst at board position (x, z). */
export function spawnSplash(x, z) {
    for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.3;
        const blue = 0.75 + Math.random() * 0.25;
        add({
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
export function spawnDust(x, z) {
    for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        add({
            x: x + Math.cos(a) * 0.2, y: 0.06, z: z + Math.sin(a) * 0.2,
            vx: Math.cos(a) * 0.7, vy: 0.4 + Math.random() * 0.4,
            vz: Math.sin(a) * 0.7,
            life: 0, ttl: 0.3 + Math.random() * 0.2, grav: 1.5,
            size: 0.10 + Math.random() * 0.10,
            r: 0.9, g: 0.88, b: 0.8,
        });
    }
}

/** Remove all particles. */
export function clearParticles() {
    particles.length = 0;
}

/**
 * Integrate and repack. Returns {data, count} — `data` is the shared
 * Float32Array with the first count*8 floats valid this frame.
 */
export function updateParticles(dt) {
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
        data[off++] = p.x;
        data[off++] = p.y;
        data[off++] = p.z;
        data[off++] = p.size * (0.6 + 0.4 * fade);
        data[off++] = p.r;
        data[off++] = p.g;
        data[off++] = p.b;
        data[off++] = fade;
    }
    return {data, count: particles.length};
}
