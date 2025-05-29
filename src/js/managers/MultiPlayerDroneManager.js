export class DroneManager {
  constructor(scene, socket) {
    this.scene = scene;
    this.socket = socket;
    this.drone = null;
    this.box = null;
    this.droneSpeed = 150;
    this.isDelivering = false;
    this.deliveryTimer = null;
    this.deliveryInterval = 45000; // Extended to 45 seconds between automatic deliveries
    this.maxDroneVolume = 0.5; // Maximum volume for the drone sound
    this.minDroneVolume = 0.33; // Minimum volume for the drone sound
    this.volumeDistance = 500; // Distance at which volume is minimum
    this.upgradeBoxes = [];

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

    this.handleSocketEvents();
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

  getUpgradeBoxes() {
    return this.upgradeBoxes;
  }

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
    const upgradeBox = this.scene.add.sprite(x, y - 40, 'powerup_box_closed');
    upgradeBox.setOrigin(0.5);
    this.upgradeBoxes.push(upgradeBox);

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
    upgradeBox.powerupTexture = powerupTexture;

    upgradeBox.setDepth(3);
    upgradeBox.setScale(0.5); // Half the original size

    // Add physics to the box
    this.scene.physics.world.enable(upgradeBox);

    // Set a much smaller physics body for more precise pickups (35% of original size)
    upgradeBox.body.setSize(upgradeBox.width * 0.35, upgradeBox.height * 0.35);

    this.scene.lootGroup.add(upgradeBox);

    // Store upgrade information
    upgradeBox.upgradeType = upgradeType.type;
    upgradeBox.upgradeName = upgradeType.name;
    upgradeBox.upgradeEmoji = upgradeType.emoji;
    upgradeBox.upgradeLevel = upgradeLevel;
    upgradeBox.upgradeEffect = upgradeEffect;
    upgradeBox.upgradeDuration = upgradeDuration;

    // Debug logging for magazine upgrades
    if (upgradeType.type === 'magazine') {
      console.log(`DEBUG - Magazine box created:`);
      console.log(`- Box type: ${upgradeBox.upgradeType}`);
      console.log(`- Box level: ${upgradeBox.upgradeLevel}`);
      console.log(`- Box effect (magazines): ${upgradeBox.upgradeEffect}`);
      console.log(`- Box duration: ${upgradeBox.upgradeDuration}`);
    }

    // Get level-specific description if available
    const levelData = upgradeType.levels.find(l => l.level === upgradeLevel);
    if (levelData) {
      upgradeBox.upgradeDescription = levelData.description;
    } else {
      upgradeBox.upgradeDescription = 'Upgrade';
    }

    // Simple bounce animation when the box lands
    this.scene.tweens.add({
      targets: upgradeBox,
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
        if (upgradeBox && upgradeBox.active) {
          this.scene.tweens.add({
            targets: [upgradeBox, upgradeBox.powerupIcon].filter(Boolean),
            alpha: 0,
            duration: 300,
            onComplete: () => {
              if (upgradeBox) {
                if (upgradeBox.powerupIcon) {
                  upgradeBox.powerupIcon.destroy();
                }
                upgradeBox.destroy();
              }
            }
          });
        }
      }, this);
    }
  }

  // New method to deliver a specific upgrade at a specific level
  deliverSpecificUpgrade(upgradeType, level, effect, duration, playerId) {
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
        duration: duration,
        playerId: playerId
      });

      if (upgradeType === 'magazine') {
        console.log(`DEBUG - Magazine delivery queued due to drone in flight`);
      }

      return;
    }

    if (playerId === 0) {
      this.socket.emit('drone_delivery', {
        upgradeType: upgradeType,
        level: level,
        effect: effect,
        duration: duration,
        roomId: this.scene.roomId
      });
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
    let dropX, dropY;

    // Calculate drop point closer to the player for on-demand deliveries
    if (playerId === 0) {
      dropX = player.x;
      dropY = player.y;
    } else {
      const enemies = this.scene.enemyManager.getEnemies();
      let i = 0;
      for (i = 0; i < enemies.length; i++) {
        if (enemies[i].playerId === playerId) {
          dropX = enemies[i].player.x;
          dropY = enemies[i].player.y;
          break;
        }
      }
      if (i === enemies.length) {
        console.log("Seems like enemy is dead");
        if (this.deliveryQueue.length > 0) {
          this.isDelivering = false;
          const nextDelivery = this.deliveryQueue.shift();
          this.deliverSpecificUpgrade(
            nextDelivery.type,
            nextDelivery.level,
            nextDelivery.effect,
            nextDelivery.duration,
            nextDelivery.playerId
          );
        }
        return;
      }
    }

    // Keep drop point within game bounds
    const boundedDropX = Phaser.Math.Clamp(dropX, 100, gameWidth - 100);
    const boundedDropY = Phaser.Math.Clamp(dropY, 100, gameHeight - 100);

    // Set drone entry and exit points based on chosen side - ensure it's completely off screen
    switch (side) {
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
                            nextDelivery.duration,
                            nextDelivery.playerId
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
    switch (upgradeType) {
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
        this.createUpgradeEffect(player, upgradeEmoji, 0x00ffff, upgradeLevel);
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

  applyUpgradeForEnemy(upgradeBox) {
    console.log("Applying upgrade for enemy", upgradeBox);
    const pickupText = this.scene.add.text(
      upgradeBox.x,
      upgradeBox.y - 30,
      upgradeBox.upgradeEmoji,
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

    // Add a short delay before removing the box to let player see the opened box and powerup
    this.scene.time.delayedCall(400, () => {
      this.scene.tweens.add({
        targets: [upgradeBox],
        alpha: 0,
        duration: 200,
        onComplete: () => {
          upgradeBox.destroy();
        }
      });
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
  // Handle socket event when another player starts the game
  handleSocketEvents() {
    if (!this.socket) {
      console.warn('Socket not initialized when setting up event handlers');
      return;
    }

    this.socket.on('drone_delivered', (data) => {
      if(data.roomId != this.scene.roomId) {
        return;
      }
      console.log('Received drone delivery event:', data);
      // Handle the drone delivery event as needed
      if (data.playerId !== this.scene.playerManager.playerId) {
        this.deliverSpecificUpgrade(data.upgradeType, data.level, data.effect, data.duration, data.playerId);
      }
    });
  }
}