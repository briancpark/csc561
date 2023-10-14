const INPUT_TRIANGLES_URL = "triangles.json";
const INPUT_ELLIPSOIDS_URL = "ellipsoids.json";
const INPUT_LIGHTS_URL = "lights.json";
const INPUT_SPHERES_URL = "spheres.json";
var Eye = [0.5, 0.5, -0.5, 1.0];

var gl = null;
var diffuseBuffer;
var vertexBuffer;
var indexBuffer;
var ambientBuffer;
var specularBuffer;
var normalBuffer;
var eyeBuffer;
var selectionBuffer;
var selectionMatrices = [];

var lightVertexArray = [];
var ambientArray = [];
var diffuseArray = [];
var specularArray = [];

var triBufferSize;
var colorBufferSize;
var vtxBufferSize;
var shaderProgram;


const eye = [0.5, 0.5, -0.5];
const up = [0, 1, 0];
const at = [0, 0, 1];


function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest();
            httpReq.open("GET", url, false);
            httpReq.send(null);
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            }
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        }
    } catch (e) {
        console.log(e);
        return (String.null);
    }
}

function setupWebGL() {
    var canvas = document.getElementById("myWebGLCanvas");
    gl = canvas.getContext("webgl");

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clearDepth(1.0);
            gl.enable(gl.DEPTH_TEST);
        }
    } catch (e) {
        console.log(e);
    }

}

function loadTriangles() {
    triBufferSize = 0;
    colorBufferSize = 0;
    vtxBufferSize = 0;

    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    if (inputTriangles != String.null) {
        var ambientArray = [];
        var diffuseArray = [];
        var specularArray = [];
        var nArray = [];
        var eyeArray = [];

        var vertexArray = [];
        var normalArray = [];
        var indexArray = [];

        inputTriangles.forEach(data => {
            vertexArray.push(...data.vertices.flat());
            normalArray.push(...data.normals.flat());
            eyeArray.push(...data.vertices.map(() => Eye).flat());
        });

        var offset = 0;
        inputTriangles.forEach(data => {
            data.triangles.forEach(triangle => {
                indexArray.push(...triangle.map(index => index + offset));
            });

            diffuseArray.push(...data.vertices.map(() => [...data.material.diffuse, 1.0]).flat());
            ambientArray.push(...data.vertices.map(() => [...data.material.ambient, 1.0]).flat());
            specularArray.push(...data.vertices.map(() => [...data.material.specular, 1.0]).flat());

            offset += data.vertices.length;
        })

        nArray = inputTriangles.map(triangle => triangle.vertices.map(() => triangle.material.n).flat()).flat();

        inputTriangles.forEach(() => selectionMatrices.push(mat4.create()));

        triBufferSize = indexArray.length;

        vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

        eyeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, eyeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(eyeArray), gl.STATIC_DRAW);

        selectionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, selectionBuffer);
        var selectionBufferData = [];
        inputTriangles.forEach((data, index) => {
            data.vertices.forEach(() => {
                selectionBufferData.push.apply(selectionBufferData, selectionMatrices[index]);
            });
        });
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(selectionBufferData), gl.STATIC_DRAW);

        diffuseBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW);

        ambientBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW);

        specularBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW);

        nBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nArray), gl.STATIC_DRAW);

        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);
    }

    var inputLights = getJSONFile(INPUT_LIGHTS_URL, "lights");
    if (inputLights != String.null) {

        inputLights.forEach(data => {
            lightVertexArray.push(data.x, data.y, data.z);
        });

        inputLights.forEach(data => {
            diffuseArray.push(...data.diffuse, 1.0);
            ambientArray.push(...data.ambient, 1.0);
            specularArray.push(...data.specular, 1.0);
        });
    }
}

function setupShaders() {
    var fShaderCode = `
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
            vec4 diffuse = max(dot(vL, vN), 0.0) * vDiffuse;
            vec4 H = normalize(vL + vE);
            vec4 specular = pow(max(dot(vN, H), 0.0), v_n) * vSpecular;   
            vec4 fColor = vAmbient + diffuse + vSpecular;
            gl_FragColor = fColor;
        }
    `;

    var vShaderCode = `
        attribute vec4 vertexPosition;
        attribute vec4 aEye;
        attribute mat4 aSelectionMatrix;
        attribute vec4 aDiffuse;
        attribute vec4 aAmbient;
        attribute vec4 aSpecular;
        attribute vec4 aNormal;
        attribute float a_n;
        
        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
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
        //uProjectionMatrix * uModelViewMatrix *
            gl_Position =  aSelectionMatrix * vertexPosition;
            vec4 lightPos = uModelViewMatrix * uLightPosition;
            vL = normalize(lightPos - vertexPosition);
            vN = normalize(aNormal);
            vE = normalize(aEye - vertexPosition);
            
            vSpecular = aSpecular;
            vDiffuse = aDiffuse;
            vAmbient = aAmbient;
            v_n = a_n;
        }
    `;

    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fShader, fShaderCode);
        gl.compileShader(fShader);

        var vShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vShader, vShaderCode);
        gl.compileShader(vShader);

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else {
            shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, fShader);
            gl.attachShader(shaderProgram, vShader);
            gl.linkProgram(shaderProgram);

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            }
        }
    } catch (e) {
        console.log(e);
    }
    altPosition = false;
    setTimeout(function alterPosition() {
        altPosition = !altPosition;
        setTimeout(alterPosition, 2000);
    }, 2000);
}


function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    requestAnimationFrame(renderTriangles);

    var vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition");
    var selectionMatrixAttrib = gl.getAttribLocation(shaderProgram, "aSelectionMatrix");
    var vertexEyeAttrib = gl.getAttribLocation(shaderProgram, "aEye");
    var vertexDiffuseAttrib = gl.getAttribLocation(shaderProgram, "aDiffuse");
    var vertexAmbientAtrrib = gl.getAttribLocation(shaderProgram, "aAmbient");
    var vertexSpecularAtrrib = gl.getAttribLocation(shaderProgram, "aSpecular");
    var vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "aNormal");
    var vertexNAttrib = gl.getAttribLocation(shaderProgram, "a_n");

    var modelViewMatrixAttrib = gl.getUniformLocation(shaderProgram, "uModelViewMatrix");
    var projectionMatrixAttrib = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
    var lightPositionAttrib = gl.getUniformLocation(shaderProgram, "uLightPosition");

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, selectionBuffer);
    for (let offsetIdx = 0; offsetIdx < 4; offsetIdx++) {
        gl.vertexAttribPointer(selectionMatrixAttrib + offsetIdx, 4, gl.FLOAT, false, 64, offsetIdx * 16);
        gl.enableVertexAttribArray(selectionMatrixAttrib + offsetIdx);
    }


    gl.bindBuffer(gl.ARRAY_BUFFER, eyeBuffer);
    gl.vertexAttribPointer(vertexEyeAttrib, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer);
    gl.vertexAttribPointer(vertexDiffuseAttrib, 4, gl.FLOAT, false, 0, 0);


    gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
    gl.vertexAttribPointer(vertexAmbientAtrrib, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
    gl.vertexAttribPointer(vertexSpecularAtrrib, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.vertexAttribPointer(vertexNAttrib, 1, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(vertexPositionAttrib);
    gl.enableVertexAttribArray(vertexEyeAttrib);
    gl.enableVertexAttribArray(vertexDiffuseAttrib);
    gl.enableVertexAttribArray(vertexAmbientAtrrib);
    gl.enableVertexAttribArray(vertexSpecularAtrrib);
    gl.enableVertexAttribArray(vertexNormalAttrib);
    gl.enableVertexAttribArray(vertexNAttrib);


    const fov = (90 * Math.PI) / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const near = 0;
    const far = 1;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fov, aspect, near, far);


    const center = vec3.create();
    vec3.add(center, eye, at);

    const modelViewMatrix = mat4.create();
    mat4.lookAt(modelViewMatrix, eye, center, up);

    gl.useProgram(shaderProgram);

    gl.uniformMatrix4fv(
        projectionMatrixAttrib,
        false,
        projectionMatrix);

    gl.uniformMatrix4fv(
        modelViewMatrixAttrib,
        false,
        modelViewMatrix);


    gl.uniform4fv(
        lightPositionAttrib,
        lightVertexArray.concat([1.0]),
    );

    var lightDiffuseAttrib = gl.getUniformLocation(shaderProgram, "uLightDiffuse");
    gl.uniform4fv(
        lightDiffuseAttrib,
        diffuseArray.concat([1.0]),
    )

    var lightAmbientAttrib = gl.getUniformLocation(shaderProgram, "uLightAmbient");
    gl.uniform4fv(
        lightAmbientAttrib,
        ambientArray.concat([1.0]),
    )

    var lightSpecularAttrib = gl.getUniformLocation(shaderProgram, "uLightSpecular");
    gl.uniform4fv(
        lightSpecularAttrib,
        specularArray.concat([1.0]),
    )

    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0);
}

function main() {
    setupWebGL();
    loadTriangles();
    setupShaders();
    renderTriangles();

    /*
        a and d — translate view left (a) and right (d) along view X
        w and s — translate view forward (w) and backward (s) along view Z
        q and e — translate view up (q) and down (e) along view Y
        A and D — rotate view left (A) and right (D) around view Y (yaw)
        W and S — rotate view forward (W) and backward (S) around view X (pitch)
    */

    // document.addEventListener('keydown', function (event) {
    //     const delta = 0.5;
    //     // loadTriangles(true); // load in the triangles from tri file
    //     switch (event.key) {
    //         case "a": // a
    //             Eye[0] += delta;
    //             break;
    //         case "d": // d
    //             break;
    //
    //         case "w": // w
    //             break;
    //         case "s": // s
    //             break;
    //
    //         case "q": // q
    //             break;
    //         case "e": // e
    //             break;
    //
    //         case "A": // a
    //             break;
    //         case "D": // d
    //             break;
    //
    //         case "W": // w
    //             break;
    //         case "S": // s
    //             break;
    //
    //         default:
    //         // do nothing
    //
    //     }
    // }, false);

}
