/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0;
const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0;
const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
const INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog3/lights.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var colorBufferSize = 0;
var altPosition; // flag indicating whether to alter vertex positions
var vertexPositionAttrib; // where to put position for vertex shader
var vertexColorAttrib; // where to put color for vertex shader
var altPositionUniform; // where to put altPosition flag for vertex shader


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET", url, false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try

    catch (e) {
        console.log(e);
        return (String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    if (inputTriangles != String.null) {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var indexArray = []; // 1D array of vertex indices for WebGL
        var colorArray = []; // 1D array of vertex color for WebGL
        var vtxBufferSize = 0; // the number of vertices in the vertex buffer
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array

        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            vec3.set(indexOffset, vtxBufferSize, vtxBufferSize, vtxBufferSize); // update vertex offset

            // set up the vertex coord array
            for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                coordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);
                coordArray.push(inputTriangles[whichSet].material.diffuse[0], inputTriangles[whichSet].material.diffuse[1], inputTriangles[whichSet].material.diffuse[2]);
            } // end for vertices in set

            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd, indexOffset, inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);
            } // end for triangles in set

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris
            colorBufferSize += inputTriangles[whichSet].triangles.length * 3;
        } // end for each triangle set
        triBufferSize *= 3; // now total number of indices

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to th
    } // end if triangles found

} // end load triangles

// setup the webGL shaders
function setupShaders() {

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;
        varying vec3 vColor;
        
        void main(void) {
            gl_FragColor = vec4(vColor, 1.0);
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexColor;
        uniform bool altPosition;
        varying vec3 vColor;

        void main(void) {
            vColor = vertexColor;
            if(altPosition)
                gl_Position = vec4(vertexPosition + vec3(-1.0, -1.0, 0.0), 1.0); // use the altered position
            else
                gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
        }
    `;

    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader progr
                // am link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition");
                vertexColorAttrib =
                    gl.getAttribLocation(shaderProgram, "vertexColor"); // get pointer to vertex shader input
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                gl.enableVertexAttribArray(vertexColorAttrib); // input to shader from array

                altPositionUniform = // get pointer to altPosition flag
                    gl.getUniformLocation(shaderProgram, "altPosition");
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try

    catch (e) {
        console.log(e);
    } // end catch
    altPosition = false;
    setTimeout(function alterPosition() {
        altPosition = !altPosition;
        setTimeout(alterPosition, 2000);
    }, 2000); // switch flag value every 2 seconds
} // end setup shaders
var bgColor = 0;

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    gl.clearColor(bgColor, 0, 0, 1.0);
    requestAnimationFrame(renderTriangles);
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 0); // feed
    gl.vertexAttribPointer(vertexColorAttrib, 3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT); // feed
    gl.uniform1i(altPositionUniform, altPosition); // feed

    // gl.drawArrays(gl.TRIANGLES, 0, 3); // render
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0);
} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

function main() {
    var lights = getJSONFile(INPUT_LIGHTS_URL, "lights");
    console.log(lights);

    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL


    /*
        a and d — translate view left (a) and right (d) along view X
        w and s — translate view forward (w) and backward (s) along view Z
        q and e — translate view up (q) and down (e) along view Y
        A and D — rotate view left (A) and right (D) around view Y (yaw)
        W and S — rotate view forward (W) and backward (S) around view X (pitch)
    */

    document.addEventListener('keydown', function (event) {
        switch (event.key) {
            case 65: // a
                break;
            case 68: // d
                break;

            case 87: // w
                break;
            case 83: // s
                break;

            case 81: // q
                break;
            case 69: // e
                break;

            default:
            // do nothing

        }

    }, false);

} // end main
