import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';
import { EnemySounds } from './EnemySounds.js';
import { EnemySpawner } from './EnemySpawner.js';
import { EnemyBehavior } from './EnemyBehavior.js';
import { EnemyCollisions } from './EnemyCollisions.js';
import { EnemyEffects } from './EnemyEffects.js';

// Create a globally accessible instance for emergency access
let globalEnemyManager = null;

// Emergency global functions for direct access
export function forceStopAllEnemySpawning() {
  console.log("🚨 GLOBAL EMERGENCY: Force stopping all enemy spawning");
  if (globalEnemyManager && globalEnemyManager.spawner) {
    // Use every method we have to pause spawning
    if (typeof globalEnemyManager.spawner.pauseSpawning === 'function') {
      globalEnemyManager.spawner.pauseSpawning();
    }
    
    // Directly pause the timers as well
    if (globalEnemyManager.spawner.enemySpawnTimer) {
      globalEnemyManager.spawner.enemySpawnTimer.paused = true;
      console.log("Forced pause of enemySpawnTimer:", globalEnemyManager.spawner.enemySpawnTimer.paused);
    }
    
    if (globalEnemyManager.spawner.waveTimer) {
      globalEnemyManager.spawner.waveTimer.paused = true;
      console.log("Forced pause of waveTimer:", globalEnemyManager.spawner.waveTimer.paused);
    }
    
    // Set the flag as well
    if (globalEnemyManager.spawner.spawnPaused !== undefined) {
      globalEnemyManager.spawner.spawnPaused = true;
    }
  } else {
    console.error("Cannot force stop spawning - no global enemy manager available");
  }
}

export function forceStartAllEnemySpawning() {
  console.log("🟢 GLOBAL EMERGENCY: Force starting all enemy spawning");
  if (globalEnemyManager && globalEnemyManager.spawner) {
    // Use every method we have to resume spawning
    if (typeof globalEnemyManager.spawner.resumeSpawning === 'function') {
      globalEnemyManager.spawner.resumeSpawning();
    }
    
    // Directly resume the timers as well
    if (globalEnemyManager.spawner.enemySpawnTimer) {
      globalEnemyManager.spawner.enemySpawnTimer.paused = false;
      console.log("Forced resume of enemySpawnTimer:", !globalEnemyManager.spawner.enemySpawnTimer.paused);
    }
    
    if (globalEnemyManager.spawner.waveTimer) {
      globalEnemyManager.spawner.waveTimer.paused = false;
      console.log("Forced resume of waveTimer:", !globalEnemyManager.spawner.waveTimer.paused);
    }
    
    // Set the flag as well
    if (globalEnemyManager.spawner.spawnPaused !== undefined) {
      globalEnemyManager.spawner.spawnPaused = false;
    }
  } else {
    console.error("Cannot force start spawning - no global enemy manager available");
  }
}

export class EnemyManager {
  constructor(scene, bloodContainer) {
    this.scene = scene;
    this.bloodContainer = bloodContainer;
    
    // Check if we're in multiplayer mode
    this.isMultiplayer = scene.registry.get('multiplayer') || false;
    this.isHost = scene.registry.get('isHost') || false;
    
    // Add paused flag for deposit/withdraw screens
    this.paused = false;
    
    // Store velocities of all enemies when paused
    this.pausedEnemiesState = [];
    
    // Define shadow offsets for all enemies
    this.shadowOffsets = [
      { x: 10, y: 10 },   // For reflector in top-left, shadow falls bottom-right
      { x: -10, y: 10 },  // For reflector in top-right, shadow falls bottom-left
      { x: 10, y: -10 },  // For reflector in bottom-left, shadow falls top-right
      { x: -10, y: -10 }  // For reflector in bottom-right, shadow falls top-left
    ];
    
    // Initialize sub-managers
    this.sounds = new EnemySounds(scene);
    this.spawner = new EnemySpawner(scene, this.sounds, this.shadowOffsets);
    this.behavior = new EnemyBehavior(scene);
    this.collisions = new EnemyCollisions(scene);
    this.effects = new EnemyEffects(scene, bloodContainer);
    
    // Pass the sounds reference directly to the effects
    this.effects.sounds = this.sounds;
    
    // Store a reference to this instance globally for emergency access
    globalEnemyManager = this;
    
    // Add force methods to this instance
    this.forceStopSpawning = () => forceStopAllEnemySpawning();
    this.forceStartSpawning = () => forceStartAllEnemySpawning();
    
    // Force add emergency spawning control methods to the scene's events
    if (scene && scene.events) {
      scene.events.on('forceStopSpawning', this.forceStopSpawning, this);
      scene.events.on('forceStartSpawning', this.forceStartSpawning, this);
    }
    
    // Bind methods to ensure correct context
    this.checkBulletEnemyCollision = this.checkBulletEnemyCollision.bind(this);
    
    // Multiplayer sync
    this.multiplayerEvents = null;
    this.lastEnemySync = 0;
    this.enemySyncInterval = 100; // Send enemy updates every 100ms
  }

  init() {
    // Initialize all sub-managers
    this.sounds.init();
    this.spawner.init();
    // Make sure collisions is initialized properly
    if (!this.collisions) {
      this.collisions = new EnemyCollisions(this.scene);
    }
    
    // Set up multiplayer synchronization
    if (this.isMultiplayer) {
      this.setupMultiplayerSync();
    }
  }
  
  // Set up multiplayer enemy synchronization
  setupMultiplayerSync() {
    console.log(`Setting up multiplayer enemy sync. Host: ${this.isHost}`);
    
    // Get the event emitter from the registry
    if (!this.scene.registry.get('multiplayerEvents')) {
      this.scene.registry.set('multiplayerEvents', new Phaser.Events.EventEmitter());
    }
    
    this.multiplayerEvents = this.scene.registry.get('multiplayerEvents');
    
    if (this.isHost) {
      // Host sends enemy spawns, updates, and deaths to client
      // We'll implement event calls in the respective methods
    } else {
      // Client receives enemy spawns, updates, and deaths from host
      this.multiplayerEvents.on('enemySpawn', this.handleEnemySpawn, this);
      this.multiplayerEvents.on('enemyUpdate', this.handleEnemyUpdate, this);
      this.multiplayerEvents.on('enemyUpdates', this.handleEnemyUpdates, this);
      this.multiplayerEvents.on('enemyDeath', this.handleEnemyDeath, this);
      this.multiplayerEvents.on('enemyHit', this.handleEnemyHit, this);
    }
  }
  
  // Handle enemy spawn event from host (client only)
  handleEnemySpawn(data) {
    if (this.isHost) return;
    
    const { enemyId, x, y, type, direction } = data;
    
    // Create enemy using spawner
    this.spawner.createEnemy(x, y, type, enemyId, direction);
    console.log(`Client received enemy spawn: id=${enemyId}, type=${type}, pos=(${x},${y})`);
  }
  
  // Handle enemy update event from host (client only)
  handleEnemyUpdate(data) {
    if (this.isHost) return;
    
    const { enemyId, x, y, velocityX, velocityY, animKey, isFlipped } = data;
    
    // Find the enemy
    const enemy = this.findEnemyById(enemyId);
    if (!enemy) return;
    
    // Update enemy position and animation
    enemy.x = x;
    enemy.y = y;
    enemy.body.velocity.x = velocityX;
    enemy.body.velocity.y = velocityY;
    enemy.flipX = isFlipped;
    
    // Play animation if provided and different from current
    if (animKey && enemy.anims.currentAnim?.key !== animKey) {
      enemy.play(animKey);
    }
    
    // Update enemy shadows
    this.updateEnemyShadows(enemy);
  }
  
  // Update shadows for a specific enemy
  updateEnemyShadows(enemy) {
    if (!enemy || !enemy.shadows) return;
    
    // Update each shadow's position based on the enemy's position
    enemy.shadows.forEach(shadowData => {
      shadowData.sprite.x = enemy.x + shadowData.offset.x;
      shadowData.sprite.y = enemy.y + shadowData.offset.y + 20; // Small Y offset to position shadow properly
    });
  }
  
  // Handle enemy death event from host (client only)
  handleEnemyDeath(data) {
    if (this.isHost) return;
    
    const { enemyId, deathType, deathDirection } = data;
    
    // Find the enemy
    const enemy = this.findEnemyById(enemyId);
    if (!enemy) return;
    
    // Kill the enemy with visual effects
    this.killEnemy(enemy, deathType, deathDirection);
    console.log(`Client received enemy death: id=${enemyId}`);
  }
  
  // Handle enemy hit event from host (client only)
  handleEnemyHit(data) {
    if (this.isHost) return;
    
    const { enemyId, damage, hitDirection } = data;
    
    // Find the enemy
    const enemy = this.findEnemyById(enemyId);
    if (!enemy) return;
    
    // Create hit effect
    this.effects.createHitEffect(enemy, hitDirection);
    
    // Flash the enemy
    this.effects.flashEnemy(enemy);
    
    console.log(`Client received enemy hit: id=${enemyId}, damage=${damage}`);
  }
  
  // Find an enemy by its ID
  findEnemyById(enemyId) {
    const enemies = this.spawner.enemies.getChildren();
    return enemies.find(e => e.enemyId === enemyId);
  }

  startSpawning() {
    // In multiplayer, only the host should spawn enemies
    if (this.isMultiplayer && !this.isHost) {
      console.log("Client: Not starting enemy spawning - host will control spawning");
      return;
    }
    
    this.spawner.startSpawning();
  }

  update(player) {
    // Skip update if paused
    if (this.paused) return;
    
    // Log if there are special AI enemies
    const enemies = this.getEnemies().getChildren();
    const aiEnemies = enemies.filter(enemy => enemy.isAIPlayer);
    
    if (aiEnemies.length > 0 && Math.random() < 0.05) {
      console.log(`AI player enemy is active: ${aiEnemies.length} AI enemies in scene`);
    }
    
    this.behavior.updateEnemies(this.getEnemies(), player);
    
    // In multiplayer host mode, sync enemies to client
    if (this.isMultiplayer && this.isHost) {
      this.syncEnemies();
    }
  }
  
  // Sync enemies from host to client
  syncEnemies() {
    const now = this.scene.time.now;
    if (now - this.lastEnemySync < this.enemySyncInterval) {
      return; // Only sync at set intervals to reduce network traffic
    }
    
    this.lastEnemySync = now;
    
    // Get all active enemies
    const enemies = this.getEnemies().getChildren();
    
    // Skip if no enemies
    if (enemies.length === 0) return;
    
    // Only send updates for a subset of enemies each time to reduce bandwidth
    // Choose 5 enemies or 1/3 of all enemies, whichever is smaller
    const updateCount = Math.min(5, Math.ceil(enemies.length / 3));
    const enemiesToUpdate = this.selectEnemiesToSync(enemies, updateCount);
    
    // Create update data for selected enemies
    const updates = enemiesToUpdate.map(enemy => ({
      enemyId: enemy.enemyId,
      x: enemy.x,
      y: enemy.y,
      velocityX: enemy.body.velocity.x,
      velocityY: enemy.body.velocity.y,
      animKey: enemy.anims.currentAnim?.key,
      isFlipped: enemy.flipX
    }));
    
    // Send update to client
    if (this.multiplayerEvents && updates.length > 0) {
      this.multiplayerEvents.emit('enemyUpdates', updates);
    }
  }
  
  // Handle enemy updates from host (client only)
  handleEnemyUpdates(data) {
    if (this.isHost) return;
    
    // Process multiple enemy updates
    data.forEach(enemyData => {
      this.handleEnemyUpdate(enemyData);
    });
    
    console.log(`Client received batch update for ${data.length} enemies`);
  }
  
  // Select a subset of enemies to sync
  selectEnemiesToSync(enemies, count) {
    // Simple implementation: take random enemies
    const shuffled = [...enemies].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // Start enemy attack when close enough to the player.
  startEnemyAttack(enemy, player, onPlayerDeath) {
    this.behavior.startEnemyAttack(enemy, player, onPlayerDeath);
  }

  // Custom collision check for bullet-enemy collisions
  checkBulletEnemyCollision(bullet, enemy) {
    if (!this.collisions) {
      console.warn('EnemyManager: collisions object is undefined');
      return false;
    }
    return this.collisions.checkBulletEnemyCollision(bullet, enemy);
  }

  // When a bullet hits an enemy.
  hitEnemy(bullet, enemy, updateScore) {
    // Track the hit first (bullet successfully hit an enemy)
    if (this.scene.ui && !enemy.isHit) {
      this.scene.ui.trackHit();
    }
    
    // Pass to effects to handle the visual effects and eventual destruction
    this.effects.hitEnemy(bullet, enemy, updateScore);
  }

  // For player-enemy collision detection
  getEnemies() {
    return this.spawner.getEnemies();
  }

  // Create small blood splatter when enemy is in attack range
  createPlayerBloodSplatter(player) {
    this.effects.createPlayerBloodSplatter(player);
    // No sounds for player being attacked
  }

  // Create massive blood explosion when player dies
  createPlayerDeathBlood(player) {
    this.effects.createPlayerDeathBlood(player);
  }

  // Pause enemy spawning and updates
  setPaused(isPaused) {
    this.paused = isPaused;
    
    // Call the spawner's dedicated pause/resume methods if available
    if (this.spawner) {
      if (isPaused && typeof this.spawner.pauseSpawning === 'function') {
        console.log("EnemyManager.setPaused: Calling spawner.pauseSpawning()");
        this.spawner.pauseSpawning();
      } else if (!isPaused && typeof this.spawner.resumeSpawning === 'function') {
        console.log("EnemyManager.setPaused: Calling spawner.resumeSpawning()");
        this.spawner.resumeSpawning();
      }
    }
    
    // Store/restore spawn timers when pausing/unpausing (legacy/backup approach)
    if (isPaused) {
      // Store timers for restoration later
      if (this.spawner && this.spawner.enemySpawnTimer) {
        this.spawner.enemySpawnTimer.paused = true;
      }
      if (this.spawner && this.spawner.waveTimer) {
        this.spawner.waveTimer.paused = true;
      }
    } else {
      // Restore timers
      if (this.spawner && this.spawner.enemySpawnTimer) {
        this.spawner.enemySpawnTimer.paused = false;
      }
      if (this.spawner && this.spawner.waveTimer) {
        this.spawner.waveTimer.paused = false;
      }
    }
  }
  
  // Clean up resources
  shutdown() {
    console.log("EnemyManager shutdown called");
    
    // Clear the global reference
    if (globalEnemyManager === this) {
      globalEnemyManager = null;
    }
    
    // Clean up the spawner
    if (this.spawner && typeof this.spawner.shutdown === 'function') {
      this.spawner.shutdown();
    }
    
    // Clean up component managers
    if (this.soundManager && typeof this.soundManager.shutdown === 'function') {
      this.soundManager.shutdown();
    }
    
    if (this.behaviorManager && typeof this.behaviorManager.shutdown === 'function') {
      this.behaviorManager.shutdown();
    }
    
    if (this.collisionManager && typeof this.collisionManager.shutdown === 'function') {
      this.collisionManager.shutdown();
    }
    
    if (this.effectsManager && typeof this.effectsManager.shutdown === 'function') {
      this.effectsManager.shutdown();
    }
    
    // Clear enemy group
    if (this.enemies) {
      this.enemies.clear(true, true);
    }
  }
}