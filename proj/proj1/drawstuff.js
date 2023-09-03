/* Constants */
const PIXEL_DENSITY = 0.01;
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog1/ellipsoids.json";
const INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog1/lights.json";
const INPUT_BOXES_URL = "https://ncsucgclass.github.io/prog1/boxes.json";
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog1/triangles.json";

/* classes */

// Color constructor
class Color {
    constructor(r, g, b, a) {
        try {
            if ((typeof (r) !== "number") || (typeof (g) !== "number") || (typeof (b) !== "number") || (typeof (a) !== "number"))
                throw "color component not a number";
            else if ((r < 0) || (g < 0) || (b < 0) || (a < 0))
                throw "color component less than 0";
            else if ((r > 255) || (g > 255) || (b > 255) || (a > 255))
                throw "color component bigger than 255";
            else {
                this.r = r;
                this.g = g;
                this.b = b;
                this.a = a;
            }
        } // end try

        catch (e) {
            console.log(e);
        }
    } // end Color constructor

    // Color change method
    change(r, g, b, a) {
        try {
            if ((typeof (r) !== "number") || (typeof (g) !== "number") || (typeof (b) !== "number") || (typeof (a) !== "number"))
                throw "color component not a number";
            else if ((r < 0) || (g < 0) || (b < 0) || (a < 0))
                throw "color component less than 0";
            else if ((r > 255) || (g > 255) || (b > 255) || (a > 255))
                throw "color component bigger than 255";
            else {
                this.r = r;
                this.g = g;
                this.b = b;
                this.a = a;
            }
        } // end throw

        catch (e) {
            console.log(e);
        }
    } // end Color change method
} // end color class

class Vector {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static add(v1, v2) {
        if (v1 instanceof Vector && v2 instanceof Vector) {
            return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z);
        } else if (v1 instanceof Vector && typeof (v2) === "number") {
            // broadcast scalar to vector
            return new Vector(v1.x + v2, v1.y + v2, v1.z + v2);
        } else if (typeof (v1) === "number" && v2 instanceof Vector) {
            return new Vector(v1 + v2.x, v1 + v2.y, v1 + v2.z);
        }
    }

    static sub(v1, v2) {
        if (v1 instanceof Vector && v2 instanceof Vector) {
            return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
        } else if (v1 instanceof Vector && typeof (v2) === "number") {
            // broadcast scalar to vector
            return new Vector(v1.x - v2, v1.y - v2, v1.z - v2);
        } else if (typeof (v1) === "number" && v2 instanceof Vector) {
            return new Vector(v1 - v2.x, v1 - v2.y, v1 - v2.z);
        }
    }

    static div(v1, v2) {
        if (v1 instanceof Vector && v2 instanceof Vector) {
            return new Vector(v1.x / v2.x, v1.y / v2.y, v1.z / v2.z);
        } else if (v1 instanceof Vector && typeof (v2) === "number") {
            // broadcast scalar to vector
            return new Vector(v1.x / v2, v1.y / v2, v1.z / v2);
        } else if (typeof (v1) === "number" && v2 instanceof Vector) {
            return new Vector(v1 / v2.x, v1 / v2.y, v1 / v2.z);
        }
    }

    static mul(v1, v2) {
        if (v1 instanceof Vector && v2 instanceof Vector) {
            return new Vector(v1.x * v2.x, v1.y * v2.y, v1.z * v2.z);
        } else if (v1 instanceof Vector && typeof (v2) === "number") {
            // broadcast scalar to vector
            return new Vector(v1.x * v2, v1.y * v2, v1.z * v2);
        } else if (typeof (v1) === "number" && v2 instanceof Vector) {
            return new Vector(v1 * v2.x, v1 * v2.y, v1 * v2.z);
        }
    }

    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    }

    static scaled(v1, s) {
        return new Vector(v1.x * s, v1.y * s, v1.z * s);
    }

    static norm(v1) {
        return Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    }
}

/* utility functions */

// draw a pixel at x,y using color
function drawPixel(imagedata, x, y, color) {
    try {
        if ((typeof (x) !== "number") || (typeof (y) !== "number"))
            throw "drawpixel location not a number";
        else if ((x < 0) || (y < 0) || (x >= imagedata.width) || (y >= imagedata.height))
            throw "drawpixel location outside of image";
        else if (color instanceof Color) {
            var pixelindex = (y * imagedata.width + x) * 4;
            imagedata.data[pixelindex] = color.r;
            imagedata.data[pixelindex + 1] = color.g;
            imagedata.data[pixelindex + 2] = color.b;
            imagedata.data[pixelindex + 3] = color.a;
        } else
            throw "drawpixel color is not a Color";
    } // end try

    catch (e) {
        console.log(e);
    }
} // end drawPixel

function getInput(url) {
    // load the ellipsoids file
    var httpReq = new XMLHttpRequest(); // a new http request
    httpReq.open("GET", url, false); // init the request
    httpReq.send(null); // send the request
    var startTime = Date.now();
    while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
        if ((Date.now() - startTime) > 3000)
            break;
    } // until its loaded or we time out after three seconds
    if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE)) {
        console.log * ("Unable to open input ellipses file!");
        return String.null;
    } else
        return JSON.parse(httpReq.response);
}

function findRay(e, p, t) {
    // E + t(P-E)
    var ray = Vector.add(e, Vector.scaled(Vector.sub(p, e), t));
    return ray;
}


function drawRayCastEllipsoid(context, eye) {
    const UL = new Vector(0, 1, 0.0);
    const UR = new Vector(1, 1, 0.0);
    const LL = new Vector(0, 0, 0.0);
    const LR = new Vector(1, 0, 0.0);

    var inputEllipsoids = getInput(INPUT_ELLIPSOIDS_URL);
    var inputLights = getInput(INPUT_LIGHTS_URL);
    var w = context.canvas.width;
    var h = context.canvas.height;
    var imagedata = context.createImageData(w, h);
    var numCanvasPixels = (w * h) * PIXEL_DENSITY;

    if (inputEllipsoids != String.null) {
        var x = 0;
        var y = 0; // pixel coord init
        var ellipsoidXRadius = 0; // init ellipsoid x radius
        var ellipsoidYRadius = 0; // init ellipsoid y radius
        var numEllipsoidPixels = 0; // init num pixels in ellipsoid

        var n = inputEllipsoids.length; // the number of input ellipsoids
        var rayDirection = new Vector(0, 0, 0);

        // Here is the pseduocode
        /*
        For each screen pixel
            Find the ray from the eye through the pixel
            for ech object in the scene
                if the ray intersects the object, and is closest yet
                    record intersection and object
            Find color for closest intersection
         */

        // Loop over each screen pixel in a 2d for loop row-major order
        for (var i = 0; i < h; i++) {
            for (var j = 0; j < w; j++) {
                var color = new Color(0, 0, 0, 255); // black color
                var s = i / h;
                var t = j / w;
                var p = new Vector(s, t, 0.0);

                // Find the ray from the eye through the pixel
                var ray = findRay(eye, p, t);

                // for each object in the scene
                for (var e = 0; e < n; e++) {
                    // get the discriminants of the ellipsoid and ray
                    // Solve this equation:

                    // t = (1/2a) (-b ± (b^2 - 4ac)^0.5)
                    // with
                    // a = D/A•D/A
                    // b = 2 D/A•(E-C)/A
                    // c = (E-C)/A•(E-C)/A - 1

                    var C = new Vector(inputEllipsoids[e].x, inputEllipsoids[e].y, inputEllipsoids[e].z);
                    var A = new Vector(inputEllipsoids[e].a, inputEllipsoids[e].b, inputEllipsoids[e].c);

                    var d = Vector.sub(p, eye);
                    var d_div_a = Vector.div(d, A);
                    var c_sub_c = Vector.sub(eye, C);
                    var c_sub_c_div_a = Vector.div(c_sub_c, A);
                    var a = Vector.dot(d_div_a, d_div_a);

                    var b = 2 * Vector.dot(d_div_a, Vector.div(c_sub_c, A));

                    var c = Vector.dot(c_sub_c_div_a, c_sub_c_div_a) - 1;

                    var discriminant = (b * b) - (4 * a * c);
                    if (discriminant < 0) {
                        drawPixel(imagedata, i, j, color);
                    } else {
                        var t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
                        var t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
                        var t = Math.min(t1, t2);
                        color.change(
                            inputEllipsoids[e].diffuse[0] * 255,
                            inputEllipsoids[e].diffuse[1] * 255,
                            inputEllipsoids[e].diffuse[2] * 255,
                            255);
                        drawPixel(imagedata, i, j, color);
                    }
                }
            }
        }
    }
    context.putImageData(imagedata, 0, 0);
} // end draw rand pixels in input ellipsoids

function main() {
    // Get the canvas and context
    var canvas = document.getElementById("viewport");
    var context = canvas.getContext("2d");

    var eye = new Vector(0.5, 0.5, -0.5);
    drawRayCastEllipsoid(context, eye);
}
