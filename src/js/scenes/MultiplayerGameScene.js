import { GAME_WIDTH, GAME_HEIGHT } from "../../config.js";
import { MultiplayerEnemyManager } from "../managers/MultiplayerEnemyManager.js";
import { TimeScaleManager } from "../managers/TimeScaleManager.js";
import { GameUI } from "../ui/GameUI.js";
import { DialogSystem } from "../ui/DialogSystem.js";
import { LabEnvironment } from "../environment/LabEnvironment.js";
import { MultiplayerPlayerManager } from "../managers/MultiplayerPlayerManager.js";
import { setCreditCount } from "../utils/api.js";
import { DroneManager } from "../managers/MultiPlayerDroneManager.js";
import { DroneWheel } from "../ui/MultiPlayerDroneWheel.js";

export class MultiplayerGameScene extends Phaser.Scene {
  constructor() {
    super({ key: "MultiplayerGameScene" });
    this.isMultiplayer = true;
    this.socket = null;
    this.playerAccount = null;
  }

  init(data) {
    this.socket = data.socket;
    this.playerId = this.socket.id;
    this.roomId = data.roomId;
    if (!this.socket) {
      console.error("No socket connection provided for multiplayer game");
      this.scene.start("MenuScene");
      return;
    } else {
      this.handleSocketEvents();
    }
    import("../utils/Animations.js").then(({ createAnimations }) => {
      const selectedCharacter = this.registry.get("selectedCharacter");
      console.log(`Ensuring animations for character: ${selectedCharacter}`);
      createAnimations(this);
    });
    console.log("GameScene init called - setting up fresh game state");

    // Hide wallet UI during gameplay
    const walletUI = document.getElementById("wallet-ui");
    if (walletUI) {
      walletUI.style.display = "none";
    }

    // First check if menu music is playing and stop it (different music type)
    const menuMusic = this.registry.get("menuMusic");
    if (menuMusic && menuMusic.isPlaying) {
      console.log("Stopping menu music in CharacterSelectScene");
      menuMusic.stop();
    }

    // Create a background color matching the lab floor
    this.cameras.main.setBackgroundColor(0xb8c0c8);
    this.playerManager = null;
    this.enemyManager = null;
    this.timeScaleManager = null;
    this.environment = null;
    this.ui = null;
    this.droneManager = null;

    // Clean up physics groups just in case
    if (this.physics && this.physics.world) {
      this.physics.world.colliders.destroy();
    }

    // Initialize player account and web3 connection
    this.initializePlayerAccount();
    // Initialize our component managers
    this.initializeManagers();
  }

  initializePlayerAccount() {
    // Get the existing PlayerAccount from registry
    const existingAccount = this.registry.get("playerAccount");
    if (existingAccount) {
      this.playerAccount = existingAccount;
    } else {
      // Create player account manager if not in registry (should not happen normally)
      console.log("Player account does not exist.");
      this.scene.start("MenuScene");
    }
  }

  initializeManagers() {
    // Initialize lab environment first (for floor and containers)
    this.environment = new LabEnvironment(this);
    this.environment.init();

    // Initialize UI for score display
    this.ui = new GameUI(this);
    this.ui.init();
    // Initialize player with reference to scene
    this.playerManager = new MultiplayerPlayerManager(this, this.socket);
    this.playerManager.init();

    // Initialize enemy manager
    this.enemyManager = new MultiplayerEnemyManager(
      this,
      this.environment.getBloodContainer()
    );
    this.enemyManager.init();

    // Initialize drone manager
    this.droneManager = new DroneManager(this, this.socket);
    this.droneManager.init();

    // Initialize drone wheel UI
    this.droneWheel = new DroneWheel(this);
    this.droneWheel.init();

    // Initialize dialog system
    this.dialogSystem = new DialogSystem(this);
    this.dialogSystem.init();

    // Setup floating text event listener
    this.events.on("showFloatingText", this.showFloatingText, this);

    // Initialize time scale manager
    this.timeScaleManager = new TimeScaleManager(this);
    this.timeScaleManager.init();
    this.setupKeyboardControls();
  }

  // Show a message when the player disconnects
  showDisconnectMessage() {
    const message = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        "Not enough players\nReturning to menu...",
        {
          font: "32px Arial",
          fill: "#ffffff",
        }
      )
      .setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.scene.start("MenuScene");
    });
  }

  create() {
    console.log("MuliplayerGameScene create - setting up game components");

    // Preload dialog images with error handling
    this.loadDialogAssets();

    // Create player and load sounds
    this.playerManager.createPlayer();

    // Configure camera to follow player
    this.setupCamera();

    // Log the timeScaleManager state to debug
    if (this.timeScaleManager) {
      console.log("TimeScaleManager is initialized and ready");
    } else {
      console.warn("TimeScaleManager is not initialized yet!");
    }
    console.log("MultipayerGameScene is called");
    // Send player settings to backend after player is created
    if (this.socket) {
      // Get relevant player settings from player manager
      const playerSettings = {
        playerId: this.socket.id,
        character: this.playerManager.selectedCharacter,
        x: this.playerManager.player.x,
        y: this.playerManager.player.y,
        health: this.playerManager.health,
        score: this.playerManager.score,
        roomId: this.roomId,
      };
      // Emit player created event with settings
      this.socket.emit("playerCreated", playerSettings);
      console.log("Sent player settings to server:", playerSettings);
    } else {
      console.warn(
        "Socket not initialized when trying to send player settings"
      );
    }

    // Listen for orientation changes to adjust camera
    this.events.on("orientationChange", this.handleOrientationChange, this);

    // Create loot group for cash items
    this.lootGroup = this.physics.add.group();

    // Create the ESC key object
    this.escKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC
    );

    // Add an event listener for the ESC key
    this.escKey.on("down", () => {
      this.socket.close();
      this.registry.set("isGameStarted", false);
      this.scene.start("MenuScene");
    });
  }

  // Handle player collecting cash or upgrade boxes
  handleCashCollection(player, item) {
    // Check if the item is a drone upgrade box
    if (item.upgradeType) {
      // Check if this item has already been collected to prevent duplicate collection
      if (item.isCollected) {
        console.log(`Powerup already collected, ignoring duplicate collision`);
        return;
      }

      // Mark the item as collected to prevent duplicate collection
      item.isCollected = true;

      // Apply the upgrade effect via drone manager
      console.log("Collecting powerup:", item.upgradeType);
      this.droneManager.applyUpgrade(player, item);
      return;
    }

    // Handle regular loot items (coins or cash)
    // Check if this item has already been collected to prevent duplicate collection
    if (item.isCollected) {
      console.log(`Money already collected, ignoring duplicate collision`);
      return;
    }

    // Mark the item as collected to prevent duplicate collection
    item.isCollected = true;

    this.tweens.add({
      targets: item,
      scale: 0.3, // Adjusted to match the new smaller size
      alpha: 0,
      y: item.y - 20,
      duration: 200,
      onComplete: () => {
        // Add a random amount of money (10x nerf)
        const moneyValues = [0.1, 0.5, 1, 2, 5, 10];
        const randomMoney =
          moneyValues[Math.floor(Math.random() * moneyValues.length)];

        // Apply multiplier if set (from stronger enemies)
        const multiplier = item.moneyMultiplier || 1;
        const finalAmount = randomMoney * multiplier;

        // Update player's money
        this.ui.updateMoney(finalAmount);

        // Play credit sound right before destroying the item
        this.playCreditSound();

        // Remove the item
        item.destroy();
      },
    });
  }

  setupKeyboardControls() {
    // E key to open drone wheel while held down
    this.input.keyboard.on("keydown-E", () => {
      // Only show drone wheel if neither menu is active
      if (!this.droneWheel.isVisible) {
        this.droneWheel.show();
      }
    });

    // Release E key to confirm and close drone wheel
    this.input.keyboard.on("keyup-E", () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.confirmSelection();
        this.droneWheel.hide();
      }
    });

    // Arrow keys to navigate drone wheel clockwise/counter-clockwise
    this.input.keyboard.on("keydown-LEFT", () => {
      if (this.droneWheel.isVisible) {
        console.log("LEFT arrow key pressed for drone wheel");
        this.droneWheel.selectPrevious(); // Counter-clockwise
      }
    });

    this.input.keyboard.on("keydown-RIGHT", () => {
      if (this.droneWheel.isVisible) {
        console.log("RIGHT arrow key pressed for drone wheel");
        this.droneWheel.selectNext(); // Clockwise
      }
    });

    // WASD navigation (alternative to arrow keys)
    this.input.keyboard.on("keydown-A", () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.selectPrevious(); // Counter-clockwise
      }
    });

    this.input.keyboard.on("keydown-D", () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.selectNext(); // Clockwise
      }
    });

    // Add ESC to cancel without confirming
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.hide();
      }
    });
  }

  // Load dialog assets with proper error handling
  loadDialogAssets() {
    // Setup loader to react to errors
    if (!this.load.hasListenerAttached) {
      this.load.on("filecomplete", (key, type, data) => {
        console.log(`Successfully loaded dialog asset: ${key}`);
      });

      this.load.on("loaderror", (fileObj) => {
        console.error(`Error loading file: ${fileObj.key} (${fileObj.src})`);
      });

      this.load.hasListenerAttached = true;
    }

    // For default character or others, use the original asset loading logic
    this.loadStandardDialogAssets("default");
  }

  // Original method renamed to load standard character dialog assets
  loadStandardDialogAssets(selectedCharacter) {
    const characterPath =
      selectedCharacter === "default" ? "degen" : selectedCharacter;

    // First check if the assets already exist in the texture cache
    const requiredAssets = [
      selectedCharacter === "default" ? "degen" : selectedCharacter,
      "girl",
      "networkExec",
    ];
    const missingAssets = requiredAssets.filter(
      (key) => !this.textures.exists(key)
    );

    if (missingAssets.length === 0) {
      console.log(
        "All dialog assets already loaded and available in texture cache"
      );
      return; // All assets are already loaded
    }

    console.log(
      `Loading missing dialog assets for ${characterPath}: ${missingAssets.join(
        ", "
      )}`
    );

    // Try to load missing dialog images
    try {
      if (
        !this.textures.exists(
          selectedCharacter === "default" ? "degen" : selectedCharacter
        )
      ) {
        this.load.image(
          selectedCharacter === "default" ? "degen" : selectedCharacter,
          `/assets//story/${characterPath}/intro/${
            selectedCharacter === "default" ? "degen" : selectedCharacter
          }.png`
        );
      }

      if (!this.textures.exists("girl")) {
        this.load.image(
          "girl",
          `/assets//story/${characterPath}/intro/girl.png`
        );
      }

      if (!this.textures.exists("networkExec")) {
        this.load.image(
          "networkExec",
          `/assets//story/${characterPath}/intro/networkExec.png`
        );
      }

      // Start the loader only if there are assets to load
      if (missingAssets.length > 0) {
        this.load.start();
      }
    } catch (e) {
      console.error("Error setting up dialog asset loading:", e);
    }
  }

  // Set up camera to follow player with deadzone and bounds
  setupCamera() {
    const player = this.playerManager.getPlayer();
    const isPortrait = this.registry.get("isPortrait");

    // Get current game dimensions
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;

    // Calculate the extended world size (50% larger than screen)
    const worldExtension = 0.5; // 50% extension
    const worldWidth = gameWidth * (1 + worldExtension);
    const worldHeight = gameHeight * (1 + worldExtension);

    // Calculate offset to center the extended world
    const offsetX = (worldWidth - gameWidth) / 2;
    const offsetY = (worldHeight - gameHeight) / 2;

    // Set world bounds to be larger than the camera view
    this.physics.world.setBounds(-offsetX, -offsetY, worldWidth, worldHeight);

    // Keep player within these extended world bounds
    player.setCollideWorldBounds(true);

    // Set camera bounds to match the game dimensions exactly
    // This prevents the camera from showing beyond the playable area
    this.cameras.main.setBounds(-offsetX, -offsetY, worldWidth, worldHeight);

    // Configure camera to follow player
    this.cameras.main.startFollow(player, true);

    // Set camera deadzone - smaller in portrait mode
    // These values determine how close to the edge the player can get before camera starts moving
    const deadzoneWidth = isPortrait ? gameWidth * 0.3 : gameWidth * 0.4;
    const deadzoneHeight = isPortrait ? gameHeight * 0.3 : gameHeight * 0.4;

    // Set the deadzone - area where camera won't scroll
    // This creates a "box" in the center where the player can move without the camera moving
    this.cameras.main.setDeadzone(deadzoneWidth, deadzoneHeight);

    // Set camera zoom
    this.cameras.main.setZoom(1);

    // Inform environment to resize tiles
    if (this.environment) {
      // Send an event that LabEnvironment can listen for
      this.events.emit("updateEnvironment", { isPortrait });
    }

    // Store camera configuration for reference in update
    this.cameraConfig = {
      worldWidth,
      worldHeight,
      offsetX,
      offsetY,
      gameWidth,
      gameHeight,
    };
  }

  // Function to start the game with enemies
  startGameForAllPlayers() {
    // Define required assets based on character selection
    let requiredAssets = ["degen"];

    const missingAssets = requiredAssets.filter(
      (key) => !this.textures.exists(key)
    );

    if (missingAssets.length > 0) {
      console.warn(
        `Missing dialog assets: ${missingAssets.join(
          ", "
        )}. Trying to reload...`
      );

      // Try to reload assets
      this.loadDialogAssets();

      // Wait briefly then check again
      this.time.delayedCall(300, () => {
        const stillMissing = requiredAssets.filter(
          (key) => !this.textures.exists(key)
        );

        if (stillMissing.length > 0) {
          console.error(
            `Still missing assets after reload attempt: ${stillMissing.join(
              ", "
            )}`
          );
          // Continue anyway with warning - dialog will show but images might be missing
        }
      });

      // Show SURVIVE message at game start
      this.droneWheel.enabled = true;
      this.showSurviveTextMessage();
    }
  }

  // Common method to show survive or kill count message
  showSurviveTextMessage() {
    // Always use fixed screen coordinates for UI elements, not camera-relative ones
    const camera = this.cameras.main;
    // Use fixed screen coordinates instead of camera-relative ones
    const screenCenterX = camera.width / 2;
    const screenCenterY = camera.height / 2;

    // Check if we're in portrait mode
    const isPortrait =
      this.registry.get("isPortrait") || camera.height > camera.width;

    // Create large text with red color and black outline
    // Calculate responsive font size based on screen width
    const screenWidth = camera.width;

    // Format the text content with line breaks in portrait mode
    let surviveTextContent = "💀 SURVIVE";

    // Use percentage of screen dimensions for more responsive sizing
    const targetWidthPercent = isPortrait ? 0.9 : 0.8; // Use 90% of width in portrait, 80% in landscape
    const targetWidth = screenWidth * targetWidthPercent;

    // Base font size as percentage of screen height
    const baseFontSizePercent = isPortrait ? 0.06 : 0.08; // 6% of screen height in portrait, 8% in landscape
    let fontSize = Math.floor(camera.height * baseFontSizePercent);

    // Use Metal Mania font for all announcements including SURVIVE
    const fontFamily = "Metal Mania, Arial Black, Impact";

    // For portrait mode with line breaks, we need to measure and adjust
    if (isPortrait) {
      // Create a temporary text to measure
      const tempText = this.add.text(0, 0, surviveTextContent, {
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        align: "center",
      });

      // If text is too wide, scale it down
      if (tempText.width > targetWidth) {
        const scaleFactor = targetWidth / tempText.width;
        fontSize = Math.floor(fontSize * scaleFactor);
      }

      tempText.destroy();
    } else {
      // For landscape mode, use similar approach
      const tempText = this.add.text(0, 0, surviveTextContent, {
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
      });

      // If text is too wide, scale it down
      if (tempText.width > targetWidth) {
        const scaleFactor = targetWidth / tempText.width;
        fontSize = Math.floor(fontSize * scaleFactor);
      }

      tempText.destroy();
    }

    // Enforce minimum and maximum font sizes for readability
    const minFontSize = Math.floor(camera.height * 0.04); // Minimum 4% of screen height
    const maxFontSize = Math.floor(camera.height * 0.12); // Maximum 12% of screen height
    fontSize = Math.max(minFontSize, Math.min(fontSize, maxFontSize));

    // Create text centered on the screen (not camera position)
    const surviveText = this.add.text(
      screenCenterX,
      screenCenterY,
      surviveTextContent,
      {
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        color: "#ff0000",
        stroke: "#000000",
        strokeThickness: 12,
        align: "center", // Center align for multiline text
        shadow: {
          offsetX: 3,
          offsetY: 3,
          color: "#000000",
          blur: 5,
          fill: true,
        },
        lineSpacing: isPortrait ? 10 : 0, // Add line spacing in portrait mode
      }
    );
    surviveText.setOrigin(0.5);
    surviveText.setDepth(1000); // Ensure it's above everything

    // Set scrollFactor to 0 to make text stay fixed on screen regardless of camera movement
    surviveText.setScrollFactor(0);

    // Add scale effect - faster
    this.tweens.add({
      targets: surviveText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300, // Faster scaling
      ease: "Back.easeOut",
    });

    // Add subtle shake effect - faster (using screen coordinates)
    this.tweens.add({
      targets: surviveText,
      x: { from: screenCenterX - 5, to: screenCenterX + 5 },
      yoyo: true,
      repeat: 1, // Only one repetition
      duration: 80, // Faster shake
      ease: "Sine.easeInOut",
      delay: 300, // Less delay
    });

    // Wait 1.25 seconds (half the time), then fade out
    this.time.delayedCall(1250, () => {
      // Fade out text
      this.tweens.add({
        targets: surviveText,
        alpha: 0,
        scale: 1.5,
        duration: 250, // Faster fade out
        ease: "Back.easeIn",
        onComplete: () => {
          surviveText.destroy();
        },
      });
    });
  }

  // Handle orientation changes
  handleOrientationChange({ isPortrait }) {
    // Update camera settings when orientation changes
    this.setupCamera();

    // Handle UI visibility in portrait mode
    if (isPortrait && this.ui) {
      console.log("Switching to portrait mode - hiding counters");
      // Hide counters in portrait mode until they change
      if (this.ui.killCounter) {
        // Hide container for more reliable hiding
        if (this.ui.killCounter.container) {
          this.ui.killCounter.container.setVisible(false);
        } else {
          this.ui.killCounter.segmentDisplays.forEach((segs) =>
            segs.forEach((s) => s.setVisible(false))
          );
        }
        // Update portrait mode flag
        this.ui.killCounter.isPortrait = true;
      }
    } else if (!isPortrait && this.ui) {
      console.log("Switching to landscape mode - showing counters");
      // Show counters in landscape mode
      if (this.ui.killCounter) {
        // Show container for more reliable showing
        if (this.ui.killCounter.container) {
          this.ui.killCounter.container.setVisible(true);
        } else {
          this.ui.killCounter.segmentDisplays.forEach((segs) =>
            segs.forEach((s) => s.setVisible(true))
          );
        }
        // Update portrait mode flag
        this.ui.killCounter.isPortrait = false;
      }
    }
  }

  updateCameraConstraints() {
    // Only process if we have camera config
    if (!this.cameraConfig) return;

    const camera = this.cameras.main;
    const config = this.cameraConfig;

    // Calculate maximum allowed scroll for camera
    const maxScrollX = config.offsetX;
    const maxScrollY = config.offsetY;

    // Adjust camera scroll if it's showing beyond the playable area
    if (camera.scrollX < -maxScrollX) {
      camera.scrollX = -maxScrollX;
    } else if (camera.scrollX > maxScrollX) {
      camera.scrollX = maxScrollX;
    }

    if (camera.scrollY < -maxScrollY) {
      camera.scrollY = -maxScrollY;
    } else if (camera.scrollY > maxScrollY) {
      camera.scrollY = maxScrollY;
    }
  }

  // Create red pulse effect that fills the screen
  createRedPulseEffect() {
    const camera = this.cameras.main;

    // Create a red rectangle that covers the entire screen
    const redOverlay = this.add.rectangle(
      camera.width / 2,
      camera.height / 2,
      camera.width,
      camera.height,
      0xff0000
    );
    redOverlay.setAlpha(0.35); // Start with moderate opacity
    redOverlay.setDepth(998); // Below blood splatters but above game
    redOverlay.setScrollFactor(0); // Fixed to camera

    // Pulse animation
    this.tweens.add({
      targets: redOverlay,
      alpha: { from: 0.35, to: 0 },
      duration: 500,
      ease: "Sine.easeOut",
      onComplete: () => {
        redOverlay.destroy();
      },
    });
  }

  // Handle when the player is killed
  handlePlayerDeath() {
    // Get player reference
    const player = this.playerManager.getPlayer();
    this.playerManager.stopShooting();

    // If player is already dying, don't handle death again
    if (player.isDying) {
      console.log("Player already dying, ignoring duplicate death event");
      return;
    }

    // Setup floating text event listener if not already set
    if (!this.events.listeners("showFloatingText")) {
      this.events.on("showFloatingText", this.showFloatingText, this);
    }

    // Store original scale to avoid conflicts
    const originalPlayerScale = { x: player.scaleX, y: player.scaleY };

    // Create blood explosion first (behind player)
    // this.enemyManager.createPlayerDeathBlood(player);

    // Mark player as dying with visual effects
    this.playerManager.createPlayerDeathBlood();

    // Make sure player scale doesn't get modified by other effects
    player.setScale(originalPlayerScale.x, originalPlayerScale.y);

    // Get final stats
    const finalScore = this.ui.getScore(); // Money
    const killCount = this.ui.getKillCount();
    const accuracy = this.ui.getAccuracy();

    // Define a helper function to avoid duplicating code
    this.goToGameOverScene = (score, kills, acc) => {
      // Only transition if we're still in GameScene
      if (this.scene.isActive("MultiplayerGameScene")) {
        this.socket.close();
        this.registry.set("isGameStarted", false);
        this.scene.start("GameOverScene", {
          score: score,
          killCount: kills,
          accuracy: acc,
          isAuthenticated: false,
          highScore: 0,
          isMultiPlay: true,
        });
      }
    };

    // Remove any previous animation listeners to prevent duplicates
    player.off("animationcomplete");
    player.off("manual-death-complete");

    // Get the selected character
    const selectedCharacter = "default";

    // Set the animation prefix based on the selected character
    const animPrefix =
      selectedCharacter !== "default" ? `${selectedCharacter}_` : "";

    // Listen for standard animation completion
    player.on("animationcomplete", (animation) => {
      console.log("Player animation completed:", animation.key);
      if (animation.key === `${animPrefix}player_death`) {
        console.log(
          "Death animation completed, waiting 750ms before showing GIT GUD screen"
        );
        this.time.delayedCall(750, () => {
          this.showGitGudScreen(finalScore, killCount, accuracy);
        });
      }
    });

    // Listen for manual animation completion too
    player.on("manual-death-complete", () => {
      console.log(
        "Manual death animation completed, waiting 750ms before showing GIT GUD screen"
      );
      this.time.delayedCall(750, () => {
        this.showGitGudScreen(finalScore, killCount, accuracy);
      });
    });

    // Fallback timer in case both animation methods fail
    // Increased to 2550ms (1800ms + 750ms delay) to give the animation enough time to complete
    this.time.delayedCall(2550, () => {
      // Use our helper function to avoid code duplication
      if (this.scene.isActive("MultiplayerGameScene")) {
        console.log("Player death animation timed out, showing GIT GUD screen");
        this.showGitGudScreen(finalScore, killCount, accuracy);
      }
    });
  }

  // Show "GIT GUD" screen before the game over scene
  showGitGudScreen(finalScore, killCount, accuracy) {
    // Transition to game over after 333 milliseconds (same as GET HYPED duration)
    this.time.delayedCall(333, () => {
      // Go to game over scene with final stats
      this.goToGameOverScene(finalScore, killCount, accuracy);
    });
  }

  // Show floating text above a position
  showFloatingText(config) {
    const {
      x,
      y,
      text,
      color = "#ffffff",
      fontSize = 24,
      duration = 1500,
    } = config;

    // Create text
    const floatingText = this.add.text(x, y, text, {
      fontFamily: "Tektur",
      fontSize: `${fontSize}px`,
      color: color,
      stroke: "#000000",
      strokeThickness: 4,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#000000",
        blur: 3,
        fill: true,
      },
    });
    floatingText.setOrigin(0.5);
    floatingText.setDepth(1001); // Above other UI elements

    // Animation
    this.tweens.add({
      targets: floatingText,
      y: y - 100, // Float upward
      alpha: 0,
      scale: 1.5,
      duration: duration,
      ease: "Power2",
      onComplete: () => {
        floatingText.destroy();
      },
    });

    return floatingText;
  }

  // Handle when the player is damaged by an enemy
  handlePlayerDamage(playerId) {
    // Get player reference
    const player = this.playerManager.getPlayer();

    // If player is already dying or invincible, don't process damage
    if (player.isDying || player.isInvincible) {
      console.log("Player invincible or already dying, ignoring damage");
      return;
    }

    // Reduce player health
    this.playerManager.health -= 1;
    console.log(
      `Player took damage! Health: ${this.playerManager.health}/${this.playerManager.maxHealth}`
    );

    // Update the health display
    this.playerManager.updateHealthDisplay();

    // // Create blood splatter but don't trigger death animation
    // this.enemyManager.createPlayerBloodSplatter(player);

    // Create violent screen shake
    this.cameras.main.shake(500, 0.03);

    // Create red pulse overlay effect
    this.createRedPulseEffect();

    // If health is depleted, player dies
    if (this.playerManager.health <= 0) {
      this.socket.emit("playerDead", { playerId, roomId: this.roomId });
      this.handlePlayerDeath();
    } else {
      // Make player briefly invincible after taking damage
      player.isInvincible = true;

      // Send player damage event to server
      this.socket.emit("playerDamage", { playerId, roomId: this.roomId });
      // Flash player sprite to indicate damage and invincibility
      this.tweens.add({
        targets: player,
        alpha: 0.4,
        duration: 100,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          player.alpha = 1;
          // Remove invincibility after a short period
          this.time.delayedCall(500, () => {
            player.isInvincible = false;
          });
        },
      });
    }
  }

  showKillCountMessage(killCount) {
    // Ensure killCount is a valid number
    if (killCount === undefined || killCount === null || isNaN(killCount)) {
      console.error(
        "Invalid kill count passed to showKillCountMessage:",
        killCount
      );
      return;
    }

    // Convert to number to ensure consistent handling
    killCount = Number(killCount);

    // Special message for first kill
    if (killCount === 1) {
      this.showSurviveTextMessage("FIRST BLOOD!", false, killCount);
      return;
    }

    // Check milestone achievements with wider range checks to prevent skipping
    if (killCount >= 10 && killCount < 50 && !this.messageShownFlags[10]) {
      this.messageShownFlags[10] = true;
      this.showSurviveTextMessage("10 KILLS", false, 10);
    } else if (
      killCount >= 50 &&
      killCount < 100 &&
      !this.messageShownFlags[50]
    ) {
      this.messageShownFlags[50] = true;
      this.showSurviveTextMessage("50 KILLS", false, 50);
    } else if (
      killCount >= 100 &&
      killCount < 200 &&
      !this.messageShownFlags[100]
    ) {
      this.messageShownFlags[100] = true;
      this.showSurviveTextMessage("100 KILLS", false, 100);
    } else if (
      killCount >= 200 &&
      killCount < 300 &&
      !this.messageShownFlags[200]
    ) {
      this.messageShownFlags[200] = true;
      this.showSurviveTextMessage("200 KILLS", false, 200);
    } else if (
      killCount >= 300 &&
      killCount < 400 &&
      !this.messageShownFlags[300]
    ) {
      this.messageShownFlags[300] = true;
      this.showSurviveTextMessage("300 KILLS", false, 300);
    } else if (
      killCount >= 400 &&
      killCount < 500 &&
      !this.messageShownFlags[400]
    ) {
      this.messageShownFlags[400] = true;
      this.showSurviveTextMessage("400 KILLS", false, 400);
    } else if (
      killCount >= 500 &&
      killCount < 666 &&
      !this.messageShownFlags[500]
    ) {
      this.messageShownFlags[500] = true;
      this.showSurviveTextMessage("500 KILLS", false, 500);
    } else if (killCount >= 666 && !this.messageShownFlags[666]) {
      this.messageShownFlags[666] = true;
      this.showSurviveTextMessage("666 KILLS", false, 666);
    }
    // Remove the "else" case that was showing kill count for every kill
    // This prevents the constant "undefined kills" message
  }

  // Handle when a bullet hits an enemy
  handleBulletHitPlayer(bullet, player) {
    // Skip if enemy is already hit or destroyed
    // if (enemy.isHit) return;

    // // Pass the hit to enemy manager which will handle hit tracking and visual effects
    // this.enemyManager.hitEnemy(bullet, enemy, () => {
    //     // This callback is only run when the enemy is fully destroyed
    //     const newKillCount = this.ui.updateKillCount();

    //     this.showKillCountMessage(newKillCount);
    // });
    console.log("bullet playerId:", bullet.playerId);
    this.handlePlayerDamage(bullet.playerId);
  }

  update(time, delta) {
    // Update player (handles movement, shooting, animations)
    this.playerManager.update();

    // Update enemies (handles movement, animations)
    // this.enemyManager.update(this.playerManager.getPlayer());

    // Update time scale manager
    if (this.timeScaleManager) {
      this.timeScaleManager.update();
    }

    this.checkPlayerBulletsCollision();
    this.checkPlayerUpgradeBoxCollision();
    this.checkEnemyUpgradeBoxCollision();

    // Handle camera edge cases to prevent showing beyond the playable area
    this.updateCameraConstraints();
  }

  checkPlayerBulletsCollision() {
    // Get all active bullets
    const bullets = this.playerManager.getBullets().getChildren();
    const player = this.playerManager.getPlayer();

    // Check each bullet against each enemy player
    bullets.forEach((bullet) => {
      // Skip checking bullets fired by the same player
      if (bullet.playerId === this.playerId) {
        return;
      }

      // Get bullet position
      const bulletX = bullet.x;
      const bulletY = bullet.y;

      // Get player position
      const playerX = player.x;
      const playerY = player.y;

      // Calculate distance between bullet and player
      const dx = bulletX - playerX;
      const dy = bulletY - playerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Define collision radius (adjust as needed)
      const collisionRadius = 30;

      // Check if bullet is within collision radius
      if (distance < collisionRadius) {
        // Handle collision
        this.handleBulletHitPlayer(bullet, player);

        // Destroy the bullet
        bullet.destroy();
      }
    });
  }

  checkEnemyUpgradeBoxCollision() {
    // Get all active upgrade boxes
    const upgradeBoxes = this.droneManager.getUpgradeBoxes();
    const enemies = this.enemyManager.getEnemies();
    // console.log("upgradeBoxes:", upgradeBoxes);
    // console.log("enemies:", enemies);

    upgradeBoxes.forEach((upgradeBox) => {
      enemies.forEach((enemy) => {
        if (!upgradeBox.active) {
          return;
        }
        // Get upgradeBox position
        const upgradeBoxX = upgradeBox.x;
        const upgradeBoxY = upgradeBox.y;

        // Get enemy position
        const enemyX = enemy.player.x;
        const enemyY = enemy.player.y;

        // Calculate distance between upgradeBox and enemy
        const dx = upgradeBoxX - enemyX;
        const dy = upgradeBoxY - enemyY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Define collision radius (adjust as needed)
        const collisionRadius = 50;

        // Check if upgradeBox is within collision radius
        if (distance < collisionRadius && upgradeBox.isCollected != true) {
          upgradeBox.isCollected = true;
          console.log("upgradeBox collision detected for enemy");
          // Handle collision
          this.droneManager.applyUpgradeForEnemy(upgradeBox);
        }
      });
    });
  }

  checkPlayerUpgradeBoxCollision() {
    // Get all active upgrade boxes
    const upgradeBoxes = this.droneManager.getUpgradeBoxes();
    const player = this.playerManager.getPlayer();

    upgradeBoxes.forEach((upgradeBox) => {
      if (!upgradeBox.active) {
        return;
      }
      // Check upgradeBox position
      const upgradeBoxX = upgradeBox.x;
      const upgradeBoxY = upgradeBox.y;

      // Get player position
      const playerX = player.x;
      const playerY = player.y;

      // Calculate distance between upgradeBox and player
      const dx = upgradeBoxX - playerX;
      const dy = upgradeBoxY - playerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Define collision radius (adjust as needed)
      const collisionRadius = 50;

      // Check if upgradeBox is within collision radius
      if (distance < collisionRadius && upgradeBox.isCollected != true) {
        console.log("upgradeBox collision detected for player");
        // Handle collision
        this.handleCashCollection(player, upgradeBox);
      }
    });
  }
  // Handle socket event when another player starts the game
  handleSocketEvents() {
    if (!this.socket) {
      console.warn("Socket not initialized when setting up event handlers");
      return;
    }

    this.socket.on("playerStartedGame", (data) => {
      if (data.roomId != this.roomId) {
        return;
      }
      console.log("Received playerStartedGame event:", data);

      data.players.forEach((player) => {
        if (player.playerId != this.playerId) {
          this.enemyManager.addEnemy(player);
        }
      });
      // In single player mode, start game immediately
      this.startGameForAllPlayers();
      // Start game for all connected players when any player starts
    });

    this.socket.on("playerMoved", (data) => {
      // console.log('Received playerMoved event:', data);
      if (data.roomId != this.roomId) {
        return;
      }
      if (data.playerId != this.playerId) {
        this.enemyManager.updateEnemyMovenment(data);
      }
    });

    this.socket.on("playerDamaged", (data) => {
      if (data.roomId != this.roomId) {
        return;
      }
      console.log("Received player damage event:", data);
      if (data.playerId != this.playerId) {
        this.enemyManager.damageEnemy(data.playerId);
      }
    });

    this.socket.on("playerKilled", (data) => {
      if (data.roomId != this.roomId) {
        return;
      }
      console.log("Received player killed event:", data);
      if (data.playerId != this.playerId) {
        this.enemyManager.removeEnemy(data.playerId);
      }
      if (data.killedBy == this.playerId) {
        let existingAccount = this.registry.get("playerAccount");
        existingAccount.gameAccountBalance += this.roomId * 800;

        const localAccount = JSON.parse(localStorage.getItem("playerData"));
        localAccount.gameAccountBalance += this.roomId * 800;

        setCreditCount(
          existingAccount.authToken,
          existingAccount.gameAccountBalance
        );
        this.registry.set("playerAccount", existingAccount);
        localStorage.setItem("playerData", JSON.stringify(localAccount));

        this.ui.updateKillCount();
      }
    });

    this.socket.on("playerDisconnected", (data) => {
      console.log("Received playerDisconnected event:", data);
      this.enemyManager.removeEnemy(data.playerId);
    });
  }
}
