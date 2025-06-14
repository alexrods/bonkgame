import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';
import { TouchController } from '../utils/TouchController.js';
import { GamepadController } from '../utils/GamepadController.js';
import { AmmoDisplay } from '../ui/AmmoDisplay.js';

export class MultiplayerPlayerManager {
  constructor(scene, socket) {
    this.scene = scene;
    this.socket = socket;
    this.lastShotTime = 0;
    this.player = null;
    this.playerShadows = [];
    this.lastDirection = 'down';
    this.keys = null;
    this.cursors = null;
    this.shootingDirection = { x: 0, y: 0 };
    this.autoFireTimer = null;
    this.autoFireStartTime = 0; // Track when auto-fire started
    this.bullets = null;
    this.fireRate = 250; // Default fire rate in ms - can be modified by upgrades
    this.isStopShooting = false;
    this.controlsEnabled = true; // Flag to disable controls during deposit/withdraw screens

    // Weapon system
    this.weaponType = 'rifle'; // Default weapon type (can be 'rifle' or 'shotgun')
    this.originalWeaponType = 'rifle';

    // Ammo system
    this.magazineSize = 30; // AR-15 standard capacity
    this.currentAmmo = this.magazineSize; // Start with a full mag

    // Check if we're in tutorial scene to give more magazines
    if (scene.constructor.name === 'TutorialScene' || scene.key === 'TutorialScene') {
      this.totalMagazines = 5; // Start with 5 extra magazines in tutorial (6 total with the loaded one)
      console.log("Tutorial detected, starting with 5 extra magazines (6 total with loaded magazine)");
    } else {
      this.totalMagazines = 3; // Start with three extra mags in regular game
    }
    this.isReloading = false;
    this.reloadTime = 1500; // 1.5 seconds to reload
    this.reloadTimer = null;
    this.ammoDisplay = null;
    this.reloadPrompt = null;
    this.noMagFlashTween = null; // For flashing NO MAG text

    this.shadowOffsets = [
      { x: 10, y: 10 },   // For reflector in top-left, shadow falls bottom-right
      { x: -10, y: 10 },  // For reflector in top-right, shadow falls bottom-left
      { x: 10, y: -10 },  // For reflector in bottom-left, shadow falls top-right
      { x: -10, y: -10 }  // For reflector in bottom-right, shadow falls top-left
    ];
    this.shotSound = null;
    this.reloadSound = null;
    this.reloadingAnnounceSound = null;
    this.emptyMagSound = null;
    this.lowAmmoSound = null;
    this.lastMagSound = null;
    this.touchController = null;
    this.gamepadController = null;
    this.isMobile = this.detectMobile();

    // Death animation properties
    this.deathTween = null;
    this.deathAnimProgress = { frame: 0 };
    this.deathAnimTimers = [];
    this.currentDeathFrame = 0;
  }

  detectMobile() {
    return (
      navigator.userAgent.match(/Android/i) ||
      navigator.userAgent.match(/webOS/i) ||
      navigator.userAgent.match(/iPhone/i) ||
      navigator.userAgent.match(/iPad/i) ||
      navigator.userAgent.match(/iPod/i) ||
      navigator.userAgent.match(/BlackBerry/i) ||
      navigator.userAgent.match(/Windows Phone/i) ||
      (window.innerWidth <= 800 && window.innerHeight <= 1200)
    );
  }

  init() {
    this.playerId = this.socket.id;
    if (!this.socket) {
      console.error('No socket connection provided for multiplayer game');
      this.scene.start('MenuScene');
      return;
    } else {
      this.handleSocketEvents();
    }
    // Initialize sound property
    this.shotSound = null;
    this.createBulletGroup();

    // Initialize ammo display early
    this.createAmmoDisplay();

    this.setupInput();

    // Check if we have a detected input method from StartScene
    const detectedInputMethod = this.scene.registry.get('inputMethod');
    console.log(`PlayerManager using detected input method: ${detectedInputMethod}`);

    // First initialize gamepad controller for all devices
    this.gamepadController = new GamepadController(this.scene);
    this.gamepadController.init();

    // Check if gamepad is already connected
    const isGamepadAlreadyConnected = this.isGamepadConnected();

    // Initialize touch controller for mobile devices regardless of gamepad status
    if (detectedInputMethod === 'touch' || this.isMobile) {
      this.touchController = new TouchController(this.scene);
      this.touchController.init();

      // Hide touch controls immediately if gamepad is already connected
      if (isGamepadAlreadyConnected) {
        this.hideTouchControls();
      }

      // Listen for gamepad connection/disconnection events
      window.addEventListener('gamepadconnected', (e) => {
        this.handleGamepadConnection(e);
      });

      window.addEventListener('gamepaddisconnected', (e) => {
        this.handleGamepadDisconnection(e);
      });
    }
  }

  isGamepadConnected() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(gamepads).some(gamepad => gamepad && gamepad.connected);
  }

  hideTouchControls() {
    if (!this.touchController) return;

    // Hide touch controls by making them transparent
    if (this.touchController.movementJoystick) {
      const movementElements = [
        this.touchController.movementJoystick.baseBorder,
        this.touchController.movementJoystick.base,
        this.touchController.movementJoystick.thumb,
        this.touchController.movementJoystick.thumbHighlight
      ];

      this.scene.tweens.add({
        targets: movementElements,
        alpha: 0,
        duration: 500
      });
    }

    if (this.touchController.shootJoystick) {
      const shootElements = [
        this.touchController.shootJoystick.baseBorder,
        this.touchController.shootJoystick.base,
        this.touchController.shootJoystick.thumb,
        this.touchController.shootJoystick.thumbHighlight
      ];

      this.scene.tweens.add({
        targets: shootElements,
        alpha: 0,
        duration: 500
      });
    }

    // Hide reload button
    if (this.touchController.reloadButton) {
      const reloadElements = [
        this.touchController.reloadButton.baseBorder,
        this.touchController.reloadButton.base,
        this.touchController.reloadButton.icon
      ];

      this.scene.tweens.add({
        targets: reloadElements,
        alpha: 0,
        duration: 500
      });
    }

    // Hide drone button
    if (this.touchController.droneButton) {
      const droneElements = [
        this.touchController.droneButton.baseBorder,
        this.touchController.droneButton.base,
        this.touchController.droneButton.icon
      ];

      this.scene.tweens.add({
        targets: droneElements,
        alpha: 0,
        duration: 500
      });
    }
  }

  showTouchControls() {
    if (!this.touchController) return;

    // Show touch controls by making them visible
    if (this.touchController.movementJoystick) {
      const movementElements = [
        this.touchController.movementJoystick.baseBorder,
        this.touchController.movementJoystick.base,
        this.touchController.movementJoystick.thumb,
        this.touchController.movementJoystick.thumbHighlight
      ];

      this.scene.tweens.add({
        targets: movementElements,
        alpha: 1,
        duration: 500
      });
    }

    if (this.touchController.shootJoystick) {
      const shootElements = [
        this.touchController.shootJoystick.baseBorder,
        this.touchController.shootJoystick.base,
        this.touchController.shootJoystick.thumb,
        this.touchController.shootJoystick.thumbHighlight
      ];

      this.scene.tweens.add({
        targets: shootElements,
        alpha: 1,
        duration: 500
      });
    }

    // Show reload button
    if (this.touchController.reloadButton) {
      const reloadElements = [
        this.touchController.reloadButton.baseBorder,
        this.touchController.reloadButton.base,
        this.touchController.reloadButton.icon
      ];

      this.scene.tweens.add({
        targets: reloadElements,
        alpha: 1,
        duration: 500
      });
    }

    // Show drone button
    if (this.touchController.droneButton) {
      const droneElements = [
        this.touchController.droneButton.baseBorder,
        this.touchController.droneButton.base,
        this.touchController.droneButton.icon
      ];

      this.scene.tweens.add({
        targets: droneElements,
        alpha: 1,
        duration: 500
      });
    }
  }

  handleGamepadConnection(event) {
    console.log(`Gamepad connected: ${event.gamepad.id}`);

    // Hide touch controls when gamepad is connected
    this.hideTouchControls();
  }

  handleGamepadDisconnection(event) {
    console.log(`Gamepad disconnected: ${event.gamepad.id}`);

    // Check if all gamepads are disconnected
    if (!this.isGamepadConnected() && this.isMobile) {
      // Show touch controls when all gamepads are disconnected on mobile
      this.showTouchControls();
    }
  }

  loadSounds() {
    try {
      // Load shot sound
      if (this.scene.cache.audio.exists('shot')) {
        this.shotSound = this.scene.sound.add('shot');
        console.log("Shot sound loaded successfully");
      } else {
        console.warn("Shot sound not found in cache");
        this.shotSound = null;
      }

      // Load reload sound
      if (this.scene.cache.audio.exists('reload')) {
        this.reloadSound = this.scene.sound.add('reload');
        console.log("Reload sound loaded successfully");
      } else {
        console.warn("Reload sound not found in cache");
        this.reloadSound = null;
      }

      // Load reloading announcement sound
      if (this.scene.cache.audio.exists('reloading_announce')) {
        this.reloadingAnnounceSound = this.scene.sound.add('reloading_announce');
        console.log("Reloading announcement sound loaded successfully");
      } else {
        console.warn("Reloading announcement sound not found in cache");
        this.reloadingAnnounceSound = null;
      }

      // Load empty magazine sound
      if (this.scene.cache.audio.exists('empty_mag')) {
        this.emptyMagSound = this.scene.sound.add('empty_mag');
        console.log("Empty magazine sound loaded successfully");
      } else {
        console.warn("Empty magazine sound not found in cache");
        this.emptyMagSound = null;
      }

      // Load low ammo sound
      if (this.scene.cache.audio.exists('low_ammo')) {
        this.lowAmmoSound = this.scene.sound.add('low_ammo');
        console.log("Low ammo sound loaded successfully");
      } else {
        console.warn("Low ammo sound not found in cache");
        this.lowAmmoSound = null;
      }

      // Load last magazine sound
      if (this.scene.cache.audio.exists('last_mag')) {
        this.lastMagSound = this.scene.sound.add('last_mag');
        console.log("Last magazine sound loaded successfully");
      } else {
        console.warn("Last magazine sound not found in cache");
        this.lastMagSound = null;
      }

      // Add a sound status message that will fade out
      this.soundStatusText = this.scene.add.text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 50,
        '🔊 Sound effects enabled',
        { fontSize: '16px', fill: '#fff', stroke: '#000', strokeThickness: 2 }
      );
      this.soundStatusText.setOrigin(0.5);
      this.soundStatusText.setDepth(100);

      // Fade out after 3 seconds
      this.scene.tweens.add({
        targets: this.soundStatusText,
        alpha: 0,
        delay: 3000,
        duration: 1000,
        onComplete: () => {
          this.soundStatusText.destroy();
        }
      });

    } catch (error) {
      console.error("Error loading sounds:", error);
      this.shotSound = null;
      this.reloadSound = null;
      this.reloadingAnnounceSound = null;
      this.emptyMagSound = null;
    }

    // Display initial ammo
    this.updateAmmoDisplay();
  }

  createPlayer() {
    // Get the selected character
    let selectedCharacter = this.scene.registry.get('selectedCharacter') || 'default';

    // Set the texture prefix based on the selected character
    const prefix = selectedCharacter === 'default' ? '' : `${selectedCharacter}_`;

    // Store the selected character and prefix for later use
    this.selectedCharacter = selectedCharacter;
    this.texturePrefix = prefix;

    // Verify that essential animations exist for this character
    this.verifyEssentialAnimations();

    // Determine starting position - players start back-to-back in multiplayer
    let startX = GAME_WIDTH / 2;
    let startY = GAME_HEIGHT / 2;

    // Create the player sprite in the center with the appropriate texture
    this.player = this.scene.physics.add.sprite(
      startX,
      startY,
      `${prefix}down_idle_1`
    );
    this.player.setCollideWorldBounds(false); // Set to false to allow camera to follow outside boundaries

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

    // Set player to higher depth to ensure it's above shadow
    this.player.setDepth(10);

    // Debug logs to track shadow creation
    console.log("Multiple player shadows created for reflector effect");

    this.player.isDying = false; // Flag to track if player is in death animation
    this.player.isInvincible = false; // Flag for invincibility from drone upgrades
    this.player.speed = 250; // Default movement speed that can be boosted by upgrades

    // Initialize player health system
    this.health = 3; // Player now has 3 hit points
    this.maxHealth = 10; // Maximum health with shields

    // Set initial animation with the appropriate character prefix if needed
    const animPrefix = selectedCharacter !== 'default' ? `${selectedCharacter}_` : '';

    // In single player, just use default down animation
    this.player.play(`${animPrefix}down_idle`);
    this.lastDirection = 'down';

    // Listen for orientation changes to update sprite size
    this.scene.events.on('orientationChange', this.handleOrientationChange, this);
  }

  // Update player marker position in versus mode
  updatePlayerMarker() {
    if (this.playerMarker && this.player) {
      this.playerMarker.x = this.player.x;
      this.playerMarker.y = this.player.y + 56; // Updated offset (31 + 25 = 56)
    }
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

  createBulletGroup() {
    // Create group for bullets
    this.bullets = this.scene.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 100000,
      allowGravity: false,
      runChildUpdate: true,
      collideWorldBounds: false,
      classType: Phaser.Physics.Arcade.Sprite
    });

    // Add debug message
    console.log("Bullet group created, configured and ready");
  }

  setupInput() {
    // Set up input: WASD for movement, arrow keys for shooting.
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.keys = this.scene.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      E: Phaser.Input.Keyboard.KeyCodes.E,  // E key for drone wheel
      R: Phaser.Input.Keyboard.KeyCodes.R,  // R key for reload
      ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER  // Enter for wheel confirmation
    });

    // Add keyboard event listener for reload
    this.scene.input.keyboard.on('keydown-R', () => {
      this.reload();
      // Hide touch controls when keyboard is used
      this.hideTouchControls();
    });

    // Add keyboard event listeners to hide touch controls when keyboard is used
    this.scene.input.keyboard.on('keydown', () => {
      this.hideTouchControls();
    });
  }

  // Add reload method
  reload() {
    // Skip if already reloading or player is dying
    if (this.isReloading || (this.player && this.player.isDying)) return;

    // Skip if current magazine is full
    if (this.currentAmmo === this.magazineSize) return;

    // Skip if no magazines left
    if (this.totalMagazines <= 0 && this.currentAmmo <= 0) {
      // Play empty magazine sound
      if (this.emptyMagSound) {
        this.emptyMagSound.play();
      }

      // Show "OUT OF AMMO" warning
      this.showReloadPrompt("OUT OF AMMO!");
      return;
    }

    // Start reload sequence
    this.isReloading = true;

    // Play reload sound and announcement
    if (this.reloadSound) {
      this.reloadSound.play();
    }

    // Play the verbal "reloading" announcement
    if (this.reloadingAnnounceSound) {
      this.reloadingAnnounceSound.play();
    }

    // Show reloading text
    this.showReloadPrompt("RELOADING...");

    // Update ammo display immediately to show reloading
    this.updateAmmoDisplay();

    // Store the current time scale to make reload time consistent regardless of bullet time
    const currentTimeScale = this.scene.time.timeScale;
    const actualReloadTime = this.reloadTime * currentTimeScale;

    // Use real time for the reload timer by adjusting for bullet time
    this.reloadTimer = this.scene.time.delayedCall(actualReloadTime, () => {
      if (this.totalMagazines > 0) {
        this.totalMagazines--;
        this.currentAmmo = this.magazineSize;

        // Play last magazine sound when player is on their final magazine
        if (this.totalMagazines === 0 && this.lastMagSound) {
          this.lastMagSound.play();
        }
      }

      this.isReloading = false;

      // Hide reload prompt
      if (this.reloadPrompt) {
        this.reloadPrompt.setVisible(false);
      }

      // Update ammo display
      this.updateAmmoDisplay();
    });
  }

  // Show reload prompt or warning
  showReloadPrompt(message) {
    // For "RELOADING..." we don't need to show a prompt anymore
    // as it's handled by the ammo display
    if (message === "RELOADING...") {
      return;
    }

    // For other warnings (like "OUT OF AMMO!" or "NO MAG")
    if (this.reloadPrompt) {
      this.reloadPrompt.setText(message);
      this.reloadPrompt.setVisible(true);

      // Stop any existing flash tween
      if (this.noMagFlashTween) {
        this.noMagFlashTween.stop();
        this.noMagFlashTween = null;
      }
    } else {
      // Position below the ammo display (which is now in top-right)
      const x = GAME_WIDTH - 80;
      const y = 100;

      this.reloadPrompt = this.scene.add.text(
        x, y,
        message,
        {
          fontFamily: 'Tektur',
          fontSize: '22px', // Larger to match the bigger ammo display
          color: '#ff0000',
          stroke: '#000000',
          strokeThickness: 3
        }
      );
      this.reloadPrompt.setOrigin(0.5);
      this.reloadPrompt.setScrollFactor(0);
      this.reloadPrompt.setDepth(100);
    }

    // Add flashing effect for "NO MAG" warning
    if (message === "NO MAG") {
      // Create flashing effect for the text
      this.noMagFlashTween = this.scene.tweens.add({
        targets: this.reloadPrompt,
        alpha: { from: 1, to: 0.3 },
        duration: 250, // Match the duration used in AmmoDisplay.js
        yoyo: true,
        repeat: -1
      });

      // Tell ammo display to start synchronized flashing
      if (this.ammoDisplay) {
        this.ammoDisplay.startSynchronizedFlashing();
      }

      // Auto-hide after 2 seconds for warnings
      this.scene.time.delayedCall(2000, () => {
        if (this.reloadPrompt) {
          this.reloadPrompt.setVisible(false);

          // Stop the flashing effect
          if (this.noMagFlashTween) {
            this.noMagFlashTween.stop();
            this.noMagFlashTween = null;
          }

          // Tell ammo display to stop synchronized flashing
          if (this.ammoDisplay) {
            this.ammoDisplay.stopSynchronizedFlashing();
          }
        }
      });
    } else {
      // Auto-hide after 2 seconds for other warnings
      this.scene.time.delayedCall(2000, () => {
        if (this.reloadPrompt) {
          this.reloadPrompt.setVisible(false);
        }
      });
    }
  }

  // Create ammo display (called early in init)
  createAmmoDisplay() {
    // Create new stylized eight-segment ammo display in top-right corner
    this.ammoDisplay = new AmmoDisplay(
      this.scene,
      GAME_WIDTH - 80,  // X position (centered within display)
      50  // Y position (top right)
    );

    // Update the display with current values
    this.updateAmmoDisplay();

    console.log("AmmoDisplay initialized early in the startup sequence");

    // Create health display (simple icon-based display)
    this.createHealthDisplay();
  }

  // Create a simple health icon display
  createHealthDisplay() {
    // Use the same x-coordinate as the ammo display for alignment
    // Position is offset to align the left edge of both black bars
    const ammoScale = 1.5; // Same scale used in AmmoDisplay
    const ammoWidth = 90 * ammoScale;
    const leftEdgeOffset = -ammoWidth / 2; // This aligns with the left edge of the ammo display

    // Create the health display container positioned below ammo display in top-right
    this.healthContainer = this.scene.add.container(GAME_WIDTH - 80, 100);
    this.healthContainer.setDepth(100);
    this.healthContainer.setScrollFactor(0); // Fix to camera

    // Add a background for the health bar - same width as ammo display
    this.healthBg = this.scene.add.rectangle(leftEdgeOffset, 0, ammoWidth, 30, 0x000000, 0.6);
    this.healthBg.setOrigin(0, 0.5);
    this.healthContainer.add(this.healthBg);

    // Calculate the margin and bar width to fit the new background
    const margin = 5;
    const barWidth = ammoWidth - (margin * 2);

    // Create the health bar fill
    this.healthBar = this.scene.add.rectangle(leftEdgeOffset + margin, 0, barWidth, 20, 0xff0000, 1);
    this.healthBar.setOrigin(0, 0.5);
    this.healthContainer.add(this.healthBar);

    // Add a shield icon for visual clarity using the UI shield image
    // Position it to the left of the health bar
    this.shieldIcon = this.scene.add.image(leftEdgeOffset - 15, 0, 'shield');
    this.shieldIcon.setScale(0.06); // One-fifth of previous 0.3 scale
    this.healthContainer.add(this.shieldIcon);

    // Initialize health and maxHealth if they're undefined
    if (this.health === undefined) this.health = 3;
    if (this.maxHealth === undefined) this.maxHealth = 10;

    // Add a text display showing health value - centered in the health bar
    this.healthText = this.scene.add.text(leftEdgeOffset + (ammoWidth / 2), 0, `${this.health}/${this.maxHealth}`, {
      fontFamily: 'Tektur',
      fontSize: '16px',
      color: '#ffffff'
    });
    this.healthText.setOrigin(0.5, 0.5);
    this.healthContainer.add(this.healthText);

    // Update the display
    this.updateHealthDisplay();
  }

  // Update the health display
  updateHealthDisplay() {
    if (!this.healthContainer) return;

    // Update the health text
    if (this.healthText) {
      this.healthText.setText(`${this.health}/${this.maxHealth}`);
    }

    // Update the health bar fill
    if (this.healthBar) {
      // Retrieve the original maximum width
      const ammoScale = 1.5; // Same scale used in AmmoDisplay
      const ammoWidth = 90 * ammoScale;
      const margin = 5;
      const maxWidth = ammoWidth - (margin * 2);

      // Calculate fill width based on current health percentage
      const fillPercentage = this.health / this.maxHealth;
      const newWidth = Math.max(maxWidth * fillPercentage, 0);

      // Update the bar width
      this.healthBar.width = newWidth;

      // Update color based on health level
      if (fillPercentage <= 0.25) {
        this.healthBar.fillColor = 0xff0000; // Red when critically low
      } else if (fillPercentage <= 0.5) {
        this.healthBar.fillColor = 0xff7700; // Orange when low
      } else if (fillPercentage <= 0.75) {
        this.healthBar.fillColor = 0xffff00; // Yellow when moderate
      } else {
        this.healthBar.fillColor = 0x00ff00; // Green when high
      }
    }
  }

  // Update ammo display
  updateAmmoDisplay() {
    if (!this.ammoDisplay) {
      // If called before createAmmoDisplay, just return
      return;
    }

    // Debug log removed

    // Update the display with current values
    this.ammoDisplay.updateAmmo(
      this.currentAmmo,
      this.magazineSize,
      this.totalMagazines,
      this.isReloading
    );

    // Hide the old reload prompt if it exists, as the new display handles this
    if (this.reloadPrompt) {
      this.reloadPrompt.setVisible(false);
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

  update() {
    // Skip updates if player is dying
    if (this.player && this.player.isDying) {
      // Only update shadows during death animation
      this.updateShadows();
      return;
    }

    // Always update gamepad controller first (highest priority)
    if (this.gamepadController) {
      this.gamepadController.update();
    }

    // Always update touch controller if it exists, but its inputs will be ignored if gamepad is connected
    if (this.touchController) {
      this.touchController.update();
    }

    // Safety check: make sure player exists
    if (!this.player) {
      console.warn('Player not defined in update, skipping movement and shooting');
      this.cleanupBullets(); // Still clean up bullets
      return;
    }

    // If player isn't active, DO NOT reactivate it - this was causing the bug
    if (!this.player.active) {
      console.log('Player not active in update - skipping rest of update');
      // Only update shadows and cleanup bullets
      this.updateShadows();
      this.cleanupBullets();
      return;
    }

    // Safety check: make sure player body exists and player is not dying
    if (!this.player.body) {
      // Never recreate physics for a dying player
      if (this.player.isDying) {
        console.log('Player body is missing because player is dying - skipping movement');
        // Only update shadows but skip movement/shooting
        this.updateShadows();
        this.cleanupBullets();
        return;
      }

      console.warn('Player body is missing but not dying, attempting to recreate physics body');
      // Try to re-enable physics body only for non-dying players
      this.scene.physics.world.enable(this.player);

      // If still no body, skip movement but don't return - allow shadow updates
      if (!this.player.body) {
        console.warn('Failed to recreate player body, skipping movement but continuing update');
      }
    }

    // Always update shadows regardless of body state
    this.updateShadows();
    this.updatePlayerMarker();

    // Only do movement and shooting if body exists
    if (this.player.body) {
      this.handleMovement();
      this.handleShooting();
    }

    this.cleanupBullets();
  }

  handleMovement() {
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

    // Skip if controls are disabled (during deposit/withdraw screens)
    if (!this.controlsEnabled) {
      // Make sure player isn't moving
      if (this.player) {
        this.player.setVelocity(0, 0);
      }
      return;
    }

    // Player movement.
    let speed = this.player ? this.player.speed : 250; // Use player's speed property for upgrades
    let vx = 0, vy = 0;
    let inputHandled = false;

    // Get animation prefix for the selected character
    const animPrefix = this.selectedCharacter !== 'default' ? `${this.selectedCharacter}_` : '';

    // Handle gamepad movement input (highest priority)
    if (this.gamepadController) {
      const gamepadMoveVector = this.gamepadController.getMovementVector();
      if (gamepadMoveVector.x !== 0 || gamepadMoveVector.y !== 0) {
        vx = gamepadMoveVector.x * speed;
        vy = gamepadMoveVector.y * speed;
        inputHandled = true; // Mark that we've handled input
        // Hide touch controls when gamepad is used
        this.hideTouchControls();
      }
    }

    // Check for keyboard input
    let keyboardUsed = false;
    if (this.keys.W.isDown || this.keys.S.isDown || this.keys.A.isDown || this.keys.D.isDown) {
      keyboardUsed = true;
      // Hide touch controls when keyboard is used
      this.hideTouchControls();
    }

    // If no gamepad input, try touch then keyboard
    if (!inputHandled) {
      // Handle touch input only if gamepad is not connected and keyboard is not used
      if (this.touchController && !this.isGamepadConnected() && !keyboardUsed) {
        const moveVector = this.touchController.getMovementVector();
        if (moveVector.x !== 0 || moveVector.y !== 0) {
          vx = moveVector.x * speed;
          vy = moveVector.y * speed;
          inputHandled = true;
        }
      }

      // Handle keyboard input (fallback)
      if (!inputHandled) {
        if (this.keys.W.isDown) { vy = -speed; }
        if (this.keys.S.isDown) { vy = speed; }
        if (this.keys.A.isDown) { vx = -speed; }
        if (this.keys.D.isDown) { vx = speed; }
      }
    }

    // Safety check: make sure player exists, is active, and has a valid body
    if (this.player && this.player.active && this.player.body && typeof this.player.setVelocity === 'function') {
      this.player.setVelocity(vx, vy);
    } else {
      console.warn('Player not available for movement in handleMovement');
      return; // Exit early if player isn't available
    }

    // Update player animation based on movement (when not shooting)
    let shootX = 0, shootY = 0;

    // Handle keyboard shooting input
    if (this.cursors.up.isDown) { shootY = -1; }
    if (this.cursors.down.isDown) { shootY = 1; }
    if (this.cursors.left.isDown) { shootX = -1; }
    if (this.cursors.right.isDown) { shootX = 1; }

    // Handle touch shooting input
    if (this.isMobile && this.touchController) {
      const shootVector = this.touchController.getShootingVector();
      if (shootVector.x !== 0 || shootVector.y !== 0) {
        shootX = shootVector.x;
        shootY = shootVector.y;
      }
    }

    // Handle gamepad shooting input
    if (this.gamepadController) {
      const gamepadShootVector = this.gamepadController.getShootingVector();
      // Only override other inputs if gamepad is being used for shooting
      if (gamepadShootVector.x !== 0 || gamepadShootVector.y !== 0) {
        shootX = gamepadShootVector.x;
        shootY = gamepadShootVector.y;
      }
    }

    this.socket.emit('playerMovement', {
      x: this.player.x,
      y: this.player.y,
      vx: vx,
      vy: vy,
      shootX: shootX,
      shootY: shootY,
      health: this.health,
      roomId: this.scene.roomId
    });
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

  handleShooting() {
    // Skip if controls are disabled (during deposit/withdraw screens)
    if (!this.controlsEnabled || this.isStopShooting) {
      return;
    }

    // Shooting with arrow keys, touch, or gamepad.
    let shootX = 0, shootY = 0;
    let shouldShoot = false;
    let inputHandled = false;

    // Handle gamepad shooting input (highest priority)
    if (this.gamepadController) {
      const gamepadShootVector = this.gamepadController.getShootingVector();
      if (gamepadShootVector.x !== 0 || gamepadShootVector.y !== 0) {
        shootX = gamepadShootVector.x;
        shootY = gamepadShootVector.y;
        shouldShoot = true;
        inputHandled = true;
        // Hide touch controls when gamepad is used
        this.hideTouchControls();
      }

      // Check if shoot button is pressed on gamepad
      if (this.gamepadController.isShootButtonPressed()) {
        shouldShoot = true;
        // Hide touch controls when gamepad is used
        this.hideTouchControls();
      }
    }

    // Check for keyboard arrow key input
    let keyboardUsed = false;
    if (this.cursors.up.isDown || this.cursors.down.isDown || this.cursors.left.isDown || this.cursors.right.isDown) {
      keyboardUsed = true;
      // Hide touch controls when keyboard is used
      this.hideTouchControls();
    }

    // If no gamepad shooting direction, check other inputs
    if (!inputHandled) {
      // Handle touch shooting input only if gamepad is not connected and keyboard is not used
      if (this.touchController && !this.isGamepadConnected() && !keyboardUsed) {
        const shootVector = this.touchController.getShootingVector();
        if (shootVector.x !== 0 || shootVector.y !== 0) {
          shootX = shootVector.x;
          shootY = shootVector.y;
          shouldShoot = true;
          inputHandled = true;
        }
      }

      // Handle keyboard shooting input (fallback)
      if (!inputHandled) {
        if (this.cursors.up.isDown) { shootY = -1; shouldShoot = true; }
        if (this.cursors.down.isDown) { shootY = 1; shouldShoot = true; }
        if (this.cursors.left.isDown) { shootX = -1; shouldShoot = true; }
        if (this.cursors.right.isDown) { shootX = 1; shouldShoot = true; }
      }
    }

    if ((shootX !== 0 || shootY !== 0) && shouldShoot) {
      this.shootingDirection.x = shootX;
      this.shootingDirection.y = shootY;

      // Handle shooting logic
      if (!this.autoFireTimer) {
        // Fire first shot immediately for all input methods
        this.shoot();

        // Store the start time of shooting 
        this.autoFireStartTime = this.scene.time.now;

        // Set auto-fire timer with consistent behavior across all input methods
        this.autoFireTimer = this.scene.time.addEvent({
          delay: this.fireRate, // Can be modified by upgrades
          callback: () => {
            const timeElapsed = this.scene.time.now - this.autoFireStartTime;

            // Check if we're using touch controls - they need an initial delay to prevent auto-fire on flicks
            const isTouchControl = this.touchController &&
              !this.isGamepadConnected() &&
              (this.touchController.getShootingVector().x !== 0 ||
                this.touchController.getShootingVector().y !== 0);

            // For touch controls, add initial delay to prevent auto-fire on flicks
            // For keyboard/gamepad, auto-fire immediately
            const requiredHoldTime = isTouchControl ? 250 : 0;

            if (timeElapsed > requiredHoldTime) {
              // Always auto-fire at the same rate once started
              this.shoot();
            }
          },
          callbackScope: this,
          loop: true
        });
      }
    } else if (this.autoFireTimer) {
      this.autoFireTimer.remove();
      this.autoFireTimer = null;
      this.autoFireStartTime = 0;
    }
  }

  cleanupBullets() {
    // Remove off-screen bullets - use a larger boundary to prevent premature cleanup
    // Add a 200px buffer to each dimension
    const buffer = 300;
    this.bullets.children.each(function (bullet) {
      if (bullet.active &&
        (bullet.x < -buffer ||
          bullet.x > GAME_WIDTH + buffer ||
          bullet.y < -buffer ||
          bullet.y > GAME_HEIGHT + buffer)) {

        // Debug log removed
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.enable = false; // Disable physics body
      }
    }, this);

    // Log active bullet count occasionally for debugging
    // Debugging logs removed
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

  // Handle shooting.
  shoot() {
    const now = this.scene.time.now;
    if (now - this.lastShotTime < this.fireRate) return; // Can be modified by upgrades
    this.lastShotTime = now;
    if (this.shootingDirection.x === 0 && this.shootingDirection.y === 0) return;

    // Check if reloading
    if (this.isReloading) return;

    // Check ammo
    if (this.currentAmmo <= 0) {
      // Play empty gun sound
      if (this.emptyMagSound) {
        this.emptyMagSound.play();
      }

      // Show reload prompt
      this.showReloadPrompt("NO MAG");

      // Auto-reload if player has magazines
      if (this.totalMagazines > 0) {
        this.reload();
      }

      return;
    }

    // Reduce ammo
    this.currentAmmo--;
    this.updateAmmoDisplay();

    // Add recoil effect to ammo counter with overshoot and stabilization
    if (this.ammoDisplay && this.ammoDisplay.container) {
      // Use the original position from the AmmoDisplay class (fixed y position)
      const originalY = 50; // This matches the Y value when ammoDisplay is created

      // First tween: quick sharp movement down
      this.scene.tweens.add({
        targets: this.ammoDisplay.container,
        y: originalY + 10, // Quick downward movement
        duration: 60,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          // Second tween: return with overshoot
          this.scene.tweens.add({
            targets: this.ammoDisplay.container,
            y: originalY - 3, // Slight overshoot upward
            duration: 120,
            ease: 'Sine.easeOut',
            onComplete: () => {
              // Final tween: stabilize - always return to exact original position
              this.scene.tweens.add({
                targets: this.ammoDisplay.container,
                y: originalY,
                duration: 80,
                ease: 'Cubic.easeOut'
              });
            }
          });
        }
      });
    }

    // Play low ammo sound when reaching 10 bullets left
    if (this.currentAmmo === 10 && this.lowAmmoSound) {
      this.lowAmmoSound.play();
    }

    // Auto-reload when empty if player has magazines
    if (this.currentAmmo === 0 && this.totalMagazines > 0) {
      this.scene.time.delayedCall(100, () => {
        this.reload();
      });
    }

    // Calculate angle for bullet direction
    let angle = Math.atan2(this.shootingDirection.y, this.shootingDirection.x);

    // Apply damage multiplier if set (from drone upgrades)
    const damageMultiplier = this.scene.playerManager.damageMultiplier || 1.0;

    // Base offset based on firing angle
    let muzzleOffsetX = Math.cos(angle) * 7;
    let muzzleOffsetY = Math.sin(angle) * 7;

    // Adjust muzzle position based on player direction
    if (this.lastDirection === 'side') {
      // When looking sideways, adjust up by 7 pixels
      muzzleOffsetY -= 7;
    } else if (this.lastDirection === 'up' || this.lastDirection === 'up_corner') {
      // When looking up, adjust right by 18 pixels
      muzzleOffsetX += 18;
    } else if (this.lastDirection === 'down' || this.lastDirection === 'down_corner') {
      // When looking down, adjust left by 15 pixels and down by 45 pixels
      muzzleOffsetX -= 15;
      muzzleOffsetY += 45; // Move down 45 pixels when looking down (changed direction)
    }

    // Get bullet origin coordinates
    const bulletOriginX = this.player.x + muzzleOffsetX;
    const bulletOriginY = this.player.y + muzzleOffsetY;

    if (!this.isStopShooting) {
      this.fireRifle(angle, muzzleOffsetX, muzzleOffsetY, this.playerId, this.player.x, this.player.y);
      this.socket.emit('fireRifle', {
        angle: angle,
        muzzleOffsetX: muzzleOffsetX,
        muzzleOffsetY: muzzleOffsetY,
        playerX: this.player.x,
        playerY: this.player.y,
        roomId: this.scene.roomId
      });
      console.log("Fired rifle bullet", angle, muzzleOffsetX, muzzleOffsetY, damageMultiplier, this.playerId, this.player.x, this.player.y);
    }

    // Track shot fired for accuracy calculation
    if (this.scene.ui) {
      this.scene.ui.trackShot();
    }

    // Always play the shooting sound if available
    if (this.shotSound) {
      this.shotSound.play();
    }
  }

  // Fire a single rifle bullet
  fireRifle(angle, muzzleOffsetX, muzzleOffsetY, playerId, playerX, playerY) {
    let bullet = this.bullets.create(playerX + muzzleOffsetX, playerY + muzzleOffsetY, 'bullet');
    if (bullet) {
      // Enable the bullet physics body (important!)
      bullet.enableBody(true, playerX + muzzleOffsetX, playerY + muzzleOffsetY, true, true);
      bullet.setActive(true);
      bullet.setVisible(true);

      bullet.setRotation(angle);
      bullet.setScale(1.2);
      bullet.playerId = playerId;



      // Make sure the body exists
      if (!bullet.body) {
        console.error("Bullet body is undefined!");
        return;
      }

      bullet.body.isCircle = true;
      bullet.body.radius = 6;
      bullet.body.velocity.x = Math.cos(angle) * 750;
      bullet.body.velocity.y = Math.sin(angle) * 750;

      // Set bullet depth higher than player (player is at depth 10) to ensure bullets render above the player
      bullet.setDepth(15);

      console.log("Bullet playerId:", playerId, bullet.playerId);
      console.log("this.bullets", this.bullets);

      // Debug log removed
    } else {
      // Warning log removed
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

  // Used for bullet-enemy collision detection
  getBullets() {
    return this.bullets;
  }

  getPlayer() {
    return this.player;
  }

  stopShooting() {
    this.isStopShooting = true;
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

    // Update the ammo display with weapon type
    if (this.ammoDisplay) {
      this.ammoDisplay.updateWeaponType(type);
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

  handleSocketEvents() {
    if (!this.socket) {
      console.warn('Socket not initialized when setting up event handlers');
      return;
    }

    this.socket.on("rifleFired", (data) => {
      if(data.roomId != this.scene.roomId) {
        return;
      }
      console.log("Rifle fired", data);
      if (data.playerId != this.playerId) {
        this.fireRifle(data.angle, data.muzzleOffsetX, data.muzzleOffsetY, data.playerId, data.playerX, data.playerY);
      }
    });
  }
}