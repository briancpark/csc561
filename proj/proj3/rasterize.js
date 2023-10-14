const INPUT_TRIANGLES_URL = "triangles.json";
const INPUT_ELLIPSOIDS_URL = "ellipsoids.json";
const INPUT_LIGHTS_URL = "lights.json";
const INPUT_SPHERES_URL = "spheres.json";
var Eye = [0.5, 0.5, -0.5];

var gl = null;
var selectionMatrices = [];

var lightVertexArray = [];
var ambientArray = [];
var diffuseArray = [];
var specularArray = [];

var triBufferSize;
var shaderProgram;

var locations;
var buffers;

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
    var canvas = document.getElementById("canvas");
    gl = canvas.getContext("webgl2");

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

        // uniform vec4 uLightAmbient;
        // uniform vec4 uLightDiffuse;
        // uniform vec4 uLightSpecular;
        
        varying vec4 vL;
        varying vec4 vN;
        varying vec4 vE;
        varying vec4 vAmbient;
        varying vec4 vDiffuse;
        varying vec4 vSpecular;
        varying vec4 vNormal;
        varying float v_n;

                
        void main(void) {
            gl_Position = vec4(uProjectionMatrix * uModelViewMatrix * aSelectionMatrix * vertexPosition);
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

function initLocations() {
    locations = {
        vertexPosition: gl.getAttribLocation(shaderProgram, "vertexPosition"),
        selectionMatrix: gl.getAttribLocation(shaderProgram, "aSelectionMatrix"),
        vertexEye: gl.getAttribLocation(shaderProgram, "aEye"),
        vertexDiffuse: gl.getAttribLocation(shaderProgram, "aDiffuse"),
        vertexAmbient: gl.getAttribLocation(shaderProgram, "aAmbient"),
        vertexSpecular: gl.getAttribLocation(shaderProgram, "aSpecular"),
        vertexNormal: gl.getAttribLocation(shaderProgram, "aNormal"),
        vertexN: gl.getAttribLocation(shaderProgram, "a_n"),

        modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
        projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
        lightPosition: gl.getUniformLocation(shaderProgram, "uLightPosition"),
    //     lightDiffuse: gl.getUniformLocation(shaderProgram, "uLightDiffuse"),
    //     lightAmbient: gl.getUniformLocation(shaderProgram, "uLightAmbient"),
    //     lightSpecular: gl.getUniformLocation(shaderProgram, "uLightSpecular"),
    };
}

function initBuffers() {
    buffers = {
        vertexBuffer: gl.createBuffer(),
        selectionBuffer: gl.createBuffer(),
        eyeBuffer: gl.createBuffer(),
        diffuseBuffer: gl.createBuffer(),
        ambientBuffer: gl.createBuffer(),
        specularBuffer: gl.createBuffer(),
        normalBuffer: gl.createBuffer(),
        nBuffer: gl.createBuffer(),
        indexBuffer: gl.createBuffer(),
    };

    triBufferSize = 0;

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
            eyeArray.push(...data.vertices.map(() => [...Eye, 1.0]).flat());
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

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.eyeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(eyeArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.selectionBuffer);
        var selectionBufferData = [];
        inputTriangles.forEach((data, index) => {
            data.vertices.forEach(() => {
                selectionBufferData.push.apply(selectionBufferData, selectionMatrices[index]);
            });
        });
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(selectionBufferData), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.diffuseBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.ambientBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.specularBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer);
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

function draw() {
    const center = vec3.create();
    vec3.add(center, Eye, at);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
    gl.vertexAttribPointer(locations.vertexPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.selectionBuffer);
    for (let offsetIdx = 0; offsetIdx < 4; offsetIdx++) {
        gl.vertexAttribPointer(locations.selectionMatrix + offsetIdx, 4, gl.FLOAT, false, 64, offsetIdx * 16);
        gl.enableVertexAttribArray(locations.selectionMatrix + offsetIdx);
    }


    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.eyeBuffer);
    gl.vertexAttribPointer(locations.vertexEye, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER,buffers. diffuseBuffer);
    gl.vertexAttribPointer(locations.vertexDiffuse, 4, gl.FLOAT, false, 0, 0);


    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.ambientBuffer);
    gl.vertexAttribPointer(locations.vertexAmbient, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.specularBuffer);
    gl.vertexAttribPointer(locations.vertexSpecular, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normalBuffer);
    gl.vertexAttribPointer(locations.vertexNormal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.nBuffer);
    gl.vertexAttribPointer(locations.vertexN, 1, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(locations.vertexPosition);
    gl.enableVertexAttribArray(locations.vertexEye);
    gl.enableVertexAttribArray(locations.vertexDiffuse);
    gl.enableVertexAttribArray(locations.vertexAmbient);
    gl.enableVertexAttribArray(locations.vertexSpecular);
    gl.enableVertexAttribArray(locations.vertexNormal);
    gl.enableVertexAttribArray(locations.vertexN);


    const fov = (90 * Math.PI) / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const near = 0;
    const far = 1;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fov, aspect, near, far);

    const modelViewMatrix = mat4.create();
    mat4.lookAt(modelViewMatrix, Eye, center, up);

    gl.useProgram(shaderProgram);

    gl.uniformMatrix4fv(
        locations.projectionMatrix,
        false,
        projectionMatrix);

    gl.uniformMatrix4fv(
        locations.modelViewMatrix,
        false,
        modelViewMatrix);


    gl.uniform4fv(
        locations.lightPosition,
        lightVertexArray.concat([1.0]),
    );

    // var lightDiffuseAttrib = gl.getUniformLocation(shaderProgram, "uLightDiffuse");
    // gl.uniform4fv(
    //     lightDiffuseAttrib,
    //     diffuseArray.concat([1.0]),
    // )
    //
    // var lightAmbientAttrib = gl.getUniformLocation(shaderProgram, "uLightAmbient");
    // gl.uniform4fv(
    //     lightAmbientAttrib,
    //     ambientArray.concat([1.0]),
    // )
    //
    // var lightSpecularAttrib = gl.getUniformLocation(shaderProgram, "uLightSpecular");
    // gl.uniform4fv(
    //     lightSpecularAttrib,
    //     specularArray.concat([1.0]),
    // )

    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0);


}

function main() {
    setupWebGL();
    setupShaders();
    initLocations();
    initBuffers();
    requestAnimationFrame(draw);

    /*
        a and d — translate view left (a) and right (d) along view X
        w and s — translate view forward (w) and backward (s) along view Z
        q and e — translate view up (q) and down (e) along view Y
        A and D — rotate view left (A) and right (D) around view Y (yaw)
        W and S — rotate view forward (W) and backward (S) around view X (pitch)
    */

    document.addEventListener('keydown', function (event) {
        const delta = 0.5;
        // loadTriangles(true); // load in the triangles from tri file
        switch (event.key) {
            case "a": // a
                Eye[0] += delta;
                break;
            case "d": // d
                Eye[0] -= delta;
                break;

            case "w": // w
                Eye[1] += delta;
                break;
            case "s": // s
                Eye[1] -= delta;
                break;

            case "q": // q
                break;
            case "e": // e
                break;

            case "A": // a
                break;
            case "D": // d
                break;

            case "W": // w
                break;
            case "S": // s
                break;

            default:
            // do nothing

        }
        requestAnimationFrame(draw);
    }, false);

}
