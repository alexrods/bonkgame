import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

export class EnemySpawner {
  constructor(scene, enemySounds, shadowOffsets) {
    this.scene = scene;
    this.enemySounds = enemySounds;
    this.shadowOffsets = shadowOffsets;
    this.enemies = null;
    this.enemySpawnTimer = null;
    this.currentWave = 1;
    this.waveInterval = 15000; // New wave every 15 seconds
    this.waveTimer = null;
    
    // Flag to track if spawning is paused
    this.spawnPaused = false;
    
    // Enemy types with their properties
    this.enemyTypes = {
      standard: { health: 1, tint: 0xFFFFFF, probability: 1.0, useColorAssets: false },
      blue: { health: 2, tint: 0x00A8FF, probability: 0, useColorAssets: true },
      green: { health: 3, tint: 0x00FF8A, probability: 0, useColorAssets: true },
      gold: { health: 5, tint: 0xFFD700, probability: 0, useColorAssets: true },
      blueElite: { health: 6, tint: 0x0066FF, probability: 0, useColorAssets: true }, // Deeper blue for Elite
      greenElite: { health: 9, tint: 0x00BB55, probability: 0, useColorAssets: true }, // Deeper green for Elite
      goldElite: { health: 15, tint: 0xFFAA00, probability: 0, useColorAssets: true }  // More orange-gold for Elite
    };
    
    // Define spawn patterns once to avoid recreation
    this.spawnPatterns = [
      this.randomSpawn.bind(this),
      this.cornerRushSpawn.bind(this),
      this.sideSwarmSpawn.bind(this),
      this.encircleSpawn.bind(this),
      this.blueWaveSpawn.bind(this),
      this.greenWaveSpawn.bind(this),
      this.goldWaveSpawn.bind(this),
      this.mixedEliteSpawn.bind(this),
      this.eliteBlueWaveSpawn.bind(this),
      this.eliteGreenWaveSpawn.bind(this),
      this.eliteGoldWaveSpawn.bind(this)
    ];
    
    // Offset to ensure enemies spawn outside of camera view
    // Minimum attack distance from EnemyBehavior is 20, so we use at least 2x that value
    // with additional buffer to ensure enemies don't spawn on top of the player
    this.SPAWN_OFFSET = 250;
    
    // Pooling for shadow sprites
    this.shadowPool = [];
  }

  init() {
    // Create group for enemies
    this.enemies = this.scene.physics.add.group({
      // Set defaults for all enemies in the group
      collideWorldBounds: true,
      bounceX: 0,
      bounceY: 0,
      dragX: 0,
      dragY: 0
    });
  }

  startSpawning() {
    // Delay the first spawn slightly
    this.scene.time.delayedCall(500, () => {
      // Adjust spawn rate based on portrait or landscape mode
      const isPortrait = GAME_HEIGHT > GAME_WIDTH;
      const spawnDelay = isPortrait ? 1500 : 1000; // Slower spawn rate in portrait mode
      
      // Basic enemy spawning timer
      this.enemySpawnTimer = this.scene.time.addEvent({
        delay: spawnDelay,
        callback: this.randomSpawn,
        callbackScope: this,
        loop: true
      });
      
      // Wave timer for special spawn patterns
      this.waveTimer = this.scene.time.addEvent({
        delay: this.waveInterval,
        callback: this.triggerWave,
        callbackScope: this,
        loop: true
      });
      
      // Gradually introduce stronger enemies as waves progress
      this.setupEnemyProgression();
      
      // Add listeners for UI interaction states to pause spawning
      this.setupEventListeners();
    });
  }
  
  setupEnemyProgression() {
    // After 30 seconds, introduce blue enemies
    this.scene.time.addEvent({
      delay: 30000,
      callback: () => {
        this.enemyTypes.standard.probability = 0.85;
        this.enemyTypes.blue.probability = 0.15;
      },
      callbackScope: this
    });
    
    // After 60 seconds, introduce green enemies
    this.scene.time.addEvent({
      delay: 60000,
      callback: () => {
        this.enemyTypes.standard.probability = 0.75;
        this.enemyTypes.blue.probability = 0.15;
        this.enemyTypes.green.probability = 0.1;
      },
      callbackScope: this
    });
    
    // After 2 minutes, introduce gold enemies
    this.scene.time.addEvent({
      delay: 120000,
      callback: () => {
        this.enemyTypes.standard.probability = 0.65;
        this.enemyTypes.blue.probability = 0.2;
        this.enemyTypes.green.probability = 0.1;
        this.enemyTypes.gold.probability = 0.05;
      },
      callbackScope: this
    });
    
    // After 3 minutes, introduce blue elite enemies
    this.scene.time.addEvent({
      delay: 180000,
      callback: () => {
        this.enemyTypes.standard.probability = 0.6;
        this.enemyTypes.blue.probability = 0.15;
        this.enemyTypes.green.probability = 0.1;
        this.enemyTypes.gold.probability = 0.05;
        this.enemyTypes.blueElite.probability = 0.1;
      },
      callbackScope: this
    });
    
    // After 4 minutes, introduce green elite enemies
    this.scene.time.addEvent({
      delay: 240000,
      callback: () => {
        this.enemyTypes.standard.probability = 0.55;
        this.enemyTypes.blue.probability = 0.13;
        this.enemyTypes.green.probability = 0.1;
        this.enemyTypes.gold.probability = 0.05;
        this.enemyTypes.blueElite.probability = 0.12;
        this.enemyTypes.greenElite.probability = 0.05;
      },
      callbackScope: this
    });
    
    // After 5 minutes, introduce gold elite enemies
    this.scene.time.addEvent({
      delay: 300000,
      callback: () => {
        this.enemyTypes.standard.probability = 0.5;
        this.enemyTypes.blue.probability = 0.12;
        this.enemyTypes.green.probability = 0.1;
        this.enemyTypes.gold.probability = 0.05;
        this.enemyTypes.blueElite.probability = 0.13;
        this.enemyTypes.greenElite.probability = 0.07;
        this.enemyTypes.goldElite.probability = 0.03;
      },
      callbackScope: this
    });
  }
  
  setupEventListeners() {
    if (this.scene.events) {
      this.scene.events.on('droneWheelOpened', this.pauseSpawning, this);
      this.scene.events.on('droneWheelClosed', this.resumeSpawning, this);
      this.scene.events.on('withdrawGameStarted', this.pauseSpawning, this);
      this.scene.events.on('withdrawGameEnded', this.resumeSpawning, this);
      this.scene.events.on('depositPromptOpened', this.pauseSpawning, this);
      this.scene.events.on('depositPromptClosed', this.resumeSpawning, this);
      this.scene.events.on('dialogStarted', this.pauseSpawning, this);
      this.scene.events.on('dialogEnded', this.resumeSpawning, this);
    }
  }
  
  shutdown() {
    // Clean up event listeners
    if (this.scene && this.scene.events) {
      this.scene.events.off('droneWheelOpened', this.pauseSpawning, this);
      this.scene.events.off('droneWheelClosed', this.resumeSpawning, this);
      this.scene.events.off('withdrawGameStarted', this.pauseSpawning, this);
      this.scene.events.off('withdrawGameEnded', this.resumeSpawning, this);
      this.scene.events.off('depositPromptOpened', this.pauseSpawning, this);
      this.scene.events.off('depositPromptClosed', this.resumeSpawning, this);
      this.scene.events.off('dialogStarted', this.pauseSpawning, this);
      this.scene.events.off('dialogEnded', this.resumeSpawning, this);
    }
    
    // Clean up timers
    if (this.enemySpawnTimer) {
      this.enemySpawnTimer.remove();
      this.enemySpawnTimer = null;
    }
    
    if (this.waveTimer) {
      this.waveTimer.remove();
      this.waveTimer = null;
    }
  }
  
  pauseSpawning() {
    this.spawnPaused = true;
    if (this.enemySpawnTimer) {
      this.enemySpawnTimer.paused = true;
    }
    if (this.waveTimer) {
      this.waveTimer.paused = true;
    }
  }
  
  resumeSpawning() {
    this.spawnPaused = false;
    if (this.enemySpawnTimer) {
      this.enemySpawnTimer.paused = false;
    }
    if (this.waveTimer) {
      this.waveTimer.paused = false;
    }
  }
  
  // Trigger a wave of enemies using one of the special spawn patterns
  triggerWave() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    let availablePatterns = [];
    
    // Always include basic patterns
    availablePatterns.push(0, 1, 2, 3); // Basic patterns
    
    // Add special wave patterns based on which enemy types are active
    if (this.enemyTypes.blue.probability > 0) {
      availablePatterns.push(4); // Blue wave
    }
    
    if (this.enemyTypes.green.probability > 0) {
      availablePatterns.push(5); // Green wave
    }
    
    if (this.enemyTypes.gold.probability > 0) {
      availablePatterns.push(6); // Gold wave
    }
    
    if (this.enemyTypes.blue.probability > 0 && this.enemyTypes.green.probability > 0) {
      availablePatterns.push(7); // Mixed elite wave
    }
    
    // Add elite wave patterns based on which elite enemy types are active
    if (this.enemyTypes.blueElite.probability > 0) {
      availablePatterns.push(8); // Blue Elite wave
    }
    
    if (this.enemyTypes.greenElite.probability > 0) {
      availablePatterns.push(9); // Green Elite wave
    }
    
    if (this.enemyTypes.goldElite.probability > 0) {
      availablePatterns.push(10); // Gold Elite wave
    }
    
    // Choose a random pattern from available ones, with higher chance for basic patterns in early waves
    let patternIndex;
    
    // For the first 5 waves, mostly use basic patterns
    if (this.currentWave < 5 || Math.random() < 0.7) {
      // Select from basic patterns
      patternIndex = availablePatterns[Phaser.Math.Between(0, Math.min(3, availablePatterns.length - 1))];
    } 
    // For later waves, use more elite patterns if available
    else if (this.currentWave >= 20 && Math.random() < 0.4 && 
              (this.enemyTypes.blueElite.probability > 0 || 
               this.enemyTypes.greenElite.probability > 0 || 
               this.enemyTypes.goldElite.probability > 0)) {
      // For very late waves, prefer elite patterns
      const elitePatterns = availablePatterns.filter(index => index >= 8);
      if (elitePatterns.length > 0) {
        patternIndex = elitePatterns[Phaser.Math.Between(0, elitePatterns.length - 1)];
      } else {
        // Fallback to any pattern if no elite patterns are available
        patternIndex = availablePatterns[Phaser.Math.Between(0, availablePatterns.length - 1)];
      }
    } 
    else {
      // Select from any pattern
      patternIndex = availablePatterns[Phaser.Math.Between(0, availablePatterns.length - 1)];
    }
    
    console.log(`Triggering wave ${this.currentWave}, pattern: ${patternIndex}`);
    this.spawnPatterns[patternIndex]();
    this.currentWave++;
  }

  // Random spawn (original method, renamed)
  randomSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    this.spawnEnemyAtEdge(Phaser.Math.Between(0, 3));
  }
  
  // Corner Rush: enemies from each corner simultaneously
  cornerRushSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    // Check if in portrait mode
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    
    // Get camera view to ensure enemies spawn outside of it
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    // Top-left corner
    this.createEnemy(cameraX - this.SPAWN_OFFSET, cameraY - this.SPAWN_OFFSET, 'enemy_run_down');
    if (!isPortrait) {
      this.createEnemy(cameraX - this.SPAWN_OFFSET/2, cameraY - this.SPAWN_OFFSET, 'enemy_run_down');
    }
    
    // Top-right corner
    this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, cameraY - this.SPAWN_OFFSET, 'enemy_run_down');
    if (!isPortrait) {
      this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET/2, cameraY - this.SPAWN_OFFSET, 'enemy_run_down');
    }
    
    // Bottom-left corner
    this.createEnemy(cameraX - this.SPAWN_OFFSET, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up');
    if (!isPortrait) {
      this.createEnemy(cameraX - this.SPAWN_OFFSET/2, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up');
    }
    
    // Bottom-right corner
    this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up');
    if (!isPortrait) {
      this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET/2, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up');
    }
  }
  
  // Side Swarm: enemies spawn along a single edge and swarm inward
  sideSwarmSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    const side = Phaser.Math.Between(0, 3);
    // Check if in portrait mode and reduce enemy count by half
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    const countMin = isPortrait ? 3 : 5;
    const countMax = isPortrait ? 4 : 8;
    const count = Phaser.Math.Between(countMin, countMax);
    
    // Get camera view to ensure enemies spawn outside of it
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    if (side === 0) { // Top edge
      for (let i = 0; i < count; i++) {
        const x = cameraX + (cameraWidth / (count + 1)) * (i + 1);
        this.createEnemy(x, cameraY - this.SPAWN_OFFSET, 'enemy_run_down');
      }
    } else if (side === 1) { // Bottom edge
      for (let i = 0; i < count; i++) {
        const x = cameraX + (cameraWidth / (count + 1)) * (i + 1);
        this.createEnemy(x, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up');
      }
    } else if (side === 2) { // Left edge
      for (let i = 0; i < count; i++) {
        const y = cameraY + (cameraHeight / (count + 1)) * (i + 1);
        this.createEnemy(cameraX - this.SPAWN_OFFSET, y, 'enemy_run_right');
      }
    } else { // Right edge
      for (let i = 0; i < count; i++) {
        const y = cameraY + (cameraHeight / (count + 1)) * (i + 1);
        this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, y, 'enemy_run_right', true);
      }
    }
  }
  
  // Encirclement: enemies spawn around all edges simultaneously
  encircleSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    // Determine if we're in portrait mode (height > width)
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    
    // Get camera view to ensure enemies spawn outside of it
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    if (isPortrait) {
      // 6 enemies total in portrait mode: 2 from sides, 1 from top/bottom
      
      // Top - single enemy in the center
      this.createEnemy(cameraX + cameraWidth / 2, cameraY - this.SPAWN_OFFSET, 'enemy_run_down');
      
      // Bottom - single enemy in the center
      this.createEnemy(cameraX + cameraWidth / 2, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up');
      
      // Left - two enemies spaced apart
      this.createEnemy(cameraX - this.SPAWN_OFFSET, cameraY + cameraHeight / 3, 'enemy_run_right');
      this.createEnemy(cameraX - this.SPAWN_OFFSET, cameraY + cameraHeight * 2 / 3, 'enemy_run_right');
      
      // Right - two enemies spaced apart
      this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, cameraY + cameraHeight / 3, 'enemy_run_right', true);
      this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, cameraY + cameraHeight * 2 / 3, 'enemy_run_right', true);
    } else {
      // Original behavior for landscape mode
      const horizontalCount = 4; // Standard count for top/bottom in landscape
      const verticalCount = 3; // Standard count for sides in landscape
      
      // Top and bottom edges
      for (let i = 0; i < horizontalCount; i++) {
        const x = cameraX + (cameraWidth / (horizontalCount + 1)) * (i + 1);
        // Top
        this.createEnemy(x, cameraY - this.SPAWN_OFFSET, 'enemy_run_down');
        // Bottom
        this.createEnemy(x, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up');
      }
      
      // Left and right edges
      for (let i = 0; i < verticalCount; i++) {
        const y = cameraY + (cameraHeight / (verticalCount + 1)) * (i + 1);
        // Left
        this.createEnemy(cameraX - this.SPAWN_OFFSET, y, 'enemy_run_right');
        // Right
        this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, y, 'enemy_run_right', true);
      }
    }
  }
  
  // Blue Wave: all blue enemies (2 hit)
  blueWaveSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    const side = Phaser.Math.Between(0, 3);
    // Reduce count in portrait mode
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    const countMin = isPortrait ? 2 : 4;
    const countMax = isPortrait ? 3 : 6;
    const count = Phaser.Math.Between(countMin, countMax);
    
    // Get camera view
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    if (side === 0) { // Top edge
      for (let i = 0; i < count; i++) {
        const x = cameraX + (cameraWidth / (count + 1)) * (i + 1);
        this.createEnemy(x, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, 'blue');
      }
    } else if (side === 1) { // Bottom edge
      for (let i = 0; i < count; i++) {
        const x = cameraX + (cameraWidth / (count + 1)) * (i + 1);
        this.createEnemy(x, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, 'blue');
      }
    } else if (side === 2) { // Left edge
      for (let i = 0; i < count; i++) {
        const y = cameraY + (cameraHeight / (count + 1)) * (i + 1);
        this.createEnemy(cameraX - this.SPAWN_OFFSET, y, 'enemy_run_right', false, 'blue');
      }
    } else { // Right edge
      for (let i = 0; i < count; i++) {
        const y = cameraY + (cameraHeight / (count + 1)) * (i + 1);
        this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, y, 'enemy_run_right', true, 'blue');
      }
    }
  }
  
  // Green Wave: all green enemies (3 hit)
  greenWaveSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    // Check if in portrait mode
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    const count = isPortrait ? 2 : 3;
    
    // Get camera view
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    // Spawn green enemies from opposite sides
    // Top and bottom
    for (let i = 0; i < count; i++) {
      const x = cameraX + (cameraWidth / (count + 1)) * (i + 1);
      this.createEnemy(x, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, 'green');
      this.createEnemy(x, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, 'green');
    }
  }
  
  // Gold Wave: a few gold enemies (5 hit) with regular enemies
  goldWaveSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    // Check if in portrait mode
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    
    // Get camera view
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    // Always spawn gold enemies in top-left and bottom-right corners
    this.createEnemy(cameraX - this.SPAWN_OFFSET, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, 'gold');
    this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, 'gold');
    
    // Only spawn in other corners if not in portrait mode
    if (!isPortrait) {
      this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, 'gold');
      this.createEnemy(cameraX - this.SPAWN_OFFSET, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, 'gold');
    }
    
    // Add some regular enemies as well - fewer in portrait mode
    const regularCount = isPortrait ? 2 : 4;
    for (let i = 0; i < regularCount; i++) {
      this.spawnEnemyAtEdge(Phaser.Math.Between(0, 3));
    }
  }
  
  // Mixed Elite Wave: mix of blue and green with some standard
  mixedEliteSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    // Check if in portrait mode and reduce enemy count by half
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    const enemyCount = isPortrait ? 6 : 12;
    
    // Get camera view
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    // Spawn from all sides
    for (let i = 0; i < enemyCount; i++) {
      const side = i % 4;
      let type;
      
      // Determine enemy type
      const roll = Math.random();
      if (roll < 0.4) {
        type = 'standard';
      } else if (roll < 0.7) {
        type = 'blue';
      } else {
        type = 'green';
      }
      
      if (side === 0) { // Top
        const x = Phaser.Math.Between(cameraX, cameraX + cameraWidth);
        this.createEnemy(x, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, type);
      } else if (side === 1) { // Bottom
        const x = Phaser.Math.Between(cameraX, cameraX + cameraWidth);
        this.createEnemy(x, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, type);
      } else if (side === 2) { // Left
        const y = Phaser.Math.Between(cameraY, cameraY + cameraHeight);
        this.createEnemy(cameraX - this.SPAWN_OFFSET, y, 'enemy_run_right', false, type);
      } else { // Right
        const y = Phaser.Math.Between(cameraY, cameraY + cameraHeight);
        this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, y, 'enemy_run_right', true, type);
      }
    }
  }
  
  // Blue Elite Wave: a wave of blue elite enemies (3x health of blue)
  eliteBlueWaveSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    const side = Phaser.Math.Between(0, 3);
    // Reduce count in portrait mode
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    const countMin = isPortrait ? 1 : 2;
    const countMax = isPortrait ? 2 : 4;
    const count = Phaser.Math.Between(countMin, countMax);
    
    // Get camera view
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    if (side === 0) { // Top edge
      for (let i = 0; i < count; i++) {
        const x = cameraX + (cameraWidth / (count + 1)) * (i + 1);
        this.createEnemy(x, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, 'blueElite');
      }
    } else if (side === 1) { // Bottom edge
      for (let i = 0; i < count; i++) {
        const x = cameraX + (cameraWidth / (count + 1)) * (i + 1);
        this.createEnemy(x, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, 'blueElite');
      }
    } else if (side === 2) { // Left edge
      for (let i = 0; i < count; i++) {
        const y = cameraY + (cameraHeight / (count + 1)) * (i + 1);
        this.createEnemy(cameraX - this.SPAWN_OFFSET, y, 'enemy_run_right', false, 'blueElite');
      }
    } else { // Right edge
      for (let i = 0; i < count; i++) {
        const y = cameraY + (cameraHeight / (count + 1)) * (i + 1);
        this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, y, 'enemy_run_right', true, 'blueElite');
      }
    }
    
    // Announce the elite wave with a specific sound if available
    if (this.scene.crowdRoarSound) {
      this.scene.crowdRoarSound.play({ volume: 0.7 });
    }
  }
  
  // Green Elite Wave: a wave of green elite enemies (3x health of green)
  eliteGreenWaveSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    // Check if in portrait mode
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    const count = isPortrait ? 1 : 2;
    
    // Get camera view
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    // Spawn green elite enemies from opposite sides
    // Top and bottom
    for (let i = 0; i < count; i++) {
      const x = cameraX + (cameraWidth / (count + 1)) * (i + 1);
      this.createEnemy(x, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, 'greenElite');
      this.createEnemy(x, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, 'greenElite');
    }
    
    // Announce the elite wave with a specific sound if available
    if (this.scene.crowdRoarSound) {
      this.scene.crowdRoarSound.play({ volume: 0.8 });
    }
  }
  
  // Gold Elite Wave: a single gold elite enemy with backup
  eliteGoldWaveSpawn() {
    // Exit immediately if spawning is paused or in versus mode
    if (this.spawnPaused || this.scene.versusMode) return;
    
    // Get camera view
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    // Choose a random corner for the gold elite enemy
    const corner = Phaser.Math.Between(0, 3);
    
    // Spawn a single gold elite enemy in a corner
    if (corner === 0) { // Top-left
      this.createEnemy(cameraX - this.SPAWN_OFFSET, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, 'goldElite');
    } else if (corner === 1) { // Top-right
      this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, cameraY - this.SPAWN_OFFSET, 'enemy_run_down', false, 'goldElite');
    } else if (corner === 2) { // Bottom-left
      this.createEnemy(cameraX - this.SPAWN_OFFSET, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, 'goldElite');
    } else { // Bottom-right
      this.createEnemy(cameraX + cameraWidth + this.SPAWN_OFFSET, cameraY + cameraHeight + this.SPAWN_OFFSET, 'enemy_run_up', false, 'goldElite');
    }
    
    // Add some regular enemies as backups
    const isPortrait = GAME_HEIGHT > GAME_WIDTH;
    const regularCount = isPortrait ? 2 : 4;
    
    for (let i = 0; i < regularCount; i++) {
      // Spawn blue and green enemies as backup
      const type = Math.random() < 0.5 ? 'blue' : 'green';
      this.spawnEnemyAtEdge(Phaser.Math.Between(0, 3), type);
    }
    
    // Announce the elite wave with a crowd cheer
    if (this.scene.crowdRoarSound) {
      this.scene.crowdRoarSound.play({ volume: 1.0 });
    }
  }
  
  // Helper method to spawn an enemy at a specified edge
  spawnEnemyAtEdge(spawnEdge, forcedEnemyType = null) {
    // Exit immediately if spawning is paused
    if (this.spawnPaused) return;
    
    // Don't spawn enemies at all in versus mode
    if (this.scene.versusMode) {
      return; // Skip spawning in versus mode
    }
    
    let initialAnim = 'enemy_run_down';
    let flipX = false;
    
    // Get camera view to ensure enemies spawn outside of it
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    // Get player position to ensure we don't spawn too close to the player
    const player = this.scene.player;
    let playerPosition = { x: cameraX + cameraWidth/2, y: cameraY + cameraHeight/2 };
    
    // If we have access to the actual player position, use it
    if (player && player.x !== undefined && player.y !== undefined) {
      playerPosition = { x: player.x, y: player.y };
    }
    
    // Spawn position variables
    let spawnX, spawnY;
    
    if (spawnEdge === 0) { // Top edge
      // Generate random X position along the top edge, but outside camera view
      spawnX = Phaser.Math.Between(cameraX - this.SPAWN_OFFSET, cameraX + cameraWidth + this.SPAWN_OFFSET);
      spawnY = cameraY - this.SPAWN_OFFSET;
      initialAnim = 'enemy_run_down';
    } else if (spawnEdge === 1) { // Bottom edge
      // Generate random X position along the bottom edge, but outside camera view
      spawnX = Phaser.Math.Between(cameraX - this.SPAWN_OFFSET, cameraX + cameraWidth + this.SPAWN_OFFSET);
      spawnY = cameraY + cameraHeight + this.SPAWN_OFFSET;
      initialAnim = 'enemy_run_up';
    } else if (spawnEdge === 2) { // Left edge
      spawnX = cameraX - this.SPAWN_OFFSET;
      // Generate random Y position along the left edge, but outside camera view
      spawnY = Phaser.Math.Between(cameraY - this.SPAWN_OFFSET, cameraY + cameraHeight + this.SPAWN_OFFSET);
      initialAnim = 'enemy_run_right';
    } else { // Right edge
      spawnX = cameraX + cameraWidth + this.SPAWN_OFFSET;
      // Generate random Y position along the right edge, but outside camera view
      spawnY = Phaser.Math.Between(cameraY - this.SPAWN_OFFSET, cameraY + cameraHeight + this.SPAWN_OFFSET);
      initialAnim = 'enemy_run_right';
      flipX = true;
    }
    
    // Calculate distance from spawn point to player
    const dx = spawnX - playerPosition.x;
    const dy = spawnY - playerPosition.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
    
    // If we're too close to the player, recursively try again with a different edge
    if (distanceToPlayer < this.SPAWN_OFFSET * 2) {
      this.spawnEnemyAtEdge(Phaser.Math.Between(0, 3), forcedEnemyType);
      return;
    }
    
    // Determine enemy type based on probabilities or use the forced type if provided
    let selectedType = forcedEnemyType || 'standard';
    
    // Only use probability-based selection if no forced type is provided
    if (!forcedEnemyType) {
      const roll = Math.random();
      let cumulativeProbability = 0;
      
      for (const [type, data] of Object.entries(this.enemyTypes)) {
        cumulativeProbability += data.probability;
        if (roll <= cumulativeProbability) {
          selectedType = type;
          break;
        }
      }
    }
    
    this.createEnemy(spawnX, spawnY, initialAnim, flipX, selectedType);
  }
  
  // Get shadow from pool or create new
  getShadow(x, y) {
    // Try to get from pool
    if (this.shadowPool.length > 0) {
      const shadow = this.shadowPool.pop();
      shadow.x = x;
      shadow.y = y;
      shadow.setActive(true);
      shadow.setVisible(true);
      return shadow;
    }
    
    // Create new if none in pool
    return this.scene.add.image(x, y, 'shadow');
  }
  
  // Create an enemy with specified properties
  createEnemy(x, y, initialAnim, flipX = false, enemyType = 'standard') {
    try {
      // Get enemy type data
      const typeData = this.enemyTypes[enemyType];
      
      // Determine initial texture based on enemy type
      let initialTexture = 'enemy_idle_down1';
      
      // Store the animations prefix to use for this enemy
      let animPrefix = '';
      
      // If this enemy type uses color assets, update the initialTexture and animPrefix
      if (typeData && typeData.useColorAssets) {
        // Convert the initialAnim to the corresponding colored version
        // Extract the direction from the initialAnim (e.g., "enemy_run_down" -> "down")
        const animParts = initialAnim.split('_');
        if (animParts.length >= 3) {
          const direction = animParts.slice(2).join('_');
          
          // Determine the correct animation prefix for this enemy type
          animPrefix = `enemy_${enemyType}_`;
          
          // Get the potential animation suffix format from registry if available
          const animSuffix = this.scene.registry.get('enemyTypeAnimPrefixes')?.find(
            p => p.startsWith(enemyType)
          ) || `${enemyType}_`;
          
          // Try different texture naming formats
          let textureName = `enemy_${enemyType}_idle_${direction}1`;
          
          // Check if texture exists, otherwise try alternate format
          if (!this.scene.textures.exists(textureName)) {
            textureName = `enemy_${animSuffix}idle_${direction}1`;
            
            // Final fallback to standard texture if neither format exists
            if (!this.scene.textures.exists(textureName)) {
              textureName = 'enemy_idle_down1';
            }
          }
          
          initialTexture = textureName;
          console.log(`Using colored texture: ${initialTexture} for ${enemyType} enemy`);
        }
      }
      
      // Create the enemy sprite with appropriate texture
      let enemy = this.enemies.create(x, y, initialTexture);
      
      // Set basic properties
      const baseScale = 0.5;
      enemy.setScale(baseScale);
      enemy.setOrigin(0.5, 0.5);
      
      // Set collision body
      enemy.body.setSize(enemy.displayWidth, enemy.displayHeight);
      enemy.oval = { radiusX: enemy.displayWidth / 2, radiusY: enemy.displayHeight / 2 };
      
      // Set health properties based on enemy type, using default 1 if type not found
      if (typeData) {
        enemy.health = typeData.health;
        enemy.maxHealth = typeData.health;
        enemy.enemyType = enemyType;
        
        // Store whether this enemy uses color assets
        enemy.useColorAssets = typeData.useColorAssets;
        
        // Only apply tint if not using color assets
        if (!typeData.useColorAssets) {
          enemy.setTint(typeData.tint);
        }
      } else {
        // Fallback values if type data is missing
        enemy.health = 1;
        enemy.maxHealth = 1;
        enemy.enemyType = 'standard';
        enemy.useColorAssets = false;
      }
      
      // Store the animation prefix for later use
      enemy.animPrefix = animPrefix;
      
      // Store original values for logging/debugging
      enemy.originalType = enemyType;
      
      // Special case for Elite units - set special property
      if (enemyType.includes('Elite')) {
        enemy.isElite = true;
      }
      
      // Assign a unique ID to the enemy for tracking
      enemy.enemyId = Date.now() + '_' + Math.floor(Math.random() * 10000);
      
      // Create shadows for enemy
      enemy.shadows = [];
      this.shadowOffsets.forEach(offset => {
        const shadow = this.getShadow(
          enemy.x + offset.x, 
          enemy.y + offset.y + 50
        );
        
        // Set shadow properties
        const shadowBaseScale = 1.2;
        shadow.setScale(shadowBaseScale);
        shadow.setAlpha(0.3 / this.shadowOffsets.length); // Reduced default alpha
        shadow.setDepth(1);
        
        // Store shadow and offset
        enemy.shadows.push({ sprite: shadow, offset: offset });
      });
      
      // Set enemy to higher depth
      enemy.setDepth(10);
      
      // Set initial state
      enemy.isAttacking = false;
      enemy.attackCooldown = false;
      enemy.currentDirection = '';
      
      // Play the correct animation for this enemy type
      if (enemy.useColorAssets) {
        // For colored enemies, map standard animation keys to colored animation keys
        // Extract the animation type and direction
        const animParts = initialAnim.split('_');
        if (animParts.length >= 3) {
          const animType = animParts[1]; // "run", "idle", "attack"
          const direction = animParts.slice(2).join('_'); // "down", "up", "right", etc.
          
          // First, try the direct format matching the standard animations
          const coloredAnimKey = `enemy_${enemyType}_${animType}_${direction}`;
          
          // Attempt to use animation key with proper naming as in Animations.js
          const animSuffix = this.scene.registry.get('enemyTypeAnimPrefixes')?.find(
            p => p.startsWith(enemyType)
          ) || `${enemyType}_`;
          
          const altAnimKey = `enemy_${animSuffix}${animType}_${direction}`;
          
          console.log(`Trying colored animation: ${coloredAnimKey} or ${altAnimKey} for ${enemyType} enemy`);
          
          // Check if animation exists first
          if (this.scene.anims.exists(coloredAnimKey)) {
            enemy.play(coloredAnimKey);
          } else if (this.scene.anims.exists(altAnimKey)) {
            enemy.play(altAnimKey);
          } else {
            console.warn(`Animation ${coloredAnimKey} not found, falling back to standard animation`);
            enemy.play(initialAnim);
          }
        } else {
          // If initial animation name doesn't follow expected format, use standard
          console.warn(`Invalid animation format: ${initialAnim}, using standard animation`);
          enemy.play(initialAnim);
        }
      } else {
        // For standard enemies, use the provided animation directly
        enemy.play(initialAnim);
      }
      
      if (flipX) {
        enemy.setFlipX(true);
      }
      
      // Play a random sound when enemy spawns (with reduced frequency)
      if (Math.random() < 0.6) { // Only 60% chance to play sound
        this.enemySounds.playRandomExpletive();
      }
      
      return enemy;
    } catch (e) {
      console.error("Failed to create enemy:", e);
      
      // Last resort - create a very basic enemy
      try {
        // Create a basic gray enemy as fallback
        let fallbackEnemy = this.enemies.create(x, y, 'enemy_idle_down1');
        fallbackEnemy.setScale(0.5);
        fallbackEnemy.setOrigin(0.5, 0.5);
        fallbackEnemy.body.setSize(fallbackEnemy.displayWidth, fallbackEnemy.displayHeight);
        fallbackEnemy.oval = { radiusX: fallbackEnemy.displayWidth / 2, radiusY: fallbackEnemy.displayHeight / 2 };
        fallbackEnemy.health = 1;
        fallbackEnemy.maxHealth = 1;
        fallbackEnemy.enemyType = 'standard';
        fallbackEnemy.enemyId = Date.now() + '_' + Math.floor(Math.random() * 10000);
        fallbackEnemy.isAttacking = false;
        fallbackEnemy.attackCooldown = false;
        fallbackEnemy.currentDirection = '';
        fallbackEnemy.useColorAssets = false;
        fallbackEnemy.setDepth(10);
        
        try {
          fallbackEnemy.play(initialAnim);
        } catch (animError) {
          console.error("Fallback animation failed:", animError);
        }
        
        if (flipX) {
          fallbackEnemy.setFlipX(true);
        }
        
        return fallbackEnemy;
      } catch (finalError) {
        console.error("Complete failure creating enemy:", finalError);
        return null; // Return null as last resort
      }
    }
  }
  
  // Handle orientation changes for all enemies
  handleOrientationChange({ isPortrait }) {
    if (!this.enemies) return;
    
    // Set consistent enemy and shadow scales
    const baseScale = 0.5;
    const shadowBaseScale = 1.2;
    
    this.enemies.getChildren().forEach(enemy => {
      // Update scale to base scale
      enemy.setScale(baseScale);
      
      // Update collision oval
      enemy.oval.radiusX = enemy.displayWidth / 2;
      enemy.oval.radiusY = enemy.displayHeight / 2;
      
      // Update shadow scales
      if (enemy.shadows) {
        enemy.shadows.forEach(shadowData => {
          shadowData.sprite.setScale(shadowBaseScale);
        });
      }
    });
  }
  
  // Clean up resources when scene is destroyed
  shutdown() {
    // Clear timers
    if (this.enemySpawnTimer) {
      this.enemySpawnTimer.remove();
      this.enemySpawnTimer = null;
    }
    
    if (this.waveTimer) {
      this.waveTimer.remove();
      this.waveTimer = null;
    }
    
    // Destroy all shadows
    if (this.enemies) {
      this.enemies.getChildren().forEach(enemy => {
        if (enemy.shadows) {
          enemy.shadows.forEach(shadowData => {
            if (shadowData.sprite) {
              shadowData.sprite.destroy();
            }
          });
        }
      });
    }
    
    // Clear shadow pool
    this.shadowPool.forEach(shadow => {
      if (shadow) shadow.destroy();
    });
    this.shadowPool = [];
    
    // Remove event listeners
    if (this.scene.events) {
      this.scene.events.off('droneWheelOpened', this.pauseSpawning, this);
      this.scene.events.off('droneWheelClosed', this.resumeSpawning, this);
      this.scene.events.off('withdrawGameStarted', this.pauseSpawning, this);
      this.scene.events.off('withdrawGameEnded', this.resumeSpawning, this);
      this.scene.events.off('depositPromptOpened', this.pauseSpawning, this);
      this.scene.events.off('depositPromptClosed', this.resumeSpawning, this);
    }
  }
  
  getEnemies() {
    return this.enemies;
  }
}