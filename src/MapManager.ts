import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class MapManager {
    private scene: THREE.Scene
    private mapModel: THREE.Group | null = null
    private isLoaded: boolean = false
    private onLoadCallback: Function | null = null

    // Default map parameters - can be adjusted
    private mapScale: number = 20  // Increased from 0.1 to 20
    private mapPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
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
        cube.position.set(0, 2.5, -10) // Position it in front of the starting position
        
        console.log(`Adding debug placeholder cube at (0, 2.5, -10)`)
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
} 