/**
 * NFTCollectionChecker.js
 * Utility for verifying if a user owns NFTs from a specific collection on Solana
 * Browser compatible and optimized for BonkGames
 */

import { SolanaWallet } from "../web3/SolanaWallet.js";
import { NFTCollectionReader } from "../web3/NFTCollectionReader.js";
import { PublicKey } from "@solana/web3.js";
import api from "./api.js";

// Address of the NFT collection we want to verify
const DEFAULT_COLLECTION_ADDRESS = "46LY71e113S4vEmJ1C8RrzCYnw3oW7VF4tq5Mqrsh45X"; // The BonkGames collection address en mainnet

/**
 * NFTCollectionChecker - Script to verify if a user owns NFTs from a specific collection
 * Integrated with the BonkGames authentication system
 */
class NFTCollectionChecker {
  /**
   * Constructor
   * @param {string} defaultCollectionAddress - Default collection address (optional)
   */
  constructor(defaultCollectionAddress = "") {
    this.wallet = new SolanaWallet();
    this.nftReader = new NFTCollectionReader();
    this.isChecking = false;
    this.authToken = null;
    this.defaultCollectionAddress = defaultCollectionAddress;
    this.network = "mainnet-beta"; // Default network
    
    // Properties to store Bloodlines information
    this.playerBloodlines = []; // List of unique player bloodlines
    this.bonkGamesNFTs = []; // List of Bonk Games NFTs found
    this.bloodlineCounts = {}; // Counter for each bloodline type
  }
  
  /**
   * Initializes the checker and sets up listeners
   * @param {string} [network="devnet"] - Solana network to use (mainnet-beta, devnet)
   */
  init(network = "mainnet-beta") {
    // Crear un identificador único para los elementos de bloqueo
    this.blockUIId = 'nft-verification-blocker-' + Math.random().toString(36).substring(2, 9);
    this.isBlocking = false;
    
    // Set up listeners for wallet events
    this.wallet.onConnect(this.handleWalletConnect.bind(this));
    this.wallet.onDisconnect(this.handleWalletDisconnect.bind(this));
    
    // Initialize Solana connection
    this.wallet.initConnection();
    
    // If there is already a connected wallet, use that connection
    if (this.wallet.connection) {
      this.nftReader.setConnection(this.wallet.connection);
    } else {
      // Configure the network in the nftReader
      this.nftReader.setNetwork(network);
    }
    
    console.log(`NFTCollectionChecker initialized on network ${network}`);
  }

  /**
   * Handles wallet connection
   * @param {string} publicKey - Public key of the connected wallet
   */
  async handleWalletConnect(publicKey) {
    console.log("Wallet connected:", publicKey);
    
    try {
      // Before verification, try to remove any previous mint message
      // for cases where the user changes from a wallet without NFTs to one with NFTs
      this.removeMintNFTMessage();
      
      // Block interactions during verification (if they weren't already blocked)
      this.blockGameInteractions("Connecting wallet and verifying NFTs...");
      
      // Update UI to show we're connected
      this.updateUI(true);
      
      // Authenticate with the backend
      try {
        const response = await api.post("/users/login", {
          nft_address: publicKey,
        });
        
        this.authToken = response.data.token;
        console.log("User authenticated successfully");
      } catch (authError) {
        console.warn("Could not authenticate with the backend, but continuing with NFT verification", authError);
      }
      
      // Show verification message
      this.showResult(null, "Looking for NFTs in your wallet...");
      
      // Verify if the user has NFTs from the specific collection
      const hasNFT = await this.checkCollection();
      
      if (hasNFT) {
        console.log(`NFTs from collection ${this.defaultCollectionAddress} found in the wallet`);
      } else {
        console.log(`No NFTs from collection ${this.defaultCollectionAddress} found in the wallet`);
      }
      
      // Unblock interactions when finished (only if there were no errors)
      // Note: We don't unblock if the user doesn't have NFTs, as the mint message should remain visible
      if (hasNFT && !hasNFT.needsNFT) {
        this.unblockGameInteractions();
      }
      
    } catch (error) {
      console.error("Error in wallet connection:", error);
      this.updateUI(false);
      this.showResult(false, "An error occurred while verifying your wallet. Please try again.");
      
      // In case of error, unblock interactions
      this.unblockGameInteractions();
    }
  }
  
  /**
   * Handles wallet disconnection
   */
  handleWalletDisconnect() {
    console.log("Wallet disconnected");
    
    // Clear all data related to NFTs and bloodlines
    this.nftsFound = [];
    this.bonkGamesNFTs = [];
    this.playerBloodlines = [];
    this.bloodlineCounts = {};
    this.authToken = null;
    
    // Update UI to show we're disconnected
    this.updateUI(false);
    this.clearResult();
    
    // Ensure interactions are unblocked
    this.unblockGameInteractions();
    
    // Notify that NFTs are no longer available
    if (this.onNFTsUnavailable) this.onNFTsUnavailable();
    
    console.log('NFT and bloodlines data cleared after disconnection');
  }
  
  /**
   * Updates the UI to show connection status
   * @param {boolean} isConnected - If the wallet is connected
   */
  updateUI(isConnected) {
    // Basic implementation, can be extended as needed
    console.log(`Connection status updated: ${isConnected ? 'Connected' : 'Disconnected'}`);
  }
  
  /**
   * Shows the result of NFT verification
   * @param {boolean|null} hasNFT - If the user has NFTs (null if verifying)
   * @param {string} message - Message to display
   */
  showResult(hasNFT, message) {
    // Use the wallet notification system
    if (this.wallet && this.wallet.showNotification) {
      this.wallet.showNotification(message);
    } else {
      console.log(`Verification result: ${message}`);
    }
  }
  
  /**
   * Updates player information with the bloodlines found
   * This function can be expanded to sync with a backend
   */
  updatePlayerBloodlines() {
    // If we have access to the PlayerAccount, update there
    if (window.playerAccount) {
      console.log('Updating player bloodlines...');
      
      // Save bloodlines in the player object
      window.playerAccount.bloodlines = this.playerBloodlines;
      
      // If the player has an ID, save in the backend
      if (window.playerAccount.id && this.authToken) {
        try {
          // This can be expanded to send to the backend
          console.log('Player bloodlines updated:', this.playerBloodlines);
          
          // Example of sending to the backend (implement according to API)
          /*
          api.post("/players/updateBloodlines", {
            bloodlines: this.playerBloodlines,
            nftCount: this.bonkGamesNFTs.length
          }, { headers: { "x-auth-token": this.authToken } });
          */
        } catch (error) {
          console.error('Error updating bloodlines:', error);
        }
      }
    } else {
      // Save locally for future use
      localStorage.setItem('playerBloodlines', JSON.stringify(this.playerBloodlines));
      console.log('Bloodlines saved locally:', this.playerBloodlines);
    }
  }
  
  /**
   * Shows a message to the user to acquire an NFT from The Bonk Games
   * with a link to the candy machine
   */
  showMintNFTMessage() {
    console.log('Showing message to mint an NFT from The Bonk Games');
    
    // Candy machine URL
    const candyMachineUrl = 'https://fight.bonkgames.io/';
    
    // Create or find the container for the message
    let messageContainer = document.getElementById('nft-required-message');
    let overlay = document.getElementById('nft-required-overlay');
    
    if (!messageContainer) {
      // Create overlay to block interactions
      overlay = document.createElement('div');
      overlay.id = 'nft-required-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(3px)',
        zIndex: '999',
        pointerEvents: 'all' // Block all interactions
      });
      
      // Create message container
      messageContainer = document.createElement('div');
      messageContainer.id = 'nft-required-message';
      
      // Apply styles to the container
      Object.assign(messageContainer.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#fff',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 0 30px rgba(0, 255, 102, 0.7)',
        zIndex: '1000',
        textAlign: 'center',
        backdropFilter: 'blur(5px)',
        border: '2px solid #00ff66',
        maxWidth: '90%',
        width: '500px'
      });
      
      // Create title
      const title = document.createElement('h2');
      title.textContent = 'NFT Required';
      title.style.marginBottom = '20px';
      title.style.color = '#00ff66';
      title.style.fontFamily = '"Press Start 2P", "Audiowide", sans-serif';
      title.style.fontSize = '24px';
      
      // Create message
      const message = document.createElement('p');
      message.textContent = 'To play, you need an NFT from the "The Bonk Games" collection — mint yours and come back!';
      message.style.marginBottom = '30px';
      message.style.lineHeight = '1.6';
      message.style.fontSize = '18px';
      message.style.padding = '0 10px';
      
      // Create button that redirects to the candy machine (not opening in a new tab to completely stop the game)
      const mintButton = document.createElement('button');
      mintButton.textContent = 'MINT YOUR NFT';
      mintButton.onclick = () => {
        // Store a flag in localStorage to avoid cyclical behavior
        localStorage.setItem('redirectingToMint', 'true');
        // Redirect the current page to the candy machine
        window.location.href = candyMachineUrl;
      };
      Object.assign(mintButton.style, {
        display: 'inline-block',
        padding: '15px 35px',
        backgroundColor: '#00ff66',
        color: '#000',
        textDecoration: 'none',
        borderRadius: '5px',
        fontWeight: 'bold',
        marginTop: '10px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        fontSize: '16px',
        letterSpacing: '1px'
      });
      
      // Hover effect (add event listener)
      mintButton.addEventListener('mouseover', () => {
        mintButton.style.backgroundColor = '#fff';
        mintButton.style.transform = 'scale(1.05)';
        mintButton.style.boxShadow = '0 0 15px rgba(0, 255, 102, 0.7)';
      });
      
      mintButton.addEventListener('mouseout', () => {
        mintButton.style.backgroundColor = '#00ff66';
        mintButton.style.transform = 'scale(1)';
        mintButton.style.boxShadow = 'none';
      });
      
      // Small additional explanatory text
      const note = document.createElement('p');
      note.textContent = 'You can still connect another wallet with NFTs from this collection.';
      note.style.marginTop = '25px';
      note.style.fontSize = '14px';
      note.style.opacity = '0.7';
      
      // Add elements to the container
      messageContainer.appendChild(title);
      messageContainer.appendChild(message);
      messageContainer.appendChild(mintButton);
      messageContainer.appendChild(note);
      
      // Add overlay and message to the document body
      document.body.appendChild(overlay);
      document.body.appendChild(messageContainer);
      
      // Enable only interactions with wallet elements
      this.allowWalletInteractionsOnly();
    }
  }
  
  /**
   * Removes the mint NFT message if it exists
   * Should be called when it's detected that the user has valid NFTs
   */
  removeMintNFTMessage() {
    console.log('Attempting to remove mint NFT message...');
    
    // Find mint message elements
    const messageContainer = document.getElementById('nft-required-message');
    const overlay = document.getElementById('nft-required-overlay');
    
    // Remove elements with animation if they exist
    if (messageContainer || overlay) {
      console.log('Removing mint NFT message');
      
      // Animate disappearance
      if (messageContainer) {
        messageContainer.style.transition = 'all 0.5s ease';
        messageContainer.style.opacity = '0';
        messageContainer.style.transform = 'translate(-50%, -60%)';
      }
      
      if (overlay) {
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
      }
      
      // Remove after animation
      setTimeout(() => {
        if (messageContainer && messageContainer.parentNode) {
          messageContainer.parentNode.removeChild(messageContainer);
        }
        
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        
        console.log('Mint NFT message completely removed');
      }, 500);
    }
  }
  
  /**
   * Allows interactions only with wallet-related elements
   */
  allowWalletInteractionsOnly() {
    // Find all wallet-related elements (connect/disconnect buttons)
    const walletElements = document.querySelectorAll('.wallet-adapter-button, .wallet-connect-button, [data-wallet-button]');
    
    // Ensure these elements are above the overlay and interactive
    walletElements.forEach(element => {
      if (element) {
        // Ensure they are above the overlay
        element.style.zIndex = '1001';
        // Ensure they receive events
        element.style.position = 'relative';
      }
    });
    
    // If we don't find elements with those classes, search by wallet-related text/content
    if (walletElements.length === 0) {
      document.querySelectorAll('button').forEach(button => {
        const buttonText = button.textContent.toLowerCase();
        if (buttonText.includes('wallet') || buttonText.includes('connect') || 
            buttonText.includes('phantom') || buttonText.includes('solana')) {
          button.style.zIndex = '1001';
          button.style.position = 'relative';
        }
      });
    }
  }
  
  /**
   * Blocks all interactions with the game during NFT verification
   * @param {string} message - Message to display during the block
   */
  blockGameInteractions(message = "Verifying NFTs... Please wait") {
    // If there is already an active block, don't create another one
    if (this.isBlocking) return;
    
    this.isBlocking = true;
    
    // Create blocking overlay
    const blocker = document.createElement('div');
    blocker.id = this.blockUIId;
    blocker.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: 'Arial', sans-serif;
      color: white;
      backdrop-filter: blur(5px);
    `;
    
    // Add loading icon and message
    blocker.innerHTML = `
      <div style="background-color: rgba(0, 0, 0, 0.6); padding: 30px; border-radius: 10px; text-align: center; max-width: 80%;">
        <div style="border: 6px solid rgba(0, 200, 255, 0.2); border-top: 6px solid rgba(0, 255, 255, 0.8); border-radius: 50%; width: 50px; height: 50px; margin: 0 auto 20px; animation: nft-verification-spin 1.5s linear infinite;"></div>
        <div style="font-size: 18px; margin-bottom: 15px; font-weight: bold; color: rgba(0, 255, 255, 0.8);">${message}</div>
        <div style="font-size: 14px; color: #aaa;">NFT Collection verification in progress...</div>
      </div>
      <style>
        @keyframes nft-verification-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.appendChild(blocker);
    
    // Allow only wallet buttons to be interactive
    this.allowWalletInteractionsOnly();
    
    console.log('Game interfaces blocked for NFT verification');
  }

  /**
   * Unblocks game interactions after NFT verification
   */
  unblockGameInteractions() {
    // If there is no active block, exit
    if (!this.isBlocking) return;
    
    const blocker = document.getElementById(this.blockUIId);
    if (blocker) {
      blocker.style.opacity = '0';
      blocker.style.transition = 'opacity 0.5s ease';
      
      // Remove after animation
      setTimeout(() => {
        if (blocker && blocker.parentNode) {
          blocker.parentNode.removeChild(blocker);
        }
      }, 500);
    }
    
    this.isBlocking = false;
    console.log('Game interfaces unblocked');
  }
  
  /**
   * Reads and displays NFTs from the connected wallet and their metadata
   * @returns {Promise<Array>} - Array with the NFTs found and their metadata
   */
  async checkCollection() {
    
    if (this.isChecking) {
      console.log("Already verifying NFTs");
      return false;
    }
    
    if (!this.wallet.isConnected || !this.wallet.publicKey) {
      console.error("No wallet connected");
      this.showResult(false, "No wallet connected. Please connect your wallet first.");
      return false;
    }
    
    this.isChecking = true;
    this.showResult(null, "Looking for NFTs in your wallet...");
    
    try {
      const walletAddress = this.wallet.getPublicKey();
      console.log(`Reading NFTs for wallet: ${walletAddress}`);
      
      // Ensure the nftReader is properly initialized
      if (!this.nftReader.connection) {
        if (this.wallet.connection) {
          this.nftReader.setConnection(this.wallet.connection);
        } else {
          this.nftReader.initConnection();
        }
      }
      
      // Show a message while looking for NFTs
      this.showResult(null, "Reading NFTs and their metadata from your wallet...");
      
      // Get all NFTs from the wallet with their metadata
      const nftsWithMetadata = await this.nftReader.getWalletNFTsAndMetadata(walletAddress);
      
      if (nftsWithMetadata.length === 0) {
        console.log("No NFTs found in the wallet");
        this.showResult(false, "No NFTs found in your wallet.");
        
        // No The Bonk Games NFTs - Show message to buy one and STOP the game flow
        this.showMintNFTMessage();
        
        // Return object with needsNFT flag to clearly indicate that an NFT is needed
        return { needsNFT: true };
      }
      
      // Process the NFTs found
      
      // Imprimir información de todos los NFTs para debugging
      console.log("================== DEBUGGING NFTs ENCONTRADOS ==================");
      nftsWithMetadata.forEach((nft, index) => {
        console.log(`NFT #${index + 1}:`);
        console.log("- Mint address:", nft.mint);
        
        if (nft.metadata) {
          console.log("- Nombre:", nft.metadata.name || "Sin nombre");
          console.log("- Symbol:", nft.metadata.symbol || "Sin símbolo");
          console.log("- URI:", nft.metadata.uri || "Sin URI");
          
          if (nft.metadata.onChain) {
            console.log("- On-chain collection:", nft.metadata.onChain.collection ? JSON.stringify(nft.metadata.onChain.collection) : "No disponible");
            console.log("- On-chain creators:", nft.metadata.onChain.creators ? JSON.stringify(nft.metadata.onChain.creators) : "No disponible");
          }
          
          if (nft.metadata.offChain) {
            console.log("- Off-chain name:", nft.metadata.offChain.name || "Sin nombre");
            console.log("- Off-chain collection:", nft.metadata.offChain.collection ? JSON.stringify(nft.metadata.offChain.collection) : "No disponible");
            
            // Atributos
            if (nft.metadata.offChain.attributes) {
              console.log("- Attributes:", JSON.stringify(nft.metadata.offChain.attributes));
            } else {
              console.log("- Attributes: No disponibles");
            }
          } else {
            console.log("- Sin metadatos off-chain");
          }
        } else {
          console.log("- Sin metadatos");
        }
        console.log("-------------------------");
      });
      console.log("===============================================================");
      
      // Verify the specific collection address and authorized creators
      const AUTHORIZED_COLLECTION_ID = "46LY71e113S4vEmJ1C8RrzCYnw3oW7VF4tq5Mqrsh45X"; // The BonkGames collection address
      const AUTHORIZED_CREATORS = [
        "Ehv27PUPbkP6rAa97N8PQ7oiwcZuKxMmvTy8n7d9yT6m", // Main BonkGames creator
        "BNKGvxw3733oVNUjXUvGo2jpNADCfVP1jLKDvYYsqyTc",
      ];
      
      // List of additional verification attributes that must have at least one
      const REQUIRED_ATTRIBUTES = ['Bloodline'];
      
      // Flexibilizar verificación para identificar tu NFT
      console.log("VERIFICANDO NFTS CON CRITERIOS FLEXIBLES...");
      
      // Filter NFTs usando la colección off-chain
      const bonkGamesNFTs = nftsWithMetadata.filter(nft => {
        // Imprimir el NFT siendo verificado
        console.log(`Verificando NFT: ${nft.mint} - ${nft.metadata?.name || 'Sin nombre'}`);
        
        // VERIFICACIÓN POR COLLECTION NAME OFFCHAIN como solicitó el usuario
        if (nft.metadata && nft.metadata.offChain && nft.metadata.offChain.collection) {
          // Mostrar información de colección para diagnóstico
          console.log(`- Información de colección off-chain:`, JSON.stringify(nft.metadata.offChain.collection));
          
          // Verificar si la colección es "The Bonk Games"
          const collection = nft.metadata.offChain.collection;
          
          // Verificar si coincide con la estructura esperada
          if (collection.name === "The Bonk Games" || 
              collection.family === "The Bonk Games") {
            console.log(`✅ NFT ACEPTADO: ${nft.mint} - Pertenece a la colección "The Bonk Games"`);
            return true;
          }
        } else {
          console.log(`- No se encontró información de colección off-chain para el NFT: ${nft.mint}`);
        }
        
        // También verificamos si el nombre del NFT contiene "The Bonk Games"
        if (nft.metadata && nft.metadata.offChain && nft.metadata.offChain.name) {
          const name = nft.metadata.offChain.name;
          if (name.includes("Bonk Games")) {
            console.log(`✅ NFT ACEPTADO: ${nft.mint} - Su nombre off-chain contiene "Bonk Games": ${name}`);
            return true;
          }
        }
        
        // Verificar también por los datos colección en cualquier otro formato
        if (nft.metadata && nft.metadata.offChain && typeof nft.metadata.offChain === 'object') {
          // Búsqueda profunda de cualquier propiedad que contenga "Bonk Games"
          const offchainStr = JSON.stringify(nft.metadata.offChain).toLowerCase();
          if (offchainStr.includes("bonk games")) {
            console.log(`✅ NFT ACEPTADO: ${nft.mint} - Los metadatos contienen referencia a "Bonk Games"`);
            return true;
          }
        }
        
        // Si llegamos aquí, no se identificó como NFT de Bonk Games
        console.log(`❌ NFT RECHAZADO: ${nft.mint} - No pertenece a la colección "The Bonk Games"`);
        return false;
      });
      
      
      // Show Bonk Games NFTs results
      if (bonkGamesNFTs.length > 0) {

        
        bonkGamesNFTs.forEach((nft, index) => {
          // Get NFT name
          const nftName = (nft.metadata.offChain && nft.metadata.offChain.name) || nft.metadata.name || 'No name';
          
          // Look for the "Bloodline" attribute
          let bloodlineValue = 'Not found';
          
          // Look for Bloodline value in attributes off-chain
          if (nft.metadata.offChain && nft.metadata.offChain.attributes) {
            const bloodlineAttr = nft.metadata.offChain.attributes.find(
              attr => attr.trait_type === 'Bloodline' || attr.trait_type === 'bloodline'
            );
            
            if (bloodlineAttr) {
              bloodlineValue = bloodlineAttr.value;
            }
          }
          
          // Look for Bloodline value in attributes on-chain if they exist
          if (bloodlineValue === 'Not found' && nft.metadata.onChain && nft.metadata.onChain.attributes) {
            const bloodlineAttr = nft.metadata.onChain.attributes.find(
              attr => attr.trait_type === 'Bloodline' || attr.trait_type === 'bloodline'
            );
            
            if (bloodlineAttr) {
              bloodlineValue = bloodlineAttr.value;
            }
          }
          
          // Save relevant data for later use
          nft.displayName = nftName;
          
          // Save image URL if available 
          if (nft.metadata.image || (nft.metadata.offChain && nft.metadata.offChain.image)) {
            nft.imageUrl = nft.metadata.offChain?.image || nft.metadata.image;
          }
        });
        
        // Store the bloodlines list in localStorage for persistence
        this.bonkGamesNFTs = bonkGamesNFTs;
        
        // Reset counters and lists of Bloodline
        this.bloodlineCounts = {};
        this.playerBloodlines = [];
        
        // Use the provided address or the default one
        bonkGamesNFTs.forEach(nft => {
          let bloodlineValue = null; // Initially no bloodline value
          
          // Look for Bloodline value in attributes off-chain
          if (nft.metadata.offChain && nft.metadata.offChain.attributes) {
            const bloodlineAttr = nft.metadata.offChain.attributes.find(
              attr => attr.trait_type === 'Bloodline' || attr.trait_type === 'bloodline'
            );
            if (bloodlineAttr) bloodlineValue = bloodlineAttr.value;
          }
          
          // Look for Bloodline value in attributes on-chain if they exist
          if (!bloodlineValue && nft.metadata.onChain && nft.metadata.onChain.attributes) {
            const bloodlineAttr = nft.metadata.onChain.attributes.find(
              attr => attr.trait_type === 'Bloodline' || attr.trait_type === 'bloodline'
            );
            if (bloodlineAttr) bloodlineValue = bloodlineAttr.value;
          }
          
          // Save the bloodline value in the NFT for reference (only if it exists)
          if (bloodlineValue) {
            nft.bloodline = bloodlineValue;
            
            // Counter by Bloodline type - only for real values
            this.bloodlineCounts[bloodlineValue] = (this.bloodlineCounts[bloodlineValue] || 0) + 1;
            
            // Add to the list of unique bloodlines if it doesn't exist and has a real value
            if (!this.playerBloodlines.includes(bloodlineValue)) {
              this.playerBloodlines.push(bloodlineValue);
            }
          } else {
            // If it doesn't have bloodline, assign an internal value for reference but don't count it
            nft.bloodline = 'N/A'; 
          }
        });
        
        // Save bloodlines locally for debugging
        console.log('Bloodlines saved locally: ', JSON.stringify(this.playerBloodlines));
        
        // Verify if there is at least one bloodline in the NFTs found
        if (this.playerBloodlines.length === 0) {
          // There are The Bonk Games NFTs but none has the Bloodline attribute
          console.log('The Bonk Games NFTs found, but none has the Bloodline attribute');
          
          // Show message to mint a correct one
          this.showMintNFTMessage();
          
          // Stop the game flow and don't allow to continue
          this.showResult(false, "You need an NFT from The Bonk Games with the Bloodline attribute to play.");
          this.isChecking = false;
          
          // Return object to indicate that NFT with bloodline is needed
          return { needsNFT: true, needsBloodline: true };
        }
        
        // If we get here, there is at least one NFT with bloodline
        // Update player information with the bloodlines found
        this.updatePlayerBloodlines();
        
        // Remove any mint message that might be visible
        // (important when the user changes from a wallet without NFTs to one with NFTs)
        this.removeMintNFTMessage();
        
        // Save summary for later use by the application
      } else {
        // No The Bonk Games NFTs - Show message to buy one and STOP the game flow
        this.showMintNFTMessage();
        
        // Stop the game flow and don't allow to continue
        this.showResult(false, "You need an NFT from The Bonk Games to play.");
        this.isChecking = false;
        
        // Return empty object to avoid errors but not allow the game to advance
        return { needsNFT: true };
      }
      
      // NFTs with their metadata are available for use in the application
      
      // Show result to the user with Bloodlines information
      let resultMessage = `Found ${nftsWithMetadata.length} NFTs in your wallet.`;
      
      // Add Bloodlines information if there are The Bonk Games NFTs with real bloodlines
      if (this.playerBloodlines.length > 0) {
        resultMessage += `\nYou have ${this.bonkGamesNFTs.length} NFTs from The Bonk Games with the following bloodlines: ${this.playerBloodlines.join(', ')}.`;
      } else if (this.bonkGamesNFTs.length > 0) {
        resultMessage += `\nYou have ${this.bonkGamesNFTs.length} NFTs from The Bonk Games, but none have the Bloodline attribute specified.`;
      }
      
      this.showResult(true, resultMessage);
      
      // Unblock interactions when finished
      this.unblockGameInteractions();
      
      // Return the list of NFTs with metadata
      return nftsWithMetadata;
    } catch (error) {
      console.error("Error al verificar colección de NFTs:", error);
      this.showResult(false, "Error al verificar NFTs. Por favor intenta de nuevo.");
      
      // Unblock interactions in case of error
      this.unblockGameInteractions();
      return false;
    } finally {
      this.isChecking = false;
    }
  }
}

// Export a single instance to use throughout the application
export const nftCollectionChecker = new NFTCollectionChecker(DEFAULT_COLLECTION_ADDRESS);
export default nftCollectionChecker;
