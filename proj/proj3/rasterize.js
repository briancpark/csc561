/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0;
const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0;
const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "ellipsoids.json";
const INPUT_LIGHTS_URL = "lights.json";
const INPUT_SPHERES_URL = "spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var diffuseBuffer;
var vertexBuffer; // this contains vertex coordinates in triples
var indexBuffer; // this contains indices into vertexBuffer in triples
var ambientBuffer;
var specularBuffer;
var normalBuffer;


var altPosition; // flag indicating whether to alter vertex positions
var altPositionUniform; // where to put altPosition flag for vertex shader
var triBufferSize; // the number of indices in the triangle buffer
var colorBufferSize;
var vtxBufferSize; // the number of vertices in the vertex buffer
var shaderProgram;
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
    triBufferSize = 0; // the number of indices in the triangle buffer
    colorBufferSize = 0;
    vtxBufferSize = 0; // the number of vertices in the vertex buffer

    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    if (inputTriangles != String.null) {
        // Material
        var ambientArray = [];
        var diffuseArray = [];
        var specularArray = [];
        var nArray = [];

        // Vertex, Normals, Triangle Indices
        var vertexArray = [];
        var normalArray = [];
        var indexArray = [];

        inputTriangles.forEach(data => {
            vertexArray.push(...data.vertices.flat());
            normalArray.push(...data.normals.flat());
        });

        var offset = 0;
        inputTriangles.forEach(data => {
            data.triangles.forEach(triangle => {
                indexArray.push(...triangle.map(index => index + offset));
            });

            diffuseArray.push(...data.vertices.map(() => [...data.material.diffuse, 1.0]).flat());
            ambientArray.push(...data.vertices.map(() => [...data.material.ambient, 1.0]).flat());
            specularArray.push(...data.vertices.map(() => [...data.material.specular, 1.0]).flat());
            // nArray.push(...data.vertices.map(() => [...data.material.n, 1.0]).flat());

            offset += data.vertices.length;
        })


        triBufferSize = indexArray.length; // now total number of indices

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

        diffuseBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW);

        ambientBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW);

        specularBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW);

        // nBuffer = gl.createBuffer();
        // gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
        // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nArray), gl.STATIC_DRAW);

        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        // send the triangle indices to webGL
        indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to th
    }

  var inputLights = getJSONFile(INPUT_LIGHTS_URL, "lights");
    if (inputLights != String.null) {

    }
}

// setup the webGL shaders
function setupShaders() {

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision highp float;
       
        varying vec4 vL;
        varying vec4 vN;
        varying vec4 vE;
        varying vec4 vAmbient;
        varying vec4 vDiffuse;
        varying vec4 vSpecular;
        varying vec4 v_n;
        
        void main(void) {
            gl_FragColor = vDiffuse;
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec4 aDiffuse;
        uniform bool altPosition;

        varying vec4 vL;
        varying vec4 vN;
        varying vec4 vE;
        varying vec4 vAmbient;
        varying vec4 vDiffuse;
        varying vec4 vSpecular;
        varying vec4 v_n;

        void main(void) {
            vDiffuse = aDiffuse;
            
            
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
            shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            }
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

    gl.useProgram(shaderProgram); // activate shader program (frag and vert)

    var vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition");
    gl.enableVertexAttribArray(vertexPositionAttrib);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); // feed

    vertexColorAttrib = gl.getAttribLocation(shaderProgram, "aDiffuse");
    gl.enableVertexAttribArray(vertexColorAttrib);
    gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer);
    gl.vertexAttribPointer(vertexColorAttrib, 4, gl.FLOAT, false, 0, 0); // feed


    altPositionUniform = gl.getUniformLocation(shaderProgram, "altPosition");
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.uniform1i(altPositionUniform, altPosition);


    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0);
} // end render triangles

function main() {
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
