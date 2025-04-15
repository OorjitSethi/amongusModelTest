import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class MapManager {
    private scene: THREE.Scene
    private mapModel: THREE.Group | null = null
    private isLoaded: boolean = false
    private onLoadCallback: Function | null = null
    private collisionMeshes: THREE.Mesh[] = [] // Store collision meshes

    // Default map parameters - can be adjusted
    private mapScale: number = 20  // Increased from 0.1 to 20
    private mapPosition: THREE.Vector3 = new THREE.Vector3(10, 0, 10)  // Centered position
    private mapRotation: number = 0  // Rotation around Y axis in radians

    constructor(scene: THREE.Scene) {
        this.scene = scene
    }

    /**
     * Load the map model
     * @param mapPath Path to the GLB file
     * @param onLoad Optional callback when map is loaded
     */
    public loadMap(mapPath: string, onLoad?: Function): void {
        const loader = new GLTFLoader()
        
        console.log(`Attempting to load map from: ${mapPath}`)
        
        // Add a simple placeholder cube to confirm scene rendering works
        this.addDebugPlaceholder()
        
        loader.load(
            mapPath, 
            (gltf) => {
                console.log('Map loaded successfully, processing...')
                this.mapModel = gltf.scene
                
                console.log(`Map model children count: ${this.mapModel.children.length}`)
                
                // Log the map structure for debugging
                console.log('Map structure:')
                this.logObjectStructure(this.mapModel, 0)
                
                // Apply materials and shadows
                this.mapModel.traverse((object: any) => {
                    if (object.isMesh) {
                        console.log(`Found mesh in map: ${object.name}`)
                        object.castShadow = true
                        object.receiveShadow = true
                        
                        // Ensure materials are correctly set up
                        if (object.material) {
                            object.material.side = THREE.DoubleSide
                        }
                        
                        // Extract collision meshes based on name patterns
                        if (this.shouldHaveCollision(object)) {
                            this.addToCollisionMeshes(object)
                        } else {
                            // If not detected as collision, treat all meshes as collision objects for now (for debugging)
                            this.addToCollisionMeshes(object)
                            console.log(`Added non-matching mesh as collision: ${object.name}`)
                        }
                    }
                })
                
                // Apply scale to make it the right size
                this.mapModel.scale.set(this.mapScale, this.mapScale, this.mapScale)
                console.log(`Applied scale: ${this.mapScale}`)
                
                // Position the map
                this.mapModel.position.copy(this.mapPosition)
                console.log(`Positioned map at: (${this.mapPosition.x}, ${this.mapPosition.y}, ${this.mapPosition.z})`)
                
                // Rotate the map if needed
                this.mapModel.rotation.y = this.mapRotation
                
                // Add to scene
                this.scene.add(this.mapModel)
                
                this.isLoaded = true
                console.log('Map fully loaded and added to scene')
                console.log(`Extracted ${this.collisionMeshes.length} collision meshes`)
                
                // Execute callback if provided
                if (onLoad) {
                    onLoad()
                }
                
                if (this.onLoadCallback) {
                    this.onLoadCallback()
                }
            },
            // Progress callback
            (xhr) => {
                const progress = (xhr.loaded / xhr.total * 100).toFixed(0)
                console.log(`Map loading: ${progress}%`)
            },
            // Error callback
            (error) => {
                console.error('Error loading map model:', error)
                // Still add the debug placeholder to help diagnose the issue
                this.addDebugPlaceholder(true)
            }
        )
    }
    
    /**
     * Helper to log the hierarchical structure of the map
     */
    private logObjectStructure(object: THREE.Object3D, depth: number): void {
        const indent = '  '.repeat(depth)
        console.log(`${indent}${object.name || 'unnamed'} (${object.type})`)
        
        object.children.forEach(child => {
            this.logObjectStructure(child, depth + 1)
        })
    }
    
    /**
     * Determines if an object should have collision based on its name
     */
    private shouldHaveCollision(object: THREE.Object3D): boolean {
        const name = object.name.toLowerCase()
        return (
            object.type === 'Mesh' && 
            (name.includes('wall') || 
             name.includes('table') || 
             name.includes('collision') || 
             name.includes('obstacle') ||
             name.includes('barrier') ||
             name.includes('door') ||
             name.includes('furniture'))
        )
    }
    
    /**
     * Add a mesh to the collision meshes array
     */
    private addToCollisionMeshes(mesh: THREE.Mesh): void {
        // Clone the mesh geometry for collision detection
        const clonedMesh = mesh.clone()
        
        console.log(`\n=== Debug: Processing collision mesh ${mesh.name} ===`);
        console.log(`Original position: (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z})`);
        
        // Update the world matrix of the original mesh and all its ancestors
        mesh.updateWorldMatrix(true, false);
        
        // Get the mesh's world matrix which includes all parent transformations
        const worldMatrix = mesh.matrixWorld.clone();
        console.log(`World matrix before scale:`, worldMatrix.elements);
        
        // For meshes in the map model, include the map scale
        if (this.mapModel && this.isChildOf(mesh, this.mapModel)) {
            // Create a scaling matrix for the mapScale
            const scalingMatrix = new THREE.Matrix4().makeScale(
                this.mapScale, 
                this.mapScale, 
                this.mapScale
            );
            console.log(`Scaling matrix:`, scalingMatrix.elements);
            
            // Apply the scaling after the world matrix
            worldMatrix.multiply(scalingMatrix);
            console.log(`World matrix after scale:`, worldMatrix.elements);
        }
        
        // Extract position, rotation, and scale from the world matrix
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        worldMatrix.decompose(worldPosition, worldQuaternion, worldScale);
        
        console.log(`World position after decomposition: (${worldPosition.x}, ${worldPosition.y}, ${worldPosition.z})`);
        console.log(`World scale: (${worldScale.x}, ${worldScale.y}, ${worldScale.z})`);
        
        // Apply the world transformations to the cloned mesh
        clonedMesh.position.copy(worldPosition);
        clonedMesh.quaternion.copy(worldQuaternion);
        clonedMesh.scale.copy(worldScale);
        
        // Reset the matrix to identity (important!)
        clonedMesh.updateMatrix();
        
        // Add to collision meshes array
        this.collisionMeshes.push(clonedMesh)
        
        console.log(`Final collision mesh position: (${clonedMesh.position.x}, ${clonedMesh.position.y}, ${clonedMesh.position.z})`);
        console.log(`=== End Debug ===\n`);
    }
    
    /**
     * Check if an object is a child of another object in the scene graph
     */
    private isChildOf(child: THREE.Object3D, parent: THREE.Object3D): boolean {
        let current = child.parent;
        while (current) {
            if (current === parent) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }
    
    /**
     * Get all collision meshes
     */
    public getCollisionMeshes(): THREE.Mesh[] {
        return this.collisionMeshes
    }
    
    /**
     * Check if a position collides with any collision mesh
     * @param position Position to check
     * @param radius Collision radius (character width/2)
     * @return boolean True if collision detected
     */
    public checkCollision(position: THREE.Vector3, radius: number = 0.5): boolean {
        // We're no longer using custom collision detection
        // All collisions are handled by the physics system
        console.log("Custom collision detection is disabled - using physics system instead");
        return false;
    }
    
    /**
     * Debug utility to visualize a collision box
     */
    private showDebugCollisionBox(box: THREE.Box3, color: number = 0xffff00): void {
        // Debug visualization is no longer needed as physics system handles collisions
        return;
    }
    
    /**
     * Add a placeholder cube to help debug scene rendering
     */
    private addDebugPlaceholder(isError: boolean = false): void {
        // Create a distinctive debug cube
        const geometry = new THREE.BoxGeometry(5, 5, 5)
        const material = new THREE.MeshStandardMaterial({ 
            color: isError ? 0xff0000 : 0x00ff00,
            wireframe: true
        })
        const cube = new THREE.Mesh(geometry, material)
        cube.position.set(10, 2.5, 10) // Position it at the new center coordinates
        
        console.log(`Adding debug placeholder cube at (10, 2.5, 10)`)
        this.scene.add(cube)
    }
    
    /**
     * Set a callback to be called when map finishes loading
     */
    public onLoad(callback: Function): void {
        if (this.isLoaded) {
            callback()
        } else {
            this.onLoadCallback = callback
        }
    }
    
    /**
     * Manually set the map scale
     */
    public setScale(scale: number): void {
        this.mapScale = scale
        if (this.mapModel) {
            this.mapModel.scale.set(scale, scale, scale)
        }
    }
    
    /**
     * Manually set the map position
     */
    public setPosition(position: THREE.Vector3): void {
        this.mapPosition = position
        if (this.mapModel) {
            this.mapModel.position.copy(position)
        }
    }
    
    /**
     * Set the map's rotation around the Y axis
     */
    public setRotation(radians: number): void {
        this.mapRotation = radians
        if (this.mapModel) {
            this.mapModel.rotation.y = radians
        }
    }
    
    /**
     * Check if the map is loaded
     */
    public isMapLoaded(): boolean {
        return this.isLoaded
    }
    
    /**
     * Get the map model (if loaded)
     */
    public getMapModel(): THREE.Group | null {
        return this.mapModel
    }

    /**
     * Generate a fallback map model with simple collision objects
     */
    public generateFallbackMap(): void {
        console.log('Generating fallback map model...');
        
        // Clear existing collision meshes
        this.collisionMeshes = [];
        
        // Create a group to hold our map meshes
        const mapGroup = new THREE.Group();
        mapGroup.name = 'FallbackMap';
        
        // Set the map center to match character position (10,0,10)
        const mapCenterX = 10;
        const mapCenterZ = 10;
        
        // Create a floor
        const floorGeometry = new THREE.PlaneGeometry(40, 40);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(mapCenterX, -0.01, mapCenterZ);
        floor.receiveShadow = true;
        floor.name = 'floor';
        mapGroup.add(floor);
        
        // Create walls
        const createWall = (x: number, z: number, width: number, height: number, depth: number, rotationY: number = 0, color: number = 0x777777) => {
            const wallGeometry = new THREE.BoxGeometry(width, height, depth);
            const wallMaterial = new THREE.MeshStandardMaterial({ 
                color: color,
                roughness: 0.7,
                metalness: 0.3
            });
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(x, height/2, z);
            wall.rotation.y = rotationY;
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.name = 'wall';
            return wall;
        };
        
        // Add walls around the map (make them clearly visible with different colors)
        // North wall (red)
        mapGroup.add(createWall(mapCenterX, mapCenterZ - 10, 40, 4, 1, 0, 0xaa3333));
        // South wall (blue)
        mapGroup.add(createWall(mapCenterX, mapCenterZ + 10, 40, 4, 1, 0, 0x3333aa));
        // East wall (green)
        mapGroup.add(createWall(mapCenterX - 20, mapCenterZ, 20, 4, 1, Math.PI/2, 0x33aa33));
        // West wall (yellow)
        mapGroup.add(createWall(mapCenterX + 20, mapCenterZ, 20, 4, 1, Math.PI/2, 0xaaaa33));
        
        // Add some interior obstacles
        // Center wall
        mapGroup.add(createWall(mapCenterX, mapCenterZ, 10, 3, 1, 0, 0x996633));
        
        // Add some columns in corners
        mapGroup.add(createWall(mapCenterX - 5, mapCenterZ - 5, 2, 4, 2, Math.PI/4, 0x884422));
        mapGroup.add(createWall(mapCenterX + 5, mapCenterZ - 5, 2, 4, 2, -Math.PI/4, 0x884422));
        mapGroup.add(createWall(mapCenterX - 5, mapCenterZ + 5, 2, 4, 2, -Math.PI/4, 0x884422));
        mapGroup.add(createWall(mapCenterX + 5, mapCenterZ + 5, 2, 4, 2, Math.PI/4, 0x884422));
        
        // Add a table in the center
        const tableGeometry = new THREE.BoxGeometry(5, 1.5, 3);
        const tableMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.1
        });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(mapCenterX, 0.75, mapCenterZ);
        table.castShadow = true;
        table.receiveShadow = true;
        table.name = 'table';
        mapGroup.add(table);
        
        // Add some crates
        const createCrate = (x: number, z: number, size: number = 1.5) => {
            const crateGeometry = new THREE.BoxGeometry(size, size, size);
            const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x7F5F2A });
            const crate = new THREE.Mesh(crateGeometry, crateMaterial);
            crate.position.set(x, size/2, z);
            crate.castShadow = true;
            crate.receiveShadow = true;
            crate.name = 'crate';
            return crate;
        };
        
        // Add crates in various positions
        mapGroup.add(createCrate(mapCenterX - 5, mapCenterZ, 1.8));
        mapGroup.add(createCrate(mapCenterX + 5, mapCenterZ, 1.5));
        mapGroup.add(createCrate(mapCenterX, mapCenterZ - 5, 1.2));
        mapGroup.add(createCrate(mapCenterX, mapCenterZ + 5, 2.0));
        
        // Set position and scale
        mapGroup.position.copy(this.mapPosition);
        
        // Add to scene
        this.scene.add(mapGroup);
        this.mapModel = mapGroup;
        
        // Extract collision meshes
        mapGroup.traverse((object: any) => {
            if (object.isMesh && object.name !== 'floor') {
                this.addToCollisionMeshes(object);
            }
        });
        
        this.isLoaded = true;
        console.log(`Generated fallback map with ${this.collisionMeshes.length} collision objects`);
        
        // Log collision mesh positions for debugging
        this.collisionMeshes.forEach((mesh, index) => {
            console.log(`Collision mesh ${index} (${mesh.name}): position (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z})`);
        });
    }
} 