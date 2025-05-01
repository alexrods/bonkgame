import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

export class TouchController {
  constructor(scene) {
    this.scene = scene;
    this.movementJoystick = null;
    this.shootJoystick = null;
    this.movementVector = { x: 0, y: 0 };
    this.shootingVector = { x: 0, y: 0 };
    
    // Make joysticks responsive to screen size - calculating once at initialization
    // and then recalculating on resize/orientation change
    this.updateJoystickDimensions();
    
    // Detect orientation for adaptive layout
    this.isPortrait = window.innerHeight > window.innerWidth;
    
    // Track all active touches to handle multiple inputs properly
    this.activePointers = {};
    
    // Track if a joystick is currently moving/tweening back to center
    this.movementResetting = false;
    this.shootingResetting = false;
    
    // Keep track of the last orientation to avoid unnecessary repositioning
    this.lastWidth = window.innerWidth;
    this.lastHeight = window.innerHeight;
    
    // Add listener for orientation changes
    window.addEventListener('orientationchange', () => {
      // Use a longer timeout for orientation changes as they can take time
      setTimeout(() => {
        // Reset active touches since orientation change can cause weird behavior
        this.activePointers = {};
        this.movementJoystick.active = null;
        this.shootJoystick.active = null;
        
        // Update based on new dimensions
        this.isPortrait = window.innerHeight > window.innerWidth;
        this.updateJoystickDimensions();
        this.repositionJoysticks();
        
        // Update tracking variables
        this.lastWidth = window.innerWidth;
        this.lastHeight = window.innerHeight;
      }, 300);
    });
    
    // Also listen for resize events which might happen when orientation changes
    window.addEventListener('resize', () => {
      // Throttle resize events to avoid excessive recalculations
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        // Avoid unnecessary repositioning if dimensions haven't changed much
        if (Math.abs(this.lastWidth - window.innerWidth) > 50 || 
            Math.abs(this.lastHeight - window.innerHeight) > 50) {
          
          this.isPortrait = window.innerHeight > window.innerWidth;
          this.updateJoystickDimensions();
          this.repositionJoysticks();
          
          // Update tracking variables
          this.lastWidth = window.innerWidth;
          this.lastHeight = window.innerHeight;
        }
      }, 200);
    });
  }
  
  // Calculate joystick dimensions based on screen size
  updateJoystickDimensions() {
    // Responsive sizing - larger on tablets, smaller on phones
    const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
    
    // Use 16% of the smaller screen dimension with a minimum and maximum size
    this.joystickRadius = Math.min(
      Math.max(smallerDimension * 0.16, 40), // Minimum radius of 40px
      80 // Maximum radius of 80px
    );
  }

  init() {
    this.createMovementJoystick();
    this.createShootingJoystick();
    this.createDroneButton();
    this.createReloadButton();
    this.setupMultitouchHandlers();
  }
  
  createDroneButton() {
    // Calculate position between joysticks at the bottom of the screen
    // Swap positions with reload button
    const buttonRadius = this.joystickRadius * 0.4; // Smaller than joysticks
    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - buttonRadius * 5; // Higher position (where reload was)
    
    // Create base with border
    const buttonBaseBorder = this.scene.add.circle(x, y, buttonRadius + 4, 0xffffff, 0.3);
    buttonBaseBorder.setScrollFactor(0);
    buttonBaseBorder.setDepth(99);
    
    // Create base
    const buttonBase = this.scene.add.circle(x, y, buttonRadius, 0x000099, 0.6);
    buttonBase.setScrollFactor(0);
    buttonBase.setDepth(100);
    
    // Create drone icon
    const buttonIcon = this.scene.add.text(x, y, '📦', { fontSize: '22px' });
    buttonIcon.setOrigin(0.5);
    buttonIcon.setScrollFactor(0);
    buttonIcon.setDepth(101);
    
    this.droneButton = {
      baseBorder: buttonBaseBorder,
      base: buttonBase,
      icon: buttonIcon,
      centerX: x,
      centerY: y,
      radius: buttonRadius
    };
    
    // Add a pulsing animation
    this.scene.tweens.add({
      targets: [this.droneButton.base, this.droneButton.baseBorder],
      scaleX: 1.1,
      scaleY: 1.1,
      yoyo: true,
      repeat: -1,
      duration: 800,
      ease: 'Sine.InOut'
    });
    
    // Make the button interactive
    buttonBase.setInteractive({ cursor: 'pointer' });
    
    // Add simple tap handler (no hold required)
    buttonBase.on('pointerdown', (pointer) => {
      // Flash the button
      this.scene.tweens.add({
        targets: [this.droneButton.base],
        alpha: 0.3,
        yoyo: true,
        duration: 100,
        onComplete: () => {
          // Check if deposit/withdraw prompt or rhythm minigame is active
          const depositPromptActive = this.scene.droneWheel.depositWithdrawPrompt && 
                                     this.scene.droneWheel.depositWithdrawPrompt.isVisible;
          const rhythmGameActive = this.scene.droneWheel.rhythmGame && 
                                  this.scene.droneWheel.rhythmGame.isActive;
          
          // Toggle the drone wheel only if neither menu is active
          if (this.scene.droneWheel && !depositPromptActive && !rhythmGameActive) {
            this.scene.droneWheel.toggle();
          }
        }
      });
      
      // Prevent this touch from affecting joysticks
      pointer.wasOnButton = true;
    });
  }

  createMovementJoystick() {
    // Calculate position based on current orientation
    const position = this.getMovementJoystickPosition();
    const x = position.x;
    const y = position.y;

    // Create base with border
    const movementBaseBorder = this.scene.add.circle(x, y, this.joystickRadius + 4, 0xffffff, 0.3);
    movementBaseBorder.setScrollFactor(0);
    movementBaseBorder.setDepth(99);
    
    // Create base
    const movementBase = this.scene.add.circle(x, y, this.joystickRadius, 0x000000, 0.6);
    movementBase.setScrollFactor(0);
    movementBase.setDepth(100);

    // Create thumb with gradient effect
    const movementThumb = this.scene.add.circle(x, y, this.joystickRadius * 0.6, 0x6699cc, 0.9);
    movementThumb.setScrollFactor(0);
    movementThumb.setDepth(101);
    
    // Add inner highlight to thumb
    const movementThumbHighlight = this.scene.add.circle(x, y, this.joystickRadius * 0.3, 0x99ccff, 0.8);
    movementThumbHighlight.setScrollFactor(0);
    movementThumbHighlight.setDepth(102);

    this.movementJoystick = {
      baseBorder: movementBaseBorder,
      base: movementBase,
      thumb: movementThumb,
      thumbHighlight: movementThumbHighlight,
      centerX: x,
      centerY: y,
      active: null,
      baseArea: { x, y, radius: this.joystickRadius * 2.0 }
    };
  }

  createShootingJoystick() {
    // Calculate position based on current orientation
    const position = this.getShootingJoystickPosition();
    const x = position.x;
    const y = position.y;

    // Create base with border
    const shootBaseBorder = this.scene.add.circle(x, y, this.joystickRadius + 4, 0xffffff, 0.3);
    shootBaseBorder.setScrollFactor(0);
    shootBaseBorder.setDepth(99);
    
    // Create base
    const shootBase = this.scene.add.circle(x, y, this.joystickRadius, 0x000000, 0.6);
    shootBase.setScrollFactor(0);
    shootBase.setDepth(100);

    // Create thumb with gradient effect
    const shootThumb = this.scene.add.circle(x, y, this.joystickRadius * 0.6, 0xcc3333, 0.9);
    shootThumb.setScrollFactor(0);
    shootThumb.setDepth(101);
    
    // Add inner highlight to thumb
    const shootThumbHighlight = this.scene.add.circle(x, y, this.joystickRadius * 0.3, 0xff6666, 0.8);
    shootThumbHighlight.setScrollFactor(0);
    shootThumbHighlight.setDepth(102);

    this.shootJoystick = {
      baseBorder: shootBaseBorder,
      base: shootBase,
      thumb: shootThumb,
      thumbHighlight: shootThumbHighlight,
      centerX: x,
      centerY: y,
      active: null,
      baseArea: { x, y, radius: this.joystickRadius * 2.0 }
    };
  }

  setupMultitouchHandlers() {
    // Track all active touches to handle multiple inputs properly
    this.activePointers = {};

    this.scene.input.on('pointerdown', (pointer) => {
      // Check if the deposit/withdraw prompt is visible - if so, only let the pointer through if it's over a button
      if (this.scene.droneWheel && 
          this.scene.droneWheel.depositWithdrawPrompt && 
          this.scene.droneWheel.depositWithdrawPrompt.isVisible) {
        
        // Let the pointer through to be handled by the UI buttons directly
        // but don't process it as a joystick input
        return;
      }
      
      // Store this pointer
      this.activePointers[pointer.id] = pointer;
      pointer.wasOnButton = false; // Initialize button flag
      pointer.isDroneButton = false; // Initialize drone button flag
      
      // Process all joysticks for each new pointer
      this.processJoystickPointerDown(pointer);
    });

    this.scene.input.on('pointermove', (pointer) => {
      // Check if the deposit/withdraw prompt is visible - if so, don't process joystick movement
      if (this.scene.droneWheel && 
          this.scene.droneWheel.depositWithdrawPrompt && 
          this.scene.droneWheel.depositWithdrawPrompt.isVisible) {
        return;
      }
      
      // Update stored pointer
      this.activePointers[pointer.id] = pointer;
      
      // Update joysticks if they're being controlled by this pointer
      if (this.movementJoystick.active === pointer.id) {
        this.updateMovementJoystick(pointer);
      }
      
      if (this.shootJoystick.active === pointer.id) {
        this.updateShootingJoystick(pointer);
      }
    });

    // Track touch start times to detect quick flicks
    this.touchStartTimes = {};
    
    this.scene.input.on('pointerdown', (pointer) => {
      // Store touch start time for this pointer
      this.touchStartTimes[pointer.id] = this.scene.time.now;
    });
    
    this.scene.input.on('pointerup', (pointer) => {
      // Calculate touch duration
      const touchDuration = this.scene.time.now - (this.touchStartTimes[pointer.id] || 0);
      const isQuickFlick = touchDuration < 200; // Consider anything less than 200ms a quick flick
      
      // Remove this pointer from tracking
      delete this.activePointers[pointer.id];
      delete this.touchStartTimes[pointer.id];
      
      // Release joysticks if they were controlled by this pointer
      if (this.movementJoystick.active === pointer.id) {
        // Mark as no longer active immediately, but preserve vector until animation completes
        this.movementJoystick.active = null;
        this.movementResetting = true;
        
        // Store the current vector values to enable smooth deceleration
        const lastVectorX = this.movementVector.x;
        const lastVectorY = this.movementVector.y;
        
        // Smoothly reset the joystick visually
        this.scene.tweens.add({
          targets: [this.movementJoystick.thumb, this.movementJoystick.thumbHighlight],
          x: this.movementJoystick.centerX,
          y: this.movementJoystick.centerY,
          duration: 180,
          ease: 'Power2',
          onUpdate: (tween) => {
            // Gradually reduce the movement vector as the joystick returns to center
            const progress = tween.progress;
            this.movementVector.x = lastVectorX * (1 - progress);
            this.movementVector.y = lastVectorY * (1 - progress);
          },
          onComplete: () => {
            // Only zero the vector after the tween completes
            this.movementVector.x = 0;
            this.movementVector.y = 0;
            this.movementResetting = false;
          }
        });
        
        // Check if any other pointer is over the movement joystick and capture it
        this.checkForAvailablePointers();
      }
      
      if (this.shootJoystick.active === pointer.id) {
        // Mark as no longer active immediately, but preserve vector until animation completes
        this.shootJoystick.active = null;
        this.shootingResetting = true;
        
        // Store the current vector values for deceleration (only used for normal release)
        const lastVectorX = this.shootingVector.x;
        const lastVectorY = this.shootingVector.y;
        
        // For quick flicks, immediately reset shooting vector to prevent auto-fire
        if (isQuickFlick) {
          this.shootingVector.x = 0;
          this.shootingVector.y = 0;
        }
        
        // Always animate the joystick visually
        this.scene.tweens.add({
          targets: [this.shootJoystick.thumb, this.shootJoystick.thumbHighlight],
          x: this.shootJoystick.centerX,
          y: this.shootJoystick.centerY,
          duration: 180,
          ease: 'Power2',
          onUpdate: (tween) => {
            // Only gradually reduce the vector for normal releases, not for quick flicks
            if (!isQuickFlick) {
              const progress = tween.progress;
              this.shootingVector.x = lastVectorX * (1 - progress);
              this.shootingVector.y = lastVectorY * (1 - progress);
            }
          },
          onComplete: () => {
            // Zero the vector when animation completes
            this.shootingVector.x = 0;
            this.shootingVector.y = 0;
            this.shootingResetting = false;
          }
        });
        
        // Check if any other pointer is over the shooting joystick and capture it
        this.checkForAvailablePointers();
      }
    });
    
    // Also handle pointercancel events (crucial for mobile)
    this.scene.input.on('pointercancel', (pointer) => {
      // Handle the same as pointerup
      if (this.activePointers[pointer.id]) {
        delete this.activePointers[pointer.id];
        
        // Reset any joysticks controlled by this pointer
        if (this.movementJoystick.active === pointer.id) {
          this.movementJoystick.active = null;
          this.movementVector.x = 0;
          this.movementVector.y = 0;
          
          // Reset joystick visuals immediately
          this.movementJoystick.thumb.x = this.movementJoystick.centerX;
          this.movementJoystick.thumb.y = this.movementJoystick.centerY;
          this.movementJoystick.thumbHighlight.x = this.movementJoystick.centerX;
          this.movementJoystick.thumbHighlight.y = this.movementJoystick.centerY;
        }
        
        if (this.shootJoystick.active === pointer.id) {
          this.shootJoystick.active = null;
          this.shootingVector.x = 0;
          this.shootingVector.y = 0;
          
          // Reset joystick visuals immediately
          this.shootJoystick.thumb.x = this.shootJoystick.centerX;
          this.shootJoystick.thumb.y = this.shootJoystick.centerY;
          this.shootJoystick.thumbHighlight.x = this.shootJoystick.centerX;
          this.shootJoystick.thumbHighlight.y = this.shootJoystick.centerY;
        }
      }
    });
  }
  
  checkForAvailablePointers() {
    // Look through all active pointers to see if any are over joysticks without control
    Object.values(this.activePointers).forEach(pointer => {
      this.processJoystickPointerDown(pointer);
    });
  }
  
  processJoystickPointerDown(pointer) {
    // Guard against undefined or non-standard pointers
    if (!pointer || typeof pointer.id === 'undefined') {
      console.warn('Invalid pointer received in processJoystickPointerDown');
      return;
    }
    
    // Skip if this pointer was on a button (prevents joystick activation when pressing buttons)
    if (pointer.wasOnButton) {
      return;
    }
    
    // First check if this pointer is already controlling a joystick
    if (this.movementJoystick.active === pointer.id || this.shootJoystick.active === pointer.id) {
      return; // Already controlling something
    }
    
    // Check if the deposit/withdraw prompt is visible - if so, don't activate joysticks at all
    if (this.scene.droneWheel && 
        this.scene.droneWheel.depositWithdrawPrompt && 
        this.scene.droneWheel.depositWithdrawPrompt.isVisible) {
      // Block all touch controls while deposit/withdraw prompt is open
      console.log("TouchController: Blocking input while deposit/withdraw prompt is active");
      return;
    }
    
    // Check if the wheel is visible - if so, don't activate joysticks
    if (this.scene.droneWheel && this.scene.droneWheel.isVisible) {
      // Check if clicking on or near the wheel
      const wheelBounds = {
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT / 2,
        radius: this.scene.droneWheel.radius + 50 // Add some padding
      };
      
      const wheelDist = Phaser.Math.Distance.Between(
        pointer.x, pointer.y,
        wheelBounds.x, wheelBounds.y
      );
      
      // Handle wheel interaction
      this.handleWheelInteraction(pointer);
      return;
    }
    
    // Check for drone button click
    if (this.droneButton) {
      const buttonDist = Phaser.Math.Distance.Between(
        pointer.x, pointer.y,
        this.droneButton.centerX, this.droneButton.centerY
      );
      
      if (buttonDist <= this.droneButton.radius) {
        // Mark this pointer as used on a button (prevents joystick activation)
        pointer.wasOnButton = true;
        return;
      }
    }
    
    // Check for reload button click
    if (this.reloadButton) {
      const reloadDist = Phaser.Math.Distance.Between(
        pointer.x, pointer.y,
        this.reloadButton.centerX, this.reloadButton.centerY
      );
      
      if (reloadDist <= this.reloadButton.radius) {
        // Mark this pointer as used on a button
        pointer.wasOnButton = true;
        
        // Flash the button
        this.scene.tweens.add({
          targets: [this.reloadButton.base],
          alpha: 0.3,
          yoyo: true,
          duration: 100,
          onComplete: () => {
            // Trigger reload
            if (this.scene.playerManager) {
              this.scene.playerManager.reload();
            }
          }
        });
        
        return;
      }
    }
    
    // For mobile devices, make the touch zones larger than the visible joystick for easier control
    const touchZoneMultiplier = 1.2;
    
    // Check movement joystick - allow it to be grabbed even during reset animation
    if (!this.movementJoystick.active) {
      const moveDist = Phaser.Math.Distance.Between(
        pointer.x, pointer.y,
        this.movementJoystick.centerX, this.movementJoystick.centerY
      );
      
      // Use the joystick's baseArea.radius * touchZoneMultiplier to make detection area larger
      if (moveDist <= this.movementJoystick.baseArea.radius * touchZoneMultiplier) {
        this.movementJoystick.active = pointer.id;
        this.movementResetting = false; // Cancel the resetting state
        
        // Stop any ongoing tweens on the movement joystick
        this.scene.tweens.killTweensOf([
          this.movementJoystick.thumb, 
          this.movementJoystick.thumbHighlight
        ]);
        
        // Update immediately to provide responsive feedback
        this.updateMovementJoystick(pointer);
        return; // Exit early as we've assigned this pointer
      }
    }
    
    // Check shooting joystick - allow it to be grabbed even during reset animation
    if (!this.shootJoystick.active) {
      const shootDist = Phaser.Math.Distance.Between(
        pointer.x, pointer.y,
        this.shootJoystick.centerX, this.shootJoystick.centerY
      );
      
      // Use the joystick's baseArea.radius * touchZoneMultiplier to make detection area larger
      if (shootDist <= this.shootJoystick.baseArea.radius * touchZoneMultiplier) {
        this.shootJoystick.active = pointer.id;
        this.shootingResetting = false; // Cancel the resetting state
        
        // Stop any ongoing tweens on the shooting joystick
        this.scene.tweens.killTweensOf([
          this.shootJoystick.thumb, 
          this.shootJoystick.thumbHighlight
        ]);
        
        // Update immediately to provide responsive feedback
        this.updateShootingJoystick(pointer);
      }
    }
  }
  
  // Handle interaction with the drone wheel
  handleWheelInteraction(pointer) {
    if (!this.scene.droneWheel) return;
    
    const wheelCenter = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
    const dx = pointer.x - wheelCenter.x;
    const dy = pointer.y - wheelCenter.y;
    
    // Calculate distance from center
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 40) {
      // Center tap - confirm selection and hide
      this.scene.droneWheel.confirmSelection();
      this.scene.droneWheel.hide();
      return;
    } else if (distance < this.scene.droneWheel.radius + 30) {
      // Segment tap - determine which segment
      const angle = Math.atan2(dy, dx);
      const degrees = (angle * 180 / Math.PI + 360) % 360;
      
      // Determine which segment was tapped based on angle
      const segmentCount = this.scene.droneWheel.upgradeOptions.length;
      const segmentSize = 360 / segmentCount;
      
      // Convert angle to segment index
      const segmentIndex = Math.floor(((degrees + (segmentSize / 2)) % 360) / segmentSize);
      
      // Update selection and immediately confirm it
      this.scene.droneWheel.selectedIndex = segmentIndex;
      this.scene.droneWheel.updateSelection();
      this.scene.droneWheel.confirmSelection();
      this.scene.droneWheel.hide();
    } else {
      // Click outside the wheel - just hide it without confirming
      this.scene.droneWheel.hide();
    }
  }
  
  resetJoystick(joystick) {
    // Reset both thumb and thumbHighlight positions
    joystick.thumb.x = joystick.centerX;
    joystick.thumb.y = joystick.centerY;
    joystick.thumbHighlight.x = joystick.centerX;
    joystick.thumbHighlight.y = joystick.centerY;
  }

  updateMovementJoystick(pointer) {
    const dx = pointer.x - this.movementJoystick.centerX;
    const dy = pointer.y - this.movementJoystick.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let thumbX, thumbY;
    
    if (distance <= this.joystickRadius) {
      thumbX = pointer.x;
      thumbY = pointer.y;
    } else {
      // If beyond the joystick radius, keep the thumb at the edge of the allowed circle
      const angle = Math.atan2(dy, dx);
      thumbX = this.movementJoystick.centerX + Math.cos(angle) * this.joystickRadius;
      thumbY = this.movementJoystick.centerY + Math.sin(angle) * this.joystickRadius;
    }
    
    // Update both thumb and thumbHighlight positions
    this.movementJoystick.thumb.x = thumbX;
    this.movementJoystick.thumb.y = thumbY;
    this.movementJoystick.thumbHighlight.x = thumbX;
    this.movementJoystick.thumbHighlight.y = thumbY;

    // Calculate normalized vector (0 to 1)
    const normalizedDistance = Math.min(distance, this.joystickRadius) / this.joystickRadius;
    const angle = Math.atan2(dy, dx);
    
    this.movementVector.x = Math.cos(angle) * normalizedDistance;
    this.movementVector.y = Math.sin(angle) * normalizedDistance;
  }

  updateShootingJoystick(pointer) {
    const dx = pointer.x - this.shootJoystick.centerX;
    const dy = pointer.y - this.shootJoystick.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let thumbX, thumbY;
    
    if (distance <= this.joystickRadius) {
      thumbX = pointer.x;
      thumbY = pointer.y;
    } else {
      // If beyond the joystick radius, keep the thumb at the edge of the allowed circle
      const angle = Math.atan2(dy, dx);
      thumbX = this.shootJoystick.centerX + Math.cos(angle) * this.joystickRadius;
      thumbY = this.shootJoystick.centerY + Math.sin(angle) * this.joystickRadius;
    }
    
    // Update both thumb and thumbHighlight positions
    this.shootJoystick.thumb.x = thumbX;
    this.shootJoystick.thumb.y = thumbY;
    this.shootJoystick.thumbHighlight.x = thumbX;
    this.shootJoystick.thumbHighlight.y = thumbY;

    // Calculate normalized vector
    const normalizedDistance = Math.min(distance, this.joystickRadius) / this.joystickRadius;
    if (normalizedDistance > 0.2) { // Reduced dead zone for better responsiveness, closer to keyboard/gamepad
      const angle = Math.atan2(dy, dx);
      this.shootingVector.x = Math.cos(angle);
      this.shootingVector.y = Math.sin(angle);
    } else {
      this.shootingVector.x = 0;
      this.shootingVector.y = 0;
    }
  }

  getMovementVector() {
    // Return zero vector if drone wheel is open
    if (this.scene.droneWheel && this.scene.droneWheel.isVisible) {
      return { x: 0, y: 0 };
    }
    return this.movementVector;
  }

  getShootingVector() {
    // Return zero vector if drone wheel is open
    if (this.scene.droneWheel && this.scene.droneWheel.isVisible) {
      return { x: 0, y: 0 };
    }
    return this.shootingVector;
  }

  update() {
    // We don't need to do anything during the resetting phase
    // as the tween's onUpdate handles the vector interpolation
    
    // But we can add a small deadzone to prevent accidental movement
    if (!this.movementJoystick.active && !this.movementResetting) {
      // If magnitude of movement vector is very small and no active control, zero it
      const moveMagnitude = Math.sqrt(
        this.movementVector.x * this.movementVector.x + 
        this.movementVector.y * this.movementVector.y
      );
      
      if (moveMagnitude < 0.05) {
        this.movementVector.x = 0;
        this.movementVector.y = 0;
      }
    }
    
    if (!this.shootJoystick.active && !this.shootingResetting) {
      // If magnitude of shooting vector is very small and no active control, zero it
      const shootMagnitude = Math.sqrt(
        this.shootingVector.x * this.shootingVector.x + 
        this.shootingVector.y * this.shootingVector.y
      );
      
      if (shootMagnitude < 0.2) { // Consistent with the other deadzone value
        this.shootingVector.x = 0;
        this.shootingVector.y = 0;
      }
    }
  }
  
  // Ensure joysticks are visible and properly positioned
  ensureJoysticksVisibility() {
    // Check if any of the joystick elements have low or zero alpha
    if (this.movementJoystick && this.shootJoystick) {
      const movementAlpha = this.movementJoystick.base.alpha;
      const shootingAlpha = this.shootJoystick.base.alpha;
      
      // If alpha is very low, make joysticks visible again
      if (movementAlpha < 0.5 || shootingAlpha < 0.5) {
        const elements = [
          // Movement joystick elements
          this.movementJoystick.baseBorder,
          this.movementJoystick.base,
          this.movementJoystick.thumb,
          this.movementJoystick.thumbHighlight,
          // Shooting joystick elements
          this.shootJoystick.baseBorder,
          this.shootJoystick.base,
          this.shootJoystick.thumb,
          this.shootJoystick.thumbHighlight
        ];
        
        // Make all elements fully visible
        elements.forEach(element => {
          if (element) {
            element.alpha = 1.0;
          }
        });
        
        // If reload button exists and is invisible, make it visible too
        if (this.reloadButton) {
          const reloadElements = [
            this.reloadButton.baseBorder,
            this.reloadButton.base,
            this.reloadButton.icon
          ];
          
          reloadElements.forEach(element => {
            if (element) {
              element.alpha = 1.0;
            }
          });
        }
        
        // Make sure positions are correct
        this.repositionJoysticks();
      }
    }
  }
  
  // Get optimal position for movement joystick based on orientation
  getMovementJoystickPosition() {
    // Get current screen dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Adjust for safe areas on mobile devices
    const safeAreaBottom = 20; // pixels from bottom edge
    const safeAreaSide = 20;   // pixels from side edges
    
    if (this.isPortrait) {
      // In portrait mode, position joystick in bottom-left with edge padding
      return {
        x: this.joystickRadius + safeAreaSide,
        y: screenHeight - this.joystickRadius - safeAreaBottom
      };
    } else {
      // In landscape mode, use comfortable position from the edge
      return {
        x: this.joystickRadius + safeAreaSide,
        y: screenHeight - this.joystickRadius - safeAreaBottom
      };
    }
  }
  
  // Get optimal position for shooting joystick based on orientation
  getShootingJoystickPosition() {
    // Get current screen dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Adjust for safe areas on mobile devices
    const safeAreaBottom = 20; // pixels from bottom edge
    const safeAreaSide = 20;   // pixels from side edges
    
    if (this.isPortrait) {
      // In portrait mode, position joystick in bottom-right with edge padding
      return {
        x: screenWidth - this.joystickRadius - safeAreaSide,
        y: screenHeight - this.joystickRadius - safeAreaBottom
      };
    } else {
      // In landscape mode, use comfortable position from the edge
      return {
        x: screenWidth - this.joystickRadius - safeAreaSide,
        y: screenHeight - this.joystickRadius - safeAreaBottom
      };
    }
  }
  
  // Create reload button
  createReloadButton() {
    // Calculate position between joysticks at the bottom of the screen
    // Swap positions with drone button
    const buttonRadius = this.joystickRadius * 0.5; // Larger than drone button
    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - buttonRadius * 2; // Lower position (where drone was)
    
    // Create base with border
    const buttonBaseBorder = this.scene.add.circle(x, y, buttonRadius + 4, 0xffffff, 0.3);
    buttonBaseBorder.setScrollFactor(0);
    buttonBaseBorder.setDepth(99);
    
    // Create base
    const buttonBase = this.scene.add.circle(x, y, buttonRadius, 0x990000, 0.6);
    buttonBase.setScrollFactor(0);
    buttonBase.setDepth(100);
    
    // Create reload icon
    const buttonIcon = this.scene.add.text(x, y, '🔄', { fontSize: '24px' });
    buttonIcon.setOrigin(0.5);
    buttonIcon.setScrollFactor(0);
    buttonIcon.setDepth(101);
    
    this.reloadButton = {
      baseBorder: buttonBaseBorder,
      base: buttonBase,
      icon: buttonIcon,
      centerX: x,
      centerY: y,
      radius: buttonRadius
    };
    
    // Make the button interactive
    buttonBase.setInteractive({ cursor: 'pointer' });
    
    // Add click handler
    buttonBase.on('pointerdown', (pointer) => {
      // Flash the button
      this.scene.tweens.add({
        targets: [this.reloadButton.base],
        alpha: 0.3,
        yoyo: true,
        duration: 100,
        onComplete: () => {
          // Trigger reload action
          if (this.scene.playerManager) {
            this.scene.playerManager.reload();
          }
        }
      });
      
      // Prevent this touch from affecting joysticks
      pointer.wasOnButton = true;
    });
  }
  
  // Reposition joysticks and buttons when orientation changes
  repositionJoysticks() {
    if (!this.movementJoystick || !this.shootJoystick) return;
    
    // Get new positions
    const movePos = this.getMovementJoystickPosition();
    const shootPos = this.getShootingJoystickPosition();
    
    // Kill any ongoing tweens
    this.scene.tweens.killTweensOf([
      this.movementJoystick.baseBorder,
      this.movementJoystick.base,
      this.movementJoystick.thumb, 
      this.movementJoystick.thumbHighlight,
      this.shootJoystick.baseBorder,
      this.shootJoystick.base,
      this.shootJoystick.thumb,
      this.shootJoystick.thumbHighlight
    ]);
    
    // Reset any active joystick state
    this.movementJoystick.active = null;
    this.shootJoystick.active = null;
    this.movementResetting = false;
    this.shootingResetting = false;
    
    // Reset vectors immediately when repositioning
    this.movementVector.x = 0;
    this.movementVector.y = 0;
    this.shootingVector.x = 0;
    this.shootingVector.y = 0;
    
    // Calculate drone button position based on current screen
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const buttonRadius = this.joystickRadius * 0.4;
    const droneButtonX = screenWidth / 2;
    const droneButtonY = screenHeight - buttonRadius * 2;
    
    // Reposition drone button if it exists
    if (this.droneButton) {
      this.scene.tweens.add({
        targets: [
          this.droneButton.baseBorder,
          this.droneButton.base,
          this.droneButton.icon
        ],
        x: droneButtonX,
        y: droneButtonY,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this.droneButton.centerX = droneButtonX;
          this.droneButton.centerY = droneButtonY;
        }
      });
    }
    
    // Reposition reload button if it exists
    if (this.reloadButton) {
      const reloadButtonX = screenWidth / 2;
      const reloadButtonY = screenHeight - buttonRadius * 5;
      
      this.scene.tweens.add({
        targets: [
          this.reloadButton.baseBorder,
          this.reloadButton.base,
          this.reloadButton.icon
        ],
        x: reloadButtonX,
        y: reloadButtonY,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this.reloadButton.centerX = reloadButtonX;
          this.reloadButton.centerY = reloadButtonY;
        }
      });
    }
    
    // For immediate feedback, update base position first and thumb later
    
    // First update base positions immediately - this is important for response
    this.movementJoystick.base.x = movePos.x;
    this.movementJoystick.base.y = movePos.y;
    this.movementJoystick.baseBorder.x = movePos.x;
    this.movementJoystick.baseBorder.y = movePos.y;
    
    this.shootJoystick.base.x = shootPos.x;
    this.shootJoystick.base.y = shootPos.y;
    this.shootJoystick.baseBorder.x = shootPos.x;
    this.shootJoystick.baseBorder.y = shootPos.y;
    
    // Immediately update internal position tracking before animation
    this.movementJoystick.centerX = movePos.x;
    this.movementJoystick.centerY = movePos.y;
    this.movementJoystick.baseArea = { x: movePos.x, y: movePos.y, radius: this.joystickRadius * 2.0 };
    
    this.shootJoystick.centerX = shootPos.x;
    this.shootJoystick.centerY = shootPos.y;
    this.shootJoystick.baseArea = { x: shootPos.x, y: shootPos.y, radius: this.joystickRadius * 2.0 };
    
    // Then animate the thumbs to their new positions
    this.scene.tweens.add({
      targets: [
        this.movementJoystick.thumb,
        this.movementJoystick.thumbHighlight
      ],
      x: movePos.x,
      y: movePos.y,
      duration: 200,
      ease: 'Power2'
    });
    
    this.scene.tweens.add({
      targets: [
        this.shootJoystick.thumb,
        this.shootJoystick.thumbHighlight
      ],
      x: shootPos.x,
      y: shootPos.y,
      duration: 200,
      ease: 'Power2'
    });
    
    // Make sure all elements are visible
    [
      this.movementJoystick.baseBorder,
      this.movementJoystick.base,
      this.movementJoystick.thumb,
      this.movementJoystick.thumbHighlight,
      this.shootJoystick.baseBorder,
      this.shootJoystick.base,
      this.shootJoystick.thumb,
      this.shootJoystick.thumbHighlight
    ].forEach(element => {
      if (element) element.alpha = 1.0;
    });
  }
}