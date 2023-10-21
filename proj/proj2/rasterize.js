/* GLOBAL CONSTANTS AND VARIABLES */

/* eslint-disable require-jsdoc, max-len, no-throw-literal, no-unused-vars */

/* assignment specific globals */
const INPUT_TRIANGLES_URL = 'https://ncsucgclass.github.io/prog2/triangles.json'; // triangles file loc

/* webgl globals */
let gl = null; // the all powerful gl object. It's all here folks!
let vertexBuffer; // this contains vertex coordinates in triples
let triangleBuffer; // this contains indices into vertexBuffer in triples
let triBufferSize = 0; // the number of indices in the triangle buffer
let vertexPositionAttrib; // where to put position for vertex shader
let vertexColorAttrib; // where to put color for vertex shader


// ASSIGNMENT HELPER FUNCTIONS

function loadShaderFile(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // `false` makes the request synchronous
    xhr.send();

    if (xhr.status !== 200) {
        throw new Error(`Failed to load shader file: ${url}`);
    }

    return xhr.responseText;
}


// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== 'string') || (typeof (descr) !== 'string')) {
            throw 'getJSONFile: parameter not a string';
        } else {
            const httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open('GET', url, false); // init the request
            httpReq.send(null); // send the request
            const startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000) {
                    break;
                }
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE)) {
                throw 'Unable to open ' + descr + ' file!';
            } else {
                return JSON.parse(httpReq.response);
            }
        } // end if good params
    } catch (e) {
        console.log(e);
        return (String.null);
    }
}

// set up the webGL environment
function setupWebGL() {
    // Get the canvas and context
    const canvas = document.getElementById('myWebGLCanvas'); // create a js canvas
    gl = canvas.getContext('webgl'); // get a webgl object from it

    try {
        if (gl == null) {
            throw 'unable to create gl context -- is your browser gl ready?';
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } catch (e) {
        console.log(e);
    }
}

// read triangles in, load them into webgl buffers
function loadTriangles(random = false) {
    const inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, 'triangles');
    if (inputTriangles != String.null) {
        let whichSetVert; // index of vertex in current triangle set
        let whichSetTri; // index of triangle in current triangle set
        const coordArray = []; // 1D array of vertex coords for WebGL
        const indexArray = []; // 1D array of vertex indices for WebGL
        let vtxBufferSize = 0; // the number of vertices in the vertex buffer
        let vtxToAdd = []; // vtx coords to add to the coord array
        const indexOffset = vec3.create(); // the index offset for the current set
        const triToAdd = vec3.create(); // tri indices to add to the index array

        for (let whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            vec3.set(indexOffset, vtxBufferSize, vtxBufferSize, vtxBufferSize); // update vertex offset

            // set up the vertex coord array
            for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                coordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);
                if (random == true) {
                    coordArray.push(Math.random(), Math.random(), Math.random());
                } else {
                    coordArray.push(inputTriangles[whichSet].material.diffuse[0], inputTriangles[whichSet].material.diffuse[1], inputTriangles[whichSet].material.diffuse[2]);
                }
            } // end for vertices in set

            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd, indexOffset, inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);
            } // end for triangles in set

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris
        } // end for each triangle set
        triBufferSize *= 3; // now total number of indices

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to that buffer
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    // define fragment shader in essl using es6 template strings
    const fShaderCode = loadShaderFile('fShader.glsl');
    const vShaderCode = loadShaderFile('vShader.glsl');

    try {
        // console.log("fragment shader: "+fShaderCode);
        const fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        const vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw 'error during fragment shader compile: ' + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw 'error during vertex shader compile: ' + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            const shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw 'error during shader program linking: ' + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib =
                    gl.getAttribLocation(shaderProgram, 'vertexPosition'); // get pointer to vertex shader input
                vertexColorAttrib =
                    gl.getAttribLocation(shaderProgram, 'vertexColor'); // get pointer to vertex shader input

                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                gl.enableVertexAttribArray(vertexColorAttrib); // input to shader from array
            } // end if no shader program link errors
        } // end if no compile errors
    } catch (e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 0); // feed
    gl.vertexAttribPointer(vertexColorAttrib, 3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT); // feed

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0); // render
} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

function main() {
    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL

    document.addEventListener('keydown', function(event) {
        if (event.keyCode === 32) {
            // clear the canvas
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
            // clear the buffers
            gl.deleteBuffer(vertexBuffer);
            gl.deleteBuffer(triangleBuffer);

            // reset variables
            triBufferSize = 0;

            loadTriangles(true); // load in the triangles from tri file
            setupShaders(); // setup the webGL shaders
            renderTriangles(); // draw the triangles using webGL
        }
    }, false);
} // end main
