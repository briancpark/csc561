/**
 * renderer.js — every WebGL2 call in Hopper lives here.
 *
 * Frame pipeline:
 *   1. shadow pass — depth from the sun into a 2048² depth texture
 *   2. scene pass  — sky, lit geometry, animated water, particles into a
 *                    multisampled offscreen framebuffer
 *   3. post pass   — MSAA resolve + tonemap/vignette/death fade to canvas
 *
 * The game hands over a list of {gpu, model} draws plus a few scalars;
 * the renderer owns the camera, sun light, programs, framebuffers, and
 * the uploaded archetype meshes. Uses the class copy of gl-matrix
 * (global mat3/mat4/vec4).
 */
/* global mat3, mat4, vec4 */

import {createProgram} from '../../assets/gl-utils.js';
import {
    SCENE_VS, SCENE_FS, SHADOW_VS, SHADOW_FS, WATER_VS, WATER_FS,
    SKY_VS, SKY_FS, PARTICLE_VS, PARTICLE_FS, POST_VS, POST_FS,
} from './shaders.js';
import {
    buildFrog, buildCar, buildTruck, buildLog, uploadMesh, buildWaterGrid,
} from './meshes.js';
import {
    SHADOW_SIZE, SUN_DIR, SUN_COLOR, SKY_AMBIENT, GROUND_AMBIENT, ZENITH,
    HORIZON, FOG_DENSITY, WATER_Y, WATER_DEEP, WATER_SHALLOW, WATER_SKY,
    CAR_COLORS, TRUCK_COLORS, lerp,
} from './constants.js';
import {MAX_PARTICLES, FLOATS_PER_PARTICLE} from './particles.js';

const IDENTITY = mat4.create();
const IDENTITY3 = mat3.create();

/**
 * Create the renderer for a canvas. Returns null if WebGL2 is missing.
 */
export function createRenderer(canvas) {
    const gl = canvas.getContext('webgl2', {antialias: false, alpha: false});
    if (!gl) return null;

    /* ---- programs ---- */
    const progs = {
        scene: createProgram(gl, SCENE_VS, SCENE_FS),
        shadow: createProgram(gl, SHADOW_VS, SHADOW_FS),
        water: createProgram(gl, WATER_VS, WATER_FS),
        sky: createProgram(gl, SKY_VS, SKY_FS),
        particle: createProgram(gl, PARTICLE_VS, PARTICLE_FS),
        post: createProgram(gl, POST_VS, POST_FS),
    };

    /* ---- framebuffers ---- */
    const fbos = setupFramebuffers(gl, canvas.width, canvas.height);

    /* ---- archetype meshes + particle stream buffer ---- */
    const gpu = {
        frog: uploadMesh(gl, buildFrog()),
        cars: CAR_COLORS.map((c) => uploadMesh(gl, buildCar(c))),
        trucks: TRUCK_COLORS.map((c) => uploadMesh(gl, buildTruck(c))),
        log: uploadMesh(gl, buildLog()),
    };
    const waterGrid = buildWaterGrid(gl, 96, 1.0);
    const particleVao = gl.createVertexArray();
    const particleVbo = gl.createBuffer();
    gl.bindVertexArray(particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, particleVbo);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * FLOATS_PER_PARTICLE * 4,
        gl.DYNAMIC_DRAW);
    const pStride = FLOATS_PER_PARTICLE * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, pStride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, pStride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, pStride, 16);
    gl.bindVertexArray(null);

    /* ---- camera + light ---- */
    const cam = {
        pos: [0, 8.5, 6.5],
        focus: [0, 0, 0],
        desired: [0, 0, 0],
        proj: mat4.create(),
        view: mat4.create(),
        sunScreen: [-10, -10],
    };
    mat4.perspective(cam.proj, 46 * Math.PI / 180,
        canvas.width / canvas.height, 0.1, 120);
    const lightVP = mat4.create();
    const normalMat = mat3.create();

    /* Per-frame scratch matrices so draws don't allocate. */
    const matPool = [];
    let matPoolUsed = 0;
    const poolMat = () => {
        if (matPoolUsed === matPool.length) matPool.push(mat4.create());
        return mat4.identity(matPool[matPoolUsed++]);
    };

    /**
     * Ease the camera toward `target` ([x, y, z] focus point) or, if null,
     * hold the last target (used to freeze the camera on death).
     */
    function updateCamera(target, dt) {
        if (target) cam.desired = target;
        const k = 1 - Math.exp(-dt * 4.5);
        for (let i = 0; i < 3; i++) {
            cam.focus[i] = lerp(cam.focus[i], cam.desired[i], k);
        }
        // Camera sits behind/above the focus, aimed a few rows ahead so
        // the frog lands about a third of the way up the frame.
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
        const eye = [cx + SUN_DIR[0] * 30, SUN_DIR[1] * 30,
            cz + SUN_DIR[2] * 30];
        const view = poolMat();
        mat4.lookAt(view, eye, [cx, 0, cz], [0, 1, 0]);
        const proj = poolMat();
        mat4.ortho(proj, -16, 16, -16, 16, 1, 70);
        mat4.multiply(lightVP, proj, view);
        // Snap the projected origin to the shadow texel grid (kills shimmer).
        const o = vec4.fromValues(0, 0, 0, 1);
        vec4.transformMat4(o, o, lightVP);
        const half = SHADOW_SIZE / 2;
        lightVP[12] += (Math.round(o[0] * half) - o[0] * half) / half;
        lightVP[13] += (Math.round(o[1] * half) - o[1] * half) / half;
    }

    /** Pass 1: scene depth from the sun into the shadow map. */
    function renderShadow(draws) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.shadow.fbo);
        gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT); // front-face culling reduces shadow acne
        const p = progs.shadow;
        gl.useProgram(p.prog);
        gl.uniformMatrix4fv(p.u.uLightVP, false, lightVP);
        for (const d of draws) {
            gl.uniformMatrix4fv(p.u.uModel, false, d.model);
            gl.bindVertexArray(d.gpu.vao);
            gl.drawArrays(gl.TRIANGLES, 0, d.gpu.count);
        }
        gl.cullFace(gl.BACK);
    }

    /** Pass 2: sky, lit geometry, water and particles into the scene FBO. */
    function renderScene(draws, time, particleData, particleCount) {
        const target = fbos.msaa ? fbos.msaa.fbo : fbos.resolve.fbo;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(HORIZON[0], HORIZON[1], HORIZON[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Sky gradient (attribute-less fullscreen triangle behind all).
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
        gl.uniformMatrix4fv(sc.u.uLightVP, false, lightVP);
        gl.uniform3fv(sc.u.uSunDir, SUN_DIR);
        gl.uniform3fv(sc.u.uSunColor, SUN_COLOR);
        gl.uniform3fv(sc.u.uSkyAmbient, SKY_AMBIENT);
        gl.uniform3fv(sc.u.uGroundAmbient, GROUND_AMBIENT);
        gl.uniform3fv(sc.u.uCamPos, cam.pos);
        gl.uniform3fv(sc.u.uFogColor, HORIZON);
        gl.uniform1f(sc.u.uFogDensity, FOG_DENSITY);
        gl.uniform1f(sc.u.uShadowTexel, 1 / SHADOW_SIZE);
        gl.uniform1i(sc.u.uShadowMap, 1);
        for (const d of draws) {
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
        gl.uniformMatrix4fv(wt.u.uLightVP, false, lightVP);
        gl.uniform1f(wt.u.uTime, time);
        gl.uniform3fv(wt.u.uSunDir, SUN_DIR);
        gl.uniform3fv(wt.u.uSunColor, SUN_COLOR);
        gl.uniform3fv(wt.u.uCamPos, cam.pos);
        gl.uniform3fv(wt.u.uDeepColor, WATER_DEEP);
        gl.uniform3fv(wt.u.uShallowColor, WATER_SHALLOW);
        gl.uniform3fv(wt.u.uSkyReflect, WATER_SKY);
        gl.uniform3fv(wt.u.uFogColor, HORIZON);
        gl.uniform1f(wt.u.uFogDensity, FOG_DENSITY);
        gl.uniform1f(wt.u.uShadowTexel, 1 / SHADOW_SIZE);
        gl.uniform1i(wt.u.uShadowMap, 1);
        gl.bindVertexArray(waterGrid.vao);
        gl.drawElements(gl.TRIANGLES, waterGrid.count, gl.UNSIGNED_SHORT, 0);

        // Particles: stream this frame's packed data into the dynamic VBO.
        if (particleCount > 0) {
            const pp = progs.particle;
            gl.useProgram(pp.prog);
            gl.depthMask(false);
            gl.uniformMatrix4fv(pp.u.uProj, false, cam.proj);
            gl.uniformMatrix4fv(pp.u.uView, false, cam.view);
            gl.uniform1f(pp.u.uPointScale, canvas.height * 0.5 * cam.proj[5]);
            gl.bindVertexArray(particleVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, particleVbo);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, particleData.subarray(0,
                particleCount * FLOATS_PER_PARTICLE));
            gl.drawArrays(gl.POINTS, 0, particleCount);
            gl.depthMask(true);
        }
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
    }

    /** Pass 3: resolve MSAA and run the post-process onto the canvas. */
    function renderPost(deathFade) {
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
        gl.uniform1f(p.u.uDeathFade, deathFade);
        gl.bindVertexArray(fbos.emptyVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return {
        gl,
        gpu,
        cam,
        IDENTITY,
        /** Reset the scratch-matrix pool; call before building draws. */
        beginFrame() {
            matPoolUsed = 0;
        },
        poolMat,
        updateCamera,
        updateLight,
        /**
         * Draw one frame. `frame` = {draws, time, deathFade,
         * particleData, particleCount}.
         */
        render(frame) {
            renderShadow(frame.draws);
            renderScene(frame.draws, frame.time,
                frame.particleData, frame.particleCount);
            renderPost(frame.deathFade);
        },
    };
}

/** Shadow map, MSAA scene buffer, resolve texture, and an empty VAO. */
function setupFramebuffers(gl, width, height) {
    const fbos = {};

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
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const resolveFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, resolveTex, 0);
    fbos.resolve = {fbo: resolveFbo, tex: resolveTex};

    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    if (samples > 1) {
        const colorRb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, colorRb);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples,
            gl.RGBA8, width, height);
        const depthRb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples,
            gl.DEPTH_COMPONENT24, width, height);
        const msaaFbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.RENDERBUFFER, colorRb);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER, depthRb);
        fbos.msaa = {fbo: msaaFbo};
    } else {
        // No MSAA: the resolve FBO needs its own depth buffer.
        const depthRb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24,
            width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER, depthRb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Empty VAO for attribute-less fullscreen triangles.
    fbos.emptyVao = gl.createVertexArray();
    return fbos;
}
