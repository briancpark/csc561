/* eslint-disable require-jsdoc, no-throw-literal, prefer-spread, max-len, no-unused-vars, guard-for-in, no-var */

/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_FROG_URL = 'attributes/frog.json';
const INPUT_ELLIPSOIDS_URL = 'attributes/ellipsoids.json'; // ellipsoids file loc
const defaultEye = vec3.fromValues(0.7, 0.5, -0.9); // default eye position in world space
const defaultCenter = vec3.fromValues(0.7, 0.8, 1.0); // default view direction in world space
const defaultUp = vec3.fromValues(0, 1, 0); // default view up vector
const lightAmbient = vec3.fromValues(0.4, 0.4, 1); // default light ambient emission
const lightDiffuse = vec3.fromValues(1, 1, 1); // default light diffuse emission
const lightSpecular = vec3.fromValues(1, 1, 1); // default light specular emission
const lightPosition = vec3.fromValues(0.1, 0.5, -1); // default light position
const rotateTheta = Math.PI / 50; // how much to rotate models by with each key press

/* webgl and geometry data */
let gl = null; // the all powerful gl object. It's all here folks!
let inputFrog = []; // the triangle data as loaded from input files
const inputTrucks = []; // the triangle data as loaded from input files
let numTriangleSets = 0; // how many triangle sets in input scene
const inputEllipsoids = []; // the ellipsoid data as loaded from input files
const numEllipsoids = 0; // how many ellipsoids in the input scene
const vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
const normalBuffers = []; // this contains normal component lists by set, in triples
const triSetSizes = []; // this contains the size of each triangle set
const triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
const viewDelta = 0.1; // how much to displace view with each key press

const replace = true;
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

// 14 x 14 grid
STEP_SCALE = 0.1;
const playerPosition = {x: 6, y: 0};
var DISTANCE = 1.4;
var speed0 = 0.001;
var speed1 = 0.0005;
var speed2 = 0.0001;
var speed3 = 0.0015;
var speed4 = 0.0025;
let lastTime = 0;
const fpsInterval = 1000 / 30; // 30 FPS

var enemiesPositions = [
    {x: -1, y: -1},

    {x: 0, y: 1},
    {x: 4, y: 1},
    {x: 8, y: 1},
    {x: 12, y: 1},

    {x: 0, y: 2},
    {x: 4, y: 2},
    {x: 8, y: 2},
    {x: 12, y: 2},

    {x: 0, y: 3},
    {x: 3, y: 3},
    {x: 6, y: 3},
    {x: 9, y: 3},
    {x: 12, y: 3},

    {x: 0, y: 4},
    {x: 5, y: 4},
    {x: 10, y: 4},

    {x: 0, y: 5},

    {x: 0, y: 6},
    {x: 1, y: 6},
    {x: 2, y: 6},
    {x: 4, y: 6},
    {x: 5, y: 6},
    {x: 6, y: 6},
    {x: 8, y: 6},
    {x: 9, y: 6},
    {x: 10, y: 6},

    {x: 0, y: 7},
    {x: 5, y: 7},
    {x: 10, y: 7},

    {x: 0, y: 8},

    {x: 0, y: 9},
    {x: 1, y: 9},
    {x: 4, y: 9},
    {x: 5, y: 9},
    {x: 8, y: 9},
    {x: 9, y: 9},

    {x: 0, y: 10},
    {x: 5, y: 10},
];

walls = [
    {x: 1, y: 11},
    {x: 2, y: 11},
    {x: 5, y: 11},
    {x: 8, y: 11},
    {x: 11, y: 11},
    {x: 12, y: 11},
];

function playStepSound() {
    var audio = new Audio('attributes/mariojump.mp3');
    // set the volume
    audio.volume = 0.05;
    // audio.play();
}

function initEnemies() {
    // init frog
    inputFrog[0].translation = vec3.fromValues(0.7, 0, 0);

    // first row
    inputFrog[1].translation = vec3.fromValues(0.0, 0, 0);
    inputFrog[2].translation = vec3.fromValues(0.4, 0, 0);
    inputFrog[3].translation = vec3.fromValues(0.8, 0, 0);
    inputFrog[4].translation = vec3.fromValues(1.2, 0, 0);

    inputFrog[5].translation = vec3.fromValues(0.0, 0, 0);
    inputFrog[6].translation = vec3.fromValues(0.4, 0, 0);
    inputFrog[7].translation = vec3.fromValues(0.8, 0, 0);
    inputFrog[8].translation = vec3.fromValues(1.2, 0, 0);

    inputFrog[9].translation = vec3.fromValues(0.0, 0, 0);
    inputFrog[10].translation = vec3.fromValues(0.3, 0, 0);
    inputFrog[11].translation = vec3.fromValues(0.6, 0, 0);
    inputFrog[12].translation = vec3.fromValues(0.9, 0, 0);
    inputFrog[13].translation = vec3.fromValues(1.2, 0, 0);

    inputFrog[14].translation = vec3.fromValues(0.0, 0, 0);
    inputFrog[15].translation = vec3.fromValues(0.5, 0, 0);
    inputFrog[16].translation = vec3.fromValues(1.0, 0, 0);

    inputFrog[17].translation = vec3.fromValues(0.0, 0, 0);

    inputFrog[18].translation = vec3.fromValues(0.0, 0, 0);
    inputFrog[19].translation = vec3.fromValues(0.1, 0, 0);
    inputFrog[20].translation = vec3.fromValues(0.2, 0, 0);
    inputFrog[21].translation = vec3.fromValues(0.4, 0, 0);
    inputFrog[22].translation = vec3.fromValues(0.5, 0, 0);
    inputFrog[23].translation = vec3.fromValues(0.6, 0, 0);
    inputFrog[24].translation = vec3.fromValues(0.8, 0, 0);
    inputFrog[25].translation = vec3.fromValues(0.9, 0, 0);
    inputFrog[26].translation = vec3.fromValues(1.0, 0, 0);

    inputFrog[27].translation = vec3.fromValues(0.0, 0, 0);
    inputFrog[28].translation = vec3.fromValues(0.5, 0, 0);
    inputFrog[29].translation = vec3.fromValues(1.0, 0, 0);

    inputFrog[30].translation = vec3.fromValues(0.0, 0, 0);

    inputFrog[31].translation = vec3.fromValues(0.0, 0, 0);
    inputFrog[32].translation = vec3.fromValues(0.1, 0, 0);
    inputFrog[33].translation = vec3.fromValues(0.4, 0, 0);
    inputFrog[34].translation = vec3.fromValues(0.5, 0, 0);
    inputFrog[35].translation = vec3.fromValues(0.8, 0, 0);
    inputFrog[36].translation = vec3.fromValues(0.9, 0, 0);

    inputFrog[37].translation = vec3.fromValues(0.0, 0, 0);
    inputFrog[38].translation = vec3.fromValues(0.8, 0, 0);
}

function checkHitEnemy() {
    // based on the player's position, check if they hit an enemy
    var playerX = playerPosition.x;
    var playerY = playerPosition.y;

    for (var i = 1; i < 39; i++) {
        var enemyX = enemiesPositions[i].x;
        var enemyY = enemiesPositions[i].y;

        if (Math.abs(enemyX - playerX) < 0.1 && Math.abs(playerY - enemyY) < 0.01) {
            console.log(playerX, playerY, enemyX, enemyY);
            return true;
        }
    }
    return false;
}

function gameLoop(time) {
    // Call the game loop again on the next frame at a rate of 60 frames per second
    requestAnimationFrame(gameLoop);
    const elapsed = time - lastTime;
    if (elapsed > fpsInterval) {
        lastTime = time - (elapsed % fpsInterval);

        // row 1
        vec3.add(inputFrog[1].translation, inputFrog[1].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[2].translation, inputFrog[2].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[3].translation, inputFrog[3].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[4].translation, inputFrog[4].translation, vec3.fromValues(speed0, 0, 0));

        // row 2
        vec3.add(inputFrog[5].translation, inputFrog[5].translation, vec3.fromValues(-speed1, 0, 0));
        vec3.add(inputFrog[6].translation, inputFrog[6].translation, vec3.fromValues(-speed1, 0, 0));
        vec3.add(inputFrog[7].translation, inputFrog[7].translation, vec3.fromValues(-speed1, 0, 0));
        vec3.add(inputFrog[8].translation, inputFrog[8].translation, vec3.fromValues(-speed1, 0, 0));

        // row 3
        vec3.add(inputFrog[9].translation, inputFrog[9].translation, vec3.fromValues(speed2, 0, 0));
        vec3.add(inputFrog[10].translation, inputFrog[10].translation, vec3.fromValues(speed2, 0, 0));
        vec3.add(inputFrog[11].translation, inputFrog[11].translation, vec3.fromValues(speed2, 0, 0));
        vec3.add(inputFrog[12].translation, inputFrog[12].translation, vec3.fromValues(speed2, 0, 0));
        vec3.add(inputFrog[13].translation, inputFrog[13].translation, vec3.fromValues(speed2, 0, 0));

        // row 5
        vec3.add(inputFrog[14].translation, inputFrog[14].translation, vec3.fromValues(-speed3, 0, 0));
        vec3.add(inputFrog[15].translation, inputFrog[15].translation, vec3.fromValues(-speed3, 0, 0));
        vec3.add(inputFrog[16].translation, inputFrog[16].translation, vec3.fromValues(-speed3, 0, 0));

        // snake
        vec3.add(inputFrog[17].translation, inputFrog[17].translation, vec3.fromValues(speed4, 0, 0));

        // turtles
        vec3.add(inputFrog[18].translation, inputFrog[18].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[19].translation, inputFrog[19].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[20].translation, inputFrog[20].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[21].translation, inputFrog[21].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[22].translation, inputFrog[22].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[23].translation, inputFrog[23].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[24].translation, inputFrog[24].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[25].translation, inputFrog[25].translation, vec3.fromValues(speed0, 0, 0));
        vec3.add(inputFrog[26].translation, inputFrog[26].translation, vec3.fromValues(speed0, 0, 0));


        // logs
        vec3.add(inputFrog[27].translation, inputFrog[27].translation, vec3.fromValues(-speed0, 0, 0));
        vec3.add(inputFrog[28].translation, inputFrog[28].translation, vec3.fromValues(-speed0, 0, 0));
        vec3.add(inputFrog[29].translation, inputFrog[29].translation, vec3.fromValues(-speed0, 0, 0));

        // big log
        vec3.add(inputFrog[30].translation, inputFrog[30].translation, vec3.fromValues(-speed3, 0, 0));

        // turtles 2
        vec3.add(inputFrog[31].translation, inputFrog[31].translation, vec3.fromValues(speed1, 0, 0));
        vec3.add(inputFrog[32].translation, inputFrog[32].translation, vec3.fromValues(speed1, 0, 0));
        vec3.add(inputFrog[33].translation, inputFrog[33].translation, vec3.fromValues(speed1, 0, 0));
        vec3.add(inputFrog[34].translation, inputFrog[34].translation, vec3.fromValues(speed1, 0, 0));
        vec3.add(inputFrog[35].translation, inputFrog[35].translation, vec3.fromValues(speed1, 0, 0));
        vec3.add(inputFrog[36].translation, inputFrog[36].translation, vec3.fromValues(speed1, 0, 0));

        // big logs 2
        vec3.add(inputFrog[37].translation, inputFrog[37].translation, vec3.fromValues(-speed2, 0, 0));
        vec3.add(inputFrog[38].translation, inputFrog[38].translation, vec3.fromValues(-speed2, 0, 0));

        enemiesPositions[1].x += speed0 * 10;
        enemiesPositions[2].x += speed0 * 10;
        enemiesPositions[3].x += speed0 * 10;
        enemiesPositions[4].x += speed0 * 10;

        enemiesPositions[5].x -= speed1 * 10;
        enemiesPositions[6].x -= speed1 * 10;
        enemiesPositions[7].x -= speed1 * 10;
        enemiesPositions[8].x -= speed1 * 10;

        enemiesPositions[9].x += speed2 * 10;
        enemiesPositions[10].x += speed2 * 10;
        enemiesPositions[11].x += speed2 * 10;
        enemiesPositions[12].x += speed2 * 10;
        enemiesPositions[13].x += speed2 * 10;

        enemiesPositions[14].x -= speed3 * 10;
        enemiesPositions[15].x -= speed3 * 10;
        enemiesPositions[16].x -= speed3 * 10;

        enemiesPositions[17].x += speed4 * 10;

        enemiesPositions[18].x += speed0 * 10;
        enemiesPositions[19].x += speed0 * 10;
        enemiesPositions[20].x += speed0 * 10;
        enemiesPositions[21].x += speed0 * 10;
        enemiesPositions[22].x += speed0 * 10;
        enemiesPositions[23].x += speed0 * 10;
        enemiesPositions[24].x += speed0 * 10;
        enemiesPositions[25].x += speed0 * 10;
        enemiesPositions[26].x += speed0 * 10;

        enemiesPositions[27].x -= speed0 * 10;
        enemiesPositions[28].x -= speed0 * 10;
        enemiesPositions[29].x -= speed0 * 10;

        enemiesPositions[30].x -= speed3 * 10;

        enemiesPositions[31].x += speed1 * 10;
        enemiesPositions[32].x += speed1 * 10;
        enemiesPositions[33].x += speed1 * 10;
        enemiesPositions[34].x += speed1 * 10;
        enemiesPositions[35].x += speed1 * 10;
        enemiesPositions[36].x += speed1 * 10;

        enemiesPositions[37].x -= speed2 * 10;
        enemiesPositions[38].x -= speed2 * 10;


        if (inputFrog[1].translation[0] > 1.3) {
            inputFrog[1].translation[0] = -0.2;
            enemiesPositions[1].x = -2;
        }
        if (inputFrog[2].translation[0] > 1.3) {
            inputFrog[2].translation[0] = -0.2;
            enemiesPositions[2].x = -2;
        }
        if (inputFrog[3].translation[0] > 1.3) {
            inputFrog[3].translation[0] = -0.2;
            enemiesPositions[3].x = -2;
        }
        if (inputFrog[4].translation[0] > 1.3) {
            inputFrog[4].translation[0] = -0.2;
            enemiesPositions[4].x = -2;
        }

        if (inputFrog[5].translation[0] < -0.2) {
            inputFrog[5].translation[0] = 1.3;
            enemiesPositions[5].x = 13;
        }
        if (inputFrog[6].translation[0] < -0.2) {
            inputFrog[6].translation[0] = 1.3;
            enemiesPositions[6].x = 13;
        }
        if (inputFrog[7].translation[0] < -0.2) {
            inputFrog[7].translation[0] = 1.3;
            enemiesPositions[7].x = 13;
        }
        if (inputFrog[8].translation[0] < -0.2) {
            inputFrog[8].translation[0] = 1.3;
            enemiesPositions[8].x = 13;
        }

        if (inputFrog[9].translation[0] > 1.3) {
            inputFrog[9].translation[0] = -0.2;
            enemiesPositions[9].x = -2;
        }
        if (inputFrog[10].translation[0] > 1.3) {
            inputFrog[10].translation[0] = -0.2;
            enemiesPositions[10].x = -2;
        }
        if (inputFrog[11].translation[0] > 1.3) {
            inputFrog[11].translation[0] = -0.2;
            enemiesPositions[11].x = -2;
        }
        if (inputFrog[12].translation[0] > 1.3) {
            inputFrog[12].translation[0] = -0.2;
            enemiesPositions[12].x = -2;
        }
        if (inputFrog[13].translation[0] > 1.3) {
            inputFrog[13].translation[0] = -0.2;
            enemiesPositions[13].x = -2;
        }

        if (inputFrog[14].translation[0] < -0.2) {
            inputFrog[14].translation[0] = 1.3;
            enemiesPositions[14].x = 13;
        }
        if (inputFrog[15].translation[0] < -0.2) {
            inputFrog[15].translation[0] = 1.3;
            enemiesPositions[15].x = 13;
        }
        if (inputFrog[16].translation[0] < -0.2) {
            inputFrog[16].translation[0] = 1.3;
            enemiesPositions[16].x = 13;
        }

        if (inputFrog[17].translation[0] > 1.3) {
            inputFrog[17].translation[0] = -0.2;
            enemiesPositions[17].x = -2;
        }

        if (inputFrog[18].translation[0] > 1.3) {
            inputFrog[18].translation[0] = -0.2;
            enemiesPositions[18].x = -2;
        }
        if (inputFrog[19].translation[0] > 1.3) {
            inputFrog[19].translation[0] = -0.2;
            enemiesPositions[19].x = -2;
        }
        if (inputFrog[20].translation[0] > 1.3) {
            inputFrog[20].translation[0] = -0.2;
            enemiesPositions[20].x = -2;
        }
        if (inputFrog[21].translation[0] > 1.3) {
            inputFrog[21].translation[0] = -0.2;
            enemiesPositions[21].x = -2;
        }
        if (inputFrog[22].translation[0] > 1.3) {
            inputFrog[22].translation[0] = -0.2;
            enemiesPositions[22].x = -2;
        }
        if (inputFrog[23].translation[0] > 1.3) {
            inputFrog[23].translation[0] = -0.2;
            enemiesPositions[23].x = -2;
        }
        if (inputFrog[24].translation[0] > 1.3) {
            inputFrog[24].translation[0] = -0.2;
            enemiesPositions[24].x = -2;
        }
        if (inputFrog[25].translation[0] > 1.3) {
            inputFrog[25].translation[0] = -0.2;
            enemiesPositions[25].x = -2;
        }
        if (inputFrog[26].translation[0] > 1.3) {
            inputFrog[26].translation[0] = -0.2;
            enemiesPositions[26].x = -2;
        }

        if (inputFrog[27].translation[0] < -0.2) {
            inputFrog[27].translation[0] = 1.3;
            enemiesPositions[27].x = 13;
        }
        if (inputFrog[28].translation[0] < -0.2) {
            inputFrog[28].translation[0] = 1.3;
            enemiesPositions[28].x = 13;
        }
        if (inputFrog[29].translation[0] < -0.2) {
            inputFrog[29].translation[0] = 1.3;
            enemiesPositions[29].x = 13;
        }

        if (inputFrog[30].translation[0] < -0.2) {
            inputFrog[30].translation[0] = 1.3;
            enemiesPositions[30].x = 13;
        }

        if (inputFrog[31].translation[0] > 1.3) {
            inputFrog[31].translation[0] = -0.2;
            enemiesPositions[31].x = -2;
        }
        if (inputFrog[32].translation[0] > 1.3) {
            inputFrog[32].translation[0] = -0.2;
            enemiesPositions[32].x = -2;
        }
        if (inputFrog[33].translation[0] > 1.3) {
            inputFrog[33].translation[0] = -0.2;
            enemiesPositions[33].x = -2;
        }
        if (inputFrog[34].translation[0] > 1.3) {
            inputFrog[34].translation[0] = -0.2;
            enemiesPositions[34].x = -2;
        }
        if (inputFrog[35].translation[0] > 1.3) {
            inputFrog[35].translation[0] = -0.2;
            enemiesPositions[35].x = -2;
        }
        if (inputFrog[36].translation[0] > 1.3) {
            inputFrog[36].translation[0] = -0.2;
            enemiesPositions[36].x = -2;
        }

        if (inputFrog[37].translation[0] < -0.2) {
            inputFrog[37].translation[0] = 1.3;
            enemiesPositions[37].x = 13;
        }
        if (inputFrog[38].translation[0] < -0.2) {
            inputFrog[38].translation[0] = 1.3;
            enemiesPositions[38].x = 13;
        }


        if (checkHitEnemy()) {
            playerPosition.x = 6;
            playerPosition.y = 0;
            inputFrog[0].translation = vec3.fromValues(0.7, 0, 0);
        }
    }
}

function nextPosHitWall(x, y) {
    for (var i = 0; i < walls.length; i++) {
        if (walls[i].x == x && walls[i].y == y) {
            return true;
        }
    }
    return false;
}


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

        if (((image.width & (image.width - 1)) === 0) && ((image.width & (image.width - 1)) === 0)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    image.src = url;

    return texture;
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
            handleKeyDown.modelOn = inputFrog[whichModel];
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
        // update the frog's position
        if (playerPosition.x < 13 && !nextPosHitWall(playerPosition.x + 1, playerPosition.y)) {
            playerPosition.x += 1;
            vec3.add(inputFrog[0].translation, inputFrog[0].translation, vec3.fromValues(-STEP_SCALE, 0, 0));
        }
        // console.log(playerPosition.x, playerPosition.y)
        playStepSound();
        break;
    case 'ArrowLeft': // select previous triangle set

        if (playerPosition.x > 0 && !nextPosHitWall(playerPosition.x - 1, playerPosition.y)) {
            playerPosition.x -= 1;
            vec3.add(inputFrog[0].translation, inputFrog[0].translation, vec3.fromValues(STEP_SCALE, 0, 0));
        }
        // console.log(playerPosition.x, playerPosition.y)
        playStepSound();
        break;
    case 'ArrowUp': // select next ellipsoid

        if (playerPosition.y < 11 && !nextPosHitWall(playerPosition.x, playerPosition.y + 1)) {
            playerPosition.y += 1;
            vec3.add(inputFrog[0].translation, inputFrog[0].translation, vec3.fromValues(0, STEP_SCALE, 0));
        }
        // console.log(playerPosition.x, playerPosition.y)
        playStepSound();
        break;
    case 'ArrowDown': // select previous ellipsoid

        if (playerPosition.y > 0 && !nextPosHitWall(playerPosition.x, playerPosition.y - 1)) {
            playerPosition.y -= 1;
            vec3.add(inputFrog[0].translation, inputFrog[0].translation, vec3.fromValues(0, -STEP_SCALE, 0));
        }
        playStepSound();
        // console.log(playerPosition.x, playerPosition.y)
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
    }
}

// set up the webGL environment
function setupWebGL() {
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed

    // Get the canvas and context
    const canvas = document.getElementById('myWebGLCanvas'); // create a js canvas
    gl = canvas.getContext('webgl'); // get a webgl object from it

    try {
        if (gl == null) {
            throw 'unable to create gl context -- is your browser gl ready?';
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
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

    inputFrog = getJSONFile(INPUT_FROG_URL, 'frog'); // read in the triangle data

    let whichSetVert; // index of vertex in current triangle set
    let whichSetTri; // index of triangle in current triangle set
    let vtxToAdd; // vtx coords to add to the coord array
    let normToAdd; // vtx normal to add to the coord array
    let triToAdd; // tri indices to add to the index array
    const maxCorner = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); // bbox corner
    const minCorner = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); // other corner

    // process each triangle set to load webgl vertex and triangle buffers
    numTriangleSets = inputFrog.length; // remember how many tri sets
    for (let whichSet = 0; whichSet < numTriangleSets; whichSet++) { // for each tri set
        // set up hilighting, modeling translation and rotation
        inputFrog[whichSet].center = vec3.fromValues(0, 0, 0); // center point of tri set
        inputFrog[whichSet].on = false; // not highlighted
        inputFrog[whichSet].translation = vec3.fromValues(0, 0, 0); // no translation
        inputFrog[whichSet].xAxis = vec3.fromValues(1, 0, 0); // model X axis
        inputFrog[whichSet].yAxis = vec3.fromValues(0, 1, 0); // model Y axis

        textures[whichSet] = loadTexture(gl, 'attributes/' + inputFrog[whichSet].material.texture);

        // set up the vertex and normal arrays, define model center and axes
        inputFrog[whichSet].glVertices = []; // flat coord list for webgl
        inputFrog[whichSet].glNormals = []; // flat normal list for webgl
        inputFrog[whichSet].glUVs = [];
        const numVerts = inputFrog[whichSet].vertices.length; // num vertices in tri set
        for (whichSetVert = 0; whichSetVert < numVerts; whichSetVert++) { // verts in set
            vtxToAdd = inputFrog[whichSet].vertices[whichSetVert]; // get vertex to add
            normToAdd = inputFrog[whichSet].normals[whichSetVert]; // get normal to add
            uvsToAdd = inputFrog[whichSet].uvs[whichSetVert];
            inputFrog[whichSet].glVertices.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]); // put coords in set coord list
            inputFrog[whichSet].glNormals.push(normToAdd[0], normToAdd[1], normToAdd[2]); // put normal in set coord list
            inputFrog[whichSet].glUVs.push(uvsToAdd[0], uvsToAdd[1]);
            vec3.max(maxCorner, maxCorner, vtxToAdd); // update world bounding box corner maxima
            vec3.min(minCorner, minCorner, vtxToAdd); // update world bounding box corner minima
            vec3.add(inputFrog[whichSet].center, inputFrog[whichSet].center, vtxToAdd); // add to ctr sum
        } // end for vertices in set
        vec3.scale(inputFrog[whichSet].center, inputFrog[whichSet].center, 1 / numVerts); // avg ctr sum

        // send the vertex coords and normals to webGL
        vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSet]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputFrog[whichSet].glVertices), gl.STATIC_DRAW); // data in
        normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputFrog[whichSet].glNormals), gl.STATIC_DRAW); // data in

        UVBuffer[whichSet] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, UVBuffer[whichSet]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputFrog[whichSet].glUVs), gl.STATIC_DRAW);

        // set up the triangle index array, adjusting indices across sets
        inputFrog[whichSet].glTriangles = []; // flat index list for webgl
        triSetSizes[whichSet] = inputFrog[whichSet].triangles.length; // number of tris in this set
        for (whichSetTri = 0; whichSetTri < triSetSizes[whichSet]; whichSetTri++) {
            triToAdd = inputFrog[whichSet].triangles[whichSetTri]; // get tri to add
            inputFrog[whichSet].glTriangles.push(triToAdd[0], triToAdd[1], triToAdd[2]); // put indices in set list
        } // end for triangles in set

        // send the triangle indices to webGL
        triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inputFrog[whichSet].glTriangles), gl.STATIC_DRAW); // data in
    } // end for each triangle set
}

// setup the webGL shaders
function setupShaders() {
    // define vertex shader in essl using es6 template strings
    const vShaderCode = loadShaderFile('./vshader.glsl');
    const fShaderCode = loadShaderFile('./fshader.glsl');

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
        currSet = inputFrog[whichTriSet];
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
        currSet = inputFrog[whichTriSet];
        if (currSet.material.alpha < 1.0) {
            transparencyOrder.push(whichTriSet);
        }
    }

    function paintersAlg(a, b) {
        makeModelTransform(inputFrog[a]);
        let v0 = vec3.create();
        let v1 = vec3.create();
        mat4.getTranslation(v0, mMatrix);
        vec3.add(v1, v0, inputFrog[a].center);
        const dist = vec3.distance(v1, Eye);

        makeModelTransform(inputFrog[b]);
        v0 = vec3.create();
        v1 = vec3.create();
        mat4.getTranslation(v0, mMatrix);
        vec3.add(v1, v0, inputFrog[b].center);
        return vec3.distance(v1, Eye) - dist;
    }

    transparencyOrder.sort(paintersAlg);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    for (var whichTriSet = 0; whichTriSet < transparencyOrder.length; whichTriSet++) {
        currSet = inputFrog[transparencyOrder[whichTriSet]];
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
    // Start the game loop
    initEnemies();
    gameLoop();
} // end main
