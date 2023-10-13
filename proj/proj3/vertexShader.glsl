attribute vec3 vertexPosition;
attribute vec4 aEye;
attribute mat4 aSelectionMatrix;
attribute vec4 aDiffuse;
attribute vec4 aAmbient;
attribute vec4 aSpecular;
attribute vec4 aNormal;
attribute float a_n;

uniform bool altPosition;

varying vec4 vL;
varying vec4 vN;
varying vec4 vE;
varying vec4 vAmbient;
varying vec4 vDiffuse;
varying vec4 vSpecular;
varying vec4 vNormal;
varying vec4 v_n;

uniform vec4 uLightAmbient;
uniform vec4 uLightDiffuse;
uniform vec4 uLightSpecular;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec4 uLightPosition;


void main(void) {
    vDiffuse = aDiffuse;
    vSpecular = aSpecular;
    vAmbient = aAmbient;

    vL = normalize(uLightPosition - vec4(vertexPosition, 1.0));
    vN = normalize(aNormal);
    vE = normalize(aEye - vec4(vertexPosition, 1.0));

    vSpecular = aSpecular;
    vDiffuse = aDiffuse;
    vAmbient = aAmbient;
    vNormal = aNormal;
    v_n = vec4(a_n, a_n, a_n, a_n);


    gl_Position = vec4(vertexPosition, 1.0);

    // if(altPosition)
    //     gl_Position = vec4(vertexPosition + vec3(-1.0, -1.0, 0.0), 1.0); // use the altered position
    // else
    //     gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
}