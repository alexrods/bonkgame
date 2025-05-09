import { updateEarnCount, getUserInfo } from "../utils/api.js";

/**
 * BonkGameAccount - Manages global BONK balances across the game
 * Keeps track of the total BONK earned and allows syncing with server
 */
export class BonkGameAccount {
  constructor(scene) {
    this.scene = scene;
    this.bonkBalance = 0;
    this.initialized = false;
    
    // Initialize bonk balance from localStorage if available
    this.init();
  }

  /**
   * Initialize bonk balance
   * Loads from localStorage if available
   */
  init() {
    try {
      const savedBalance = localStorage.getItem("bonkGameAccountBalance");
      if (savedBalance && !isNaN(parseFloat(savedBalance))) {
        this.bonkBalance = parseFloat(savedBalance);
        console.log(`Loaded global BONK balance from localStorage: ${this.bonkBalance}`);
      }
      this.initialized = true;
    } catch (error) {
      console.error("Error loading BONK balance from localStorage:", error);
      this.bonkBalance = 0;
    }
  }

  /**
   * Save bonk balance to localStorage
   */
  save() {
    try {
      localStorage.setItem("bonkGameAccountBalance", this.bonkBalance.toString());
    } catch (error) {
      console.error("Error saving BONK balance to localStorage:", error);
    }
  }

  /**
   * Get the current bonk balance
   * @returns {number} Current BONK balance
   */
  getBonkBalance() {
    return this.bonkBalance;
  }

  /**
   * Set the bonk balance to a specific value
   * @param {number} amount - New BONK balance
   * @returns {number} New BONK balance
   */
  setBonkBalance(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      console.error(`Invalid BONK balance: ${amount}`);
      return this.bonkBalance;
    }
    
    this.bonkBalance = Math.max(0, amount);
    this.save();
    
    // Emit event so UI elements can update
    try {
      if (this.scene && this.scene.events) {
        this.scene.events.emit("bonkBalanceUpdated", this.bonkBalance);
        console.log(`Global BONK balance updated to ${this.bonkBalance}`);
      }
    } catch (error) {
      console.error("Error emitting bonkBalanceUpdated event:", error);
    }
    
    return this.bonkBalance;
  }

  /**
   * Update bonk balance by adding or subtracting amount
   * @param {number} amount - Amount to add (positive) or subtract (negative)
   * @returns {number} New BONK balance
   */
  updateBonkBalance(amount) {
    return this.setBonkBalance(this.bonkBalance + amount);
  }

  /**
   * Sync bonk balance with server
   * @param {string} authToken - Authentication token for the API
   * @param {boolean} addToExisting - Whether to add to existing earns or replace it
   * @param {number} arenaBonus - Optional bonus from arena bonk balance to include
   * @returns {Promise<Object>} Response from API
   */
  async syncWithServer(authToken, addToExisting = true, arenaBonus = 0) {
    if (!authToken) {
      console.error("Cannot sync BONK balance: No authentication token provided");
      return Promise.reject(new Error("No authentication token provided"));
    }
    
    try {
      // Check if we have a valid arena bonus to add
      if (arenaBonus === undefined || arenaBonus === null) {
        arenaBonus = 0;
      }
      
      // Ensure arenaBonus is a number
      if (typeof arenaBonus !== 'number') {
        try {
          arenaBonus = parseFloat(arenaBonus) || 0;
        } catch (e) {
          console.error("Could not parse arenaBonus to number, defaulting to 0:", e);
          arenaBonus = 0;
        }
      }
      
      // Make sure we have a valid bonus amount (no negative values)
      arenaBonus = Math.max(0, arenaBonus);
      
      // Use the total of global balance plus any arena bonus passed in
      const totalBonks = this.bonkBalance;
      
      // FIXED: Instead of directly updating, first get the current server value
      if (addToExisting) {
        try {
          // Get current user info to determine existing earns
          const userInfo = await getUserInfo(authToken);
          const existingEarns = userInfo.user && userInfo.user.earns ? parseFloat(userInfo.user.earns) : 0;
          
          // Calculate combined total
          const combinedTotal = existingEarns + totalBonks + arenaBonus;
          
          console.log(`FIXED syncWithServer: Retrieved current balance from server: ${existingEarns}`);
          console.log(`FIXED syncWithServer: Setting combined total: ${existingEarns} + ${totalBonks} + ${arenaBonus} = ${combinedTotal}`);
          
          // Update with the exact combined total (don't add to existing)
          const response = await updateEarnCount(authToken, combinedTotal, false);
          
          console.log("FIXED: Successfully set exact BONK balance on server", response);
          return response;
        } catch (userInfoError) {
          console.error('Error fetching user info in syncWithServer:', userInfoError);
          // Fall back to original behavior if user info fetch fails
        }
      }
      
      // Original behavior as fallback
      console.log(`Syncing BONK balance with server: ${totalBonks} (global balance)${addToExisting ? ' (adding to existing)' : ' (replacing existing)'}`);
      
      
      // First update the global balance alone
      const response = await updateEarnCount(authToken, totalBonks, addToExisting);
      
      // Check if we have arena bonuses to add
      if (arenaBonus > 0) {
        console.log(`Adding BONK arena bonus to server: ${arenaBonus} (arena bonus)`);
        
        // Now update with the arena bonus (always add to existing)
        const bonusResponse = await updateEarnCount(authToken, arenaBonus, true);
        console.log("Successfully added arena BONK bonus to server", bonusResponse);
        
        // Return the bonus response as it has the most up-to-date total
        return bonusResponse;
      }
      
      console.log("Successfully synced BONK balance with server", response);
      return response;
    } catch (error) {
      console.error("Error syncing BONK balance with server:", error);
      throw error;
    }
  }

  /**
   * Reset bonk balance to zero
   * @returns {number} New BONK balance (always 0)
   */
  reset() {
    this.bonkBalance = 0;
    this.save();
    
    // Emit event so UI elements can update
    try {
      if (this.scene && this.scene.events) {
        this.scene.events.emit("bonkBalanceUpdated", this.bonkBalance);
        console.log("Global BONK balance reset to 0");
      }
    } catch (error) {
      console.error("Error emitting bonkBalanceUpdated event:", error);
    }
    
    return this.bonkBalance;
  }
}