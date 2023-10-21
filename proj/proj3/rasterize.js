/* eslint-disable require-jsdoc, no-throw-literal, prefer-spread, max-len, no-unused-vars, guard-for-in */

let INPUT_TRIANGLES_URL = 'attributes/triangles.json';
// const INPUT_ELLIPSOIDS_URL = 'attributes/ellipsoids.json';
const INPUT_LIGHTS_URL = 'attributes/lights.json';
let Eye = [0.5, 0.5, -0.5];

let gl = null;
let selectionMatrices = [];

let triBufferSize;
let shaderProgram;

let locations;
let buffers;
let selectionBufferData = [];
let selection = -1;
let triangles;
const up = [0, 1, 0];
const at = [0, 0, 1];

let mystery = false;

function loadShaderFile(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // `false` makes the request synchronous
    xhr.send();

    if (xhr.status !== 200) {
        throw new Error(`Failed to load shader file: ${url}`);
    }

    return xhr.responseText;
}

function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== 'string') || (typeof (descr) !== 'string')) throw 'getJSONFile: parameter not a string';
        else {
            const httpReq = new XMLHttpRequest();
            httpReq.open('GET', url, false);
            httpReq.send(null);
            const startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000) break;
            }
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE)) throw `Unable to open ${descr} file!`;
            else return JSON.parse(httpReq.response);
        }
    } catch (e) {
        console.log(e);
        return (String.null);
    }
}

function setupWebGL() {
    const canvas = document.getElementById('canvas');
    gl = canvas.getContext('webgl');

    try {
        if (gl == null) {
            throw 'unable to create gl context -- is your browser gl ready?';
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
        }
    } catch (e) {
        console.log(e);
    }
}

function setupShaders() {
    const fShaderCode = loadShaderFile('./fShader.glsl');
    const vShaderCode = loadShaderFile('./vShader.glsl');

    try {
        const fShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fShader, fShaderCode);
        gl.compileShader(fShader);

        const vShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vShader, vShaderCode);
        gl.compileShader(vShader);

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
            throw `error during fragment shader compile: ${gl.getShaderInfoLog(fShader)}`;
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
            throw `error during vertex shader compile: ${gl.getShaderInfoLog(vShader)}`;
            gl.deleteShader(vShader);
        } else {
            shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, fShader);
            gl.attachShader(shaderProgram, vShader);
            gl.linkProgram(shaderProgram);

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                throw `error during shader program linking: ${gl.getProgramInfoLog(shaderProgram)}`;
            }
        }
    } catch (e) {
        console.log(e);
    }
}

function initLocations() {
    locations = {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'vertexPosition'),
        selectionMatrix: gl.getAttribLocation(shaderProgram, 'aSelection'),
        vertexEye: gl.getAttribLocation(shaderProgram, 'aEye'),
        vertexDiffuse: gl.getAttribLocation(shaderProgram, 'aDiffuse'),
        vertexAmbient: gl.getAttribLocation(shaderProgram, 'aAmbient'),
        vertexSpecular: gl.getAttribLocation(shaderProgram, 'aSpecular'),
        vertexNormal: gl.getAttribLocation(shaderProgram, 'aNormal'),
        vertexN: gl.getAttribLocation(shaderProgram, 'a_n'),

        uModelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelView'),
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjection'),
        lightPosition: gl.getUniformLocation(shaderProgram, 'uLightPosition'),
        lightDiffuse: gl.getUniformLocation(shaderProgram, 'uLightDiffuse'),
        lightAmbient: gl.getUniformLocation(shaderProgram, 'uLightAmbient'),
        lightSpecular: gl.getUniformLocation(shaderProgram, 'uLightSpecular'),
    };
}

function initBuffers() {
    // If buffers don't exist, create them
    if (buffers == null) {
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
    }

    triBufferSize = 0;

    const inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, 'triangles');
    triangles = inputTriangles;
    if (inputTriangles !== String.null) {
        const ambientArray = [];
        const diffuseArray = [];
        const specularArray = [];
        let nArray = [];
        const eyeArray = [];

        const vertexArray = [];
        const normalArray = [];
        const indexArray = [];

        inputTriangles.forEach((data) => {
            vertexArray.push(...data.vertices.flat());
            normalArray.push(...data.normals.flat());
            eyeArray.push(...data.vertices.map(() => [...Eye, 1.0]).flat());
        });

        let offset = 0;
        inputTriangles.forEach((data) => {
            data.triangles.forEach((triangle) => {
                indexArray.push(...triangle.map((index) => index + offset));
            });

            diffuseArray.push(...data.vertices.map(() => [...data.material.diffuse, 1.0]).flat());
            ambientArray.push(...data.vertices.map(() => [...data.material.ambient, 1.0]).flat());
            specularArray.push(...data.vertices.map(() => [...data.material.specular, 1.0]).flat());

            offset += data.vertices.length;
        });

        nArray = inputTriangles.map((triangle) => triangle.vertices.map(() => triangle.material.n).flat()).flat();

        if (selectionMatrices.length === 0) {
            inputTriangles.forEach(() => selectionMatrices.push(mat4.create()));
        }

        triBufferSize = indexArray.length;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.eyeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(eyeArray), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.selectionBuffer);
        selectionBufferData = [];
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

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.diffuseBuffer);
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

    const lightVertexArray = [];
    const ambientArray = [];
    const diffuseArray = [];
    const specularArray = [];
    const inputLights = getJSONFile(INPUT_LIGHTS_URL, 'lights');
    if (inputLights != String.null) {
        inputLights.forEach((data) => {
            lightVertexArray.push(data.x, data.y, data.z);
        });

        inputLights.forEach((data) => {
            diffuseArray.push(...data.diffuse);
            ambientArray.push(...data.ambient);
            specularArray.push(...data.specular);
        });
    }

    const fov = (90 * Math.PI) / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const near = 0;
    const far = 1;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fov, aspect, near, far);

    const uModelViewMatrix = mat4.create();
    mat4.lookAt(uModelViewMatrix, Eye, center, up);

    gl.useProgram(shaderProgram);

    gl.uniformMatrix4fv(
        locations.projectionMatrix,
        false,
        projectionMatrix,
    );

    gl.uniformMatrix4fv(
        locations.uModelViewMatrix,
        false,
        uModelViewMatrix,
    );

    gl.uniform4fv(
        locations.lightPosition,
        lightVertexArray.concat([1.0]),
    );

    const lightDiffuseAttrib = gl.getUniformLocation(shaderProgram, 'uLightDiffuse');
    gl.uniform4fv(
        lightDiffuseAttrib,
        diffuseArray.concat([1.0]),
    );

    const lightAmbientAttrib = gl.getUniformLocation(shaderProgram, 'uLightAmbient');
    gl.uniform4fv(
        lightAmbientAttrib,
        ambientArray.concat([1.0]),
    );

    const lightSpecularAttrib = gl.getUniformLocation(shaderProgram, 'uLightSpecular');
    gl.uniform4fv(
        lightSpecularAttrib,
        specularArray.concat([1.0]),
    );
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0);
}

function getTriangleCenter(triangles) {
    const factor = triangles.triangles.length * 3;
    const center = [0, 0, 0];
    for (const triangle of triangles.triangles) {
        for (const vertex of triangle) {
            const [x, y, z] = triangles.vertices[vertex];
            center[0] += x / factor;
            center[1] += y / factor;
            center[2] += z / factor;
        }
    }
    return center;
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
        left and right — select and highlight the next/previous triangle set (previous off)
        space — deselect and turn off highlight
        k and ; — translate selection left (k) and right (;) along view X
        o and l — translate selection forward (o) and backward (l) along view Z
        i and p — translate selection up (i) and down (p) along view Y
        K and : — rotate selection left (K) and right (:) around view Y (yaw)
        O and L — rotate selection forward (O) and backward (L) around view X (pitch)
        I and P — rotate selection clockwise (I) and counterclockwise (P) around view Z (roll)
    */

    document.addEventListener('keydown', (event) => {
        const delta = 0.1;
        let v; let
            center;

        if (selection !== -1) {
            center = getTriangleCenter(triangles[selection]);
        }
        switch (event.key) {
        case 'a':
            Eye[0] += delta;
            break;
        case 'd':
            Eye[0] -= delta;
            break;

        case 'w':
            Eye[2] += delta;
            break;
        case 's':
            Eye[2] -= delta;
            break;

        case 'q':
            Eye[1] += delta;
            break;
        case 'e':
            Eye[1] -= delta;
            break;

        case 'A':
            vec3.rotateY(at, at, Eye, glMatrix.toRadian(delta));
            break;
        case 'D':
            vec3.rotateY(at, at, Eye, glMatrix.toRadian(-delta));
            break;

        case 'W':
            vec3.rotateX(at, at, Eye, glMatrix.toRadian(delta));
            vec3.rotateX(up, up, Eye, glMatrix.toRadian(delta));
            break;
        case 'S':
            vec3.rotateX(at, at, Eye, glMatrix.toRadian(-delta));
            vec3.rotateX(up, up, Eye, glMatrix.toRadian(-delta));
            break;

        case 'ArrowLeft':
            if (selection !== -1) {
                v = [1 / 1.2, 1 / 1.2, 1];
                mat4.scale(selectionMatrices[selection], selectionMatrices[selection], v);
            }
            selection--;
            if (selection < 0) {
                selection = selectionMatrices.length - 1;
            }
            v = [1.2, 1.2, 1];
            mat4.scale(selectionMatrices[selection], selectionMatrices[selection], v);
            break;
        case 'ArrowRight':
            if (selection !== -1) {
                v = [1 / 1.2, 1 / 1.2, 1];
                mat4.scale(selectionMatrices[selection], selectionMatrices[selection], v);
            }
            selection++;
            if (selection > selectionMatrices.length - 1) {
                selection = 0;
            }
            v = [1.2, 1.2, 1];
            mat4.scale(selectionMatrices[selection], selectionMatrices[selection], v);
            break;
        case ' ':
            if (selection !== -1) {
                v = [1 / 1.2, 1 / 1.2, 1];
                mat4.scale(selectionMatrices[selection], selectionMatrices[selection], v);
                selection = -1;
            }
            break;

        case 'k':
            if (selection !== -1) {
                v = [delta, 0, 0];
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], v);
            }
            break;
        case ';':
            if (selection !== -1) {
                v = [-delta, 0, 0];
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], v);
            }
            break;

        case 'o':
            if (selection !== -1) {
                v = [0, 0, delta];
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], v);
            }
            break;
        case 'l':
            if (selection !== -1) {
                v = [0, 0, -delta];
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], v);
            }
            break;

        case 'i':
            if (selection !== -1) {
                v = [0, delta, 0];
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], v);
            }
            break;
        case 'p':
            if (selection !== -1) {
                v = [0, -delta, 0];
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], v);
            }
            break;

        case 'K':
            if (selection !== -1) {
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
                mat4.rotateY(selectionMatrices[selection], selectionMatrices[selection], delta);
                vec3.negate(center, center);
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
            }
            break;
        case ':':
            if (selection !== -1) {
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
                mat4.rotateY(selectionMatrices[selection], selectionMatrices[selection], -delta);
                vec3.negate(center, center);
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
            }
            break;

        case 'O':
            if (selection !== -1) {
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
                mat4.rotateX(selectionMatrices[selection], selectionMatrices[selection], delta);
                vec3.negate(center, center);
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
            }
            break;
        case 'L':
            if (selection !== -1) {
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
                mat4.rotateX(selectionMatrices[selection], selectionMatrices[selection], -delta);
                vec3.negate(center, center);
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
            }
            break;

        case 'I':
            if (selection !== -1) {
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
                mat4.rotateZ(selectionMatrices[selection], selectionMatrices[selection], delta);
                vec3.negate(center, center);
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
            }
            break;
        case 'P':
            if (selection !== -1) {
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
                mat4.rotateZ(selectionMatrices[selection], selectionMatrices[selection], -delta);
                vec3.negate(center, center);
                mat4.translate(selectionMatrices[selection], selectionMatrices[selection], center);
            }
            break;

        case '!':
            if (!mystery) {
                // Make it my own
                INPUT_TRIANGLES_URL = 'attributes/triangles3.json';
                gl = canvas.getContext('webgl');
                Eye = [-0.5, -0.5, -1.0];

                for (const key in buffers) {
                    gl.deleteBuffer(buffers[key]);
                }


                // Reset the context
                gl = null;
                selectionMatrices = [];
                triBufferSize = 0;
                shaderProgram = null;
                locations = null;
                buffers = null;
                selectionBufferData = [];
                selection = -1;
                triangles = null;
                mystery = true;

                setupWebGL();
                setupShaders();
                initLocations();
                initBuffers();
                requestAnimationFrame(draw);
            } else {
                for (let s = 0; s < selectionMatrices.length; s++) {
                    center = getTriangleCenter(triangles[s]);
                    mat4.translate(selectionMatrices[s], selectionMatrices[s], center);
                    mat4.rotateY(selectionMatrices[s], selectionMatrices[s], -delta);
                    vec3.negate(center, center);
                    mat4.translate(selectionMatrices[s], selectionMatrices[s], center);
                }
            }
            break;

        default:
            break;
        }
        initBuffers();
        requestAnimationFrame(draw);
    }, false);
}
