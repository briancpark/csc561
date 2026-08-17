/**
 * hero.js — ray-marched metaball backdrop for the landing page.
 *
 * A single fullscreen fragment shader sphere-traces a smooth-min union of
 * signed-distance spheres, shades them with a rim/fresnel light in the
 * per-project accent hues, and adds a soft halo from the closest-approach
 * distance of missed rays. Blob positions are animated on the CPU
 * (Lissajous drift + cursor attraction + click repulsion) and passed as
 * uniforms. Renders at reduced resolution — the blobs are soft, so it
 * upscales cleanly.
 */

const BLOB_COUNT = 7;

const FS = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform vec4 uBlobs[${BLOB_COUNT}];
uniform vec3 uColors[${BLOB_COUNT}];
uniform vec3 uBg;

out vec4 fragColor;

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Scene distance plus a distance-weighted blend of the blob colors.
float map(vec3 p, out vec3 col) {
    float d = 1e5;
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < ${BLOB_COUNT}; i++) {
        float di = length(p - uBlobs[i].xyz) - uBlobs[i].w;
        d = smin(d, di, 0.55);
        float w = exp(-di * 2.5);
        acc += uColors[i] * w;
        wsum += w;
    }
    col = acc / max(wsum, 1e-4);
    return d;
}

vec3 normalAt(vec3 p) {
    vec3 c;
    const vec2 e = vec2(0.002, -0.002);
    return normalize(
        e.xyy * map(p + e.xyy, c) + e.yyx * map(p + e.yyx, c) +
        e.yxy * map(p + e.yxy, c) + e.xxx * map(p + e.xxx, c));
}

void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
    vec3 ro = vec3(0.0, 0.0, 6.0);
    vec3 rd = normalize(vec3(uv * 0.5, -1.0));

    // Background: dark base with a very faint diagonal wash.
    vec3 bg = uBg + vec3(0.02, 0.025, 0.04) * (0.5 + 0.5 * uv.y);

    float t = 0.0;
    float glow = 0.0;
    vec3 glowCol = vec3(0.0);
    vec3 col;
    bool hit = false;
    for (int i = 0; i < 90; i++) {
        vec3 p = ro + rd * t;
        float d = map(p, col);
        // Accumulate a halo from how close each step passes to the surface.
        float g = exp(-d * 2.2) * 0.045;
        glow += g;
        glowCol += col * g;
        if (d < 0.0015) {
            hit = true;
            break;
        }
        t += d * 0.9;
        if (t > 14.0) break;
    }

    vec3 color = bg;
    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = normalAt(p);
        vec3 key = normalize(vec3(0.6, 0.9, 0.7));
        float diff = max(dot(n, key), 0.0);
        float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.6);
        vec3 h = normalize(key - rd);
        float spec = pow(max(dot(n, h), 0.0), 60.0);
        vec3 base = col * 0.55;
        color = base * (0.45 + 0.55 * diff) + col * fres * 1.25 +
            vec3(1.0) * spec * 0.4;
        // Distant blobs sink into the background.
        color = mix(color, bg, smoothstep(6.0, 11.0, t));
    } else if (glow > 0.0) {
        color += glowCol / max(glow, 1e-4) * min(glow, 1.0) * 0.55;
    }

    // Subtle film grain hides banding in the gradients.
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) +
        uTime) * 43758.5453) - 0.5;
    color += grain * 0.012;
    fragColor = vec4(color, 1.0);
}
`;

const VS = `#version 300 es
void main() {
    vec2 v[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
    gl_Position = vec4(v[gl_VertexID], 0.0, 1.0);
}
`;

const ACCENTS = [
    [0.478, 0.635, 1.0], // site accent
    [1.0, 0.706, 0.329], // p1
    [0.365, 0.827, 0.620], // p2
    [0.400, 0.702, 1.0], // p3
    [0.710, 0.549, 1.0], // p4
    [1.0, 0.494, 0.714], // p5
    [0.478, 0.635, 1.0],
];

/** Boot the hero; silently does nothing without WebGL2. */
function initHero() {
    const canvas = document.getElementById('hero-gl');
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', {antialias: false, alpha: false});
    if (!gl) return;

    const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(s));
            return null;
        }
        return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uBlobs = gl.getUniformLocation(prog, 'uBlobs');
    const uColors = gl.getUniformLocation(prog, 'uColors');
    const uBg = gl.getUniformLocation(prog, 'uBg');
    gl.bindVertexArray(gl.createVertexArray());

    const bgHex = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg').trim() || '#0b0e14';
    const bg = [1, 3, 5].map((i) => parseInt(bgHex.slice(i, i + 2), 16) / 255);
    gl.uniform3fv(uBg, bg);
    gl.uniform3fv(uColors, ACCENTS.flat());

    // Blob motion: a base center, Lissajous drift, cursor pull, and an
    // eased velocity so interaction feels weighty rather than snappy.
    const blobs = [];
    for (let i = 0; i < BLOB_COUNT; i++) {
        const a = (i / BLOB_COUNT) * Math.PI * 2;
        blobs.push({
            cx: Math.cos(a) * 2.9 + 1.6, cy: Math.sin(a) * 1.3 + 0.7,
            cz: (i % 2) * 0.8 - 0.4,
            ax: 0.5 + (i % 3) * 0.25, ay: 0.35 + (i % 2) * 0.3,
            fx: 0.17 + i * 0.023, fy: 0.13 + i * 0.031, ph: i * 1.7,
            r: 0.40 + (i % 3) * 0.12,
            x: 0, y: 0, z: 0, vx: 0, vy: 0,
        });
    }
    const blobData = new Float32Array(BLOB_COUNT * 4);

    // Cursor in scene units on the z = 0 plane (matches the shader camera).
    const mouse = {x: 0, y: 0, active: false, kick: 0};
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

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, time);
        gl.uniform4fv(uBlobs, blobData);
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
