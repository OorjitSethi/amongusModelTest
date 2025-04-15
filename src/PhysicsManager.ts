import * as THREE from 'three'

export class PhysicsManager {
    private physicsWorld: any = null
    private tempTransform: any = null
    private isInitialized: boolean = false
    private rigidBodies: Map<THREE.Object3D, any> = new Map()
    private meshes: Map<any, THREE.Object3D> = new Map()
    private ammo: any = null
    
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
            
            this.isInitialized = true
            console.log('Ammo.js physics initialized successfully')
        } catch (error) {
            console.error('Failed to initialize Ammo.js:', error)
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
     * Process collisions for character controller
     */
    public checkCharacterCollision(
        position: THREE.Vector3, 
        radius: number = 0.5, 
        height: number = 2
    ): boolean {
        if (!this.isInitialized || !this.physicsWorld || !this.ammo) {
            return false
        }
        
        try {
            // Use a simple ray-based approach instead of ghost object
            // Check for collisions using ray casting from multiple directions
            
            // Create rays in 8 directions around the character (like a compass)
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
            
            // Create a sphere for collision detection
            const sphere = new THREE.Sphere(position.clone(), radius);
            
            // Check collisions with all static bodies in the scene
            // Convert Map to Array for iteration to avoid TypeScript issues
            const rigidBodyEntries = Array.from(this.rigidBodies.entries());
            for (const [object, _] of rigidBodyEntries) {
                if (object instanceof THREE.Mesh) {
                    // Skip meshes that are too far away (optimization)
                    if (object.position.distanceTo(position) > radius * 5) {
                        continue;
                    }
                    
                    // Compute bounding box if not already computed
                    if (!object.geometry.boundingBox) {
                        object.geometry.computeBoundingBox();
                    }
                    
                    // Get the object's bounding box in world space
                    const boundingBox = object.geometry.boundingBox.clone();
                    object.updateMatrixWorld(true);
                    boundingBox.applyMatrix4(object.matrixWorld);
                    
                    // Get the closest point on the box to the sphere center
                    const closestPoint = new THREE.Vector3();
                    boundingBox.clampPoint(position, closestPoint);
                    
                    // If the closest point is within the sphere radius, we have a collision
                    const distance = position.distanceTo(closestPoint);
                    if (distance < radius) {
                        console.log(`Collision detected with object: ${object.name || 'unnamed'}`);
                        return true;
                    }
                }
            }
            
            // No collision detected
            return false;
        } catch (error) {
            console.error('Error checking character collision:', error)
            return false
        }
    }
    
    /**
     * Update physics simulation
     */
    public update(deltaTime: number): void {
        if (!this.isInitialized || !this.physicsWorld || !this.tempTransform) {
            return
        }
        
        // Step simulation
        this.physicsWorld.stepSimulation(deltaTime, 10)
        
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
            this.createStaticRigidBody(mesh)
        })
    }
} 