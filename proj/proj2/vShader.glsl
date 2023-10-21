attribute vec3 vertexPosition;
attribute vec3 vertexColor;
varying vec3 vColor;

void main(void) {
    vColor = vertexColor;
    gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
}