/* eslint-disable require-jsdoc, no-throw-literal, prefer-spread, max-len, no-unused-vars, guard-for-in, no-var */

/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
let INPUT_TRIANGLES_URL = 'attributes/triangles.json'; // triangles file loc
const INPUT_ELLIPSOIDS_URL = 'attributes/ellipsoids.json'; // ellipsoids file loc
const defaultEye = vec3.fromValues(0.5, 0.5, -0.5); // default eye position in world space
const defaultCenter = vec3.fromValues(0.5, 0.5, 0.5); // default view direction in world space
const defaultUp = vec3.fromValues(0, 1, 0); // default view up vector
const lightAmbient = vec3.fromValues(1, 1, 1); // default light ambient emission
const lightDiffuse = vec3.fromValues(1, 1, 1); // default light diffuse emission
const lightSpecular = vec3.fromValues(1, 1, 1); // default light specular emission
const lightPosition = vec3.fromValues(-0.5, 1.5, -0.5); // default light position
const rotateTheta = Math.PI / 50; // how much to rotate models by with each key press

/* webgl and geometry data */
let gl = null; // the all powerful gl object. It's all here folks!
let inputTriangles = []; // the triangle data as loaded from input files
let numTriangleSets = 0; // how many triangle sets in input scene
let inputEllipsoids = []; // the ellipsoid data as loaded from input files
let numEllipsoids = 0; // how many ellipsoids in the input scene
const vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
const normalBuffers = []; // this contains normal component lists by set, in triples
const triSetSizes = []; // this contains the size of each triangle set
const triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
let viewDelta = 0; // how much to displace view with each key press

let replace = true;
const UVBuffer = [];
const textures = [];
let textureULoc;
let alphaULoc;
let texCoordAttirbLoc;
let replaceULoc;
/* shader parameter locations */
let vPosAttribLoc; // where to put position for vertex shader
let mMatrixULoc; // where to put model matrix for vertex shader
let pvmMatrixULoc; // where to put project model view matrix for vertex shader
let ambientULoc; // where to put ambient reflecivity for fragment shader
let diffuseULoc; // where to put diffuse reflecivity for fragment shader
let specularULoc; // where to put specular reflecivity for fragment shader
let shininessULoc; // where to put specular exponent for fragment shader

/* interaction variables */
let Eye = vec3.clone(defaultEye); // eye position in world space
let Center = vec3.clone(defaultCenter); // view direction in world space
let Up = vec3.clone(defaultUp); // view up vector in world space

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

//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Because images have to be downloaded over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
    gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        width,
        height,
        border,
        srcFormat,
        srcType,
        pixel,
    );

    const image = new Image();
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            level,
            internalFormat,
            srcFormat,
            srcType,
            image,
        );

        // WebGL1 has different requirements for power of 2 images
        // vs. non power of 2 images so check if the image is a
        // power of 2 in both dimensions.
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            // Yes, it's a power of 2. Generate mips.
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            // No, it's not a power of 2. Turn off mips and set
            // wrapping to clamp to edge
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    image.src = url;

    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
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
        }
    } catch (e) {
        console.log(e);
        return (String.null);
    }
}

// does stuff when keys are pressed
function handleKeyDown(event) {
    const modelEnum = {TRIANGLES: 'triangles', ELLIPSOID: 'ellipsoid'}; // enumerated model type
    const dirEnum = {NEGATIVE: -1, POSITIVE: 1}; // enumerated rotation direction

    function highlightModel(modelType, whichModel) {
        if (handleKeyDown.modelOn != null) {
            handleKeyDown.modelOn.on = false;
        }
        handleKeyDown.whichOn = whichModel;
        if (modelType == modelEnum.TRIANGLES) {
            handleKeyDown.modelOn = inputTriangles[whichModel];
        } else {
            handleKeyDown.modelOn = inputEllipsoids[whichModel];
        }
        handleKeyDown.modelOn.on = true;
    } // end highlight model

    function translateModel(offset) {
        if (handleKeyDown.modelOn != null) {
            vec3.add(handleKeyDown.modelOn.translation, handleKeyDown.modelOn.translation, offset);
        }
    } // end translate model

    function rotateModel(axis, direction) {
        if (handleKeyDown.modelOn != null) {
            const newRotation = mat4.create();

            mat4.fromRotation(newRotation, direction * rotateTheta, axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis, handleKeyDown.modelOn.xAxis, newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis, handleKeyDown.modelOn.yAxis, newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model

    // set up needed view params
    let lookAt = vec3.create();
    let viewRight = vec3.create();
    const temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt, vec3.subtract(temp, Center, Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight, vec3.cross(temp, lookAt, Up)); // get view right vector

    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    switch (event.code) {
    // model selection
    case 'Space':
        if (handleKeyDown.modelOn != null) {
            handleKeyDown.modelOn.on = false;
        } // turn off highlighted model
        handleKeyDown.modelOn = null; // no highlighted model
        handleKeyDown.whichOn = -1; // nothing highlighted
        break;
    case 'ArrowRight': // select next triangle set
        highlightModel(modelEnum.TRIANGLES, (handleKeyDown.whichOn + 1) % numTriangleSets);
        break;
    case 'ArrowLeft': // select previous triangle set
        highlightModel(modelEnum.TRIANGLES, (handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn - 1 : numTriangleSets - 1);
        break;
    case 'ArrowUp': // select next ellipsoid
        highlightModel(modelEnum.ELLIPSOID, (handleKeyDown.whichOn + 1) % numEllipsoids);
        break;
    case 'ArrowDown': // select previous ellipsoid
        highlightModel(modelEnum.ELLIPSOID, (handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn - 1 : numEllipsoids - 1);
        break;

        // view change
    case 'KeyA': // translate view left, rotate left with shift
        Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, viewDelta));
        if (!event.getModifierState('Shift')) {
            Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, viewDelta));
        }
        break;
    case 'KeyD': // translate view right, rotate right with shift
        Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, -viewDelta));
        if (!event.getModifierState('Shift')) {
            Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, -viewDelta));
        }
        break;
    case 'KeyS': // translate view backward, rotate up with shift
        if (event.getModifierState('Shift')) {
            Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
            Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
        } else {
            Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, -viewDelta));
            Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, -viewDelta));
        } // end if shift not pressed
        break;
    case 'KeyW': // translate view forward, rotate down with shift
        if (event.getModifierState('Shift')) {
            Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
            Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
        } else {
            Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, viewDelta));
            Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, viewDelta));
        } // end if shift not pressed
        break;
    case 'KeyQ': // translate view up, rotate counterclockwise with shift
        if (event.getModifierState('Shift')) {
            Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, -viewDelta)));
        } else {
            Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, viewDelta));
            Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
        } // end if shift not pressed
        break;
    case 'KeyE': // translate view down, rotate clockwise with shift
        if (event.getModifierState('Shift')) {
            Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, viewDelta)));
        } else {
            Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, -viewDelta));
            Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
        } // end if shift not pressed
        break;
    case 'Escape': // reset view to default
        Eye = vec3.copy(Eye, defaultEye);
        Center = vec3.copy(Center, defaultCenter);
        Up = vec3.copy(Up, defaultUp);
        break;

        // model transformation
    case 'KeyK': // translate left, rotate left with shift
        if (event.getModifierState('Shift')) {
            rotateModel(Up, dirEnum.NEGATIVE);
        } else {
            translateModel(vec3.scale(temp, viewRight, viewDelta));
        }
        break;
    case 'Semicolon': // translate right, rotate right with shift
        if (event.getModifierState('Shift')) {
            rotateModel(Up, dirEnum.POSITIVE);
        } else {
            translateModel(vec3.scale(temp, viewRight, -viewDelta));
        }
        break;
    case 'KeyL': // translate backward, rotate up with shift
        if (event.getModifierState('Shift')) {
            rotateModel(viewRight, dirEnum.POSITIVE);
        } else {
            translateModel(vec3.scale(temp, lookAt, -viewDelta));
        }
        break;
    case 'KeyO': // translate forward, rotate down with shift
        if (event.getModifierState('Shift')) {
            rotateModel(viewRight, dirEnum.NEGATIVE);
        } else {
            translateModel(vec3.scale(temp, lookAt, viewDelta));
        }
        break;
    case 'KeyI': // translate up, rotate counterclockwise with shift
        if (event.getModifierState('Shift')) {
            rotateModel(lookAt, dirEnum.POSITIVE);
        } else {
            translateModel(vec3.scale(temp, Up, viewDelta));
        }
        break;
    case 'KeyP': // translate down, rotate clockwise with shift
        if (event.getModifierState('Shift')) {
            rotateModel(lookAt, dirEnum.NEGATIVE);
        } else {
            translateModel(vec3.scale(temp, Up, -viewDelta));
        }
        break;
    case 'KeyB':
        replace = !replace;
        break;
    case 'Digit1':
        if (event.getModifierState('Shift')) {
            // reset everythign and rerender everything with attributes/teapot.json
            gl = null;
            inputTriangles = getJSONFile('attributes/triangles2.json', 'triangles2'); // read in the triangle data
            INPUT_TRIANGLES_URL = 'attributes/triangles2.json';
            setupWebGL(); // set up the webGL environment
            loadModels(); // load in the models from tri file
            setupShaders(); // setup the webGL shaders
            renderModels(); // draw the triangles using webGL
        }
        break;
    case 'Backspace': // reset model transforms to default
        for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
            vec3.set(inputTriangles[whichTriSet].translation, 0, 0, 0);
            vec3.set(inputTriangles[whichTriSet].xAxis, 1, 0, 0);
            vec3.set(inputTriangles[whichTriSet].yAxis, 0, 1, 0);
        }
        for (let whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
            vec3.set(inputEllipsoids[whichEllipsoid].translation, 0, 0, 0);
            vec3.set(inputEllipsoids[whichTriSet].xAxis, 1, 0, 0);
            vec3.set(inputEllipsoids[whichTriSet].yAxis, 0, 1, 0);
        }
        break;
    }
}

// set up the webGL environment
function setupWebGL() {
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed


    const imageCanvas = document.getElementById('myImageCanvas'); // create a 2d canvas
    const cw = imageCanvas.width;
    const ch = imageCanvas.height;
    imageContext = imageCanvas.getContext('2d');
    const bkgdImage = new Image();
    bkgdImage.crossOrigin = 'Anonymous';
    bkgdImage.src = 'attributes/sky.jpg';
    bkgdImage.onload = function() {
        const iw = bkgdImage.width;
        const ih = bkgdImage.height;
        imageContext.drawImage(bkgdImage, 0, 0, iw, ih, 0, 0, cw, ch);
    };


    // Get the canvas and context
    const canvas = document.getElementById('myWebGLCanvas'); // create a js canvas
    gl = canvas.getContext('webgl'); // get a webgl object from it

    try {
        if (gl == null) {
            throw 'unable to create gl context -- is your browser gl ready?';
        } else {
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } catch (e) {
        console.log(e);
    }
}

// read models in, load them into webgl buffers
function loadModels() {
    // make an ellipsoid, with numLongSteps longitudes.
    // start with a sphere of radius 1 at origin
    // Returns verts, tris and normals.
    function makeEllipsoid(currEllipsoid, numLongSteps) {
        try {
            if (numLongSteps % 2 != 0) {
                throw 'in makeSphere: uneven number of longitude steps!';
            } else if (numLongSteps < 4) {
                throw 'in makeSphere: number of longitude steps too small!';
            } else { // good number longitude steps
                // make vertices
                var ellipsoidVertices = [0, -1, 0]; // vertices to return, init to south pole
                const angleIncr = (Math.PI + Math.PI) / numLongSteps; // angular increment
                const latLimitAngle = angleIncr * (Math.floor(numLongSteps / 4) - 1); // start/end lat angle
                let latRadius;
                let latY; // radius and Y at current latitude
                for (let latAngle = -latLimitAngle; latAngle <= latLimitAngle; latAngle += angleIncr) {
                    latRadius = Math.cos(latAngle); // radius of current latitude
                    latY = Math.sin(latAngle); // height at current latitude
                    for (let longAngle = 0; longAngle < 2 * Math.PI; longAngle += angleIncr) {
                        ellipsoidVertices.push(latRadius * Math.sin(longAngle), latY, latRadius * Math.cos(longAngle));
                    }
                } // end for each latitude
                ellipsoidVertices.push(0, 1, 0); // add north pole
                ellipsoidVertices = ellipsoidVertices.map(function(val, idx) { // position and scale ellipsoid
                    switch (idx % 3) {
                    case 0: // x
                        return (val * currEllipsoid.a + currEllipsoid.x);
                    case 1: // y
                        return (val * currEllipsoid.b + currEllipsoid.y);
                    case 2: // z
                        return (val * currEllipsoid.c + currEllipsoid.z);
                    } // end switch
                });

                // make normals using the ellipsoid gradient equation
                // resulting normals are unnormalized: we rely on shaders to normalize
                var ellipsoidNormals = ellipsoidVertices.slice(); // start with a copy of the transformed verts
                ellipsoidNormals = ellipsoidNormals.map(function(val, idx) { // calculate each normal
                    switch (idx % 3) {
                    case 0: // x
                        return (2 / (currEllipsoid.a * currEllipsoid.a) * (val - currEllipsoid.x));
                    case 1: // y
                        return (2 / (currEllipsoid.b * currEllipsoid.b) * (val - currEllipsoid.y));
                    case 2: // z
                        return (2 / (currEllipsoid.c * currEllipsoid.c) * (val - currEllipsoid.z));
                    } // end switch
                });

                // make triangles, from south pole to middle latitudes to north pole
                var ellipsoidTriangles = []; // triangles to return
                for (var whichLong = 1; whichLong < numLongSteps; whichLong++) {
                    ellipsoidTriangles.push(0, whichLong, whichLong + 1);
                }
                ellipsoidTriangles.push(0, numLongSteps, 1); // longitude wrap tri
                let llVertex; // lower left vertex in the current quad
                for (let whichLat = 0; whichLat < (numLongSteps / 2 - 2); whichLat++) {
                    for (var whichLong = 0; whichLong < numLongSteps - 1; whichLong++) {
                        llVertex = whichLat * numLongSteps + whichLong + 1;
                        ellipsoidTriangles.push(llVertex, llVertex + numLongSteps, llVertex + numLongSteps + 1);
                        ellipsoidTriangles.push(llVertex, llVertex + numLongSteps + 1, llVertex + 1);
                    }
                    ellipsoidTriangles.push(llVertex + 1, llVertex + numLongSteps + 1, llVertex + 2);
                    ellipsoidTriangles.push(llVertex + 1, llVertex + 2, llVertex - numLongSteps + 2);
                }
                for (var whichLong = llVertex + 2; whichLong < llVertex + numLongSteps + 1; whichLong++) {
                    ellipsoidTriangles.push(whichLong, ellipsoidVertices.length / 3 - 1, whichLong + 1);
                }
                ellipsoidTriangles.push(ellipsoidVertices.length / 3 - 2, ellipsoidVertices.length / 3 - 1,
                    ellipsoidVertices.length / 3 - numLongSteps - 1); // longitude wrap
            }
            return ({vertices: ellipsoidVertices, normals: ellipsoidNormals, triangles: ellipsoidTriangles});
        } catch (e) {
            console.log(e);
        }
    }

    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, 'triangles'); // read in the triangle data

    try {
        if (inputTriangles == String.null) {
            throw 'Unable to load triangles file!';
        } else {
            let whichSetVert; // index of vertex in current triangle set
            let whichSetTri; // index of triangle in current triangle set
            let vtxToAdd; // vtx coords to add to the coord array
            let normToAdd; // vtx normal to add to the coord array
            let triToAdd; // tri indices to add to the index array
            const maxCorner = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); // bbox corner
            const minCorner = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); // other corner

            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (let whichSet = 0; whichSet < numTriangleSets; whichSet++) { // for each tri set
                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0, 0, 0); // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0, 0, 0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1, 0, 0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0, 1, 0); // model Y axis

                textures[whichSet] = loadTexture(gl, 'attributes/' + inputTriangles[whichSet].material.texture);

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                inputTriangles[whichSet].glUVs = [];
                const numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert = 0; whichSetVert < numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    uvsToAdd = inputTriangles[whichSet].uvs[whichSetVert];
                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0], normToAdd[1], normToAdd[2]); // put normal in set coord list
                    inputTriangles[whichSet].glUVs.push(uvsToAdd[0], uvsToAdd[1]);
                    vec3.max(maxCorner, maxCorner, vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner, minCorner, vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center, inputTriangles[whichSet].center, 1 / numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glVertices), gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glNormals), gl.STATIC_DRAW); // data in

                UVBuffer[whichSet] = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, UVBuffer[whichSet]);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glUVs), gl.STATIC_DRAW);

                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri = 0; whichSetTri < triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0], triToAdd[1], triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inputTriangles[whichSet].glTriangles), gl.STATIC_DRAW); // data in
            } // end for each triangle set

            inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL, 'ellipsoids'); // read in the ellipsoids

            if (inputEllipsoids == String.null) {
                throw 'Unable to load ellipsoids file!';
            } else {
                // init ellipsoid highlighting, translation and rotation; update bbox
                let ellipsoid; // current ellipsoid
                let ellipsoidModel; // current ellipsoid triangular model
                const temp = vec3.create(); // an intermediate vec3
                const minXYZ = vec3.create();
                const maxXYZ = vec3.create(); // min/max xyz from ellipsoid
                numEllipsoids = inputEllipsoids.length; // remember how many ellipsoids
                for (let whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
                    // set up various stats and transforms for this ellipsoid
                    ellipsoid = inputEllipsoids[whichEllipsoid];
                    ellipsoid.on = false; // ellipsoids begin without highlight
                    ellipsoid.translation = vec3.fromValues(0, 0, 0); // ellipsoids begin without translation
                    ellipsoid.xAxis = vec3.fromValues(1, 0, 0); // ellipsoid X axis
                    ellipsoid.yAxis = vec3.fromValues(0, 1, 0); // ellipsoid Y axis
                    ellipsoid.center = vec3.fromValues(ellipsoid.x, ellipsoid.y, ellipsoid.z); // locate ellipsoid ctr
                    vec3.set(minXYZ, ellipsoid.x - ellipsoid.a, ellipsoid.y - ellipsoid.b, ellipsoid.z - ellipsoid.c);
                    vec3.set(maxXYZ, ellipsoid.x + ellipsoid.a, ellipsoid.y + ellipsoid.b, ellipsoid.z + ellipsoid.c);
                    vec3.min(minCorner, minCorner, minXYZ); // update world bbox min corner
                    vec3.max(maxCorner, maxCorner, maxXYZ); // update world bbox max corner

                    // make the ellipsoid model
                    ellipsoidModel = makeEllipsoid(ellipsoid, 32);

                    // send the ellipsoid vertex coords and normals to webGL
                    vertexBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[vertexBuffers.length - 1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ellipsoidModel.vertices), gl.STATIC_DRAW); // data in
                    normalBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex normal buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[normalBuffers.length - 1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ellipsoidModel.normals), gl.STATIC_DRAW); // data in

                    triSetSizes.push(ellipsoidModel.triangles.length);

                    // send the triangle indices to webGL
                    triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length - 1]); // activate that buffer
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ellipsoidModel.triangles), gl.STATIC_DRAW); // data in
                } // end for each ellipsoid

                viewDelta = vec3.length(vec3.subtract(temp, maxCorner, minCorner)) / 100; // set global
            }
        }
    } catch (e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {
    // define vertex shader in essl using es6 template strings
    const vShaderCode = loadShaderFile('./vshader.glsl');
    const fShaderCode = loadShaderFile('./fshader.glsl');

    try {
        const fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

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

                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, 'aVertexPosition'); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, 'aVertexNormal'); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array

                texCoordAttirbLoc = gl.getAttribLocation(shaderProgram, 'aTexCoord'); // ptr to texture pos attrib
                gl.enableVertexAttribArray(texCoordAttirbLoc); // connect attrib to array

                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, 'umMatrix'); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, 'upvmMatrix'); // ptr to pvmmat

                // locate fragment uniforms
                const eyePositionULoc = gl.getUniformLocation(shaderProgram, 'uEyePosition'); // ptr to eye position
                const lightAmbientULoc = gl.getUniformLocation(shaderProgram, 'uLightAmbient'); // ptr to light ambient
                const lightDiffuseULoc = gl.getUniformLocation(shaderProgram, 'uLightDiffuse'); // ptr to light diffuse
                const lightSpecularULoc = gl.getUniformLocation(shaderProgram, 'uLightSpecular'); // ptr to light specular
                const lightPositionULoc = gl.getUniformLocation(shaderProgram, 'uLightPosition'); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, 'uAmbient'); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, 'uDiffuse'); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, 'uSpecular'); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, 'uShininess'); // ptr to shininess

                // locate texture uniforms
                textureULoc = gl.getUniformLocation(shaderProgram, 'uTexture');
                alphaULoc = gl.getUniformLocation(shaderProgram, 'uAlpha');
                replaceULoc = gl.getUniformLocation(shaderProgram, 'uReplace');

                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc, Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc, lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc, lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc, lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc, lightPosition); // pass in the light's position
            }
        }
    } catch (e) {
        console.log(e);
    }
}

// render the loaded model
function renderModels() {
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        const zAxis = vec3.create();
        const sumRotation = mat4.create();
        const temp = mat4.create();
        const negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix, vec3.negate(negCtr, currModel.center));

        // scale for highlighting if needed
        if (currModel.on) {
            mat4.multiply(mMatrix, mat4.fromScaling(temp, vec3.fromValues(1.2, 1.2, 1.2)), mMatrix);
        } // S(1.2) * T(-ctr)

        // rotate the model to current interactive orientation
        vec3.normalize(zAxis, vec3.cross(zAxis, currModel.xAxis, currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0, 0, 1);
        mat4.multiply(mMatrix, sumRotation, mMatrix); // R(ax) * S(1.2) * T(-ctr)

        // translate back to model center
        mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.center), mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.translation), mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)
    } // end make model transform

    // var hMatrix = mat4.create(); // handedness matrix
    const pMatrix = mat4.create(); // projection matrix
    const vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    const pvMatrix = mat4.create(); // hand * proj * view matrices
    let pvmMatrix = mat4.create(); // hand * proj * view * model matrices

    window.requestAnimationFrame(renderModels); // set up frame render callback

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix, 0.5 * Math.PI, 1, 0.1, 10); // create projection matrix
    mat4.lookAt(vMatrix, Eye, Center, Up); // create view matrix
    mat4.multiply(pvMatrix, pvMatrix, pMatrix); // projection
    mat4.multiply(pvMatrix, pvMatrix, vMatrix); // projection * view

    // render each triangle set
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let currSet; // the tri set and its material properties
    for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet];
        if (currSet.material.alpha >= 1.0) {
            // make model transform, add to view project
            makeModelTransform(currSet);
            mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
            gl.uniform1f(alphaULoc, currSet.material.alpha);
            gl.uniform1i(replaceULoc, replace);
            gl.uniform1i(textureULoc, 0);
            gl.activeTexture(gl.TEXTURE0);

            // vertex buffer: activate and feed into vertex shader
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichTriSet]); // activate
            gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichTriSet]); // activate
            gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed

            // texture buffer: activate and feed into vertex shader
            gl.bindBuffer(gl.ARRAY_BUFFER, UVBuffer[whichTriSet]); // activate
            gl.vertexAttribPointer(texCoordAttirbLoc, 2, gl.FLOAT, false, 0, 0);
            gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]); // activate

            // triangle buffer: activate and render
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichTriSet]); // activate
            gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[whichTriSet], gl.UNSIGNED_SHORT, 0); // render
        }
    } // end for each triangle set

    var ellipsoid;
    var instanceTransform = mat4.create(); // the current ellipsoid and material
    for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
        ellipsoid = inputEllipsoids[whichEllipsoid];

        // define model transform, premult with pvmMatrix, feed to vertex shader
        makeModelTransform(ellipsoid);
        pvmMatrix = mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // premultiply with pv matrix
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc, ellipsoid.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc, ellipsoid.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc, ellipsoid.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc, ellipsoid.n); // pass in the specular exponent

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[numTriangleSets + whichEllipsoid]); // activate vertex buffer
        gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed vertex buffer to shader
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[numTriangleSets + whichEllipsoid]); // activate normal buffer
        gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed normal buffer to shader
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[numTriangleSets + whichEllipsoid]); // activate tri buffer

        // draw a transformed instance of the ellipsoid
        gl.drawElements(gl.TRIANGLES, triSetSizes[numTriangleSets + whichEllipsoid], gl.UNSIGNED_SHORT, 0); // render
    } // end for each ellipsoid


    // Transparency
    const transparencyOrder = [];
    for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet];
        if (currSet.material.alpha < 1.0) {
            transparencyOrder.push(whichTriSet);
        }
    }

    function paintersAlg(a, b) {
        makeModelTransform(inputTriangles[a]);
        let v0 = vec3.create();
        let v1 = vec3.create();
        mat4.getTranslation(v0, mMatrix);
        vec3.add(v1, v0, inputTriangles[a].center);
        const dist = vec3.distance(v1, Eye);

        makeModelTransform(inputTriangles[b]);
        v0 = vec3.create();
        v1 = vec3.create();
        mat4.getTranslation(v0, mMatrix);
        vec3.add(v1, v0, inputTriangles[b].center);
        return vec3.distance(v1, Eye) - dist;
    }

    transparencyOrder.sort(paintersAlg);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    for (var whichTriSet = 0; whichTriSet < transparencyOrder.length; whichTriSet++) {
        currSet = inputTriangles[transparencyOrder[whichTriSet]];
        if (currSet.material.alpha < 1.0) {
            // make model transform, add to view project
            makeModelTransform(currSet);
            mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
            gl.uniform1f(alphaULoc, currSet.material.alpha); // pass in the specular exponent
            gl.uniform1i(replaceULoc, replace);
            gl.uniform1i(textureULoc, 0);
            gl.activeTexture(gl.TEXTURE0);

            // vertex buffer: activate and feed into vertex shader
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[transparencyOrder[whichTriSet]]); // activate
            gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[transparencyOrder[whichTriSet]]); // activate
            gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed

            // texture buffer: activate and feed into vertex shader
            gl.bindBuffer(gl.ARRAY_BUFFER, UVBuffer[transparencyOrder[whichTriSet]]);
            gl.vertexAttribPointer(texCoordAttirbLoc, 2, gl.FLOAT, false, 0, 0);
            gl.bindTexture(gl.TEXTURE_2D, textures[transparencyOrder[whichTriSet]]);

            // triangle buffer: activate and render
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichTriSet]); // activate
            gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[whichTriSet], gl.UNSIGNED_SHORT, 0); // render

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[transparencyOrder[whichTriSet]]); // activate
            gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[transparencyOrder[whichTriSet]], gl.UNSIGNED_SHORT, 0); // render
        }
    } // end for each triangle set


    var ellipsoid;
    var instanceTransform = mat4.create(); // the current ellipsoid and material
    for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
        ellipsoid = inputEllipsoids[whichEllipsoid];

        if (ellipsoid.texture.indexOf('png') == -1) {
            gl.depthMask(false);

            // define model transform, premult with pvmMatrix, feed to vertex shader
            makeModelTransform(ellipsoid);
            pvmMatrix = mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // premultiply with pv matrix
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, ellipsoid.glTexture);
            gl.uniform1i(textureULoc, 0);

            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc, ellipsoid.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc, ellipsoid.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc, ellipsoid.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc, ellipsoid.n); // pass in the specular exponent

            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[numTriangleSets + whichEllipsoid]); // activate vertex buffer
            gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed vertex buffer to shader
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[numTriangleSets + whichEllipsoid]); // activate normal buffer
            gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed normal buffer to shader
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[numTriangleSets + whichEllipsoid]); // activate tri buffer

            gl.bindBuffer(gl.ARRAY_BUFFER, textures[numTriangleSets + whichEllipsoid]);
            gl.enableVertexAttribArray(texCoordAttirbLoc);
            gl.vertexAttribPointer(texCoordAttirbLoc, 2, gl.FLOAT, false, 0, 0);

            // draw a transformed instance of the ellipsoid
            gl.drawElements(gl.TRIANGLES, triSetSizes[numTriangleSets + whichEllipsoid], gl.UNSIGNED_SHORT, 0); // render
        }
    }
} // end render model


/* MAIN -- HERE is where execution begins after window load */

function main() {
    setupWebGL(); // set up the webGL environment
    loadModels(); // load in the models from tri file
    setupShaders(); // setup the webGL shaders
    renderModels(); // draw the triangles using webGL
} // end main
