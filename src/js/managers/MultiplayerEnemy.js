import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';
import { EnemyEffects } from './EnemyEffects.js';

export class MultiplayerEnemy {
    constructor(scene, playerId, bloodContainer) {
        this.scene = scene;
        this.playerId = playerId;
        this.player = null;
        this.playerShadows = [];
        this.lastDirection = 'down';
        this.shootingDirection = { x: 0, y: 0 };
        this.bullets = null;
        this.health = 3;

        // Weapon system
        this.weaponType = 'rifle'; // Default weapon type (can be 'rifle' or 'shotgun')
        this.originalWeaponType = 'rifle';

        this.shadowOffsets = [
            { x: 10, y: 10 },   // For reflector in top-left, shadow falls bottom-right
            { x: -10, y: 10 },  // For reflector in top-right, shadow falls bottom-left
            { x: 10, y: -10 },  // For reflector in bottom-left, shadow falls top-right
            { x: -10, y: -10 }  // For reflector in bottom-right, shadow falls top-left
        ];
        // Death animation properties
        this.deathTween = null;
        this.deathAnimProgress = { frame: 0 };
        this.deathAnimTimers = [];
        this.currentDeathFrame = 0;
        this.effects = new EnemyEffects(scene, bloodContainer);
    }

    createPlayer(sX, sY, health) {
        // Get the selected character
        let selectedCharacter = 'default';

        // Set the texture prefix based on the selected character
        const prefix = selectedCharacter === 'default' ? '' : `${selectedCharacter}_`;

        // Store the selected character and prefix for later use
        this.selectedCharacter = selectedCharacter;
        this.texturePrefix = prefix;

        // Verify that essential animations exist for this character
        this.verifyEssentialAnimations();

        // Determine starting position - players start back-to-back in multiplayer
        let startX = sX;
        let startY = sY;
        console.log("Start X, Start Y", startX, startY);

        // Create the player sprite in the center with the appropriate texture
        this.player = this.scene.physics.add.sprite(
            startX,
            startY,
            `${prefix}down_idle_1`
        );
        this.player.setCollideWorldBounds(true); // Set to false to allow camera to follow outside boundaries

        // Set default scale
        const baseScale = 0.5;
        this.player.setScale(baseScale);

        this.player.setOrigin(0.5, 0.5);
        this.player.body.setSize(this.player.displayWidth, this.player.displayHeight);

        // Define the player's collision oval.
        this.player.oval = {
            radiusX: this.player.displayWidth / 2,
            radiusY: this.player.displayHeight / 2
        };

        // For death animation, make sure we're using a proper sprite size
        this.player.deathAnimation = {
            width: 64,  // Set appropriate width for death animation frames
            height: 64  // Set appropriate height for death animation frames
        };

        // Make sure we can use the player_death sprites for animation
        // Check if death animation frames are loaded
        console.log(`Checking if ${selectedCharacter} death animation frames are loaded:`);
        const deathFrames = [
            `${prefix}player_death_1`, `${prefix}player_death_2`, `${prefix}player_death_3`,
            `${prefix}player_death_4`, `${prefix}player_death_5`, `${prefix}player_death_6`,
            `${prefix}player_death_7`, `${prefix}player_death_8`, `${prefix}player_death_9`,
            `${prefix}player_death_10`, `${prefix}player_death_11`
        ];

        deathFrames.forEach(frame => {
            console.log(`Frame ${frame} exists: ${this.scene.textures.exists(frame)}`);
        });

        // Create multiple player shadows for all modes
        this.playerShadows = [];
        this.shadowOffsets.forEach(offset => {
            let shadow = this.scene.add.image(
                this.player.x + offset.x,
                this.player.y + offset.y + 50, // Keep the Y offset from before
                'shadow'
            );
            // Set shadow scale
            shadow.setScale(1.1);
            shadow.setAlpha(0.675 / this.shadowOffsets.length); // Reduce opacity further since we have multiple shadows (50% darker)
            shadow.setDepth(1);
            // Save both the shadow sprite and its offset
            this.playerShadows.push({ sprite: shadow, offset: offset });
        });

        // Check if we're in versus mode
        const isVersusMode = this.scene.versusMode === true;

        if (isVersusMode) {
            // In versus mode, add green marker under the shadows
            this.playerMarker = this.scene.add.image(
                this.player.x,
                this.player.y + 56, // Adjusted position (31 + 25 = 56)
                'greenMark'
            );
            this.playerMarker.setScale(0.7 * 1.25 * 1.25); // Increase size by another 25%
            this.playerMarker.setAlpha(0.8);
            this.playerMarker.setDepth(0); // Set depth to 0 to be under shadows
        }

        // Set player to higher depth to ensure it's above shadow
        this.player.setDepth(10);

        // Debug logs to track shadow creation
        console.log("Multiple player shadows created for reflector effect");

        this.player.isDying = false; // Flag to track if player is in death animation
        this.player.isInvincible = false; // Flag for invincibility from drone upgrades
        this.player.speed = 250; // Default movement speed that can be boosted by upgrades

        // Initialize player health system
        this.health = health; // Player now has 3 hit points
        this.maxHealth = 10; // Maximum health with shields

        // Set initial animation with the appropriate character prefix if needed
        const animPrefix = selectedCharacter !== 'default' ? `${selectedCharacter}_` : '';

        // In single player, just use default down animation
        this.player.play(`${animPrefix}down_idle`);
        this.lastDirection = 'down';

        // Listen for orientation changes to update sprite size
        this.scene.events.on('orientationChange', this.handleOrientationChange, this);
        this.createShieldBar();
    }

    // Handle orientation changes
    handleOrientationChange({ isPortrait }) {
        if (!this.player) return;

        console.log(`Player handling orientation change: isPortrait=${isPortrait}`);

        // Update collision body size
        this.player.body.setSize(this.player.displayWidth, this.player.displayHeight);

        // Update collision oval
        this.player.oval.radiusX = this.player.displayWidth / 2;
        this.player.oval.radiusY = this.player.displayHeight / 2;

        // If player is in death animation, make sure to clean up any duplicate sprites
        if (this.player.isDying) {
            // For portrait mode: ensure any existing sprite is properly managed
            if (this.player.deathAnimSprite) {
                this.player.deathAnimSprite.destroy();
                this.player.deathAnimSprite = null;
            }

            // Refresh alpha and depth settings
            this.player.setAlpha(1.0);

            // Set appropriate depth based on orientation
            if (isPortrait) {
                this.player.setDepth(21); // Higher depth in portrait mode
            } else {
                this.player.setDepth(20);
            }
        }
    }

    // Safe way to play animations that won't crash if player is inactive or dying
    safePlayAnimation(animKey, ignoreIfCurrentAnim = true) {
        // Multiple safety checks:
        // 1. Player must exist
        // 2. Player must be active
        // 3. Player must not be dying
        // 4. Player must have anims component
        if (!this.player || !this.player.active || this.player.isDying || !this.player.anims) {
            return false;
        }

        // Check if we should ignore when it's already the current animation
        if (ignoreIfCurrentAnim &&
            this.player.anims.currentAnim &&
            this.player.anims.currentAnim.key === animKey) {
            return true; // Animation is already playing
        }

        // Check if animation exists 
        if (!this.player.anims.exists(animKey)) {
            console.warn(`Animation ${animKey} doesn't exist`);
            return false;
        }

        // Safe to play animation
        try {
            this.player.play(animKey, true);
            return true;
        } catch (error) {
            console.error(`Error playing animation ${animKey}:`, error);
            return false;
        }
    }

    handleMovement(data) {
        // Safety checks at the beginning
        if (!this.player) {
            console.warn('Cannot handle movement: player is null or undefined');
            return;
        }

        if (!this.player.active) {
            console.warn('Cannot handle movement: player is not active');
            return;
        }

        if (!this.player.body || typeof this.player.setVelocity !== 'function') {
            console.warn('Cannot handle movement: player.body is missing or player.setVelocity is not a function');
            return;
        }

        let vx = data.vx, vy = data.vy;

        this.player.x = data.x;
        this.player.y = data.y;
        this.health = data.health;
        // Get animation prefix for the selected character
        const animPrefix = this.selectedCharacter !== 'default' ? `${this.selectedCharacter}_` : '';


        // Safety check: make sure player exists, is active, and has a valid body
        if (this.player && this.player.active && this.player.body && typeof this.player.setVelocity === 'function') {
            this.player.setVelocity(vx, vy);
        } else {
            console.warn('Player not available for movement in handleMovement');
            return; // Exit early if player isn't available
        }

        // Update player animation based on movement (when not shooting)
        let shootX = data.shootX, shootY = data.shootY;
        this.updateShadows();
        this.updateShieldBar();

        // Player animation based on movement and shooting.
        if (shootX === 0 && shootY === 0) {
            if (vx === 0 && vy === 0) {
                // Check if player exists first
                if (!this.player) {
                    console.error("Player sprite is undefined, cannot play idle animation");
                    return;
                }

                const animKey = `${animPrefix}${this.lastDirection}_idle`;
                if (this.scene.anims.exists(animKey)) {
                    this.player.play(animKey, true);
                } else {
                    console.warn(`Animation ${animKey} doesn't exist!`);

                    // Try the fallback without prefix
                    const fallbackKey = `${this.lastDirection}_idle`;
                    if (this.scene.anims.exists(fallbackKey)) {
                        this.player.play(fallbackKey, true);
                    } else {
                        console.error(`Neither ${animKey} nor fallback ${fallbackKey} exists!`);
                        // Last resort - if we have any down_idle animation, use that
                        if (this.scene.anims.exists('down_idle')) {
                            this.player.play('down_idle', true);
                        } else {
                            console.error("No usable idle animations found");
                        }
                    }
                }
            } else {
                this.updateMovementAnimation(vx, vy);
            }
        } else {
            // Determine if player is moving
            let isMoving = (vx !== 0 || vy !== 0);

            // Calculate angle in radians then convert to degrees for shooting
            let shootAngle = Math.atan2(shootY, shootX);
            let shootDegrees = (shootAngle * 180 / Math.PI + 360) % 360;

            // Helper function to safely play animation with fallback
            const safePlayShootingAnimation = (walkKey, idleKey) => {
                // Check if player exists first
                if (!this.player) {
                    console.error("Player sprite is undefined, cannot play animation");
                    return;
                }

                const animKey = isMoving ? walkKey : idleKey;
                if (this.scene.anims.exists(animKey)) {
                    this.player.play(animKey, true);
                } else {
                    console.warn(`Animation ${animKey} doesn't exist!`);

                    // Try the fallback without prefix
                    const fallbackKey = isMoving ? walkKey.replace(animPrefix, '') : idleKey.replace(animPrefix, '');
                    if (this.scene.anims.exists(fallbackKey)) {
                        this.player.play(fallbackKey, true);
                    } else {
                        console.error(`Neither ${animKey} nor fallback ${fallbackKey} exists!`);
                        // Last resort - if we have any down_idle animation, use that
                        if (this.scene.anims.exists('down_idle')) {
                            this.player.play('down_idle', true);
                        } else {
                            console.error("No usable animations found");
                        }
                    }
                }
            };

            // Use the same 8-way direction logic for shooting animations
            if (shootDegrees >= 337.5 || shootDegrees < 22.5) {
                // Right direction (0 degrees)
                safePlayShootingAnimation(`${animPrefix}side_walk`, `${animPrefix}side_idle`);
                this.lastDirection = 'side';
                this.player.setFlipX(false);
            } else if (shootDegrees >= 22.5 && shootDegrees < 67.5) {
                // Down-right direction (45 degrees)
                safePlayShootingAnimation(`${animPrefix}down_corner_walk`, `${animPrefix}down_corner_idle`);
                this.lastDirection = 'down_corner';
                this.player.setFlipX(false);
            } else if (shootDegrees >= 67.5 && shootDegrees < 112.5) {
                // Down direction (90 degrees)
                safePlayShootingAnimation(`${animPrefix}down_walk`, `${animPrefix}down_idle`);
                this.lastDirection = 'down';
                this.player.setFlipX(false);
            } else if (shootDegrees >= 112.5 && shootDegrees < 157.5) {
                // Down-left direction (135 degrees)
                safePlayShootingAnimation(`${animPrefix}down_corner_walk`, `${animPrefix}down_corner_idle`);
                this.lastDirection = 'down_corner';
                this.player.setFlipX(true);
            } else if (shootDegrees >= 157.5 && shootDegrees < 202.5) {
                // Left direction (180 degrees)
                safePlayShootingAnimation(`${animPrefix}side_walk`, `${animPrefix}side_idle`);
                this.lastDirection = 'side';
                this.player.setFlipX(true);
            } else if (shootDegrees >= 202.5 && shootDegrees < 247.5) {
                // Up-left direction (225 degrees)
                safePlayShootingAnimation(`${animPrefix}up_corner_walk`, `${animPrefix}up_corner_idle`);
                this.lastDirection = 'up_corner';
                this.player.setFlipX(true);
            } else if (shootDegrees >= 247.5 && shootDegrees < 292.5) {
                // Up direction (270 degrees)
                safePlayShootingAnimation(`${animPrefix}up_walk`, `${animPrefix}up_idle`);
                this.lastDirection = 'up';
                this.player.setFlipX(false);
            } else if (shootDegrees >= 292.5 && shootDegrees < 337.5) {
                // Up-right direction (315 degrees)
                safePlayShootingAnimation(`${animPrefix}up_corner_walk`, `${animPrefix}up_corner_idle`);
                this.lastDirection = 'up_corner';
                this.player.setFlipX(false);
            }
        }
    }

    updateShadows() {
        // Update player shadows positions
        if (this.playerShadows) {
            this.playerShadows.forEach(shadowData => {
                shadowData.sprite.x = this.player.x + shadowData.offset.x;
                shadowData.sprite.y = this.player.y + shadowData.offset.y + 50; // Keep the +50 Y offset
            });
        }
    }

    // Update player's movement animation.
    updateMovementAnimation(vx, vy) {
        // Calculate angle in radians then convert to degrees
        let angle = Math.atan2(vy, vx);
        let degrees = (angle * 180 / Math.PI + 360) % 360;

        // Get the animation prefix for the selected character
        const animPrefix = this.selectedCharacter !== 'default' ? `${this.selectedCharacter}_` : '';

        // Divide the 360 degrees into 8 equal sections (45 degrees each)
        // 0/360 = right, 45 = down-right, 90 = down, 135 = down-left, 
        // 180 = left, 225 = up-left, 270 = up, 315 = up-right

        // Helper function to safely play animation with fallback
        const safePlayAnimation = (primaryKey, fallbackKey) => {
            // Check if player exists first
            if (!this.player) {
                console.error("Player sprite is undefined, cannot play animation");
                return;
            }

            console.log(`Trying to play animation: ${primaryKey}, exists: ${this.scene.anims.exists(primaryKey)}`);
            if (this.scene.anims.exists(primaryKey)) {
                this.player.play(primaryKey, true);
            } else {
                console.warn(`Animation ${primaryKey} doesn't exist! Trying fallback: ${fallbackKey}`);

                // Try the fallback animation
                if (this.scene.anims.exists(fallbackKey)) {
                    this.player.play(fallbackKey, true);
                } else {
                    console.error(`Neither ${primaryKey} nor fallback ${fallbackKey} exists!`);
                    // Last resort - if we have any down_walk animation, use that
                    if (this.scene.anims.exists('down_walk')) {
                        this.player.play('down_walk', true);
                    } else {
                        console.error("No usable animations found");
                    }
                }
            }
        };

        if (degrees >= 337.5 || degrees < 22.5) {
            // Right direction (0 degrees)
            safePlayAnimation(`${animPrefix}side_walk`, 'side_walk');
            this.lastDirection = 'side';
            this.player.setFlipX(false);
        } else if (degrees >= 22.5 && degrees < 67.5) {
            // Down-right direction (45 degrees)
            safePlayAnimation(`${animPrefix}down_corner_walk`, 'down_corner_walk');
            this.lastDirection = 'down_corner';
            this.player.setFlipX(false);
        } else if (degrees >= 67.5 && degrees < 112.5) {
            // Down direction (90 degrees)
            safePlayAnimation(`${animPrefix}down_walk`, 'down_walk');
            this.lastDirection = 'down';
            this.player.setFlipX(false);
        } else if (degrees >= 112.5 && degrees < 157.5) {
            // Down-left direction (135 degrees)
            safePlayAnimation(`${animPrefix}down_corner_walk`, 'down_corner_walk');
            this.lastDirection = 'down_corner';
            this.player.setFlipX(true);
        } else if (degrees >= 157.5 && degrees < 202.5) {
            // Left direction (180 degrees)
            safePlayAnimation(`${animPrefix}side_walk`, 'side_walk');
            this.lastDirection = 'side';
            this.player.setFlipX(true);
        } else if (degrees >= 202.5 && degrees < 247.5) {
            // Up-left direction (225 degrees)
            safePlayAnimation(`${animPrefix}up_corner_walk`, 'up_corner_walk');
            this.lastDirection = 'up_corner';
            this.player.setFlipX(true);
        } else if (degrees >= 247.5 && degrees < 292.5) {
            // Up direction (270 degrees)
            safePlayAnimation(`${animPrefix}up_walk`, 'up_walk');
            this.lastDirection = 'up';
            this.player.setFlipX(false);
        } else if (degrees >= 292.5 && degrees < 337.5) {
            // Up-right direction (315 degrees)
            safePlayAnimation(`${animPrefix}up_corner_walk`, 'up_corner_walk');
            this.lastDirection = 'up_corner';
            this.player.setFlipX(false);
        }
    }

    // Check if player is completely outside the camera view
    isCompletelyOutsideCameraView() {
        if (!this.player) return false;

        const camera = this.scene.cameras.main;
        const buffer = 100; // Add a buffer to account for large sprites

        // Get camera bounds
        const cameraLeft = camera.worldView.x - buffer;
        const cameraRight = camera.worldView.x + camera.worldView.width + buffer;
        const cameraTop = camera.worldView.y - buffer;
        const cameraBottom = camera.worldView.y + camera.worldView.height + buffer;

        // Calculate player bounds with its dimensions
        const playerWidth = this.player.displayWidth || this.player.width || 64;
        const playerHeight = this.player.displayHeight || this.player.height || 64;
        const playerLeft = this.player.x - (playerWidth / 2);
        const playerRight = this.player.x + (playerWidth / 2);
        const playerTop = this.player.y - (playerHeight / 2);
        const playerBottom = this.player.y + (playerHeight / 2);

        // Check if player is completely outside camera view
        const isOutside =
            playerRight < cameraLeft ||
            playerLeft > cameraRight ||
            playerBottom < cameraTop ||
            playerTop > cameraBottom;

        if (isOutside) {
            console.log(`Player at (${this.player.x},${this.player.y}) is completely outside camera view:`,
                {
                    playerBounds: { left: playerLeft, right: playerRight, top: playerTop, bottom: playerBottom },
                    cameraBounds: { left: cameraLeft, right: cameraRight, top: cameraTop, bottom: cameraBottom }
                });
        }

        return isOutside;
    }

    createPlayerDeathBlood() {
        // If player is already dying, don't restart the death animation
        if (this.player.isDying) {
            console.log('Player already dying, not restarting death animation');
            return;
        }

        // Mark player as dying to prevent multiple blood effects
        this.player.isDying = true;

        // Reset any existing death position properties
        if (this.player) {
            this.player.deathX = undefined;
            this.player.deathY = undefined;
        }

        // Check if player is completely off-screen
        const isCompletelyOffScreen = this.isCompletelyOutsideCameraView();

        // For completely off-screen deaths, use a simplified process
        if (isCompletelyOffScreen) {
            console.log(`Player at (${this.player.x}, ${this.player.y}) is completely off-screen - using simplified death`);

            // Skip the full animation, but still trigger game over with a small delay
            this.scene.time.delayedCall(200, () => {
                // Tell the scene the player is dead
                this.player.emit('manual-death-complete');
            });

            return; // Skip the full animation process
        }

        console.log('Starting player death animation');

        // Get the animation prefix for the selected character
        const prefix = this.texturePrefix || '';

        // Manual frame-by-frame animation with dynamic frame count
        const isCharacter3 = this.selectedCharacter === 'character3';
        const deathFrameCount = isCharacter3 ? 12 : 11; // character3 has 12 death frames

        // Create array of death frames based on character type
        this.deathFrames = [];
        for (let i = 1; i <= deathFrameCount; i++) {
            this.deathFrames.push(`${prefix}player_death_${i}`);
        }

        // Remove any tweens affecting the player to prevent glitches
        this.scene.tweens.killTweensOf(this.player);

        // Stop any current animation to prevent conflicts
        this.player.anims.stop();

        // Remove any tints that may have been applied previously
        this.player.clearTint();

        // Make sure we preserve scale
        const originalScale = { x: this.player.scaleX, y: this.player.scaleY };

        // Set the first frame
        this.player.setTexture(this.deathFrames[0]);

        // Restore original scale
        this.player.setScale(originalScale.x, originalScale.y);

        // Check screen orientation to handle portrait mode correctly - use registry first
        const isPortrait = this.scene.registry.get('isPortrait') ||
            (this.scene.scale.height > this.scene.scale.width);

        // Set fixed opacity to avoid transparency issues in portrait mode
        this.player.setAlpha(1.0);

        // Set depth to ensure proper layering in all orientations
        this.player.setDepth(20);

        // Create a manual frame animation using time events
        this.currentDeathFrame = 0;

        // Clear any existing timers
        if (this.deathAnimTimers) {
            this.deathAnimTimers.forEach(timer => {
                if (timer) timer.remove();
            });
        }

        // Use a single managed animation approach instead of multiple timers
        this.deathAnimTimers = [];

        // Create a dummy object to tween - we'll use this to track progress
        this.deathAnimProgress = { frame: 0 };

        // Clear any previous tweens
        if (this.deathTween) {
            this.deathTween.stop();
            this.deathTween = null;
        }

        console.log(`Portrait mode detected: ${isPortrait}`);

        // If in portrait mode, make sure there are no duplicate sprites
        if (isPortrait && this.player.deathAnimSprite) {
            this.player.deathAnimSprite.destroy();
            this.player.deathAnimSprite = null;
        }

        // Create a tween that goes through all frames
        const lastFrameIndex = this.deathFrames.length - 1;
        this.deathTween = this.scene.tweens.add({
            targets: this.deathAnimProgress,
            frame: lastFrameIndex, // Go to last frame (index is count-1)
            duration: this.deathFrames.length * 100, // Duration based on frame count
            ease: 'Linear',
            onUpdate: () => {
                // Calculate the current frame based on progress
                const newFrame = Math.floor(this.deathAnimProgress.frame);

                // Only update the texture if the frame has changed
                if (newFrame !== this.currentDeathFrame && newFrame < this.deathFrames.length) {
                    this.currentDeathFrame = newFrame;

                    // Only update if the player still exists and is still dying
                    if (this.player && this.player.active && this.player.isDying) {
                        // For portrait mode: first ensure any existing sprite is destroyed
                        if (this.player.deathAnimSprite) {
                            this.player.deathAnimSprite.destroy();
                            this.player.deathAnimSprite = null;
                        }

                        // Update the texture directly on the player
                        this.player.setTexture(this.deathFrames[newFrame]);

                        // Ensure consistent scaling in both orientations
                        this.player.setScale(originalScale.x, originalScale.y);

                        // Set fixed alpha to ensure full opacity
                        this.player.setAlpha(1.0);

                        // Refresh depth value to avoid z-fighting in portrait mode
                        if (isPortrait) {
                            this.player.setDepth(21); // Slightly higher than normal depth to avoid z-fighting
                        } else {
                            this.player.setDepth(20);
                        }

                        // Store original position on first frame if we don't already have it
                        // We only need to do this once at the start of the animation
                        if (newFrame === 0) {
                            // Just store the position directly on the player object
                            this.player.deathX = this.player.x;
                            this.player.deathY = this.player.y;
                            console.log(`Player death at position: (${this.player.deathX}, ${this.player.deathY})`);
                        }

                        // Simply set position directly - no clamping or extra checks needed
                        // This ensures animation plays exactly where the player died
                        if (this.player.deathX !== undefined && this.player.deathY !== undefined) {
                            this.player.x = this.player.deathX;
                            this.player.y = this.player.deathY;
                        }
                    }
                }
            },
            onComplete: () => {
                console.log('Manual death animation completed');
                if (this.player && this.player.active) {
                    // Hold final frame and trigger the manual-death-complete event
                    this.player.emit('manual-death-complete');
                }
            }
        });

        // Gently fade out shadows rather than growing/rotating them which may conflict with the animation
        if (this.playerShadows) {
            this.playerShadows.forEach(shadowData => {
                // Fade out shadow
                this.scene.tweens.add({
                    targets: shadowData.sprite,
                    alpha: 0.5, // Just fade to a low alpha (50% darker)
                    duration: 1000,
                    ease: 'Linear'
                });
            });
        }

        // Freeze player movement
        this.player.body.velocity.x = 0;
        this.player.body.velocity.y = 0;
    }

    getPlayer() {
        return this.player;
    }

    // Clean up resources when shutting down or restarting
    shutdown() {
        // Clear any existing timers
        if (this.deathAnimTimers) {
            this.deathAnimTimers.forEach(timer => {
                if (timer) timer.remove();
            });
        }

        // Stop any tweens
        if (this.deathTween) {
            this.deathTween.stop();
            this.deathTween = null;
        }

        // Clear the reload timer if it exists
        if (this.reloadTimer) {
            this.reloadTimer.remove();
            this.reloadTimer = null;
        }

        // Clear any auto-fire timer
        if (this.autoFireTimer) {
            this.autoFireTimer.remove();
            this.autoFireTimer = null;
        }

        // Reset death position properties on the player object
        if (this.player) {
            this.player.deathX = undefined;
            this.player.deathY = undefined;
        }

        // Clean up health display
        if (this.healthContainer) {
            this.healthContainer.destroy();
            this.healthContainer = null;
        }
    }

    // Set the weapon type (rifle or shotgun)
    setWeaponType(type) {
        // Store the original weapon type if not already saved
        if (!this.originalWeaponType) {
            this.originalWeaponType = this.weaponType;
        }

        // Set the new weapon type
        this.weaponType = type;

        console.log(`Weapon type set to: ${type}`);
    }

    // Handle player damage
    damagePlayer(amount) {
        console.log('===== PLAYER DAMAGE METHOD CALLED =====');
        console.log(`Attempting to damage player by ${amount} points`);

        // Safety checks to prevent errors
        if (!this.player) {
            console.warn('Cannot damage player: player is undefined/null');
            return;
        }

        // If player isn't active, don't try to reactivate it - skip damage instead
        // CRITICAL FIX: Never force reactivate a player that might be dying
        if (!this.player.active) {
            console.warn('Player is not active - skipping damage');
            return;
        }

        // If player body is missing, check if player is dying before recreating
        if (!this.player.body) {
            // Only recreate physics body if player isn't dying
            if (!this.player.isDying) {
                console.warn('Player body is missing but not dying - recreating physics body');
                this.scene.physics.world.enable(this.player);
            } else {
                console.log('Player body is missing because player is dying - skipping recreation');
                return;
            }
        }

        // Only use health tracking on the PlayerManager (this.health), NOT on the sprite
        // This ensures we have a single source of truth

        // Initialize health if not set (one time only)
        if (typeof this.health === 'undefined') {
            console.log('Initializing player health to 3');
            this.health = 3;
            this.maxHealth = 10;
        }

        // Log player state for debugging
        console.log('Player state before damage:', {
            player: !!this.player,
            active: this.player.active,
            hasBody: !!this.player.body,
            isDying: this.player.isDying,
            isInvincible: this.player.isInvincible,
            health: this.health,
            maxHealth: this.maxHealth
        });

        // Check if player is already dying
        if (this.player.isDying) {
            console.log('Player already dying, ignoring damage');
            return;
        }

        // Check if player is invincible (from shield or other effects)
        if (this.player.isInvincible) {
            console.log('Player is invincible, ignoring damage');
            return;
        }

        console.log(`Player taking ${amount} damage`);

        // Reduce player health - ONLY update this.health, not this.player.health
        this.health = Math.max(0, this.health - amount);
        console.log(`Player health reduced to ${this.health}/${this.maxHealth}`);

        // Update health display if it exists
        this.updateHealthDisplay();

        // Make player temporarily invincible
        this.player.isInvincible = true;
        console.log('Player is now temporarily invincible');

        // Visual feedback - flash effect
        this.scene.tweens.add({
            targets: this.player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 3,
            onUpdate: () => {
                // Safety check - stop tween if player is no longer valid
                if (!this.player || !this.player.active || this.player.isDying) {
                    return false; // Stop the tween
                }
            },
            onComplete: () => {
                // Safety check before resetting alpha
                if (this.player && this.player.active && !this.player.isDying) {
                    this.player.alpha = 1;
                    // Remove invincibility after a short delay
                    this.scene.time.delayedCall(800, () => {
                        if (this.player && this.player.active && !this.player.isDying) {
                            this.player.isInvincible = false;
                        }
                    });
                }
            }
        });

        // Play hit sound if available
        if (this.scene.sound.get('grunt_1')) {
            const hitSounds = ['grunt_1', 'grunt_2', 'grunt_3', 'grunt_4'];
            const randomSound = Phaser.Utils.Array.GetRandom(hitSounds);
            this.scene.sound.play(randomSound, { volume: 0.5 });
        }

        // Check for player death
        if (this.health <= 0) {
            console.log('Player has died from damage!');

            // Trigger player death in the scene
            if (this.scene && typeof this.scene.handlePlayerDeath === 'function') {
                console.log('Calling scene.handlePlayerDeath()');
                this.scene.handlePlayerDeath();
            } else {
                console.error('Cannot handle player death: scene or handlePlayerDeath function not available');
            }
        }
    }

    createShieldBar() {
        if (!this.player) return;

        this.health = 3;
        this.maxShields = 10;
        // Create shield bar background (black rectangle)
        this.shieldBarBg = this.scene.add.rectangle(
            this.player.x,
            this.player.y + 40, // Position above AI player
            50, // Width
            8, // Height
            0x000000 // Black color
        );
        this.shieldBarBg.setDepth(20);
        this.shieldBarBg.setAlpha(0.7);

        // Create shield bar (green rectangle initially)
        this.shieldBar = this.scene.add.rectangle(
            this.player.x - 25, // Left-aligned with background
            this.player.y + 40,
            50, // Full width initially
            8,
            0x00ff00 // Green color
        );
        this.shieldBar.setDepth(21);
        this.shieldBar.setOrigin(0, 0.5); // Set origin to left center for easier scaling

        // Update shield bar color based on current shield value
        this.updateShieldBarColor();
    }

    updateShieldBar() {
        if (!this.player || !this.shieldBar || !this.shieldBarBg) return;
        if(this.health == 0) {
            this.shieldBar.destroy();
            this.shieldBarBg.destroy();
            return;
        }

        // Position shield bar above AI player
        this.shieldBarBg.x = this.player.x;
        this.shieldBarBg.y = this.player.y + 40;

        this.shieldBar.x = this.player.x - 25; // Left-aligned
        this.shieldBar.y = this.player.y + 40;

        // Update shield bar width based on current shield value
        const shieldPercentage = this.health / this.maxShields;
        this.shieldBar.width = 50 * shieldPercentage;

        // Update shield bar color
        this.updateShieldBarColor();
    }

    updateShieldBarColor() {
        if (!this.shieldBar) return;

        const shieldPercentage = this.health / this.maxShields;

        // Set color based on shield percentage
        if (shieldPercentage <= 0.25) {
            // 25% or less - red
            this.shieldBar.fillColor = 0xff0000;
        } else if (shieldPercentage <= 0.75) {
            // 75% or less - orange
            this.shieldBar.fillColor = 0xff9900;
        } else {
            // Above 75% - green
            this.shieldBar.fillColor = 0x00ff00;
        }
    }

    // Verify essential animations exist and create fallbacks if needed
    verifyEssentialAnimations() {
        if (!this.scene || !this.scene.anims) {
            console.error("Cannot verify animations - scene or animation system not available");
            return;
        }

        const directions = ['down', 'up', 'side', 'down_corner', 'up_corner'];
        const states = ['idle', 'walk'];
        const animPrefix = this.selectedCharacter !== 'default' ? `${this.selectedCharacter}_` : '';

        // Log the available animations
        console.log("Available animations:", Object.keys(this.scene.anims.anims.entries));

        // Check essential animations for this character
        for (const direction of directions) {
            for (const state of states) {
                const animKey = `${animPrefix}${direction}_${state}`;
                const noPrefix = `${direction}_${state}`;

                // Check if animation exists with prefix or without
                if (!this.scene.anims.exists(animKey) && !this.scene.anims.exists(noPrefix)) {
                    console.warn(`Animation missing: ${animKey} (and no fallback)`);

                    // Check if we have the basic frame to create a simple animation
                    const frameKey = `${this.texturePrefix}${direction}_${state}_1`;
                    if (this.scene.textures.exists(frameKey)) {
                        // Create a minimal animation with just this frame
                        try {
                            console.log(`Creating minimal animation ${noPrefix} with frame ${frameKey}`);
                            this.scene.anims.create({
                                key: noPrefix,
                                frames: [{ key: frameKey }],
                                frameRate: 1,
                                repeat: -1
                            });
                        } catch (e) {
                            console.error(`Failed to create fallback animation: ${e.message}`);
                        }
                    } else {
                        console.error(`Cannot create fallback animation - frame ${frameKey} not found`);
                    }
                }
            }
        }

        // Ensure we have the critical down_idle animation one way or another
        if (!this.scene.anims.exists('down_idle')) {
            console.warn("Critical animation 'down_idle' missing, creating emergency fallback");
            try {
                // Try to create a simple emergency animation with any available texture
                const availableTextures = Object.keys(this.scene.textures.list).filter(key =>
                    key !== '__DEFAULT' && key !== '__MISSING' && !key.includes('__BASE')
                );

                if (availableTextures.length > 0) {
                    this.scene.anims.create({
                        key: 'down_idle',
                        frames: [{ key: availableTextures[0] }],
                        frameRate: 1,
                        repeat: -1
                    });
                    console.log(`Created emergency 'down_idle' animation with ${availableTextures[0]}`);
                }
            } catch (e) {
                console.error("Failed to create emergency animation:", e);
            }
        }
    }

    handlePlayerDamage() {
        console.log("Enemy received player damage");
        this.effects.createPlayerBloodSplatter(this.player);
        this.health -= 1;
        this.updateShieldBar();
    }

    // Handle when the player is killed
    handlePlayerDeath() {
        console.log("Start to kill enemy");
        // Get player reference
        const player = this.player;
        this.health = 0;
        this.updateShieldBar();

        // If player is already dying, don't handle death again
        if (player.isDying) {
            console.log('Player already dying, ignoring duplicate death event');
            return;
        }

        // Store original scale to avoid conflicts
        const originalPlayerScale = { x: player.scaleX, y: player.scaleY };

        // // Create blood explosion first (behind player)
        // this.enemyManager.createPlayerDeathBlood(player);

        // Mark player as dying with visual effects
        this.createPlayerDeathBlood();

        // Make sure player scale doesn't get modified by other effects
        player.setScale(originalPlayerScale.x, originalPlayerScale.y);

        // Fallback timer in case both animation methods fail
        // Increased to 2550ms (1800ms + 750ms delay) to give the animation enough time to complete
        this.scene.time.delayedCall(2550, () => {
            // Use our helper function to avoid code duplication
            // if (this.scene.isActive('GameScene')) {
            //     console.log('Player death animation timed out, showing GIT GUD screen');
            //     this.showGitGudScreen(finalScore, killCount, accuracy);
            // }
            this.player.destroy();
            this.playerShadows.forEach(shadow => shadow.sprite.destroy());
            delete this.player;
            delete this.playerShadows;
            this.shutdown();
            console.log("Enemy shutdown");
        });
    }

    createPlayerDeathBlood() {
        // If player is already dying, don't restart the death animation
        if (this.player.isDying) {
            console.log('Player already dying, not restarting death animation');
            return;
        }

        // Mark player as dying to prevent multiple blood effects
        this.player.isDying = true;

        // Reset any existing death position properties
        if (this.player) {
            this.player.deathX = undefined;
            this.player.deathY = undefined;
        }

        // Check if player is completely off-screen
        const isCompletelyOffScreen = this.isCompletelyOutsideCameraView();

        // For completely off-screen deaths, use a simplified process
        if (isCompletelyOffScreen) {
            console.log(`Player at (${this.player.x}, ${this.player.y}) is completely off-screen - using simplified death`);

            // Skip the full animation, but still trigger game over with a small delay
            this.scene.time.delayedCall(200, () => {
                // Tell the scene the player is dead
                this.player.emit('manual-death-complete');
            });

            return; // Skip the full animation process
        }

        console.log('Starting player death animation');

        // Get the animation prefix for the selected character
        const prefix = this.texturePrefix || '';

        // Manual frame-by-frame animation with dynamic frame count
        const isCharacter3 = this.selectedCharacter === 'character3';
        const deathFrameCount = isCharacter3 ? 12 : 11; // character3 has 12 death frames

        // Create array of death frames based on character type
        this.deathFrames = [];
        for (let i = 1; i <= deathFrameCount; i++) {
            this.deathFrames.push(`${prefix}player_death_${i}`);
        }

        // Remove any tweens affecting the player to prevent glitches
        this.scene.tweens.killTweensOf(this.player);

        // Stop any current animation to prevent conflicts
        this.player.anims.stop();

        // Remove any tints that may have been applied previously
        this.player.clearTint();

        // Make sure we preserve scale
        const originalScale = { x: this.player.scaleX, y: this.player.scaleY };

        // Set the first frame
        this.player.setTexture(this.deathFrames[0]);

        // Restore original scale
        this.player.setScale(originalScale.x, originalScale.y);

        // Check screen orientation to handle portrait mode correctly - use registry first
        const isPortrait = this.scene.registry.get('isPortrait') ||
            (this.scene.scale.height > this.scene.scale.width);

        // Set fixed opacity to avoid transparency issues in portrait mode
        this.player.setAlpha(1.0);

        // Set depth to ensure proper layering in all orientations
        this.player.setDepth(20);

        // Create a manual frame animation using time events
        this.currentDeathFrame = 0;

        // Clear any existing timers
        if (this.deathAnimTimers) {
            this.deathAnimTimers.forEach(timer => {
                if (timer) timer.remove();
            });
        }

        // Use a single managed animation approach instead of multiple timers
        this.deathAnimTimers = [];

        // Create a dummy object to tween - we'll use this to track progress
        this.deathAnimProgress = { frame: 0 };

        // Clear any previous tweens
        if (this.deathTween) {
            this.deathTween.stop();
            this.deathTween = null;
        }

        console.log(`Portrait mode detected: ${isPortrait}`);

        // If in portrait mode, make sure there are no duplicate sprites
        if (isPortrait && this.player.deathAnimSprite) {
            this.player.deathAnimSprite.destroy();
            this.player.deathAnimSprite = null;
        }

        // Create a tween that goes through all frames
        const lastFrameIndex = this.deathFrames.length - 1;
        this.deathTween = this.scene.tweens.add({
            targets: this.deathAnimProgress,
            frame: lastFrameIndex, // Go to last frame (index is count-1)
            duration: this.deathFrames.length * 100, // Duration based on frame count
            ease: 'Linear',
            onUpdate: () => {
                // Calculate the current frame based on progress
                const newFrame = Math.floor(this.deathAnimProgress.frame);

                // Only update the texture if the frame has changed
                if (newFrame !== this.currentDeathFrame && newFrame < this.deathFrames.length) {
                    this.currentDeathFrame = newFrame;

                    // Only update if the player still exists and is still dying
                    if (this.player && this.player.active && this.player.isDying) {
                        // For portrait mode: first ensure any existing sprite is destroyed
                        if (this.player.deathAnimSprite) {
                            this.player.deathAnimSprite.destroy();
                            this.player.deathAnimSprite = null;
                        }

                        // Update the texture directly on the player
                        this.player.setTexture(this.deathFrames[newFrame]);

                        // Ensure consistent scaling in both orientations
                        this.player.setScale(originalScale.x, originalScale.y);

                        // Set fixed alpha to ensure full opacity
                        this.player.setAlpha(1.0);

                        // Refresh depth value to avoid z-fighting in portrait mode
                        if (isPortrait) {
                            this.player.setDepth(21); // Slightly higher than normal depth to avoid z-fighting
                        } else {
                            this.player.setDepth(20);
                        }

                        // Store original position on first frame if we don't already have it
                        // We only need to do this once at the start of the animation
                        if (newFrame === 0) {
                            // Just store the position directly on the player object
                            this.player.deathX = this.player.x;
                            this.player.deathY = this.player.y;
                            console.log(`Player death at position: (${this.player.deathX}, ${this.player.deathY})`);
                        }

                        // Simply set position directly - no clamping or extra checks needed
                        // This ensures animation plays exactly where the player died
                        if (this.player.deathX !== undefined && this.player.deathY !== undefined) {
                            this.player.x = this.player.deathX;
                            this.player.y = this.player.deathY;
                        }
                    }
                }
            },
            onComplete: () => {
                console.log('Manual death animation completed');
                if (this.player && this.player.active) {
                    // Hold final frame and trigger the manual-death-complete event
                    this.player.emit('manual-death-complete');
                }
            }
        });

        // Gently fade out shadows rather than growing/rotating them which may conflict with the animation
        if (this.playerShadows) {
            this.playerShadows.forEach(shadowData => {
                // Fade out shadow
                this.scene.tweens.add({
                    targets: shadowData.sprite,
                    alpha: 0.3, // Just fade to a low alpha (50% darker)
                    duration: 1000,
                    ease: 'Linear'
                });
            });
        }

        // Freeze player movement
        this.player.body.velocity.x = 0;
        this.player.body.velocity.y = 0;
    }
}