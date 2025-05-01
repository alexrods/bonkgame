import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  AccountLayout,
  Token,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
/**
 * Solana Wallet Integration for Web3 functionality
 * Handles wallet connection, disconnection and transactions
 */
export class SolanaWallet {
  constructor() {
    this.connection = null;
    this.wallet = null;
    this.publicKey = null;
    this.isConnected = false;
    this.onConnectCallback = null;
    this.onDisconnectCallback = null;
    this.walletDropdownVisible = false;

    this.Credit_DECIMALS = 6;
    this.Credit_MINT_ADDRESS = "dsitAJapavcqf2UsXzP4jBz2wBC6nu3od7D45idwiSU";
    this.Bonk_DECIMALS = 6;
    this.Bonk_MINT_ADDRESS = "dsitAJapavcqf2UsXzP4jBz2wBC6nu3od7D45idwiSU";
    this.ADMIN_WALLET_ADDRESS = "CGacpojgdVcuUBZuFJqWu3eiEVcbXAxQcXXridgvFhRg";

    // Supported wallets
    this.supportedWallets = [
      {
        name: "Phantom",
        id: "phantom",
        icon: "https://www.phantom.app/img/phantom-logo.svg",
        adapter: window.phantom?.solana,
      },
      {
        name: "Solflare",
        id: "solflare",
        icon: "https://solflare.com/icon.svg",
        adapter: window.solflare,
      },
      {
        name: "Backpack",
        id: "backpack",
        icon: "https://raw.githubusercontent.com/coral-xyz/backpack/master/packages/app-extension/src/assets/icons/logomark.svg",
        adapter: window.backpack?.xnft?.solana,
      },
      {
        name: "Glow",
        id: "glow",
        icon: "https://glow.app/favicon.ico",
        adapter: window.glowSolana,
      },
      {
        name: "Slope",
        id: "slope",
        icon: "https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/slope.svg",
        adapter: window.slope,
      },
      {
        name: "Coin98",
        id: "coin98",
        icon: "https://coin98.s3.ap-southeast-1.amazonaws.com/webpage/asset/favicon/c98-wallet-logo.png",
        adapter: window.coin98?.sol,
      },
    ];

    this.initConnection();
    this.setupListeners();
  }

  /**
   * Initialize Solana connection to the network
   */
  initConnection() {
    const endpoint =
      "https://divine-restless-needle.solana-devnet.quiknode.pro/8218c13e5cbcca622366abac18ce7c35555f3450";

    try {
      this.connection = new Connection(endpoint, "confirmed");
    } catch (error) {
      console.error("Failed to initialize Solana connection:", error);
    }
  }

  /**
   * Set up event listeners for wallet UI
   */
  setupListeners() {
    // Connect wallet button click
    const connectButton = document.getElementById("connect-wallet");
    if (connectButton) {
      connectButton.addEventListener("click", () => {
        if (this.isConnected) {
          this.disconnect();
        } else {
          this.showWalletOptions();
        }
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
      const dropdown = document.querySelector(".wallet-dropdown");
      const connectButton = document.getElementById("connect-wallet");

      if (dropdown && this.walletDropdownVisible) {
        if (
          !dropdown.contains(event.target) &&
          event.target !== connectButton
        ) {
          this.hideWalletOptions();
        }
      }
    });
  }

  /**
   * Show wallet options dropdown
   */
  showWalletOptions() {
    // First, ensure we clean up any existing dropdown
    const existingDropdown = document.querySelector(".wallet-dropdown");
    if (existingDropdown) {
      existingDropdown.remove();
    }

    // Create a new dropdown
    const dropdown = document.createElement("div");
    dropdown.className = "wallet-dropdown";

    // Refresh wallet adapters to ensure we have the latest detection
    this.refreshWalletAdapters();

    // Create options for each supported wallet
    let availableWallets = 0;

    // Add header to the dropdown
    const header = document.createElement("div");
    header.style.color = "white";
    header.style.padding = "10px";
    header.style.borderBottom = "1px solid rgba(255,255,255,0.2)";
    header.style.marginBottom = "10px";
    header.style.fontWeight = "bold";
    header.style.textAlign = "center";
    header.textContent = "Select a Wallet";
    dropdown.appendChild(header);

    this.supportedWallets.forEach((wallet) => {
      try {
        if (this.isWalletAvailable(wallet.id)) {
          availableWallets++;
          const option = document.createElement("div");
          option.className = "wallet-option";

          // Add a try-catch block for the image to handle load errors
          const imgHtml = `<img src="${wallet.icon}" class="wallet-icon" alt="${wallet.name}" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjIgNFYyMEMyMiAyMS4xMDQ2IDIxLjEwNDYgMjIgMjAgMjJINEMyLjg5NTQzIDIyIDIgMjEuMTA0NiAyIDIwVjRDMiAyLjg5NTQzIDIuODk1NDMgMiA0IDJIMjBDMjEuMTA0NiAyIDIyIDIuODk1NDMgMjIgNFoiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPjxwYXRoIGQ9Ik0xMiA4VjE2IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik04IDEySDEyLjVIMTYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+'" />`;

          option.innerHTML = `
            ${imgHtml}
            <span class="wallet-option-name">${wallet.name}</span>
          `;

          option.addEventListener("click", () => {
            this.connect(wallet.id);
            this.hideWalletOptions();
          });

          dropdown.appendChild(option);
        }
      } catch (err) {
        console.warn(
          `Error checking wallet availability for ${wallet.id}:`,
          err
        );
      }
    });

    // Add install instructions if no wallets are available
    if (availableWallets === 0) {
      // Header text
      const noWalletsHeader = document.createElement("div");
      noWalletsHeader.style.color = "white";
      noWalletsHeader.style.padding = "10px 15px";
      noWalletsHeader.style.textAlign = "center";
      noWalletsHeader.style.fontWeight = "bold";
      noWalletsHeader.textContent = "No Solana wallets detected";
      dropdown.appendChild(noWalletsHeader);

      // Instructions
      const message = document.createElement("div");
      message.style.color = "#ccccff";
      message.style.padding = "10px 15px";
      message.style.textAlign = "center";
      message.style.fontSize = "14px";
      message.style.lineHeight = "1.4";
      message.innerHTML =
        "Please install one of these Solana wallets:<br><br>" +
        '<a href="https://phantom.app/" target="_blank" style="color: #00ffff; text-decoration: none;">• Phantom</a><br>' +
        '<a href="https://backpack.app/" target="_blank" style="color: #00ffff; text-decoration: none;">• Backpack</a><br>' +
        '<a href="https://spl_greeter.com/" target="_blank" style="color: #00ffff; text-decoration: none;">• Solflare</a>';
      dropdown.appendChild(message);
    }

    // Add to the DOM
    const walletContainer = document.getElementById("wallet-container");
    if (walletContainer) {
      walletContainer.appendChild(dropdown);

      // Show the dropdown
      dropdown.style.display = "block";
      this.walletDropdownVisible = true;
    } else {
      console.error("Wallet container element not found");
    }
  }

  /**
   * Refreshes wallet adapters to ensure we're getting the latest version
   */
  refreshWalletAdapters() {
    // Update adapter references in case they've been loaded after page load
    this.supportedWallets.forEach((wallet) => {
      switch (wallet.id) {
        case "phantom":
          wallet.adapter = window.phantom?.solana;
          break;
        case "solflare":
          wallet.adapter = bs58.solflare;
          break;
        case "backpack":
          wallet.adapter = window.backpack?.xnft?.solana;
          break;
        case "glow":
          wallet.adapter = window.glowSolana;
          break;
        case "slope":
          wallet.adapter = bs58.slope;
          break;
        case "coin98":
          wallet.adapter = window.coin98?.sol;
          break;
      }
    });
  }

  /**
   * Hide wallet options dropdown
   */
  hideWalletOptions() {
    const dropdown = document.querySelector(".wallet-dropdown");
    if (dropdown) {
      dropdown.style.display = "none";
      this.walletDropdownVisible = false;
    }
  }

  /**
   * Check if a specific wallet is available in the browser
   * @param {string} walletId - ID of the wallet to check
   * @returns {boolean} Whether the wallet is available
   */
  isWalletAvailable(walletId) {
    switch (walletId) {
      case "phantom":
        return window.phantom?.solana && window.phantom.solana.isPhantom;
      case "solflare":
        return bs58.solflare && bs58.solflare.isSolflare;
      case "backpack":
        return window.backpack?.xnft?.solana;
      case "glow":
        return window.glowSolana;
      case "slope":
        return bs58.slope;
      case "coin98":
        return window.coin98?.sol;
      default:
        return false;
    }
  }

  /**
   * Connect to the specified wallet
   * @param {string} walletId - ID of the wallet to connect to
   */
  async connect(walletId) {
    try {
      const walletInfo = this.supportedWallets.find((w) => w.id === walletId);
      if (!walletInfo || !this.isWalletAvailable(walletId)) {
        this.showNotification(
          `${walletId} wallet not available. Please install it.`
        );
        return;
      }

      // Use the appropriate wallet adapter
      const adapter = walletInfo.adapter;
      if (!adapter) {
        this.showNotification(
          `Could not find ${walletId} adapter. Please refresh the page.`
        );
        console.error(`Adapter for ${walletId} is undefined`);
        return;
      }

      console.log(`Attempting to connect to ${walletInfo.name}...`);

      // Request connection to the wallet with error handling
      let resp;
      try {
        // Special handling for different wallet types
        switch (walletId) {
          case "backpack":
            // Backpack has a different connection method
            if (adapter.connect) {
              resp = await adapter.connect();
            } else {
              console.log("Trying alternative connection method for Backpack");
              // Some adapters might have a different connect method
              await adapter.request({ method: "connect" });
              resp = { publicKey: adapter.publicKey };
            }
            break;

          case "coin98":
            // Coin98 might have a different approach
            if (adapter.connect) {
              resp = await adapter.connect();
            } else if (adapter.request) {
              await adapter.request({ method: "sol_requestAccounts" });
              resp = { publicKey: adapter.publicKey };
            }
            break;

          default:
            // Standard connection method for most wallets
            resp = await adapter.connect();
        }
      } catch (err) {
        // Handle user rejection
        if (err.code === 4001) {
          this.showNotification("Connection rejected by user");
          return;
        }

        // Log detailed error before rethrowing
        console.error(`Connection error with ${walletId}:`, err);
        this.showNotification(`Connection failed: ${err.message}`);
        return;
      }

      // Verify that we got a proper response with a public key
      if (!resp) {
        console.error(`No response from ${walletId} wallet`);
        this.showNotification(`No response from ${walletId} wallet`);
        return;
      }

      // Different wallets might provide the public key in different ways
      let publicKey;

      if (resp.publicKey) {
        // Most wallets return publicKey directly
        publicKey = resp.publicKey;
      } else if (adapter.publicKey) {
        // Some wallets make it available on the adapter
        publicKey = adapter.publicKey;
      } else {
        console.error("Could not get public key from wallet");
        this.showNotification("Could not get your wallet address");
        return;
      }

      // Store the public key and update UI
      this.publicKey = publicKey;
      this.wallet = adapter;
      this.isConnected = true;

      // Update UI
      this.updateWalletUI();

      // Call onConnect callback if set
      if (this.onConnectCallback) {
        this.onConnectCallback(this.publicKey.toString());
      }

      // Set up wallet change and disconnect listeners if supported
      if (this.wallet.on) {
        // Watch for standard events
        this.wallet.on("disconnect", this.handleWalletDisconnect.bind(this));
        this.wallet.on("accountChanged", this.handleWalletChange.bind(this));
      } else if (this.wallet.addEventListener) {
        // Some wallets use standard DOM events
        this.wallet.addEventListener(
          "disconnect",
          this.handleWalletDisconnect.bind(this)
        );
        this.wallet.addEventListener(
          "accountsChanged",
          this.handleWalletChange.bind(this)
        );
      }

      console.log(
        `Connected to ${walletInfo.name} wallet:`,
        this.publicKey.toString()
      );
      this.showNotification(`Connected to ${walletInfo.name}`);
    } catch (error) {
      console.error("Error connecting to wallet:", error);
      this.showNotification(`Error connecting: ${error.message}`);
    }
  }

  /**
   * Disconnect from the current wallet
   */
  async disconnect() {
    try {
      if (!this.wallet) {
        console.log("No wallet to disconnect");
        return;
      }

      // Different wallets might have different disconnect methods
      if (this.wallet.disconnect) {
        try {
          await this.wallet.disconnect();
        } catch (err) {
          console.warn("Error during wallet disconnect:", err);
        }
      } else if (this.wallet.request) {
        // Try alternative method for some wallets
        try {
          await this.wallet.request({ method: "disconnect" });
        } catch (err) {
          console.warn("Error during wallet request disconnect:", err);
        }
      }

      // Always trigger the disconnect handler regardless of the success of the disconnect call
      this.handleWalletDisconnect();
      this.showNotification("Wallet disconnected");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      // Still clean up the local state
      this.handleWalletDisconnect();
    }
  }

  /**
   * Handle wallet disconnection (either manual or from wallet)
   */
  handleWalletDisconnect() {
    this.publicKey = null;
    this.wallet = null;
    this.isConnected = false;

    // Update UI
    this.updateWalletUI();

    // Call onDisconnect callback if set
    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }

    console.log("Wallet disconnected");
  }

  /**
   * Handle wallet account change
   * @param {Object} newPublicKey - New public key from the wallet
   */
  handleWalletChange(newPublicKey) {
    if (newPublicKey) {
      this.publicKey = newPublicKey;
      this.updateWalletUI();

      if (this.onConnectCallback) {
        this.onConnectCallback(this.publicKey.toString());
      }
    } else {
      this.handleWalletDisconnect();
    }
  }

  /**
   * Update wallet UI elements based on connection state
   */
  updateWalletUI() {
    const connectButton = document.getElementById("connect-wallet");
    const walletStatus = document.getElementById("wallet-status");
    const walletContainer = document.getElementById("wallet-container");

    if (this.isConnected && this.publicKey) {
      // Connected state
      connectButton.textContent = "Disconnect";
      walletContainer.classList.add("connected");

      // Format address to show abbreviated form
      const address = this.publicKey.toString();
      const shortAddress = `${address.substring(0, 4)}...${address.substring(
        address.length - 4
      )}`;
      walletStatus.textContent = shortAddress;
      walletStatus.style.display = "block";
    } else {
      // Disconnected state
      connectButton.textContent = "Connect Wallet";
      walletContainer.classList.remove("connected");
      walletStatus.textContent = "";
      walletStatus.style.display = "none";
    }
  }

  /**
   * Show a notification to the user
   * @param {string} message - Message to display
   */
  showNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById("wallet-notification");
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "wallet-notification";
      notification.style.position = "fixed";
      notification.style.bottom = "20px";
      notification.style.left = "50%";
      notification.style.transform = "translateX(-50%)";
      notification.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
      notification.style.color = "white";
      notification.style.padding = "10px 20px";
      notification.style.borderRadius = "5px";
      notification.style.zIndex = "1001";
      notification.style.textAlign = "center";
      document.body.appendChild(notification);
    }

    // Set message and show
    notification.textContent = message;
    notification.style.display = "block";

    // Hide after 3 seconds
    setTimeout(() => {
      notification.style.display = "none";
    }, 3000);
  }

  /**
   * Set callback for when wallet connects
   * @param {Function} callback - Function to call when connected
   */
  onConnect(callback) {
    this.onConnectCallback = callback;

    // If already connected, call immediately
    if (this.isConnected && this.publicKey) {
      callback(this.publicKey.toString());
    }
  }

  /**
   * Set callback for when wallet disconnects
   * @param {Function} callback - Function to call when disconnected
   */
  onDisconnect(callback) {
    this.onDisconnectCallback = callback;
  }

  /**
   * Sign a transaction with the connected wallet
   * @param {Transaction} transaction - Solana transaction to sign
   * @returns {Transaction} Signed transaction
   */
  async signTransaction(transaction) {
    if (!this.isConnected || !this.wallet) {
      throw new Error("Wallet not connected");
    }

    try {
      return await this.wallet.signTransaction(transaction);
    } catch (error) {
      console.error("Error signing transaction:", error);
      throw error;
    }
  }

  /**
   * Sign and send a transaction
   * @param {Transaction} transaction - Solana transaction to sign and send
   * @returns {string} Transaction signature
   */
  async signAndSendTransaction(transaction) {
    if (!this.isConnected || !this.wallet || !this.connection) {
      throw new Error("Wallet not connected");
    }

    try {
      // Sign the transaction
      const signedTransaction = await this.wallet.signTransaction(transaction);

      // Send the transaction
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize()
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, "confirmed");

      return signature;
    } catch (error) {
      console.error("Error signing and sending transaction:", error);
      throw error;
    }
  }

  /**
   * Get the current wallet's public key
   * @returns {string} Public key as string
   */
  getPublicKey() {
    return this.publicKey ? this.publicKey.toString() : null;
  }

  /**
   * Get the wallet's SOL balance
   * @returns {number} Balance in SOL
   */
  async getBalance() {
    if (!this.isConnected || !this.publicKey || !this.connection) {
      return 0;
    }

    try {
      const balance = await this.connection.getBalance(this.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Error getting balance:", error);
      return 0;
    }
  }

  /**
   * Get BONK token account for a wallet address
   * @param {PublicKey} walletAddress - Wallet address to find token account for
   * @param {PublicKey} tokenMint - Token mint address
   * @returns {PublicKey} Token account address
   */
  async getTokenAccount(walletAddress, tokenMint) {
    if (!this.connection) {
      throw new Error("No connection to Solana network");
    }

    try {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletAddress,
        { mint: tokenMint }
      );

      if (tokenAccounts.value.length === 0) {
        // No token account found
        return null;
      }

      return tokenAccounts.value[0].pubkey;
    } catch (error) {
      console.error("Error getting token account:", error);
      throw error;
    }
  }

  /**
   * Create a token account if it doesn't exist
   * @param {PublicKey} walletAddress - Wallet address to create token account for
   * @param {PublicKey} tokenMint - Token mint address
   * @returns {PublicKey} Token account address
   */
  async createTokenAccountIfNeeded(walletAddress, tokenMint) {
    try {
      let tokenAccount = await this.getTokenAccount(walletAddress, tokenMint);
      let tokenAccountPubkey = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        tokenMint,
        walletAddress,
        false
      );

      if (!tokenAccount) {
        // Create new token account
        const transaction = new Transaction();

        // Create Associated Token Account instruction
        const ataInstruction = Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          tokenMint,
          tokenAccountPubkey,
          walletAddress,
          walletAddress
        );

        transaction.add(ataInstruction);

        // Sign and send transaction
        const signature = await this.signAndSendTransaction(transaction);
        console.log("Created token account, signature:", signature);

        // Get the new token account
        tokenAccount = await this.getTokenAccount(walletAddress, tokenMint);
      }

      return tokenAccount;
    } catch (error) {
      console.error("Error creating token account:", error);
      throw error;
    }
  }

  /**
   * Deposit BONK tokens to administrator wallet
   * @param {number} amount - Amount of BONK tokens to deposit
   * @returns {Promise<Object>} Transaction result
   */
  async depositCredit(amount) {
    if (!this.isConnected || !this.wallet) {
      throw new Error("Wallet not connected");
    }

    try {
      // Convert amount to token units based on decimals
      const tokenAmount = amount * Math.pow(10, this.Credit_DECIMALS);

      // Get token mint
      const tokenMint = new PublicKey(this.Credit_MINT_ADDRESS);

      // Get admin wallet public key
      const adminWallet = new PublicKey(this.ADMIN_WALLET_ADDRESS);

      // Get or create token accounts
      const sourceTokenAccount = await this.createTokenAccountIfNeeded(
        this.publicKey,
        tokenMint
      );

      const destinationTokenAccount = await this.createTokenAccountIfNeeded(
        adminWallet,
        tokenMint
      );

      // Create transfer instruction
      const transferInstruction = Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        sourceTokenAccount,
        destinationTokenAccount,
        this.publicKey,
        [],
        tokenAmount
      );

      // Create transaction and add transfer instruction
      const transaction = new Transaction().add(transferInstruction);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.publicKey;

      // Sign and send transaction
      const signature = await this.signAndSendTransaction(transaction);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error("Transaction failed to confirm");
      }

      // Show success notification
      this.showNotification(`Successfully deposited ${amount} BONK`);

      return {
        success: true,
        signature,
        amount: amount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error depositing BONK:", error);
      this.showNotification(`Failed to deposit BONK: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get Credit token balance for connected wallet
   * @returns {Promise<number>} Balance of Credit tokens
   */
  async getCreditBalance() {
    if (!this.isConnected || !this.publicKey) {
      return 0;
    }

    try {
      const tokenMint = new PublicKey(this.Credit_MINT_ADDRESS);
      const tokenAccount = await this.getTokenAccount(
        this.publicKey,
        tokenMint
      );

      if (!tokenAccount) {
        return 0;
      }

      const accountInfo = await this.connection.getParsedAccountInfo(
        tokenAccount
      );

      if (!accountInfo.value || !accountInfo.value.data) {
        return 0;
      }

      const balance = accountInfo.value.data.parsed.info.tokenAmount.uiAmount;
      return balance;
    } catch (error) {
      console.error("Error getting BONK balance:", error);
      return 0;
    }
  }

  /**
   * Get Bonk token balance for connected wallet
   * @returns {Promise<number>} Balance of Bonk tokens
   */
  async getBonkBalance() {
    if (!this.isConnected || !this.publicKey) {
      return 0;
    }

    try {
      const tokenMint = new PublicKey(this.Bonk_MINT_ADDRESS);
      const tokenAccount = await this.getTokenAccount(
        this.publicKey,
        tokenMint
      );

      if (!tokenAccount) {
        return 0;
      }

      const accountInfo = await this.connection.getParsedAccountInfo(
        tokenAccount
      );

      if (!accountInfo.value || !accountInfo.value.data) {
        return 0;
      }

      const balance = accountInfo.value.data.parsed.info.tokenAmount.uiAmount;
      return balance;
    } catch (error) {
      console.error("Error getting BONK balance:", error);
      return 0;
    }
  }
}
