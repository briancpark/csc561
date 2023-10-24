precision highp float;

varying vec3 vL;
varying vec3 vN;
varying vec3 vE;
varying vec3 vAmbient;
varying vec3 vDiffuse;
varying vec3 vSpecular;
varying vec3 vNormal;
varying float v_n;

void main(void) {
    vec3 vH = normalize(vL + vE);
    float diffuseScale = max(0.0, dot(vN, vL));
    vec3 diffuse = diffuseScale * vDiffuse;
    float specularScale = pow(max(0.0, dot(vN, vH)), v_n);
    vec3 specular = specularScale * vSpecular;
    vec4 color = vec4(vAmbient + diffuse + specular, 1.0);
    gl_FragColor = color;
}
