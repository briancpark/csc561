/**
 * constants.js — tuning knobs and palette shared by the Hopper modules.
 */

/* Board geometry (one grid cell = one world unit). */
export const MINX = -5; // playable column range
export const MAXX = 5;
export const SLAB_COLS = 8; // terrain spans x in [-8, 8]
export const RING = 22; // moving objects wrap over x in [-11, 11]
export const WATER_Y = -0.16;
export const LOG_TOP = 0.10;

/* Frog feel. */
export const HOP_TIME = 0.14;
export const HOP_HEIGHT = 0.45;

/* Rendering. */
export const SHADOW_SIZE = 2048;
export const SUN_DIR = [0.50, 1.0, 0.42];
export const SUN_COLOR = [1.12, 1.04, 0.92];
export const SKY_AMBIENT = [0.40, 0.47, 0.56];
export const GROUND_AMBIENT = [0.26, 0.23, 0.21];
export const ZENITH = [0.30, 0.56, 0.92];
export const HORIZON = [0.78, 0.88, 0.96];
export const FOG_DENSITY = 0.030;
export const WATER_DEEP = [0.13, 0.46, 0.66];
export const WATER_SHALLOW = [0.22, 0.64, 0.78];
export const WATER_SKY = [0.75, 0.88, 0.95];

/* Palette. */
export const GRASS_A = [0.45, 0.74, 0.35];
export const GRASS_B = [0.40, 0.68, 0.31];
export const DIRT = [0.42, 0.30, 0.20];
export const ASPHALT = [0.23, 0.24, 0.28];
export const DASH = [0.85, 0.80, 0.55];
export const CAR_COLORS = [
    [0.93, 0.42, 0.38], [0.30, 0.75, 0.70], [0.95, 0.78, 0.30],
    [0.68, 0.55, 0.90], [0.35, 0.55, 0.90], [0.92, 0.92, 0.95],
];
export const TRUCK_COLORS = [
    [0.85, 0.35, 0.32], [0.33, 0.52, 0.78], [0.9, 0.62, 0.25],
];

/* Small math helpers used across modules. */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
