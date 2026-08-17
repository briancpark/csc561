/**
 * world.js — seeded procedural lane generation for Hopper.
 *
 * Rows are generated strictly in order and kept in a sliding window
 * around the frog. Each row owns its static terrain mesh (uploaded once)
 * and, for road/water rows, a lane of moving objects that wrap around a
 * ring wider than the visible board.
 */

import {
    MINX, MAXX, SLAB_COLS, RING, GRASS_A, GRASS_B, DIRT, ASPHALT, DASH,
    CAR_COLORS, clamp,
} from './constants.js';
import {
    newMesh, addBox, shade, addTree, uploadMesh, deleteMesh,
} from './meshes.js';

/** Deterministic PRNG (mulberry32) so runs are reproducible via ?seed=. */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const EMPTY_ROW = Object.freeze({
    r: 0, type: 'grass', trees: [], treeCols: new Set(), objs: [],
    dir: 0, speed: 0, gpu: null,
});

/** Build the static terrain mesh for one row (baked in world coords). */
function buildRowMesh(gl, row) {
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

/**
 * Create the world container. `gl` is needed to upload row meshes.
 * Call reset(seed) before use.
 */
export function createWorld(gl) {
    const rows = new Map();
    let rng = null;
    let gen = null;

    /** Generate the next row in sequence. */
    function genRow() {
        const g = gen;
        const r = g.nextRow++;
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
            g.pathCol = clamp(g.pathCol + Math.floor(rng() * 3) - 1,
                MINX, MAXX);
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
        buildRowMesh(gl, row);
        rows.set(r, row);
    }

    return {
        rows,

        /** Drop everything and start a fresh sequence from the seed. */
        reset(seed) {
            rng = mulberry32(seed);
            for (const [, row] of rows) deleteMesh(gl, row.gpu);
            rows.clear();
            gen = {nextRow: -8, lastType: 'grass', runType: 'grass',
                runLeft: 0, pathCol: 0};
        },

        /** Keep a window of rows around frogRow; free rows far behind. */
        ensureRows(frogRow) {
            while (gen.nextRow < frogRow + 24) genRow();
            for (const [r, row] of rows) {
                if (r < frogRow - 10) {
                    deleteMesh(gl, row.gpu);
                    rows.delete(r);
                }
            }
        },

        /** Force generation up to (not including) the given row. */
        extend(upTo) {
            while (gen.nextRow < upTo) genRow();
        },

        /** Row lookup with a safe empty fallback. */
        getRow(r) {
            return rows.get(r) || EMPTY_ROW;
        },

        /** The log (if any) under board position x on a water row. */
        findLog(row, x) {
            return row.objs.find(
                (o) => Math.abs(o.x - x) < o.halfLen + 0.35) || null;
        },

        /** Advance cars and logs along their lanes, wrapping on the ring. */
        update(dt) {
            for (const [, row] of rows) {
                if (!row.speed) continue;
                const dx = row.dir * row.speed * dt;
                for (const o of row.objs) {
                    o.x += dx;
                    if (o.x > RING / 2) o.x -= RING;
                    else if (o.x < -RING / 2) o.x += RING;
                }
            }
        },
    };
}
