// OptimizedAssetLoader.js - Enhanced asset loading system with WebP support and dynamic loading
// This file provides optimized asset loading for mobile devices

export class OptimizedAssetLoader {
  constructor(scene) {
    this.scene = scene;
    this.loadedScenes = new Set(); // Track which asset groups have been loaded
    this.loadQueue = [];
    this.isLoading = false;
    this.webpSupported = null; // Will be determined on init
    this.progressCallbacks = [];
    this.completeCallbacks = [];
    
    // Asset categories for code splitting
    this.assetManifest = {
      core: {
        images: [
          { key: 'game_logo', path: '/assets/UI/game_logo.png' },
          { key: 'dialog_box', path: '/assets/UI/dialog_box.png' },
          { key: 'menu_background', path: '/assets/UI/menu_background.png' },
          { key: 'button', path: '/assets/UI/button.png' },
          { key: 'button_hover', path: '/assets/UI/button_hover.png' },
          // Add other UI core assets
        ],
        audio: [
          { key: 'intro_music', path: '/assets/sound/music/intro.mp3' },
          { key: 'keystroke', path: '/assets/sound/sfx/keystroke.mp3' },
          { key: 'shot', path: '/assets/sound/sfx/shot.mp3' },
        ]
      },
      menuScene: {
        images: [
          // Menu specific assets
        ],
        audio: [
          { key: 'scroll_beat', path: '/assets/sound/music/scroll_beat.mp3' },
        ]
      },
      gameScene: {
        images: [
          { key: 'rifle', path: '/assets/upgrades/rifle.png' },
          { key: 'shotgun', path: '/assets/upgrades/shotgun.png' },
        ],
        audio: [
          { key: 'reload', path: '/assets/sound/sfx/rifle_reload.mp3' },
          { key: 'empty_mag', path: '/assets/sound/sfx/empty_shot.mp3' },
          { key: 'low_ammo', path: '/assets/sound/sfx/lowAmmo.mp3' },
          { key: 'last_mag', path: '/assets/sound/sfx/lastMag.mp3' },
        ]
      },
      // Enemy assets will be split by enemy type and loaded on demand
      enemies: {},
      // Character assets will be split by character ID 
      characters: {}
    };
    
    // Initialize character assets based on character IDs
    this.initCharacterAssets();
    // Initialize enemy assets
    this.initEnemyAssets();
  }
  
  async init() {
    // Check WebP support
    this.webpSupported = await this.detectWebPSupport();
    console.log(`WebP support: ${this.webpSupported ? 'Yes' : 'No'}`);
    
    // Set up load listeners
    this.setupLoaderEvents();
    
    // Add methods to detect device capabilities
    this.detectLowMemoryDevice();
    
    // Load core assets immediately
    this.loadAssetGroup('core');
  }
  
  // Check if the browser supports WebP format
  async detectWebPSupport() {
    return new Promise(resolve => {
      const webP = new Image();
      webP.onload = function() { resolve(webP.height === 1); };
      webP.onerror = function() { resolve(false); };
      webP.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    });
  }
  
  // Detect if we're on a low memory device
  detectLowMemoryDevice() {
    // Check for low memory indicators
    const isLowMemory = 
      navigator.deviceMemory && navigator.deviceMemory <= 2 || // 2GB or less RAM
      /android/i.test(navigator.userAgent) && !/high|large/i.test(navigator.userAgent) || // Basic Android devices
      /mobile/i.test(navigator.userAgent) && window.innerWidth < 768; // Small screen mobile
    
    this.scene.registry.set('isLowMemoryDevice', isLowMemory);
    console.log(`Device memory detection: ${isLowMemory ? 'Low memory device' : 'Normal memory device'}`);
    
    // If in Phantom WebView, assume we need to be conservative with memory
    const isPhantomWebView = /Phantom/i.test(navigator.userAgent);
    if (isPhantomWebView) {
      console.log('Phantom WebView detected - using conservative memory settings');
      this.scene.registry.set('isLowMemoryDevice', true);
    }
    
    return isLowMemory;
  }
  
  // Set up event listeners for the Phaser loader
  setupLoaderEvents() {
    const loader = this.scene.load;
    
    loader.on('filecomplete', (key, type, data) => {
      // Only log important assets to reduce console spam
      if (key.includes('music') || key === 'game_logo') {
        console.log(`Loaded: ${key}`);
      }
      
      // Notify callbacks
      this.progressCallbacks.forEach(callback => 
        callback({ key, type, progress: loader.progress })
      );
    });
    
    loader.on('progress', (value) => {
      // Only update at 5% increments to reduce overhead
      if (value % 0.05 <= 0.01) {
        this.progressCallbacks.forEach(callback => 
          callback({ progress: value })
        );
      }
    });
    
    loader.on('complete', () => {
      this.isLoading = false;
      
      // Process next in queue if any
      if (this.loadQueue.length > 0) {
        const nextGroup = this.loadQueue.shift();
        this.loadAssetGroupInternal(nextGroup);
      } else {
        // All queued loading complete
        this.completeCallbacks.forEach(callback => callback());
      }
    });
  }
  
  // Initialize character assets in the manifest
  initCharacterAssets() {
    // Define character IDs
    const characterIds = [1, 2, 3, 4, 5]; // Add all available character IDs
    
    characterIds.forEach(id => {
      const charKey = `character${id}`;
      this.assetManifest.characters[charKey] = {
        images: [],
        audio: []
      };
      
      // Add character-specific dialog sounds
      for (let i = 1; i <= 4; i++) {
        this.assetManifest.characters[charKey].audio.push({
          key: `${charKey}_dialog${i}`,
          path: `/assets/sound/story/${this.getCharacterFolder(id)}/intro/${charKey}_dialog${i}.mp3`
        });
      }
      
      // Character sprites will be added by loadCharacterAssets
    });
  }
  
  // Get character folder based on ID
  getCharacterFolder(id) {
    const folderMap = {
      1: 'degen',
      2: 'chad',
      3: 'toaster',
      4: 'pixel',
      5: 'flex'
    };
    return folderMap[id] || 'degen';
  }
  
  // Initialize enemy assets in the manifest
  initEnemyAssets() {
    // Enemy types/colors
    const enemyTypes = ['grey', 'blue', 'golden', 'purple', 'red'];
    
    enemyTypes.forEach(type => {
      this.assetManifest.enemies[type] = {
        images: []
      };
      
      // Enemy sprites will be added by loadEnemyAssets
    });
  }
  
  // Add a progress callback
  onProgress(callback) {
    this.progressCallbacks.push(callback);
  }
  
  // Add a complete callback
  onComplete(callback) {
    this.completeCallbacks.push(callback);
  }
  
  // Load a specific asset group
  loadAssetGroup(groupKey) {
    if (this.loadedScenes.has(groupKey)) {
      console.log(`Asset group ${groupKey} already loaded, skipping`);
      return Promise.resolve();
    }
    
    if (this.isLoading) {
      // Queue this group for loading after the current load completes
      console.log(`Queuing asset group ${groupKey} for loading`);
      this.loadQueue.push(groupKey);
      return new Promise(resolve => {
        const completeCallback = () => {
          if (this.loadedScenes.has(groupKey)) {
            resolve();
            // Remove this one-time callback
            const index = this.completeCallbacks.indexOf(completeCallback);
            if (index > -1) this.completeCallbacks.splice(index, 1);
          }
        };
        this.completeCallbacks.push(completeCallback);
      });
    }
    
    return this.loadAssetGroupInternal(groupKey);
  }
  
  // Internal method to load assets
  loadAssetGroupInternal(groupKey) {
    console.log(`Loading asset group: ${groupKey}`);
    
    // Mark as loading
    this.isLoading = true;
    
    // Special case for dynamic groups like specific characters or enemies
    if (groupKey.startsWith('character')) {
      const characterId = groupKey.replace('character', '');
      return this.loadCharacterAssets(characterId);
    } else if (groupKey.startsWith('enemy_')) {
      const enemyType = groupKey.replace('enemy_', '');
      return this.loadEnemyAssets(enemyType);
    }
    
    // Get the asset group from manifest
    const group = this.assetManifest[groupKey];
    if (!group) {
      console.error(`Asset group ${groupKey} not found in manifest`);
      this.isLoading = false;
      return Promise.reject(`Asset group ${groupKey} not found`);
    }
    
    // Create a promise to track completion
    return new Promise((resolve) => {
      // Load images with WebP alternatives when supported
      if (group.images && group.images.length > 0) {
        group.images.forEach(image => {
          if (this.webpSupported) {
            // Try to load WebP version first for supported browsers
            const webpPath = this.getWebPPath(image.path);
            this.scene.load.image(image.key, webpPath);
          } else {
            // Fall back to original format
            this.scene.load.image(image.key, image.path);
          }
        });
      }
      
      // Load audio
      if (group.audio && group.audio.length > 0) {
        group.audio.forEach(audio => {
          this.scene.load.audio(audio.key, audio.path);
        });
      }
      
      // One-time complete handler for this promise
      const completeHandler = () => {
        this.loadedScenes.add(groupKey);
        resolve();
        
        // Remove this one-time handler
        const index = this.completeCallbacks.indexOf(completeHandler);
        if (index > -1) this.completeCallbacks.splice(index, 1);
      };
      
      this.completeCallbacks.push(completeHandler);
      
      // Start loading if there's anything to load
      if ((group.images && group.images.length > 0) || 
          (group.audio && group.audio.length > 0)) {
        this.scene.load.start(); // Start the loading process
      } else {
        // Nothing to load, resolve immediately
        this.isLoading = false;
        completeHandler();
      }
    });
  }
  
  // Convert a regular image path to WebP equivalent
  getWebPPath(path) {
    // Check if path already has an extension
    const hasExtension = /\.(png|jpe?g|gif)$/i.test(path);
    
    if (hasExtension) {
      // Replace the existing extension with .webp
      return path.replace(/\.(png|jpe?g|gif)$/i, '.webp');
    } else {
      // Add .webp extension if no extension exists
      return `${path}.webp`;
    }
  }
  
  // Load character assets dynamically
  loadCharacterAssets(characterId) {
    const characterKey = `character${characterId}`;
    
    // Check if already loaded
    if (this.loadedScenes.has(characterKey)) {
      console.log(`Character ${characterId} assets already loaded`);
      this.isLoading = false;
      return Promise.resolve();
    }
    
    console.log(`Loading character ${characterId} assets`);
    
    return new Promise((resolve) => {
      // Determine character folder based on ID
      const characterFolder = this.getCharacterFolder(characterId);
      
      // Define base path for character assets
      const basePath = `/assets/Characters/${characterFolder}/`;
      
      // Load character sprites with WebP support
      const characterSprites = [
        { key: `player${characterId}_idle`, path: `${basePath}Idle/idle.png` },
        { key: `player${characterId}_run`, path: `${basePath}Run/run.png` },
        { key: `player${characterId}_death`, path: `${basePath}Death/death.png` }
      ];
      
      // Load sprites with WebP alternatives when supported
      characterSprites.forEach(sprite => {
        if (this.webpSupported) {
          const webpPath = this.getWebPPath(sprite.path);
          this.scene.load.image(sprite.key, webpPath);
        } else {
          this.scene.load.image(sprite.key, sprite.path);
        }
      });
      
      // One-time complete handler for this promise
      const completeHandler = () => {
        this.loadedScenes.add(characterKey);
        resolve();
        
        // Remove this one-time handler
        const index = this.completeCallbacks.indexOf(completeHandler);
        if (index > -1) this.completeCallbacks.splice(index, 1);
      };
      
      this.completeCallbacks.push(completeHandler);
      
      // Start loading
      this.scene.load.start();
    });
  }
  
  // Load enemy assets dynamically
  loadEnemyAssets(enemyType) {
    const enemyKey = `enemy_${enemyType}`;
    
    // Check if already loaded
    if (this.loadedScenes.has(enemyKey)) {
      console.log(`Enemy ${enemyType} assets already loaded`);
      this.isLoading = false;
      return Promise.resolve();
    }
    
    console.log(`Loading enemy ${enemyType} assets`);
    
    return new Promise((resolve) => {
      // Define base path for enemy assets
      const basePath = `/assets/Enemy/${enemyType}/`;
      
      // Define enemy animations to load
      const directions = ['down', 'up', 'right', 'right_down', 'right_up'];
      
      // Load walking animations
      directions.forEach(direction => {
        for (let i = 1; i <= 7; i++) {
          const key = `enemy_walk_${direction}${i}`;
          const path = `${basePath}walk/e1 walk ${direction}${i}.png`;
          
          if (this.webpSupported) {
            const webpPath = this.getWebPPath(path);
            this.scene.load.image(key, webpPath);
          } else {
            this.scene.load.image(key, path);
          }
        }
      });
      
      // Load attack animations
      directions.forEach(direction => {
        for (let i = 1; i <= 9; i++) {
          const key = `enemy_attack_${direction}${i}`;
          const path = `${basePath}attack/e1 attack ${direction}${i}.png`;
          
          if (this.webpSupported) {
            const webpPath = this.getWebPPath(path);
            this.scene.load.image(key, webpPath);
          } else {
            this.scene.load.image(key, path);
          }
        }
      });
      
      // One-time complete handler for this promise
      const completeHandler = () => {
        this.loadedScenes.add(enemyKey);
        resolve();
        
        // Remove this one-time handler
        const index = this.completeCallbacks.indexOf(completeHandler);
        if (index > -1) this.completeCallbacks.splice(index, 1);
      };
      
      this.completeCallbacks.push(completeHandler);
      
      // Start loading
      this.scene.load.start();
    });
  }
  
  // Prefetch assets for a scene that will be needed soon
  prefetchScene(sceneKey) {
    console.log(`Prefetching assets for ${sceneKey}`);
    // Queue loading but don't wait for completion
    this.loadAssetGroup(sceneKey);
  }
  
  // Unload assets to free memory (for low memory devices)
  unloadScene(sceneKey) {
    if (!this.scene.registry.get('isLowMemoryDevice')) {
      console.log('Not unloading assets - device has sufficient memory');
      return; // Only unload on low memory devices
    }
    
    if (!this.loadedScenes.has(sceneKey)) {
      console.log(`Scene ${sceneKey} assets not loaded, nothing to unload`);
      return;
    }
    
    console.log(`Unloading assets for ${sceneKey}`);
    
    // Get the asset group
    const group = this.assetManifest[sceneKey];
    if (!group) return;
    
    // Unload images
    if (group.images && group.images.length > 0) {
      group.images.forEach(image => {
        if (this.scene.textures.exists(image.key)) {
          this.scene.textures.remove(image.key);
        }
      });
    }
    
    // Mark as unloaded
    this.loadedScenes.delete(sceneKey);
  }
}

// Helper function to create sprite atlases from individual frames
export function createDynamicAtlas(scene, frameKeys, atlasName) {
  // Skip atlas creation on low memory devices to avoid overhead
  if (scene.registry.get('isLowMemoryDevice')) {
    return null;
  }
  
  // Create a texture atlas dynamically to improve performance
  const atlas = scene.textures.addDynamicTexture(atlasName, 2048, 2048);
  
  // Add each frame to the atlas
  frameKeys.forEach(key => {
    if (scene.textures.exists(key)) {
      atlas.add(key, 0, scene.textures.get(key).getSourceImage());
    }
  });
  
  return atlas;
}

// Simple utility to preload WebP version of an image
export function preloadWebPImage(scene, key, path) {
  // Create a new OptimizedAssetLoader instance if one doesn't exist
  if (!scene.optimizedLoader) {
    scene.optimizedLoader = new OptimizedAssetLoader(scene);
  }
  
  // Use existing WebP detection
  if (scene.optimizedLoader.webpSupported) {
    const webpPath = path.replace(/\.(png|jpe?g|gif)$/i, '.webp');
    scene.load.image(key, webpPath);
  } else {
    scene.load.image(key, path);
  }
}
