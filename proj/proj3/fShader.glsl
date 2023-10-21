precision highp float;

varying vec4 vL;
varying vec4 vN;
varying vec4 vE;
varying vec4 vAmbient;
varying vec4 vDiffuse;
varying vec4 vSpecular;
varying vec4 vNormal;
varying float v_n;

void main(void) {
    vec4 vH = normalize(vL + vE);
    float diffuseScale = max(0.0, dot(vN, vL));
    vec4 diffuse = diffuseScale * vDiffuse;
    float specularScale = pow(max(0.0, dot(vN, vH)), v_n);
    vec4 specular = specularScale * vSpecular;
    gl_FragColor = vAmbient + diffuse + specular;
}
