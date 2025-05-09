export class EnemyBehavior {
  constructor(scene) {
    this.scene = scene;
    // Configuration for enemy spacing and flank behavior
    this.minEnemyDistance = 60; // Minimum distance between enemies
    this.flankingFactor = 0.65; // How much enemies try to flank (0-1)
    this.approachMidpoint = 0.5; // For staged approach (0-1)
    
    // Cache of enemy positions to reduce array creation
    this.enemyPositionsCache = [];
    
    // Optimization: Animation change throttling
    this.animChangeThrottleMs = 200; // Min ms between anim changes
    this.lastAnimChangeTimes = new Map(); // Map enemyId -> timestamp
  }

  updateEnemies(enemies, player) {
    // Reset and populate enemy position cache
    this.enemyPositionsCache.length = 0;
    
    // First pass - populate positions for proximity checks
    enemies.children.iterate(enemy => {
      if (enemy.active && !enemy.isDying) {
        this.enemyPositionsCache.push({ x: enemy.x, y: enemy.y, enemy: enemy });
      }
      return true;
    });
    
    const now = Date.now();
    
    // Second pass - handle movement and AI
    if (!enemies || !enemies.children) return;
    
    enemies.children.each(enemy => {
      // Skip updates for inactive enemies
      if (!enemy.active) return;
      
      // For dying enemies, just ensure they stay at their death position
      if (enemy.isDying) {
        // If enemy has a stored death position, make sure it stays there
        if (enemy.deathPosition) {
          enemy.x = enemy.deathPosition.x;
          enemy.y = enemy.deathPosition.y;
          
          // Update any attached shadow positions based on stored offsets
          if (enemy.shadowOffsets) {
            enemy.shadowOffsets.forEach(shadowOffset => {
              if (shadowOffset.sprite && shadowOffset.sprite.active) {
                shadowOffset.sprite.x = enemy.x + shadowOffset.offsetX;
                shadowOffset.sprite.y = enemy.y + shadowOffset.offsetY;
              }
            });
          }
        }
        return;
      }
      
      // Update enemy shadows positions (skip if no shadows)
      if (enemy.shadows) {
        enemy.shadows.forEach(shadowData => {
          shadowData.sprite.x = enemy.x + shadowData.offset.x;
          shadowData.sprite.y = enemy.y + shadowData.offset.y + 50;
        });
      }
      
      // Don't update enemies that are attacking, hit, or dying
      if (enemy.isAttacking || enemy.isHit) return;
      
      // Special handling for AI player enemies (more aggressive targeting)
      if (enemy.isAIPlayer) {
        this.updateAIPlayer(enemy, player, now);
        return;
      }
      
      // Get direction to player
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Define minimum attack distance
      const minAttackDistance = 20; 
      
      // Special handling for dying player
      if (player.isDying) {
        // If very close to player corpse, attack
        if (distance <= minAttackDistance) {
          // Stop movement
          enemy.body.velocity.x = 0;
          enemy.body.velocity.y = 0;
          
          // Start attack if not on cooldown
          if (!enemy.attackCooldown) {
            this.startEnemyAttack(enemy, player, null);
          }
          return;
        }
        
        // Otherwise, move toward player with simplified physics
        const baseSpeed = 125 * (Math.random() * 0.4 + 0.8); // 100-150 range (25% faster)
        const timeScale = this.scene.time.timeScale || 1.0;
        const speed = baseSpeed * timeScale;
        
        // Simplified movement - avoid physics calculations when possible
        if (distance > 0) {
          enemy.body.velocity.x = (dx / distance) * speed;
          enemy.body.velocity.y = (dy / distance) * speed;
        }
        
        this.updateEnemyRunAnimation(enemy, dx, dy, now);
      } else {
        // Normal movement for living player with flanking behavior
        const baseSpeed = 125 * (Math.random() * 0.4 + 0.8); // 100-150 range (25% faster)
        const timeScale = this.scene.time.timeScale || 1.0;
        const speed = baseSpeed * timeScale;
        
        // Only recalculate flanking positions when needed (every so many frames) or nearby to player
        const shouldRecalculateTarget = !enemy.targetPos || distance < 200 || Math.random() < 0.05;
        
        if (shouldRecalculateTarget) {
          enemy.targetPos = this.calculateFlankingPosition(enemy, player, this.enemyPositionsCache);
        }
        
        // Simplified movement - avoid physics engine overhead
        if (enemy.targetPos) {
          const targetDx = enemy.targetPos.x - enemy.x;
          const targetDy = enemy.targetPos.y - enemy.y;
          const targetDistance = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
          
          if (targetDistance > 0) {
            enemy.body.velocity.x = (targetDx / targetDistance) * speed;
            enemy.body.velocity.y = (targetDy / targetDistance) * speed;
          }
        }
        
        // Update animation based on movement direction relative to player
        this.updateEnemyRunAnimation(enemy, dx, dy, now);
      }
    }, this);
  }
  
  // Calculate a flanking position that avoids other enemies
  calculateFlankingPosition(enemy, player, enemyPositions) {
    // Base vector from enemy to player
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Early return for edge cases
    if (distance === 0) return { x: player.x, y: player.y };
    
    // Normalize direction vector
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Start with direct approach vector
    let targetX = player.x;
    let targetY = player.y;
    
    // Check for nearby enemies
    let nearbyEnemies = false;
    let avoidanceX = 0;
    let avoidanceY = 0;
    let enemyCount = 0;
    
    // Apply avoidance forces from other enemies
    for (const pos of enemyPositions) {
      // Skip self
      if (pos.enemy === enemy) continue;
      
      // Vector from this enemy to other enemy
      const otherDx = pos.x - enemy.x;
      const otherDy = pos.y - enemy.y;
      const otherDistance = Math.sqrt(otherDx * otherDx + otherDy * otherDy);
      
      // If enemies are too close, generate avoidance force
      if (otherDistance < this.minEnemyDistance) {
        nearbyEnemies = true;
        
        // Create avoidance vector (away from other enemy)
        if (otherDistance > 0) {  // Prevent division by zero
          avoidanceX -= otherDx / otherDistance;
          avoidanceY -= otherDy / otherDistance;
          enemyCount++;
        }
      }
    }
    
    // If enemies are nearby, adjust the target position
    if (nearbyEnemies && enemyCount > 0) {
      // Normalize avoidance vector
      const avoidMag = Math.sqrt(avoidanceX * avoidanceX + avoidanceY * avoidanceY);
      if (avoidMag > 0) {
        avoidanceX /= avoidMag;
        avoidanceY /= avoidMag;
      }
      
      // Calculate perpendicular vector to approach direction (for flanking)
      const perpX = -dirY;
      const perpY = dirX;
      
      // Determine which side to flank based on avoidance and current position
      const flankSide = (perpX * avoidanceX + perpY * avoidanceY) > 0 ? 1 : -1;
      
      // Blend direct approach with flanking behavior
      const flankX = perpX * flankSide * this.flankingFactor;
      const flankY = perpY * flankSide * this.flankingFactor;
      
      // Calculate midpoint between enemy and player for staged approach
      const midpointX = enemy.x + dirX * distance * this.approachMidpoint;
      const midpointY = enemy.y + dirY * distance * this.approachMidpoint;
      
      // Apply flanking to this midpoint
      targetX = midpointX + flankX * distance;
      targetY = midpointY + flankY * distance;
    }
    
    return { x: targetX, y: targetY };
  }
  
  // Helper method to update enemy running animation based on movement direction
  updateEnemyRunAnimation(enemy, dx, dy, now) {
    // Throttle animation changes to avoid performance spikes
    if (this.lastAnimChangeTimes.has(enemy)) {
      const lastChangeTime = this.lastAnimChangeTimes.get(enemy);
      if (now - lastChangeTime < this.animChangeThrottleMs) {
        return; // Skip animation update if too recent
      }
    }
    
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    let animKey = 'enemy_run_down';
    let flipX = false;
    
    if (absX > absY * 2) {
      animKey = 'enemy_run_right';
      flipX = dx < 0;
    } else if (absY > absX * 2) {
      animKey = (dy < 0) ? 'enemy_run_up' : 'enemy_run_down';
    } else {
      if (dy < 0) {
        animKey = 'enemy_run_right_up';
        flipX = dx < 0;
      } else {
        animKey = 'enemy_run_right_down';
        flipX = dx < 0;
      }
    }
    
    // For colored enemies, transform the animation key
    if (enemy.useColorAssets && enemy.enemyType) {
      // Extract the base animation part (run) and direction part
      const direction = animKey.replace('enemy_run_', '');
      
      // Create the colored animation key using the naming convention from Animations.js
      // Format: enemy_[type]_[action]_[direction], e.g., enemy_blue_run_right
      const coloredAnimKey = `enemy_${enemy.enemyType}_run_${direction}`;
      
      // Check if this animation exists
      if (this.scene.anims.exists(coloredAnimKey)) {
        animKey = coloredAnimKey;
      } else {
        // Try fallback to the underscore suffix format used in Animations.js
        const fallbackKey = `enemy_${enemy.enemyType}_run_${direction}`;
        if (this.scene.anims.exists(fallbackKey)) {
          animKey = fallbackKey;
        } else {
          console.warn(`Animation ${coloredAnimKey} not found for ${enemy.enemyType} enemy, using standard animation`);
        }
      }
    }
    
    // Only update animation if it's different
    if (!enemy.anims.isPlaying || enemy.anims.currentAnim.key !== animKey) {
      enemy.play(animKey);
      this.lastAnimChangeTimes.set(enemy, now);
    }
    
    // Only update flip if it changed
    if (enemy.flipX !== flipX) {
      enemy.setFlipX(flipX);
    }
  }

  // Start enemy attack when close enough to the player
  // Special behavior for AI player enemies - more aggressive targeting and shooting
  updateAIPlayer(enemy, player, now) {
    // Get direction to player
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // AI player moves faster and more directly
    const baseSpeed = 175; // Faster than regular enemies
    const timeScale = this.scene.time.timeScale || 1.0;
    const speed = baseSpeed * timeScale;
    
    // AI player has two modes - attack and shoot
    const shootRange = 300; // Stay at distance to shoot
    const attackRange = 50;  // Get close to melee attack
    
    // Choose behavior based on distance
    if (distance > shootRange) {
      // Too far - move towards player
      enemy.body.velocity.x = (dx / distance) * speed;
      enemy.body.velocity.y = (dy / distance) * speed;
    } else if (distance < attackRange) {
      // Close enough for melee attack
      if (!enemy.attackCooldown) {
        this.startEnemyAttack(enemy, player, () => this.scene.handlePlayerDamage());
      }
    } else {
      // Ideal range for shooting - move less, focus on shooting
      
      // Move side to side slightly
      const perpX = -dy / distance;
      const perpY = dx / distance;
      const sideMotion = Math.sin(now / 500) * 0.7; // Oscillating side motion
      
      enemy.body.velocity.x = perpX * speed * sideMotion;
      enemy.body.velocity.y = perpY * speed * sideMotion;
      
      // Attempt to shoot at player on a cooldown
      if (!enemy.shootCooldown) {
        // Create bullet for AI to shoot at player
        this.createAIBullet(enemy, player);
        
        // Set cooldown
        enemy.shootCooldown = true;
        this.scene.time.delayedCall(800, () => {
          enemy.shootCooldown = false;
        });
      }
    }
    
    // Update animation
    this.updateEnemyRunAnimation(enemy, dx, dy, now);
  }
  
  // Create a bullet for AI player to shoot at player
  createAIBullet(enemy, player) {
    // Don't proceed if scene doesn't exist
    if (!this.scene) return;
    
    // Create bullet in the bullet group
    const bulletGroup = this.scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 20,
      collideWorldBounds: true,
      allowGravity: false
    });
    
    // Create bullet from enemy to player
    const bullet = bulletGroup.create(enemy.x, enemy.y, 'bullet');
    bullet.setScale(0.5);
    
    // Set bullet direction toward player with some inaccuracy
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const angle = Math.atan2(dy, dx);
    const inaccuracy = (Math.random() - 0.5) * 0.2; // Add some randomness
    
    // Set bullet speed and direction
    const bulletSpeed = 400;
    bullet.body.velocity.x = Math.cos(angle + inaccuracy) * bulletSpeed;
    bullet.body.velocity.y = Math.sin(angle + inaccuracy) * bulletSpeed;
    
    // Make bullet die after a certain distance
    bullet.isEnemyBullet = true;
    bullet.distanceTraveled = 0;
    bullet.maxDistance = 800;
    
    // Add bullet to update list and collisions
    if (this.scene.playerManager) {
      this.scene.physics.add.overlap(
        bullet,
        this.scene.playerManager.getPlayer(),
        (bullet, player) => {
          bullet.destroy();
          // Damage player if hit by bullet
          if (!player.isInvincible && !player.isDying) {
            this.scene.handlePlayerDamage();
          }
        }
      );
    }
    
    // Update bullet position and check for destruction
    this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (!bullet || !bullet.active) return;
        
        bullet.distanceTraveled += bulletSpeed * 0.1;
        if (bullet.distanceTraveled >= bullet.maxDistance) {
          bullet.destroy();
        }
      },
      repeat: 20
    });
  }

  startEnemyAttack(enemy, player, onPlayerDeath) {
    if (enemy.isAttacking || enemy.attackCooldown || enemy.isDying || enemy.isHit) return;
    
    // Set up the attack
    enemy.isAttacking = true;
    enemy.attackCooldown = true;
    
    // Stop movement
    if (enemy.body) {
      enemy.body.velocity.x = 0;
      enemy.body.velocity.y = 0;
    }
    
    // Choose the appropriate attack animation based on direction to player
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    let attackAnim = 'enemy_attack_down';
    let flipX = false;
    
    // Determine attack direction based on player position
    if (absX > absY * 2) {
      attackAnim = 'enemy_attack_right';
      flipX = dx < 0;
    } else if (absY > absX * 2) {
      attackAnim = (dy < 0) ? 'enemy_attack_up' : 'enemy_attack_down';
    } else {
      if (dy < 0) {
        attackAnim = 'enemy_attack_right_up';
        flipX = dx < 0;
      } else {
        attackAnim = 'enemy_attack_right_down';
        flipX = dx < 0;
      }
    }
    
    // For colored enemies, transform the animation key
    if (enemy.useColorAssets && enemy.enemyType) {
      // Extract the direction part of the animation key
      const direction = attackAnim.replace('enemy_attack_', '');
      
      // Create the colored animation key using the correct format based on Animations.js
      const coloredAnimKey = `enemy_${enemy.enemyType}_attack_${direction}`;
      
      // Check if this animation exists
      if (this.scene.anims.exists(coloredAnimKey)) {
        attackAnim = coloredAnimKey;
      } else {
        // Try another format with underscore suffix
        const fallbackKey = `enemy_${enemy.enemyType}_attack_${direction}`;
        if (this.scene.anims.exists(fallbackKey)) {
          attackAnim = fallbackKey;
        } else {
          console.warn(`Attack animation ${coloredAnimKey} not found for ${enemy.enemyType} enemy, using standard animation`);
        }
      }
    }
    
    enemy.currentDirection = attackAnim.replace('attack', 'run');
    
    // Remove any existing animation listeners to prevent duplicates
    enemy.off('animationcomplete');
    
    // Play the attack animation
    enemy.play(attackAnim);
    enemy.setFlipX(flipX);
    
    // Handle animation completion
    enemy.once('animationcomplete', function(animation) {
      if (animation.key.includes('attack')) {
        enemy.isAttacking = false;
        
        // Check if this attack should kill the player
        if (!player.isDying && onPlayerDeath) {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const killRange = player.oval.radiusX + enemy.oval.radiusX - 90;
          
          if (d <= killRange) {
            onPlayerDeath();
          }
        }
        
        // Use shorter cooldown for attacks on a dying player
        const baseCooldownTime = player.isDying ? 400 : 750;
        
        // Adjust cooldown time for bullet time to keep attack frequency consistent
        const timeScale = this.scene.time.timeScale || 1.0;
        const cooldownTime = baseCooldownTime * timeScale;
        
        this.scene.time.delayedCall(cooldownTime, function() {
          enemy.attackCooldown = false;
        });
      }
    }, this);
  }
}