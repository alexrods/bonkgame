/**
 * AssetManager.js - Sistema mejorado de carga progresiva de assets
 * Este gestor coordina la carga optimizada y progresiva de recursos
 */

import { OptimizedAssetLoader } from './OptimizedAssetLoader.js';

export class AssetManager {
  constructor(scene) {
    this.scene = scene;
    this.optimizedLoader = null;
    this.loadState = {
      core: false,
      ui: false,
      characters: {},
      enemies: {},
      maps: {},
      audio: {
        sfx: false,
        music: false
      }
    };
    this.loadQueue = [];
    this.isLoading = false;
    this.priorities = {
      CRITICAL: 0,   // Recursos vitales (UI, controles)
      HIGH: 1,       // Recursos inmediatos (personaje actual)
      MEDIUM: 2,     // Recursos probables (enemigos comunes)
      LOW: 3,        // Recursos opcionales (efectos visuales)
      BACKGROUND: 4  // Recursos de fondo (assets futuros)
    };
    
    // Detectar si estamos en un dispositivo móvil
    this.isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
    this.isPhantomWallet = /Phantom/i.test(navigator.userAgent);
    
    // Set memory constraints based on device detection
    this.setMemoryConstraints();
    
    // Inicializar el loader optimizado
    this.initOptimizedLoader();
    
    // Suscribirse a eventos de cambio de escena para gestionar recursos
    this.setupSceneTransitionHandlers();
  }
  
  /**
   * Inicializa el cargador optimizado y configura sus eventos
   */
  initOptimizedLoader() {
    // Si estamos en Phantom, desactivamos el optimized loader
    if (this.isPhantomWallet) {
      console.log('AssetManager: Modo de compatibilidad Phantom - usando cargador básico');
      this.useOptimizedLoader = false;
      return;
    }
    
    // Usar el OptimizedLoader existente o crear uno nuevo
    this.optimizedLoader = this.scene.registry.get('optimizedLoader');
    if (!this.optimizedLoader) {
      console.log('AssetManager: Creando nuevo OptimizedLoader');
      this.optimizedLoader = new OptimizedAssetLoader(this.scene);
      this.scene.registry.set('optimizedLoader', this.optimizedLoader);
      this.optimizedLoader.init();
    }
    
    // Configurar eventos
    this.useOptimizedLoader = true;
  }
  
  /**
   * Determina restricciones de memoria según el dispositivo
   */
  setMemoryConstraints() {
    let memoryLimit = 'high'; // Por defecto
    
    if (this.isPhantomWallet) {
      memoryLimit = 'minimal';
    } else if (this.isMobile) {
      // Intentar detectar memoria disponible
      if (navigator.deviceMemory) {
        if (navigator.deviceMemory <= 2) {
          memoryLimit = 'low';
        } else if (navigator.deviceMemory <= 4) {
          memoryLimit = 'medium';
        }
      } else {
        // Sin API de detección, asumir restricción basada en navegador
        memoryLimit = 'medium';
      }
    }
    
    this.memoryLimit = memoryLimit;
    console.log(`AssetManager: Configurado para restricción de memoria: ${memoryLimit}`);
    
    // Guardar en registro para uso en otras escenas
    this.scene.registry.set('memoryLimit', memoryLimit);
  }
  
  /**
   * Configura manejadores para transiciones entre escenas para gestionar memoria
   */
  setupSceneTransitionHandlers() {
    // Cuando una escena se duerme, considera liberar sus recursos
    this.scene.game.events.on('sleep', (sceneName) => {
      if (this.memoryLimit === 'low' || this.memoryLimit === 'minimal') {
        this.considerUnloadingScene(sceneName);
      }
    });
    
    // Cuando una escena se inicia, considera precargar sus recursos
    this.scene.game.events.on('start', (sceneName) => {
      this.considerPreloadingScene(sceneName);
    });
  }
  
  /**
   * Considera liberar recursos de escenas inactivas
   */
  considerUnloadingScene(sceneName) {
    // No descargar recursos críticos o de la escena actual
    if (sceneName === 'BootScene' || sceneName === this.scene.key) return;
    
    // Liberar recursos según la restricción de memoria
    if (this.memoryLimit === 'minimal') {
      console.log(`AssetManager: Liberando recursos de ${sceneName} (modo minimal)`);
      this.unloadSceneAssets(sceneName);
    } else if (this.memoryLimit === 'low') {
      // En modo bajo, solo liberar recursos de baja prioridad
      console.log(`AssetManager: Liberando recursos no críticos de ${sceneName} (modo low)`);
      this.unloadSceneAssets(sceneName, true);
    }
  }
  
  /**
   * Considera precargar recursos para una escena que se está iniciando
   */
  considerPreloadingScene(sceneName) {
    // Precargar según memoria disponible
    if (this.memoryLimit === 'minimal') {
      // En modo minimal, cargar solo lo esencial al momento
      console.log(`AssetManager: Solo recursos esenciales para ${sceneName}`);
      this.loadSceneEssentialAssets(sceneName);
    } else {
      // En otros modos, precargar progresivamente
      console.log(`AssetManager: Precargando progresivamente para ${sceneName}`);
      this.preloadSceneProgressively(sceneName);
    }
  }
  
  /**
   * Carga progresivamente los assets necesarios para una escena
   * @param {string} groupKey - Clave del grupo de assets a cargar
   * @param {number} priority - Prioridad de carga (del enum priorities)
   * @returns {Promise} - Promesa que se resuelve cuando la carga está completa
   */
  loadAssetGroup(groupKey, priority = this.priorities.MEDIUM) {
    if (!this.useOptimizedLoader || this.isPhantomWallet) {
      // En modo compatible, no usar carga optimizada
      console.log(`AssetManager: Saltando carga optimizada para ${groupKey} (modo compatible)`);
      return Promise.resolve();
    }
    
    // Si ya está cargado, devolver una promesa resuelta
    if (this.isGroupLoaded(groupKey)) {
      return Promise.resolve();
    }
    
    // Crear objeto de solicitud de carga con prioridad
    const loadRequest = {
      groupKey,
      priority,
      promise: null,
      resolve: null,
      reject: null
    };
    
    // Crear promesa para seguimiento externo
    loadRequest.promise = new Promise((resolve, reject) => {
      loadRequest.resolve = resolve;
      loadRequest.reject = reject;
    });
    
    // Añadir a la cola de carga
    this.loadQueue.push(loadRequest);
    
    // Ordenar la cola por prioridad
    this.loadQueue.sort((a, b) => a.priority - b.priority);
    
    // Iniciar proceso de carga si no está en curso
    if (!this.isLoading) {
      this.processNextInQueue();
    }
    
    return loadRequest.promise;
  }
  
  /**
   * Procesa el siguiente elemento en la cola de carga
   */
  processNextInQueue() {
    if (this.loadQueue.length === 0) {
      this.isLoading = false;
      return;
    }
    
    this.isLoading = true;
    const request = this.loadQueue.shift();
    
    console.log(`AssetManager: Cargando grupo ${request.groupKey} (prioridad ${request.priority})`);
    
    // Usar el optimized loader para cargar
    this.optimizedLoader.loadAssetGroup(request.groupKey)
      .then(() => {
        console.log(`AssetManager: Grupo ${request.groupKey} cargado con éxito`);
        
        // Marcar como cargado
        this.markGroupAsLoaded(request.groupKey);
        
        // Resolver la promesa externa
        request.resolve();
        
        // Procesar el siguiente en la cola
        this.processNextInQueue();
      })
      .catch(error => {
        console.error(`AssetManager: Error cargando grupo ${request.groupKey}:`, error);
        request.reject(error);
        
        // Procesar el siguiente aunque haya error
        this.processNextInQueue();
      });
  }
  
  /**
   * Marca un grupo de assets como cargado
   */
  markGroupAsLoaded(groupKey) {
    if (groupKey.startsWith('character')) {
      const characterId = groupKey.replace('character', '');
      this.loadState.characters[characterId] = true;
    } else if (groupKey.startsWith('enemy_')) {
      const enemyType = groupKey.replace('enemy_', '');
      this.loadState.enemies[enemyType] = true;
    } else if (groupKey === 'core' || groupKey === 'ui') {
      this.loadState[groupKey] = true;
    } else if (groupKey === 'sfx' || groupKey === 'music') {
      this.loadState.audio[groupKey] = true;
    } else if (groupKey.startsWith('map_')) {
      const mapId = groupKey.replace('map_', '');
      this.loadState.maps[mapId] = true;
    }
  }
  
  /**
   * Verifica si un grupo de assets ya está cargado
   */
  isGroupLoaded(groupKey) {
    if (groupKey.startsWith('character')) {
      const characterId = groupKey.replace('character', '');
      return !!this.loadState.characters[characterId];
    } else if (groupKey.startsWith('enemy_')) {
      const enemyType = groupKey.replace('enemy_', '');
      return !!this.loadState.enemies[enemyType];
    } else if (groupKey === 'core' || groupKey === 'ui') {
      return !!this.loadState[groupKey];
    } else if (groupKey === 'sfx' || groupKey === 'music') {
      return !!this.loadState.audio[groupKey];
    } else if (groupKey.startsWith('map_')) {
      const mapId = groupKey.replace('map_', '');
      return !!this.loadState.maps[mapId];
    }
    return false;
  }
  
  /**
   * Carga solo los assets esenciales para una escena (modo minimal)
   */
  loadSceneEssentialAssets(sceneName) {
    switch (sceneName) {
      case 'MenuScene':
        // Para el menú solo necesitamos UI básica
        this.loadAssetGroup('ui', this.priorities.CRITICAL);
        break;
      case 'GameScene':
        // Para el juego necesitamos el personaje seleccionado y enemigos básicos
        const selectedCharacter = this.scene.registry.get('selectedCharacter') || 'default';
        const characterId = selectedCharacter === 'default' ? '1' : selectedCharacter.replace('character', '');
        
        this.loadAssetGroup(`character${characterId}`, this.priorities.CRITICAL);
        this.loadAssetGroup('enemy_grey', this.priorities.HIGH); // Enemigos básicos
        break;
    }
  }
  
  /**
   * Precarga progresivamente los assets para una escena
   */
  preloadSceneProgressively(sceneName) {
    // Primero cargar lo esencial
    this.loadSceneEssentialAssets(sceneName);
    
    // Luego cargar assets secundarios con retraso
    setTimeout(() => {
      switch (sceneName) {
        case 'GameScene':
          // Cargar más tipos de enemigos progresivamente
          setTimeout(() => this.loadAssetGroup('enemy_red', this.priorities.MEDIUM), 2000);
          setTimeout(() => this.loadAssetGroup('enemy_blue', this.priorities.LOW), 5000);
          setTimeout(() => this.loadAssetGroup('enemy_purple', this.priorities.BACKGROUND), 10000);
          break;
      }
    }, 3000); // Retraso inicial
  }
  
  /**
   * Libera recursos de una escena para ahorrar memoria
   * @param {string} sceneName - Nombre de la escena
   * @param {boolean} keepCritical - Si mantener recursos críticos
   */
  unloadSceneAssets(sceneName, keepCritical = false) {
    if (!this.useOptimizedLoader || !this.optimizedLoader) return;
    
    switch (sceneName) {
      case 'GameScene':
        // Liberar recursos de enemigos menos comunes
        if (this.optimizedLoader.unloadScene) {
          if (!keepCritical) {
            // Liberar todo
            this.optimizedLoader.unloadScene('enemy_purple');
            this.optimizedLoader.unloadScene('enemy_blue');
            this.loadState.enemies.purple = false;
            this.loadState.enemies.blue = false;
          } else {
            // Mantener enemigos básicos pero liberar los raros
            this.optimizedLoader.unloadScene('enemy_purple');
            this.loadState.enemies.purple = false;
          }
        }
        break;
    }
  }
  
  /**
   * Carga texturas optimizadas para un personaje
   * @param {string|number} characterId - ID del personaje
   */
  loadCharacterAssets(characterId) {
    if (!characterId) return Promise.resolve();
    
    // Normalizar ID
    const charId = typeof characterId === 'string' && characterId === 'default' ? 
                  '1' : 
                  (characterId.toString().replace('character', ''));
    
    return this.loadAssetGroup(`character${charId}`, this.priorities.HIGH);
  }
  
  /**
   * Carga texturas optimizadas para un tipo de enemigo
   * @param {string} enemyType - Tipo de enemigo (grey, red, blue, etc.)
   */
  loadEnemyAssets(enemyType) {
    if (!enemyType) return Promise.resolve();
    
    // Determinar prioridad basada en tipo
    let priority;
    switch (enemyType) {
      case 'grey': priority = this.priorities.HIGH; break;
      case 'red': priority = this.priorities.MEDIUM; break;
      default: priority = this.priorities.LOW; break;
    }
    
    return this.loadAssetGroup(`enemy_${enemyType}`, priority);
  }
  
  /**
   * Libera memoria de la GPU para evitar desbordamientos
   */
  freeGPUMemory() {
    // Solo en dispositivos con restricciones de memoria
    if (this.memoryLimit === 'minimal' || this.memoryLimit === 'low') {
      if (this.scene.textures && this.scene.textures.getTextureKeys) {
        const textureKeys = this.scene.textures.getTextureKeys();
        const nonEssentialTextures = textureKeys.filter(key => {
          // Mantener texturas esenciales
          return !key.includes('__DEFAULT') && 
                 !key.includes('__MISSING') && 
                 !key.includes('ui_') &&
                 !key.includes('player') &&
                 !key.includes('button');
        });
        
        // Eliminar texturas no esenciales menos usadas
        const texturesToRemove = nonEssentialTextures.slice(0, 10); // Eliminar hasta 10 texturas
        texturesToRemove.forEach(key => {
          try {
            console.log(`AssetManager: Liberando textura ${key} para ahorrar memoria`);
            this.scene.textures.remove(key);
          } catch (e) {
            console.warn(`AssetManager: Error liberando textura ${key}:`, e);
          }
        });
      }
    }
  }
}
