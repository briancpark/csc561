attribute vec3 vertexPosition;
attribute vec3 aEye;
attribute mat4 aSelection;
attribute vec3 aDiffuse;
attribute vec3 aAmbient;
attribute vec3 aSpecular;
attribute vec3 aNormal;
attribute float a_n;


uniform mat4 uModelView;
uniform mat4 uProjection;
uniform vec3 uLightPosition;

uniform vec3 uLightAmbient;
uniform vec3 uLightDiffuse;
uniform vec3 uLightSpecular;

varying vec3 vL;
varying vec3 vN;
varying vec3 vE;
varying vec3 vAmbient;
varying vec3 vDiffuse;
varying vec3 vSpecular;
varying vec3 vNormal;
varying float v_n;


void main(void) {
    gl_Position = uProjection * uModelView * aSelection * vec4(vertexPosition, 1.0);
    vec4 lightPos = uModelView * vec4(uLightPosition, 1.0);
    vL = normalize(lightPos.xyz - vertexPosition);
    vN = normalize(aNormal);
    vE = normalize(aEye - vertexPosition);

    vSpecular = aSpecular * uLightSpecular;
    vDiffuse = aDiffuse * uLightDiffuse;
    vAmbient = aAmbient * uLightAmbient;
    v_n = a_n;
}