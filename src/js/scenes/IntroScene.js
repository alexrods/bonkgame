import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IntroScene' });
    this.inputDetected = false;
    this.inputMethod = null;
  }
  
  init() {
    // Create a dark cyberpunk background
    this.cameras.main.setBackgroundColor(0x030311);
    
    // Check if audio is already unlocked
    this.audioUnlocked = this.registry.get('audioUnlocked') || false;
    console.log(`Audio unlocked: ${this.audioUnlocked}`);
    
    // Scene duration (57 seconds = 57000ms) - though we'll likely auto-proceed before this
    this.sceneDuration = 57000;
    
    // Detect input method and auto-proceed when detected
    this.detectInputMethod();
  }
  
  create() {
    // Hide wallet UI in IntroScene
    const walletUI = document.getElementById('wallet-ui');
    if (walletUI) {
      walletUI.style.display = 'none';
    }
    
    // According to the pattern: "introscene - scroll_beat"
    // We need to play scroll_beat music
    
    // First check if bootScene music is playing and stop it
    const bootMusic = this.registry.get('introMusic');  // This is from BootScene
    if (bootMusic && bootMusic.isPlaying) {
      console.log('Stopping boot music in IntroScene');
      bootMusic.stop();
    }
    
    // Add scroll beat music with appropriate volume
    if (this.cache.audio.exists('scroll_beat')) {
      this.music = this.sound.add('scroll_beat', {
        volume: 0.8,  // Appropriate volume level
        loop: true
      });
      
      // Play music immediately - we've already unlocked audio in StartScene
      this.music.play();
      console.log("Scroll beat music playing in IntroScene");
    }
    
    // Add narration
    if (this.cache.audio.exists('narration')) {
      this.narration = this.sound.add('narration', {
        volume: 1.0
      });
      
      // Play narration immediately
      this.narration.play();
      console.log("Narration playing in IntroScene");
    }
    
    // Set up timer to end the scene after 56.9 seconds
    this.time.delayedCall(this.sceneDuration, () => {
      // Store music reference in registry to access it in MenuScene
      this.registry.set('introMusic', this.music);
      
      // Don't stop the music when transitioning
      // Transition to MenuScene
      this.scene.start('MenuScene');
    });
    
    // Set up gamepad support if available
    this.setupGamepadSupport();
    
    // Create city skyline silhouette in background
    const cityGraphics = this.add.graphics();
    
    // Draw distant city skyline with blue/purple hue
    cityGraphics.fillStyle(0x0a0a2a, 1);
    cityGraphics.fillRect(0, GAME_HEIGHT - 400, GAME_WIDTH, 400);
    
    // Add cyberpunk city buildings silhouettes
    cityGraphics.fillStyle(0x050520, 1);
    
    // Create random buildings
    for (let i = 0; i < 40; i++) {
      const width = Phaser.Math.Between(30, 120);
      const height = Phaser.Math.Between(100, 350);
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      
      cityGraphics.fillRect(x, GAME_HEIGHT - height, width, height);
      
      // Add some windows to the buildings
      cityGraphics.fillStyle(0x444499, 0.3);
      for (let w = 0; w < 10; w++) {
        const windowWidth = Phaser.Math.Between(3, 8);
        const windowHeight = Phaser.Math.Between(3, 15);
        const windowX = x + Phaser.Math.Between(5, width - 10);
        const windowY = GAME_HEIGHT - height + Phaser.Math.Between(10, height - 20);
        cityGraphics.fillRect(windowX, windowY, windowWidth, windowHeight);
      }
      cityGraphics.fillStyle(0x050520, 1);
    }
    
    // Add neon glow effect
    const glowGraphics = this.add.graphics();
    glowGraphics.fillStyle(0x5522aa, 0.1);
    glowGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Create digital "noise" particles
    this.digitalParticles = [];
    for (let i = 0; i < 150; i++) {
      // Create different types of particles
      let color, size, alpha;
      
      if (i % 3 === 0) {
        // Neon particles
        color = Phaser.Math.RND.pick([0x00ffff, 0xff00ff, 0xff3377, 0x66bbff]);
        size = Phaser.Math.FloatBetween(0.5, 2);
        alpha = Phaser.Math.FloatBetween(0.3, 0.7);
      } else {
        // Dust/static particles
        color = 0xcccccc;
        size = Phaser.Math.FloatBetween(0.5, 1.2);
        alpha = Phaser.Math.FloatBetween(0.1, 0.3);
      }
      
      const particle = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        size,
        color,
        alpha
      );
      
      this.digitalParticles.push({
        obj: particle,
        speedX: Phaser.Math.FloatBetween(-0.4, 0.4),
        speedY: Phaser.Math.FloatBetween(-0.3, 0.5),
        glitch: Math.random() > 0.8 // Some particles will "glitch"
      });
    }

    // Separate title from lore text to handle them differently
    const titleText = "WELCOME TO THE BONK GAMES!";
    
    // Lore text content with more line breaks (without the title)
    const loreText = 
      "\n\n\n\n" +
      "In the year 2093, art is banned. Individuality is a crime.\n" +
      "Freedom is a privilege—sold to the highest bidder.\n\n\n" +
      "The Network owns everything. The Corps enforce its laws.\n" +
      "The Mob thrives in its shadows. The Bots control what's left.\n\n" +
      "But all of them answer to Bonk Games—the greatest spectacle\n" +
      "in human history.\n\n\n" +
      "Every cycle, contestants fight for survival in the Network's\n" +
      "blood-soaked Arena. It's not just a game—it's a rigged\n" +
      "economy of pain and profit.\n\n" + 
      "Survive, and you'll earn your freedom.\n" +
      "Die, and you'll be recycled—sold for spare parts, uploaded\n" +
      "into a toaster, or worse.\n\n\n" +
      "Your only currency is violence. Your only allies are as\n" +
      "desperate as you. Your enemies? Everyone.\n\n\n" +
      "The cameras are rolling. The crowd is watching.\n" +
      "The Network is always listening.\n\n\n" +
      "FIGHT. SURVIVE. PROFIT.\n\n\n" +
      "Welcome to The Bonk Games.";

    // Calculate responsive font size for intro text
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    const isPortrait = screenHeight > screenWidth;
    
    // Adjust intro font size based on orientation
    let introFontSize = Math.max(16, Math.floor(screenWidth * (isPortrait ? 0.025 : 0.035))); // Smaller in portrait
    
    // Calculate wrap width based on orientation
    const wrapWidth = isPortrait ? screenWidth * 0.9 : GAME_WIDTH * 0.8;
    
    // Create the scrolling text - start 400px from the top of the screen
    const startY = 400;
    this.introText = this.add.text(
      GAME_WIDTH / 2,
      startY,
      loreText,
      {
        fontFamily: '"Tektur", monospace, Courier, Arial',
        fontSize: `${introFontSize}px`,
        color: '#ffffff',
        align: 'center',
        lineSpacing: isPortrait ? 10 : 15, // Reduced line spacing in portrait
        wordWrap: { width: wrapWidth },
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 5, fill: true }
      }
    );
    this.introText.setOrigin(0.5, 0);
    
    // Create an enhanced responsive title with better adaptability for portrait mode
    // Apply even more responsive sizing for title
    const targetTitleWidth = isPortrait ? screenWidth * 0.9 : screenWidth * 0.75;
    
    // Use a flexible base font size based on screen dimensions
    const baseFontSize = isPortrait 
      ? Math.min(80, Math.floor(screenWidth * 0.15)) // Smaller base in portrait, limited max size
      : 100; // Larger in landscape
    
    // Create a temporary text to measure dimensions
    const tempTitleObj = this.add.text(0, 0, titleText, {
      fontFamily: '"Tektur", monospace, Courier, Arial',
      fontSize: `${baseFontSize}px`
    });
    
    // Calculate scaling factor and adjust font size
    const titleScaleFactor = targetTitleWidth / tempTitleObj.width;
    const calculatedFontSize = Math.floor(baseFontSize * titleScaleFactor);
    
    // Apply size limits based on orientation
    const finalTitleFontSize = isPortrait 
      ? Math.min(calculatedFontSize, Math.floor(screenWidth * 0.12)) // Cap size in portrait
      : calculatedFontSize;
      
    tempTitleObj.destroy();
    
    // Position the title to appear before the text (just above the main text)
    const titleY = 350;
    
    // Create the title text with the calculated font size
    const titleTextObj = this.add.text(
      GAME_WIDTH / 2,
      titleY,
      titleText,
      {
        fontFamily: '"Tektur", monospace, Courier, Arial',
        fontSize: `${finalTitleFontSize}px`,
        color: '#00ffff',
        align: 'center',
        shadow: { offsetX: 3, offsetY: 3, color: '#ff00ff', blur: 12, fill: true }
      }
    );
    titleTextObj.setOrigin(0.5, 0);
    
    // Glitch effect for title
    this.time.addEvent({
      delay: 1500,
      callback: () => {
        // Random glitch effect
        if (Math.random() > 0.5) {
          titleTextObj.setVisible(!titleTextObj.visible);
          this.time.addEvent({
            delay: 100,
            callback: () => {
              titleTextObj.setVisible(true);
            },
            callbackScope: this
          });
        }
      },
      callbackScope: this,
      loop: true
    });

    // Calculate scroll distance to make text scroll completely off the top
    const totalTextHeight = this.introText.height + titleTextObj.height;
    const scrollDistance = -(startY + totalTextHeight + 50); // Ensure it scrolls completely off screen
    
    // Match scroll duration to scene duration (57000ms = 57 seconds)
    // Use 95% of the scene duration to ensure everything scrolls completely
    const scrollDuration = this.sceneDuration * 0.95; // End slightly before scene transition
    
    // Create a container for all elements that should scroll together
    const scrollContainer = this.add.container(0, 0);
    
    // Add title and text to the container
    scrollContainer.add(titleTextObj);
    scrollContainer.add(this.introText);
    
    // Animation to scroll the container
    this.scrollTween = this.tweens.add({
      targets: scrollContainer,
      y: scrollDistance,
      duration: scrollDuration,
      ease: 'Linear',
      onComplete: () => {
        // Only stop narration. Since IntroScene and MenuScene share scroll_beat music, we keep it playing
        if (this.narration) this.narration.stop();
        
        // Store music reference in registry so MenuScene can use the same instance
        if (this.music) {
          this.registry.set('scrollBeatMusic', this.music);
        }
        
        // Transition to MenuScene - music will continue playing
        this.scene.start('MenuScene');
      }
    });
    
    // Add game logo centered below the lore text
    if (this.textures.exists('game_logo')) {
      // Calculate position below the text
      const logoY = startY + this.introText.height + 150; // Position logo 150px below the text
      const logo = this.add.image(GAME_WIDTH / 2, logoY, 'game_logo');
      logo.setOrigin(0.5);
      logo.setScale(0.4); // Original scale of 0.4
      
      // Add glow effect
      logo.setTint(0x00ffff);
      
      // Create a glow effect if supported
      if (logo.postFX) {
        logo.postFX.addGlow(0x00ffff, 0.5, 0, false);
      }
      
      // Add the logo to the scroll container so it scrolls with everything else
      scrollContainer.add(logo);
      
      logo.setDepth(99);
    }
    
    // Add scanline effect after everything else so it's on top
    this.scanlines = this.createScanlines();
    this.scanlines.setDepth(100); // Ensure it's above all other elements
    
    // Dialog removed to keep only narration and music

    // Set up pointer handler to detect mouse/touch input
    this.input.on('pointerdown', () => {
      if (this.needsInputDetection) {
        if (this.inputMethod === 'touch') {
          console.log('Touch/mouse input confirmed via pointer event');
          this.needsInputDetection = false;
          this.registry.set('inputMethod', 'touch');
          
          // Auto-proceed to MenuScene after short delay
          this.time.delayedCall(500, () => {
            this.proceedToMenuScene();
          });
        }
      }
    });
  }
  
  setupGamepadSupport() {
    console.log('Setting up gamepad support in IntroScene');
    // Try to ensure gamepad plugin is active
    if (this.input.gamepad) {
      // Force enable the gamepad input
      this.input.gamepad.enabled = true;
      
      // Log gamepad status
      console.log('Gamepad status in IntroScene:', {
        enabled: this.input.gamepad.enabled,
        total: this.input.gamepad.total,
        gamepads: navigator.getGamepads ? Array.from(navigator.getGamepads()).map(g => g ? g.id : null) : 'API not available'
      });
      
      if (this.input.gamepad.on) {
        // Add gamepad connection event
        this.input.gamepad.on('connected', (pad) => {
          console.log(`Gamepad connected in IntroScene: ${pad.id}`);
          this.gamepad = pad;
        });
        
        // Add gamepad button press handler
        this.input.gamepad.on('down', (pad, button, index) => {
          console.log(`Gamepad button pressed: ${index}`);
          
          // Store music reference in registry to access it in MenuScene
          if (this.music) {
            this.registry.set('introMusic', this.music);
          }
          
          // Only stop narration when skipping, keep music playing
          if (this.narration) this.narration.stop();
          
          // Skip intro on any button press
          this.scene.start('MenuScene');
        });
      } else {
        console.log('Gamepad exists but "on" method is not available');
      }
      
      // Check if gamepads are already connected
      if (this.input.gamepad.total > 0) {
        console.log(`Found ${this.input.gamepad.total} gamepads already connected`);
        this.gamepad = this.input.gamepad.getPad(0);
        
        // Manually check for button presses on already connected gamepad
        this.input.gamepad.once('update', () => {
          const pad = this.input.gamepad.getPad(0);
          // Check if any button is pressed on the gamepad at start
          for (let i = 0; i < pad.buttons.length; i++) {
            if (pad.buttons[i].pressed) {
              console.log(`Initial gamepad button ${i} state detected as pressed`);
              this.scene.start('MenuScene');
              break;
            }
          }
        });
      }
    } else {
      console.log('Gamepad not available in this browser');
    }
  }
  
  detectInputMethod() {
    // Flag to track if input method needs to be detected
    this.needsInputDetection = true;
    
    // Check for gamepad
    if (navigator.getGamepads && Array.from(navigator.getGamepads()).some(gp => gp)) {
      this.inputMethod = 'gamepad';
      console.log('Gamepad input method detected');
      
      // Store the input method in the registry to share between scenes
      this.registry.set('inputMethod', 'gamepad');
      
      // Wait for actual gamepad input before proceeding
      this.needsInputDetection = false;
      return;
    }
    
    // Check for touch support - but only set it as potential method
    // We'll wait for actual touch event to proceed
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.inputMethod = 'touch';
      console.log('Touch capability detected, waiting for touch event');
      
      // Listen for touch event to confirm
      window.addEventListener('touchstart', () => {
        if (this.needsInputDetection) {
          console.log('Touch input confirmed');
          this.registry.set('inputMethod', 'touch');
          this.needsInputDetection = false;
          
          // Auto-proceed to MenuScene after short delay
          this.time.delayedCall(500, () => {
            this.proceedToMenuScene();
          });
        }
      }, { once: true });
      
      return;
    }
    
    // For keyboard, wait for an actual key press
    this.inputMethod = 'keyboard';
    console.log('Keyboard assumed, waiting for key press');
    
    // Listen for keyboard event to confirm
    this.input.keyboard.once('keydown', () => {
      if (this.needsInputDetection) {
        console.log('Keyboard input confirmed');
        this.registry.set('inputMethod', 'keyboard');
        this.needsInputDetection = false;
        
        // Auto-proceed to MenuScene after short delay
        this.time.delayedCall(500, () => {
          this.proceedToMenuScene();
        });
      }
    });
    
    // Add event listeners to update input method if it changes
    this.setupInputMethodListeners();
  }
  
  proceedToMenuScene() {
    // Only stop narration. Since IntroScene and MenuScene share scroll_beat music, we keep it playing
    if (this.narration) this.narration.stop();
    
    // Store music reference in registry so MenuScene can use the same instance
    if (this.music) {
      this.registry.set('scrollBeatMusic', this.music);
    }
    
    // Transition to MenuScene - music will continue playing
    this.scene.start('MenuScene');
  }
  
  createScanlines() {
    const scanlineGraphics = this.add.graphics();
    scanlineGraphics.lineStyle(1, 0x000000, 0.2);
    
    // Draw horizontal lines across the screen
    for (let y = 0; y < this.cameras.main.height; y += 4) {
      scanlineGraphics.beginPath();
      scanlineGraphics.moveTo(0, y);
      scanlineGraphics.lineTo(this.cameras.main.width, y);
      scanlineGraphics.closePath();
      scanlineGraphics.strokePath();
    }
    
    return scanlineGraphics;
  }
  
  setupInputMethodListeners() {
    // Listen for gamepad connection
    window.addEventListener('gamepadconnected', (e) => {
      if (this.needsInputDetection) {
        console.log(`Gamepad connected: ${e.gamepad.id}`);
        this.inputMethod = 'gamepad';
        this.registry.set('inputMethod', 'gamepad');
        this.needsInputDetection = false;
        
        // Auto-proceed to MenuScene after short delay
        this.time.delayedCall(500, () => {
          this.proceedToMenuScene();
        });
      }
    });
    
    // Listen for gamepad input (for already connected gamepads)
    if (this.input.gamepad) {
      this.input.gamepad.on('down', (pad, button, index) => {
        if (this.needsInputDetection && this.inputMethod === 'gamepad') {
          console.log(`Gamepad button pressed: ${index}`);
          this.needsInputDetection = false;
          
          // Auto-proceed to MenuScene after short delay
          this.time.delayedCall(500, () => {
            this.proceedToMenuScene();
          });
        }
      });
    }
  }
  
  update() {
    // Update digital particle positions
    if (this.digitalParticles) {
      for (const particle of this.digitalParticles) {
        particle.obj.x += particle.speedX;
        particle.obj.y += particle.speedY;
        
        // Apply glitch effect to some particles
        if (particle.glitch && Math.random() > 0.95) {
          // Teleport the particle to a new location
          particle.obj.x = Phaser.Math.Between(0, GAME_WIDTH);
          particle.obj.y = Phaser.Math.Between(0, GAME_HEIGHT);
        }
        
        // Wrap particles around screen edges
        if (particle.obj.x < 0) particle.obj.x = GAME_WIDTH;
        if (particle.obj.x > GAME_WIDTH) particle.obj.x = 0;
        if (particle.obj.y < 0) particle.obj.y = GAME_HEIGHT;
        if (particle.obj.y > GAME_HEIGHT) particle.obj.y = 0;
      }
    }
    
    // Check for gamepad input in the update loop as a fallback
    if (this.needsInputDetection && this.inputMethod === 'gamepad') {
      if (this.input.gamepad && this.input.gamepad.total > 0) {
        const gamepad = this.input.gamepad.getPad(0);
        
        if (gamepad) {
          // Check if any gamepad button is pressed
          let buttonPressed = false;
          
          // Check all buttons
          for (let i = 0; i < gamepad.buttons.length; i++) {
            if (gamepad.buttons[i] && gamepad.buttons[i].pressed) {
              buttonPressed = true;
              break;
            }
          }
          
          // Also check the analog sticks for significant movement
          if (!buttonPressed) {
            for (let i = 0; i < gamepad.axes.length; i++) {
              if (Math.abs(gamepad.axes[i]) > 0.7) {
                buttonPressed = true;
                break;
              }
            }
          }
          
          if (buttonPressed) {
            console.log('Gamepad input detected in update loop');
            this.needsInputDetection = false;
            
            // Auto-proceed to MenuScene after short delay
            this.time.delayedCall(500, () => {
              this.proceedToMenuScene();
            });
          }
        }
      }
    }
  }
}