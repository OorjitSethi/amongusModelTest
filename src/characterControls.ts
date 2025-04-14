import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { A, D, DIRECTIONS, S, W } from './utils'

export class CharacterControls {
    model: THREE.Group
    mixer: THREE.AnimationMixer
    animationsMap: Map<string, THREE.AnimationAction> = new Map()
    camera: THREE.Camera
    controls: PointerLockControls

    // state
    toggleRun: boolean = true
    currentAction: string
    
    // Movement speeds
    walkSpeed: number = 2.5
    runSpeed: number = 5.0
    
    // Camera settings
    cameraHeight: number = 1.8 // Eye height for first person
    
    // Movement vectors
    moveDirection = new THREE.Vector3()
    modelPosition = new THREE.Vector3()

    constructor(
        model: THREE.Group,
        mixer: THREE.AnimationMixer,
        animationsMap: Map<string, THREE.AnimationAction>,
        camera: THREE.Camera,
        controls: PointerLockControls,
        currentAction: string
    ) {
        this.model = model
        this.mixer = mixer
        this.animationsMap = animationsMap
        this.currentAction = currentAction
        this.camera = camera
        this.controls = controls
        
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
        
        // Store initial position
        this.modelPosition.copy(this.model.position)
        
        // Initialize character position and camera
        this.updateControlsPosition()
    }
    
    private updateControlsPosition() {
        // Position the controls object at character position with eye height
        if (this.controls && this.model) {
            const controlsObject = this.controls.getObject()
            controlsObject.position.x = this.model.position.x
            controlsObject.position.z = this.model.position.z
            controlsObject.position.y = this.model.position.y + this.cameraHeight
        }
    }

    public switchRunToggle() {
        this.toggleRun = !this.toggleRun
    }

    public update(delta: number, keysPressed: any) {
        // Only handle movement if controls are locked (game is active)
        if (this.controls.isLocked) {
            // Calculate movement direction relative to camera view
            this.moveDirection.set(0, 0, 0)
            
            if (keysPressed[W]) this.moveDirection.z -= 1
            if (keysPressed[S]) this.moveDirection.z += 1
            if (keysPressed[A]) this.moveDirection.x -= 1
            if (keysPressed[D]) this.moveDirection.x += 1
            
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
                
                // Move the controls/camera
                const controlsObject = this.controls.getObject()
                controlsObject.position.add(moveVector)
                
                // Move the model to follow the camera (at foot level)
                this.model.position.x = controlsObject.position.x
                this.model.position.z = controlsObject.position.z
                this.model.position.y = controlsObject.position.y - this.cameraHeight
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
            this.model.position.x = controlsObject.position.x
            this.model.position.z = controlsObject.position.z 
            this.model.position.y = controlsObject.position.y - this.cameraHeight
            
            // Make the character face the camera direction even when not moving
            const cameraDirection = new THREE.Vector3()
            this.camera.getWorldDirection(cameraDirection)
            cameraDirection.y = 0
            cameraDirection.normalize()
            const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z)
            this.model.rotation.y = cameraAngle + Math.PI
        }
        
        // Update the animation mixer
        this.mixer.update(delta)
    }
}