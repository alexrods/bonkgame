// Creates the bullet texture, blood textures, shadow, and lab floor texture.
export function createBulletTexture(scene) {
  // Create a simple shadow texture for our multi-reflector setup
  const shadowGraphics = scene.add.graphics();
  // Lower opacity black for the shadow (50% darker)
  shadowGraphics.fillStyle(0x000000, 0.6);
  
  // Simple oval shadow - we'll create 4 of these in different positions
  shadowGraphics.fillEllipse(50, 50, 70, 28);
  
  // Generate texture with plenty of padding
  shadowGraphics.generateTexture('shadow', 100, 100);
  
  console.log("Simple shadow texture created for multi-reflector setup");
  
  // Metallic bullet texture
  const bulletGraphics = scene.add.graphics();
  
  // Silver base
  bulletGraphics.fillStyle(0xcccccc)
    .fillCircle(4, 4, 4);
  
  // Metallic shine
  bulletGraphics.fillStyle(0xffffff)
    .fillCircle(3, 3, 1.5);
  
  // Darker edge for 3D look
  bulletGraphics.lineStyle(1, 0x999999)
    .strokeCircle(4, 4, 4);
    
  bulletGraphics.generateTexture('bullet', 9, 9);
    
  // Blood particle texture - small droplet
  scene.add.graphics()
    .fillStyle(0x990000)
    .fillCircle(4, 4, 4)
    .generateTexture('blood_particle', 8, 8);
    
  // Generic particle for effects (white, can be tinted)
  scene.add.graphics()
    .fillStyle(0xffffff)
    .fillCircle(4, 4, 4)
    .generateTexture('particle', 8, 8);
  
  // Blood splash texture - larger blood pool
  const bloodGraphics = scene.add.graphics();
  bloodGraphics.fillStyle(0xaa0000, 1);
  bloodGraphics.fillCircle(16, 16, 16);
  // Add some irregular shapes to make it look more like a splatter
  bloodGraphics.fillStyle(0x880000, 1);
  bloodGraphics.fillCircle(10, 10, 8);
  bloodGraphics.fillCircle(22, 12, 10);
  bloodGraphics.fillCircle(12, 22, 9);
  bloodGraphics.fillCircle(24, 22, 11);
  bloodGraphics.generateTexture('blood_splash', 32, 32);
  
  // Lab floor texture (tiled pattern)
  const labFloorGraphics = scene.add.graphics();
  
  // Base tile - light gray with slight blue tint
  labFloorGraphics.fillStyle(0xb8c0c8);
  labFloorGraphics.fillRect(0, 0, 64, 64);
  
  // Tile grout lines
  labFloorGraphics.lineStyle(1, 0x8090a0);
  labFloorGraphics.strokeRect(0, 0, 64, 64);
  labFloorGraphics.lineBetween(32, 0, 32, 64);
  labFloorGraphics.lineBetween(0, 32, 64, 32);
  
  // Subtle variations and spots
  labFloorGraphics.fillStyle(0xa8b0b8);
  labFloorGraphics.fillRect(3, 3, 26, 26);
  labFloorGraphics.fillRect(35, 35, 26, 26);
  
  labFloorGraphics.fillStyle(0xc8d0d8);
  labFloorGraphics.fillRect(35, 3, 26, 26);
  labFloorGraphics.fillRect(3, 35, 26, 26);
  
  // Small details for realism
  for (let i = 0; i < 8; i++) {
    const x = Phaser.Math.Between(4, 60);
    const y = Phaser.Math.Between(4, 60);
    const size = Phaser.Math.Between(1, 3);
    const color = Phaser.Math.RND.pick([0x909090, 0x707890, 0xd0d8e0]);
    labFloorGraphics.fillStyle(color);
    labFloorGraphics.fillRect(x, y, size, size);
  }
  
  labFloorGraphics.generateTexture('lab_floor', 64, 64);
  
  // Tutorial floor texture (concrete with yellow markings)
  // This makes a larger 128x128 tile to accommodate the text
  const tutorialFloorGraphics = scene.add.graphics();
  
  // Base concrete color - slightly darker gray
  tutorialFloorGraphics.fillStyle(0x888888);
  tutorialFloorGraphics.fillRect(0, 0, 128, 128);
  
  // Add concrete texture with speckles
  for (let i = 0; i < 150; i++) {
    const x = Phaser.Math.Between(0, 128);
    const y = Phaser.Math.Between(0, 128);
    const size = Phaser.Math.Between(1, 3);
    const color = Phaser.Math.RND.pick([0x777777, 0x999999, 0xaaaaaa]);
    tutorialFloorGraphics.fillStyle(color, 0.6);
    tutorialFloorGraphics.fillRect(x, y, size, size);
  }
  
  // Add small cracks for realism
  tutorialFloorGraphics.lineStyle(1, 0x777777, 0.6);
  // Random cracks
  for (let i = 0; i < 5; i++) {
    const startX = Phaser.Math.Between(10, 118);
    const startY = Phaser.Math.Between(10, 118);
    const endX = startX + Phaser.Math.Between(-20, 20);
    const endY = startY + Phaser.Math.Between(-20, 20);
    tutorialFloorGraphics.lineBetween(startX, startY, endX, endY);
  }
  
  // No hazard lines as requested
  // Adding a few more concrete details instead
  
  // Add a few more speckles for texture variation
  for (let i = 0; i < 50; i++) {
    const x = Phaser.Math.Between(0, 128);
    const y = Phaser.Math.Between(0, 128);
    const size = Phaser.Math.Between(1, 2);
    const color = Phaser.Math.RND.pick([0x777777, 0x999999, 0xaaaaaa]);
    tutorialFloorGraphics.fillStyle(color, 0.5);
    tutorialFloorGraphics.fillRect(x, y, size, size);
  }
  
  // Add a few more cracks for realism
  tutorialFloorGraphics.lineStyle(1, 0x777777, 0.4);
  for (let i = 0; i < 3; i++) {
    const startX = Phaser.Math.Between(10, 118);
    const startY = Phaser.Math.Between(10, 118);
    const endX = startX + Phaser.Math.Between(-15, 15);
    const endY = startY + Phaser.Math.Between(-15, 15);
    tutorialFloorGraphics.lineBetween(startX, startY, endX, endY);
  }
  
  // Add "TRAINING AREA" text in the center of the tile
  const textStyle = {
    fontFamily: 'Arial',
    fontSize: '16px',
    fontStyle: 'bold',
    color: '#ff0000',
    align: 'center'
  };
  
  // Create a temporary text object to use as texture
  const tempText = scene.add.text(0, 0, 'TRAINING AREA', textStyle);
  tempText.setVisible(false);
  
  // Generate a texture from the text
  tempText.setPosition(64 - tempText.width / 2, 64 - tempText.height / 2);
  
  // Generate the texture
  tutorialFloorGraphics.generateTexture('tutorial_floor', 128, 128);
  tempText.destroy();
}