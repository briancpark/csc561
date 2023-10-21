attribute vec4 vertexPosition;
attribute vec4 aEye;
attribute mat4 aSelection;
attribute vec4 aDiffuse;
attribute vec4 aAmbient;
attribute vec4 aSpecular;
attribute vec4 aNormal;
attribute float a_n;


uniform mat4 uModelView;
uniform mat4 uProjection;
uniform vec4 uLightPosition;

uniform vec4 uLightAmbient;
uniform vec4 uLightDiffuse;
uniform vec4 uLightSpecular;

varying vec4 vL;
varying vec4 vN;
varying vec4 vE;
varying vec4 vAmbient;
varying vec4 vDiffuse;
varying vec4 vSpecular;
varying vec4 vNormal;
varying float v_n;


void main(void) {
    gl_Position = uProjection * uModelView * aSelection * vertexPosition;
    vec4 lightPos = uModelView * uLightPosition;
    vL = normalize(lightPos - vertexPosition);
    vN = normalize(aNormal);
    vE = normalize(aEye - vertexPosition);

    vSpecular = aSpecular * uLightSpecular;
    vDiffuse = aDiffuse * uLightDiffuse;
    vAmbient = aAmbient * uLightAmbient;
    v_n = a_n;
}