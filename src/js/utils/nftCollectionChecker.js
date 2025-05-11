import { SolanaWallet } from "../web3/SolanaWallet.js";
import { NFTCollectionReader } from "../web3/NFTCollectionReader.js";
import { PublicKey } from "@solana/web3.js";
import api from "./api.js";

// Importamos los polyfills necesarios para Web3
import "./polyfills.js";

/**
 * NFTCollectionChecker - Script para verificar si un usuario posee NFTs de una colección específica
 * Integrado con el sistema de autenticación de BonkGames
 */
class NFTCollectionChecker {
  /**
   * Constructor
   * @param {string} defaultCollectionAddress - Dirección de colección por defecto (opcional)
   */
  constructor(defaultCollectionAddress = "") {
    this.wallet = new SolanaWallet();
    this.nftReader = new NFTCollectionReader();
    this.isChecking = false;
    this.authToken = null;
    this.defaultCollectionAddress = defaultCollectionAddress;
  }

  /**
   * Inicializa el checker y configura los listeners
   * @param {string} [network="mainnet-beta"] - Red de Solana a utilizar (mainnet-beta, devnet)
   */
  init(network = "mainnet-beta") {
    // Configurar listeners para eventos de wallet
    this.wallet.onConnect(this.handleWalletConnect.bind(this));
    this.wallet.onDisconnect(this.handleWalletDisconnect.bind(this));
    
    // Inicializar conexión de Solana
    this.wallet.initConnection();
    
    // Si ya hay una wallet conectada, usar esa conexión
    if (this.wallet.connection) {
      this.nftReader.setConnection(this.wallet.connection);
    } else {
      // Configurar la red en el nftReader
      this.nftReader.setNetwork(network);
    }
    
    console.log(`NFTCollectionChecker inicializado en red ${network}`);
  }

  /**
   * Maneja la conexión de la wallet
   * @param {string} publicKey - Clave pública de la wallet conectada
   */
  async handleWalletConnect(publicKey) {
    console.log("Wallet conectada:", publicKey);
    
    try {
      // Autenticar con el backend
      const response = await api.post("/users/login", {
        nft_address: publicKey,
      });
      
      this.authToken = response.data.token;
      console.log("Usuario autenticado correctamente");
      
      // Asegurarse de que el nftReader tenga la misma conexión que la wallet
      if (this.wallet.connection) {
        // Si la wallet ya tiene una conexión, usarla para el nftReader
        this.nftReader.setConnection(this.wallet.connection);
        console.log("Usando la conexión existente de la wallet para el nftReader");
      } else {
        // Si no, inicializar la conexión del nftReader
        this.nftReader.initConnection();
        console.log("Inicializando nueva conexión para el nftReader");
      }
      
      // Actualizar la UI para mostrar que estamos conectados
      this.updateUI(true);
    } catch (error) {
      console.error("Error al autenticar usuario:", error);
      this.updateUI(false);
    }
  }

  /**
   * Maneja la desconexión de la wallet
   */
  handleWalletDisconnect() {
    console.log("Wallet desconectada");
    this.authToken = null;
    this.updateUI(false);
  }

  /**
   * Actualiza la UI basada en el estado de conexión
   * @param {boolean} isConnected - Si la wallet está conectada
   */
  updateUI(isConnected) {
    const statusElement = document.getElementById('wallet-status');
    const resultElement = document.getElementById('nft-check-result');
    
    if (statusElement) {
      statusElement.textContent = isConnected ? 'Conectado' : 'Desconectado';
      statusElement.className = isConnected ? 'connected' : 'disconnected';
    }
    
    if (resultElement) {
      resultElement.textContent = '';
      resultElement.className = '';
    }
  }

  /**
   * Verifica si el usuario posee NFTs de una colección específica
   * @param {string} [collectionAddress] - Dirección de la colección a verificar (opcional si se estableció una por defecto)
   * @returns {Promise<boolean>} - True si el usuario posee al menos un NFT de la colección
   */
  async checkCollection(collectionAddress) {
    // Usar la dirección de colección proporcionada o la predeterminada
    const targetCollection = collectionAddress || this.defaultCollectionAddress;
    
    if (!targetCollection) {
      console.error("No se proporcionó dirección de colección y no hay una predeterminada");
      this.showResult(false, "Error: No se especificó una dirección de colección");
      return false;
    }
    if (this.isChecking) {
      console.log("Ya hay una verificación en curso");
      return false;
    }
    
    if (!this.wallet.isConnected || !this.wallet.publicKey) {
      console.error("Wallet no conectada");
      this.showResult(false, "Wallet no conectada. Por favor conecta tu wallet primero.");
      return false;
    }
    
    this.isChecking = true;
    this.showResult(null, "Verificando colección de NFTs...");
    
    try {
      const walletAddress = this.wallet.getPublicKey();
      console.log(`Verificando NFTs para wallet ${walletAddress} en colección ${targetCollection}`);
      
      // Usar el método hasNFTFromCollection que ahora utiliza Metaplex
      const hasNFT = await this.nftReader.hasNFTFromCollection(walletAddress, targetCollection);
      
      console.log(`Resultado de verificación: ${hasNFT ? 'Posee NFT' : 'No posee NFT'}`);
      this.showResult(hasNFT, hasNFT ? 
        "¡Felicidades! Posees NFT(s) de esta colección." : 
        "No se encontraron NFTs de esta colección en tu wallet."
      );
      
      // Si el usuario tiene NFTs de la colección, podríamos actualizar su estado en el backend
      if (hasNFT && this.authToken) {
        try {
          await api.post("/users/updateNftStatus", 
            { collection: targetCollection, hasNft: true },
            { headers: { "x-auth-token": this.authToken } }
          );
          console.log("Estado de NFT actualizado en el backend");
        } catch (error) {
          console.error("Error al actualizar estado de NFT en el backend:", error);
        }
      }
      
      return hasNFT;
    } catch (error) {
      console.error("Error al verificar colección de NFTs:", error);
      this.showResult(false, "Error al verificar NFTs. Por favor intenta de nuevo.");
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Muestra el resultado de la verificación en la UI
   * @param {boolean|null} success - Resultado de la verificación (null para estado de carga)
   * @param {string} message - Mensaje a mostrar
   */
  showResult(success, message) {
    const resultElement = document.getElementById('nft-check-result');
    if (!resultElement) return;
    
    resultElement.textContent = message;
    
    if (success === null) {
      resultElement.className = 'loading';
    } else if (success) {
      resultElement.className = 'success';
    } else {
      resultElement.className = 'error';
    }
  }

  /**
   * Obtiene todos los NFTs de la wallet del usuario
   * @returns {Promise<Array>} - Lista de NFTs
   */
  async getAllNFTs() {
    if (!this.wallet.isConnected || !this.wallet.publicKey) {
      console.error("Wallet no conectada");
      return [];
    }
    
    try {
      // Asegurarse de que el nftReader tenga una conexión válida
      if (!this.nftReader.connection) {
        if (this.wallet.connection) {
          this.nftReader.setConnection(this.wallet.connection);
        } else {
          this.nftReader.initConnection();
        }
      }
      
      const walletAddress = this.wallet.getPublicKey();
      console.log(`Obteniendo todos los NFTs para wallet ${walletAddress}`);
      
      // Usar el método getNFTsByWallet que ahora utiliza Metaplex
      const nfts = await this.nftReader.getNFTsByWallet(walletAddress);
      console.log(`Se encontraron ${nfts.length} NFTs en total`);
      
      return nfts;
    } catch (error) {
      console.error("Error al obtener NFTs:", error);
      return [];
    }
  }

  /**
   * Obtiene NFTs de una colección específica
   * @param {string} [collectionAddress] - Dirección de la colección (opcional si se estableció una por defecto)
   * @returns {Promise<Array>} - Lista de NFTs de la colección
   */
  async getCollectionNFTs(collectionAddress) {
    // Usar la dirección de colección proporcionada o la predeterminada
    const targetCollection = collectionAddress || this.defaultCollectionAddress;
    
    if (!targetCollection) {
      console.error("No se proporcionó dirección de colección y no hay una predeterminada");
      return [];
    }
    
    if (!this.wallet.isConnected || !this.wallet.publicKey) {
      console.error("Wallet no conectada");
      return [];
    }
    
    try {
      // Asegurarse de que el nftReader tenga una conexión válida
      if (!this.nftReader.connection) {
        if (this.wallet.connection) {
          this.nftReader.setConnection(this.wallet.connection);
        } else {
          this.nftReader.initConnection();
        }
      }
      
      const walletAddress = this.wallet.getPublicKey();
      console.log(`Buscando NFTs de la colección ${targetCollection} para wallet ${walletAddress}`);
      
      // Usar el método getNFTsByCollection que ahora utiliza Metaplex
      const nfts = await this.nftReader.getNFTsByCollection(walletAddress, targetCollection);
      console.log(`Se encontraron ${nfts.length} NFTs de la colección`);
      
      return nfts;
    } catch (error) {
      console.error("Error al obtener NFTs de la colección:", error);
      return [];
    }
  }
}

// Dirección de la colección de NFTs que queremos buscar
// IMPORTANTE: Reemplaza esta dirección con la de tu colección real
const DEFAULT_COLLECTION_ADDRESS = "8Uvbv1B8Xrn7rCbfMS2GkQuYbA4vJ5BcNi9xnmWb5uzQ";

// Exportar una instancia única para usar en toda la aplicación
export const nftCollectionChecker = new NFTCollectionChecker(DEFAULT_COLLECTION_ADDRESS);
export default nftCollectionChecker;
