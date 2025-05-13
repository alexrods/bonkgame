import {
  createOrGetWallet,
  getUserInfo,
  updateCredit,
  setCreditCount,
  withdrawCredit,
  withdrawBonk,
  updateEarnCount
} from "../utils/api.js";
import { SolanaWallet } from "./SolanaWallet.js";
import { nftCollectionChecker } from "../utils/nftCollectionChecker.js";
import { WhitelistManager } from "./WhitelistManager.js";

/**
 * PlayerAccount - Manages player account integration with web3
 * Links the Solana wallet to player data and game progress
 */
export class PlayerAccount {
  constructor(scene) {
    this.scene = scene;
    this.wallet = new SolanaWallet();
    this.playerData = null;
    this.isAuthenticated = false;
    this.authToken = null;

    // Game account balance - separate from wallet and arena
    this.gameAccountBalance = 0;

    // Initialize whitelist manager
    this.whitelistManager = new WhitelistManager();

    // Set up wallet connection callbacks
    this.wallet.onConnect(this.handleWalletConnect.bind(this));
    this.wallet.onDisconnect(this.handleWalletDisconnect.bind(this));

    // Initialize player data from localStorage if available
    this.initPlayerData();
  }

  /**
   * Initialize player data
   * Loads from localStorage if available, or creates default data
   */
  initPlayerData() {
    // Default player data
    this.playerData = {
      address: null,
      highScore: 0,
      lastPlayedDate: null,
      gameAccountBalance: 0, // Add game account balance to player data
      bonkBalance: 0, // Add BONK token balance to player data
      gameSettings: {
        soundEnabled: true,
        difficulty: "normal",
      },
    };

    // Try to load existing data from localStorage
    try {
      const savedData = localStorage.getItem("playerData");
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        this.playerData = { ...this.playerData, ...parsedData };

        // Make sure to sync the gameAccountBalance with the playerData
        this.gameAccountBalance = this.playerData.gameAccountBalance || 0;

        // Sync BONK balance with playerData
        this.bonkBalance = this.playerData.bonkBalance || 0;
      }
    } catch (error) {
      console.error("Error loading player data from localStorage:", error);
    }
  }

  /**
   * Handle wallet connection
   * @param {string} publicKey - Public key of the connected wallet
   */
  async handleWalletConnect(publicKey) {
    try {
      // First check whitelist
      if (!this.whitelistManager.isWhitelisted(publicKey)) {
        console.warn(`Wallet ${publicKey} not whitelisted. Access denied.`);
        this.scene.events.emit("wallet-not-whitelisted", publicKey);
        return;
      }

      // Create or get wallet from backend
      const response = await createOrGetWallet(publicKey);

      // Store the auth token
      this.authToken = response.token;

      // Get user info including balances
      const userInfo = await getUserInfo(this.authToken);
      this.gameAccountBalance = userInfo.credit_count || 0;
      this.bonkBalance = userInfo.earn || 0;

      // Update local state
      this.isAuthenticated = true;
      this.playerData = {
        ...this.playerData,
        address: publicKey,
        gameAccountBalance: userInfo.credit_count || 0,
        bonkBalance: userInfo.earn || 0,
      };

      // Save updated player data
      this.savePlayerData();

      // Notify the game
      this.scene.events.emit("player-authenticated", this.playerData);
      this.scene.events.emit(
        "gameAccountUpdated",
        this.playerData.credit_count
      );
      this.scene.events.emit(
        "bonkBalanceUpdated",
        this.playerData.bonk_balance
      );
      
      // Verificar si el usuario posee NFTs de la colección configurada
      try {
        // Limpiar cualquier información anterior de bloodlines
        this.bloodlines = [];
        localStorage.removeItem('playerBloodlines');
        
        // Inicializar el verificador de NFTs
        if (!nftCollectionChecker.wallet.isConnected) {
          // Usar la misma conexión que ya tenemos establecida
          nftCollectionChecker.wallet = this.wallet;
          nftCollectionChecker.authToken = this.authToken;
          // Configurar la red como devnet para pruebas
          nftCollectionChecker.network = "devnet";
        }
        
        // Verificar la colección de NFTs usando el método checkCollection
        console.log("Verificando colección de NFTs para el usuario...");
        const hasNFT = await nftCollectionChecker.checkCollection();
        
        // Almacenar el resultado en playerData
        this.playerData.hasCollectionNFT = hasNFT;
        this.savePlayerData();
        
        // Emitir evento con el resultado
        this.scene.events.emit("nft-collection-check", {
          hasNFT,
          collectionAddress: nftCollectionChecker.defaultCollectionAddress
        });
        
        // Mostrar mensaje en el juego usando el sistema de notificaciones existente
        if (hasNFT) {
          this.wallet.showNotification("¡Felicidades! Posees NFTs de la colección especial.");
          console.log("El usuario posee NFTs de la colección configurada");
          
          // También emitimos un evento para que otros componentes puedan reaccionar
          this.scene.events.emit("nft-collection-found", true);
        } else {
          this.wallet.showNotification("No se encontraron NFTs de la colección especial en tu wallet.");
          console.log("El usuario NO posee NFTs de la colección configurada");
          
          // También emitimos un evento para que otros componentes puedan reaccionar
          this.scene.events.emit("nft-collection-found", false);
        }
      } catch (nftError) {
        console.error("Error al verificar colección de NFTs:", nftError);
        // No interrumpimos el flujo de autenticación si falla la verificación de NFTs
      }

      console.log("Player authenticated:", publicKey);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      this.handleWalletDisconnect();
    }
  }

  /**
   * Handle wallet disconnection
   */
  async handleWalletDisconnect() {
    // Reset authentication state
    this.isAuthenticated = false;
    this.authToken = null;
    
    // Update player data to reflect disconnection
    if (this.playerData) {
      this.playerData.address = null;
    }
    
    // Limpiar las bloodlines al desconectar la wallet
    this.bloodlines = [];
    localStorage.removeItem('playerBloodlines');
    
    // Save updated state
    this.savePlayerData();
    
    // Notify the game
    this.scene.events.emit("player-unauthenticated");
    
    console.log("Wallet disconnected from PlayerAccount");

    console.log("Player disconnected");
  }

  /**
   * Save player data to localStorage
   */
  savePlayerData() {
    // Make sure gameAccountBalance and bonkBalance are synced to playerData before saving
    this.playerData.gameAccountBalance = this.gameAccountBalance;
    this.playerData.bonkBalance = this.bonkBalance;

    try {
      localStorage.setItem("playerData", JSON.stringify(this.playerData));
    } catch (error) {
      console.error("Error saving player data to localStorage:", error);
    }
  }

  /**
   * Update player's high score if the new score is higher
   * @param {number} score - New score to check against high score
   * @returns {boolean} Whether the score was a new high score
   */
  updateHighScore(score) {
    if (score > this.playerData.highScore) {
      this.playerData.highScore = score;
      this.savePlayerData();

      // If player is authenticated, we could save to blockchain or server here
      if (this.isAuthenticated) {
        // For now, just log it
        console.log(`New high score for ${this.playerData.address}: ${score}`);
      }

      return true;
    }
    return false;
  }

  /**
   * Get player's high score
   * @returns {number} Player's high score
   */
  getHighScore() {
    return this.playerData.highScore;
  }

  /**
   * Load player's tokens (NFTs or fungible tokens)
   * This is a stub function that could be expanded to load actual token data
   */
  async loadPlayerTokens() {
    if (!this.isAuthenticated || !this.wallet.isConnected) {
      return null;
    }

    try {
      // For now, just log a placeholder message
      console.log("Loading tokens for player:", this.playerData.address);

      // In a real implementation, this would query the Solana blockchain
      // for the player's NFTs or tokens using the wallet's public key

      // Example code (not actually executed):
      /*
      const connection = this.wallet.connection;
      const publicKey = new solanaWeb3.PublicKey(this.playerData.address);
      
      // Query token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new solanaWeb3.PublicKey('') }
      );
      
      // Process token data
      const tokens = tokenAccounts.value.map(accountInfo => {
        const parsedInfo = accountInfo.account.data.parsed.info;
        return {
          mint: parsedInfo.mint,
          amount: parsedInfo.tokenAmount.uiAmount,
          decimals: parsedInfo.tokenAmount.decimals
        };
      });
      
      return tokens;
      */

      return null;
    } catch (error) {
      console.error("Error loading player tokens:", error);
      return null;
    }
  }

  /**
   * Update game settings
   * @param {Object} settings - New game settings
   */
  updateGameSettings(settings) {
    this.playerData.gameSettings = {
      ...this.playerData.gameSettings,
      ...settings,
    };
    this.savePlayerData();
  }

  /**
   * Get the current game settings
   * @returns {Object} Current game settings
   */
  getGameSettings() {
    return this.playerData.gameSettings;
  }

  /**
   * Update the player data object
   * @param {Object} data - Data to merge with player data
   */
  updatePlayerData(data) {
    this.playerData = {
      ...this.playerData,
      ...data,
    };
    this.savePlayerData();
  }

  /**
   * Get full player data object
   * @returns {Object} Player data
   */
  getPlayerData() {
    return this.playerData;
  }

  /**
   * Check if player is authenticated (wallet connected) and whitelisted
   * @returns {boolean} Whether player is authenticated and whitelisted
   */
  isPlayerAuthenticated() {
    // First check the in-memory state
    if (this.isAuthenticated) {
      // Verify the wallet is whitelisted
      if (
        this.playerData.address &&
        !this.whitelistManager.isWhitelisted(this.playerData.address)
      ) {
        console.warn(
          `Wallet ${this.playerData.address} not in whitelist, revoking access`
        );
        this.isAuthenticated = false;
        return false;
      }
      return true;
    }

    // Check if the wallet is connected directly
    if (this.wallet && this.wallet.isConnected && this.wallet.publicKey) {
      const publicKey = this.wallet.getPublicKey();

      // Check if the wallet is whitelisted
      if (!this.whitelistManager.isWhitelisted(publicKey)) {
        console.warn(
          `Connected wallet ${publicKey} not in whitelist, denying access`
        );
        // Force disconnect the wallet
        if (typeof this.wallet.disconnect === "function") {
          setTimeout(() => {
            this.wallet.disconnect();
          }, 1000);
        }
        return false;
      }

      // Wallet is connected and whitelisted, update our state
      this.isAuthenticated = true;
      this.playerData.address = publicKey;
      return true;
    }

    // Check if persistent authentication is enabled in WEB3_CONFIG
    // Import config dynamically since we can't import at the top due to circular dependency
    let persistentAuth = false;
    try {
      // Try to get the WEB3_CONFIG from the scene if available
      if (
        this.scene &&
        this.scene.sys &&
        this.scene.sys.game.cache.json.get("gameConfig")
      ) {
        persistentAuth =
          this.scene.sys.game.cache.json.get("gameConfig").WEB3_CONFIG
            .persistentAuth;
      } else {
        // If not available in cache, try to import from the window
        persistentAuth = window.WEB3_CONFIG?.persistentAuth;
      }
    } catch (err) {
      console.warn("Error accessing WEB3_CONFIG:", err);
      persistentAuth = false; // Default to false if can't determine
    }

    // Only check localStorage for persistent authentication if enabled
    if (persistentAuth) {
      try {
        const storedAuth = localStorage.getItem("walletAuthenticated");
        const storedAddress = localStorage.getItem("connectedWalletAddress");

        // If we have stored authentication data, try to use it
        if (storedAuth === "true" && storedAddress) {
          // Check if the stored wallet is whitelisted
          if (!this.whitelistManager.isWhitelisted(storedAddress)) {
            console.warn(
              `Stored wallet ${storedAddress} not in whitelist, clearing local storage`
            );
            localStorage.removeItem("walletAuthenticated");
            localStorage.removeItem("connectedWalletAddress");
            return false;
          }

          // Only set if not already authenticated to avoid duplicate events
          if (!this.isAuthenticated) {
            console.log("Found stored wallet authentication, restoring state");
            this.isAuthenticated = true;
            this.playerData.address = storedAddress;

            // We don't emit 'player-authenticated' here to avoid unexpected events
            // This just quietly restores the state
          }
          return true;
        }
      } catch (err) {
        console.warn("Error checking localStorage for authentication:", err);
      }
    }

    // If we get here, player is not authenticated
    return this.isAuthenticated;
  }

  /**
   * Get wallet instance to interact with directly if needed
   * @returns {SolanaWallet} The wallet instance
   */
  getWallet() {
    return this.wallet;
  }

  /**
   * Get the player's game account balance
   * @returns {number} Current game account balance
   */
  getGameAccountBalance() {
    return this.gameAccountBalance;
  }

 /**
   * Get the player's BONK balance
   * @returns {number} Current BONK balance
   */
 getBonkBalance() {
  return this.bonkBalance;
}

  /**
   * Update the player's game account balance
   * @param {number} amount - Amount to add (positive) or subtract (negative)
   * @returns {number} New game account balance
   */
  updateGameAccountBalance(amount) {
    this.gameAccountBalance += amount;

    // Ensure balance doesn't go below zero
    if (this.gameAccountBalance < 0) {
      this.gameAccountBalance = 0;
    }

    // Update player data and save
    this.playerData.gameAccountBalance = this.gameAccountBalance;
    this.savePlayerData();

    // Emit an event so UI elements can update - with try/catch for safety
    try {
      if (this.scene && this.scene.events) {
        this.scene.events.emit("gameAccountUpdated", this.gameAccountBalance);
      } else {
        console.warn(
          "Cannot emit gameAccountUpdated event - scene or events not available"
        );
      }
    } catch (error) {
      console.error("Error emitting gameAccountUpdated event:", error);
    }

    return this.gameAccountBalance;
  }

 /**
   * Update the player's BONK balance
   * @param {number} amount - Amount to add (positive) or subtract (negative)
   * @returns {number} New BONK balance
   */
 updateBonkBalance(amount) {
  this.bonkBalance += amount;

  // Ensure balance doesn't go below zero
  if (this.bonkBalance < 0) {
    this.bonkBalance = 0;
  }

  // Update player data and save
  this.playerData.bonkBalance = this.bonkBalance;
  this.savePlayerData();

  // FIXED: Emit an event so UI elements can update - with try/catch for safety
  try {
    if (this.scene && this.scene.events) {
      console.log(
        `Emitting bonkBalanceUpdated event with balance: ${this.bonkBalance}`
      );
      this.scene.events.emit("bonkBalanceUpdated", this.bonkBalance);
    } else {
      console.warn(
        "Cannot emit bonkBalanceUpdated event - scene or events not available"
      );
    }
  } catch (error) {
    console.error("Error emitting bonkBalanceUpdated event:", error);
  }

  return this.bonkBalance;
}

  /**
   * Deposit from Solana wallet to game account
   * @param {number} solAmount - Amount of SOL to deposit
   * @param {number} gameCredits - Equivalent game credits to receive
   * @returns {boolean} Whether the transaction succeeded
   */
  async depositToGameAccount(amount) {
    if (!this.isAuthenticated || !this.authToken) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await this.scene.playerAccount.wallet.depositCredit(
        amount
      );
      console.log(result);

      await updateCredit(this.authToken, amount, result.signature);

      // Update local state
      this.playerData.credit_count += amount;
      this.savePlayerData();

      // Emit update event
      this.scene.events.emit(
        "gameAccountUpdated",
        this.playerData.credit_count
      );

      return true;
    } catch (error) {
      console.error("Error depositing to game account:", error);
      throw error;
      return false;
    }
  }

   /**
    * Withdraw all credits from game account to Solana wallet
    * @returns {boolean} Whether the transaction succeeded
    */
   async withdrawFromGameAccount() {
     if (!this.isAuthenticated || !this.authToken) {
       throw new Error("Not authenticated");
     }
 
     try {
       // Get current credit count from player data
       const totalCredits = this.gameAccountBalance || 0;
       
       if (totalCredits <= 0) {
         console.log("No credits to withdraw");
         return false;
       }
       
       // Withdraw all credits
       await withdrawCredit(this.authToken, this.wallet.getPublicKey(), totalCredits);
 
       // Update local state
       this.gameAccountBalance = 0;
       this.playerData.gameAccountBalance = 0;
       this.savePlayerData();
 
       // Emit update event
       this.scene.events.emit("gameAccountUpdated", 0);
 
       console.log(`Successfully withdrew all credits (${totalCredits})`);
       return true;
     } catch (error) {
       console.error("Error withdrawing from game account:", error);
       return false;
     }
   }

  /**
   * Deposit from game account to arena - COMPLETELY REWRITTEN
   * @param {number} amount - Amount of game credits to deposit to arena
   * @returns {boolean} Whether the transaction succeeded
   */
  depositToArena(amount) {
    console.log("FIXED depositToArena called with amount:", amount);

    // Step 1: Validate input and prerequisites
    if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
      console.error(`Invalid deposit amount: ${amount}`);
      return false;
    }

    // Check if player has enough in game account
    if (this.gameAccountBalance < amount) {
      console.error(
        `Insufficient game account balance: have ${this.gameAccountBalance}, need ${amount}`
      );
      return false;
    }

    // Check if UI exists - provide more descriptive error
    if (!this.scene.ui) {
      console.error(
        "No UI component found to update arena balance - ensure scene.ui is available"
      );
      // Continue anyway - we'll handle this gracefully below
    }

    // Step 2: Log initial states for debugging
    console.log(`===== DEPOSIT TO ARENA =====`);
    console.log(`Amount: ${amount}`);
    console.log(`Initial game balance: ${this.gameAccountBalance}`);
    console.log(
      `Initial arena balance: ${
        this.scene.ui ? this.scene.ui.money : "N/A - UI not available"
      }`
    );

    try {
      // Step 3: Critical section - Update both balances in sequence

      // First, subtract from game account - this must succeed
      this.gameAccountBalance -= amount;

      // Ensure game balance doesn't go below zero
      if (this.gameAccountBalance < 0) {
        this.gameAccountBalance = 0;
      }

      // Update player data and save to localStorage
      this.playerData.gameAccountBalance = this.gameAccountBalance;
      this.savePlayerData();

      // CRITICAL FIX: Force direct update of arena balance
      // This bypasses any potential event handler issues
      let previousArenaBalance = 0;
      let newArenaBalance = 0;

      // Handle the case where UI isn't available
      if (this.scene.ui) {
        previousArenaBalance = this.scene.ui.money || 0;
        this.scene.ui.money = previousArenaBalance + amount;
        newArenaBalance = this.scene.ui.money;

        // Update the display text
        if (this.scene.ui.moneyText) {
          this.scene.ui.moneyText.setText(
            "💵 Arena: $" + this.scene.ui.money.toFixed(2)
          );
        }
      } else {
        console.warn(
          "No UI found for updating arena balance - will only update game account"
        );
        // We'll just calculate what the new balance would be for logging
        newArenaBalance = previousArenaBalance + amount;
      }

      // Log the success
      if (this.scene.ui) {
        console.log(
          `Updated arena balance directly: ${previousArenaBalance} + ${amount} = ${this.scene.ui.money}`
        );
      } else {
        console.log(`Game account updated, but no UI to update arena balance`);
      }

      // Emit events for both updates
      this.scene.events.emit("gameAccountUpdated", this.gameAccountBalance);

      // Only emit money events if we have UI
      if (this.scene.ui) {
        this.scene.events.emit("moneyUpdated", this.scene.ui.money);
        this.scene.events.emit("arenaBalanceUpdated", this.scene.ui.money);
      }

      // Step 4: Verify the transaction
      console.log(`===== DEPOSIT RESULTS =====`);
      console.log(`Final game balance: ${this.gameAccountBalance}`);

      if (this.scene.ui) {
        console.log(`Final arena balance: ${this.scene.ui.money}`);
        console.log(`Expected game balance: ${this.gameAccountBalance}`);
        console.log(`Expected arena balance: ${previousArenaBalance + amount}`);
      } else {
        console.log(`No UI available to show arena balance`);
      }

      // Final verification - if there's a discrepancy, fix it one more time
      if (
        this.scene.ui &&
        Math.abs(this.scene.ui.money - (previousArenaBalance + amount)) > 0.001
      ) {
        console.warn(
          `EMERGENCY FIX - Arena balance still incorrect! Applying final fix.`
        );
        this.scene.ui.money = previousArenaBalance + amount;

        // Update the display text again
        if (this.scene.ui.moneyText) {
          this.scene.ui.moneyText.setText(
            "💵 Arena: $" + this.scene.ui.money.toFixed(2)
          );
        }

        // Emit updated events
        this.scene.events.emit("moneyUpdated", this.scene.ui.money);
        this.scene.events.emit("arenaBalanceUpdated", this.scene.ui.money);
      }

      return true;
    } catch (error) {
      // Step 5: Error handling - try to recover if possible
      console.error("ERROR IN DEPOSIT TO ARENA:", error);

      // Attempt recovery - ensure game account was decremented
      if (this.gameAccountBalance !== this.playerData.gameAccountBalance) {
        this.playerData.gameAccountBalance = this.gameAccountBalance;
        this.savePlayerData();
      }

      // Try one last direct UI update
      try {
        if (this.scene.ui) {
          const initialArenaBalance = this.scene.ui.money || 0;
          this.scene.ui.money = initialArenaBalance + amount;

          if (this.scene.ui.moneyText) {
            this.scene.ui.moneyText.setText(
              "💵 Arena: $" + this.scene.ui.money.toFixed(2)
            );
          }

          this.scene.events.emit("moneyUpdated", this.scene.ui.money);
          console.log(
            `RECOVERY ATTEMPT - Arena balance set to ${this.scene.ui.money}`
          );
          return true;
        } else {
          console.warn(
            "RECOVERY ATTEMPT - No UI available, but game account was updated"
          );
          return true; // Return true since the game account was updated successfully
        }
      } catch (recoveryError) {
        console.error(
          "CRITICAL FAILURE - Recovery attempt failed:",
          recoveryError
        );
        return false;
      }
    }
  }

  /**
   * Withdraw from arena to game account
   * @param {number} amount - Amount of game credits to withdraw from arena to game account
   * @param {number} [totalArenaBalance] - Total arena balance to withdraw (optional)
   * @returns {boolean} Whether the transaction succeeded
   */
  withdrawFromArena(amount, totalArenaBalance) {
    // Check if player has funds in arena - try multiple ways to get the balance
    let arenaBalance = 0;

    // Method 1: Use the passed totalArenaBalance parameter (most reliable)
    if (totalArenaBalance !== undefined && totalArenaBalance > 0) {
      arenaBalance = totalArenaBalance;
    }
    // Method 2: Try to get through getMoney() function
    else if (this.scene.ui && typeof this.scene.ui.getMoney === "function") {
      arenaBalance = this.scene.ui.getMoney();
    }
    // Method 3: Try to access money property directly
    else if (this.scene.ui && typeof this.scene.ui.money === "number") {
      arenaBalance = this.scene.ui.money;
    }
    // Method 4: Last resort - check if there's a moneyText that might have the value
    else if (this.scene.ui && this.scene.ui.moneyText) {
      try {
        // Try to parse the money from the text (format: "💵 Arena: $X")
        const moneyText = this.scene.ui.moneyText.text;
        const moneyMatch = moneyText.match(/\$(\d+(\.\d+)?)/);
        if (moneyMatch && moneyMatch[1]) {
          arenaBalance = parseFloat(moneyMatch[1]);
        }
      } catch (e) {
        console.error("Error parsing money from text:", e);
      }
    }

    console.log(
      `Withdrawal requested: amount=${amount}, totalArenaBalance=${totalArenaBalance}, detected balance=${arenaBalance}`
    );

    // If there's no balance, we can't withdraw
    if (arenaBalance <= 0) {
      console.error(`Insufficient arena balance: have ${arenaBalance}`);
      // Force a minimum test value if in development mode
      if (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
      ) {
        console.warn("DEV MODE: Using minimum test value despite zero balance");
        arenaBalance = 10;
      } else {
        return false;
      }
    }

    // Balance to withdraw is the arena balance we detected
    const balanceToWithdraw = arenaBalance;

    // Update arena balance (subtract the full balance)
    if (this.scene.ui) {
      console.log(
        `FULL WITHDRAWAL: Setting arena balance to 0 (was: ${balanceToWithdraw})`
      );

      // Use ALL available methods to ensure UI is updated

      // Method 1: Use updateMoney if available
      if (typeof this.scene.ui.updateMoney === "function") {
        this.scene.ui.updateMoney(-balanceToWithdraw);
        console.log(`Called updateMoney(-${balanceToWithdraw})`);
      }

      // Method 2: Always directly set money property to 0
      if (typeof this.scene.ui.money === "number") {
        this.scene.ui.money = 0; // Set to zero since we're withdrawing everything
        console.log(`Set ui.money = 0 directly`);
      }

      // Method 3: Always update text display if it exists
      if (this.scene.ui.moneyText) {
        this.scene.ui.moneyText.setText("💵 Arena: $0.00");
        console.log(`Updated moneyText to show $0.00`);
      }

      // Method 4: Emit events to notify all components
      try {
        this.scene.events.emit("moneyUpdated", 0);
        this.scene.events.emit("arenaBalanceUpdated", 0);
        console.log(`Emitted money update events with value 0`);
      } catch (e) {
        console.error(`Error emitting money events: ${e}`);
      }

      // Verify the update worked
      const verifyMoney = this.scene.ui.getMoney
        ? this.scene.ui.getMoney()
        : typeof this.scene.ui.money === "number"
        ? this.scene.ui.money
        : "unknown";
      console.log(
        `VERIFICATION: Arena balance after withdrawal: ${verifyMoney}`
      );
    } else {
      console.warn(
        "No UI component found to update arena balance - will still update game account"
      );
    }

    // Update game account balance (add the calculated amount)
    this.updateGameAccountBalance(amount);
    console.log(
      `Added ${amount} credits to game account (from total arena balance of ${balanceToWithdraw})`
    );

    return true;
  }
  /**
   * Returns the public address of the connected wallet * Miguel Addition
   * @returns {string|null}
   */
  getWalletAddress() {
    return this.wallet && typeof this.wallet.getPublicKey === "function"
      ? this.wallet.getPublicKey()
      : null;
  }

  /**
   * Update the player's credit_count in the database
   * @param {number} creditCount - New credit count value
   * @returns {Promise<Object>} Response from API
   */
  async setCreditCount(creditCount) {
    if (!this.isAuthenticated || !this.authToken) {
      console.error("Cannot update credit count: Not authenticated");
      console.log("Authentication state:", { 
        isAuthenticated: this.isAuthenticated, 
        hasToken: !!this.authToken, 
        tokenLength: this.authToken ? this.authToken.length : 0 
      });
      throw new Error("Not authenticated");
    }
    
    try {
      console.log("Preparing credit_count update in DB:", {
        creditCount,
        tokenLongitud: this.authToken ? this.authToken.length : 0,
        tokenPrimeros10: this.authToken ? this.authToken.substring(0, 10) + '...' : null,
        userId: this.playerData?._id
      });
      const response = await setCreditCount(this.authToken, creditCount);
      console.log("Credit count updated successfully in DB", response);
      return response;
    } catch (error) {
      console.error("Error updating credit_count in DB:", error);
      if (error.response) {
        console.error("Error details:", {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  }

/**
   * Withdraw BONK tokens from the game account.
   * Calls the withdrawBonk function from api.js and explicitly updates the database balance.
   * @param {number|null} amount - Amount to withdraw, or null to withdraw all.
   * @returns {Promise<boolean>} - True if successful.
   */
  async withdrawBonkFromGameAccount(amount = null) {
    if (!this.isAuthenticated || !this.authToken) {
      console.error("Cannot withdraw bonks: Not authenticated");
      throw new Error("Not authenticated");
    }
    const walletAddr = this.getWalletAddress();
    if (!walletAddr) {
      console.error("No wallet address available for withdrawal.");
      throw new Error("No wallet address available.");
    }
    // Si no se especifica un monto, se retiran todos los bonks disponibles
    if (amount === null) {
      amount = this.bonkBalance;
    }
    try {
      // 1. Primero enviamos los Bonks a la wallet del usuario
      const result = await withdrawBonk(this.authToken, walletAddr, amount);
      console.log("WithdrawBonkFromGameAccount result:", result);
      
      // 2. Calculamos el nuevo saldo de Bonks
      const newBonkBalance = amount === this.bonkBalance ? 0 : Math.max(0, this.bonkBalance - amount);
      
      // 3. Actualizamos explícitamente el saldo en la base de datos
      const updateResult = await updateEarnCount(this.authToken, newBonkBalance);
      console.log("UpdateBonkCount result:", updateResult);
      
      // 4. Actualizamos el saldo local con el valor de la base de datos
      if (updateResult && updateResult.newBonkBalance !== undefined) {
        this.bonkBalance = updateResult.newBonkBalance;
        this.playerData.bonkBalance = updateResult.newBonkBalance;
      } else {
        // Si no recibimos un nuevo valor, usamos el calculado localmente
        this.bonkBalance = newBonkBalance;
        this.playerData.bonkBalance = newBonkBalance;
      }
      
      // 5. Guardamos los datos actualizados localmente
      this.savePlayerData();
      
      return true;
    } catch (error) {
      console.error("Failed to withdraw bonks:", error);
      throw error;
    }
  }
}
