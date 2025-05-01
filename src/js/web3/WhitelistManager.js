import { WEB3_CONFIG } from '../../config.js';

/**
 * WhitelistManager - Manages wallet address whitelisting
 * Checks if a wallet is authorized to play the game
 */
export class WhitelistManager {
  constructor() {
    this.whitelistedAddresses = new Set();
    this.isLoaded = false;
    this.whitelistRequired = WEB3_CONFIG.whitelistRequired !== false; // Default to true if not defined
    this.loadWhitelist();
  }

  /**
   * Load the whitelist from whitelist.txt file
   */
  async loadWhitelist() {
    try {
      // Fetch the whitelist.txt file
      const response = await fetch('/whitelist.txt');
      if (!response.ok) {
        console.error('Failed to load whitelist file:', response.status);
        return;
      }

      const text = await response.text();
      
      // Parse the whitelist file (skip comments and empty lines)
      const addresses = text.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      // Add each address to our set
      addresses.forEach(address => {
        this.whitelistedAddresses.add(address);
      });
      
      this.isLoaded = true;
      console.log(`Whitelist loaded: ${this.whitelistedAddresses.size} addresses`);
    } catch (error) {
      console.error('Error loading whitelist:', error);
    }
  }

  /**
   * Check if a wallet address is whitelisted
   * @param {string} address - Wallet address to check
   * @returns {boolean} True if whitelisted, false otherwise
   */
  isWhitelisted(address) {
    // If whitelisting is disabled, allow all wallets
    if (!this.whitelistRequired) {
      return true;
    }
    
    // If the whitelist isn't loaded yet, allow access temporarily
    // This prevents blocking during loading
    if (!this.isLoaded) {
      console.warn('Whitelist not loaded yet, allowing access temporarily');
      return true;
    }
    
    // Check if the address is in our whitelist
    return this.whitelistedAddresses.has(address);
  }

  /**
   * Refreshes the whitelist from the server
   * Useful when the whitelist has been updated
   */
  async refreshWhitelist() {
    // Clear existing list
    this.whitelistedAddresses.clear();
    this.isLoaded = false;
    
    // Reload the whitelist
    await this.loadWhitelist();
    return this.isLoaded;
  }
}