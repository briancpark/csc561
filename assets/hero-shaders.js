/**
 * hero-shaders.js — GLSL for the landing-page metaball hero.
 * `blobCount` is baked into the fragment shader's uniform arrays.
 */

/** Fragment shader: sphere-traced smooth-min metaballs, cursor-lit. */
export function heroFragmentSource(blobCount) {
    return `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform vec4 uBlobs[${blobCount}];
uniform vec3 uColors[${blobCount}];
uniform vec3 uBg;
uniform vec3 uLight; // cursor-driven point light, scene units

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
    for (int i = 0; i < ${blobCount}; i++) {
        float di = length(p - uBlobs[i].xyz) - uBlobs[i].w;
        d = smin(d, di, 0.42);
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
        // The cursor is a point light hovering just in front of the blobs.
        vec3 toL = uLight - p;
        float lDist = length(toL);
        vec3 l = toL / lDist;
        float atten = 6.0 / (1.0 + lDist * lDist * 0.35);
        float diff = max(dot(n, l), 0.0) * atten;
        vec3 h = normalize(l - rd);
        float spec = pow(max(dot(n, h), 0.0), 48.0) * min(atten, 1.5);
        float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);
        // Dim sky fill so unlit blobs still read as glassy shapes.
        float fill = 0.35 + 0.25 * n.y;
        vec3 base = col * 0.72;
        color = base * (fill * 0.55 + diff) + col * fres * 1.1 +
            vec3(1.0, 0.98, 0.95) * spec * 0.7;
        // Distant blobs sink into the background.
        color = mix(color, bg, smoothstep(6.0, 11.0, t));
    } else if (glow > 0.0) {
        color += glowCol / max(glow, 1e-4) * min(glow, 1.0) * 0.55;
    }

    // Soft rolloff so the cursor light can blow out without clipping to white.
    color = color / (1.0 + color * 0.22);

    // Subtle film grain hides banding in the gradients.
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) +
        uTime) * 43758.5453) - 0.5;
    color += grain * 0.012;
    fragColor = vec4(color, 1.0);
}
`;
}

/** Vertex shader: attribute-less fullscreen triangle. */
export const HERO_VERTEX_SOURCE = `#version 300 es
void main() {
    vec2 v[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
    gl_Position = vec4(v[gl_VertexID], 0.0, 1.0);
}
`;
