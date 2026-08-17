/**
 * shaders.js — all GLSL ES 3.00 shader sources for the hopper.
 *
 * Pipeline overview:
 *   1. shadow pass   — scene depth from the sun into a depth texture
 *   2. scene pass    — sky gradient, lit geometry, animated water, particles
 *                      (rendered into a multisampled offscreen framebuffer)
 *   3. post pass     — resolve + tonemap, vignette, death desaturation
 */

/* Shared chunk: 3x3 PCF lookup into a hardware-compared shadow map. */
const SHADOW_GLSL = `
uniform highp sampler2DShadow uShadowMap;
uniform float uShadowTexel;

float shadowFactor(vec4 shadowCoord) {
    vec3 sc = shadowCoord.xyz / shadowCoord.w;
    sc = sc * 0.5 + 0.5;
    if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) {
        return 1.0;
    }
    float sum = 0.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 off = vec2(float(x), float(y)) * uShadowTexel;
            sum += texture(uShadowMap, vec3(sc.xy + off, sc.z - 0.0022));
        }
    }
    return sum / 9.0;
}
`;

/* Shared chunk: distance fog toward the horizon color. */
const FOG_GLSL = `
uniform vec3 uFogColor;
uniform float uFogDensity;

vec3 applyFog(vec3 color, float dist) {
    float f = dist * uFogDensity;
    return mix(color, uFogColor, 1.0 - exp(-f * f));
}
`;

/* ------------------------------------------------------------------ */
/* Scene: vertex-colored, flat-shaded geometry with shadows + fog      */
/* ------------------------------------------------------------------ */

export const SCENE_VS = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;

uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMat;
uniform mat4 uLightVP;

out vec3 vNormal;
out vec3 vWorldPos;
out vec3 vColor;
out vec4 vShadowCoord;

void main() {
    vec4 wp = uModel * vec4(aPosition, 1.0);
    vWorldPos = wp.xyz;
    vNormal = uNormalMat * aNormal;
    vColor = aColor;
    vShadowCoord = uLightVP * wp;
    gl_Position = uProj * uView * wp;
}
`;

export const SCENE_FS = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
in vec3 vColor;
in vec4 vShadowCoord;

uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundAmbient;
uniform vec3 uCamPos;
${SHADOW_GLSL}
${FOG_GLSL}

out vec4 fragColor;

void main() {
    vec3 nrm = normalize(vNormal);

    // Hemisphere ambient: blend ground bounce and sky light by normal tilt.
    float hemi = nrm.y * 0.5 + 0.5;
    vec3 ambient = mix(uGroundAmbient, uSkyAmbient, hemi);

    float ndl = max(dot(nrm, uSunDir), 0.0);
    float shadow = shadowFactor(vShadowCoord);

    // Blinn-Phong specular, gated so it never shows on unlit faces.
    vec3 viewDir = normalize(uCamPos - vWorldPos);
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(nrm, halfDir), 0.0), 42.0) * 0.22;
    spec *= smoothstep(0.0, 0.2, ndl) * shadow;

    vec3 lit = vColor * (ambient + uSunColor * ndl * shadow) + uSunColor * spec;
    lit = applyFog(lit, length(uCamPos - vWorldPos));
    fragColor = vec4(lit, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Shadow pass: depth only, from the sun's orthographic camera         */
/* ------------------------------------------------------------------ */

export const SHADOW_VS = `#version 300 es
layout(location = 0) in vec3 aPosition;

uniform mat4 uLightVP;
uniform mat4 uModel;

void main() {
    gl_Position = uLightVP * uModel * vec4(aPosition, 1.0);
}
`;

export const SHADOW_FS = `#version 300 es
precision mediump float;
void main() {}
`;

/* ------------------------------------------------------------------ */
/* Water: sum-of-sines displacement in the vertex shader, analytic     */
/* normals, fresnel sky reflection, sun glints, shadowed + fogged      */
/* ------------------------------------------------------------------ */

export const WATER_VS = `#version 300 es
layout(location = 0) in vec2 aGridPos;

uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat4 uLightVP;
uniform float uTime;

out vec3 vNormal;
out vec3 vWorldPos;
out vec4 vShadowCoord;
out float vHeight;

// Three directional sine waves; derivatives give the surface normal.
const vec2 D1 = vec2(1.0, 0.35);
const vec2 D2 = vec2(-0.55, 1.0);
const vec2 D3 = vec2(0.8, -0.9);

void main() {
    vec4 wp = uModel * vec4(aGridPos.x, 0.0, aGridPos.y, 1.0);
    vec2 p = wp.xz;

    float p1 = dot(D1, p) * 1.15 + uTime * 1.5;
    float p2 = dot(D2, p) * 1.9 + uTime * 2.2;
    float p3 = dot(D3, p) * 3.1 + uTime * 2.9;

    float h = 0.045 * sin(p1) + 0.03 * sin(p2) + 0.014 * sin(p3);
    vec2 grad = D1 * (0.045 * 1.15 * cos(p1)) +
        D2 * (0.03 * 1.9 * cos(p2)) +
        D3 * (0.014 * 3.1 * cos(p3));

    wp.y += h;
    vHeight = h;
    vWorldPos = wp.xyz;
    vNormal = normalize(vec3(-grad.x, 1.0, -grad.y));
    vShadowCoord = uLightVP * wp;
    gl_Position = uProj * uView * wp;
}
`;

export const WATER_FS = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
in vec4 vShadowCoord;
in float vHeight;

uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCamPos;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSkyReflect;
${SHADOW_GLSL}
${FOG_GLSL}

out vec4 fragColor;

void main() {
    vec3 nrm = normalize(vNormal);
    vec3 viewDir = normalize(uCamPos - vWorldPos);

    float crest = smoothstep(-0.05, 0.08, vHeight);
    vec3 base = mix(uDeepColor, uShallowColor, crest);

    // Fresnel: grazing angles reflect the sky.
    float fresnel = pow(1.0 - max(dot(nrm, viewDir), 0.0), 3.0);
    vec3 color = mix(base, uSkyReflect, fresnel * 0.65);

    float shadow = shadowFactor(vShadowCoord);
    color *= 0.55 + 0.45 * shadow;

    // Sun glints on wave facets.
    vec3 halfDir = normalize(uSunDir + viewDir);
    float glint = pow(max(dot(nrm, halfDir), 0.0), 140.0);
    color += uSunColor * glint * 0.9 * shadow;

    color = applyFog(color, length(uCamPos - vWorldPos));
    fragColor = vec4(color, 0.94);
}
`;

/* ------------------------------------------------------------------ */
/* Sky: attribute-less fullscreen triangle, gradient + sun glow        */
/* ------------------------------------------------------------------ */

export const SKY_VS = `#version 300 es
out vec2 vUV;

void main() {
    // One oversized triangle covers the screen without any buffers.
    vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
    vec2 p = verts[gl_VertexID];
    vUV = p * 0.5 + 0.5;
    gl_Position = vec4(p, 0.99999, 1.0);
}
`;

export const SKY_FS = `#version 300 es
precision highp float;

in vec2 vUV;

uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec2 uSunScreen;

out vec4 fragColor;

void main() {
    vec3 sky = mix(uHorizon, uZenith, pow(clamp(vUV.y, 0.0, 1.0), 0.75));
    float d = distance(vUV, uSunScreen);
    sky += vec3(1.0, 0.85, 0.6) * 0.35 * exp(-d * d * 18.0);
    fragColor = vec4(sky, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Particles: camera-facing round point sprites                        */
/* ------------------------------------------------------------------ */

export const PARTICLE_VS = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in float aSize;
layout(location = 2) in vec4 aColor;

uniform mat4 uProj;
uniform mat4 uView;
uniform float uPointScale;

out vec4 vColor;

void main() {
    vec4 clip = uProj * uView * vec4(aPosition, 1.0);
    gl_Position = clip;
    gl_PointSize = uPointScale * aSize / max(clip.w, 0.1);
    vColor = aColor;
}
`;

export const PARTICLE_FS = `#version 300 es
precision mediump float;

in vec4 vColor;
out vec4 fragColor;

void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.15, d) * vColor.a;
    if (alpha < 0.01) discard;
    fragColor = vec4(vColor.rgb, alpha);
}
`;

/* ------------------------------------------------------------------ */
/* Post: tonemap + vignette + death desaturation on the resolved image */
/* ------------------------------------------------------------------ */

export const POST_VS = `#version 300 es
out vec2 vUV;

void main() {
    vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
    vec2 p = verts[gl_VertexID];
    vUV = p * 0.5 + 0.5;
    gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const POST_FS = `#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D uScene;
uniform float uDeathFade;

out vec4 fragColor;

void main() {
    vec3 color = texture(uScene, vUV).rgb;

    // Gentle Reinhard-style rolloff keeps sun highlights from clipping.
    color = color / (1.0 + color * 0.14);

    // Mild saturation lift for the toy-town look.
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, 1.12);

    // Vignette.
    vec2 c = vUV - 0.5;
    color *= 1.0 - dot(c, c) * 0.55;

    // Fade toward drab gray while dead.
    color = mix(color, vec3(luma * 0.75), uDeathFade * 0.7);

    fragColor = vec4(color, 1.0);
}
`;
