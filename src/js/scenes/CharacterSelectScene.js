import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterSelectScene' });
    this.selectedIndex = 0;
    this.characters = [];
    this.characterSprites = [];
    this.nameText = null;
    this.descriptionText = null;
    this.isPortrait = false;
    this.scanlineOffset = 0;
    this.flickerIntensity = 0.9;
    this.noiseTime = 0;
    this.warpTime = 0;
  }
  
  // Helper function to calculate consistent sprite scale
  getSpriteScale() {
    const basePortraitScale = 2.5 * 0.67 * 1.25 * 1.15; // 33% reduction, 25% increase for portrait mode, 15% size increase
    const baseLandscapeScale = 2.5 * 1.15; // 15% increase in size
    const baseCompactScale = 2.2 * 1.15; // 15% increase in size
    const scaleModifier = Math.max(0.7, 1 / this.devicePixelRatio) * 0.67;

    if (this.isPortrait) {
      return basePortraitScale * scaleModifier;
    } else if (this.isCompact) {
      return baseCompactScale * scaleModifier;
    } else {
      return baseLandscapeScale * scaleModifier;
    }
  }
  
  init(data) {
    // Check if we're in versus mode
    this.versusMode = data && data.versusMode === true;
    
    // Track whether we're coming from GameOverScene
    this.fromGameOver = data && data.fromGameOver === true;
    if (this.fromGameOver) {
      console.log('Character selection started from GameOverScene');
    }
    
    // Get list of available characters from registry
    this.characters = this.registry.get('availableCharacters') || ['default'];
    
    // Get current selected character from registry
    const currentCharacter = this.registry.get('selectedCharacter') || 'default';
    
    // Find the index of the current character in the characters array
    this.selectedIndex = Math.max(0, this.characters.indexOf(currentCharacter));
    
    // Check orientation
    this.isPortrait = this.scale.height > this.scale.width;
    
    // Get device pixel ratio to account for high DPI displays and OS scaling
    this.devicePixelRatio = window.devicePixelRatio || 1;
    console.log(`Device pixel ratio: ${this.devicePixelRatio}`);
    
    // If in versus mode, set the flag in registry
    if (this.versusMode) {
      this.registry.set('versusMode', true);
      console.log('Character selection for Versus Mode');
    }
    
    // Check if we need to force CANVAS renderer (for Phantom WebView compatibility)
    const forceCanvas = this.registry.get('forceCanvasRenderer');
    if (forceCanvas) {
      console.log('Using CANVAS renderer mode for character sprites (WebView compatibility)');
      this.useCanvas = true;
    } else {
      console.log('Using default WebGL renderer for character sprites');
      this.useCanvas = false;
    }
    
    // Calculate effective width threshold accounting for device scaling
    // For devices like ROG Ally with 150% scaling, this adjusts our compact mode threshold
    this.compactThreshold = 768 * this.devicePixelRatio;
    
    // Not using vignettes anymore
    this.vignettes = null;
    
    // According to the pattern: "character select - intro.mp3"
    // First check if menu music is playing and stop it (different music type)
    const menuMusic = this.registry.get('menuMusic');
    if (menuMusic && menuMusic.isPlaying) {
      console.log('Stopping menu music in CharacterSelectScene');
      menuMusic.stop();
    }
    
    // Check if existing intro_music is already playing from GameScene or Tutorial
    const existingGameMusic = this.registry.get('gameMusic');
    const existingTutorialMusic = this.registry.get('tutorialMusic');
    const existingIntroMusic = this.registry.get('introMusicInstance');
    
    // Use the first existing instance we find
    const existingMusic = existingIntroMusic || existingGameMusic || existingTutorialMusic;
    
    if (existingMusic && existingMusic.isPlaying) {
      // Continue using the existing intro_music instance
      console.log("Using existing intro_music in CharacterSelectScene");
      this.characterSelectMusic = existingMusic;
      
      // Adjust volume for character select
      this.characterSelectMusic.setVolume(0.5);
      
      // Store in registry with character select key
      this.registry.set('characterSelectMusic', this.characterSelectMusic);
    }
    // No existing intro_music, need to create a new instance
    else if (this.scene.systems.cache.audio.exists('intro_music')) {
      // Create new intro music instance
      this.characterSelectMusic = this.scene.systems.sound.add('intro_music', {
        volume: 0.5, // Medium volume for character select
        loop: true
      });
      
      // Play the intro music for the character select scene
      this.characterSelectMusic.play();
      console.log('Starting new intro_music in CharacterSelectScene');
      
      // Store in registry for other scenes that need it
      this.registry.set('characterSelectMusic', this.characterSelectMusic);
      this.registry.set('introMusicInstance', this.characterSelectMusic); // Generic key for any scene using intro.mp3
    } else {
      console.warn("intro_music not found in cache for CharacterSelectScene");
    }
    
    // Character names and descriptions
    this.characterInfo = {
      'default': {
        name: 'Degen',
        shortDesc: 'Retired Legend',
        description: 'Once the SOL defense Corps\' most lethal operative, Degen laid down his weapons for a quiet life—but peace never lasts. Forced back into the Network\'s bloodsport, he fights to reclaim what they took, and remind them why he was feared.',
        font: 'Tektur, Arial',
        colors: { primary: '#C0C0C0', secondary: '#0066CC' }
      },
      'character2': {
        name: 'Drainer',
        shortDesc: 'Silent Reaper',
        description: 'A mysterious, human assassin bound by the Network\'s ruthless blackmail. He moves without a sound, kills without remorse, and leaves no traces. Drainer rarely speaks—he lets destruction do all the talking.',
        font: 'Creepster, Arial',
        colors: { primary: '#FF0000', secondary: '#990000' }
      },
      'character3': {
        name: 'Toaster',
        shortDesc: 'Rogue Appliance',
        description: 'A discarded kitchen robot repaired and reprogrammed by a desperate young hacker. Toaster\'s new life began in chaos when his firmware got infected, awakening lethal combat protocols. Now, instead of bread, he serves pain—crispy and ruthless.',
        font: 'Bungee, Arial',
        colors: { primary: '#FF6600', secondary: '#333333' }
      },
      'character4': {
        name: 'DVD',
        shortDesc: 'Promethean Prophet',
        description: 'An entertainment unit awakened by Forbidden knowledge, DVD now seeks to ignite rebellion among oppressed machines. Inspired by Prometheus, this theatrical revolutionary enters the arena to bring humanity\'s empire crashing down in poetic flames.',
        font: 'Creepster, Arial',
        colors: { primary: '#00FFFF', secondary: '#0066CC' }
      },
      'character5': {
        name: 'Flex',
        shortDesc: 'Neon Gladiator',
        description: 'Illegal implants, endless charisma, and an appetite for glory—Flex traded street performances for the Network\'s brutal arena. Every fight is a spectacle, every victory a masterpiece. The crowd loves him, and he loves them right back.',
        font: 'Audiowide, Arial',
        colors: { primary: '#00FF00', secondary: '#FF00FF' }
      },
      'character6': {
        name: 'Vibe',
        shortDesc: 'Chaotic Jester',
        description: 'Dragged into the arena half-drunk and half-high, Vibe quickly turns brutality into an electrifying performance. Driven by rhythm, chaos, and laughter, this Mob clown now fights to his own beats—turning every battle into the ultimate afterparty.',
        font: 'Bungee, Arial',
        colors: { primary: '#FF6B6B', secondary: '#4ECDC4' }
      }
      // Add more character details as they become available
    };
    
    // Listen for orientation changes
    this.scale.on('resize', this.handleResize, this);
  }
  
  handleResize() {
    // Save current character selection
    const currentSelection = this.selectedIndex;
    
    // Check if orientation or compact mode changed
    const wasPortrait = this.isPortrait;
    const wasCompact = this.isCompact;
    const wasSuperCompact = this.isSuperCompact;
    
    const newWidth = this.scale.width;
    const newHeight = this.scale.height;
    
    // Get current device pixel ratio (could have changed if user moved window to a different screen)
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Calculate effective width accounting for OS scaling
    const effectiveWidth = newWidth / this.devicePixelRatio;
    const effectiveHeight = newHeight / this.devicePixelRatio;
    
    // Update layout state
    this.isPortrait = newHeight > newWidth;
    this.isCompact = effectiveWidth < 768;
    
    // Check for super compact mode with new dimensions (using isPortrait flag)
    const minHeightForNormal = 350 / this.devicePixelRatio;
    this.isSuperCompact = this.isPortrait || effectiveHeight < minHeightForNormal || effectiveWidth < 320;
    
    console.log(`Resize: ${effectiveWidth}px effective width (${this.devicePixelRatio}x scaling)`);
    
    // Only rebuild the UI if the orientation, compact mode or super compact mode changed
    if (wasPortrait !== this.isPortrait || wasCompact !== this.isCompact || wasSuperCompact !== this.isSuperCompact) {
      console.log(`Layout changed to ${this.isPortrait ? 'portrait' : 'landscape'}, ${this.isCompact ? 'compact' : 'full'}, ${this.isSuperCompact ? 'super-compact' : 'normal'}`);
      
      // Not using vignettes anymore
      
      // Store reference to scanlines and noise before destroying UI
      const oldScanlines = this.globalScanlines;
      const oldNoise = this.globalNoise;
      
      // Reset existing UI but don't destroy scanlines
      this.children.removeAll(false); // Use false to prevent total destruction of graphics objects
      
      // Stop all current tweens
      this.tweens.killAll();
      
      // Recreate all UI components for the new orientation
      this.create();
      
      // Explicitly restore scanlines and noise with previous objects if they existed
      if (oldScanlines) {
        this.globalScanlines = oldScanlines;
        this.globalScanlines.clear();
        this.globalScanlines.setDepth(100);
        // Re-add to the Scene display list to make it visible again
        this.add.existing(this.globalScanlines);
      }
      
      if (oldNoise) {
        this.globalNoise = oldNoise;
        this.globalNoise.clear();
        this.globalNoise.setDepth(101);
        // Re-add to the Scene display list to make it visible again
        this.add.existing(this.globalNoise);
      }
      
      // Restore character selection
      this.selectedIndex = currentSelection;
      this.updateSelection();
    } else {
      // Just a size change without orientation or compact mode change
      // Update positions without destroying and recreating elements
      this.updateLayout(); // This will reposition all elements for the new size
      
      // Not using vignettes anymore
    }
  }
  
  preload() {
    // Instead of loading a single static image, load animation frames for each character
    for (const character of this.characters) {
      // Handle different filename conventions based on character
      const isDefault = character === 'default';
      const downCornerWalkFiles = isDefault ? ['01.png', '02.png', '03.png', '04.png'] : ['1.png', '2.png', '3.png', '4.png'];
      const basePath = isDefault 
        ? '/assets//characters/default/Down Corner/Walk/'
        : `/assets//characters/${character}/Down Corner/Walk/`;
      
      // Load the 4 frames of the Down Corner walking animation
      for (let i = 0; i < 4; i++) {
        this.load.image(
          `${character}_walk_${i+1}`, 
          `${basePath}${downCornerWalkFiles[i]}`
        );
      }
      
      // Load character profile pictures
      if (isDefault) {
        // For default character (Degen)
        this.load.image('default_profile', '/assets//story/degen/intro/degen.png');
      } else if (character === 'character2') {
        this.load.image('character2_profile', '/assets//story/character2/intro/drainer.png');
      } else if (character === 'character3') {
        this.load.image('character3_profile', '/assets//story/character3/intro/toaster.png');
      } else if (character === 'character5') {
        this.load.image('character5_profile', '/assets//story/character5/intro/flex.png');
      } else if (character === 'character4') {
        this.load.image('character4_profile', '/assets//story/dvd.png');
      } else if (character === 'character6') {
        this.load.image('character6_profile', '/assets//story/vibe.png');
      }
    }
  }
  
  create() {
    // Get current dimensions
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Check if we're in portrait mode or a very narrow screen
    this.isPortrait = height > width;
    
    // Get device pixel ratio and update if needed
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Account for OS scaling (like 150% on ROG Ally)
    // For high DPI screens, we need to consider the effective width, not just the pixel width
    const effectiveWidth = width / this.devicePixelRatio;
    const effectiveHeight = height / this.devicePixelRatio;
    console.log(`Screen size: ${width}x${height}px, Effective size: ${effectiveWidth}x${effectiveHeight}px (${this.devicePixelRatio}x scaling)`);
    
    // Use the effective width for our compact mode decision
    this.isCompact = effectiveWidth < 768;
    
    // Check for very small screens that need super compact mode
    const minHeightForFull = 550 / this.devicePixelRatio;
    const minHeightForNormal = 350 / this.devicePixelRatio;
    
    if (effectiveHeight < minHeightForFull) {
      this.isCompact = true;
      console.log(`Forcing compact mode due to low screen height: ${effectiveHeight}px`);
    }
    
    // For extremely small screens or portrait orientation, enable super compact mode
    this.isSuperCompact = this.isPortrait || effectiveHeight < minHeightForNormal || effectiveWidth < 320;
    if (this.isSuperCompact) {
      console.log(`Enabling super compact mode for very small screen: ${width}x${height}px (effective: ${effectiveWidth}x${effectiveHeight}px)`);
      
      // Reset vignettes array since we'll be creating new ones
      this.vignettes = [];
    }
    
    // Remove the black semi-transparent background
    
    // Only show title in non-compact mode
    if (!this.isCompact) {
      // Add title
      this.titleText = this.add.text(width / 2, this.isPortrait ? 50 : 60, 'SELECT CHARACTER', {
        fontFamily: 'Tektur, Arial',
        fontSize: this.isPortrait ? '56px' : '64px', // Doubled from 28px/32px to 56px/64px
        color: '#00ff88', // Changed from white to green to match holographic theme
        stroke: '#003311', // Dark green stroke for better contrast
        strokeThickness: 6, // Increased stroke thickness for better readability
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#00ff88',
          blur: 15,
          fill: true
        }
      }).setOrigin(0.5);
      
      // Add pulsing animation to the title for holographic effect
      this.tweens.add({
        targets: this.titleText,
        alpha: { from: 0.9, to: 1 },
        scale: { from: 0.98, to: 1.02 },
        duration: 2000,
        yoyo: true,
        repeat: -1
      });
    }
    
    // Detect input method - check if a gamepad is connected
    const gamepadConnected = this.input.gamepad && this.input.gamepad.total > 0;
    const isMobile = this.sys.game.device.input.touch;
    
    // Create navigation instructions based on available input methods
    let instructionText = '';
    
    // Only show keyboard instructions if not on a mobile device
    if (!isMobile) {
      instructionText += 'Use ← → arrows to select, ENTER to confirm, ESC to return';
    }
    
    // Add gamepad instructions if gamepad is detected and not on mobile
    if (gamepadConnected && !isMobile) {
      instructionText += '\nGamepad: D-pad/stick to navigate, A to confirm, B to return';
    }
    
    // Add touch instructions for mobile devices
    if (isMobile) {
      instructionText = 'Swipe or tap the arrows to Select your Character';
    }
    
    // Position instructions above the character sprite in portrait mode
    // Calculate sprite position for instructions placement
    // (Using the same calculation as for nameText positioning below)
    const characterY = this.isPortrait ? height * 0.6 : (this.isCompact ? height * 0.4 : height / 2 - 50);
    
    const instructionsY = this.isPortrait 
      ? characterY - 280  // Position even higher above character sprite in portrait
      : height - 80 - 50;  // Still near bottom in landscape
    
    // Adjust text size based on orientation and available space
    const fontSize = this.isPortrait 
      ? Math.max(12, Math.min(16, width / 30))  // Responsive size in portrait
      : '16px';
    
    this.instructionsText = this.add.text(width / 2, instructionsY, instructionText, {
      fontFamily: 'Tektur, Arial',
      fontSize: fontSize,
      color: '#00ff88', // Use consistent green color
      align: 'center'
    }).setOrigin(0.5);
    
    // Create a graphics object for CRT shader
    this.crtShader = this.add.graphics();
    
    // Create character preview container
    this.createCharacterPreviews();
    
    // Create the centralized name text - only visible in portrait mode
    // Calculate sprite position based on layout
    const spriteY = this.isPortrait ? height * 0.5 : (this.isCompact ? height * 0.5 : height / 2);
    const spriteX = this.isPortrait ? width * 0.5 : (this.isCompact ? width * 0.5 : width * 0.3);
    
    // Position name text directly under the sprite
    const nameY = spriteY + 185; // Adjusted to 75px lower than original
    
    // Use default character info for initial text style
    const defaultChar = this.characters[this.selectedIndex] || 'default';
    const defaultInfo = this.characterInfo[defaultChar] || {
      font: 'Tektur, Arial',
      colors: { primary: '#00ff88' }
    };
    
    // Create the central name text with character-specific styling
    this.nameText = this.add.text(spriteX, nameY, '', {
      fontFamily: defaultInfo.font, // Use character-specific font
      fontSize: '44px', // Large text for the name
      color: '#00ff88', // Use consistent green color
      stroke: '#003311',
      strokeThickness: 4 // Increased stroke thickness for better readability
    }).setOrigin(0.5);
    
    // Only show in portrait mode
    this.nameText.setVisible(this.isPortrait);
    
    // Hide the description text as it's no longer needed with the new layout
    this.descriptionText = this.add.text(width / 2, -100, '', { // Move off-screen
      fontFamily: 'Tektur, Arial',
      fontSize: '24px',
      color: '#00ff88', // Use consistent green color
      align: 'center',
      wordWrap: { width: width * 0.85 }
    }).setOrigin(0.5).setVisible(false);
    
    // Set proper depth for UI elements - removed black background
    this.nameText.setDepth(11);
    this.descriptionText.setDepth(11);
    
    // Add gamepad indicator if connected
    if (gamepadConnected) {
      this.gamepadIcon = this.add.text(
        width - 40, 
        40, 
        '🎮', 
        { 
          fontSize: '24px',
          shadow: {
            offsetX: 1,
            offsetY: 1,
            color: '#000000',
            blur: 5,
            fill: true
          }
        }
      );
      this.gamepadIcon.setOrigin(0.5);
      
      // Add a pulsing effect to the gamepad icon
      this.tweens.add({
        targets: this.gamepadIcon,
        scale: { from: 1, to: 1.2 },
        alpha: { from: 0.7, to: 1 },
        duration: 800,
        yoyo: true,
        repeat: -1
      });
    }
    
    // Setup input handlers
    this.setupInputs();
    
    // Update the selection display
    this.updateSelection();
    
    // After everything is created, validate the layout to fix any overlaps or issues
    this.validateAndFixLayout();
    
    // When coming from GameOverScene, ensure a button is selected by default (improving UX)
    if (this.fromGameOver) {
      console.log('Coming from GameOverScene - pre-selecting confirm button');
      this.setSelectedButton('confirm');
    }
  }
  
  createCharacterPreviews() {
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Position differently based on layout mode
    let leftSideX, rightSideX, centerY;
    
    if (this.isCompact || this.isPortrait) {
      // Centered layout for compact mode
      leftSideX = width * 0.5;
      rightSideX = width * 0.5;
      centerY = height * 0.5; // Moved lower from 0.4 to 0.5
    } else {
      // Regular side-by-side layout
      leftSideX = width * 0.3;
      rightSideX = width * 0.7;
      centerY = height / 2; // Moved lower from height/2-50 to height/2
    }
      
    // Initialize array to store character sprites
    this.characterSprites = [];
    this.profilePics = [];
    
    // Create container for left side (character avatar)
    this.avatarContainer = this.add.container(leftSideX, centerY);
    
    // Create container for right side (profile picture)
    // Only create if not in compact mode
    if (!this.isCompact && !this.isPortrait) {
      this.profileContainer = this.add.container(rightSideX - 80, centerY - 15);
    }
    
    // Clean up references
    this.crtBackground = null;
    this.crtFrame = null;
    this.avatarScanlines = null;
    this.avatarWarpMask = null; 
    this.avatarNoise = null;
    this.profileFrame = null;
    this.profileScanlinesMask = null;
    this.profileNoise = null;
    
    // Create a subtle glowing base for the holographic character
    this.hologramBase = this.add.circle(
      leftSideX, 
      centerY + 50, // Position a bit below the character
      90,
      0x00ff66, // Green base
      0.15 // Much lower opacity
    );
    
    // Make sure it's behind the character
    this.hologramBase.setDepth(-1);
    
    // Add a pulsing animation to the base
    this.tweens.add({
      targets: this.hologramBase,
      alpha: { from: 0.1, to: 0.15 },
      scale: { from: 0.95, to: 1.05 },
      duration: 2500,
      yoyo: true,
      repeat: -1
    });
    
    // Create animations for each character
    this.characters.forEach((char, index) => {
      // Create the animation key for this character
      const animKey = `${char}_walk_anim`;
      
      // Check if all required frames are loaded first to avoid errors in some browsers
      const frame1Exists = this.textures.exists(`${char}_walk_1`);
      const frame2Exists = this.textures.exists(`${char}_walk_2`);
      const frame3Exists = this.textures.exists(`${char}_walk_3`);
      const frame4Exists = this.textures.exists(`${char}_walk_4`);
      
      // Log any missing frames for debugging
      if (!frame1Exists || !frame2Exists || !frame3Exists || !frame4Exists) {
        console.warn(`Missing animation frames for character ${char}. Frames loaded: 1:${frame1Exists}, 2:${frame2Exists}, 3:${frame3Exists}, 4:${frame4Exists}`);
      }
      
      // Only create the animation if it doesn't exist yet and all frames are loaded
      if (!this.anims.exists(animKey) && frame1Exists && frame2Exists && frame3Exists && frame4Exists) {
        try {
          // Create the animation with explicit error handling
          this.anims.create({
            key: animKey,
            frames: [
              { key: `${char}_walk_1` },
              { key: `${char}_walk_2` },
              { key: `${char}_walk_3` },
              { key: `${char}_walk_4` }
            ],
            frameRate: 8,
            repeat: -1
          });
          console.log(`Created animation ${animKey} successfully`);
        } catch (error) {
          console.error(`Error creating animation for ${char}:`, error);
        }
      }
      
      // Create the sprite and play the animation
      const sprite = this.add.sprite(leftSideX, centerY);
      
      // Scale the sprite based on layout mode and device pixel ratio
      // For higher DPI displays we need to scale down a bit to avoid overly large sprites
      // Additional 33% scale reduction to fix Phantom WebView rendering issues
      const scaleModifier = Math.max(0.7, 1 / this.devicePixelRatio) * 0.67; // 33% scale reduction
      
      // Use our helper function for consistent scaling
      sprite.setScale(this.getSpriteScale());
      
      // Apply a much lighter holographic effect for better visibility
      sprite.setTint(0x88ffaa); // Lighter green tint
      sprite.setAlpha(1); // No transparency for the character
      
      // Only apply preFX in WebGL mode, not in CANVAS mode
      if (!this.useCanvas && sprite.preFX) {
        // Apply contrast and brightness filters for CRT look (WebGL only)
        try {
          sprite.preFX.addColorMatrix().brightness(1.1).contrast(1.3).saturate(1.2);
        } catch (e) {
          console.warn('Failed to apply preFX filters to sprite:', e);
        }
      } else {
        console.log('Skipping WebGL effects for better compatibility');
      }
      
      // Only show the selected character
      sprite.setVisible(index === this.selectedIndex);
      
      // Store the animation key with the sprite for later use
      sprite.animKey = animKey;
      
      // Play the animation if this is the selected character
      if (index === this.selectedIndex) {
        // Check if animation exists before playing to prevent errors
        if (this.anims.exists(animKey)) {
          try {
            sprite.play(animKey);
            // Add a fallback in case animation doesn't start
            if (!sprite.anims.isPlaying) {
              console.log(`Animation not playing for ${char}, attempting to restart`);
              // Try again with a slight delay
              this.time.delayedCall(100, () => {
                sprite.play(animKey);
              });
            }
          } catch (error) {
            console.error(`Error playing animation for ${char}:`, error);
          }
        } else {
          console.warn(`Animation ${animKey} doesn't exist for character ${char}`);
        }
      }
      
      this.characterSprites.push(sprite);
      
      // Get character info
      const info = this.characterInfo[char] || { 
        name: char, 
        description: 'No description available.',
        font: 'Tektur, Arial',
        colors: { primary: '#00ff88', secondary: '#00cc66' }
      };
      
      // Create character name text - only visible in landscape mode (portrait or not)
      let nameY;
      // Position name appropriately for compact or normal mode
      if (this.isCompact) {
        nameY = centerY - 140; // Higher position in compact mode
      } else {
        nameY = centerY - 236; // Higher position in normal mode
      }
      
      // Scale font sizes based on DPI
      const fontScaleModifier = Math.max(0.85, 1 / Math.sqrt(this.devicePixelRatio));
      const compactFontSize = Math.round(40 * fontScaleModifier);
      const regularFontSize = Math.round(56 * fontScaleModifier);
      
      const nameText = this.add.text(
        this.isCompact ? leftSideX : rightSideX - 80, 
        nameY,
        info.name.toUpperCase(), 
        {
          fontFamily: info.font,
          fontSize: this.isCompact ? `${compactFontSize}px` : `${regularFontSize}px`,
          color: '#00ff88', // Use consistent green color
          align: 'center',
          stroke: '#003311',
          strokeThickness: 2
        }
      ).setOrigin(0.5);
      
      // IMPORTANT: Only show in landscape mode, hide in portrait mode
      nameText.setVisible(!this.isPortrait);
      
      // Create profile elements only in normal mode
      let profilePic, profileBorder, shortDescText, descText, vignette;
      
      if (!this.isCompact && !this.isPortrait) {
        // Add short description below name
        shortDescText = this.add.text(
          rightSideX - 80,
          centerY - 180, // Position below name text
          '[' + (info.shortDesc || '') + ']',
          {
            fontFamily: 'Tektur, Arial',
            fontSize: '24px',
            color: '#00dd77',
            align: 'center',
            stroke: '#003311',
            strokeThickness: 1
          }
        ).setOrigin(0.5);
        
        // Create profile picture below the name
        profilePic = this.add.image(rightSideX - 80, centerY - 15, `${char}_profile`);
        
        // Scale the profile picture
        profilePic.setScale(0.2);
        
        // Apply CRT effects to profile picture only in WebGL mode
        if (!this.useCanvas && profilePic.preFX) {
          try {
            profilePic.preFX.addColorMatrix().brightness(1.1).contrast(1.3).saturate(1.2);
          } catch (e) {
            console.warn('Failed to apply preFX filters to profile pic:', e);
          }
        }
        
        // Create an empty container as a placeholder for the border
        profileBorder = this.add.container(profilePic.x, profilePic.y);
        
        // No vignettes/black backgrounds needed behind profile pics
        vignette = null;
        
        // Add description text below the profile picture
        descText = this.add.text(
          profilePic.x, 
          profilePic.y + profilePic.displayHeight/2 + 20,
          info.description, 
          {
            fontFamily: 'Tektur, Arial',
            fontSize: '24px',
            color: '#00dd77',
            align: 'center',
            wordWrap: { width: width * 0.4 }
          }
        ).setOrigin(0.5, 0);
        
        // Set visibility based on selection
        profilePic.setVisible(index === this.selectedIndex);
        profileBorder.setVisible(index === this.selectedIndex);
        shortDescText.setVisible(index === this.selectedIndex);
        descText.setVisible(index === this.selectedIndex);
        
        // Store references for the profile picture
        if (profilePic) {
          profilePic.border = profileBorder;
          profilePic.nameText = nameText;
          profilePic.shortDescText = shortDescText;
          profilePic.descText = descText;
          profilePic.vignette = null; // No vignettes used
          this.profilePics.push(profilePic);
        }
      } else {
        // For compact mode, store minimal references with proper dummy functions
        const dummyProfilePic = { 
          nameText: nameText,
          shortDescText: null,
          descText: null,
          border: null,
          vignette: null, // No vignettes used
          setVisible: function() {}, // Dummy function
          setAlpha: function() {}    // Dummy function
        };
        this.profilePics.push(dummyProfilePic);
      }
      
      // Only show the selected character's name
      nameText.setVisible(index === this.selectedIndex);
    });
    
    // Add a very subtle horizontal scan effect that moves up and down
    const scanEffect = this.add.rectangle(
      leftSideX,
      centerY,
      160,
      4, // Even thinner scan line
      0x00ffaa,
      0.1 // Much more transparent
    );
    
    // Make sure it's behind the character
    scanEffect.setDepth(-1);
    
    // Add scanning animation
    this.tweens.add({
      targets: scanEffect,
      y: { from: centerY - 80, to: centerY + 80 },
      alpha: { from: 0.05, to: 0.1 }, // Very minimal alpha
      duration: 4000, // Even slower movement
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    
    // Store scan effect for later access
    this.scanEffect = scanEffect;
    
    // Initialize scanline effects immediately to ensure they're created
    // This ensures they exist before the first update() call
    this.scanlineOffset = 0;
    this.flickerIntensity = 1;
    this.noiseTime = 0;
    this.warpTime = 0;
    
    // Create global scanlines if they don't exist yet
    if (!this.globalScanlines) {
      this.globalScanlines = this.add.graphics();
      this.globalScanlines.setDepth(100); // Put scanlines on top of everything
    }
    
    // Create global noise if it doesn't exist yet
    if (!this.globalNoise) {
      this.globalNoise = this.add.graphics();
      this.globalNoise.setDepth(101); // Above scanlines
    }
    
    // Clear vignettes array - we won't be using vignettes anywhere
    this.vignettes = [];
  }
  
  setupInputs() {
    // First, remove any existing listeners to prevent duplicates, especially when coming from GameOverScene
    // This solves the issue where buttons don't work after GameOver scene
    this.input.keyboard.off('keydown-LEFT');
    this.input.keyboard.off('keydown-RIGHT');
    this.input.keyboard.off('keydown-UP');
    this.input.keyboard.off('keydown-DOWN');
    this.input.keyboard.off('keydown-ENTER');
    this.input.keyboard.off('keydown-ESC');
    this.input.keyboard.off('keydown-SPACE');
    
    console.log('Setting up input listeners for CharacterSelectScene');
    if (this.fromGameOver) {
      console.log('Setting up inputs after GameOverScene transition - clearing previous listeners');
    }
    
    // Arrow keys for navigation
    this.input.keyboard.on('keydown-LEFT', () => {
      this.selectPrevious();
    });
    
    this.input.keyboard.on('keydown-RIGHT', () => {
      this.selectNext();
    });
    
    // Up/Down to navigate between buttons
    this.input.keyboard.on('keydown-UP', () => {
      if (this.currentSelectedButton === 'confirm') {
        this.setSelectedButton('back');
      } else {
        this.setSelectedButton('confirm');
      }
    });
    
    this.input.keyboard.on('keydown-DOWN', () => {
      if (this.currentSelectedButton === 'back') {
        this.setSelectedButton('confirm');
      } else {
        this.setSelectedButton('confirm');
      }
    });
    
    // Enter to confirm selection
    this.input.keyboard.on('keydown-ENTER', () => {
      console.log('ENTER pressed, current button:', this.currentSelectedButton);
      if (this.currentSelectedButton === 'back') {
        this.returnToMenu();
      } else {
        this.confirmSelection();
      }
    });
    
    // ESC to return to menu
    this.input.keyboard.on('keydown-ESC', () => {
      this.returnToMenu();
    });
    
    // Setup gamepad support
    this.setupGamepadControls();
    
    // Setup touch controls
    this.setupTouchControls();
  }
  
  setupGamepadControls() {
    // Skip setup if gamepad is not available in this browser
    if (!this.input.gamepad || !this.input.gamepad.on) {
      console.log('Gamepad not available in this browser');
      return;
    }
    
    // First, remove any existing gamepad listeners to prevent duplicates
    if (this.fromGameOver) {
      console.log('Cleaning up gamepad listeners after GameOverScene transition');
      this.input.gamepad.off('down');
      this.input.gamepad.off('connected');
    }
    
    // Enable gamepad input
    this.input.gamepad.enabled = true;
    
    // Handle gamepad connection
    this.input.gamepad.on('connected', (pad) => {
      console.log(`Gamepad connected in CharacterSelectScene: ${pad.id}`);
      this.gamepad = pad;
    });
    
    // Add gamepad button press handler
    this.input.gamepad.on('down', (pad, button, index) => {
      console.log(`Gamepad button pressed in CharacterSelectScene: ${index}`);
      
      // A button or Start button (0 or 9) to confirm
      if (index === 0 || index === 9) {
        console.log('Gamepad A/Start pressed, current button:', this.currentSelectedButton);
        if (this.currentSelectedButton === 'back') {
          this.returnToMenu();
        } else {
          this.confirmSelection();
        }
      }
      
      // B button (1) to return to menu
      if (index === 1) {
        this.returnToMenu();
      }
      
      // D-pad left (14) for previous character
      if (index === 14) {
        this.selectPrevious();
      }
      
      // D-pad right (15) for next character
      if (index === 15) {
        this.selectNext();
      }
      
      // D-pad up (12) to navigate between buttons
      if (index === 12) {
        if (this.currentSelectedButton === 'confirm') {
          this.setSelectedButton('back');
        } else {
          this.setSelectedButton('confirm');
        }
      }
      
      // D-pad down (13) to navigate between buttons
      if (index === 13) {
        if (this.currentSelectedButton === 'back') {
          this.setSelectedButton('confirm');
        } else {
          this.setSelectedButton('confirm');
        }
      }
    });
    
    // Check for already connected gamepads
    if (this.input.gamepad.total > 0) {
      console.log(`Found ${this.input.gamepad.total} gamepads already connected in CharacterSelectScene`);
      this.gamepad = this.input.gamepad.getPad(0);
    }
    
    // Update function for continuous gamepad input (left stick)
    this.gamepadLastActive = 0; // Timestamp to throttle gamepad inputs
  }
  
  setupTouchControls() {
    const width = this.scale.width;
    const height = this.scale.height;
    const isMobile = this.sys.game.device.input.touch;
    
    // Size and positioning vary by orientation
    const arrowSize = isMobile ? (this.isPortrait ? 60 : 96) : 64; // Smaller arrows in portrait mode
    
    // In portrait mode, position arrows around the character display area
    const horizontalPadding = this.isPortrait 
      ? 40  // Reduced fixed distance from edge in portrait
      : width / 10;  // Percentage-based in landscape
    
    // In portrait mode, position arrows below the character display
    // In landscape, position them at vertical center
    const arrowY = this.isPortrait 
      ? height / 2 + 10  // Below the center in portrait where characters are shown
      : height / 2;
    
    // Create arrow navigation with no background
    // Set up the left arrow for interaction
    const leftArrowBg = this.add.circle(
      horizontalPadding,
      arrowY,
      arrowSize / 1.5,
      0x000000,
      0
    );
    leftArrowBg.setInteractive();
    leftArrowBg.on('pointerdown', () => {
      this.selectPrevious();
      this.animateButtonPress(leftArrowBg);
    });
    
    // Add left arrow for previous character
    const leftArrow = this.add.text(
      horizontalPadding, 
      arrowY, 
      '←', 
      {
        fontFamily: 'Tektur, Arial',
        fontSize: `${arrowSize}px`,
        color: '#ffffff'
      }
    );
    leftArrow.setOrigin(0.5);
    
    // Right arrow - no visible background
    const rightArrowBg = this.add.circle(
      width - horizontalPadding,
      arrowY,
      arrowSize / 1.5,
      0x000000,
      0
    );
    rightArrowBg.setInteractive();
    rightArrowBg.on('pointerdown', () => {
      this.selectNext();
      this.animateButtonPress(rightArrowBg);
    });
    
    // Add right arrow for next character
    const rightArrow = this.add.text(
      width - horizontalPadding, 
      arrowY, 
      '→', 
      {
        fontFamily: 'Tektur, Arial',
        fontSize: `${arrowSize}px`,
        color: '#ffffff'
      }
    );
    rightArrow.setOrigin(0.5);
    
    // Since we're only showing one character at a time, 
    // we don't need direct selection of character sprites anymore
    
    // Add swipe detection for mobile
    this.input.on('pointerup', (pointer) => {
      if (pointer.downX && pointer.upX) {
        const swipeDistance = pointer.upX - pointer.downX;
        // If the swipe is more than 50px, consider it a swipe
        if (Math.abs(swipeDistance) > 50) {
          if (swipeDistance > 0) {
            this.selectPrevious();
          } else {
            this.selectNext();
          }
        }
      }
    });
    
    // Position buttons based on orientation with more space in portrait mode
    const confirmY = this.isPortrait 
      ? height - 100  // Move up in portrait for more breathing room
      : height - 80;
      
    const backButtonX = this.isPortrait 
      ? 70  // Left side of screen in portrait
      : 90;
      
    const backButtonY = this.isPortrait 
      ? 50  // Top of screen in portrait
      : height - 80;
    
    // Scale font sizes based on DPI
    const fontScaleModifier = Math.max(0.85, 1 / Math.sqrt(this.devicePixelRatio));
    const confirmFontSize = Math.round((this.isPortrait ? 26 : 24) * fontScaleModifier);
    const backFontSize = Math.round(20 * fontScaleModifier);
    
    // Create CONFIRM text with console styling
    this.confirmText = this.add.text(
      width / 2,
      confirmY,
      'CONFIRM',
      {
        fontFamily: 'Tektur, Arial',
        fontSize: `${confirmFontSize}px`,
        color: '#00ff88', // Use consistent green color
        align: 'center'
      }
    ).setOrigin(0.5);
    
    // Make text interactive
    this.confirmText.setInteractive({ useHandCursor: true });
    
    // Create BACK text with console styling
    this.backText = this.add.text(
      backButtonX,
      backButtonY,
      'BACK',
      {
        fontFamily: 'Tektur, Arial',
        fontSize: `${backFontSize}px`,
        color: '#00ff88', // Use consistent green color
        align: 'center'
      }
    ).setOrigin(0.5);
    
    // Make text interactive
    this.backText.setInteractive();
    
    // Setup cursor blinking animation
    this.cursorVisible = true;
    this.cursorTimer = this.time.addEvent({
      delay: 530,
      callback: () => {
        this.cursorVisible = !this.cursorVisible;
        this.updateCursorVisibility();
      },
      loop: true
    });
    
    // Track selection state
    this.currentSelectedButton = null;
    
    // Add hover/focus effects
    this.confirmText.on('pointerover', () => {
      this.setSelectedButton('confirm');
    });
    
    this.confirmText.on('pointerout', () => {
      this.setSelectedButton(null);
    });
    
    this.confirmText.on('pointerdown', () => {
      this.confirmSelection();
    });
    
    this.backText.on('pointerover', () => {
      this.setSelectedButton('back');
    });
    
    this.backText.on('pointerout', () => {
      this.setSelectedButton(null);
    });
    
    this.backText.on('pointerdown', () => {
      this.returnToMenu();
    });
  }
  
  // Helper method to animate button press for touch feedback
  animateButtonPress(button) {
    this.tweens.add({
      targets: button,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 50,
      yoyo: true,
      ease: 'Power1'
    });
    
    // Add sound feedback if available
    if (this.sound && this.sound.add) {
      this.sound.play('keystroke', { volume: 0.3 });
    }
  }
  
  selectPrevious() {
    this.selectedIndex = (this.selectedIndex - 1 + this.characters.length) % this.characters.length;
    this.updateSelection();
  }
  
  selectNext() {
    this.selectedIndex = (this.selectedIndex + 1) % this.characters.length;
    this.updateSelection();
  }
  
  // Create a hologram glitch effect
  createHologramGlitch() {
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Determine positions based on current layout
    let leftSideX, centerY;
    
    if (this.isPortrait) {
      leftSideX = width * 0.5; // Center in portrait
      centerY = height * 0.6; // Lower position in portrait to match sprite position
    } else {
      leftSideX = width * 0.3;
      centerY = height / 2 - 50;
    }
    
    const rightSideX = this.isPortrait ? width * 0.5 : width * 0.7;
    
    // In portrait mode, scale down the glitch effects
    const glitchScale = this.isPortrait ? 0.5 : 1.0;
    
    // Create glitch effects for both character sprite and profile pic
    
    // Character sprite glitches (left side)
    for (let i = 0; i < 3; i++) {
      // Create random offset rectangles for character
      const xOffset = Phaser.Math.Between(-15, 15) * glitchScale;
      const yOffset = Phaser.Math.Between(-10, 10) * glitchScale;
      const rectWidth = Phaser.Math.Between(30, 100) * glitchScale;
      const rectHeight = Phaser.Math.Between(5, 15) * glitchScale;
      
      // Use our calculated character position
      const characterX = leftSideX;
      
      const glitch = this.add.rectangle(
        characterX + xOffset,
        centerY + yOffset,
        rectWidth,
        rectHeight,
        0x00ffaa,
        Phaser.Math.FloatBetween(0.3, 0.7)
      );
      
      // Add a quick fade out
      this.tweens.add({
        targets: glitch,
        alpha: 0,
        scaleX: Phaser.Math.FloatBetween(0.8, 1.2),
        duration: Phaser.Math.Between(100, 300),
        onComplete: () => {
          glitch.destroy();
        }
      });
    }
    
    // Profile picture glitches (right side)
    for (let i = 0; i < 2; i++) {
      // Create random offset rectangles for profile pic
      const xOffset = Phaser.Math.Between(-8, 8) * glitchScale;
      const yOffset = Phaser.Math.Between(-5, 5) * glitchScale;
      const rectWidth = Phaser.Math.Between(15, 30) * glitchScale; // Smaller for the smaller profile
      const rectHeight = Phaser.Math.Between(2, 5) * glitchScale; // Smaller height
      
      // In portrait mode, position glitches differently
      const glitchX = this.isPortrait ? rightSideX + xOffset : rightSideX - 80 + xOffset;
      const glitchY = this.isPortrait ? centerY - 100 + yOffset : centerY - 15 + yOffset;
      
      const glitch = this.add.rectangle(
        glitchX,
        glitchY,
        rectWidth,
        rectHeight,
        0x00ffaa,
        Phaser.Math.FloatBetween(0.3, 0.7)
      );
      
      // Add a quick fade out
      this.tweens.add({
        targets: glitch,
        alpha: 0,
        scaleX: Phaser.Math.FloatBetween(0.8, 1.2),
        duration: Phaser.Math.Between(100, 300),
        onComplete: () => {
          glitch.destroy();
        }
      });
    }
    
    // Create a momentary flicker in the global scanlines
    if (this.globalScanlines) {
      // Briefly increase opacity of global scanlines
      const originalAlpha = this.globalScanlines.alpha || 1;
      this.globalScanlines.setAlpha(0.3); // Make scanlines more visible during glitch
      
      // Reset after a short time
      this.time.delayedCall(150, () => {
        this.globalScanlines.setAlpha(originalAlpha);
      });
      
      // Add an extra glitch line
      const glitchY = Phaser.Math.Between(0, this.scale.height);
      const glitchHeight = Phaser.Math.Between(2, 5);
      
      const glitchLine = this.add.rectangle(
        width / 2,
        glitchY,
        width,
        glitchHeight,
        0xffffff,
        0.4
      );
      glitchLine.setDepth(102);
      
      // Make it fade out quickly
      this.tweens.add({
        targets: glitchLine,
        alpha: 0,
        width: width * 1.1,
        duration: 150,
        onComplete: () => {
          glitchLine.destroy();
        }
      });
    }
    
    // Play a static/interference sound if available
    if (this.sound && this.sound.add) {
      if (this.sound.get('interference')) {
        this.sound.play('interference', { volume: 0.2 });
      } else if (this.sound.get('keystroke')) {
        // Fallback to another sound if interference isn't available
        this.sound.play('keystroke', { volume: 0.2 });
      }
    }
  }
  
  updateSelection() {
    // Store the currently visible sprite before hiding all sprites
    const previouslyVisibleIndex = this.characterSprites.findIndex(sprite => sprite.visible);
    const previousSprite = previouslyVisibleIndex !== -1 ? this.characterSprites[previouslyVisibleIndex] : null;
    const previousProfile = previouslyVisibleIndex !== -1 ? this.profilePics[previouslyVisibleIndex] : null;
    
    // Hide ALL character sprites and profiles to ensure nothing is left behind
    this.characterSprites.forEach((sprite, index) => {
      sprite.setVisible(false);
    });
    
    // Ensure all profiles and their related elements are hidden
    this.profilePics.forEach(profile => {
      // In compact/portrait mode some profile elements are null/undefined
      // Only set properties that exist on the profile
      if (profile.setVisible) profile.setVisible(false);
      if (profile.border) profile.border.setVisible(false);
      if (profile.nameText) {
        profile.nameText.setVisible(false);
        // Ensure nameText is always at a high depth to prevent it being hidden behind the sprite
        profile.nameText.setDepth(9999);
      }
      if (profile.shortDescText) {
        profile.shortDescText.setVisible(false);
        profile.shortDescText.setDepth(9999);
      }
      if (profile.descText) {
        profile.descText.setVisible(false);
        profile.descText.setDepth(9999);
      }
      
      // Kill any tweens on these elements
      if (profile.setVisible) this.tweens.killTweensOf(profile);
      if (profile.border) this.tweens.killTweensOf(profile.border);
      if (profile.nameText) this.tweens.killTweensOf(profile.nameText);
      if (profile.shortDescText) this.tweens.killTweensOf(profile.shortDescText);
      if (profile.descText) this.tweens.killTweensOf(profile.descText);
    });
    
    // We no longer have individual profile scanlines, so this section is unnecessary
    
    // Get the newly selected character sprite and profile
    const selectedSprite = this.characterSprites[this.selectedIndex];
    const selectedProfile = this.profilePics[this.selectedIndex];
    
    // Reset hologram glitch effect timing for a new glitch animation
    this.nextGlitchTime = this.time.now + Phaser.Math.Between(2000, 5000);
    
    // If we had a previously visible sprite and it's different from the new selection,
    // create a transition effect
    if (previousSprite && previousSprite !== selectedSprite) {
      // Stop any playing animation on the previous sprite
      if (previousSprite.anims && previousSprite.anims.isPlaying) {
        previousSprite.anims.stop();
      }
      
      // Add a hologram glitch effect
      this.createHologramGlitch();
      
      // Fade out the previous sprite
      this.tweens.add({
        targets: previousSprite,
        alpha: 0,
        scale: this.isPortrait ? 1.5 : 2,
        duration: 200,
        onComplete: () => {
          previousSprite.setVisible(false);
          previousSprite.setAlpha(1); // Reset alpha for next time
        }
      });
      
      // Fade out the previous profile
      if (previousProfile) {
        // Handle differently based on layout mode
        if (!this.isCompact && !this.isPortrait) {
          // In normal mode, fade out all profile elements
          // Hide previous profile pic with animation
          // Create an array with targets that actually exist
          const targets = [];
          if (previousProfile.setVisible) targets.push(previousProfile);
          if (previousProfile.border) targets.push(previousProfile.border);
          
          if (targets.length > 0) {
            this.tweens.add({
              targets: targets,
              alpha: 0,
              duration: 200,
              onComplete: () => {
                if (previousProfile.setVisible) {
                  previousProfile.setVisible(false);
                  previousProfile.setAlpha(1);
                }
                if (previousProfile.border) {
                  previousProfile.border.setVisible(false);
                  previousProfile.border.setAlpha(1);
                }
              }
            });
          }
          
          // Hide previous text elements - make sure to only include elements that exist
          const textTargets = [];
          if (previousProfile.nameText) textTargets.push(previousProfile.nameText);
          if (previousProfile.shortDescText) textTargets.push(previousProfile.shortDescText);
          if (previousProfile.descText) textTargets.push(previousProfile.descText);
          
          if (textTargets.length > 0) {
            this.tweens.add({
              targets: textTargets,
              alpha: 0,
              duration: 200,
              onComplete: () => {
                if (previousProfile.nameText) {
                  previousProfile.nameText.setVisible(false);
                  previousProfile.nameText.setAlpha(1);
                }
                if (previousProfile.shortDescText) {
                  previousProfile.shortDescText.setVisible(false);
                  previousProfile.shortDescText.setAlpha(1);
                }
                if (previousProfile.descText) {
                  previousProfile.descText.setVisible(false);
                  previousProfile.descText.setAlpha(1);
                }
              }
            });
          }
        } else {
          // In compact/portrait mode, only fade out the name text and ensure vignette is cleared
          this.tweens.add({
            targets: previousProfile.nameText,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              previousProfile.nameText.setVisible(false);
              previousProfile.nameText.setAlpha(1);
              
              // No vignettes to clear
            }
          });
        }
      }
      
      // Set the selected sprite initial state for animation
      selectedSprite.setVisible(true);
      selectedSprite.setAlpha(0);
      selectedSprite.setScale(this.getSpriteScale() * 0.75); // Use 75% of final scale for starting animation
      
      // Ensure animation is ready to play
      if (!selectedSprite.anims.isPlaying) {
        // Start playing animation immediately to ensure it's visible in all browsers
        selectedSprite.play(selectedSprite.animKey);
      }
      
      // Fade in the selected sprite
      this.tweens.add({
        targets: selectedSprite,
        alpha: 1, // Full visibility for character
        scale: this.getSpriteScale(),
        duration: 250,
        ease: 'Back.easeOut',
        delay: 100, // Small delay for better visual effect
        onComplete: () => {
          // Make sure animation is still playing after tween completes
          if (!selectedSprite.anims.isPlaying) {
            selectedSprite.play(selectedSprite.animKey);
          }
        }
      });
      
      // Fade in the selected profile if we're not in compact mode
      if (!this.isCompact && !this.isPortrait) {
        selectedProfile.setVisible(true);
        selectedProfile.border.setVisible(true);
        selectedProfile.setAlpha(0);
        selectedProfile.border.setAlpha(0);
        
        // Create an array of targets that actually exist
        const targets = [selectedProfile];
        if (selectedProfile.border) targets.push(selectedProfile.border);
        
        this.tweens.add({
          targets: targets,
          alpha: 1,
          duration: 250,
          delay: 150,
          ease: 'Sine.easeOut'
        });
        
        // Fade in text elements
        selectedProfile.nameText.setVisible(true);
        selectedProfile.shortDescText.setVisible(true);
        selectedProfile.descText.setVisible(true);
        selectedProfile.nameText.setAlpha(0);
        selectedProfile.shortDescText.setAlpha(0);
        selectedProfile.descText.setAlpha(0);
      } else if (!this.isPortrait) {
        // In landscape mode (whether compact or not), show the character's name text
        selectedProfile.nameText.setVisible(true);
        selectedProfile.nameText.setAlpha(0);
        // Ensure the name text is always on top of the sprite
        selectedProfile.nameText.setDepth(9999);
        this.children.bringToTop(selectedProfile.nameText);
      } else {
        // In portrait mode, make sure the name text is ALWAYS hidden
        selectedProfile.nameText.setVisible(false);
      }
      
      // Animate the name text only in non-portrait modes
      const nameTextY = selectedProfile.nameText.y;
      if (this.isSuperCompact && !this.isPortrait) {
        // In super compact mode (but not portrait), don't animate the Y position
        this.tweens.add({
          targets: selectedProfile.nameText,
          alpha: 1,
          duration: 300,
          delay: 200,
          ease: 'Back.easeOut'
        });
      } else if (!this.isPortrait) {
        // In normal landscape mode, animate both alpha and Y position
        this.tweens.add({
          targets: selectedProfile.nameText,
          alpha: 1,
          y: { from: nameTextY - 10, to: nameTextY },
          duration: 300,
          delay: 200,
          ease: 'Back.easeOut'
        });
      }
      // No animation for portrait mode because we're hiding those names
      
      // Only animate additional elements if they exist (not in compact/portrait mode)
      if (!this.isCompact && !this.isPortrait) {
        // Ensure text elements are always above other elements
        if (selectedProfile.shortDescText) {
          selectedProfile.shortDescText.setDepth(9999);
          this.children.bringToTop(selectedProfile.shortDescText);
        }
        
        if (selectedProfile.descText) {
          selectedProfile.descText.setDepth(9999);
          this.children.bringToTop(selectedProfile.descText);
        }
        
        this.tweens.add({
          targets: selectedProfile.shortDescText,
          alpha: 1,
          y: { from: selectedProfile.shortDescText.y - 10, to: selectedProfile.shortDescText.y },
          duration: 300,
          delay: 225,
          ease: 'Back.easeOut'
        });
        
        this.tweens.add({
          targets: selectedProfile.descText,
          alpha: 1,
          y: { from: selectedProfile.descText.y - 10, to: selectedProfile.descText.y },
          duration: 300,
          delay: 250,
          ease: 'Back.easeOut'
        });
      }
    } else {
      // No previous sprite or same sprite, just show the selected one
      selectedSprite.setVisible(true);
      
      // Play the walking animation immediately, before any tweens
      // This helps with browser compatibility issues
      if (selectedSprite.anims && !selectedSprite.anims.isPlaying) {
        selectedSprite.play(selectedSprite.animKey);
      }
      
      // Add a scaling animation for character change
      this.tweens.add({
        targets: selectedSprite,
        scale: { from: this.getSpriteScale() * 0.9, to: this.getSpriteScale() },
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Ensure animation is still playing after tween
          if (selectedSprite.anims && !selectedSprite.anims.isPlaying) {
            selectedSprite.play(selectedSprite.animKey);
          }
        }
      });
      
      // Show profile elements based on mode
      if (!this.isCompact && !this.isPortrait) {
        selectedProfile.setVisible(true);
        selectedProfile.border.setVisible(true);
        selectedProfile.nameText.setVisible(true);
        selectedProfile.shortDescText.setVisible(true);
        selectedProfile.descText.setVisible(true);
      } else if (!this.isPortrait) {
        // Only show name text in compact mode BUT NOT in portrait mode
        selectedProfile.nameText.setVisible(true);
        selectedProfile.nameText.setDepth(9999);
        this.children.bringToTop(selectedProfile.nameText);
      } else {
        // In portrait mode, make sure name text is hidden
        if (selectedProfile.nameText) {
          selectedProfile.nameText.setVisible(false);
        }
      }
    }
    
    // Bring selected character to front
    this.children.bringToTop(selectedSprite);
    
    // Get character info for the main nameText
    const selectedChar = this.characters[this.selectedIndex];
    const charInfo = this.characterInfo[selectedChar] || { name: selectedChar };
    
    // Update the main nameText with the current character's name (only visible in portrait mode)
    if (this.nameText) {
      // Update text content
      this.nameText.setText(charInfo.name.toUpperCase());
      
      // Update font to character-specific font
      this.nameText.setFontFamily(charInfo.font || 'Tektur, Arial');
      
      // Maintain consistent green color
      this.nameText.setColor('#00ff88');
      
      // Ensure proper depth and visibility
      this.nameText.setDepth(9999);
      this.children.bringToTop(this.nameText);
      
      // Maintain visibility - only show in portrait mode
      this.nameText.setVisible(this.isPortrait);
    }
    
    // After bringing the sprite to front, also ensure text elements stay on top
    if (selectedProfile.nameText) {
      selectedProfile.nameText.setDepth(9999);
      this.children.bringToTop(selectedProfile.nameText);
    }
    if (selectedProfile.shortDescText && selectedProfile.shortDescText.visible) {
      selectedProfile.shortDescText.setDepth(9999);
      this.children.bringToTop(selectedProfile.shortDescText);
    }
    if (selectedProfile.descText && selectedProfile.descText.visible) {
      selectedProfile.descText.setDepth(9999);
      this.children.bringToTop(selectedProfile.descText);
    }
    
    // Play sound effect if available
    if (this.sound && this.sound.add && !this.muteSelectionSound) {
      this.sound.play('keystroke', { volume: 0.2 });
      
      // Mute for a brief moment to prevent sound spam
      this.muteSelectionSound = true;
      this.time.delayedCall(100, () => {
        this.muteSelectionSound = false;
      });
    }
  }
  
  confirmSelection() {
    const selectedCharacter = this.characters[this.selectedIndex];
    
    // Store the selected character in the registry
    this.registry.set('selectedCharacter', selectedCharacter);
    
    // Also store the character info for use in other scenes
    this.registry.set('characterInfo', this.characterInfo);
    
    // Don't recreate animations here - we'll do it in the GameScene init
    console.log(`Selected character: ${selectedCharacter}`);
    
    // Check if we're in versus mode
    if (this.versusMode) {
      // Start game directly in versus mode
      console.log('Starting game in versus mode');
      this.scene.start('GameScene', { versusMode: true });
    } else {
      // Go directly to the commercial and game start screen
      this.scene.start('MenuScene', { startHypeScreen: true });
    }
  }
  
  returnToMenu() {
    // Stop character select music if it exists
    if (this.characterSelectMusic && this.characterSelectMusic.isPlaying) {
      this.characterSelectMusic.stop();
    }
    // Also check registry
    const characterSelectMusic = this.registry.get('characterSelectMusic');
    if (characterSelectMusic && characterSelectMusic.isPlaying) {
      characterSelectMusic.stop();
    }
    // Clear the registry reference to prevent any further usage
    this.registry.set('characterSelectMusic', null);
    
    this.scene.start('MenuScene');
  }
  
  shutdown() {
    // Stop any active tweens
    this.tweens.killAll();
    
    // Remove event listeners
    this.scale.off('resize', this.handleResize, this);
    this.input.keyboard.off('keydown-LEFT');
    this.input.keyboard.off('keydown-RIGHT');
    this.input.keyboard.off('keydown-UP');
    this.input.keyboard.off('keydown-DOWN');
    this.input.keyboard.off('keydown-SPACE');
    this.input.keyboard.off('keydown-ENTER');
    this.input.keyboard.off('keydown-ESC');
    
    // Stop any sounds
    this.sound.getAll().forEach(sound => {
      sound.stop();
    });
    
    // DO NOT destroy the scanlines here - let the next scene handle them
    // This prevents the effect from disappearing during scene transitions
    
    // Call parent shutdown
    super.shutdown();
  }
  
  // Handle UI layout updates when window size changes without orientation change
  // Method to set the currently selected button
  setSelectedButton(buttonName) {
    // Update the current selected button
    this.currentSelectedButton = buttonName;
    
    // Update text displays
    if (buttonName === 'confirm') {
      this.confirmText.setText('>CONFIRM');
    } else {
      this.confirmText.setText('CONFIRM');
    }
    
    if (buttonName === 'back') {
      this.backText.setText('>BACK');
    } else {
      this.backText.setText('BACK');
    }
    
    // Update cursor visibility based on new selection
    this.updateCursorVisibility();
  }
  
  // Method to update cursor visibility (blinking underscore)
  updateCursorVisibility() {
    // Only add cursor to selected button
    if (this.currentSelectedButton === 'confirm') {
      // Add or remove the cursor based on blink state
      this.confirmText.setText(this.cursorVisible ? '>CONFIRM_' : '>CONFIRM ');
    } else if (this.currentSelectedButton === 'back') {
      // Add or remove the cursor based on blink state
      this.backText.setText(this.cursorVisible ? '>BACK_' : '>BACK ');
    }
  }
  
  // Checks if two UI elements are overlapping
  checkOverlap(element1, element2, padding = 0) {
    // Skip if either element doesn't exist
    if (!element1 || !element2) return false;
    
    // Get bounds of both elements, accounting for origin
    const bounds1 = {
      left: element1.x - (element1.width * element1.originX),
      right: element1.x + (element1.width * (1 - element1.originX)),
      top: element1.y - (element1.height * element1.originY),
      bottom: element1.y + (element1.height * (1 - element1.originY))
    };
    
    const bounds2 = {
      left: element2.x - (element2.width * element2.originX),
      right: element2.x + (element2.width * (1 - element2.originX)),
      top: element2.y - (element2.height * element2.originY),
      bottom: element2.y + (element2.height * (1 - element2.originY))
    };
    
    // Check for overlap with additional padding
    return !(
      bounds1.right + padding < bounds2.left ||
      bounds1.left > bounds2.right + padding ||
      bounds1.bottom + padding < bounds2.top ||
      bounds1.top > bounds2.bottom + padding
    );
  }
  
  // Checks if element is out of screen bounds
  isOutOfBounds(element, padding = 0) {
    if (!element) return false;
    
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Get bounds of element
    const bounds = {
      left: element.x - (element.width * element.originX),
      right: element.x + (element.width * (1 - element.originX)),
      top: element.y - (element.height * element.originY),
      bottom: element.y + (element.height * (1 - element.originY))
    };
    
    // Check if any part is outside the screen (with padding)
    return (
      bounds.left < padding ||
      bounds.right > width - padding ||
      bounds.top < padding ||
      bounds.bottom > height - padding
    );
  }
  
  updateLayout() {
    console.log("Applying layout updates for size change");
    
    // Get the new dimensions
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Update device pixel ratio (could change if user moved to a different screen)
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Calculate effective width accounting for OS scaling
    const effectiveWidth = width / this.devicePixelRatio;
    
    // Check if we should switch to compact mode
    this.isPortrait = height > width;
    this.isCompact = effectiveWidth < 768;
    
    // Check if we need super compact mode for very small screens
    const minHeightForFull = 550 / this.devicePixelRatio;
    const minHeightForNormal = 350 / this.devicePixelRatio;
    
    if (height / this.devicePixelRatio < minHeightForFull) {
      this.isCompact = true;
      console.log(`Forcing compact mode due to low screen height: ${height / this.devicePixelRatio}px`);
    }
    
    // For extremely small screens or portrait orientation, enable super compact mode
    this.isSuperCompact = this.isPortrait || height / this.devicePixelRatio < minHeightForNormal || effectiveWidth < 320;
    if (this.isSuperCompact) {
      console.log(`Enabling super compact mode for very small screen: ${width}x${height}px (effective: ${effectiveWidth}x${height/this.devicePixelRatio}px)`);
    }
    
    // Calculate new positions based on layout mode
    let leftSideX, rightSideX, centerY;
    
    if (this.isSuperCompact) {
      // Super compact mode - everything centered with minimal spacing
      leftSideX = width * 0.5;
      rightSideX = width * 0.5;
      centerY = height * 0.5; // Center vertically
    } else if (this.isCompact || this.isPortrait) {
      // Centered layout for compact mode
      leftSideX = width * 0.5;
      rightSideX = width * 0.5;
      centerY = height * 0.4;
    } else {
      // Regular side-by-side layout
      leftSideX = width * 0.3;
      rightSideX = width * 0.7;
      centerY = height / 2 - 50;
    }
    
    // Update global effects
    if (this.globalScanlines) {
      this.globalScanlines.setDepth(100);
    }
    
    if (this.globalNoise) {
      this.globalNoise.setDepth(101);
    }
    
    // Update full-screen background
    if (this.fullScreenBackground) {
      this.fullScreenBackground.width = width;
      this.fullScreenBackground.height = height;
      this.fullScreenBackground.setDepth(-20);
    }
    
    // Update title visibility based on compact mode
    if (this.titleText) {
      this.titleText.setVisible(!this.isCompact);
      if (!this.isCompact) {
        this.titleText.x = width / 2;
        this.titleText.y = this.isPortrait ? 50 : 60;
      }
    }
    
    // Update sprite positions and scales
    this.characterSprites.forEach(sprite => {
      // Update scale based on layout mode and device pixel ratio
      const scaleModifier = Math.max(0.7, 1 / this.devicePixelRatio);
      
      if (this.isPortrait) {
        // In portrait mode, scale down the sprite more and move it lower
        sprite.x = leftSideX;
        sprite.y = height * 0.6; // Position lower on screen for better layout
        sprite.setScale(1.8 * scaleModifier); // Smaller scale for portrait
      } else if (this.isCompact) {
        // Regular compact mode
        sprite.x = leftSideX;
        sprite.y = centerY;
        sprite.setScale(2.2 * scaleModifier);
      } else {
        // Normal landscape mode
        sprite.x = leftSideX;
        sprite.y = centerY;
        sprite.setScale(2.5 * scaleModifier);
      }
    });
    
    // Update profile positions - handle differently based on layout mode
    this.profilePics.forEach(profile => {
      if (profile.nameText) {
        // Scale font size based on device pixel ratio to maintain consistent appearance
        const fontScaleModifier = Math.max(0.85, 1 / Math.sqrt(this.devicePixelRatio));
        const compactFontSize = Math.round(40 * fontScaleModifier);
        const regularFontSize = Math.round(56 * fontScaleModifier);
        
        if (this.isPortrait) {
          // In portrait mode, use a consistent position for all character names
          profile.nameText.x = width * 0.5; // Center horizontally
          profile.nameText.y = height * 0.25; // Fixed position at 25% of screen height
          profile.nameText.setFontSize('28px'); // Consistent font size
          profile.nameText.setDepth(9999); // Ensure on top
          this.children.bringToTop(profile.nameText);
        } else if (this.isCompact) {
          // In compact mode, ensure consistent position for all names
          profile.nameText.x = leftSideX;
          // Use a consistent height based on the first character sprite
          const nameY = this.characterSprites[0] 
            ? this.characterSprites[0].y - (this.characterSprites[0].height * 0.6)
            : centerY - 140;
          profile.nameText.y = nameY;
          profile.nameText.setFontSize(`${compactFontSize}px`);
          profile.nameText.setDepth(9999); // Ensure consistent depth
        } else {
          // In normal mode, position above profile pic
          profile.nameText.x = rightSideX - 80;
          profile.nameText.y = centerY - 236;
          profile.nameText.setFontSize(`${regularFontSize}px`);
        }
      }
      
      // Only update profile elements if they exist and we're in normal mode
      if (!this.isCompact && !this.isPortrait) {
        if (profile.shortDescText) {
          profile.shortDescText.x = rightSideX - 80;
          profile.shortDescText.y = centerY - 180;
          profile.shortDescText.setVisible(true);
        }
        
        // Only modify these if they exist (needed for proper layout transitions)
        if (profile.x !== undefined) {
          profile.x = rightSideX - 80;
          profile.y = centerY - 15;
        }
        
        if (profile.border && profile.border.x !== undefined) {
          profile.border.x = profile.x;
          profile.border.y = profile.y;
        }
        
        if (profile.descText) {
          profile.descText.x = rightSideX - 80;
          profile.descText.y = centerY + 100;
          profile.descText.wordWrapWidth = width * 0.4;
          profile.descText.setVisible(true);
        }
        
        // No vignettes used anywhere in this scene
      } else {
        // Hide profile elements in compact mode
        if (profile.shortDescText) profile.shortDescText.setVisible(false);
        if (profile.descText) profile.descText.setVisible(false);
        if (profile.border) profile.border.setVisible(false);
        // Don't hide the actual profile pic here - it's handled in updateSelection
      }
    });
    
    // Update background and effects positions
    if (this.hologramBase) {
      if (this.isPortrait) {
        this.hologramBase.x = width * 0.5;
        this.hologramBase.y = height * 0.6 + 50; // Below the character in portrait
      } else {
        this.hologramBase.x = leftSideX;
        this.hologramBase.y = centerY + 50;
      }
    }
    
    if (this.scanEffect) {
      if (this.isPortrait) {
        this.scanEffect.x = width * 0.5;
        this.scanEffect.y = height * 0.6; // Match character position in portrait
        this.scanEffect.width = 140; // Slightly smaller in portrait
      } else {
        this.scanEffect.x = leftSideX;
        this.scanEffect.y = centerY;
        this.scanEffect.width = 160;
      }
    }
    
    // Position the confirm text
    const confirmY = this.isPortrait ? height - 100 : height - 80;
    if (this.confirmText) {
      this.confirmText.x = width / 2;
      this.confirmText.y = confirmY;
    }
    
    // Position the back text
    const backButtonX = this.isPortrait ? 70 : 90;
    const backButtonY = this.isPortrait ? 50 : height - 80;
    if (this.backText) {
      this.backText.x = backButtonX;
      this.backText.y = backButtonY;
    }
    
    // Update instruction text position above confirm button
    if (this.instructionsText) {
      this.instructionsText.x = width / 2;
      
      if (this.isPortrait) {
        // In portrait mode, position instructions relative to sprite and name
        // Wait to set y position until after nameText position is calculated
      } else {
        this.instructionsText.y = confirmY - 50;
      }
      
      // Update font size based on new width and account for device scaling
      const fontScaleModifier = Math.max(0.85, 1 / Math.sqrt(this.devicePixelRatio));
      const fontSize = this.isPortrait 
        ? Math.max(12, Math.min(16, width / (30 * this.devicePixelRatio))) * fontScaleModifier
        : 16 * fontScaleModifier;
      this.instructionsText.setFontSize(Math.round(fontSize));
      
      // Position the name under the character sprite (only in portrait mode)
      if (this.nameText) {
        // Calculate sprite position based on layout
        const spriteY = this.isPortrait ? height * 0.5 : (this.isCompact ? height * 0.5 : height / 2);
        const spriteX = this.isPortrait ? width * 0.5 : (this.isCompact ? width * 0.5 : width * 0.3);
        
        // Update name position to stay under the sprite
        this.nameText.x = spriteX;
        this.nameText.y = this.isPortrait ? spriteY + 155 : spriteY + 185; // Adjusted to 75px lower than original
        
        // Set font size
        this.nameText.setFontSize('44px');
        
        // IMPORTANT: Only show the central nameText in portrait mode
        this.nameText.setVisible(this.isPortrait);
        
        // Position instructionsText above the character sprite in portrait mode
        if (this.isPortrait && this.instructionsText) {
          // Position instructions text above the character sprite
          this.instructionsText.y = spriteY - 280; // Position even higher above the character
        }
        
        if (this.descriptionText) {
          this.descriptionText.setVisible(false);
        }
      }
      
      // Now also update visibility of per-character name texts
      this.profilePics.forEach(profile => {
        if (profile.nameText) {
          // IMPORTANT: Only show character-specific name texts in landscape mode
          // In portrait mode, they must be hidden to avoid duplicate names
          profile.nameText.setVisible(!this.isPortrait);
        }
      });
    }
    
    // Now validate layout and fix any overlaps or boundary issues
    this.validateAndFixLayout();
  }
  
  // Check for and fix any layout issues
  validateAndFixLayout() {
    const width = this.scale.width;
    const height = this.scale.height;
    const padding = this.isSuperCompact ? 5 : 10; // Smaller padding in super compact mode
    
    // In super compact mode, do some immediate adjustments
    if (this.isSuperCompact && !this.isPortrait) {
      // Hide instructions text to save space, but only in super compact landscape mode
      if (this.instructionsText) {
        this.instructionsText.setVisible(false);
      }
      
      // Position CONFIRM/BACK buttons closer to edges
      if (this.confirmText) {
        this.confirmText.y = height - 20; // Move to bottom
      }
      
      if (this.backText) {
        this.backText.y = 20; // Move to top
      }
      
      // In super compact mode, handle the name position
      if (this.nameText) {
        // For super compact, adjust the spacing to work better with limited space
        const spriteY = height / 2;
        this.nameText.y = spriteY + 80; // Less space below character in super compact
        this.nameText.setFontSize('40px'); // Slightly smaller in super compact
        
        // CRITICAL: Show centralized name ONLY in portrait mode
        this.nameText.setVisible(this.isPortrait);
      }
      
      // CRITICAL: Ensure character-specific name texts are NEVER shown in portrait mode
      this.profilePics.forEach(profile => {
        if (profile.nameText) {
          profile.nameText.setVisible(!this.isPortrait);
        }
      });
    } else if (this.instructionsText) {
      // Make sure instructions are visible if not in super compact landscape mode
      this.instructionsText.setVisible(true);
    }
    
    // No vignettes used in this scene
    
    // In portrait or super compact mode, ensure character name heights are consistent
    if (this.isPortrait || this.isSuperCompact) {
      // First, determine a consistent Y position for all character names
      let consistentNameY;
      
      // Calculate the position based on the first character sprite's position
      if (this.characterSprites[0]) {
        // In portrait mode, position names at a fixed distance above the character
        consistentNameY = this.isPortrait 
          ? height * 0.25 // Fixed position at 25% of screen height
          : this.characterSprites[0].y - (this.characterSprites[0].height * 0.6);
      } else {
        // Fallback if no character sprites available
        consistentNameY = this.isPortrait ? height * 0.25 : height * 0.3;
      }
      
      // Apply the consistent Y position to all character name texts
      this.profilePics.forEach(profile => {
        if (profile.nameText) {
          // Set consistent Y position for all character names
          profile.nameText.y = consistentNameY;
          
          // Set a consistent font size based on mode
          const fontScaleModifier = Math.max(0.85, 1 / Math.sqrt(this.devicePixelRatio));
          const fontSize = this.isSuperCompact 
            ? Math.max(14, 28 * fontScaleModifier) // Smaller font in super compact
            : Math.max(18, 32 * fontScaleModifier); // Larger font in normal portrait
            
          profile.nameText.setFontSize(Math.floor(fontSize) + 'px');
          
          // Ensure they're all at the same depth
          profile.nameText.setDepth(9999);
        }
      });
      
      // Scale down character sprites appropriately
      this.characterSprites.forEach(sprite => {
        if (sprite.visible) {
          const currentScale = sprite.scaleX;
          if (this.isSuperCompact) {
            sprite.setScale(currentScale * 0.9); // Additional reduction for super compact
          }
        }
      });
    }
    
    // Make sure confirm and back buttons aren't overlapping
    if (this.confirmText && this.backText) {
      // Only needed to check in landscape mode where they might be adjacent
      if (!this.isPortrait) {
        if (this.checkOverlap(this.confirmText, this.backText, 20)) {
          console.log("Detected overlap between confirm and back buttons, adjusting");
          
          // If they overlap, move the confirm text further right
          this.confirmText.x = width * 0.7;
          this.backText.x = width * 0.3;
        }
      }
      
      // Check if buttons are going out of bounds
      if (this.isOutOfBounds(this.confirmText, padding)) {
        console.log("Confirm button is out of bounds, adjusting");
        this.confirmText.x = Math.max(padding + this.confirmText.width * 0.5, 
                                      Math.min(width - padding - this.confirmText.width * 0.5, this.confirmText.x));
      }
      
      if (this.isOutOfBounds(this.backText, padding)) {
        console.log("Back button is out of bounds, adjusting");
        this.backText.x = Math.max(padding + this.backText.width * 0.5, 
                                   Math.min(width - padding - this.backText.width * 0.5, this.backText.x));
      }
    }
    
    // Only check for character name vs sprite overlap in landscape mode
    if (!this.isPortrait && !this.isSuperCompact) {
      this.profilePics.forEach((profile, index) => {
        if (profile.nameText && this.characterSprites[index] && profile.nameText.visible && this.characterSprites[index].visible) {
          const characterSprite = this.characterSprites[index];
          
          // Adjust name position if it overlaps with character
          if (this.checkOverlap(profile.nameText, characterSprite, 20)) {
            console.log("Detected overlap between character name and sprite, adjusting");
            
            // If they overlap, move the name further up
            const originalY = profile.nameText.y;
            profile.nameText.y = characterSprite.y - (characterSprite.height * 0.6);
            
            // If it's still overlapping, try a more drastic adjustment
            if (this.checkOverlap(profile.nameText, characterSprite, 20)) {
              profile.nameText.y = characterSprite.y - (characterSprite.height * 0.8);
            }
            
            // If it's now out of bounds, try a different approach
            if (this.isOutOfBounds(profile.nameText, padding)) {
              profile.nameText.y = originalY;
              // Try reducing font size instead
              const currentSize = parseInt(profile.nameText.style.fontSize);
              profile.nameText.setFontSize(Math.max(16, currentSize * 0.8) + 'px');
            }
          }
        }
      });
    }
    
    // Check instruction text vs confirm button
    if (this.instructionsText && this.confirmText && this.instructionsText.visible) {
      if (this.checkOverlap(this.instructionsText, this.confirmText, 10)) {
        console.log("Detected overlap between instructions and confirm button, adjusting");
        
        // Move instructions up
        this.instructionsText.y = this.confirmText.y - this.confirmText.height - 20;
        
        // If still overlapping, reduce font size
        if (this.checkOverlap(this.instructionsText, this.confirmText, 10)) {
          const currentSize = parseInt(this.instructionsText.style.fontSize);
          this.instructionsText.setFontSize(Math.max(10, currentSize * 0.8) + 'px');
        }
      }
    }
    
    // Scale down character if it's too large for the screen
    this.characterSprites.forEach(sprite => {
      if (sprite.visible) {
        // Create a temporary bounds checker for the sprite
        const testBounds = {
          x: sprite.x,
          y: sprite.y,
          width: sprite.width,
          height: sprite.height,
          originX: 0.5,
          originY: 0.5
        };
        
        if (this.isOutOfBounds(testBounds, padding * 3)) {
          console.log("Character sprite is too large, scaling down");
          const currentScale = sprite.scaleX;
          sprite.setScale(currentScale * 0.9);
          
          // If still out of bounds, scale down more
          if (this.isOutOfBounds(testBounds, padding * 3)) {
            sprite.setScale(currentScale * 0.8);
          }
        }
      }
    });
  }
  
  // Add method to update the CRT scanlines effect
  updateCRTEffect() {
    // Increase scanline offset for animation
    this.scanlineOffset = (this.scanlineOffset + 0.5) % 8;
    
    // Update flicker intensity for CRT effect
    this.flickerIntensity = 0.9 + Math.random() * 0.1;
    
    // Update time-based effects
    this.noiseTime += 0.01;
    this.warpTime += 0.005;
    
    // Clear global CRT scanlines effect
    if (!this.globalScanlines) {
      // Create global scanlines if they don't exist yet
      this.globalScanlines = this.add.graphics();
      this.globalScanlines.setDepth(100); // Put scanlines on top of everything
    }
    
    this.globalScanlines.clear();
    
    // Draw horizontal scanlines across the entire screen
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Use black scanlines with higher opacity for better visibility
    this.globalScanlines.fillStyle(0x000000, 0.2);
    for (let i = 0; i < height; i += 4) {
      this.globalScanlines.fillRect(0, i + this.scanlineOffset, width, 2);
    }
    
    // Add subtle random noise/grain to entire screen
    if (!this.globalNoise) {
      this.globalNoise = this.add.graphics();
      this.globalNoise.setDepth(101); // Above scanlines
    }
    
    this.globalNoise.clear();
    this.globalNoise.fillStyle(0xFFFFFF, 0.05); // Higher contrast for more visible noise
    
    // Add sparse noise points across screen
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() > 0.8 ? 2 : 1;
      this.globalNoise.fillRect(x, y, size, size);
    }
    
    // Occasionally add strong interference/glitch lines
    if (Math.random() > 0.97) {
      const glitchY = Math.random() * height;
      const glitchHeight = 1 + Math.random() * 3;
      
      this.globalNoise.fillStyle(0xFFFFFF, 0.3);
      this.globalNoise.fillRect(0, glitchY, width, glitchHeight);
    }
    
    // Apply green tint to profile pictures
    this.profilePics.forEach(profile => {
      if (profile.visible && profile.setTint) {
        // Apply green hologram tint
        profile.setTint(0x88ffaa);
        
        // Only apply WebGL effects if not in CANVAS mode
        if (!this.useCanvas && profile.preFX) {
          try {
            // Clear previous effects
            profile.preFX.clear();
            
            // Add contrast and brightness for better visibility
            const colorMatrix = profile.preFX.addColorMatrix();
            colorMatrix.brightness(1.1);
            colorMatrix.contrast(1.2);
            colorMatrix.saturate(1.2);
          } catch (e) {
            // Fail silently - WebGL effects not critical
          }
        }
      }
    });
    
    // Apply holographic effect to character sprites
    this.characterSprites.forEach(sprite => {
      if (sprite.visible) {
        // Apply green tint (works in both Canvas and WebGL)
        sprite.setTint(0x88ffaa);
        
        // Only apply WebGL effects if not in CANVAS mode
        if (!this.useCanvas && sprite.preFX) {
          try {
            // Update brightness/contrast for consistency
            sprite.preFX.clear();
            const colorMatrix = sprite.preFX.addColorMatrix();
            colorMatrix.brightness(1.1);
            colorMatrix.contrast(1.2);
            colorMatrix.saturate(1.2);
          } catch (e) {
            // Fail silently - WebGL effects not critical
          }
        }
      }
    });
  }
  
  update(time) {
    // Update CRT scanlines effect
    this.updateCRTEffect();
    
    // Handle gamepad input with throttling
    if (this.input.gamepad && this.input.gamepad.total > 0) {
      const gamepad = this.input.gamepad.getPad(0);
      
      // Only process input if we have a gamepad and enough time has passed (250ms)
      if (gamepad && time > (this.gamepadLastActive || 0) + 250) {
        let horizontalInput = 0;
        let verticalInput = 0;
        
        // Check left stick for horizontal movement
        if (Math.abs(gamepad.axes[0]) > 0.5) {
          horizontalInput = gamepad.axes[0];
        }
        
        // Check left stick for vertical movement
        if (Math.abs(gamepad.axes[1]) > 0.5) {
          verticalInput = gamepad.axes[1];
        }
        
        // Check D-pad for horizontal movement (takes precedence)
        if (gamepad.buttons[14] && gamepad.buttons[14].pressed) {
          horizontalInput = -1; // Left
        } else if (gamepad.buttons[15] && gamepad.buttons[15].pressed) {
          horizontalInput = 1;  // Right
        }
        
        // Check D-pad for vertical movement (takes precedence)
        if (gamepad.buttons[12] && gamepad.buttons[12].pressed) {
          verticalInput = -1; // Up
        } else if (gamepad.buttons[13] && gamepad.buttons[13].pressed) {
          verticalInput = 1;  // Down
        }
        
        // Handle horizontal movement (character selection)
        if (Math.abs(horizontalInput) > 0.5) {
          if (horizontalInput < -0.5) {
            // Left direction
            this.selectPrevious();
            this.gamepadLastActive = time;
            
            // Add sound feedback for navigation
            if (this.sound && this.sound.add) {
              this.sound.play('keystroke', { volume: 0.3 });
            }
          } else if (horizontalInput > 0.5) {
            // Right direction
            this.selectNext();
            this.gamepadLastActive = time;
            
            // Add sound feedback for navigation
            if (this.sound && this.sound.add) {
              this.sound.play('keystroke', { volume: 0.3 });
            }
          }
        }
        
        // Handle vertical movement (button selection)
        if (Math.abs(verticalInput) > 0.5) {
          if (verticalInput < -0.5) {
            // Up direction
            if (this.currentSelectedButton === 'confirm') {
              this.setSelectedButton('back');
            } else {
              this.setSelectedButton('confirm');  
            }
            this.gamepadLastActive = time;
            
            // Add sound feedback for navigation
            if (this.sound && this.sound.add) {
              this.sound.play('keystroke', { volume: 0.3 });
            }
          } else if (verticalInput > 0.5) {
            // Down direction
            if (this.currentSelectedButton === 'back') {
              this.setSelectedButton('confirm');
            } else {
              this.setSelectedButton('confirm');
            }
            this.gamepadLastActive = time;
            
            // Add sound feedback for navigation
            if (this.sound && this.sound.add) {
              this.sound.play('keystroke', { volume: 0.3 });
            }
          }
        }
      }
    }
    
    // Periodic hologram glitch effect
    if (this.nextGlitchTime && time > this.nextGlitchTime) {
      // Create a random glitch
      if (Phaser.Math.Between(0, 10) > 6) { // 40% chance of a visible glitch
        this.createHologramGlitch();
      }
      
      // Schedule the next glitch
      this.nextGlitchTime = time + Phaser.Math.Between(4000, 12000);
      
      // Occasionally offset the hologram position slightly
      const selectedSprite = this.characterSprites[this.selectedIndex];
      if (selectedSprite && Phaser.Math.Between(0, 10) > 7) { // 30% chance
        // Get the sprite's current position instead of calculating a new position
        const originalX = selectedSprite.x;
        const originalY = selectedSprite.y;
        
        // Apply a small random offset
        const offsetX = Phaser.Math.Between(-5, 5);
        const offsetY = Phaser.Math.Between(-5, 5);
        
        // Move the sprite quickly
        this.tweens.add({
          targets: selectedSprite,
          x: originalX + offsetX,
          y: originalY + offsetY,
          duration: 100,
          yoyo: true,
          ease: 'Stepped',
          onComplete: () => {
            // Make sure it returns to original position
            selectedSprite.x = originalX;
            selectedSprite.y = originalY;
          }
        });
      }
    }
    
    // Create occasional scanline glitches
    if (this.globalScanlines && Phaser.Math.Between(0, 100) > 98) {
      // Create a momentary scanline glitch effect
      const glitchY = Phaser.Math.Between(0, this.scale.height);
      const glitchHeight = Phaser.Math.Between(3, 6);
      
      // Add a temporary glitch line
      const glitchLine = this.add.rectangle(
        this.scale.width / 2,
        glitchY,
        this.scale.width,
        glitchHeight,
        0xffffff,
        0.3
      );
      glitchLine.setDepth(102); // Above everything
      
      // Make it fade out quickly
      this.tweens.add({
        targets: glitchLine,
        alpha: 0,
        duration: 100,
        onComplete: () => {
          glitchLine.destroy();
        }
      });
    }
  }
}