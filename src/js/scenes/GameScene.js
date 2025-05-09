import { GAME_WIDTH, GAME_HEIGHT, WEB3_CONFIG } from '../../config.js';
import { PlayerManager } from '../managers/PlayerManager.js';
import { EnemyManager } from '../managers/EnemyManager.js';
import { DroneManager } from '../managers/DroneManager.js';
import { TimeScaleManager } from '../managers/TimeScaleManager.js';
import { GameUI } from '../ui/GameUI.js';
import { DroneWheel } from '../ui/DroneWheel.js';
import { DialogSystem } from '../ui/DialogSystem.js';
import { LabEnvironment } from '../environment/LabEnvironment.js';
import { PlayerAccount } from '../web3/PlayerAccount.js';
import { AIPlayerManager } from '../managers/AIPlayerManager.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.introMusic = null;
    this.playerAccount = null;
    this.cachedAudioElements = {}; // Cache for HTML Audio objects
    
    // Preload flag to ensure Network Drone Pilot image is loaded
    this.networkDronePilotLoaded = false;
    
    // Flag to prevent multiple first blood triggers
    this.firstBloodTriggered = false;
    
    // Kill streak tracking
    this.killStreak = {
      kills: 0,            // Number of kills in current streak
      startTime: 0,        // When the streak started
      lastKillTime: 0,     // Time of last kill
      active: false,       // Whether a streak is currently active
      cooldown: false,     // Cooldown after playing crowd chant
      timeWindow: 5000,    // Time window in ms (5 seconds)
      requiredKills: 7     // Kills needed for crowd chant (7 kills)
    };
    // Extended streak tracking (for longer streaks)
    this.extendedKillStreak = {
      kills: 0,             // Number of kills in extended streak
      startTime: 0,         // When the extended streak started
      active: false,        // Whether an extended streak is currently active
      cooldown: false,      // Cooldown after playing crowd cheer
      timeWindow: 30000,    // Time window in ms (30 seconds)
      requiredKills: 25     // Kills needed for crowd chant (25 kills)
    };
    this.crowdChantSound = null;
    this.crowdCheerSound = null;
    this.crowdCheer1Sound = null;
    this.crowdCheer2Sound = null;
    this.crowdOooohSound = null;
    this.crowdAaaahSound = null;
    this.cheerCounter = 0; // Used to alternate between cheer sounds
    this.activeEnemyCount = 0; // Track enemy count for reactions
    this.previousWave = 0; // Track wave number to detect wave completion
  }
  
  init(data) {
    // Check if we're in versus mode
    this.versusMode = data && data.versusMode === true || this.registry.get('versusMode') === true;
    
    // Reset milestone flags for a clean game start
    this.enemyDronesTriggered = false;
    this.milestone50Crossed = false;
    
    console.log("GameScene MODO VERSUS init called - setting up fresh game state");
    // Pre-select AI opponents for milestone encounters
    this.selectedAIOpponents = this.preSelectAIOpponents();
    
    // Make sure animations are created/recreated when game scene starts
    // This ensures character-specific animations are available
    import('../utils/Animations.js').then(({createAnimations}) => {
      const selectedCharacter = this.registry.get('selectedCharacter');
      console.log(`Ensuring animations for character: ${selectedCharacter}`);
      createAnimations(this);
    });
    console.log('GameScene init called - setting up fresh game state');
    
    if (this.versusMode) {
      // Load the AI player manager when in versus mode
      // We'll use a synchronous approach for simplicity
      console.log('Setting up versus mode');
      this.registry.set('versusMode', true);
      
      // Import will be handled in initializeManagers after the dynamic import
    }
    
    // Hide wallet UI during gameplay
    const walletUI = document.getElementById('wallet-ui');
    if (walletUI) {
      walletUI.style.display = 'none';
    }
    
    // Create a background color matching the lab floor
    this.cameras.main.setBackgroundColor(0xb8c0c8);
    
    // Get the intro music from registry
    this.introMusic = this.registry.get('introMusic');
    
    // According to the pattern: "GameScene - intro.mp3"
    // First check if menu music is playing and stop it (different music type)
    const menuMusic = this.registry.get('menuMusic');
    if (menuMusic && menuMusic.isPlaying) {
      console.log('Stopping menu music in GameScene');
      menuMusic.stop();
    }

    // Check if existing intro_music is already playing from Tutorial or CharacterSelect
    const existingTutorialMusic = this.registry.get('tutorialMusic');
    const existingCharSelectMusic = this.registry.get('characterSelectMusic');
    const existingIntroMusic = this.registry.get('introMusicInstance');
    
    // Use the first existing instance we find
    const existingMusic = existingIntroMusic || existingTutorialMusic || existingCharSelectMusic;
    
    if (existingMusic && existingMusic.isPlaying) {
      // Continue using the existing intro_music instance
      console.log("Using existing intro_music in GameScene");
      this.gameMusic = existingMusic;
      
      // Adjust volume for game scene - lower volume for dialog
      this.gameMusic.setVolume(0.3);
      
      // Store in registry with game scene key
      this.registry.set('gameMusic', this.gameMusic);
    }
    // No existing intro_music, need to create a new instance
    else if (this.cache.audio.exists('intro_music')) {
      // Create new intro music instance
      this.gameMusic = this.sound.add('intro_music', {
        volume: 0.3, // Lower volume to make dialog easier to hear
        loop: true
      });
      
      // Play the intro music for the game scene
      this.gameMusic.play();
      console.log('Starting new intro_music in GameScene');
      
      // Store in registry for other scenes that need it
      this.registry.set('gameMusic', this.gameMusic);
      this.registry.set('introMusicInstance', this.gameMusic); // Generic key for any scene using intro.mp3
    } else {
      console.warn("intro_music not found in cache for GameScene");
    }
    
    // Reset all state variables for clean restart
    this.cachedAudioElements = {};
    this.playerManager = null;
    this.enemyManager = null;
    this.droneManager = null;
    this.timeScaleManager = null;
    this.environment = null;
    this.ui = null;
    this.lootGroup = null;
    
    // Reset first blood flag for new game
    this.firstBloodTriggered = false;
    
    // Reset wave counter and active enemy count to prevent crowd reactions on restart
    this.previousWave = 0;
    this.activeEnemyCount = 0;
    
    // Clean up physics groups just in case
    if (this.physics && this.physics.world) {
      this.physics.world.colliders.destroy();
    }
    
    // Initialize player account and web3 connection
    this.initializePlayerAccount();
    
    // Initialize our component managers
    this.initializeManagers();
    
    // Preload and cache milestone sound effects
    this.preloadMilestoneSounds();
  }
  
  // Clean up resources when shutting down or restarting
  shutdown() {
    // Clean up physics groups if they exist
    if (this.lootGroup) {
      this.lootGroup.clear(true, true);
    }
    
    // Clear cached audio elements
    this.cachedAudioElements = {};
    
    // Reset first blood flag
    this.firstBloodTriggered = false;
    
    // Call shutdown on component managers if they have one
    if (this.playerManager && typeof this.playerManager.shutdown === 'function') {
      this.playerManager.shutdown();
    }
    
    if (this.enemyManager && typeof this.enemyManager.shutdown === 'function') {
      this.enemyManager.shutdown();
    }
    
    if (this.droneManager && typeof this.droneManager.shutdown === 'function') {
      this.droneManager.shutdown();
    }
    
    if (this.droneWheel && typeof this.droneWheel.shutdown === 'function') {
      this.droneWheel.shutdown();
    }
    
    if (this.dialogSystem && typeof this.dialogSystem.shutdown === 'function') {
      this.dialogSystem.shutdown();
    }
    
    if (this.environment && typeof this.environment.shutdown === 'function') {
      this.environment.shutdown();
    }
    
    if (this.ui && typeof this.ui.shutdown === 'function') {
      this.ui.shutdown();
    }
    
    if (this.timeScaleManager && typeof this.timeScaleManager.shutdown === 'function') {
      this.timeScaleManager.shutdown();
    }
    
    // Remove any event listeners
    this.events.off('player-authenticated');
    this.events.off('player-disconnected');
    this.events.off('showFloatingText');
    
    // Call parent shutdown
    super.shutdown();
  }
  
  // Pre-select which AI characters will appear at each milestone
  preSelectAIOpponents() {
    console.log("Pre-selecting AI opponents for milestones");
    
    // Available AI character options
    const characterOptions = ['character2', 'character3','character4', 'character5','character6'];
    //const characterOptions = ['character4'];
    
    // Get player's selected character to avoid duplicates
    const playerCharacter = this.registry.get('selectedCharacter') || 'default';
    
    // Filter out player's character
    const availableCharacters = characterOptions.filter(char => char !== playerCharacter);
    
    // Función para obtener un elemento aleatorio único
    const getUniqueRandomCharacter = (usedCharacters) => {
      const remainingChars = availableCharacters.filter(char => !usedCharacters.includes(char));
      
      // Si no quedan caracteres, reinicia el pool
      if (remainingChars.length === 0) {
        return Phaser.Utils.Array.GetRandom(availableCharacters);
      }
      
      return Phaser.Utils.Array.GetRandom(remainingChars);
    };
    
    // Pre-select 5 AI opponents for milestones (100, 200, 300, 400+ kills)
    const aiOpponents = [];
    const usedCharacters = [];
    
    for (let i = 0; i < 5; i++) {
      const selectedChar = getUniqueRandomCharacter(usedCharacters);
      aiOpponents.push(selectedChar);
      usedCharacters.push(selectedChar);
    }
    
    // Asignar un personaje aleatorio como aiCharacterKey global
    this.aiCharacterKey = Phaser.Utils.Array.GetRandom(aiOpponents);
    
    console.log("Pre-selected AI opponents for milestones:", aiOpponents, "Global AI Character:", this.aiCharacterKey);
    return aiOpponents;
  }
  
  // Get current kill count from UI
  getKillCount() {
    return this.ui && this.ui.killCounter ? this.ui.killCounter.killCount : 0;
  }
  
  preloadMilestoneSounds() {
    console.log("Preloading milestone sound effects");
    
    // Load crowd chant sound
    try {
      this.crowdChantSound = this.sound.add('crowd_chant');
      console.log("Crowd chant sound loaded successfully");
    } catch (e) {
      console.error("Error loading crowd chant sound:", e);
      
      // Fallback to HTML Audio if Phaser sound fails
      try {
        this.cachedAudioElements['crowd_chant'] = new Audio('src/sound/sfx/crowdChant.mp3');
        console.log("Crowd chant loaded as HTML Audio fallback");
      } catch (e) {
        console.error("Failed to load crowd chant as HTML Audio:", e);
      }
    }
    
    // Try to load interference sound from Phaser's cache
    try {
      // This is used for the GIT GUD screen
      this.interferenceSound = this.sound.add('interference');
      console.log("Interference sound loaded successfully");
    } catch (e) {
      console.error("Error loading interference sound:", e);
      // We'll rely on the HTML Audio fallback loaded later
    }
    
    // Load crowd cheer sounds
    try {
      this.crowdCheerSound = this.sound.add('crowd_cheer');
      this.crowdCheer1Sound = this.sound.add('crowd_cheer1');
      this.crowdCheer2Sound = this.sound.add('crowd_cheer2');
      this.crowdOooohSound = this.sound.add('crowd_ooooh');
      this.crowdAaaahSound = this.sound.add('crowd_aaaah');
      console.log("Crowd reaction sounds loaded successfully");
    } catch (e) {
      console.error("Error loading crowd reaction sounds:", e);
      
      // Fallback to HTML Audio if Phaser sound fails
      try {
        this.cachedAudioElements['crowd_cheer'] = new Audio('/assets//sound/sfx/crowdCheer.mp3');
        this.cachedAudioElements['crowd_cheer1'] = new Audio('/assets//sound/sfx/crowdCheer1.mp3');
        this.cachedAudioElements['crowd_cheer2'] = new Audio('/assets//sound/sfx/crowdCheer2.mp3');
        this.cachedAudioElements['crowd_ooooh'] = new Audio('/assets//sound/sfx/ooooh.mp3');
        this.cachedAudioElements['crowd_aaaah'] = new Audio('/assets//sound/sfx/aaaah.mp3');
        
        // Pre-load to ensure readiness when needed
        for (const key of ['crowd_cheer', 'crowd_cheer1', 'crowd_cheer2', 'crowd_ooooh', 'crowd_aaaah']) {
          if (this.cachedAudioElements[key]) {
            this.cachedAudioElements[key].load();
          }
        }
        
        console.log("Crowd reaction sounds loaded as HTML Audio fallback");
      } catch (e) {
        console.error("Failed to load crowd reaction sounds as HTML Audio:", e);
      }
    }
    
    // Array of milestone sound paths
    const milestoneSounds = [
      { key: 'survive', path: '/assets//sound/sfx/survive.mp3' },
      { key: 'kills_firstblood', path: '/assets//sound/sfx/firstblood.mp3' },
      { key: 'kills_10', path: '/assets//sound/sfx/10kills.mp3' },
      { key: 'kills_50', path: '/assets//sound/sfx/50kills.mp3' },
      { key: 'kills_100', path: '/assets//sound/sfx/100kills.mp3' },
      { key: 'kills_200', path: '/assets//sound/sfx/200kills.mp3' },
      { key: 'kills_300', path: '/assets//sound/sfx/300kills.mp3' },
      { key: 'kills_400', path: '/assets//sound/sfx/400kills.mp3' },
      { key: 'kills_500', path: '/assets//sound/sfx/500kills.mp3' },
      { key: 'kills_666', path: '/assets//sound/sfx/666kills.mp3' },
      { key: 'kills_pandemonium', path: '/assets//sound/sfx/PANDEMODIUM.mp3' },
      { key: 'interference', path: '/assets//sound/sfx/interference.mp3' }
    ];
    
    // Pre-load Toaster's 50-kill milestone dialog sounds to ensure they're available when needed
    const toasterSounds = [
      { key: 'toaster50kills', path: '/assets//sound/story/toaster/50kills/toaster50kills.mp3' },
      { key: 'toaster50kills1', path: '/assets//sound/story/toaster/50kills/toaster50kills1.mp3' },
      { key: 'dronePilot_50kills', path: '/assets//sound/story/all/50kills/dronePilot.mp3' }
    ];
    
    // Add Toaster sounds to the milestone sounds array
    milestoneSounds.push(...toasterSounds);
    
    // Create and cache audio elements for each sound
    milestoneSounds.forEach(({ key, path }) => {
      try {
        const audio = new Audio(path);
        audio.volume = 1.0;
        // Store for future use
        this.cachedAudioElements[key] = audio;
        console.log(`Preloaded audio for ${key}: ${path}`);
      } catch (e) {
        console.error(`Error preloading audio for ${key}:`, e);
      }
    });
    
    // Also try to load these sounds via Phaser's sound system
    try {
      console.log("Preloading Toaster milestone dialog sounds via Phaser sound system");
      this.load.audio('toaster50kills', '/assets//sound/story/toaster/50kills/toaster50kills.mp3');
      this.load.audio('toaster50kills1', '/assets//sound/story/toaster/50kills/toaster50kills1.mp3');
      this.load.audio('dronePilot_50kills', '/assets//sound/story/all/50kills/dronePilot.mp3');
      this.load.start(); // Start loading these sounds
    } catch (e) {
      console.error("Error preloading Toaster milestone sounds via Phaser:", e);
      // We'll rely on the HTML Audio fallback loaded above
    }
  }
  
  initializePlayerAccount() {
    // Get the existing PlayerAccount from registry
    const existingAccount = this.registry.get('playerAccount');
    if (existingAccount) {
      this.playerAccount = existingAccount;
      console.log('GameScene: Using existing PlayerAccount from registry');
    } else {
      // Create player account manager if not in registry (should not happen normally)
      console.warn('GameScene: No PlayerAccount in registry, creating new one');
      this.playerAccount = new PlayerAccount(this);
      this.registry.set('playerAccount', this.playerAccount);
    }
    
    // Set up event listeners for authentication events
    this.events.on('player-authenticated', this.handlePlayerAuthenticated, this);
    this.events.on('player-disconnected', this.handlePlayerDisconnected, this);
    
    // For debugging
    console.log('GameScene: Player is authenticated:', this.playerAccount.isPlayerAuthenticated());
    console.log('GameScene: Wallet required setting:', WEB3_CONFIG.walletRequired);
    
    // Check if wallet connection is required to play
    if (WEB3_CONFIG.walletRequired && !this.playerAccount.isPlayerAuthenticated()) {
      console.log('GameScene: Wallet required but not authenticated, returning to menu');
      
      // Instead of showing message, return to menu scene
      this.scene.start('MenuScene');
    }
  }
  
  initializeManagers() {
    // Initialize lab environment first (for floor and containers)
    this.environment = new LabEnvironment(this);
    this.environment.init();
    
    // Initialize UI for score display
    this.ui = new GameUI(this);
    this.ui.init();
    
    // initialize the arena bonk counter
    this.arenaBonkCount = 0;
    
    // Initialize player with reference to scene
    this.playerManager = new PlayerManager(this);
    this.playerManager.init();
    
    // Always load AIPlayerManager, even if not in versus mode.
    // We'll need it for milestone AI players in single player mode too
    const setupAI = () => {
      try {
        // Use the imported AIPlayerManager class directly
        console.log('Setting up AI Player Manager with imported class');
        
        // Create and initialize the AI player
        this.aiPlayerManager = new AIPlayerManager(this, this.playerManager);
        this.aiPlayerManager.aiCharacter = this.aiCharacterKey;
        this.aiPlayerManager.init();
        
        // Only immediately spawn AI player if in versus mode
        if (this.versusMode) {
          console.log('Initializing versus mode...');
          
          // Wait for player to be created
          if (!this.playerManager.player) {
            console.log('Waiting for player to be created before spawning AI...');
            this.time.delayedCall(500, () => setupAIPlayer());
            return;
          }
          
          // Create AI player at a position opposite to the player
          const setupAIPlayer = () => {
            if (!this.playerManager.player) {
              console.log('Player not available, cannot create AI player');
              return;
            }
            
            const spawnX = Math.max(100, Math.min(this.cameras.main.width - 100, 
                                                 this.cameras.main.width - this.playerManager.player.x));
            const spawnY = Math.max(100, Math.min(this.cameras.main.height - 100, 
                                                 this.cameras.main.height - this.playerManager.player.y));
            
            console.log(`Creating AI player at position (${spawnX}, ${spawnY})`);
            this.aiPlayerManager.createAIPlayer(spawnX, spawnY);
            
            // Set up collision between player bullets and AI player
            this.physics.add.overlap(
              this.playerManager.bullets,
              this.aiPlayerManager.aiPlayer,
              this.playerBulletHitAI,
              null,
              this
            );
            
            // Set up collision between AI bullets and player
            this.physics.add.overlap(
              this.aiPlayerManager.bullets,
              this.playerManager.player,
              this.aiBulletHitPlayer,
              null,
              this
            );
          };
          
          // Call the setup function immediately or with a delay if player isn't ready
          if (this.playerManager.player) {
            setupAIPlayer();
          } else {
            this.time.delayedCall(500, setupAIPlayer);
          }
          
          // Modify enemy spawn rate for versus mode
          this.versusEnemySpawnRate = 0.3; // Reduce enemy spawn rate to 30%
          console.log('Versus mode initialized successfully!');
        } else {
          console.log('AI Player Manager loaded for milestone events');
        }
        
      } catch (error) {
        console.error('Failed to initialize AI player manager:', error);
      }
    };
    
    // Start the async initialization
    setupAI();
    
    // Initialize enemy manager with reference to blood container
    this.enemyManager = new EnemyManager(this, this.environment.getBloodContainer());
    this.enemyManager.init();
    
    // Initialize drone manager
    this.droneManager = new DroneManager(this);
    this.droneManager.init();
    
    // Initialize drone wheel UI
    this.droneWheel = new DroneWheel(this);
    this.droneWheel.init();
    
    // Initialize dialog system
    this.dialogSystem = new DialogSystem(this);
    this.dialogSystem.init();
    
    // Listen for dialog end to trigger enemy AI player spawn at milestones
    this.events.on('dialogEnded', this.handleDialogEnded, this);
    
    // Get reference to rhythmGame and depositWithdrawPrompt from droneWheel for player animations
    this.rhythmGame = this.droneWheel.rhythmGame;
    this.depositWithdrawPrompt = this.droneWheel.depositWithdrawPrompt;
    
    // Initialize time scale manager
    this.timeScaleManager = new TimeScaleManager(this);
    this.timeScaleManager.init();
    
    // Set up keyboard controls for drone wheel
    this.setupKeyboardControls();
    
    // Setup floating text event listener
    this.events.on('showFloatingText', this.showFloatingText, this);
    
    // Initialize enemy drones flag - ensure it's false when the scene starts
    this.enemyDronesTriggered = false;
    
    // Ensure Network Drone Pilot image is loaded for 50 kill milestone dialog
    if (!this.networkDronePilotLoaded) {
      console.log("Preloading Network Drone Pilot image during initialization");
      this.load.image('story/networkDronePilot', '/assets//story/networkDronePilot.png');
      this.load.once('complete', () => {
        console.log("Network Drone Pilot image loaded during initialization");
        this.networkDronePilotLoaded = true;
      });
      this.load.start();
    }
    
    // If in versus mode, set up AI-player collision
    if (this.versusMode && this.aiPlayerManager && this.aiPlayerManager.aiPlayer) {
      // Set up collision between player bullets and AI player
      this.physics.add.overlap(
        this.playerManager.bullets,
        this.aiPlayerManager.aiPlayer,
        this.playerBulletHitAI,
        null,
        this
      );
    }
  }
  
  // Handle player bullets hitting AI player
  playerBulletHitAI(bullet, aiPlayer) {
    console.log('===== PLAYER BULLET HIT AI =====');
    
    // Safety check for bullet
    if (!bullet || !bullet.active) {
      console.warn('Invalid bullet in playerBulletHitAI');
      return;
    }
    
    // Safety check for AI player
    if (!aiPlayer || !aiPlayer.active) {
      console.warn('Invalid AI player in playerBulletHitAI');
      return;
    }
    
    // Prevent multiple damage events from the same bullet
    if (bullet.hasDealtDamage) {
      console.log('Bullet has already dealt damage, ignoring this hit');
      return;
    }
    bullet.hasDealtDamage = true;
    
    console.log(`Bullet hit AI at position (${aiPlayer.x}, ${aiPlayer.y})`);
    
    // Destroy the bullet
    bullet.destroy();
    console.log('Bullet destroyed');
    
    // Check available damage methods on AI player manager
    console.log('AI damage function availability:', {
      aiPlayerManager: !!this.aiPlayerManager,
      handleHitDamageFunction: !!(this.aiPlayerManager && typeof this.aiPlayerManager.handleHitDamage === 'function'),
      damageFunction: !!(this.aiPlayerManager && typeof this.aiPlayerManager.damage === 'function')
    });
    
    if (this.aiPlayerManager) {
      // Preferred: Use the unified handleHitDamage method if available
      if (typeof this.aiPlayerManager.handleHitDamage === 'function') {
        console.log('Calling aiPlayerManager.handleHitDamage with 1 damage point');
        this.aiPlayerManager.handleHitDamage(1); // This properly handles shields versus health
      }
      // Fallback: Use the legacy damage method if handleHitDamage isn't available
      else if (typeof this.aiPlayerManager.damage === 'function') {
        console.log('Calling legacy aiPlayerManager.damage with 1 damage point');
        this.aiPlayerManager.damage(1);
      }
      
    } else {
      console.warn('Direct damage fallback: aiPlayerManager not available');
      
      // Apply damage directly if manager not available
      if (aiPlayer) {
        // Initialize health if needed
        if (typeof aiPlayer.health === 'undefined') {
          aiPlayer.health = 100;
          aiPlayer.maxHealth = 100;
        }
        
        // Apply damage
        aiPlayer.health = Math.max(0, aiPlayer.health - 1);
        console.log(`Applied direct damage. AI health: ${aiPlayer.health}/${aiPlayer.maxHealth}`);
        
        // Flash effect
        this.tweens.add({
          targets: aiPlayer,
          alpha: 0.5,
          duration: 100,
          yoyo: true,
          repeat: 3,
        });
      }
    }
  }
  
  // Handle AI bullets hitting the player
  aiBulletHitPlayer(bullet, player) {
    console.log('===== AI BULLET HIT PLAYER =====');
    
    // CRITICAL: Make sure the parameters are in the correct order
    // Very important safety check - never destroy the player by accident!
    if (bullet === player) {
      console.error('CRITICAL ERROR: bullet and player are the same object! Overlap callback parameters may be reversed.');
      return; // Abort to prevent destroying the player
    }
    
    // Ensure bullet is actually a bullet and not the player
    if (bullet && player && typeof bullet.isDying !== 'undefined' && bullet.health !== undefined) {
      console.error('CRITICAL ERROR: First parameter appears to be the player, not a bullet!');
      // Swap parameters as a last resort if they seem reversed
      const temp = bullet;
      bullet = player;
      player = temp;
      console.log('Swapped bullet and player parameters as an emergency fix');
    }
    
    // Safety check for bullet
    if (!bullet || !bullet.active) {
      console.warn('Invalid bullet in aiBulletHitPlayer');
      return;
    }
    
    // Safety check for player but don't return if just inactive
    if (!player) {
      console.warn('Invalid player in aiBulletHitPlayer');
      return;
    }
    
    // NEVER try to reactivate a dying player
    if (!player.active) {
      if (player.isDying || player.isDead) {
        console.log('Player is not active because it is dying or dead - not processing bullet hit');
        return;
      }
    }
    
    console.log(`AI bullet hit player at position (${player.x}, ${player.y})`);
    
    // Mark bullet as a bullet for safety
    bullet.isBullet = true;
    
    // Destroy the bullet ONLY (never the player!)
    if (bullet && bullet.active && bullet !== player) {
      bullet.destroy();
      console.log('AI bullet destroyed');
    } else {
      console.log('AI bullet not active or already destroyed');
    }
    
    // Damage the player
    console.log('Player damage function availability:', {
      playerManager: !!this.playerManager,
      damageFunction: !!(this.playerManager && typeof this.playerManager.damagePlayer === 'function'),
      sceneDamageFunction: !!(typeof this.damagePlayer === 'function')
    });
    
    if (this.playerManager && typeof this.playerManager.damagePlayer === 'function') {
      console.log('Calling playerManager.damagePlayer with 5 damage points');
      this.playerManager.damagePlayer(5); // 5 damage points (less than player damage)
    } else if (typeof this.damagePlayer === 'function') {
      console.log('Calling scene.damagePlayer with 5 damage points');
      this.damagePlayer(5);
    } else {
      console.warn('Direct damage fallback: playerManager or damage function not available');
      
      // Apply damage directly if manager not available
      if (player) {
        // Initialize health if needed
        if (typeof player.health === 'undefined') {
          player.health = 100;
          player.maxHealth = 100;
        }
        
        // Apply damage
        player.health = Math.max(0, player.health - 5);
        console.log(`Applied direct damage. Player health: ${player.health}/${player.maxHealth}`);
        
        // Check if player health is zero and call handlePlayerDeath
        if (player.health === 0) {
          console.log('Player health is zero from direct damage, calling handlePlayerDeath');
          this.handlePlayerDeath();
        }
        
        // Make player temporarily invincible
        player.isInvincible = true;
        
        // Flash effect
        this.tweens.add({
          targets: player,
          alpha: 0.5,
          duration: 100,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            if (player && player.active) {
              player.alpha = 1;
              // Remove invincibility after a short delay
              this.time.delayedCall(800, () => {
                if (player && player.active) {
                  player.isInvincible = false;
                }
              });
            }
          }
        });
      }
    }
    
    // Show hit effect
    if (typeof this.showHitEffect === 'function') {
      console.log('Showing hit effect for player');
      this.showHitEffect(player.x, player.y);
    } else {
      console.warn('showHitEffect function not available');
    }
  }
  
  // Show hit effect at position
  showHitEffect(x, y) {
    // Simple flash effect
    const flash = this.add.circle(x, y, 20, 0xff0000, 0.7);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 200,
      onComplete: () => {
        flash.destroy();
      }
    });
  }
  
  // Show kill count milestone message
  showKillCountMessage(killCount) {
    // Ensure valid kill count
    if (typeof killCount !== 'number') {
      console.warn(`Invalid kill count: ${killCount}`);
      return;
    }
    
    // Initialize message shown flags if not already done
    if (!this.messageShownFlags) {
      this.messageShownFlags = {};
    }
    
    // First blood message
    if (killCount === 1 && !this.messageShownFlags[1]) {
      this.messageShownFlags[1] = true;
      console.log("FIRST BLOOD!");
      
      // Play first blood sound effect
      if (this.sound.get('kills_firstblood')) {
        this.sound.play('kills_firstblood', { volume: 1.0 });
      } else if (this.cachedAudioElements['kills_firstblood']) {
        this.cachedAudioElements['kills_firstblood'].play();
      }
      
      // Show first blood message
      this.showFloatingText({
        x: this.cameras.main.centerX,
        y: this.cameras.main.centerY - 100,
        text: "FIRST BLOOD!",
        color: '#ff0000',
        fontSize: '36px',
        strokeThickness: 3,
        strokeColor: '#000000',
        centered: true
      });
      return;
    }
    
    // Check other milestone achievements
    if (killCount >= 10 && killCount < 50 && !this.messageShownFlags[10]) {
      this.messageShownFlags[10] = true;
      console.log("10 KILLS MILESTONE!");
      
      // Play 10 kills sound effect
      if (this.sound.get('kills_10')) {
        this.sound.play('kills_10', { volume: 1.0 });
      } else if (this.cachedAudioElements['kills_10']) {
        this.cachedAudioElements['kills_10'].play();
      }
      
      // Show 10 kills message
      this.showFloatingText({
        x: this.cameras.main.centerX,
        y: this.cameras.main.centerY - 100,
        text: "10 KILLS!",
        color: '#ff6600',
        fontSize: '36px',
        strokeThickness: 3,
        strokeColor: '#000000',
        centered: true
      });
    }
    
    else if (killCount >= 50 && killCount < 100 && !this.messageShownFlags[50]) {
      this.messageShownFlags[50] = true;
      console.log("50 KILLS MILESTONE!");
      
      // Play 50 kills sound effect
      if (this.sound.get('kills_50')) {
        this.sound.play('kills_50', { volume: 1.0 });
      } else if (this.cachedAudioElements['kills_50']) {
        this.cachedAudioElements['kills_50'].play();
      }
      
      // Show 50 kills message
      this.showFloatingText({
        x: this.cameras.main.centerX,
        y: this.cameras.main.centerY - 100,
        text: "50 KILLS!",
        color: '#ffcc00',
        fontSize: '36px',
        strokeThickness: 3,
        strokeColor: '#000000',
        centered: true
      });
    }
    
    else if (killCount >= 100 && killCount < 200 && !this.messageShownFlags[100]) {
      this.messageShownFlags[100] = true;
      console.log("100 KILLS MILESTONE!");
      
      // Play 100 kills sound effect
      if (this.sound.get('kills_100')) {
        this.sound.play('kills_100', { volume: 1.0 });
      } else if (this.cachedAudioElements['kills_100']) {
        this.cachedAudioElements['kills_100'].play();
      }
      
      // Show 100 kills message
      this.showFloatingText({
        x: this.cameras.main.centerX,
        y: this.cameras.main.centerY - 100,
        text: "100 KILLS!",
        color: '#ff3333',
        fontSize: '40px',
        strokeThickness: 4,
        strokeColor: '#000000',
        centered: true
      });
      
      // Show milestone dialog for 100 kills - AI player will spawn after dialog
      console.log("100 kill milestone reached - showing dialog");
      const characterImagePath = `story/${this.selectedCharacter}/intro/${this.selectedCharacter}`;
      const networkExecImagePath = "story/networkExec";
      
    }
    
    else if (killCount >= 200 && killCount < 300 && !this.messageShownFlags[200]) {
      this.messageShownFlags[200] = true;
      console.log("200 KILLS MILESTONE!");
      
      // Play 200 kills sound effect
      if (this.sound.get('kills_200')) {
        this.sound.play('kills_200', { volume: 1.0 });
      } else if (this.cachedAudioElements['kills_200']) {
        this.cachedAudioElements['kills_200'].play();
      }
      
      // Show 200 kills message
      this.showFloatingText({
        x: this.cameras.main.centerX,
        y: this.cameras.main.centerY - 100,
        text: "200 KILLS!",
        color: '#cc33ff',
        fontSize: '42px',
        strokeThickness: 4,
        strokeColor: '#000000',
        centered: true
      });
    }
    
    else if (killCount >= 300 && killCount < 400 && !this.milestoneFlags[300]) {
      this.milestoneFlags[300] = true;
      console.log("300 KILLS MILESTONE! CHARACTER7 APPEARS!");
      
      // Spawn character7 AI player
      this.spawnEnemyAIPlayer('character7');
      
      // Play 300 kills sound effect
      if (this.sound.get('kills_300')) {
        this.sound.play('kills_300', { volume: 1.0 });
      } else if (this.cachedAudioElements['kills_300']) {
        this.cachedAudioElements['kills_300'].play();
      }
      
      // Camera flash effect for dramatic entrance
      this.cameras.main.flash(500, 255, 0, 0);
      
      // Optional spawn explosion effect
      const playerPos = this.playerManager.player.getCenter();
      const spawnEffect = this.add.sprite(playerPos.x, playerPos.y, 'explosion');
      spawnEffect.setScale(2);
      spawnEffect.play('explosion_anim');
      spawnEffect.on('animationcomplete', () => {
        spawnEffect.destroy();
      });
      
      // Show 300 kills message
      this.showFloatingText({
        x: this.cameras.main.centerX,
        y: this.cameras.main.centerY - 100,
        text: "300 KILLS! OMEN APPEARS!",
        color: '#ff3333',
        fontSize: '42px',
        strokeThickness: 4,
        strokeColor: '#000000',
        centered: true
      });
      
      // Log Omen spawn for debugging
      console.log('Omen character spawned at 300 kills milestone');
    }
    
    // Additional milestones can be handled similarly
  }
  
  // Ensure AIPlayerManager is available and initialized
  ensureAIPlayerManager() {
    // Only proceed if we don't already have an AIPlayerManager
    if (!this.aiPlayerManager) {
      console.log("------------Initializing AIPlayerManager for milestone events");
      
      // Create and initialize the AIPlayerManager using imported class
      try {
        // Create and initialize the AI player manager
        this.aiPlayerManager.aiCharacter = this.aiCharacterKey;
        this.aiPlayerManager = new AIPlayerManager(this, this.playerManager);
        this.aiPlayerManager.init();
        console.log('AI Player Manager initialized for milestone events');
        
        // For update calls, we'll handle this in the spawnEnemyAIPlayer method
      } catch (error) {
        console.error('Error initializing AIPlayerManager:', error);
      }
    }
  }
  
  // Spawn an AI-controlled player at milestone kill counts
  spawnEnemyAIPlayer(aiCharacterKey) {
    console.log("------------MILESTONE: Spawning enemy AI player");
    
    // Ensure AIPlayerManager is available
    if (!this.aiPlayerManager) {
      console.warn("AIPlayerManager not available, trying to initialize it...");
      this.ensureAIPlayerManager();
      
      // Since AIPlayerManager is loaded asynchronously, we need to 
      // retry the spawn after a short delay if it's not immediately available
      if (!this.aiPlayerManager) {
        console.log("AIPlayerManager initialization in progress, will retry spawn in 500ms");
        
        // Retry in 500ms
        this.time.delayedCall(500, () => {
          if (this.aiPlayerManager) {
            console.log("----------------AIPlayerManager now available, spawning milestone AI player");
            //this.spawnEnemyAIPlayer();
          } else {
            console.error("Failed to initialize AIPlayerManager for milestone event!");
          }
        });
        return;
      }
    }
    
    // Skip if player isn't available
    if (!this.playerManager || !this.playerManager.player) {
      console.error("No player available, cannot spawn AI player");
      return;
    }
    
    // Pick a position away from the player
    const player = this.playerManager.player;
    const spawnDistance = 400;
    const angle = Math.random() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * spawnDistance;
    const y = player.y + Math.sin(angle) * spawnDistance;
    
    // El personaje AI debe ser pasado explícitamente
    const aiCharacter = this.aiCharacterKey;
    console.log(`[SPAWN ENEMY AI] Spawning AI character "${aiCharacter}"`);
    // Elimina cualquier AI anterior
    if (this.aiPlayerManager.aiPlayer) {
      this.aiPlayerManager.destroy();
    }
    // Setea el personaje AI antes de inicializar
    this.aiPlayerManager.aiCharacter = aiCharacter;
    console.log(`[SPAWN ENEMY AI] [DEBUG] aiPlayerManager.aiCharacter asignado:`, this.aiPlayerManager.aiCharacter);
    this.aiPlayerManager.init();
    // Crea el AI player
    const aiPlayer = this.aiPlayerManager.createAIPlayer(x, y);
    if (aiPlayer) {
      console.log(`[SPAWN ENEMY AI] [DEBUG] AIPlayer creado con textura:`, aiPlayer.texture ? aiPlayer.texture.key : 'Sin textura');
    } else {
      console.warn(`[SPAWN ENEMY AI] [DEBUG] AIPlayer no se pudo crear correctamente.`);
    }
    
    // Set up collision between player bullets and AI player
    this.physics.add.overlap(
      this.playerManager.bullets,
      this.aiPlayerManager.aiPlayer,
      this.playerBulletHitAI,
      null,
      this
    );
    
    // Set up collision between AI bullets and player
    this.physics.add.overlap(
      this.aiPlayerManager.bullets,
      this.playerManager.player,
      this.aiBulletHitPlayer,
      null,
      this
    );
    
    // Show floating text to indicate AI opponent
    this.showFloatingText({
      x: x, 
      y: y - 50,
      text: `AI ${aiCharacter.toUpperCase()}`,
      color: '#ff4444',
      fontSize: '28px'
    });
  }
  
  setupKeyboardControls() {
    // E key to open drone wheel while held down
    this.input.keyboard.on('keydown-E', () => {
      // Check if deposit/withdraw prompt or rhythm minigame is active
      const depositPromptActive = this.droneWheel.depositWithdrawPrompt && 
                                 this.droneWheel.depositWithdrawPrompt.isVisible;
      const rhythmGameActive = this.droneWheel.rhythmGame && 
                              this.droneWheel.rhythmGame.isActive;
      
      // Only show drone wheel if neither menu is active
      if (!this.droneWheel.isVisible && !depositPromptActive && !rhythmGameActive) {
        this.droneWheel.show();
      }
    });
    
    // Release E key to confirm and close drone wheel
    this.input.keyboard.on('keyup-E', () => {
      // Only handle if drone wheel is visible and not in deposit or rhythm game
      const depositPromptActive = this.droneWheel.depositWithdrawPrompt && 
                                 this.droneWheel.depositWithdrawPrompt.isVisible;
      const rhythmGameActive = this.droneWheel.rhythmGame && 
                              this.droneWheel.rhythmGame.isActive;
                              
      if (this.droneWheel.isVisible && !depositPromptActive && !rhythmGameActive) {
        this.droneWheel.confirmSelection();
        this.droneWheel.hide();
      }
    });
    
    // Arrow keys to navigate drone wheel clockwise/counter-clockwise
    this.input.keyboard.on('keydown-LEFT', () => {
      if (this.droneWheel.isVisible) {
        console.log("LEFT arrow key pressed for drone wheel");
        this.droneWheel.selectPrevious(); // Counter-clockwise
      }
    });
    
    this.input.keyboard.on('keydown-RIGHT', () => {
      if (this.droneWheel.isVisible) {
        console.log("RIGHT arrow key pressed for drone wheel");
        this.droneWheel.selectNext(); // Clockwise
      }
    });
    
    // WASD navigation (alternative to arrow keys)
    this.input.keyboard.on('keydown-A', () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.selectPrevious(); // Counter-clockwise
      }
    });
    
    this.input.keyboard.on('keydown-D', () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.selectNext(); // Clockwise
      }
    });
    
    // Add ESC to cancel without confirming
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.hide();
      }
    });
  }
  
  create() {
    console.log("GameScene create - setting up game components");
    
    // Preload dialog images with error handling
    this.loadDialogAssets();

    // Precarga explícita para Drainer si es el personaje seleccionado
    const selectedCharacter = this.registry.get('selectedCharacter') || 'default';
    if (selectedCharacter === 'character2') {
      this.loadDrainerDialogAssets();
    }
    
    // Check if this is a multiplayer game
    this.isMultiplayer = this.registry.get('multiplayer') || false;
    this.isHost = this.registry.get('isHost') || false;
    
    // In multiplayer mode, host should wait for a signal before starting
    if (this.isMultiplayer && this.isHost) {
      // Show waiting text
      this.waitingHostText = this.add.text(
        GAME_WIDTH / 2,
        GAME_HEIGHT * 0.3,
        'Waiting for Player 2...',
        {
          fontFamily: 'Tektur',
          fontSize: '28px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4
        }
      );
      this.waitingHostText.setOrigin(0.5);
      this.waitingHostText.setDepth(1000);
      this.waitingHostText.setScrollFactor(0);
    }
    
    // Create player and load sounds
    this.playerManager.createPlayer();
    this.playerManager.loadSounds();
    
    // Configure camera to follow player
    this.setupCamera();
    
    // In multiplayer, if we're not host, immediately send a "ready" message
    // This helps in case the player ready signal from lobby was missed
    if (this.isMultiplayer && !this.isHost && this.playerManager.socket) {
      console.log("Player 2 sending another playerReady signal from GameScene");
      this.playerManager.socket.emit('playerReady', { 
        sessionId: this.registry.get('sessionId') 
      });
    }
    
    // Log the timeScaleManager state to debug
    if (this.timeScaleManager) {
      console.log("TimeScaleManager is initialized and ready");
    } else {
      console.warn("TimeScaleManager is not initialized yet!");
    }
    
    // Check if this is a brand new game or a restart from game over
    const isRestartFromGameOver = this.registry.get('restartFromGameOver');
    
    // For multiplayer, check if we need to wait
    if (this.isMultiplayer) {
      if (this.playerManager.socket) {
        this.playerManager.socket.on('startGame', () => {
          console.log('Received startGame signal, both players ready!');
          
          // Hide waiting text if it exists
          if (this.waitingHostText) {
            this.waitingHostText.destroy();
          }
          
          // Start the game for both players
          this.startGameForAllPlayers(isRestartFromGameOver);
        });
        
        console.log(`Multiplayer game: I am ${this.isHost ? 'HOST' : 'PLAYER 2'}`);
      }
    } else {
      // In single player mode, start game immediately
      this.startGameForAllPlayers(isRestartFromGameOver);
    }
    
    // Setup collision detection between bullets and enemies
    // Use enemyManager's collision check method, but bound to the EnemyManager instance
    this.physics.add.overlap(
      this.playerManager.getBullets(),
      this.enemyManager.getEnemies(),
      this.handleBulletEnemyCollision,
      (bullet, enemy) => this.enemyManager.checkBulletEnemyCollision(bullet, enemy),
      this
    );
    
    // Create loot group for cash items
    this.lootGroup = this.physics.add.group();
    
    // Setup collision for player collecting cash
    this.physics.add.overlap(
      this.playerManager.getPlayer(),
      this.lootGroup,
      this.handleCashCollection,
      null,
      this
    );
    
    // If player is authenticated, load high score from player account
    if (this.playerAccount.isPlayerAuthenticated()) {
      const highScore = this.playerAccount.getHighScore();
      this.ui.setHighScore(highScore);
    }
    
    // Listen for orientation changes to adjust camera
    this.events.on('orientationChange', this.handleOrientationChange, this);
  }
  
  // Track and handle kill streaks
  updateKillStreak() {
    const now = this.time.now;
    const streak = this.killStreak;
    const extStreak = this.extendedKillStreak;
    
    // Update short streak (7 kills in 5 seconds)
    // If we're in cooldown, check if it should end
    if (streak.cooldown) {
      // End cooldown after 10 seconds
      if (now - streak.lastKillTime > 10000) {
        streak.cooldown = false;
      }
    } else {
      // Check if this is the first kill in a potential streak
      if (!streak.active) {
        streak.active = true;
        streak.kills = 1;
        streak.startTime = now;
        streak.lastKillTime = now;
      } else {
        // Check if the streak is still valid (within the time window)
        if (now - streak.lastKillTime <= streak.timeWindow) {
          // Add to streak and update the last kill time
          streak.kills++;
          streak.lastKillTime = now;
          
          // If we've reached the threshold, play the crowd chant
          if (streak.kills >= streak.requiredKills) {
            this.playCrowdChant();
            
            // Reset streak and enter cooldown
            streak.active = false;
            streak.kills = 0;
            streak.cooldown = true;
          }
        } else {
          // Too much time has passed, reset streak
          streak.active = true;
          streak.kills = 1;
          streak.startTime = now;
          streak.lastKillTime = now;
        }
      }
    }
    
    // Update extended streak (40 kills in 30 seconds)
    // If we're in cooldown, check if it should end
    if (extStreak.cooldown) {
      // End cooldown after 30 seconds
      if (now - extStreak.startTime > 60000) { // 1 minute cooldown
        extStreak.cooldown = false;
      }
    } else {
      // Check if this is the first kill in a potential extended streak
      if (!extStreak.active) {
        extStreak.active = true;
        extStreak.kills = 1;
        extStreak.startTime = now;
      } else {
        // Check if the streak is still valid (within the extended time window)
        if (now - extStreak.startTime <= extStreak.timeWindow) {
          // Add to extended streak
          extStreak.kills++;
          
          // If we've reached the threshold, play the crowd cheer
          if (extStreak.kills >= extStreak.requiredKills) {
            this.playCrowdCheer();
            
            // Reset extended streak and enter cooldown
            extStreak.active = false;
            extStreak.kills = 0;
            extStreak.cooldown = true;
          }
        } else {
          // Too much time has passed, reset extended streak
          extStreak.active = true;
          extStreak.kills = 1;
          extStreak.startTime = now;
        }
      }
    }
  }
  
  // Play alternating crowd cheer sounds for 7-kill streaks
  playCrowdChant() {
    // Don't play crowd sounds in tutorial scene
    if (this.scene.key === 'TutorialScene') {
      console.log('Skipping crowd chant sound in tutorial');
      return;
    }
    
    // Increment the counter and get which cheer sound to use (0, 1, or 2)
    this.cheerCounter = (this.cheerCounter + 1) % 3;
    const cheerType = this.cheerCounter;
    console.log(`Crowd cheering (${cheerType}) for 7-kill streak!`);
    
    // Try to play using Phaser sound system first
    if (cheerType === 0 && this.crowdCheerSound) {
      this.crowdCheerSound.play({ volume: 1.0 });
      return;
    } else if (cheerType === 1 && this.crowdCheer1Sound) {
      this.crowdCheer1Sound.play({ volume: 1.0 });
      return;
    } else if (cheerType === 2 && this.crowdCheer2Sound) {
      this.crowdCheer2Sound.play({ volume: 1.0 });
      return;
    }
    
    // Fallback to HTML Audio elements if available
    let audioKey = 'crowd_cheer';
    if (cheerType === 1) audioKey = 'crowd_cheer1';
    if (cheerType === 2) audioKey = 'crowd_cheer2';
    
    const audioElement = this.cachedAudioElements[audioKey];
    if (audioElement) {
      // Reset to beginning in case it's already been played
      audioElement.currentTime = 0;
      // Ensure full volume
      audioElement.volume = 1.0;
      
      // Play with error handling
      try {
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn(`Unable to play ${audioKey} sound:`, error);
          });
        }
      } catch (error) {
        console.error(`Failed to play ${audioKey} sound:`, error);
      }
    }
  }
  
  // Play the crowd chant sound for extended streaks (25 kills)
  playCrowdCheer() {
    // Don't play crowd sounds in tutorial scene
    if (this.scene.key === 'TutorialScene') {
      console.log('Skipping crowd cheer sound in tutorial');
      return;
    }
    
    console.log('Crowd chanting for 25-kill streak!');
    
    // Try to play using Phaser sound system first
    if (this.crowdChantSound) {
      this.crowdChantSound.play({ volume: 1.0 });  // Full volume for crowd chant
      return;
    }
    
    // Fallback to HTML Audio element if available
    const audioElement = this.cachedAudioElements['crowd_chant'];
    if (audioElement) {
      // Reset to beginning in case it's already been played
      audioElement.currentTime = 0;
      // Ensure full volume
      audioElement.volume = 1.0;
      
      // Play with error handling
      try {
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Unable to play crowd chant sound:", error);
          });
        }
      } catch (error) {
        console.error("Failed to play crowd chant sound:", error);
      }
    }
  }

  // Play the crowd ooooh sound when player takes damage or survives a wave
  playCrowdOoooh() {
    // Don't play crowd sounds in tutorial scene
    if (this.scene.key === 'TutorialScene') {
      console.log('Skipping crowd ooooh sound in tutorial');
      return;
    }
    
    console.log('Crowd goes "Ooooh!"');
    
    // Try to play using Phaser sound system first
    if (this.crowdOooohSound) {
      this.crowdOooohSound.play({ volume: 1.0 });
      return;
    }
    
    // Fallback to HTML Audio element if available
    const audioElement = this.cachedAudioElements['crowd_ooooh'];
    if (audioElement) {
      // Reset to beginning in case it's already been played
      audioElement.currentTime = 0;
      // Ensure full volume for dramatic effect
      audioElement.volume = 1.0;
      
      // Play with error handling
      try {
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Unable to play crowd ooooh sound:", error);
          });
        }
      } catch (error) {
        console.error("Failed to play crowd ooooh sound:", error);
      }
    }
  }
  
  // Play the crowd aaaah sound for surviving a large number of enemies
  playCrowdAaaah() {
    // Don't play crowd sounds in tutorial scene
    if (this.scene.key === 'TutorialScene') {
      console.log('Skipping crowd aaaah sound in tutorial');
      return;
    }
    
    console.log('Crowd goes "Aaaah!" for surviving many enemies!');
    
    // Try to play using Phaser sound system first
    if (this.crowdAaaahSound) {
      this.crowdAaaahSound.play({ volume: 1.0 });
      return;
    }
    
    // Fallback to HTML Audio element if available
    const audioElement = this.cachedAudioElements['crowd_aaaah'];
    if (audioElement) {
      audioElement.currentTime = 0;
      audioElement.volume = 1.0;
      
      try {
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Unable to play crowd aaaah sound:", error);
          });
        }
      } catch (error) {
        console.error("Failed to play crowd aaaah sound:", error);
      }
    }
  }
  
  // Set up camera to follow player with deadzone and bounds
  setupCamera() {
    const player = this.playerManager.getPlayer();
    const isPortrait = this.registry.get('isPortrait');
    
    // Get current game dimensions
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;
    
    // Calculate the extended world size (50% larger than screen)
    const worldExtension = 0.5; // 50% extension
    const worldWidth = gameWidth * (1 + worldExtension);
    const worldHeight = gameHeight * (1 + worldExtension);
    
    // Calculate offset to center the extended world
    const offsetX = (worldWidth - gameWidth) / 2;
    const offsetY = (worldHeight - gameHeight) / 2;
    
    // Set world bounds to be larger than the camera view
    this.physics.world.setBounds(
      -offsetX, 
      -offsetY, 
      worldWidth, 
      worldHeight
    );
    
    // Keep player within these extended world bounds
    player.setCollideWorldBounds(true);
    
    // Set camera bounds to match the game dimensions exactly
    // This prevents the camera from showing beyond the playable area
    this.cameras.main.setBounds(
      -offsetX, 
      -offsetY, 
      worldWidth, 
      worldHeight
    );
    
    // Configure camera to follow player
    this.cameras.main.startFollow(player, true);
    
    // Set camera deadzone - smaller in portrait mode
    // These values determine how close to the edge the player can get before camera starts moving
    const deadzoneWidth = isPortrait ? gameWidth * 0.3 : gameWidth * 0.4;
    const deadzoneHeight = isPortrait ? gameHeight * 0.3 : gameHeight * 0.4;
    
    // Set the deadzone - area where camera won't scroll
    // This creates a "box" in the center where the player can move without the camera moving
    this.cameras.main.setDeadzone(deadzoneWidth, deadzoneHeight);
    
    // Set camera zoom
    this.cameras.main.setZoom(1);
    
    // Inform environment to resize tiles
    if (this.environment) {
      // Send an event that LabEnvironment can listen for
      this.events.emit('updateEnvironment', { isPortrait });
    }
    
    // Store camera configuration for reference in update
    this.cameraConfig = {
      worldWidth,
      worldHeight,
      offsetX,
      offsetY,
      gameWidth,
      gameHeight
    };
  }
  
  // Handle orientation changes
  handleOrientationChange({ isPortrait }) {
    // Update camera settings when orientation changes
    this.setupCamera();
    
    // Handle UI visibility in portrait mode
    if (isPortrait && this.ui) {
      console.log('Switching to portrait mode - hiding counters');
      // Hide counters in portrait mode until they change
      if (this.ui.killCounter) {
        // Hide container for more reliable hiding
        if (this.ui.killCounter.container) {
          this.ui.killCounter.container.setVisible(false);
        } else {
          this.ui.killCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(false)));
        }
        // Update portrait mode flag
        this.ui.killCounter.isPortrait = true;
      }
      
      if (this.ui.moneyCounter) {
        // Hide container for more reliable hiding
        if (this.ui.moneyCounter.container) {
          this.ui.moneyCounter.container.setVisible(false);
        } else {
          this.ui.moneyCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(false)));
          this.ui.moneyCounter.decimalPoints.forEach(point => point.setVisible(false));
        }
        // Update portrait mode flag
        this.ui.moneyCounter.isPortrait = true;
      }
      
      if (this.ui.bonkCounter) {
        // Hide container for more reliable hiding
        if (this.ui.bonkCounter.container) {
          this.ui.bonkCounter.container.setVisible(false);
        } else {
          this.ui.bonkCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(false)));
          this.ui.bonkCounter.decimalPoints.forEach(point => point.setVisible(false));
        }
        // Update portrait mode flag
        this.ui.bonkCounter.isPortrait = true;
      }
    } else if (!isPortrait && this.ui) {
      console.log('Switching to landscape mode - showing counters');
      // Show counters in landscape mode
      if (this.ui.killCounter) {
        // Show container for more reliable showing
        if (this.ui.killCounter.container) {
          this.ui.killCounter.container.setVisible(true);
        } else {
          this.ui.killCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(true)));
        }
        // Update portrait mode flag
        this.ui.killCounter.isPortrait = false;
      }
      
      if (this.ui.moneyCounter) {
        // Show container for more reliable showing
        if (this.ui.moneyCounter.container) {
          this.ui.moneyCounter.container.setVisible(true);
        } else {
          this.ui.moneyCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(true)));
          this.ui.moneyCounter.decimalPoints.forEach(point => point.setVisible(true));
        }
        // Update portrait mode flag
        this.ui.moneyCounter.isPortrait = false;
      }
      
      if (this.ui.bonkCounter) {
        // Show container for more reliable showing
        if (this.ui.bonkCounter.container) {
          this.ui.bonkCounter.container.setVisible(true);
        } else {
          this.ui.bonkCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(true)));
          this.ui.bonkCounter.decimalPoints.forEach(point => point.setVisible(true));
        }
        // Update portrait mode flag
        this.ui.bonkCounter.isPortrait = false;
      }
    }
  }
  
  // Clean up scene when it stops or restarts
  destroy() {
    // Make sure to clean up properly
    this.shutdown();
    super.destroy();
  }
  
  // Handle player collecting cash or upgrade boxes
  handleCashCollection(player, item) {
    // Check if the item is a drone upgrade box
    if (item.upgradeType) {
      // Check if this item has already been collected to prevent duplicate collection
      if (item.isCollected) {
        console.log(`Powerup already collected, ignoring duplicate collision`);
        return;
      }
      
      // Mark the item as collected to prevent duplicate collection
      item.isCollected = true;
      
      // Apply the upgrade effect via drone manager
      console.log('Collecting powerup:', item.upgradeType);
      this.droneManager.applyUpgrade(player, item);
      return;
    }
    
    // Check if it's a BONK token
    if (item.lootType === 'bonk') {
      // Check if this item has already been collected to prevent duplicate collection
      if (item.isCollected) {
        console.log(`Bonk already collected, ignoring duplicate collision`);
        return;
      }
      
      // Mark the item as collected to prevent duplicate collection
      item.isCollected = true;
      
      // Special collection animation for Bonk
      this.tweens.add({
        targets: item,
        scale: 0.2, // Grow slightly for effect
        alpha: 0,
        y: item.y - 30, // Fly up higher
        duration: 300,
        ease: 'Back.easeIn',
        onComplete: () => {
          // Add Bonk tokens to player's account
          const bonkAmount = item.bonkAmount || 1;

          // Incrementa el contador de BONK de la arena
          this.arenaBonkCount += bonkAmount;

          // Actualiza SOLO la UI con el contador de la arena
          this.time.delayedCall(50, () => {
            if (this.ui && typeof this.ui.updateBonkDisplay === 'function') {
              this.ui.updateBonkDisplay(this.arenaBonkCount);
            }
          });

          // También actualiza el balance de la cuenta en segundo plano (si quieres mantenerlo actualizado)
          if (this.playerAccount) {
            this.playerAccount.updateBonkBalance(bonkAmount);
          }

          // Show floating text for BONK collection
          this.events.emit('showFloatingText', {
            x: player.x,
            y: player.y - 40,
            text: `+${bonkAmount} BONK`,
            color: '#ffe234' // Bonk yellow color
          });

          // Remove the bonk item
          item.destroy();
        }
      });
      return;
    }
    
    // Handle regular loot items (coins or cash)
    // Check if this item has already been collected to prevent duplicate collection
    if (item.isCollected) {
      console.log(`Money already collected, ignoring duplicate collision`);
      return;
    }
    
    // Mark the item as collected to prevent duplicate collection
    item.isCollected = true;
    
    this.tweens.add({
      targets: item,
      scale: 0.3, // Adjusted to match the new smaller size
      alpha: 0,
      y: item.y - 20,
      duration: 200,
      onComplete: () => {
        // Add a random amount of money (10x nerf)
        const moneyValues = [0.1, 0.5, 1, 2, 5, 10];
        const randomMoney = moneyValues[Math.floor(Math.random() * moneyValues.length)];
        
        // Apply multiplier if set (from stronger enemies)
        const multiplier = item.moneyMultiplier || 1;
        const finalAmount = randomMoney * multiplier;
        
        // Update player's money
        this.ui.updateMoney(finalAmount);
        
        // Play credit sound right before destroying the item
        this.playCreditSound();
        
        // Remove the item
        item.destroy();
      }
    });
  }
  
  // Play credit sound when collecting loot
  playCreditSound() {
    // Try to play the sound using Phaser's sound system
    const sound = this.sound.get('credit');
    if (sound) {
      sound.play({ volume: 0.5 });
      return;
    }
    
    // Fallback to HTML Audio if available
    const audioElement = this.cachedAudioElements['credit'];
    if (audioElement) {
      audioElement.currentTime = 0;
      audioElement.volume = 0.5;
      
      try {
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn(`Unable to play credit sound:`, error);
          });
        }
      } catch (error) {
        console.error(`Failed to play credit sound:`, error);
      }
      return;
    }
    
    // Second fallback - try to create and play the sound directly
    try {
      const newAudio = new Audio('/assets//sound/sfx/credit.mp3');
      newAudio.volume = 0.5;
      const playPromise = newAudio.play();
      
      // Cache for future use
      this.cachedAudioElements['credit'] = newAudio;
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn(`Unable to create and play credit sound:`, error);
        });
      }
    } catch (error) {
      console.error(`Failed to create and play credit sound:`, error);
    }
  }
  
  update(time, delta) {
    // Update player (handles movement, shooting, animations)
    this.playerManager.update();
    
    // Update enemies (handles movement, animations)
    this.enemyManager.update(this.playerManager.getPlayer());
    
    // Update AI player - both in versus mode and for milestone events in single player
    if (this.aiPlayerManager && this.aiPlayerManager.aiPlayer) {
      // Don't log every frame to avoid console spam
      // console.log('Updating AI player');
      this.aiPlayerManager.update(time, delta);
      
      // Debug: show AI state
      if (this.debugText && this.aiPlayerManager.currentState) {
        this.debugText.setText(`AI State: ${this.aiPlayerManager.currentState}`);
      } else if (this.aiPlayerManager.currentState && !this.debugText) {
        // Create debug text if it doesn't exist yet
        this.debugText = this.add.text(10, 10, `AI State: ${this.aiPlayerManager.currentState}`, {
          fontSize: '16px', 
          color: '#ffffff',
          backgroundColor: '#000000'
        });
        this.debugText.setDepth(1000);
        this.debugText.setScrollFactor(0);
      }
    }
    
    // Update drone manager
    if (this.droneManager) {
      this.droneManager.update();
    }
    
    // Update time scale manager
    if (this.timeScaleManager) {
      this.timeScaleManager.update();
    }
    
    // Check for player-enemy collisions (for enemy attacks)
    this.checkPlayerEnemyCollisions();
    
    // Handle camera edge cases to prevent showing beyond the playable area
    this.updateCameraConstraints();
    
    // Track enemy count and wave transitions for crowd reactions
    this.updateCrowdReactions();
  }
  
  // Track enemy count and detect waves for crowd reactions
  // Track which milestones have already triggered special enemies
  milestoneFlags = {
    100: false,
    200: false,
    300: false,
    400: false,
    500: false,
    600: false
  };
  
  // Handle dialog ended event - check if we need to spawn AI player
  handleDialogEnded() {
    console.log("Dialog ended, checking if we should spawn enemy AI player");
    
    // Get current kill count directly from UI - don't call updateKillCount
    const killCount = this.ui ? this.ui.killCount : 0;
    
    // Check for milestone ranges to catch cases where exact value was skipped
    if ((killCount >= 100 && killCount < 200 && !this.milestoneFlags[100]) ||
        (killCount >= 200 && killCount < 300 && !this.milestoneFlags[200]) ||
        (killCount >= 300 && killCount < 400 && !this.milestoneFlags[300]) ||
        (killCount >= 400 && killCount < 500 && !this.milestoneFlags[400]) ||
        (killCount >= 500 && killCount < 600 && !this.milestoneFlags[500]) ||
        (killCount >= 600 && !this.milestoneFlags[600])) {
      
      // Determine which milestone we're triggering
      let milestone = 100;
      if (killCount >= 600) milestone = 600;
      else if (killCount >= 500) milestone = 500;
      else if (killCount >= 400) milestone = 400;
      else if (killCount >= 300) milestone = 300;
      else if (killCount >= 200) milestone = 200;
      
      console.log(`Dialog ended at milestone kill range for ${milestone}, spawning enemy AI player`);
      
      // Mark this milestone as triggered
      this.milestoneFlags[milestone] = true;
      
      // Spawn enemy AI player
      this.spawnEnemyAIPlayer();
    } else {
      // For non-milestone dialogs, ensure enemy spawning is resumed
      if (this.enemyManager) {
        console.log("Resuming enemy spawning after non-milestone dialog");
        
        // Check the current enemy count for debugging purposes
        const currentEnemyCount = this.enemyManager.getEnemies()?.getLength() || 0;
        console.log(`Current enemy count: ${currentEnemyCount}`);
        
        // Use setPaused which is available on EnemyManager
        this.enemyManager.setPaused(false);
        
        // Use comprehensive approach for non-milestone dialogs too
        // Direct access to timers via the spawner
        if (this.enemyManager.spawner) {
          console.log("Directly resuming spawner timers");
          
          // Check timer states before changing
          const enemySpawnTimerState = this.enemyManager.spawner.enemySpawnTimer?.paused;
          const waveTimerState = this.enemyManager.spawner.waveTimer?.paused;
          console.log(`Timer states - enemySpawnTimer: ${enemySpawnTimerState ? 'paused' : 'active'}, waveTimer: ${waveTimerState ? 'paused' : 'active'}`);
          
          if (this.enemyManager.spawner.enemySpawnTimer) {
            this.enemyManager.spawner.enemySpawnTimer.paused = false;
          }
          
          if (this.enemyManager.spawner.waveTimer) {
            this.enemyManager.spawner.waveTimer.paused = false;
          }
          
          // Set the flag directly
          this.enemyManager.spawner.spawnPaused = false;
          
          // Also use the dedicated method if available
          if (typeof this.enemyManager.spawner.resumeSpawning === 'function') {
            this.enemyManager.spawner.resumeSpawning();
          }
        }
        
        // Force spawning to resume via the global function
        if (typeof this.enemyManager.forceStartSpawning === 'function') {
          console.log("Using forceStartSpawning global function for dialog end");
          this.enemyManager.forceStartSpawning();
        }
        
        // Emit events to ensure other systems know spawning is resumed
        this.events.emit('enemySpawningResumed');
      }
    }
  }
  
  updateCrowdReactions() {
    // Get current enemy count
    const currentEnemyCount = this.enemyManager.getEnemies().getLength();
    
    // Check for wave completion
    if (this.enemyManager.spawner && this.enemyManager.spawner.currentWave > this.previousWave) {
      // A new wave has started, update previousWave
      this.previousWave = this.enemyManager.spawner.currentWave;
    }
    
    // Check for wave survived (enemy count returning to 0 after being > 0)
    if (this.activeEnemyCount > 10 && currentEnemyCount === 0) {
      // Player has cleared all enemies after there were at least 10
      this.playCrowdOoooh();
    }
    
    // Check for surviving large number of enemies (more than 15 enemies on screen)
    if (currentEnemyCount > 15 && this.activeEnemyCount <= 15) {
      // Player is facing a large number of enemies
      this.playCrowdAaaah();
    }
    
    // Update the active enemy count
    this.activeEnemyCount = currentEnemyCount;
  }
  
  updateCameraConstraints() {
    // Only process if we have camera config
    if (!this.cameraConfig) return;
    
    const camera = this.cameras.main;
    const config = this.cameraConfig;
    
    // Calculate maximum allowed scroll for camera
    const maxScrollX = config.offsetX;
    const maxScrollY = config.offsetY;
    
    // Adjust camera scroll if it's showing beyond the playable area
    if (camera.scrollX < -maxScrollX) {
      camera.scrollX = -maxScrollX;
    } else if (camera.scrollX > maxScrollX) {
      camera.scrollX = maxScrollX;
    }
    
    if (camera.scrollY < -maxScrollY) {
      camera.scrollY = -maxScrollY;
    } else if (camera.scrollY > maxScrollY) {
      camera.scrollY = maxScrollY;
    }
  }
  
  // Handle when a player connects their wallet
  handlePlayerAuthenticated(playerData) {
    console.log('Player authenticated in GameScene:', playerData);
    
    // Load player high score
    const highScore = this.playerAccount.getHighScore();
    this.ui.setHighScore(highScore);
    
    // Load game settings if available
    const settings = this.playerAccount.getGameSettings();
    if (settings) {
      // Apply settings (example: sound settings)
      if (settings.soundEnabled !== undefined) {
        this.sound.mute = !settings.soundEnabled;
      }
    }
  }
  
  // Handle when a player disconnects their wallet
  handlePlayerDisconnected() {
    console.log('Player disconnected in GameScene');
    
    // If wallet is required, return to menu
    if (WEB3_CONFIG.walletRequired) {
      console.log('Wallet required but disconnected, returning to menu');
      this.scene.start('MenuScene');
    }
  }
  
  // Show SURVIVE message at game start
  showSurviveMessage() {
    this.droneWheel.enabled = true;
    this.showSurviveTextMessage('💀 SURVIVE', true);
    // Enemy drones will start after 50 kills milestone dialog
  }
  
  // Milestone flags to track which kill count achievements have already been triggered
  // This is separate from AI player milestone flags since we want to show messages for every milestone
  messageShownFlags = {
    10: false,
    50: false,
    100: false,
    200: false,
    300: false,
    400: false,
    500: false,
    666: false
  };
  
  // Flags to track which dialog milestones have been shown to the player
  // This prevents showing the same dialog multiple times
  dialogShownFlags = {
    50: false,
    100: false,
    200: false,
    300: false,
    400: false,
    500: false,
    666: false
  };

  // Show kill count milestone message
  showKillCountMessage(killCount) {
    // Ensure killCount is a valid number
    if (killCount === undefined || killCount === null || isNaN(killCount)) {
      console.error("Invalid kill count passed to showKillCountMessage:", killCount);
      return;
    }
    
    // Convert to number to ensure consistent handling
    killCount = Number(killCount);
    
    // Special message for first kill
    if (killCount === 1) {
      this.showSurviveTextMessage('FIRST BLOOD!', false, killCount);
      return;
    }
    
    // Check milestone achievements with wider range checks to prevent skipping
    if (killCount >= 10 && killCount < 50 && !this.messageShownFlags[10]) {
      this.messageShownFlags[10] = true;
      this.showSurviveTextMessage('10 KILLS', false, 10);
    } else if (killCount >= 50 && killCount < 100 && !this.messageShownFlags[50]) {
      this.messageShownFlags[50] = true;
      this.showSurviveTextMessage('50 KILLS', false, 50);  
    } else if (killCount >= 100 && killCount < 200 && !this.messageShownFlags[100]) {
      this.messageShownFlags[100] = true;
      this.showSurviveTextMessage('100 KILLS', false, 100);
    } else if (killCount >= 200 && killCount < 300 && !this.messageShownFlags[200]) {
      this.messageShownFlags[200] = true;
      this.showSurviveTextMessage('200 KILLS', false, 200);
    } else if (killCount >= 300 && killCount < 400 && !this.messageShownFlags[300]) {
      this.messageShownFlags[300] = true;
      this.showSurviveTextMessage('300 KILLS', false, 300);
    } else if (killCount >= 400 && killCount < 500 && !this.messageShownFlags[400]) {
      this.messageShownFlags[400] = true;
      this.showSurviveTextMessage('400 KILLS', false, 400);
    } else if (killCount >= 500 && killCount < 666 && !this.messageShownFlags[500]) {
      this.messageShownFlags[500] = true;
      this.showSurviveTextMessage('500 KILLS', false, 500);
    } else if (killCount >= 666 && !this.messageShownFlags[666]) {
      this.messageShownFlags[666] = true;
      this.showSurviveTextMessage('666 KILLS', false, 666);
    }
    // Remove the "else" case that was showing kill count for every kill
    // This prevents the constant "undefined kills" message
  }
  
  // Common method to show survive or kill count message
  showSurviveTextMessage(messageContent, isGameStart = false, killCount = 0) {
    // Play appropriate sound based on kill count or survive sound for game start
    let soundKey = 'survive';
    
    if (!isGameStart) {
      // Choose appropriate sound key based on kill count
      if (killCount === 1) {
        soundKey = 'kills_firstblood';
      } else if (killCount === 10 || (killCount >= 10 && killCount < 20 && this.messageShownFlags[10])) {
        soundKey = 'kills_10';
      } else if (killCount === 50 || (killCount >= 50 && killCount < 60 && this.messageShownFlags[50])) {
        soundKey = 'kills_50';
      } else if (killCount === 100 || (killCount >= 100 && killCount < 110 && this.messageShownFlags[100])) {
        soundKey = 'kills_100';
      } else if (killCount === 200 || (killCount >= 200 && killCount < 210 && this.messageShownFlags[200])) {
        soundKey = 'kills_200';
      } else if (killCount === 300 || (killCount >= 300 && killCount < 310 && this.messageShownFlags[300])) {
        soundKey = 'kills_300';
      } else if (killCount === 400 || (killCount >= 400 && killCount < 410 && this.messageShownFlags[400])) {
        soundKey = 'kills_400';
      } else if (killCount === 500 || (killCount >= 500 && killCount < 510 && this.messageShownFlags[500])) {
        soundKey = 'kills_500';
      } else if (killCount === 666 || (killCount >= 666 && killCount < 676 && this.messageShownFlags[666])) {
        soundKey = 'kills_666';
      } else if (killCount > 666) {
        soundKey = 'kills_pandemonium';
      }
    }
    
    // Play the selected sound
    let sound;
    if (this.sound.get(soundKey)) {
      // Play using Phaser's sound system if available
      sound = this.sound.get(soundKey);
      sound.play({ volume: 1.0 });  // Keep annoucement sounds at full volume
    } else if (this.cachedAudioElements[soundKey]) {
      // Use our preloaded HTML Audio element
      sound = this.cachedAudioElements[soundKey];
      // Reset to beginning in case it's already been played
      sound.currentTime = 0;
      
      // Play the sound with error handling
      try {
        const playPromise = sound.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn(`Unable to play ${soundKey} sound:`, error);
          });
        }
      } catch (error) {
        console.error(`Failed to play ${soundKey} sound:`, error);
      }
    } else {
      console.warn(`${soundKey} sound not found in any cache, creating new Audio element`);
      // Last resort - create a new audio element if we don't have it cached
      try {
        let soundPath = 'survive.mp3';
        if (soundKey !== 'survive') {
          if (soundKey === 'kills_firstblood') {
            soundPath = 'firstblood.mp3';
          } else if (soundKey.includes('100')) {
            soundPath = '100kills.mp3';
          } else if (soundKey.includes('pandemonium')) {
            soundPath = 'PANDEMODIUM.mp3';
          } else {
            soundPath = soundKey.replace('kills_', '') + 'kills.mp3';
          }
        }
        // Create and cache the audio element for future use
        sound = new Audio(`/assets//sound/sfx/${soundPath}`);
        this.cachedAudioElements[soundKey] = sound; // Store for reuse
        sound.volume = 1.0;  // Full volume for announcement sounds
        sound.play();
      } catch (error) {
        console.error(`Failed to play ${soundKey} sound:`, error);
      }
    }
    
    // Always use fixed screen coordinates for UI elements, not camera-relative ones
    const camera = this.cameras.main;
    // Use fixed screen coordinates instead of camera-relative ones
    const screenCenterX = camera.width / 2;
    const screenCenterY = camera.height / 2;
    
    // Check if we're in portrait mode
    const isPortrait = this.registry.get('isPortrait') || camera.height > camera.width;
    
    // Create large text with red color and black outline
    // Calculate responsive font size based on screen width
    const screenWidth = camera.width;
    
    // Format the text content with line breaks in portrait mode
    let surviveTextContent;
    if (isGameStart) {
      surviveTextContent = isPortrait ? '💀\nSURVIVE' : '💀 SURVIVE';
    } else {
      // For other messages like "FIRST BLOOD" or "X KILLS"
      if (isPortrait) {
        if (messageContent === 'FIRST BLOOD!') {
          surviveTextContent = 'FIRST\nBLOOD!';
        } else if (messageContent.includes('KILLS')) {
          const killNumber = messageContent.split(' ')[0];
          surviveTextContent = `${killNumber}\nKILLS`;
        } else {
          // Add line break for any other two-word announcements
          surviveTextContent = messageContent.replace(' ', '\n');
        }
      } else {
        surviveTextContent = messageContent;
      }
    }
    
    // Use percentage of screen dimensions for more responsive sizing
    const targetWidthPercent = isPortrait ? 0.9 : 0.8; // Use 90% of width in portrait, 80% in landscape
    const targetWidth = screenWidth * targetWidthPercent;
    
    // Base font size as percentage of screen height
    const baseFontSizePercent = isPortrait ? 0.06 : 0.08; // 6% of screen height in portrait, 8% in landscape
    let fontSize = Math.floor(camera.height * baseFontSizePercent);
    
    // Use Metal Mania font for all announcements including SURVIVE
    const fontFamily = 'Metal Mania, Arial Black, Impact';
    
    // For portrait mode with line breaks, we need to measure and adjust
    if (isPortrait) {
      // Create a temporary text to measure
      const tempText = this.add.text(0, 0, surviveTextContent, {
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        align: 'center'
      });
      
      // If text is too wide, scale it down
      if (tempText.width > targetWidth) {
        const scaleFactor = targetWidth / tempText.width;
        fontSize = Math.floor(fontSize * scaleFactor);
      }
      
      tempText.destroy();
    } else {
      // For landscape mode, use similar approach
      const tempText = this.add.text(0, 0, surviveTextContent, {
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
      });
      
      // If text is too wide, scale it down
      if (tempText.width > targetWidth) {
        const scaleFactor = targetWidth / tempText.width;
        fontSize = Math.floor(fontSize * scaleFactor);
      }
      
      tempText.destroy();
    }
    
    // Enforce minimum and maximum font sizes for readability
    const minFontSize = Math.floor(camera.height * 0.04); // Minimum 4% of screen height
    const maxFontSize = Math.floor(camera.height * 0.12); // Maximum 12% of screen height
    fontSize = Math.max(minFontSize, Math.min(fontSize, maxFontSize));
    
    // Create text centered on the screen (not camera position)
    const surviveText = this.add.text(
      screenCenterX,
      screenCenterY,
      surviveTextContent,
      {
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        color: '#ff0000',
        stroke: '#000000',
        strokeThickness: 12,
        align: 'center', // Center align for multiline text
        shadow: {
          offsetX: 3,
          offsetY: 3,
          color: '#000000',
          blur: 5,
          fill: true
        },
        lineSpacing: isPortrait ? 10 : 0 // Add line spacing in portrait mode
      }
    );
    surviveText.setOrigin(0.5);
    surviveText.setDepth(1000); // Ensure it's above everything
    
    // Set scrollFactor to 0 to make text stay fixed on screen regardless of camera movement
    surviveText.setScrollFactor(0);
    
    // Add scale effect - faster
    this.tweens.add({
      targets: surviveText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300, // Faster scaling
      ease: 'Back.easeOut'
    });
    
    // Add subtle shake effect - faster (using screen coordinates)
    this.tweens.add({
      targets: surviveText,
      x: { from: screenCenterX - 5, to: screenCenterX + 5 },
      yoyo: true,
      repeat: 1, // Only one repetition
      duration: 80, // Faster shake
      ease: 'Sine.easeInOut',
      delay: 300 // Less delay
    });
    
    // Wait 1.25 seconds (half the time), then fade out
    this.time.delayedCall(1250, () => {
      // Fade out text
      this.tweens.add({
        targets: surviveText,
        alpha: 0,
        scale: 1.5,
        duration: 250, // Faster fade out
        ease: 'Back.easeIn',
        onComplete: () => {
          surviveText.destroy();
          // Start enemy spawning after text fades out, but only at game start and not in versus mode
          if (isGameStart && !this.versusMode) {
            this.enemyManager.startSpawning();
          }
        }
      });
    });
  }
  
  
  // Handle collisions between player and enemies for attacks
  checkPlayerEnemyCollisions() {
    const player = this.playerManager.getPlayer();
    
    // Skip collision check if player is invincible
    if (player.isInvincible) return;
    
    this.enemyManager.getEnemies().children.each(enemy => {
      if (enemy.isAttacking) return;
      
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const attackRange = player.oval.radiusX + enemy.oval.radiusX - 90;
      
      if (d <= attackRange) {
        // Start enemy attack animation
        this.enemyManager.startEnemyAttack(enemy, player, () => this.handlePlayerDamage());
      }
    }, this);
  }
  
  // Handle when a bullet hits an enemy
  handleBulletEnemyCollision(bullet, enemy) {
    // Skip if enemy is already hit or destroyed
    if (enemy.isHit) return;
    
    // Capture the old kill count before incrementing to detect crossing milestones
    const oldKillCount = this.ui.getKillCount();
    
    // Pass the hit to enemy manager which will handle hit tracking and visual effects
    this.enemyManager.hitEnemy(bullet, enemy, () => {
      // This callback is only run when the enemy is fully destroyed
      const newKillCount = this.ui.updateKillCount();
      
      // Check for kill streak
      this.updateKillStreak();
      
      // Show message at specific kill counts (except for FIRST BLOOD which is now shown with blood particles)
      if (
        // Remove killCount === 1 since we're showing FIRST BLOOD with blood particles now
        newKillCount === 10 || 
        newKillCount === 50 || 
        newKillCount === 100 || 
        newKillCount === 200 ||
        newKillCount === 300 ||
        newKillCount === 400 ||
        newKillCount === 500 ||
        newKillCount === 600 ||
        // Keep every 100 after the special milestones (but not if it matches a special one)
        (newKillCount > 100 && newKillCount % 100 === 0 && 
         newKillCount !== 200 && newKillCount !== 300 && 
         newKillCount !== 400 && newKillCount !== 500 && 
         newKillCount !== 600)
      ) {
        this.showKillCountMessage(newKillCount);
      }
      
      // Check for approaching milestone kills to stop enemies using boundary-crossing
      this.checkApproachingKillMilestones(newKillCount, oldKillCount);
      
      // Debug log for milestone detection
      if (newKillCount >= 90 && newKillCount < 100) {
        console.log(`MILESTONE DEBUG: Kill count at ${newKillCount}, approaching 100 milestone`);
      }
      
      // Check for 50-kill milestone explicitly using boundary-crossing approach
      if (oldKillCount < 50 && newKillCount >= 50 && newKillCount < 100 && !this.enemyDronesTriggered) {
        console.log(`50-KILL MILESTONE CROSSED: From ${oldKillCount} to ${newKillCount}, triggering drone milestone dialog`);
        
        // Store the fact that we've detected the 50-kill milestone crossing
        this.milestone50Crossed = true;
        
        // Also ensure the dialogShownFlags is updated
        if (this.dialogShownFlags) {
          this.dialogShownFlags[50] = true;
        }
        
        // Trigger the dialog after a short delay to let the kill message finish
        // But DO NOT set enemyDronesTriggered here - let showKillsMilestoneDialog do it
        this.time.delayedCall(1000, () => {
          this.showKillsMilestoneDialog();
        });
        
        // Return early to avoid double-processing with the loop below
        return;
      }
      
      // Show special dialog at specific milestone kills using a cleaner approach and boundary-crossing
      const dialogMilestones = [100, 200, 300, 400, 500, 666]; // 50 handled separately above
      
      // Check each milestone with boundary-crossing approach
      dialogMilestones.forEach(milestone => {
        if (oldKillCount < milestone && newKillCount >= milestone && !this.dialogShownFlags[milestone]) {
          // Mark this milestone as shown so we don't trigger it again
          this.dialogShownFlags[milestone] = true;
          
          console.log(`MILESTONE CROSSED: From ${oldKillCount} to ${newKillCount} (>= ${milestone}), showing dialog`);
          
          // Trigger the dialog after a short delay to let the kill message finish
          this.time.delayedCall(1000, () => {
            this.showKillsMilestoneDialog();
          });
        }
      });
    });
  }
  
  // Handle when the player is damaged by an enemy
  handlePlayerDamage() {
    // Get player reference
    const player = this.playerManager.getPlayer();
    
    // If player is already dying or invincible, don't process damage
    if (player.isDying || player.isInvincible) {
      console.log('Player invincible or already dying, ignoring damage');
      return;
    }
    
    // Reduce player health
    this.playerManager.health -= 1;
    console.log(`Player took damage! Health: ${this.playerManager.health}/${this.playerManager.maxHealth}`);
    
    // Update the health display
    this.playerManager.updateHealthDisplay();
    
    // Create blood splatter but don't trigger death animation
    this.enemyManager.createPlayerBloodSplatter(player);
    
    // Create violent screen shake
    this.cameras.main.shake(500, 0.03);
    
    // Create red pulse overlay effect
    this.createRedPulseEffect();
    
    // If health is depleted, player dies
    if (this.playerManager.health <= 0) {
      this.handlePlayerDeath();
    } else {
      // Play crowd "ooooh" sound ONLY when player takes non-fatal damage
      this.playCrowdOoooh();
      
      // Make player briefly invincible after taking damage
      player.isInvincible = true;
      
      // Flash player sprite to indicate damage and invincibility
      this.tweens.add({
        targets: player,
        alpha: 0.4,
        duration: 100,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          player.alpha = 1;
          // Remove invincibility after a short period
          this.time.delayedCall(500, () => {
            player.isInvincible = false;
          });
        }
      });
    }
  }
  
  
  // Create red pulse effect that fills the screen
  createRedPulseEffect() {
    const camera = this.cameras.main;
    
    // Create a red rectangle that covers the entire screen
    const redOverlay = this.add.rectangle(
      camera.width / 2, 
      camera.height / 2,
      camera.width,
      camera.height,
      0xff0000
    );
    redOverlay.setAlpha(0.35); // Start with moderate opacity
    redOverlay.setDepth(998); // Below blood splatters but above game
    redOverlay.setScrollFactor(0); // Fixed to camera
    
    // Pulse animation
    this.tweens.add({
      targets: redOverlay,
      alpha: { from: 0.35, to: 0 },
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        redOverlay.destroy();
      }
    });
  }
  
  // Handle when the player is killed
  handlePlayerDeath() {
    // Get player reference
    const player = this.playerManager.getPlayer();
    
    // If player is already dying, don't handle death again
    if (player.isDying) {
      console.log('Player already dying, ignoring duplicate death event');
      return;
    }
    
    // Setup floating text event listener if not already set
    if (!this.events.listeners('showFloatingText')) {
      this.events.on('showFloatingText', this.showFloatingText, this);
    }
    
    // Play alternating crowd cheer when player dies (but not in tutorial)
    if (this.scene.key !== 'TutorialScene') {
      this.cheerCounter = (this.cheerCounter + 1) % 3;
      const cheerType = this.cheerCounter;
      console.log(`Crowd cheering (${cheerType}) for player death!`);
      
      // Try to play using Phaser sound system first
      if (cheerType === 0 && this.crowdCheerSound) {
        this.crowdCheerSound.play({ volume: 1.0 });
      } else if (cheerType === 1 && this.crowdCheer1Sound) {
        this.crowdCheer1Sound.play({ volume: 1.0 });
      } else if (cheerType === 2 && this.crowdCheer2Sound) {
        this.crowdCheer2Sound.play({ volume: 1.0 });
      } else {
        // Fallback to HTML Audio element
        let audioKey = 'crowd_cheer';
        if (cheerType === 1) audioKey = 'crowd_cheer1';
        if (cheerType === 2) audioKey = 'crowd_cheer2';
        
        const audioElement = this.cachedAudioElements[audioKey];
        if (audioElement) {
          // Reset to beginning in case it's already been played
          audioElement.currentTime = 0;
          // Ensure full volume
          audioElement.volume = 1.0;
          
          // Play with error handling
          try {
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                console.warn(`Unable to play ${audioKey} sound on death:`, error);
              });
            }
          } catch (error) {
            console.error(`Failed to play ${audioKey} sound on death:`, error);
          }
        }
      }
    } else {
      console.log('Skipping crowd cheering for player death in tutorial');
    }
    
    // Stop drone sound if it's playing
    if (this.droneManager && this.droneManager.droneSound) {
      this.droneManager.droneSound.stop();
    }
    
    // Store original scale to avoid conflicts
    const originalPlayerScale = { x: player.scaleX, y: player.scaleY };
    
    // Create blood explosion first (behind player)
    this.enemyManager.createPlayerDeathBlood(player);
    
    // Mark player as dying with visual effects
    this.playerManager.createPlayerDeathBlood();
    
    // Make sure player scale doesn't get modified by other effects
    player.setScale(originalPlayerScale.x, originalPlayerScale.y);
    
    // Get final stats
    const finalScore = this.ui.getScore(); // Money
    const killCount = this.ui.getKillCount();
    const accuracy = this.ui.getAccuracy();
    
    // If player is authenticated, update high score in player account
    if (this.playerAccount.isPlayerAuthenticated()) {
      const isNewHighScore = this.playerAccount.updateHighScore(finalScore);
      if (isNewHighScore) {
        console.log('New high score saved to player account:', finalScore);
      }
    }
    
    // Define a helper function to avoid duplicating code
    this.goToGameOverScene = (score, kills, acc) => {
      // Only transition if we're still in GameScene
      if (this.scene.isActive('GameScene')) {
        this.scene.start('GameOverScene', { 
          score: score,
          killCount: kills,
          accuracy: acc,
          isAuthenticated: this.playerAccount.isPlayerAuthenticated(),
          highScore: this.playerAccount.getHighScore()
        });
      }
    };
    
    // Remove any previous animation listeners to prevent duplicates
    player.off('animationcomplete');
    player.off('manual-death-complete');
    
    // Get the selected character
    const selectedCharacter = this.registry.get('selectedCharacter') || 'default';
    
    // Set the animation prefix based on the selected character
    const animPrefix = selectedCharacter !== 'default' ? `${selectedCharacter}_` : '';
    
    // Listen for standard animation completion
    player.on('animationcomplete', (animation) => {
      console.log('Player animation completed:', animation.key);
      if (animation.key === `${animPrefix}player_death`) {
        console.log('Death animation completed, waiting 750ms before showing GIT GUD screen');
        this.time.delayedCall(750, () => {
          this.showGitGudScreen(finalScore, killCount, accuracy);
        });
      }
    });
    
    // Listen for manual animation completion too
    player.on('manual-death-complete', () => {
      console.log('Manual death animation completed, waiting 750ms before showing GIT GUD screen');
      this.time.delayedCall(750, () => {
        this.showGitGudScreen(finalScore, killCount, accuracy);
      });
    });
    
    // Fallback timer in case both animation methods fail
    // Increased to 2550ms (1800ms + 750ms delay) to give the animation enough time to complete
    this.time.delayedCall(2550, () => {
      // Use our helper function to avoid code duplication
      if (this.scene.isActive('GameScene')) {
        console.log('Player death animation timed out, showing GIT GUD screen');
        this.showGitGudScreen(finalScore, killCount, accuracy);
      }
    });
  }
  
  // Load dialog assets with proper error handling
  loadDialogAssets() {
    // Setup loader to react to errors
    if (!this.load.hasListenerAttached) {
      this.load.on('filecomplete', (key, type, data) => {
        console.log(`Successfully loaded dialog asset: ${key}`);
      });
      
      this.load.on('loaderror', (fileObj) => {
        console.error(`Error loading file: ${fileObj.key} (${fileObj.src})`);
      });
      
      this.load.hasListenerAttached = true;
    }
    
    // Get the selected character
    const selectedCharacter = this.registry.get('selectedCharacter') || 'default';
    
    // Handle character-specific asset loading
    if (selectedCharacter === 'character2') {
      // For Drainer, load the specific Drainer dialog assets
      this.loadDrainerDialogAssets();
    } else if (selectedCharacter === 'character3') {
      // For Toaster, load the Toaster-specific dialog assets
      this.loadToasterDialogAssets();
    } else if (selectedCharacter === 'character5') {
      // For Flex, load the character5-specific dialog assets
      this.loadFlexDialogAssets();
    } else {
      // For default character or others, use the original asset loading logic
      this.loadStandardDialogAssets(selectedCharacter);
    }
  }
  
  // New method to load dialog assets for Drainer character
  loadDrainerDialogAssets() {
    // First check if the assets already exist in the texture cache
    const requiredAssets = [
      'story/character2/intro/drainer', 
      'story/character2/intro/networkExec'
    ];
    
    const missingAssets = requiredAssets.filter(key => !this.textures.exists(key));
    
    if (missingAssets.length === 0) {
      console.log("All Drainer dialog assets already loaded and available in texture cache");
      return; // All assets are already loaded
    }
    
    console.log(`Loading missing Drainer dialog assets: ${missingAssets.join(', ')}`);
    
    // Try to load missing dialog images
    try {
      // Force reload both assets regardless of cache status to ensure they're available
      this.load.image('story/character2/intro/drainer', '/assets//story/character2/intro/drainer.png');
      this.load.image('story/character2/intro/networkExec', '/assets//story/character2/intro/networkExec.png');
      
      // Add debugging to track image loading
      this.load.on('filecomplete-image-story/character2/intro/networkExec', () => {
        console.log('NetworkExec image loaded successfully');
      });
      
      this.load.on('filecomplete-image-story/character2/intro/drainer', () => {
        console.log('Drainer image loaded successfully');
      });
      
      // Add error handlers
      this.load.on('loaderror', (fileObj) => {
        console.error(`Error loading Drainer dialog asset: ${fileObj.key} (${fileObj.src})`);
      });
      
      // Load dialog sounds for Drainer
      if (!this.sound.get('character2_dialog1')) {
        this.load.audio('character2_dialog1', '/assets//sound/story/drainer/intro/character2_dialog1.mp3');
      }
      
      if (!this.sound.get('character2_dialog3')) {
        this.load.audio('character2_dialog3', '/assets//sound/story/drainer/intro/character2_dialog3.mp3');
      }
      
      if (!this.sound.get('character2_dialog4')) {
        this.load.audio('character2_dialog4', '/assets//sound/story/drainer/intro/character2_dialog4.mp3');
      }
      
      // Start the loader
      this.load.start();
      
      // Add a additional verification step that waits for load completion
      this.load.once('complete', () => {
        console.log('Drainer assets load complete, verifying textures...');
        
        // Verify the textures were actually loaded
        if (!this.textures.exists('story/character2/intro/networkExec')) {
          console.error('NetworkExec texture still not available after loading!');
        } else {
          console.log('NetworkExec texture verified after loading');
        }
        
        if (!this.textures.exists('story/character2/intro/drainer')) {
          console.error('Drainer texture still not available after loading!');
        } else {
          console.log('Drainer texture verified after loading');
        }
      });
    } catch (e) {
      console.error("Error setting up Drainer dialog asset loading:", e);
    }
  }
  
  // Method to load dialog assets for Flex character
  loadFlexDialogAssets() {
    // First check if the assets already exist in the texture cache
    const requiredAssets = [
      'story/character5/intro/flex', 
      'story/character5/intro/grandma',
      'story/character5/intro/networkExec'
    ];
    
    const missingAssets = requiredAssets.filter(key => !this.textures.exists(key));
    
    if (missingAssets.length === 0) {
      console.log("All Flex dialog assets already loaded and available in texture cache");
      return; // All assets are already loaded
    }
    
    console.log(`Loading missing Flex dialog assets: ${missingAssets.join(', ')}`);
    
    // Try to load missing dialog images
    try {
      // Force reload assets regardless of cache status to ensure they're available
      this.load.image('story/character5/intro/flex', '/assets//story/character5/intro/flex.png');
      this.load.image('story/character5/intro/grandma', '/assets//story/character5/intro/grandma.png');
      this.load.image('story/character5/intro/networkExec', '/assets//story/character5/intro/networkExec.png');
      
      // Add debugging to track image loading
      this.load.on('filecomplete-image-story/character5/intro/flex', () => {
        console.log('Flex image loaded successfully');
      });
      
      this.load.on('filecomplete-image-story/character5/intro/grandma', () => {
        console.log('Grandma image loaded successfully');
      });
      
      this.load.on('filecomplete-image-story/character5/intro/networkExec', () => {
        console.log('NetworkExec image loaded successfully');
      });
      
      // Add error handlers
      this.load.on('loaderror', (fileObj) => {
        console.error(`Error loading Flex dialog asset: ${fileObj.key} (${fileObj.src})`);
      });
      
      // Load dialog sounds for Flex
      if (!this.sound.get('character5_dialog1')) {
        this.load.audio('character5_dialog1', '/assets//sound/story/flex/intro/character5_dialog1.mp3');
      }
      
      if (!this.sound.get('character5_dialog2')) {
        this.load.audio('character5_dialog2', '/assets//sound/story/flex/intro/character5_dialog2.mp3');
      }
      
      if (!this.sound.get('character5_dialog3')) {
        this.load.audio('character5_dialog3', '/assets//sound/story/flex/intro/character5_dialog3.mp3');
      }
      
      if (!this.sound.get('character5_dialog4')) {
        this.load.audio('character5_dialog4', '/assets//sound/story/flex/intro/character5_dialog4.mp3');
      }
      
      // Load 50 kills milestone dialog sounds for Flex
      if (!this.sound.get('flex50kills')) {
        this.load.audio('flex50kills', '/assets//sound/story/flex/50kills/flex50kills.mp3');
      }
      
      if (!this.sound.get('flex50kills1')) {
        this.load.audio('flex50kills1', '/assets//sound/story/flex/50kills/flex50kills1.mp3');
      }
      
      // Start the loader
      this.load.start();
      
      // Add a additional verification step that waits for load completion
      this.load.once('complete', () => {
        console.log('Flex assets load complete, verifying textures...');
        
        // Verify the textures were actually loaded
        if (!this.textures.exists('story/character5/intro/flex')) {
          console.error('Flex texture still not available after loading!');
        } else {
          console.log('Flex texture verified after loading');
        }
        
        if (!this.textures.exists('story/character5/intro/grandma')) {
          console.error('Grandma texture still not available after loading!');
        } else {
          console.log('Grandma texture verified after loading');
        }
        
        if (!this.textures.exists('story/character5/intro/networkExec')) {
          console.error('NetworkExec texture still not available after loading!');
        } else {
          console.log('NetworkExec texture verified after loading');
        }
      });
    } catch (e) {
      console.error("Error setting up Flex dialog asset loading:", e);
    }
  }
  
  // Method to load dialog assets for Toaster character
  loadToasterDialogAssets() {
    // First check if the assets already exist in the texture cache
    const requiredAssets = [
      'story/character3/intro/toaster', 
      'story/character3/intro/kid',
      'story/character3/intro/networkExec'
    ];
    
    const missingAssets = requiredAssets.filter(key => !this.textures.exists(key));
    
    if (missingAssets.length === 0) {
      console.log("All Toaster dialog assets already loaded and available in texture cache");
      return; // All assets are already loaded
    }
    
    console.log(`Loading missing Toaster dialog assets: ${missingAssets.join(', ')}`);
    
    // Try to load missing dialog images
    try {
      // Force reload assets regardless of cache status to ensure they're available
      this.load.image('story/character3/intro/toaster', '/assets//story/character3/intro/toaster.png');
      this.load.image('story/character3/intro/kid', '/assets//story/character3/intro/kid.png');
      this.load.image('story/character3/intro/networkExec', '/assets//story/character3/intro/networkExec.png');
      
      // Add debugging to track image loading
      this.load.on('filecomplete-image-story/character3/intro/toaster', () => {
        console.log('Toaster image loaded successfully');
      });
      
      this.load.on('filecomplete-image-story/character3/intro/kid', () => {
        console.log('Kid image loaded successfully');
      });
      
      this.load.on('filecomplete-image-story/character3/intro/networkExec', () => {
        console.log('NetworkExec image loaded successfully');
      });
      
      // Add error handlers
      this.load.on('loaderror', (fileObj) => {
        console.error(`Error loading Toaster dialog asset: ${fileObj.key} (${fileObj.src})`);
      });
      
      // Load dialog sounds for Toaster
      if (!this.sound.get('character3_dialog1')) {
        this.load.audio('character3_dialog1', '/assets//sound/story/toaster/intro/character3_dialog1.mp3');
      }
      
      if (!this.sound.get('character3_dialog2')) {
        this.load.audio('character3_dialog2', '/assets//sound/story/toaster/intro/character3_dialog2.mp3');
      }
      
      if (!this.sound.get('character3_dialog3')) {
        this.load.audio('character3_dialog3', '/assets//sound/story/toaster/intro/character3_dialog3.mp3');
      }
      
      if (!this.sound.get('character3_dialog4')) {
        this.load.audio('character3_dialog4', '/assets//sound/story/toaster/intro/character3_dialog4.mp3');
      }
      
      // Load 50 kills milestone dialog sounds for Toaster
      if (!this.sound.get('toaster50kills')) {
        this.load.audio('toaster50kills', '/assets//sound/story/toaster/50kills/toaster50kills.mp3');
      }
      
      if (!this.sound.get('toaster50kills1')) {
        this.load.audio('toaster50kills1', '/assets//sound/story/toaster/50kills/toaster50kills1.mp3');
      }
      
      // Load the Network Drone Pilot sound which is used in all character dialogs at 50 kills
      if (!this.sound.get('dronePilot_50kills')) {
        console.log('Loading the critical dronePilot_50kills sound file');
        this.load.audio('dronePilot_50kills', '/assets//sound/story/all/50kills/dronePilot.mp3');
      }
      
      // Start the loader
      this.load.start();
      
      // Add a additional verification step that waits for load completion
      this.load.once('complete', () => {
        console.log('Toaster assets load complete, verifying textures...');
        
        // Verify the textures were actually loaded
        if (!this.textures.exists('story/character3/intro/toaster')) {
          console.error('Toaster texture still not available after loading!');
        } else {
          console.log('Toaster texture verified after loading');
        }
        
        if (!this.textures.exists('story/character3/intro/kid')) {
          console.error('Kid texture still not available after loading!');
        } else {
          console.log('Kid texture verified after loading');
        }
        
        if (!this.textures.exists('story/character3/intro/networkExec')) {
          console.error('NetworkExec texture still not available after loading!');
        } else {
          console.log('NetworkExec texture verified after loading');
        }
      });
    } catch (e) {
      console.error("Error setting up Toaster dialog asset loading:", e);
    }
  }
  
  // Original method renamed to load standard character dialog assets
  loadStandardDialogAssets(selectedCharacter) {
    const characterPath = selectedCharacter === 'default' ? 'degen' : selectedCharacter;
    
    // First check if the assets already exist in the texture cache
    const requiredAssets = [
      selectedCharacter === 'default' ? 'degen' : selectedCharacter, 
      'girl', 
      'networkExec'
    ];
    const missingAssets = requiredAssets.filter(key => !this.textures.exists(key));
    
    if (missingAssets.length === 0) {
      console.log("All dialog assets already loaded and available in texture cache");
      return; // All assets are already loaded
    }
    
    console.log(`Loading missing dialog assets for ${characterPath}: ${missingAssets.join(', ')}`);
    
    // Try to load missing dialog images
    try {
      if (!this.textures.exists(selectedCharacter === 'default' ? 'degen' : selectedCharacter)) {
        this.load.image(
          selectedCharacter === 'default' ? 'degen' : selectedCharacter, 
          `/assets//story/${characterPath}/intro/${selectedCharacter === 'default' ? 'degen' : selectedCharacter}.png`
        );
      }
      
      if (!this.textures.exists('girl')) {
        this.load.image('girl', `/assets//story/${characterPath}/intro/girl.png`);
      }
      
      if (!this.textures.exists('networkExec')) {
        this.load.image('networkExec', `/assets//story/${characterPath}/intro/networkExec.png`);
      }
      
      // Start the loader only if there are assets to load
      if (missingAssets.length > 0) {
        this.load.start();
      }
    } catch (e) {
      console.error("Error setting up dialog asset loading:", e);
    }
  }
  
  // Function to start the game with enemies
  startGameForAllPlayers(isRestartFromGameOver) {
    // Show dialog and SURVIVE text for new games
    if (!isRestartFromGameOver) {
      // Get the selected character to determine required assets
      const selectedCharacter = this.registry.get('selectedCharacter') || 'default';
      
      // Define required assets based on character selection
      let requiredAssets;
      
      if (selectedCharacter === 'character2') {
        // For Drainer character, we only need the Drainer-specific assets
        requiredAssets = ['story/character2/intro/drainer', 'story/character2/intro/networkExec'];
      } else {
        // For original characters, we need the standard assets
        requiredAssets = ['girl', 'degen', 'networkExec'];
      }
      
      const missingAssets = requiredAssets.filter(key => !this.textures.exists(key));
      
      if (missingAssets.length > 0) {
        console.warn(`Missing dialog assets: ${missingAssets.join(', ')}. Trying to reload...`);
        
        // Try to reload assets
        this.loadDialogAssets();
        
        // For character2, we need to wait for the load.complete event
        if (selectedCharacter === 'character2') {
          this.load.once('complete', () => {
            console.log('Assets loaded, waiting a bit longer to ensure textures are processed...');
            
            // Give a little extra time for textures to be processed
            this.time.delayedCall(500, () => {
              console.log('Starting Drainer dialog after load complete');
              this.showIntroDialog();
            });
          });
        } else {
          // For other characters, use the original approach
          // Wait briefly then check again
          this.time.delayedCall(300, () => {
            const stillMissing = requiredAssets.filter(key => !this.textures.exists(key));
            
            if (stillMissing.length > 0) {
              console.error(`Still missing assets after reload attempt: ${stillMissing.join(', ')}`);
              // Continue anyway with warning - dialog will show but images might be missing
            }
            
            // Start dialog regardless
            this.showIntroDialog();
          });
        }
      } else {
        // All assets loaded, show dialog
        this.showIntroDialog();
      }
    } else {
      // If it's a restart, just start enemy spawning directly without showing dialog or SURVIVE message
      this.enemyManager.startSpawning();
      
      // Reset the restart flag for next time
      this.registry.set('restartFromGameOver', false);
    }
  }
  
  // Show the intro dialog sequence
  showIntroDialog() {
    // Get the selected character
    const selectedCharacter = this.registry.get('selectedCharacter') || 'default';

    // Get the dialog from DialogSystem's static methods based on character
    let introDialog;
    if (selectedCharacter === 'default') {
      introDialog = DialogSystem.getDegenIntroDialog();
    } else if (selectedCharacter === 'character3') {
      introDialog = DialogSystem.getToasterIntroDialog();
    } else if (selectedCharacter === 'character5') {
      introDialog = DialogSystem.getFlexIntroDialog();
    } else if (selectedCharacter === 'character2') {
        // For character2 (Drainer), still use inline dialog definition until it's migrated
        introDialog = [
          {
            character: "Network Exec",
            text: "Listen carefully, Drainer. We need this quick and clean—no mistakes.",
          image: "story/character2/intro/networkExec",
          sound: "character2_dialog1"
        },
        {
          character: "Drainer",
          text: "…",
          image: "story/character2/intro/drainer",
          // No sound for the silence
        },
        {
          character: "Network Exec",
          text: "Remember your place, Drainer. You're still our dog.",
          image: "story/character2/intro/networkExec",
          sound: "character2_dialog3"
        },
        {
          character: "Drainer",
          text: "I will make you pay.",
          image: "story/character2/intro/drainer",
          sound: "character2_dialog4"
        }
      ];
    } else {
      // Default to Degen dialog for unknown characters
      introDialog = DialogSystem.getDegenIntroDialog();
    }
    
    // Start the dialog system
    this.dialogSystem.start(introDialog, () => {
      // After dialog completes, show the SURVIVE message
      this.showSurviveMessage();
    });
  }
  
  // Show "GIT GUD" screen before the game over scene
  showGitGudScreen(finalScore, killCount, accuracy) {
    // Stop all crowd cheering sounds
    if (this.crowdCheerSound) {
      this.crowdCheerSound.stop();
    }
    if (this.crowdCheer1Sound) {
      this.crowdCheer1Sound.stop();
    }
    if (this.crowdCheer2Sound) {
      this.crowdCheer2Sound.stop();
    }
    if (this.crowdChantSound) {
      this.crowdChantSound.stop();
    }
    if (this.crowdOooohSound) {
      this.crowdOooohSound.stop();
    }
    if (this.crowdAaaahSound) {
      this.crowdAaaahSound.stop();
    }
    
    // Stop HTML audio elements if they exist
    Object.keys(this.cachedAudioElements).forEach(key => {
      if (key.includes('crowd')) {
        const audio = this.cachedAudioElements[key];
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    });

    // Create a black screen overlay fixed to the camera
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width, this.cameras.main.height,
      0x000000
    );
    overlay.setOrigin(0, 0);
    overlay.setDepth(1000);
    overlay.setScrollFactor(0); // Fixed to camera view
    
    // Play interference sound (same as GET HYPED screen)
    // Use the instance variable first if available (loaded in preloadMilestoneSounds)
    if (this.interferenceSound) {
      this.interferenceSound.play({ volume: 1.0 });
    } else {
      // Fall back to trying to get it from the sound cache
      let interferenceSound = this.sound.get('interference');
      let fallbackAudio = this.cachedAudioElements['interference'];
      
      if (interferenceSound) {
        interferenceSound.play({ volume: 1.0 });
      } else if (fallbackAudio) {
        console.log('Using cached interference sound');
        fallbackAudio.currentTime = 0;
        fallbackAudio.volume = 1.0;
        fallbackAudio.play().catch(error => {
          console.error('Error playing cached interference sound:', error);
        });
      } else {
        console.warn('Interference sound not found in any cache');
        
        // Last resort fallback
        try {
          fallbackAudio = new Audio('/assets//sound/sfx/interference.mp3');
          fallbackAudio.volume = 1.0;
          fallbackAudio.play();
          // Save for future use
          this.cachedAudioElements['interference'] = fallbackAudio;
        } catch (error) {
          console.error('Failed to play interference sound fallback:', error);
        }
      }
    }
    
    // Explicitly stop sound after 333ms (same as GET HYPED)
    this.time.delayedCall(333, () => {
      // Stop instance variable if used
      if (this.interferenceSound) {
        this.interferenceSound.stop();
      }
      
      // Also stop local variables if they were used
      let interferenceSound = this.sound.get('interference');
      if (interferenceSound) {
        interferenceSound.stop();
      }
      
      // Stop HTML audio element if used
      let fallbackAudio = this.cachedAudioElements['interference'];
      if (fallbackAudio) {
        fallbackAudio.pause();
        fallbackAudio.currentTime = 0;
      }
    });
    
    // Sometimes show taunt.png instead of "GIT GUD" text (30% chance)
    const showTaunt = Math.random() < 0.3;
    
    if (showTaunt && this.textures.exists('taunt')) {
      // Use taunt.png image
      const tauntImage = this.add.image(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        'taunt'
      );
      
      // Make it black and white - with multiple fallback methods if pipeline fails
      try {
        // First approach - try direct pipeline set
        const pipelineExists = this.game.renderer.pipelines && 
                              typeof this.game.renderer.pipelines.get === 'function' && 
                              this.game.renderer.pipelines.get('Grayscale');
                              
        if (pipelineExists) {
          tauntImage.setPipeline('Grayscale');
          console.log('Applied Grayscale pipeline to taunt image');
        } 
        // Second approach - try post pipeline
        else if (typeof tauntImage.setPostPipeline === 'function') {
          tauntImage.setPostPipeline('Grayscale');
          console.log('Applied Grayscale as post pipeline to taunt image');
        }
        // Third approach - manual grayscale using tint
        else {
          const gray = 0xbbbbbb; // Mid gray
          tauntImage.setTint(gray);
          console.warn('Grayscale pipeline not available, using tint fallback');
        }
      } catch (error) {
        console.error('Error applying grayscale:', error);
        
        // Fallbacks to achieve grayscale effect
        try {
          // First fallback - desaturate using tint
          tauntImage.setTint(0xbbbbbb);
        } catch (tintError) {
          console.error('Failed to apply tint:', tintError);
          // Second fallback - if all else fails, at least apply alpha
          try {
            tauntImage.alpha = 0.8;
          } catch (alphaError) {
            console.error('All grayscale fallbacks failed');
          }
        }
      }
      
      // Set proper size and origin
      tauntImage.setOrigin(0.5);
      
      // Determine if we're in portrait mode
      const isPortrait = this.cameras.main.width < this.cameras.main.height;
      
      // Scale to fit screen - use different scaling for portrait and landscape
      let scaleFactor;
      if (isPortrait) {
        // In portrait mode, use 80% of screen width to ensure good fit
        scaleFactor = (this.cameras.main.width * 0.8) / tauntImage.width;
      } else {
        // In landscape mode, use 60% of screen height
        scaleFactor = (this.cameras.main.height * 0.6) / tauntImage.height;
      }
      tauntImage.setScale(scaleFactor);
      
      tauntImage.setDepth(1001); // Ensure it's above the overlay
      tauntImage.setScrollFactor(0); // Fixed to camera
      
      // Create scanlines overlay for the taunt image
      const scanlines = this.add.graphics();
      scanlines.setDepth(1002); // Above taunt image
      scanlines.setScrollFactor(0); // Fixed to camera
      
      // Draw thick scanlines with error handling
      const drawScanlines = () => {
        try {
          // Clear previous drawings
          scanlines.clear();
          
          // Make sure the taunt image exists and has valid properties
          if (!tauntImage || !tauntImage.width || !tauntImage.scaleX) {
            console.warn('Cannot draw scanlines - taunt image invalid');
            return;
          }
          
          // Determine boundaries to contain scanlines to just the image area
          const imgWidth = tauntImage.width * tauntImage.scaleX;
          const imgHeight = tauntImage.height * tauntImage.scaleY;
          const imgX = tauntImage.x - (imgWidth / 2);
          const imgY = tauntImage.y - (imgHeight / 2);
          
          // Draw scanlines with VHS-style effect
          scanlines.lineStyle(2, 0x000000, 0.5); // Thick, dark scanlines
          
          // Draw horizontal scanlines
          for (let y = 0; y < imgHeight; y += 4) {
            scanlines.beginPath();
            scanlines.moveTo(imgX, imgY + y);
            scanlines.lineTo(imgX + imgWidth, imgY + y);
            scanlines.closePath();
            scanlines.strokePath();
          }
          
          // Occasionally add VHS tracking artifacts
          if (Math.random() > 0.7) {
            scanlines.lineStyle(8, 0xffffff, 0.1);
            const artifactY = imgY + Phaser.Math.Between(0, imgHeight);
            scanlines.beginPath();
            scanlines.moveTo(imgX, artifactY);
            scanlines.lineTo(imgX + imgWidth, artifactY);
            scanlines.closePath();
            scanlines.strokePath();
          }
        } catch (scanlineError) {
          console.error('Error drawing scanlines:', scanlineError);
        }
      };
      
      // Initial scanline draw
      drawScanlines();
      
      // Add glitch effect to the image
      this.time.addEvent({
        delay: 30,
        callback: () => {
          // Random position glitch effect (more extreme for image)
          if (Math.random() > 0.4) {
            tauntImage.x += Phaser.Math.Between(-15, 15);
            tauntImage.y += Phaser.Math.Between(-12, 12);
            
            // Reset position after brief delay
            this.time.delayedCall(20, () => {
              tauntImage.x = this.cameras.main.width / 2;
              tauntImage.y = this.cameras.main.height / 2;
            });
          }
          
          // Random scale glitch effect
          if (Math.random() > 0.7) {
            const scaleGlitch = Phaser.Math.FloatBetween(0.95, 1.05);
            tauntImage.setScale(scaleFactor * scaleGlitch);
          }
          
          // Random alpha glitch effect
          if (Math.random() > 0.8) {
            tauntImage.setAlpha(Phaser.Math.FloatBetween(0.7, 1));
          }
          
          // Removed rotation effect as requested
          
          // Update scanlines to match image position
          drawScanlines();
          
          // RGB split effect (randomly)
          if (Math.random() > 0.8) {
            try {
              // Create temporary RGB shift copies
              const redShift = this.add.image(
                tauntImage.x + Phaser.Math.Between(-5, 5),
                tauntImage.y,
                'taunt'
              );
              // Apply settings one by one to catch errors
              redShift.setScale(tauntImage.scaleX, tauntImage.scaleY);
              redShift.setAlpha(0.2);
              redShift.setTint(0xff0000);
              // Only set blend mode if available
              if (Phaser.BlendModes && Phaser.BlendModes.ADD) {
                redShift.setBlendMode(Phaser.BlendModes.ADD);
              }
              redShift.setScrollFactor(0);
              redShift.setDepth(1001);
              
              const blueShift = this.add.image(
                tauntImage.x + Phaser.Math.Between(-5, 5),
                tauntImage.y,
                'taunt'
              );
              blueShift.setScale(tauntImage.scaleX, tauntImage.scaleY);
              blueShift.setAlpha(0.2);
              blueShift.setTint(0x0000ff);
              // Only set blend mode if available
              if (Phaser.BlendModes && Phaser.BlendModes.ADD) {
                blueShift.setBlendMode(Phaser.BlendModes.ADD);
              }
              blueShift.setScrollFactor(0);
              blueShift.setDepth(1001);
              
              // Remove after brief moment
              this.time.delayedCall(50, () => {
                redShift.destroy();
                blueShift.destroy();
              });
            } catch (error) {
              console.error('Error creating RGB split effect:', error);
            }
          }
          
          // Occasionally add video noise over the image
          if (Math.random() > 0.9) {
            try {
              // Calculate image boundaries for noise effects
              const noiseImgWidth = tauntImage.width * tauntImage.scaleX;
              const noiseImgHeight = tauntImage.height * tauntImage.scaleY;
              const noiseImgX = tauntImage.x - (noiseImgWidth / 2);
              const noiseImgY = tauntImage.y - (noiseImgHeight / 2);
              
              scanlines.fillStyle(0xffffff, 0.05);
              for (let i = 0; i < 50; i++) {
                const noiseX = noiseImgX + Phaser.Math.Between(0, noiseImgWidth);
                const noiseY = noiseImgY + Phaser.Math.Between(0, noiseImgHeight);
                const noiseSize = Phaser.Math.Between(1, 3);
                scanlines.fillRect(noiseX, noiseY, noiseSize, noiseSize);
              }
            } catch (noiseError) {
              console.error('Error creating noise effect:', noiseError);
            }
          }
        },
        repeat: 10
      });
    } else {
      // Determine if we're in portrait mode
      const isPortrait = this.cameras.main.width < this.cameras.main.height;
      
      // Calculate responsive font size based on screen width/height
      const screenWidth = this.cameras.main.width;
      const screenHeight = this.cameras.main.height;
      const text = 'GIT GUD';
      
      // Use different target widths for portrait and landscape
      let targetWidth;
      if (isPortrait) {
        targetWidth = screenWidth * 0.85; // Slightly smaller in portrait
      } else {
        targetWidth = screenWidth * 0.9; // Use 90% of screen width in landscape
      }
      
      // Start with a base font size and adjust
      let fontSize = 100;
      const tempText = this.add.text(0, 0, text, {
        fontFamily: 'Arial Black',
        fontSize: `${fontSize}px`,
      });
      
      // Scale the font size to match desired width
      const scaleFactor = targetWidth / tempText.width;
      fontSize = Math.floor(fontSize * scaleFactor);
      
      // In portrait mode, cap the font size to avoid being too large
      if (isPortrait) {
        const maxFontSize = Math.floor(screenHeight * 0.15); // Max 15% of screen height
        fontSize = Math.min(fontSize, maxFontSize);
      }
      
      tempText.destroy();
      
      // Create the "GIT GUD" text with calculated size, centered on screen
      const gitGudText = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        text,
        {
          fontFamily: 'Arial Black',
          fontSize: `${fontSize}px`,
          color: '#ffffff',
          align: 'center',
        }
      );
      gitGudText.setOrigin(0.5);
      gitGudText.setDepth(1001); // Ensure it's above the overlay
      gitGudText.setScrollFactor(0); // Fixed to camera view
      
      // Add glitch effect to the text (same as GET HYPED)
      this.time.addEvent({
        delay: 50,
        callback: () => {
          // Random position glitch effect
          if (Math.random() > 0.5) {
            gitGudText.x += Phaser.Math.Between(-10, 10);
            gitGudText.y += Phaser.Math.Between(-8, 8);
            
            // Reset position after brief delay
            this.time.delayedCall(30, () => {
              gitGudText.x = this.cameras.main.width / 2;
              gitGudText.y = this.cameras.main.height / 2;
            });
          }
          
          // Black and white glitch effect
          if (Math.random() > 0.7) {
            if (Math.random() > 0.5) {
              gitGudText.setTint(0xffffff);
            } else {
              gitGudText.setTint(0x000000);
            }
            
            // Reset color after brief delay
            this.time.delayedCall(40, () => {
              gitGudText.clearTint();
            });
          }
        },
        repeat: 5
      });
    }
    
    // Transition to game over after 333 milliseconds (same as GET HYPED duration)
    this.time.delayedCall(333, () => {
      // Go to game over scene with final stats
      this.goToGameOverScene(finalScore, killCount, accuracy);
    });
  }
  
  // Show floating text above a position
  showFloatingText(config) {
    const { x, y, text, color = '#ffffff', fontSize = 24, duration = 1500 } = config;
    
    // Create text
    const floatingText = this.add.text(x, y, text, {
      fontFamily: 'Tektur',
      fontSize: `${fontSize}px`,
      color: color,
      stroke: '#000000',
      strokeThickness: 4,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 3,
        fill: true
      }
    });
    floatingText.setOrigin(0.5);
    floatingText.setDepth(1001); // Above other UI elements
    
    // Animation
    this.tweens.add({
      targets: floatingText,
      y: y - 100, // Float upward
      alpha: 0,
      scale: 1.5,
      duration: duration,
      ease: 'Power2',
      onComplete: () => {
        floatingText.destroy();
      }
    });
    
    return floatingText;
  }
  
  // Show a dialog at kills milestone
  // Check if we're approaching a major kill milestone and stop enemy spawning if needed
  checkApproachingKillMilestones(newKillCount, oldKillCount) {
    // Define the milestone values
    const milestones = [50, 100, 200, 300, 400, 500, 600];
    
    // Define buffer - only pause when within this many kills of a milestone
    const buffer = 3;
    
    // Find if we're approaching any milestone
    const targetMilestone = milestones.find(milestone => {
      return newKillCount >= (milestone - buffer) && newKillCount < milestone;
    });
    
    if (targetMilestone) {
      // Only pause spawning if there are sufficient enemies on screen
      const currentEnemyCount = this.enemyManager?.getEnemies()?.getLength() || 0;
      const minimumEnemyCount = 3; // Ensure there are enough enemies to reach the milestone
      
      console.log(`Approaching milestone kill ${targetMilestone}: kill count (${newKillCount}) with ${currentEnemyCount} enemies on screen`);
      
      // Only pause spawning if we have enough enemies to reach the milestone
      if (currentEnemyCount >= minimumEnemyCount) {
        console.log(`Stopping enemy spawning with ${currentEnemyCount} enemies active`);
        
        // Stop enemy spawning - next few enemies will lead to the milestone kill
        if (this.enemyManager) {
          // Use every method available to stop spawning
          // 1. Use setPaused method which is available on the EnemyManager
          this.enemyManager.setPaused(true);
          
          // 2. Use the force stop global function
          if (typeof this.enemyManager.forceStopSpawning === 'function') {
            console.log("Using forceStopSpawning global function");
            this.enemyManager.forceStopSpawning();
          }
          
          // 3. Direct access to timers via the spawner
          if (this.enemyManager.spawner) {
            console.log("Directly pausing spawner timers");
            if (this.enemyManager.spawner.enemySpawnTimer) {
              this.enemyManager.spawner.enemySpawnTimer.paused = true;
            }
            if (this.enemyManager.spawner.waveTimer) {
              this.enemyManager.spawner.waveTimer.paused = true;
            }
            // Set the flag directly
            this.enemyManager.spawner.spawnPaused = true;
          }
          
          // 4. Emit events
          console.log("Emitting spawning pause events");
          this.events.emit('enemySpawningPausedForMilestone');
          this.events.emit('dialogStarted');
          this.events.emit('forceStopSpawning');
        }
      } else {
        console.log(`Not pausing spawn as enemy count (${currentEnemyCount}) is below minimum threshold (${minimumEnemyCount})`);
        // Continue spawning to ensure we have enough enemies to reach the milestone
      }
    }
  }
  
  // Method to spawn an enemy AI player to fight the player after milestone dialog
  spawnEnemyAIPlayer(aiCharacterKey) {
    try {
      console.log("MILESTONE: Spawning enemy AI player");
    
    // Get player position for spawning the AI at reasonable distance
    const player = this.playerManager.getPlayer();
    if (!player) {
      console.error("Cannot spawn AI player - player object not found");
      return null;
    }
    
    const spawnDistance = 400; // Distance from player to spawn
    
    // Generate position at random angle but fixed distance from player
    const angle = Math.random() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * spawnDistance;
    const y = player.y + Math.sin(angle) * spawnDistance;
    
    console.log(`Spawning AI player at position (${x}, ${y}) relative to player (${player.x}, ${player.y})`)
    
    // Get the current player character to pick a different one for the AI
    const selectedCharacter = this.aiCharacterKey;
    
    // Choose a different character for the AI opponent - one of the other 3 characters
    //const characterOptions = ['character2', 'character3', 'character5'].filter(char => char !== selectedCharacter);
    //const aiCharacter = Phaser.Utils.Array.GetRandom(characterOptions);
    const aiCharacter = this.aiCharacterKey;

    console.log(`---------Player is ${selectedCharacter}, AI opponent will be ${aiCharacter}`);
    
    // Ensure AIPlayerManager is initialized
    if (!this.aiPlayerManager) {
      console.warn("AIPlayerManager not available, trying to initialize it...");
      this.ensureAIPlayerManager();
      
      // Since AIPlayerManager is loaded asynchronously, we need to 
      // retry the spawn after a short delay if it's not immediately available
      if (!this.aiPlayerManager) {
        console.log("AIPlayerManager initialization in progress, will retry spawn in 500ms");
        
        // Retry in 500ms
        this.time.delayedCall(500, () => {
          if (this.aiPlayerManager) {
            console.log("AIPlayerManager now available, spawning milestone AI player");
            //this.spawnEnemyAIPlayer();
          } else {
            console.error("Failed to initialize AIPlayerManager for milestone event!");
          }
        });
        return;
      }
    }
    
    // Set the AI character before creating the AI player
    this.aiPlayerManager.aiCharacter = aiCharacter;
    
    // Create the actual AI player using AIPlayerManager
    console.log(`Creating milestone AI player (${aiCharacter}) at position (${x}, ${y})`);
    this.aiPlayerManager.createAIPlayer(x, y);
    
    // Set up collision between player bullets and AI player
    this.physics.add.overlap(
      this.playerManager.bullets,
      this.aiPlayerManager.aiPlayer,
      this.playerBulletHitAI,
      null,
      this
    );
    
    // Set up collision between AI bullets and player
    this.physics.add.overlap(
      this.aiPlayerManager.bullets,
      this.playerManager.player,
      this.aiBulletHitPlayer,
      null,
      this
    );
    
    // Add floating text to identify the AI player
    this.showFloatingText({
      x: x,
      y: y - 50,
      text: `AI ${this.getCharacterDisplayName(aiCharacter)}`,
      color: '#FF0000',
      fontSize: '28px',
      duration: 5000
    });
    
    // Add debug logging
    console.log(`AI player created via AIPlayerManager`);
    console.log(`- AI Character: ${aiCharacter}`);
    console.log(`- Position: (${x}, ${y})`);
    console.log(`- Health: ${this.aiPlayerManager.aiPlayer.health}`);
    
    // Set up timer to resume enemy spawning after 30 seconds
    this.time.delayedCall(30000, () => {
      console.log("MILESTONE: Resuming enemy spawning after AI player encounter");
      
      // Check how many enemies are currently active
      const currentEnemyCount = this.enemyManager?.getEnemies()?.getLength() || 0;
      console.log(`Current enemy count before resuming spawning: ${currentEnemyCount}`);
      
      if (this.enemyManager) {
        console.log("Resuming enemy spawning through EnemyManager");
        
        // Use setPaused to properly resume spawning
        this.enemyManager.setPaused(false);
        console.log("EnemyManager.setPaused(false) called");
        
        // Try direct spawner access as backup
        if (this.enemyManager.spawner && typeof this.enemyManager.spawner.resumeSpawning === 'function') {
          console.log("Using spawner.resumeSpawning() method");
          this.enemyManager.spawner.resumeSpawning();
        }
        
        // Directly access spawner timers 
        if (this.enemyManager.spawner) {
          console.log("Directly resuming spawner timers");
          
          // Check timer states before changing
          const enemySpawnTimerState = this.enemyManager.spawner.enemySpawnTimer?.paused;
          const waveTimerState = this.enemyManager.spawner.waveTimer?.paused;
          console.log(`Timer states before resuming - enemySpawnTimer: ${enemySpawnTimerState ? 'paused' : 'active'}, waveTimer: ${waveTimerState ? 'paused' : 'active'}`);
          
          if (this.enemyManager.spawner.enemySpawnTimer) {
            this.enemyManager.spawner.enemySpawnTimer.paused = false;
            console.log("enemySpawnTimer resumed");
          } else {
            console.log("enemySpawnTimer not available");
          }
          
          if (this.enemyManager.spawner.waveTimer) {
            this.enemyManager.spawner.waveTimer.paused = false;
            console.log("waveTimer resumed");
          } else {
            console.log("waveTimer not available");
          }
          
          // Set the flag directly
          const previousSpawnPaused = this.enemyManager.spawner.spawnPaused;
          this.enemyManager.spawner.spawnPaused = false;
          console.log(`spawnPaused flag changed from ${previousSpawnPaused} to false`);
        }
        
        // Emit resumption events
        console.log("Emitting spawn resumption events");
        this.events.emit('enemySpawningResumed');
        this.events.emit('dialogEnded');
        
        // Force spawning to resume via the global function
        if (typeof this.enemyManager.forceStartSpawning === 'function') {
          console.log("Using forceStartSpawning global function");
          this.enemyManager.forceStartSpawning();
        }
        
        // As a fallback, create a new spawn timer if needed
        if (this.enemyManager.spawner && !this.enemyManager.spawner.enemySpawnTimer) {
          console.log("Creating new enemy spawn timer as fallback");
          const isPortrait = this.cameras.main.height > this.cameras.main.width;
          const spawnDelay = isPortrait ? 1500 : 1000;
          
          this.enemyManager.spawner.enemySpawnTimer = this.time.addEvent({
            delay: spawnDelay,
            callback: this.enemyManager.spawner.randomSpawn,
            callbackScope: this.enemyManager.spawner,
            loop: true
          });
          console.log(`New spawn timer created with delay: ${spawnDelay}ms`);
        }
        
        // Verify spawner state after all resume attempts
        console.log("Final spawner state check:");
        if (this.enemyManager.spawner) {
          console.log(`- spawnPaused flag: ${this.enemyManager.spawner.spawnPaused}`);
          console.log(`- enemySpawnTimer paused: ${this.enemyManager.spawner.enemySpawnTimer?.paused}`);
          console.log(`- waveTimer paused: ${this.enemyManager.spawner.waveTimer?.paused}`);
        }
      }
    });
    
      // Return the AI player instance from the manager instead of the undefined enemyAI variable
      return this.aiPlayerManager.aiPlayer;
    } catch (error) {
      console.error("Error in spawnEnemyAIPlayer:", error);
      return null;
    }
  }
  
  // Helper method to get display name for a character
  getCharacterDisplayName(characterKey) {
    const characterNames = {
      'default': 'Degen',
      'character2': 'Drainer',
      'character3': 'Toaster',
      'character5': 'Flex'
    };
    return characterNames[characterKey] || characterKey;
  }

  showKillsMilestoneDialog() {
    // Ensure Network Drone Pilot image is preloaded
    if (!this.textures.exists('story/networkDronePilot')) {
      console.log("Preloading Network Drone Pilot image");
      this.load.image('story/networkDronePilot', '/assets//story/networkDronePilot.png');
      this.load.once('complete', () => {
        console.log("Network Drone Pilot image loaded");
      });
      this.load.start();
    }
    
    // Get the selected character
    const selectedCharacter = this.registry.get('selectedCharacter') || 'default';
    console.log(`Dialog - Selected character from registry: '${selectedCharacter}'`);
    
    // Create a simple dialog between character and network exec
    let dialog = [];
    
    // Get appropriate character image path based on the selected character
    let characterImagePath;
    if (selectedCharacter === 'default') {
      characterImagePath = "story/degen/intro/degen";
    } else if (selectedCharacter === 'character2') {
      characterImagePath = "story/character2/intro/drainer";
    } else if (selectedCharacter === 'character3') {
      characterImagePath = "story/character3/intro/toaster";
      console.log("Using Toaster character image path");
    } else if (selectedCharacter === 'character5') {
      characterImagePath = "story/character5/intro/flex";
    } else {
      characterImagePath = "story/degen/intro/degen"; // Default fallback
      console.log(`Using default character image path because '${selectedCharacter}' was not recognized`);
    }
    
    // Get network exec image path
    let networkExecImagePath = "story/networkDronePilot";
    
    // Get character name for dialog
    let characterName;
    if (selectedCharacter === 'default') {
      characterName = "Degen";
    } else if (selectedCharacter === 'character2') {
      characterName = "Drainer";
    } else if (selectedCharacter === 'character3') {
      characterName = "Toaster";
      console.log("Character name set to Toaster");
    } else if (selectedCharacter === 'character4') {
      characterName = "DVD";
      console.log("Character name set to DVD");
    } else if (selectedCharacter === 'character5') {
      characterName = "Flex";
    } else if (selectedCharacter === 'character6') {
      characterName = "Vibe";
      console.log("Character name set to Vibe");
    } else if (selectedCharacter === 'character7') {
      characterName = "Omen";
      console.log("Character name set to Omen");
    } else {
      characterName = "Degen"; // Default fallback
      console.log(`Using default character name because '${selectedCharacter}' was not recognized`);
    }
    
    // Get current kill count to identify which milestone we're at
    const killCount = this.ui.getKillCount();
    console.log(`Milestone dialog triggered for killCount: ${killCount}, character: ${characterName}`);
    
    // Track if this is the 50 kills milestone (or higher if it was skipped)
    let is50KillMilestone = false;
    
    // Create appropriate dialog based on milestone
    console.log(`Dialog milestone check: killCount=${killCount}, enemyDronesTriggered=${this.enemyDronesTriggered}, milestone50Crossed=${this.milestone50Crossed}`);
    
    // If kill count is between 50-99 and we've already triggered the drone milestone,
    // just return to avoid showing the fallback dialog
    if (killCount >= 50 && killCount < 100 && this.enemyDronesTriggered) {
      console.log("Already triggered 50-kill milestone, skipping milestone dialog entirely");
      return;
    }
    
    // If we explicitly crossed the 50-kill boundary OR we're at 50+ kills and the drone milestone hasn't been triggered
    if ((this.milestone50Crossed === true) || (killCount >= 50 && killCount < 100 && !this.enemyDronesTriggered)) {
      // Mark that enemy drones have been triggered - this happens here so the condition in handleBulletEnemyCollision
      // can properly detect first crossing of the 50-kill threshold
      this.enemyDronesTriggered = true;
      // Reset the crossing flag
      this.milestone50Crossed = false;
      // For 50 kills milestone
      console.log("50-kill milestone dialog will be shown");
      is50KillMilestone = true;
      
      // Create the dialog for 50 kills, show it, then return immediately to avoid the fallback
      
      // Character-specific dialog for 50 kills milestone
      if (characterName === "Degen") {
        dialog = [
          {
            character: "Degen [Retired Legend]",
            text: "I don't want to hurt anyone. You're leaving me no choice.",
            image: characterImagePath,
            sound: "degen_50kills"
          },
          {
            character: "Network Drone Pilot",
            text: "Activating drone mine sequence. Survival unlikely.",
            image: networkExecImagePath,
            sound: "dronePilot_50kills"
          },
          {
            character: "Degen [Retired Legend]",
            text: "Typical Network welcome—explosives and cheap tricks.",
            image: characterImagePath,
            sound: "degen_50kills1"
          }
        ];
      }
      else if (characterName === "Drainer") {
        dialog = [
          {
            character: "Network Drone Pilot",
            text: "Activating drone mine sequence. Survival unlikely.",
            image: networkExecImagePath,
            sound: "dronePilot_50kills"
          },
          {
            character: "Drainer [Silent Reaper]",
            text: "…",
            image: characterImagePath
          }
        ];
      }
      else if (characterName === "Toaster") {
        console.log("Creating Toaster-specific dialog for 50-kill milestone");
        dialog = [
          {
            character: "Toaster [Rogue Appliance]",
            text: "Threat detected. Attempting to penetrate adversary system… hack failed.",
            image: characterImagePath,
            sound: "toaster50kills"
          },
          {
            character: "Network Drone Pilot",
            text: "Activating drone mine sequence. Survival unlikely.",
            image: networkExecImagePath,
            sound: "dronePilot_50kills"
          },
          {
            character: "Toaster [Rogue Appliance]",
            text: "Activating evasive maneuvers. Adjusting combat protocol.",
            image: characterImagePath,
            sound: "toaster50kills1"
          }
        ];
        console.log("Toaster dialog created:", dialog);
      }
      else if (characterName === "Flex") {
        dialog = [
          {
            character: "Flex [Neon Gladiator]",
            text: "Fifty down and still no standing ovation? Tough crowd.",
            image: characterImagePath,
            sound: "flex50kills"
          },
          {
            character: "Network Drone Pilot",
            text: "Activating drone mine sequence. Survival unlikely.",
            image: networkExecImagePath,
            sound: "dronePilot_50kills"
          },
          {
            character: "Flex [Neon Gladiator]",
            text: "Aww shucks, you Network folk are too kind. You really shouldn't have!",
            image: characterImagePath,
            sound: "flex50kills1"
          }
        ];
      } else {
        // Default dialog if character is not recognized
        dialog = [
          {
            character: "Network Drone Pilot",
            text: "Activating drone mine sequence. Survival unlikely.",
            image: networkExecImagePath,
            sound: "dronePilot_50kills"
          },
          {
            character: characterName,
            text: "50 kills already? This is just getting started.",
            image: characterImagePath
          }
        ];
      }
    } else if (killCount >= 100 && killCount < 200) {
      // For 100 kills milestone
      if (selectedCharacter === "default") {
        // Usar aiCharacterKey global directamente
        let aiCharacter = this.aiCharacterKey;
        console.log(`[MILESTONE 100] Usando AI character global: ${aiCharacter}`);
        let aiImage = `story/${aiCharacter.toLowerCase()}/intro/${aiCharacter.toLowerCase()}`;
        console.log(`[MILESTONE 100] AI para dialog:`, aiCharacter);
        // Usar aiCharacter para diálogo y para el spawn
        switch (aiCharacter) {
          case "character2":
            dialog = [
              { character: "Degen", text: "Still fighting their war, Drainer?", image: characterImagePath },
              { character: "Drainer", text: "…", image: "story/character2/intro/drainer" },
              { character: "Degen", text: "Fine. Have it your way.", image: characterImagePath }
            ];
            break;
          case "character3":
            dialog = [
              { character: "Degen", text: "Never thought I'd fight a kitchen appliance.", image: characterImagePath },
              { character: "Toaster", text: "Threat assessment: high.", image: "story/character3/intro/toaster" },
              { character: "Degen", text: "Let's toast.", image: characterImagePath }
            ];
            break;
          case "character5":
            dialog = [
              { character: "Degen", text: "You're enjoying this, aren't you?", image: characterImagePath },
              { character: "Flex", text: "No hard feelings?", image: "story/character5/intro/flex" },
              { character: "Degen", text: "None at all.", image: characterImagePath }
            ];
            break;
          case "character4":
            dialog = [
              { character: "Degen", text: "Philosopher bot—now I've seen it all.", image: characterImagePath },
              { character: "DVD", text: "My words bite deeper than blades.", image: "story/dvd"},
              { character: "Degen", text: "Let's test that theory.", image: characterImagePath }
            ];
            break;
          case "character6":
            dialog = [
              { character: "Degen", text: "Do you realize how serious this is?", image: characterImagePath },
              { character: "Vibe", text: "Chill—just dance to the beat.", image: "story/vibe" },
              { character: "Degen", text: "I'm done dancing.", image: characterImagePath }
            ];
            break;
          default:
            dialog = [
              { character: "Degen", text: "Another challenger approaches.", image: characterImagePath },
              { character: aiCharacter, text: "…", image: aiImage },
              { character: "Degen", text: "Let's get this over with.", image: characterImagePath }
            ];
        }
        // Al finalizar el diálogo, spawnea el AI correcto
        this.dialogSystem.start(dialog, () => {
          this.time.delayedCall(2000, () => {
            this.spawnEnemyAIPlayer(aiCharacter);
          });
        });
      } else {
        dialog = [
          {
            character: characterName,
            text: "100 kills? The crowd is loving this carnage!",
            image: characterImagePath
          },
          {
            character: "Network Exec",
            text: "Keep it up. The ratings are through the roof!",
            image: networkExecImagePath
          }
        ];
      }
      // } else if (killCount >= 200 && killCount < 300) {
      //   // For 200 kills milestone
      //   dialog = [
      //     {
      //       character: characterName,
      //       text: "200 down. How many more do you want?",
      //       image: characterImagePath
      //     },
      //     {
      //       character: "Network Exec",
      //       text: "As many as it takes. Don't stop now.",
      //       image: networkExecImagePath
      //     }
      //   ];
    } else if (killCount >= 300 && killCount < 400) {
      const omenImagePath = "story/omen";
      // For 300 kills milestone
      if (characterName === 'Degen') {
        dialog = [
          {
            character: 'Omen',
            text: "They say you're a legend. I see only weakness.",
            image: omenImagePath
          },
          {
            character: 'Degen',
            text: "You're just another Network puppet hiding behind a mask.",
            image: characterImagePath
          },
          {
            character: 'Omen',
            text: "Then let's see who breaks first.",
            image: omenImagePath
          }
        ];
      } else {
        dialog = [
          {
            character: characterName,
            text: "300 kills... They just keep coming.",
            image: characterImagePath          },
          {
            character: "Network Exec",
            text: "We're making history here. This will be remembered.",
            image: networkExecImagePath
          }
        ];
      }
      // Removed fallback for 50+ kills since it's now handled by the wider range check above
    } else {
      // Default dialog as fallback
      dialog = [
        {
          character: characterName,
          text: "The Arena never ends, does it?",
          image: characterImagePath
        },
        {
          character: "Network Exec",
          text: "Not until the ratings drop. And they won't.",
          image: networkExecImagePath
        }
      ];
    }
    
    // Start dialog immediately instead of using a fixed delay
    if (this.dialogSystem) {
      this.dialogSystem.start(dialog);
      
      // For 50 kills milestone, launch the enemy drone after dialog
      if (is50KillMilestone) {
        console.log(`Setting enemyDronesTriggered to true for character: ${this.registry.get('selectedCharacter')}`);
        // Mark that enemy drones have been triggered
        this.enemyDronesTriggered = true;
        
        // Schedule enemy drone to arrive after dialog
        this.time.delayedCall(5000, () => {
          if (this.droneManager) {
            console.log("Launching enemy drone after 50 kills milestone");
            
            // Send the first enemy drone - important: only send if not already delivering
            if (!this.droneManager.isDelivering) {
              // Send the first enemy drone
              this.droneManager.sendEnemyDrone();
            } else {
              console.log("Player drone is in flight, scheduling enemy drone for later");
              // Queue the enemy drone launch for after current delivery
              this.time.delayedCall(5000, () => {
                this.droneManager.sendEnemyDrone();
              });
            }
            
            // Enable periodic enemy drone spawning (every 10 seconds with 50% chance)
            this.droneManager.startEnemyDroneSpawning();
          }
        });
      }
    }
    
    // If this is the 50-kill milestone, return early to avoid the fallback dialog
    if (is50KillMilestone) {
      console.log("Returning early from 50-kill milestone dialog to avoid fallback");
      return;
    }
  }
}