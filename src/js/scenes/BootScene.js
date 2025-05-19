import { createBulletTexture } from '../utils/TextureGenerator.js';
import { createAnimations } from '../utils/Animations.js';
import { OptimizedAssetLoader } from '../utils/OptimizedAssetLoader.js';
import { preloadSprites } from '../utils/AssetLoader.js'; // Mantenemos compatibilidad
import { AssetManager } from '../utils/AssetManager.js'; // Nuevo sistema de carga progresiva

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
    this.currentAsset = '';
    this.optimizedLoader = null;
    this.useOptimizedLoader = true; // Flag para habilitar el cargador optimizado
    this.assetManager = null; // Nuevo gestor de assets progresivo
  }
  
  init() {
    // Hide wallet UI during boot scene
    const walletUI = document.getElementById('wallet-ui');
    if (walletUI) {
      walletUI.style.display = 'none';
    }
    
    // Set initial portrait mode flag
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPortrait = height > width;
    this.registry.set('isPortrait', isPortrait);
    console.log('Initial orientation:', isPortrait ? 'portrait' : 'landscape');
    
    // Inicializar el sistema de carga progresiva de assets
    this.assetManager = new AssetManager(this);
    this.registry.set('assetManager', this.assetManager);
  }
  
  preload() {
    // Create loading UI
    this.createLoadingUI();
    
    // Detect if we're in a mobile environment, especially Phantom Wallet
    const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
    const isPhantomWebView = /Phantom/i.test(navigator.userAgent);
    
    // Phantom Wallet usa el gestor de assets especial que ya tiene optimizaciones incorporadas
    if (isPhantomWebView) {
      console.log('Phantom WebView detected - IMPLEMENTING EXTREME COMPATIBILITY MODE');
      this.useOptimizedLoader = false;
      
      // MÉTODO 1: No intentar cargar todos los recursos, solo los mínimos
      this.load.image('game_logo', '/assets/UI/game_logo.png');
      this.load.image('button', '/assets/UI/button.png');
      this.load.image('button_hover', '/assets/UI/button_hover.png');
      
      // Cargar sólo los sonidos esenciales
      this.load.audio('intro_music', '/assets/sound/music/intro.mp3');
      this.load.audio('shot', '/assets/sound/sfx/shot.mp3');
      
      // Advertir al usuario sobre modo de compatibilidad
      const loadingMessage = document.getElementById('loading-message');
      if (loadingMessage) {
        loadingMessage.textContent = 'Modo de compatibilidad Phantom activado';
      }
      
      // MÉTODO 2: Establecer un temporizador corto para forzar la finalización rápida
      this.phantomSafetyTimeout = this.time.delayedCall(3000, () => {
        console.log('PHANTOM SAFETY: Forzando finalización de carga inmediata');
        
        // MÉTODO 3: Forzar la finalización de la carga directamente
        window.dispatchEvent(new CustomEvent('game-loading-complete'));
        
        // MÉTODO 4: Iniciar directamente la escena de menú
        this.cache.game.scene.getScene('BootScene').scene.start('MenuScene');
      });
      
      // MÉTODO 5: Configurar para rendimiento extremadamente bajo
      this.game.renderer.setMaxTextures(8);  // Limitar aún más el número de texturas
      this.registry.set('phantomMode', true); // Usar flag específico para Phantom
      this.registry.set('ultraLowGraphicsMode', true); // Modo gráfico ultra reducido
    } else {
      // Para dispositivos normales, usar el sistema de carga progresiva
      this.useOptimizedLoader = this.useOptimizedLoader && isMobile;
      
      // Iniciar la carga progresiva para el menú principal
      if (this.assetManager) {
        console.log('Iniciando carga progresiva con AssetManager');
        // Cargar recursos críticos inmediatamente (UI básica)
        this.assetManager.loadAssetGroup('ui', this.assetManager.priorities.CRITICAL);
        
        // Programar carga de los recursos secundarios (personaje por defecto)
        setTimeout(() => {
          this.assetManager.loadAssetGroup('character1', this.assetManager.priorities.HIGH);
        }, 1000);
        
        // Recursos de fondo (enemigos comunes) cargados después para no bloquear la UI
        setTimeout(() => {
          this.assetManager.loadAssetGroup('enemy_grey', this.assetManager.priorities.MEDIUM);
        }, 3000);
      }
    }
    
    if (this.useOptimizedLoader) {
      console.log('Using optimized asset loader for mobile/Phantom');
      // Initialize the optimized loader
      this.optimizedLoader = new OptimizedAssetLoader(this);
      
      // Set up event propagation
      this.optimizedLoader.onProgress(data => {
        this.currentAsset = data.key || this.currentAsset;
        this.updateProgressBar(data.progress || 0);
        
        // Dispatch progress events to the DOM UI
        window.dispatchEvent(new CustomEvent('game-loading-progress', {
          detail: { value: data.progress || 0, currentAsset: this.currentAsset }
        }));
      });
      
      this.optimizedLoader.onComplete(() => {
        console.log("Core assets loaded successfully");
        // Dispatch event to notify that core loading is complete
        window.dispatchEvent(new CustomEvent('game-loading-complete'));
      });
      
      // Initialize and load core assets
      this.optimizedLoader.init();
    } else {
      console.log('Using traditional asset loader');
      
      // The original loading code for non-mobile or when optimization is disabled
      // Load weapon upgrade images
      this.load.image('rifle', '/assets//upgrades/rifle.png');
      this.load.image('shotgun', '/assets//upgrades/shotgun.png');
      
      // Add loading event listeners for debugging and UI updates
      this.load.on('filecomplete', (key, type, data) => {
        // Reduce logging to improve performance - only log certain key assets
        if (key.startsWith('player_death_') || key === 'intro_music' || key === 'gameMusic') {
          console.log(`Successfully loaded: ${key} (${type})`);
        }
        this.currentAsset = key;
        this.updateLoadingText();
        
        // Throttle DOM updates to improve performance - only update every 10 assets or for key assets
        const isKeyAsset = key.includes('music') || key.includes('player_death_') || key === 'game_logo';
        if (isKeyAsset || Math.random() < 0.1) {  // Update UI for ~10% of assets or key assets
          // Dispatch event for DOM-based loading UI
          window.dispatchEvent(new CustomEvent('game-loading-progress', {
            detail: { value: this.load.progress, currentAsset: key }
          }));
        }
      });
      
      this.load.on('loaderror', (file) => {
        console.error(`Error loading file: ${file.key} (${file.type}) - ${file.url}`);
        
        // Continue loading even if one file fails
        this.load.on('filecomplete', () => {
          this.load.start(); // Restart loading pipeline
        }, this, true); // Once only
      });
      
      this.load.on('progress', (value) => {
        this.updateProgressBar(value);
        
        // Throttle progress updates to improve performance
        if (value % 0.05 <= 0.01) { // Update at roughly 5% intervals
          // Dispatch event for DOM-based loading UI
          window.dispatchEvent(new CustomEvent('game-loading-progress', {
            detail: { value: value, currentAsset: this.currentAsset }
          }));
        }
      });
      
      // Add a listener for all load completion
      this.load.on('complete', () => {
        console.log("All assets loaded successfully");
        console.log("Audio cache contains:", Object.keys(this.cache.audio.entries));
        
        // Dispatch event to notify that loading is complete
        window.dispatchEvent(new CustomEvent('game-loading-complete'));
      });
      
      // Seguridad adicional: establecer un límite máximo de tiempo de carga (5 segundos)
      this.time.delayedCall(5000, () => {
        // Si todavía estamos en BootScene después de 5 segundos, forzar avance
        if (this.scene.key === 'BootScene') {
          console.log('SAFETY: Forzando finalización de carga después de 5 segundos');
          window.dispatchEvent(new CustomEvent('game-loading-complete'));
          // Intentar avanzar a MenuScene
          this.scene.start('MenuScene');
        }
      });
      
      // Use the original asset loader for non-mobile
      preloadSprites(this);
    }
  }
  
  createLoadingUI() {
    // Skip creating any UI elements in the Phaser scene
    // We'll rely completely on the HTML/DOM loading UI
    // This avoids duplicate loading bars and text elements
  }
  
  updateProgressBar(value) {
    // No progress bar in the Phaser scene to update
    // All updates are handled via events to the HTML UI
  }
  
  updateLoadingText() {
    // Don't need to update text here, it's handled by the HTML UI
    // Just keep track of the current asset for events
  }
  
  create() {
    createBulletTexture(this);
    
    // Make sure animations are created after loading is complete
    console.log('Creating animations...');
    createAnimations(this);
    console.log('Animations created');
    
    // Almacenar los sistemas de carga en el registro para otras escenas
    if (this.useOptimizedLoader && this.optimizedLoader) {
      this.registry.set('optimizedLoader', this.optimizedLoader);
    }
    
    // Configurar el sistema de liberar memoria cuando sea necesario 
    if (this.assetManager) {
      console.log('Configurando sistema de liberación de memoria automático');
      
      // Cada 60 segundos, verificar y liberar memoria si es necesario
      this.memoryCleanupTimer = this.time.addEvent({
        delay: 60000,
        callback: () => {
          this.assetManager.freeGPUMemory();
        },
        loop: true
      });
    }
    
    // Detect Phantom WebView to set appropriate renderer flag
    const isPhantomWebView = /Phantom/i.test(navigator.userAgent);
    if (isPhantomWebView) {
      console.log('Phantom WebView detected, forcing CANVAS renderer mode');
      this.registry.set('forceCanvasRenderer', true);
    } else {
      console.log('Standard browser detected, using default renderer');
      this.registry.set('forceCanvasRenderer', false);
    }
    
    // Create custom grayscale pipeline
    this.createGrayscalePipeline();
    
    // Ensure fonts are loaded
    console.log('Checking font loading...');
    // Create a div to test if the font is loaded
    const testFontElement = document.createElement('div');
    testFontElement.style.fontFamily = 'Tektur';
    testFontElement.style.position = 'absolute';
    testFontElement.style.visibility = 'hidden';
    testFontElement.textContent = 'Testing Tektur Font Loading';
    document.body.appendChild(testFontElement);
    console.log('Font load check element created');
    
    // Create an object to share between scenes
    this.registry.set('audioUnlocked', false);
    
    // Create audio references but don't play anything in BootScene
    if (this.cache.audio.exists('intro_music')) {
      // Just create a reference, without auto-playing
      this.introMusic = this.sound.add('intro_music', {
        volume: 0.6,
        loop: true
      });
      
      // Store the music in the registry to share between scenes
      this.registry.set('introMusic', this.introMusic);
      
      console.log("Created intro music reference (won't auto-play)");
      
      // Try to detect if we already have audio context unlock
      if (this.sound.context.state === 'running') {
        console.log("Audio context is already running, will be ready for scene-specific music");
        this.registry.set('audioUnlocked', true);
      }
    } else {
      console.warn("Intro music not found in cache");
    }
    
    // Show the HTML logo for the boot scene
    const logoContainer = document.getElementById('boot-logo-container');
    if (logoContainer) {
      logoContainer.style.display = 'block';
    }
    
    // Hide the logo when starting next scene
    this.events.once('shutdown', () => {
      if (logoContainer) {
        logoContainer.style.display = 'none';
      }
    });
    
    // Add scanline effect - with highest depth to ensure it's on top
    this.scanlines = this.createScanlines();
    this.scanlines.setDepth(1000); // Make sure it's on top of all other elements
    
    // No tweens to clean up
    
    // Start the sequence with StartScene (logo screen)
    this.scene.start('StartScene');
  }
  
  // Create a grayscale pipeline for black and white effect
  createGrayscalePipeline() {
    try {
      const renderer = this.game.renderer;
      
      // Check Phaser version
      const usingPhaser3 = (Phaser.VERSION && Phaser.VERSION.startsWith('3'));
      
      if (renderer.type === Phaser.WEBGL) {
        // Define the shader
        const fragShader = `
          precision mediump float;
          uniform sampler2D uMainSampler;
          varying vec2 outTexCoord;
          
          void main(void) {
            vec4 color = texture2D(uMainSampler, outTexCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor = vec4(vec3(gray), color.a);
          }
        `;
        
        // Different approaches based on Phaser version
        if (usingPhaser3) {
          // Try different pipeline class objects in case of version differences
          try {
            // For newer Phaser 3.50+
            if (Phaser.Renderer.WebGL.Pipelines.PostFXPipeline) {
              class GrayscalePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
                constructor(game) {
                  super({
                    game: game,
                    renderTarget: true,
                    fragShader: fragShader,
                    name: 'Grayscale'
                  });
                }
              }
              
              // Register the pipeline
              renderer.pipelines.addPostPipeline('Grayscale', GrayscalePipeline);
              console.log('Grayscale PostFXPipeline created successfully');
            } 
            // For older Phaser 3 versions
            else if (Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline) {
              const grayscalePipeline = renderer.pipelines.add('Grayscale', new Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline({
                game: this.game,
                renderer: renderer,
                fragShader: fragShader
              }));
              console.log('Grayscale TextureTintPipeline created successfully');
            }
          } catch (pipelineError) {
            console.error('Failed to create specific pipeline type:', pipelineError);
            
            // Last resort - try a more basic approach
            try {
              // Generic pipeline for compatibility
              renderer.pipelines.add('Grayscale', {
                name: 'Grayscale',
                shader: {
                  fragment: fragShader
                }
              });
              console.log('Created basic grayscale pipeline as fallback');
            } catch (genericError) {
              console.error('All pipeline creation attempts failed:', genericError);
            }
          }
        } else {
          console.warn('Not using Phaser 3, grayscale pipeline won\'t be created');
        }
      } else {
        console.warn('Grayscale pipeline not created - renderer is not WebGL');
      }
    } catch (error) {
      console.error('Error creating grayscale pipeline:', error);
    }
  }
  
  createScanlines() {
    // Create a container for scanlines that we can destroy and recreate
    const scanlineContainer = this.add.container(0, 0);
    
    // Create a new drawing function
    const drawScanlines = () => {
      // Clear any existing children in container
      scanlineContainer.removeAll(true);
      
      // Create a new graphics object
      const scanlineGraphics = this.add.graphics();
      scanlineGraphics.lineStyle(1, 0x000000, 0.2);
      
      // Draw horizontal lines across the screen with consistent spacing
      const spacing = 4; // 4 pixels between lines
      // Use a default height if cameras.main is not available
      const height = this.cameras && this.cameras.main ? this.cameras.main.height : 600;
      const totalLines = Math.ceil(height / spacing);
      
      for (let i = 0; i < totalLines; i++) {
        const y = i * spacing;
        scanlineGraphics.beginPath();
        scanlineGraphics.moveTo(0, y);
        // Use a default width if cameras.main is not available
        const width = this.cameras && this.cameras.main ? this.cameras.main.width : 800;
        scanlineGraphics.lineTo(width, y);
        scanlineGraphics.closePath();
        scanlineGraphics.strokePath();
      }
      
      // Add graphics to container
      scanlineContainer.add(scanlineGraphics);
    };
    
    // Initial draw
    drawScanlines();
    
    // Store the container and draw function in registry for later access
    this.registry.set('scanlineContainer', scanlineContainer);
    this.registry.set('redrawScanlines', drawScanlines);
    
    return scanlineContainer;
  }
}