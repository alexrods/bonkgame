/**
 * ArenaBonkAccount - Manages BONK balance earned in the current arena session
 * This balance can be transferred to the global account through the ATM hack
 */
export class ArenaBonkAccount {
  constructor(scene) {
    this.scene = scene;
    this.bonkBalance = 0;
    this.initialized = false;
    
    // Initialize bonk balance for this arena session
    this.init();
  }

  /**
   * Initialize arena bonk balance
   * We don't load from localStorage since this resets each session
   */
  init() {
    // Force reset to zero balance at start of a game
    this.bonkBalance = 0;
    this.initialized = true;
    
    // Emit event so UI elements can update
    try {
      if (this.scene && this.scene.events) {
        this.scene.events.emit("arenaBonkBalanceUpdated", this.bonkBalance);
        
        // Also emit bonkBalanceUpdated for broader compatibility
        this.scene.events.emit("bonkBalanceUpdated", this.bonkBalance);
      }
    } catch (error) {
      console.error("Error emitting balance update events during init:", error);
    }
    
    console.log("Arena BONK account initialized with zero balance");
    return this.bonkBalance;
  }

  /**
   * Get the current arena bonk balance
   * @returns {number} Current arena BONK balance
   */
  getBonkBalance() {
    return this.bonkBalance;
  }

  /**
   * Set the arena bonk balance to a specific value
   * @param {number} amount - New arena BONK balance
   * @returns {number} New arena BONK balance
   */
  setBonkBalance(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      console.error(`Invalid arena BONK balance: ${amount}`);
      return this.bonkBalance;
    }
    
    this.bonkBalance = Math.max(0, amount);
    
    // Emit event so UI elements can update
    try {
      if (this.scene && this.scene.events) {
        this.scene.events.emit("arenaBonkBalanceUpdated", this.bonkBalance);
        console.log(`Arena BONK balance updated to ${this.bonkBalance}`);
      }
    } catch (error) {
      console.error("Error emitting arenaBonkBalanceUpdated event:", error);
    }
    
    return this.bonkBalance;
  }

  /**
   * Update arena bonk balance by adding or subtracting amount
   * @param {number} amount - Amount to add (positive) or subtract (negative)
   * @returns {number} New arena BONK balance
   */
  updateBonkBalance(amount) {
    return this.setBonkBalance(this.bonkBalance + amount);
  }

  /**
   * Transfer the arena bonk balance to a destination account
   * @param {BonkGameAccount} destinationAccount - The account to transfer to
   * @returns {Object} Object containing the transferred amount and new arena balance
   */
  transferToAccount(destinationAccount) {
    if (!destinationAccount) {
      console.error("No destination account provided for transfer");
      return { transferred: 0, newBalance: this.bonkBalance };
    }
    
    const amountToTransfer = this.bonkBalance;
    
    // Add to destination account
    if (typeof destinationAccount.updateBonkBalance === 'function') {
      destinationAccount.updateBonkBalance(amountToTransfer);
      console.log(`Transferred ${amountToTransfer} BONK to global account`);
    } else {
      console.error("Destination account does not have updateBonkBalance method");
      return { transferred: 0, newBalance: this.bonkBalance };
    }
    
    // Reset arena balance
    this.bonkBalance = 0;
    
    // Emit event for UI update
    try {
      if (this.scene && this.scene.events) {
        this.scene.events.emit("arenaBonkBalanceUpdated", this.bonkBalance);
        console.log("Arena BONK balance reset to 0 after transfer");
      }
    } catch (error) {
      console.error("Error emitting arenaBonkBalanceUpdated event:", error);
    }
    
    return { transferred: amountToTransfer, newBalance: 0 };
  }

  /**
   * Reset arena bonk balance to zero
   * @returns {number} New arena BONK balance (always 0)
   */
  reset() {
    this.bonkBalance = 0;
    
    // Emit event so UI elements can update
    try {
      if (this.scene && this.scene.events) {
        this.scene.events.emit("arenaBonkBalanceUpdated", this.bonkBalance);
        console.log("Arena BONK balance reset to 0");
      }
    } catch (error) {
      console.error("Error emitting arenaBonkBalanceUpdated event:", error);
    }
    
    return this.bonkBalance;
  }
}