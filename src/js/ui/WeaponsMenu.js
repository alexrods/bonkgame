import { BULLET_TIME_SLOWDOWN } from '../../config.js';

export class WeaponsMenu {
  constructor(scene) {
    this.scene = scene;
    this.isVisible = false;
    this.container = null;
    this.onWeaponSelectedCallback = null;
    this.onCancelCallback = null;
  }
  
  create() {
    // Create the container
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1050); // Higher than DroneWheel
    
    // Create background overlay
    const bg = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000, 0.7
    );
    this.container.add(bg);
    
    // Create main content container
    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);
    
    // Get orientation
    const isPortrait = this.scene.game.registry.get('isPortrait') || 
                       (this.scene.cameras.main.height > this.scene.cameras.main.width);
    
    // Create panel background - adjust size based on orientation
    const panelWidth = isPortrait ? 400 : 500;
    const panelHeight = isPortrait ? 460 : 280;
    
    const panel = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      panelWidth,
      panelHeight,
      0x000000, 0.95
    );
    panel.setStrokeStyle(2, 0x00ff00);
    this.contentContainer.add(panel);
    
    // Add title
    const titleY = this.scene.cameras.main.height / 2 - (isPortrait ? panelHeight / 2 - 35 : 100);
    const title = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      titleY,
      'SELECT WEAPON',
      {
        fontFamily: 'Tektur',
        fontSize: '24px',
        color: '#00ff00',
        align: 'center',
        fontStyle: 'bold'
      }
    );
    title.setOrigin(0.5);
    this.contentContainer.add(title);
    
    // Create scanlines effect
    const scanlines = this.createScanlines(panel);
    this.container.add(scanlines);
    
    // Create weapon options
    this.createWeaponOptions(isPortrait);
    
    // Hide initially
    this.container.setAlpha(0);
    this.container.setVisible(false);
    
    // Listen for orientation changes
    this.orientationChangeListener = (data) => {
      this.updateLayout(data.isPortrait);
    };
    this.scene.game.events.on('orientationChange', this.orientationChangeListener);
  }
  
  createWeaponOptions(isPortrait = false) {
    // Weapon option container
    this.weaponsContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.weaponsContainer);
    
    // Store elements that need to be repositioned on orientation change
    this.weaponElements = { shotgun: {}, rifle: {} };
    
    const centerX = this.scene.cameras.main.width / 2;
    const centerY = this.scene.cameras.main.height / 2;
    
    // Panel dimensions - slightly smaller in portrait mode
    const panelWidth = 180;
    const panelHeight = 160;
    
    // Position weapons based on orientation
    let shotgunX, shotgunY, rifleX, rifleY;
    
    if (isPortrait) {
      // Vertical layout (one above the other)
      shotgunX = centerX;
      shotgunY = centerY - 70;
      rifleX = centerX;
      rifleY = centerY + 100;
    } else {
      // Horizontal layout (side by side)
      shotgunX = centerX - 120;
      shotgunY = centerY;
      rifleX = centerX + 120;
      rifleY = centerY;
    }
    
    // Create shotgun option
    const shotgunPanel = this.scene.add.rectangle(
      shotgunX,
      shotgunY,
      panelWidth,
      panelHeight,
      0x003300,
      0.6
    );
    shotgunPanel.setStrokeStyle(2, 0x00ff00);
    shotgunPanel.setInteractive();
    this.weaponsContainer.add(shotgunPanel);
    this.weaponElements.shotgun.panel = shotgunPanel;
    
    // Add shotgun image
    const shotgunImage = this.scene.add.image(
      shotgunX,
      shotgunY - 30,
      'shotgun'
    );
    shotgunImage.setScale(0.1125); // 3/4 of the current 0.15 scale
    this.weaponsContainer.add(shotgunImage);
    this.weaponElements.shotgun.image = shotgunImage;
    
    // Add shotgun label
    const shotgunLabel = this.scene.add.text(
      shotgunX,
      shotgunY + 30,
      'SHOTGUN',
      {
        fontFamily: 'Tektur',
        fontSize: '16px',
        color: '#00ff00',
        align: 'center'
      }
    );
    shotgunLabel.setOrigin(0.5);
    this.weaponsContainer.add(shotgunLabel);
    this.weaponElements.shotgun.label = shotgunLabel;
    
    // Add shotgun description
    const shotgunDesc = this.scene.add.text(
      shotgunX,
      shotgunY + 55,
      'Wide spread\nHigh damage',
      {
        fontFamily: 'Tektur',
        fontSize: '12px',
        color: '#ffffff',
        align: 'center'
      }
    );
    shotgunDesc.setOrigin(0.5);
    this.weaponsContainer.add(shotgunDesc);
    this.weaponElements.shotgun.desc = shotgunDesc;
    
    // Create rifle option
    const riflePanel = this.scene.add.rectangle(
      rifleX,
      rifleY,
      panelWidth,
      panelHeight,
      0x003300,
      0.6
    );
    riflePanel.setStrokeStyle(2, 0x00ff00);
    riflePanel.setInteractive();
    this.weaponsContainer.add(riflePanel);
    this.weaponElements.rifle.panel = riflePanel;
    
    // Add rifle image
    const rifleImage = this.scene.add.image(
      rifleX,
      rifleY - 30,
      'rifle'
    );
    rifleImage.setScale(0.2);
    this.weaponsContainer.add(rifleImage);
    this.weaponElements.rifle.image = rifleImage;
    
    // Add rifle label
    const rifleLabel = this.scene.add.text(
      rifleX,
      rifleY + 30,
      'ASSAULT RIFLE',
      {
        fontFamily: 'Tektur',
        fontSize: '16px',
        color: '#00ff00',
        align: 'center'
      }
    );
    rifleLabel.setOrigin(0.5);
    this.weaponsContainer.add(rifleLabel);
    this.weaponElements.rifle.label = rifleLabel;
    
    // Add rifle description
    const rifleDesc = this.scene.add.text(
      rifleX,
      rifleY + 55,
      'Rapid fire\nMedium damage',
      {
        fontFamily: 'Tektur',
        fontSize: '12px',
        color: '#ffffff',
        align: 'center'
      }
    );
    rifleDesc.setOrigin(0.5);
    this.weaponsContainer.add(rifleDesc);
    this.weaponElements.rifle.desc = rifleDesc;
    
    // Add hover and click effects
    shotgunPanel.on('pointerover', () => {
      shotgunPanel.setFillStyle(0x005500);
      shotgunLabel.setColor('#33ff33');
    });
    
    shotgunPanel.on('pointerout', () => {
      shotgunPanel.setFillStyle(0x003300);
      shotgunLabel.setColor('#00ff00');
    });
    
    shotgunPanel.on('pointerdown', () => {
      shotgunPanel.setFillStyle(0x007700);
      shotgunLabel.setColor('#ffffff');
    });
    
    shotgunPanel.on('pointerup', () => {
      this.selectWeapon('shotgun');
    });
    
    riflePanel.on('pointerover', () => {
      riflePanel.setFillStyle(0x005500);
      rifleLabel.setColor('#33ff33');
    });
    
    riflePanel.on('pointerout', () => {
      riflePanel.setFillStyle(0x003300);
      rifleLabel.setColor('#00ff00');
    });
    
    riflePanel.on('pointerdown', () => {
      riflePanel.setFillStyle(0x007700);
      rifleLabel.setColor('#ffffff');
    });
    
    riflePanel.on('pointerup', () => {
      this.selectWeapon('rifle');
    });
  }
  
  createScanlines(panel) {
    const scanlineGraphics = this.scene.add.graphics();
    scanlineGraphics.lineStyle(1, 0x00ff00, 0.15);
    
    const bounds = panel.getBounds();
    const startY = bounds.y;
    const endY = bounds.y + bounds.height;
    const startX = bounds.x;
    const endX = bounds.x + bounds.width;
    
    for (let y = startY; y < endY; y += 4) {
      scanlineGraphics.beginPath();
      scanlineGraphics.moveTo(startX, y);
      scanlineGraphics.lineTo(endX, y);
      scanlineGraphics.closePath();
      scanlineGraphics.strokePath();
    }
    
    return scanlineGraphics;
  }
  
  show(weaponSelectedCallback, cancelCallback) {
    if (!this.container) {
      this.create();
    }
    
    this.isVisible = true;
    this.onWeaponSelectedCallback = weaponSelectedCallback;
    this.onCancelCallback = cancelCallback;
    
    // Initial selection state
    this.selectedWeaponIndex = 0; // Start with shotgun (left) selected
    
    // Pause game elements
    this.pauseGame();
    
    // Check current orientation and update layout if needed
    const isPortrait = this.scene.game.registry.get('isPortrait') || 
                       (this.scene.cameras.main.height > this.scene.cameras.main.width);
    
    // Update layout for current orientation
    this.updateLayout(isPortrait);
    
    // Position container relative to camera
    const camera = this.scene.cameras.main;
    this.container.setPosition(camera.scrollX, camera.scrollY);
    
    // Temporarily disable button interactivity to prevent touch event bleed-through
    // This helps prevent the same touch that opened the menu from triggering a weapon option
    this.disableButtonsTemporarily();
    
    // Make visible
    this.container.setVisible(true);
    
    // Fade in
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });
    
    // Setup escape key to close
    this.escKey = this.scene.input.keyboard.addKey('ESC');
    this.escKey.once('down', () => {
      this.hide();
      if (this.onCancelCallback) {
        this.onCancelCallback();
      }
    });
    
    // Set up keyboard navigation
    this.setupKeyboardNavigation();
    
    // Update visual selection indicator initially
    this.updateSelectionVisuals();
    
    // Start input monitoring for gamepad
    this.startGamepadInputMonitoring();
  }
  
  // Setup keyboard navigation controls
  setupKeyboardNavigation() {
    // Clear any existing key handlers first
    if (this.leftKey) this.leftKey.removeAllListeners();
    if (this.rightKey) this.rightKey.removeAllListeners();
    if (this.enterKey) this.enterKey.removeAllListeners();
    
    // Set up arrow keys for navigation
    this.leftKey = this.scene.input.keyboard.addKey('LEFT');
    this.rightKey = this.scene.input.keyboard.addKey('RIGHT');
    this.enterKey = this.scene.input.keyboard.addKey('ENTER');
    
    // Left arrow selects shotgun (index 0)
    this.leftKey.on('down', () => {
      if (this.isVisible) {
        this.selectedWeaponIndex = 0; // Shotgun
        this.updateSelectionVisuals();
      }
    });
    
    // Right arrow selects rifle (index 1)
    this.rightKey.on('down', () => {
      if (this.isVisible) {
        this.selectedWeaponIndex = 1; // Rifle
        this.updateSelectionVisuals();
      }
    });
    
    // Enter key confirms selection
    this.enterKey.on('down', () => {
      if (this.isVisible) {
        const weaponType = this.selectedWeaponIndex === 0 ? 'shotgun' : 'rifle';
        this.selectWeapon(weaponType);
      }
    });
  }
  
  // Start monitoring gamepad input
  startGamepadInputMonitoring() {
    // Clear any existing gamepad update handler
    if (this.gamepadUpdateHandler) {
      this.scene.events.off('update', this.gamepadUpdateHandler);
    }
    
    // Set up gamepad checking in the update loop
    this.lastDpadLeft = false;
    this.lastDpadRight = false;
    this.lastButtonA = false;
    this.lastButtonB = false;
    this.lastLeftStickX = 0;
    
    this.gamepadUpdateHandler = (time, delta) => {
      if (!this.isVisible) return;
      
      // Get gamepad from scene's gamepadController
      if (!this.scene.gamepadController) return;
      
      // Get current button states
      const dpadLeft = this.scene.gamepadController.buttonState.DPadLeft;
      const dpadRight = this.scene.gamepadController.buttonState.DPadRight;
      const buttonA = this.scene.gamepadController.buttonState.A;
      const buttonB = this.scene.gamepadController.buttonState.B;
      
      // Get left stick X value (if available)
      let leftStickX = 0;
      if (this.scene.gamepadController.gamepad && this.scene.gamepadController.gamepad.axes) {
        leftStickX = this.scene.gamepadController.gamepad.axes[0];
        
        // Apply deadzone
        if (Math.abs(leftStickX) < 0.3) leftStickX = 0;
      }
      
      // Handle D-pad Left direction (shotgun selection)
      if (dpadLeft && !this.lastDpadLeft) {
        console.log("WeaponsMenu: D-pad Left detected");
        this.selectedWeaponIndex = 0; // Shotgun
        this.updateSelectionVisuals();
      }
      
      // Handle D-pad Right direction (rifle selection)
      if (dpadRight && !this.lastDpadRight) {
        console.log("WeaponsMenu: D-pad Right detected");
        this.selectedWeaponIndex = 1; // Rifle
        this.updateSelectionVisuals();
      }
      
      // Handle left stick for selection
      if (Math.abs(leftStickX) > 0.5 && Math.abs(this.lastLeftStickX) <= 0.5) {
        if (leftStickX < -0.5) {
          console.log("WeaponsMenu: Left stick left detected");
          this.selectedWeaponIndex = 0; // Shotgun
          this.updateSelectionVisuals();
        } else if (leftStickX > 0.5) {
          console.log("WeaponsMenu: Left stick right detected");
          this.selectedWeaponIndex = 1; // Rifle
          this.updateSelectionVisuals();
        }
      }
      
      // Handle A button for confirmation
      if (buttonA && !this.lastButtonA) {
        console.log("WeaponsMenu: A button pressed");
        const weaponType = this.selectedWeaponIndex === 0 ? 'shotgun' : 'rifle';
        this.selectWeapon(weaponType);
      }
      
      // Handle B button for cancellation
      if (buttonB && !this.lastButtonB) {
        console.log("WeaponsMenu: B button pressed - cancelling");
        this.hide();
        if (this.onCancelCallback) {
          this.onCancelCallback();
        }
      }
      
      // Save current states for next frame
      this.lastDpadLeft = dpadLeft;
      this.lastDpadRight = dpadRight;
      this.lastButtonA = buttonA;
      this.lastButtonB = buttonB;
      this.lastLeftStickX = leftStickX;
    };
    
    // Add the update handler
    this.scene.events.on('update', this.gamepadUpdateHandler, this);
    
    // Debug log
    console.log("WeaponsMenu: Gamepad input monitoring started");
  }
  
  // Update the visual appearance based on selection
  updateSelectionVisuals() {
    // Remove any existing highlight indicator
    if (this.selectionIndicator) {
      this.selectionIndicator.destroy();
      this.selectionIndicator = null;
    }
    
    // Reset both panels to unselected state
    if (this.weaponElements.shotgun.panel) {
      this.weaponElements.shotgun.panel.setFillStyle(0x003300);
      if (this.weaponElements.shotgun.label) {
        this.weaponElements.shotgun.label.setColor('#00ff00');
      }
    }
    
    if (this.weaponElements.rifle.panel) {
      this.weaponElements.rifle.panel.setFillStyle(0x003300);
      if (this.weaponElements.rifle.label) {
        this.weaponElements.rifle.label.setColor('#00ff00');
      }
    }
    
    let selectedPanel, selectedLabel;
    
    // Set the selected one to highlighted state
    if (this.selectedWeaponIndex === 0 && this.weaponElements.shotgun.panel) {
      selectedPanel = this.weaponElements.shotgun.panel;
      selectedLabel = this.weaponElements.shotgun.label;
      selectedPanel.setFillStyle(0x005500);
      if (selectedLabel) {
        selectedLabel.setColor('#33ff33');
      }
    } else if (this.selectedWeaponIndex === 1 && this.weaponElements.rifle.panel) {
      selectedPanel = this.weaponElements.rifle.panel;
      selectedLabel = this.weaponElements.rifle.label;
      selectedPanel.setFillStyle(0x005500);
      if (selectedLabel) {
        selectedLabel.setColor('#33ff33');
      }
    }
    
    // Add a visual indicator around the selected panel
    if (selectedPanel) {
      // Create a highlight rectangle slightly larger than the panel
      this.selectionIndicator = this.scene.add.rectangle(
        selectedPanel.x,
        selectedPanel.y,
        selectedPanel.width + 10,
        selectedPanel.height + 10,
        0x00ff00,
        0.3
      );
      this.selectionIndicator.setStrokeStyle(3, 0x00ff00, 1);
      
      // Add to content container to ensure it moves with the menu
      if (this.weaponsContainer) {
        this.weaponsContainer.add(this.selectionIndicator);
        this.weaponsContainer.sendToBack(this.selectionIndicator);
      }
      
      // Add a pulsing animation to make it more noticeable
      this.scene.tweens.add({
        targets: this.selectionIndicator,
        alpha: { from: 0.3, to: 0.7 },
        duration: 600,
        yoyo: true,
        repeat: -1
      });
      
      // Show a help text for keyboard/gamepad controls
      this.showControlsHelp();
    }
  }
  
  // Show a help text for keyboard/gamepad controls
  showControlsHelp() {
    // Remove any existing help text
    if (this.controlsHelpText) {
      this.controlsHelpText.destroy();
      this.controlsHelpText = null;
    }
    
    // Create help text at the bottom of the menu
    const helpY = this.scene.cameras.main.height / 2 + 180;
    this.controlsHelpText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      helpY,
      "Use ← → arrows or gamepad to select\nENTER or A button to confirm",
      {
        fontFamily: 'Tektur, Arial',
        fontSize: '14px',
        color: '#aaffaa',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3
      }
    );
    this.controlsHelpText.setOrigin(0.5);
    this.controlsHelpText.setDepth(1100);
    
    // Add to container to ensure it moves with the menu
    if (this.container) {
      this.container.add(this.controlsHelpText);
    }
  }
  
  hide() {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    
    // Resume game elements
    this.resumeGame();
    
    // Fade out
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
      }
    });
    
    // Remove input listeners
    this.cleanupInputListeners();
  }
  
  // Clean up all input listeners
  cleanupInputListeners() {
    // Remove keyboard listeners
    if (this.escKey) {
      this.escKey.removeAllListeners();
    }
    
    if (this.leftKey) {
      this.leftKey.removeAllListeners();
    }
    
    if (this.rightKey) {
      this.rightKey.removeAllListeners();
    }
    
    if (this.enterKey) {
      this.enterKey.removeAllListeners();
    }
    
    // Remove gamepad update handler
    if (this.gamepadUpdateHandler) {
      this.scene.events.off('update', this.gamepadUpdateHandler);
      this.gamepadUpdateHandler = null;
    }
    
    // Clean up visual indicators
    if (this.selectionIndicator) {
      this.selectionIndicator.destroy();
      this.selectionIndicator = null;
    }
    
    if (this.controlsHelpText) {
      this.controlsHelpText.destroy();
      this.controlsHelpText = null;
    }
  }
  
  selectWeapon(weaponType) {
    if (!this.isVisible) return;
    
    // Debug log to confirm selection
    console.log(`WeaponsMenu: Selected weapon: ${weaponType}`);
    
    // Hide the menu
    this.hide();
    
    // Call the callback with selected weapon
    if (this.onWeaponSelectedCallback) {
      // Small delay before triggering callback to ensure menu is fully closed
      this.scene.time.delayedCall(50, () => {
        this.onWeaponSelectedCallback(weaponType);
      });
    }
  }
  
  pauseGame() {
    // Store time scales for later restoration
    this.previousTimeScale = this.scene.time.timeScale;
    this.previousAnimsTimeScale = this.scene.anims.globalTimeScale;
    this.previousPhysicsTimeScale = this.scene.physics.world.timeScale;
    this.previousPhysicsPaused = this.scene.physics.world.isPaused;
    
    // Pause enemies behavior and stop enemy spawning
    if (this.scene.enemyManager) {
      this.scene.enemyManager.paused = true;
      
      // Pause spawn timers to prevent new enemies while menu is open
      if (this.scene.enemyManager.spawner && this.scene.enemyManager.spawner.enemySpawnTimer) {
        this.scene.enemyManager.spawner.enemySpawnTimer.paused = true;
      }
      if (this.scene.enemyManager.spawner && this.scene.enemyManager.spawner.waveTimer) {
        this.scene.enemyManager.spawner.waveTimer.paused = true;
      }
    }
    
    // Disable player controls during menu
    if (this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = false;
    }
    
    // Set a flag in the gamepad controller to disable LB while menu is open
    if (this.scene.gamepadController) {
      this.scene.gamepadController.weaponsMenuActive = true;
    }
    
    // Store and pause projectiles
    if (this.scene.projectiles) {
      this.projectilesState = [];
      this.scene.projectiles.getChildren().forEach(projectile => {
        this.projectilesState.push({
          obj: projectile,
          velX: projectile.body.velocity.x,
          velY: projectile.body.velocity.y
        });
        projectile.body.setVelocity(0, 0); // Completely stop projectiles
      });
    }
    
    // Use TimeScaleManager if available, otherwise apply time scales directly
    if (this.scene.timeScaleManager) {
      // Use TimeScaleManager to activate slow time
      this.scene.timeScaleManager.activateDroneWheelTime();
    } else {
      // Fallback to direct time scale adjustment
      this.scene.time.timeScale = BULLET_TIME_SLOWDOWN;
      this.scene.physics.world.timeScale = BULLET_TIME_SLOWDOWN;
      this.scene.anims.globalTimeScale = BULLET_TIME_SLOWDOWN;
    }
    
    // Store player's previous velocity
    if (this.scene.playerManager && this.scene.playerManager.player) {
      const player = this.scene.playerManager.player;
      this.previousVelocity = {
        x: player.body.velocity.x,
        y: player.body.velocity.y
      };
      // Stop player movement during menu
      player.setVelocity(0, 0);
    }
  }
  
  resumeGame() {
    // Use TimeScaleManager if available, otherwise restore time scales directly
    if (this.scene.timeScaleManager) {
      // Force restore enemy speeds first to make sure they're reset
      if (this.scene.timeScaleManager.enemiesWithStoredSpeeds && 
          this.scene.timeScaleManager.enemiesWithStoredSpeeds.length > 0) {
        this.scene.timeScaleManager.restoreEnemySpeeds();
      }
      
      // Use TimeScaleManager to deactivate slow time
      this.scene.timeScaleManager.deactivateDroneWheelTime();
    } else {
      // Fallback to direct time scale restoration
      this.scene.time.timeScale = this.previousTimeScale || 1.0;
      this.scene.anims.globalTimeScale = this.previousAnimsTimeScale || 1.0;
      this.scene.physics.world.timeScale = this.previousPhysicsTimeScale || this.previousTimeScale || 1.0;
    }
    
    // If physics world was paused before, resume it
    if (this.previousPhysicsPaused) {
      this.scene.physics.world.resume();
    }
    
    // Re-enable player controls
    if (this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = true;
    }
    
    // Clear the weapons menu active flag from gamepad controller
    if (this.scene.gamepadController) {
      this.scene.gamepadController.weaponsMenuActive = false;
    }
    
    // Restore player velocity if needed
    if (this.scene.playerManager && this.scene.playerManager.player && this.previousVelocity) {
      const player = this.scene.playerManager.player;
      // Only restore velocity if it was changed
      if (player.body.velocity.x === 0 && player.body.velocity.y === 0) {
        player.setVelocity(this.previousVelocity.x, this.previousVelocity.y);
      }
    }
    
    // Unpause enemies and resume enemy spawning
    if (this.scene.enemyManager) {
      this.scene.enemyManager.paused = false;
      // Resume spawn timers to restart enemy spawning when menu is closed
      if (this.scene.enemyManager.spawner && this.scene.enemyManager.spawner.enemySpawnTimer) {
        this.scene.enemyManager.spawner.enemySpawnTimer.paused = false;
      }
      if (this.scene.enemyManager.spawner && this.scene.enemyManager.spawner.waveTimer) {
        this.scene.enemyManager.spawner.waveTimer.paused = false;
      }
    }
    
    // Restore projectile velocities if any were stored
    if (this.projectilesState && this.projectilesState.length > 0) {
      this.projectilesState.forEach(pState => {
        if (pState.obj && pState.obj.active) {
          pState.obj.body.setVelocity(pState.velX, pState.velY);
        }
      });
      this.projectilesState = [];
    }
  }
  
  updateLayout(isPortrait) {
    if (!this.container || !this.weaponElements) return;
    
    const centerX = this.scene.cameras.main.width / 2;
    const centerY = this.scene.cameras.main.height / 2;
    
    // Update panel size based on orientation
    const panelWidth = isPortrait ? 400 : 500;
    const panelHeight = isPortrait ? 460 : 280;
    
    // Find and update the panel
    if (this.contentContainer && this.contentContainer.list && this.contentContainer.list[0]) {
      const panel = this.contentContainer.list[0];
      panel.setSize(panelWidth, panelHeight);
      panel.setPosition(centerX, centerY);
    }
    
    // Update title position
    if (this.contentContainer && this.contentContainer.list && this.contentContainer.list[1]) {
      const title = this.contentContainer.list[1];
      const titleY = centerY - (isPortrait ? panelHeight / 2 - 35 : 100);
      title.setPosition(centerX, titleY);
    }
    
    // Update weapon positions
    if (this.weaponElements) {
      if (isPortrait) {
        // Vertical layout (one above the other)
        this.repositionWeapon('shotgun', centerX, centerY - 70);
        this.repositionWeapon('rifle', centerX, centerY + 100);
      } else {
        // Horizontal layout (side by side)
        this.repositionWeapon('shotgun', centerX - 120, centerY);
        this.repositionWeapon('rifle', centerX + 120, centerY);
      }
    }
    
    // Update scanlines if present
    if (this.container.list && this.container.list.length > 2) {
      const scanlines = this.container.list[2];
      if (scanlines && scanlines.clear) {
        scanlines.clear();
        
        // Find the panel to get its bounds
        if (this.contentContainer && this.contentContainer.list && this.contentContainer.list[0]) {
          const panel = this.contentContainer.list[0];
          const bounds = panel.getBounds();
          
          scanlines.lineStyle(1, 0x00ff00, 0.15);
          const startY = bounds.y;
          const endY = bounds.y + bounds.height;
          const startX = bounds.x;
          const endX = bounds.x + bounds.width;
          
          for (let y = startY; y < endY; y += 4) {
            scanlines.beginPath();
            scanlines.moveTo(startX, y);
            scanlines.lineTo(endX, y);
            scanlines.closePath();
            scanlines.strokePath();
          }
        }
      }
    }
  }
  
  repositionWeapon(type, x, y) {
    const elements = this.weaponElements[type];
    if (!elements) return;
    
    if (elements.panel) {
      elements.panel.setPosition(x, y);
    }
    
    if (elements.image) {
      elements.image.setPosition(x, y - 30);
    }
    
    if (elements.label) {
      elements.label.setPosition(x, y + 30);
    }
    
    if (elements.desc) {
      elements.desc.setPosition(x, y + 55);
    }
  }
  
  cleanup() {
    // Clean up all input listeners
    this.cleanupInputListeners();
    
    // Remove orientation change listener
    if (this.orientationChangeListener) {
      this.scene.game.events.off('orientationChange', this.orientationChangeListener);
    }
    
    // Destroy container
    if (this.container) {
      this.container.destroy();
    }
    
    // Final safety check - force enable controls
    if (this.scene && this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = true;
    }
  }
  
  disableButtonsTemporarily() {
    try {
      // Always keep the temporary disabling to prevent accidental selection, especially with touch controls
      
      // Safety check for container
      if (!this.container || !this.container.active) {
        console.warn('WeaponsMenu: Cannot disable buttons - container not active');
        return;
      }
      
      // Get all interactive buttons in the container (shotgun and rifle panels)
      const buttons = [];
      
      // Add weapon panels if they exist
      if (this.weaponElements) {
        if (this.weaponElements.shotgun && this.weaponElements.shotgun.panel) {
          buttons.push(this.weaponElements.shotgun.panel);
        }
        if (this.weaponElements.rifle && this.weaponElements.rifle.panel) {
          buttons.push(this.weaponElements.rifle.panel);
        }
      }
      
      console.log(`WeaponsMenu: Temporarily disabling ${buttons.length} weapon buttons to prevent accidental selection`);
      
      // Disable all buttons temporarily
      buttons.forEach(button => {
        if (button && button.active) {
          button.disableInteractive();
        }
      });
      
      // Re-enable after a delay of 500ms (increased from 350ms)
      this.scene.time.delayedCall(500, () => {
        console.log(`WeaponsMenu: Re-enabling ${buttons.length} weapon buttons`);
        
        // For shotgun button
        if (this.weaponElements && this.weaponElements.shotgun && this.weaponElements.shotgun.panel) {
          const shotgunPanel = this.weaponElements.shotgun.panel;
          const shotgunLabel = this.weaponElements.shotgun.label;
          
          if (shotgunPanel && shotgunPanel.active) {
            try {
              // Re-enable with fresh event handlers
              shotgunPanel.setInteractive();
              
              // Clear existing listeners to avoid duplicates
              shotgunPanel.off('pointerover');
              shotgunPanel.off('pointerout');
              shotgunPanel.off('pointerdown');
              shotgunPanel.off('pointerup');
              
              // Re-add event handlers
              shotgunPanel.on('pointerover', () => {
                shotgunPanel.setFillStyle(0x005500);
                if (shotgunLabel) shotgunLabel.setColor('#33ff33');
              });
              
              shotgunPanel.on('pointerout', () => {
                shotgunPanel.setFillStyle(0x003300);
                if (shotgunLabel) shotgunLabel.setColor('#00ff00');
              });
              
              shotgunPanel.on('pointerdown', () => {
                shotgunPanel.setFillStyle(0x007700);
                if (shotgunLabel) shotgunLabel.setColor('#ffffff');
              });
              
              shotgunPanel.on('pointerup', () => {
                this.selectWeapon('shotgun');
              });
            } catch (err) {
              console.warn('WeaponsMenu: Error re-enabling shotgun button:', err);
            }
          }
        }
        
        // For rifle button
        if (this.weaponElements && this.weaponElements.rifle && this.weaponElements.rifle.panel) {
          const riflePanel = this.weaponElements.rifle.panel;
          const rifleLabel = this.weaponElements.rifle.label;
          
          if (riflePanel && riflePanel.active) {
            try {
              // Re-enable with fresh event handlers
              riflePanel.setInteractive();
              
              // Clear existing listeners to avoid duplicates
              riflePanel.off('pointerover');
              riflePanel.off('pointerout');
              riflePanel.off('pointerdown');
              riflePanel.off('pointerup');
              
              // Re-add event handlers
              riflePanel.on('pointerover', () => {
                riflePanel.setFillStyle(0x005500);
                if (rifleLabel) rifleLabel.setColor('#33ff33');
              });
              
              riflePanel.on('pointerout', () => {
                riflePanel.setFillStyle(0x003300);
                if (rifleLabel) rifleLabel.setColor('#00ff00');
              });
              
              riflePanel.on('pointerdown', () => {
                riflePanel.setFillStyle(0x007700);
                if (rifleLabel) rifleLabel.setColor('#ffffff');
              });
              
              riflePanel.on('pointerup', () => {
                this.selectWeapon('rifle');
              });
            } catch (err) {
              console.warn('WeaponsMenu: Error re-enabling rifle button:', err);
            }
          }
        }
      });
    } catch (error) {
      console.error('WeaponsMenu: Error disabling buttons temporarily:', error);
    }
  }
}