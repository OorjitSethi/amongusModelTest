import { CharacterControls } from './characterControls';
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0);

// CAMERA
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.65, 0); // Position at eye height

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// Create controls for first-person camera using Three.js PointerLockControls
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Input handling for player movement
const keysPressed: { [key: string]: boolean } = {};

// Add instructions to start the game
const instructionsElement = document.createElement('div');
instructionsElement.id = 'instructions';
instructionsElement.style.position = 'absolute';
instructionsElement.style.width = '100%';
instructionsElement.style.height = '100%';
instructionsElement.style.display = 'flex';
instructionsElement.style.flexDirection = 'column';
instructionsElement.style.justifyContent = 'center';
instructionsElement.style.alignItems = 'center';
instructionsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
instructionsElement.style.color = '#ffffff';
instructionsElement.style.fontFamily = 'Arial, sans-serif';
instructionsElement.style.zIndex = '1000';
instructionsElement.style.cursor = 'pointer';
instructionsElement.innerHTML = `
    <h1 style="margin-bottom: 20px;">Character Controls Demo</h1>
    <div style="text-align: center; font-size: 1.2em; line-height: 1.5;">
        <p>Click to look around and play</p>
        <p>WASD to move</p>
        <p>Shift to run</p>
        <p>ESC to pause and release mouse</p>
    </div>
`;
document.body.appendChild(instructionsElement);

// Click instructions to start game
instructionsElement.addEventListener('click', function() {
    try {
        controls.lock();
    } catch (e) {
        console.error("Error locking pointer:", e);
    }
});

// Show instructions when pointer is unlocked
controls.addEventListener('unlock', function() {
    instructionsElement.style.display = 'flex';
});

// Hide instructions when pointer is locked
controls.addEventListener('lock', function() {
    instructionsElement.style.display = 'none';
});

// Handle pointer lock events
document.addEventListener('pointerlockchange', function() {
    if (document.pointerLockElement === document.body) {
        console.log("Pointer lock activated");
    } else {
        console.log("Pointer lock deactivated");
    }
}, false);

document.addEventListener('pointerlockerror', function(e) {
    console.error("Pointer lock error:", e);
    alert("There was an error with the pointer lock. Click again to try again.");
}, false);

// Keyboard event listeners for player movement
document.addEventListener('keydown', (event) => {
    keysPressed[event.key.toLowerCase()] = true;
    
    // Toggle run with shift
    if (event.key === 'Shift' && characterControls) {
        characterControls.switchRunToggle();
    }
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});

// LIGHTS
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// FLOOR
const floorGeometry = new THREE.PlaneGeometry(80, 80);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// MODEL WITH ANIMATIONS
var characterControls: CharacterControls;
new GLTFLoader().load('models/Soldier.glb', function (gltf) {
    const model = gltf.scene;
    model.traverse(function (object: any) {
        if (object.isMesh) object.castShadow = true;
    });
    scene.add(model);

    const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
    const mixer = new THREE.AnimationMixer(model);
    const animationsMap: Map<string, THREE.AnimationAction> = new Map();
    gltfAnimations.filter(a => a.name != 'TPose').forEach((a: THREE.AnimationClip) => {
        animationsMap.set(a.name, mixer.clipAction(a));
    });

    characterControls = new CharacterControls(model, mixer, animationsMap, camera, controls, 'Idle');
});

const clock = new THREE.Clock();

// ANIMATE
function animate() {
    const delta = clock.getDelta();
    
    if (characterControls) {
        characterControls.update(delta, keysPressed);
    }
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

document.body.appendChild(renderer.domElement);
animate();

// RESIZE HANDLER
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize, false);

function generateFloor() {
    // TEXTURES
    const textureLoader = new THREE.TextureLoader();
    const placeholder = textureLoader.load("./textures/placeholder/placeholder.png");
    const sandBaseColor = textureLoader.load("./textures/sand/Sand 002_COLOR.jpg");
    const sandNormalMap = textureLoader.load("./textures/sand/Sand 002_NRM.jpg");
    const sandHeightMap = textureLoader.load("./textures/sand/Sand 002_DISP.jpg");
    const sandAmbientOcclusion = textureLoader.load("./textures/sand/Sand 002_OCC.jpg");

    const WIDTH = 80
    const LENGTH = 80

    const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH, 512, 512);
    const material = new THREE.MeshStandardMaterial(
        {
            map: sandBaseColor, normalMap: sandNormalMap,
            displacementMap: sandHeightMap, displacementScale: 0.1,
            aoMap: sandAmbientOcclusion
        })
    wrapAndRepeatTexture(material.map)
    wrapAndRepeatTexture(material.normalMap)
    wrapAndRepeatTexture(material.displacementMap)
    wrapAndRepeatTexture(material.aoMap)
    // const material = new THREE.MeshPhongMaterial({ map: placeholder})

    const floor = new THREE.Mesh(geometry, material)
    floor.receiveShadow = true
    floor.rotation.x = - Math.PI / 2
    scene.add(floor)
}

function wrapAndRepeatTexture (map: THREE.Texture) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.repeat.x = map.repeat.y = 10
}

function light() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(- 60, 100, - 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = - 50;
    dirLight.shadow.camera.left = - 50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    scene.add(dirLight);
    // scene.add( new THREE.CameraHelper(dirLight.shadow.camera))
}