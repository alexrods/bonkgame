import { BULLET_TIME_SLOWDOWN } from "../../config.js";
import {
  forceStopAllEnemySpawning,
  forceStartAllEnemySpawning,
} from "../managers/EnemyManager.js";

export class DepositWithdrawPrompt {
  constructor(scene) {
    this.scene = scene;
    this.container = null;
    this.isVisible = false;
    this.onDepositCallback = null;
    this.onWithdrawCallback = null;
    this.onCancelCallback = null;
    this.onChaincreditBalance = 0; // Mock Solana balance (in SOL)
    this.onChaincreditBalanceText = null;
    this.gameAccountBalance = 0;
    this.gameAccountBalanceText = null;
    this.promptMode = "main"; // 'main', 'wallet-to-game', 'game-to-arena', or 'waiting'
    this.waitingContainer = null; // Container for the waiting screen
    this.isWaiting = false; // Flag to track if waiting screen is shown
    this.backgroundBlocker = null; // Elemento para bloquear interacciones con el fondo
  }

  create() {
    // Create the container
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1050); // Higher than DroneWheel

    // Create the waiting screen container (initially hidden)
    this.waitingContainer = this.scene.add.container(0, 0);
    this.waitingContainer.setDepth(1060); // Even higher than main container
    this.waitingContainer.setVisible(false);

    // Add an update callback to make the UI follow the camera
    this.updateEvent = this.scene.time.addEvent({
      delay: 16,
      callback: this.update,
      callbackScope: this,
      loop: true,
    });

    // Create the waiting screen
    this.createWaitingScreen();

    // Listen for arena and game account and BONK balance update events
    this.scene.events.on(
      "arenaBalanceUpdated",
      this.updateArenaBalanceDisplay,
      this
    );
    this.scene.events.on(
      "gameAccountUpdated",
      this.updateGameAccountDisplay,
      this
    );
    this.scene.events.on(
      "bonkBalanceUpdated",
      this.updateBonkBalanceDisplay,
      this
    );

    // Create background overlay
    const bg = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.7
    );
    this.container.add(bg);
    
    // Crear un bloqueador de interacción para el fondo
    this.backgroundBlocker = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width * 2, // Hacerlo extra grande para cubrir toda la pantalla
      this.scene.cameras.main.height * 2,
      0x000000,
      0.01 // Casi transparente
    );
    this.backgroundBlocker.setInteractive();
    this.backgroundBlocker.on('pointerdown', (pointer) => {
      // Consumir el evento para evitar que llegue a elementos del fondo
      pointer.event.stopPropagation();
    });
    this.container.add(this.backgroundBlocker);

    // Create main content container that will hold all UI elements except scanlines
    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    // Create panel background (wide terminal style screen) - tighter height
    const panel = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      500,
      280, // Reduced height
      0x000000,
      0.95
    );
    panel.setStrokeStyle(2, 0x00ff00);
    this.contentContainer.add(panel);

    // Add header text - will only be visible in game scene
    const headerText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 110,
      "CUSTOM TERMINAL FIRMWARE VERSION 69.420-247",
      {
        fontFamily: "Tektur",
        fontSize: "14px",
        color: "#00ff00",
        align: "center",
      }
    );
    headerText.setOrigin(0.5);
    this.contentContainer.add(headerText);
    this.headerText = headerText;

    // Add title - position will depend on scene, moved down to make room for cancel button
    const title = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 125, // Moved down to make room for cancel button
      "WALLET OPERATIONS",
      {
        fontFamily: "Tektur",
        fontSize: "24px",
        color: "#00ff00",
        align: "center",
        fontStyle: "bold",
      }
    );
    title.setOrigin(0.5);
    this.contentContainer.add(title);

    // Store the title text object for later updates
    this.titleText = title;

    // Add game logo with green tint instead of subtitle text - moved between title and buttons
    this.logoImage = this.scene.add.image(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      "game_logo"
    );
    this.logoImage.setScale(0.12); // Scale the logo to smaller size
    this.logoImage.setOrigin(0.5);
    this.logoImage.setTint(0x00ff00); // Apply green tint to match terminal style
    this.contentContainer.add(this.logoImage); // Add to content container to place behind scanlines

    // Virus images removed

    // Create scanlines effect limited to panel area (on top of everything)
    const scanlines = this.createScanlines(panel);
    this.container.add(scanlines);

    // Keep the subtitleText variable for compatibility but make it invisible
    this.subtitleText = this.scene.add.text(0, 0, "", { fontSize: "1px" });
    this.subtitleText.setVisible(false);

    // Create placeholder variables to prevent errors elsewhere in the code
    this.onChaincreditBalanceText = this.scene.add.text(0, 0, "", {
      fontSize: "1px",
    });
    this.onChaincreditBalanceText.setVisible(false);

    this.gameAccountBalanceText = this.scene.add.text(0, 0, "", {
      fontSize: "1px",
    });
    this.gameAccountBalanceText.setVisible(false);

    this.arenaBalanceText = this.scene.add.text(0, 0, "", { fontSize: "1px" });
    this.arenaBalanceText.setVisible(false);

    this.bonkBalanceText = this.scene.add.text(0, 0, "", { fontSize: "1px" });
    this.bonkBalanceText.setVisible(false);

    // Create main screen buttons container
    this.mainButtonsContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.mainButtonsContainer); // Add to content container to put behind scanlines

    // Create wallet-to-game buttons container
    this.walletToGameButtonsContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.walletToGameButtonsContainer); // Add to content container to put behind scanlines
    this.walletToGameButtonsContainer.setVisible(false);

    // Create game-to-arena buttons container
    this.gameToArenaButtonsContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.gameToArenaButtonsContainer); // Add to content container to put behind scanlines
    this.gameToArenaButtonsContainer.setVisible(false);

    // ---- MAIN MENU BUTTONS ---- (side by side)

    // Create YES button - starts rhythm hack game (positioned left)
    this.createButton(
      "YES",
      this.scene.cameras.main.width / 2 - 120,
      this.scene.cameras.main.height / 2 + 80,
      () => {
        this.handleWithdraw();
      },
      this.mainButtonsContainer
    );

    // Create NO button (positioned right)
    this.createButton(
      "NO",
      this.scene.cameras.main.width / 2 + 120,
      this.scene.cameras.main.height / 2 + 80,
      () => {
        this.performImmediateGameStateRestoration();
        this.hide();
        if (this.onCancelCallback) {
          this.onCancelCallback();
        }
      },
      this.mainButtonsContainer,
      true
    ); // Pass true to indicate this is a cancel button

    // ---- WALLET TO GAME BUTTONS ----

    // Create deposit options for wallet to game - pushed down to accommodate higher cancel button
    this.createButton(
      "DEPOSIT 100K 🅒",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 60,
      () => {
        this.handleWalletToGameDeposit(100000);
      },
      this.walletToGameButtonsContainer
    );

    this.createButton(
      "DEPOSIT 250K 🅒",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      () => {
        this.handleWalletToGameDeposit(250000);
      },
      this.walletToGameButtonsContainer
    );  

    this.createButton(
      "DEPOSIT 500K 🅒",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 + 60,
      () => {
        this.handleWalletToGameDeposit(500000);
      },
      this.walletToGameButtonsContainer
    );

    // Create withdraw button to switch to game-to-wallet mode
    this.createButton(
      "WITHDRAW",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 + 120,
      () => {
        this.switchToGameToWalletMode();
      },
      this.walletToGameButtonsContainer
    );

    // Create back button for wallet to game - moved higher in top right corner with padding
    const cancelButton = this.createButton(
      "CANCEL",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 + 180,
      () => {
        this.performImmediateGameStateRestoration();
        this.hide();
        if (this.onCancelCallback) {
          this.onCancelCallback();
        }
      },
      this.walletToGameButtonsContainer,
      true
    ); // Pass true to indicate this is a cancel button

    // ---- GAME TO WALLET BUTTONS ----

    // Create a new container for game to wallet options
    this.gameToWalletButtonsContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.gameToWalletButtonsContainer); // Add to content container to put behind scanlines
    this.gameToWalletButtonsContainer.setVisible(false);

    // Create withdraw options for game to wallet - pushed down to accommodate higher cancel button
    this.createButton(
      "WITHDRAW CREDITS 🅒",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 60,
      () => {
        // Llamar a withdrawFromGameAccount sin parámetro para retirar todo
        this.handleGameToWalletWithdraw();
      },
      this.gameToWalletButtonsContainer
    );

    this.createButton(
      "WITHDRAW BONKS",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      () => {
        // call withdrawBonk with null amount to withdraw all bonks
        this.handleGameToWalletWithdrawBonk();
      },
      this.gameToWalletButtonsContainer
    );

    // Create back button for game to wallet - higher in top right corner with padding
    this.createButton(
      "BACK",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 + 120,
      () => {
        this.switchToWalletToGameMode();
      },
      this.gameToWalletButtonsContainer,
      true
    ); // Pass true to indicate this is a cancel button

    // ---- GAME TO ARENA BUTTONS ----

    // Create deposit options for game to arena - pushed down to accommodate higher cancel button
    this.createButton(
      "DEPOSIT 100 🅒",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 60,
      () => {
        this.handleGameToArenaDeposit(100000);
      },
      this.gameToArenaButtonsContainer
    );

    this.createButton(
      "DEPOSIT 250 🅒",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      () => {
        this.handleGameToArenaDeposit(250000);
      },
      this.gameToArenaButtonsContainer
    );

    this.createButton(
      "DEPOSIT 500 🅒",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 + 60,
      () => {
        this.handleGameToArenaDeposit(500000);
      },
      this.gameToArenaButtonsContainer
    );

    // Create back button for game to arena - higher in top right corner with padding
    this.createButton(
      "BACK",
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 + 120,
      () => {
        this.switchToMainMenu();
      },
      this.gameToArenaButtonsContainer,
      true
    ); // Pass true to indicate this is a cancel button

    // Hide initially
    this.container.setAlpha(0);
    this.container.setVisible(false);
  }

  async getOnchainGameAccountBalance() {
    // Get balance from PlayerAccount if available
    if (this.scene.playerAccount) {
      return await this.scene.playerAccount.wallet.getCreditBalance();
    }
    return 0;
  }

  getGameAccountBalance() {
    // Get balance from PlayerAccount if available
    if (this.scene.playerAccount) {
      return this.scene.playerAccount.getGameAccountBalance();
    }
    return 0;
  }

  getArenaBalance() {
    // Get balance from UI component
    if (this.scene.ui) {
      return this.scene.ui.getMoney();
    }
    return 0;
  }

  getBonkBalance() {
    // Get bonk balance from PlayerAccount if available
    if (this.scene.playerAccount) {
      return this.scene.playerAccount.getBonkBalance();
    }
    return 0;
  }

  updateBalanceDisplays() {
    // This function is intentionally simplified since we no longer display balances
    // It's kept for compatibility with existing code that calls it
    try {
      // Check if the container exists before attempting to update
      if (!this.container || !this.container.active) {
        console.warn(
          "DepositWithdrawPrompt: Container not active, skipping balance update"
        );
        return;
      }

      // No balance displays to update
    } catch (error) {
      console.error("Error updating balance displays:", error);
    }
  }

  switchToMainMenu() {
    try {
      this.promptMode = "main";

      // Check if the container and scene still exist
      if (!this.container || !this.container.active || !this.scene) {
        console.warn(
          "DepositWithdrawPrompt: Container not active or scene not available, skipping menu switch"
        );
        return;
      }

      // Check if we're in the MenuScene (for wallet-to-game deposits)
      // or in the GameScene (for BONK token mini-game)
      const isMenuScene = this.scene.scene.key === "MenuScene";

      if (isMenuScene) {
        // In menu scene, only show wallet-to-game options
        if (this.titleText) {
          this.titleText.setText("WALLET OPERATIONS");
          // Position title lower to make room for cancel button
          this.titleText.y = this.scene.cameras.main.height / 2 - 125;
        }

        // Hide firmware text in menu scene
        if (this.headerText) this.headerText.setVisible(false);

        // Hide logo in wallet mode
        if (this.logoImage) this.logoImage.setVisible(false);

        // Show wallet buttons only
        if (this.mainButtonsContainer)
          this.mainButtonsContainer.setVisible(false);
        if (this.walletToGameButtonsContainer)
          this.walletToGameButtonsContainer.setVisible(true);
        if (this.gameToArenaButtonsContainer)
          this.gameToArenaButtonsContainer.setVisible(false);
        if (this.gameToWalletButtonsContainer)
          this.gameToWalletButtonsContainer.setVisible(false);
      } else {
        // In game scene, show hack interface
        if (this.titleText) {
          this.titleText.setText("ATTEMPT NETWORK HACK?");
          // Position title inside panel for game scene
          this.titleText.y = this.scene.cameras.main.height / 2 - 80;
        }

        // Show firmware text in game scene
        if (this.headerText) this.headerText.setVisible(true);

        // Show logo in hack mode
        if (this.logoImage) this.logoImage.setVisible(true);

        // Show main buttons only
        if (this.mainButtonsContainer)
          this.mainButtonsContainer.setVisible(true);
        if (this.walletToGameButtonsContainer)
          this.walletToGameButtonsContainer.setVisible(false);
        if (this.gameToArenaButtonsContainer)
          this.gameToArenaButtonsContainer.setVisible(false);
        if (this.gameToWalletButtonsContainer)
          this.gameToWalletButtonsContainer.setVisible(false);
      }

      // Update balance displays - wrapped in try-catch in its own method
      this.updateBalanceDisplays();
    } catch (error) {
      console.error("Error in switchToMainMenu:", error);
    }
  }

  switchToWalletToGameMode() {
    this.promptMode = "wallet-to-game";
    this.subtitleText.setText("WALLET TO GAME DEPOSIT");

    // Show wallet to game buttons, hide other button containers
    this.mainButtonsContainer.setVisible(false);
    this.walletToGameButtonsContainer.setVisible(true);
    this.gameToArenaButtonsContainer.setVisible(false);
    this.gameToWalletButtonsContainer.setVisible(false);

    // Update balance displays
    this.updateBalanceDisplays();
  }

  switchToGameToWalletMode() {
    this.promptMode = "game-to-wallet";
    this.subtitleText.setText("GAME TO WALLET WITHDRAW");

    // Show game to wallet buttons, hide other button containers
    this.mainButtonsContainer.setVisible(false);
    this.walletToGameButtonsContainer.setVisible(false);
    this.gameToArenaButtonsContainer.setVisible(false);
    this.gameToWalletButtonsContainer.setVisible(true);

    // Update balance displays
    this.updateBalanceDisplays();
  }

  switchToGameToArenaMode() {
    this.promptMode = "game-to-arena";
    this.subtitleText.setText("GAME TO ARENA DEPOSIT");

    // Show game to arena buttons, hide other button containers
    this.mainButtonsContainer.setVisible(false);
    this.walletToGameButtonsContainer.setVisible(false);
    this.gameToArenaButtonsContainer.setVisible(true);
    this.gameToWalletButtonsContainer.setVisible(false);

    // Update balance displays
    this.updateBalanceDisplays();
  }

  createButton(text, x, y, callback, container, isCancel = false) {
    // Larger, bolder buttons with styling based on button type
    const isYesButton = text === "YES";
    const isNoButton = text === "NO";

    // Button styling (default green or red for cancel/back buttons)
    let fillColor,
      strokeColor,
      textColor,
      hoverFillColor,
      hoverTextColor,
      clickFillColor;

    if (isCancel || text === "CANCEL" || text === "BACK" || isNoButton) {
      // Red styling for cancel/back buttons
      fillColor = 0x330000; // Darker red background
      strokeColor = 0xff0000; // Red border
      textColor = "#ff0000"; // Red text
      hoverFillColor = 0x550000; // Slightly brighter red on hover
      hoverTextColor = "#ff3333"; // Brighter red text on hover
      clickFillColor = 0x770000; // Even brighter red on click
    } else {
      // Green styling for regular buttons
      fillColor = 0x003300; // Darker green background
      strokeColor = 0x00ff00; // Bright green border
      textColor = "#00ff00"; // Green text
      hoverFillColor = 0x005500; // Slightly brighter green on hover
      hoverTextColor = "#33ff33"; // Brighter green text on hover
      clickFillColor = 0x007700; // Even brighter green on click
    }

    // Create button with appropriate size and styling - wider for terminal look
    const button = this.scene.add.rectangle(x, y, 220, 36, fillColor);
    button.setInteractive();
    button.setStrokeStyle(2, strokeColor);

    const buttonText = this.scene.add.text(x, y, text, {
      fontFamily: "Tektur",
      fontSize: "18px",
      color: textColor,
      align: "center",
      fontStyle: "bold",
    });
    buttonText.setOrigin(0.5);

    // Add hover effect
    button.on("pointerover", () => {
      button.setFillStyle(hoverFillColor);
      buttonText.setColor(hoverTextColor);
    });

    button.on("pointerout", () => {
      button.setFillStyle(fillColor); // Back to original color
      buttonText.setColor(textColor);
    });

    // Add click effect
    button.on("pointerdown", () => {
      button.setFillStyle(clickFillColor);
      buttonText.setColor("#ffffff"); // White text on click
    });

    button.on("pointerup", () => {
      button.setFillStyle(hoverFillColor); // Back to hover color
      buttonText.setColor(hoverTextColor); // Back to hover text color
      if (callback) callback();
    });

    if (container) {
      container.add(button);
      container.add(buttonText);
    } else {
      this.container.add(button);
      this.container.add(buttonText);
    }

    return { button, text: buttonText };
  }

  show(depositCallback, withdrawCallback, cancelCallback) {
    try {
      // Safety check for container and scene
      if (!this.container || !this.container.active || !this.scene) {
        console.error(
          "Cannot show DepositWithdrawPrompt: Container not active or scene not available"
        );
        return;
      }

      this.isVisible = true;
      this.onDepositCallback = depositCallback;
      this.onWithdrawCallback = withdrawCallback;
      this.onCancelCallback = cancelCallback;
      
      // Asegurar que el bloqueador de fondo esté activo y al frente
      if (this.backgroundBlocker) {
        this.backgroundBlocker.setVisible(true);
        // Mover el bloqueador al frente del contenedor
        this.container.bringToTop(this.backgroundBlocker);
        // Luego mover el contenido por encima del bloqueador
        if (this.contentContainer) {
          this.container.bringToTop(this.contentContainer);
        }
      }

      // Use multiple approaches to ensure enemy spawning is stopped

      // 1. Use global emergency function (most reliable)
      forceStopAllEnemySpawning();

      // 2. Emit event (for additional safety/redundancy)
      this.scene.events.emit("depositPromptOpened");

      // 3. Direct scene event trigger if available
      if (this.scene.events) {
        this.scene.events.emit("forceStopSpawning");
      }

      // Check if we're in the MenuScene
      const isMenuScene = this.scene.scene.key === "MenuScene";

      // Update the prompt based on the scene
      if (this.titleText) {
        if (isMenuScene) {
          this.titleText.setText("WALLET OPERATIONS");
          // Position title lower to make room for cancel button
          this.titleText.y = this.scene.cameras.main.height / 2 - 125;

          // Hide firmware text in menu scene
          if (this.headerText) this.headerText.setVisible(false);

          // Hide logo in wallet mode
          if (this.logoImage) this.logoImage.setVisible(false);
        } else {
          this.titleText.setText("ATTEMPT NETWORK HACK?");
          // Position title inside panel for game scene
          this.titleText.y = this.scene.cameras.main.height / 2 - 80;

          // Show firmware text in game scene
          if (this.headerText) this.headerText.setVisible(true);

          // Show logo in hack mode
          if (this.logoImage) this.logoImage.setVisible(true);
        }
      } else {
        console.warn("DepositWithdrawPrompt: titleText not available");
      }

      // Only disable player controls if not in MenuScene
      if (!isMenuScene && this.scene.playerManager) {
        console.log(
          "DepositWithdrawPrompt: FORCIBLY disabling player controls"
        );
        this.scene.playerManager.controlsEnabled = false;

        // Force stop player movement immediately
        if (this.scene.playerManager.player) {
          this.scene.playerManager.player.setVelocity(0, 0);
        }
      }

      // Temporarily disable button interactivity to prevent touch event bleed-through
      // This helps prevent the same touch that opened the menu from triggering a deposit option
      if (this.container.active) {
        this.disableButtonsTemporarily();
      }

      // Switch to main menu view
      this.switchToMainMenu();

      // Check if we're already in the drone wheel - only in game scene
      const comingFromWheel =
        !isMenuScene &&
        this.scene.droneWheel &&
        this.scene.droneWheel.openingAtmFromWheel;

      // Store time scales in game scene only
      if (!isMenuScene) {
        // Always store time scales regardless of where we're coming from
        // This ensures we restore to the correct state later
        this.previousTimeScale = this.scene.time.timeScale;
        this.previousAnimsTimeScale = this.scene.anims.globalTimeScale;
        this.previousPhysicsTimeScale = this.scene.physics.world.timeScale;

        // If coming from wheel, ensure we wait for the next frame before applying time scales
        if (comingFromWheel) {
          console.log(
            "DepositWithdrawPrompt: Coming from wheel, ensuring time scale sync"
          );
          this.scene.time.delayedCall(10, () => {
            if (this.scene.timeScaleManager) {
              // Force time scale to match drone wheel first, then apply ATM slowdown
              this.scene.timeScaleManager.activeTimeEffects.droneWheel = true;
              this.scene.timeScaleManager.updateTimeScales();
            }
          });
        }

        // Apply time scaling effects in game scene only
        if (this.scene.timeScaleManager) {
          console.log("DepositWithdrawPrompt show: Setting up time scaling");

          // Always store enemy speeds if not already stored
          if (
            !this.scene.timeScaleManager.enemiesWithStoredSpeeds ||
            this.scene.timeScaleManager.enemiesWithStoredSpeeds.length === 0
          ) {
            console.log("DepositWithdrawPrompt show: Storing enemy speeds");
            this.scene.timeScaleManager.storeEnemySpeeds();
          }

          // Set player as exempt from time scaling
          this.scene.timeScaleManager.exemptEntities.player = true;
          this.scene.timeScaleManager.exemptEntities.playerBullets = true;
          this.scene.timeScaleManager.exemptEntities.playerReload = true;

          // Force apply the slowdown effect for the BONK TERMINAL menu
          console.log(
            "DepositWithdrawPrompt show: Forcefully slowing down enemies for BONK TERMINAL"
          );

          // Always call both methods to ensure proper enemy slowdown
          this.scene.timeScaleManager.storeEnemySpeeds();

          // For rhythm game / ATM, we need to ensure any existing time effects are properly transitioned
          if (comingFromWheel) {
            console.log(
              "DepositWithdrawPrompt: Transitioning from drone wheel to rhythm game time effect"
            );
            // Explicitly deactivate drone wheel first to prevent conflicts
            this.scene.timeScaleManager.deactivateDroneWheelTime();
            // Then activate rhythm game with a small delay to ensure clean state transition
            this.scene.time.delayedCall(15, () => {
              this.scene.timeScaleManager.activateRhythmGameTime();

              // Ensure controls remain disabled during state transition
              if (this.scene.playerManager && this.isVisible) {
                this.scene.playerManager.controlsEnabled = false;
              }
            });
          } else {
            // Normal case - just activate rhythm game directly
            this.scene.timeScaleManager.activateRhythmGameTime();
          }

          // Force immediate application of the slowdown to enemies
          if (this.scene.enemyManager && this.scene.enemyManager.getEnemies) {
            const enemies = this.scene.enemyManager.getEnemies().getChildren();
            if (enemies && enemies.length > 0) {
              console.log(
                `DepositWithdrawPrompt: Directly slowing down ${enemies.length} enemies`
              );
              enemies.forEach((enemy) => {
                if (enemy.body && enemy.body.velocity) {
                  // Apply slower 5% speed for deposit menu (slower than rhythm game)
                  // The actual rhythm minigame will use a different time scale via TimeScaleManager
                  enemy.body.velocity.x *= 0.05;
                  enemy.body.velocity.y *= 0.05;
                }
                if (enemy.anims) {
                  enemy.anims.timeScale = 0.05;
                }
                if (enemy.speed !== undefined) {
                  enemy.speed *= 0.05;
                }
              });
            }
          }

          // Force immediate update of time manager
          this.scene.timeScaleManager.updateTimeScales();
        } else if (this.scene.time.timeScale > BULLET_TIME_SLOWDOWN) {
          // Apply directly if no manager available
          console.log(
            "DepositWithdrawPrompt show: No TimeScaleManager, setting time scale directly"
          );
          this.scene.time.timeScale = BULLET_TIME_SLOWDOWN;
          this.scene.physics.world.timeScale = BULLET_TIME_SLOWDOWN;
          this.scene.anims.globalTimeScale = BULLET_TIME_SLOWDOWN;
        }

        // Pause enemies in game scene only
        if (this.scene.enemyManager) {
          // Use the enemyManager's setPaused method which properly handles timers
          this.scene.enemyManager.setPaused(true);

          // Direct access to enemy spawner as an additional safety measure
          if (this.scene.enemyManager.spawner) {
            console.log(
              "DepositWithdrawPrompt: Directly pausing enemy spawner"
            );

            // Call pauseSpawning method if available
            if (
              typeof this.scene.enemyManager.spawner.pauseSpawning ===
              "function"
            ) {
              this.scene.enemyManager.spawner.pauseSpawning();
            }

            // Also directly pause the timers
            if (this.scene.enemyManager.spawner.enemySpawnTimer) {
              this.scene.enemyManager.spawner.enemySpawnTimer.paused = true;
            }
            if (this.scene.enemyManager.spawner.waveTimer) {
              this.scene.enemyManager.spawner.waveTimer.paused = true;
            }
          }
        }

        // Redundant control disable just to be safe in game scene only
        if (this.scene.playerManager) {
          this.scene.playerManager.controlsEnabled = false;
        }

        // Store and pause projectiles in game scene only
        if (this.scene.projectiles) {
          this.projectilesState = [];
          this.scene.projectiles.getChildren().forEach((projectile) => {
            this.projectilesState.push({
              obj: projectile,
              velX: projectile.body.velocity.x,
              velY: projectile.body.velocity.y,
            });
            projectile.body.setVelocity(0, 0);
          });
        }
      }

      // Follow camera instead of centering in the world
      const camera = this.scene.cameras.main;
      // Position the container so it's centered on the camera view, not the world
      this.container.setPosition(camera.scrollX, camera.scrollY);

      // Make visible
      this.container.setVisible(true);

      // Fade in
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: 200,
        ease: "Power2",
      });

      // Setup escape key to close
      this.escKey = this.scene.input.keyboard.addKey("ESC");
      this.escKey.once("down", () => {
        console.log(
          "DepositWithdrawPrompt: ESC pressed - forcing immediate control restoration"
        );

        // Force immediate game state restoration for better responsiveness (unless in MenuScene)
        if (!isMenuScene) {
          this.performImmediateGameStateRestoration();
        }

        // Hide the prompt
        this.hide();

        // Then call the callback
        if (this.onCancelCallback) {
          this.onCancelCallback();
        }
      });

      // Set a safety timeout to ensure controls remain disabled (unless in MenuScene)
      if (!isMenuScene) {
        this.controlSafetyInterval = setInterval(() => {
          if (this.isVisible && this.scene && this.scene.playerManager) {
            this.scene.playerManager.controlsEnabled = false;
          } else {
            // Clear interval if no longer visible
            clearInterval(this.controlSafetyInterval);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error showing DepositWithdrawPrompt:", error);
    }
  }

  hide(goingToRhythmGame = false) {
    if (!this.isVisible) return;

    this.isVisible = false;

    // If waiting screen is visible, hide it as well
    if (this.isWaiting && this.waitingContainer) {
      this.waitingContainer.setVisible(false);
      this.isWaiting = false;
    }
    
    // Hide the background blocker
    if (this.backgroundBlocker) {
      this.backgroundBlocker.setVisible(false);
    }

    // Only restart enemy spawning if not transitioning to rhythm game
    if (!goingToRhythmGame) {
      // Use multiple approaches to ensure enemy spawning is restarted

      // 1. Use global emergency function (most reliable)
      forceStartAllEnemySpawning();

      // 2. Emit event (for additional safety/redundancy)
      this.scene.events.emit("depositPromptClosed");

      // 3. Direct scene event trigger if available
      if (this.scene.events) {
        this.scene.events.emit("forceStartSpawning");
      }
    }

    // Check if we're in the MenuScene
    const isMenuScene = this.scene.scene.key === "MenuScene";

    // Clear the safety interval immediately (if it exists)
    if (this.controlSafetyInterval) {
      clearInterval(this.controlSafetyInterval);
      this.controlSafetyInterval = null;
    }

    // Skip game-specific logic if we're in the menu scene
    if (isMenuScene) {
      // Fade out only with no complex game state restoration
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 200,
        ease: "Power2",
        onComplete: () => {
          this.container.setVisible(false);
        },
      });

      // Remove escape key listener
      if (this.escKey) {
        this.escKey.removeAllListeners();
      }

      return;
    }

    // Game scene specific logic below

    // Check if we're in the drone wheel
    const comingFromWheel =
      this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;

    // Add flag to track if we're transitioning to rhythm game
    this.transitioningToRhythmGame = goingToRhythmGame;

    // Before starting fade out, make synchronous state changes for player controls
    // This ensures controls are properly set regardless of animation timing
    if (!comingFromWheel) {
      // If not coming from wheel, re-enable player controls immediately
      if (this.scene.playerManager) {
        console.log(
          "DepositWithdrawPrompt hide: Synchronously re-enabling player controls"
        );
        this.scene.playerManager.controlsEnabled = true;
      }
    } else {
      // If coming from wheel, ensure controls remain disabled
      if (this.scene.playerManager) {
        console.log(
          "DepositWithdrawPrompt hide: Coming from wheel, keeping controls disabled"
        );
        this.scene.playerManager.controlsEnabled = false;
      }
    }

    // Fade out
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: "Power2",
      onComplete: () => {
        this.container.setVisible(false);

        // Check if we're transitioning to rhythm game - if so, don't reset time scales yet
        if (this.transitioningToRhythmGame) {
          console.log(
            "DepositWithdrawPrompt: Transitioning to rhythm game, preserving 5% time scale"
          );
          // Keep rhythm game time effect active
          if (this.scene.timeScaleManager) {
            this.scene.timeScaleManager.activeTimeEffects.rhythmGame = true;

            // Make sure player stays exempt from time scaling
            this.scene.timeScaleManager.exemptEntities.player = true;
            this.scene.timeScaleManager.exemptEntities.playerBullets = true;
            this.scene.timeScaleManager.exemptEntities.playerReload = true;

            // Update time scales to ensure they stay applied
            this.scene.timeScaleManager.updateTimeScales();
          }
        } else {
          // Normal case - restore previous time scales
          console.log(
            `DepositWithdrawPrompt restoring time scales: game=${this.previousTimeScale}, physics=${this.previousPhysicsTimeScale}, anims=${this.previousAnimsTimeScale}`
          );

          // Restore time scales - use TimeScaleManager if available
          if (this.scene.timeScaleManager) {
            // Make sure to deactivate rhythm game time effect first
            if (this.scene.timeScaleManager.activeTimeEffects.rhythmGame) {
              console.log(
                "DepositWithdrawPrompt: Deactivating rhythm game time effect"
              );
              this.scene.timeScaleManager.deactivateRhythmGameTime();
            }

            // Check if we're still coming from wheel
            if (comingFromWheel) {
              console.log(
                "DepositWithdrawPrompt: Coming from wheel, activating drone wheel time"
              );
              // If coming from wheel, make sure to restore wheel time effect
              this.scene.timeScaleManager.activateDroneWheelTime();
            } else {
              // Not coming from wheel - do full reset
              console.log(
                "DepositWithdrawPrompt: Not coming from wheel, doing full reset"
              );

              // Remove player exemptions if we're not coming from wheel
              if (!this.scene.timeScaleManager.activeTimeEffects.bulletTime) {
                this.scene.timeScaleManager.exemptEntities.player = false;
                this.scene.timeScaleManager.exemptEntities.playerBullets = false;
                this.scene.timeScaleManager.exemptEntities.playerReload = false;
              }

              // Always force restore enemy speeds to make sure they're properly reset
              console.log(
                "DepositWithdrawPrompt: Forcing enemy speed restoration"
              );
              this.scene.timeScaleManager.restoreEnemySpeeds();

              // Force immediate update to ensure all time effects are applied
              this.scene.timeScaleManager.updateTimeScales();
            }
          }
        }

        if (!this.scene.timeScaleManager) {
          // Restore directly if no manager available
          this.scene.time.timeScale = this.previousTimeScale || 1;
          this.scene.anims.globalTimeScale = this.previousAnimsTimeScale || 1;
          this.scene.physics.world.timeScale =
            this.previousPhysicsTimeScale || this.previousTimeScale || 1;
        }

        // Handle game object pausing based on context
        if (this.transitioningToRhythmGame) {
          // Keep enemies paused when transitioning to rhythm game
          if (this.scene.enemyManager) {
            console.log(
              "DepositWithdrawPrompt: Keeping enemies paused during transition to rhythm game"
            );
            this.scene.enemyManager.paused = true;
          }

          // Keep player controls disabled during rhythm game
          if (this.scene.playerManager) {
            this.scene.playerManager.controlsEnabled = false;
          }

          // Don't restore projectile velocities yet
        } else if (comingFromWheel) {
          // If coming from wheel, keep enemies paused but let wheel handle
          // the final unpausing when wheel is closed
          if (this.scene.enemyManager) {
            this.scene.enemyManager.paused = true; 
          }

          // Controls should already be set appropriately above in the synchronous section

          // Don't restore projectile velocities yet, the wheel will handle that
        } else {
          // Normal case - unpause game objects
          if (this.scene.enemyManager) {
            // Use the enemyManager's setPaused method which properly handles timers
            this.scene.enemyManager.setPaused(false);

            // Direct access to enemy spawner as an additional safety measure
            if (this.scene.enemyManager.spawner) {
              console.log(
                "DepositWithdrawPrompt: Directly resuming enemy spawner"
              );

              // Call resumeSpawning method if available
              if (
                typeof this.scene.enemyManager.spawner.resumeSpawning ===
                "function"
              ) {
                this.scene.enemyManager.spawner.resumeSpawning();
              }

              // Also directly resume the timers
              if (this.scene.enemyManager.spawner.enemySpawnTimer) {
                this.scene.enemyManager.spawner.enemySpawnTimer.paused = false;
              }
              if (this.scene.enemyManager.spawner.waveTimer) {
                this.scene.enemyManager.spawner.waveTimer.paused = false;
              }
            }
          }

          // Controls should already be set appropriately above in the synchronous section,
          // but we'll set it again here to be extra safe
          if (this.scene.playerManager) {
            this.scene.playerManager.controlsEnabled = true;
          }

          // Restore projectile velocities if any were stored
          if (this.projectilesState && this.projectilesState.length > 0) {
            this.projectilesState.forEach((pState) => {
              if (pState.obj && pState.obj.active) {
                pState.obj.body.setVelocity(pState.velX, pState.velY);
              }
            });
            this.projectilesState = [];
          }

          // Schedule multiple attempts to restore control with increasing delays
          this.forceMultipleControlRestoration();
        }
      },
    });

    // Remove escape key listener
    if (this.escKey) {
      this.escKey.removeAllListeners();
    }
  }

  /**
   * Force immediate game state restoration
   * This method immediately restores all game state without waiting for animations
   */
  performImmediateGameStateRestoration() {
    console.log(
      "DepositWithdrawPrompt: Performing immediate game state restoration"
    );

    // Check if we're coming from the wheel to handle that case specially
    const comingFromWheel =
      this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;

    // Reset wheel flag immediately if needed
    if (comingFromWheel) {
      console.log(
        "DepositWithdrawPrompt: Resetting openingAtmFromWheel flag immediately"
      );
      this.scene.droneWheel.openingAtmFromWheel = false;
    }

    // Force time scales to normal
    if (this.scene.time) {
      this.scene.time.timeScale = 1.0;
    }
    if (this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.timeScale = 1.0;
    }
    if (this.scene.anims) {
      this.scene.anims.globalTimeScale = 1.0;
    }

    // Force player controls enabled immediately
    if (this.scene.playerManager) {
      console.log("DepositWithdrawPrompt: FORCIBLY enabling player controls");
      this.scene.playerManager.controlsEnabled = true;

      // Force player to stop moving to prevent unexpected movement
      if (
        this.scene.playerManager.player &&
        this.scene.playerManager.player.body
      ) {
        this.scene.playerManager.player.setVelocity(0, 0);
      }
    }

    // Force enemies unpaused immediately
    if (this.scene.enemyManager) {
      this.scene.enemyManager.paused = false;
      this.scene.enemyManager.setPaused(false);

      // Resume spawn timers to restart enemy spawning immediately
      if (
        this.scene.enemyManager.spawner &&
        this.scene.enemyManager.spawner.enemySpawnTimer
      ) {
        this.scene.enemyManager.spawner.enemySpawnTimer.paused = false;
      }
      if (
        this.scene.enemyManager.spawner &&
        this.scene.enemyManager.spawner.waveTimer
      ) {
        this.scene.enemyManager.spawner.waveTimer.paused = false;
      }
    }

    // Reset TimeScaleManager if available
    if (this.scene.timeScaleManager) {
      // First, force restore all enemy speeds
      console.log("DepositWithdrawPrompt: Forcibly restoring enemy speeds");
      this.scene.timeScaleManager.restoreEnemySpeeds();

      // Then disable all time effects and reset flags
      this.scene.timeScaleManager.activeTimeEffects.rhythmGame = false;
      this.scene.timeScaleManager.activeTimeEffects.droneWheel = false;
      this.scene.timeScaleManager.activeTimeEffects.bulletTime = false;

      // Reset all entity exemptions
      this.scene.timeScaleManager.exemptEntities.player = false;
      this.scene.timeScaleManager.exemptEntities.playerBullets = false;
      this.scene.timeScaleManager.exemptEntities.playerReload = false;

      // Force apply normal time scale
      this.scene.timeScaleManager.applyTimeScales(1.0);

      // Make a second attempt to reset enemy speeds for redundancy
      if (this.scene.timeScaleManager.resetAllEnemySpeeds) {
        this.scene.timeScaleManager.resetAllEnemySpeeds();
      }
    }

    // Restore projectile velocities immediately
    if (this.projectilesState && this.projectilesState.length > 0) {
      this.projectilesState.forEach((pState) => {
        if (pState.obj && pState.obj.active) {
          pState.obj.body.setVelocity(pState.velX, pState.velY);
        }
      });
      this.projectilesState = [];
    }
  }

  /**
   * Force multiple control restoration attempts to ensure player control is regained
   */
  forceMultipleControlRestoration() {
    // Only do this if we're not coming from the wheel
    if (this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel) {
      return;
    }

    console.log(
      "DepositWithdrawPrompt: Starting aggressive control restoration sequence"
    );

    // Schedule multiple attempts to restore control with increasing delays
    const delays = [100, 300, 500, 800, 1000, 1500];

    delays.forEach((delay) => {
      this.scene.time.delayedCall(delay, () => {
        if (!this.scene) return; // Scene might have changed by now

        console.log(`Delayed control restoration attempt at ${delay}ms`);

        // Reset all possible time-altering states
        if (this.scene.timeScaleManager) {
          // Check if we're coming from wheel
          const comingFromWheel =
            this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;

          if (!comingFromWheel) {
            this.scene.timeScaleManager.activeTimeEffects.rhythmGame = false;
            this.scene.timeScaleManager.activeTimeEffects.droneWheel = false;
            this.scene.timeScaleManager.activeTimeEffects.bulletTime = false;
            this.scene.timeScaleManager.exemptEntities.player = false;
            this.scene.timeScaleManager.exemptEntities.playerBullets = false;
            this.scene.timeScaleManager.exemptEntities.playerReload = false;
            this.scene.timeScaleManager.applyTimeScales(1.0);
          }
        }

        // Force time scales directly as well for non-wheel cases
        if (
          !this.scene.droneWheel ||
          !this.scene.droneWheel.openingAtmFromWheel
        ) {
          this.scene.time.timeScale = 1.0;
          this.scene.physics.world.timeScale = 1.0;
          this.scene.anims.globalTimeScale = 1.0;

          // Force unpause everything
          if (this.scene.enemyManager) {
            this.scene.enemyManager.paused = false;

            // Resume spawn timers to restart enemy spawning
            if (
              this.scene.enemyManager.spawner &&
              this.scene.enemyManager.spawner.enemySpawnTimer
            ) {
              this.scene.enemyManager.spawner.enemySpawnTimer.paused = false;
            }
            if (
              this.scene.enemyManager.spawner &&
              this.scene.enemyManager.spawner.waveTimer
            ) {
              this.scene.enemyManager.spawner.waveTimer.paused = false;
            }
          }

          // Force enable player controls
          if (this.scene.playerManager) {
            this.scene.playerManager.controlsEnabled = true;
          }
        }
      });
    });
  }

  // From Solana wallet to game account
  async handleWalletToGameDeposit(gameCredits) {
    try {
      this.onChaincreditBalance = await this.getOnchainGameAccountBalance();
      console.log(this.onChaincreditBalance);

      // Check if we have enough SOL in the wallet
      if (this.onChaincreditBalance >= gameCredits) {
        await this.scene.playerAccount.depositToGameAccount(gameCredits);

        // Simulate transaction by updating mock balance
        this.onChaincreditBalance -= gameCredits;

        // Add credits to player's game account (not to arena)
        if (this.scene.playerAccount) {
          this.scene.playerAccount.updateGameAccountBalance(gameCredits);
        }

        // CRITICAL: Ensure enemies are reset to normal speed first
        // This fixes the issue where enemies remain slowed after a deposit
        if (this.scene.timeScaleManager) {
          console.log(
            "DepositWithdrawPrompt: Pre-emptively restoring enemy speeds before hide/reset"
          );
          this.scene.timeScaleManager.restoreEnemySpeeds();
        }

        // Show success message
        if (this.scene.playerManager && this.scene.playerManager.player) {
          this.scene.events.emit("showFloatingText", {
            x: this.scene.playerManager.player.x,
            y: this.scene.playerManager.player.y - 50,
            text: `+$${gameCredits} TO GAME ACCOUNT`,
            color: "#00ffff",
          });
        } else {
          // In menu scene, we can't show floating text tied to player position
          console.log(`Deposit successful: +$${gameCredits} to game account`);
        }

        // Update balance displays
        this.updateBalanceDisplays();

        // Check if we need to reset wheel state
        const comingFromWheel =
          this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;
        if (comingFromWheel) {
          // Reset the flag when done with ATM operation
          this.scene.droneWheel.openingAtmFromWheel = false;
        }

        // Switch back to main menu
        this.switchToMainMenu();

        // Reset time scales AFTER hiding
        this.forceTimeScaleReset();

        // Run the enemy speed normalization as an extra safety measure
        this.ensureEnemiesAtNormalSpeed();

        // Pre-emptively force control restoration with immediate and delayed attempts
        if (this.scene.playerManager) {
          this.scene.playerManager.controlsEnabled = true;
        }

        // Make a delayed call to ensure enemy speeds remain normal after everything settles
        this.scene.time.delayedCall(300, () => {
          if (this.scene && this.scene.timeScaleManager) {
            console.log(
              "DepositWithdrawPrompt: Final enemy speed normalization check"
            );
            this.ensureEnemiesAtNormalSpeed();
          }
        });

        // Call callback if provided
        if (this.onDepositCallback) {
          this.onDepositCallback(gameCredits);
        }
        alert("Success");
      } else {
        // Show insufficient wallet funds message
        if (this.scene.playerManager && this.scene.playerManager.player) {
          this.scene.events.emit("showFloatingText", {
            x: this.scene.playerManager.player.x,
            y: this.scene.playerManager.player.y - 50,
            text: `INSUFFICIENT SOL IN WALLET`,
            color: "#ff0000",
          });
        } else {
          // In menu scene, we can't show floating text tied to player position
          console.log("Error: Insufficient SOL in wallet");
        }

        // CRITICAL: Ensure enemies are reset to normal speed first
        // This fixes the issue where enemies remain slowed after an error
        if (this.scene.timeScaleManager) {
          console.log(
            "DepositWithdrawPrompt: Pre-emptively restoring enemy speeds before hide/reset"
          );
          this.scene.timeScaleManager.restoreEnemySpeeds();
        }

        // Show brief error flash and hide immediately
        // Use a red overlay instead of setTint since containers don't support tint
        const errorOverlay = this.scene.add.rectangle(
          this.scene.cameras.main.width / 2,
          this.scene.cameras.main.height / 2,
          this.scene.cameras.main.width,
          this.scene.cameras.main.height,
          0xff0000,
          0.3
        );
        errorOverlay.setScrollFactor(0);
        errorOverlay.setDepth(1060); // Above the container

        // Flash the overlay red quickly then hide
        this.scene.tweens.add({
          targets: [this.container, errorOverlay],
          alpha: { from: 1, to: 0.5 },
          duration: 100,
          repeat: 1,
          yoyo: true,
          onComplete: () => {
            errorOverlay.destroy();
            console.log(
              "DepositWithdrawPrompt: Immediately hiding after insufficient funds error"
            );

            // Force time scale reset first
            this.forceTimeScaleReset();

            // Run the enemy speed normalization as an extra safety measure
            this.ensureEnemiesAtNormalSpeed();

            // Pre-emptively force controls enabled
            if (this.scene.playerManager) {
              this.scene.playerManager.controlsEnabled = true;
            }

            // Switch back to main menu
            this.switchToMainMenu();

            // Make a delayed call to ensure enemy speeds remain normal after everything settles
            this.scene.time.delayedCall(300, () => {
              if (this.scene && this.scene.timeScaleManager) {
                console.log(
                  "DepositWithdrawPrompt: Final enemy speed normalization check"
                );
                this.ensureEnemiesAtNormalSpeed();
              }
            });
          },
        });

        // Call callback if provided
        if (this.onCancelCallback) {
          this.onCancelCallback();
        }
      }
    } catch (error) {
      console.error("Error in handleGameToWalletDeposit:", error);
      alert("failed");
      // Handle the error as needed
    }
  }

  // From game account to Solana wallet
  async handleGameToWalletWithdraw() {
    try {
      // Get the current balance from the game account before withdrawing
      const currentBalance = this.getGameAccountBalance();
      console.log(`Withdrawal amount: ${currentBalance} credits`);
      
      // Verify that there are credits to withdraw
      if (currentBalance <= 0) {
        alert("No hay créditos para retirar");
        return;
      }
      
      // Show waiting screen
      this.showWaitingScreen(`PROCESSING WITHDRAWAL...`);
      
      try {
        // Withdraw all credits
        await this.scene.playerAccount.withdrawFromGameAccount();
        
        // CRITICAL: Ensure enemies are reset to normal speed if needed
        if (this.scene.timeScaleManager) {
          console.log(
            "DepositWithdrawPrompt: Pre-emptively restoring enemy speeds before hide/reset"
          );
          this.scene.timeScaleManager.restoreEnemySpeeds();
        }
        
        // Report withdraw to analytics
        if (window.gtag) {
          window.gtag("event", "withdraw_all_credits", {
            event_category: "economy",
            event_label: "Withdraw all credits",
            value: currentBalance,
          });
        }
        
        // Call callback if provided
        if (this.onWithdrawCallback) {
          console.log("Calling onWithdrawCallback");
          this.onWithdrawCallback(currentBalance);
        }
        
        // Show success message
        this.hideWaitingScreen(
          () => {
            // Show floating text
            if (this.scene.playerManager && this.scene.playerManager.player) {
              this.scene.events.emit("showFloatingText", {
                x: this.scene.playerManager.player.x,
                y: this.scene.playerManager.player.y - 50,
                text: `WITHDREW ${currentBalance} CREDITS`,
                color: "#00ffff",
              });
            } else {
              console.log(`Withdrawal successful: ${currentBalance} credits to wallet`);
            }
            
            // Actualizar displays de saldo
            this.updateBalanceDisplays();
            
            // Verificar si necesitamos resetear el estado de la rueda
            const comingFromWheel =
              this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;
            if (comingFromWheel) {
              this.scene.droneWheel.openingAtmFromWheel = false;
            }
            
            // Resetear escalas de tiempo
            this.forceTimeScaleReset();
            
            // Normalizar velocidad de enemigos
            this.ensureEnemiesAtNormalSpeed();
            
            // Habilitar controles del jugador
            if (this.scene.playerManager) {
              this.scene.playerManager.controlsEnabled = true;
            }
            
            // Mostrar contenedor principal
            this.container.setVisible(true);
            this.container.setAlpha(1);
            
            // Volver al modo wallet to game
            this.switchToWalletToGameMode();
          },
          "WITHDRAWAL SUCCESSFUL!"
        );
      } catch (error) {
        console.error("Withdrawal transaction failed:", error);
        
        // Show error message
        this.hideWaitingScreen(
          () => {
            alert("Withdrawal failed. Please try again later.");
            
            // Reset scales
            this.forceTimeScaleReset();
            
            // Normalizar velocidad de enemigos
            this.ensureEnemiesAtNormalSpeed();
            
            // Habilitar controles del jugador
            if (this.scene.playerManager) {
              this.scene.playerManager.controlsEnabled = true;
            }
            
            // Mostrar contenedor principal
            this.container.setVisible(true);
            this.container.setAlpha(1);
            
            // Volver al modo wallet to game
            this.switchToWalletToGameMode();
          },
          "WITHDRAWAL FAILED!"
        );
      }
    } catch (error) {
      console.error("Error in handleGameToWalletWithdraw:", error);
      
      // Manejar error general
      alert("An unexpected error occurred. Please try again later.");
      
      // Resetear escalas de tiempo
      this.forceTimeScaleReset();
      
      // Normalizar velocidad de enemigos
      this.ensureEnemiesAtNormalSpeed();
      
      // Habilitar controles del jugador
      if (this.scene.playerManager) {
        this.scene.playerManager.controlsEnabled = true;
      }
    }
  }

  async handleGameToWalletWithdrawBonk() {
    try {
      // Get the current balance from the game account before withdrawing
      const currentBonkBalance = this.getBonkBalance();
      console.log(`Withdrawal amount: ${currentBonkBalance} bonks`);
      
      // Verify if there are bonks to withdraw
      if (currentBonkBalance <= 0) {
        alert("No bonks to withdraw");
        return;
      }
      
      // show waiting screen
      this.showWaitingScreen(`PROCESSING WITHDRAWAL...`);
      
      try {
        // Retirar todos los bonks
        await this.scene.playerAccount.withdrawBonkFromGameAccount();
        
        // CRITICAL: Ensure enemies are reset to normal speed if needed
        if (this.scene.timeScaleManager) {
          console.log(
            "DepositWithdrawPrompt: Pre-emptively restoring enemy speeds before hide/reset"
          );
          this.scene.timeScaleManager.restoreEnemySpeeds();
        }
        
        // Report withdraw to analytics
        if (window.gtag) {
          window.gtag("event", "withdraw_all_credits", {
            event_category: "economy",
            event_label: "Withdraw all credits",
            value: currentBonkBalance,
          });
        }
        
        // Call callback if provided
        if (this.onWithdrawCallback) {
          console.log("Calling onWithdrawCallback");
          this.onWithdrawCallback(currentBonkBalance);
        }
        
        // Show success message
        this.hideWaitingScreen(
          () => {
            // Show floating text
            if (this.scene.playerManager && this.scene.playerManager.player) {
              this.scene.events.emit("showFloatingText", {
                x: this.scene.playerManager.player.x,
                y: this.scene.playerManager.player.y - 50,
                text: `WITHDREW ${currentBonkBalance} BONKS`,
                color: "#00ffff",
              });
            } else {
              console.log(`Withdrawal successful: ${currentBonkBalance} bonks to wallet`);
            }
            
            // update displays
            this.updateBalanceDisplays();
            
            // verify if we need to reset the wheel state
            const comingFromWheel =
              this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;
            if (comingFromWheel) {
              this.scene.droneWheel.openingAtmFromWheel = false;
            }
            
            // reset time scales
            this.forceTimeScaleReset();
            
            // normalize enemy speeds
            this.ensureEnemiesAtNormalSpeed();
            
            // enable player controls
            if (this.scene.playerManager) {
              this.scene.playerManager.controlsEnabled = true;
            }
            
            // show main container
            this.container.setVisible(true);
            this.container.setAlpha(1);
            
            // switch to wallet to game mode
            this.switchToWalletToGameMode();
          },
          "WITHDRAWAL SUCCESSFUL!"
        );
      } catch (error) {
        console.error("Withdrawal transaction failed:", error);
        
        // show error message
        this.hideWaitingScreen(
          () => {
            alert("Withdrawal failed. Please try again later.");
            
            // reset time scales
            this.forceTimeScaleReset();
            
            // normalize enemy speeds
            this.ensureEnemiesAtNormalSpeed();
            
            // enable player controls
            if (this.scene.playerManager) {
              this.scene.playerManager.controlsEnabled = true;
            }
            
            // show main container
            this.container.setVisible(true);
            this.container.setAlpha(1);
            
            // switch to wallet to game mode
            this.switchToWalletToGameMode();
          },
          "WITHDRAWAL FAILED!"
        );
      }
    } catch (error) {
      console.error("Error in handleGameToWalletWithdrawBonk:", error);
      
      // handle general error
      alert("An unexpected error occurred. Please try again later.");
      
      // reset time scales
      this.forceTimeScaleReset();
      
      // normalize enemy speeds
      this.ensureEnemiesAtNormalSpeed();
      
      // enable player controls
      if (this.scene.playerManager) {
        this.scene.playerManager.controlsEnabled = true;
      }
    }
  }

  // From game account to arena - IMPROVED VERSION
  async handleGameToArenaDeposit(gameCredits) {
    console.log(
      "IMPROVED handleGameToArenaDeposit called with amount:",
      gameCredits
    );

    // Get game account balance
    const gameAccountBalance = this.getGameAccountBalance();

    // Check if we have enough credits in the game account
    if (gameAccountBalance >= gameCredits) {
      // Store initial balances for verification
      const initialGameBalance = gameAccountBalance;
      const initialArenaBalance = this.scene.ui ? this.scene.ui.getMoney() : 0;

      console.log(
        `DEPOSIT REQUEST: Moving ${gameCredits} credits from game account (${initialGameBalance}) to arena (${initialArenaBalance})`
      );

      let success = false;

      // Transfer credits from game account to arena
      if (this.scene.playerAccount) {
        // Call fixed depositToArena method and store success status
        success = this.scene.playerAccount.depositToArena(gameCredits);

        if (!success) {
          // Show error message
          this.scene.events.emit("showFloatingText", {
            x: this.scene.playerManager.player.x,
            y: this.scene.playerManager.player.y - 50,
            text: `TRANSFER FAILED`,
            color: "#ff0000",
          });

          // Flash container red
          this.container.setTint(0xff0000);
          this.scene.tweens.add({
            targets: this.container,
            alpha: { from: 1, to: 0.5 },
            duration: 100,
            repeat: 1,
            yoyo: true,
            onComplete: () => {
              this.container.clearTint();
            },
          });

          // Update balance displays
          this.updateBalanceDisplays();

          return;
        }
      } else {
        // Fallback to direct UI update if playerAccount is not available
        // This double-updates both the game account and arena balances consistently
        try {
          // DIRECT EMERGENCY UPDATE
          if (this.scene.ui) {
            // First subtract from game account
            const newGameBalance = initialGameBalance - gameCredits;
            console.log(
              `Emergency update: Setting game account to ${newGameBalance}`
            );

            // Use direct property update to avoid event loops
            if (this.scene.playerAccount) {
              this.scene.playerAccount.gameAccountBalance = Math.max(
                0,
                newGameBalance
              );
              this.scene.playerAccount.playerData.gameAccountBalance =
                this.scene.playerAccount.gameAccountBalance;
              this.scene.playerAccount.savePlayerData();
            }

            // Then directly update arena
            const newArenaBalance = initialArenaBalance + gameCredits;
            console.log(
              `Emergency update: Setting arena to ${newArenaBalance}`
            );

            // Set money directly
            this.scene.ui.money = newArenaBalance;

            // Update text display
            if (this.scene.ui.moneyText) {
              this.scene.ui.moneyText.setText(
                "💵 Arena: $" + newArenaBalance.toFixed(2)
              );
            }

            // Force emit the money updated event to ensure all listeners are aware
            this.scene.events.emit("moneyUpdated", newArenaBalance);
            this.scene.events.emit("arenaBalanceUpdated", newArenaBalance);

            success = true;
          }
        } catch (error) {
          console.error("Emergency balance update failed:", error);
          success = false;
        }
      }

      // If the transaction failed, exit early
      if (!success) {
        return;
      }

      // CRITICAL: Ensure enemies are reset to normal speed first
      if (this.scene.timeScaleManager) {
        console.log(
          "DepositWithdrawPrompt: Pre-emptively restoring enemy speeds before hide/reset"
        );
        this.scene.timeScaleManager.restoreEnemySpeeds();
      }

      // Show success message if playerManager and player exist
      if (this.scene.playerManager && this.scene.playerManager.player) {
        this.scene.events.emit("showFloatingText", {
          x: this.scene.playerManager.player.x,
          y: this.scene.playerManager.player.y - 50,
          text: `+$${gameCredits} CREDITED TO ARENA`,
          color: "#00ffff",
        });
      } else {
        console.log(`+$${gameCredits} CREDITED TO ARENA`);
      }

      // VERIFICATION STEP - Check if arena balance was actually updated (if UI exists)
      if (this.scene.ui) {
        const finalArenaBalance = this.scene.ui.getMoney();
        const expectedArenaBalance = initialArenaBalance + gameCredits;

        console.log(
          `VERIFICATION: Arena balance is ${finalArenaBalance}, expected ${expectedArenaBalance}`
        );

        // If the arena balance doesn't match what we expect, force a direct update
        if (Math.abs(finalArenaBalance - expectedArenaBalance) > 0.001) {
          console.warn(
            `Arena balance verification failed! Applying emergency fix.`
          );

          // Force direct update
          this.scene.ui.money = expectedArenaBalance;

          // Update display
          if (this.scene.ui.moneyText) {
            this.scene.ui.moneyText.setText(
              "💵 Arena: $" + expectedArenaBalance.toFixed(2)
            );
          }

          // Emit event again
          this.scene.events.emit("moneyUpdated", expectedArenaBalance);
        }
      } else {
        console.log(`VERIFICATION: No UI available to verify arena balance`);
      }

      // Force refresh balance displays
      if (this.scene.ui) {
        this.arenaBalanceText.setText(
          `$${this.scene.ui.getMoney().toFixed(2)} CREDITS`
        );
      }
      if (this.scene.playerAccount) {
        this.gameAccountBalanceText.setText(
          `$${this.scene.playerAccount
            .getGameAccountBalance()
            .toFixed(2)} CREDITS`
        );
      }

      // Update balance displays after a brief delay to ensure all changes have propagated
      this.scene.time.delayedCall(50, () => {
        this.updateBalanceDisplays();
      });

      // Check if we need to reset wheel state
      const comingFromWheel =
        this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;
      if (comingFromWheel) {
        // Reset the flag when done with ATM operation
        this.scene.droneWheel.openingAtmFromWheel = false;
      }

      // Reset time scales AFTER hiding
      this.forceTimeScaleReset();

      // Run the enemy speed normalization as an extra safety measure
      this.ensureEnemiesAtNormalSpeed();

      // Pre-emptively force control restoration with immediate and delayed attempts
      if (this.scene.playerManager) {
        this.scene.playerManager.controlsEnabled = true;
      }

      // Make a delayed call to ensure enemy speeds remain normal after everything settles
      this.scene.time.delayedCall(300, () => {
        if (this.scene && this.scene.timeScaleManager) {
          console.log(
            "DepositWithdrawPrompt: Final enemy speed normalization check"
          );
          this.ensureEnemiesAtNormalSpeed();
        }
      });

      // Hide the prompt immediately to return to game
      console.log(
        "DepositWithdrawPrompt: Successful deposit, closing menu and returning to game"
      );
      this.performImmediateGameStateRestoration();
      this.hide();

      // Call callback if provided
      if (this.onDepositCallback) {
        this.onDepositCallback(gameCredits);
      }
    } else {
      // Show insufficient game account funds message
      this.scene.events.emit("showFloatingText", {
        x: this.scene.playerManager.player.x,
        y: this.scene.playerManager.player.y - 50,
        text: `INSUFFICIENT GAME ACCOUNT BALANCE`,
        color: "#ff0000",
      });

      // CRITICAL: Ensure enemies are reset to normal speed first
      if (this.scene.timeScaleManager) {
        console.log(
          "DepositWithdrawPrompt: Pre-emptively restoring enemy speeds before hide/reset"
        );
        this.scene.timeScaleManager.restoreEnemySpeeds();
      }

      // Show brief error flash and hide immediately
      // Use a red overlay instead of setTint since containers don't support tint
      const errorOverlay = this.scene.add.rectangle(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height / 2,
        this.scene.cameras.main.width,
        this.scene.cameras.main.height,
        0xff0000,
        0.3
      );
      errorOverlay.setScrollFactor(0);
      errorOverlay.setDepth(1060); // Above the container

      // Flash the overlay red quickly then hide
      this.scene.tweens.add({
        targets: [this.container, errorOverlay],
        alpha: { from: 1, to: 0.5 },
        duration: 100,
        repeat: 1,
        yoyo: true,
        onComplete: () => {
          errorOverlay.destroy();

          // Force time scale reset first
          this.forceTimeScaleReset();

          // Run the enemy speed normalization as an extra safety measure
          this.ensureEnemiesAtNormalSpeed();

          // Pre-emptively force controls enabled
          if (this.scene.playerManager) {
            this.scene.playerManager.controlsEnabled = true;
          }

          // Make a delayed call to ensure enemy speeds remain normal after everything settles
          this.scene.time.delayedCall(300, () => {
            if (this.scene && this.scene.timeScaleManager) {
              console.log(
                "DepositWithdrawPrompt: Final enemy speed normalization check"
              );
              this.ensureEnemiesAtNormalSpeed();
            }
          });
        },
      });
    }
  }

  // Withdraw from arena to game account via rhythm game
  handleWithdraw() {
    console.log("DepositWithdrawPrompt: Transitioning to rhythm game");

    // CRITICAL: We need to ensure the time scaling stays at 5% when transitioning
    // Force the time scale to remain at 5% before hiding the prompt
    if (this.scene.timeScaleManager) {
      console.log(
        "DepositWithdrawPrompt: Ensuring time scale stays at 5% during transition"
      );
      // Ensure the rhythm game effect is active before hiding the ATM menu
      this.scene.timeScaleManager.activeTimeEffects.rhythmGame = true;

      // Force apply the proper time scale
      if (this.scene.enemyManager && this.scene.enemyManager.getEnemies) {
        const enemies = this.scene.enemyManager.getEnemies().getChildren();
        if (enemies && enemies.length > 0) {
          console.log(
            `DepositWithdrawPrompt: Ensuring ${enemies.length} enemies stay at 5% speed during transition`
          );
          enemies.forEach((enemy) => {
            // Keep enemies at 5% during transition
            if (enemy.body && enemy.body.velocity) {
              const originalVelocity = {
                x: enemy.originalVelocityX || enemy.body.velocity.x * 20, // Estimate original as 20x current if not stored
                y: enemy.originalVelocityY || enemy.body.velocity.y * 20,
              };
              enemy.originalVelocityX = originalVelocity.x;
              enemy.originalVelocityY = originalVelocity.y;
              enemy.body.velocity.x = originalVelocity.x * 0.05;
              enemy.body.velocity.y = originalVelocity.y * 0.05;
            }
            if (enemy.anims) {
              enemy.anims.timeScale = 0.05;
            }
            if (enemy.speed !== undefined) {
              // Save original speed if not already saved
              if (!enemy.originalSpeed) {
                // Estimate original as 20x current if not stored
                enemy.originalSpeed = enemy.speed * 20;
              }
              enemy.speed = enemy.originalSpeed * 0.05;
            }
          });
        }
      }
    }

    // First hide the prompt - keeping the controls disabled
    this.hide(true); // Pass true to indicate we're transitioning to rhythm game

    // Call withdraw callback if provided - this will start the rhythm game
    if (this.onWithdrawCallback) {
      this.onWithdrawCallback();
    }
  }

  update() {
    // Only update position if containers are visible
    if (this.scene && this.scene.cameras) {
      const camera = this.scene.cameras.main;
      // Update main container position
      if (this.isVisible && this.container) {
        this.container.setPosition(camera.scrollX, camera.scrollY);
      }
      // Update waiting screen position
      if (this.isWaiting && this.waitingContainer) {
        this.waitingContainer.setPosition(camera.scrollX, camera.scrollY);
      }
    }
  }

  /**
   * Show the waiting screen while withdrawing to wallet
   * @param {string} [customMessage] - Optional custom message to display
   */
  showWaitingScreen(customMessage) {
    if (!this.waitingContainer) return;
    
    this.isWaiting = true;
    
    // Set custom message if provided
    if (customMessage && this.waitingStatusText) {
      this.waitingStatusText.setText(customMessage);
    } else if (this.waitingStatusText) {
      this.waitingStatusText.setText("PLEASE WAIT...");
    }
    
    // Position the container relative to camera
    const camera = this.scene.cameras.main;
    this.waitingContainer.setPosition(camera.scrollX, camera.scrollY);
    
    // Show the waiting screen with fade in
    this.waitingContainer.setAlpha(0);
    this.waitingContainer.setVisible(true);
    
    this.scene.tweens.add({
      targets: this.waitingContainer,
      alpha: 1,
      duration: 300,
      ease: "Power2"
    });
    
    // Hide the main container if it's visible
    if (this.isVisible && this.container) {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 300,
        ease: "Power2",
        onComplete: () => {
          this.container.setVisible(false);
        }
      });
    }
    
    // IMPORTANTE: Deshabilitar controles del jugador para evitar cambios de escenario
    this.disableAllControls();
    
    // Crear un bloqueador de input que cubra toda la pantalla para evitar clics
    this.createInputBlocker();
  }
      
  /**
   * Disable all player controls and UI interactions
   * This prevents the player from changing scenes or interacting with the game
   * while a critical operation like withdrawal is in progress
   */
  disableAllControls() {
    console.log("DepositWithdrawPrompt: Disabling all controls during withdrawal");
    
    // Disable player controls if available
    if (this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = false;
      console.log("Player controls disabled");
    }
    
    // Disable scene switching if available
    if (this.scene.sceneManager) {
      this.scene._allowSceneChange = false; // Custom flag to prevent scene changes
      console.log("Scene switching disabled");
    }
    
    // Disable all buttons in the scene
    if (this.scene.input && this.scene.input.enabled) {
      // Store original state to restore later
      this._originalInputEnabled = this.scene.input.enabled;
      this.scene.input.enabled = false;
      console.log("Scene input disabled");
    }
    
    // Disable keyboard events
    if (this.scene.input && this.scene.input.keyboard) {
      this._originalKeyboardEnabled = this.scene.input.keyboard.enabled;
      this.scene.input.keyboard.enabled = false;
      console.log("Keyboard input disabled");
    }
  }
  
  /**
   * Create an invisible input blocker that covers the entire screen
   * This prevents clicks from passing through to UI elements below
   */
  createInputBlocker() {
    // Remove any existing input blocker
    if (this.inputBlocker) {
      this.inputBlocker.destroy();
    }
    
    // Create a full-screen rectangle that blocks input
    this.inputBlocker = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.01 // Almost invisible but still blocks input
    );
    
    // Make sure it's above everything else
    this.inputBlocker.setDepth(2000);
    
    // Make it follow the camera
    this.inputBlocker.setScrollFactor(0);
    
    // Add it to the waiting container
    this.waitingContainer.add(this.inputBlocker);
    
    console.log("Input blocker created");
  }
  
  /**
   * Re-enable all controls that were disabled
   */
  enableAllControls() {
    console.log("DepositWithdrawPrompt: Re-enabling all controls");
    
    // Re-enable player controls
    if (this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = true;
      console.log("Player controls re-enabled");
    }
    
    // Re-enable scene switching
    if (this.scene.sceneManager) {
      this.scene._allowSceneChange = true;
      console.log("Scene switching re-enabled");
    }
    
    // Re-enable scene input if it was enabled before
    if (this.scene.input && this._originalInputEnabled !== undefined) {
      this.scene.input.enabled = this._originalInputEnabled;
      console.log("Scene input restored to original state");
    }
    
    // Re-enable keyboard if it was enabled before
    if (this.scene.input && this.scene.input.keyboard && this._originalKeyboardEnabled !== undefined) {
      this.scene.input.keyboard.enabled = this._originalKeyboardEnabled;
      console.log("Keyboard input restored to original state");
    }
    
    // Remove input blocker
    if (this.inputBlocker) {
      this.inputBlocker.destroy();
      this.inputBlocker = null;
      console.log("Input blocker removed");
    }
  }
  
  /**
   * Hide the waiting screen
   * @param {Function} [callback] - Optional callback to execute when hidden
   * @param {string} [resultMessage] - Optional result message to show briefly before hiding
   */
  hideWaitingScreen(callback, resultMessage) {
    if (!this.waitingContainer || !this.isWaiting) {
      if (callback) callback();
      return;
    }
    
    // If a result message is provided, show it briefly before hiding
    if (resultMessage && this.waitingStatusText) {
      this.waitingStatusText.setText(resultMessage);
    
      // Wait a moment to show the result message before hiding
      this.scene.time.delayedCall(1500, () => {
        this.fadeOutWaitingScreen(callback);
      });
    } else {
      this.fadeOutWaitingScreen(callback);
    }
  }
    
    /**
     * Fade out the waiting screen
     * @private
     * @param {Function} [callback] - Optional callback to execute when hidden
     */
    fadeOutWaitingScreen(callback) {
      this.scene.tweens.add({
        targets: this.waitingContainer,
        alpha: 0,
        duration: 300,
        ease: "Power2",
        onComplete: () => {
          this.waitingContainer.setVisible(false);
          this.isWaiting = false;
          
          // IMPORTANTE: Re-habilitar todos los controles que fueron deshabilitados
          this.enableAllControls();
          
          // Execute callback if provided
          if (callback) callback();
        }
      });
    }


  /**
   * Force an immediate reset of time scales to normal
   * This ensures game returns to normal speed after deposit/error
   */
  forceTimeScaleReset() {
    console.log(
      "DepositWithdrawPrompt: Forcing immediate time scale reset to normal"
    );

    // First check if we are in the drone wheel to handle that case specially
    const inDroneWheel =
      this.scene.droneWheel && this.scene.droneWheel.isVisible;
    const fromAtmFromWheel =
      this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;

    // CRITICAL: Always restore enemy speeds first, regardless of context
    // This is necessary because enemies might have been directly slowed down during show()
    if (
      this.scene.timeScaleManager &&
      this.scene.timeScaleManager.enemiesWithStoredSpeeds
    ) {
      console.log(
        "DepositWithdrawPrompt: FORCIBLY restoring enemy speeds before further time processing"
      );
      this.scene.timeScaleManager.restoreEnemySpeeds();
    }

    // If we're coming from the wheel and plan to return to it, don't restart controls
    if (inDroneWheel || fromAtmFromWheel) {
      console.log("Still in drone wheel - skipping complete control reset");

      // Just make sure time scales are correct for drone wheel
      if (this.scene.timeScaleManager) {
        // Make sure we deactivate rhythm game first
        if (this.scene.timeScaleManager.activeTimeEffects.rhythmGame) {
          this.scene.timeScaleManager.deactivateRhythmGameTime();
        }

        // Force time scale to drone wheel scale
        this.scene.timeScaleManager.activeTimeEffects.droneWheel = true;
        this.scene.timeScaleManager.activeTimeEffects.bulletTime = false;

        // Re-store speeds before activating drone wheel again
        // This ensures a clean state for the drone wheel time effect
        this.scene.timeScaleManager.storeEnemySpeeds();

        // Activate drone wheel time to ensure proper enemy slowdown
        this.scene.timeScaleManager.activateDroneWheelTime();
      }

      return;
    }

    // Force time scales to normal regardless of where we came from
    if (this.scene.timeScaleManager) {
      // Reset all active effects
      this.scene.timeScaleManager.activeTimeEffects.rhythmGame = false;
      this.scene.timeScaleManager.activeTimeEffects.droneWheel = false;
      this.scene.timeScaleManager.activeTimeEffects.bulletTime = false;

      // Reset player exemptions
      this.scene.timeScaleManager.exemptEntities.player = false;
      this.scene.timeScaleManager.exemptEntities.playerBullets = false;
      this.scene.timeScaleManager.exemptEntities.playerReload = false;

      // Restore enemy speeds again to be absolutely certain
      this.scene.timeScaleManager.restoreEnemySpeeds();

      // Apply normal time scale
      this.scene.timeScaleManager.applyTimeScales(1.0);

      // Force an enemy speed check since we've made significant changes
      this.ensureEnemiesAtNormalSpeed();
    } else {
      // Direct application if no manager available
      this.scene.time.timeScale = 1.0;
      this.scene.physics.world.timeScale = 1.0;
      this.scene.anims.globalTimeScale = 1.0;
    }

    // Unpause everything
    if (this.scene.enemyManager) {
      this.scene.enemyManager.paused = false;
    }

    // Enable player controls with a slight delay to ensure everything else is reset
    if (this.scene.playerManager) {
      // First set flag immediately
      this.scene.playerManager.controlsEnabled = true;

      // Then use a delayed call to ensure it sticks (in case anything else is fighting with this)
      this.scene.time.delayedCall(100, () => {
        if (this.scene.playerManager) {
          console.log("Delayed re-enabling player controls");
          this.scene.playerManager.controlsEnabled = true;
        }
      });
    }

    // Restore projectile velocities if any were stored
    if (this.projectilesState && this.projectilesState.length > 0) {
      this.projectilesState.forEach((pState) => {
        if (pState.obj && pState.obj.active) {
          pState.obj.body.setVelocity(pState.velX, pState.velY);
        }
      });
      this.projectilesState = [];
    }
  }

  /**
   * Ensure all enemies are at normal speed regardless of time scale
   * This is a brute-force approach to fix any speed issues
   */
  ensureEnemiesAtNormalSpeed() {
    if (!this.scene.enemyManager || !this.scene.enemyManager.getEnemies) return;

    const enemies = this.scene.enemyManager.getEnemies().getChildren();
    if (!enemies || enemies.length === 0) return;

    console.log(
      `DepositWithdrawPrompt: Force-normalizing speeds for ${enemies.length} enemies`
    );

    enemies.forEach((enemy) => {
      if (!enemy || !enemy.active) return;

      // Reset animation time scale to normal
      if (enemy.anims) {
        enemy.anims.timeScale = 1.0;
      }

      // Reset custom speed property if it exists
      // We don't know the exact original speed, but EnemyManager will update it
      // next frame based on the enemy type
      if (enemy.speed !== undefined) {
        // Get default speed based on enemy type if possible
        const defaultSpeed = this.getDefaultEnemySpeed(enemy);
        enemy.speed = defaultSpeed || 100; // Fallback to 100 if unknown
      }
    });
  }

  /**
   * Get the default speed for an enemy based on its type
   * This uses common enemy speed values from the game
   */
  getDefaultEnemySpeed(enemy) {
    // Try to intelligently guess the default speed based on enemy properties
    if (!enemy) return 100;

    // Check if enemy has a type or behavior property we can use
    if (enemy.enemyType) {
      // Handle based on known enemy types
      switch (enemy.enemyType) {
        case "basic":
          return 100;
        case "fast":
          return 150;
        case "heavy":
          return 75;
        case "boss":
          return 60;
        default:
          return 100;
      }
    }

    // If enemy has a visible health property, assume it's stronger/heavier
    if (enemy.health && enemy.health > 100) {
      return 75; // Heavier enemies are typically slower
    }

    // Default fallback
    return 100;
  }

  disableButtonsTemporarily() {
    try {
      // Safety check for container
      if (!this.container || !this.container.active) {
        console.warn("Cannot disable buttons: Container not active");
        return;
      }

      // Get all interactive buttons in the container
      const buttons = this.container
        .getAll()
        .filter(
          (item) =>
            item &&
            item.input &&
            item.input.enabled &&
            item.type === "Rectangle"
        );

      console.log(
        `Temporarily disabling ${buttons.length} deposit buttons to prevent accidental clicks`
      );

      // Disable all buttons temporarily
      buttons.forEach((button) => {
        if (button && button.active) {
          button.disableInteractive();
        }
      });

      // Re-enable after a longer delay to prevent accidental touch events in portrait mode
      // Increased from 200ms to 350ms
      this.scene.time.delayedCall(350, () => {
        console.log(`Re-enabling ${buttons.length} deposit buttons`);
        buttons.forEach((button) => {
          if (button && button.active) {
            try {
              button.setInteractive();
            } catch (err) {
              // Button may have been destroyed during the delay
              console.warn("Button no longer available for re-enabling:", err);
            }
          }
        });
      });
    } catch (error) {
      console.error("Error disabling buttons temporarily:", error);
    }
  }

  /**
   * Update arena balance display
   * @param {number} newBalance - The new arena balance
   */
  updateArenaBalanceDisplay(newBalance) {
    console.log(`Updating arena balance display: $${newBalance}`);
    // Update the arena balance display in the deposit/withdraw prompt
    if (this.arenaBalanceText && this.arenaBalanceText.scene) {
      try {
        this.arenaBalanceText.setText(`$${newBalance.toFixed(2)} CREDITS`);
      } catch (error) {
        console.warn("Error updating arena balance text:", error.message);
      }
    }
  }

  /**
   * Update game account balance display
   * @param {number} newBalance - The new game account balance
   */
  updateGameAccountDisplay(newBalance) {
    // Determine if we are in a login process
    const isLoginProcess = this.isLoginProcess(newBalance);
    
    // PART 1: Attempt to update the database separate from the UI, EXCEPT during login
    console.log("DepositWithdrawPrompt: Verifying scene to update DB:", {
      hasScene: !!this.scene,
      isLoginProcess,
    });
    
    if (this.scene && !isLoginProcess) { // Only update DB if NOT a login process
      console.log("DepositWithdrawPrompt: Verifying playerAccount", {
        hasPlayerAccount: !!this.scene.playerAccount,
        playerAccountType: this.scene.playerAccount
          ? typeof this.scene.playerAccount
          : "undefined",
      });
      
      if (this.scene.playerAccount) {
        console.log("DepositWithdrawPrompt: Properties of playerAccount", {
          // isAuthenticated: this.scene.playerAccount.isAuthenticated,
          // hasAuthToken: !!this.scene.playerAccount.authToken,
          // hasSetCreditCountMethod: typeof this.scene.playerAccount.setCreditCount ===
          //   "function",
        });
        
        // Attempt to update in the database
        if (typeof this.scene.playerAccount.setCreditCount === "function") {
          console.log(
            "DepositWithdrawPrompt: Attempting to update credit_count in DB with value:",
            newBalance
          );
          try {
            this.scene.playerAccount.setCreditCount(newBalance)
              .then((response) => {
                console.log(
                  "DepositWithdrawPrompt: credit_count successfully updated in DB:",
                  response
                );
              })
              .catch((err) => {
                console.error(
                  "Error updating credit_count in DB from DepositWithdrawPrompt:",
                  err
                );
              });
          } catch (error) {
            console.error("Error calling setCreditCount:", error);
          }
        } else {
          console.error(
            "DepositWithdrawPrompt: Cannot update DB - setCreditCount method not available"
          );
        }
      } else {
        console.error(
          "DepositWithdrawPrompt: Cannot update DB - playerAccount not available"
        );
      }
    } else if (isLoginProcess) {
      console.log("DepositWithdrawPrompt: Skipping DB update during login process");
    } else {
      console.error(
        "DepositWithdrawPrompt: Cannot update DB - scene not available"
      );
    }
    
    // PART 2: Update the UI if available (original code)
    if (this.gameAccountText && this.gameAccountText.scene) {
      try {
        this.gameAccountText.setText(`$${newBalance.toFixed(2)} CREDITS`);
      } catch (error) {
        console.warn("Error updating game account text:", error.message);
      }
    } else {
      console.log("DepositWithdrawPrompt: Cannot update UI - gameAccountText not available");
    }
  }
  
  /**
   * Determines if we are in a login process based on special characteristics
   * @param {number} newBalance - The new balance to check
   * @returns {boolean} true if it appears to be part of a login process
   */
  isLoginProcess(newBalance) {
    if (newBalance === 0) {
      return true;
    }
    
    return false;
  }

  /**
   * Update BONK balance display
   * @param {number} newBalance - The new BONK balance
   */
  updateBonkBalanceDisplay(newBalance) {
    console.log(`Updating BONK balance display: ${newBalance}`);
    // Update the BONK balance display in the deposit/withdraw prompt
    if (this.bonkBalanceText && this.bonkBalanceText.scene) {
      try {
        this.bonkBalanceText.setText(`${newBalance} BONK`);
      } catch (error) {
        console.warn("Error updating BONK balance text:", error.message);
      }
    }
  }

  /**
   * Create the waiting screen UI when withdrawing to wallet
   */
  createWaitingScreen() {
    // Create background overlay
    const bg = this.scene.add.rectangle(
    this.scene.cameras.main.width / 2,
    this.scene.cameras.main.height / 2,
    this.scene.cameras.main.width,
    this.scene.cameras.main.height,
    0x000000,
    0.85
    );
    this.waitingContainer.add(bg);

    // Create panel background (terminal style screen)
    const panel = this.scene.add.rectangle(
    this.scene.cameras.main.width / 2,
    this.scene.cameras.main.height / 2,
    500,
    300,
    0x000000,
    0.95
    );
    panel.setStrokeStyle(2, 0x00ff00);
    this.waitingContainer.add(panel);
    
    // Add title
    const title = this.scene.add.text(
    this.scene.cameras.main.width / 2,
    this.scene.cameras.main.height / 2 - 100,
    "PROCESSING WITHDRAWAL",
    {
    fontFamily: "Tektur",
    fontSize: "24px",
    color: "#00ff00",
    align: "center",
    fontStyle: "bold",
    }
    );
    title.setOrigin(0.5);
    this.waitingContainer.add(title);

    // Add subtitle with explanation
    const subtitle = this.scene.add.text(
    this.scene.cameras.main.width / 2,
    this.scene.cameras.main.height / 2 - 60,
    "TRANSFERRING FUNDS TO YOUR WALLET",
    {
    fontFamily: "Tektur",
    fontSize: "16px",
    color: "#00ff00",
    align: "center",
    }
    );
    subtitle.setOrigin(0.5);
    this.waitingContainer.add(subtitle);
    
    // Add loading spinner animation
    const spinnerSize = 50;
    const spinnerX = this.scene.cameras.main.width / 2;
    const spinnerY = this.scene.cameras.main.height / 2;
    
    // Create spinner segments
    for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = spinnerX + Math.cos(angle) * spinnerSize;
    const y = spinnerY + Math.sin(angle) * spinnerSize;
    
    const dot = this.scene.add.circle(x, y, 5, 0x00ff00);
    dot.alpha = 0.2 + (i / 8) * 0.8; // Fade alpha based on position
    
    this.waitingContainer.add(dot);
    }
    
    // Add an animated dot that rotates around the circle
    const animatedDot = this.scene.add.circle(
    spinnerX + spinnerSize,
    spinnerY,
    8,
    0x00ff00
    );
    this.waitingContainer.add(animatedDot);
    
    // Create animation for the dot
    this.scene.tweens.add({
    targets: animatedDot,
    angle: 360,
    loop: -1,
    duration: 1500,
    onUpdate: (tween) => {
    const progress = tween.progress;
    const angle = progress * Math.PI * 2;
    animatedDot.x = spinnerX + Math.cos(angle) * spinnerSize;
    animatedDot.y = spinnerY + Math.sin(angle) * spinnerSize;
    }
    });
    
    // Add status message
    this.waitingStatusText = this.scene.add.text(
    this.scene.cameras.main.width / 2,
    this.scene.cameras.main.height / 2 + 80,
    "PLEASE WAIT...",
    {
    fontFamily: "Tektur",
    fontSize: "18px",
    color: "#00ff00",
    align: "center",
    }
    );
    this.waitingStatusText.setOrigin(0.5);
    this.waitingContainer.add(this.waitingStatusText);
    
    // Add footer note
    const footer = this.scene.add.text(
    this.scene.cameras.main.width / 2,
    this.scene.cameras.main.height / 2 + 120,
    "DO NOT CLOSE OR REFRESH THE PAGE",
    {
    fontFamily: "Tektur",
    fontSize: "14px",
    color: "#ff0000",
    align: "center",
    fontStyle: "bold",
    }
    );
    footer.setOrigin(0.5);
    this.waitingContainer.add(footer);
    
    // Add scanlines for terminal effect
    const scanlines = this.createScanlines(panel);
    this.waitingContainer.add(scanlines);
  }

  /**
   * Create scanlines effect for the terminal display
   * @param {Phaser.GameObjects.Rectangle} panel - The panel to apply scanlines to
   */
  createScanlines(panel) {
    const scanlineGraphics = this.scene.add.graphics();
    scanlineGraphics.lineStyle(1, 0x00ff00, 0.15); // Green scanlines with low opacity

    // Get panel bounds
    const bounds = panel.getBounds();
    const startY = bounds.y;
    const endY = bounds.y + bounds.height;
    const startX = bounds.x;
    const endX = bounds.x + bounds.width;

    // Draw horizontal scanlines across the panel
    for (let y = startY; y < endY; y += 4) {
      scanlineGraphics.beginPath();
      scanlineGraphics.moveTo(startX, y);
      scanlineGraphics.lineTo(endX, y);
      scanlineGraphics.closePath();
      scanlineGraphics.strokePath();
    }

    return scanlineGraphics;
  }

  cleanup() {
    // Clear the safety interval if it exists
    if (this.controlSafetyInterval) {
      clearInterval(this.controlSafetyInterval);
      this.controlSafetyInterval = null;
    }

    // Clear the update event
    if (this.updateEvent) {
      this.updateEvent.remove();
      this.updateEvent = null;
    }

    // Remove event listeners
    if (this.scene && this.scene.events) {
      this.scene.events.off(
        "arenaBalanceUpdated",
        this.updateArenaBalanceDisplay,
        this
      );
      this.scene.events.off(
        "gameAccountUpdated",
        this.updateGameAccountDisplay,
        this
      );
      this.scene.events.off(
        "bonkBalanceUpdated",
        this.updateBonkBalanceDisplay,
        this
      );
    }

    // Destroy main container
    if (this.container) {
      this.container.destroy();
    }

    // Destroy waiting screen container
    if (this.waitingContainer) {
      this.waitingContainer.destroy();
      this.waitingContainer = null;
      this.isWaiting = false;
    }

    if (this.escKey) {
      this.escKey.removeAllListeners();
    }

    // Final safety check - force enable controls
    // This prevents controls from being stuck in disabled state when scene changes
    if (this.scene && this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = true;
    }
  }
}
