export class DroneManager {
  constructor(scene) {
    this.scene = scene;
    this.drone = null;
    this.box = null;
    this.droneSpeed = 150;
    this.isDelivering = false;
    this.deliveryTimer = null;
    this.deliveryInterval = 45000; // Extended to 45 seconds between automatic deliveries
    this.maxDroneVolume = 0.5; // Maximum volume for the drone sound
    this.minDroneVolume = 0.33; // Minimum volume for the drone sound
    this.volumeDistance = 500; // Distance at which volume is minimum
    
    // Enemy drone flag and reference
    this.enemyDrone = null;
    
    // Enemy drone spawning timer
    this.enemyDroneTimer = null;
    this.enemyDroneEnabled = false;
    this.enemyDroneInterval = 10000; // 10 seconds
    
    // Updated with new upgrade types and prices
    this.upgradeTypes = [
      { 
        type: 'speed', 
        name: 'Speed Boots', 
        emoji: '👢',
        levels: [
          { level: 1, effect: 1.1, description: '+10% Speed', duration: 30000 },
          { level: 2, effect: 1.2, description: '+20% Speed', duration: 30000 },
          { level: 3, effect: 1.3, description: '+30% Speed', duration: 30000 },
          { level: 4, effect: 1.4, description: '+40% Speed', duration: 30000 }
        ]
      },
      { 
        type: 'fireRate', 
        name: 'Rapid Fire', 
        emoji: '🔫',
        levels: [
          { level: 1, effect: 0.7, description: 'Weapon Select', duration: 30000 }
        ]
      },
      { 
        type: 'armor', 
        name: 'Shield', 
        emoji: '🛡️',
        levels: [
          { level: 1, effect: 1, description: '+1 HP', duration: 0 }
        ]
      },
      {
        type: 'withdraw',
        name: 'ATM',
        emoji: '🏧',
        levels: [
          { level: 1, effect: 1, description: 'Transfer funds', duration: 0 }
        ]
      },
      {
        type: 'magazine',
        name: 'Ammo',
        emoji: '🔄',
        levels: [
          { level: 1, effect: 4, description: '4 Magazines', duration: 0 }
        ]
      },
      {
        type: 'bulletTime',
        name: 'Stimulants',
        emoji: '💊',
        levels: [
          { level: 1, effect: 0.3, description: '30s Stimulants', duration: 30000 }
        ]
      },
      {
        type: 'emote',
        name: 'Emote',
        emoji: '😊',
        levels: [
          { level: 1, effect: 1, description: 'Express yourself', duration: 5000 }
        ]
      },
      {
        type: 'shotgun',
        name: 'Shotgun',
        emoji: '🔫',
        levels: [
          { level: 1, effect: 1, description: 'Wide spread, high damage', duration: 30000 }
        ]
      },
      {
        type: 'robot',
        name: 'Combat Robot',
        emoji: '🤖',
        levels: [
          { level: 1, effect: 1, description: 'Combat Robot', duration: 15000 }
        ]
      }
    ];
    
    // Keep track of active upgrade effects
    this.activeUpgrades = {
      speed: null,
      fireRate: null,
      armor: null,
      withdraw: null,
      magazine: null,
      bulletTime: null,
      emote: null,
      shotgun: null,
      robot: null
    };
    
    // Store visual effect groups
    this.upgradeEffects = {
      speed: null,
      fireRate: null,
      armor: null,
      withdraw: null,
      magazine: null,
      bulletTime: null,
      emote: null,
      shotgun: null,
      robot: null
    };
    
    // Queue for pending deliveries
    this.deliveryQueue = [];
  }

  init() {
    // Assets should already be loaded in the AssetLoader.js
    // Just setup the drone directly
    this.setupDrone();
    
    // No longer starting automatic timer deliveries
    // We'll only deliver drones on player request
  }

  setupDrone() {
    // Create the drone sprite off-screen initially with animation
    this.drone = this.scene.physics.add.sprite(-100, -100, 'drone_anim');
    this.drone.setScale(0.25); // Reduced by half as requested
    this.drone.setDepth(100);  // Ensure drone renders on top of everything
    this.drone.initialScale = 0.25; // Store initial scale for animation references
    this.drone.setVisible(false); // Ensure the drone is initially invisible
    
    // Play the drone hover animation
    this.drone.play('drone_hover');
    
    // Define shadow offsets for different reflector positions (same as player/enemy shadows)
    this.shadowOffsets = [
      { x: 10, y: 10 },   // For reflector in top-left, shadow falls bottom-right
      { x: -10, y: 10 },  // For reflector in top-right, shadow falls bottom-left
      { x: 10, y: -10 },  // For reflector in bottom-left, shadow falls top-right
      { x: -10, y: -10 }  // For reflector in bottom-right, shadow falls top-left
    ];
    
    // Create multiple drone shadows to match the multi-reflector setup
    this.drone.shadows = [];
    this.shadowOffsets.forEach(offset => {
      // The shadow texture is created in TextureGenerator.js
      let shadow = this.scene.add.image(
        this.drone.x + offset.x, 
        this.drone.y + offset.y + 50, // +50 Y offset like other entities
        'shadow'
      );
      // Double the shadow size (from 0.5 to 1.0)
      shadow.setScale(1.0); 
      // Lower initial opacity for height perspective (50% darker)
      shadow.setAlpha(0.3 / this.shadowOffsets.length); 
      shadow.setDepth(1); // Same depth as other shadows
      shadow.setVisible(false); // Initially not visible since drone is off-screen
      
      // Store both the shadow sprite and its offset
      this.drone.shadows.push({ sprite: shadow, offset: offset });
    });
    
    // Create the drone sound
    if (this.scene.cache.audio.exists('drone_buzz')) {
      this.droneSound = this.scene.sound.add('drone_buzz', { 
        volume: this.minDroneVolume, // Start at minimum volume
        loop: true 
      });
    }
    
    // We're no longer using automatic deliveries
    // No need to set up the delivery timer
  }

  // Delivery timer method removed - no more automatic deliveries

  dropBox(x, y, specificUpgrade = null) {
    // Create a variable to store the powerup texture key
    let powerupTexture = null;
    
    // Set the upgrade type for this box
    let upgradeType;
    let upgradeLevel = 1;
    let upgradeEffect, upgradeDuration;
    
    if (specificUpgrade) {
      // Use the specific upgrade requested
      const requestedUpgrade = this.upgradeTypes.find(u => u.type === specificUpgrade.type);
      if (requestedUpgrade) {
        upgradeType = requestedUpgrade;
        
        // Set the level information for the specific level requested
        upgradeLevel = specificUpgrade.level;
        upgradeEffect = specificUpgrade.effect;
        upgradeDuration = specificUpgrade.duration;
      } else {
        // Fallback to random if requested type not found
        upgradeType = this.upgradeTypes[Math.floor(Math.random() * this.upgradeTypes.length)];
        upgradeEffect = upgradeType.levels[0].effect;
        upgradeDuration = upgradeType.levels[0].duration;
      }
    } else {
      // Random upgrade with level 1
      upgradeType = this.upgradeTypes[Math.floor(Math.random() * this.upgradeTypes.length)];
      upgradeEffect = upgradeType.levels[0].effect;
      upgradeDuration = upgradeType.levels[0].duration;
    }
    
    // Create the box using the new box image, starting with closed box
    this.box = this.scene.add.sprite(x, y - 40, 'powerup_box_closed');
    this.box.setOrigin(0.5);
    
    // Determine the correct powerup texture key based on the upgrade type
    switch (upgradeType.type) {
      case 'speed':
        powerupTexture = 'powerup_rapid_fire'; // Using rapid fire texture as fallback
        break;
      case 'fireRate':
        powerupTexture = 'powerup_rapid_fire';
        break;
      case 'armor':
        powerupTexture = 'powerup_shield';
        break;
      case 'magazine':
        powerupTexture = 'powerup_ammo';
        break;
      case 'bulletTime':
        powerupTexture = 'powerup_ammo'; // Using ammo texture as fallback
        break;
      case 'shotgun':
        powerupTexture = 'powerup_shotgun';
        break;
      default:
        // Fallback to an emoji if no texture is found
        powerupTexture = null;
        break;
    }
    
    // Store the powerup texture key for use when box is opened
    this.box.powerupTexture = powerupTexture;
    
    this.box.setDepth(3);
    this.box.setScale(0.5); // Half the original size
    
    // Add physics to the box
    this.scene.physics.world.enable(this.box);
    
    // Set a much smaller physics body for more precise pickups (35% of original size)
    this.box.body.setSize(this.box.width * 0.35, this.box.height * 0.35);
    
    this.scene.lootGroup.add(this.box);
    
    // Store upgrade information
    this.box.upgradeType = upgradeType.type;
    this.box.upgradeName = upgradeType.name;
    this.box.upgradeEmoji = upgradeType.emoji;
    this.box.upgradeLevel = upgradeLevel;
    this.box.upgradeEffect = upgradeEffect;
    this.box.upgradeDuration = upgradeDuration;
    
    // Debug logging for magazine upgrades
    if (upgradeType.type === 'magazine') {
      console.log(`DEBUG - Magazine box created:`);
      console.log(`- Box type: ${this.box.upgradeType}`);
      console.log(`- Box level: ${this.box.upgradeLevel}`);
      console.log(`- Box effect (magazines): ${this.box.upgradeEffect}`);
      console.log(`- Box duration: ${this.box.upgradeDuration}`);
    }
    
    // Get level-specific description if available
    const levelData = upgradeType.levels.find(l => l.level === upgradeLevel);
    if (levelData) {
      this.box.upgradeDescription = levelData.description;
    } else {
      this.box.upgradeDescription = 'Upgrade';
    }
    
    // Simple bounce animation when the box lands
    this.scene.tweens.add({
      targets: this.box,
      y: y + 10,
      duration: 500,
      ease: 'Bounce.Out'
    });
    
    // No pulsing effect
    
    // Remove the revealing animation so box stays closed until collected
    
    // In tutorial mode, packages don't expire
    if (this.scene.scene.key !== 'TutorialScene') {
      // Make the box disappear after 15 seconds if not collected (only in regular game)
      this.scene.time.delayedCall(15000, () => {
        if (this.box && this.box.active) {
          this.scene.tweens.add({
            targets: [this.box, this.box.powerupIcon].filter(Boolean),
            alpha: 0,
            duration: 300,
            onComplete: () => {
              if (this.box) {
                if (this.box.powerupIcon) {
                  this.box.powerupIcon.destroy();
                }
                this.box.destroy();
                this.box = null;
              }
            }
          });
        }
      }, this);
    }
  }
  
  // New method to deliver a specific upgrade at a specific level
  deliverSpecificUpgrade(upgradeType, level, effect, duration) {
    // Debug logging for magazine deliveries
    if (upgradeType === 'magazine') {
      console.log(`DEBUG - Requesting magazine delivery:`);
      console.log(`- Type: ${upgradeType}`);
      console.log(`- Level: ${level}`);
      console.log(`- Effect (magazines): ${effect}`);
      console.log(`- Duration: ${duration}`);
    }
    
    if (this.isDelivering) {
      // Queue this delivery if a drone is already in flight
      this.deliveryQueue.push({
        type: upgradeType,
        level: level,
        effect: effect,
        duration: duration
      });
      
      if (upgradeType === 'magazine') {
        console.log(`DEBUG - Magazine delivery queued due to drone in flight`);
      }
      
      return;
    }
    
    this.isDelivering = true;
    
    // Get player position
    const player = this.scene.playerManager.getPlayer();
    if (!player) {
      this.isDelivering = false;
      return;
    }
    
    // Set drone starting position outside the screen
    const gameWidth = this.scene.cameras.main.width;
    const gameHeight = this.scene.cameras.main.height;
    
    // Randomly choose which side to enter from
    const side = Math.floor(Math.random() * 4);
    let startX, startY, endX, endY;
    
    // Calculate drop point closer to the player for on-demand deliveries
    const dropX = player.x + Phaser.Math.Between(-100, 100);
    const dropY = player.y + Phaser.Math.Between(-100, 100);
    
    // Keep drop point within game bounds
    const boundedDropX = Phaser.Math.Clamp(dropX, 100, gameWidth - 100);
    const boundedDropY = Phaser.Math.Clamp(dropY, 100, gameHeight - 100);
    
    // Set drone entry and exit points based on chosen side - ensure it's completely off screen
    switch(side) {
      case 0: // Top
        startX = Phaser.Math.Between(100, gameWidth - 100);
        startY = -100; // Further off-screen
        endX = startX; // Exit from same X position
        endY = -100;
        break;
      case 1: // Right
        startX = gameWidth + 100; // Further off-screen
        startY = Phaser.Math.Between(100, gameHeight - 100);
        endX = gameWidth + 100;
        endY = startY; // Exit from same Y position
        break;
      case 2: // Bottom
        startX = Phaser.Math.Between(100, gameWidth - 100);
        startY = gameHeight + 100; // Further off-screen
        endX = startX; // Exit from same X position
        endY = gameHeight + 100;
        break;
      case 3: // Left
        startX = -100; // Further off-screen
        startY = Phaser.Math.Between(100, gameHeight - 100);
        endX = -100;
        endY = startY; // Exit from same Y position
        break;
    }
    
    // Position drone at the start position
    this.drone.x = startX;
    this.drone.y = startY;
    this.drone.setVisible(true);
    
    // Make sure animation is playing
    if (!this.drone.anims.isPlaying) {
      this.drone.play('drone_hover');
    }
    
    // Make shadows visible too
    if (this.drone.shadows) {
      this.drone.shadows.forEach(shadowData => {
        shadowData.sprite.setVisible(true);
        shadowData.sprite.x = this.drone.x + shadowData.offset.x;
        shadowData.sprite.y = this.drone.y + shadowData.offset.y + 50;
      });
    }
    
    // Play drone sound
    if (this.droneSound) {
      this.droneSound.play();
    }
    
    // For on-demand deliveries, make the drone slightly faster
    const entryDuration = 1500;
    const exitDuration = 1500;
    
    // Show "On the way!" message
    this.showDeliveryText(player, "Drone incoming!");
    
    // Enhanced drone animation sequence
    // Phase 1: Arrival path from off-screen
    this.scene.tweens.add({
      targets: this.drone,
      x: boundedDropX,
      y: boundedDropY - 50, // Arrive slightly above the drop point
      scale: this.drone.initialScale, // Maintain initial scale to represent height
      duration: entryDuration,
      ease: 'Quad.InOut',
      onComplete: () => {
        // Phase 2: Landing sequence - drone descends
        this.scene.tweens.add({
          targets: this.drone,
          y: boundedDropY,
          scale: this.drone.initialScale * 0.92,
          duration: 800,
          ease: 'Quad.Out',
          onComplete: () => {
            // Phase 3: Hover animation before package drop
            this.scene.tweens.add({
              targets: this.drone,
              y: this.drone.y - 8,
              duration: 200,
              yoyo: true,
              repeat: 1,
              onComplete: () => {
                // Drop the specific upgrade package
                this.dropBox(boundedDropX, boundedDropY, {
                  type: upgradeType,
                  level: level,
                  effect: effect,
                  duration: duration
                });
                
                // Phase 4: Takeoff sequence
                this.scene.tweens.add({
                  targets: this.drone,
                  y: boundedDropY - 80,
                  scale: this.drone.initialScale * 1.03,
                  duration: 900,
                  ease: 'Cubic.Out',
                  onComplete: () => {
                    // Phase 5: Exit path
                    this.scene.tweens.add({
                      targets: this.drone,
                      x: endX,
                      y: endY,
                      scale: this.drone.initialScale * 0.98,
                      duration: exitDuration,
                      ease: 'Quad.In',
                      onComplete: () => {
                        // Hide the drone and stop sound when it leaves
                        this.drone.setVisible(false);
                        
                        // Hide all shadows too
                        if (this.drone.shadows) {
                          this.drone.shadows.forEach(shadowData => {
                            shadowData.sprite.setVisible(false);
                          });
                        }
                        
                        if (this.droneSound) {
                          this.droneSound.stop();
                        }
                        
                        this.isDelivering = false;
                        
                        // Check the queue for pending deliveries
                        if (this.deliveryQueue.length > 0) {
                          const nextDelivery = this.deliveryQueue.shift();
                          this.deliverSpecificUpgrade(
                            nextDelivery.type,
                            nextDelivery.level,
                            nextDelivery.effect,
                            nextDelivery.duration
                          );
                        }
                        // No more automatic deliveries!
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }
  
  // Empty method - text notifications removed
  showDeliveryText(player, message) {
    // No text display
  }

  applyUpgrade(player, box) {
    // For the robot upgrade which might be directly applied, box could be a plain object
    const upgradeType = box.upgradeType;
    const upgradeName = box.upgradeName;
    const upgradeEmoji = box.upgradeEmoji;
    const upgradeLevel = box.upgradeLevel || 1;
    const upgradeEffect = box.upgradeEffect;
    const upgradeDuration = box.upgradeDuration || 10000;
    
    // Flag to check if this is a box game object or a plain object
    const isBoxGameObject = box.destroy && typeof box.destroy === 'function';
    
    // First, animate the box opening (only if it's a game object and not already open)
    if (isBoxGameObject && box.texture.key === 'powerup_box_closed') {
      // Change texture to open box
      box.setTexture('powerup_box_open');
      
      // Brief pause to show the opened box before applying the upgrade effect
      this.scene.time.delayedCall(200, () => {
        // Continue with the upgrade application
        this.applyUpgradeEffect(player, box, upgradeType, upgradeName, upgradeEmoji, upgradeLevel, upgradeEffect, upgradeDuration, isBoxGameObject);
      });
    } else {
      // If it's not a closed box or not a game object, apply the upgrade immediately
      this.applyUpgradeEffect(player, box, upgradeType, upgradeName, upgradeEmoji, upgradeLevel, upgradeEffect, upgradeDuration, isBoxGameObject);
    }
  }
  
  // This method contains the actual upgrade application logic extracted from applyUpgrade
  applyUpgradeEffect(player, box, upgradeType, upgradeName, upgradeEmoji, upgradeLevel, upgradeEffect, upgradeDuration, isBoxGameObject) {
    
    // Play whoo sound when any upgrade box is opened
    if (isBoxGameObject) {
      // Check if the sound is already available in the cache
      if (this.scene.cache.audio.exists('whoo')) {
        // Play with Phaser sound system if available
        this.scene.sound.play('whoo', { volume: 0.7 });
      } else {
        // Try to load and play the sound directly if not in cache
        try {
          const whooSound = new Audio('/assets/sound/sfx/whoo.mp3');
          whooSound.volume = 0.7;
          whooSound.play().catch(error => {
            console.warn("Unable to play whoo sound:", error);
          });
        } catch (error) {
          console.error("Failed to load whoo sound:", error);
        }
      }
    }
    
    // Log magazine count before applying any upgrade
    if (this.scene.playerManager && upgradeType === 'magazine') {
      console.log(`DEBUG - BEFORE upgrade application - Total magazines: ${this.scene.playerManager.totalMagazines}`);
    }
    
    console.log(`Applying upgrade: ${upgradeType}, level: ${upgradeLevel}, effect: ${upgradeEffect}`);
    
    // No floating text for pickups
    
    // Clear any existing upgrade timer/effect of the same type
    if (this.activeUpgrades[upgradeType]) {
      clearTimeout(this.activeUpgrades[upgradeType]);
      this.activeUpgrades[upgradeType] = null;
    }
    
    // Remove any existing visual effects
    if (this.upgradeEffects[upgradeType]) {
      this.upgradeEffects[upgradeType].forEach(item => {
        if (item && item.destroy) {
          item.destroy();
        }
      });
      this.upgradeEffects[upgradeType] = null;
    }
    
    // Special handling for bullet time - use TimeScaleManager if available
    if (upgradeType === 'bulletTime' && this.scene.timeScaleManager) {
      console.log("Using TimeScaleManager for bullet time effect");
    }
    
    // Apply the specific upgrade effect
    switch(upgradeType) {
      case 'magazine':
        // Add multiple magazines to the player's inventory
        const magazinesToAdd = upgradeEffect || 1;
        
        // Debug logging
        console.log(`DEBUG - Magazine pickup:`)
        console.log(`- Box upgradeEffect: ${upgradeEffect}`);
        console.log(`- Magazines to add: ${magazinesToAdd}`);
        console.log(`- Current magazines before adding: ${this.scene.playerManager.totalMagazines}`);
        
        // Only add exactly the number specified
        this.scene.playerManager.totalMagazines += magazinesToAdd;
        
        console.log(`- Total magazines after adding: ${this.scene.playerManager.totalMagazines}`);
        
        // Update the display
        this.scene.playerManager.updateAmmoDisplay();
        
        // No text display for magazine pickup
        break;
        
      case 'speed':
        // Store original speed if not already saved
        if (!player.originalSpeed) {
          player.originalSpeed = player.speed;
        }
        
        // Apply the speed multiplier from the specific upgrade level
        player.speed = player.originalSpeed * upgradeEffect;
        
        // Create a visual indicator with appropriate level styling
        this.upgradeEffects[upgradeType] = this.createUpgradeEffect(
          player, 
          `${upgradeEmoji}${upgradeLevel}`, 
          0x00ffff, 
          upgradeLevel
        );
        
        // Set timer to reset after duration
        this.activeUpgrades[upgradeType] = this.scene.time.delayedCall(upgradeDuration, () => {
          if (player.active) {
            player.speed = player.originalSpeed;
            
            // No expiration text
            
            // Clean up timers and effects
            this.activeUpgrades[upgradeType] = null;
            
            if (this.upgradeEffects[upgradeType]) {
              this.upgradeEffects[upgradeType].forEach(item => {
                if (item && item.destroy) {
                  item.destroy();
                }
              });
              this.upgradeEffects[upgradeType] = null;
            }
          }
        });
        break;
        
      case 'fireRate':
        // Store original fire rate if not already saved
        if (!this.scene.playerManager.originalFireRate) {
          this.scene.playerManager.originalFireRate = this.scene.playerManager.fireRate;
        }
        
        // Apply the multiplier (smaller value = faster firing)
        this.scene.playerManager.fireRate = this.scene.playerManager.originalFireRate * upgradeEffect;
        
        // Create visual indicator
        this.upgradeEffects[upgradeType] = this.createUpgradeEffect(
          player, 
          `${upgradeEmoji}${upgradeLevel}`, 
          0xff0000, 
          upgradeLevel
        );
        
        // Reset after duration
        this.activeUpgrades[upgradeType] = this.scene.time.delayedCall(upgradeDuration, () => {
          if (player.active) {
            this.scene.playerManager.fireRate = this.scene.playerManager.originalFireRate;
            
            // No expiration text
            
            // Clean up
            this.activeUpgrades[upgradeType] = null;
            
            if (this.upgradeEffects[upgradeType]) {
              this.upgradeEffects[upgradeType].forEach(item => {
                if (item && item.destroy) {
                  item.destroy();
                }
              });
              this.upgradeEffects[upgradeType] = null;
            }
          }
        });
        break;
        
      case 'armor':
        // Add +1 HP permanently instead of temporary invincibility
        console.log('Adding +1 HP to player');
        
        // If player has a health property, increase it
        if (this.scene.playerManager.health !== undefined) {
          // Increase health but cap at maximum
          this.scene.playerManager.health = Math.min(
            this.scene.playerManager.health + 1,
            this.scene.playerManager.maxHealth
          );
          console.log(`Player health increased to ${this.scene.playerManager.health}/${this.scene.playerManager.maxHealth}`);
          
          // Update health display if available
          if (this.scene.playerManager.updateHealthDisplay) {
            this.scene.playerManager.updateHealthDisplay();
          }
        } else {
          console.warn('Player health property not found');
        }
        
        // Create a brief visual indicator for the player
        this.upgradeEffects[upgradeType] = this.createUpgradeEffect(
          player, 
          `${upgradeEmoji}+1`, 
          0xffff00, 
          1
        );
        
        // Clean up visual effect after a short time
        this.activeUpgrades[upgradeType] = this.scene.time.delayedCall(3000, () => {
          // Clean up
          this.activeUpgrades[upgradeType] = null;
          
          if (this.upgradeEffects[upgradeType]) {
            this.upgradeEffects[upgradeType].forEach(item => {
              if (item && item.destroy) {
                item.destroy();
              }
            });
            this.upgradeEffects[upgradeType] = null;
          }
        });
        break;
        
      case 'withdraw':
        // Placeholder for withdraw functionality
        console.log("Withdraw functionality will be implemented later");
        
        // Show a feedback message to the player
        const withdrawText = this.scene.add.text(
          player.x,
          player.y - 50,
          "💰 Withdraw initiated!",
          {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4
          }
        );
        withdrawText.setOrigin(0.5);
        withdrawText.setDepth(100);
        
        // Fade out and destroy the text
        this.scene.tweens.add({
          targets: withdrawText,
          y: withdrawText.y - 30,
          alpha: 0,
          duration: 2000,
          onComplete: () => {
            withdrawText.destroy();
          }
        });
        break;
        
      case 'emote':
        // This is an emote that shows an animation above the player
        // and doesn't affect weapon type
        
        // Play crowd roar sound when emote is activated
        if (this.scene.cache.audio.exists('crowd_roar')) {
          this.scene.sound.play('crowd_roar', { volume: 0.7 });
        }
        
        // Create the emote above the player
        const emoteText = this.scene.add.text(
          player.x,
          player.y - 50,
          `${upgradeEmoji}`,
          {
            fontSize: '64px', // Increased from 32px to 64px
            fontFamily: 'Arial'
          }
        );
        emoteText.setOrigin(0.5);
        emoteText.setDepth(100);
        
        // Create fireworks effect with individual sprites instead of particle emitter
        const fireworksParticles = [];
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        
        // Function to create a single particle
        const createParticle = (x, y, color) => {
          const particle = this.scene.add.circle(x, y, 4, color, 0.8);
          particle.setDepth(99);
          particle.setBlendMode(Phaser.BlendModes.ADD);
          
          // Random angle and speed
          const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);
          const speed = Phaser.Math.Between(50, 150);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          // Add particle to tracking array
          fireworksParticles.push(particle);
          
          // Animate the particle
          this.scene.tweens.add({
            targets: particle,
            x: x + vx,
            y: y + vy,
            alpha: 0,
            scale: 0.1,
            duration: Phaser.Math.Between(500, 1000),
            ease: 'Power2',
            onComplete: () => {
              particle.destroy();
              
              // Remove from array
              const index = fireworksParticles.indexOf(particle);
              if (index > -1) {
                fireworksParticles.splice(index, 1);
              }
            }
          });
        };
        
        // Initial burst
        for (let i = 0; i < 30; i++) {
          createParticle(
            player.x + Phaser.Math.Between(-20, 20),
            player.y - 50 + Phaser.Math.Between(-20, 20),
            colors[Phaser.Math.Between(0, colors.length - 1)]
          );
        }
        
        // Add repeating bursts from three different points around the emoji
        const burstTimer = this.scene.time.addEvent({
          delay: 200, // More frequent bursts
          repeat: 24, // Many more bursts for the 5 seconds (increased from 8)
          callback: () => {
            // Create particles at three different positions around the emoji
            const positions = [
              { x: emoteText.x - 30, y: emoteText.y },         // Left side
              { x: emoteText.x + 30, y: emoteText.y },         // Right side
              { x: emoteText.x, y: emoteText.y - 30 }          // Top
            ];
            
            // Add 10 particles per burst point (30 total per burst)
            positions.forEach(pos => {
              for (let i = 0; i < 10; i++) {
                createParticle(
                  pos.x + Phaser.Math.Between(-15, 15),
                  pos.y + Phaser.Math.Between(-15, 15),
                  colors[Phaser.Math.Between(0, colors.length - 1)]
                );
              }
            });
          }
        });
        
        // Store the emote and timer for cleanup
        this.upgradeEffects[upgradeType] = [emoteText, burstTimer];
        
        // Use the original upgrade duration
        const emoteDisplayTime = upgradeDuration; // Using original duration of 5000ms
        
        // Animate the emote growing and fading away
        this.scene.tweens.add({
          targets: emoteText,
          y: emoteText.y - 40,
          scale: 2.0, // Increased from 1.5 to 2.0
          alpha: 0,
          duration: emoteDisplayTime,
          ease: 'Sine.Out',
          onComplete: () => {
            emoteText.destroy();
          }
        });
        
        // Set a timer to clean up after duration
        this.activeUpgrades[upgradeType] = this.scene.time.delayedCall(emoteDisplayTime, () => {
          // Clean up all effects
          if (this.upgradeEffects[upgradeType]) {
            this.upgradeEffects[upgradeType].forEach(item => {
              if (item && item.destroy) {
                item.destroy();
              }
            });
            this.upgradeEffects[upgradeType] = null;
          }
          this.activeUpgrades[upgradeType] = null;
        });
        break;

      case 'shotgun':
        // This is the actual shotgun weapon upgrade
        
        // Store original weapon type if not already saved
        if (!this.scene.playerManager.originalWeaponType) {
          this.scene.playerManager.originalWeaponType = this.scene.playerManager.weaponType;
        }
        
        // Apply shotgun specific effects
        if (this.scene.playerManager.setWeaponType) {
          this.scene.playerManager.setWeaponType('shotgun');
        } else {
          // Direct set if method not available
          this.scene.playerManager.weaponType = 'shotgun';
        }
        
        // Create visual indicator for shotgun
        this.upgradeEffects[upgradeType] = this.createUpgradeEffect(
          player, 
          '🔫', 
          0xff6600, 
          upgradeLevel
        );
        
        // Play weapon upgrade sound
        if (this.scene.playerManager.reloadSound) {
          this.scene.playerManager.reloadSound.play({ volume: 0.8 });
        }
        
        // Reset after duration
        this.activeUpgrades[upgradeType] = this.scene.time.delayedCall(upgradeDuration, () => {
          if (player.active) {
            // Switch back to default weapon
            if (this.scene.playerManager.setWeaponType) {
              this.scene.playerManager.setWeaponType(this.scene.playerManager.originalWeaponType || 'rifle');
            } else {
              // Direct set if method not available
              this.scene.playerManager.weaponType = this.scene.playerManager.originalWeaponType || 'rifle';
            }
            
            // Clean up
            this.activeUpgrades[upgradeType] = null;
            
            if (this.upgradeEffects[upgradeType]) {
              this.upgradeEffects[upgradeType].forEach(item => {
                if (item && item.destroy) {
                  item.destroy();
                }
              });
              this.upgradeEffects[upgradeType] = null;
            }
          }
        });
        break;
        
      case 'robot':
        console.log("Activating combat drone");
        
        // Create a combat drone that follows the player and shoots enemies
        this.activateCombatDrone(player, upgradeDuration);
        
        // Show feedback to the player
        const droneText = this.scene.add.text(
          player.x,
          player.y - 60,
          "Combat Robot activated!",
          {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ff3333', // Red color for laser robot
            stroke: '#000000',
            strokeThickness: 4
          }
        );
        droneText.setOrigin(0.5);
        droneText.setDepth(100);
        
        // Fade out the text
        this.scene.tweens.add({
          targets: droneText,
          y: droneText.y - 30,
          alpha: 0,
          duration: 2000,
          onComplete: () => {
            droneText.destroy();
          }
        });
        break;
        
      case 'bulletTime':
        // If bullet time is already active, don't restart it
        if (this.activeUpgrades[upgradeType]) {
          this.activeUpgrades[upgradeType].remove();
          this.activeUpgrades[upgradeType] = null;

          if (this.upgradeEffects[upgradeType]) {
            this.upgradeEffects[upgradeType].forEach(item => {
              if (item && item.destroy) {
                item.destroy();
              }
            });
            this.upgradeEffects[upgradeType] = null;
          }
        }
        
        // Use the TimeScaleManager for bullet time if available
        if (this.scene.timeScaleManager) {
          // Activate bullet time through the manager
          this.scene.timeScaleManager.activateBulletTime();
          
          console.log("Bullet time activated through TimeScaleManager");
        } else {
          // Fallback to direct time scale manipulation
          console.warn("TimeScaleManager not available, using direct time scale manipulation");
          
          // Store original time scale if not already saved
          if (!this.scene.originalTimeScale) {
            this.scene.originalTimeScale = this.scene.time.timeScale;
          }
          
          // Store the current values before applying bullet time
          console.log(`Storing original time scales before bullet time: game=${this.scene.time.timeScale}, physics=${this.scene.physics.world.timeScale}, anims=${this.scene.anims.globalTimeScale}`);
          
          // Apply bullet time effect
          this.scene.time.timeScale = upgradeEffect;
          
          // When applying bullet time, also scale physics world to match
          // This prevents sliding and running in place issues
          this.scene.physics.world.timeScale = upgradeEffect;
          
          // Slow down all animations in the scene with a single property
          this.scene.anims.globalTimeScale = upgradeEffect;
          
          console.log(`Applied bullet time effect: ${upgradeEffect}`);
        }
        
        // Create a visual effect for stimulants
        this.upgradeEffects[upgradeType] = this.createUpgradeEffect(
          player, 
          `${upgradeEmoji}${upgradeLevel}`, 
          0x9966ff, 
          upgradeLevel
        );
        
        // Reset after duration
        this.activeUpgrades[upgradeType] = this.scene.time.delayedCall(upgradeDuration, () => {
          if (player.active) {
            // Deactivate bullet time through the manager if available
            if (this.scene.timeScaleManager) {
              this.scene.timeScaleManager.deactivateBulletTime();
              console.log("Bullet time deactivated through TimeScaleManager");
            } else {
              // Fallback to direct time scale restoration
              console.log(`BulletTime restoring to originalTimeScale: ${this.scene.originalTimeScale || 1.0}`);
              this.scene.time.timeScale = this.scene.originalTimeScale || 1.0;
              this.scene.physics.world.timeScale = this.scene.originalTimeScale || 1.0;
              this.scene.anims.globalTimeScale = 1.0;
              
              // Reset the original time scale reference
              this.scene.originalTimeScale = null;
            }
            
            // Clean up
            this.activeUpgrades[upgradeType] = null;
            
            if (this.upgradeEffects[upgradeType]) {
              this.upgradeEffects[upgradeType].forEach(item => {
                if (item && item.destroy) {
                  item.destroy();
                }
              });
              this.upgradeEffects[upgradeType] = null;
            }
          }
        });
        break;
    }
    
    // Log magazine count after applying upgrade but before destroying box
    if (this.scene.playerManager && upgradeType === 'magazine') {
      console.log(`DEBUG - AFTER upgrade application - Total magazines: ${this.scene.playerManager.totalMagazines}`);
    }
    
    // Destroy the box if it exists and is a game object - after a slight delay to show the open box
    if (isBoxGameObject) {
      // Log before tween starts
      if (upgradeType === 'magazine') {
        console.log(`DEBUG - Before box destroy tween - Box active: ${box.active}`);
      }
      
      // Create a bright flash effect where the box was collected
      const flash = this.scene.add.circle(box.x, box.y, 50, 0xffffff, 0.8);
      flash.setDepth(5);
      
      // Animate the flash outward and fade it out
      this.scene.tweens.add({
        targets: flash,
        scale: 2,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          flash.destroy();
        }
      });
      
      // Target only the box since we're not showing powerup icons
      const targets = [box];
      
      // Add a short delay before removing the box to let player see the opened box and powerup
      this.scene.time.delayedCall(400, () => {
        this.scene.tweens.add({
          targets: targets,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            if (upgradeType === 'magazine') {
              console.log(`DEBUG - In destroy callback - Box active: ${box && box.active}`);
              console.log(`DEBUG - Final magazine count: ${this.scene.playerManager.totalMagazines}`);
            }
            
            if (box && box.active) {
              box.destroy();
            }
            this.box = null;
          }
        });
      });
    }
  }
  
  // Method to create and manage a combat robot with the new sprite assets
  activateCombatDrone(player, duration) {
    // Get camera bounds for positioning the robot off-screen initially
    const camera = this.scene.cameras.main;
    const gameWidth = camera.width;
    const gameHeight = camera.height;
    
    // Calculate a random entry point from outside the camera view
    const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    let startX, startY;
    
    // Position robot off-screen based on chosen side
    switch(side) {
      case 0: // Top
        startX = camera.scrollX + Phaser.Math.Between(100, gameWidth - 100);
        startY = camera.scrollY - 100; // Above camera view
        break;
      case 1: // Right
        startX = camera.scrollX + gameWidth + 100; // Right of camera view
        startY = camera.scrollY + Phaser.Math.Between(100, gameHeight - 100);
        break;
      case 2: // Bottom
        startX = camera.scrollX + Phaser.Math.Between(100, gameWidth - 100);
        startY = camera.scrollY + gameHeight + 100; // Below camera view
        break;
      case 3: // Left
        startX = camera.scrollX - 100; // Left of camera view
        startY = camera.scrollY + Phaser.Math.Between(100, gameHeight - 100);
        break;
    }
    
    // Create the combat robot sprite off-screen initially
    const combatRobot = this.scene.add.sprite(
      startX,
      startY,
      'robot_idle_down' // Start with the down-facing sprite
    );
    
    combatRobot.setOrigin(0.5);
    combatRobot.setDepth(20);
    combatRobot.setScale(0.375); // Reduced by 25% from previous 0.5 scale
    
    // Enable physics for the robot
    this.scene.physics.world.enable(combatRobot);
    
    // Create shadows for the robot (similar to other entities)
    combatRobot.shadows = [];
    this.shadowOffsets.forEach(offset => {
      let shadow = this.scene.add.image(
        combatRobot.x + offset.x, 
        combatRobot.y + offset.y + 30,
        'shadow'
      );
      shadow.setScale(0.7);
      shadow.setAlpha(0.3 / this.shadowOffsets.length);
      shadow.setDepth(1);
      
      combatRobot.shadows.push({ sprite: shadow, offset: offset });
    });
    
    // Create a circular path around the player
    const pathRadius = 80;
    const pathSpeed = 0.015; // Slightly slower than the drone
    let pathAngle = 0;
    
    // Store initial entry position for the exit path
    const entryPosition = { x: startX, y: startY };
    
    // Track the robot's current direction
    let currentDirection = 'down';
    let isAttacking = false;
    let attackCooldown = 0;
    
    // Set up the robot's behavior states
    let robotState = 'entering'; // States: entering, orbiting, exiting
    
    // Create laser beams group for the robot
    const robotLasers = this.scene.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 20,
      allowGravity: false,
      runChildUpdate: true,
      collideWorldBounds: false
    });
    
    // Set up a timer for the robot to shoot
    const shootDelay = 600; // ms between shots (slightly slower than drone)
    let lastShootTime = 0;
    
    // Function to update the robot's sprite based on the direction to the nearest enemy
    const updateRobotDirection = (targetX, targetY) => {
      // Calculate angle to target in radians
      const angleRad = Phaser.Math.Angle.Between(
        combatRobot.x, combatRobot.y, targetX, targetY
      );
      
      // Convert to degrees for easier comparison
      const angleDeg = Phaser.Math.RadToDeg(angleRad);
      
      // Determine the direction based on angle
      let newDirection;
      
      // Define direction based on angle ranges
      if (angleDeg >= -45 && angleDeg < 45) {
        newDirection = 'side'; // Right
        combatRobot.setFlipX(false); // No flip for right side
      } else if (angleDeg >= 45 && angleDeg < 135) {
        newDirection = 'down'; // Down
      } else if (angleDeg >= -135 && angleDeg < -45) {
        newDirection = 'up'; // Up
      } else {
        newDirection = 'side'; // Left
        combatRobot.setFlipX(true); // Flip for left side
      }
      
      // Add corner directions for more precise facing
      if (angleDeg >= 0 && angleDeg < 45) {
        newDirection = 'down_corner'; // Down-right
        combatRobot.setFlipX(false);
      } else if (angleDeg >= 135 || angleDeg < -135) {
        newDirection = 'down_corner'; // Down-left
        combatRobot.setFlipX(true);
      } else if (angleDeg >= -45 && angleDeg < 0) {
        newDirection = 'up_corner'; // Up-right
        combatRobot.setFlipX(false);
      } else if (angleDeg >= -135 && angleDeg < -45) {
        newDirection = 'up_corner'; // Up-left
        combatRobot.setFlipX(true);
      }
      
      // Only update texture if direction changed or attack state changed
      if (newDirection !== currentDirection || isAttacking !== (attackCooldown > 0)) {
        currentDirection = newDirection;
        isAttacking = attackCooldown > 0;
        
        // Set the appropriate texture based on direction and attack state
        const state = isAttacking ? 'attack' : 'idle';
        const textureKey = `robot_${state}_${currentDirection}`;
        
        combatRobot.setTexture(textureKey);
      }
    };
    
    // Function to make the robot shoot laser at the nearest enemy
    const shootAtEnemy = (time) => {
      if (time - lastShootTime < shootDelay) return;
      
      // Only shoot if in orbiting state
      if (robotState !== 'orbiting') return;
      
      // Find the nearest enemy
      const enemies = this.scene.enemyManager.getEnemies();
      if (!enemies || !enemies.getChildren || enemies.getChildren().length === 0) return;
      
      let nearestEnemy = null;
      let minDistance = Number.MAX_VALUE;
      
      enemies.getChildren().forEach(enemy => {
        if (enemy.active) {
          const distance = Phaser.Math.Distance.Between(
            combatRobot.x, combatRobot.y, enemy.x, enemy.y
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestEnemy = enemy;
          }
        }
      });
      
      // If we found an enemy, shoot a laser at it
      if (nearestEnemy) {
        // Update robot's facing direction
        updateRobotDirection(nearestEnemy.x, nearestEnemy.y);
        
        // Only shoot if enemy is within range
        if (minDistance < 300) {
          lastShootTime = time;
          attackCooldown = 200; // Set the attack animation duration
          
          // Calculate angle to enemy
          const angle = Phaser.Math.Angle.Between(
            combatRobot.x, combatRobot.y, nearestEnemy.x, nearestEnemy.y
          );
          
          // Create a laser beam (using bullet sprite but changing appearance)
          const laser = robotLasers.get(combatRobot.x, combatRobot.y);
          if (laser) {
            laser.setActive(true);
            laser.setVisible(true);
            laser.enableBody(true, combatRobot.x, combatRobot.y, true, true);
            
            laser.setRotation(angle);
            laser.setScale(0.8, 0.6); // Thinner for laser-like appearance
            
            // Set laser color to bright red
            laser.setTint(0xff0000);
            
            // Higher speed for laser beam
            const laserSpeed = 800;
            laser.body.velocity.x = Math.cos(angle) * laserSpeed;
            laser.body.velocity.y = Math.sin(angle) * laserSpeed;
            
            laser.setDepth(15);
            laser.damageMultiplier = 1.2; // Slightly more powerful than regular bullets
            
            // Create laser beam trail effect
            const trailLength = 20;
            const trailWidth = 2;
            const laserTrail = this.scene.add.rectangle(
              combatRobot.x, combatRobot.y,
              trailLength, trailWidth, 
              0xff0000, 0.7
            );
            laserTrail.setOrigin(0, 0.5);
            laserTrail.setRotation(angle);
            laserTrail.setDepth(14);
            
            // Add the trail to the laser for cleanup
            laser.trail = laserTrail;
            
            // Update trail position in a timer
            const trailUpdate = this.scene.time.addEvent({
              delay: 16,
              callback: () => {
                if (laser.active && laserTrail.active) {
                  laserTrail.x = laser.x;
                  laserTrail.y = laser.y;
                  laserTrail.rotation = laser.rotation;
                } else {
                  trailUpdate.remove();
                  laserTrail.destroy();
                }
              },
              loop: true
            });
            
            // Play laser shoot sound (different from regular weapon)
            if (this.scene.playerManager.shotSound) {
              this.scene.playerManager.shotSound.play({ volume: 0.3, rate: 1.5 }); // Higher pitch for laser sound
            }
            
            // Add auto-destruction timer for the laser after 1 second if it doesn't hit anything
            this.scene.time.delayedCall(1000, () => {
              if (laser.active) {
                laser.setActive(false);
                laser.setVisible(false);
                if (laser.trail) {
                  laser.trail.destroy();
                }
              }
            });
          }
        }
      }
    };
    
    // Process collision between robot lasers and enemies
    const handleLaserEnemyCollision = (laser, enemy) => {
      if (laser.active && enemy.active) {
        // Disable the laser
        laser.setActive(false);
        laser.setVisible(false);
        laser.body.enable = false;
        
        // Destroy the trail
        if (laser.trail) {
          laser.trail.destroy();
        }
        
        // Use the EnemyManager's hitEnemy method
        this.scene.enemyManager.hitEnemy(laser, enemy, () => {
          // Update kill count and money when enemy is destroyed
          if (this.scene.ui) {
            this.scene.ui.updateKillCount();
            this.scene.ui.updateMoney(0.05); // Add a small amount of money for robot kills
          }
        });
      }
    };
    
    // Add collision between robot lasers and enemies
    this.scene.physics.add.collider(
      robotLasers,
      this.scene.enemyManager.getEnemies(),
      handleLaserEnemyCollision
    );
    
    // Add hover animation to make the robot float
    this.scene.tweens.add({
      targets: combatRobot,
      y: combatRobot.y - 10,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
    
    // Show feedback to the player
    const droneText = this.scene.add.text(
      player.x,
      player.y - 60,
      "Combat Robot inbound!",
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ff3333',
        stroke: '#000000',
        strokeThickness: 4
      }
    );
    droneText.setOrigin(0.5);
    droneText.setDepth(100);
    
    // Fade out the text
    this.scene.tweens.add({
      targets: droneText,
      y: droneText.y - 30,
      alpha: 0,
      duration: 2000,
      onComplete: () => {
        droneText.destroy();
      }
    });
    
    // No need for a midpoint calculation as we'll fly directly to orbit position
    
    // Update function for the robot
    const updateRobot = (time) => {
      if (!player.active || !combatRobot.active) return;
      
      // Update behavior based on state
      switch (robotState) {
        case 'entering':
          // Entry path is already handled via tween
          break;
          
        case 'orbiting':
          // Move robot in a circular path around the player
          pathAngle += pathSpeed;
          
          // Calculate the new position in the orbit
          const newX = player.x + Math.cos(pathAngle) * pathRadius;
          const newY = player.y + Math.sin(pathAngle) * pathRadius;
          
          // Apply the position - this gradual movement prevents teleportation
          combatRobot.x = newX;
          combatRobot.y = newY;
          break;
          
        case 'exiting':
          // Exit path is already handled via tween
          break;
      }
      
      // Update shadows to follow the robot
      if (combatRobot.shadows) {
        combatRobot.shadows.forEach(shadowData => {
          shadowData.sprite.x = combatRobot.x + shadowData.offset.x;
          shadowData.sprite.y = combatRobot.y + shadowData.offset.y + 30;
        });
      }
      
      // Decrement attack cooldown
      if (attackCooldown > 0) {
        attackCooldown -= 16; // Assuming ~60fps
      }
      
      // Find nearest enemy for direction facing
      const enemies = this.scene.enemyManager.getEnemies();
      if (enemies && enemies.getChildren && enemies.getChildren().length > 0) {
        let nearestEnemy = null;
        let minDistance = Number.MAX_VALUE;
        
        enemies.getChildren().forEach(enemy => {
          if (enemy.active) {
            const distance = Phaser.Math.Distance.Between(
              combatRobot.x, combatRobot.y, enemy.x, enemy.y
            );
            
            if (distance < minDistance) {
              minDistance = distance;
              nearestEnemy = enemy;
            }
          }
        });
        
        if (nearestEnemy) {
          updateRobotDirection(nearestEnemy.x, nearestEnemy.y);
        }
      } else {
        // Default facing direction based on movement
        if (robotState === 'entering') {
          // Face toward player when entering
          updateRobotDirection(player.x, player.y);
        } else if (robotState === 'exiting') {
          // Face toward exit point when leaving
          updateRobotDirection(entryPosition.x, entryPosition.y);
        } else {
          // Default facing while orbiting
          updateRobotDirection(player.x, player.y - 100);
        }
      }
      
      // Make the robot shoot at enemies
      shootAtEnemy(time);
    };
    
    // Add the update function to the scene's update event
    const updateListener = this.scene.events.on('update', updateRobot);
    
    // Calculate a starting orbit angle based on entry direction
    // This helps create a smooth transition from entry to orbit
    let initialOrbitAngle;
    if (side === 0) { // Top
      initialOrbitAngle = 270 * (Math.PI / 180); // Start from top (270 degrees)
    } else if (side === 1) { // Right
      initialOrbitAngle = 0 * (Math.PI / 180); // Start from right (0 degrees)
    } else if (side === 2) { // Bottom
      initialOrbitAngle = 90 * (Math.PI / 180); // Start from bottom (90 degrees)
    } else { // Left
      initialOrbitAngle = 180 * (Math.PI / 180); // Start from left (180 degrees)
    }
    
    // Calculate the orbit position to fly directly to
    const orbitX = player.x + Math.cos(initialOrbitAngle) * pathRadius;
    const orbitY = player.y + Math.sin(initialOrbitAngle) * pathRadius;
    
    // First tween: fly in from off-screen directly to the orbit position
    this.scene.tweens.add({
      targets: combatRobot,
      x: orbitX,
      y: orbitY,
      duration: 1500,
      ease: 'Quad.Out',
      onComplete: () => {
        // Keep the robot stationary for a moment and face the player
        updateRobotDirection(player.x, player.y);
        
        // Start with the current position as the orbit angle
        // Calculate the exact angle from player to current position
        pathAngle = Math.atan2(combatRobot.y - player.y, combatRobot.x - player.x);
        
        // Begin a smooth transition to perfect orbit if not already in it
        const perfectOrbitX = player.x + Math.cos(pathAngle) * pathRadius;
        const perfectOrbitY = player.y + Math.sin(pathAngle) * pathRadius;
        
        // Check if we need to adjust position to be on perfect orbit
        const distance = Phaser.Math.Distance.Between(combatRobot.x, combatRobot.y, perfectOrbitX, perfectOrbitY);
        
        if (distance > 5) {
          // Small adjustment tween to ensure robot is precisely on orbit path
          this.scene.tweens.add({
            targets: combatRobot,
            x: perfectOrbitX,
            y: perfectOrbitY,
            duration: 300,
            ease: 'Sine.Out',
            onComplete: () => {
              // Now transition to orbiting state
              robotState = 'orbiting';
            }
          });
        } else {
          // Already in perfect orbit position, just start orbiting
          robotState = 'orbiting';
        }
        
        // Set up a timer to trigger the exit sequence
        this.scene.time.delayedCall(duration - 2000, () => {
          // Start the exit sequence
          robotState = 'exiting';
          
          // Calculate exit point (going back to the same side of entry)
          const camera = this.scene.cameras.main;
          const exitX = camera.scrollX + (side === 1 ? camera.width + 100 : (side === 3 ? -100 : Phaser.Math.Between(100, camera.width - 100)));
          const exitY = camera.scrollY + (side === 0 ? -100 : (side === 2 ? camera.height + 100 : Phaser.Math.Between(100, camera.height - 100)));
          
          // Final tween: fly out to exit point
          this.scene.tweens.add({
            targets: combatRobot,
            x: exitX,
            y: exitY,
            duration: 2000,
            ease: 'Quad.In',
            onComplete: () => {
              // Remove the update listener
              this.scene.events.off('update', updateListener);
              
              // Clean up shadows
              if (combatRobot.shadows) {
                combatRobot.shadows.forEach(shadowData => {
                  if (shadowData.sprite) {
                    shadowData.sprite.destroy();
                  }
                });
              }
              
              // Clean up robot
              combatRobot.destroy();
              
              // Clean up lasers
              robotLasers.getChildren().forEach(laser => {
                if (laser.trail) {
                  laser.trail.destroy();
                }
              });
              robotLasers.clear(true, true);
              
              // Clean up the robot upgrade effect
              this.activeUpgrades['robot'] = null;
            }
          });
        });
      }
    });
  }

  createUpgradeEffect(player, emoji, color, level = 1) {
    // Get the AmmoDisplay from the scene
    const playerManager = this.scene.playerManager;
    let ammoDisplay = null;
    
    if (playerManager && playerManager.ammoDisplay) {
      ammoDisplay = playerManager.ammoDisplay;
    } else {
      console.warn("AmmoDisplay not found in PlayerManager");
    }
    
    // Create brief pickup effect above player
    const pickupText = this.scene.add.text(
      player.x, 
      player.y - 30, 
      emoji, 
      { 
        fontSize: '24px' 
      }
    );
    pickupText.setOrigin(0.5);
    pickupText.setDepth(10);
    
    // Create a very brief flash animation and then remove
    this.scene.tweens.add({
      targets: pickupText,
      y: pickupText.y - 40,
      alpha: 0,
      scale: 1.5,
      duration: 800,
      onComplete: () => {
        pickupText.destroy();
      }
    });
    
    // Get the upgrade type from the emoji (assuming emoji format contains the type)
    let upgradeType = '';
    if (emoji.includes('👟')) upgradeType = 'speed';
    else if (emoji.includes('🔥')) upgradeType = 'fireRate';
    else if (emoji.includes('🛡️')) upgradeType = 'armor';
    else if (emoji.includes('💊')) upgradeType = 'bulletTime';
    else if (emoji.includes('🔫')) upgradeType = 'shotgun';
    else if (emoji.includes('🤖')) upgradeType = 'robot';
    else if (emoji.includes('📦')) upgradeType = 'magazine';
    
    // Create indicators in the ammo display
    if (ammoDisplay && upgradeType !== 'armor') { // Don't add indicator for shield/armor
      ammoDisplay.addUpgradeIndicator(upgradeType, emoji, color);
      // Return reference to the indicator for removal
      return [{
        destroy: () => {
          if (ammoDisplay) {
            ammoDisplay.removeUpgradeIndicator(upgradeType);
          }
        }
      }];
    }
    
    // If no ammo display, return an empty array that supports cleanup
    return [{
      destroy: () => { /* Nothing to clean up */ }
    }];
  }
  
  // Helper method to clean up effect elements
  cleanupEffects(effectElements) {
    if (!effectElements) return;
    
    effectElements.forEach(element => {
      if (element && element.destroy) {
        element.destroy();
      }
    });
  }

  showUpgradeExpiredText(player, message) {
    // Empty method - text notifications removed
  }

  // Start periodic enemy drone spawns
  startEnemyDroneSpawning() {
    if (this.enemyDroneEnabled) {
      console.log("Enemy drone spawning already enabled");
      return;
    }
    
    console.log("Enabling periodic enemy drone spawning");
    this.enemyDroneEnabled = true;
    
    // Start the timer for first enemy drone spawn check
    this.scheduleNextEnemyDrone();
  }
  
  // Stop periodic enemy drone spawns
  stopEnemyDroneSpawning() {
    console.log("Disabling enemy drone spawning");
    this.enemyDroneEnabled = false;
    
    // Clear any existing timer
    if (this.enemyDroneTimer) {
      this.enemyDroneTimer.remove();
      this.enemyDroneTimer = null;
    }
  }
  
  // Schedule the next enemy drone spawn check
  scheduleNextEnemyDrone() {
    // Clear any existing timer
    if (this.enemyDroneTimer) {
      this.enemyDroneTimer.remove();
    }
    
    // Only schedule if enemy drone spawning is enabled
    if (!this.enemyDroneEnabled) return;
    
    // Set up timer for next check
    this.enemyDroneTimer = this.scene.time.delayedCall(this.enemyDroneInterval, () => {
      if (!this.enemyDroneEnabled) return;
      
      // 50% chance to spawn enemy drone
      if (Math.random() < 0.5) {
        console.log("Random enemy drone spawn triggered");
        this.sendEnemyDrone();
      } else {
        console.log("Enemy drone spawn check - not spawning this time");
      }
      
      // Schedule next check regardless of whether a drone was spawned
      this.scheduleNextEnemyDrone();
    });
  }
  
  // Send enemy drone with proximity mine
  sendEnemyDrone() {
    // Skip only if enemy drone is already active, allow enemy drone when player drone is active
    if (this.enemyDrone) {
      console.log("Cannot send enemy drone - enemy drone already active");
      return;
    }
    
    console.log("Sending enemy drone with proximity mine");
    
    // Get player position
    const player = this.scene.playerManager.getPlayer();
    if (!player) {
      return;
    }
    
    // Set screen dimensions
    const gameWidth = this.scene.cameras.main.width;
    const gameHeight = this.scene.cameras.main.height;
    
    // Randomly choose which side to enter from
    const side = Math.floor(Math.random() * 4);
    let startX, startY, endX, endY;
    
    // Calculate drop point with intentional offset from player
    // We want to drop slightly away from player for fairer gameplay
    const dropX = player.x + Phaser.Math.Between(-200, 200);
    const dropY = player.y + Phaser.Math.Between(-200, 200);
    
    // Keep drop point within game bounds
    const boundedDropX = Phaser.Math.Clamp(dropX, 100, gameWidth - 100);
    const boundedDropY = Phaser.Math.Clamp(dropY, 100, gameHeight - 100);
    
    // Set drone entry and exit points based on chosen side
    switch(side) {
      case 0: // Top
        startX = Phaser.Math.Between(100, gameWidth - 100);
        startY = -100;
        endX = startX;
        endY = -100;
        break;
      case 1: // Right
        startX = gameWidth + 100;
        startY = Phaser.Math.Between(100, gameHeight - 100);
        endX = gameWidth + 100;
        endY = startY;
        break;
      case 2: // Bottom
        startX = Phaser.Math.Between(100, gameWidth - 100);
        startY = gameHeight + 100;
        endX = startX;
        endY = gameHeight + 100;
        break;
      case 3: // Left
        startX = -100;
        startY = Phaser.Math.Between(100, gameHeight - 100);
        endX = -100;
        endY = startY;
        break;
    }
    
    // Create the enemy drone sprite (using dedicated enemy drone assets)
    this.enemyDrone = this.scene.physics.add.sprite(startX, startY, 'enemy_drone_anim_1');
    this.enemyDrone.setScale(0.25);
    this.enemyDrone.setDepth(100);
    this.enemyDrone.play('enemy_drone_hover');
    
    // Add warning text to the scene
    const warningText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      80,
      "⚠️ ENEMY DRONE INCOMING ⚠️", 
      {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ff0000',
        stroke: '#000000',
        strokeThickness: 4
      }
    );
    warningText.setOrigin(0.5);
    warningText.setScrollFactor(0);
    warningText.setDepth(200);
    
    // Make warning text flash
    this.scene.tweens.add({
      targets: warningText,
      alpha: 0.3,
      duration: 300,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        warningText.destroy();
      }
    });
    
    // Create shadows for the drone
    this.enemyDrone.shadows = [];
    this.shadowOffsets.forEach(offset => {
      let shadow = this.scene.add.image(
        this.enemyDrone.x + offset.x, 
        this.enemyDrone.y + offset.y + 50, 
        'shadow'
      );
      shadow.setScale(1.0);
      shadow.setAlpha(0.3 / this.shadowOffsets.length);
      shadow.setDepth(1);
      
      this.enemyDrone.shadows.push({ sprite: shadow, offset: offset });
    });
    
    // Play drone sound with slightly higher pitch for enemy drone
    let droneSound = null;
    if (this.scene.cache.audio.exists('drone_buzz')) {
      droneSound = this.scene.sound.add('drone_buzz', { 
        volume: this.minDroneVolume,
        loop: true,
        rate: 1.2 // Higher pitch for enemy drone
      });
      droneSound.play();
    }
    
    // Drone movement - entry
    this.scene.tweens.add({
      targets: this.enemyDrone,
      x: boundedDropX,
      y: boundedDropY - 50,
      scale: 0.25,
      duration: 1800,
      ease: 'Quad.InOut',
      onComplete: () => {
        // Landing sequence
        this.scene.tweens.add({
          targets: this.enemyDrone,
          y: boundedDropY,
          scale: 0.23,
          duration: 600,
          ease: 'Quad.Out',
          onComplete: () => {
            // Deploy proximity mine
            this.dropProximityMine(boundedDropX, boundedDropY);
            
            // Take off
            this.scene.tweens.add({
              targets: this.enemyDrone,
              y: boundedDropY - 80,
              scale: 0.25,
              duration: 700,
              ease: 'Cubic.Out',
              onComplete: () => {
                // Exit path
                this.scene.tweens.add({
                  targets: this.enemyDrone,
                  x: endX,
                  y: endY,
                  scale: 0.25,
                  duration: 1500,
                  ease: 'Quad.In',
                  onComplete: () => {
                    // Clean up drone
                    if (droneSound) {
                      droneSound.stop();
                      droneSound.destroy();
                    }
                    
                    // Destroy shadows
                    if (this.enemyDrone.shadows) {
                      this.enemyDrone.shadows.forEach(shadowData => {
                        if (shadowData.sprite) {
                          shadowData.sprite.destroy();
                        }
                      });
                    }
                    
                    this.enemyDrone.destroy();
                    this.enemyDrone = null;
                    
                    // If periodic enemy drone spawning is enabled,
                    // consider scheduling the next one immediately
                    if (this.enemyDroneEnabled) {
                      console.log("Enemy drone complete - continuing with scheduled spawning");
                    }
                  }
                });
              }
            });
          }
        });
      }
    });
  }
  
  // Drop a proximity mine
  dropProximityMine(x, y) {
    // Create the proximity mine
    const mine = this.scene.physics.add.sprite(x, y, 'powerup_box_closed');
    mine.setOrigin(0.5);
    mine.setDepth(3);
    mine.setScale(0.4);
    mine.setTint(0x111111); // Black tint for enemy mine
    mine.isProximityMine = true; // Flag as a proximity mine
    
    // Add physics body with a much larger collision area for better triggering
    this.scene.physics.world.enable(mine);
    mine.body.setSize(mine.width * 1.0, mine.height * 1.0); // Doubled from 0.5 to 1.0
    
    // Create a visible trigger radius indicator - will be resized to match physics body
    const triggerRadius = this.scene.add.circle(x, y, 50, 0xff0000, 0.2);
    triggerRadius.setDepth(2); // Just below the mine
    mine.triggerRadius = triggerRadius;
    
    // Add pulsating animation to the trigger radius
    this.scene.tweens.add({
      targets: triggerRadius,
      alpha: 0.05,
      scale: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Add a bomb emoji indicator
    const bombEmoji = this.scene.add.text(x, y - 15, '💣', { fontSize: '20px' });
    bombEmoji.setOrigin(0.5);
    bombEmoji.setDepth(4);
    mine.bombEmoji = bombEmoji;
    
    // Simple bounce animation
    this.scene.tweens.add({
      targets: mine,
      y: y + 10,
      duration: 500,
      ease: 'Bounce.Out'
    });
    
    // Add a pulsing effect for increased visibility
    this.scene.tweens.add({
      targets: [mine, bombEmoji],
      alpha: 0.6,
      duration: 500,
      yoyo: true,
      repeat: -1
    });
    
    // Add pulsating red light 
    const blinkingLight = this.scene.add.graphics();
    blinkingLight.fillStyle(0xff0000, 0.9); // Brighter red for more contrast against black
    blinkingLight.fillCircle(0, 0, 5);
    blinkingLight.setPosition(x, y - 5);
    blinkingLight.setDepth(4);
    mine.blinkingLight = blinkingLight;
    
    // Make the light pulse (more dramatic than simple blinking)
    this.scene.tweens.add({
      targets: blinkingLight,
      alpha: 0.2,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Also make the light size pulse for more dramatic effect
    this.scene.tweens.add({
      targets: blinkingLight,
      scaleX: 0.7,
      scaleY: 0.7,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Use Phaser's built-in physics overlap for more reliable triggering
    // Get the player sprite
    const player = this.scene.playerManager.getPlayer();
    
    // Create an overlap detector between player and mine with expanded collision
    const overlapCollider = this.scene.physics.add.overlap(player, mine, () => {
      // Only process once - remove the overlap detector first
      this.scene.physics.world.removeCollider(overlapCollider);
      
      // Trigger the mine
      this.triggerMine(mine);
    });
    
    // Make the trigger radius match the actual physics body size for visual accuracy
    if (mine.triggerRadius) {
      // Calculate visual radius based on the physics body size
      const physicsBodyRadius = Math.max(mine.body.width, mine.body.height) / 2;
      mine.triggerRadius.setRadius(physicsBodyRadius);
    }
    
    // Store the collider for cleanup
    mine.overlapCollider = overlapCollider;
    
    // Add to the scene's loot group 
    this.scene.lootGroup.add(mine);
    
    // If the mine is not triggered after 20 seconds, detonate automatically
    this.scene.time.delayedCall(20000, () => {
      if (mine && !mine.hasExploded && !mine.isDetonating) {
        console.log("Auto-detonating mine after timeout");
        
        // Set hasExploded flag to prevent duplicates
        mine.hasExploded = true;
        
        // Remove the collider before detonating to avoid double triggering
        if (mine.overlapCollider) {
          try {
            this.scene.physics.world.removeCollider(mine.overlapCollider);
          } catch (e) {
            console.warn("Error removing collider during auto-detonation:", e);
          }
        }
        
        this.detonateMine(mine);
      }
    });
    
    console.log("Proximity mine dropped at", x, y);
  }
  
  // Trigger the mine with escalating beeps before detonation
  triggerMine(mine) {
    if (!mine) return;
    
    // Add a custom flag to track explosion state - only detonate once
    if (mine.hasExploded) {
      console.log("Mine already exploded, skipping duplicate trigger");
      return;
    }
    
    console.log(`Mine triggered by player at ${mine.x}, ${mine.y}`);
    
    // Flag to indicate this mine was triggered by player proximity
    mine.triggeredByPlayer = true;
    
    // Set explosion flag to prevent duplicate detonations
    mine.hasExploded = true;
    
    // Ensure mine is visible
    if (mine.alpha < 1) {
      mine.alpha = 1;
    }
    if (mine.bombEmoji && mine.bombEmoji.alpha < 1) {
      mine.bombEmoji.alpha = 1;
    }
    
    // Function to play beep sound at specified volume and rate
    const playBeep = (volume = 0.7, rate = 1.0) => {
      if (this.scene.cache.audio.exists('mine_beep')) {
        const beepSound = this.scene.sound.add('mine_beep', { 
          volume: volume,
          rate: rate
        });
        beepSound.play();
      } else {
        console.warn('mine_beep sound not found for mine trigger');
      }
    };
    
    // Speed up pulsating and make light bright red
    if (mine.blinkingLight) {
      // Kill all existing tweens on the blinking light
      this.scene.tweens.killTweensOf(mine.blinkingLight);
      
      // Increase the light size dramatically
      mine.blinkingLight.clear();
      mine.blinkingLight.fillStyle(0xff0000, 1.0); // Full bright red
      mine.blinkingLight.fillCircle(0, 0, 8); // Bigger circle
    }
    
    // If we have a trigger radius, make it flash faster
    if (mine.triggerRadius) {
      this.scene.tweens.killTweensOf(mine.triggerRadius);
      this.scene.tweens.add({
        targets: mine.triggerRadius,
        alpha: 0.3,
        scale: 1.0,
        duration: 111, // Match the shortest beep interval
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
    
    // Structured sequence of beeps with decreasing intervals before explosion
    // Initial beep
    playBeep(0.7, 1.0);
    
    // Second beep after 333ms
    this.scene.time.delayedCall(333, () => {
      playBeep(0.75, 1.1);
      
      // Apply a small shake to the mine
      this.scene.tweens.add({
        targets: mine,
        x: mine.x + 2,
        duration: 50,
        yoyo: true,
        repeat: 1
      });
      
      // Third beep after 222ms
      this.scene.time.delayedCall(222, () => {
        playBeep(0.8, 1.2);
        
        // Apply a more noticeable shake
        this.scene.tweens.add({
          targets: mine,
          x: mine.x + 3,
          duration: 40,
          yoyo: true,
          repeat: 1
        });
        
        // Fourth beep after 111ms
        this.scene.time.delayedCall(111, () => {
          playBeep(0.85, 1.3);
          
          // Apply an even more noticeable shake
          this.scene.tweens.add({
            targets: mine,
            x: mine.x + 4,
            duration: 30,
            yoyo: true,
            repeat: 1
          });
          
          // Fifth beep after 55ms
          this.scene.time.delayedCall(55, () => {
            playBeep(0.9, 1.4);
            
            // Stronger shake
            this.scene.tweens.add({
              targets: mine,
              x: mine.x + 5,
              duration: 25,
              yoyo: true,
              repeat: 1
            });
            
            // Sixth beep after 22ms (the final beep)
            this.scene.time.delayedCall(22, () => {
              playBeep(0.95, 1.5);
              
              // Final violent shake
              this.scene.tweens.add({
                targets: mine,
                x: mine.x + 6,
                duration: 20,
                yoyo: true,
                repeat: 1
              });
              
              // Detonate after the final beep with a small delay
              this.scene.time.delayedCall(22, () => {
                if (mine) {
                  console.log("About to detonate after beep sequence");
                  this.detonateMine(mine);
                }
              });
            });
          });
        });
      });
    });
    
    // SAFETY: Add guaranteed fallback detonation in case animations fail
    // Using 1000ms which is enough for the shorter sequence
    this.scene.time.delayedCall(1000, () => {
      if (mine && !mine.isDetonating) {
        console.log("Fallback forced detonation triggered for mine");
        this.detonateMine(mine);
      }
    });
  }
  
  // Detonate the proximity mine
  detonateMine(mine) {
    if (!mine) return;
    
    // Use the hasExploded flag to prevent duplicate explosions
    // This flag is more reliable than checking mine.active
    if (mine.isDetonating) {
      console.log("Mine is already in the process of detonation, skipping duplicate");
      return; 
    }
    
    // Set flag to prevent re-entry during the detonation process
    mine.isDetonating = true;
    
    // Get position before destroying mine (store separately from mine object)
    const x = mine.x;
    const y = mine.y;
    
    // Get player triggered status before destroying the mine
    const triggeredByPlayer = mine.triggeredByPlayer || false;
    
    console.log(`Actually detonating mine now at ${x}, ${y}, triggered by player: ${triggeredByPlayer}`);
    
    // Play explosion sound for mine detonation
    if (this.scene.cache.audio.exists('mine_explosion')) {
      this.scene.sound.play('mine_explosion', { volume: 1.0 });
    } else {
      console.warn('mine_explosion sound not found, falling back to shot sound');
      if (this.scene.cache.audio.exists('shot')) {
        this.scene.sound.play('shot', { volume: 1.0 });
      }
    }
    
    // Remove the physics overlap detector if it exists
    if (mine.overlapCollider) {
      try {
        this.scene.physics.world.removeCollider(mine.overlapCollider);
      } catch (e) {
        console.warn("Error removing collider:", e);
      }
      mine.overlapCollider = null;
    }
    
    // Ensure all tweens on the mine and its elements are stopped
    try {
      this.scene.tweens.killTweensOf(mine);
      if (mine.bombEmoji) this.scene.tweens.killTweensOf(mine.bombEmoji);
      if (mine.blinkingLight) this.scene.tweens.killTweensOf(mine.blinkingLight);
      if (mine.triggerRadius) this.scene.tweens.killTweensOf(mine.triggerRadius);
    } catch (e) {
      console.warn("Error killing tweens:", e);
    }
    
    // Clean up mine elements - without active checks to ensure they're removed
    try {
      if (mine.bombEmoji) {
        mine.bombEmoji.destroy();
      }
      
      if (mine.blinkingLight) {
        mine.blinkingLight.destroy();
      }
      
      if (mine.triggerRadius) {
        mine.triggerRadius.destroy();
      }
      
      // Remove the old update listener if it exists (for backward compatibility)
      if (mine.updateListener) {
        this.scene.events.off('update', mine.updateListener);
      }
      
      // Make sure to remove from parent group first if it exists
      if (mine.parentContainer) {
        mine.parentContainer.remove(mine);
      }
      
      // Remove from loot group if it exists
      if (this.scene.lootGroup && this.scene.lootGroup.contains(mine)) {
        this.scene.lootGroup.remove(mine);
      }
      
      // Finally destroy the mine object itself
      mine.destroy();
    } catch (e) {
      console.warn("Error during mine cleanup:", e);
    }
    
    // Create explosion effect - pass the triggered flag to potentially adjust the animation
    this.createExplosion(x, y, triggeredByPlayer);
    
    // Create damage radius to hurt player if in range
    this.createDamageRadius(x, y);
  }
  
  // Create visual explosion effect
  createExplosion(x, y, triggeredByPlayer = false) {
    // Create a bright flash
    const flash = this.scene.add.circle(x, y, 100, 0xffff00, 0.8);
    flash.setDepth(10);
    
    // Flash animation - bigger flash for player-triggered explosions
    this.scene.tweens.add({
      targets: flash,
      scale: triggeredByPlayer ? 2.2 : 1.8, // Larger flash for player-triggered explosions
      alpha: 0,
      duration: 300,
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // *** IMPORTANT: Make sure explosion animation works for player-triggered mines ***
    // Create a manual fallback explosion if we know the textures exist
    this.createManualExplosion(x, y, triggeredByPlayer);
    
    // Create particles for explosion effect
    const mainSmoke = this.addSmokeEffect(x, y, triggeredByPlayer);
    
    // For player-triggered explosions, add additional visual effects
    if (triggeredByPlayer) {
      // Add more smoke for player-triggered explosions
      for (let i = 0; i < 3; i++) {
        const offsetX = Phaser.Math.Between(-30, 30);
        const offsetY = Phaser.Math.Between(-30, 30);
        this.addSmokeEffect(x + offsetX, y + offsetY, true);
      }
      
      // Add additional particles
      this.addExplosionParticles(x, y, 80);
    } else {
      // Standard particles for timeout explosion
      this.addExplosionParticles(x, y, 50);
    }
  }
  
  // Create a manual explosion animation (reliable fallback)
  createManualExplosion(x, y, isPlayerTriggered) {
    // Primary explosion - using bigger scale for player-triggered explosions
    this.createExplosionSequence(x, y, 'big', isPlayerTriggered ? 1.7 : 1.5);
    
    // Secondary explosions for player-triggered mines
    if (isPlayerTriggered) {
      const offset1X = Phaser.Math.Between(-40, 40);
      const offset1Y = Phaser.Math.Between(-40, 40);
      this.scene.time.delayedCall(150, () => {
        this.createExplosionSequence(x + offset1X, y + offset1Y, 'medium', 1.2);
      });
      
      const offset2X = Phaser.Math.Between(-50, 50);
      const offset2Y = Phaser.Math.Between(-50, 50);
      this.scene.time.delayedCall(250, () => {
        this.createExplosionSequence(x + offset2X, y + offset2Y, 'small', 0.85);
      });
    }
  }
  
  // Create a single explosion frame sequence
  createExplosionSequence(x, y, sizeType, scale) {
    // Define the texture keys to use
    let textureKeys = [];
    
    // Use the correct texture keys that match what's loaded in AssetLoader.js
    if (sizeType === 'big') {
      for (let i = 1; i <= 8; i++) {
        textureKeys.push(`explosion_big_${i}`);
      }
    } else if (sizeType === 'medium') {
      for (let i = 1; i <= 8; i++) {
        textureKeys.push(`explosion_medium_${i}`);
      }
    } else {
      for (let i = 1; i <= 8; i++) {
        textureKeys.push(`explosion_small_${i}`);
      }
    }
    
    // Function to show the next frame in sequence
    const showNextFrame = (index) => {
      // If we've shown all frames, we're done
      if (index >= textureKeys.length) return;
      
      const texture = textureKeys[index];
      
      // Check if the texture exists
      if (this.scene.textures.exists(texture)) {
        // Create sprite for this frame
        const frame = this.scene.add.sprite(x, y, texture);
        frame.setScale(scale);
        frame.setDepth(15);
        frame.setOrigin(0.5);
        
        // Show this frame briefly
        this.scene.time.delayedCall(70, () => {
          frame.destroy();
          // Show the next frame
          showNextFrame(index + 1);
        });
      } else {
        // Skip this frame if texture doesn't exist and go to next
        console.warn(`Explosion texture not found: ${texture}`);
        showNextFrame(index + 1);
      }
    };
    
    // Start the sequence with the first frame
    showNextFrame(0);
  }
  
  // Add explosion particles
  addExplosionParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 70;
      
      const particle = this.scene.add.circle(
        x, 
        y, 
        3 + Math.random() * 4, 
        Phaser.Display.Color.GetColor(
          255, 
          Math.floor(100 + Math.random() * 155), 
          0
        ), 
        0.8
      );
      
      particle.setDepth(9);
      
      // Animate particle
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.1,
        duration: 500 + Math.random() * 500,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
  
  // Add smoke effect
  addSmokeEffect(x, y, isPlayerTriggered) {
    const smokeParticles = [];
    
    const smokeCount = isPlayerTriggered ? 12 : 8;
    
    for (let i = 0; i < smokeCount; i++) {
      const smokeParticle = this.scene.add.circle(
        x + Phaser.Math.Between(-10, 10), 
        y + Phaser.Math.Between(-10, 10), 
        15 + Math.random() * 25, 
        0x333333, 
        0.4
      );
      
      smokeParticle.setDepth(8);
      
      // Calculate random offset for smoke movement
      const smokeOffsetRange = isPlayerTriggered ? 50 : 40;
      const smokeOffsetX = Phaser.Math.Between(-smokeOffsetRange, smokeOffsetRange);
      const smokeOffsetY = Phaser.Math.Between(-smokeOffsetRange, smokeOffsetRange);
      
      // Animate smoke - longer lasting for player-triggered
      this.scene.tweens.add({
        targets: smokeParticle,
        x: smokeParticle.x + smokeOffsetX,
        y: smokeParticle.y + smokeOffsetY,
        alpha: 0,
        scale: 2 + Math.random() * (isPlayerTriggered ? 1 : 0.5),
        duration: 1000 + Math.random() * (isPlayerTriggered ? 1500 : 1000),
        ease: 'Sine.Out',
        onComplete: () => {
          smokeParticle.destroy();
        }
      });
      
      smokeParticles.push(smokeParticle);
    }
    
    return smokeParticles;
  }
  
  // Try to add explosion sprite with animation
  tryAddExplosionSprite(x, y, explosionSize, explosionScale, triggeredByPlayer) {
    try {
      // First check if standard animations exist
      let animKey = `explosion_${explosionSize}`;
      let altAnimKey = `explosion_${explosionSize}_alt`;
      let canPlayAnimation = false;
      
      // Debug existing animation keys and check for big explosion frames
      console.log("Available animations:", Object.keys(this.scene.anims.anims.entries));
      console.log("Checking for explosion textures:", 
                 `BigExplo1 exists: ${this.scene.textures.exists('BigExplo1')}`,
                 `explosion_big_1 exists: ${this.scene.textures.exists('explosion_big_1')}`);
                 
      // This is important for proximity mine explosions - list all available textures related to explosions
      const explosionTextures = Object.keys(this.scene.textures.list).filter(
        key => key.includes('Explo') || key.includes('explo')
      );
      console.log("All explosion-related textures:", explosionTextures);
      
      // Try standard animation key first
      if (this.scene.anims.exists(animKey)) {
        console.log(`Found standard animation: ${animKey}`);
        canPlayAnimation = true;
      } 
      // Try alternative animation key next
      else if (this.scene.anims.exists(altAnimKey)) {
        console.log(`Found alternative animation: ${altAnimKey}`);
        animKey = altAnimKey;
        canPlayAnimation = true;
      } 
      // Fallback to looking for any explosion animation
      else {
        // Check for any explosion-related animations
        const explosionAnimKeys = Object.keys(this.scene.anims.anims.entries)
          .filter(key => key.includes('explosion') || key.includes('Explo'));
        
        if (explosionAnimKeys.length > 0) {
          console.log(`Found fallback explosion animation: ${explosionAnimKeys[0]}`);
          animKey = explosionAnimKeys[0];
          canPlayAnimation = true;
        } else {
          // Manually create the animation if we have the texture but no animation
          const textureKey = `BigExplo1`;
          if (this.scene.textures.exists(textureKey)) {
            console.log(`Creating explosion animation on-the-fly using ${textureKey}`);
            
            // Create frames array
            const frames = [];
            for (let i = 1; i <= 8; i++) {
              if (this.scene.textures.exists(`BigExplo${i}`)) {
                frames.push({ key: `BigExplo${i}` });
              }
            }
            
            if (frames.length > 0) {
              // Create animation
              this.scene.anims.create({
                key: 'explosion_big',
                frames: frames,
                frameRate: 15,
                repeat: 0,
                hideOnComplete: true
              });
              
              animKey = 'explosion_big';
              canPlayAnimation = true;
            } else {
              console.log(`No explosion animations or textures found`);
              return;
            }
          } else {
            console.log(`No explosion animations found for: ${animKey} or ${altAnimKey}`);
            return;
          }
        }
      }
      
      if (canPlayAnimation) {
        this.addExplosionAnimation(x, y, animKey, explosionSize, explosionScale);
        
        // For player-triggered or big explosions, add secondary effects
        if (triggeredByPlayer || explosionSize === 'big') {
          // Add secondary explosion with delay
          this.scene.time.delayedCall(150, () => {
            // Secondary explosion is medium for player-triggered, otherwise smaller
            const secondarySize = triggeredByPlayer ? 'medium' : (explosionSize === 'big' ? 'medium' : 'small');
            const offsetRange = triggeredByPlayer ? 40 : 30;
            const offsetX = Phaser.Math.Between(-offsetRange, offsetRange);
            const offsetY = Phaser.Math.Between(-offsetRange, offsetRange);
            
            this.addSecondaryExplosion(x + offsetX, y + offsetY, secondarySize, explosionScale);
          });
          
          // Add tertiary explosion for player-triggered only
          if (triggeredByPlayer) {
            this.scene.time.delayedCall(250, () => {
              const offsetX = Phaser.Math.Between(-50, 50);
              const offsetY = Phaser.Math.Between(-50, 50);
              this.addTertiaryExplosion(x + offsetX, y + offsetY, explosionScale);
            });
          }
        }
      }
    } catch (err) {
      console.error("Error attempting to add explosion sprite:", err);
    }
  }
  
  // Add main explosion animation
  addExplosionAnimation(x, y, animKey, explosionSize, explosionScale) {
    try {
      // Get animation
      const animation = this.scene.anims.get(animKey);
      if (!animation || !animation.frames || animation.frames.length === 0) {
        console.error(`Invalid animation: ${animKey} - missing frames`);
        return;
      }
      
      // Get first frame
      let initialFrame;
      try {
        // Check if we're dealing with a frame object or direct texture key
        if (animation.frames[0].frame && animation.frames[0].frame.name) {
          initialFrame = animation.frames[0].frame.name;
        } else if (animation.frames[0].key) {
          // For direct texture key references
          initialFrame = animation.frames[0].key;
        }
      } catch (err) {
        console.error(`Error getting initial frame for ${animKey}:`, err);
        
        // Find any explosion texture
        for (const texKey of Object.keys(this.scene.textures.list)) {
          if (texKey.includes('Explo') || texKey.includes('explosion')) {
            initialFrame = texKey;
            break;
          }
        }
        
        // Fallback to BigExplo1 if available
        if (!initialFrame && this.scene.textures.exists('BigExplo1')) {
          initialFrame = 'BigExplo1';
        }
        
        // Fallback to white as last resort
        if (!initialFrame) initialFrame = '__WHITE';
      }
      
      // Create explosion sprite
      const explosion = this.scene.add.sprite(x, y, initialFrame);
      explosion.setOrigin(0.5);
      explosion.setScale(explosionScale[explosionSize]);
      explosion.setDepth(15);
      
      // Play animation
      try {
        explosion.play(animKey);
      } catch (err) {
        console.error(`Failed to play animation ${animKey}:`, err);
      }
      
      // Destroy when animation completes
      explosion.on('animationcomplete', () => {
        explosion.destroy();
      });
    } catch (err) {
      console.error("Error creating explosion animation:", err);
    }
  }
  
  // Add secondary explosion
  addSecondaryExplosion(x, y, sizeName, explosionScale) {
    try {
      // Find animation
      let animKey = `explosion_${sizeName}`;
      let altAnimKey = `explosion_${sizeName}_alt`;
      
      if (!this.scene.anims.exists(animKey) && !this.scene.anims.exists(altAnimKey)) {
        return;
      }
      
      if (!this.scene.anims.exists(animKey)) {
        animKey = altAnimKey;
      }
      
      const animation = this.scene.anims.get(animKey);
      if (!animation || !animation.frames || animation.frames.length === 0) {
        return;
      }
      
      // Get frame
      let initialFrame;
      try {
        initialFrame = animation.frames[0].frame.name;
      } catch (err) {
        // Find fallback texture
        for (const texKey of Object.keys(this.scene.textures.list)) {
          if (texKey.includes('Explo') || texKey.includes('explosion')) {
            initialFrame = texKey;
            break;
          }
        }
        if (!initialFrame) initialFrame = '__WHITE';
      }
      
      // Create explosion
      const explosion = this.scene.add.sprite(x, y, initialFrame);
      explosion.setOrigin(0.5);
      explosion.setScale(explosionScale[sizeName] * 0.8);
      explosion.setDepth(14);
      
      // Play animation
      try {
        explosion.play(animKey);
      } catch (err) {
        console.error(`Failed to play secondary animation:`, err);
      }
      
      // Clean up
      explosion.on('animationcomplete', () => {
        explosion.destroy();
      });
    } catch (err) {
      console.error("Error creating secondary explosion:", err);
    }
  }
  
  // Add tertiary explosion
  addTertiaryExplosion(x, y, explosionScale) {
    try {
      // Find animation
      let animKey = 'explosion_small';
      let altAnimKey = 'explosion_small_alt';
      
      if (!this.scene.anims.exists(animKey) && !this.scene.anims.exists(altAnimKey)) {
        return;
      }
      
      if (!this.scene.anims.exists(animKey)) {
        animKey = altAnimKey;
      }
      
      const animation = this.scene.anims.get(animKey);
      if (!animation || !animation.frames || animation.frames.length === 0) {
        return;
      }
      
      // Get frame
      let initialFrame;
      try {
        initialFrame = animation.frames[0].frame.name;
      } catch (err) {
        // Find fallback texture
        for (const texKey of Object.keys(this.scene.textures.list)) {
          if (texKey.includes('SmallExplo') || texKey.includes('explosion_small')) {
            initialFrame = texKey;
            break;
          }
        }
        if (!initialFrame) initialFrame = '__WHITE';
      }
      
      // Create explosion
      const explosion = this.scene.add.sprite(x, y, initialFrame);
      explosion.setOrigin(0.5);
      explosion.setScale(explosionScale['small'] * 0.7);
      explosion.setDepth(13);
      
      // Play animation
      try {
        explosion.play(animKey);
      } catch (err) {
        console.error(`Failed to play tertiary animation:`, err);
      }
      
      // Clean up
      explosion.on('animationcomplete', () => {
        explosion.destroy();
      });
    } catch (err) {
      console.error("Error creating tertiary explosion:", err);
    }
  }
  
  // Create damage radius that hurts player
  // This duplicate createDamageRadius method has been removed
  // The implementation at line ~2716 is now used exclusively
  
  createDamageRadius(x, y) {
    // Damage radius
    const damageRadius = 150;
    
    // Get player
    const player = this.scene.playerManager.getPlayer();
    if (!player || !player.active) return;
    
    // Check if player is in blast radius
    const distance = Phaser.Math.Distance.Between(x, y, player.x, player.y);
    
    if (distance <= damageRadius) {
      // Player is in blast radius, apply damage
      console.log(`Player hit by mine explosion, distance: ${distance}`);
      
      // Fixed damage: always apply 3 hit points of damage regardless of distance
      const damage = 3;
      
      // Handle the damage using the scene's handlePlayerDamage method
      if (this.scene.handlePlayerDamage && typeof this.scene.handlePlayerDamage === 'function') {
        // Use the scene's handler for consistent death handling
        this.scene.handlePlayerDamage();
      } else {
        // Fallback if handler not available
        if (this.scene.playerManager && this.scene.playerManager.health !== undefined) {
          // Only apply damage if player isn't invincible
          if (!player.isInvincible) {
            this.scene.playerManager.health = Math.max(0, this.scene.playerManager.health - damage);
            
            // Update health display if available
            if (this.scene.playerManager.updateHealthDisplay) {
              this.scene.playerManager.updateHealthDisplay();
            }
            
            // Trigger death if health reaches zero
            if (this.scene.playerManager.health <= 0 && !player.isDying) {
              player.isDying = true;
              
              // Trigger death animation if available
              if (this.scene.playerManager.createPlayerDeathBlood) {
                this.scene.playerManager.createPlayerDeathBlood();
              }
              
              // Trigger scene's death handler if available
              if (this.scene.handlePlayerDeath) {
                this.scene.handlePlayerDeath();
              }
            }
          }
        }
      }
    }
  }
  
  update() {
    // Only update if drone is visible
    if (this.drone && this.drone.visible) {
      // Update shadow positions to follow the drone and adjust shadow scale based on drone scale
      if (this.drone.shadows) {
        // Calculate shadow scale based on drone scale - smaller when drone is high up, larger when close to ground
        // Double the shadow scale (base from 0.5 to 1.0)
        const shadowScale = 1.0 + ((this.drone.scale - 0.15) / this.drone.initialScale) * 0.3;
        
        this.drone.shadows.forEach(shadowData => {
          shadowData.sprite.x = this.drone.x + shadowData.offset.x;
          shadowData.sprite.y = this.drone.y + shadowData.offset.y + 50;
          shadowData.sprite.setScale(shadowScale);
          
          // Adjust shadow alpha based on height (scale) - more transparent when high up (50% darker)
          const shadowAlpha = Math.min(0.675, 0.3 + (shadowScale * 0.6)) / this.shadowOffsets.length;
          shadowData.sprite.setAlpha(shadowAlpha);
        });
      }
      
      // Adjust drone sound volume based on distance to player
      if (this.droneSound && this.droneSound.isPlaying) {
        const player = this.scene.playerManager.getPlayer();
        if (player) {
          // Calculate distance between drone and player
          const dx = this.drone.x - player.x;
          const dy = this.drone.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Adjust volume based on distance (closer = louder)
          // Map the distance to a volume value between minDroneVolume and maxDroneVolume
          let volume;
          if (distance >= this.volumeDistance) {
            volume = this.minDroneVolume;
          } else {
            // Linear interpolation between min and max volume based on distance
            const t = 1 - (distance / this.volumeDistance);
            volume = this.minDroneVolume + t * (this.maxDroneVolume - this.minDroneVolume);
          }
          
          // Apply the new volume
          this.droneSound.setVolume(volume);
        }
      }
    }
    
    // Update enemy drone shadows if active
    if (this.enemyDrone && this.enemyDrone.active) {
      if (this.enemyDrone.shadows) {
        this.enemyDrone.shadows.forEach(shadowData => {
          shadowData.sprite.x = this.enemyDrone.x + shadowData.offset.x;
          shadowData.sprite.y = this.enemyDrone.y + shadowData.offset.y + 50;
        });
      }
    }
  }
  
  shutdown() {
    // Stop enemy drone spawning
    this.stopEnemyDroneSpawning();
    
    // Clean up resources
    
    // Always stop and destroy the sound, regardless of playing state
    if (this.droneSound) {
      this.droneSound.stop();
      this.droneSound.destroy();
      this.droneSound = null;
    }
    
    // Extra safety: stop any drone sounds that might still be in the sound manager
    // This ensures the sound doesn't carry over to other scenes
    if (this.scene && this.scene.sound) {
      const droneSounds = this.scene.sound.getAll('drone_buzz');
      if (droneSounds && droneSounds.length > 0) {
        droneSounds.forEach(sound => {
          if (sound.isPlaying) {
            sound.stop();
          }
          sound.destroy();
        });
      }
    }
    
    // Clean up all shadows
    if (this.drone && this.drone.shadows) {
      this.drone.shadows.forEach(shadowData => {
        if (shadowData.sprite) {
          shadowData.sprite.destroy();
        }
      });
      this.drone.shadows = [];
    }
    
    // Clean up enemy drone if active
    if (this.enemyDrone) {
      if (this.enemyDrone.shadows) {
        this.enemyDrone.shadows.forEach(shadowData => {
          if (shadowData.sprite) {
            shadowData.sprite.destroy();
          }
        });
      }
      this.enemyDrone.destroy();
      this.enemyDrone = null;
    }
    
    if (this.box && this.box.active) {
      this.box.destroy();
    }
    
    // Clean up any active effects
    Object.keys(this.activeUpgrades).forEach(key => {
      if (this.activeUpgrades[key]) {
        this.activeUpgrades[key].remove();
        this.activeUpgrades[key] = null;
      }
    });
    
    // Clean up any effect graphics
    Object.keys(this.upgradeEffects).forEach(key => {
      if (this.upgradeEffects[key]) {
        this.cleanupEffects(this.upgradeEffects[key]);
        this.upgradeEffects[key] = null;
      }
    });
  }
}