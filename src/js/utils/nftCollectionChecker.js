/**
 * NFTCollectionChecker.js
 * Utilidad para verificar si un usuario posee NFTs de una colección específica en Solana
 * Compatible con el navegador y optimizado para BonkGames
 */

import { SolanaWallet } from "../web3/SolanaWallet.js";
import { NFTCollectionReader } from "../web3/NFTCollectionReader.js";
import { PublicKey } from "@solana/web3.js";
import api from "./api.js";

// Dirección de la colección de NFTs que queremos verificar
const DEFAULT_COLLECTION_ADDRESS = "8Uvbv1B8Xrn7rCbfMS2GkQuYbA4vJ5BcNi9xnmWb5uzQ";

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
    this.network = "devnet"; // Red por defecto
    
    // Propiedades para almacenar información de Bloodlines
    this.playerBloodlines = []; // Lista de bloodlines únicas del jugador
    this.bonkGamesNFTs = []; // Lista de NFTs de Bonk Games encontrados
    this.bloodlineCounts = {}; // Contador de cada tipo de bloodline
  }
  
  /**
   * Inicializa el checker y configura los listeners
   * @param {string} [network="devnet"] - Red de Solana a utilizar (mainnet-beta, devnet)
   */
  init(network = "devnet") {
    // Crear un identificador único para los elementos de bloqueo
    this.blockUIId = 'nft-verification-blocker-' + Math.random().toString(36).substring(2, 9);
    this.isBlocking = false;
    
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
      // Antes de verificar, intentar quitar cualquier mensaje de mint previo
      // para casos donde el usuario cambia de wallet sin NFTs a una con NFTs
      this.removeMintNFTMessage();
      
      // Bloquear las interacciones del juego durante la verificación
      this.blockGameInteractions("Conectando wallet y verificando NFTs...");
      
      // Actualizar la UI para mostrar que estamos conectados
      this.updateUI(true);
      
      // Autenticar con el backend
      try {
        const response = await api.post("/users/login", {
          nft_address: publicKey,
        });
        
        this.authToken = response.data.token;
        console.log("Usuario autenticado correctamente");
      } catch (authError) {
        console.warn("No se pudo autenticar con el backend, pero continuamos la verificación de NFTs", authError);
      }
      
      // Mostrar mensaje de verificación
      this.showResult(null, "Buscando NFTs en tu wallet...");
      
      // Verificar si el usuario tiene NFTs de la colección específica
      const hasNFT = await this.checkCollection();
      
      if (hasNFT) {
        console.log(`Se encontraron NFTs de la colección ${this.defaultCollectionAddress} en la wallet`);
      } else {
        console.log(`No se encontraron NFTs de la colección ${this.defaultCollectionAddress} en la wallet`);
      }
      
      // Desbloquear las interacciones al finalizar (solo si no hubo errores)
      // Nota: No desbloqueamos si no tiene NFTs, ya que el mensaje de mint debe permanecer visible
      if (hasNFT && !hasNFT.needsNFT) {
        this.unblockGameInteractions();
      }
      
    } catch (error) {
      console.error("Error en la conexión de wallet:", error);
      this.updateUI(false);
      this.showResult(false, "Ocurrió un error al verificar tu wallet. Inténtalo de nuevo.");
      
      // En caso de error, desbloquear las interacciones
      this.unblockGameInteractions();
    }
  }
  
  /**
   * Maneja la desconexión de la wallet
   */
  handleWalletDisconnect() {
    console.log("Wallet desconectada");
    
    // Limpiar todos los datos relacionados con NFTs y bloodlines
    this.nftsFound = [];
    this.bonkGamesNFTs = [];
    this.playerBloodlines = [];
    this.bloodlineCounts = {};
    this.authToken = null;
    
    // Actualizar UI para mostrar que estamos desconectados
    this.updateUI(false);
    this.clearResult();
    
    // Asegurar que las interacciones estén desbloqueadas
    this.unblockGameInteractions();
    
    // Notificar que los NFTs ya no están disponibles
    if (this.onNFTsUnavailable) this.onNFTsUnavailable();
    
    console.log('Datos de NFTs y bloodlines limpiados después de desconexión');
  }
  
  /**
   * Actualiza la UI para mostrar el estado de la conexión
   * @param {boolean} isConnected - Si la wallet está conectada
   */
  updateUI(isConnected) {
    // Implementación básica, puede ser extendida según necesidades
    console.log(`Estado de conexión actualizado: ${isConnected ? 'Conectado' : 'Desconectado'}`);
  }
  
  /**
   * Muestra el resultado de la verificación de NFTs
   * @param {boolean|null} hasNFT - Si el usuario tiene NFTs (null si está verificando)
   * @param {string} message - Mensaje a mostrar
   */
  showResult(hasNFT, message) {
    // Usar el sistema de notificaciones de la wallet
    if (this.wallet && this.wallet.showNotification) {
      this.wallet.showNotification(message);
    } else {
      console.log(`Resultado de verificación: ${message}`);
    }
  }
  
  /**
   * Actualiza la información del jugador con las bloodlines encontradas
   * Esta función se puede expandir para sincronizar con un backend
   */
  updatePlayerBloodlines() {
    // Si tenemos acceso al PlayerAccount, actualizar allí
    if (window.playerAccount) {
      console.log('Actualizando bloodlines del jugador...');
      
      // Guardar bloodlines en el objeto del jugador
      window.playerAccount.bloodlines = this.playerBloodlines;
      
      // Si el jugador tiene un ID, guardar en el backend
      if (window.playerAccount.id && this.authToken) {
        try {
          // Esto se puede expandir para enviar al backend
          console.log('Bloodlines del jugador actualizadas:', this.playerBloodlines);
          
          // Ejemplo de envío a backend (implementar según API)
          /*
          api.post("/players/updateBloodlines", {
            bloodlines: this.playerBloodlines,
            nftCount: this.bonkGamesNFTs.length
          }, { headers: { "x-auth-token": this.authToken } });
          */
        } catch (error) {
          console.error('Error al actualizar bloodlines:', error);
        }
      }
    } else {
      // Guardar localmente para uso futuro
      localStorage.setItem('playerBloodlines', JSON.stringify(this.playerBloodlines));
      console.log('Bloodlines guardadas localmente:', this.playerBloodlines);
    }
  }
  
  /**
   * Muestra un mensaje al usuario para adquirir un NFT de The Bonk Games
   * con un enlace a la candy machine
   */
  showMintNFTMessage() {
    console.log('Mostrando mensaje para mintear un NFT de The Bonk Games');
    
    // URL de la candy machine
    const candyMachineUrl = 'https://fight.bonkgames.io/';
    
    // Crear o encontrar el contenedor para el mensaje
    let messageContainer = document.getElementById('nft-required-message');
    let overlay = document.getElementById('nft-required-overlay');
    
    if (!messageContainer) {
      // Crear overlay para bloquear interacciones
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
        pointerEvents: 'all' // Bloquea todas las interacciones
      });
      
      // Crear contenedor del mensaje
      messageContainer = document.createElement('div');
      messageContainer.id = 'nft-required-message';
      
      // Aplicar estilos al contenedor
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
      
      // Crear título
      const title = document.createElement('h2');
      title.textContent = 'NFT Required';
      title.style.marginBottom = '20px';
      title.style.color = '#00ff66';
      title.style.fontFamily = '"Press Start 2P", "Audiowide", sans-serif';
      title.style.fontSize = '24px';
      
      // Crear mensaje
      const message = document.createElement('p');
      message.textContent = 'To play, you need an NFT from the "The Bonk Games" collection — mint yours and come back!';
      message.style.marginBottom = '30px';
      message.style.lineHeight = '1.6';
      message.style.fontSize = '18px';
      message.style.padding = '0 10px';
      
      // Crear botón que redireccione a la candy machine (no se abre en nueva pestaña para detener completamente el juego)
      const mintButton = document.createElement('button');
      mintButton.textContent = 'MINT YOUR NFT';
      mintButton.onclick = () => {
        // Almacenar un flag en localStorage para evitar comportamiento cíclico
        localStorage.setItem('redirectingToMint', 'true');
        // Redireccionar la página actual a la candy machine
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
      
      // Hover effect (agregar event listener)
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
      
      // Pequeño texto explicativo adicional
      const note = document.createElement('p');
      note.textContent = 'You can still connect another wallet with NFTs from this collection.';
      note.style.marginTop = '25px';
      note.style.fontSize = '14px';
      note.style.opacity = '0.7';
      
      // Agregar elementos al contenedor
      messageContainer.appendChild(title);
      messageContainer.appendChild(message);
      messageContainer.appendChild(mintButton);
      messageContainer.appendChild(note);
      
      // Agregar overlay y mensaje al cuerpo del documento
      document.body.appendChild(overlay);
      document.body.appendChild(messageContainer);
      
      // Habilitar solo interacciones con elementos wallet
      this.allowWalletInteractionsOnly();
    }
  }
  
  /**
   * Quita el mensaje de mint NFT si existe
   * Debe llamarse cuando se detecta que el usuario tiene NFTs válidos
   */
  removeMintNFTMessage() {
    console.log('Intentando quitar mensaje de mint NFT...');
    
    // Buscar elementos del mensaje de mint
    const messageContainer = document.getElementById('nft-required-message');
    const overlay = document.getElementById('nft-required-overlay');
    
    // Quitar elementos con animación si existen
    if (messageContainer || overlay) {
      console.log('Eliminando mensaje de mint NFT');
      
      // Animar desaparición
      if (messageContainer) {
        messageContainer.style.transition = 'all 0.5s ease';
        messageContainer.style.opacity = '0';
        messageContainer.style.transform = 'translate(-50%, -60%)';
      }
      
      if (overlay) {
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
      }
      
      // Eliminar después de la animación
      setTimeout(() => {
        if (messageContainer && messageContainer.parentNode) {
          messageContainer.parentNode.removeChild(messageContainer);
        }
        
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        
        console.log('Mensaje de mint NFT eliminado completamente');
      }, 500);
    }
  }
  
  /**
   * Permite interacciones solo con elementos relacionados con la wallet
   */
  allowWalletInteractionsOnly() {
    // Buscar todos los elementos relacionados con wallet (botones de conexión/desconexión)
    const walletElements = document.querySelectorAll('.wallet-adapter-button, .wallet-connect-button, [data-wallet-button]');
    
    // Asegurar que estos elementos estén por encima del overlay y sean interactivos
    walletElements.forEach(element => {
      if (element) {
        // Asegurar que están por encima del overlay
        element.style.zIndex = '1001';
        // Asegurar que reciben eventos
        element.style.position = 'relative';
      }
    });
    
    // Si no encontramos elementos con esas clases, buscar por texto/contenido relacionado con wallet
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
   * Bloquea todas las interacciones con el juego durante la verificación de NFTs
   * @param {string} message - Mensaje a mostrar durante el bloqueo
   */
  blockGameInteractions(message = "Verificando NFTs... Por favor espera") {
    // Si ya hay un bloqueo activo, no crear otro
    if (this.isBlocking) return;
    
    this.isBlocking = true;
    
    // Crear overlay de bloqueo
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
    
    // Añadir icono de carga y mensaje
    blocker.innerHTML = `
      <div style="background-color: rgba(0, 0, 0, 0.6); padding: 30px; border-radius: 10px; text-align: center; max-width: 80%;">
        <div style="border: 6px solid rgba(0, 200, 255, 0.2); border-top: 6px solid rgba(0, 255, 255, 0.8); border-radius: 50%; width: 50px; height: 50px; margin: 0 auto 20px; animation: nft-verification-spin 1.5s linear infinite;"></div>
        <div style="font-size: 18px; margin-bottom: 15px; font-weight: bold; color: rgba(0, 255, 255, 0.8);">${message}</div>
        <div style="font-size: 14px; color: #aaa;">NFT Collection en proceso de verificación...</div>
      </div>
      <style>
        @keyframes nft-verification-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.appendChild(blocker);
    
    // Permitir que solo los botones de wallet sean interactivos
    this.allowWalletInteractionsOnly();
    
    console.log('Interfaces del juego bloqueadas para verificación de NFTs');
  }

  /**
   * Desbloquea las interacciones con el juego después de la verificación de NFTs
   */
  unblockGameInteractions() {
    // Si no hay bloqueo activo, salir
    if (!this.isBlocking) return;
    
    const blocker = document.getElementById(this.blockUIId);
    if (blocker) {
      blocker.style.opacity = '0';
      blocker.style.transition = 'opacity 0.5s ease';
      
      // Remover después de la animación
      setTimeout(() => {
        if (blocker && blocker.parentNode) {
          blocker.parentNode.removeChild(blocker);
        }
      }, 500);
    }
    
    this.isBlocking = false;
    console.log('Interfaces del juego desbloqueadas');
  }
  
  /**
   * Lee y muestra los NFTs de la wallet conectada y su metadata
   * @returns {Promise<Array>} - Array con los NFTs encontrados y su metadata
   */
  async checkCollection() {
    
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
    this.showResult(null, "Buscando NFTs en tu wallet...");
    
    try {
      const walletAddress = this.wallet.getPublicKey();
      console.log(`Leyendo NFTs para wallet: ${walletAddress}`);
      
      // Asegurarse de que el nftReader está correctamente inicializado
      if (!this.nftReader.connection) {
        if (this.wallet.connection) {
          this.nftReader.setConnection(this.wallet.connection);
        } else {
          this.nftReader.initConnection();
        }
      }
      
      // Mostramos un mensaje mientras buscamos los NFTs
      this.showResult(null, "Leyendo NFTs y su metadata de tu wallet...");
      
      // Obtener todos los NFTs de la wallet con sus metadatos
      const nftsWithMetadata = await this.nftReader.getWalletNFTsAndMetadata(walletAddress);
      
      if (nftsWithMetadata.length === 0) {
        console.log("No se encontraron NFTs en la wallet");
        this.showResult(false, "No se encontraron NFTs en tu wallet.");
        
        // No hay NFTs de The Bonk Games - Mostrar mensaje para comprar uno y DETENER el flujo del juego
        this.showMintNFTMessage();
        
        // Retornar objeto con flag needsNFT para indicar claramente que se necesita un NFT
        return { needsNFT: true };
      }
      
      // Procesamos los NFTs encontrados
      
      // Verificar la dirección específica de la colección y los creators autorizados
      const AUTHORIZED_COLLECTION_ID = "8Uvbv1B8Xrn7rCbfMS2GkQuYbA4vJ5BcNi9xnmWb5uzQ"; // La dirección de la colección BonkGames
      const AUTHORIZED_CREATORS = [
        "7CNaNvbW5TSMPn8dPPrskLvaev9C1yp1zLe3nCp4hjUc", // Creator principal BonkGames
        // Añade aquí otros creators autorizados si los hay
      ];
      
      // Lista de atributos de verificación adicionales que debe tener al menos uno
      const REQUIRED_ATTRIBUTES = ['Bloodline'];
      
      // Filtrar NFTs usando criterios más estrictos
      const bonkGamesNFTs = nftsWithMetadata.filter(nft => {
        // Primera verificación: El nombre debe comenzar con "The Bonk Games"
        let nameMatches = false;
        
        if (nft.metadata && nft.metadata.name) {
          nameMatches = nft.metadata.name.startsWith('The Bonk Games');
        }
        // Si tiene metadatos off-chain, verificar ahí también
        if (!nameMatches && nft.metadata && nft.metadata.offChain && nft.metadata.offChain.name) {
          nameMatches = nft.metadata.offChain.name.startsWith('The Bonk Games');
        }
        
        // Si el nombre no coincide, descartar inmediatamente
        if (!nameMatches) return false;
        
        // Segunda verificación: coleccionID si está disponible
        if (nft.metadata && nft.metadata.collection && nft.metadata.collection.key) {
          // Si tiene collection.key, verificar si coincide con nuestra colección autorizada
          if (nft.metadata.collection.key === AUTHORIZED_COLLECTION_ID) {
            console.log(`NFT verificado por collection.key: ${nft.metadata.name}`);
            return true;
          }
        }
        
        // Tercera verificación: los creators autorizados
        let creatorVerified = false;
        if (nft.metadata && nft.metadata.creators && nft.metadata.creators.length > 0) {
          // Verificar si al menos uno de los creators está en nuestra lista autorizada
          creatorVerified = nft.metadata.creators.some(creator => 
            AUTHORIZED_CREATORS.includes(creator.address) && creator.verified
          );
          
          if (creatorVerified) {
            console.log(`NFT verificado por creator autorizado: ${nft.metadata.name}`);
            return true;
          }
        }
        
        // Si llegamos aquí y el nombre coincide pero no podemos verificar por creator o collection,
        // solo aceptamos basado en el nombre y esperamos que tenga el atributo Bloodline
        console.log(`NFT aceptado solo por nombre (verificación menos segura): ${nft.metadata.name}`);
        return nameMatches;
      });
      
      // Mostrar resultados de los NFTs de Bonk Games
      if (bonkGamesNFTs.length > 0) {

        
        bonkGamesNFTs.forEach((nft, index) => {
          // Obtener nombre del NFT
          const nftName = (nft.metadata.offChain && nft.metadata.offChain.name) || nft.metadata.name || 'Sin nombre';
          
          // Buscar el atributo "Bloodline"
          let bloodlineValue = 'No encontrado';
          
          // Buscar en los atributos off-chain
          if (nft.metadata.offChain && nft.metadata.offChain.attributes) {
            const bloodlineAttr = nft.metadata.offChain.attributes.find(
              attr => attr.trait_type === 'Bloodline' || attr.trait_type === 'bloodline'
            );
            
            if (bloodlineAttr) {
              bloodlineValue = bloodlineAttr.value;
            }
          }
          
          // Buscar en los atributos on-chain si existen
          if (bloodlineValue === 'No encontrado' && nft.metadata.onChain && nft.metadata.onChain.attributes) {
            const bloodlineAttr = nft.metadata.onChain.attributes.find(
              attr => attr.trait_type === 'Bloodline' || attr.trait_type === 'bloodline'
            );
            
            if (bloodlineAttr) {
              bloodlineValue = bloodlineAttr.value;
            }
          }
          
          // Guardar datos relevantes para uso posterior
          nft.displayName = nftName;
          
          // Guardar URL de imagen si está disponible 
          if (nft.metadata.image || (nft.metadata.offChain && nft.metadata.offChain.image)) {
            nft.imageUrl = nft.metadata.offChain?.image || nft.metadata.image;
          }
        });
        
        // Almacenar NFTs de Bonk Games encontrados
        this.bonkGamesNFTs = bonkGamesNFTs;
        
        // Recopilar valores únicos de Bloodline
        this.bloodlineCounts = {};
        this.playerBloodlines = [];
        
        // Calcular resumen por valores de Bloodline
        bonkGamesNFTs.forEach(nft => {
          let bloodlineValue = null; // Inicialmente no tiene valor de bloodline
          
          // Buscar en atributos off-chain
          if (nft.metadata.offChain && nft.metadata.offChain.attributes) {
            const bloodlineAttr = nft.metadata.offChain.attributes.find(
              attr => attr.trait_type === 'Bloodline' || attr.trait_type === 'bloodline'
            );
            if (bloodlineAttr) bloodlineValue = bloodlineAttr.value;
          }
          
          // Buscar en atributos on-chain si es necesario
          if (!bloodlineValue && nft.metadata.onChain && nft.metadata.onChain.attributes) {
            const bloodlineAttr = nft.metadata.onChain.attributes.find(
              attr => attr.trait_type === 'Bloodline' || attr.trait_type === 'bloodline'
            );
            if (bloodlineAttr) bloodlineValue = bloodlineAttr.value;
          }
          
          // Guardar el valor de bloodline en el NFT para referencia (solo si existe)
          if (bloodlineValue) {
            nft.bloodline = bloodlineValue;
            
            // Contador por tipo de Bloodline - solo para valores reales
            this.bloodlineCounts[bloodlineValue] = (this.bloodlineCounts[bloodlineValue] || 0) + 1;
            
            // Agregar a la lista de bloodlines únicas si no existe y tiene un valor real
            if (!this.playerBloodlines.includes(bloodlineValue)) {
              this.playerBloodlines.push(bloodlineValue);
            }
          } else {
            // Si no tiene bloodline, asignar un valor interno para referencia pero no contar
            nft.bloodline = 'N/A'; 
          }
        });
        
        // Guardar las bloodlines localmente para debugging
        console.log('Bloodlines guardadas localmente: ', JSON.stringify(this.playerBloodlines));
        
        // Verificar si hay al menos una bloodline en los NFTs encontrados
        if (this.playerBloodlines.length === 0) {
          // Hay NFTs de The Bonk Games pero ninguno tiene el atributo Bloodline
          console.log('Se encontraron NFTs de The Bonk Games, pero ninguno tiene el atributo Bloodline');
          
          // Mostrar mensaje para mintear uno correcto
          this.showMintNFTMessage();
          
          // Detener el flujo del juego y no permitir continuar
          this.showResult(false, "Se necesita un NFT de The Bonk Games con atributo Bloodline para jugar.");
          this.isChecking = false;
          
          // Retornar objeto para indicar que se necesita NFT con bloodline
          return { needsNFT: true, needsBloodline: true };
        }
        
        // Si llegamos aquí, hay al menos un NFT con bloodline
        // Actualizar información del jugador con las bloodlines encontradas
        this.updatePlayerBloodlines();
        
        // Quitar cualquier mensaje de mint que pudiera estar visible
        // (importante cuando el usuario cambia de wallet sin NFTs a una con NFTs)
        this.removeMintNFTMessage();
        
        // Guardar resumen para uso posterior por la aplicación
      } else {
        // No hay NFTs de The Bonk Games - Mostrar mensaje para comprar uno y DETENER el flujo del juego
        this.showMintNFTMessage();
        
        // Detener el flujo del juego y no permitir continuar
        this.showResult(false, "Se necesita un NFT de The Bonk Games para jugar.");
        this.isChecking = false;
        
        // Retornar objeto vacío para evitar errores pero no permitir que el juego avance
        return { needsNFT: true };
      }
      
      // Los NFTs con su metadata están disponibles para uso en la aplicación
      
      // Mostrar resultado al usuario con información de Bloodlines
      let resultMessage = `Se encontraron ${nftsWithMetadata.length} NFTs en tu wallet.`;
      
      // Añadir información de Bloodlines si hay NFTs de The Bonk Games con bloodlines reales
      if (this.playerBloodlines.length > 0) {
        resultMessage += `\nTienes ${this.bonkGamesNFTs.length} NFTs de The Bonk Games con las siguientes bloodlines: ${this.playerBloodlines.join(', ')}.`;
      } else if (this.bonkGamesNFTs.length > 0) {
        resultMessage += `\nTienes ${this.bonkGamesNFTs.length} NFTs de The Bonk Games, pero ninguno tiene el atributo 'Bloodline' especificado.`;
      }
      
      this.showResult(true, resultMessage);
      
      // Desbloquear interacciones al finalizar
      this.unblockGameInteractions();
      
      // Devolver la lista de NFTs con metadata
      return nftsWithMetadata;
    } catch (error) {
      console.error("Error al verificar colección de NFTs:", error);
      this.showResult(false, "Error al verificar NFTs. Por favor intenta de nuevo.");
      
      // Desbloquear interacciones en caso de error
      this.unblockGameInteractions();
      return false;
    } finally {
      this.isChecking = false;
    }
  }
}

// Exportar una instancia única para usar en toda la aplicación
export const nftCollectionChecker = new NFTCollectionChecker(DEFAULT_COLLECTION_ADDRESS);
export default nftCollectionChecker;
