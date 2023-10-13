precision highp float;

varying vec4 vL;
varying vec4 vN;
varying vec4 vE;
varying vec4 vAmbient;
varying vec4 vDiffuse;
varying vec4 vSpecular;
varying vec4 vNormal;
varying vec4 v_n;

void main(void) {
    vec4 diffuse = max(dot(vL, vN), 0.0) * vDiffuse;
    vec4 H = normalize(vL+vE);
    vec4 specular = pow(max(dot(vN, H), 0.0), v_n.x) * vSpecular;
    vec4 fColor = vAmbient + diffuse + vSpecular;
    fColor.a = 1.0;
    gl_FragColor = fColor;
}