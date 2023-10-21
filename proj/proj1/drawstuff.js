/* eslint-disable require-jsdoc, no-throw-literal, max-len, no-unused-vars */

/* Constants */
const INPUT_ELLIPSOIDS_URL = 'https://ncsucgclass.github.io/prog1/ellipsoids.json';
const INPUT_LIGHTS_URL = 'attributes/lights.json';
const INPUT_TRIANGLES_URL = 'attributes/triangles2.json';


let lightX = Math.random() * 4 - 2;
let lightY = Math.random() * 4 - 2;
let lightZ = Math.random() * 4 - 2;

/* classes */

// Color constructor
class Color {
    constructor(r, g, b, a) {
        try {
            if ((typeof (r) !== 'number') || (typeof (g) !== 'number') || (typeof (b) !== 'number') || (typeof (a) !== 'number')) {
                throw 'color component not a number';
            } else if ((r < 0) || (g < 0) || (b < 0) || (a < 0)) {
                throw 'color component less than 0';
            } else if ((r > 255) || (g > 255) || (b > 255) || (a > 255)) {
                throw 'color component bigger than 255';
            } else {
                this.r = r;
                this.g = g;
                this.b = b;
                this.a = a;
            }
        } catch (e) {
            console.log(e);
        }
    }

    // Color change method
    change(r, g, b, a) {
        try {
            if ((typeof (r) !== 'number') || (typeof (g) !== 'number') || (typeof (b) !== 'number') || (typeof (a) !== 'number')) {
                throw 'color component not a number';
            } else if ((r < 0) || (g < 0) || (b < 0) || (a < 0)) {
                throw 'color component less than 0';
            } else if ((r > 255) || (g > 255) || (b > 255) || (a > 255)) {
                throw 'color component bigger than 255';
            } else {
                this.r = r;
                this.g = g;
                this.b = b;
                this.a = a;
            }
        } catch (e) {
            console.log(e);
        }
    }
}

class Vector {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static add(v1, v2) {
        return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z);
    }

    static sub(v1, v2) {
        return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
    }

    static div(v1, v2) {
        return new Vector(v1.x / v2.x, v1.y / v2.y, v1.z / v2.z);
    }

    static mul(v1, v2) {
        return new Vector(v1.x * v2.x, v1.y * v2.y, v1.z * v2.z);
    }

    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    }

    static scaled(v1, s) {
        return new Vector(v1.x * s, v1.y * s, v1.z * s);
    }

    static norm(v1) {
        return (Vector.scaled(v1, 1 / Math.sqrt(Vector.dot(v1, v1))));
    }

    static square(v1) {
        return new Vector(v1.x * v1.x, v1.y * v1.y, v1.z * v1.z);
    }

    static min(v1, v2) {
        return new Vector(Math.min(v1.x, v2.x), Math.min(v1.y, v2.y), Math.min(v1.z, v2.z));
    }

    static cross(v1, v2) {
        return new Vector(v1.y * v2.z - v2.y * v1.z,
            v1.z * v2.x - v2.z * v1.x,
            v1.x * v2.y - v2.x * v1.y);
    }
}

/* utility functions */

// draw a pixel at x,y using color
function drawPixel(imagedata, x, y, color) {
    try {
        if ((typeof (x) !== 'number') || (typeof (y) !== 'number')) {
            throw 'drawpixel location not a number';
        } else if ((x < 0) || (y < 0) || (x >= imagedata.width) || (y >= imagedata.height)) {
            throw 'drawpixel location outside of image';
        } else if (color instanceof Color) {
            const pixelindex = (y * imagedata.width + x) * 4;
            imagedata.data[pixelindex] = color.r;
            imagedata.data[pixelindex + 1] = color.g;
            imagedata.data[pixelindex + 2] = color.b;
            imagedata.data[pixelindex + 3] = color.a;
        } else {
            throw 'drawpixel color is not a Color';
        }
    } catch (e) {
        console.log(e);
    }
} // end drawPixel

function getInput(url) {
    // load the ellipsoids file
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
        console.log * ('Unable to open input ellipses file!');
        return String.null;
    } else {
        return JSON.parse(httpReq.response);
    }
}

function ellipsoidIntersection(p, eye, ellipsoid) {
    // get the discriminants of the ellipsoid and ray
    // Solve this equation:

    // t = (1/2a) (-b ± (b^2 - 4ac)^0.5)
    // with
    // a = D/A•D/A
    // b = 2 D/A•(E-C)/A
    // c = (E-C)/A•(E-C)/A - 1
    const C = new Vector(ellipsoid.x, ellipsoid.y, ellipsoid.z);
    const A = new Vector(ellipsoid.a, ellipsoid.b, ellipsoid.c);

    const d = Vector.sub(p, eye);
    const DDivA = Vector.div(d, A);
    const CSubC = Vector.sub(eye, C);
    const CSubCDivA = Vector.div(CSubC, A);

    const a = Vector.dot(DDivA, DDivA);
    const b = 2 * Vector.dot(DDivA, Vector.div(CSubC, A));
    const c = Vector.dot(CSubCDivA, CSubCDivA) - 1;

    const discriminant = (b * b) - (4 * a * c);

    if (discriminant >= 0) {
        const t0 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
        const smallestT = Math.min(t0, t1);
        const intersectionVector = Vector.add(eye, Vector.scaled(d, smallestT));
        return {'intersection': intersectionVector, 't': smallestT};
    } else {
        return {'intersection': NaN, 't': NaN};
    }
}


function blinnPhongColor(N, L, H, eAmbient, lAmbient, eDiffuse, lDiffuse, eSpecular, lSpecular, n, color) {
    // ambient + diffuse + specular = color
    // Recall that the dot products could be negative

    // Ambient
    const ambient = Vector.mul(eAmbient, lAmbient);

    // Diffuse
    const diffuseScale = Math.max(0, Vector.dot(N, L));
    const diffuse = Vector.scaled(Vector.mul(eDiffuse, lDiffuse), diffuseScale);

    // Specular
    const specularScale = Math.pow(Math.max(0, Vector.dot(N, H)), n);
    const specular = Vector.scaled(Vector.mul(eSpecular, lSpecular), specularScale);

    const shadeScale = 1;


    color = Vector.add(color, Vector.add(ambient, Vector.scaled(Vector.add(diffuse, specular), shadeScale)));
    // Clamp to 1
    const ones = new Vector(1, 1, 1);
    const clamp = Vector.scaled(ones, 255);
    color = Vector.mul(Vector.min(color, ones), clamp);
    return color;
}

function ellipsoidColor(ellipsoid, intersection, lights, eye) {
    // Iterate over each light
    let color = new Vector(0, 0, 0);

    for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        const lightLocation = new Vector(-0.5, 1.5, -0.5);
        const eAmbient = new Vector(ellipsoid.ambient[0], ellipsoid.ambient[1], ellipsoid.ambient[2]);
        const lAmbient = new Vector(light.ambient[0], light.ambient[1], light.ambient[2]);
        const eDiffuse = new Vector(ellipsoid.diffuse[0], ellipsoid.diffuse[1], ellipsoid.diffuse[2]);
        const lDiffuse = new Vector(light.diffuse[0], light.diffuse[1], light.diffuse[2]);
        const eSpecular = new Vector(ellipsoid.specular[0], ellipsoid.specular[1], ellipsoid.specular[2]);
        const lSpecular = new Vector(light.specular[0], light.specular[1], light.specular[2]);

        // Variables for the Phong model
        const I = intersection;
        const C = new Vector(ellipsoid.x, ellipsoid.y, ellipsoid.z);
        const A = new Vector(ellipsoid.a, ellipsoid.b, ellipsoid.c);
        const L = Vector.norm(Vector.sub(lightLocation, I));

        // Get the normal vector, N, at the intersection point
        // 2(I_x - Cx) / a^2, 2(I_y - Cy) / b^2, 2(I_z - Cz) / c^2
        const N = Vector.norm(Vector.div(Vector.scaled(Vector.sub(I, C), 2), Vector.square(A)));
        const V = Vector.norm(Vector.sub(eye, I));
        const H = Vector.norm(Vector.add(L, V));


        color = blinnPhongColor(N, L, H, eAmbient, lAmbient, eDiffuse, lDiffuse, eSpecular, lSpecular, ellipsoid.n, color);
    }

    return new Color(color.x, color.y, color.z, 255);
}

function triangleColor(triangle, intersection, lights, eye) {
    // Iterate over each light
    let color = new Vector(0, 0, 0);

    for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        // random light between -2 and 2
        const lightLocation = new Vector(lightX, lightY, lightZ);

        const eAmbient = new Vector(triangle.material.ambient[0], triangle.material.ambient[1], triangle.material.ambient[2]);
        const lAmbient = new Vector(light.ambient[0], light.ambient[1], light.ambient[2]);
        const eDiffuse = new Vector(triangle.material.diffuse[0], triangle.material.diffuse[1], triangle.material.diffuse[2]);
        const lDiffuse = new Vector(light.diffuse[0], light.diffuse[1], light.diffuse[2]);
        const eSpecular = new Vector(triangle.material.specular[0], triangle.material.specular[1], triangle.material.specular[2]);
        const lSpecular = new Vector(light.specular[0], light.specular[1], light.specular[2]);

        // Variables for the Phong model
        const I = intersection;
        const A = new Vector(triangle.vertices[0][0], triangle.vertices[0][1], triangle.vertices[0][2]);
        const B = new Vector(triangle.vertices[1][0], triangle.vertices[1][1], triangle.vertices[1][2]);
        const C = new Vector(triangle.vertices[2][0], triangle.vertices[2][1], triangle.vertices[2][2]);
        const L = Vector.norm(Vector.sub(lightLocation, I));

        // Get the normal vector, N, at the intersection point
        // N = BA×CA
        const BA = Vector.sub(B, A);
        const CA = Vector.sub(C, A);
        let N = Vector.cross(BA, CA);
        N = Vector.norm(N);
        const V = Vector.norm(Vector.sub(eye, I));
        const H = Vector.norm(Vector.add(L, V));

        color = blinnPhongColor(N, L, H, eAmbient, lAmbient, eDiffuse, lDiffuse, eSpecular, lSpecular, triangle.material.n, color);
    }
    return new Color(color.x, color.y, color.z, 255);
}

function triangleInteserction(p, eye, triangle) {
    // ray equation is p = eye + t * d
    const D = Vector.sub(p, eye);

    // N = BA×CA
    const A = new Vector(triangle.vertices[0][0], triangle.vertices[0][1], triangle.vertices[0][2]);
    const B = new Vector(triangle.vertices[1][0], triangle.vertices[1][1], triangle.vertices[1][2]);
    const C = new Vector(triangle.vertices[2][0], triangle.vertices[2][1], triangle.vertices[2][2]);

    // Triangle normal
    // N = BA×CA
    const BA = Vector.sub(B, A);
    const CA = Vector.sub(C, A);
    const N = Vector.cross(BA, CA);

    // triangle plane constant, d = N•A
    const d = Vector.dot(N, A);

    // Get the intersection point
    // t = (d - N•E) / N•D
    const ND = Vector.dot(N, D);

    if (ND == 0) {
        return {'intersection': NaN, 't': NaN};
    } else {
        const t = (d - Vector.dot(N, eye)) / ND;
        const intersection = Vector.add(eye, Vector.scaled(D, t));

        // determine if point lies in triangle sides
        const AB = Vector.sub(B, A);
        const BC = Vector.sub(C, B);
        const CA = Vector.sub(A, C);

        const AP = Vector.sub(intersection, A);
        const BP = Vector.sub(intersection, B);
        const CP = Vector.sub(intersection, C);

        const AB_AP = Vector.cross(AB, AP);
        const BC_BP = Vector.cross(BC, BP);
        const CA_CP = Vector.cross(CA, CP);

        if (Vector.dot(N, AB_AP) < 0 || Vector.dot(N, BC_BP) < 0 || Vector.dot(N, CA_CP) < 0) {
            return {'intersection': NaN, 't': NaN};
        } else {
            return {'intersection': intersection, 't': t};
        }
    }
}

function drawRayCastTriangles(context, eye) {
    const inputTriangles = getInput(INPUT_TRIANGLES_URL);
    const inputLights = getInput(INPUT_LIGHTS_URL);
    const w = context.canvas.width;
    const h = context.canvas.height;
    const imagedata = context.createImageData(w, h);

    if (inputTriangles != String.null) {
        const n = inputTriangles.length; // the number of input triangles

        let s = 0;
        let t = 1;

        // Loop over each screen pixel in a 2d for loop col-major order
        for (let j = 0; j < h; j++) {
            s = 0;
            for (let i = 0; i < w; i++) {
                let closest = Number.MAX_VALUE;
                let color = new Color(0, 0, 0, 255); // black color
                // Find the ray from the eye through the pixel
                const p = new Vector(s, t, 0.0);
                let triangle;
                let intersectionVector = null;

                // for each object in the scene
                for (let e = 0; e < n; e++) {
                    const intersection = triangleInteserction(p, eye, inputTriangles[e]);

                    if (intersection.intersection) {
                        // if the ray intersects the object, and is closest yet
                        if (intersection.t < closest) {
                            closest = intersection.t;
                            intersectionVector = intersection.intersection;
                            triangle = inputTriangles[e];
                        }
                    }
                }
                if (intersectionVector) {
                    color = triangleColor(triangle, intersectionVector, inputLights, eye);
                }
                drawPixel(imagedata, i, j, color);
                s += 1 / w;
            }
            t -= 1 / h;
        }
    }
    context.putImageData(imagedata, 0, 0);
}

function drawRayCastEllipsoid(context, eye) {
    const inputEllipsoids = getInput(INPUT_ELLIPSOIDS_URL);
    const inputLights = getInput(INPUT_LIGHTS_URL);
    const w = context.canvas.width;
    const h = context.canvas.height;
    const imagedata = context.createImageData(w, h);

    if (inputEllipsoids != String.null) {
        const n = inputEllipsoids.length; // the number of input ellipsoids

        let s = 0;
        let t = 1;

        // Loop over each screen pixel in a 2d for loop col-major order
        for (let j = 0; j < h; j++) {
            s = 0;

            for (let i = 0; i < w; i++) {
                let ellipsoid;
                let intersectionVector = null;
                let closest = Number.MAX_VALUE;
                let color = new Color(0, 0, 0, 255); // black color
                // Find the ray from the eye through the pixel
                const p = new Vector(s, t, 0.0);

                // for each object in the scene
                for (let e = 0; e < n; e++) {
                    const intersection = ellipsoidIntersection(p, eye, inputEllipsoids[e]);

                    if (intersection.intersection.x != NaN) {
                        // if the ray intersects the object, and is closest yet
                        if (intersection.t < closest) {
                            closest = intersection.t;
                            intersectionVector = intersection.intersection;
                            ellipsoid = inputEllipsoids[e];
                        }
                    }
                }
                if (intersectionVector) {
                    color = ellipsoidColor(ellipsoid, intersectionVector, inputLights, eye);
                }
                drawPixel(imagedata, i, j, color);
                s += 1 / w;
            }
            t -= 1 / h;
        }
    }
    context.putImageData(imagedata, 0, 0);
} // end draw rand pixels in input ellipsoids

function main() {
    // Get the canvas and context
    const canvas = document.getElementById('viewport');
    const context = canvas.getContext('2d');

    const eye = new Vector(0.5, 0.5, -0.5);

    drawRayCastEllipsoid(context, eye);

    // after pressing spacebar the cursor will change
    document.addEventListener('keydown', function(event) {
        if (event.keyCode === 32) {
            // clear the canvas
            context.clearRect(0, 0, canvas.width, canvas.height);
            lightX = Math.random() * 4 - 2;
            lightY = Math.random() * 4 - 2;
            lightZ = Math.random() * 4 - 2;

            // set and scale the current location of mouse
            drawRayCastTriangles(context, eye);
        }
    }, false);
}
