// Nicholas Delli Carpini

// ----- GLOBALS -----

let canvasRect;

// --- GL Vars ---
let gl;
let glProgram;
let projectionMLoc;
let viewMLoc;
let lightingFlagLoc;
let renderingFlagLoc;
let wireframeFlagLoc;

let lightingCoordLoc;
let ambientVLoc;
let diffuseVLoc;
let specularVLoc;
let shininessLoc;

let projectionM;
let viewM;
let lightingCoord;

let pyramidBuffer;
let normalBuffer;
let lineBuffer;

// values taken from example
let ambientV      = vec4(0.2, 0.2, 0.2, 1.0);
let diffuseV      = vec4(1.0, 1.0, 1.0, 1.0);
let specularV     = vec4(0.8, 0.8, 0.8, 1.0);

let lightingFlag = 0;

// --- Pyramid ---
let pyramidArr = [];
let normalArr = [];

let wireframe = false;
let pyramidSubdivisions = 4;
let numPyramid = 0;

let currTranslation;
let lastTranslation;

// values taken from example
let pyramidA = vec4(      0.0,       0.0,     -1.0, 1);
let pyramidB = vec4(      0.0,  0.942809, 0.333333, 1);
let pyramidC = vec4(-0.816497, -0.471405, 0.333333, 1);
let pyramidD = vec4( 0.816497, -0.471405, 0.333333, 1);

// values taken from example
let pyramidAmbient   = vec4(1.0, 0.0, 1.0, 1.0);
let pyramidDiffuse   = vec4(1.0, 0.8, 0.0, 1.0);
let pyramidSpecular  = vec4(0.5, 0.5, 0.5, 1.0);
let pyramidShininess = 5.0;

// --- Line ---
let lineArr = [];

let lineSubdivisions = 0;
let numLine = 0;

// values taken from project description
let lineA = vec4(-8.0,  8.0, 0.0, 1);
let lineB = vec4( 2.0,  4.0, 0.0, 1);
let lineC = vec4( 6.0,  6.0, 0.0, 1);
let lineD = vec4(  10, -8.0, 0.0, 1);
let lineE = vec4( 2.0, -2.0, 0.0, 1);
let lineF = vec4(-6.0, -2.0, 0.0, 1);

// --- Animation ---
let animate = false;
let animateSubdivisions = 150;
let pyramidPos = 0;
let animatePosArr = [];

// ----- FUNCTIONS -----

// TAKEN FROM EXAMPLE - makes a new triangle for both points and normals array
// a, b, c - face coordinates for triangle
//
// returns null
function newTriangle(a, b, c) {
    pyramidArr.push(a);
    pyramidArr.push(b);
    pyramidArr.push(c);
    
    normalArr.push(a[0],a[1], a[2], 0.0);
    normalArr.push(b[0],b[1], b[2], 0.0);
    normalArr.push(c[0],c[1], c[2], 0.0);
    
    numPyramid += 3;
}

// TAKEN FROM EXAMPLE - create pyramid from 3D triangle coordinates
// a, b, c - face coordinates for triangle
// count - divide the faces to create a more spherical object from triangles
//
// returns null
function divideTriangle(a, b, c, count) {
    if (count > 0) {
        let ab = mix(a, b, 0.5);
        let ac = mix(a, c, 0.5);
        let bc = mix(b, c, 0.5);

        ab = normalize(ab, true);
        ac = normalize(ac, true);
        bc = normalize(bc, true);

        divideTriangle(a, ab, ac, count - 1);
        divideTriangle(ab, b, bc, count - 1);
        divideTriangle(bc, c, ac, count - 1);
        divideTriangle(ab, bc, ac, count - 1);
    }
    else {
        newTriangle(a, b, c);
    }
}

// builds the pyramid based on pyramidSubdivisions to increase spherical-ness
// and translates the pyramid to its proper position
//
// returns null
function shape3D() {
    pyramidArr = [];
    normalArr = [];

    // 4 divideTriangle() calls taken from example
    divideTriangle(pyramidA, pyramidB, pyramidC, pyramidSubdivisions);
    divideTriangle(pyramidD, pyramidC, pyramidB, pyramidSubdivisions);
    divideTriangle(pyramidA, pyramidD, pyramidB, pyramidSubdivisions);
    divideTriangle(pyramidA, pyramidC, pyramidD, pyramidSubdivisions);
    
    // reset normalBuffer on reshape
    normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalArr), gl.STATIC_DRAW);

    let normalCoord = gl.getAttribLocation(glProgram, "normalCoord");
    gl.vertexAttribPointer(normalCoord, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(normalCoord);

    // reset translations
    lastTranslation = undefined;
    currTranslation = undefined;

    translatePyramid();
}

// performs chaikin subdivisions on arr for 2D objects
// arr - arr to perform subdivions on
// subdivisions - number of times to perform chaikin subdivions
//
// returns new arr with subdivisions
function chaikin2D(arr, subdivisions) {
    let retArr = [];

    if (subdivisions === 0) {
        retArr = arr;
        retArr.push(arr[0]);

        return retArr;
    }

    const arrLength = arr.length;
    let x1, y1, x2, y2;
    for (let i = 0; i < arrLength; i++) {
        x1 = (0.75 * arr[i][0]) + (0.25 * arr[(i + 1) % arrLength][0]);
        y1 = (0.75 * arr[i][1]) + (0.25 * arr[(i + 1) % arrLength][1]);
        x2 = (0.25 * arr[i][0]) + (0.75 * arr[(i + 1) % arrLength][0]);
        y2 = (0.25 * arr[i][1]) + (0.75 * arr[(i + 1) % arrLength][1]);

        retArr.push(vec4(x1, y1, arr[i][2], arr[i][3]));
        retArr.push(vec4(x2, y2, arr[i][2], arr[i][3]));
    }

    return chaikin2D(retArr, (subdivisions - 1));
}

// creates chaikin line and then updates animatePosArr to reflect new curve
//
// returns null
function shape2D() {
    lineArr = [lineA, lineB, lineC, lineD, lineE, lineF];

    lineArr = chaikin2D(lineArr, lineSubdivisions);

    numLine = lineArr.length;

    calculateAnimDivisions();
}

// calculates an array of positions for the pyramid to travel along the chaikin line
// based on the number of subdivisions defined by animateSubdivisions
//
// returns null
function calculateAnimDivisions() {
    animatePosArr = [];

    // if chaikin line has equal points to animateSubdivisions
    //   -> use lineArr as animatePosArr
    if (lineArr.length === animateSubdivisions) {
        animatePosArr = lineArr;
    }

    // if chaikin line has more points than animateSubdivisions
    //   -> push lineArr[x] to animatePosArr where x is based on dirtyIter
    else if (lineArr.length > animateSubdivisions) {
        let dirtyIter = (lineArr.length - 1) / animateSubdivisions;
        let iterator = 0;
        for (let i = 0; i < animateSubdivisions; i++) {
            let temp = Math.round(iterator);

            if (temp < lineArr.length) {
                animatePosArr.push(lineArr[temp]);
            }
            else {
                animatePosArr.push(lineArr[lineArr.length - 1]);
            }

            iterator += dirtyIter;
        }
    }

    // if chaikin line has less points than animateSubdivisions
    //   -> push (x,y) to animatePosArr based on number of subdivisions per lineArr obj
    else if (lineArr.length < animateSubdivisions) {
        let dirtyIter = (lineArr.length - 1) / animateSubdivisions;
        let iterator = 0;

        let x, y;
        let floor, roof, percentage;
        for (let i = 0; i < animateSubdivisions; i++) {
            roof = Math.ceil(iterator);
            floor = Math.floor(iterator);
            percentage = iterator - floor;

            if (roof < lineArr.length) {
                x = (lineArr[roof][0] * percentage) + (lineArr[floor][0] * (1 - percentage));
                y = (lineArr[roof][1] * percentage) + (lineArr[floor][1] * (1 - percentage));

                animatePosArr.push(vec4(x, y, lineArr[roof][2], lineArr[roof][3]));
            }
            else {
                animatePosArr.push(lineArr[lineArr.length - 1]);
            }

            iterator += dirtyIter;
        }
    }
}

// increment the position of the pyramid along the animatePosArr, and then translate the
// pyramid to the new positions.
//
// returns null
function incrementAnimPos() {
    pyramidPos++;

    // loop the animation
    if (pyramidPos >= animateSubdivisions) {
        pyramidPos = 0;
    }

    translatePyramid();
}

// translates the pyramid along the animatePosArr to appear as smooth motion along
// the chaikin line
//
// returns null
function translatePyramid() {
    lastTranslation = currTranslation;
    currTranslation = animatePosArr[pyramidPos];

    // translates the pyramid back to origin
    if (lastTranslation !== undefined) {
        for (let i = 0; i < pyramidArr.length; i++) {
            pyramidArr[i] = mult(translate(-lastTranslation[0], -lastTranslation[1], 0), pyramidArr[i]);
        }
    }

    // translates the pyramid to new position
    for (let i = 0; i < pyramidArr.length; i++) {
        pyramidArr[i] = mult(translate(currTranslation[0], currTranslation[1], 0), pyramidArr[i]);
    }
}

// ----- RENDER FUNCTIONS -----

// sets up gl variables and does the initial render of webgl
//
// returns null
function initRender() {
    projectionMLoc = gl.getUniformLocation(glProgram, "projectionM");
    viewMLoc = gl.getUniformLocation(glProgram, "viewM");

    lightingFlagLoc = gl.getUniformLocation(glProgram, "lightingFlag");
    renderingFlagLoc = gl.getUniformLocation(glProgram, "renderingFlag");
    wireframeFlagLoc = gl.getUniformLocation(glProgram, "wireframeFlag");

    lightingCoordLoc = gl.getUniformLocation(glProgram, "lightingCoord");
    diffuseVLoc = gl.getUniformLocation(glProgram, "diffuseV");
    specularVLoc = gl.getUniformLocation(glProgram, "specularV");
    ambientVLoc = gl.getUniformLocation(glProgram, "ambientV");
    shininessLoc = gl.getUniformLocation(glProgram, "shininess");

    initEnvironment();

    shape2D();
    initGLBuffer(0, lineBuffer, lineArr);
    gl.drawArrays(gl.LINE_STRIP, 0, numLine);

    shape3D();
    initGLBuffer(1, pyramidBuffer, pyramidArr);
    if (wireframe) {
        for (let i = 0; i < numPyramid; i += 3) {
            gl.drawArrays(gl.LINE_STRIP, i, 3);
        }
    }
    else {
        for (let i = 0; i < numPyramid; i += 3) {
            gl.drawArrays(gl.TRIANGLES, i, 3);
        }
    }
}

// sets up the perspective projection and lighting for the scene
//
// returns null
function initEnvironment() {
    let aspectRatio = canvasRect.width / canvasRect.height;
    let fov = 30;
    let cameraZ;

    if (aspectRatio > 1) {
        cameraZ = 1 / (Math.tan(((fov / 2) * Math.PI / 180)) / 12);
    } else {
        cameraZ = 1 / (Math.tan(((fov / 2) * Math.PI / 180)) / 12) / aspectRatio;
    }

    let eye = vec3(0, 0, cameraZ);
    let at  = vec3(0, 0, -1);
    let up  = vec3(0, 1, 0);

    viewM = lookAt(eye, at, up);
    projectionM = perspective(fov, aspectRatio, 0.1, 100);
    lightingCoord = vec4(0.0, 0.0, -cameraZ * 0.8, 0.0);

    gl.uniformMatrix4fv(viewMLoc, false, flatten(viewM));
    gl.uniformMatrix4fv(projectionMLoc, false, flatten(projectionM));

    gl.uniform4fv(lightingCoordLoc, flatten(lightingCoord));
    gl.uniform4fv(diffuseVLoc, flatten(mult(diffuseV, pyramidDiffuse)));
    gl.uniform4fv(specularVLoc, flatten(mult(specularV, pyramidSpecular)));
    gl.uniform4fv(ambientVLoc, flatten(mult(ambientV, pyramidAmbient)));
    gl.uniform1f(shininessLoc, pyramidShininess);
}

// sets up the webgl buffers and appropriate values to send to shaders
// renderingFlag - flag for shaders to render either line (0) or pyramid (1)
// pointArr - array of points to be rendered in webgl
//
// returns null
function initGLBuffer(renderingFlag, pointBuffer, pointArr) {
    gl.uniform1i(lightingFlagLoc, lightingFlag);
    gl.uniform1i(renderingFlagLoc, renderingFlag);
    gl.uniform1i(wireframeFlagLoc, (wireframe ? 1 : 0));

    pointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointArr), gl.STATIC_DRAW);

    let pointCoord = gl.getAttribLocation(glProgram, "pointCoord");
    gl.vertexAttribPointer(pointCoord, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(pointCoord);
}

// renders the scene based on globals
//
// returns null
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    initGLBuffer(0, lineBuffer, lineArr);
    gl.drawArrays(gl.LINE_STRIP, 0, numLine);

    if (animate) incrementAnimPos();

    initGLBuffer(1, pyramidBuffer, pyramidArr);
    if (wireframe) {
        for (let i = 0; i < numPyramid; i += 3) {
            gl.drawArrays(gl.LINE_STRIP, i, 3);
        }
    }
    else {
        gl.drawArrays(gl.TRIANGLES, 0, numPyramid);

    }

    // animate the scene
    if (animate) requestAnimationFrame(render);
}

// ----- MAIN -----
function main() {
    let canvas = document.getElementById("webgl");

    // set canvas size onload
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    const topbarRect = document.getElementById("topbar").getBoundingClientRect();
    const topbarH = topbarRect.height + topbarRect.y + 12;

    canvas.height = windowH - topbarH - topbarRect.y;
    canvas.width = windowW - (topbarRect.x * 2);

    canvasRect = canvas.getBoundingClientRect();

    // webgl setup
    gl = WebGLUtils.setupWebGL(canvas, undefined);
    if (!gl) {
        console.log("Error: could not setup rendering context for WebGL");
        return;
    }

    gl.viewport(0,0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    glProgram = initShaders(gl, "vshader", "fshader");
    gl.useProgram(glProgram);

    initRender();

    // interaction handlers
    document.addEventListener("keydown", (e) => {
        switch (e.key) {

            // wireframe vs lighting mode (true=wireframe | false=lighting)
            case "m":
                wireframe = !wireframe;
                shape3D();
                if (!animate) {
                    render();
                }
                break;

            // decreases subdivisions of pyramid
            case "q":
                if (pyramidSubdivisions > 1) {
                    pyramidSubdivisions--;
                    shape3D();
                    if (!animate) {
                        render();
                    }
                }
                break;

            // increases subdivisions of pyramid
            case "e":
                if (pyramidSubdivisions < 8) {
                    pyramidSubdivisions++;
                    shape3D();
                    if (!animate) {
                        render();
                    }
                }
                break;

            // decreases subdivisions of chaikin line
            case "i":
                if (lineSubdivisions > 0) {
                    lineSubdivisions--;
                    shape2D();
                    if (!animate) {
                        translatePyramid();
                        render();
                    }
                }
                break;

            // increases subdivisions of chaikin line
            case "j":
                if (lineSubdivisions < 8) {
                    lineSubdivisions++;
                    shape2D();
                    if (!animate) {
                        translatePyramid();
                        render();
                    }
                }
                break;

            // turn on/off animation
            case "a":
                animate = !animate;
                render();
                break;

            // change lighting mode of scene (0=Gouraud | 1=Phong)
            case "l":
                if (lightingFlag === 1) {
                    lightingFlag = 0;
                }
                else {
                    lightingFlag = 1;
                }

                if (!animate) {
                    render();
                }
                break;
        }
    });
}