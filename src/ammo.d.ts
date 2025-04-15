// Define types for Ammo.js when loaded from CDN
interface Window {
    Ammo: any;
}

declare namespace Ammo {
    class btVector3 {
        constructor(x: number, y: number, z: number);
        x(): number;
        y(): number;
        z(): number;
    }
    
    class btQuaternion {
        constructor(x: number, y: number, z: number, w: number);
        x(): number;
        y(): number;
        z(): number;
        w(): number;
    }
    
    class btDefaultCollisionConfiguration {
        constructor();
    }
    
    class btCollisionDispatcher {
        constructor(configuration: btDefaultCollisionConfiguration);
    }
    
    class btDbvtBroadphase {
        constructor();
    }
    
    class btSequentialImpulseConstraintSolver {
        constructor();
    }
    
    class btDiscreteDynamicsWorld {
        constructor(
            dispatcher: btCollisionDispatcher,
            broadphase: btDbvtBroadphase,
            solver: btSequentialImpulseConstraintSolver,
            configuration: btDefaultCollisionConfiguration
        );
        setGravity(vector: btVector3): void;
        addRigidBody(body: btRigidBody): void;
        removeRigidBody(body: btRigidBody): void;
        addCollisionObject(object: btPairCachingGhostObject, group: number, mask: number): void;
        removeCollisionObject(object: btPairCachingGhostObject): void;
        stepSimulation(timeStep: number, maxSubSteps?: number): void;
    }
    
    class btTransform {
        constructor();
        setIdentity(): void;
        setOrigin(vector: btVector3): void;
        setRotation(quaternion: btQuaternion): void;
        getOrigin(): btVector3;
        getRotation(): btQuaternion;
    }
    
    class btDefaultMotionState {
        constructor(transform: btTransform);
        getWorldTransform(transform: btTransform): void;
    }
    
    class btCollisionShape {
        setMargin(margin: number): void;
        calculateLocalInertia(mass: number, inertia: btVector3): void;
    }
    
    class btBoxShape extends btCollisionShape {
        constructor(halfExtents: btVector3);
    }
    
    class btSphereShape extends btCollisionShape {
        constructor(radius: number);
    }
    
    class btCapsuleShape extends btCollisionShape {
        constructor(radius: number, height: number);
    }
    
    class btRigidBodyConstructionInfo {
        constructor(mass: number, motionState: btDefaultMotionState, shape: btCollisionShape, localInertia: btVector3);
    }
    
    class btRigidBody {
        constructor(info: btRigidBodyConstructionInfo);
        setCollisionFlags(flags: number): void;
        getMotionState(): btDefaultMotionState;
        isActive(): boolean;
    }
    
    class btPairCachingGhostObject {
        constructor();
        setWorldTransform(transform: btTransform): void;
        setCollisionShape(shape: btCollisionShape): void;
        setCollisionFlags(flags: number): void;
        getNumOverlappingObjects(): number;
    }
} 