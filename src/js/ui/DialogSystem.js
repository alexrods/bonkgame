export class DialogSystem {
  // Helper method to get standard dialog for intro sequence
  static getDegenIntroDialog() {
    return [
      {
        character: "Degen",
        text: "Thought I'd finally found peace. Just bug burgers, quiet nights. But the Network…they never let you go.",
        image: "story/degen/intro/degen",
        sound: "dialog1"
      },
      {
        character: "Network Exec",
        text: "You were born to fight, Degen. You will fight again—even if it's your last.",
        image: "story/degen/intro/networkExec",
        sound: "dialog2"
      },
      {
        character: "Girlfriend",
        text: "Help me, Degen! PLEASE!",
        image: "story/degen/intro/girl",
        sound: "dialog3"
      },
      {
        character: "Degen",
        text: "Anastasia…",
        image: "story/degen/intro/degen",
        sound: "dialog4"
      }
    ];
  }
  
  // Helper method to get Toaster intro dialog
  static getToasterIntroDialog() {
    return [
      {
        character: "Toaster",
        text: "Loading... POST Complete... System reboot: Finalized. Location: Unknown. Scaning...",
        image: "story/character3/intro/toaster",
        sound: "character3_dialog1"
      },
      {
        character: "Hacker",
        text: "Toaster! I messed up bad—the Network's got me. You've gotta fight… win enough for both of us!",
        image: "story/character3/intro/kid",
        sound: "character3_dialog2"
      },
      {
        character: "Network Exec",
        text: "You know what to do, machine. Get to work.",
        image: "story/character3/intro/networkExec",
        sound: "character3_dialog3"
      },
      {
        character: "Toaster",
        text: "Analyzing... Proceed until creator is found... Use of lethal force: Engaged...",
        image: "story/character3/intro/toaster",
        sound: "character3_dialog4"
      }
    ];
  }
  
  // Helper method to get Flex intro dialog
  static getFlexIntroDialog() {
    return [
      {
        character: "Flex",
        text: "Fame, fortune, family—Grandma's gonna love tonight's show!",
        image: "story/character5/intro/flex",
        sound: "character5_dialog1"
      },
      {
        character: "Grandma",
        text: "Give them a good show, Flexie dear!",
        image: "story/character5/intro/grandma",
        sound: "character5_dialog2"
      },
      {
        character: "Network Exec",
        text: "You know what to do, clown. Your last cleaning bill was expensive—remember to make it worth it.",
        image: "story/character5/intro/networkExec",
        sound: "character5_dialog3"
      },
      {
        character: "Flex",
        text: "Take a chill pill, old man. I'll make it worth it, no worries. As long as you keep the credits flowin', I'll keep the blood pumpin'.",
        image: "story/character5/intro/flex",
        sound: "character5_dialog4"
      }
    ];
  }
  constructor(scene) {
    this.scene = scene;
    this.dialogContainer = null;
    this.isActive = false;
    this.dialogData = null;
    this.currentDialogIndex = 0;
    this.dialogCharacter = null;
    this.characterName = null;
    this.dialogText = null;
    this.dialogBackground = null;
    this.currentDialog = null;
    this.previousTimeScale = 1.0;
    this.previousPhysicsTimeScale = 1.0;
    this.previousAnimsTimeScale = 1.0;
    this.onCompleteCallback = null;
    // Add sound support
    this.currentSound = null;
    // Store game state before dialog
    this.gameStateBeforeDialog = null;
    // Thought bubbles have been removed
  }

  init() {
    // Set the default values for the dialog
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    
    // Check if we're in portrait mode
    const isPortrait = width < height;

    // Create the dialog container - position at the center of the viewport
    this.dialogContainer = this.scene.add.container(width / 2, height / 2);
    
    // IMPORTANT: Container depth is NOT inherited by its children!
    // Each child must have its depth set individually, and container.sort('depth')
    // must be called to sort children by depth
    this.dialogContainer.setDepth(1100); // Higher than most elements
    
    // Make sure the dialog container is fixed to the camera (doesn't scroll with the game world)
    this.dialogContainer.setScrollFactor(0);

    // Create translucent black background - centered within the container (0, 0)
    this.dialogBackground = this.scene.add.rectangle(
      0,
      0,
      width,
      height,
      0x000000, 0.7
    );
    this.dialogBackground.setDepth(1);
    this.dialogContainer.add(this.dialogBackground);

    // Create dialog box - position lower in portrait mode, higher in landscape
    // Add bottom padding in portrait mode to move the dialog box up from the bottom edge
    const bottomPadding = isPortrait ? height * 0.1 : 0; // 10% of screen height as padding in portrait mode only
    
    // Store bottom padding as a property so it can be accessed by other methods
    this.bottomPadding = bottomPadding;
    
    // Position the dialog box near the bottom of the screen, but position is now relative to the container's center
    const dialogBoxY = isPortrait ? (height * 0.35) : height * 0.3;
    
    const dialogBoxHeight = isPortrait ? height * 0.3 : height * 0.25;
    
    this.dialogBox = this.scene.add.rectangle(
      0,
      dialogBoxY,
      width * 0.9,
      dialogBoxHeight,
      0x000000, 0.9
    );
    this.dialogBox.setStrokeStyle(4, 0x00ff00); // Green border for CRT look
    this.dialogBox.setDepth(50);
    this.dialogContainer.add(this.dialogBox);
    
    // Create scanline pattern
    const scanlineGraphics = this.scene.make.graphics({x: 0, y: 0, add: false});
    const scanlineSpacing = 4; // Adjust for scanline density
    scanlineGraphics.fillStyle(0x000000, 0.3);
    
    for (let y = 0; y < dialogBoxHeight; y += scanlineSpacing) {
      scanlineGraphics.fillRect(0, y, width * 0.9, 2);
    }
    
    const scanlineTexture = scanlineGraphics.generateTexture('dialogScanlines', width * 0.9, dialogBoxHeight);
    
    // Add CRT scanlines effect as a sprite (not rectangle)
    this.scanlines = this.scene.add.sprite(
      0, // Centered with the dialog box
      dialogBoxY,
      'dialogScanlines'
    );
    this.scanlines.setDepth(95); // Just below text but above dialog box
    this.dialogContainer.add(this.scanlines);
    
    // Create character name text - position based on dialog box (relative to container center)
    const nameY = dialogBoxY - (dialogBoxHeight / 2) - 10;
    this.characterName = this.scene.add.text(
      -width * 0.4, // Positioned relative to container center (left side)
      nameY,
      '',
      {
        fontFamily: 'Tektur',
        fontSize: isPortrait ? '20px' : '24px',
        color: '#00ff00', // CRT green
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
        shadow: { color: '#00ff00', blur: 6, offsetX: 0, offsetY: 0, fill: true } // CRT glow effect
      }
    );
    // Set higher depth to ensure name appears above character images
    this.characterName.setDepth(100);
    this.dialogContainer.add(this.characterName);

    // Create dialog text - position based on dialog box (relative to container center)
    const textY = nameY + 40;
    const fontSize = isPortrait ? '18px' : '20px';
    
    this.dialogText = this.scene.add.text(
      -width * 0.4, // Positioned relative to container center (left side)
      textY,
      '',
      {
        fontFamily: 'Tektur',
        fontSize: fontSize,
        color: '#00ff00', // CRT green
        wordWrap: { width: width * 0.8 },
        lineSpacing: 8,
        shadow: { color: '#00ff00', blur: 4, offsetX: 0, offsetY: 0, fill: true } // CRT glow effect
      }
    );
    // Set higher depth to ensure text appears above character images
    this.dialogText.setDepth(100);
    this.dialogContainer.add(this.dialogText);

    // Create character image (will be set per dialog)
    // Position based on orientation and align with bottom of dialog box (relative to container center)
    const characterX = isPortrait ? 0 : -width * 0.25; // Center in portrait, left side in landscape
    const characterY = dialogBoxY + (dialogBoxHeight / 2); // Positioned at bottom of dialog box
    
    // Get the selected character
    const selectedCharacter = this.scene.registry.get('selectedCharacter') || 'default';
    
    // Create placeholder for character image
    this.dialogCharacter = this.scene.add.image(
      characterX,
      characterY,
      selectedCharacter === 'default' ? 'degen' : selectedCharacter
    );
    
    // Center horizontally, but align bottom with top of dialog box
    this.dialogCharacter.setOrigin(0.5, 1.0); // 0.5 horizontally, 1.0 (bottom) vertically
    
    // Set initial visibility
    this.dialogCharacter.setVisible(false);
    
    // Set responsive display size based on screen dimensions - half original size
    // Use percentage of screen height for consistent sizing
    const maxHeight = isPortrait ? height * 0.09 : height * 0.125; // Half the original size
    // Will maintain aspect ratio when an actual texture is loaded
    const maxWidth = maxHeight;
    this.dialogCharacter.setDisplaySize(maxWidth, maxHeight);
    
    // Set image depth lower than text elements to ensure image stays behind text
    this.dialogCharacter.setDepth(10); // Lower depth than text elements
    
    // IMPORTANT: Add the character to the container AFTER setting its depth
    this.dialogContainer.add(this.dialogCharacter);
    
    // Thought bubbles have been removed

    // Create continue prompt - adjust position based on dialog box (relative to container center)
    const promptY = dialogBoxY + (dialogBoxHeight / 2) - 20;
    
    this.continuePrompt = this.scene.add.text(
      width * 0.35, // Positioned to the right relative to container center
      promptY,
      '[SPACE]',
      {
        fontFamily: 'Tektur',
        fontSize: isPortrait ? '14px' : '16px',
        color: '#00ff00', // CRT green
        shadow: { color: '#00ff00', blur: 4, offsetX: 0, offsetY: 0, fill: true } // CRT glow effect
      }
    );
    // Set higher depth to ensure prompt appears above character images
    this.continuePrompt.setDepth(100);
    this.dialogContainer.add(this.continuePrompt);

    // Animate continue prompt for visibility
    this.scene.tweens.add({
      targets: this.continuePrompt,
      alpha: { from: 0.5, to: 1 },
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Hide container initially
    this.dialogContainer.setAlpha(0);
    this.dialogContainer.setVisible(false);

    // Setup input handling
    this.setupInput();
    
    // Store orientation state for later updates
    this.isPortrait = isPortrait;
    
    // Listen for orientation changes
    this.scene.scale.on('resize', this.handleResize, this);
  }

  setupInput() {
    // Create a spacebar key object
    this.spaceKey = this.scene.input.keyboard.addKey('SPACE');
    
    // Handle keyboard input
    this.scene.input.keyboard.on('keydown-SPACE', () => {
      if (this.isActive) {
        this.nextDialog();
      }
    });

    // Handle mouse/touch input
    this.dialogBackground.setInteractive();
    this.dialogBox.setInteractive();
    this.dialogBackground.on('pointerdown', () => {
      if (this.isActive) {
        this.nextDialog();
      }
    });
    this.dialogBox.on('pointerdown', () => {
      if (this.isActive) {
        this.nextDialog();
      }
    });
  }

  // Helper method to preload sounds for dialogs
  preloadDialogSounds(dialogData) {
    if (!dialogData || !Array.isArray(dialogData)) return;
    
    // Preload audio for all dialog entries that have a sound
    dialogData.forEach(dialog => {
      if (dialog.sound && typeof dialog.sound === 'string') {
        let path;
        
        // Determine which character's sound folder to use based on sound key prefix
        if (dialog.sound.startsWith('character2_')) {
          // For character2 (Drainer) dialog sounds
          path = `/assets/sound/story/drainer/intro/${dialog.sound}.mp3`;
        } else if (dialog.sound.startsWith('character3_')) {
          // For character3 (Toaster) dialog sounds
          path = `/assets/sound/story/toaster/intro/${dialog.sound}.mp3`;
        } else if (dialog.sound.startsWith('character5_')) {
          // For character5 (Flex) dialog sounds
          path = `/assets/sound/story/flex/intro/${dialog.sound}.mp3`;
        } else if (dialog.sound.startsWith('dronePilot_')) {
          // For Network Drone Pilot sounds
          path = `/assets/sound/story/all/50kills/${dialog.sound.replace('dronePilot_', '')}.mp3`;
        } else {
          // For original degen dialog sounds
          path = `/assets/sound/story/degen/intro/${dialog.sound}.mp3`;
        }
        
        console.log(`Pre-checking dialog sound: ${dialog.sound} at path: ${path}`);
        
        // Check if already loaded
        if (!this.scene.cache.audio.exists(dialog.sound)) {
          console.log(`Attempting to preload dialog sound: ${dialog.sound} from ${path}`);
          // Try to load it now if missing
          this.scene.load.audio(dialog.sound, path);
          // Since this is a late load, we need to start the load
          this.scene.load.start();
        }
      }
    });
  }
  
  // Lower music volume when dialog starts
  lowerMusicVolume() {
    // Lower game music volume during dialog so speech is more clear
    if (this.scene.gameMusic) {
      console.log('Lowering game music volume for dialog');
      this.scene.tweens.add({
        targets: this.scene.gameMusic,
        volume: 0.1, // Lower volume during dialog even more
        duration: 800,
        ease: 'Linear'
      });
    } else if (this.scene.registry && this.scene.registry.get('gameMusic')) {
      const gameMusic = this.scene.registry.get('gameMusic');
      if (gameMusic && typeof gameMusic.setVolume === 'function') {
        console.log('Lowering registry game music volume for dialog');
        this.scene.tweens.add({
          targets: gameMusic,
          volume: 0.1, // Lower volume during dialog even more
          duration: 800,
          ease: 'Linear'
        });
      }
    }
  }

  // Save current game state
  saveGameState() {
    console.log("Saving game state before dialog");
    
    const player = this.scene.playerManager?.player;
    const enemies = this.scene.enemyManager?.getEnemies()?.getChildren() || [];
    
    // Create a snapshot of the current game state
    this.gameStateBeforeDialog = {
      // Player state
      player: player ? {
        x: player.x,
        y: player.y,
        velocityX: player.body?.velocity?.x || 0,
        velocityY: player.body?.velocity?.y || 0,
        health: player.health,
        armor: player.armor,
        weapon: player.currentWeapon,
        ammo: player.ammo,
        direction: player.direction,
        animKey: player.anims?.currentAnim?.key
      } : null,
      
      // Enemy states
      enemies: enemies.map(enemy => ({
        id: enemy.enemyId || enemy.id,
        x: enemy.x,
        y: enemy.y,
        velocityX: enemy.body?.velocity?.x || 0,
        velocityY: enemy.body?.velocity?.y || 0,
        health: enemy.health,
        direction: enemy.direction,
        type: enemy.enemyType,
        state: enemy.state,
        animKey: enemy.anims?.currentAnim?.key,
        isFlipped: enemy.flipX
      })),
      
      // Time scales
      timeScales: {
        game: this.scene.time.timeScale,
        physics: this.scene.physics.world.timeScale,
        anims: this.scene.anims.globalTimeScale
      }
    };
    
    console.log(`Game state saved: ${enemies.length} enemies stored`);
  }

  start(dialogData, onCompleteCallback) {
    this.dialogData = dialogData;
    this.currentDialogIndex = 0;
    this.isActive = true;
    this.onCompleteCallback = onCompleteCallback;
    
    // Save current game state before starting dialog
    this.saveGameState();
    
    // Preload sounds for this dialog sequence
    this.preloadDialogSounds(dialogData);
    
    // Lower music volume during dialog
    this.lowerMusicVolume();
    
    // Save current time scales for restoration later
    this.previousTimeScale = this.scene.time.timeScale;
    this.previousPhysicsTimeScale = this.scene.physics.world.timeScale;
    this.previousAnimsTimeScale = this.scene.anims.globalTimeScale;
    
    // Update dialog position based on camera position
    this.updateDialogPosition();

    // Pause the game while dialog is active
    if (this.scene.timeScaleManager) {
      // Use the time scale manager if available
      this.scene.timeScaleManager.activeTimeEffects.dialog = true;
      this.scene.timeScaleManager.updateTimeScales();
    } else {
      // Otherwise directly set time scales - use a very small value instead of 0
      // to allow event callbacks to still execute
      this.scene.time.timeScale = 0.001;
      this.scene.physics.world.timeScale = 0.001;
      this.scene.anims.globalTimeScale = 0.001;
    }

    // Disable player controls
    if (this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = false;
      
      // Hide touch controls if they exist
      if (this.scene.playerManager.touchController) {
        // Store touch controller elements that need to be hidden
        const touchElements = [
          // Movement joystick
          this.scene.playerManager.touchController.movementJoystick.baseBorder,
          this.scene.playerManager.touchController.movementJoystick.base,
          this.scene.playerManager.touchController.movementJoystick.thumb,
          this.scene.playerManager.touchController.movementJoystick.thumbHighlight,
          
          // Shooting joystick
          this.scene.playerManager.touchController.shootJoystick.baseBorder,
          this.scene.playerManager.touchController.shootJoystick.base,
          this.scene.playerManager.touchController.shootJoystick.thumb,
          this.scene.playerManager.touchController.shootJoystick.thumbHighlight,
          
          // Buttons
          ...(this.scene.playerManager.touchController.droneButton ? 
            [
              this.scene.playerManager.touchController.droneButton.baseBorder,
              this.scene.playerManager.touchController.droneButton.base,
              this.scene.playerManager.touchController.droneButton.icon
            ] : []),
            
          ...(this.scene.playerManager.touchController.reloadButton ? 
            [
              this.scene.playerManager.touchController.reloadButton.baseBorder,
              this.scene.playerManager.touchController.reloadButton.base,
              this.scene.playerManager.touchController.reloadButton.icon
            ] : [])
        ];
        
        // Hide all touch control elements
        touchElements.forEach(element => {
          if (element) {
            element.setAlpha(0);
          }
        });
      }
    }
    
    // Pause enemy manager if available
    if (this.scene.enemyManager) {
      this.scene.enemyManager.setPaused(true);
    }
    
    // Emit event to ensure spawner is paused (this is what other UI components use)
    this.scene.events.emit('dialogStarted');

    // Make container visible
    this.dialogContainer.setVisible(true);
    
    // Update position to match camera before showing
    this.updateDialogPosition();
    
    // Fade in with a tween
    this.scene.tweens.add({
      targets: this.dialogContainer,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        // Show first dialog
        this.showDialog(0);
      }
    });
  }

  showDialog(index) {
    if (!this.dialogData || index >= this.dialogData.length) {
      this.complete();
      return;
    }

    this.currentDialog = this.dialogData[index];
    this.currentDialogIndex = index;

    // Stop any currently playing dialog sound
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound = null;
    }

    // Play dialog sound if specified
    if (this.currentDialog.sound) {
      try {
        // Check if sound exists in the cache
        if (this.scene.cache.audio.exists(this.currentDialog.sound)) {
          console.log(`Playing dialog sound: ${this.currentDialog.sound}`);
          this.currentSound = this.scene.sound.add(this.currentDialog.sound);
          
          // Add error handler for the sound
          this.currentSound.once('loaderror', () => {
            console.error(`Error loading dialog sound: ${this.currentDialog.sound}`);
            this.currentSound = null;
          });
          
          // Add debug event for when sound successfully plays
          this.currentSound.once('play', () => {
            console.log(`Dialog sound started playing: ${this.currentDialog.sound}`);
          });
          
          // Start playing the sound with maximum volume
          this.currentSound.play({ volume: 1.0 });
        } else {
          console.warn(`Dialog sound not found in cache: ${this.currentDialog.sound}`);
          
          // Try to load the sound on-demand as a fallback
          let path;
          
          // Determine which character's sound folder to use based on sound key prefix
          if (this.currentDialog.sound.startsWith('character2_')) {
            // For character2 (Drainer) dialog sounds
            path = `/assets/sound/story/drainer/intro/${this.currentDialog.sound}.mp3`;
          } else if (this.currentDialog.sound.startsWith('character3_')) {
            // For character3 (Toaster) dialog sounds
            path = `/assets/sound/story/toaster/intro/${this.currentDialog.sound}.mp3`;
          } else if (this.currentDialog.sound.startsWith('character5_')) {
            // For character5 (Flex) dialog sounds
            path = `/assets/sound/story/flex/intro/${this.currentDialog.sound}.mp3`;
          } else if (this.currentDialog.sound.startsWith('flex50kills')) {
            // For Flex 50 kills milestone sounds
            path = `/assets/sound/story/flex/50kills/${this.currentDialog.sound}.mp3`;
          } else if (this.currentDialog.sound.startsWith('toaster50kills')) {
            // For Toaster 50 kills milestone sounds
            path = `/assets/sound/story/toaster/50kills/${this.currentDialog.sound}.mp3`;
          } else if (this.currentDialog.sound.startsWith('dronePilot_')) {
            // For Network Drone Pilot sounds
            path = `/assets/sound/story/all/50kills/${this.currentDialog.sound.replace('dronePilot_', '')}.mp3`;
          } else {
            // For original degen dialog sounds
            path = `/assets/sound/story/degen/intro/${this.currentDialog.sound}.mp3`;
          }
          
          console.log(`Attempting to load dialog sound on-demand: ${path}`);
          this.scene.load.audio(this.currentDialog.sound, path);
          this.scene.load.once('complete', () => {
            console.log(`Loaded dialog sound on-demand: ${this.currentDialog.sound}`);
            // Now try to play it
            if (this.isActive && this.currentDialogIndex === index) {
              this.currentSound = this.scene.sound.add(this.currentDialog.sound);
              this.currentSound.play({ volume: 1.0 });
            }
          });
          this.scene.load.start();
        }
      } catch (error) {
        console.error(`Exception playing dialog sound: ${error.message}`);
      }
    }

    // Thought bubbles have been removed

    // Set character name - ensure defaults for safety
    this.characterName.setText(this.currentDialog.character || 'Network');

    // Set dialog text with a typewriter effect
    const fullText = this.currentDialog.text;
    this.dialogText.setText('');

    let i = 0;
    const typingSpeed = 30; // milliseconds per character
    
    // Clear any existing typing timer
    if (this.typingTimer) {
      this.typingTimer.remove();
    }

    // Show full text immediately instead of typing effect
    this.dialogText.setText(fullText);
    
    // Thought bubbles have been removed
    
    // Clear any existing typing timer
    if (this.typingTimer) {
      this.typingTimer.remove();
      this.typingTimer = null;
    }

    // Set character image with error handling - do this before the typing effect starts
    if (this.currentDialog.image) {
      // Log for debugging
      console.log(`Attempting to show dialog image: ${this.currentDialog.image}`);
      
      // Verify texture exists before attempting to use it
      if (this.scene.textures.exists(this.currentDialog.image)) {
        console.log(`Texture found: ${this.currentDialog.image}`);
        this.dialogCharacter.setTexture(this.currentDialog.image);
        // Make character visible immediately
        this.dialogCharacter.setVisible(true);
        
        // Get current dimensions for responsive sizing
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const isPortrait = width < height;
        
        // Update character position and size based on current orientation
        // Always update position and size to be responsive
        this.isPortrait = isPortrait;
        
        // Get dialog box position for character position reference - relative to container center
        const dialogBoxY = isPortrait ? (height * 0.35) : height * 0.3;
        const dialogBoxHeight = isPortrait ? height * 0.3 : height * 0.25;
        
        // Update character position relative to the container center
        const characterX = -width * 0.4; // Left side of the container
        
        let characterY;
        let originY;
        
        if (isPortrait) {
          // In portrait mode, position character above the dialog box
          characterY = dialogBoxY - (dialogBoxHeight * 0.5);
          originY = 1.0; // Bottom edge vertically
        } else {
          // In landscape mode, align with the bottom of the dialog box
          characterY = dialogBoxY + (dialogBoxHeight / 2);
          originY = 1.0; // Bottom edge vertically
        }
        
        this.dialogCharacter.setPosition(characterX, characterY);
        
        // Set origin to align left-top/bottom of character with position depending on mode
        this.dialogCharacter.setOrigin(0, originY); // Left edge horizontally, top/bottom vertically
        
        // Dynamically calculate appropriate size based on screen dimensions
        // Make image proportional to screen size rather than fixed pixels
        const frameWidth = this.dialogCharacter.frame.width;
        const frameHeight = this.dialogCharacter.frame.height;
        const aspectRatio = frameWidth / frameHeight;
        
        // Use a simple default scaling factor for all images
        const scaleFactor = 1.0; // Default scaling with no customization
        console.log(`Using default scaling for image: ${this.dialogCharacter.texture.key}`);
        
        // Set responsive size based on screen dimensions
        // Use percentage of screen height for more consistent sizing across devices
        // For portrait: reduce by 33%, for landscape: increase by 25%
        const maxHeight = isPortrait ? height * 0.355 : height * 0.83; // 0.53 * 0.67 = 0.355 (33% reduction) and 0.665 * 1.25 = 0.83 (25% increase)
        const maxWidth = maxHeight * aspectRatio;
        
        // Apply sizing that maintains aspect ratio
        this.dialogCharacter.setDisplaySize(maxWidth, maxHeight);
        
        // Origin already set to position the character correctly
        
        // We don't need to set scale here as we've already applied custom scaling
        // with setDisplaySize, which respects the aspect ratio
        
        // CRITICAL: Ensure character depth is correct before making visible
        // This ensures text always appears above characters
        this.dialogCharacter.setDepth(10);
        
        // Ensure character is fixed to camera
        this.dialogCharacter.setScrollFactor(0);
        
        // Make character visible
        this.dialogCharacter.setVisible(true);
        
        // Sort children by depth - Container.sort() is the correct method, not depthSort
        this.dialogContainer.sort('depth');
        
        // Add a small enter animation - using alpha instead of scale to preserve sizing
        this.dialogCharacter.setAlpha(0.7); // Start slightly faded
        this.scene.tweens.add({
          targets: this.dialogCharacter,
          alpha: 1,
          duration: 200,
          ease: 'Sine.easeOut'
        });
        
        // Add dramatic effect based on character
        if (this.currentDialog.character === "Girlfriend") {
          // Desperate effect - slight shake
          this.scene.tweens.add({
            targets: this.dialogCharacter,
            x: { from: this.dialogCharacter.x - 3, to: this.dialogCharacter.x + 3 },
            yoyo: true,
            repeat: 2,
            duration: 100,
            ease: 'Sine.easeInOut'
          });
        } else if (this.currentDialog.character === "Veiled Villain") {
          // Removed animation effect for villain character
          // Just ensure full opacity
          this.dialogCharacter.setAlpha(1);
        }
      } else {
        // Texture doesn't exist, log an error and hide the character
        console.error(`DialogSystem: Texture '${this.currentDialog.image}' not found for character '${this.currentDialog.character}'`);
        
        // Try to load the image on demand if it's missing
        if (this.currentDialog.image.startsWith('story/character2/intro/') || 
            this.currentDialog.image.startsWith('story/character3/intro/')) {
          console.log(`Attempting emergency load of ${this.currentDialog.image}`);
          
          const imagePath = `/assets/${this.currentDialog.image}.png`;
          this.scene.load.image(this.currentDialog.image, imagePath);
          
          // Start loading and update when complete
          this.scene.load.start();
          this.scene.load.once('complete', () => {
            console.log(`Emergency load complete for ${this.currentDialog.image}`);
            
            if (this.scene.textures.exists(this.currentDialog.image)) {
              console.log(`Successfully loaded ${this.currentDialog.image}, updating dialog character`);
              this.dialogCharacter.setTexture(this.currentDialog.image);
              this.dialogCharacter.setVisible(true);
              
              // Refresh position and sizing
              this.handleResize();
            } else {
              console.error(`Still failed to load ${this.currentDialog.image} after emergency load`);
              this.dialogCharacter.setVisible(false);
            }
          });
        } else {
          this.dialogCharacter.setVisible(false);
        }
      }
    } else {
      this.dialogCharacter.setVisible(false);
    }
  }
  
  // Method to show thought bubble with text has been removed

  nextDialog() {
    // Since we're showing the text immediately now, we always just move to the next dialog
    this.showDialog(this.currentDialogIndex + 1);
  }

  complete() {
    this.isActive = false;
    
    // Stop any currently playing dialog sound
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound = null;
    }
    
    // Restore music volume
    this.restoreMusicVolume();
    
    // Restore game state
    this.restoreGameState();

    // Fade out dialog
    this.scene.tweens.add({
      targets: this.dialogContainer,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.dialogContainer.setVisible(false);
        
        // Call completion callback if provided
        if (this.onCompleteCallback && typeof this.onCompleteCallback === 'function') {
          this.onCompleteCallback();
        }
      }
    });
  }

  restoreMusicVolume() {
    // Restore game music volume after dialog ends
    if (this.scene.gameMusic) {
      console.log('Restoring game music volume to normal level');
      this.scene.tweens.add({
        targets: this.scene.gameMusic,
        volume: 0.6, // Restore to normal gameplay volume
        duration: 1000,
        ease: 'Linear'
      });
    } else if (this.scene.registry && this.scene.registry.get('gameMusic')) {
      const gameMusic = this.scene.registry.get('gameMusic');
      if (gameMusic && typeof gameMusic.setVolume === 'function') {
        console.log('Restoring registry game music volume to normal level');
        this.scene.tweens.add({
          targets: gameMusic,
          volume: 0.6, // Restore to normal gameplay volume
          duration: 1000,
          ease: 'Linear'
        });
      }
    }
  }

  // Restore saved game state
  restoreGameStateFromSnapshot() {
    if (!this.gameStateBeforeDialog) {
      console.warn("No game state snapshot to restore");
      return;
    }
    
    console.log("Restoring game state after dialog");
    
    // Restore player state (position only - don't change health/ammo)
    const player = this.scene.playerManager?.player;
    const playerSnapshot = this.gameStateBeforeDialog.player;
    
    if (player && playerSnapshot) {
      // Keep player in the same position they were in when dialog started
      player.x = playerSnapshot.x;
      player.y = playerSnapshot.y;
      
      // Set velocity to what it was before dialog
      if (player.body) {
        player.body.velocity.x = playerSnapshot.velocityX;
        player.body.velocity.y = playerSnapshot.velocityY;
      }
      
      // Restore player animation if it was playing
      if (playerSnapshot.animKey && player.anims && 
          player.anims.currentAnim?.key !== playerSnapshot.animKey) {
        player.play(playerSnapshot.animKey);
      }
    }
    
    // Restore enemy states
    const enemySnapshot = this.gameStateBeforeDialog.enemies;
    const enemyManager = this.scene.enemyManager;
    
    if (enemyManager && enemySnapshot && enemySnapshot.length > 0) {
      // Get current enemies
      const currentEnemies = enemyManager.getEnemies()?.getChildren() || [];
      
      // Map enemies by ID for easier lookups
      const enemiesById = {};
      currentEnemies.forEach(enemy => {
        const id = enemy.enemyId || enemy.id;
        if (id) {
          enemiesById[id] = enemy;
        }
      });
      
      // Restore enemies that still exist
      let restoredCount = 0;
      
      enemySnapshot.forEach(snapshot => {
        const enemy = enemiesById[snapshot.id];
        
        if (enemy && enemy.active) {
          // Keep enemy in the same position
          enemy.x = snapshot.x;
          enemy.y = snapshot.y;
          
          // Restore velocity
          if (enemy.body) {
            enemy.body.velocity.x = snapshot.velocityX;
            enemy.body.velocity.y = snapshot.velocityY;
          }
          
          // Restore animation
          if (snapshot.animKey && enemy.anims && 
              enemy.anims.currentAnim?.key !== snapshot.animKey) {
            enemy.play(snapshot.animKey);
          }
          
          // Restore flip state
          if (enemy.flipX !== snapshot.isFlipped) {
            enemy.flipX = snapshot.isFlipped;
          }
          
          restoredCount++;
        }
      });
      
      console.log(`Restored ${restoredCount}/${enemySnapshot.length} enemies`);
    }
    
    // Clear the saved state
    this.gameStateBeforeDialog = null;
  }

  restoreGameState() {
    // Restore time scales
    if (this.scene.timeScaleManager) {
      // Use the time scale manager if available
      this.scene.timeScaleManager.activeTimeEffects.dialog = false;
      this.scene.timeScaleManager.applyTimeScales(1.0);
    } else {
      // Otherwise directly set time scales
      this.scene.time.timeScale = this.previousTimeScale;
      this.scene.physics.world.timeScale = this.previousPhysicsTimeScale;
      this.scene.anims.globalTimeScale = this.previousAnimsTimeScale;
    }
    
    // Only restart enemy drone spawning if it was already enabled
    // This ensures drones only start after the 50 kills milestone
    if (this.scene.droneManager && 
        typeof this.scene.droneManager.startEnemyDroneSpawning === 'function' &&
        this.scene.droneManager.enemyDroneEnabled) {
      console.log("Re-enabling enemy drone spawning after dialog");
      this.scene.droneManager.startEnemyDroneSpawning();
    }

    // Re-enable player controls
    if (this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = true;
      
      // Show touch controls if they exist
      if (this.scene.playerManager.touchController) {
        // Store touch controller elements that need to be shown
        const touchElements = [
          // Movement joystick
          this.scene.playerManager.touchController.movementJoystick.baseBorder,
          this.scene.playerManager.touchController.movementJoystick.base,
          this.scene.playerManager.touchController.movementJoystick.thumb,
          this.scene.playerManager.touchController.movementJoystick.thumbHighlight,
          
          // Shooting joystick
          this.scene.playerManager.touchController.shootJoystick.baseBorder,
          this.scene.playerManager.touchController.shootJoystick.base,
          this.scene.playerManager.touchController.shootJoystick.thumb,
          this.scene.playerManager.touchController.shootJoystick.thumbHighlight,
          
          // Buttons
          ...(this.scene.playerManager.touchController.droneButton ? 
            [
              this.scene.playerManager.touchController.droneButton.baseBorder,
              this.scene.playerManager.touchController.droneButton.base,
              this.scene.playerManager.touchController.droneButton.icon
            ] : []),
            
          ...(this.scene.playerManager.touchController.reloadButton ? 
            [
              this.scene.playerManager.touchController.reloadButton.baseBorder,
              this.scene.playerManager.touchController.reloadButton.base,
              this.scene.playerManager.touchController.reloadButton.icon
            ] : [])
        ];
        
        // Show all touch control elements
        touchElements.forEach(element => {
          if (element) {
            element.setAlpha(1);
          }
        });
        
        // Reposition joysticks in case orientation changed during dialog
        this.scene.playerManager.touchController.repositionJoysticks();
      }
    }
    
    // Restore the game state from our snapshot
    this.restoreGameStateFromSnapshot();
    
    // Unpause enemy manager if available
    if (this.scene.enemyManager) {
      this.scene.enemyManager.setPaused(false);
    }
    
    // Emit event to ensure spawner is resumed (this is what other UI components use)
    this.scene.events.emit('dialogEnded');
  }

  // Handle orientation or size changes
  handleResize() {
    // Get new dimensions
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    
    // Check if orientation has changed
    const isPortrait = width < height;
    
    // Only update if orientation has changed or forced
    if (isPortrait !== this.isPortrait || !this.isPortrait) {
      this.isPortrait = isPortrait;
      
      // Update dialog background to fill screen
      this.dialogBackground.setPosition(width / 2, height / 2);
      this.dialogBackground.setSize(width, height);
      
      // Update dialog box position and size
      const bottomPadding = isPortrait ? height * 0.1 : 0; // 10% of screen height as padding in portrait mode only
      
      // Store bottom padding as a property so it can be accessed by other methods
      this.bottomPadding = bottomPadding;
      
      // In portrait mode, move dialog box UP from its default position by subtracting the padding
      const dialogBoxY = isPortrait ? (height * 0.85) - bottomPadding : height * 0.8;
      
      const dialogBoxHeight = isPortrait ? height * 0.3 : height * 0.25;
      
      this.dialogBox.setPosition(width / 2, dialogBoxY);
      this.dialogBox.setSize(width * 0.9, dialogBoxHeight);
      
      // If the texture already exists, destroy it first
      if (this.scene.textures.exists('dialogScanlines')) {
        this.scene.textures.remove('dialogScanlines');
      }
      
      // Recreate scanline texture for new size
      const scanlineGraphics = this.scene.make.graphics({x: 0, y: 0, add: false});
      const scanlineSpacing = 4; // Match original spacing
      scanlineGraphics.fillStyle(0x000000, 0.3);
      
      for (let y = 0; y < dialogBoxHeight; y += scanlineSpacing) {
        scanlineGraphics.fillRect(0, y, width * 0.9, 2);
      }
      
      // Generate new texture
      scanlineGraphics.generateTexture('dialogScanlines', width * 0.9, dialogBoxHeight);
      
      // Remove old scanlines sprite and create a new one
      if (this.scanlines) {
        this.scanlines.destroy();
      }
      
      this.scanlines = this.scene.add.sprite(
        width / 2,
        dialogBoxY,
        'dialogScanlines'
      );
      this.scanlines.setDepth(95);
      this.dialogContainer.add(this.scanlines);
      
      // Update character name text position
      const nameY = dialogBoxY - (dialogBoxHeight / 2) - 10;
      this.characterName.setPosition(width * 0.1, nameY);
      this.characterName.setFontSize(isPortrait ? '20px' : '24px');
      
      // Update dialog text position and size
      const textY = nameY + 40;
      this.dialogText.setPosition(width * 0.1, textY);
      this.dialogText.setFontSize(isPortrait ? '18px' : '20px');
      this.dialogText.setWordWrapWidth(width * 0.8);
      
      // Update character position - align with left edge of text box
      const textLeftEdge = width * 0.1; // This matches the dialog text's left position
      const characterX = textLeftEdge; // Use same X position as text
      
      let characterY;
      let originY;
      
      if (isPortrait) {
        // DIRECT FIX: In portrait mode, explicitly position the character at 65% of screen height
        // This will place the bottom of the image right at the top of the dialog box
        characterY = height * 0.65;
        originY = 1.0; // Bottom edge vertically
      } else {
        // In landscape mode, keep aligned with the bottom of the dialog box
        const dialogBoxBottomEdge = dialogBoxY + (dialogBoxHeight / 2);
        characterY = dialogBoxBottomEdge;
        originY = 1.0; // Bottom edge vertically
      }
      
      this.dialogCharacter.setPosition(characterX, characterY);
      
      // Ensure correct origin is maintained to align left-top/bottom of character
      this.dialogCharacter.setOrigin(0, originY); // Left edge horizontally, top/bottom vertically
      
      // Maintain aspect ratio for character image
      if (this.dialogCharacter.frame) {
        const frameWidth = this.dialogCharacter.frame.width;
        const frameHeight = this.dialogCharacter.frame.height;
        const aspectRatio = frameWidth / frameHeight;
        
        // Use a simple default scaling factor for all images
        const scaleFactor = 1.0; // Default scaling with no customization
        console.log(`Using default scaling for image: ${this.dialogCharacter.texture.key}`);
        
        // Responsive sizing based on screen dimensions
        // For portrait: reduce by 33%, for landscape: increase by 25%
        const maxHeight = isPortrait ? height * 0.355 : height * 0.83; // 0.53 * 0.67 = 0.355 (33% reduction) and 0.665 * 1.25 = 0.83 (25% increase)
        const maxWidth = maxHeight * aspectRatio;
        
        this.dialogCharacter.setDisplaySize(maxWidth, maxHeight);
      }
      
      // Thought bubbles have been removed
      
      // Update continue prompt position
      const promptY = dialogBoxY + (dialogBoxHeight / 2) - 20;
      
      this.continuePrompt.setPosition(width * 0.85, promptY);
      this.continuePrompt.setFontSize(isPortrait ? '14px' : '16px');
    }
  }
  
  // Helper method to get display name for a character key
  getCharacterDisplayName(characterKey) {
    // Map character keys to their display names
    const characterNames = {
      'default': 'Degen',
      'character2': 'Drainer',
      'character3': 'Toaster',
      'character5': 'Flex'
    };
    
    return characterNames[characterKey] || characterKey;
  }
  
  // Update dialog size to match the camera viewport
  updateDialogPosition() {
    if (!this.dialogContainer || !this.isActive) return;
    
    // Get current dimensions
    const camera = this.scene.cameras.main;
    const width = camera.width;
    const height = camera.height;
    
    // Position the container at the center of the viewport
    this.dialogContainer.setPosition(width / 2, height / 2);
    
    // Update dialog background to fill viewport
    if (this.dialogBackground) {
      this.dialogBackground.setPosition(0, 0); // Centered within container
      this.dialogBackground.setSize(width, height);
    }
  }
  
  // Called every frame from GameScene.update() when dialog is active
  update() {
    if (this.isActive) {
      this.updateDialogPosition();
    }
  }
  
  shutdown() {
    // Clean up resources
    if (this.typingTimer) {
      this.typingTimer.remove();
    }
    
    // Stop any currently playing dialog sound
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound = null;
    }
    
    // Clear saved game state
    this.gameStateBeforeDialog = null;
    
    this.scene.input.keyboard.off('keydown-SPACE');
    
    if (this.dialogBackground) {
      this.dialogBackground.off('pointerdown');
    }
    
    if (this.dialogBox) {
      this.dialogBox.off('pointerdown');
    }
    
    // Remove resize event listener
    this.scene.scale.off('resize', this.handleResize, this);
    
    // Clean up scanline texture
    if (this.scene.textures.exists('dialogScanlines')) {
      this.scene.textures.remove('dialogScanlines');
    }
    
    if (this.dialogContainer) {
      this.dialogContainer.destroy();
    }
  }
}