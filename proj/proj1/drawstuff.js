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

function ellipsoidIntersection(p, eye, ellipsoid) {
    // get the discriminants of the ellipsoid and ray
    // Solve this equation:

    // t = (1/2a) (-b ± (b^2 - 4ac)^0.5)
    // with
    // a = D/A•D/A
    // b = 2 D/A•(E-C)/A
    // c = (E-C)/A•(E-C)/A - 1
    var C = new Vector(ellipsoid.x, ellipsoid.y, ellipsoid.z);
    var A = new Vector(ellipsoid.a, ellipsoid.b, ellipsoid.c);

    var d = Vector.sub(p, eye);
    var d_div_a = Vector.div(d, A);
    var c_sub_c = Vector.sub(eye, C);
    var c_sub_c_div_a = Vector.div(c_sub_c, A);

    var a = Vector.dot(d_div_a, d_div_a);
    var b = 2 * Vector.dot(d_div_a, Vector.div(c_sub_c, A));
    var c = Vector.dot(c_sub_c_div_a, c_sub_c_div_a) - 1;

    var discriminant = (b * b) - (4 * a * c);

    if (discriminant >= 0) {
        var t0 = (-b + Math.sqrt(discriminant)) / (2 * a);
        var t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
        var smallest_t = Math.min(t0, t1);
        var intersection_vector = Vector.add(eye, Vector.scaled(d, smallest_t));
        return {"intersection": intersection_vector, "t": smallest_t}
    } else {
        return {"intersection": NaN, "t": NaN};
    }
}

function ellipsoidColor(ellipsoid, intersection, lights, eye) {
    // Iterate over each light
    var color = new Vector(0, 0, 0);

    for (let i = 0; i < lights.length; i++) {
        var light = lights[i];
        // var light_location = new Vector(light.x, light.y, light.z);
        var light_location = new Vector(-0.5, 1.5, -0.5);
        var e_ambient = new Vector(ellipsoid.ambient[0], ellipsoid.ambient[1], ellipsoid.ambient[2]);
        var l_ambient = new Vector(light.ambient[0], light.ambient[1], light.ambient[2]);
        var e_diffuse = new Vector(ellipsoid.diffuse[0], ellipsoid.diffuse[1], ellipsoid.diffuse[2]);
        var l_diffuse = new Vector(light.diffuse[0], light.diffuse[1], light.diffuse[2]);
        var e_specular = new Vector(ellipsoid.specular[0], ellipsoid.specular[1], ellipsoid.specular[2]);
        var l_specular = new Vector(light.specular[0], light.specular[1], light.specular[2]);

        // Variables for the Phong model
        var I = intersection;
        var C = new Vector(ellipsoid.x, ellipsoid.y, ellipsoid.z);
        var A = new Vector(ellipsoid.a, ellipsoid.b, ellipsoid.c);
        var L = Vector.norm(Vector.sub(light_location, I));

        // Get the normal vector, N, at the intersection point
        // 2(I_x - Cx) / a^2, 2(I_y - Cy) / b^2, 2(I_z - Cz) / c^2
        var N = Vector.norm(Vector.div(Vector.scaled(Vector.sub(I, C), 2), Vector.square(A)));
        var V = Vector.norm(Vector.sub(eye, I));
        var H = Vector.norm(Vector.add(L, V));

        // ambient + diffuse + specular = color
        // Recall that the dot products could be negative

        // Ambient
        color = Vector.add(color, Vector.mul(e_ambient, l_ambient));

        // Diffuse
        var diffuse_scale = Math.max(0, Vector.dot(N, L));
        color = Vector.add(color, Vector.scaled(Vector.mul(e_diffuse, l_diffuse), diffuse_scale));

        // Specular
        var specular_scale = Math.pow(Math.max(0, Vector.dot(N, H)), ellipsoid.n);
        color = Vector.add(color, Vector.scaled(Vector.mul(e_specular, l_specular), specular_scale));

        // Clamp to 1
        var ones = new Vector(1, 1, 1);
        var clamp = Vector.scaled(ones, 255);
        color = Vector.mul(Vector.min(color, ones), clamp);
    }

    return new Color(color.x, color.y, color.z, 255);
}

function triangleColor(triangle, intersection, lights, eye) {
    // Iterate over each light
    var color = new Vector(0, 0, 0);

    for (let i = 0; i < lights.length; i++) {
        var light = lights[i];
        // var light_location = new Vector(light.x, light.y, light.z);
        var light_location = new Vector(-0.5, 1.5, -0.5);

        var e_ambient = new Vector(triangle.material.ambient[0], triangle.material.ambient[1], triangle.material.ambient[2]);
        var l_ambient = new Vector(light.ambient[0], light.ambient[1], light.ambient[2]);
        var e_diffuse = new Vector(triangle.material.diffuse[0], triangle.material.diffuse[1], triangle.material.diffuse[2]);
        var l_diffuse = new Vector(light.diffuse[0], light.diffuse[1], light.diffuse[2]);
        var e_specular = new Vector(triangle.material.specular[0], triangle.material.specular[1], triangle.material.specular[2]);
        var l_specular = new Vector(light.specular[0], light.specular[1], light.specular[2]);

        // Variables for the Phong model
        var I = intersection;
        var A = new Vector(triangle.vertices[0][0], triangle.vertices[0][1], triangle.vertices[0][2]);
        var B = new Vector(triangle.vertices[1][0], triangle.vertices[1][1], triangle.vertices[1][2]);
        var C = new Vector(triangle.vertices[2][0], triangle.vertices[2][1], triangle.vertices[2][2]);
        var L = Vector.norm(Vector.sub(light_location, I));

        // Get the normal vector, N, at the intersection point
        // N = BA×CA
        var BA = Vector.sub(B, A);
        var CA = Vector.sub(C, A);
        var N = Vector.cross(BA, CA);
        N = Vector.norm(N);
        var V = Vector.norm(Vector.sub(eye, I));
        var H = Vector.norm(Vector.add(L, V));

        // ambient + diffuse + specular = color
        // Recall that the dot products could be negative

        // Ambient
        color = Vector.add(color, Vector.mul(e_ambient, l_ambient));

        // Diffuse
        var diffuse_scale = Math.max(0, Vector.dot(N, L));
        color = Vector.add(color, Vector.scaled(Vector.mul(e_diffuse, l_diffuse), diffuse_scale));

        // Specular
        var specular_scale = Math.pow(Math.max(0, Vector.dot(N, H)), triangle.material.n);
        color = Vector.add(color, Vector.scaled(Vector.mul(e_specular, l_specular), specular_scale));

        // Clamp to 1
        var ones = new Vector(1, 1, 1);
        var clamp = Vector.scaled(ones, 255);
        color = Vector.mul(Vector.min(color, ones), clamp);

        return new Color(color.x, color.y, color.z, 255);
    }
}

function triangleInteserction(p, eye, triangle) {
    // ray equation is p = eye + t * d
    var D = Vector.sub(p, eye);

    // N = BA×CA
    var A = new Vector(triangle.vertices[0][0], triangle.vertices[0][1], triangle.vertices[0][2]);
    var B = new Vector(triangle.vertices[1][0], triangle.vertices[1][1], triangle.vertices[1][2]);
    var C = new Vector(triangle.vertices[2][0], triangle.vertices[2][1], triangle.vertices[2][2]);

    // Triangle normal
    // N = BA×CA
    var BA = Vector.sub(B, A);
    var CA = Vector.sub(C, A);
    var N = Vector.cross(BA, CA);

    //triangle plane constant, d = N•A
    var d = Vector.dot(N, A);

    // Get the intersection point
    // t = (d - N•E) / N•D
    var ND = Vector.dot(N, D);

    if (ND == 0) {
        return {"intersection": NaN, "t": NaN};
    } else {
        var t = (d - Vector.dot(N, eye)) / ND;
        var intersection = Vector.add(eye, Vector.scaled(D, t));

        // determine if point lies in triangle sides
        var AB = Vector.sub(B, A);
        var BC = Vector.sub(C, B);
        var CA = Vector.sub(A, C);

        var AP = Vector.sub(intersection, A);
        var BP = Vector.sub(intersection, B);
        var CP = Vector.sub(intersection, C);

        var AB_AP = Vector.cross(AB, AP);
        var BC_BP = Vector.cross(BC, BP);
        var CA_CP = Vector.cross(CA, CP);

        if (Vector.dot(N, AB_AP) < 0 || Vector.dot(N, BC_BP) < 0 || Vector.dot(N, CA_CP) < 0) {
            return {"intersection": NaN, "t": NaN};

        } else {
            return {"intersection": intersection, "t": t};
        }
    }
}
function drawRayCastTriangles(context, eye) {
    var inputTriangles = getInput(INPUT_TRIANGLES_URL);
    var inputLights = getInput(INPUT_LIGHTS_URL);
    var w = context.canvas.width;
    var h = context.canvas.height;
    var imagedata = context.createImageData(w, h);

    if (inputTriangles != String.null) {
        var n = inputTriangles.length; // the number of input triangles

        let s = 0;
        let t = 1;

        // Loop over each screen pixel in a 2d for loop col-major order
        for (let j = 0; j < h; j++) {
            s = 0;
            for (let i = 0; i < w; i++) {
                var closest = Number.MAX_VALUE;
                var color = new Color(0, 0, 0, 255); // black color
                // Find the ray from the eye through the pixel
                var p = new Vector(s, t, 0.0);

                // for each object in the scene
                for (let e = 0; e < n; e++) {
                    var intersection = triangleInteserction(p, eye, inputTriangles[e]);

                    if (intersection.intersection) {
                        // if the ray intersects the object, and is closest yet
                        if (intersection.t < closest) {
                            closest = intersection.t;
                            color = triangleColor(inputTriangles[e], intersection.intersection, inputLights, eye);
                        }
                    }
                    drawPixel(imagedata, i, j, color);
                }
                s += 1 / w;
            }
            t -= 1 / h;
        }
    }
    context.putImageData(imagedata, 0, 0);
}

function drawRayCastEllipsoid(context, eye) {
    var inputEllipsoids = getInput(INPUT_ELLIPSOIDS_URL);
    var inputLights = getInput(INPUT_LIGHTS_URL);
    var w = context.canvas.width;
    var h = context.canvas.height;
    var imagedata = context.createImageData(w, h);

    if (inputEllipsoids != String.null) {
        var n = inputEllipsoids.length; // the number of input ellipsoids

        let s = 0;
        let t = 1;

        // Loop over each screen pixel in a 2d for loop col-major order
        for (let j = 0; j < h; j++) {
            s = 0;
            for (let i = 0; i < w; i++) {
                var closest = Number.MAX_VALUE;
                var color = new Color(0, 0, 0, 255); // black color
                // Find the ray from the eye through the pixel
                var p = new Vector(s, t, 0.0);

                // for each object in the scene
                for (let e = 0; e < n; e++) {
                    var intersection = ellipsoidIntersection(p, eye, inputEllipsoids[e]);

                    if (intersection.intersection.x != NaN) {
                        // if the ray intersects the object, and is closest yet
                        if (intersection.t < closest) {
                            closest = intersection.t;
                            color = ellipsoidColor(inputEllipsoids[e], intersection.intersection, inputLights, eye);
                        }
                    }
                    drawPixel(imagedata, i, j, color);
                }
                s += 1 / w;
            }
            t -= 1 / h;
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

    // after pressing spacebar the cursor will change
    document.addEventListener('keydown', function (event) {
        if (event.keyCode === 32) {
            // clear the canvas
            context.clearRect(0, 0, canvas.width, canvas.height);

            // set and scale the current location of mouse
            drawRayCastTriangles(context, eye);
        }
    }   , false);
}
