# Among Us - The Skeld in 3D

A first-person 3D exploration of The Skeld map from Among Us, built with Three.js.

## Setup

1. Install dependencies:
```
npm install
```

2. **Important:** Place your Skeld map GLB file in this location:
```
src/models/skeld-map.glb
```

3. Start the development server:
```
npm start
```

## Controls

- **WASD** - Move around
- **Mouse** - Look around
- **Shift** - Run
- **ESC** - Release mouse cursor

## Map Configuration

If you need to adjust the map scale, position, or rotation, you can modify these values in `src/index.ts`:

```javascript
// Adjust map position and scale if needed
mapManager.setScale(0.1); // Adjust this value to change the map size
mapManager.setPosition(new THREE.Vector3(0, 0, 0)); // Set position offset
```

## Project Structure

- `src/index.ts` - Main application entry point
- `src/characterControls.ts` - First-person character controller
- `src/MapManager.ts` - Handles loading and managing the Skeld map
- `src/models/` - Directory for 3D models (place your skeld-map.glb here)

## Customization

- To change the starting position of the player, modify the `startPosition` vector in `index.ts`
- To adjust the camera height, modify the `cameraHeight` value in `characterControls.ts`
- To change lighting, modify the light settings in `index.ts`

## Notes

- The scale of the map is initially set to 0.1 - you may need to adjust this based on your specific GLB file
- First-time load may be slow as it's loading all map assets

![Screenshot](https://github.com/tamani-coding/threejs-character-controls-example/blob/main/screenshot01.png?raw=true)