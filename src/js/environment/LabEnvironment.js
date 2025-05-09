import { GAME_HEIGHT, GAME_WIDTH } from '../../config.js';

export class LabEnvironment { 
  constructor(scene, options = {}) {
    this.scene = scene;
    this.floorContainer = null;
    this.bloodContainer = null;
    this.options = options;
  }

  init() {
    // Create a container for blood splashes to keep them above floor but below shadows and entities
    this.bloodContainer = this.scene.add.container(0, 0);
    this.bloodContainer.setDepth(0.5); // Above floor (0), below shadows (1) and entities (10)
    
    // Create the floor based on scene type
    this.createFloor();
    
    // Listen for updates to environment (like orientation changes)
    this.scene.events.on('updateEnvironment', this.updateEnvironment, this);
    this.scene.events.on('orientationChange', this.updateEnvironment, this);
  }
  
  // Handle updates to environment (like orientation changes)
  updateEnvironment({ isPortrait }) {
    // Clean up old floor tiles
    if (this.floorContainer) {
      this.floorContainer.removeAll(true);
    }
    
    // Recreate floor with updated dimensions
    this.createFloor();
  }

  // Create the tiled floor background based on options
  createFloor() {
    // Always use concrete floor for tutorial, lab floor for other scenes
    const floorTexture = this.scene.constructor.name === 'TutorialScene' ? 'tutorial_floor' : 'lab_floor';
    
    // Tutorial uses larger concrete tiles, lab uses smaller tiles
    const tileSize = floorTexture === 'tutorial_floor' ? 128 : 64;
    
    // Get actual camera dimensions (may have changed due to orientation)
    const gameWidth = this.scene.cameras.main.width;
    const gameHeight = this.scene.cameras.main.height;
    
    // Calculate extended area based on the world bounds extension (50%)
    const worldExtension = 0.5; // Match the value in setupCamera
    const extendedWidth = gameWidth * (1 + worldExtension);
    const extendedHeight = gameHeight * (1 + worldExtension);
    
    // Calculate how many tiles we need to cover the extended area
    const tilesNeededX = Math.ceil(extendedWidth / tileSize) + 2; // +2 for safety
    const tilesNeededY = Math.ceil(extendedHeight / tileSize) + 2; // +2 for safety
    
    // Create a container to hold all the floor tiles
    this.floorContainer = this.scene.add.container(0, 0);
    this.floorContainer.setDepth(0); // Floor is at depth 0, shadows at 1, entities higher
    
    // Calculate offset to center the tiles and extend beyond edges
    const offsetX = -(extendedWidth - gameWidth) / 2 - tileSize;
    const offsetY = -(extendedHeight - gameHeight) / 2 - tileSize;
    
    // Place the floor tiles in a grid, covering the whole visible area plus padding
    for (let x = 0; x < tilesNeededX; x++) {
      for (let y = 0; y < tilesNeededY; y++) {
        const tile = this.scene.add.image(offsetX + x * tileSize, offsetY + y * tileSize, floorTexture);
        tile.setOrigin(0, 0); // Set origin to top-left corner
        this.floorContainer.add(tile);
      }
    }
    
    // If it's the tutorial scene and we're using the tutorial floor, add some training area elements
    if (this.scene.constructor.name === 'TutorialScene') {
      // Get current dimensions
      const gameWidth = this.scene.cameras.main.width;
      const gameHeight = this.scene.cameras.main.height;
      
      // Define the hazard line position first (we'll use this to position the text)
      const lineY = gameHeight / 3;
      
      // Simple red "TRAINING AREA" text with responsive font size
      // Calculate responsive font size based on screen width
      const fontSize = Math.max(48, Math.floor(gameWidth * 0.1)); // 10% of screen width, minimum 48px
      
      const centerText = this.scene.add.text(
        gameWidth / 2,
        lineY - Math.floor(gameHeight * 0.05), // Position above the hazard line using % of height
        'TRAINING AREA', 
        {
          fontFamily: 'Arial',
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: '#ff0000',
          align: 'center'
        }
      );
      centerText.setOrigin(0.5, 0.5);
      centerText.setAlpha(0.4); // Slightly more visible
      centerText.setDepth(0.5); // Just above the floor but below everything else
      
      // Add to the floor container
      this.floorContainer.add(centerText);
      
      // Add a single worn-out horizontal hazard line across the screen about 1/3 of the way down
      const lineGraphics = this.scene.add.graphics();
      lineGraphics.setDepth(0.3); // Above the floor, below most elements
      
      // Create hazard line with subtle worn-out effect (no chips)
      const segmentLength = 25; // Length of each colored segment
      const lineWidth = 10; // Width of the hazard line
      const totalSegments = Math.ceil(gameWidth / segmentLength) + 4; // Extra segments for wider coverage
      
      for (let i = -2; i < totalSegments - 2; i++) { // Start 2 segments from the left edge for padding
        // Alternate between yellow and black
        const color = i % 2 === 0 ? 0xffdd00 : 0x000000;
        
        // Add very subtle variation to segments to make them look slightly worn
        const wornSegmentLength = segmentLength * Phaser.Math.FloatBetween(0.95, 1);
        const segmentGap = segmentLength - wornSegmentLength;
        
        // Vary the alpha slightly for a subtle worn effect
        const alpha = Phaser.Math.FloatBetween(0.9, 1);
        
        // Apply the subtle worn effect
        lineGraphics.fillStyle(color, alpha);
        
        // Draw segment with minimal variation
        lineGraphics.fillRect(
          i * segmentLength + segmentGap/2, // Add a tiny gap
          lineY - lineWidth/2, // No vertical variation
          wornSegmentLength,
          lineWidth
        );
      }
      
      this.floorContainer.add(lineGraphics);
    }
  }

  getBloodContainer() {
    return this.bloodContainer;
  }
}