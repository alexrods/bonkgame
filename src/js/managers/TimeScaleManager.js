/**
 * TimeScaleManager.js
 * Centralized manager for handling all time scaling effects in the game.
 */

export class TimeScaleManager {
  constructor(scene) {
    this.scene = scene;
    
    // Check if we're in multiplayer mode
    this.isMultiplayer = scene.registry.get('multiplayer') || false;
    this.isHost = scene.registry.get('isHost') || false;
    
    // Store original time scales
    this.originalTimeScales = {
      game: 1.0,
      physics: 1.0,
      anims: 1.0
    };
    
    // Current active time scales
    this.currentTimeScales = {
      game: 1.0,
      physics: 1.0,
      anims: 1.0
    };
    
    // Constants for various slowdown levels
    this.TIME_SCALE_NORMAL = 1.0;
    this.TIME_SCALE_DRONE_WHEEL = 0.05; // Drone wheel open - 5% speed (same as rhythm game)
    this.TIME_SCALE_DEPOSIT_MENU = 0.05; // ATM/deposit menu - 5% speed (95% reduction)
    this.TIME_SCALE_RHYTHM_GAME = 0.05; // BONK rhythm minigame - 5% speed for game world, but rhythm interface runs at normal speed
    this.TIME_SCALE_MINIGAME = 0.02; // Other minigames - 2% speed (extremely slow)
    this.TIME_SCALE_BULLET_TIME = 0.35; // Stimulant effect - 35% for enemies only
    this.TIME_SCALE_DIALOG = 0.001; // Dialog - 0.1% speed (nearly full game pause, but allows callbacks to fire)
    
    // Track which UI elements are currently affecting time
    this.activeTimeEffects = {
      droneWheel: false,
      rhythmGame: false,
      bulletTime: false,
      dialog: false
    };
    
    // Track which entities should ignore global time scaling
    this.exemptEntities = {
      player: false,
      playerBullets: false,
      playerReload: false
    };
    
    // Track stored enemy speeds to ensure proper cleanup
    this.enemiesWithStoredSpeeds = [];
    
    // Sync events in multiplayer
    this.multiplayerEvents = null;
  }
  
  /**
   * Initialize time scales at game start
   */
  init() {
    // Reset all state to make sure we start fresh
    this.reset();
    
    // Store initial time scales (should all be 1.0)
    this.storeCurrentTimeScales();
    
    // Apply normal time scale
    this.applyTimeScales(this.TIME_SCALE_NORMAL);
    
    // In multiplayer mode, set up synchronization
    if (this.isMultiplayer) {
      this.setupMultiplayerSync();
    }
    
    console.log(`TimeScaleManager initialized (multiplayer: ${this.isMultiplayer})`);
  }
  
  /**
   * Set up synchronization for multiplayer
   */
  setupMultiplayerSync() {
    console.log(`Setting up multiplayer time scale sync. Host: ${this.isHost}`);
    
    // Get the event emitter from the registry
    if (!this.scene.registry.get('multiplayerEvents')) {
      this.scene.registry.set('multiplayerEvents', new Phaser.Events.EventEmitter());
    }
    
    this.multiplayerEvents = this.scene.registry.get('multiplayerEvents');
    
    // Event listeners for time scale sync
    if (this.isHost) {
      // Host can modify time scales and sync to client
      this.multiplayerEvents.on('timeScaleRequest', this.handleTimeScaleRequest, this);
    } else {
      // Client receives time scale updates from host
      this.multiplayerEvents.on('timeScaleSync', this.handleTimeScaleSync, this);
    }
  }
  
  /**
   * Handle time scale requests in multiplayer (host only)
   */
  handleTimeScaleRequest(data) {
    if (!this.isHost) return;
    
    const { effect, active } = data;
    
    // Process the request and determine the appropriate time scale
    if (effect === 'droneWheel') {
      if (active) {
        this.activateDroneWheelTime();
      } else {
        this.deactivateDroneWheelTime();
      }
    } else if (effect === 'rhythmGame') {
      if (active) {
        this.activateRhythmGameTime();
      } else {
        this.deactivateRhythmGameTime();
      }
    } else if (effect === 'bulletTime') {
      if (active) {
        this.activateBulletTime();
      } else {
        this.deactivateBulletTime();
      }
    }
    
    // Sync the new time scale to clients
    this.syncTimeScale();
  }
  
  /**
   * Handle time scale sync from host (client only)
   */
  handleTimeScaleSync(data) {
    if (this.isHost) return;
    
    const { activeEffects, timeScale, exemptEntities } = data;
    
    // Update our local state to match the host
    this.activeTimeEffects = activeEffects;
    
    // Update exempt entities if provided
    if (exemptEntities) {
      this.exemptEntities = exemptEntities;
    }
    
    // Apply the time scale received from host
    this.applyTimeScales(timeScale);
    
    // Handle entity-specific time scaling if needed
    if ((this.activeTimeEffects.bulletTime || 
         this.activeTimeEffects.droneWheel || 
         this.activeTimeEffects.rhythmGame) && 
        this.exemptEntities.player) {
      this.adjustExemptEntities();
    }
    
    console.log(`Client received time scale sync: ${timeScale}`);
  }
  
  /**
   * Sync current time scale to clients (host only)
   */
  syncTimeScale() {
    if (!this.isHost || !this.multiplayerEvents) return;
    
    // Send current state to clients
    this.multiplayerEvents.emit('timeScaleSync', {
      activeEffects: this.activeTimeEffects,
      timeScale: this.currentTimeScales.game,
      exemptEntities: this.exemptEntities // Also sync exempt entities status
    });
    
    console.log(`Host synced time scale: ${this.currentTimeScales.game}`);
  }
  
  /**
   * Reset all state variables
   */
  reset() {
    // Reset time scales to normal
    this.originalTimeScales = {
      game: 1.0, 
      physics: 1.0, 
      anims: 1.0
    };
    
    this.currentTimeScales = {
      game: 1.0, 
      physics: 1.0, 
      anims: 1.0
    };
    
    // Reset all effect flags
    this.activeTimeEffects.droneWheel = false;
    this.activeTimeEffects.rhythmGame = false;
    this.activeTimeEffects.bulletTime = false;
    this.activeTimeEffects.dialog = false;
    
    // Reset exempt entities
    this.exemptEntities.player = false;
    this.exemptEntities.playerBullets = false;
    this.exemptEntities.playerReload = false;
    
    // Clear stored enemy speeds
    this.enemiesWithStoredSpeeds = [];
    
    console.log('TimeScaleManager state reset');
  }
  
  /**
   * Store current time scales for restoration later
   */
  storeCurrentTimeScales() {
    this.originalTimeScales.game = this.scene.time.timeScale;
    this.originalTimeScales.physics = this.scene.physics.world.timeScale; 
    this.originalTimeScales.anims = this.scene.anims.globalTimeScale;
    
    console.log(`Stored original time scales: game=${this.originalTimeScales.game}, physics=${this.originalTimeScales.physics}, anims=${this.originalTimeScales.anims}`);
  }
  
  /**
   * Apply time scales consistently across game, physics, and animations
   */
  applyTimeScales(gameTimeScale, physicsTimeScale = null, animsTimeScale = null) {
    // Use game time scale for all if others not specified
    const physicsScale = physicsTimeScale !== null ? physicsTimeScale : gameTimeScale;
    const animScale = animsTimeScale !== null ? animsTimeScale : gameTimeScale;
    
    // Update scene time scales
    this.scene.time.timeScale = gameTimeScale;
    this.scene.physics.world.timeScale = physicsScale;
    this.scene.anims.globalTimeScale = animScale;
    
    // Update current scales
    this.currentTimeScales.game = gameTimeScale;
    this.currentTimeScales.physics = physicsScale;
    this.currentTimeScales.anims = animScale;
    
    console.log(`Applied time scales: game=${gameTimeScale}, physics=${physicsScale}, anims=${animScale}`);
  }
  
  /**
   * Handle opening the drone wheel
   */
  activateDroneWheelTime() {
    console.log('Activating drone wheel time effect');
    
    // In multiplayer, client needs to request time scale change from host
    if (this.isMultiplayer && !this.isHost) {
      if (this.multiplayerEvents) {
        this.multiplayerEvents.emit('timeScaleRequest', {
          effect: 'droneWheel',
          active: true
        });
      }
      // Client doesn't modify time directly, so return
      return;
    }
    
    // Mark drone wheel as active
    this.activeTimeEffects.droneWheel = true;
    
    // Store current time scales if this is the first time effect
    if (!this.activeTimeEffects.rhythmGame && !this.activeTimeEffects.bulletTime) {
      this.storeCurrentTimeScales();
    }
    
    // Store enemy speeds before slowing them down
    this.storeEnemySpeeds();
    
    // Special handling for drone wheel: exempt player from time scaling
    this.exemptEntities.player = true;
    this.exemptEntities.playerBullets = true;
    this.exemptEntities.playerReload = true;
    
    // Update time scales
    this.updateTimeScales();
    
    // In multiplayer, host syncs time scale to client
    if (this.isMultiplayer && this.isHost) {
      this.syncTimeScale();
    }
  }
  
  /**
   * Handle closing the drone wheel
   */
  deactivateDroneWheelTime() {
    console.log('Deactivating drone wheel time effect');
    
    // In multiplayer, client needs to request time scale change from host
    if (this.isMultiplayer && !this.isHost) {
      if (this.multiplayerEvents) {
        this.multiplayerEvents.emit('timeScaleRequest', {
          effect: 'droneWheel',
          active: false
        });
      }
      // Client doesn't modify time directly, so return
      return;
    }
    
    // Mark drone wheel as inactive
    this.activeTimeEffects.droneWheel = false;
    
    // Remove player exemptions (unless bullet time is active)
    if (!this.activeTimeEffects.bulletTime && !this.activeTimeEffects.rhythmGame) {
      this.exemptEntities.player = false;
      this.exemptEntities.playerBullets = false;
      this.exemptEntities.playerReload = false;
    }
    
    // Restore original enemy speeds (if no other time effects are active)
    if (!this.activeTimeEffects.bulletTime && !this.activeTimeEffects.rhythmGame) {
      this.restoreEnemySpeeds();
    }
    
    // Update time scales
    this.updateTimeScales();
    
    // In multiplayer, host syncs time scale to client
    if (this.isMultiplayer && this.isHost) {
      this.syncTimeScale();
    }
  }
  
  /**
   * Handle opening the rhythm game (ATM)
   */
  activateRhythmGameTime() {
    console.log('Activating rhythm game time effect');
    
    // Mark rhythm game as active
    this.activeTimeEffects.rhythmGame = true;
    
    // Store current time scales if this is the first time effect
    if (!this.activeTimeEffects.droneWheel && !this.activeTimeEffects.bulletTime) {
      this.storeCurrentTimeScales();
    }
    
    // Store enemy speeds if not already stored by another effect
    this.storeEnemySpeeds();
    
    // Exempt player from time scaling for rhythm game
    this.exemptEntities.player = true;
    this.exemptEntities.playerBullets = true;
    this.exemptEntities.playerReload = true;
    
    // Update time scales
    this.updateTimeScales();
  }
  
  /**
   * Handle closing the rhythm game (ATM)
   */
  deactivateRhythmGameTime() {
    console.log('Deactivating rhythm game time effect');
    
    // Mark rhythm game as inactive
    this.activeTimeEffects.rhythmGame = false;
    
    // Remove player exemptions (unless another time effect is active)
    if (!this.activeTimeEffects.bulletTime && !this.activeTimeEffects.droneWheel) {
      this.exemptEntities.player = false;
      this.exemptEntities.playerBullets = false;
      this.exemptEntities.playerReload = false;
    }
    
    // Restore original enemy speeds (if no other time effects are active)
    if (!this.activeTimeEffects.bulletTime && !this.activeTimeEffects.droneWheel) {
      this.restoreEnemySpeeds();
    } else {
      // Otherwise, reapply the remaining active effect's slowdown
      this.updateTimeScales();
    }
  }
  
  /**
   * Handle bullet time activation (stimulants)
   */
  activateBulletTime() {
    console.log('Activating bullet time effect');
    
    // Mark bullet time as active
    this.activeTimeEffects.bulletTime = true;
    
    // Exempt player and bullets from time scaling
    this.exemptEntities.player = true;
    this.exemptEntities.playerBullets = true;
    this.exemptEntities.playerReload = true;
    
    // Store current time scales if this is the first time effect
    if (!this.activeTimeEffects.droneWheel && !this.activeTimeEffects.rhythmGame) {
      this.storeCurrentTimeScales();
    }
    
    // Store the original speeds of all enemies before slowing them
    this.storeEnemySpeeds();
    
    // Update time scales
    this.updateTimeScales();
  }
  
  /**
   * Handle bullet time deactivation
   */
  deactivateBulletTime() {
    console.log('Deactivating bullet time effect');
    
    // Mark bullet time as inactive
    this.activeTimeEffects.bulletTime = false;
    
    // Remove player exemptions (unless another effect is active)
    if (!this.activeTimeEffects.droneWheel && !this.activeTimeEffects.rhythmGame) {
      this.exemptEntities.player = false;
      this.exemptEntities.playerBullets = false;
      this.exemptEntities.playerReload = false;
    }
    
    // Restore original enemy speeds (if no other time effects are active)
    if (!this.activeTimeEffects.droneWheel && !this.activeTimeEffects.rhythmGame) {
      this.restoreEnemySpeeds();
    } else {
      // Otherwise, reapply the remaining active effect's slowdown
      this.adjustExemptEntities();
    }
    
    // Update time scales
    this.updateTimeScales();
  }
  
  /**
   * Update time scales based on active effects
   */
  updateTimeScales() {
    // Determine the time scale to use based on active effects
    let gameTimeScale = this.TIME_SCALE_NORMAL;
    
    // Dialog takes precedence over all other effects (complete pause)
    if (this.activeTimeEffects.dialog) {
      gameTimeScale = this.TIME_SCALE_DIALOG;
    }
    // Rhythm game takes precedence over drone wheel
    else if (this.activeTimeEffects.rhythmGame) {
      // Check if we're in the actual rhythm minigame vs just in the deposit menu
      const inRhythmMinigame = this.scene.rhythmGame && this.scene.rhythmGame.isActive;
      gameTimeScale = inRhythmMinigame ? this.TIME_SCALE_RHYTHM_GAME : this.TIME_SCALE_DEPOSIT_MENU;
    } else if (this.activeTimeEffects.droneWheel) {
      gameTimeScale = this.TIME_SCALE_DRONE_WHEEL;
    } else if (this.activeTimeEffects.bulletTime) {
      gameTimeScale = this.TIME_SCALE_BULLET_TIME;
    } else {
      // No active effects, restore original time scales
      gameTimeScale = this.originalTimeScales.game;
    }
    
    console.log(`updateTimeScales called - activeEffects: droneWheel=${this.activeTimeEffects.droneWheel}, rhythmGame=${this.activeTimeEffects.rhythmGame}, bulletTime=${this.activeTimeEffects.bulletTime}, dialog=${this.activeTimeEffects.dialog}`);
    
    // Handle special cases where we need different time scales for player vs enemies
    if ((this.activeTimeEffects.bulletTime || this.activeTimeEffects.droneWheel || this.activeTimeEffects.rhythmGame) && 
        (this.exemptEntities.player || this.exemptEntities.playerBullets)) {
      
      console.log(`TimeScaleManager: Using special handling for time effects. Selected Time Scale: ${gameTimeScale}`);
      
      // For all time effects with player exemptions, we want to keep the player at normal speed
      // Set time scales to normal first (for player)
      this.applyTimeScales(this.TIME_SCALE_NORMAL);
      
      // Then adjust enemies individually based on active effects
      this.adjustExemptEntities();
    } else {
      // For other effects, apply global slowdown uniformly
      console.log(`TimeScaleManager: Using uniform time scaling at ${gameTimeScale}`);
      this.applyTimeScales(gameTimeScale);
    }
  }
  
  /**
   * Adjust entities that should be exempt from global time scaling
   */
  adjustExemptEntities() {
    // Only make adjustments if any time effect is active
    if (!this.activeTimeEffects.bulletTime && 
        !this.activeTimeEffects.droneWheel && 
        !this.activeTimeEffects.rhythmGame) {
      console.log('No time effects active, skipping entity adjustments');
      return;
    }
    
    // Get enemies and enemyManager
    const enemyManager = this.scene.enemyManager;
    if (!enemyManager) {
      console.log('No enemy manager found, skipping entity adjustments');
      return;
    }
    
    const enemiesGroup = enemyManager.getEnemies();
    if (!enemiesGroup) {
      console.log('Enemy group is null, skipping entity adjustments');
      return;
    }
    
    const enemies = enemiesGroup.getChildren ? enemiesGroup.getChildren() : null;
    if (!enemies || enemies.length === 0) {
      console.log('No enemies found, skipping entity adjustments');
      return;
    }
    
    // Determine which slow-down factor to use based on the active effect
    let targetSlowdownFactor;
    let activeEffectName = "none";
    
    if (this.activeTimeEffects.rhythmGame) {
      targetSlowdownFactor = this.TIME_SCALE_RHYTHM_GAME;
      activeEffectName = "rhythmGame";
    } else if (this.activeTimeEffects.droneWheel) {
      targetSlowdownFactor = this.TIME_SCALE_DRONE_WHEEL;
      activeEffectName = "droneWheel";
    } else if (this.activeTimeEffects.bulletTime) {
      targetSlowdownFactor = this.TIME_SCALE_BULLET_TIME;
      activeEffectName = "bulletTime";
    } else {
      targetSlowdownFactor = this.TIME_SCALE_NORMAL; // Shouldn't happen, but as failsafe
      activeEffectName = "normal (failsafe)";
    }
    
    console.log(`TimeScaleManager: Slowing enemies for ${activeEffectName} effect at ${targetSlowdownFactor * 100}% speed`);
    
    enemies.forEach(enemy => {
      if (!enemy || !enemy.active) return;
      
      // Apply DIRECT slow-motion to enemy velocities if it has a body
      if (enemy.body && enemy.body.velocity) {
        // Find this enemy in our stored speeds
        const storedEnemy = this.enemiesWithStoredSpeeds.find(data => data.enemy === enemy);
        
        if (storedEnemy) {
          // Calculate slow velocities from the stored original values
          const slowVelocityX = storedEnemy.originalVelocityX * targetSlowdownFactor;
          const slowVelocityY = storedEnemy.originalVelocityY * targetSlowdownFactor;
          
          // Directly set enemy velocities to slow values
          enemy.body.velocity.x = slowVelocityX;
          enemy.body.velocity.y = slowVelocityY;
        } else {
          // No stored original velocity - store the current one then slow it
          const originalVelocityX = enemy.body.velocity.x;
          const originalVelocityY = enemy.body.velocity.y;
          
          // Store in our array for future reference
          this.enemiesWithStoredSpeeds.push({
            enemy: enemy,
            originalVelocityX: originalVelocityX,
            originalVelocityY: originalVelocityY
          });
          
          // Apply slowdown factor
          enemy.body.velocity.x = originalVelocityX * targetSlowdownFactor;
          enemy.body.velocity.y = originalVelocityY * targetSlowdownFactor;
        }
      }
      
      // Also slow down any animation in the enemy
      if (enemy.anims) {
        // First check if we have stored animation timeScale
        const storedEnemy = this.enemiesWithStoredSpeeds.find(data => data.enemy === enemy);
        if (storedEnemy) {
          if (storedEnemy.originalAnimsTimeScale !== undefined) {
            // Apply slowdown to original animation timeScale
            enemy.anims.timeScale = storedEnemy.originalAnimsTimeScale * targetSlowdownFactor;
          } else {
            // Store original anim timeScale if not already stored
            storedEnemy.originalAnimsTimeScale = enemy.anims.timeScale || 1.0;
            enemy.anims.timeScale = storedEnemy.originalAnimsTimeScale * targetSlowdownFactor;
          }
        } else {
          // If enemy is in our array but doesn't have anim timeScale, add it
          const originalAnimsTimeScale = enemy.anims.timeScale || 1.0;
          this.enemiesWithStoredSpeeds.push({
            enemy: enemy,
            originalAnimsTimeScale: originalAnimsTimeScale
          });
          enemy.anims.timeScale = originalAnimsTimeScale * targetSlowdownFactor;
        }
      }
      
      // Directly modify speed property if available
      if (enemy.speed !== undefined) {
        // First check if we have stored speed
        const storedEnemy = this.enemiesWithStoredSpeeds.find(data => data.enemy === enemy);
        if (storedEnemy) {
          if (storedEnemy.originalSpeed !== undefined) {
            // Apply slowdown to original speed
            enemy.speed = storedEnemy.originalSpeed * targetSlowdownFactor;
          } else {
            // Store original speed if not already stored
            storedEnemy.originalSpeed = enemy.speed;
            enemy.speed = storedEnemy.originalSpeed * targetSlowdownFactor;
          }
        } else {
          // If enemy isn't in our array at all, add it
          const originalSpeed = enemy.speed;
          this.enemiesWithStoredSpeeds.push({
            enemy: enemy,
            originalSpeed: originalSpeed
          });
          enemy.speed = originalSpeed * targetSlowdownFactor;
        }
      }
    });
  }
  
  /**
   * Get the current game time scale
   */
  getCurrentTimeScale() {
    return this.currentTimeScales.game;
  }
  
  /**
   * Store speeds of all enemies
   */
  storeEnemySpeeds() {
    const enemyManager = this.scene.enemyManager;
    if (!enemyManager) {
      console.log('No enemy manager found, skipping speed storage');
      return;
    }
    
    const enemiesGroup = enemyManager.getEnemies();
    if (!enemiesGroup) {
      console.log('Enemy group is null, skipping speed storage');
      return;
    }
    
    const enemies = enemiesGroup.getChildren ? enemiesGroup.getChildren() : null;
    if (!enemies || enemies.length === 0) {
      console.log('No enemies found, skipping speed storage');
      return;
    }
    
    // Create a new array each time to avoid reference issues
    // but preserve any enemies we already have stored
    const existingEnemyIds = this.enemiesWithStoredSpeeds.map(data => data.enemy.id);
    
    enemies.forEach(enemy => {
      if (!enemy || !enemy.active) return;
      
      // Skip enemies we've already stored
      if (existingEnemyIds.includes(enemy.id)) return;
      
      // Store original velocity and speed
      const originalData = {
        enemy: enemy,
        originalVelocityX: enemy.body ? enemy.body.velocity.x : 0,
        originalVelocityY: enemy.body ? enemy.body.velocity.y : 0
      };
      
      // Store speed property if it exists
      if (enemy.speed !== undefined) {
        originalData.originalSpeed = enemy.speed;
      }
      
      // Store animation timeScale if it exists
      if (enemy.anims && enemy.anims.timeScale !== undefined) {
        originalData.originalAnimsTimeScale = enemy.anims.timeScale;
      }
      
      this.enemiesWithStoredSpeeds.push(originalData);
    });
    
    console.log(`Stored speeds for ${this.enemiesWithStoredSpeeds.length} enemies`);
  }
  
  /**
   * Restore original enemy speeds
   */
  restoreEnemySpeeds() {
    if (!this.enemiesWithStoredSpeeds || this.enemiesWithStoredSpeeds.length === 0) {
      console.log('No stored enemy speeds to restore');
      return;
    }
    
    let restoredCount = 0;
    let staleCount = 0;
    
    // Create a copy of the array to iterate through while we modify the original
    const storedSpeedsCopy = [...this.enemiesWithStoredSpeeds];
    
    storedSpeedsCopy.forEach(data => {
      const enemy = data.enemy;
      
      if (enemy && enemy.active) {
        // Restore velocity
        if (enemy.body) {
          enemy.body.velocity.x = data.originalVelocityX;
          enemy.body.velocity.y = data.originalVelocityY;
        }
        
        // Restore speed property if it exists
        if (data.originalSpeed !== undefined) {
          enemy.speed = data.originalSpeed;
        }
        
        // Restore animation timeScale if it exists
        if (data.originalAnimsTimeScale !== undefined && enemy.anims) {
          enemy.anims.timeScale = data.originalAnimsTimeScale;
        } else if (enemy.anims) {
          // Default to normal timeScale if we didn't store one
          enemy.anims.timeScale = 1.0;
        }
        
        restoredCount++;
      } else {
        // Enemy is no longer active, so we'll remove it from our array
        staleCount++;
      }
      
      // Remove this entry from the original array
      const index = this.enemiesWithStoredSpeeds.findIndex(item => item.enemy === data.enemy);
      if (index !== -1) {
        this.enemiesWithStoredSpeeds.splice(index, 1);
      }
    });
    
    // Force reset ALL enemies to normal speed, even ones spawned after the time effect was applied
    this.resetAllEnemySpeeds();
    
    console.log(`Restored speeds for ${restoredCount} enemies, removed ${staleCount} stale entries, and reset all enemy speeds`);
  }
  
  /**
   * Reset all enemy speeds to normal, regardless of stored state
   * This is a failsafe to ensure ALL enemies return to normal speed
   */
  resetAllEnemySpeeds() {
    const enemyManager = this.scene.enemyManager;
    if (!enemyManager) {
      console.log('No enemy manager found, skipping reset all');
      return;
    }
    
    const enemiesGroup = enemyManager.getEnemies();
    if (!enemiesGroup) {
      console.log('Enemy group is null, skipping reset all');
      return;
    }
    
    const enemies = enemiesGroup.getChildren ? enemiesGroup.getChildren() : null;
    if (!enemies || enemies.length === 0) {
      console.log('No enemies found, skipping reset all');
      return;
    }
    
    let resetCount = 0;
    
    enemies.forEach(enemy => {
      if (!enemy || !enemy.active) return;
      
      // Reset animation timeScale to normal
      if (enemy.anims) {
        enemy.anims.timeScale = 1.0;
      }
      
      // Reset speed property if it exists
      if (enemy.speed !== undefined) {
        // Get the default speed based on enemy type
        let defaultSpeed = 100; // Default fallback
        if (enemy.enemyType === 'blue') defaultSpeed = 110;
        if (enemy.enemyType === 'green') defaultSpeed = 120;
        if (enemy.enemyType === 'gold') defaultSpeed = 130;
        
        enemy.speed = defaultSpeed;
      }
      
      resetCount++;
    });
    
    console.log(`Force reset ${resetCount} enemies to normal speed`);
  }

  /**
   * Update method called each frame
   */
  update() {
    // Clean up any stale enemy references (enemies that were killed)
    this.cleanupStaleEnemies();
    
    // Apply entity-specific time scaling when needed
    if ((this.activeTimeEffects.bulletTime || 
         this.activeTimeEffects.droneWheel || 
         this.activeTimeEffects.rhythmGame) && 
        this.exemptEntities.player) {
      
      // Always adjust exempt entities when any time effect is active
      this.adjustExemptEntities();
    }
  }
  
  /**
   * Clean up stale enemy references
   */
  cleanupStaleEnemies() {
    if (!this.enemiesWithStoredSpeeds || this.enemiesWithStoredSpeeds.length === 0) return;
    
    // Check periodically, not every frame
    if (Math.random() < 0.05) { // 5% chance each frame
      const initialCount = this.enemiesWithStoredSpeeds.length;
      
      // Filter out enemies that are no longer active
      this.enemiesWithStoredSpeeds = this.enemiesWithStoredSpeeds.filter(data => {
        return data.enemy && data.enemy.active;
      });
      
      const removedCount = initialCount - this.enemiesWithStoredSpeeds.length;
      if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} stale enemy references`);
      }
    }
  }
  
  /**
   * Clean up when changing scenes
   */
  shutdown() {
    console.log('TimeScaleManager shutdown');
    
    // Reset all time scales to normal
    this.applyTimeScales(this.TIME_SCALE_NORMAL);
    
    // Full reset of all state
    this.reset();
  }
}