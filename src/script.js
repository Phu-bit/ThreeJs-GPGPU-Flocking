import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import birdFS from './shaders/bird/birdFS.glsl';
import birdVS from './shaders/bird/birdVS.glsl';
import fragmentShaderVelocity from './shaders/bird/fragmentShaderVelocity.glsl';
import fragmentShaderPosition from './shaders/bird/fragmentShaderPosition.glsl';

/* TEXTURE WIDTH FOR SIMULATION */
const WIDTH = 16;

const BIRDS = WIDTH * WIDTH;

// Custom Geometry - using 3 triangles each. No UVs, no normals currently.
class BirdGeometry extends THREE.BufferGeometry {

    constructor() {
 
        super();

        const trianglesPerBird = 3;
        const triangles = BIRDS * trianglesPerBird;
        const points = triangles * 3;

        const vertices = new THREE.BufferAttribute( new Float32Array( points * 3 ), 3 );
        const birdColors = new THREE.BufferAttribute( new Float32Array( points * 3 ), 3 );
        const references = new THREE.BufferAttribute( new Float32Array( points * 2 ), 2 );
        const birdVertex = new THREE.BufferAttribute( new Float32Array( points ), 1 );

        this.setAttribute( 'position', vertices );
        this.setAttribute( 'birdColor', birdColors );
        this.setAttribute( 'reference', references );
        this.setAttribute( 'birdVertex', birdVertex );

        // this.setAttribute( 'normal', new Float32Array( points * 3 ), 3 );


        let v = 0;

        function verts_push() {

            for ( let i = 0; i < arguments.length; i ++ ) {

                vertices.array[ v ++ ] = arguments[ i ];

            }

        }

        const wingsSpan = 100;

        for ( let f = 0; f < BIRDS; f ++ ) {


            // front body
            verts_push(
                0, 0, - 50,
                0, 30, 0,
                0, -30,0,
                
            );
            
            // back body
            verts_push(
                0,  0,  50,
                0, -30,  0,
                0, 30, 0,
            );


            verts_push(
                0,  0,  50,
                30, 0,  -50,
                -30, 0, -50
            );




            // Body


            // Wings



        }

        for ( let v = 0; v < triangles * 3; v ++ ) {

            const triangleIndex = ~ ~ ( v / 3 );
            const birdIndex = ~ ~ ( triangleIndex / trianglesPerBird );
            const x = ( birdIndex % WIDTH ) / WIDTH;
            const y = ~ ~ ( birdIndex / WIDTH ) / WIDTH;

            const c = new THREE.Color(
                0x666666 +
                ~ ~ ( v / 9 ) / BIRDS * 0x666666
            );

            birdColors.array[ v * 3 + 0 ] = c.r;
            birdColors.array[ v * 3 + 1 ] = c.g;
            birdColors.array[ v * 3 + 2 ] = c.b;

            references.array[ v * 2 ] = x;
            references.array[ v * 2 + 1 ] = y;

            birdVertex.array[ v ] = v % 9;

        }

        this.scale( 0.2, 0.2, 0.2 );

    }

}

//

let container, stats;
let camera, scene, renderer;
let mouseX = 0, mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const BOUNDS = 800, BOUNDS_HALF = BOUNDS / 2;

let last = performance.now();

let gpuCompute;
let velocityVariable;
let positionVariable;
let positionUniforms;
let velocityUniforms;
let birdUniforms;
let controls;
let boundMesh;

init();
animate();

function init() {

    container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 3000 );
    camera.position.z = 350;

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x267544 );
    scene.fog = new THREE.Fog( 0xffffff, 1, 400 );

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );

    initComputeRenderer();

    stats = new Stats();
    container.appendChild( stats.dom );

    container.style.touchAction = 'none';
    container.addEventListener( 'pointermove', onPointerMove );

    //

    window.addEventListener( 'resize', onWindowResize );

    controls = new OrbitControls(camera, container)
    controls.enableDamping = true
    controls.enabled = false;


    const gui = new GUI();


    const effectController = {
        separation: 20.0,
        alignment: 20.0,
        cohesion: 20.0,
        freedom: 0.75,
        preyRadius: 150.0,
    };

    const valuesChanger = function () {

        velocityUniforms[ 'separationDistance' ].value = effectController.separation;
        velocityUniforms[ 'alignmentDistance' ].value = effectController.alignment;
        velocityUniforms[ 'cohesionDistance' ].value = effectController.cohesion;
        velocityUniforms[ 'freedomFactor' ].value = effectController.freedom;
        velocityUniforms[ 'preyRadius' ].value = effectController.preyRadius;

    };

    valuesChanger();

    gui.add( effectController, 'separation', 0.0, 100.0, 1.0 ).onChange( valuesChanger );
    gui.add( effectController, 'alignment', 0.0, 100, 0.001 ).onChange( valuesChanger );
    gui.add( effectController, 'cohesion', 0.0, 100, 0.025 ).onChange( valuesChanger );
    gui.add( effectController, 'preyRadius', 0.0, 500, 1.0 ).onChange( valuesChanger );
    gui.add( gpuCompute.debugP, 'visible', true ).name( 'Show Position Texture' );
    gui.add( gpuCompute.debugV, 'visible', true ).name( 'Show Velocity Texture' );
    gui.add( gpuCompute.debugV, 'visible', true ).name( 'Show Velocity Texture' );
    gui.close();

    initBirds();

    const boundGeo = new THREE.BoxGeometry(BOUNDS, BOUNDS, BOUNDS);
    const boundMaterial = new THREE.MeshBasicMaterial({color: 0x000000, wireframe: true})
    boundMesh = new THREE.Mesh(boundGeo, boundMaterial);
    boundMesh.visible = false;
    scene.add(boundMesh)

}

function initComputeRenderer() {

    gpuCompute = new GPUComputationRenderer( WIDTH, WIDTH, renderer );

    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();
    fillPositionTexture( dtPosition );
    fillVelocityTexture( dtVelocity );

    velocityVariable = gpuCompute.addVariable( 'textureVelocity', fragmentShaderVelocity, dtVelocity );
    positionVariable = gpuCompute.addVariable( 'texturePosition', fragmentShaderPosition, dtPosition );

    gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
    gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );

    positionUniforms = positionVariable.material.uniforms;
    velocityUniforms = velocityVariable.material.uniforms;

    positionUniforms[ 'time' ] = { value: 0.0 };
    positionUniforms[ 'delta' ] = { value: 0.0 };
    velocityUniforms[ 'time' ] = { value: 1.0 };
    velocityUniforms[ 'delta' ] = { value: 0.0 };
    velocityUniforms[ 'testing' ] = { value: 1.0 };
    velocityUniforms[ 'separationDistance' ] = { value: 1.0 };
    velocityUniforms[ 'alignmentDistance' ] = { value: 1.0 };
    velocityUniforms[ 'cohesionDistance' ] = { value: 1.0 };
    velocityUniforms[ 'freedomFactor' ] = { value: 1.0 };
    velocityUniforms[ 'preyRadius' ] = { value: 1.0 };
    velocityUniforms[ 'predator' ] = { value: new THREE.Vector3() };
    velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed( 2 );

    velocityVariable.wrapS = THREE.RepeatWrapping;
    velocityVariable.wrapT = THREE.RepeatWrapping;
    positionVariable.wrapS = THREE.RepeatWrapping;
    positionVariable.wrapT = THREE.RepeatWrapping;

    const error = gpuCompute.init();

    gpuCompute.debugV = new THREE.Mesh(
        new THREE.PlaneGeometry(3,3),
        new THREE.MeshBasicMaterial({
            map: gpuCompute.getCurrentRenderTarget(velocityVariable).texture
        })
    )
    gpuCompute.debugV.position.z = 300;
    gpuCompute.debugV.position.x = -20;
    gpuCompute.debugV.scale.set(10,10,10);
    gpuCompute.debugV.visible = false;

    gpuCompute.debugP = new THREE.Mesh(
        new THREE.PlaneGeometry(3,3),
        new THREE.MeshBasicMaterial({
            map: gpuCompute.getCurrentRenderTarget(positionVariable).texture
        })
    )
    gpuCompute.debugP.position.z = 300;
    gpuCompute.debugP.position.x = 20;
    gpuCompute.debugP.scale.set(10,10,10);
    gpuCompute.debugP.visible = false;
    scene.add(gpuCompute.debugP, gpuCompute.debugV)


    if ( error !== null ) {

        console.error( error );

    }

}

function initBirds() {

    const geometry = new BirdGeometry();

    // For Vertex and Fragment
    birdUniforms = {
        'color': { value: new THREE.Color( 0xff2200 ) },
        'texturePosition': { value: null },
        'textureVelocity': { value: null },
        'time': { value: 1.0 },
        'delta': { value: 0.0 }
    };

    // THREE.ShaderMaterial
    const material = new THREE.ShaderMaterial( {
        uniforms: birdUniforms,
        vertexShader: birdVS,
        fragmentShader: birdFS,
        side: THREE.DoubleSide

    } );

    const birdMesh = new THREE.Mesh( geometry, material );
    birdMesh.rotation.y = Math.PI / 2;
    birdMesh.matrixAutoUpdate = false;
    birdMesh.updateMatrix();

    scene.add( birdMesh );

}

function fillPositionTexture( texture ) {

    const theArray = texture.image.data;

    for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {

        const x = Math.random() * BOUNDS - BOUNDS_HALF;
        const y = Math.random() * BOUNDS - BOUNDS_HALF;
        const z = Math.random() * BOUNDS - BOUNDS_HALF;

        theArray[ k + 0 ] = x;
        theArray[ k + 1 ] = y;
        theArray[ k + 2 ] = z;
        theArray[ k + 3 ] = 1;

    }

}

function fillVelocityTexture( texture ) {

    const theArray = texture.image.data;

    for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {

        const x = Math.random() - 0.5;
        const y = Math.random() - 0.5;
        const z = Math.random() - 0.5;

        theArray[ k + 0 ] = x * 10;
        theArray[ k + 1 ] = y * 10;
        theArray[ k + 2 ] = z * 10;
        theArray[ k + 3 ] = 1;

    }

}

function onWindowResize() {

    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function onPointerMove( event ) {

    if ( event.isPrimary === false ) return;

    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;

}

//

function animate() {

    requestAnimationFrame( animate );

    render();
    stats.update();

}

function render() {

    const now = performance.now();
    let delta = ( now - last ) / 1000;

    if ( delta > 1 ) delta = 1; // safety cap on large deltas
    last = now;
    controls.update()

    positionUniforms[ 'time' ].value = now;
    positionUniforms[ 'delta' ].value = delta;
    velocityUniforms[ 'time' ].value = now;
    velocityUniforms[ 'delta' ].value = delta;
    birdUniforms[ 'time' ].value = now;
    birdUniforms[ 'delta' ].value = delta;

    velocityUniforms[ 'predator' ].value.set( 0.5 * mouseX / windowHalfX, - 0.5 * mouseY / windowHalfY, 0 );

    mouseX = 10000;
    mouseY = 10000;

    gpuCompute.compute();

    birdUniforms[ 'texturePosition' ].value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
    birdUniforms[ 'textureVelocity' ].value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;

    renderer.render( scene, camera );

}