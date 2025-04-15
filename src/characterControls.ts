import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { A, D, DIRECTIONS, S, W } from './utils'
import { MapManager } from './MapManager'
import { PhysicsManager } from './PhysicsManager'

export class CharacterControls {
    model: THREE.Group
    mixer: THREE.AnimationMixer
    animationsMap: Map<string, THREE.AnimationAction> = new Map()
    camera: THREE.Camera
    controls: PointerLockControls
    mapManager: MapManager | null = null
    physicsManager: PhysicsManager | null = null

    // state
    toggleRun: boolean = true
    currentAction: string
    
    // Movement speeds
    walkSpeed: number = 2.5
    runSpeed: number = 5.0
    
    // Camera settings
    cameraHeight: number = 1.65 // Eye height for first person
    cameraForwardOffset: number = 0.25 // Forward offset to place camera at eyes
    
    // Collision settings
    collisionRadius: number = 0.5 // Character collision radius
    characterHeight: number = 1.8 // Character height for collision capsule
    
    // Movement vectors
    moveDirection = new THREE.Vector3()
    modelPosition = new THREE.Vector3()
    lastValidPosition = new THREE.Vector3()

    constructor(
        model: THREE.Group,
        mixer: THREE.AnimationMixer,
        animationsMap: Map<string, THREE.AnimationAction>,
        camera: THREE.Camera,
        controls: PointerLockControls,
        currentAction: string,
        mapManager?: MapManager,
        physicsManager?: PhysicsManager
    ) {
        this.model = model
        this.mixer = mixer
        this.animationsMap = animationsMap
        this.currentAction = currentAction
        this.camera = camera
        this.controls = controls
        this.mapManager = mapManager || null
        this.physicsManager = physicsManager || null
        
        // Make model visible (was hidden in previous implementation)
        this.model.traverse((object) => {
            if (object.type === 'Mesh') {
                object.visible = true
            }
        })

        // Initialize animations
        this.animationsMap.forEach((value, key) => {
            if (key == currentAction) {
                value.play()
            }
        })
        
        // Position model at the new map center (10, 0, 10)
        this.model.position.set(10, 0, 10)
        
        // Store initial position
        this.modelPosition.copy(this.model.position)
        this.lastValidPosition.copy(this.model.position)
        
        // Initialize character position and camera
        this.updateControlsPosition()
    }
    
    /**
     * Set the map manager reference for collision detection
     */
    public setMapManager(mapManager: MapManager): void {
        this.mapManager = mapManager
    }
    
    /**
     * Set the physics manager reference for collision detection
     */
    public setPhysicsManager(physicsManager: PhysicsManager): void {
        this.physicsManager = physicsManager
    }
    
    private updateControlsPosition() {
        // Position the controls object at character position with eye height
        if (this.controls && this.model) {
            const controlsObject = this.controls.getObject()
            
            // Get camera direction for forward offset
            const cameraDirection = new THREE.Vector3()
            this.camera.getWorldDirection(cameraDirection)
            cameraDirection.y = 0
            cameraDirection.normalize()
            
            // Calculate forward offset
            const forwardOffset = cameraDirection.clone().multiplyScalar(this.cameraForwardOffset)
            
            // Apply position with height and forward offset
            controlsObject.position.x = this.model.position.x + forwardOffset.x
            controlsObject.position.z = this.model.position.z + forwardOffset.z
            controlsObject.position.y = this.model.position.y + this.cameraHeight
        }
    }

    public switchRunToggle() {
        this.toggleRun = !this.toggleRun
    }

    /**
     * Check if a position would result in a collision
     */
    private checkCollision(position: THREE.Vector3): boolean {
        // Only use physics-based collision detection
        if (this.physicsManager && this.physicsManager.isPhysicsInitialized()) {
            const collision = this.physicsManager.checkCharacterCollision(
                position, 
                this.collisionRadius,
                this.characterHeight
            );
            if (collision) {
                console.log(`Physics collision detected at position (${position.x}, ${position.y}, ${position.z})`);
                return true;
            }
        } else {
            console.warn("Physics system not initialized - character will have no collisions");
        }
        
        // No collision detected or physics not available
        return false;
    }

    public update(delta: number, keysPressed: any) {
        // Only handle movement if controls are locked (game is active)
        if (this.controls.isLocked) {
            // Calculate movement direction relative to camera view
            this.moveDirection.set(0, 0, 0)
            
            if (keysPressed[W]) this.moveDirection.z -= 1
            if (keysPressed[S]) this.moveDirection.z += 1
            if (keysPressed[A]) this.moveDirection.x += 1
            if (keysPressed[D]) this.moveDirection.x -= 1
            
            // Get camera direction
            const cameraDirection = new THREE.Vector3()
            this.camera.getWorldDirection(cameraDirection)
            cameraDirection.y = 0
            cameraDirection.normalize()
            
            // Make the character face the camera direction
            const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z)
            this.model.rotation.y = cameraAngle + Math.PI
            
            // Determine animation state based on whether we're moving or not
            const isMoving = this.moveDirection.length() > 0
            
            let play = 'Idle'
            if (isMoving) {
                play = this.toggleRun ? 'Run' : 'Walk'
                
                // Normalize for diagonal movement
                this.moveDirection.normalize()
                
                // Get camera right vector
                const cameraRight = new THREE.Vector3()
                cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize()
                
                // Calculate movement vector
                const moveVector = new THREE.Vector3()
                moveVector.addScaledVector(cameraDirection, -this.moveDirection.z)
                moveVector.addScaledVector(cameraRight, this.moveDirection.x)
                moveVector.normalize()
                
                // Apply speed
                const speed = this.toggleRun ? this.runSpeed : this.walkSpeed
                moveVector.multiplyScalar(speed * delta)
                
                // Store current position before moving
                this.lastValidPosition.copy(this.model.position)
                
                // Get the controls object
                const controlsObject = this.controls.getObject()
                
                // Calculate new position
                const newControlsPosition = controlsObject.position.clone().add(moveVector)
                
                // Calculate forward offset for character position
                const forwardOffset = cameraDirection.clone().multiplyScalar(this.cameraForwardOffset)
                
                // Calculate the new character position (removing offset)
                const newModelPosition = new THREE.Vector3(
                    newControlsPosition.x - forwardOffset.x,
                    newControlsPosition.y - this.cameraHeight,
                    newControlsPosition.z - forwardOffset.z
                )
                
                // Check for collision
                const wouldCollide = this.checkCollision(newModelPosition)
                
                if (!wouldCollide) {
                    // No collision, move normally
                    controlsObject.position.copy(newControlsPosition)
                    
                    // Update model position
                    this.model.position.x = controlsObject.position.x - forwardOffset.x
                    this.model.position.z = controlsObject.position.z - forwardOffset.z
                    this.model.position.y = controlsObject.position.y - this.cameraHeight
                } else {
                    // Try to slide along walls by moving in separate X and Z directions
                    
                    // Try X movement only
                    const newPositionX = new THREE.Vector3(
                        newModelPosition.x,
                        this.model.position.y,
                        this.model.position.z
                    )
                    
                    if (!this.checkCollision(newPositionX)) {
                        // Can move in X direction
                        this.model.position.x = newPositionX.x
                        controlsObject.position.x = newPositionX.x + forwardOffset.x
                    }
                    
                    // Try Z movement only
                    const newPositionZ = new THREE.Vector3(
                        this.model.position.x,
                        this.model.position.y,
                        newModelPosition.z
                    )
                    
                    if (!this.checkCollision(newPositionZ)) {
                        // Can move in Z direction
                        this.model.position.z = newPositionZ.z
                        controlsObject.position.z = newPositionZ.z + forwardOffset.z
                    }
                }
            }
            
            // Update animation
            if (this.currentAction != play) {
                const toPlay = this.animationsMap.get(play)
                const current = this.animationsMap.get(this.currentAction)
                
                current.fadeOut(0.2)
                toPlay.reset().fadeIn(0.2).play()
                
                this.currentAction = play
            }
        } else {
            // If controls are not locked, position model under camera
            const controlsObject = this.controls.getObject()
            
            // Calculate forward offset
            const cameraDirection = new THREE.Vector3()
            this.camera.getWorldDirection(cameraDirection)
            cameraDirection.y = 0
            cameraDirection.normalize()
            
            const forwardOffset = cameraDirection.clone().multiplyScalar(this.cameraForwardOffset)
            
            // Position model considering forward offset
            this.model.position.x = controlsObject.position.x - forwardOffset.x
            this.model.position.z = controlsObject.position.z - forwardOffset.z
            this.model.position.y = controlsObject.position.y - this.cameraHeight
            
            // Make the character face the camera direction
            const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z)
            this.model.rotation.y = cameraAngle + Math.PI
        }
        
        // Update the animation mixer
        this.mixer.update(delta)
    }
}