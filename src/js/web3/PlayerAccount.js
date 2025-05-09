import {
  createOrGetWallet,
  getUserInfo,
  updateCredit,
  setCreditCount,
  withdrawCredit
} from "../utils/api.js";
import { SolanaWallet } from "./SolanaWallet.js";
import { WhitelistManager } from "./WhitelistManager.js";
import { BonkGameAccount } from "./BonkGameAccount.js";
import { ArenaBonkAccount } from "./ArenaBonkAccount.js";

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

    // BONK account classes
    this.bonkGameAccount = new BonkGameAccount(scene);
    this.arenaBonkAccount = new ArenaBonkAccount(scene);
    
    // Make sure arena BONK account is properly initialized to 0
    if (this.arenaBonkAccount) {
      this.arenaBonkAccount.init();
    }

    // BONK balance - legacy - we'll keep this for backward compatibility
    this.bonkBalance = 0;

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
      bonkBalance: 0, // Add BONK token balance to player data (for backward compatibility)
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

        // Sync global BONK balance with bonkGameAccount
        // Note: We're also keeping the legacy bonkBalance property for backward compatibility
        const globalBonkBalance = this.playerData.bonkBalance || 0;
        this.bonkBalance = globalBonkBalance;
        
        // Update the bonkGameAccount with the global balance
        if (this.bonkGameAccount) {
          this.bonkGameAccount.setBonkBalance(globalBonkBalance);
        }
        
        // Arena bonk account always starts at 0 for each session
        if (this.arenaBonkAccount) {
          // Call init() to properly reset and initialize the arena account
          this.arenaBonkAccount.init();
          // Explicitly set balance to 0 again for extra safety
          this.arenaBonkAccount.setBonkBalance(0);
          console.log("Arena BONK account initialized and set to 0 during player data init");
        }
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
      
      // Check for BONK balance in the database
      let serverBonkBalance = userInfo.earn || 0;
      
      // Check for backup BONK balance in localStorage (could be from previous sessions)
      let localBackupBonkBalance = 0;
      try {
        const backupBalanceStr = localStorage.getItem("bonkBalanceBackup");
        if (backupBalanceStr && !isNaN(parseFloat(backupBalanceStr))) {
          localBackupBonkBalance = parseFloat(backupBalanceStr);
          console.log(`Found local BONK balance backup: ${localBackupBonkBalance}`);
        }
      } catch (lsError) {
        console.warn("Error checking for BONK backup in localStorage:", lsError);
      }
      
      // Use the higher of the database value and local backup
      const highestBonkBalance = Math.max(serverBonkBalance, localBackupBonkBalance);
      console.log(`Using highest BONK balance: ${highestBonkBalance} (server: ${serverBonkBalance}, local: ${localBackupBonkBalance})`);
      
      // If there's a discrepancy and the local backup is higher, update the database
      if (localBackupBonkBalance > serverBonkBalance && this.authToken) {
        try {
          // Import updateEarnCount
          const { updateEarnCount } = require("../utils/api.js");
          
          // Update the database with the higher value
          updateEarnCount(this.authToken, localBackupBonkBalance)
            .then(() => console.log(`Updated DB with backed up BONK balance: ${localBackupBonkBalance}`))
            .catch(err => console.error('Error updating BONK balance on connect:', err));
            
          // After successful backup restoration, clear the backup
          localStorage.removeItem("bonkBalanceBackup");
        } catch (updateErr) {
          console.error("Error updating DB with backup BONK balance:", updateErr);
        }
      }
      
      // Set the BONK balance to the highest value found (for backward compatibility)
      this.bonkBalance = highestBonkBalance;
      
      // Also update the bonkGameAccount with the global balance
      if (this.bonkGameAccount) {
        this.bonkGameAccount.setBonkBalance(highestBonkBalance);
      }
      
      // Arena bonk account always starts at 0 for each session
      if (this.arenaBonkAccount) {
        // Call init() to properly reset and initialize the arena account
        this.arenaBonkAccount.init();
        // Explicitly set balance to 0 again for extra safety
        this.arenaBonkAccount.setBonkBalance(0);
        console.log("Arena BONK account initialized and set to 0 during wallet connect");
      }

      // Update local state
      this.isAuthenticated = true;
      this.playerData = {
        ...this.playerData,
        address: publicKey,
        gameAccountBalance: userInfo.credit_count || 0,
        bonkBalance: highestBonkBalance, // Use the highest balance
      };

      // Save updated player data
      this.savePlayerData();

      // Notify the game
      this.scene.events.emit("player-authenticated", this.playerData);
      this.scene.events.emit(
        "gameAccountUpdated",
        this.playerData.gameAccountBalance
      );
      this.scene.events.emit(
        "bonkBalanceUpdated",
        this.playerData.bonkBalance
      );

      console.log("Player authenticated:", publicKey);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      this.handleWalletDisconnect();
    }
  }

  /**
   * Handle wallet disconnection
   */
  handleWalletDisconnect() {
    // Before disconnecting, ensure current BONK balance is saved to DB
    if (this.isAuthenticated && this.authToken && this.playerData && this.playerData.bonkBalance > 0) {
      try {
        // Import the updateEarnCount function if available
        const { updateEarnCount } = require("../utils/api.js");
        
        // Make a final attempt to save the player's BONK balance to the database
        updateEarnCount(this.authToken, this.playerData.bonkBalance)
          .then(() => console.log(`Disconnect: Final DB update of BONK balance: ${this.playerData.bonkBalance}`))
          .catch(err => console.error('Error updating BONK balance during disconnect:', err));
      } catch (error) {
        console.error('Could not import updateEarnCount during disconnect:', error);
      }
    }
    
    this.isAuthenticated = false;

    // Don't clear playerData completely, just mark as not authenticated
    // IMPORTANT: Save the data even though we're disconnecting
    const savedAddress = this.playerData.address;
    this.playerData.address = null;
    
    // Save the current state to localStorage
    try {
      this.savePlayerData();
      console.log(`Saved player data during disconnect with bonkBalance: ${this.playerData.bonkBalance}`);
    } catch (saveErr) {
      console.error('Error saving player data during disconnect:', saveErr);
    }

    // Clear authenticated flag in localStorage
    try {
      localStorage.removeItem("walletAuthenticated");
      localStorage.removeItem("connectedWalletAddress");
      
      // Save a dedicated backup of BONK balance
      if (this.playerData && this.playerData.bonkBalance > 0) {
        localStorage.setItem("bonkBalanceBackup", this.playerData.bonkBalance);
        console.log(`Saved BONK balance backup: ${this.playerData.bonkBalance}`);
      }
    } catch (err) {
      console.warn("Could not clear wallet auth status from localStorage", err);
    }

    // Notify the game that player is no longer authenticated
    this.scene.events.emit("player-disconnected");

    console.log(`Player disconnected (wallet: ${savedAddress}, BONK balance: ${this.playerData.bonkBalance})`);
  }

  /**
   * Save player data to localStorage
   */
  savePlayerData() {
    // Make sure gameAccountBalance is synced to playerData before saving
    this.playerData.gameAccountBalance = this.gameAccountBalance;
    
    // Sync bonk balances from the account classes to playerData
    if (this.bonkGameAccount) {
      const globalBonkBalance = this.bonkGameAccount.getBonkBalance();
      this.playerData.bonkBalance = globalBonkBalance;
      // Also update the legacy property for backward compatibility
      this.bonkBalance = globalBonkBalance;
    } else {
      // Fallback to legacy property
      this.playerData.bonkBalance = this.bonkBalance;
    }

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
        { programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
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
   * @param {boolean} [fromArena=false] - Whether to get the arena balance instead of global
   * @returns {number} Current BONK balance
   */
  getBonkBalance(fromArena = false) {
    if (fromArena) {
      return this.arenaBonkAccount ? this.arenaBonkAccount.getBonkBalance() : 0;
    }
    return this.bonkGameAccount ? this.bonkGameAccount.getBonkBalance() : this.bonkBalance;
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
   * @param {boolean} [toArena=false] - Whether to update the arena balance instead of global
   * @returns {number} New BONK balance
   */
  updateBonkBalance(amount, toArena = false) {
    let newBalance = 0;
    
    if (toArena) {
      // Update the arena-specific BONK balance
      if (this.arenaBonkAccount) {
        newBalance = this.arenaBonkAccount.updateBonkBalance(amount);
        console.log(`Updated arena BONK balance by ${amount} to ${newBalance}`);
      } else {
        console.warn("Cannot update arena BONK balance: ArenaBonkAccount not available");
        return 0;
      }
    } else {
      // Update the global BONK balance
      if (this.bonkGameAccount) {
        newBalance = this.bonkGameAccount.updateBonkBalance(amount);
        console.log(`Updated global BONK balance by ${amount} to ${newBalance}`);
        
        // Also update legacy property for backward compatibility
        this.bonkBalance = newBalance;
        
        // Update player data and save
        this.playerData.bonkBalance = newBalance;
        this.savePlayerData();
      } else {
        // Fallback to legacy behavior
        this.bonkBalance += amount;
        
        // Ensure balance doesn't go below zero
        if (this.bonkBalance < 0) {
          this.bonkBalance = 0;
        }
        
        newBalance = this.bonkBalance;
        
        // Update player data and save
        this.playerData.bonkBalance = this.bonkBalance;
        this.savePlayerData();
        
        // Emit event manually (since we're not using the account class)
        try {
          if (this.scene && this.scene.events) {
            console.log(`Emitting bonkBalanceUpdated event with balance: ${this.bonkBalance}`);
            this.scene.events.emit("bonkBalanceUpdated", this.bonkBalance);
          }
        } catch (error) {
          console.error("Error emitting bonkBalanceUpdated event:", error);
        }
      }
    }

    return newBalance;
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
   * Withdraw from game account to Solana wallet
   * @param {number} gameCredits - Amount of game credits to withdraw
   * @param {number} solAmount - Equivalent SOL to receive
   * @returns {boolean} Whether the transaction succeeded
   */
  async withdrawFromGameAccount(amount) {
    if (!this.isAuthenticated || !this.authToken) {
      throw new Error("Not authenticated");
    }

    // Create a deliberate delay to show the waiting screen
    // This is important so users don't think the transaction is happening instantly
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      console.log(`Starting withdrawal of ${amount} credits to wallet ${this.wallet.getPublicKey()}`);
      
      // Call the backend API to withdraw funds
      const result = await withdrawCredit(this.authToken, this.wallet.getPublicKey(), amount);
      
      // Add a second delay to simulate blockchain transaction time
      // This gives users confidence that something is actually happening
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log("Withdrawal transaction successful:", result);

      // Update local state
      this.playerData.credit_count = Math.max(
        0,
        this.playerData.credit_count - amount
      );
      this.savePlayerData();

      // Emit update event
      this.scene.events.emit(
        "gameAccountUpdated",
        this.playerData.credit_count
      );

      return true;
    } catch (error) {
      console.error("Error withdrawing from game account:", error);
      
      // Let's add some basic error categorization
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Server error response:", {
          status: error.response.status,
          data: error.response.data
        });
        
        // Check for specific status codes
        if (error.response.status === 401) {
          throw new Error("Authentication error. Please reconnect your wallet.");
        } else if (error.response.status === 400) {
          throw new Error("Invalid withdrawal request. Please check your balance.");
        } else if (error.response.status === 429) {
          throw new Error("Too many withdrawal attempts. Please try again later.");
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error("No response from server:", error.request);
        throw new Error("Server not responding. Please check your connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Request setup error:", error.message);
      }
      
      // If we haven't thrown a specific error yet, throw a generic one
      throw new Error("Withdrawal failed: " + (error.message || "Unknown error"));
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
      console.log("Estado de autenticación:", { 
        isAuthenticated: this.isAuthenticated, 
        hasToken: !!this.authToken, 
        tokenLength: this.authToken ? this.authToken.length : 0 
      });
      throw new Error("Not authenticated");
    }
    
    try {
      console.log("Preparando actualización de credit_count en DB:", {
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
        console.error("Detalles del error:", {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  }
}
