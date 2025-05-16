import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Programs used for Solana metadata
const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const metadataProgramId = new PublicKey(METADATA_PROGRAM_ID);

// Constants for decoding metadata
const MAX_NAME_LENGTH = 32;
const MAX_SYMBOL_LENGTH = 10;
const MAX_URI_LENGTH = 200;
const MAX_CREATOR_LENGTH = 34;

/**
 * NFTCollectionReader - Class to read NFTs from a Solana wallet
 * Uses directly Web3.js and SPL-token for greater compatibility with browsers
 */
export class NFTCollectionReader {
  /**
   * Constructor
   * @param {Connection} connection - Connection to Solana (optional, can be provided later)
   */
  constructor(connection = null) {
    this.connection = connection;
    this.endpoints = {
      'mainnet-beta': import.meta.env.VITE_RPC_URL,
      'devnet': 'https://api.devnet.solana.com',
      'testnet': 'https://api.testnet.solana.com'
    };
    this.network = "mainnet-beta"; // You can change to "devnet" if needed
  }

  /**
   * Initializes the connection to Solana if it doesn't exist
   */
  initConnection() {
    if (!this.connection) {
      try {
        const endpoint = this.endpoints[this.network] || this.endpoints['mainnet-beta'];
        this.connection = new Connection(endpoint, 'confirmed');
      } catch (error) {
        throw error;
      }
    }
  }

  /**
   * Sets a custom connection
   * @param {Connection} connection - Connection to Solana
   */
  setConnection(connection) {
    this.connection = connection;
  }

  /**
   * Sets the network to use (mainnet-beta, devnet, etc.)
   * @param {string} network - Network to use
   */
  setNetwork(network) {
    this.network = network;
    const endpoint = this.endpoints[network] || this.endpoints['mainnet-beta'];
    this.connection = new Connection(endpoint, 'confirmed');
  }

  /**
   * Helper function to derive the metadata address of a mint
   * @param {string|PublicKey} mint - Mint address
   * @returns {Promise<PublicKey>} - Metadata address
   */
  async findMetadataAddress(mint) {
    const mintKey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    // Deriving the PDA for the metadata
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        metadataProgramId.toBuffer(),
        mintKey.toBuffer(),
      ],
      metadataProgramId
    )[0];
  }
  
  /**
   * Gets all NFTs from a wallet and their basic metadata
   * @param {string|PublicKey} walletAddress - Wallet address
   * @returns {Promise<Array>} - List of NFTs with basic metadata
   */
  async getWalletNFTsAndMetadata(walletAddress) {
    this.initConnection();

    try {
      // Convert string to PublicKey if necessary
      const owner = typeof walletAddress === 'string' 
        ? new PublicKey(walletAddress) 
        : walletAddress;

      console.log(`Searching for NFTs for wallet: ${owner.toString()}`);
      
      // Get all token accounts for the wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        owner,
        { programId: TOKEN_PROGRAM_ID }
      );

      console.log(`${tokenAccounts.value.length} token accounts found`);
      
      // Filter only accounts with quantity = 1 (likely NFT)
      const nftAccounts = tokenAccounts.value
        .filter(account => {
          const amount = account.account.data.parsed.info.tokenAmount;
          // NFTs usually have quantity = 1 and decimals = 0
          return amount.uiAmount === 1 && amount.decimals === 0;
        });
      
      console.log(`${nftAccounts.length} NFTs found`);
      
      // For each NFT, get its basic metadata
      const nftsWithMetadata = await Promise.all(
        nftAccounts.map(async (account) => {
          const mint = account.account.data.parsed.info.mint;
          
          try {
            // Try to get basic metadata
            const metadata = await this.getNFTMetadata(mint);
            return {
              mint,
              address: account.pubkey.toString(),
              metadata,
              tokenAccount: account
            };
          } catch (err) {
            // If we can't get the metadata, return basic info
            return {
              mint,
              address: account.pubkey.toString(),
              metadata: null,
              tokenAccount: account
            };
          }
        })
      );

      return nftsWithMetadata;
    } catch (error) {
      console.error("Error getting NFTs from wallet:", error);
      return [];
    }
  }

  /**
   * Verifies if a wallet has at least one NFT from a specific collection
   * @param {string|PublicKey} walletAddress - Wallet address
   * @param {string} collectionAddress - Collection address
   * @returns {Promise<boolean>} - True if the wallet has at least one NFT from the collection
   */
  async hasNFTFromCollection(walletAddress, collectionAddress) {
    try {
      // Initialize connection
      this.initConnection();
      
      // Convert wallet address to PublicKey if necessary
      const owner = typeof walletAddress === 'string' 
        ? new PublicKey(walletAddress) 
        : walletAddress;
      
      // Convert collection address to PublicKey
      const targetCollection = typeof collectionAddress === 'string'
        ? new PublicKey(collectionAddress)
        : collectionAddress;
      
      console.log(`Verifying if wallet ${owner.toString()} has NFTs from collection ${targetCollection.toString()}`);
      
      // Simple method: verify if the wallet has the collection directly
      // This method is less precise but more compatible with the browser
      const tokens = await this.getNFTsByWallet(owner);
      
      // Verify if any of the tokens belong to the collection
      // In a real implementation, we should verify the metadata of each token
      const hasTokens = tokens.length > 0;
      
      // Simulate a positive verification for testing
      console.log(`Wallet has ${tokens.length} tokens. Assuming they belong to the collection for testing.`);
      return hasTokens;
    } catch (error) {
      console.error("Error verifying NFTs from collection:", error);
      return false;
    }
  }

  /**
   * Gets NFTs from a wallet filtered by collection
   * @param {string|PublicKey} walletAddress - Wallet address
   * @param {string} collectionAddress - Collection address
   * @returns {Promise<Array>} - NFTs from the collection
   */
  // async getNFTsByCollection(walletAddress, collectionAddress) {
  //   try {
  //   }
  // }

  /**
   * Gets all NFTs from a wallet
   * @param {string|PublicKey} walletAddress - Wallet address
   * @returns {Promise<Array>} - List of NFTs
   */
  async getNFTsByWallet(walletAddress) {
    return this.getTokensByWallet(walletAddress);
  }

  /**
   * Verifies if a wallet has at least one NFT from a specific collection
   * @param {string|PublicKey} walletAddress - Wallet address
   * @param {string} collectionAddress - Collection address
   * @returns {Promise<boolean>} - True if the wallet has at least one NFT from the collection
   */
  async hasNFTFromCollection(walletAddress, collectionAddress) {
    try {
      // Initialize connection
      this.initConnection();
      
      // Convert wallet address to PublicKey if necessary
      const owner = typeof walletAddress === 'string' 
        ? new PublicKey(walletAddress) 
        : walletAddress;
      
      // Convert collection address to PublicKey
      const targetCollection = typeof collectionAddress === 'string'
        ? new PublicKey(collectionAddress)
        : collectionAddress;
      
      console.log(`Verifying if wallet ${owner.toString()} has NFTs from collection ${targetCollection.toString()}`);
      console.log(`Network: ${this.network}, RPC endpoint: ${this.endpoints[this.network]}`);
      
      // Get all NFTs from the wallet with metadata
      const nftsWithMetadata = await this.getWalletNFTsAndMetadata(owner);
      
      if (nftsWithMetadata.length === 0) {
        console.log("No NFTs found in the wallet.");
        return false;
      }
      
      console.log(`The wallet has ${nftsWithMetadata.length} NFTs. Verifying collection...`);
      
      // Log the first few NFTs for debugging
      nftsWithMetadata.slice(0, 3).forEach((nft, index) => {
        console.log(`NFT ${index + 1}:`, {
          mint: nft.mint,
          name: nft.metadata?.name || 'Unknown',
          symbol: nft.metadata?.symbol || 'Unknown',
          uri: nft.metadata?.uri || 'No URI'
        });
      });
      
      // Check if any of the NFTs belongs to the target collection
      // We need to examine the metadata of each NFT
      let collectionNFTs = [];
      
      for (const nft of nftsWithMetadata) {
        const metadata = nft.metadata;
        
        if (!metadata) continue;
        
        // Check if the NFT belongs to the target collection
        // This can be done by checking creators, collection address, or URI patterns
        
        // Method 1: Check if the NFT has creators that match our target
        const targetCollectionStr = targetCollection.toString();
        const hasMatchingCreator = metadata.onChain && 
                                  metadata.onChain.creators && 
                                  metadata.onChain.creators.some(creator => 
                                    creator.address && creator.address.toString() === targetCollectionStr);
        
        // Method 2: Check if the collection field matches our target (if available)
        const hasMatchingCollection = metadata.onChain && 
                                     metadata.onChain.collection && 
                                     metadata.onChain.collection.key && 
                                     metadata.onChain.collection.key.toString() === targetCollectionStr;
        
        // Method 3: Check if the NFT URI contains any reference to the collection
        // This is less reliable but can help in some cases
        const uriContainsReference = metadata.uri && 
                                    (metadata.uri.includes(targetCollectionStr) || 
                                     metadata.uri.includes('bonkgames') || 
                                     metadata.uri.includes('bonk-games'));
        
        // Method 4: Check if off-chain metadata has collection references
        const offChainCollectionMatch = metadata.offChain && 
                                       metadata.offChain.collection && 
                                       metadata.offChain.collection.name && 
                                       metadata.offChain.collection.name.toLowerCase().includes('bonk');
        
        // If any method matches, consider it part of the collection
        if (hasMatchingCreator || hasMatchingCollection || uriContainsReference || offChainCollectionMatch) {
          console.log(`Found matching NFT: ${metadata.name || nft.mint}`);
          collectionNFTs.push(nft);
        }
      }
      
      console.log(`Found ${collectionNFTs.length} NFTs matching the target collection`);
      
      return collectionNFTs.length > 0;
    } catch (error) {
      console.error("Error verifying NFTs from collection:", error);
      return false;
    }
  }
  
  /**
   * Gets NFTs from a wallet filtered by collection
   * @param {string|PublicKey} walletAddress - Wallet address
   * @param {string} collectionAddress - Collection address
   * @returns {Promise<Array>} - NFTs from the collection
   */
  async getNFTsByCollection(walletAddress, collectionAddress) {
    try {
      // Initialize connection
      this.initConnection();
      
      // Convert wallet address to PublicKey if necessary
      const owner = typeof walletAddress === 'string' 
        ? new PublicKey(walletAddress) 
        : walletAddress;
      
      // Convert collection address to PublicKey
      const targetCollection = typeof collectionAddress === 'string'
        ? new PublicKey(collectionAddress)
        : collectionAddress;
      
      console.log(`Getting NFTs from collection ${targetCollection.toString()} for wallet ${owner.toString()}`);
      
      // Get all NFTs from the wallet with metadata
      const nfts = await this.getWalletNFTsAndMetadata(owner);
      
      if (nfts.length === 0) {
        console.log("No NFTs found in the wallet.");
        return [];
      }
      
      console.log(`The wallet has ${nfts.length} NFTs. Filtering for collection...`);
      
      // Filter NFTs by collection
      const targetCollectionStr = targetCollection.toString();
      const collectionNFTs = nfts.filter(nft => {
        const metadata = nft.metadata;
        if (!metadata) return false;
        
        // Method 1: Check if the NFT has creators that match our target
        const hasMatchingCreator = metadata.onChain && 
                                 metadata.onChain.creators && 
                                 metadata.onChain.creators.some(creator => 
                                   creator.address && creator.address.toString() === targetCollectionStr);
        
        // Method 2: Check if the collection field matches our target (if available)
        const hasMatchingCollection = metadata.onChain && 
                                    metadata.onChain.collection && 
                                    metadata.onChain.collection.key && 
                                    metadata.onChain.collection.key.toString() === targetCollectionStr;
        
        // Method 3: Check if the NFT URI contains any reference to the collection
        const uriContainsReference = metadata.uri && 
                                   (metadata.uri.includes(targetCollectionStr) || 
                                    metadata.uri.includes('bonkgames') || 
                                    metadata.uri.includes('bonk-games'));
        
        // Method 4: Check if off-chain metadata has collection references
        const offChainCollectionMatch = metadata.offChain && 
                                      metadata.offChain.collection && 
                                      metadata.offChain.collection.name && 
                                      metadata.offChain.collection.name.toLowerCase().includes('bonk');
        
        // If any method matches, consider it part of the collection
        return hasMatchingCreator || hasMatchingCollection || uriContainsReference || offChainCollectionMatch;
      });
      
      console.log(`Found ${collectionNFTs.length} NFTs matching the target collection`);
      
      // Log details of the filtered NFTs
      collectionNFTs.forEach((nft, index) => {
        console.log(`Collection NFT ${index + 1}:`, {
          mint: nft.mint,
          name: nft.metadata?.name || 'Unknown',
          uri: nft.metadata?.uri || 'No URI'
        });
      });
      
      return collectionNFTs;
    } catch (error) {
      console.error("Error getting NFTs from collection:", error);
      return [];
    }
  }
  
  /**
   * Tries to obtain off-chain metadata (JSON) from a URI
   * @param {string} uri - URI of the JSON metadata
   * @returns {Promise<Object|null>} - Off-chain metadata or null if there is an error
   */
  async fetchOffchainMetadata(uri) {
    if (!uri) return null;
    
    try {
      // Fix URI if necessary
      let metadataUri = uri;
      if (uri.startsWith('ipfs://')) {
        // Convert IPFS to HTTP gateway
        metadataUri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
      } else if (!uri.startsWith('http')) {
        // Add https:// if missing
        metadataUri = 'https://' + uri;
      }
      
      // Try calling arweave or IPFS

      const response = await fetch(metadataUri);
      if (response.ok) {
        const metadata = await response.json();
        return metadata;
      }
      return null;
    } catch (error) {
      console.warn(`Error fetching off-chain metadata: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Obtiene metadatos on-chain de un NFT con intento de obtener también off-chain
   * @param {string} mintAddress - Dirección de mint del NFT
   * @returns {Promise<Object|null>} - Metadatos del NFT
   */
  async getNFTMetadata(mintAddress) {
    this.initConnection();
    
    try {
      const mintPubkey = new PublicKey(mintAddress);
      
      // Obtener la dirección PDA de los metadatos
      const metadataAddress = await this.findMetadataAddress(mintPubkey);

      
      // Intentar obtener la cuenta de metadatos
      const metadataAccount = await this.connection.getAccountInfo(metadataAddress);
      
      if (!metadataAccount || !metadataAccount.data) {
        // Return basic information if no metadata
        return {
          mint: mintPubkey.toString(),
          name: "Token without metadata",
          symbol: "NFT?",
          tokenType: "Without metadata"
        };
      }
      
      // Decode on-chain metadata
      const metadataDecoded = this.decodeMetadata(metadataAccount.data);
      
      // Crear objeto base con metadatos on-chain
      const metadata = {
        mint: mintPubkey.toString(),
        name: metadataDecoded.name,
        symbol: metadataDecoded.symbol,
        uri: metadataDecoded.uri,
        tokenType: "NFT",
        onChain: metadataDecoded
      };
      
      // If there is a URI, try to obtain off-chain metadata
      if (metadataDecoded.uri && metadataDecoded.uri.length > 1) {
        try {
          const offChainMeta = await this.fetchOffchainMetadata(metadataDecoded.uri);
          if (offChainMeta) {
            // Add off-chain metadata to the object
            metadata.offChain = offChainMeta;
            // Update name and image if they exist in off-chain
            if (offChainMeta.name) metadata.name = offChainMeta.name;
            if (offChainMeta.image) metadata.image = offChainMeta.image;
            if (offChainMeta.attributes) metadata.attributes = offChainMeta.attributes;
          }
        } catch (offChainError) {
          console.warn(`Error fetching off-chain metadata: ${offChainError.message}`);
        }
      }
      
      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for ${mintAddress}:`, error);
      // Return simplified object with error
      return {
        mint: mintAddress,
        name: "Error fetching metadata",
        symbol: "ERR",
        error: error.message
      };
    }
  }
  
  /**
   * Decodes binary metadata data using a more precise approach for Metaplex
   * @param {Buffer} data - Binary data of the metadata account
   * @returns {Object} - Decoded metadata
   */
  decodeMetadata(data) {
    try {
      // More robust way to decode Metaplex metadata
      // Structure based on the Metaplex Metadata v1 schema
      
      // Decoding Metaplex metadata
      
      // Metaplex metadata starts with a specific prefix
      // Determine if we have the expected format
      
      let offset = 0;
      // Sometimes there is a prefix byte
      if (data[0] === 4) {
        offset = 1;
      }
      
      // The first 8 bytes after the prefix contain structure information
      offset += 8;
      
      // Get names and URI using a length-based approach
      let name = "";
      let symbol = "";
      let uri = "";
      
      try {
        // Try reading name (32 bytes)
        const nameLength = data.readUInt32LE(offset);
        offset += 4;
        if (nameLength > 0 && nameLength < 100) { // Security check
          name = new TextDecoder().decode(data.slice(offset, offset + nameLength));

        }
        offset += MAX_NAME_LENGTH + 4; // Skip to symbol (4 bytes additional padding)
        
        // Try reading symbol (10 bytes)
        const symbolLength = data.readUInt32LE(offset);
        offset += 4;
        if (symbolLength > 0 && symbolLength < 20) { // Security check
          symbol = new TextDecoder().decode(data.slice(offset, offset + symbolLength));

        }
        offset += MAX_SYMBOL_LENGTH + 4; // Skip to URI (4 bytes additional padding)
        
        // Try reading URI (200 bytes)
        const uriLength = data.readUInt32LE(offset);
        offset += 4;
        if (uriLength > 0 && uriLength < 300) { // Security check
          uri = new TextDecoder().decode(data.slice(offset, offset + uriLength));

        }
      } catch (bytesError) {
        // Silently ignore error - pass to next method
        // If bytes approach fails, try another method
      }
      
      // Alternative approach: search for patterns in binary data
      if (!uri || uri.length < 5) {
        // Search for common URLs in the data if we couldn't extract them structurally
        const dataStr = new TextDecoder().decode(data);
        const httpMatches = dataStr.match(/https?:\/\/[\w\d\.\-\/]+/g);
        const arweaveMatches = dataStr.match(/https?:\/\/arweave\.[\w\d\.\-\/]+/g);
        const ipfsMatches = dataStr.match(/ipfs:\/\/[\w\d\.\-\/]+/g);
      
        if (httpMatches && httpMatches.length > 0) {
          uri = httpMatches[0];

        } else if (arweaveMatches && arweaveMatches.length > 0) {
          uri = arweaveMatches[0];

        } else if (ipfsMatches && ipfsMatches.length > 0) {
          uri = ipfsMatches[0];

        }
      }
      
      // Search for names if we haven't found them
      if (!name || name.length < 1) {
        // Search for alphanumeric strings of reasonable length for the name
        const dataStr = new TextDecoder().decode(data);
        const possibleNames = dataStr.match(/[A-Za-z0-9\s]{3,30}/g);
        if (possibleNames && possibleNames.length > 0) {
          name = possibleNames[0];

        }
      }
      
      return {
        name: name.trim() || "NFT",
        symbol: symbol.trim() || "NFT",
        uri: uri.trim(),
        rawData: Array.from(data.slice(0, 50)) // First 50 bytes for debug
      };
    } catch (error) {
      console.error("Error decoding metadata:", error);
      return {
        name: "Error decoding",
        symbol: "ERR",
        uri: "",
        error: error.message
      };
    }
  }
}

