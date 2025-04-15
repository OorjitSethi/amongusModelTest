import * as THREE from 'three'

export class PhysicsManager {
    private physicsWorld: any = null
    private tempTransform: any = null
    private isInitialized: boolean = false
    private rigidBodies: Map<THREE.Object3D, any> = new Map()
    private meshes: Map<any, THREE.Object3D> = new Map()
    private ammo: any = null
    
    // Ghost object for character collision detection
    private characterGhostObject: any = null
    private ghostTransform: any = null
    
    // Physics configuration
    private gravityConstant: number = -9.8
    private collisionMargin: number = 0.05
    
    constructor() {}
    
    /**
     * Initialize the physics world
     */
    public async init(): Promise<void> {
        try {
            console.log('Initializing Ammo.js physics...')
            
            // Check if Ammo.js is available globally
            if (typeof window !== 'undefined' && (window as any).Ammo) {
                this.ammo = (window as any).Ammo
                console.log('Using globally loaded Ammo.js')
            } else {
                // Load Ammo.js dynamically if not available
                console.log('Ammo.js not found globally, attempting to load dynamically')
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script')
                    script.src = 'https://cdn.jsdelivr.net/npm/ammo.js@0.0.10/ammo.js'
                    script.async = true
                    script.onload = () => {
                        this.ammo = (window as any).Ammo
                        console.log('Ammo.js loaded from CDN')
                        resolve()
                    }
                    script.onerror = (err) => {
                        console.error('Failed to load Ammo.js from CDN:', err)
                        reject(new Error('Failed to load Ammo.js from CDN'))
                    }
                    document.body.appendChild(script)
                })
            }
            
            // Configure collision configuration
            const collisionConfiguration = new this.ammo.btDefaultCollisionConfiguration()
            const dispatcher = new this.ammo.btCollisionDispatcher(collisionConfiguration)
            const broadphase = new this.ammo.btDbvtBroadphase()
            const solver = new this.ammo.btSequentialImpulseConstraintSolver()
            
            // Create physics world
            this.physicsWorld = new this.ammo.btDiscreteDynamicsWorld(
                dispatcher, 
                broadphase, 
                solver, 
                collisionConfiguration
            )
            
            // Set gravity
            this.physicsWorld.setGravity(new this.ammo.btVector3(0, this.gravityConstant, 0))
            
            // Create reusable temp transform
            this.tempTransform = new this.ammo.btTransform()
            
            // Create a transform for the ghost object
            this.ghostTransform = new this.ammo.btTransform()
            
            this.isInitialized = true
            console.log('Ammo.js physics initialized successfully')
        } catch (error) {
            console.error('Failed to initialize Ammo.js:', error)
        }
    }
    
    /**
     * Create a character collision ghost object
     * @param position Initial position
     * @param radius Character radius
     * @param height Character height
     */
    public createCharacterGhostObject(position: THREE.Vector3, radius: number, height: number): void {
        if (!this.isInitialized || !this.ammo) {
            console.warn('Physics not initialized, cannot create ghost object');
            return;
        }
        
        try {
            // Clean up existing ghost object if any
            if (this.characterGhostObject) {
                this.physicsWorld.removeCollisionObject(this.characterGhostObject);
                // Note: In a real implementation, you'd need to properly dispose Ammo.js objects
            }
            
            console.log(`Creating ghost object at position (${position.x}, ${position.y}, ${position.z}) with radius ${radius} and height ${height}`);
            
            // Create a capsule shape for the character
            // Note: The height parameter is the total height between the two sphere centers
            const capsuleHeight = Math.max(0.1, height - 2 * radius);
            const capsuleShape = new this.ammo.btCapsuleShape(radius, capsuleHeight);
            capsuleShape.setMargin(this.collisionMargin);
            
            // Set up the ghost object transform
            this.ghostTransform.setIdentity();
            this.ghostTransform.setOrigin(new this.ammo.btVector3(
                position.x, 
                position.y + height * 0.5, // Center the capsule vertically
                position.z
            ));
            
            // Create the ghost object
            this.characterGhostObject = new this.ammo.btPairCachingGhostObject();
            this.characterGhostObject.setCollisionShape(capsuleShape);
            this.characterGhostObject.setWorldTransform(this.ghostTransform);
            
            // Important: Don't set CF_NO_CONTACT_RESPONSE or it won't detect static objects
            // Just set as a sensor object that reports collisions but doesn't respond physically
            
            // Add to physics world - use specific collision groups
            // 2 = character group, -1 = collide with everything except floors (which are in group 1)
            this.physicsWorld.addCollisionObject(this.characterGhostObject, 2, -1);
            
            console.log(`Created character ghost object at (${position.x}, ${position.y}, ${position.z}) with radius ${radius} and height ${height}`);
            
            // Add a debug sphere to visualize the ghost object
            this.createGhostDebugVisualization(position, radius, height);
        } catch (error) {
            console.error('Failed to create character ghost object:', error);
        }
    }
    
    /**
     * Create a visual debug representation of the ghost object
     */
    private createGhostDebugVisualization(position: THREE.Vector3, radius: number, height: number): void {
        // This function requires access to the scene, so it's left as a no-op
        // In a real implementation, you'd add a wireframe capsule to visualize the ghost
        console.log("Ghost object debug visualization would be created here");
    }
    
    /**
     * Update the character ghost object position
     * @param position New position
     */
    public updateCharacterGhostPosition(position: THREE.Vector3, height: number): void {
        if (!this.isInitialized || !this.ammo || !this.characterGhostObject) {
            return;
        }
        
        try {
            // Update ghost transform
            this.ghostTransform.setIdentity();
            this.ghostTransform.setOrigin(new this.ammo.btVector3(
                position.x, 
                position.y + height * 0.5, // Center the capsule vertically
                position.z
            ));
            
            // Apply the new transform to the ghost object
            this.characterGhostObject.setWorldTransform(this.ghostTransform);
            
            // Log every 100 frames for debugging
            if (Math.random() < 0.01) {
                console.log(`Ghost position updated to (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
            }
        } catch (error) {
            console.error('Failed to update ghost object position:', error);
        }
    }
    
    /**
     * Check if the character ghost object is colliding with anything
     * @returns Boolean indicating if collision occurred and details if requested
     */
    public checkGhostCollision(): boolean {
        if (!this.isInitialized || !this.ammo || !this.characterGhostObject) {
            return false;
        }
        
        try {
            // Force the physics world to update overlapping pairs
            this.physicsWorld.updateAabbs();
            this.physicsWorld.computeOverlappingPairs();
            
            // Get the number of overlapping objects
            const numOverlaps = this.characterGhostObject.getNumOverlappingObjects();
            
            // Log collision check for debugging
            console.log(`Checking ghost collisions, found ${numOverlaps} overlapping objects`);
            
            if (numOverlaps > 0) {
                // Collect collision objects for debugging
                for (let i = 0; i < numOverlaps; i++) {
                    const overlappingObject = this.characterGhostObject.getOverlappingObject(i);
                    
                    // Skip floor objects (userIndex 999)
                    const userIndex = overlappingObject.getUserIndex();
                    if (userIndex === 999) {
                        console.log(`Ignoring floor collision with user index ${userIndex}`);
                        continue;
                    }
                    
                    // Get collision flags
                    const collisionFlags = overlappingObject.getCollisionFlags();
                    const isStatic = (collisionFlags & 1) !== 0; // CF_STATIC_OBJECT
                    const isKinematic = (collisionFlags & 2) !== 0; // CF_KINEMATIC_OBJECT
                    
                    // Find the corresponding mesh if possible
                    const mesh = this.meshes.get(overlappingObject);
                    const meshName = mesh ? mesh.name : "unknown";
                    
                    console.log(`Collision with object ${i}: ${meshName} (static: ${isStatic}, kinematic: ${isKinematic}, flags: ${collisionFlags})`);
                    
                    // We found a valid collision
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error checking ghost collision:', error);
            return false;
        }
    }
    
    /**
     * Create a static rigid body for a mesh
     * @param mesh The mesh to create a rigid body for
     * @param options Optional settings including position override
     */
    public createStaticRigidBody(mesh: THREE.Mesh, options?: { 
        position?: THREE.Vector3;
        mass?: number;
        restitution?: number;
        isFloor?: boolean;
    }): void {
        if (!this.isInitialized || !this.physicsWorld || !this.ammo) {
            console.warn('Physics not initialized yet')
            return
        }
        
        try {
            // Get mesh position or use custom position if provided
            const position = options?.position || mesh.position
            const quaternion = mesh.quaternion
            
            // Create collision shape based on geometry type
            let shape: any
            
            if (mesh.geometry instanceof THREE.BoxGeometry) {
                // For box geometry, use box shape
                const dimensions = new THREE.Vector3()
                mesh.geometry.computeBoundingBox()
                mesh.geometry.boundingBox?.getSize(dimensions)
                
                // Half extents are half the full dimensions
                const halfExtents = new this.ammo.btVector3(
                    dimensions.x * 0.5 * mesh.scale.x,
                    dimensions.y * 0.5 * mesh.scale.y,
                    dimensions.z * 0.5 * mesh.scale.z
                )
                
                shape = new this.ammo.btBoxShape(halfExtents)
            } else if (mesh.geometry instanceof THREE.SphereGeometry) {
                // For sphere geometry, use sphere shape
                const radius = mesh.geometry.parameters.radius * Math.max(
                    mesh.scale.x,
                    mesh.scale.y,
                    mesh.scale.z
                )
                
                shape = new this.ammo.btSphereShape(radius)
            } else {
                // For other geometries, use convex hull or bbox as fallback
                // This is a simplified approach
                const bbox = new THREE.Box3().setFromObject(mesh)
                const dimensions = new THREE.Vector3()
                bbox.getSize(dimensions)
                
                const halfExtents = new this.ammo.btVector3(
                    dimensions.x * 0.5,
                    dimensions.y * 0.5,
                    dimensions.z * 0.5
                )
                
                shape = new this.ammo.btBoxShape(halfExtents)
            }
            
            // Set collision margin
            shape.setMargin(this.collisionMargin)
            
            // Create transform
            const transform = new this.ammo.btTransform()
            transform.setIdentity()
            transform.setOrigin(new this.ammo.btVector3(position.x, position.y, position.z))
            transform.setRotation(new this.ammo.btQuaternion(
                quaternion.x,
                quaternion.y,
                quaternion.z,
                quaternion.w
            ))
            
            // Create motion state
            const motionState = new this.ammo.btDefaultMotionState(transform)
            
            // Mass of 0 means static rigid body
            const mass = options?.mass ?? 0
            const localInertia = new this.ammo.btVector3(0, 0, 0)
            
            // Create rigid body
            const rbInfo = new this.ammo.btRigidBodyConstructionInfo(
                mass,
                motionState,
                shape,
                localInertia
            )
            
            const rigidBody = new this.ammo.btRigidBody(rbInfo)
            
            // Set restitution (bounciness) if provided
            if (options?.restitution !== undefined) {
                rigidBody.setRestitution(options.restitution);
            }
            
            // Mark floor objects with a special user index
            if (options?.isFloor || mesh.name.toLowerCase().includes('floor')) {
                rigidBody.setUserIndex(999); // Special index for floors
            }
            
            // Add to physics world
            this.physicsWorld.addRigidBody(rigidBody)
            
            // Store reference for later use
            this.rigidBodies.set(mesh, rigidBody)
            this.meshes.set(rigidBody, mesh)
            
            console.log(`Created static rigid body for mesh: ${mesh.name || 'unnamed'} at position (${position.x}, ${position.y}, ${position.z})`)
        } catch (error) {
            console.error('Failed to create static rigid body:', error)
        }
    }
    
    /**
     * Create a dynamic rigid body for a mesh
     */
    public createDynamicRigidBody(mesh: THREE.Mesh, mass: number = 1): void {
        if (!this.isInitialized || !this.physicsWorld || !this.ammo) {
            console.warn('Physics not initialized yet')
            return
        }
        
        try {
            // Get mesh position and rotation
            const position = mesh.position
            const quaternion = mesh.quaternion
            
            // Create collision shape based on geometry type
            let shape: any
            
            if (mesh.geometry instanceof THREE.BoxGeometry) {
                // For box geometry, use box shape
                const dimensions = new THREE.Vector3()
                mesh.geometry.computeBoundingBox()
                mesh.geometry.boundingBox?.getSize(dimensions)
                
                // Half extents are half the full dimensions
                const halfExtents = new this.ammo.btVector3(
                    dimensions.x * 0.5 * mesh.scale.x,
                    dimensions.y * 0.5 * mesh.scale.y,
                    dimensions.z * 0.5 * mesh.scale.z
                )
                
                shape = new this.ammo.btBoxShape(halfExtents)
            } else if (mesh.geometry instanceof THREE.SphereGeometry) {
                // For sphere geometry, use sphere shape
                const radius = mesh.geometry.parameters.radius * Math.max(
                    mesh.scale.x,
                    mesh.scale.y,
                    mesh.scale.z
                )
                
                shape = new this.ammo.btSphereShape(radius)
            } else {
                // For other geometries, use convex hull or bbox as fallback
                const bbox = new THREE.Box3().setFromObject(mesh)
                const dimensions = new THREE.Vector3()
                bbox.getSize(dimensions)
                
                const halfExtents = new this.ammo.btVector3(
                    dimensions.x * 0.5,
                    dimensions.y * 0.5,
                    dimensions.z * 0.5
                )
                
                shape = new this.ammo.btBoxShape(halfExtents)
            }
            
            // Set collision margin
            shape.setMargin(this.collisionMargin)
            
            // Create transform
            const transform = new this.ammo.btTransform()
            transform.setIdentity()
            transform.setOrigin(new this.ammo.btVector3(position.x, position.y, position.z))
            transform.setRotation(new this.ammo.btQuaternion(
                quaternion.x,
                quaternion.y,
                quaternion.z,
                quaternion.w
            ))
            
            // Create motion state
            const motionState = new this.ammo.btDefaultMotionState(transform)
            
            // Setup mass and inertia
            const localInertia = new this.ammo.btVector3(0, 0, 0)
            
            if (mass > 0) {
                shape.calculateLocalInertia(mass, localInertia)
            }
            
            // Create rigid body
            const rbInfo = new this.ammo.btRigidBodyConstructionInfo(
                mass,
                motionState,
                shape,
                localInertia
            )
            
            const rigidBody = new this.ammo.btRigidBody(rbInfo)
            
            // Add to physics world
            this.physicsWorld.addRigidBody(rigidBody)
            
            // Store reference for later use
            this.rigidBodies.set(mesh, rigidBody)
            this.meshes.set(rigidBody, mesh)
            
            console.log(`Created dynamic rigid body for mesh: ${mesh.name || 'unnamed'}`)
        } catch (error) {
            console.error('Failed to create dynamic rigid body:', error)
        }
    }
    
    /**
     * Process collisions for character controller using the ghost object
     */
    public checkCharacterCollision(
        position: THREE.Vector3, 
        radius: number = 0.5, 
        height: number = 2
    ): boolean {
        // Update the ghost object position if it exists
        if (this.characterGhostObject) {
            this.updateCharacterGhostPosition(position, height);
            
            // Always output position for debugging
            console.log(`Checking collision at position (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
            
            return this.checkGhostCollision();
        }
        
        // If no ghost object, create one first
        console.log(`Creating new ghost object for collision detection`);
        this.createCharacterGhostObject(position, radius, height);
        
        // Update position and check collision
        this.updateCharacterGhostPosition(position, height);
        return this.checkGhostCollision();
    }
    
    /**
     * Update physics simulation
     */
    public update(deltaTime: number): void {
        if (!this.isInitialized || !this.physicsWorld || !this.tempTransform) {
            return
        }
        
        try {
            // Step simulation with fixed timestep (1/60 second) for stability
            // Using a maximum of 10 substeps to catch up if frame rate drops
            const fixedTimeStep = 1.0 / 60.0;
            const maxSubSteps = 10;
            
            // Log physics step occasionally for debugging
            if (Math.random() < 0.01) {
                console.log(`Stepping physics simulation: deltaTime=${deltaTime}, fixedTimeStep=${fixedTimeStep}`);
            }
            
            this.physicsWorld.stepSimulation(deltaTime, maxSubSteps, fixedTimeStep);
            
            // Force collision world update after stepping
            this.physicsWorld.updateAabbs();
            this.physicsWorld.computeOverlappingPairs();
            
            // Update dynamic objects
            this.rigidBodies.forEach((body, mesh) => {
                if (body.isActive()) {
                    const motionState = body.getMotionState()
                    
                    if (motionState) {
                        motionState.getWorldTransform(this.tempTransform)
                        
                        const position = this.tempTransform.getOrigin()
                        const rotation = this.tempTransform.getRotation()
                        
                        // Update Three.js mesh position and rotation
                        mesh.position.set(position.x(), position.y(), position.z())
                        mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w())
                    }
                }
            })
        } catch (error) {
            console.error('Error in physics update:', error);
        }
    }
    
    /**
     * Check if physics is initialized
     */
    public isPhysicsInitialized(): boolean {
        return this.isInitialized
    }
    
    /**
     * Create collision objects from meshes
     */
    public createCollisionObjects(meshes: THREE.Mesh[]): void {
        meshes.forEach(mesh => {
            const isFloor = mesh.name.toLowerCase().includes('floor');
            this.createStaticRigidBody(mesh, { isFloor });
        })
    }
    
    /**
     * Mark a rigid body as a floor
     */
    public markAsFloor(rigidBody: any): void {
        if (rigidBody) {
            rigidBody.setUserIndex(999); // Special index for floors
            console.log("Marked rigid body as floor");
        }
    }
} 