import { GAME_WIDTH, GAME_HEIGHT, WEB3_CONFIG } from "../../config.js";
import { PlayerAccount } from "../web3/PlayerAccount.js";
import { DepositWithdrawPrompt } from "../ui/DepositWithdrawPrompt.js";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
    this.introMusic = null;
    this.playerAccount = null;
    this.cachedAudioElements = {}; // Cache for HTML Audio objects
    this.depositWithdrawPrompt = null;
  }

  init(data) {
    // Check if PlayerAccount already exists in registry
    const existingAccount = this.registry.get("playerAccount");
    if (existingAccount) {
      this.playerAccount = existingAccount;
      console.log("MenuScene: Using existing PlayerAccount from registry");
    } else {
      // Initialize player account and web3 connection
      this.playerAccount = new PlayerAccount(this);
      // Store in registry for other scenes to use
      this.registry.set("playerAccount", this.playerAccount);
      console.log("MenuScene: Created new PlayerAccount");
    }

    // Set up event listeners for authentication events
    this.events.on(
      "player-authenticated",
      this.handlePlayerAuthenticated,
      this
    );
    this.events.on("player-disconnected", this.handlePlayerDisconnected, this);
    this.events.on(
      "wallet-not-whitelisted",
      this.handleWalletNotWhitelisted,
      this
    );

    // Listen for game account balance updates
    this.events.on("gameAccountUpdated", this.handleGameAccountUpdated, this);

    // Check if we should start the hype screen right away (coming from tutorial)
    this.startHypeScreen = data && data.startHypeScreen === true;

    // Preload and cache cutscene sound effects
    this.preloadCutsceneSounds();
  }

  // Handle game account balance updates
  handleGameAccountUpdated(balance) {
    console.log(`MenuScene: Game account balance updated to ${balance}`);

    // Only refresh if scene is active and cameras exist
    if (this.scene.isActive() && this.cameras && this.cameras.main) {
      // Refresh wallet info display if it exists
      if (this.walletInfoContainer) {
        this.walletInfoContainer.destroy();
        this.createWalletInfo();
      }
    } else {
      console.log(
        "MenuScene: Skipping wallet info update - scene not active or cameras not available"
      );
    }
  }

  // Handle player authenticated event
  handlePlayerAuthenticated() {
    console.log("MenuScene: Player authenticated");

    // Update UI to reflect authenticated state
    this.updateButtonStates();

    // Show wallet info if scene is active
    if (this.scene.isActive() && this.cameras && this.cameras.main) {
      this.createWalletInfo();
    }
  }

  // Handle player disconnected event
  handlePlayerDisconnected() {
    console.log("MenuScene: Player disconnected");

    // Update UI to reflect non-authenticated state
    this.updateButtonStates();

    // Remove wallet info if exists
    if (this.walletInfoContainer) {
      this.walletInfoContainer.destroy();
      this.walletInfoContainer = null;
    }
  }

  // Handle wallet not whitelisted event
  handleWalletNotWhitelisted() {
    console.log("MenuScene: Wallet not whitelisted");

    // Show a message to the user
    if (this.scene.isActive() && this.cameras && this.cameras.main) {
      this.showWhitelistWarning();
    }
  }

  // Show whitelist warning dialog
  showWhitelistWarning() {
    // Create a background overlay
    const overlay = this.add.rectangle(
      0,
      0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.7
    );
    overlay.setOrigin(0, 0);
    overlay.setDepth(1000);

    // Create a container for the dialog
    const dialogContainer = this.add.container(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2
    );
    dialogContainer.setDepth(1001);

    // Create dialog background
    const dialogBg = this.add.rectangle(0, 0, 400, 250, 0x330033, 0.9);
    dialogBg.setStrokeStyle(2, 0xff00ff);
    dialogContainer.add(dialogBg);

    // Create dialog title
    const title = this.add.text(0, -80, "NOT WHITELISTED", {
      fontFamily: "Tektur, Arial",
      fontSize: "24px",
      color: "#ff00ff",
      align: "center",
    });
    title.setOrigin(0.5);
    dialogContainer.add(title);

    // Create dialog text
    const text = this.add.text(
      0,
      -20,
      "Your wallet is not on the whitelist.\nPlease contact support for access.",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        align: "center",
      }
    );
    text.setOrigin(0.5);
    dialogContainer.add(text);

    // Create OK button
    const okButton = this.add.rectangle(0, 70, 150, 50, 0x990099, 0.8);
    okButton.setStrokeStyle(2, 0xffffff);
    dialogContainer.add(okButton);

    const okText = this.add.text(0, 70, "OK", {
      fontFamily: "Arial Black",
      fontSize: "20px",
      color: "#ffffff",
    });
    okText.setOrigin(0.5);
    dialogContainer.add(okText);

    // Make button interactive
    okButton.setInteractive({ useHandCursor: true });

    // Add hover effect
    okButton.on("pointerover", () => {
      okButton.fillColor = 0xff00ff;
      okText.setScale(1.1);
    });

    okButton.on("pointerout", () => {
      okButton.fillColor = 0x990099;
      okText.setScale(1);
    });

    // Add click handler to close dialog
    okButton.on("pointerdown", () => {
      overlay.destroy();
      dialogContainer.destroy();
    });
  }

  // Start the tutorial
  startTutorial() {
    console.log("Starting tutorial");
    this.scene.start("TutorialScene");
  }

  // Create wallet deposit button
  createWalletDepositButton() {
    // Clean up any existing button
    if (this.walletButton) {
      this.walletButton.destroy();
    }

    if (this.walletButtonContainer) {
      this.walletButtonContainer.destroy();
    }

    // Only create the button if authenticated
    if (this.playerAccount && this.playerAccount.isPlayerAuthenticated()) {
      const buttonY = this.cameras.main.height * 0.85; // Below other buttons

      // Create container for wallet button
      this.walletButtonContainer = this.add.container(
        this.cameras.main.width / 2,
        buttonY
      );

      // Create glow effect for wallet button
      const walletGlow = this.add.rectangle(0, 0, 250, 60, 0x009900, 0.2);
      this.walletButtonContainer.add(walletGlow);

      // Add pulsating animation to the glow
      this.tweens.add({
        targets: walletGlow,
        alpha: { from: 0.2, to: 0.4 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
      });

      // Calculate responsive font size for wallet button
      const screenWidth = this.cameras.main.width;
      const isPortrait = this.cameras.main.height > this.cameras.main.width;

      // In non-portrait modes, buttons should be 50% smaller
      const sizeMultiplier = isPortrait ? 1 : 0.5;
      let walletFontSize = Math.max(
        20 * sizeMultiplier,
        Math.floor(screenWidth * 0.04 * sizeMultiplier)
      );

      // Create wallet button text
      this.walletButton = this.add.text(0, 0, "DEPOSIT / WITHDRAW", {
        fontFamily: '"Tektur", monospace, Courier, Arial',
        fontSize: `${walletFontSize}px`,
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: "#00cc00",
          blur: 5,
          stroke: true,
          fill: true,
        },
      });
      this.walletButton.setOrigin(0.5);

      // Add to container
      this.walletButtonContainer.add(this.walletButton);

      // Make the button interactive
      this.walletButton.setInteractive({ useHandCursor: true });

      // Add hover effect
      this.walletButton.on("pointerover", () => {
        this.walletButton.setColor("#00ff00");
        this.walletButton.setScale(1.1);
        walletGlow.alpha = 0.5;
      });

      this.walletButton.on("pointerout", () => {
        this.walletButton.setColor("#ffffff");
        this.walletButton.setScale(1);
        walletGlow.alpha = 0.2;
      });

      // Add click event for wallet operations
      this.walletButton.on("pointerdown", () => {
        // Show deposit/withdraw dialog
        this.showDepositWithdrawDialog();
      });
    }
  }

  // Show deposit/withdraw dialog
  showDepositWithdrawDialog() {
    console.log("Showing deposit/withdraw dialog");

    // Check if deposit/withdraw prompt exists
    if (this.depositWithdrawPrompt) {
      // Show the prompt with callbacks
      this.depositWithdrawPrompt.show(
        // Deposit callback
        (amount) => {
          console.log(`Deposit completed: ${amount}`);

          // Update wallet info display if it exists
          if (this.walletInfoContainer) {
            this.walletInfoContainer.destroy();
            this.createWalletInfo();
          }
        },
        // Withdraw callback
        (amount) => {
          console.log(`Withdraw completed: ${amount}`);

          // Update wallet info display if it exists
          if (this.walletInfoContainer) {
            this.walletInfoContainer.destroy();
            this.createWalletInfo();
          }
        },
        // Cancel callback
        () => {
          console.log("Deposit/withdraw canceled");
        }
      );
    } else {
      // Fallback to legacy implementation
      if (
        this.playerAccount &&
        typeof this.playerAccount.showDepositWithdrawPrompt === "function"
      ) {
        this.playerAccount.showDepositWithdrawPrompt();
      } else {
        // Fallback dialog if the proper implementation is not available

        // Create a background overlay
        const overlay = this.add.rectangle(
          0,
          0,
          this.cameras.main.width,
          this.cameras.main.height,
          0x000000,
          0.7
        );
        overlay.setOrigin(0, 0);
        overlay.setDepth(1000);

        // Create a container for the dialog
        const dialogContainer = this.add.container(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2
        );
        dialogContainer.setDepth(1001);

        // Create dialog background
        const dialogBg = this.add.rectangle(0, 0, 400, 250, 0x113300, 0.9);
        dialogBg.setStrokeStyle(2, 0x00ff00);
        dialogContainer.add(dialogBg);

        // Create dialog title
        const title = this.add.text(0, -80, "WALLET OPERATIONS", {
          fontFamily: "Tektur, Arial",
          fontSize: "24px",
          color: "#00ff00",
          align: "center",
        });
        title.setOrigin(0.5);
        dialogContainer.add(title);

        // Create dialog text
        const text = this.add.text(
          0,
          -20,
          "Web3 wallet integration placeholder.\nThis would connect to your crypto wallet.",
          {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#ffffff",
            align: "center",
          }
        );
        text.setOrigin(0.5);
        dialogContainer.add(text);

        // Create OK button
        const okButton = this.add.rectangle(0, 70, 150, 50, 0x009900, 0.8);
        okButton.setStrokeStyle(2, 0xffffff);
        dialogContainer.add(okButton);

        const okText = this.add.text(0, 70, "OK", {
          fontFamily: "Arial Black",
          fontSize: "20px",
          color: "#ffffff",
        });
        okText.setOrigin(0.5);
        dialogContainer.add(okText);

        // Make button interactive
        okButton.setInteractive({ useHandCursor: true });

        // Add hover effect
        okButton.on("pointerover", () => {
          okButton.fillColor = 0x00ff00;
          okText.setScale(1.1);
        });

        okButton.on("pointerout", () => {
          okButton.fillColor = 0x009900;
          okText.setScale(1);
        });

        // Add click handler to close dialog
        okButton.on("pointerdown", () => {
          overlay.destroy();
          dialogContainer.destroy();
        });
      }
    }
  }

  // Create wallet info display
  createWalletInfo() {
    // Check if player account exists and is authenticated
    if (!this.playerAccount || !this.playerAccount.isPlayerAuthenticated()) {
      return;
    }

    // Remove existing container if it exists
    if (this.walletInfoContainer) {
      this.walletInfoContainer.destroy();
    }

    // Create a container for wallet info
    this.walletInfoContainer = this.add.container(
      this.cameras.main.width - 20,
      70
    );
    this.walletInfoContainer.setDepth(100);

    // Get wallet address and truncate it
    const walletAddress = this.playerAccount.getWalletAddress();
    const truncatedAddress = `${walletAddress.substring(
      0,
      6
    )}...${walletAddress.substring(walletAddress.length - 4)}`;

    // Create semi-transparent background
    const bg = this.add.rectangle(0, 0, 200, 90, 0x330033, 0.7);
    bg.setStrokeStyle(1, 0xff00ff);
    this.walletInfoContainer.add(bg);

    // Create wallet label
    const walletLabel = this.add.text(-85, -35, "WALLET:", {
      fontFamily: "Tektur, Arial",
      fontSize: "14px",
      color: "#ff00ff",
    });
    this.walletInfoContainer.add(walletLabel);

    // Create wallet address text
    const addressText = this.add.text(0, -35, truncatedAddress, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#ffffff",
    });
    addressText.setOrigin(0, 0);
    this.walletInfoContainer.add(addressText);

    // Create bonk balance label
    const bonkLabel = this.add.text(-85, -10, "BONK:", {
      fontFamily: "Tektur, Arial",
      fontSize: "14px",
      color: "#ff00ff",
    });
    this.walletInfoContainer.add(bonkLabel);

    // Get bonk balance and format it
    const bonkBalance = this.playerAccount.getBonkBalance() || 0;
    const formattedBalance = bonkBalance.toLocaleString();

    // Create bonk balance text
    const balanceText = this.add.text(0, -10, formattedBalance, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#ffffff",
    });
    balanceText.setOrigin(0, 0);
    this.walletInfoContainer.add(balanceText);

    // Create bonk balance label
    const accountBalanceLabel = this.add.text(-85, 15, "Account Balance:", {
      fontFamily: "Tektur, Arial",
      fontSize: "14px",
      color: "#ff00ff",
    });
    this.walletInfoContainer.add(accountBalanceLabel);

    // Get bonk balance and format it
    const accountBalance = this.playerAccount.getGameAccountBalance() || 0;
    const formattedAccountBalanceBalance = accountBalance.toLocaleString();

    // Create bonk balance text
    const accountBalanceText = this.add.text(
      0,
      15,
      formattedAccountBalanceBalance,
      {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffffff",
      }
    );
    balanceText.setOrigin(0, 0);
    this.walletInfoContainer.add(accountBalanceText);

    // Set container origin to top right
    this.walletInfoContainer.setPosition(120, 70);
  }

  // Show game code entry dialog for joining co-op games
  showGameCodeEntryDialog() {
    // Create a background overlay
    const overlay = this.add.rectangle(
      0,
      0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.7
    );
    overlay.setOrigin(0, 0);
    overlay.setDepth(1000);

    // Create a container for the dialog
    const dialogContainer = this.add.container(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2
    );
    dialogContainer.setDepth(1001);

    // Create dialog background
    const dialogBg = this.add.rectangle(0, 0, 400, 300, 0x330033, 0.9);
    dialogBg.setStrokeStyle(2, 0x00ffff);
    dialogContainer.add(dialogBg);

    // Create dialog title
    const title = this.add.text(0, -100, "ENTER GAME CODE", {
      fontFamily: "Tektur, Arial",
      fontSize: "24px",
      color: "#00ffff",
      align: "center",
    });
    title.setOrigin(0.5);
    dialogContainer.add(title);

    // Create input field using DOM element
    const codeInputDiv = document.createElement("div");
    codeInputDiv.style.position = "absolute";
    codeInputDiv.style.left = "50%";
    codeInputDiv.style.top = "50%";
    codeInputDiv.style.transform = "translate(-50%, -50%)";
    codeInputDiv.style.zIndex = "1002";

    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.maxLength = 6;
    codeInput.style.width = "150px";
    codeInput.style.padding = "10px";
    codeInput.style.fontSize = "20px";
    codeInput.style.textAlign = "center";
    codeInput.style.backgroundColor = "#220033";
    codeInput.style.color = "#ffffff";
    codeInput.style.border = "2px solid #00ffff";
    codeInput.style.borderRadius = "5px";
    codeInput.style.outline = "none";
    codeInput.style.textTransform = "uppercase";

    // Append the input to the wrapper
    codeInputDiv.appendChild(codeInput);

    // Add the input to the DOM
    document.body.appendChild(codeInputDiv);

    // Focus the input
    codeInput.focus();

    // Create error text (hidden initially)
    const errorText = this.add.text(0, 40, "Invalid code. Please try again.", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ff0000",
      align: "center",
    });
    errorText.setOrigin(0.5);
    errorText.setVisible(false);
    dialogContainer.add(errorText);

    // Create Join button
    const joinButton = this.add.rectangle(0, 80, 150, 50, 0x00cc66, 0.8);
    joinButton.setStrokeStyle(2, 0xffffff);
    dialogContainer.add(joinButton);

    const joinText = this.add.text(0, 80, "JOIN", {
      fontFamily: "Arial Black",
      fontSize: "20px",
      color: "#ffffff",
    });
    joinText.setOrigin(0.5);
    dialogContainer.add(joinText);

    // Create Cancel button
    const cancelButton = this.add.rectangle(0, 140, 150, 50, 0xaa0000, 0.8);
    cancelButton.setStrokeStyle(2, 0xffffff);
    dialogContainer.add(cancelButton);

    const cancelText = this.add.text(0, 140, "CANCEL", {
      fontFamily: "Arial Black",
      fontSize: "20px",
      color: "#ffffff",
    });
    cancelText.setOrigin(0.5);
    dialogContainer.add(cancelText);

    // Make buttons interactive
    joinButton.setInteractive({ useHandCursor: true });
    cancelButton.setInteractive({ useHandCursor: true });

    // Join button hover effect
    joinButton.on("pointerover", () => {
      joinButton.fillColor = 0x00ff88;
      joinText.setScale(1.1);
    });

    joinButton.on("pointerout", () => {
      joinButton.fillColor = 0x00cc66;
      joinText.setScale(1);
    });

    // Cancel button hover effect
    cancelButton.on("pointerover", () => {
      cancelButton.fillColor = 0xff0000;
      cancelText.setScale(1.1);
    });

    cancelButton.on("pointerout", () => {
      cancelButton.fillColor = 0xaa0000;
      cancelText.setScale(1);
    });

    // Validate and join game with the entered code
    const validateAndJoin = () => {
      const code = codeInput.value.toUpperCase();

      // Basic validation - must be 6 characters
      if (code.length === 6) {
        // Clean up HTML elements
        document.body.removeChild(codeInputDiv);
        overlay.destroy();
        dialogContainer.destroy();

        // Set as player2 in registry with specific game code
        this.registry.set("forceHost", false);
        this.registry.set("gameCode", code);

        // Go to lobby scene
        this.scene.start("LobbyScene");
      } else {
        // Show error message
        errorText.setVisible(true);

        // Shake the input
        this.tweens.add({
          targets: codeInput,
          x: { from: 0, to: 10 },
          duration: 50,
          repeat: 3,
          yoyo: true,
          onComplete: () => {
            codeInput.style.transform = "translateX(0)";
          },
        });
      }
    };

    // Join button click handler
    joinButton.on("pointerdown", validateAndJoin);

    // Add enter key handler for input field
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        validateAndJoin();
      }
    });

    // Cancel button click handler
    cancelButton.on("pointerdown", () => {
      // Clean up HTML elements
      document.body.removeChild(codeInputDiv);
      overlay.destroy();
      dialogContainer.destroy();
    });
  }

  // Show co-op role selection dialog
  showCoopRoleDialog() {
    // Create a background overlay
    const overlay = this.add.rectangle(
      0,
      0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.7
    );
    overlay.setOrigin(0, 0);
    overlay.setDepth(1000);

    // Create a container for the dialog
    const dialogContainer = this.add.container(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2
    );
    dialogContainer.setDepth(1001);

    // Create dialog background
    const dialogBg = this.add.rectangle(0, 0, 400, 300, 0x330033, 0.9);
    dialogBg.setStrokeStyle(2, 0x00ffff);
    dialogContainer.add(dialogBg);

    // Create dialog title
    const title = this.add.text(0, -110, "SELECT ROLE", {
      fontFamily: "Tektur, Arial",
      fontSize: "24px",
      color: "#00ffff",
      align: "center",
    });
    title.setOrigin(0.5);
    dialogContainer.add(title);

    // Create host button
    const hostButton = this.add.rectangle(0, -50, 250, 60, 0x006699, 0.8);
    hostButton.setStrokeStyle(2, 0xffffff);
    dialogContainer.add(hostButton);

    const hostText = this.add.text(0, -50, "HOST GAME", {
      fontFamily: "Tektur, Arial",
      fontSize: "20px",
      color: "#ffffff",
    });
    hostText.setOrigin(0.5);
    dialogContainer.add(hostText);

    // Create join button
    const joinButton = this.add.rectangle(0, 30, 250, 60, 0x006699, 0.8);
    joinButton.setStrokeStyle(2, 0xffffff);
    dialogContainer.add(joinButton);

    const joinText = this.add.text(0, 30, "JOIN GAME", {
      fontFamily: "Tektur, Arial",
      fontSize: "20px",
      color: "#ffffff",
    });
    joinText.setOrigin(0.5);
    dialogContainer.add(joinText);

    // Create cancel button
    const cancelButton = this.add.rectangle(0, 100, 150, 40, 0x333333, 0.8);
    cancelButton.setStrokeStyle(1, 0xaaaaaa);
    dialogContainer.add(cancelButton);

    const cancelText = this.add.text(0, 100, "CANCEL", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#aaaaaa",
    });
    cancelText.setOrigin(0.5);
    dialogContainer.add(cancelText);

    // Make buttons interactive
    hostButton.setInteractive({ useHandCursor: true });
    joinButton.setInteractive({ useHandCursor: true });
    cancelButton.setInteractive({ useHandCursor: true });

    // Add hover effects
    hostButton.on("pointerover", () => {
      hostButton.fillColor = 0x00aaff;
      hostText.setScale(1.1);
    });

    hostButton.on("pointerout", () => {
      hostButton.fillColor = 0x006699;
      hostText.setScale(1);
    });

    joinButton.on("pointerover", () => {
      joinButton.fillColor = 0x00aaff;
      joinText.setScale(1.1);
    });

    joinButton.on("pointerout", () => {
      joinButton.fillColor = 0x006699;
      joinText.setScale(1);
    });

    cancelButton.on("pointerover", () => {
      cancelButton.fillColor = 0x555555;
      cancelText.setScale(1.1);
    });

    cancelButton.on("pointerout", () => {
      cancelButton.fillColor = 0x333333;
      cancelText.setScale(1);
    });

    // Add click handlers
    hostButton.on("pointerdown", () => {
      // Close dialog
      overlay.destroy();
      dialogContainer.destroy();

      // Set as host in registry
      this.registry.set("isHost", true);
      this.registry.set("multiplayer", true);
      this.registry.set("forceHost", true);

      // Start character select before lobby
      this.scene.start("CharacterSelectScene");
    });

    joinButton.on("pointerdown", () => {
      // Close dialog
      overlay.destroy();
      dialogContainer.destroy();

      // Show game code entry dialog
      this.showGameCodeEntryDialog();
    });

    cancelButton.on("pointerdown", () => {
      overlay.destroy();
      dialogContainer.destroy();
    });
  }

  // Create scanlines effect
  createScanlines() {
    const scanlineGraphics = this.add.graphics();
    scanlineGraphics.lineStyle(1, 0x000000, 0.2);

    // Draw horizontal lines across the screen
    for (let y = 0; y < this.cameras.main.height; y += 4) {
      scanlineGraphics.beginPath();
      scanlineGraphics.moveTo(0, y);
      scanlineGraphics.lineTo(this.cameras.main.width, y);
      scanlineGraphics.closePath();
      scanlineGraphics.strokePath();
    }

    return scanlineGraphics;
  }

  // Show a commercial cutscene
  showCommercial() {
    // Start preloading dialog assets immediately when commercial starts
    // This ensures they're ready when the game scene loads
    this.preloadDialogAssets();

    // Create a black screen overlay
    const overlay = this.add.rectangle(
      0,
      0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000
    );
    overlay.setOrigin(0, 0);
    overlay.setDepth(1000);

    // Disable all input during commercial
    this.disableAllInput();

    // Check if in portrait mode
    const isPortrait = this.cameras.main.height > this.cameras.main.width;

    // Available commercial products
    const commercials = [
      {
        images: { portrait: "bonkosPortrait", wide: "bonkosWide" },
        sound: "becomeSponsor",
      },
      {
        images: { portrait: "organtradePortrait", wide: "organtradeWide" },
        sound: "organTrading",
      },
      {
        images: { portrait: "psg1Portrait", wide: "psg1Wide" },
        sound: "psg1",
      },
      {
        images: { portrait: "wifPortrait", wide: "wifWide" },
        sound: "wif",
      },
    ];

    // Initialize static counter if it doesn't exist
    if (typeof this.constructor.commercialCounter === "undefined") {
      this.constructor.commercialCounter = 0;
    } else {
      this.constructor.commercialCounter++;
    }

    // Select a random commercial
    const commercial = Phaser.Utils.Array.GetRandom(commercials);

    // Add the commercial image
    const productImage = this.add.image(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      isPortrait ? commercial.images.portrait : commercial.images.wide
    );
    productImage.setOrigin(0.5, 0.5);
    productImage.setDepth(1001);

    // Set image to stretch to fill the screen completely in both modes
    productImage.setDisplaySize(
      this.cameras.main.width,
      this.cameras.main.height
    );

    // Simple fixed text for top and bottom
    const textStyle = {
      fontFamily: "Tektur, Arial",
      fontSize: "40px",
      color: "#FFFFFF",
      stroke: "#000000",
      strokeThickness: 6,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: "#000000",
        blur: 10,
        stroke: true,
        fill: true,
      },
    };

    // Show text on every other ad (even-numbered commercials)
    let topText = null;
    let bottomText = null;

    if (this.constructor.commercialCounter % 2 === 0) {
      // Top text - "Burn Credits"
      topText = this.add.text(
        this.cameras.main.width / 2, // Center horizontally
        this.cameras.main.height * 0.1,
        "BURN CREDITS",
        textStyle
      );
      topText.setOrigin(0.5, 0.5); // Center the text
      topText.setDepth(1002);

      // Bottom text - "Buy your add"
      bottomText = this.add.text(
        this.cameras.main.width / 2, // Center horizontally
        this.cameras.main.height * 0.9,
        "BUY YOUR ADD",
        textStyle
      );
      bottomText.setOrigin(0.5, 0.5); // Center the text
      bottomText.setDepth(1002);

      // Add a subtle scale animation to both texts
      this.tweens.add({
        targets: [topText, bottomText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Select intro sound - either "sponsored by" or "today's games"
    const introSounds = ["sonponsoredBy", "todaysgames"];
    const introSound = Phaser.Utils.Array.GetRandom(introSounds);

    // Play intro sound first
    let introSoundObj = this.sound.get(introSound);
    let introFallback = this.cachedAudioElements?.[introSound];
    let introSoundDuration = introSound === "sonponsoredBy" ? 1500 : 3100; // Sound-specific durations

    const playCommercialSound = () => {
      // Play commercial-specific sound
      let commercialSound = this.sound.get(commercial.sound);
      let commercialFallback = this.cachedAudioElements?.[commercial.sound];

      if (commercialSound) {
        commercialSound.play({ volume: 1.0 });
      } else if (commercialFallback) {
        commercialFallback.currentTime = 0;
        commercialFallback.volume = 1.0;
        commercialFallback.play().catch((error) => {
          console.error(`Error playing cached commercial sound:`, error);
        });
      } else {
        // Last resort fallback
        try {
          commercialFallback = new Audio(
            `assets/sound/comercials/${commercial.sound}.mp3`
          );
          commercialFallback.volume = 1.0;
          commercialFallback.play();
          // Save for future use
          if (!this.cachedAudioElements) this.cachedAudioElements = {};
          this.cachedAudioElements[commercial.sound] = commercialFallback;
        } catch (error) {
          console.error(`Failed to play commercial sound fallback:`, error);
        }
      }

      // Store reference to stop later
      return { sound: commercialSound, fallback: commercialFallback };
    };

    // Play intro sound first, then commercial sound
    if (introSoundObj) {
      introSoundObj.play({ volume: 1.0 });
      this.time.delayedCall(introSoundDuration, playCommercialSound);
    } else if (introFallback) {
      introFallback.currentTime = 0;
      introFallback.volume = 1.0;
      introFallback.play().catch((error) => {
        console.error(`Error playing cached intro sound:`, error);
        // If intro fails, play commercial sound immediately
        playCommercialSound();
      });
      this.time.delayedCall(introSoundDuration, playCommercialSound);
    } else {
      // Last resort fallback for intro sound
      try {
        introFallback = new Audio(`assets/sound/comercials/${introSound}.mp3`);
        introFallback.volume = 1.0;
        introFallback.play();
        // Save for future use
        if (!this.cachedAudioElements) this.cachedAudioElements = {};
        this.cachedAudioElements[introSound] = introFallback;
        this.time.delayedCall(introSoundDuration, playCommercialSound);
      } catch (error) {
        console.error(`Failed to play intro sound fallback:`, error);
        // If intro fails, play commercial sound immediately
        const commercialSoundObjs = playCommercialSound();
      }
    }

    // Duration of commercial before showing enter arena cutscene
    const commercialDuration = 4500; // 4.5 seconds

    // Transition to enter arena cutscene after commercial ends
    this.time.delayedCall(commercialDuration + introSoundDuration, () => {
      // Stop any sounds
      const sounds = ["sonponsoredBy", "todaysgames", commercial.sound];

      sounds.forEach((soundKey) => {
        const sound = this.sound.get(soundKey);
        const fallback = this.cachedAudioElements?.[soundKey];

        if (sound) {
          sound.stop();
        }
        if (fallback) {
          fallback.pause();
          fallback.currentTime = 0;
        }
      });

      // Clean up commercial elements
      productImage.destroy();
      if (topText) topText.destroy();
      if (bottomText) bottomText.destroy();

      // Begin the arena cutscene, reusing the overlay
      this.showEnterArenaCutscene(overlay);
    });
  }

  // Preload dialog assets for the selected character
  preloadDialogAssets() {
    // Get the selected character
    const selectedCharacter =
      this.registry.get("selectedCharacter") || "default";
    console.log(`Preloading dialog assets for character: ${selectedCharacter}`);

    // If the character is character2 (Drainer), load Drainer-specific assets
    if (selectedCharacter === "character2") {
      // Preload Drainer image assets
      if (!this.textures.exists("story/character2/intro/drainer")) {
        this.load.image(
          "story/character2/intro/drainer",
          "assets/story/character2/intro/drainer.png"
        );
      }

      if (!this.textures.exists("story/character2/intro/networkExec")) {
        this.load.image(
          "story/character2/intro/networkExec",
          "assets/story/character2/intro/networkExec.png"
        );
      }

      // Preload Drainer sound assets
      if (!this.sound.get("character2_dialog1")) {
        this.load.audio(
          "character2_dialog1",
          "assets/sound/story/drainer/intro/character2_dialog1.mp3"
        );
      }

      if (!this.sound.get("character2_dialog3")) {
        this.load.audio(
          "character2_dialog3",
          "assets/sound/story/drainer/intro/character2_dialog3.mp3"
        );
      }

      if (!this.sound.get("character2_dialog4")) {
        this.load.audio(
          "character2_dialog4",
          "assets/sound/story/drainer/intro/character2_dialog4.mp3"
        );
      }
    } else {
      // Preload standard dialog assets for other characters
      const characterPath =
        selectedCharacter === "default" ? "degen" : selectedCharacter;

      // Load character image
      if (
        !this.textures.exists(
          selectedCharacter === "default" ? "degen" : selectedCharacter
        )
      ) {
        this.load.image(
          selectedCharacter === "default" ? "degen" : selectedCharacter,
          `assets/story/${characterPath}/intro/${
            selectedCharacter === "default" ? "degen" : selectedCharacter
          }.png`
        );
      }

      // Load girl image
      if (!this.textures.exists("girl")) {
        this.load.image("girl", `assets/story/${characterPath}/intro/girl.png`);
      }

      // Load network exec image
      if (!this.textures.exists("networkExec")) {
        this.load.image(
          "networkExec",
          `assets/story/${characterPath}/intro/networkExec.png`
        );
      }

      // Load dialog sounds
      for (let i = 1; i <= 4; i++) {
        const soundKey = `dialog${i}`;
        if (!this.sound.get(soundKey)) {
          this.load.audio(
            soundKey,
            `assets/sound/story/degen/intro/${soundKey}.mp3`
          );
        }
      }
    }

    // Start loading all the assets
    this.load.start();

    // Add loading completion callback for debug
    this.load.once("complete", () => {
      console.log("Dialog asset preloading complete!");
    });
  }

  // Disable all input during cutscenes
  disableAllInput() {
    this.input.keyboard.enabled = false;
    this.input.mouse.enabled = false;
    if (this.touchController) {
      this.touchController.hide();
    }
  }

  // Enable input after cutscenes
  enableAllInput() {
    this.input.keyboard.enabled = true;
    this.input.mouse.enabled = true;
    if (this.touchController && this.isMobile) {
      this.touchController.show();
    }
  }

  // Create the hype screen before starting the game
  createHypeScreen() {
    // Hide wallet UI during cutscene
    const walletUI = document.getElementById("wallet-ui");
    if (walletUI) {
      walletUI.style.display = "none";
    }

    // Create a background overlay
    const overlay = this.add.rectangle(
      0,
      0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000
    );
    overlay.setOrigin(0, 0);
    overlay.setDepth(1000);

    // Play interference sound for the GET HYPED text
    let interferenceSound = this.sound.get("interference");
    let fallbackAudio = this.cachedAudioElements
      ? this.cachedAudioElements["interference"]
      : null;

    if (interferenceSound) {
      // Use a one-shot sound that won't loop
      interferenceSound.play({ volume: 1.0 });
    } else if (fallbackAudio) {
      console.log("Using cached interference sound");
      fallbackAudio.currentTime = 0;
      fallbackAudio.volume = 1.0;
      fallbackAudio.play().catch((error) => {
        console.error("Error playing cached interference sound:", error);
      });
    } else {
      console.warn("Interference sound not found in any cache");

      // Last resort fallback
      try {
        fallbackAudio = new Audio("assets/sound/sfx/interference.mp3");
        fallbackAudio.volume = 1.0;
        fallbackAudio.play();
        // Save for future use
        if (!this.cachedAudioElements) this.cachedAudioElements = {};
        this.cachedAudioElements["interference"] = fallbackAudio;
      } catch (error) {
        console.error("Failed to play interference sound fallback:", error);
      }
    }

    // Explicitly stop sound after 333ms
    this.time.delayedCall(333, () => {
      if (interferenceSound) {
        interferenceSound.stop();
      }
      if (fallbackAudio) {
        fallbackAudio.pause();
        fallbackAudio.currentTime = 0;
      }
    });

    // Additional safety: Make sure sound stops when leaving this scene
    this.events.once("shutdown", () => {
      if (interferenceSound) {
        interferenceSound.stop();
      }
      if (fallbackAudio) {
        fallbackAudio.pause();
        fallbackAudio.currentTime = 0;
      }
    });

    // Calculate responsive font size based on screen width
    // Using 90% of screen width as target size
    const screenWidth = this.cameras.main.width;
    const text = "GET HYPED";
    const targetWidth = screenWidth * 0.9;

    // Start with a base font size and adjust
    let fontSize = 100;
    const tempText = this.add.text(0, 0, text, {
      fontFamily: "Arial Black",
      fontSize: `${fontSize}px`,
    });

    // Scale the font size to match desired width
    const scaleFactor = targetWidth / tempText.width;
    fontSize = Math.floor(fontSize * scaleFactor);
    tempText.destroy();

    // Add the "GET HYPED" text with calculated size
    const hypeText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      text,
      {
        fontFamily: "Arial Black",
        fontSize: `${fontSize}px`,
        color: "#ffffff",
        align: "center",
      }
    );
    hypeText.setOrigin(0.5);
    hypeText.setDepth(1001); // Ensure it's above the overlay

    // Add glitch effect to the text
    this.time.addEvent({
      delay: 50,
      callback: () => {
        // Random position glitch effect
        if (Math.random() > 0.5) {
          hypeText.x += Phaser.Math.Between(-10, 10);
          hypeText.y += Phaser.Math.Between(-8, 8);

          // Reset position after brief delay
          this.time.delayedCall(30, () => {
            hypeText.x = this.cameras.main.width / 2;
            hypeText.y = this.cameras.main.height / 2;
          });
        }

        // Black and white glitch effect
        if (Math.random() > 0.7) {
          // Alternate between white and black
          if (Math.random() > 0.5) {
            // Set to white
            hypeText.setTint(0xffffff);
          } else {
            // Set to black (effectively making it invisible against the black background)
            hypeText.setTint(0x000000);
          }

          // Reset color after brief delay
          this.time.delayedCall(40, () => {
            hypeText.clearTint();
          });
        }
      },
      repeat: 5,
    });

    // Start the commercial after 333 milliseconds
    this.time.delayedCall(333, () => {
      // First show a commercial, then the arena entrance cutscene
      this.showCommercial();
    });
  }

  showConnectWalletWarning() {
    // Check if scanlines exist and temporarily store their depth
    let scanlinesDepth = 0;
    if (this.scanlines) {
      scanlinesDepth = this.scanlines.depth || 0;
      this.scanlines.destroy();
    }

    // Check if warning already exists
    if (this.warningText) {
      // If it exists, reset the animation
      this.warningText.setAlpha(1);
      this.time.removeEvent(this.warningFadeEvent);
      this.tweens.killTweensOf(this.warningText);
    } else {
      // Calculate responsive font size for warning text
      const screenWidth = this.cameras.main.width;
      let warningFontSize = Math.max(20, Math.floor(screenWidth * 0.038)); // 3.8% of screen width, minimum 20px

      // Create warning text matching the style of other menu elements but in red
      this.warningText = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height * 0.88, // Positioned below tutorial button
        "CONNECT WALLET TO PLAY!",
        {
          fontFamily: "Arial Black", // Same as other menu text
          fontSize: `${warningFontSize}px`,
          color: "#ff0000", // Red text
          stroke: "#000000",
          strokeThickness: 6,
          shadow: {
            offsetX: 2,
            offsetY: 2,
            color: "#aa0000", // Darker red shadow
            blur: 5,
            stroke: true,
            fill: true,
          },
        }
      );
      this.warningText.setOrigin(0.5);
    }

    // Now recreate the scanlines so they're on top of the warning
    this.scanlines = this.createScanlines();
    if (scanlinesDepth > 0) {
      this.scanlines.setDepth(scanlinesDepth);
    }

    // Just animate the warning text
    const warningElements = [this.warningText];

    // Add shaking animation to the warning text
    this.tweens.add({
      targets: warningElements,
      x: {
        from: this.cameras.main.width / 2 - 10,
        to: this.cameras.main.width / 2 + 10,
      },
      duration: 60,
      yoyo: true,
      repeat: 5,
      ease: "Sine.easeInOut",
    });

    // Fade out after 2 seconds
    this.warningFadeEvent = this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: warningElements,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          if (this.warningText) {
            this.warningText.destroy();
            this.warningText = null;
          }
        },
      });
    });
  }

  preloadCutsceneSounds() {
    console.log("Preloading cutscene sound effects");

    // Array of cutscene sound paths
    const cutsceneSounds = [
      { key: "crowd_roar", path: "assets/sound/sfx/crowd_roar.mp3" },
      { key: "interference", path: "assets/sound/sfx/interference.mp3" },
    ];

    // Create and cache audio elements for each sound
    cutsceneSounds.forEach(({ key, path }) => {
      try {
        const audio = new Audio(path);
        audio.volume = 1.0;
        // Store for future use
        this.cachedAudioElements[key] = audio;
        console.log(`Preloaded audio for ${key}: ${path}`);
      } catch (e) {
        console.error(`Error preloading audio for ${key}:`, e);
      }
    });
  }

  create() {
    // Show wallet UI in MenuScene
    const walletUI = document.getElementById("wallet-ui");
    if (walletUI) {
      walletUI.style.display = "block";
    }

    // Ensure the player account has been initialized
    if (!this.playerAccount) {
      console.error("PlayerAccount not initialized! This shouldn't happen.");
      this.playerAccount = new PlayerAccount(this);
      // Re-setup event listeners
      this.events.on(
        "player-authenticated",
        this.handlePlayerAuthenticated,
        this
      );
      this.events.on(
        "player-disconnected",
        this.handlePlayerDisconnected,
        this
      );
    }

    // IMPORTANT: Always clean up deposit/withdraw prompt when creating the menu scene
    // This ensures we start with a fresh prompt when needed
    if (this.depositWithdrawPrompt) {
      console.log("MenuScene: Cleaning up existing DepositWithdrawPrompt");
      if (this.depositWithdrawPrompt.cleanup) {
        this.depositWithdrawPrompt.cleanup();
      }
      this.depositWithdrawPrompt = null;
    }

    // Initialize the deposit/withdraw prompt
    this.depositWithdrawPrompt = new DepositWithdrawPrompt(this);
    this.depositWithdrawPrompt.create();

    console.log(
      "Menu scene created. Wallet connected:",
      this.playerAccount.isPlayerAuthenticated()
    );

    // If we're coming from the tutorial, immediately go to the hype screen
    if (this.startHypeScreen && this.playerAccount.isPlayerAuthenticated()) {
      console.log("Coming from tutorial, going straight to GET HYPED screen");
      // Short delay to let the scene initialize before transitioning
      this.time.delayedCall(100, () => {
        this.createHypeScreen();
      });
      return;
    }

    // Get the intro music from registry and start playing it
    this.introMusic = this.registry.get("introMusic");
    const audioUnlocked = this.registry.get("audioUnlocked");

    // Check for detected input method from StartScene
    this.inputMethod = this.registry.get("inputMethod") || null;
    console.log(`Menu scene using input method: ${this.inputMethod}`);

    // Setup scene-specific audio unlock
    const unlockAudio = () => {
      // Only do this once
      if (!this.registry.get("audioUnlocked") && this.introMusic) {
        // Set the flag to true to avoid duplicates
        this.registry.set("audioUnlocked", true);

        // Only adjust volume for continuous music
        console.log(
          "Ensuring music continues playing after user interaction in MenuScene"
        );
        this.introMusic.volume = 0.53; // Increased by 33% (0.4 * 1.33 = 0.53)

        // Only play if the music isn't already playing (which it should be from IntroScene)
        if (!this.introMusic.isPlaying) {
          console.log("Music wasn't playing, starting it now");
          this.introMusic.play();
        }
      }
    };

    // Add input handlers to unlock audio
    this.input.on("pointerdown", unlockAudio);
    this.input.keyboard.on("keydown", unlockAudio);

    // Initialize gamepad support if available
    this.setupGamepadSupport();

    // Check for existing scroll_beat music from IntroScene
    const existingScrollBeatMusic = this.registry.get("scrollBeatMusic");

    if (existingScrollBeatMusic) {
      // Continue using the existing scroll_beat music instance
      console.log("Using existing scroll_beat music from IntroScene");
      this.scrollBeatMusic = existingScrollBeatMusic;

      // Make sure it's playing and at the right volume
      if (!this.scrollBeatMusic.isPlaying) {
        this.scrollBeatMusic.play();
      }
      this.scrollBeatMusic.setVolume(0.8);

      // Store in registry under consistent key for other scenes
      this.registry.set("menuMusic", this.scrollBeatMusic);
    }
    // If no existing scroll_beat music, create new instance
    else if (audioUnlocked) {
      console.log(
        "No existing scroll_beat music, creating new instance for MenuScene"
      );

      // According to the pattern: "MenuScene - scroll_beat"
      // Need to stop introMusic (intro.mp3) if it's playing
      if (this.introMusic && this.introMusic.isPlaying) {
        this.introMusic.stop();
      }

      // Check if scroll_beat music exists in cache and play it
      if (this.cache.audio.exists("scroll_beat")) {
        this.scrollBeatMusic = this.sound.add("scroll_beat", {
          volume: 0.8,
          loop: true,
        });
        this.scrollBeatMusic.play();

        // Store in registry for other scenes to use
        this.registry.set("menuMusic", this.scrollBeatMusic);
        this.registry.set("scrollBeatMusic", this.scrollBeatMusic);
      } else {
        console.warn("Scroll beat music not found in cache");
      }
    }

    // Add cyberpunk-themed background
    this.cameras.main.setBackgroundColor(0x120326);

    // Create the animated title
    // Check if we're in portrait mode
    const isPortrait = this.cameras.main.height > this.cameras.main.width;

    // Calculate responsive font size for title based on screen width
    const screenWidth = this.cameras.main.width;
    const titleText = "BONK GAMES";

    // Different target widths based on orientation
    // In landscape, reduce to 50% of the standard size
    const targetWidth = isPortrait ? screenWidth * 0.8 : screenWidth * 0.4;

    // Start with a base font size and adjust - smaller in non-portrait
    let titleFontSize = isPortrait ? 80 : 40;
    const tempTitle = this.add.text(0, 0, titleText, {
      fontFamily: '"Tektur", monospace, Courier, Arial',
      fontSize: `${titleFontSize}px`,
    });

    // Scale the font size to match desired width
    const titleScaleFactor = targetWidth / tempTitle.width;
    titleFontSize = Math.floor(titleFontSize * titleScaleFactor);
    tempTitle.destroy();

    // Position the title closer to the logo but not too high
    const titleY = this.cameras.main.height * 0.42; // Slightly lower than previous position
    const title = this.add.text(
      this.cameras.main.width / 2,
      titleY,
      titleText,
      {
        fontFamily: '"Tektur", monospace, Courier, Arial',
        fontSize: `${titleFontSize}px`,
        color: "#ff00ff",
        stroke: "#000000",
        strokeThickness: 8,
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: "#00ffff",
          blur: 10,
          stroke: true,
          fill: true,
        },
      }
    );
    title.setOrigin(0.5);

    // Add the logo directly using Phaser - simplest approach
    if (this.textures.exists("game_logo")) {
      // Check if we're in portrait mode
      const isPortrait = this.cameras.main.height > this.cameras.main.width;

      // Create a background container for the logo
      const logoBackground = this.add.rectangle(
        this.cameras.main.width / 2,
        this.cameras.main.height * 0.25,
        this.cameras.main.width,
        isPortrait ? 100 : 200, // Smaller in portrait mode
        0x000000
      );
      logoBackground.setAlpha(0.3);

      // Add the logo
      const logo = this.add.image(
        this.cameras.main.width / 2,
        this.cameras.main.height * 0.25,
        "game_logo"
      );

      // Scale logo based on orientation - further reduced to 3/4 the size
      // Original portrait scale was 0.3, so 3/4 of that is 0.225
      // Original landscape scale was 0.3, so 3/4 of that is 0.225
      logo.setScale(isPortrait ? 0.225 : 0.225);
      logo.setTint(0xff00ff); // Magenta tint

      // Set a very low depth to ensure it's behind everything else
      logoBackground.setDepth(-10);
      logo.setDepth(-10);

      // Simple fixed delay for logo glitch
      this.time.addEvent({
        delay: 333, // Specific value as requested
        callback: () => {
          // Random glitch (70% chance)
          if (Math.random() > 0.3) {
            // Store original properties
            const originalX = logo.x;
            const originalY = logo.y;

            // Smaller position change
            logo.x += Phaser.Math.Between(-5, 5);
            logo.y += Phaser.Math.Between(-3, 3);

            // Occasional color change
            if (Math.random() > 0.6) {
              logo.setTint(0x00ffff); // Cyan tint
            }

            // Very rare flicker
            if (Math.random() > 0.9) {
              logo.setVisible(false);
              this.time.delayedCall(30, () => {
                logo.setVisible(true);
              });
            }

            // Reset after short delay
            this.time.delayedCall(100, () => {
              logo.x = originalX;
              logo.y = originalY;
              logo.setTint(0xff00ff); // Back to magenta
            });
          }
        },
        callbackScope: this,
        loop: true,
      });

      // Add a simple blue glow effect to the logo
      const logoGlow = this.add.image(
        this.cameras.main.width / 2,
        this.cameras.main.height * 0.25,
        "game_logo"
      );
      logoGlow.setScale(logo.scaleX * 1.05, logo.scaleY * 1.05); // Slightly larger
      logoGlow.setTint(0x00ffff); // Cyan glow
      logoGlow.setAlpha(0.4); // Semi-transparent
      logoGlow.setDepth(-11); // Behind the main logo

      // Add a subtler pulsing effect to the glow
      this.tweens.add({
        targets: logoGlow,
        alpha: { from: 0.2, to: 0.4 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });

      // Store reference to remove on scene shutdown
      this.logoElements = [logo, logoBackground];
    }

    // Clean up on scene shutdown
    this.events.once("shutdown", () => {
      if (this.logoElements) {
        this.logoElements.forEach((element) => {
          if (element && !element.destroyed) {
            element.destroy();
          }
        });
      }

      // Cleanup deposit/withdraw prompt if it exists
      if (this.depositWithdrawPrompt) {
        console.log("MenuScene Shutdown: Cleaning up DepositWithdrawPrompt");
        if (this.depositWithdrawPrompt.cleanup) {
          this.depositWithdrawPrompt.cleanup();
        }
        this.depositWithdrawPrompt = null;
      }
    });

    // Simple fixed delay for title glitch
    this.time.addEvent({
      delay: 222, // Specific value as requested
      callback: () => {
        // Random glitch effect (60% chance)
        if (Math.random() > 0.4) {
          // Store original position
          const originalX = title.x;
          const originalY = title.y;

          // Smaller random offset
          title.x += Phaser.Math.Between(-3, 3);
          title.y += Phaser.Math.Between(-2, 2);

          // Less frequent visibility flicker
          if (Math.random() > 0.85) {
            title.setVisible(false);
            this.time.delayedCall(30, () => {
              title.setVisible(true);
            });
          }

          // Occasional color change
          if (Math.random() > 0.7) {
            title.setColor("#00ffff");
          }

          // Reset everything after a short delay
          this.time.delayedCall(80, () => {
            title.x = originalX;
            title.y = originalY;
            title.setColor("#ff00ff");
          });
        }
      },
      callbackScope: this,
      loop: true,
    });

    // Subtle alpha pulsing
    this.tweens.add({
      targets: title,
      alpha: { from: 0.85, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    // We've removed the pulsating effect for the title

    // Subtitle has been removed

    // Check wallet connection status and show appropriate button
    this.createPlayOrConnectButton();

    // Create digital "noise" particles for cyberpunk effect
    this.particles = [];
    for (let i = 0; i < 100; i++) {
      // Create different types of particles
      let color, size, alpha;

      if (i % 3 === 0) {
        // Neon particles
        color = Phaser.Math.RND.pick([0x00ffff, 0xff00ff, 0xff3377, 0x66bbff]);
        size = Phaser.Math.FloatBetween(0.5, 2);
        alpha = Phaser.Math.FloatBetween(0.3, 0.7);
      } else {
        // Dust/static particles
        color = 0xcccccc;
        size = Phaser.Math.FloatBetween(0.5, 1.2);
        alpha = Phaser.Math.FloatBetween(0.1, 0.3);
      }

      const particle = this.add.circle(
        Phaser.Math.Between(0, this.cameras.main.width),
        Phaser.Math.Between(0, this.cameras.main.height),
        size,
        color,
        alpha
      );

      this.particles.push({
        obj: particle,
        speedX: Phaser.Math.FloatBetween(-0.4, 0.4),
        speedY: Phaser.Math.FloatBetween(-0.2, 0.2),
        glitch: Math.random() > 0.8, // Some particles will "glitch"
      });
    }

    // Add version info at the bottom
    // Calculate responsive font size for version text
    let versionFontSize = Math.max(10, Math.floor(screenWidth * 0.02)); // 2% of screen width, minimum 10px

    const versionText = this.add.text(
      this.cameras.main.width - 20,
      this.cameras.main.height - 20,
      "PROTO v0.3 • WEB3 EDITION",
      {
        fontFamily: '"Tektur", monospace, Courier, Arial',
        fontSize: `${versionFontSize}px`,
        color: "#666666",
      }
    );
    versionText.setOrigin(1, 1);

    // If wallet is connected, show wallet information
    if (this.playerAccount.isPlayerAuthenticated()) {
      this.createWalletInfo();
    }

    // Add a scanline effect after everything else so it's on top
    this.scanlines = this.createScanlines();
    this.scanlines.setDepth(100); // Ensure it's above everything
  }

  createPlayOrConnectButton() {
    // Clean up any existing buttons
    if (this.playButton) {
      this.playButton.destroy();
      this.playButtonContainer.destroy();
    }

    if (this.tutorialButton) {
      this.tutorialButton.destroy();
      this.tutorialButtonContainer.destroy();
    }

    if (this.characterSelectButton) {
      this.characterSelectButton.destroy();
      this.characterSelectButtonContainer.destroy();
    }

    if (this.walletButton) {
      this.walletButton.destroy();
      this.walletButtonContainer.destroy();
    }

    if (this.atmButton) {
      this.atmButton.destroy();
      this.atmButtonContainer.destroy();
    }

    // Create the play button
    this.createPlayButton();

    // Create the wallet deposit button
    this.createWalletDepositButton();

    // Create the ATM button
    this.createATMButton();

    // Update button states based on authentication
    this.updateButtonStates();
  }

  // Create the play button
  createPlayButton() {
    const buttonY = this.cameras.main.height * 0.55; // Position with more space below title (moved up)

    // Create container for Play button
    this.playButtonContainer = this.add.container(
      this.cameras.main.width / 2,
      buttonY
    );

    // Create glow effect
    const playGlow = this.add.rectangle(0, 0, 180, 90, 0xff00ff, 0.2);
    this.playButtonContainer.add(playGlow);

    // Add pulsating animation to the glow
    this.tweens.add({
      targets: playGlow,
      alpha: { from: 0.2, to: 0.4 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    // Calculate responsive font size for play button
    const screenWidth = this.cameras.main.width;
    const isPortrait = this.cameras.main.height > this.cameras.main.width;

    // In non-portrait modes, buttons should be 50% smaller
    const sizeMultiplier = isPortrait ? 1 : 0.5;
    let playFontSize = Math.max(
      30 * sizeMultiplier,
      Math.floor(screenWidth * 0.062 * sizeMultiplier)
    ); // 6.2% of screen width, minimum 30px

    // Create play button
    this.playButton = this.add.text(0, 0, "SINGLE PLAYER", {
      fontFamily: '"Tektur", monospace, Courier, Arial',
      fontSize: `${playFontSize}px`,
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 6,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#ff00ff",
        blur: 5,
        stroke: true,
        fill: true,
      },
    });
    this.playButton.setOrigin(0.5);

    // Add to container
    this.playButtonContainer.add(this.playButton);

    // Add hover effect for the play button when enabled
    this.playButton.on("pointerover", () => {
      if (this.playerAccount.isPlayerAuthenticated()) {
        this.playButton.setColor("#00ffff");
        this.playButton.setScale(1.1);
        playGlow.alpha = 0.5;
      }
    });

    this.playButton.on("pointerout", () => {
      if (this.playerAccount.isPlayerAuthenticated()) {
        this.playButton.setColor("#ffffff");
        this.playButton.setScale(1);
        playGlow.alpha = 0.2;
      }
    });

    // Add click event for the play button
    this.playButton.on("pointerdown", () => {
      // Only start the game if wallet is connected
      if (this.playerAccount.isPlayerAuthenticated()) {
        // Record that we're playing single player
        this.registry.set("multiplayer", false);

        // Check if the tutorial has been completed
        const tutorialCompleted =
          localStorage.getItem("tutorialCompleted") === "true";
        // Check if player has already had their first game
        const hadFirstGame = localStorage.getItem("hadFirstGame") === "true";

        if (!tutorialCompleted) {
          // New player MUST play the tutorial first
          this.startTutorial();
        } else if (tutorialCompleted && !hadFirstGame) {
          // They've completed tutorial but haven't played their first game yet
          // Use default character (degen) for first game
          this.registry.set("selectedCharacter", "default");
          localStorage.setItem("hasSelectedCharacter", "true");
          this.createHypeScreen();
        } else {
          // Returning player who has completed tutorial and first game
          // Must select character before playing
          this.scene.start("CharacterSelectScene");
        }
      } else {
        // Show error message when trying to play without wallet
        this.showConnectWalletWarning();
      }
    });

    // Create versus button (below the single player button)
    this.createVersusButton();
  }

  // Create the versus button
  createVersusButton() {
    const buttonY = this.cameras.main.height * 0.65; // Below single player button

    // Create container for Versus button
    this.versusButtonContainer = this.add.container(
      this.cameras.main.width / 2,
      buttonY
    );

    // Create glow effect (using purple for versus mode)
    const versusGlow = this.add.rectangle(0, 0, 180, 90, 0x9900ff, 0.2);
    this.versusButtonContainer.add(versusGlow);

    // Add pulsating animation to the glow
    this.tweens.add({
      targets: versusGlow,
      alpha: { from: 0.2, to: 0.4 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    // Calculate responsive font size for versus button
    const screenWidth = this.cameras.main.width;
    const isPortrait = this.cameras.main.height > this.cameras.main.width;

    // In non-portrait modes, buttons should be 50% smaller
    const sizeMultiplier = isPortrait ? 1 : 0.5;
    let versusFontSize = Math.max(
      30 * sizeMultiplier,
      Math.floor(screenWidth * 0.062 * sizeMultiplier)
    ); // 6.2% of screen width, minimum 30px

    // Create versus button
    this.versusButton = this.add.text(0, 0, "VERSUS MODE", {
      fontFamily: '"Tektur", monospace, Courier, Arial',
      fontSize: `${versusFontSize}px`,
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 6,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#9900ff", // Purple shadow
        blur: 5,
        stroke: true,
        fill: true,
      },
    });
    this.versusButton.setOrigin(0.5);

    // Add to container
    this.versusButtonContainer.add(this.versusButton);

    // Make the button interactive
    this.versusButton.setInteractive({ useHandCursor: true });

    // Add hover effect for the versus button when enabled
    this.versusButton.on("pointerover", () => {
      if (this.playerAccount.isPlayerAuthenticated()) {
        this.versusButton.setColor("#9900ff");
        this.versusButton.setScale(1.1);
        versusGlow.alpha = 0.5;
      }
    });

    this.versusButton.on("pointerout", () => {
      if (this.playerAccount.isPlayerAuthenticated()) {
        this.versusButton.setColor("#ffffff");
        this.versusButton.setScale(1);
        versusGlow.alpha = 0.2;
      }
    });

    // Add click event for the versus button
    this.versusButton.on("pointerdown", () => {
      // Only start the game if wallet is connected
      if (this.playerAccount.isPlayerAuthenticated()) {
        // Record that we're playing versus mode
        this.registry.set("multiplayer", false); // Not using multiplayer networking
        this.registry.set("versusMode", true); // Flag for versus AI mode

        // Check if the tutorial has been completed
        const tutorialCompleted =
          localStorage.getItem("tutorialCompleted") === "true";

        if (!tutorialCompleted) {
          // New player MUST play the tutorial first
          this.startTutorial();
        } else {
          // Go to character select screen to choose player character
          this.scene.start("CharacterSelectScene", { versusMode: true });
        }
      } else {
        // Show error message when trying to play without wallet
        this.showConnectWalletWarning();
      }
    });

    // Create co-op button (below the versus button)
    this.createCoopButton();
  }

  // Create the co-op button
  createCoopButton() {
    const buttonY = this.cameras.main.height * 0.75; // Below versus button (originally was at 0.65)

    // Create container for Co-op button
    this.coopButtonContainer = this.add.container(
      this.cameras.main.width / 2,
      buttonY
    );

    // Create glow effect (using cyan/blue for co-op to differentiate)
    const coopGlow = this.add.rectangle(0, 0, 180, 90, 0x00ffff, 0.2);
    this.coopButtonContainer.add(coopGlow);

    // Add pulsating animation to the glow
    this.tweens.add({
      targets: coopGlow,
      alpha: { from: 0.2, to: 0.4 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    // Calculate responsive font size for co-op button
    const screenWidth = this.cameras.main.width;
    const isPortrait = this.cameras.main.height > this.cameras.main.width;

    // In non-portrait modes, buttons should be 50% smaller
    const sizeMultiplier = isPortrait ? 1 : 0.5;
    let coopFontSize = Math.max(
      30 * sizeMultiplier,
      Math.floor(screenWidth * 0.062 * sizeMultiplier)
    ); // 6.2% of screen width, minimum 30px

    // Create co-op button
    this.coopButton = this.add.text(0, 0, "CO-OP MODE", {
      fontFamily: '"Tektur", monospace, Courier, Arial',
      fontSize: `${coopFontSize}px`,
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 6,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#00ffff", // Cyan shadow instead of magenta
        blur: 5,
        stroke: true,
        fill: true,
      },
    });
    this.coopButton.setOrigin(0.5);

    // Add to container
    this.coopButtonContainer.add(this.coopButton);

    // Make the button interactive (but we'll update its state in updateButtonStates())
    this.coopButton.setInteractive({ useHandCursor: true });

    // Add hover effect for the co-op button when enabled
    this.coopButton.on("pointerover", () => {
      if (this.playerAccount.isPlayerAuthenticated()) {
        this.coopButton.setColor("#00ffff");
        this.coopButton.setScale(1.1);
        coopGlow.alpha = 0.5;
      }
    });

    this.coopButton.on("pointerout", () => {
      if (this.playerAccount.isPlayerAuthenticated()) {
        this.coopButton.setColor("#ffffff");
        this.coopButton.setScale(1);
        coopGlow.alpha = 0.2;
      }
    });

    // Add click event for the co-op button
    this.coopButton.on("pointerdown", () => {
      // Only start the game if wallet is connected
      if (this.playerAccount.isPlayerAuthenticated()) {
        // Show role selection dialog before going to lobby
        this.showCoopRoleDialog();
      } else {
        // Show error message when trying to play without wallet
        this.showConnectWalletWarning();
      }
    });
  }

  // Sets up the gamepad support
  setupGamepadSupport() {
    // Initialize gamepad values
    this.buttonIndex = 0;
    this.gamepadLastActive = 0;

    // Check if gamepad is available
    if (this.input.gamepad) {
      // Detect gamepads if they're already connected
      this.input.gamepad.once("connected", (pad) => {
        console.log("Gamepad connected:", pad.id);
        this.updateSelectedButton();
      });
    } else {
      console.log("Gamepad API not available");
    }
  }

  // Check if a gamepad is connected
  isGamepadConnected() {
    try {
      return this.input && this.input.gamepad && this.input.gamepad.total > 0;
    } catch (e) {
      console.log("Error checking gamepad connection:", e);
      return false;
    }
  }

  // Handle gamepad connection
  handleGamepadConnection() {
    console.log("Gamepad connected!");

    // Hide touch controls if they exist
    this.hideTouchControls();

    // Update UI to show gamepad is active
    if (this.menuButtons && this.menuButtons.length > 0) {
      this.updateSelectedButton();
    }
  }

  // Handle gamepad disconnection
  handleGamepadDisconnection() {
    console.log("Gamepad disconnected!");

    // Show touch controls on mobile
    if (this.isMobile) {
      this.showTouchControls();
    }
  }

  // Hide touch controls
  hideTouchControls() {
    if (this.touchController) {
      this.touchController.hide();
    }
  }

  // Show touch controls
  showTouchControls() {
    if (this.touchController) {
      this.touchController.show();
    }
  }

  // Update method - called every frame
  update(time, delta) {
    const currentTime = time;

    // Update particle positions
    if (this.particles) {
      for (const particle of this.particles) {
        particle.obj.x += particle.speedX;
        particle.obj.y += particle.speedY;

        // Apply glitch effect to some particles
        if (particle.glitch && Math.random() > 0.98) {
          // Teleport the particle to a new location
          particle.obj.x = Phaser.Math.Between(0, this.cameras.main.width);
          particle.obj.y = Phaser.Math.Between(0, this.cameras.main.height);
        }

        // Wrap particles around screen edges
        if (particle.obj.x < 0) particle.obj.x = this.cameras.main.width;
        if (particle.obj.x > this.cameras.main.width) particle.obj.x = 0;
        if (particle.obj.y < 0) particle.obj.y = this.cameras.main.height;
        if (particle.obj.y > this.cameras.main.height) particle.obj.y = 0;
      }
    }

    // Initialize menuButtons if not already initialized
    if (!this.menuButtons) {
      this.menuButtons = [];
    }

    // Only update menu buttons if none are tracked yet
    if (this.menuButtons.length === 0) {
      // Get all interactive buttons on the scene
      this.menuButtons = this.children.list.filter(
        (child) => child.type === "Text" && child.input && child.input.enabled
      );

      // Sort buttons by vertical position to ensure proper navigation order
      this.menuButtons.sort((a, b) => a.y - b.y);

      if (this.menuButtons.length > 0 && this.buttonIndex === undefined) {
        // Initialize button index
        this.buttonIndex = 0;
      }
    }

    // Handle gamepad navigation
    this.handleGamepadInput(time);
  }

  // Handle gamepad input for menu navigation
  // Update the visual state of the selected button
  updateSelectedButton() {
    if (!this.menuButtons || this.menuButtons.length === 0) {
      return;
    }

    // Ensure buttonIndex is valid
    if (this.buttonIndex === undefined || this.buttonIndex < 0) {
      this.buttonIndex = 0;
    } else if (this.buttonIndex >= this.menuButtons.length) {
      this.buttonIndex = this.menuButtons.length - 1;
    }

    // Apply visual effect to the selected button and reset others
    this.menuButtons.forEach((button, index) => {
      if (index === this.buttonIndex) {
        // Highlight selected button
        button.setScale(1.1);

        // Change text color to cyan for selected button
        if (button.style && button.style.color) {
          if (button === this.versusButton) {
            button.setColor("#9900ff"); // Purple for versus button
          } else if (button === this.coopButton) {
            button.setColor("#00ffff"); // Cyan for co-op button
          } else {
            button.setColor("#00ffff"); // Default cyan highlight
          }
        }
      } else {
        // Reset non-selected buttons
        button.setScale(1);

        // Reset color to default white
        if (button.style && button.style.color) {
          button.setColor("#ffffff");
        }
      }
    });
  }

  handleGamepadInput(time) {
    // Safety check for gamepad API
    if (!this.input || !this.input.gamepad || !this.isGamepadConnected()) {
      return;
    }

    // Only process input every 300ms to prevent oversensitivity
    if (!this.gamepadLastActive || time < this.gamepadLastActive + 300) {
      return;
    }

    // Get first gamepad
    const gamepad = this.input.gamepad.getPad(0);
    if (!gamepad) {
      return;
    }

    // Menu navigation
    if (this.menuButtons && this.menuButtons.length > 0) {
      // Vertical navigation (D-pad or left stick)
      const verticalInput =
        (gamepad.buttons[12]?.pressed ? -1 : 0) +
          (gamepad.buttons[13]?.pressed ? 1 : 0) || // D-pad up/down
        gamepad.axes[1]; // Left stick vertical

      if (Math.abs(verticalInput) > 0.5) {
        if (verticalInput < -0.5) {
          // Navigate up
          this.buttonIndex = Math.max(0, this.buttonIndex - 1);
          this.updateSelectedButton();
          this.gamepadLastActive = time;

          // Play sound for navigation if available
          if (this.sound.get("keystroke")) {
            this.sound.play("keystroke", { volume: 0.3 });
          }
        } else if (verticalInput > 0.5) {
          // Navigate down
          this.buttonIndex = Math.min(
            this.menuButtons.length - 1,
            this.buttonIndex + 1
          );
          this.updateSelectedButton();
          this.gamepadLastActive = time;

          // Play sound for navigation if available
          if (this.sound.get("keystroke")) {
            this.sound.play("keystroke", { volume: 0.3 });
          }
        }
      }

      // Select button with A/X button
      if (gamepad.buttons[0]?.pressed || gamepad.buttons[2]?.pressed) {
        // Trigger the currently selected button
        if (
          this.buttonIndex >= 0 &&
          this.buttonIndex < this.menuButtons.length
        ) {
          const selectedButton = this.menuButtons[this.buttonIndex];
          selectedButton.emit("pointerdown");
          this.gamepadLastActive = time + 500; // Prevent rapid-fire
        }
      }
    }
  }

  // Create the ATM button
  createATMButton() {
    const buttonY = this.cameras.main.height * 0.8; // Position between CO-OP button and DEPOSIT/WITHDRAW button

    // Create container for ATM button
    this.atmButtonContainer = this.add.container(
      this.cameras.main.width / 2,
      buttonY
    );

    // Create glow effect (using green for ATM mode)
    const atmGlow = this.add.rectangle(0, 0, 180, 90, 0x00ff00, 0.2);
    this.atmButtonContainer.add(atmGlow);

    // Add pulsating animation to the glow
    this.tweens.add({
      targets: atmGlow,
      alpha: { from: 0.2, to: 0.4 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    // Calculate responsive font size for ATM button
    const screenWidth = this.cameras.main.width;
    const isPortrait = this.cameras.main.height > this.cameras.main.width;

    // In non-portrait modes, buttons should be 50% smaller
    const sizeMultiplier = isPortrait ? 1 : 0.5;
    let atmFontSize = Math.max(
      30 * sizeMultiplier,
      Math.floor(screenWidth * 0.062 * sizeMultiplier)
    ); // 6.2% of screen width, minimum 30px

    // Create ATM button
    this.atmButton = this.add.text(0, 0, "ATM", {
      fontFamily: '"Tektur", monospace, Courier, Arial',
      fontSize: `${atmFontSize}px`,
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 6,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#00ff00", // Green shadow
        blur: 5,
        stroke: true,
        fill: true,
      },
    });
    this.atmButton.setOrigin(0.5);

    // Add to container
    this.atmButtonContainer.add(this.atmButton);

    // Make the button interactive
    this.atmButton.setInteractive({ useHandCursor: true });

    // Add hover effect for the ATM button when enabled
    this.atmButton.on("pointerover", () => {
      if (this.playerAccount.isPlayerAuthenticated()) {
        this.atmButton.setColor("#00ff00");
        this.atmButton.setScale(1.1);
        atmGlow.alpha = 0.5;
      }
    });

    this.atmButton.on("pointerout", () => {
      if (this.playerAccount.isPlayerAuthenticated()) {
        this.atmButton.setColor("#ffffff");
        this.atmButton.setScale(1);
        atmGlow.alpha = 0.2;
      }
    });

    // Add click event for the ATM button
    this.atmButton.on("pointerdown", () => {
      // Only allow ATM access if wallet is connected
      if (this.playerAccount.isPlayerAuthenticated()) {
        // Display the deposit/withdraw prompt
        this.showDepositWithdrawDialog();
      } else {
        // Show error message when trying to use ATM without wallet
        this.showConnectWalletWarning();
      }
    });
  }

  updateButtonStates() {
    // Enable or disable buttons based on wallet connection status
    const isAuthenticated = this.playerAccount.isPlayerAuthenticated();

    if (this.playButton) {
      this.playButton.setInteractive({ useHandCursor: true });

      // Adjust appearance based on authentication
      if (isAuthenticated) {
        this.playButton.setColor("#ffffff");
        this.playButton.setAlpha(1);
      } else {
        this.playButton.setColor("#aaaaaa");
        this.playButton.setAlpha(0.7);
      }
    }

    if (this.versusButton) {
      this.versusButton.setInteractive({ useHandCursor: true });

      // Adjust appearance based on authentication
      if (isAuthenticated) {
        this.versusButton.setColor("#ffffff");
        this.versusButton.setAlpha(1);
      } else {
        this.versusButton.setColor("#aaaaaa");
        this.versusButton.setAlpha(0.7);
      }
    }

    if (this.coopButton) {
      this.coopButton.setInteractive({ useHandCursor: true });

      // Adjust appearance based on authentication
      if (isAuthenticated) {
        this.coopButton.setColor("#ffffff");
        this.coopButton.setAlpha(1);
      } else {
        this.coopButton.setColor("#aaaaaa");
        this.coopButton.setAlpha(0.7);
      }
    }

    // ATM button should follow the same authentication rules
    if (this.atmButton) {
      this.atmButton.setInteractive({ useHandCursor: true });

      // Adjust appearance based on authentication
      if (isAuthenticated) {
        this.atmButton.setColor("#ffffff");
        this.atmButton.setAlpha(1);
      } else {
        this.atmButton.setColor("#aaaaaa");
        this.atmButton.setAlpha(0.7);
      }
    }

    // Tutorial button should be visible regardless of authentication
    if (this.tutorialButton) {
      this.tutorialButton.setInteractive({ useHandCursor: true });
      this.tutorialButton.setAlpha(1);
    }

    if (this.characterSelectButton) {
      this.characterSelectButton.setInteractive({ useHandCursor: true });

      // Adjust appearance based on authentication
      if (isAuthenticated) {
        this.characterSelectButton.setColor("#ffffff");
        this.characterSelectButton.setAlpha(1);
      } else {
        this.characterSelectButton.setColor("#aaaaaa");
        this.characterSelectButton.setAlpha(0.7);
      }
    }
  }

  showEnterArenaCutscene(existingOverlay) {
    // Start preloading dialog assets while the cutscene is playing
    this.preloadDialogAssets();

    // Create a black screen overlay or use existing one
    const overlay =
      existingOverlay ||
      this.add.rectangle(
        0,
        0,
        this.cameras.main.width,
        this.cameras.main.height,
        0x000000
      );
    overlay.setOrigin(0, 0);
    overlay.setDepth(1000);

    // Disable all input during cutscene to prevent interruption
    this.disableAllInput();

    // Check if in portrait mode
    const isPortrait = this.cameras.main.height > this.cameras.main.width;

    // Load background image based on orientation
    const background = this.add.image(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2, // Center vertically
      isPortrait ? "cutscene_portrait" : "cutscene_landscape"
    );
    background.setOrigin(0.5, 0.5); // Center both horizontally and vertically
    background.setDepth(1001);

    // Set background to stretch larger than screen dimensions to avoid black edges during movement
    background.setDisplaySize(
      this.cameras.main.width,
      this.cameras.main.height * 1.2
    );

    // Get the selected character
    const selectedCharacter =
      this.registry.get("selectedCharacter") || "default";

    // Choose the appropriate cutscene character image
    let characterImageKey = "cutscene_character"; // Default

    // Map character IDs to image keys
    if (selectedCharacter === "character2") {
      characterImageKey = "cutscene_character2";
    } else if (selectedCharacter === "character3") {
      characterImageKey = "cutscene_character3";
    } else if (selectedCharacter === "character5") {
      characterImageKey = "cutscene_character5";
    }

    // Position character image at the bottom of the screen initially
    const character = this.add.image(
      this.cameras.main.width / 2,
      this.cameras.main.height + 50, // Start below the bottom
      characterImageKey
    );
    character.setOrigin(0.5, 0.5);
    character.setDepth(1002);

    // Scale character appropriately
    character.setScale(0.7);

    // Get character info from registry
    const characterInfo = this.registry.get("characterInfo") || {
      default: {
        name: "Degen",
        font: "Tektur, Arial",
        colors: { primary: "#C0C0C0", secondary: "#0066CC" },
      },
      character2: {
        name: "Drainer",
        font: "Creepster, Arial",
        colors: { primary: "#FF0000", secondary: "#990000" },
      },
      character3: {
        name: "Toaster",
        font: "Bungee, Arial",
        colors: { primary: "#FF6600", secondary: "#333333" },
      },
      character5: {
        name: "Flex",
        font: "Audiowide, Arial",
        colors: { primary: "#00FF00", secondary: "#FF00FF" },
      },
    };

    // Get character details
    const charDetails =
      characterInfo[selectedCharacter] || characterInfo["default"];

    // Add character name text
    // Use character-specific font but responsive size
    let fontFamily = charDetails.font;

    // Calculate responsive font size based on screen width
    // Using a percentage of screen width for responsive sizing
    const screenWidth = this.cameras.main.width;
    const targetWidth = screenWidth * (isPortrait ? 0.8 : 0.6); // Use 80% in portrait, 60% in landscape

    // Start with base font size for estimation
    let baseFontSize = isPortrait ? 120 : 80;

    // Apply character-specific adjustments
    if (charDetails.name === "Drainer") {
      fontFamily = "Creepster, cursive, Arial";
      // Drainer gets slightly larger text
      baseFontSize = isPortrait ? 140 : 100;

      // Create and preload Creepster font element - critical for rendering
      const fontPreload = document.createElement("div");
      fontPreload.textContent = "Drainer";
      fontPreload.style.fontFamily = "Creepster, cursive";
      fontPreload.style.position = "absolute";
      fontPreload.style.left = "-9999px";
      fontPreload.style.fontSize = `${baseFontSize}px`;
      fontPreload.className = "drainer-text";
      document.body.appendChild(fontPreload);

      // Keep the preload element for 2 seconds, then remove
      setTimeout(() => document.body.removeChild(fontPreload), 2000);
    }

    // Create temporary text to measure width
    const tempText = this.add.text(0, 0, charDetails.name, {
      fontFamily: fontFamily,
      fontSize: `${baseFontSize}px`,
    });

    // Calculate scaling factor to fit target width
    const scaleFactor = targetWidth / tempText.width;
    const fontSize = `${Math.floor(baseFontSize * scaleFactor)}px`;
    tempText.destroy();

    const nameText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height * 0.35,
      charDetails.name,
      {
        fontFamily: fontFamily,
        fontSize: fontSize,
        color: charDetails.colors.primary,
        stroke: "#000000",
        strokeThickness: 8,
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: charDetails.colors.secondary,
          blur: 5,
          stroke: true,
          fill: true,
        },
      }
    );
    nameText.setOrigin(0.5);
    nameText.setDepth(1003);
    nameText.setAlpha(0); // Start invisible

    // Make name text appear with animation after character enters
    this.time.delayedCall(1000, () => {
      this.tweens.add({
        targets: nameText,
        alpha: 1,
        y: this.cameras.main.height * 0.31,
        scale: { from: 1.5, to: 1 },
        duration: 500,
        ease: "Back.easeOut",
      });
    });

    // Create camera flash effect container
    const flashContainer = this.add.container(0, 0);
    flashContainer.setDepth(1003);

    // Play crowd roar sound
    let crowdRoarSound = this.sound.get("crowd_roar");
    let crowdRoarFallback = this.cachedAudioElements
      ? this.cachedAudioElements["crowd_roar"]
      : null;

    if (crowdRoarSound) {
      crowdRoarSound.play({ volume: 0.7 });
    } else if (crowdRoarFallback) {
      console.log("Using cached crowd roar sound");
      crowdRoarFallback.currentTime = 0;
      crowdRoarFallback.volume = 0.7;
      crowdRoarFallback.play().catch((error) => {
        console.error("Error playing cached crowd roar sound:", error);
      });
    } else {
      console.warn("Crowd roar sound not found in any cache");

      // Last resort fallback
      try {
        crowdRoarFallback = new Audio("assets/sound/sfx/crowd_roar.mp3");
        crowdRoarFallback.volume = 0.7;
        crowdRoarFallback.play();
        // Save for future use
        if (!this.cachedAudioElements) this.cachedAudioElements = {};
        this.cachedAudioElements["crowd_roar"] = crowdRoarFallback;
      } catch (error) {
        console.error("Failed to play crowd roar sound fallback:", error);
      }
    }

    // Make sure sound stops when leaving this scene
    this.events.once("shutdown", () => {
      if (crowdRoarSound) {
        crowdRoarSound.stop();
      }
      if (crowdRoarFallback) {
        crowdRoarFallback.pause();
        crowdRoarFallback.currentTime = 0;
      }
    });

    // Function to create a camera flash
    const createCameraFlash = () => {
      // Create flash effect
      const flash = this.add.rectangle(
        0,
        0,
        this.cameras.main.width,
        this.cameras.main.height,
        0xffffff
      );
      flash.setOrigin(0, 0);
      flash.setAlpha(0.8);

      // Add to container
      flashContainer.add(flash);

      // Fade out and remove
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          flashContainer.remove(flash);
          flash.destroy();
        },
      });
    };

    // Create animations for background and character
    // Move background upward (opposite to character's upward movement)
    this.tweens.add({
      targets: background,
      y: {
        from: this.cameras.main.height / 2,
        to: this.cameras.main.height / 2 - 100,
      }, // Move up by 100px
      duration: 3000, // 3 seconds
      ease: "Power1",
    });

    // Move character from bottom to middle (walking into the arena)
    // Only raise 50% as much (using 75% of screen height instead of 50%)
    this.tweens.add({
      targets: character,
      y: this.cameras.main.height * 0.75, // End at 75% of screen height (reduced by 50%)
      duration: 3000, // Reduced to 3 seconds
      ease: "Power1",
      delay: 300, // Reduced delay
    });

    // Add camera flashes at specific intervals (adjusted for shorter duration)
    this.time.delayedCall(600, createCameraFlash);
    this.time.delayedCall(1500, createCameraFlash);
    this.time.delayedCall(2400, createCameraFlash);

    // Fade out the crowd roar sound 500ms before cutscene ends
    this.time.delayedCall(2800, () => {
      // If using Phaser sound
      if (crowdRoarSound) {
        this.tweens.add({
          targets: crowdRoarSound,
          volume: 0,
          duration: 500,
          ease: "Power1",
        });
      }

      // If using HTML5 Audio fallback
      if (crowdRoarFallback) {
        // HTML5 Audio doesn't support tweens, so manually fade out
        const startVolume = crowdRoarFallback.volume;
        const fadePoints = 10;
        const interval = 500 / fadePoints;
        const volumeStep = startVolume / fadePoints;

        const fadeInterval = setInterval(() => {
          if (crowdRoarFallback.volume > volumeStep) {
            crowdRoarFallback.volume -= volumeStep;
          } else {
            crowdRoarFallback.volume = 0;
            clearInterval(fadeInterval);
          }
        }, interval);
      }
    });

    // After animations complete, transition to the GET HYPED screen
    this.time.delayedCall(3300, () => {
      // Instead of fade, use a quick blackout (overlay is already black)
      // Just destroy elements immediately
      background.destroy();
      character.destroy();
      flashContainer.destroy();
      nameText.destroy(); // Clean up character name text too

      // Stop crowd roar sound (volume should be 0 now)
      if (crowdRoarSound) {
        crowdRoarSound.stop();
      }
      if (crowdRoarFallback) {
        crowdRoarFallback.pause();
        crowdRoarFallback.currentTime = 0;
      }

      // Keep overlay and proceed to GET HYPED screen
      this.showGetHypedScreen(overlay);
    });
  }

  showGetHypedScreen(existingOverlay) {
    // Make sure input is disabled for this part too
    this.disableAllInput();

    // Reuse existing overlay from cutscene
    const overlay = existingOverlay;

    // Play interference sound for the GET HYPED text
    let interferenceSound = this.sound.get("interference");
    let fallbackAudio = this.cachedAudioElements
      ? this.cachedAudioElements["interference"]
      : null;

    if (interferenceSound) {
      // Use a one-shot sound that won't loop
      interferenceSound.play({ volume: 1.0 });
    } else if (fallbackAudio) {
      console.log("Using cached interference sound");
      fallbackAudio.currentTime = 0;
      fallbackAudio.volume = 1.0;
      fallbackAudio.play().catch((error) => {
        console.error("Error playing cached interference sound:", error);
      });
    } else {
      console.warn("Interference sound not found in any cache");

      // Last resort fallback
      try {
        fallbackAudio = new Audio("assets/sound/sfx/interference.mp3");
        fallbackAudio.volume = 1.0;
        fallbackAudio.play();
        // Save for future use
        if (!this.cachedAudioElements) this.cachedAudioElements = {};
        this.cachedAudioElements["interference"] = fallbackAudio;
      } catch (error) {
        console.error("Failed to play interference sound fallback:", error);
      }
    }

    // Explicitly stop sound after 333ms
    this.time.delayedCall(333, () => {
      if (interferenceSound) {
        interferenceSound.stop();
      }
      if (fallbackAudio) {
        fallbackAudio.pause();
        fallbackAudio.currentTime = 0;
      }
    });

    // Additional safety: Make sure sound stops when leaving this scene
    this.events.once("shutdown", () => {
      if (interferenceSound) {
        interferenceSound.stop();
      }
      if (fallbackAudio) {
        fallbackAudio.pause();
        fallbackAudio.currentTime = 0;
      }
    });

    // Calculate responsive font size based on screen width
    // Using 90% of screen width as target size
    const screenWidth = this.cameras.main.width;
    const text = "GET HYPED";
    const targetWidth = screenWidth * 0.9; // Use 90% of screen width

    // Start with a base font size and adjust
    let fontSize = 100;
    const tempText = this.add.text(0, 0, text, {
      fontFamily: "Arial Black",
      fontSize: `${fontSize}px`,
    });

    // Scale the font size to match desired width
    const scaleFactor = targetWidth / tempText.width;
    fontSize = Math.floor(fontSize * scaleFactor);
    tempText.destroy();

    // Add the "GET HYPED" text with calculated size
    const hypeText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      text,
      {
        fontFamily: "Arial Black",
        fontSize: `${fontSize}px`,
        color: "#ffffff",
        align: "center",
      }
    );
    hypeText.setOrigin(0.5);
    hypeText.setDepth(1001); // Ensure it's above the overlay

    // Add glitch effect to the text
    this.time.addEvent({
      delay: 50,
      callback: () => {
        // Random position glitch effect
        if (Math.random() > 0.5) {
          hypeText.x += Phaser.Math.Between(-10, 10);
          hypeText.y += Phaser.Math.Between(-8, 8);

          // Reset position after brief delay
          this.time.delayedCall(30, () => {
            hypeText.x = this.cameras.main.width / 2;
            hypeText.y = this.cameras.main.height / 2;
          });
        }

        // Black and white glitch effect
        if (Math.random() > 0.7) {
          // Alternate between white and black
          if (Math.random() > 0.5) {
            // Set to white
            hypeText.setTint(0xffffff);
          } else {
            // Set to black (effectively making it invisible against the black background)
            hypeText.setTint(0x000000);
          }

          // Reset color after brief delay
          this.time.delayedCall(40, () => {
            hypeText.clearTint();
          });
        }
      },
      repeat: 5,
    });

    // Start the game after 333 milliseconds
    this.time.delayedCall(333, () => {
      // Keep the music playing through all scenes
      this.scene.start("GameScene");
    });
  }
}
