import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

export class AIPlayerManager {
  constructor(scene, playerManager) {
    this.scene = scene;
    this.playerManager = playerManager;
    this.aiPlayer = null;
    this.aiPlayerMarker = null;
    this.aiPlayerShadows = [];
    this.shadowOffsets = [
      { x: 10, y: 10 },   // For reflector in top-left, shadow falls bottom-right
      { x: -10, y: 10 },  // For reflector in top-right, shadow falls bottom-left
      { x: 10, y: -10 },  // For reflector in bottom-left, shadow falls top-right
      { x: -10, y: -10 }  // For reflector in bottom-right, shadow falls top-left
    ];
    this.aiCharacter = null; // Character type to use for AI
    this.bullets = null;
    this.fireRate = 200; // Reduced from 250ms for more aggressive shooting
    this.lastShotTime = 0;
    this.lastDirection = 'down';
    this.targetPlayer = null;
    this.currentAmmo = 30; // Start with full magazine
    this.magazineSize = 30;
    this.totalMagazines = 3;
    this.isReloading = false;
    this.reloadTime = 1500; // Time to reload in ms
    this.reloadTimer = null;
    this.weaponType = 'rifle'; // Default weapon
    this.decisionCooldown = 0;
    this.currentState = 'idle';
    this.targetPosition = null;
    this.moveSpeed = 250; // Increased from 200 for more aggressive movement
    this.difficultyLevel = 'medium'; // easy, medium, hard
    this.reactionTime = 500; // Time in ms before AI reacts to player
    this.lastDecisionTime = 0;
    this.shootAccuracy = 0.7; // 0-1, higher means more accurate
    this.decisionInterval = 400; // Reduced from 500ms for more frequent decisions
    this.lastPositionChangeTime = 0;
    this.positionChangeInterval = 1500; // Reduced from 2000ms for more frequent movement changes
    this.availableCharacters = ['character2', 'character3', 'character4', 'character5', 'character6', 'character7', 'default'];
    this.startingHealth = 1; // Reduced to 1 HP
    this.shields = 5; // Starting with 5 shields
    this.maxShields = 5; // Maximum shield value
    this.shieldBar = null; // Shield bar graphic
    this.shieldBarBg = null; // Shield bar background
    
    // Debug properties
    this.debugText = null;
    this.debugMode = false; // Never enable debug mode in production
    
    // Last direction change time
    this.lastDirectionChangeTime = 0;
    this.directionChangeInterval = 2000; // 2 seconds between forced direction changes
    
    // Explicitly track mode
    this.isVersusMode = this.scene.versusMode === true;
    
    // Create this flag to track if animations have been created yet
    this.animationsCreated = false;
    
    // Teleport tracking for Omen
    this.isTeleporting = false;
    this.teleportCooldown = 5000; // 5 seconds cooldown between teleports
    this.lastTeleportTime = 0;
  }

  teleportBehindPlayer() {
    const currentTime = this.scene.time.now;
    
    // Check teleport cooldown
    if (this.isTeleporting || currentTime - this.lastTeleportTime < this.teleportCooldown) {
      return;
    }
    
    this.isTeleporting = true;
    this.lastTeleportTime = currentTime;
    
    // Visual effect before teleport
    if (this.aiPlayer) {
      this.aiPlayer.alpha = 0.5;
      console.log('Omen preparing to teleport');
    }
    
    // Get position behind player
    const playerPos = this.targetPlayer.getCenter();
    const playerDir = this.targetPlayer.body.velocity;
    const magnitude = 150;
    const teleportX = playerPos.x - (playerDir.x !== 0 ? Math.sign(playerDir.x) * magnitude : 0);
    const teleportY = playerPos.y - (playerDir.y !== 0 ? Math.sign(playerDir.y) * magnitude : 0);
    
    // Teleport after delay
    this.scene.time.delayedCall(500, () => {
      if (this.aiPlayer) {
        this.aiPlayer.x = teleportX;
        this.aiPlayer.y = teleportY;
        this.aiPlayer.alpha = 1;
        console.log('Omen teleported successfully');
      }
      this.isTeleporting = false;
    });
  }

  init() {
    this.targetPlayer = this.playerManager.player;
    this.createBulletGroup();
    
    // Update versus mode flag
    this.isVersusMode = this.scene.versusMode === true;
    console.log(`AI Player Manager initializing in ${this.isVersusMode ? 'versus' : 'story'} mode`);

    // Select random character for AI if not already set
    // Sincroniza con el personaje global de la escena si existe
    if (this.scene && this.scene.aiCharacterKey) {
      this.aiCharacter = this.scene.aiCharacterKey;
      console.log(`---------s[AIPlayerManager] Sincronizado aiCharacter desde GameScene: ${this.aiCharacter}`);
    }
    if (!this.aiCharacter) {
      console.log("AICharacter no está definido, usando valor actual:", this.aiCharacter);
      // Get player's character
      const playerChar = this.scene.registry.get('selectedCharacter') || 'default';
      
      // Remove player's character from available options
      const availableChars = this.availableCharacters.filter(char => char !== playerChar);
      
      // Pick a random character from remaining options
      this.aiCharacter = Phaser.Utils.Array.GetRandom(availableChars);
      
      // Store the selected character in the registry to ensure persistence
      this.scene.registry.set('aiCharacter', this.aiCharacter);
      console.log(`Selected AI character: ${this.aiCharacter}, stored in registry`);
    }
    
    // Ensure we always have a valid character by checking registry as backup
    if (!this.aiCharacter && this.scene.registry.get('aiCharacter')) {
      this.aiCharacter = this.scene.registry.get('aiCharacter');
      console.log(`Retrieved AI character from registry: ${this.aiCharacter}`);
    }
    
    
    
    // Initialize animation prefix
    this.animPrefix = this.aiCharacter !== 'default' ? `${this.aiCharacter}_` : '';
    
    // Try to explicitly load textures for this character before creating animations
    // This is necessary especially in story mode where character assets might not be fully loaded
    this.loadAICharacterTextures(this.aiCharacter);
    
    // Create all the necessary animations for this character - this is crucial
    this.createAICharacterAnimations(this.aiCharacter);
    
    // Important for both modes - set the flag that animations have been created
    this.animationsCreated = true;
    
    console.log(`AI character: ${this.aiCharacter}, Difficulty: ${this.difficultyLevel}, AnimPrefix: ${this.animPrefix}`);
  }
  
  // Explicitly load textures for AI character to ensure they're available
  loadAICharacterTextures(characterId) {
    const loadImage = (key, path) => {
      if (!this.scene.textures.exists(key)) {
        this.scene.load.image(key, path);
        this.scene.load.once('complete', () => {
          console.log(`AI texture loaded: ${key}`);
        });
        this.scene.load.start(); // Start the load
      }
    };
    
    console.log(`Ensuring textures are loaded for AI character: ${characterId}`);
    
    const basePath = `assets/characters/${characterId}/`;
    const prefix = characterId !== 'default' ? `${characterId}_` : '';
    
    // Determine frame count for different characters
    const hasExtraIdleFrames = characterId === 'character3';
    const idleFrameCount = hasExtraIdleFrames ? 9 : 4;
    
    // Load idle and walk frames for all directions
    const directions = ['down', 'up', 'side', 'down_corner', 'up_corner'];
    
    directions.forEach(direction => {
      // Load idle frames
      for (let i = 1; i <= idleFrameCount; i++) {
        const key = `${prefix}${direction}_idle_${i}`;
        loadImage(key, `${basePath}${direction.charAt(0).toUpperCase() + direction.slice(1).replace('_corner', ' Corner')}/Idle/${i}.png`);
      }
      
      // Load walk frames
      for (let i = 1; i <= 4; i++) {
        const key = `${prefix}${direction}_walk_${i}`;
        loadImage(key, `${basePath}${direction.charAt(0).toUpperCase() + direction.slice(1).replace('_corner', ' Corner')}/Walk/${i}.png`);
      }
    });
  }
  
  // Create character animations specifically for the AI
  createAICharacterAnimations(characterId) {
    const scene = this.scene;
    if (!scene || !scene.anims) {
      console.error('Scene not available for creating AI animations');
      return;
    }
    
    // If the animations for this character have already been created, just return
    if (this.animationsCreated) {
      console.log(`AI animations already created for ${characterId}, skipping`);
      return;
    }
    
    console.log(`Creating animations for AI character: ${characterId} (mode: ${this.isVersusMode ? 'versus' : 'story'})`);
    
    // For animation keys (like "character2_down_idle")
    const animPrefix = characterId !== 'default' ? `${characterId}_` : '';
    
    // Check if character3 which has more idle frames
    const hasExtraIdleFrames = characterId === 'character3';
    const idleFrameCount = hasExtraIdleFrames ? 9 : 4;
    const idleFrameRate = hasExtraIdleFrames ? 10 : 8;
    
    // Verify that at least some texture keys exist - this helps us understand the naming pattern
    const allTextures = Object.keys(scene.textures.list);
    const characterTextures = allTextures.filter(key => 
      key.includes(characterId) || 
      (characterId === 'default' && (key.includes('idle') || key.includes('walk'))));
      
    console.log('Checking for available character textures:',
      characterTextures.slice(0, 10)
    );
    
    // If we have very few textures, this might indicate a problem
    if (characterTextures.length < 5) {
      console.warn(`Found very few textures for character ${characterId}. Animations may not work properly.`);
    }
    
    // Determine if we're using the game's standard key format or an alternative
    // Standard: character2_down_idle_1  Alternative: character2/Down/Idle/1.png
    const standardFormatExists = allTextures.some(key => key.includes(`${animPrefix}down_idle`));
    const pathFormatExists = allTextures.some(key => key.includes(`characters/${characterId}/`));
    
    // Prefer standard format if it exists, otherwise use path format
    const keyFormat = standardFormatExists ? 'standard' : (pathFormatExists ? 'path' : 'standard');
    
    console.log(`Using ${keyFormat} key format for AI character textures (standardFormat: ${standardFormatExists}, pathFormat: ${pathFormatExists})`);
    
    // Create all the directional animations for idle and walk
    const directions = ['down', 'up', 'side', 'down_corner', 'up_corner'];
    
    // Create single-frame animations as fallbacks
    this.createFallbackAnimations(scene, characterId, animPrefix);
    
    // Create idle animations for all directions
    directions.forEach(direction => {
      const idleKey = `${animPrefix}${direction}_idle`;
      
      // Skip if this animation already exists
      if (scene.anims.exists(idleKey)) {
        console.log(`Animation ${idleKey} already exists, skipping creation`);
        return;
      }
      
      // Create array of frames
      const idleFrames = [];
      for (let i = 1; i <= idleFrameCount; i++) {
        // Try different key patterns depending on how the textures are loaded
        let frameKey;
        if (keyFormat === 'standard') {
          frameKey = `${animPrefix}${direction}_idle_${i}`;
        } else {
          // Convert direction from code format to file path format
          const dirPath = direction.replace('_corner', ' Corner');
          const dirFormatted = dirPath.charAt(0).toUpperCase() + dirPath.slice(1);
          frameKey = `characters/${characterId}/${dirFormatted}/Idle/${i}.png`;
        }
        
        if (scene.textures.exists(frameKey)) {
          idleFrames.push({ key: frameKey });
        } else {
          // If first pattern doesn't work, try the other pattern
          const altFrameKey = (keyFormat === 'standard') ? 
            `characters/${characterId}/${direction.charAt(0).toUpperCase() + direction.slice(1)}/Idle/${i}.png` :
            `${animPrefix}${direction}_idle_${i}`;
            
          if (scene.textures.exists(altFrameKey)) {
            idleFrames.push({ key: altFrameKey });
          } else {
            // Check if we can find ANY texture for this character to use as fallback
            const fallbackKey = this.findFallbackTexture(scene, characterId, direction, 'idle');
            if (fallbackKey) {
              console.log(`Using fallback texture for ${frameKey}: ${fallbackKey}`);
              idleFrames.push({ key: fallbackKey });
            } else {
              console.warn(`AI Animation frame not found: ${frameKey} or ${altFrameKey}`);
            }
          }
        }
      }
      
      if (idleFrames.length > 0) {
        scene.anims.create({
          key: idleKey,
          frames: idleFrames,
          frameRate: idleFrameRate,
          repeat: -1
        });
        console.log(`Created AI animation: ${idleKey} with ${idleFrames.length} frames`);
      }
    });
    
    // Create walk animations for all directions
    directions.forEach(direction => {
      const walkKey = `${animPrefix}${direction}_walk`;
      
      // Skip if this animation already exists
      if (scene.anims.exists(walkKey)) {
        console.log(`Animation ${walkKey} already exists, skipping creation`);
        return;
      }
      
      // Create array of frames
      const walkFrames = [];
      for (let i = 1; i <= 4; i++) {
        // Try different key patterns depending on how the textures are loaded
        let frameKey;
        if (keyFormat === 'standard') {
          frameKey = `${animPrefix}${direction}_walk_${i}`;
        } else {
          // Convert direction from code format to file path format
          const dirPath = direction.replace('_corner', ' Corner');
          const dirFormatted = dirPath.charAt(0).toUpperCase() + dirPath.slice(1);
          frameKey = `characters/${characterId}/${dirFormatted}/Walk/${i}.png`;
        }
        
        if (scene.textures.exists(frameKey)) {
          walkFrames.push({ key: frameKey });
        } else {
          // If first pattern doesn't work, try the other pattern
          const altFrameKey = (keyFormat === 'standard') ? 
            `characters/${characterId}/${direction.charAt(0).toUpperCase() + direction.slice(1)}/Walk/${i}.png` :
            `${animPrefix}${direction}_walk_${i}`;
            
          if (scene.textures.exists(altFrameKey)) {
            walkFrames.push({ key: altFrameKey });
          } else {
            // Check if we can find ANY texture for this character to use as fallback
            const fallbackKey = this.findFallbackTexture(scene, characterId, direction, 'walk');
            if (fallbackKey) {
              console.log(`Using fallback texture for ${frameKey}: ${fallbackKey}`);
              walkFrames.push({ key: fallbackKey });
            } else {
              console.warn(`AI Animation frame not found: ${frameKey} or ${altFrameKey}`);
            }
          }
        }
      }
      
      if (walkFrames.length > 0) {
        scene.anims.create({
          key: walkKey,
          frames: walkFrames,
          frameRate: 8,
          repeat: -1
        });
        console.log(`Created AI animation: ${walkKey} with ${walkFrames.length} frames`);
      }
    });
    
    // Log all available animations for debugging
    console.log('Available animations after AI setup:');
    const animKeys = Object.keys(scene.anims.anims.entries)
      .filter(key => key.includes(animPrefix))
      .slice(0, 10); // Limit to first 10 to avoid log spam
    console.log(animKeys);
    
    // Create simple single-frame animations as fallbacks for directions
    // that don't have animations yet
    this.ensureFallbackAnimations(scene, characterId, animPrefix, directions);
  }
  
  // Find a fallback texture that can be used if the exact one isn't found
  findFallbackTexture(scene, characterId, direction, animType) {
    // Try to find any texture that matches this character and direction
    const allTextures = Object.keys(scene.textures.list);
    
    // First try textures for this specific direction
    const dirTextures = allTextures.filter(key => 
      key.includes(characterId) && 
      key.includes(direction) && 
      key.includes(animType));
      
    if (dirTextures.length > 0) {
      return dirTextures[0]; // Use the first matching texture
    }
    
    // If no direction-specific textures, try any texture for this character
    const charTextures = allTextures.filter(key => 
      key.includes(characterId) && 
      key.includes(animType));
      
    if (charTextures.length > 0) {
      return charTextures[0];
    }
    
    // If still no luck, look for any down idle texture as last resort
    const fallbackTextures = allTextures.filter(key => 
      key.includes('down_idle') || 
      key.includes('Down/Idle'));
      
    if (fallbackTextures.length > 0) {
      return fallbackTextures[0];
    }
    
    return null; // No fallback found
  }
  
  // Create simple single-frame animations to ensure we have something
  createFallbackAnimations(scene, characterId, animPrefix) {
    // Find a texture to use as fallback
    const allTextures = Object.keys(scene.textures.list);
    const fallbackTextures = allTextures.filter(key => 
      key.includes(characterId) || 
      (characterId === 'default' && (key.includes('idle') || key.includes('down'))));
    
    if (fallbackTextures.length === 0) {
      console.warn('No fallback textures found for AI character');
      return;
    }
    
    const fallbackKey = fallbackTextures[0];
    
    // Create a fallback animation for each direction and type
    const fallbackAnimKey = `${animPrefix}fallback_animation`;
    if (!scene.anims.exists(fallbackAnimKey)) {
      scene.anims.create({
        key: fallbackAnimKey,
        frames: [{ key: fallbackKey }],
        frameRate: 1,
        repeat: 0
      });
      console.log(`Created fallback animation ${fallbackAnimKey} using texture ${fallbackKey}`);
    }
  }
  
  // Make sure we have animations for all directions
  ensureFallbackAnimations(scene, characterId, animPrefix, directions) {
    // For each direction and animation type, check if we have an animation
    // and create a fallback if we don't
    const animTypes = ['idle', 'walk'];
    
    directions.forEach(direction => {
      animTypes.forEach(animType => {
        const animKey = `${animPrefix}${direction}_${animType}`;
        
        if (!scene.anims.exists(animKey)) {
          // Try to create a single-frame animation
          const fallbackKey = this.findFallbackTexture(scene, characterId, direction, animType);
          if (fallbackKey) {
            scene.anims.create({
              key: animKey,
              frames: [{ key: fallbackKey }],
              frameRate: 1,
              repeat: animType === 'idle' ? -1 : 0 // idle should loop, walk can be one-shot
            });
            console.log(`Created single-frame fallback animation ${animKey} using texture ${fallbackKey}`);
          } else if (scene.anims.exists(`${animPrefix}fallback_animation`)) {
            // Clone the fallback animation
            const fallbackAnim = scene.anims.get(`${animPrefix}fallback_animation`);
            scene.anims.create({
              key: animKey,
              frames: fallbackAnim.frames,
              frameRate: fallbackAnim.frameRate,
              repeat: animType === 'idle' ? -1 : 0
            });
            console.log(`Cloned fallback animation for ${animKey}`);
          }
        }
      });
    });
  }

  createAIPlayer(x, y) {
    // Siempre sincroniza con el personaje global de la escena justo antes de crear el AI
    if (this.scene && this.scene.aiCharacterKey) {
      this.aiCharacter = this.scene.aiCharacterKey;
      console.log(`[AIPlayerManager] [createAIPlayer] Forzando aiCharacter desde GameScene: ${this.aiCharacter}`);
    } else {
      console.warn('[AIPlayerManager] [createAIPlayer] GameScene.aiCharacterKey no está definido, usando valor actual:', this.aiCharacter);
    }
    // Si sigue sin estar definido, solo entonces intenta fallback
    if (!this.aiCharacter || this.aiCharacter === '') {
      // First check if we have a character in the registry
      const registryChar = this.scene.registry.get('aiCharacter');
      const iaCharacter = this.aiCharacter;
      if (registryChar) {
        // Use the character stored in registry
        //this.aiCharacter = iaCharacter;
        console.log(`Using AI character from registry: ${this.aiCharacter}`);
      } else {
        // Get player's character
        const playerChar = this.scene.registry.get('selectedCharacter') || 'default';
        
        // Remove player's character from available options
        const availableChars = this.availableCharacters.filter(char => char !== playerChar);
        
        // Pick a random character from remaining options
        this.aiCharacter = Phaser.Utils.Array.GetRandom(availableChars);
        
        // Store the selection in registry for persistence
        this.scene.registry.set('aiCharacter', this.aiCharacter);
        console.log(`No AI character set, randomly selected: ${this.aiCharacter}`);
      }
    }
    
    const characterKey = this.aiCharacter;
    console.log(`[AIPlayerManager] [createAIPlayer] Personaje FINAL que se usará para el AI: ${characterKey}`);
    if (characterKey === 'default') {
      console.warn('[AIPlayerManager] [createAIPlayer] ADVERTENCIA: Se está usando "default" como personaje AI. Esto NO debería pasar a los 100 kills. Revisar lógica previa.');
    }
    // Update versus mode flag
    this.isVersusMode = this.scene.versusMode === true;
    console.log(`MODO VERSUS Creating AI player with character: ${characterKey} in ${this.isVersusMode ? 'versus' : 'story'} mode`);
    
    // Ensure animations are created before creating the sprite
    if (!this.animationsCreated) {
      this.loadAICharacterTextures(characterKey);
      this.createAICharacterAnimations(characterKey);
      this.animationsCreated = true;
    }
    
    // Create AI player sprite with the correct character texture key
    // Use the first frame of the character's down idle animation as the texture
    const textureKey = characterKey !== 'default' ? 
      `${characterKey}_down_idle_1` : 
      'down_idle_1';
    
    console.log(`Attempting to create AI player with texture: ${textureKey}`);
    
    // Verify that the texture exists
    if (!this.scene.textures.exists(textureKey)) {
      console.warn(`Texture ${textureKey} not found. Looking for alternatives...`);
      
      // Try to find an alternative texture - cast a wide net
      const allTextures = Object.keys(this.scene.textures.list);
      
      // First try character-specific textures
      let alternativeTextures = allTextures.filter(key => 
        key.includes(characterKey) && 
        !key.includes('enemy') &&
        (key.includes('idle') || key.includes('walk') || key.includes('Idle') || key.includes('Walk')));
      
      // If no character-specific textures, try any player character textures
      if (alternativeTextures.length === 0) {
        alternativeTextures = allTextures.filter(key => 
          (key.includes('idle') || key.includes('Idle')) &&
          (key.includes('down') || key.includes('Down')) &&
          !key.includes('enemy') &&
          !key.includes('Enemy'));
      }
      
      if (alternativeTextures.length > 0) {
        const altTexture = alternativeTextures[0];
        console.log(`Using alternative texture: ${altTexture}`);
        this.aiPlayer = this.scene.physics.add.sprite(x, y, altTexture);
        
        // Create a single-frame animation using this texture if needed
        const idleKey = `${this.animPrefix}down_idle`;
        if (!this.scene.anims.exists(idleKey)) {
          this.scene.anims.create({
            key: idleKey,
            frames: [{ key: altTexture }],
            frameRate: 1,
            repeat: -1
          });
          console.log(`Created emergency single-frame animation ${idleKey} with texture ${altTexture}`);
        }
      } else {
        // Fallback to a generic rectangle if no texture found
        console.error(`No suitable texture found for AI character ${characterKey}, using placeholder`);
        this.aiPlayer = this.scene.physics.add.sprite(x, y);
        this.aiPlayer.setTexture(); // Clear texture
        this.aiPlayer.setDisplaySize(40, 40); // Set size for visibility
        this.aiPlayer.setFillStyle(0x00ff00); // Green rectangle as placeholder
      }
    } else {
      // Create AI player sprite with the verified texture
      this.aiPlayer = this.scene.physics.add.sprite(x, y, textureKey);
    }
    
    // Set common properties
    this.aiPlayer.setCollideWorldBounds(true);
    this.aiPlayer.setSize(40, 40); // Hitbox size
    this.aiPlayer.setDepth(10);
    this.aiPlayer.setScale(0.5); // Match player scale
    
    // Initialize health properties
    this.aiPlayer.health = this.startingHealth;
    this.aiPlayer.maxHealth = this.startingHealth;
    this.aiPlayer.shields = this.shields;
    
    // Create shield bar
    this.createShieldBar();
    
    // Create shadows using the dedicated shadow texture, just like the player
    this.aiPlayerShadows = [];
    this.shadowOffsets.forEach(offset => {
      let shadow = this.scene.add.image(
        x + offset.x, 
        y + offset.y + 50, // Add the +50 Y offset just like the player shadows
        'shadow'  // Use the dedicated shadow texture
      );
      shadow.setScale(1.1);
      shadow.setAlpha(0.675 / this.shadowOffsets.length);
      shadow.setDepth(1);
      this.aiPlayerShadows.push({ sprite: shadow, offset: offset });
    });
    
    console.log("Modo versus: " + this.isVersusMode);
    // Check if we're in versus mode
    if (this.isVersusMode) {
      // Add red marker for AI player in versus mode
      this.aiPlayerMarker = this.scene.add.image(x, y + 56, 'redMark'); // Adjusted position (31 + 25 = 56)
      this.aiPlayerMarker.setDepth(8); // Set depth to 8 to be under shadows
      this.aiPlayerMarker.setScale(0.7 * 1.25 * 1.25); // Increase size by another 25%
      this.aiPlayerMarker.setAlpha(0.8);
    }

    // Update character animations prefix based on selected character
    this.animPrefix = characterKey !== 'default' ? `${characterKey}_` : '';
    
    // Log available animations for debugging
    console.log('Available animations for AI:');
    const relevantAnims = Object.keys(this.scene.anims.anims.entries)
      .filter(key => key.includes(this.animPrefix) || key.includes('down_idle') || key.includes('fallback'))
      .slice(0, 10);
    console.log(relevantAnims);
    
    // Initialize the animation system - crucial for proper animation in both modes
    this.initializeAIPlayerAnimations();
    
    this.updateAIShadows();
    
    // Add debug text if in debug mode
    if (this.debugMode) {
      this.debugText = this.scene.add.text(
        this.aiPlayer.x, this.aiPlayer.y - 50, '', { fontSize: '12px', fill: '#ffffff', backgroundColor: '#000000' }
      );
      // Check if this.aiPlayer.add is available (container functionality)
      if (this.aiPlayer.add && typeof this.aiPlayer.add === 'function') {
        this.aiPlayer.add(this.debugText);
      } else {
        // If not a container, manually position the debug text
        this.debugText.setOrigin(0.5, 1);
      }
      this.debugText.setText(`${characterKey}`);
    }
    
    console.log(`AI Player created with character: ${characterKey}, texture: ${this.aiPlayer.texture.key}, animPrefix: ${this.animPrefix}`);
    
    return this.aiPlayer;
  }
  
  // Initialize AI player animations system
  initializeAIPlayerAnimations() {
    if (!this.aiPlayer) return;
    
    // Try different animation keys in priority order
    const idleKeys = [
      `${this.animPrefix}down_idle`,
      `${this.animPrefix}idle_down`,
      `${this.animPrefix}fallback_animation`,
      'down_idle'
    ];
    
    // Try each key until one works
    let animPlayed = false;
    for (const key of idleKeys) {
      if (this.scene.anims.exists(key)) {
        console.log(`Playing AI idle animation: ${key}`);
        this.aiPlayer.play(key);
        animPlayed = true;
        break;
      }
    }
    
    // If no animation keys were found, try to find ANY idle animation
    if (!animPlayed) {
      const anyIdleAnimation = Object.keys(this.scene.anims.anims.entries)
        .find(key => key.includes('idle') || key.includes('Idle'));
              
      if (anyIdleAnimation) {
        console.log(`Playing alternative animation: ${anyIdleAnimation}`);
        this.aiPlayer.play(anyIdleAnimation);
      } else {
        console.warn('No suitable animation found for AI player');
      }
    }
    
    // Set initial direction
    this.lastDirection = 'down';
    
    // Force state change after 1 second to ensure animation starts working
    if (!this.isVersusMode) {
      this.scene.time.delayedCall(1000, () => {
        if (this.aiPlayer && this.aiPlayer.active) {
          console.log('Forcing initial state change for AI in story mode');
          this.currentState = 'approach';
          this.targetPosition = {
            x: this.aiPlayer.x + Phaser.Math.Between(-200, 200),
            y: this.aiPlayer.y + Phaser.Math.Between(-200, 200)
          };
          this.lastPositionChangeTime = this.scene.time.now;
        }
      });
    }
  }

  createBulletGroup() {
    this.bullets = this.scene.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 30,
      allowGravity: false,
      runChildUpdate: true,
      collideWorldBounds: false
    });
    
    // Add overlap with player if targetPlayer exists
    if (this.targetPlayer && this.targetPlayer.active) {
      this.scene.physics.add.overlap(
        this.bullets,
        this.targetPlayer,
        this.bulletHitPlayer,
        null,
        this
      );
    } else {
      console.warn('Target player not available when creating bullet group, deferring overlap setup');
      
      // Try again in the next frame when target player might be available
      this.scene.time.delayedCall(100, () => {
        if (this.targetPlayer && this.targetPlayer.active) {
          this.scene.physics.add.overlap(
            this.bullets,
            this.targetPlayer,
            this.bulletHitPlayer,
            null,
            this
          );
          console.log('Deferred bullet-player overlap setup complete');
        } else {
          console.error('Target player still not available after delay');
        }
      });
    }
  }

  bulletHitPlayer(bullet, player) {
    console.log('===== AI BULLET HIT PLAYER =====');
    
    // CRITICAL: Make sure the parameters are in the correct order
    // Very important safety check - never destroy the player by accident!
    if (bullet === player) {
      console.error('CRITICAL ERROR: bullet and player are the same object! Overlap callback parameters may be reversed.');
      return; // Abort to prevent destroying the player
    }
    
    // Ensure bullet is actually a bullet and not the player
    if (bullet && !bullet.hasOwnProperty('hasDealtDamage') && !bullet.hasOwnProperty('isBullet')) {
      console.error('CRITICAL ERROR: First parameter does not appear to be a bullet!');
      // Swap parameters as a last resort if they seem reversed
      const temp = bullet;
      bullet = player;
      player = temp;
      console.log('Swapped bullet and player parameters as an emergency fix');
    }
    
    // Check if bullet has already dealt damage (to prevent multiple overlaps)
    if (bullet.hasDealtDamage) {
      console.log('This bullet has already dealt damage, ignoring additional overlap');
      return;
    }
    
    // Mark this bullet as having dealt damage to prevent double damage
    bullet.hasDealtDamage = true;
    bullet.isBullet = true; // Mark explicitly as a bullet for safety checks
    
    // Immediately disable bullet physics to prevent further collisions
    if (bullet && bullet.body) {
      bullet.body.enable = false;
    }
    
    // Now destroy the bullet ONLY (never the player!)
    if (bullet && bullet.active && bullet !== player) {
      bullet.destroy();
      console.log('Bullet destroyed');
    } else {
      console.log('Bullet not active or already destroyed');
    }
    
    // Safety check for player
    if (!player) {
      console.warn('Player is null in bulletHitPlayer');
      return;
    }
    
    // Skip if player is already dying, invincible, or not active
    // CRITICAL FIX: Do not process inactive players, as they may be in death animation
    if (player.isDying || player.isInvincible || !player.active) {
      console.log('Player is dying, invincible, or not active, ignoring bullet hit');
      return;
    }
    
    console.log('Player state:', {
      active: player.active,
      isDying: player.isDying,
      isInvincible: player.isInvincible,
      hasBody: !!player.body
    });
    
    // Damage the player (use the main game's player damage function)
    try {
      console.log('Attempting to damage player with:', {
        hasPlayerManager: !!this.playerManager,
        hasPlayerManagerDamageMethod: this.playerManager && typeof this.playerManager.damagePlayer === 'function',
        hasSceneDamageMethod: this.scene && typeof this.scene.damagePlayer === 'function'
      });
      
      if (this.playerManager && typeof this.playerManager.damagePlayer === 'function') {
        console.log('Using playerManager.damagePlayer method');
        // Use a smaller damage amount (1 instead of 10) to prevent immediate death
        this.playerManager.damagePlayer(1); 
      } else if (this.scene && typeof this.scene.damagePlayer === 'function') {
        console.log('Using scene.damagePlayer method');
        this.scene.damagePlayer(1);
      } else {
        // Fallback damage handling if neither method is available
        console.log('No damagePlayer method found, applying direct invincibility and visual effect');
        
        // Only apply effects if player is still active
        if (player.active && !player.isInvincible) {
          player.isInvincible = true;
          
          // Flash effect - make sure we check player is still active on each tween update
          this.scene.tweens.add({
            targets: player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 3,
            onUpdate: () => {
              // Safety check - stop tween if player is no longer valid
              if (!player || !player.active || player.isDying) {
                return false; // Stop the tween
              }
            },
            onComplete: () => {
              // Only update if player is still active
              if (player && player.active && !player.isDying) {
                player.isInvincible = false;
                player.alpha = 1;
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error in bulletHitPlayer:', error);
    }
  }

  update(time, delta) {
    // Safety check: make sure AI player exists
    if (!this.aiPlayer) {
      console.log('AI player not defined, skipping update');
      return;
    }
    
    // If AI is marked as dead, just update shadows but skip normal AI logic
    if (this.aiPlayer.isDead) {
      console.log('AI is dead - skipping normal update');
      this.updateAIShadows(); // Still update shadows
      return;
    }
    
    // Use isDying rather than active for death state tracking
    if (this.aiPlayer.isDying) {
      console.log('AI player is dying - not performing regular updates');
      this.updateAIShadows(); // Still update shadows
      return;
    }
    
    // Update AI shadows
    this.updateAIShadows();
    
    // Update shield bar
    this.updateShieldBar();
    
    // Track if we're in versus mode
    const isVersusMode = this.scene.versusMode === true;
    
    // Safety check: make sure target player exists, but in story mode we can function without one
    if (!this.targetPlayer) {
      console.log('Target player not defined - continuing with limited functionality');
      
      // In story mode, we can still animate the AI and have it do basic behaviors
      // even without a target player
      if (!isVersusMode) {
        // Perform random movement/idle cycles even without a player target
        if (time > this.lastDecisionTime + this.decisionInterval * 1.5) {
          // Choose a random state - more likely to be idle
          const stateOptions = ['idle', 'idle', 'idle', 'evade', 'approach'];
          this.currentState = Phaser.Utils.Array.GetRandom(stateOptions);
          
          // For movement states, create a random target position
          if (this.currentState !== 'idle') {
            this.targetPosition = {
              x: this.aiPlayer.x + Phaser.Math.Between(-200, 200),
              y: this.aiPlayer.y + Phaser.Math.Between(-200, 200)
            };
          }
          
          this.lastDecisionTime = time;
        }
        
        // Execute the current behavior, which will use targetPosition for movement
        // if no targetPlayer is available
        this.executeCurrentBehavior(time, delta);
      } else {
        // In versus mode, we need a target player
        return;
      }
      
      return;
    }
    
    // If target player is dead or dying, AI could enter a "victory" state
    if (this.targetPlayer.isDead || this.targetPlayer.isDying) {
      console.log('Target player is dead or dying - AI victory state');
      this.updateAIShadows(); // Still update shadows
      
      // In story mode, we can have a victory celebration animation
      if (!isVersusMode) {
        // Random idle animations and facing directions
        if (time > this.lastDecisionTime + 500) {
          const directions = ['down', 'up', 'side', 'down_corner', 'up_corner'];
          this.lastDirection = Phaser.Utils.Array.GetRandom(directions);
          this.updateAnimation('idle');
          this.lastDecisionTime = time;
        }
      }
      
      return;
    }
    
    // Safety check: ensure shootingDirection is initialized
    if (!this.shootingDirection || (this.shootingDirection.x === 0 && this.shootingDirection.y === 0)) {
      // Initialize with a direction toward the player
      this.shootingDirection = {
        x: this.targetPlayer.x - this.aiPlayer.x,
        y: this.targetPlayer.y - this.aiPlayer.y
      };
    }
    
    // Make decisions at fixed intervals, more frequently in versus mode
    const decisionRate = isVersusMode ? this.decisionInterval : this.decisionInterval * 1.5;
    if (time > this.lastDecisionTime + decisionRate) {
      this.makeDecisions(time);
      this.lastDecisionTime = time;
    }
    
    // Execute current AI behavior
    this.executeCurrentBehavior(time, delta);
    
    // In single player mode, ensure the AI is active and dynamic
    if (!isVersusMode) {
      // If AI has been idle too long, force it to move
      if (this.currentState === 'idle' && time > this.lastPositionChangeTime + 5000) {
        console.log('AI has been idle too long in single player mode - forcing state change');
        this.currentState = Phaser.Utils.Array.GetRandom(['approach', 'strafe', 'strafe']);
        this.lastPositionChangeTime = time;
      }
      
      // Periodically change facing direction even when idle to make the AI look more alive
      if (time > this.lastDirectionChangeTime + 2000) {
        const directions = ['down', 'up', 'side', 'down_corner', 'up_corner'];
        const newDirection = Phaser.Utils.Array.GetRandom(directions);
        
        // Only log if direction actually changed
        if (newDirection !== this.lastDirection) {
          console.log(`AI direction change to ${newDirection} in single player mode`);
          this.lastDirection = newDirection;
          
          // Update animation with new direction
          const animState = this.aiPlayer.body && 
            (Math.abs(this.aiPlayer.body.velocity.x) > 5 || 
             Math.abs(this.aiPlayer.body.velocity.y) > 5) ? 'move' : 'idle';
          this.updateAnimation(animState, { direction: this.lastDirection });
        }
        
        this.lastDirectionChangeTime = time;
      }
    }
  }

  makeDecisions(time) {
    // Safety check: make sure both AI and player exist
    if (!this.aiPlayer || !this.aiPlayer.active) {
      return;
    }
    
    // Check if we have a valid player target
    const hasValidTarget = this.targetPlayer && this.targetPlayer.active;
    
    // Update versus mode flag
    this.isVersusMode = this.scene.versusMode === true;
    
    // In single player mode without target, use a random position target
    if (!hasValidTarget && !this.isVersusMode) {
      // If we don't have a target position yet, create one
      if (!this.targetPosition) {
        this.targetPosition = {
          x: Phaser.Math.Between(100, GAME_WIDTH - 100),
          y: Phaser.Math.Between(100, GAME_HEIGHT - 100)
        };
        console.log(`Created new AI target position: (${this.targetPosition.x}, ${this.targetPosition.y})`);
      }
      
      // Calculate distance to target position
      const distToTarget = Phaser.Math.Distance.Between(
        this.aiPlayer.x, this.aiPlayer.y,
        this.targetPosition.x, this.targetPosition.y
      );
      
      // Update shooting direction
      this.shootingDirection = {
        x: this.targetPosition.x - this.aiPlayer.x,
        y: this.targetPosition.y - this.aiPlayer.y
      };
      
      // Make decisions based on single player mode
      if (time > this.lastPositionChangeTime + (this.positionChangeInterval * 0.5)) {  // More frequent decisions
        // More aggressive AI behavior - prioritize approach and shooting
        
        // Higher chance for aggressive actions (95%)
        if (Math.random() < 0.95) {
          // More aggressive movement behaviors with strong preference for approach
          // Aggressive AIs approach more, evade less
          const moveStates = [
            'approach', 'approach', 'approach', 'approach', // 4x approach (most common)
            'strafe', 'strafe',                             // 2x strafe (medium)
            'shoot', 'shoot',                               // 2x shooting (medium)
            'evade'                                         // 1x evade (rare)
          ];
          this.currentState = Phaser.Utils.Array.GetRandom(moveStates);
          
          // Approach the player more often when far away
          if (distToTarget > 300 && Math.random() < 0.7) {
            this.currentState = 'approach';
          }
          
          // Shoot more often when at medium distance
          if (distToTarget < 300 && distToTarget > 100 && Math.random() < 0.5) {
            this.currentState = 'shoot';
          }
          
          // Sometimes pick a new target, but less frequently (more pursuit)
          if (Math.random() < 0.15 || distToTarget < 40) {
            this.targetPosition = {
              x: Phaser.Math.Between(100, GAME_WIDTH - 100),
              y: Phaser.Math.Between(100, GAME_HEIGHT - 100)
            };
            console.log(`AI reached target, created new position: (${this.targetPosition.x}, ${this.targetPosition.y})`);
          }
        } else {
          // Rare idle state (5% chance) - even aggressive AIs need brief pauses
          this.currentState = Math.random() < 0.3 ? 'idle' : 'shoot'; // Prefer shooting over idle
        }
        
        // Log the decision
        console.log(`AI single player decision: ${this.currentState}, target: (${this.targetPosition.x}, ${this.targetPosition.y})`);
        this.lastPositionChangeTime = time;
      }
      
      return; // Skip the versus mode decision making
    }
    
    // Versus mode decision making (requires valid target player)
    if (!hasValidTarget) return;
    
    // Calculate distance to player
    const distToPlayer = Phaser.Math.Distance.Between(
      this.aiPlayer.x, this.aiPlayer.y,
      this.targetPlayer.x, this.targetPlayer.y
    );
    
    // Update shooting direction to aim at player
    this.shootingDirection = {
      x: this.targetPlayer.x - this.aiPlayer.x,
      y: this.targetPlayer.y - this.aiPlayer.y
    };
    
    // Make movement decisions
    if (time > this.lastPositionChangeTime + this.positionChangeInterval) {
      // Decide whether to move to a new position
      if (Math.random() < 0.7) { // 70% chance to change position
        if (distToPlayer < 200) {
          // Too close, move away
          this.currentState = 'evade';
        } else if (distToPlayer > 500) {
          // Too far, get closer
          this.currentState = 'approach';
        } else {
          // Good range, strafe
          this.currentState = 'strafe';
        }
      } else {
        // Stay still and shoot
        this.currentState = 'shoot';
      }
      
      this.lastPositionChangeTime = time;
    }
    
    // Always try to shoot when player is visible and in range
    if (distToPlayer < 600) {
      this.tryToShoot(time);
    }
    
    // In single player mode, shoot more aggressively when in "shoot" state
    if (!this.isVersusMode && this.currentState === 'shoot') {
      // Try shooting regardless of the distToPlayer check
      this.tryToShoot(time);
    }
    
    // Reload if low ammo and not currently shooting
    if (this.currentAmmo <= 5 && !this.isReloading && this.currentState !== 'shoot') {
      this.reload();
    }
  }

  executeCurrentBehavior(time, delta) {
    // Safety check: make sure AI player exists
    if (!this.aiPlayer || !this.aiPlayer.active) {
      return;
    }
    
    // Update versus mode flag
    this.isVersusMode = this.scene.versusMode === true;
    
    // Get current velocity for animation purposes
    const currentVelocity = {
      x: this.aiPlayer.body ? this.aiPlayer.body.velocity.x : 0,
      y: this.aiPlayer.body ? this.aiPlayer.body.velocity.y : 0
    };
    
    // Debug mode is disabled for production
    
    // If in story mode and idle, ensure periodic movement happens
    // This is CRITICAL for getting animations working properly
    if (!this.isVersusMode && this.currentState === 'idle' && time > this.lastPositionChangeTime + 2000) {
      // Add random movement in story mode to make AI look alive
      this.currentState = Phaser.Utils.Array.GetRandom(['approach', 'evade', 'strafe', 'strafe', 'approach']);
      
      if (!this.targetPosition || Math.random() < 0.7) {
        // Choose a new random target position
        this.targetPosition = {
          x: this.aiPlayer.x + Phaser.Math.Between(-300, 300),
          y: this.aiPlayer.y + Phaser.Math.Between(-300, 300)
        };
      }
      
      this.lastPositionChangeTime = time;
      console.log(`AI state changed to ${this.currentState} with target position ${this.targetPosition.x},${this.targetPosition.y}`);
    }
    
    // If the AI has been in a movement state too long, change it
    if (!this.isVersusMode && 
        (this.currentState === 'approach' || this.currentState === 'evade' || this.currentState === 'strafe') && 
        time > this.lastPositionChangeTime + 5000) {
      if (Math.random() < 0.5) {
        // Switch to idle periodically
        this.currentState = 'idle';
        console.log('AI switching to idle state after extended movement');
      } else {
        // Or change movement pattern
        const newState = Phaser.Utils.Array.GetRandom(['approach', 'evade', 'strafe']);
        if (newState !== this.currentState) {
          this.currentState = newState;
          console.log(`AI changing movement pattern to ${this.currentState}`);
        }
        
        // Get a new target position
        this.targetPosition = {
          x: this.aiPlayer.x + Phaser.Math.Between(-300, 300),
          y: this.aiPlayer.y + Phaser.Math.Between(-300, 300)
        };
      }
      this.lastPositionChangeTime = time;
    }
    
    // In story mode, periodically change facing direction even when idle
    if (!this.isVersusMode && 
        time > this.lastDirectionChangeTime + this.directionChangeInterval && 
        this.currentState === 'idle' && 
        Math.random() < 0.7) {
      // Choose a random direction to face
      const directions = ['down', 'up', 'side', 'down_corner', 'up_corner'];
      const newDirection = Phaser.Utils.Array.GetRandom(directions);
      if (newDirection !== this.lastDirection) {
        this.lastDirection = newDirection;
        console.log(`AI idle direction change to ${this.lastDirection}`);
        // Force animation update
        this.updateAnimation('idle', { direction: this.lastDirection });
      }
      this.lastDirectionChangeTime = time;
    }
    
    // Execute behavior based on current state
    switch (this.currentState) {
      case 'idle':
        // Just stand still
        this.aiPlayer.setVelocity(0, 0);
        this.updateAnimation('idle', { direction: this.lastDirection });
        break;
        
      case 'approach':
        // Move toward player or target position
        if (this.targetPlayer && this.targetPlayer.active) {
          this.moveTowardPlayer(delta);
        } else if (this.targetPosition) {
          // In story mode, move toward the random target position
          this.moveTowardPlayer(delta); // This method now handles targetPosition too
        } else {
          // Fall back to idle if no target
          this.currentState = 'idle';
          this.aiPlayer.setVelocity(0, 0);
          this.updateAnimation('idle');
        }
        break;
        
      case 'evade':
        // Move away from player or position
        if (this.targetPlayer && this.targetPlayer.active) {
          this.moveAwayFromPlayer(delta);
        } else if (this.targetPosition) {
          // In story mode, move away from the random target position
          this.moveAwayFromPlayer(delta); // This method now handles targetPosition too
        } else {
          // Fall back to idle if no target
          this.currentState = 'idle';
          this.aiPlayer.setVelocity(0, 0);
          this.updateAnimation('idle');
        }
        break;
        
      case 'strafe':
        // Strafe around player or position
        if (this.targetPlayer && this.targetPlayer.active) {
          this.strafeAroundPlayer(delta);
        } else if (this.targetPosition) {
          // In story mode, strafe around the random target position
          this.strafeAroundPlayer(delta); // This method now handles targetPosition too
        } else {
          // Fall back to idle if no target
          this.currentState = 'idle';
          this.aiPlayer.setVelocity(0, 0);
          this.updateAnimation('idle');
        }
        break;
        
      case 'shoot':
        // Stop moving and focus on shooting
        this.aiPlayer.setVelocity(0, 0);
        if (this.targetPlayer && this.targetPlayer.active) {
          this.aimAtPlayer();
        } else if (this.targetPosition) {
          // In story mode, aim at the random target position
          const direction = this.determineDirection(
            this.targetPosition.x - this.aiPlayer.x,
            this.targetPosition.y - this.aiPlayer.y
          );
          this.updateAnimation('idle', { direction });
        } else {
          this.updateAnimation('idle');
        }
        break;
        
      default:
        // Default to idle if no valid state
        this.currentState = 'idle';
        this.aiPlayer.setVelocity(0, 0);
        this.updateAnimation('idle');
        break;
    }
    
    // Update debug text if it exists
    if (this.debugText) {
      // Update position to stay above the AI player's head
      this.debugText.x = this.aiPlayer.x;
      this.debugText.y = this.aiPlayer.y - 50;
      
      // Update text content
      const vx = currentVelocity.x.toFixed(0);
      const vy = currentVelocity.y.toFixed(0);
      const dir = this.lastDirection || 'none';
      const state = this.currentState || 'none';
      
      // Keep debug text short and readable
      this.debugText.setText(`v:${vx},${vy}\ndir:${dir}\nstate:${state}`);
    }
  }

  moveTowardPlayer(delta) {
    // Safety checks for AI player
    if (!this.aiPlayer || !this.aiPlayer.active) {
      return;
    }
    
    // Get target position - either player or random position 
    // (for story mode when player might not be available)
    let targetX, targetY;
    
    if (this.targetPlayer && this.targetPlayer.active) {
      // Move toward the player if available
      targetX = this.targetPlayer.x;
      targetY = this.targetPlayer.y;
    } else if (this.targetPosition) {
      // Move toward a random position if player not available
      targetX = this.targetPosition.x;
      targetY = this.targetPosition.y;
    } else {
      // Generate a random position if no target exists
      targetX = this.aiPlayer.x + Phaser.Math.Between(-200, 200);
      targetY = this.aiPlayer.y + Phaser.Math.Between(-200, 200);
      
      // Store this position for future use
      this.targetPosition = { x: targetX, y: targetY };
    }
    
    // Calculate angle to target
    const angle = Phaser.Math.Angle.Between(
      this.aiPlayer.x, this.aiPlayer.y,
      targetX, targetY
    );
    
    // Add some randomness to avoid moving in a straight line
    const randomAngle = angle + Phaser.Math.FloatBetween(-0.2, 0.2);
    
    // Calculate velocity based on angle
    const velocityX = Math.cos(randomAngle) * this.moveSpeed;
    const velocityY = Math.sin(randomAngle) * this.moveSpeed;
    
    // Apply velocity
    this.aiPlayer.setVelocity(velocityX, velocityY);
    
    // Check if we've reached the target position and switch to idle if so
    if (this.targetPosition && !this.targetPlayer) {
      const distToTarget = Phaser.Math.Distance.Between(
        this.aiPlayer.x, this.aiPlayer.y,
        this.targetPosition.x, this.targetPosition.y
      );
      
      // If we reached the random target position, go back to idle
      if (distToTarget < 50) {
        this.currentState = 'idle';
        this.targetPosition = null;
        this.aiPlayer.setVelocity(0, 0);
        this.updateAnimation('idle');
        return;
      }
    }
    
    // Update animation with proper direction based on movement
    // This will automatically determine the correct animation to play
    // based on the velocity and apply the proper directional animation
    this.updateAnimation('move', { x: velocityX, y: velocityY });
    
    // If we're moving horizontally, make sure flip is set correctly
    if (Math.abs(velocityX) > Math.abs(velocityY) * 0.5) {
      this.aiPlayer.setFlipX(velocityX < 0);
    }
  }

  moveAwayFromPlayer(delta) {
    // Safety checks for AI player
    if (!this.aiPlayer || !this.aiPlayer.active) {
      return;
    }
    
    // Get flee source - either player or random position 
    let sourceX, sourceY;
    
    if (this.targetPlayer && this.targetPlayer.active) {
      // Move away from the player if available
      sourceX = this.targetPlayer.x;
      sourceY = this.targetPlayer.y;
    } else if (this.targetPosition) {
      // Move away from a specified position if player not available
      sourceX = this.targetPosition.x;
      sourceY = this.targetPosition.y;
    } else {
      // Generate a position to flee from if no source exists
      sourceX = this.aiPlayer.x + Phaser.Math.Between(-100, 100);
      sourceY = this.aiPlayer.y + Phaser.Math.Between(-100, 100);
      
      // Store this position for future reference
      this.targetPosition = { x: sourceX, y: sourceY };
    }
    
    // Calculate angle from AI to source (what we're fleeing from)
    const angle = Phaser.Math.Angle.Between(
      this.aiPlayer.x, this.aiPlayer.y,
      sourceX, sourceY
    );
    
    // Move in the opposite direction
    const escapeAngle = angle + Math.PI;
    
    // Add some randomness to make movement more natural
    const randomizedAngle = escapeAngle + Phaser.Math.FloatBetween(-0.3, 0.3);
    
    // Calculate velocity based on angle
    const velocityX = Math.cos(randomizedAngle) * this.moveSpeed;
    const velocityY = Math.sin(randomizedAngle) * this.moveSpeed;
    
    this.aiPlayer.setVelocity(velocityX, velocityY);
    
    // Check if we've moved far enough away and can stop
    if (this.targetPosition && !this.targetPlayer) {
      const distFromSource = Phaser.Math.Distance.Between(
        this.aiPlayer.x, this.aiPlayer.y,
        this.targetPosition.x, this.targetPosition.y
      );
      
      // If we're far enough away, go back to idle
      if (distFromSource > 300) {
        this.currentState = 'idle';
        this.targetPosition = null;
        this.aiPlayer.setVelocity(0, 0);
        this.updateAnimation('idle');
        return;
      }
    }
    
    // Update animation with proper direction based on movement vector
    this.updateAnimation('move', { x: velocityX, y: velocityY });
    
    // If we're moving horizontally, make sure flip is set correctly
    if (Math.abs(velocityX) > Math.abs(velocityY) * 0.5) {
      this.aiPlayer.setFlipX(velocityX < 0);
    }
  }

  strafeAroundPlayer(delta) {
    // Safety checks for AI player
    if (!this.aiPlayer || !this.aiPlayer.active) {
      return;
    }
    
    // Get strafe center point - either player or random position
    let centerX, centerY;
    let targetToFace = null;
    
    if (this.targetPlayer && this.targetPlayer.active) {
      // Strafe around the player if available
      centerX = this.targetPlayer.x;
      centerY = this.targetPlayer.y;
      targetToFace = this.targetPlayer;
    } else if (this.targetPosition) {
      // Strafe around a specified position if player not available
      centerX = this.targetPosition.x;
      centerY = this.targetPosition.y;
    } else {
      // Generate a center point to strafe around if no target exists
      centerX = this.aiPlayer.x + Phaser.Math.Between(-100, 100);
      centerY = this.aiPlayer.y + Phaser.Math.Between(-100, 100);
      
      // Store this position for future reference
      this.targetPosition = { x: centerX, y: centerY };
    }
    
    // Calculate angle from AI to center
    const angle = Phaser.Math.Angle.Between(
      this.aiPlayer.x, this.aiPlayer.y,
      centerX, centerY
    );
    
    // Strafe perpendicular to center direction (90 degrees)
    // Use consistent strafe direction to prevent sudden changes
    if (this.strafeDirection === undefined) {
      this.strafeDirection = Math.random() < 0.5 ? 1 : -1;
    }
    
    const strafeAngle = angle + (Math.PI / 2 * this.strafeDirection);
    
    // Calculate velocity based on angle
    const velocityX = Math.cos(strafeAngle) * this.moveSpeed;
    const velocityY = Math.sin(strafeAngle) * this.moveSpeed;
    
    this.aiPlayer.setVelocity(velocityX, velocityY);
    
    // Update animation with proper direction based on movement vector
    // For strafing, we should primarily face toward the target
    const angleToTarget = Math.atan2(
      centerY - this.aiPlayer.y,
      centerX - this.aiPlayer.x
    );
    
    // Determine which direction to face when strafing
    const facingDirection = this.determineStrafeFacingDirection(angleToTarget, velocityX, velocityY);
    
    // Update animation with the facing direction
    this.updateAnimation('move', { 
      x: velocityX, 
      y: velocityY,
      direction: facingDirection 
    });
    
    // Set proper flipping for side-facing animations
    if (facingDirection === 'side' || facingDirection.includes('corner')) {
      if (targetToFace) {
        // If we have a target, flip based on target position
        const targetIsToTheRight = targetToFace.x > this.aiPlayer.x;
        this.aiPlayer.setFlipX(!targetIsToTheRight);
      } else {
        // Otherwise, flip based on movement direction
        this.aiPlayer.setFlipX(velocityX < 0);
      }
    }
    
    // Check if we've strafed long enough and should change state
    if (this.targetPosition && !this.targetPlayer && Math.random() < 0.02) {
      this.currentState = 'idle';
      this.strafeDirection = undefined; // Reset strafe direction for next time
      this.aiPlayer.setVelocity(0, 0);
      this.updateAnimation('idle');
    }
  }
  
  // Helper method to determine facing direction during strafing
  determineStrafeFacingDirection(angleToPlayer, vx, vy) {
    // Convert angle to degrees for easier angle comparisons
    const angleDegrees = ((angleToPlayer * 180 / Math.PI) + 360) % 360;
    
    // 8-way direction mapping based on angle to player
    if (angleDegrees >= 22.5 && angleDegrees < 67.5) {
      return 'down_corner'; // Bottom-right
    } else if (angleDegrees >= 67.5 && angleDegrees < 112.5) {
      return 'down'; // Down
    } else if (angleDegrees >= 112.5 && angleDegrees < 157.5) {
      return 'down_corner'; // Bottom-left
    } else if (angleDegrees >= 157.5 && angleDegrees < 202.5) {
      return 'side'; // Left
    } else if (angleDegrees >= 202.5 && angleDegrees < 247.5) {
      return 'up_corner'; // Top-left
    } else if (angleDegrees >= 247.5 && angleDegrees < 292.5) {
      return 'up'; // Up
    } else if (angleDegrees >= 292.5 && angleDegrees < 337.5) {
      return 'up_corner'; // Top-right
    } else {
      return 'side'; // Right
    }
  }

  aimAtPlayer() {
    // Safety checks
    if (!this.aiPlayer || !this.aiPlayer.active || !this.targetPlayer || !this.targetPlayer.active) {
      return;
    }
    
    // Calculate angle to player
    const dx = this.targetPlayer.x - this.aiPlayer.x;
    const dy = this.targetPlayer.y - this.aiPlayer.y;
    
    // Update shooting direction based on player position
    this.shootingDirection = { x: dx, y: dy };
    
    // Determine animation based on direction
    const angle = Math.atan2(dy, dx);
    const degrees = (angle * 180 / Math.PI + 360) % 360;
    
    // Use the same directional logic as the strafing facing direction
    const facingDirection = this.determineStrafeFacingDirection(angle, dx, dy);
    
    // Update the animation with the facing direction
    this.updateAnimation('idle', { direction: facingDirection });
    
    // Set proper flipping for side-facing animations
    if (facingDirection === 'side') {
      // If facing sideways, flip based on target position
      this.aiPlayer.setFlipX(dx < 0);
    } else if (facingDirection === 'down_corner') {
      // For corners, flip based on which side the target is on
      this.aiPlayer.setFlipX(dx < 0);
    } else if (facingDirection === 'up_corner') {
      // For corners, flip based on which side the target is on
      this.aiPlayer.setFlipX(dx < 0);
    }
    
  }

  updateAnimation(state, options = {}) {
    // Safety check
    if (!this.aiPlayer || !this.aiPlayer.active) {
      return;
    }
    
    // Track if we're in versus mode
    this.isVersusMode = this.scene.versusMode === true;
    
    // Get current velocity for animation if not provided
    let vx = options.x;
    let vy = options.y;
    
    // If velocities weren't provided in options but we have the AI player body,
    // get them from the body's velocity - CRITICAL for story mode
    if ((vx === undefined || vy === undefined) && this.aiPlayer.body) {
      vx = this.aiPlayer.body.velocity.x;
      vy = this.aiPlayer.body.velocity.y;
      
    }
    
    // Determine if the AI is moving
    const isMoving = (vx !== 0 || vy !== 0) && 
                     (Math.abs(vx) > 5 || Math.abs(vy) > 5); // Use a small threshold to avoid jitter
    
    // Override the animation state based on actual movement
    // This is CRITICAL to ensure walk animations play when moving
    if (isMoving && state === 'idle') {
      state = 'move';
    } else if (!isMoving && state === 'move') {
      state = 'idle';
    }
    
    // Determine direction from options/velocity - this is CRITICAL for animation
    const direction = options.direction || this.determineDirection(vx, vy);
    
    // Update lastDirection only if we have a valid direction from movement
    if (direction) {
      // Update direction if it has changed
      if (this.lastDirection !== direction) {
        // Direction has changed, no need to log it
      }
      this.lastDirection = direction;
    }
    
    // Ensure we have a valid direction, default to 'down' if not
    if (!this.lastDirection) {
      this.lastDirection = 'down';
    }
    
    // Ensure we have a valid animation prefix
    if (!this.animPrefix) {
      const aiCharacter = this.aiCharacter || 'default';
      this.animPrefix = aiCharacter !== 'default' ? `${aiCharacter}_` : '';
    }
    
    // Check if we should override state based on velocity
    const hasVelocity = this.aiPlayer.body && 
      (Math.abs(this.aiPlayer.body.velocity.x) > 10 || 
       Math.abs(this.aiPlayer.body.velocity.y) > 10);
    
    // If we're moving but the state is idle, change it to move
    if (hasVelocity && state === 'idle') {
      state = 'move';
    }
    
    // Map state to actual animation state used by player (idle -> idle, move -> walk)
    let animState = state;
    if (state === 'move') {
      animState = 'walk'; // Player animations use 'walk' instead of 'move'
    }
    
    // Log animation change for debugging
    if (this.lastAnimState !== animState) {
      console.log(`AI animation state changing from ${this.lastAnimState || 'none'} to ${animState}`);
      this.lastAnimState = animState;
    }
    
    // Build animation key based on current state
    const animationKey = `${this.animPrefix}${this.lastDirection}_${animState}`;
    
    // Debug - store the current animation for the debug overlay
    this.currentAnimationKey = animationKey;
    
    try {
      // In story mode, force some animation changes even if key is the same
      // This helps make AI look more alive instead of static/frozen
      const forceAnimUpdate = !this.isVersusMode && 
                             state === 'idle' && 
                             Math.random() < 0.05 && 
                             this.aiPlayer.anims.currentAnim?.key === animationKey;
      
      // Check if the animation exists on the global animation manager before playing
      if (this.scene.anims.exists(animationKey)) {
        // Only change the animation if it's different from current or we're forcing an update
        if (this.aiPlayer.anims.currentAnim?.key !== animationKey || forceAnimUpdate) {
          this.aiPlayer.play(animationKey, true);
          //console.log(`Playing AI animation: ${animationKey}`);
        }
      } else {
        // Try alternate keys in case the animation naming is different
        const alternateKeys = [
          `${this.animPrefix}${this.lastDirection}_${animState}`,
          `${this.animPrefix}${this.lastDirection}_idle`, // Fallback to idle in same direction
          `${this.animPrefix}down_${animState}`, // Fallback to down direction
          `${this.animPrefix}down_idle`, // Ultimate fallback
          `${this.animPrefix}fallback_animation` // Emergency fallback
        ];
        
        // Find the first animation key that exists in the global animation manager
        let foundValidAnimation = false;
        for (const key of alternateKeys) {
          if (this.scene.anims.exists(key) && 
              (this.aiPlayer.anims.currentAnim?.key !== key || forceAnimUpdate)) {
            this.aiPlayer.play(key, true);
            console.log(`[AIPlayerManager] Animación reproducida para AI: personaje=${this.aiCharacter}, anim=${key}, textura=${this.aiPlayer.texture ? this.aiPlayer.texture.key : 'N/A'}, animActual=${this.aiPlayer.anims.currentAnim ? this.aiPlayer.anims.currentAnim.key : 'N/A'}`);
            //console.log(`Playing alternate AI animation: ${key} (original: ${animationKey})`);
            foundValidAnimation = true;
            break;
          }
        }
        
        // If no alternative animation found and we don't have any animation playing,
        // force play the idle animation as a last resort
        if (!foundValidAnimation && !this.aiPlayer.anims.isPlaying) {
          const fallbackKey = `${this.animPrefix}down_idle`;
          if (this.scene.anims.exists(fallbackKey)) {
            //console.log(`Forcing fallback animation: ${fallbackKey}`);
            this.aiPlayer.play(fallbackKey, true);
          }
        }
      }
      
      // Apply proper flipping for side views
      if (this.lastDirection === 'side') {
        // For side animations, we need to set the flip property based on movement
        if (vx !== undefined) {
          this.aiPlayer.setFlipX(vx < 0);
        }
      } else if (this.lastDirection.includes('corner')) {
        // For corner animations, use the target position to determine flip
        if (this.targetPlayer && this.targetPlayer.active) {
          const shouldFlip = this.targetPlayer.x < this.aiPlayer.x;
          this.aiPlayer.setFlipX(shouldFlip);
        } else if (this.targetPosition) {
          // In story mode, use target position for flipping
          const shouldFlip = this.targetPosition.x < this.aiPlayer.x;
          this.aiPlayer.setFlipX(shouldFlip);
        } else if (vx !== undefined) {
          // If no target, use velocity for flipping
          this.aiPlayer.setFlipX(vx < 0);
        }
      }
      
      // Update debug text if it exists
      if (this.debugText) {
        const velX = this.aiPlayer.body ? this.aiPlayer.body.velocity.x.toFixed(0) : 0;
        const velY = this.aiPlayer.body ? this.aiPlayer.body.velocity.y.toFixed(0) : 0;
        this.debugText.setText(`vx: ${velX}, vy: ${velY}\ndir: ${this.lastDirection}, anim: ${animState}`);
        
        // If debug text is not part of the container, update its position manually
        if (!(this.aiPlayer.add && typeof this.aiPlayer.add === 'function')) {
          this.debugText.x = this.aiPlayer.x;
          this.debugText.y = this.aiPlayer.y - 50;
        }
      }
    } catch (error) {
      console.error(`Error playing animation ${animationKey}:`, error);
    }
  }

  determineDirection(vx, vy) {
    // Null direction when there's no velocity
    if (vx === undefined || vy === undefined) return null;
    
    // Don't change direction for very small movements
    // (prevents jitter when the AI is essentially standing still)
    if (Math.abs(vx) < 5 && Math.abs(vy) < 5) return null;
    
    // Determine movement direction for animation
    const absX = Math.abs(vx);
    const absY = Math.abs(vy);
    
    // Calculate angle to determine proper 8-way direction
    const angle = Math.atan2(vy, vx) * (180 / Math.PI);
    const normalizedAngle = ((angle + 360) % 360); // Convert to 0-360 range
    
    
    // 8-way directional logic for smoother movement animations
    // This matches how player animations typically work
    if (absX > absY * 2) {
      // Horizontal movement dominates strongly
      return 'side'; // Side animation with flip handled in updateAnimation
    } else if (absY > absX * 2) {
      // Vertical movement dominates strongly
      return vy > 0 ? 'down' : 'up';
    } else {
      // Diagonal movement mapping based on angle
      // Map angles to the 5 available directions in character sprites
      if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
        return 'down_corner'; // Bottom-right
      } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
        return 'down_corner'; // Bottom-left (will be flipped)
      } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
        return 'up_corner'; // Top-left (will be flipped)
      } else if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) {
        return 'up_corner'; // Top-right
      } else if ((normalizedAngle >= 337.5 && normalizedAngle <= 360) || (normalizedAngle >= 0 && normalizedAngle < 22.5)) {
        return 'side'; // Right
      } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
        return 'down'; // Down
      } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
        return 'side'; // Left (will be flipped)
      } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
        return 'up'; // Up
      }
    }
    
    // Fallback to directional logic based on dominant axis
    // This should rarely be reached due to the comprehensive angle checks above
    if (absX > absY) {
      return 'side';
    } else {
      return vy > 0 ? 'down' : 'up';
    }
  }

  tryToShoot(time) {
    if (this.isReloading || this.currentAmmo <= 0) return;
    
    // Check if enough time has passed since last shot
    if (time < this.lastShotTime + this.fireRate) return;
    
    // Get AI mode
    const isVersusMode = this.scene.versusMode === true;
    
    // Higher accuracy in single player mode for more aggressive AI
    let shootAccuracy = this.shootAccuracy;
    if (!isVersusMode) {
      // Boost accuracy in single player for more challenge
      shootAccuracy += 0.15; // Up to 15% more accurate
    }
    
    // Higher chance to shoot in single player
    let shouldShoot = Math.random() < (isVersusMode ? this.shootAccuracy : shootAccuracy);
    
    // In single player, if we're in shoot state, further increase chance
    if (!isVersusMode && this.currentState === 'shoot') {
      shouldShoot = shouldShoot || Math.random() < 0.6; // Additional 60% chance
    }
    
    if (shouldShoot) {
      this.shoot();
      this.lastShotTime = time;
    }
  }

  shoot() {
    // Safety checks
    if (!this.aiPlayer || !this.aiPlayer.active) {
      console.log('Cannot shoot: AI player not available');
      return;
    }
    
    if (this.isReloading || this.currentAmmo <= 0) {
      console.log('Cannot shoot: reloading or out of ammo');
      return;
    }
    
    if (!this.shootingDirection) {
      console.log('Cannot shoot: no shooting direction defined');
      return;
    }
    
    if (!this.bullets) {
      console.log('Cannot shoot: bullet group not initialized');
      return;
    }
    
    // Get shooting direction
    const shootDirX = this.shootingDirection.x;
    const shootDirY = this.shootingDirection.y;
    
    // Skip if zero direction
    if (shootDirX === 0 && shootDirY === 0) {
      console.log('Cannot shoot: zero direction');
      return;
    }
    
    // Normalize direction vector
    const length = Math.sqrt(shootDirX * shootDirX + shootDirY * shootDirY);
    const normalizedDirX = shootDirX / length;
    const normalizedDirY = shootDirY / length;
    
    // Add random spread based on AI accuracy
    const spread = 0.1 * (1 - this.shootAccuracy);
    const randomSpreadX = normalizedDirX + Phaser.Math.FloatBetween(-spread, spread);
    const randomSpreadY = normalizedDirY + Phaser.Math.FloatBetween(-spread, spread);
    
    // Calculate bullet spawn position (in front of the AI player)
    const spawnOffsetX = normalizedDirX * 30;
    const spawnOffsetY = normalizedDirY * 30;
    
    // Get bullet from object pool
    const bullet = this.bullets.get(
      this.aiPlayer.x + spawnOffsetX,
      this.aiPlayer.y + spawnOffsetY
    );
    
    if (bullet) {
      // Set bullet properties
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.setDepth(5);
      
      // Calculate bullet velocity
      const bulletSpeed = 800;
      bullet.setVelocity(
        randomSpreadX * bulletSpeed,
        randomSpreadY * bulletSpeed
      );
      
      // Set bullet rotation to match direction
      bullet.rotation = Math.atan2(randomSpreadY, randomSpreadX);
      
      // Set bullet damage
      bullet.damage = 1;
      
      // Set bullet timeout
      this.scene.time.delayedCall(1000, () => {
        if (bullet.active) {
          bullet.setActive(false);
          bullet.setVisible(false);
        }
      });
      
      // Decrement ammo
      this.currentAmmo--;
      
      // Play shot sound
      if (this.scene.sound.get('shot')) {
        this.scene.sound.play('shot', { volume: 0.3 });
      }
      
      // Special behavior for Omen character
      if (this.aiCharacter === 'omen') {
        // Teleport occasionally
        if (Math.random() < 0.01 && !this.isTeleporting) {
          console.log('Attempting Omen teleport');
          this.teleportBehindPlayer();
        }
        
        // Enhanced aggression for Omen
        if (this.targetPlayer && this.aiPlayer) {
          const distanceToPlayer = Phaser.Math.Distance.Between(
            this.aiPlayer.x, this.aiPlayer.y, 
            this.targetPlayer.x, this.targetPlayer.y
          );
          
          // If too close, try to teleport more aggressively
          if (distanceToPlayer < 200 && Math.random() < 0.05) {
            console.log('Omen teleporting due to close proximity');
            this.teleportBehindPlayer();
          }
        }
      }
      
      // If out of ammo, reload
      if (this.currentAmmo <= 0 && this.totalMagazines > 0) {
        this.reload();
      }
    }
  }

  reload() {
    if (this.isReloading || this.totalMagazines <= 0) return;
    
    this.isReloading = true;
    
    // Play reload sound
    if (this.scene.sound.get('rifle_reload')) {
      this.scene.sound.play('rifle_reload', { volume: 0.5 });
    }
    
    // Set timer for reload duration
    this.reloadTimer = this.scene.time.delayedCall(this.reloadTime, () => {
      this.currentAmmo = this.magazineSize;
      this.totalMagazines--;
      this.isReloading = false;
    });
  }

  updateAIShadows() {
    if (!this.aiPlayer) return;
    
    // Update shadows using the same pattern as the player manager
    if (this.aiPlayerShadows) {
      this.aiPlayerShadows.forEach(shadowData => {
        shadowData.sprite.x = this.aiPlayer.x + shadowData.offset.x;
        shadowData.sprite.y = this.aiPlayer.y + shadowData.offset.y + 50; // Keep the +50 Y offset
      });
    }
    
    // Update marker position if in versus mode
    if (this.aiPlayerMarker) {
      this.aiPlayerMarker.x = this.aiPlayer.x;
      this.aiPlayerMarker.y = this.aiPlayer.y + 56; // Keep the offset
    }
    
    // Update debug text position if it exists and is not a child of the player sprite
    if (this.debugText && !(this.aiPlayer.add && typeof this.aiPlayer.add === 'function')) {
      this.debugText.x = this.aiPlayer.x;
      this.debugText.y = this.aiPlayer.y - 50;
    }
  }

  callForDrone(droneType) {
    // AI can call for drones just like the player
    if (typeof this.scene.spawnDrone === 'function') {
      const droneX = this.aiPlayer.x + Phaser.Math.Between(-100, 100);
      const droneY = this.aiPlayer.y + Phaser.Math.Between(-100, 100);
      
      // Note: Using the scene's spawnDrone function
      this.scene.spawnDrone(droneX, droneY, droneType, this.aiPlayer);
    }
  }
  
  // Helper method to find a valid death frame texture with fallbacks
  findValidDeathFrameTexture(frameNumber) {
    // Skip if no scene
    if (!this.scene) return null;
    
    const prefix = this.aiCharacter !== 'default' ? `${this.aiCharacter}_` : '';
    
    // Try different naming patterns based on character type and conventions
    const possibleNames = [
      `${prefix}player_death_${frameNumber}`,      // Standard format - character3_player_death_1
      `${prefix}Dead${frameNumber}`,               // Dead format - character2_Dead1
      `player_death_${frameNumber}`,               // No prefix - player_death_1
      `Dead${frameNumber}`,                        // No prefix, Dead format - Dead1
      `${this.aiCharacter}/PlayerDeath/${frameNumber}.png`,  // Path format
      `characters/${this.aiCharacter}/PlayerDeath/${frameNumber}.png` // Full path format
    ];
    
    // Find the first valid texture
    for (const name of possibleNames) {
      if (this.scene.textures.exists(name)) {
        return name;
      }
    }
    
    // If we get here, no valid texture was found
    return null;
  }
  
  createShieldBar() {
    if (!this.aiPlayer) return;
    
    // Create shield bar background (black rectangle)
    this.shieldBarBg = this.scene.add.rectangle(
      this.aiPlayer.x,
      this.aiPlayer.y - 40, // Position above AI player
      50, // Width
      8, // Height
      0x000000 // Black color
    );
    this.shieldBarBg.setDepth(20);
    this.shieldBarBg.setAlpha(0.7);
    
    // Create shield bar (green rectangle initially)
    this.shieldBar = this.scene.add.rectangle(
      this.aiPlayer.x - 25, // Left-aligned with background
      this.aiPlayer.y - 40,
      50, // Full width initially
      8,
      0x00ff00 // Green color
    );
    this.shieldBar.setDepth(21);
    this.shieldBar.setOrigin(0, 0.5); // Set origin to left center for easier scaling
    
    // Update shield bar color based on current shield value
    this.updateShieldBarColor();
  }
  
  updateShieldBar() {
    if (!this.aiPlayer || !this.shieldBar || !this.shieldBarBg) return;
    
    // Position shield bar above AI player
    this.shieldBarBg.x = this.aiPlayer.x;
    this.shieldBarBg.y = this.aiPlayer.y - 40;
    
    this.shieldBar.x = this.aiPlayer.x - 25; // Left-aligned
    this.shieldBar.y = this.aiPlayer.y - 40;
    
    // Update shield bar width based on current shield value
    const shieldPercentage = this.aiPlayer.shields / this.maxShields;
    this.shieldBar.width = 50 * shieldPercentage;
    
    // Update shield bar color
    this.updateShieldBarColor();
  }
  
  updateShieldBarColor() {
    if (!this.shieldBar) return;
    
    const shieldPercentage = this.aiPlayer.shields / this.maxShields;
    
    // Set color based on shield percentage
    if (shieldPercentage <= 0.25) {
      // 25% or less - red
      this.shieldBar.fillColor = 0xff0000;
    } else if (shieldPercentage <= 0.75) {
      // 75% or less - orange
      this.shieldBar.fillColor = 0xff9900;
    } else {
      // Above 75% - green
      this.shieldBar.fillColor = 0x00ff00;
    }
  }
  
  createAIPlayerDeathAnimation() {
    // Get the animation prefix for the AI character
    const prefix = this.aiCharacter !== 'default' ? `${this.aiCharacter}_` : '';
    
    // Determine if this character uses "Dead" format or numeric format
    const isCharacter3Or5 = this.aiCharacter === 'character3' || this.aiCharacter === 'character5';
    const deathFrameCount = isCharacter3Or5 ? 12 : 11;
    
    // Create array of death frames based on character type
    this.aiDeathFrames = [];
    
    // First, check what textures exist for this character
    console.log(`Building death frames for AI character: ${this.aiCharacter}`);
    const allTextures = Object.keys(this.scene.textures.list);
    
    // Find textures that match death animations for this character
    const deathTextures = allTextures.filter(key => 
        (key.includes(this.aiCharacter) && (key.includes('Dead') || key.includes('death') || key.includes('PlayerDeath'))) ||
        (this.aiCharacter === 'default' && (key.includes('Dead') || key.includes('death')))
    );
    
    console.log(`Found ${deathTextures.length} potential death textures for ${this.aiCharacter}:`, deathTextures);
    
    // Determine the naming pattern based on available textures
    const usesDeadFormat = deathTextures.some(key => key.includes('Dead'));
    const usesNumericFormat = deathTextures.some(key => key.includes('PlayerDeath'));
    
    // Build death frames array based on detected pattern
    if (usesNumericFormat) {
      // Path-based format (characters/character3/PlayerDeath/1.png)
      for (let i = 1; i <= deathFrameCount; i++) {
        const texturePath = `characters/${this.aiCharacter}/PlayerDeath/${i}.png`;
        if (this.scene.textures.exists(texturePath)) {
          this.aiDeathFrames.push(texturePath);
        } else {
          console.warn(`Missing death texture: ${texturePath}`);
        }
      }
    } else if (usesDeadFormat) {
      // Dead format (character2_Dead1)
      for (let i = 1; i <= deathFrameCount; i++) {
        const textureName = `${prefix}Dead${i}`;
        if (this.scene.textures.exists(textureName)) {
          this.aiDeathFrames.push(textureName);
        } else {
          console.warn(`Missing death texture: ${textureName}`);
        }
      }
    } else {
      // Standard format (character5_player_death_1)
      for (let i = 1; i <= deathFrameCount; i++) {
        const textureName = `${prefix}player_death_${i}`;
        if (this.scene.textures.exists(textureName)) {
          this.aiDeathFrames.push(textureName);
        } else {
          console.warn(`Missing death texture: ${textureName}`);
        }
      }
    }
    
    // Log the final death frames that will be used
    console.log(`AI death frames for ${this.aiCharacter}:`, this.aiDeathFrames);
    
    // Store AI player position before it was destroyed
    const deathX = this.aiPlayer ? this.aiPlayer.x : this.scene.cameras.main.centerX;
    const deathY = this.aiPlayer ? this.aiPlayer.y : this.scene.cameras.main.centerY;
    
    // Create a new sprite for the death animation
    let deathSprite = this.scene.add.sprite(deathX, deathY, this.aiDeathFrames[0]);
    deathSprite.setDepth(20);
    deathSprite.setScale(0.5); // Match the AI player scale
    
    // Track the current frame for animation
    this.currentAIDeathFrame = 0;
    
    // Create a dummy object to tween - we'll use this to track progress
    this.aiDeathAnimProgress = { frame: 0 };
    
    // Clear any previous tweens
    if (this.aiDeathTween) {
      this.aiDeathTween.stop();
      this.aiDeathTween = null;
    }
    
    // Create a tween that goes through all frames
    const lastFrameIndex = this.aiDeathFrames.length - 1;
    this.aiDeathTween = this.scene.tweens.add({
      targets: this.aiDeathAnimProgress,
      frame: lastFrameIndex,
      duration: this.aiDeathFrames.length * 100, // 100ms per frame
      ease: 'Linear',
      onUpdate: () => {
        // Calculate the current frame based on progress
        const newFrame = Math.floor(this.aiDeathAnimProgress.frame);
        
        // Only update the texture if the frame has changed
        if (newFrame !== this.currentAIDeathFrame && newFrame < this.aiDeathFrames.length) {
          this.currentAIDeathFrame = newFrame;
          
          try {
            // Update the death sprite texture
            if (this.aiDeathFrames && this.aiDeathFrames[newFrame]) {
              deathSprite.setTexture(this.aiDeathFrames[newFrame]);
              console.log(`Setting AI death frame: ${this.aiDeathFrames[newFrame]}`);
            }
          } catch (error) {
            console.error('Error updating death frame:', error);
          }
        }
      },
      onComplete: () => {
        console.log('AI death animation completed');
        
        // Display victory message
        const text = this.scene.add.text(
          this.scene.cameras.main.centerX,
          this.scene.cameras.main.centerY - 100,
          'VICTORY!',
          {
            fontFamily: 'Arial',
            fontSize: 64,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
          }
        );
        text.setOrigin(0.5);
        text.setScrollFactor(0);
        
        // Scale effect
        this.scene.tweens.add({
          targets: text,
          scale: { from: 0.5, to: 1.2 },
          duration: 500,
          ease: 'Back.easeOut'
        });
        
        // Remove after a few seconds
        this.scene.time.delayedCall(3000, () => {
          this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 50,
            duration: 500,
            onComplete: () => {
              text.destroy();
              // Destroy the death sprite
              deathSprite.destroy();
            }
          });
        });
      }
    });
    
    // Gently fade out shadows
    if (this.aiPlayerShadows) {
      this.aiPlayerShadows.forEach(shadowData => {
        // Fade out shadow
        this.scene.tweens.add({
          targets: shadowData.sprite,
          alpha: 0.3,
          duration: 1000,
          ease: 'Linear',
          onComplete: () => {
            // Completely destroy the shadows when the animation is complete
            if (shadowData && shadowData.sprite) {
              shadowData.sprite.destroy();
            }
          }
        });
      });
      // Clear shadow references
      this.aiPlayerShadows = [];
    }
    
    // Fade out and destroy marker if it exists
    if (this.aiPlayerMarker) {
      this.scene.tweens.add({
        targets: this.aiPlayerMarker,
        alpha: 0,
        duration: 800,
        ease: 'Linear',
        onComplete: () => {
          if (this.aiPlayerMarker) {
            this.aiPlayerMarker.destroy();
            this.aiPlayerMarker = null;
          }
        }
      });
    }
    
    // Clean up shield bar
    if (this.shieldBar) {
      this.scene.tweens.add({
        targets: this.shieldBar,
        alpha: 0,
        duration: 500,
        ease: 'Linear',
        onComplete: () => {
          if (this.shieldBar) {
            this.shieldBar.destroy();
            this.shieldBar = null;
          }
        }
      });
    }
    
    if (this.shieldBarBg) {
      this.scene.tweens.add({
        targets: this.shieldBarBg,
        alpha: 0,
        duration: 500,
        ease: 'Linear',
        onComplete: () => {
          if (this.shieldBarBg) {
            this.shieldBarBg.destroy();
            this.shieldBarBg = null;
          }
        }
      });
    }
  }

  absorbShieldDamage(amount) {
    if (!this.aiPlayer) {
      console.warn('Cannot damage AI player shield: AI is null');
      return false;
    }
    if (this.aiPlayer.isDead || this.aiPlayer.isDying) {
      console.warn('AI is already dead or dying, ignoring shield damage');
      return false;
    }
    // Process shield damage unconditionally (do not check invincibility here)
    if (this.aiPlayer.shields === undefined) {
      this.aiPlayer.shields = this.shields; // Set to initial shields value if undefined
    }
    if (this.aiPlayer.shields > 0) {
      console.log(`Shield absorbing ${amount} damage. Shields before: ${this.aiPlayer.shields}`);
      this.aiPlayer.shields = Math.max(0, this.aiPlayer.shields - amount);
      this.updateShieldBar();
      
      // Store current AI player position and velocity
      const currentX = this.aiPlayer.x;
      const currentY = this.aiPlayer.y;
      const currentVelocityX = this.aiPlayer.body ? this.aiPlayer.body.velocity.x : 0;
      const currentVelocityY = this.aiPlayer.body ? this.aiPlayer.body.velocity.y : 0;
      const currentShields = this.aiPlayer.shields;
      const currentHealth = this.aiPlayer.health;
      const currentDepth = this.aiPlayer.depth;
      const currentAngle = this.aiPlayer.angle;
      const currentScaleX = this.aiPlayer.scaleX;
      const currentScaleY = this.aiPlayer.scaleY;
      const currentDirection = this.lastDirection || 'down';
      const currentState = this.currentState || 'idle';
      const animationKey = this.aiPlayer.anims && this.aiPlayer.anims.currentAnim ? this.aiPlayer.anims.currentAnim.key : null;
      const flipX = this.aiPlayer.flipX;
      
      // IMMEDIATELY RECREATE SPRITE to avoid the flashing effect
      // First, save a reference to the old AI player
      const oldAI = this.aiPlayer;
      
      // Store reference to current shadows and marker before destroying
      const currentShadows = this.aiPlayerShadows;
      const currentMarker = this.aiPlayerMarker;
      
      // Clean up shadows before recreating
      if (currentShadows) {
        currentShadows.forEach(shadowData => {
          if (shadowData && shadowData.sprite) shadowData.sprite.destroy();
        });
        this.aiPlayerShadows = [];
      }
      
      // Clean up marker
      if (currentMarker && currentMarker.active) {
        currentMarker.destroy();
        this.aiPlayerMarker = null;
      }
      
      // Clean up shield bar before recreating
      if (this.shieldBar) {
        this.shieldBar.destroy();
        this.shieldBar = null;
      }
      
      if (this.shieldBarBg) {
        this.shieldBarBg.destroy();
        this.shieldBarBg = null;
      }
      
      // Recreate AI player at the same position IMMEDIATELY
      this.createAIPlayer(currentX, currentY);
      
      // Restore shields, health, and other properties
      this.aiPlayer.shields = currentShields;
      this.aiPlayer.health = currentHealth;
      this.aiPlayer.setDepth(currentDepth);
      this.aiPlayer.setAngle(currentAngle);
      this.aiPlayer.setScale(currentScaleX, currentScaleY);
      this.aiPlayer.setFlipX(flipX);
      
      // Reset damage cooldown to ensure the new sprite can take damage
      this.aiPlayer.justDamaged = false;
      
      // Preserve debug text if it existed
      if (this.debugText) {
        // Update the debug text position to follow the new AI player
        if (!(this.aiPlayer.add && typeof this.aiPlayer.add === 'function')) {
          this.debugText.x = this.aiPlayer.x;
          this.debugText.y = this.aiPlayer.y - 50;
        } else {
          // If the AI player supports container functionality, add the debug text as a child
          this.aiPlayer.add(this.debugText);
        }
      }
      
      // Restore velocity if physics body exists
      if (this.aiPlayer.body && currentVelocityX !== undefined && currentVelocityY !== undefined) {
        this.aiPlayer.body.velocity.x = currentVelocityX;
        this.aiPlayer.body.velocity.y = currentVelocityY;
      }
      
      // IMMEDIATELY freeze all animations to prevent flashing
      if (this.aiPlayer.anims) {
        this.aiPlayer.anims.pause();
        
        // Get appropriate texture based on character and direction
        const characterKey = this.aiCharacter || 'default';
        const staticFrameKey = characterKey !== 'default' ? 
          `${characterKey}_${currentDirection}_idle_1` : 
          `${currentDirection}_idle_1`;
          
        // Try to set a static frame - this prevents the sprite from flashing during transition
        if (this.scene.textures.exists(staticFrameKey)) {
          this.aiPlayer.setTexture(staticFrameKey);
          console.log(`Set static frame immediately: ${staticFrameKey}`);
        }
      }
      
      // RE-REGISTER the collision so the new sprite takes damage from player bullets
      if (this.scene.playerManager && this.scene.playerManager.bullets) {
        console.log('Using scene.playerManager.bullets for collision');
        this.scene.physics.add.overlap(
          this.scene.playerManager.bullets,
          this.aiPlayer,
          this.scene.playerBulletHitAI,
          null,
          this.scene
        );
      } else if (this.playerManager && this.playerManager.bullets) {
        console.log('Using playerManager.bullets for collision');
        this.scene.physics.add.overlap(
          this.playerManager.bullets,
          this.aiPlayer,
          this.scene.playerBulletHitAI,
          null,
          this.scene
        );
      } else {
        console.warn('Could not find bullet group to re-register collision with AI player');
      }
      
      // Red flash effect on new sprite
      this.aiPlayer.setTint(0xff0000);
      this.scene.tweens.add({
        targets: this.aiPlayer,
        alpha: 0.7,
        duration: 100,
        yoyo: true,
        repeat: 1
      });
      
      // Clean up old sprite after creating new one
      if (oldAI && oldAI.active) {
        oldAI.destroy();
      }
      
      // Wait for a half second (500ms) before resuming animations
      this.scene.time.delayedCall(500, () => {
        // Only proceed if AI player is still valid
        if (this.aiPlayer && this.aiPlayer.active && !this.aiPlayer.isDead) {
          // Clear tint after delay
          this.aiPlayer.clearTint();
          
          // Resume animation after the delay
          if (animationKey && this.scene.anims.exists(animationKey)) {
            // Resume the exact same animation if available
            this.aiPlayer.play(animationKey);
            console.log(`Resumed AI animation: ${animationKey}`);
          } else {
            // Otherwise use updateAnimation with current state and direction
            this.lastDirection = currentDirection;
            this.currentState = currentState;
            console.log(`Recreating animation for state: ${currentState}, direction: ${currentDirection}`);
            
            if (currentState === 'move') {
              this.updateAnimation('move', { 
                x: currentVelocityX, 
                y: currentVelocityY,
                direction: currentDirection
              });
            } else {
              this.updateAnimation('idle', { direction: currentDirection });
            }
          }
        }
      });
      
      return true;
    }
    return false;
  }

  applyHealthDamage(amount) {
    if (!this.aiPlayer) {
      console.warn('Cannot damage AI player: AI is null');
      return;
    }
    if (this.aiPlayer.isDead || this.aiPlayer.isDying) {
      console.warn('AI is already dead or dying, ignoring health damage');
      return;
    }
    
    // Store the current character in case we need to recreate the AI player
    if (this.aiCharacter) {
      this.scene.registry.set('aiCharacter', this.aiCharacter);
      console.log(`Stored AI character ${this.aiCharacter} in registry during damage`);
    }
    
    // Initialize health if needed
    if (this.aiPlayer.health === undefined) {
      this.aiPlayer.health = this.startingHealth;
      this.aiPlayer.maxHealth = this.startingHealth;
    }
    console.log(`Applying health damage: ${amount}. Health before: ${this.aiPlayer.health}`);
    this.aiPlayer.health = Math.max(0, this.aiPlayer.health - amount);

    // Trigger visual feedback for health damage (red flash tween)
    this.aiPlayer.setTint(0xff0000);
    this.scene.tweens.add({
      targets: this.aiPlayer,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onUpdate: () => {
        // Safety check - stop tween if AI is no longer valid
        if (!this.aiPlayer || this.aiPlayer.isDead) {
          return false; // Stop the tween
        }
      },
      onComplete: () => {
        if (this.aiPlayer && !this.aiPlayer.isDead) {
          this.aiPlayer.alpha = 1;
          this.aiPlayer.clearTint();
          this.scene.time.delayedCall(800, () => {
            if (this.aiPlayer && !this.aiPlayer.isDead) {
              this.aiPlayer.isInvincible = false;
            }
          });
        }
      }
    });
    
    // Create additional effects (e.g., blood splatter)
    this.createAIBloodSplatter();
    
    // Play character damage sound
    if (this.scene.sound.get('grunt_1')) {
      const hitSounds = ['grunt_1', 'grunt_2', 'grunt_3', 'grunt_4'];
      const randomSound = Phaser.Utils.Array.GetRandom(hitSounds);
      this.scene.sound.play(randomSound, { volume: 0.5 });
    }
    
    // If health reaches 0, kill the AI
    if (this.aiPlayer.health <= 0) {
      this.killAIPlayer();
    }
  }

  handleHitDamage(amount) {
    // Prevent multiple calls in quick succession
    if (this.aiPlayer && this.aiPlayer.justDamaged) {
      console.log('AI was just damaged, ignoring this call');
      return;
    }
    
    // Set a flag to prevent multiple damage calls
    if (this.aiPlayer) {
      this.aiPlayer.justDamaged = true;
      this.scene.time.delayedCall(300, () => {  // Increased from 100 to 300 ms
        if (this.aiPlayer) {
          this.aiPlayer.justDamaged = false;
        }
      });
    }
    
    // Check basic conditions
    if (!this.aiPlayer || this.aiPlayer.isDead || this.aiPlayer.isDying) {
      return;
    }
    
    // Check if AI is invincible
    if (this.aiPlayer.isInvincible) {
      console.log('AI is invincible, ignoring damage');
      return;
    }
    
    // First, if shields exist, let them absorb the damage
    if (this.aiPlayer.shields > 0 && this.absorbShieldDamage(amount)) {
      console.log('Damage absorbed by shield; skipping health damage.');
      return;
    }
    
    // If no shield (or shield is depleted), then apply health damage
    this.applyHealthDamage(amount);
  }

  killAIPlayer() {
    console.log('AI health reached zero. Killing AI player.');
    
    // Mark AI as dying to prevent further damage
    if (this.aiPlayer) {
      this.aiPlayer.isDying = true;
    }
    
    // Immediately hide the shield bar when dying (will be properly destroyed in the death animation)
    if (this.shieldBar) {
      this.shieldBar.alpha = 0;
    }
    if (this.shieldBarBg) {
      this.shieldBarBg.alpha = 0;
    }
    
    // Destroy the AI player sprite
    if (this.aiPlayer && this.aiPlayer.active) {
      this.aiPlayer.destroy();
    }
    
    // Start death animation which will handle cleanup of other elements
    this.createAIPlayerDeathAnimation();
  }
  
  // Legacy damage method for backward compatibility
  damage(amount) {
    console.log('Legacy damage() method called with amount:', amount);
    this.handleHitDamage(amount);
  }
  
  // Legacy shield damage method for backward compatibility
  damageShield(amount) {
    console.log('Legacy damageShield() method called with amount:', amount);
    return this.absorbShieldDamage(amount);
  }
  
  createAIBloodSplatter() {
    // Store the AI player position before any potential destruction
    const aiX = this.aiPlayer.x;
    const aiY = this.aiPlayer.y;
    
    // Create blood particles manually, similar to EnemyEffects
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 75 + Math.random() * 200;
      const particleSize = 0.5 + Math.random() * 0.5;
      const lifespan = 300 + Math.random() * 300;
      const tintColors = [0x990000, 0x880000, 0x770000];
      const tint = tintColors[Math.floor(Math.random() * tintColors.length)];
      
      const particle = this.scene.add.image(
        aiX,
        aiY,
        'blood_particle'
      );
      
      // Skip if texture doesn't exist
      if (!particle.texture || particle.texture.key === '__MISSING') {
        particle.destroy();
        continue;
      }
      
      particle.setScale(particleSize);
      particle.setTint(tint);
      particle.setDepth(2); // Set depth to be consistent with other blood effects
      
      this.scene.tweens.add({
        targets: particle,
        x: aiX + Math.cos(angle) * speed,
        y: aiY + Math.sin(angle) * speed,
        scale: particleSize * 0.5,
        alpha: 0,
        duration: lifespan,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
    
    // Create blood pool/splash (smaller for non-fatal hits)
    // Create a few blood splashes directly on the scene
    for (let i = 0; i < 3; i++) {
      const splash = this.scene.add.image(
        aiX + Phaser.Math.Between(-20, 20),
        aiY + Phaser.Math.Between(-20, 20),
        'blood_splash'
      );
      
      // Skip if texture doesn't exist
      if (!splash.texture || splash.texture.key === '__MISSING') {
        splash.destroy();
        continue;
      }
      
      splash.setAlpha(0.6);
      splash.setScale(Phaser.Math.FloatBetween(0.3, 0.5));
      splash.setAngle(Phaser.Math.Between(0, 360));
      splash.setDepth(0.3); // Set depth below the player
      
      // Make blood fade out after some time
      this.scene.tweens.add({
        targets: splash,
        alpha: 0,
        duration: 2000,
        delay: 3000,
        onComplete: () => {
          splash.destroy();
        }
      });
    }
  }
  
  destroy() {
    // Cleanup resources
    if (this.bullets) {
      this.bullets.clear(true, true);
    }
    
    // Clean up shield bar
    if (this.shieldBar) {
      this.shieldBar.destroy();
      this.shieldBar = null;
    }
    
    if (this.shieldBarBg) {
      this.shieldBarBg.destroy();
      this.shieldBarBg = null;
    }
    
    // Clean up marker if it exists (for versus mode)
    if (this.aiPlayerMarker) {
      this.aiPlayerMarker.destroy();
      this.aiPlayerMarker = null;
    }
    
    // Clean up debug text
    if (this.debugText) {
      this.debugText.destroy();
      this.debugText = null;
    }
    
    // Clean up shadows
    if (this.aiPlayerShadows) {
      this.aiPlayerShadows.forEach(shadowData => {
        if (shadowData && shadowData.sprite) shadowData.sprite.destroy();
      });
      this.aiPlayerShadows = [];
    }
    
    // Clean up any death animation tweens
    if (this.aiDeathTween) {
      this.aiDeathTween.stop();
      this.aiDeathTween = null;
    }
    
    if (this.aiPlayer) {
      this.aiPlayer.destroy();
      this.aiPlayer = null;
    }
    
    if (this.reloadTimer) {
      this.reloadTimer.remove();
      this.reloadTimer = null;
    }
  }
}