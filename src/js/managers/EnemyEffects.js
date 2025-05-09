export class EnemyEffects {
  constructor(scene, bloodContainer) {
    this.scene = scene;
    this.bloodContainer = bloodContainer;
    // The sounds reference will be set directly by EnemyManager
    this.sounds = null;
  }
  
  // Check if an entity is completely outside the camera view
  // This is different from being partially off-screen - it must be COMPLETELY out of view
  isCompletelyOutsideCameraView(entity) {
    const camera = this.scene.cameras.main;
    const buffer = 100; // Add a buffer to account for large sprites
    
    // Get camera bounds
    const cameraLeft = camera.worldView.x - buffer;
    const cameraRight = camera.worldView.x + camera.worldView.width + buffer;
    const cameraTop = camera.worldView.y - buffer;
    const cameraBottom = camera.worldView.y + camera.worldView.height + buffer;
    
    // Calculate entity bounds with its dimensions
    const entityWidth = entity.displayWidth || entity.width || 64;
    const entityHeight = entity.displayHeight || entity.height || 64;
    const entityLeft = entity.x - (entityWidth / 2);
    const entityRight = entity.x + (entityWidth / 2);
    const entityTop = entity.y - (entityHeight / 2);
    const entityBottom = entity.y + (entityHeight / 2);
    
    // Check if entity is completely outside camera view
    const isOutside = 
      entityRight < cameraLeft ||
      entityLeft > cameraRight ||
      entityBottom < cameraTop ||
      entityTop > cameraBottom;
    
    // Log detailed position info for debugging
    if (isOutside) {
      console.log(`Entity at (${entity.x},${entity.y}) size ${entityWidth}x${entityHeight} is completely outside camera view:`, 
        {entityBounds: {left: entityLeft, right: entityRight, top: entityTop, bottom: entityBottom}, 
         cameraBounds: {left: cameraLeft, right: cameraRight, top: cameraTop, bottom: cameraBottom}});
    }
    
    return isOutside;
  }
  
  // Check if an entity is partially visible but near a camera edge
  // Returns true if any part of the entity is within the camera view 
  // but some part extends outside the camera
  isPartiallyVisible(entity) {
    const camera = this.scene.cameras.main;
    
    // No buffer here - checking exact visibility
    const cameraLeft = camera.worldView.x;
    const cameraRight = camera.worldView.x + camera.worldView.width;
    const cameraTop = camera.worldView.y;
    const cameraBottom = camera.worldView.y + camera.worldView.height;
    
    // Calculate entity bounds with its dimensions
    const entityWidth = entity.displayWidth || entity.width || 64;
    const entityHeight = entity.displayHeight || entity.height || 64;
    const entityLeft = entity.x - (entityWidth / 2);
    const entityRight = entity.x + (entityWidth / 2);
    const entityTop = entity.y - (entityHeight / 2);
    const entityBottom = entity.y + (entityHeight / 2);
    
    // Check if entity is completely outside camera (not visible at all)
    const isCompletelyOutside = 
      entityRight < cameraLeft ||
      entityLeft > cameraRight ||
      entityBottom < cameraTop ||
      entityTop > cameraBottom;
    
    // Check if entity is completely inside camera (fully visible)
    const isCompletelyInside = 
      entityLeft >= cameraLeft &&
      entityRight <= cameraRight &&
      entityTop >= cameraTop &&
      entityBottom <= cameraBottom;
    
    // Entity is partially visible if it's not completely outside and not completely inside
    const isPartiallyVisible = !isCompletelyOutside && !isCompletelyInside;
    
    // If partially visible, log which edges are crossed
    if (isPartiallyVisible) {
      const edgesInfo = {
        crossesLeftEdge: entityLeft < cameraLeft && entityRight > cameraLeft,
        crossesRightEdge: entityRight > cameraRight && entityLeft < cameraRight,
        crossesTopEdge: entityTop < cameraTop && entityBottom > cameraTop,
        crossesBottomEdge: entityBottom > cameraBottom && entityTop < cameraBottom
      };
      
      console.log(`Entity at (${entity.x},${entity.y}) is partially visible, crosses camera edges:`, edgesInfo);
    }
    
    return isPartiallyVisible;
  }

  // When a bullet hits an enemy.
  hitEnemy(bullet, enemy, updateScore) {
    bullet.destroy();
    
    // Decrease enemy health
    if (!enemy.health) enemy.health = 1; // Default to 1 for backward compatibility
    enemy.health -= 1;
    
    // Create more blood particles for both non-fatal and fatal hits
    this.createBloodParticles(enemy, enemy.health <= 0 ? 100 : 50);
    
    // Create larger blood pool on fatal hit, smaller one on non-fatal
    if (enemy.health <= 0) {
      this.createBloodPool(enemy, 5); // More blood pools for fatal hit
      
      // Check if this is the first kill in the game and first blood hasn't already been triggered
      if (this.scene.ui && this.scene.ui.getKillCount() === 0 && !this.scene.firstBloodTriggered) {
        // Mark first blood as triggered to prevent multiple triggers
        this.scene.firstBloodTriggered = true;
        
        // Play crowd cheer sound for the first blood
        this.playFirstBloodCrowdReaction();
        
        // We want to show FIRST BLOOD message here with the blood particles
        this.scene.time.delayedCall(10, () => {
          if (this.scene.showKillCountMessage) {
            this.scene.showKillCountMessage(1);
          }
        });
      }
    }
    
    // Play random hit/death sound
    if (this.sounds) {
      if (enemy.health <= 0) {
        this.sounds.playRandomDeathSound();
      } else {
        // Could play a different "hit" sound for non-fatal hits
        this.sounds.playRandomDeathSound();
      }
    }
    
    // If enemy still has health, just show hit effect and return
    if (enemy.health > 0) {
      this.showHitEffect(enemy);
      return;
    }
    
    // Below this point is only for fatal hits
    
    // Mark the enemy as hit but not yet destroyed
    enemy.isHit = true;
    enemy.isAttacking = false;
    enemy.attackCooldown = true;
    enemy.isDying = true; // Add this to prevent behavior updates
    
    // Make sure the enemy stops moving immediately
    if (enemy.body) {
      enemy.body.velocity.x = 0;
      enemy.body.velocity.y = 0;
      enemy.body.immovable = true; // Prevent physics from moving it
      
      // Disable physics body to prevent any further movement
      enemy.body.enable = false;
    }
    
    // Check if enemy is completely off-screen
    const isCompletelyOffScreen = this.isCompletelyOutsideCameraView(enemy);
    
    // For completely off-screen enemies, use a simplified death process
    if (isCompletelyOffScreen) {
      console.log(`Enemy at (${enemy.x}, ${enemy.y}) is completely off-screen - using simplified death`);
      
      // Create minimal blood effects at the actual position
      this.createBloodPool(enemy, 2); // Create just a couple of blood splashes
      
      // Spawn loot at the actual position
      this.spawnLoot(enemy);
      
      // Immediately destroy the enemy after a tiny delay
      this.scene.time.delayedCall(50, () => {
        if (enemy && enemy.active) {
          if (enemy.shadows) {
            enemy.shadows.forEach(shadowData => {
              shadowData.sprite.destroy();
            });
          }
          
          // Call update score callback before destroying the enemy
          if (updateScore) {
            const updatedKillCount = updateScore();
            
            // Only trigger milestone checks for specific kill counts to prevent "undefined kills" messages
            if (updatedKillCount === 1 || 
                updatedKillCount === 10 || 
                (updatedKillCount >= 50 && updatedKillCount < 60) || 
                (updatedKillCount >= 100 && updatedKillCount < 110) || 
                (updatedKillCount >= 200 && updatedKillCount < 210) || 
                (updatedKillCount >= 300 && updatedKillCount < 310) || 
                (updatedKillCount >= 400 && updatedKillCount < 410) || 
                (updatedKillCount >= 500 && updatedKillCount < 510) || 
                (updatedKillCount >= 666 && updatedKillCount < 676)) {
              
              // Check kill count milestones with a slight delay to ensure the kill count is updated
              this.scene.time.delayedCall(50, () => {
                if (this.scene.showKillCountMessage) {
                  this.scene.showKillCountMessage(updatedKillCount);
                }
              });
            }
          }
          
          // Destroy the enemy
          enemy.destroy();
        }
      });
      
      return; // Skip the full animation process
    }
    
    // For enemies that are visible or partially visible, continue with normal death animation
    
    // Determine which direction the bullet came from to select the appropriate death animation
    let deathAnimPrefix = 'enemy_death_front'; // default
    
    // Get bullet direction relative to enemy
    const dx = bullet.x - enemy.x;
    const dy = bullet.y - enemy.y;
    
    // Check screen orientation to account for orientation-specific adjustments
    // Use the same approach as in main.js - check registry first, then fallback to dimension comparison
    const isPortrait = this.scene.registry.get('isPortrait') || 
                      (this.scene.scale.height > this.scene.scale.width);
    
    // Use a normalized angle approach for more consistency across orientations
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Determine the direction based on angle (0° is right, 90° is down, -90° is up)
    let shouldFlipX = false;
    
    if (angle > -45 && angle < 45) {
        // Bullet came from left side - enemy is killed from left
        // We'll use right death animation but flipped
        deathAnimPrefix = 'enemy_death_right';  // Use right death animation but flip it
        shouldFlipX = true;  // This will flip the right animation to make it appear as left
    } else if (angle >= 45 && angle < 135) {
        // Bullet came from top side
        deathAnimPrefix = 'enemy_death_front';  // Front means killed from below
    } else if ((angle >= 135 && angle <= 180) || (angle >= -180 && angle < -135)) {
        // Bullet came from right side - enemy is killed from right
        deathAnimPrefix = 'enemy_death_right';   // Use right death animation
        shouldFlipX = false;  // No flip needed
    } else if (angle >= -135 && angle < -45) {
        // Bullet came from bottom side
        deathAnimPrefix = 'enemy_death_back';   // Back means killed from above
    }
    
    // Store the flip state on the enemy for death animation
    enemy.deathFlipX = shouldFlipX;
    
    // Since we're now using the actual death direction in the prefix
    // (killed from left uses left animation, killed from right uses right animation),
    // we don't need to swap based on flipX - the animation choice is already correct
    
    // For tutorial scene, force consistent animation direction to prevent issues
    if (this.scene.scene.key === 'TutorialScene') {
        // In tutorial, use either front or back based on bullet position relative to player
        deathAnimPrefix = dy > 0 ? 'enemy_death_front' : 'enemy_death_back';
    }
    
    // For enemies that are dying, handle their shadows
    if (enemy.shadows) {
        // Store original shadow positions relative to enemy
        enemy.shadowOffsets = [];
        
        enemy.shadows.forEach(shadowData => {
            // Store original offset
            enemy.shadowOffsets.push({
                sprite: shadowData.sprite,
                offsetX: shadowData.sprite.x - enemy.x,
                offsetY: shadowData.sprite.y - enemy.y
            });
            
            // Set shadow alpha to 0 to completely hide it during death animation
            shadowData.sprite.setAlpha(0);
        });
    }
    
    // Spawn money loot with 60% probability, but only if NOT in tutorial scene
    this.spawnLoot(enemy);
    
    // Stop any current animation
    enemy.anims.stop();
    
    // Clear tint only if this enemy type doesn't use colored assets
    if (enemy.useColorAssets === false) {
      enemy.clearTint();
    }
    
    // Create a manual frame-by-frame animation like the player death
    let deathFrames;
    
    // For colored enemies, use color-specific death animations
    if (enemy.useColorAssets && enemy.enemyType) {
      // Use the color-specific death animation frames
      deathFrames = Array.from(
        { length: 12 }, 
        (_, i) => `enemy_death_${enemy.enemyType}_${deathAnimPrefix.replace('enemy_death_', '')}_${i + 1}`
      );
      
      // Check if at least the first frame exists
      if (!this.scene.textures.exists(deathFrames[0])) {
        console.warn(`Colored death animation not found for ${enemy.enemyType}, falling back to standard grey animation`);
        // Fallback to standard grey death animation
        deathFrames = Array.from({ length: 12 }, (_, i) => `${deathAnimPrefix}_${i + 1}`);
      }
    } else {
      // Standard grey death animation
      deathFrames = Array.from({ length: 12 }, (_, i) => `${deathAnimPrefix}_${i + 1}`);
    }
    
    // Check if this is the tutorial scene
    const isTutorial = this.scene.scene.key === 'TutorialScene';
    
    // Use different scaling for tutorial vs. regular game
    const scaleMultiplier = isTutorial ? 1.0 : 1.25; // No extra scaling in tutorial
    
    // Remember original scale and apply appropriate scaling
    const originalScale = { 
      x: enemy.scaleX * scaleMultiplier, 
      y: enemy.scaleY * scaleMultiplier 
    };
    
    // Store exact enemy position - don't apply ANY boundary constraints
    // For partially visible enemies, never move the death animation to fit in camera bounds
    const deathPosition = {
      x: enemy.x,
      y: enemy.y
    };
    
    // Add a property to store this death position on the enemy
    enemy.deathPosition = deathPosition;
    
    // Check if enemy is partially visible but near an edge
    const isPartiallyVisible = this.isPartiallyVisible(enemy);
    
    // Add a debug log for enemy death position and visibility
    console.log(`Enemy death animation at position: (${deathPosition.x}, ${deathPosition.y}), partially visible: ${isPartiallyVisible}`);
    
    // IMPORTANT: We're intentionally NOT constraining this position to ANY screen boundaries
    // Death animations should always play at the exact position where the enemy died
    // This prevents "teleporting" deaths that confuse players
    
    // Set the first frame and apply enlarged scale
    if (this.scene.textures.exists(deathFrames[0])) {
      enemy.setTexture(deathFrames[0]);
      console.log(`Using death animation frame: ${deathFrames[0]} for ${enemy.enemyType || 'standard'} enemy`);
    } else {
      console.warn(`Death frame ${deathFrames[0]} not found, using fallback`);
      // Use fallback frame if the specific one doesn't exist
      enemy.setTexture('enemy_death_front_1');
    }
    enemy.setScale(originalScale.x, originalScale.y);
    
    // Apply flip setting if needed
    if (enemy.deathFlipX !== undefined) {
      enemy.setFlipX(enemy.deathFlipX);
    }
    
    // Set opacity to full to ensure death animation isn't translucent
    enemy.setAlpha(1.0);
    
    // Set dying enemy depth to 2 so it renders below other enemies and player (depth 10)
    // but above blood splashes (depth 0.3) and at the same level as blood particles (depth 2)
    enemy.setDepth(2);
    
    // Check if we're in portrait mode by using the orientation already detected above
    // at line 80-81 (reusing the isPortrait variable)
    
    // If we're in portrait mode, make sure we're using the correct rendering approach
    if (isPortrait) {
      // Make sure there are no duplicate sprites by destroying any that might exist
      if (enemy.deathAnimSprite) {
        enemy.deathAnimSprite.destroy();
        enemy.deathAnimSprite = null;
      }
      
      // Increase depth slightly in portrait mode to avoid z-fighting with other objects
      enemy.setDepth(3);
      console.log('Setting enemy death sprite depth to 3 for portrait mode');
    }
    
    // Create a dummy object to tween for animation tracking
    const deathAnimProgress = { frame: 0 };
    
    // Create a single tween to animate through all frames
    this.scene.tweens.add({
      targets: deathAnimProgress,
      frame: deathFrames.length - 1,
      duration: 1200, // 12 frames at 10fps = 1200ms
      ease: 'Linear',
      onUpdate: () => {
        // Calculate the current frame based on progress
        const newFrame = Math.floor(deathAnimProgress.frame);
        
        // Only update the texture if enemy still exists
        if (enemy && enemy.active && newFrame < deathFrames.length) {
          // Destroy any existing duplicate sprite that might be created in portrait mode
          if (enemy.deathAnimSprite) {
            enemy.deathAnimSprite.destroy();
            enemy.deathAnimSprite = null;
          }
          
          // Update texture directly on the enemy if the frame exists
          const frameName = deathFrames[newFrame];
          if (this.scene.textures.exists(frameName)) {
            enemy.setTexture(frameName);
          } else if (enemy.useColorAssets && enemy.enemyType) {
            // Try fallback to standard death animation frame
            const fallbackFrame = `enemy_death_${deathAnimPrefix.replace('enemy_death_', '')}_${newFrame + 1}`;
            if (this.scene.textures.exists(fallbackFrame)) {
              enemy.setTexture(fallbackFrame);
            }
            // If all else fails, the last texture will remain
          }
          
          // Always reset to original scale after changing texture
          enemy.setScale(originalScale.x, originalScale.y);
          
          // Apply flip setting for death animation
          if (enemy.deathFlipX !== undefined) {
            enemy.setFlipX(enemy.deathFlipX);
          }
          
          // Ensure full opacity to prevent translucency issues
          enemy.setAlpha(1.0);
          
          // Refresh depth value to avoid z-fighting in portrait mode
          if (isPortrait) {
            enemy.setDepth(3); // Maintain portrait-specific depth
          }
          
          // Use the stored death position to ensure animation plays exactly where the enemy died
          if (enemy.deathPosition) {
            enemy.x = enemy.deathPosition.x;
            enemy.y = enemy.deathPosition.y;
          }
          
          // That's it - no extra clamping or position checks needed!
        }
      },
      onComplete: () => {
        if (enemy && enemy.active) {
          // Fade out enemy and all its shadows
          const targetArray = [enemy];
          if (enemy.shadows) {
            enemy.shadows.forEach(shadowData => {
              targetArray.push(shadowData.sprite);
            });
          }
          
          // Fade everything out
          this.scene.tweens.add({
            targets: targetArray,
            alpha: 0,
            duration: 150,
            onComplete: () => {
              // Clean up all shadows
              if (enemy.shadows) {
                enemy.shadows.forEach(shadowData => {
                  shadowData.sprite.destroy();
                });
              }
              
              // Mark the enemy as destroyed and call the score update callback
              enemy.destroy();
              
              // Call update score callback now that the enemy is fully destroyed
              if (updateScore) {
                const updatedKillCount = updateScore();
                
                // Only trigger milestone checks for specific kill counts to prevent "undefined kills" messages
                if (updatedKillCount === 1 || 
                    updatedKillCount === 10 || 
                    (updatedKillCount >= 50 && updatedKillCount < 60) || 
                    (updatedKillCount >= 100 && updatedKillCount < 110) || 
                    (updatedKillCount >= 200 && updatedKillCount < 210) || 
                    (updatedKillCount >= 300 && updatedKillCount < 310) || 
                    (updatedKillCount >= 400 && updatedKillCount < 410) || 
                    (updatedKillCount >= 500 && updatedKillCount < 510) || 
                    (updatedKillCount >= 666 && updatedKillCount < 676)) {
                  
                  // Check kill count milestones with a slight delay to ensure the kill count is updated
                  this.scene.time.delayedCall(50, () => {
                    if (this.scene.showKillCountMessage) {
                      this.scene.showKillCountMessage(updatedKillCount);
                    }
                  });
                }
              }
            }
          });
        }
      }
    });
  }
  
  // Show hit effect for non-fatal hits
  showHitEffect(enemy) {
    // Store original velocity
    const originalVelocity = { x: enemy.body.velocity.x, y: enemy.body.velocity.y };
    
    // Pause enemy movement during hit effect
    enemy.body.velocity.x = 0;
    enemy.body.velocity.y = 0;
    
    // Create additional blood splash for non-fatal hits
    // Add a small blood pool even for non-fatal hits
    const splash = this.scene.add.image(
      enemy.x + Phaser.Math.Between(-10, 10),
      enemy.y + Phaser.Math.Between(-10, 10),
      'blood_splash'
    );
    splash.setAlpha(0.6);
    splash.setScale(Phaser.Math.FloatBetween(0.3, 0.5));
    splash.setAngle(Phaser.Math.Between(0, 360));
    this.bloodContainer.add(splash);
    
    // Slight knockback effect
    this.scene.tweens.add({
      targets: enemy,
      x: enemy.x + (Math.random() - 0.5) * 20,
      y: enemy.y + (Math.random() - 0.5) * 20,
      duration: 100,
      ease: 'Power1',
      completeDelay: 50,
      onComplete: () => {
        // Resume movement after a short pause
        this.scene.time.delayedCall(150, () => {
          if (enemy.active && enemy.body) {
            enemy.body.velocity.x = originalVelocity.x;
            enemy.body.velocity.y = originalVelocity.y;
          }
        });
      }
    });
  }
  
  // Create blood particles
  createBloodParticles(enemy, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 75 + Math.random() * 200; 
      const particleSize = 0.5 + Math.random() * 0.5;
      const lifespan = 300 + Math.random() * 300;
      const tintColors = [0x990000, 0x880000, 0x770000];
      const tint = tintColors[Math.floor(Math.random() * tintColors.length)];
      
      const particle = this.scene.add.image(
        enemy.x,
        enemy.y,
        'blood_particle'
      );
      particle.setScale(particleSize);
      particle.setTint(tint);
      
      this.scene.tweens.add({
        targets: particle,
        x: enemy.x + Math.cos(angle) * speed,
        y: enemy.y + Math.sin(angle) * speed,
        scale: particleSize * 0.5,
        alpha: 0,
        duration: lifespan,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
  
  // Create blood pool on the ground
  createBloodPool(enemy, count = 3) {
    for (let i = 0; i < count; i++) {
      const splash = this.scene.add.image(
        enemy.x + Phaser.Math.Between(-30, 30),
        enemy.y + Phaser.Math.Between(-30, 30),
        'blood_splash'
      );
      splash.setAlpha(0.8);
      splash.setScale(Phaser.Math.FloatBetween(0.5, 1.2));
      splash.setAngle(Phaser.Math.Between(0, 360));
      this.bloodContainer.add(splash);
    }
  }
  
  // Spawn loot
  spawnLoot(enemy) {
    // Spawn money loot with 60% probability, but only if NOT in tutorial scene
    const isTutorial = this.scene.scene.key === 'TutorialScene';
    
    // Skip loot spawning entirely in tutorial mode
    if (Math.random() < 0.6 && !isTutorial) {
      // Stronger enemies drop more cash
      let moneyMultiplier = 1;
      let lootType = 'coins'; // Default to coins for small rewards
      let lootScale = 0.08; // Setting to 0.08 for consistent coin size
      let dropBonk = false;
      
      // Adjust loot based on enemy type
      if (enemy.enemyType === 'blue') {
        moneyMultiplier = 2;
        lootType = 'coins';
        lootScale = 0.08; // Increased by factor of 2 from previous 0.04
        // Blue enemies have a 50% chance to drop bonk (increased from 25%)
        dropBonk = Math.random() < 0.99;
      } else if (enemy.enemyType === 'green') {
        moneyMultiplier = 3;
        lootType = 'cash'; // Medium rewards use cash
        lootScale = 0.22;
        // Green enemies have a 50% chance to drop bonk
        dropBonk = Math.random() < 0.5;
      } else if (enemy.enemyType === 'gold') {
        moneyMultiplier = 5;
        lootType = 'cash'; // Large rewards use cash
        lootScale = 0.28;
        
        // Gold enemies always drop bonk
        dropBonk = true;
      } else if (enemy.enemyType === 'basic' || !enemy.enemyType) {
        // For regular enemies, use coins (small rewards)
        lootType = 'coins';
        // Regular gray enemies have a 5% chance to drop bonk (rare case)
        dropBonk = Math.random() < 0.05;
      }
      
      // Store multiplier on the loot object to be used when collected
      const loot = this.scene.physics.add.image(enemy.x, enemy.y, lootType);
      loot.setScale(lootScale);
      loot.setDepth(5); // Above blood pools and shadows, but below other objects
      loot.moneyMultiplier = moneyMultiplier;
      loot.lootType = lootType; // Store loot type for collection handling
      
      // Add loot to the scene's loot group for collision detection
      if (this.scene.lootGroup) {
        this.scene.lootGroup.add(loot);
      }
      
      // Add floating effect to loot
      this.scene.tweens.add({
        targets: loot,
        y: loot.y - 10,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      // Make loot disappear after 5 seconds if not collected
      this.scene.time.delayedCall(5000, () => {
        if (loot && loot.active) {
          this.scene.tweens.add({
            targets: loot,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              loot.destroy();
            }
          });
        }
      });
      
      // Handle bonk token drop
      if (dropBonk) {
        // Offset the bonk drop slightly from the cash
        const offsetX = Math.random() * 30 - 15; // -15 to +15 pixels
        const offsetY = Math.random() * 30 - 15; // -15 to +15 pixels
        
        const bonkLoot = this.scene.physics.add.image(enemy.x + offsetX, enemy.y + offsetY, 'bonk');
        bonkLoot.setScale(0.1); // Smaller bonk token
        bonkLoot.setDepth(5); // Same depth as other loot
        bonkLoot.lootType = 'bonk'; // Mark as bonk for collection handling
        
        // Gold enemies drop more bonk
        if (enemy.enemyType === 'gold') {
          bonkLoot.bonkAmount = 3; // Gold enemies drop 3 bonk tokens
        } else if (enemy.enemyType === 'green') {
          bonkLoot.bonkAmount = 2; // Green enemies drop 2 bonk tokens
        } else {
          bonkLoot.bonkAmount = 1; // Blue and regular enemies drop 1 bonk token
        }
        
        // Add bonk to the loot group
        if (this.scene.lootGroup) {
          this.scene.lootGroup.add(bonkLoot);
        }
        
        // Add floating effect to bonk loot with different timing for visual variety
        this.scene.tweens.add({
          targets: bonkLoot,
          y: bonkLoot.y - 12,
          duration: 1200, // Slightly longer duration
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        // Make bonk disappear after 5 seconds if not collected
        this.scene.time.delayedCall(5000, () => {
          if (bonkLoot && bonkLoot.active) {
            this.scene.tweens.add({
              targets: bonkLoot,
              alpha: 0,
              duration: 300,
              onComplete: () => {
                bonkLoot.destroy();
              }
            });
          }
        });
      }
    }
  }

  // Create small blood splatter when enemy is in attack range
  createPlayerBloodSplatter(player) {
    // Use the same blood effect as player death, just with reduced intensity
    // Create blood explosion with fewer particles
    for (let i = 0; i < 50; i++) { // Reduced from death's 100 particles
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      const particleSize = 0.4 + Math.random() * 0.8;
      const lifespan = 600 + Math.random() * 500;
      const tintColors = [0xaa0000, 0x990000, 0x880000];
      const tint = tintColors[Math.floor(Math.random() * tintColors.length)];
      
      // Create particles with offset from player center
      const offsetX = Math.cos(angle) * 10;
      const offsetY = Math.sin(angle) * 10;
      
      const particle = this.scene.add.image(
        player.x + offsetX,
        player.y + offsetY,
        'blood_particle'
      );
      particle.setScale(particleSize);
      particle.setTint(tint);
      particle.setDepth(2); // Set depth above shadows (1) but lower than player (10)
      
      // Create waves of particles (staggered creation)
      this.scene.time.delayedCall(i % 20 * 4, () => {
        this.scene.tweens.add({
          targets: particle,
          x: player.x + Math.cos(angle) * speed,
          y: player.y + Math.sin(angle) * speed,
          scale: particleSize * 0.3,
          alpha: 0,
          duration: lifespan,
          onComplete: () => {
            particle.destroy();
          }
        });
      });
    }
    
    // Create a few blood pools around player
    for (let i = 0; i < 3; i++) { // Fewer than death's 8 pools
      const splash = this.scene.add.image(
        player.x + Phaser.Math.Between(-40, 40),
        player.y + Phaser.Math.Between(-40, 40),
        'blood_splash'
      );
      splash.setAlpha(0.8);
      splash.setScale(Phaser.Math.FloatBetween(0.5, 1.2));
      splash.setAngle(Phaser.Math.Between(0, 360));
      splash.setDepth(0.3); // Set depth below shadows (1) and player (10)
      this.bloodContainer.add(splash);
    }
  }

  // Create massive blood explosion when player dies
  createPlayerDeathBlood(player) {
    // Create blood explosion manually, but reduce particles to avoid conflicts with death animation
    for (let i = 0; i < 100; i++) { // Reduced from 200 to 100
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200; // Reduced speed
      const particleSize = 0.4 + Math.random() * 0.8; // Slightly smaller particles
      const lifespan = 600 + Math.random() * 500; // Shorter lifespan
      const tintColors = [0xaa0000, 0x990000, 0x880000];
      const tint = tintColors[Math.floor(Math.random() * tintColors.length)];
      
      // Create particles with offset from player center to avoid obscuring animation
      const offsetX = Math.cos(angle) * 10;
      const offsetY = Math.sin(angle) * 10;
      
      const particle = this.scene.add.image(
        player.x + offsetX,
        player.y + offsetY,
        'blood_particle'
      );
      particle.setScale(particleSize);
      particle.setTint(tint);
      particle.setDepth(2); // Set depth above shadows (1) but lower than player (10)
      
      // Create waves of particles (staggered creation)
      this.scene.time.delayedCall(i % 20 * 4, () => { // Faster staggering
        this.scene.tweens.add({
          targets: particle,
          x: player.x + Math.cos(angle) * speed,
          y: player.y + Math.sin(angle) * speed,
          scale: particleSize * 0.3,
          alpha: 0,
          duration: lifespan,
          onComplete: () => {
            particle.destroy();
          }
        });
      });
    }
    
    // Create blood pools around player, but fewer and more spread out
    for (let i = 0; i < 8; i++) { // Reduced from 12 to 8
      const splash = this.scene.add.image(
        player.x + Phaser.Math.Between(-60, 60), // More spread out
        player.y + Phaser.Math.Between(-60, 60),
        'blood_splash'
      );
      splash.setAlpha(0.8); // Slightly more transparent
      splash.setScale(Phaser.Math.FloatBetween(0.7, 1.8)); // Slightly smaller
      splash.setAngle(Phaser.Math.Between(0, 360));
      splash.setDepth(0.3); // Set depth below shadows (1) and player (10)
      this.bloodContainer.add(splash);
    }
    
    // Remove player fall tween as it's conflicting with the death animation
    // We'll let the animation handle the player's appearance
  }
  
  // Play a random crowd cheer for the first blood
  playFirstBloodCrowdReaction() {
    // Skip crowd sounds if we're in the tutorial scene
    if (this.scene.scene.key === 'TutorialScene') {
      console.log('Skipping crowd cheer for first blood in tutorial scene');
      return;
    }
    
    console.log('Playing crowd cheer for FIRST BLOOD!');
    
    // Select a random cheer sound
    const cheerSounds = ['crowd_cheer', 'crowd_cheer1', 'crowd_cheer2'];
    const randomCheerKey = cheerSounds[Math.floor(Math.random() * cheerSounds.length)];
    
    // Try to play the selected cheer using Phaser sound system first
    let crowdSound;
    if (randomCheerKey === 'crowd_cheer') {
      crowdSound = this.scene.crowdCheerSound;
    } else if (randomCheerKey === 'crowd_cheer1') {
      crowdSound = this.scene.crowdCheer1Sound;
    } else if (randomCheerKey === 'crowd_cheer2') {
      crowdSound = this.scene.crowdCheer2Sound;
    }
    
    if (crowdSound) {
      console.log(`Playing ${randomCheerKey} for first blood`);
      crowdSound.play({ volume: 1.0 });
      return;
    }
    
    // Fallback to HTML Audio element if available
    if (this.scene.cachedAudioElements && this.scene.cachedAudioElements[randomCheerKey]) {
      const audioElement = this.scene.cachedAudioElements[randomCheerKey];
      audioElement.currentTime = 0;
      audioElement.volume = 1.0;
      
      try {
        console.log(`Playing ${randomCheerKey} (HTML Audio) for first blood`);
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn(`Unable to play ${randomCheerKey} sound:`, error);
            this.tryAnyAvailableCrowdSound();
          });
        }
      } catch (error) {
        console.error(`Failed to play ${randomCheerKey} sound:`, error);
        this.tryAnyAvailableCrowdSound();
      }
      return;
    }
    
    // If the selected sound isn't available, try any available crowd sound
    this.tryAnyAvailableCrowdSound();
  }
  
  // Fallback method to play any available crowd sound
  tryAnyAvailableCrowdSound() {
    // Skip crowd sounds if we're in the tutorial scene
    if (this.scene.scene.key === 'TutorialScene') {
      console.log('Skipping crowd sounds in tutorial scene');
      return;
    }
    
    // Try to use one of the crowd sounds
    const alternatives = ['crowd_cheer', 'crowd_cheer1', 'crowd_cheer2', 'crowd_ooooh', 'crowd_aaaah'];
    
    // Try Phaser sound system first
    for (const soundKey of alternatives) {
      const sound = this.scene.sound.get(soundKey);
      if (sound) {
        console.log(`Using alternative crowd sound: ${soundKey}`);
        sound.play({ volume: 1.0 });
        return;
      }
    }
    
    // Try HTML Audio elements as fallback
    if (this.scene.cachedAudioElements) {
      for (const soundKey of alternatives) {
        const audioElement = this.scene.cachedAudioElements[soundKey];
        if (audioElement) {
          console.log(`Using alternative crowd sound (HTML Audio): ${soundKey}`);
          audioElement.currentTime = 0;
          audioElement.volume = 1.0;
          
          try {
            audioElement.play();
            return;
          } catch (error) {
            console.error(`Failed to play ${soundKey} sound:`, error);
            // Continue to next alternative
          }
        }
      }
    }
    
    // Last resort: try to create a new audio element
    try {
      const newAudio = new Audio('/assets/sound/sfx/crowdCheer.mp3');
      newAudio.volume = 1.0;
      newAudio.play();
      
      // Cache for future use
      if (this.scene.cachedAudioElements) {
        this.scene.cachedAudioElements['crowd_cheer'] = newAudio;
      }
    } catch (error) {
      console.error("Failed to play any crowd sound for first blood:", error);
    }
  }
}
