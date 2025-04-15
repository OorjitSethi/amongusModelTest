import { CharacterControls } from './characterControls';
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { MapManager } from './MapManager';
import { PhysicsManager } from './PhysicsManager';

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Initialize physics
const physicsManager = new PhysicsManager();

// Start loading physics engine
(async function initPhysics() {
    try {
        await physicsManager.init();
        console.log('Physics initialized successfully');
    } catch (error) {
        console.error('Failed to initialize physics:', error);
    }
})();

// CAMERA
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 1.65, 10); // Position at map center (10, 0, 10) with eye height

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// Create controls for first-person camera using Three.js PointerLockControls
const controls = new PointerLockControls(camera, document.body);
controls.getObject().position.set(10, 1.65, 10); // Position at map center with eye height
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
    <h1 style="margin-bottom: 20px;">Among Us - The Skeld</h1>
    <div style="text-align: center; font-size: 1.2em; line-height: 1.5;">
        <p>Click to look around and play</p>
        <p>WASD to move</p>
        <p>Shift to run</p>
        <p>ESC to pause and release mouse</p>
    </div>
    <div id="loading-status" style="margin-top: 20px;">Loading map and character...</div>
`;
document.body.appendChild(instructionsElement);

// Create loading indicator
const loadingStatus = document.getElementById('loading-status');

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
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increase intensity
scene.add(ambientLight);

// Add multiple directional lights from different angles
const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight1.position.set(0, 20, 10);
directionalLight1.castShadow = true;
scene.add(directionalLight1);

// Add a second directional light from another angle
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight2.position.set(10, 15, -10);
directionalLight2.castShadow = true;
scene.add(directionalLight2);

// Add point lights for more local illumination
const pointLight = new THREE.PointLight(0xffffff, 1, 50);
pointLight.position.set(0, 10, 0);
scene.add(pointLight);

// Initialize MapManager
const mapManager = new MapManager(scene);

// Place where the Skeld map GLB should be located
const mapPath = './models/skeld-map.glb';

// Create a loading manager to track progress
let characterLoaded = false;
let mapLoaded = false;

// Function to check if everything is loaded
function checkAllLoaded() {
    if (characterLoaded && mapLoaded) {
        if (loadingStatus) {
            loadingStatus.textContent = "Ready to play!";
            setTimeout(() => {
                loadingStatus.style.display = 'none';
            }, 1000);
        }
        console.log("All assets loaded!");
        
        // Create collision objects from map meshes once everything is loaded
        if (physicsManager.isPhysicsInitialized() && mapManager.getCollisionMeshes().length > 0) {
            physicsManager.createCollisionObjects(mapManager.getCollisionMeshes() as THREE.Mesh[]);
            console.log('Created physics collision objects for map');
        }
    }
}

// Load the Skeld map
mapManager.loadMap(mapPath, () => {
    mapLoaded = true;
    checkAllLoaded();
    
    // Adjust map position and scale if needed
    mapManager.setScale(20); // Increased from 0.1 to 20 for better visibility
    mapManager.setPosition(new THREE.Vector3(10, 0, 10)); // Adjusted position to center the map
    
    // Create rigid bodies for map collision meshes
    if (physicsManager.isPhysicsInitialized()) {
        const collisionMeshes = mapManager.getCollisionMeshes();
        console.log(`\n=== Debug: Creating rigid bodies for ${collisionMeshes.length} collision meshes ===`);
        
        // Clear any existing visualization
        clearCollisionVisualizations();
        
        // Create rigid bodies for all collision meshes
        collisionMeshes.forEach((mesh, index) => {
            const isMapFloor = mesh.name.toLowerCase().includes('floor');
            
            console.log(`\nProcessing mesh ${index}: ${mesh.name}`);
            console.log(`Original position: (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z})`);
            
            // Apply offset to match the visible wireframes (increased to 10 units east and 10 units south)
            const offsetPosition = new THREE.Vector3(
                mesh.position.x + 10,
                mesh.position.y,
                mesh.position.z + 10
            );
            
            console.log(`Offset position: (${offsetPosition.x}, ${offsetPosition.y}, ${offsetPosition.z})`);
            
            // Create a rigid body with correct mass (0 for immovable objects)
            physicsManager.createStaticRigidBody(
                mesh, 
                {
                    position: offsetPosition,
                    mass: 0, // Static/immovable object
                    restitution: 0.2, // Slight bounce
                    isFloor: isMapFloor
                }
            );
        });
        
        // Create visualizations after all rigid bodies are created
        visualizeCollisionMeshes();
        
        console.log(`=== End Debug ===\n`);
    }
    
    // Initial player position
    if (characterControls) {
        // Position character at the center of the map 
        const startPosition = new THREE.Vector3(10, 0, 10);
        characterControls.model.position.copy(startPosition);
        
        // Force update the controls position to match the new character position
        const controlsObject = controls.getObject();
        controlsObject.position.set(10, 1.65, 10);
        
        // Connect map manager to character controls for collision detection
        characterControls.setMapManager(mapManager);
        console.log("Connected character controls to map manager for collision detection");
        
        // Connect physics manager to character controls if physics is initialized
        if (physicsManager.isPhysicsInitialized()) {
            characterControls.setPhysicsManager(physicsManager);
            console.log("Connected character controls to physics manager for collision detection");
        }
    }
});

// Add a timeout to detect if map fails to load
setTimeout(() => {
    if (!mapLoaded) {
        console.error("Map failed to load within timeout period");
        if (loadingStatus) {
            loadingStatus.textContent = "Using fallback map...";
        }
        
        // Generate a fallback map with collision objects
        mapManager.generateFallbackMap();
        mapLoaded = true;
        checkAllLoaded();
        
        // Create rigid bodies for map collision meshes in the fallback map
        if (physicsManager.isPhysicsInitialized()) {
            const collisionMeshes = mapManager.getCollisionMeshes();
            console.log(`\n=== Debug: Creating ${collisionMeshes.length} rigid bodies for fallback map ===`);
            
            // Clear any existing visualization
            clearCollisionVisualizations();
            
            // Create rigid bodies for all collision meshes
            collisionMeshes.forEach((mesh, index) => {
                const isMapFloor = mesh.name.toLowerCase().includes('floor');
                
                console.log(`Processing fallback mesh ${index}: ${mesh.name} at position (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z})`);
                
                // Apply offset to match the visible wireframes (increased to 10 units east and 10 units south)
                const offsetPosition = new THREE.Vector3(
                    mesh.position.x + 10,
                    mesh.position.y,
                    mesh.position.z + 10
                );
                
                console.log(`Fallback mesh ${index} offset position: (${offsetPosition.x}, ${offsetPosition.y}, ${offsetPosition.z})`);
                
                // Create a rigid body with correct mass (0 for immovable objects)
                physicsManager.createStaticRigidBody(
                    mesh, 
                    {
                        position: offsetPosition,
                        mass: 0, // Static/immovable object
                        restitution: 0.2, // Slight bounce
                        isFloor: isMapFloor
                    }
                );
            });
            
            // Create visualizations after all rigid bodies are created
            visualizeCollisionMeshes();
            
            console.log(`=== End Debug ===\n`);
        }
        
        // Initial player position
        if (characterControls) {
            // Position character at the center of the map 
            const startPosition = new THREE.Vector3(10, 0, 10);
            characterControls.model.position.copy(startPosition);
            
            // Force update the controls position to match the new character position
            const controlsObject = controls.getObject();
            controlsObject.position.set(10, 1.65, 10);
            
            // Connect map manager to character controls for collision detection
            characterControls.setMapManager(mapManager);
            console.log("Connected character controls to map manager for collision detection");
            
            // Connect physics manager to character controls if physics is initialized
            if (physicsManager.isPhysicsInitialized()) {
                characterControls.setPhysicsManager(physicsManager);
                console.log("Connected character controls to physics manager for collision detection");
            }
        }
    }
}, 10000); // 10 second timeout

// MODEL WITH ANIMATIONS
var characterControls: CharacterControls;
new GLTFLoader().load('models/Soldier.glb', function (gltf) {
    const model = gltf.scene;
    model.traverse(function (object: any) {
        if (object.isMesh) object.castShadow = true;
    });
    
    // Position model at map center before adding it to the scene
    model.position.set(10, 0, 10);
    scene.add(model);

    const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
    const mixer = new THREE.AnimationMixer(model);
    const animationsMap: Map<string, THREE.AnimationAction> = new Map();
    gltfAnimations.filter(a => a.name != 'TPose').forEach((a: THREE.AnimationClip) => {
        animationsMap.set(a.name, mixer.clipAction(a));
    });

    characterControls = new CharacterControls(model, mixer, animationsMap, camera, controls, 'Idle', mapManager, physicsManager);
    
    characterLoaded = true;
    checkAllLoaded();
    
    // If map is already loaded, set map manager for collision detection
    if (mapLoaded) {
        characterControls.setMapManager(mapManager);
        console.log("Connected character controls to map manager for collision detection");
        
        // Connect physics manager to character controls if physics is initialized
        if (physicsManager.isPhysicsInitialized()) {
            characterControls.setPhysicsManager(physicsManager);
            console.log("Connected character controls to physics manager for collision detection");
        }
    }
});

const clock = new THREE.Clock();

// ANIMATE
function animate() {
    const delta = clock.getDelta();
    
    // Update physics simulation
    if (physicsManager.isPhysicsInitialized()) {
        physicsManager.update(delta);
    }
    
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

// Add a basic floor plane as fallback
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.set(10, -0.01, 10); // Move floor slightly below (y = -0.01) to prevent z-fighting
floor.receiveShadow = true;
scene.add(floor);

// Display the current path
console.log(`Current working directory structure:`);

// Helper function to add debug visualization objects
function addDebugObjects() {
    // Add coordinate axes
    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.position.set(10, 0.1, 10); // Position at map center, slightly above floor
    scene.add(axesHelper);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20);
    gridHelper.position.set(10, 0.01, 10); // Position at map center
    scene.add(gridHelper);
}

// Add debug visualizations
addDebugObjects();

// Collection to store visualization meshes
const collisionVisualizations: THREE.Mesh[] = [];

// Function to clear all collision visualizations
function clearCollisionVisualizations() {
    // Remove all existing visualization meshes from the scene
    collisionVisualizations.forEach(mesh => {
        scene.remove(mesh);
    });
    // Clear the array
    collisionVisualizations.length = 0;
    console.log("Cleared all collision visualizations");
}

// Add a helper function to visualize collision meshes (for debugging)
function visualizeCollisionMeshes() {
    // First clear any existing visualizations
    clearCollisionVisualizations();
    
    if (mapManager && mapManager.getCollisionMeshes().length > 0) {
        console.log(`\n=== Debug: Visualizing ${mapManager.getCollisionMeshes().length} collision meshes ===`);
        
        const collisionMeshes = mapManager.getCollisionMeshes();
        collisionMeshes.forEach((mesh, index) => {
            // Create a wireframe representation of the collision mesh
            const geometry = mesh.geometry.clone();
            const material = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                wireframe: true,
                opacity: 0.8,
                transparent: true,
                depthTest: false // Show through walls
            });
            
            const wireframeMesh = new THREE.Mesh(geometry, material);
            
            // Get the original position
            const originalPosition = mesh.position.clone();
            console.log(`Mesh ${index} (${mesh.name}) original position: (${originalPosition.x}, ${originalPosition.y}, ${originalPosition.z})`);
            
            // Apply offset: increased to 10 units east and 10 units south
            const offsetPosition = new THREE.Vector3(
                originalPosition.x + 10,
                originalPosition.y,
                originalPosition.z + 10
            );
            console.log(`Mesh ${index} offset position: (${offsetPosition.x}, ${offsetPosition.y}, ${offsetPosition.z})`);
            
            // Set the position with the offset and use original scale
            wireframeMesh.position.copy(offsetPosition);
            wireframeMesh.quaternion.copy(mesh.quaternion);
            wireframeMesh.scale.copy(mesh.scale);
            
            scene.add(wireframeMesh);
            // Store the visualization mesh for later cleanup
            collisionVisualizations.push(wireframeMesh);
            
            console.log(`Added visualization for collision mesh ${index}`);
        });
        
        console.log(`=== End Debug ===\n`);
    } else {
        console.log("No collision meshes found to visualize");
    }
}

// Add a key handler to toggle collision visualization
document.addEventListener('keydown', (event) => {
    if (event.key === 'v') {
        console.log("Toggling collision visualization");
        visualizeCollisionMeshes();
    }
});

// Add a key handler to toggle debug mode
document.addEventListener('keydown', (event) => {
    if (event.key === 'd') {
        console.log("Triggering debug visualization");
        showDebugVisualization();
    }
});

// Function to create and show a debug sphere at a specific position
function showDebugVisualization() {
    // Create a debug sphere at the player position
    const playerPosition = controls.getObject().position.clone();
    playerPosition.y -= 1.65; // Adjust for eye height
    
    const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        depthTest: false
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(playerPosition);
    scene.add(sphere);
    
    console.log(`Player position: (${playerPosition.x}, ${playerPosition.y}, ${playerPosition.z})`);
    
    // Visualize collision test rays from this position
    const rayLength = 10;
    const directions = [
        new THREE.Vector3(1, 0, 0),    // East
        new THREE.Vector3(1, 0, 1).normalize(),  // Northeast
        new THREE.Vector3(0, 0, 1),    // North
        new THREE.Vector3(-1, 0, 1).normalize(), // Northwest
        new THREE.Vector3(-1, 0, 0),   // West
        new THREE.Vector3(-1, 0, -1).normalize(), // Southwest
        new THREE.Vector3(0, 0, -1),   // South
        new THREE.Vector3(1, 0, -1).normalize()  // Southeast
    ];
    
    directions.forEach((dir, index) => {
        const rayEnd = playerPosition.clone().add(dir.clone().multiplyScalar(rayLength));
        
        // Create a line to visualize the ray
        const geometry = new THREE.BufferGeometry().setFromPoints([
            playerPosition,
            rayEnd
        ]);
        
        const material = new THREE.LineBasicMaterial({ 
            color: 0xffff00,
            depthTest: false
        });
        
        const line = new THREE.Line(geometry, material);
        scene.add(line);
    });
    
    // Test collision directly with physics manager
    if (physicsManager && physicsManager.isPhysicsInitialized()) {
        const hasCollision = physicsManager.checkCharacterCollision(playerPosition, 0.5, 1.8);
        console.log(`Direct collision test result: ${hasCollision}`);
    }
    
    console.log("Debug visualization added - press 'v' to see collision meshes");
}

// Add debug key to test collision at current position
document.addEventListener('keydown', (event) => {
    if (event.key === 'c') {
        console.log("Testing collision at current position");
        testCollisionAtCurrentPosition();
    }
});

// Function to test collision at the current position
function testCollisionAtCurrentPosition() {
    if (!characterControls || !physicsManager) {
        console.log("Character or physics manager not initialized");
        return;
    }
    
    const position = characterControls.model.position.clone();
    console.log(`Testing collision at current position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    
    const hasCollision = physicsManager.checkCharacterCollision(
        position,
        0.5, // radius
        1.8  // height
    );
    
    console.log(`Collision test result: ${hasCollision ? "COLLISION DETECTED" : "No collision"}`);
}