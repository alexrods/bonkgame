import { GAME_WIDTH, GAME_HEIGHT, WEB3_CONFIG } from '../../config.js';
import { PlayerAccount } from '../web3/PlayerAccount.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
    this.introMusic = null;
    this.gameoverMusic = null;
    this.playerAccount = null;
    this.typingSpeed = 114; // milliseconds per character (further slowed by 15% from 99ms)
    this.cursorBlinkRate = 500; // milliseconds
    this.reportText = [];
    this.currentTextIndex = 0;
    this.typedText = '';
    this.typewriterSound = null;
    this.cursorVisible = true;
    this.typingFinished = false;
    this.scrollSpeed = 0.5; // pixels per frame
    this.scrolling = false;
    this.scrollPaused = false;
    this.reportMask = null;
    this.buttonClicked = false;
    this.optionsDisplayed = false;
    this.menuButtons = [];
    this.buttonIndex = 0;
    this.gamepadLastActive = 0;
  }

  init(data) {
    // Hide wallet UI in game over screen
    const walletUI = document.getElementById('wallet-ui');
    if (walletUI) {
      walletUI.style.display = 'none';
    }
    
    // Reset all state variables for clean restart
    this.reportText = [];
    this.currentTextIndex = 0;
    this.typedText = '';
    this.typingFinished = false;
    this.scrolling = false;
    this.scrollPaused = false;
    this.gameoverMusic = null;
    this.typewriterSound = null;
    this.reportContainer = null;
    this.cursor = null;
    
    // Ensure typing speed is set correctly
    this.typingSpeed = 114; // milliseconds per character (further slowed by 15% from 99ms)
    
    // Store game stats from data
    this.score = data.score || 0; // Now represents money
    this.killCount = data.killCount || 0;
    this.accuracy = data.accuracy || 0;
    this.isAuthenticated = data.isAuthenticated || false;
    this.highScore = data.highScore || 0;
    
    // Get the intro music from registry
    this.introMusic = this.registry.get('introMusic');
    
    // Stop drone sound if it's still playing from previous scene
    // This fixes a bug where drone sound carries over to game over screen
    const droneSound = this.game.sound.getAll('drone_buzz');
    if (droneSound && droneSound.length > 0) {
      droneSound.forEach(sound => {
        if (sound.isPlaying) {
          sound.stop();
        }
      });
    }
    
    // Get the existing PlayerAccount from registry (keeping this for data persistence)
    const existingAccount = this.registry.get('playerAccount');
    if (existingAccount) {
      this.playerAccount = existingAccount;
      console.log('GameOverScene: Using existing PlayerAccount from registry');
      
      // Reset bonk tokens on player death (tokens are lost unless withdrawn)
      // This fixes the issue where bonk tokens persisted between death sessions
      
      // Reset global bonk balance
      const currentBonkBalance = this.playerAccount.getBonkBalance();
      if (currentBonkBalance > 0) {
        console.log(`Resetting global bonk balance on death: ${currentBonkBalance} -> 0`);
        this.playerAccount.updateBonkBalance(-currentBonkBalance); // Subtract all bonk tokens
      }
      
      // Also reset arena-specific bonk balance
      if (this.playerAccount.arenaBonkAccount) {
        const currentArenaBonkBalance = this.playerAccount.arenaBonkAccount.getBonkBalance();
        if (currentArenaBonkBalance > 0) {
          console.log(`Resetting arena bonk balance on death: ${currentArenaBonkBalance} -> 0`);
          this.playerAccount.arenaBonkAccount.reset(); // Reset arena balance to 0
        }
      }
    } else {
      // Create player account if not in registry (should not happen normally)
      console.warn('GameOverScene: No PlayerAccount in registry, creating new one');
      this.playerAccount = new PlayerAccount(this);
      this.registry.set('playerAccount', this.playerAccount);
    }
    
    // Add listener for orientation changes to adjust text size
    this.orientationListener = () => {
      // If we have already created the report text, reload the scene to apply new text size
      if (this.reportContainer && !this.typingFinished) {
        this.skipTypingAnimation();
      }
    };
    
    window.addEventListener('orientationchange', this.orientationListener);
    window.addEventListener('resize', this.orientationListener);
  }

  create() {
    // Check for detected input method from StartScene
    this.inputMethod = this.registry.get('inputMethod') || null;
    console.log(`GameOver scene using input method: ${this.inputMethod}`);
    
    // According to the pattern: "Game Over - game over.mp3"
    // Stop any existing music and play gameover music
    
    // Check all potential music sources from other scenes and stop them
    const musicSources = [
      this.introMusic,
      this.registry.get('menuMusic'),
      this.registry.get('gameMusic'),
      this.registry.get('tutorialMusic'),
      this.registry.get('characterSelectMusic')
    ];
    
    // Stop any playing music
    musicSources.forEach(music => {
      if (music && music.isPlaying) {
        console.log("Stopping existing music in GameOverScene");
        music.stop();
      }
    });
    
    // Play game over music
    if (this.cache.audio.exists('gameover_music')) {      
      // Play game over music
      this.gameoverMusic = this.sound.add('gameover_music', {
        volume: 0.5,
        loop: true
      });
      this.gameoverMusic.play();
      console.log("Playing game over music");
    } else {
      console.warn("Game over music not found in cache");
    }
    
    // Set up the game over screen with dark background
    const bg = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000);
    bg.setOrigin(0, 0);
    bg.setAlpha(0.8);
    
    // Setup gamepad navigation
    this.setupGamepadSupport();
    
    // Create a container for the report text - this will be used in startTypingEffect()
    this.reportContainer = null;
    
    // Check if player completed tutorial
    const completedTutorial = this.registry.get('tutorialCompleted') || false;
    
    // Generate report text based on player performance
    this.generateReportText(completedTutorial);
    
    // Start the typing effect
    this.startTypingEffect();
    
    // Set up event listeners for wallet events
    this.events.on('player-authenticated', this.handlePlayerAuthenticated, this);
    
    // We'll add the logo in the startTypingEffect method where we have
    // access to the report container and correct positioning
    
    // Add scanline effect after everything else so it's on top
    this.scanlines = this.createScanlines();
    this.scanlines.setDepth(100); // Ensure it's above all other elements
  }
  
  setupGamepadSupport() {
    // Skip setup if gamepad is not available in this browser
    if (!this.input.gamepad || !this.input.gamepad.on) {
      console.log('Gamepad not available in this browser');
      return;
    }
    
    // Enable gamepad input
    this.input.gamepad.enabled = true;
    
    // Initialize button navigation states
    this.buttonIndex = 0; // Current selected button
    this.menuButtons = []; // Will be populated in update
    this.gamepadLastActive = 0; // Timestamp to throttle gamepad inputs
    
    // Handle gamepad connection
    this.input.gamepad.on('connected', (pad) => {
      console.log(`Gamepad connected: ${pad.id}`);
      this.gamepad = pad;
    });
    
    // Add gamepad button press handler
    this.input.gamepad.on('down', (pad, button, index) => {
      // Use any gamepad button as a "select" action
      if (this.menuButtons.length > 0 && this.buttonIndex >= 0 && this.buttonIndex < this.menuButtons.length) {
        // Simulate a click on the currently selected button
        if (index === 0 || index === 9) { // A button or Start button
          const selectedButton = this.menuButtons[this.buttonIndex];
          if (selectedButton && selectedButton.emit) {
            selectedButton.emit('pointerdown');
          }
        }
      }
    });
  }
  
  update() {
    const time = this.time.now;
    
    // Handle scrolling if needed
    if (this.scrolling && !this.scrollPaused) {
      // Calculate how far we need to scroll to show the last line
      const targetY = 80 - (this.typewriterText.height - (GAME_HEIGHT - 160));
      
      // Scroll the container
      if (this.reportContainer.y > targetY) {
        this.reportContainer.y -= this.scrollSpeed;
        
        // Update cursor position to match the text scrolling
        if (this.cursor.visible) {
          this.cursor.y -= this.scrollSpeed;
        }
      } else {
        // Stop scrolling when we've reached the target
        this.scrolling = false;
      }
    }
    
    // Add skip functionality for the typing effect - need to hold briefly
    if (!this.typingFinished && (
        (this.input.keyboard.addKey('SPACE').isDown && this.input.keyboard.addKey('SPACE').getDuration() > 300) || 
        (this.input.activePointer.isDown && this.input.activePointer.downTime > time - 300))) {
      // Skip the typing animation
      this.skipTypingAnimation();
    }
    
    // Update gamepad navigation for the menu buttons
    if (this.optionsDisplayed) {
      this.updateGamepadNavigation();
    }
  }
  
  skipTypingAnimation() {
    // Stop any pending type delays
    this.time.removeAllEvents();
    
    // Show all text at once
    let fullText = '';
    for (let i = 0; i < this.reportText.length; i++) {
      fullText += this.reportText[i] + '\n';
    }
    
    this.typewriterText.setText(fullText);
    
    // Update cursor position
    this.currentTextIndex = this.reportText.length;
    this.typedText = '';
    this.typingFinished = true;
    
    // Stop any currently playing keystroke sounds
    this.sound.getAll('keystroke').forEach(sound => sound.stop());
    this.sound.getAll('keystroke1').forEach(sound => sound.stop());
    this.sound.getAll('keystroke3').forEach(sound => sound.stop());
    
    // Position cursor at end of all text
    const textMetrics = this.typewriterText.getTextMetrics();
    const lineHeight = textMetrics.lineHeight;
    const lineCount = fullText.split('\n').length;
    
    this.cursor.setPosition(
      this.typewriterText.x,
      this.typewriterText.y + (lineCount - 1) * lineHeight
    );
    
    // Check if we need to scroll
    this.checkScroll();
    
    // Add continue prompt
    this.addContinuePrompt();
  }
  
  updateSelectedButton() {
    // Remove highlight from all buttons
    this.menuButtons.forEach((button, index) => {
      if (index === this.buttonIndex) {
        // Highlight selected button
        button.setScale(1.1);
        if (button.style && button.style.backgroundColor) {
          // Make background brighter for selected button
          if (button.style.backgroundColor === '#880000') {
            button.setStyle({ backgroundColor: '#aa0000' });
          } else if (button.style.backgroundColor === '#3f3f3f') {
            button.setStyle({ backgroundColor: '#575757' });
          } else if (button.style.backgroundColor === '#4b7bec') {
            button.setStyle({ backgroundColor: '#3867d6' });
          }
        }
      } else {
        // Reset non-selected buttons
        button.setScale(1);
        if (button.style && button.style.backgroundColor) {
          // Reset background color
          if (button.style.backgroundColor === '#aa0000') {
            button.setStyle({ backgroundColor: '#880000' });
          } else if (button.style.backgroundColor === '#575757') {
            button.setStyle({ backgroundColor: '#3f3f3f' });
          } else if (button.style.backgroundColor === '#3867d6') {
            button.setStyle({ backgroundColor: '#4b7bec' });
          }
        }
      }
    });
  }
  
  handlePlayerAuthenticated(playerData) {
    // When a player authenticates, update the scene
    console.log('Player authenticated in GameOverScene, reloading scene with updated data');
    
    // Reload the scene with updated data
    this.scene.restart({
      score: this.score,
      isAuthenticated: true,
      highScore: Math.max(this.highScore, this.playerAccount.getHighScore())
    });
  }
  
  generateReportText(completedTutorial) {
    const currentDate = new Date();
    const futureDate = new Date(currentDate.getFullYear() + 70, currentDate.getMonth(), currentDate.getDate());
    
    // Clear existing report text
    this.reportText = [];
    
    // Add report header (shortened)
    const hours = currentDate.getHours().toString().padStart(2, '0');
    const minutes = currentDate.getMinutes().toString().padStart(2, '0');
    
    this.reportText.push('== NETWORK BROADCAST ==');
    this.reportText.push('== BONK GAMES SALVAGE UNIT ==');
    this.reportText.push(`AFTER-ACTION REPORT [${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}]`);
    this.reportText.push(`Cycle: ${futureDate.getFullYear()}.${(futureDate.getMonth() + 1).toString().padStart(2, '0')}.${futureDate.getDate().toString().padStart(2, '0')}`);
    this.reportText.push(`Block: ${hours}${minutes}`);
    this.reportText.push('');
    
    // Generate unit ID from wallet address if available
    let unitId = 'G-776-X3'; // Default ID
    
    if (this.playerAccount && this.playerAccount.isPlayerAuthenticated()) {
      const walletAddress = this.playerAccount.getPlayerData().address;
      if (walletAddress && walletAddress.length >= 6) {
        // Use first digit, then next three, then next two from wallet address
        unitId = `${walletAddress.charAt(0)}-${walletAddress.substring(1, 4)}-${walletAddress.substring(4, 6)}`;
        unitId = unitId.toUpperCase(); // Convert to uppercase for consistency
      }
    }
    
    this.reportText.push(`Subject: DEGEN UNIT [${unitId}]`);
    
    // Calculate player grade based on performance
    let grade, gradeText;
    if (this.killCount >= 100 && this.accuracy >= 70) {
      grade = 'S';
      gradeText = 'SUPERB';
    } else if (this.killCount >= 50 && this.accuracy >= 60) {
      grade = 'A';
      gradeText = 'GOOD';
    } else if (this.killCount >= 25 && this.accuracy >= 50) {
      grade = 'B';
      gradeText = 'AVERAGE';
    } else if (this.killCount >= 10 && this.accuracy >= 40) {
      grade = 'D';
      gradeText = 'MEDIOCRE';
    } else {
      grade = 'F';
      gradeText = 'FAIL';
    }
    
    this.reportText.push(`Classification: GRADE ${grade} (${gradeText})`);
    this.reportText.push('');
    
    // Add performance metrics
    if (this.killCount > 0) {
      const killRating = this.getKillRating();
      this.reportText.push(`Target Neutralization: ${this.killCount} [${killRating}]`);
    } else {
      this.reportText.push('Target Neutralization: 0 [INSUFFICIENT]');
    }
    
    if (this.score > 0) {
      const moneyRating = this.getMoneyRating();
      this.reportText.push(`Resource Acquisition: ${this.score} credits [${moneyRating}]`);
    } else {
      this.reportText.push('Resource Acquisition: 0 credits [FAILURE]');
    }
    
    // Add message about lost BONK tokens
    this.reportText.push('');
    this.reportText.push('⚠ ARENA ASSETS LOST ON DEATH ⚠');
    this.reportText.push('All BONK tokens collected but not withdrawn');
    this.reportText.push('have been lost. Always withdraw your tokens');
    this.reportText.push('before exiting the arena.');
    
    this.reportText.push('');
  }
  
  getKillRating() {
    if (this.killCount >= 100) return 'EXCEPTIONAL';
    if (this.killCount >= 50) return 'OUTSTANDING';
    if (this.killCount >= 25) return 'SATISFACTORY';
    if (this.killCount >= 10) return 'ACCEPTABLE';
    return 'MARGINAL';
  }
  
  getMoneyRating() {
    if (this.score >= 10000) return 'EXCEPTIONAL';
    if (this.score >= 5000) return 'OUTSTANDING';
    if (this.score >= 2000) return 'SATISFACTORY';
    if (this.score >= 1000) return 'ACCEPTABLE';
    return 'MARGINAL';
  }
  
  getAccuracyRating(accuracy) {
    if (accuracy >= 80) return 'EXCEPTIONAL';
    if (accuracy >= 70) return 'OUTSTANDING';
    if (accuracy >= 60) return 'SATISFACTORY';
    if (accuracy >= 50) return 'ACCEPTABLE';
    return 'POOR';
  }
  
  startTypingEffect() {
    // Create a container for the report
    this.reportContainer = this.add.container(0, 0);
    
    // Calculate dimensions
    const textWidth = Math.min(GAME_WIDTH - 100, 600);
    const textX = (GAME_WIDTH - textWidth) / 2;
    const textY = 80;
    const maskHeight = GAME_HEIGHT - 160; // Leave space at top and bottom
    
    // Create a mask for the scrolling text
    const maskGraphics = this.make.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(textX - 20, textY, textWidth + 40, maskHeight);
    this.reportMask = new Phaser.Display.Masks.GeometryMask(this, maskGraphics);
    
    // Check if device is in portrait mode
    const isPortrait = window.innerHeight > window.innerWidth;
    
    // Use a monospace font for typewriter effect - 30% larger when not in portrait mode
    const textStyle = {
      fontFamily: 'monospace',
      fontSize: isPortrait ? '16px' : '21px',
      color: '#33ff33',
      align: 'left',
      wordWrap: { width: textWidth }
    };
    
    // Create the text object and add it to the container
    this.typewriterText = this.add.text(textX, textY, '', textStyle);
    this.reportContainer.add(this.typewriterText);
    
    // Apply mask to container
    this.reportContainer.setMask(this.reportMask);
    
    // Add game logo in the bottom right corner of the report
    if (this.textures.exists('game_logo')) {
      // Calculate the right edge of the text area with a bit of padding
      const rightEdge = textX + textWidth - 20; // 20px padding from the right edge
      const bottomEdge = textY + maskHeight - 20; // 20px padding from the bottom edge
      
      // Position the logo in the bottom right
      const logo = this.add.image(
        rightEdge,
        bottomEdge,
        'game_logo'
      );
      logo.setOrigin(1, 1); // Anchor to bottom right
      logo.setScale(0.1); // Much smaller size (1/5 of the original 0.5 scale)
      
      // Apply green tint to match terminal theme
      logo.setTint(0x33ff33);
      
      // Apply subtle glow effect if supported
      if (logo.postFX) {
        logo.postFX.addGlow(0x33ff33, 0.3, 0, false);
      }
      
      // Add to the container so it scrolls with the text
      this.reportContainer.add(logo);
    }
    
    // Add cursor to the end of text (outside container so it can be masked separately)
    this.cursor = this.add.text(textX, textY, '_', textStyle);
    
    // Start cursor blinking
    this.cursorTimer = this.time.addEvent({
      delay: this.cursorBlinkRate,
      callback: this.blinkCursor,
      callbackScope: this,
      loop: true
    });
    
    // Setup typing sounds - load all keystroke variants
    this.keystrokeSounds = [];
    const keystrokeKeys = ['keystroke', 'keystroke1', 'keystroke3'];
    
    // Preload keystroke sounds
    keystrokeKeys.forEach(key => {
      if (this.cache.audio.exists(key)) {
        this.keystrokeSounds.push(this.sound.add(key, {
          volume: 0.5,
          rate: 1.0
        }));
      }
    });
    
    // Fallback to typewriter sound if keystroke sounds aren't available
    if (this.keystrokeSounds.length === 0 && this.cache.audio.exists('typewriter')) {
      this.typewriterSound = this.sound.add('typewriter', {
        volume: 0.5,
        rate: 2.5,
        detune: 600
      });
    }
    
    // We don't need sound queue tracking anymore since we're allowing overlapping sounds
    // Just keeping a reference to the last sound time in case it's used elsewhere
    this.lastSoundTime = 0;
    
    // Add interactive areas for user input to continue
    this.input.on('pointerdown', this.handleUserInput, this);
    this.input.keyboard.on('keydown', this.handleUserInput, this);
    if (this.input.gamepad) {
      this.input.gamepad.on('down', this.handleUserInput, this);
    }
    
    // Start typing effect
    this.typeNextChar();
  }
  
  typeNextChar() {
    if (this.currentTextIndex >= this.reportText.length) {
      this.typingFinished = true;
      
      // Check if we need to start scrolling after typing is complete
      this.checkScroll();
      
      // Add an instruction prompt at the bottom
      this.addContinuePrompt();
      return;
    }
    
    // Get current line being typed
    const currentLine = this.reportText[this.currentTextIndex];
    
    if (this.typedText.length < currentLine.length) {
      // Add next character
      const nextChar = currentLine[this.typedText.length];
      this.typedText += nextChar;
      this.typewriterText.setText(this.getFormattedText());
      
      // Update cursor position
      this.updateCursorPosition();
      
      // Check if we need to start scrolling
      this.checkScroll();
      
      // Queue typing sound (but not for spaces)
      if (nextChar !== ' ') {
        if (this.keystrokeSounds && this.keystrokeSounds.length > 0) {
          // Add to sound queue
          this.queueKeystrokeSound();
        } else if (this.typewriterSound) {
          // Queue typewriter sound
          this.queueTypewriterSound();
        }
      }
      
      // Use consistent typing speed
      const typeSpeed = this.typingSpeed;
      
      // Schedule next character
      this.time.delayedCall(typeSpeed, this.typeNextChar, [], this);
    } else {
      // Line finished, move to next line
      this.currentTextIndex++;
      this.typedText = '';
      
      // Add blank line to the formatted text
      if (this.currentTextIndex < this.reportText.length) {
        this.typewriterText.setText(this.getFormattedText() + '\n');
      }
      
      // Update cursor position
      this.updateCursorPosition();
      
      // Check if we need to start scrolling
      this.checkScroll();
      
      // Short pause between lines (250ms)
      this.time.delayedCall(250, this.typeNextChar, [], this);
    }
  }
  
  checkScroll() {
    // Only check for scrolling if the text is going beyond the mask height
    if (this.typewriterText.height > GAME_HEIGHT - 160) {
      // Calculate how far we need to scroll to show the last line
      const targetY = 80 - (this.typewriterText.height - (GAME_HEIGHT - 160));
      
      // Only start scrolling if we're not already scrolling and we need to scroll
      if (!this.scrolling && this.reportContainer.y > targetY) {
        this.scrolling = true;
      }
    }
  }
  
  addContinuePrompt() {
    // Check if device is in portrait mode
    const isPortrait = window.innerHeight > window.innerWidth;
    
    // Add a prompt at the bottom of the screen to continue
    const promptText = this.add.text(
      GAME_WIDTH / 2, 
      GAME_HEIGHT - 40,
      'Press any key or tap screen to return to Main Terminal',
      {
        fontFamily: 'monospace',
        fontSize: isPortrait ? '14px' : '18px',
        color: '#33ff33',
        align: 'center'
      }
    ).setOrigin(0.5);
    
    // Make it blink
    this.tweens.add({
      targets: promptText,
      alpha: 0,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
  }
  
  handleUserInput() {
    if (this.typingFinished) {
      // Stop all current music
      this.sound.getAll().forEach(sound => {
        sound.stop();
      });
      
      // Let the destination scene handle its own music
      // This is cleaner than trying to start music for another scene
      
      // Check where to go based on tutorial and character selection status
      const tutorialCompleted = localStorage.getItem('tutorialCompleted') === 'true';
      const hasSelectedCharacter = localStorage.getItem('hasSelectedCharacter') === 'true';
      const hadFirstGame = localStorage.getItem('hadFirstGame') === 'true';
      
      if (!tutorialCompleted) {
        // If tutorial not completed, send player to tutorial
        this.scene.start('TutorialScene');
      } else if (tutorialCompleted && !hadFirstGame) {
        // Player has completed tutorial but this was their first game
        // Mark that they've had their first game
        localStorage.setItem('hadFirstGame', 'true');
        // Now send them to character select for their second game
        this.scene.start('CharacterSelectScene', { fromGameOver: true });
      } else if (tutorialCompleted && hadFirstGame) {
        // Returning player who has completed tutorial and first game
        // Always go to character select for subsequent games
        this.scene.start('CharacterSelectScene', { fromGameOver: true });
      } else {
        // Default case - should not reach here normally
        this.scene.start('MenuScene');
      }
    } else {
      // Skip the typing animation if not finished yet
      this.skipTypingAnimation();
    }
  }
  
  // Clean up resources when shutting down
  shutdown() {
    // Stop and clean up all timers
    this.time.removeAllEvents();
    
    // Stop all sounds
    this.sound.getAll().forEach(sound => {
      sound.stop();
    });
    
    // Let each scene handle its own music initialization
    
    // Remove any event listeners
    this.events.off('player-authenticated');
    this.input.off('pointerdown', this.handleUserInput, this);
    this.input.keyboard.off('keydown', this.handleUserInput, this);
    if (this.input.gamepad) {
      this.input.gamepad.off('down', this.handleUserInput, this);
    }
    
    // Remove orientation change listeners
    if (this.orientationListener) {
      window.removeEventListener('orientationchange', this.orientationListener);
      window.removeEventListener('resize', this.orientationListener);
    }
    
    // Clean up UI elements
    this.menuButtons = [];
    this.buttonClicked = false;
    this.optionsDisplayed = false;
    
    // Clean up scanlines to prevent persistence after scene transition
    if (this.scanlines) {
      this.scanlines.clear();
      this.scanlines.destroy();
      this.scanlines = null;
    }
    
    // Call parent shutdown
    super.shutdown();
  }
  
  // Show game over menu options directly in this scene
  showGameOverOptions() {
    // If options are already displayed, do nothing
    if (this.optionsDisplayed) {
      return;
    }
    
    this.optionsDisplayed = true;
    this.buttonClicked = false;
    this.menuButtons = [];
    
    // Add a dark overlay
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000);
    overlay.setOrigin(0, 0);
    overlay.setAlpha(0.8);
    
    // Add branding
    this.add.text(GAME_WIDTH / 2, 60, 'NETWORK BROADCAST', { 
      fontFamily: 'monospace', 
      fontSize: '24px', 
      color: '#33ff33',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    this.add.text(GAME_WIDTH / 2, 90, 'BONK GAMES SALVAGE UNIT', { 
      fontFamily: 'monospace', 
      fontSize: '18px', 
      color: '#33ff33',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    
    // Add terminal-style summary box
    const boxWidth = 400;
    const boxHeight = 160;
    const boxX = (GAME_WIDTH - boxWidth) / 2;
    const boxY = 140;
    
    // Draw terminal frame
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x33ff33, 1);
    graphics.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // Generate unit ID from wallet address if available
    let unitId = 'G-776-X3'; // Default ID
    
    if (this.playerAccount && this.playerAccount.isPlayerAuthenticated()) {
      const walletAddress = this.playerAccount.getPlayerData().address;
      if (walletAddress && walletAddress.length >= 6) {
        // Use first digit, then next three, then next two from wallet address
        unitId = `${walletAddress.charAt(0)}-${walletAddress.substring(1, 4)}-${walletAddress.substring(4, 6)}`;
        unitId = unitId.toUpperCase(); // Convert to uppercase for consistency
      }
    }
    
    // Calculate player grade based on performance
    let grade, gradeText, gradeColor;
    if (this.killCount >= 100 && this.accuracy >= 70) {
      grade = 'S';
      gradeText = 'SUPERB';
      gradeColor = '#ffff00'; // Yellow for S grade
    } else if (this.killCount >= 50 && this.accuracy >= 60) {
      grade = 'A';
      gradeText = 'GOOD';
      gradeColor = '#66ff66'; // Light green for A grade
    } else if (this.killCount >= 25 && this.accuracy >= 50) {
      grade = 'B';
      gradeText = 'AVERAGE';
      gradeColor = '#33ff33'; // Green for B grade
    } else if (this.killCount >= 10 && this.accuracy >= 40) {
      grade = 'D';
      gradeText = 'MEDIOCRE';
      gradeColor = '#ff9900'; // Orange for D grade
    } else {
      grade = 'F';
      gradeText = 'FAIL';
      gradeColor = '#ff3333'; // Red for F grade
    }
    
    // Add summary stats to terminal
    this.add.text(boxX + 20, boxY + 20, `UNIT: ${unitId} [DEGEN]`, { 
      fontFamily: 'monospace', 
      fontSize: '14px', 
      color: '#33ff33'
    });
    
    // Add grade with color based on performance
    this.add.text(boxX + 20, boxY + 40, `GRADE: ${grade} (${gradeText})`, { 
      fontFamily: 'monospace', 
      fontSize: '14px',
      color: gradeColor,
      fontStyle: 'bold'
    });
    
    this.add.text(boxX + 20, boxY + 70, `COMBAT STATS:`, { 
      fontFamily: 'monospace', 
      fontSize: '14px', 
      color: '#33ff33'
    });
    
    this.add.text(boxX + 40, boxY + 100, `Target Neutralization: ${this.killCount}`, { 
      fontFamily: 'monospace', 
      fontSize: '14px', 
      color: '#33ff33'
    });
    
    this.add.text(boxX + 40, boxY + 120, `Resource Acquisition: $${this.score}`, { 
      fontFamily: 'monospace', 
      fontSize: '14px', 
      color: '#33ff33'
    });
    
    this.add.text(boxX + 40, boxY + 140, `Weapons Efficiency: ${Math.round(this.accuracy)}%`, { 
      fontFamily: 'monospace', 
      fontSize: '14px', 
      color: '#33ff33'
    });
    
    // Add a warning about lost BONK tokens on death
    this.add.text(boxX + 40, boxY + 160, `BONK tokens lost on death: WITHDRAW TO KEEP`, { 
      fontFamily: 'monospace', 
      fontSize: '14px', 
      color: '#ff3333',  // Red color for warning
      fontStyle: 'bold'
    });
    
    // Add wallet status message
    const walletStatusY = boxY + boxHeight + 60;  // Adjusted for the extra line
    if (this.isAuthenticated) {
      const connectedText = this.add.text(GAME_WIDTH / 2, walletStatusY, '🎮 Connected to Solana Wallet', { 
        fontFamily: 'monospace', 
        fontSize: '14px', 
        color: '#00ff00',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      
      // Add wallet address if available
      if (this.playerAccount && this.playerAccount.getPlayerData().address) {
        const address = this.playerAccount.getPlayerData().address;
        const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        
        this.add.text(GAME_WIDTH / 2, walletStatusY + 30, `Address: ${shortAddress}`, { 
          fontFamily: 'monospace', 
          fontSize: '12px', 
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2
        }).setOrigin(0.5);
      }
    } else {
      // If not authenticated, show a connect wallet button
      const connectText = this.add.text(GAME_WIDTH / 2, walletStatusY, 'Connect Wallet to Save Score', { 
        fontFamily: 'monospace', 
        fontSize: '14px', 
        color: '#ffcc00',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      
      // Add a connect wallet button
      const connectButton = this.add.text(GAME_WIDTH / 2, walletStatusY + 35, 'Connect Wallet', { 
        fontFamily: 'monospace', 
        fontSize: '16px', 
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        backgroundColor: '#4b7bec',
        padding: {
          left: 15,
          right: 15,
          top: 8,
          bottom: 8
        }
      }).setOrigin(0.5);
      
      connectButton.setInteractive({ useHandCursor: true });
      
      // Add hover effect to the connect button
      connectButton.on('pointerover', () => {
        connectButton.setStyle({ backgroundColor: '#3867d6' });
      });
      
      connectButton.on('pointerout', () => {
        connectButton.setStyle({ backgroundColor: '#4b7bec' });
      });
      
      // When clicked, the HTML connect wallet button will be clicked via DOM
      connectButton.on('pointerdown', () => {
        this.buttonClicked = true;
        const htmlButton = document.getElementById('connect-wallet');
        if (htmlButton) {
          htmlButton.click();
        }
      });
      
      // Add to menu buttons
      this.menuButtons.push(connectButton);
    }
    
    // DEPLOY AGAIN button
    const playAgainButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 140, 'DEPLOY AGAIN', { 
      fontFamily: 'monospace', 
      fontSize: '20px', 
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#880000',
      padding: {
        left: 20,
        right: 20,
        top: 10,
        bottom: 10
      }
    }).setOrigin(0.5);
    
    playAgainButton.setInteractive({ useHandCursor: true });
    playAgainButton.on('pointerdown', () => {
      this.buttonClicked = true;
      
      // Stop all current music
      this.sound.getAll().forEach(sound => {
        sound.stop();
      });
      
      // Let the destination scene handle its own music
      // This is cleaner than trying to start music for another scene
      
      // Check if tutorial has been completed
      const tutorialCompleted = localStorage.getItem('tutorialCompleted') === 'true';
      
      if (!tutorialCompleted) {
        // If tutorial not completed, send player back to tutorial
        this.scene.start('TutorialScene');
      } else {
        // Tutorial completed, proceed with normal restart
        // Set a flag in the registry to indicate this is a restart from game over
        this.registry.set('restartFromGameOver', true);
        
        // Stop current scene and restart GameScene
        this.scene.stop();
        this.scene.get('GameScene').scene.restart();
      }
    });
    
    // Add hover effect
    playAgainButton.on('pointerover', () => {
      playAgainButton.setStyle({ backgroundColor: '#aa0000' });
    });
    playAgainButton.on('pointerout', () => {
      playAgainButton.setStyle({ backgroundColor: '#880000' });
    });
    
    // Add to menu buttons
    this.menuButtons.push(playAgainButton);
    
    // MAIN TERMINAL button
    const mainMenuButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 80, 'MAIN TERMINAL', { 
      fontFamily: 'monospace', 
      fontSize: '16px', 
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#3f3f3f',
      padding: {
        left: 15,
        right: 15,
        top: 8,
        bottom: 8
      }
    }).setOrigin(0.5);
    
    mainMenuButton.setInteractive({ useHandCursor: true });
    mainMenuButton.on('pointerdown', () => {
      this.buttonClicked = true;
      
      // Stop all current music
      this.sound.getAll().forEach(sound => {
        sound.stop();
      });
      
      // Let the destination scene handle its own music
      // This is cleaner than trying to start music for another scene
      
      // Check if tutorial has been completed
      const tutorialCompleted = localStorage.getItem('tutorialCompleted') === 'true';
      const hadFirstGame = localStorage.getItem('hadFirstGame') === 'true';
      
      if (!tutorialCompleted) {
        // If tutorial not completed, send player to tutorial
        this.scene.start('TutorialScene');
      } else if (tutorialCompleted && !hadFirstGame) {
        // Player has completed tutorial but this was their first game
        // Mark that they've had their first game
        localStorage.setItem('hadFirstGame', 'true');
        // Now send them to character select for their second game
        this.scene.start('CharacterSelectScene', { fromGameOver: true });
      } else if (tutorialCompleted && hadFirstGame) {
        // Returning player who has completed tutorial and first game
        // Always go to character select for subsequent games
        this.scene.start('CharacterSelectScene', { fromGameOver: true });
      } else {
        // Default case - should not reach here normally
        this.scene.start('MenuScene');
      }
    });
    
    // Add hover effect
    mainMenuButton.on('pointerover', () => {
      mainMenuButton.setStyle({ backgroundColor: '#575757' });
    });
    mainMenuButton.on('pointerout', () => {
      mainMenuButton.setStyle({ backgroundColor: '#3f3f3f' });
    });
    
    // Add to menu buttons
    this.menuButtons.push(mainMenuButton);
    
    // Setup gamepad navigation
    this.setupGamepadOptions();
    
    // Add scanline effect on top
    this.scanlines = this.createScanlines();
    this.scanlines.setDepth(100);
  }
  
  // Gamepad support for menu options
  setupGamepadOptions() {
    // Skip setup if gamepad is not available in this browser
    if (!this.input.gamepad || !this.input.gamepad.on) {
      console.log('Gamepad not available in this browser');
      return;
    }
    
    // Enable gamepad input
    this.input.gamepad.enabled = true;
    
    // Handle gamepad connection
    this.input.gamepad.on('connected', (pad) => {
      console.log(`Gamepad connected: ${pad.id}`);
      this.gamepad = pad;
    });
    
    // Add gamepad button press handler
    this.input.gamepad.on('down', (pad, button, index) => {
      // Skip if options aren't displayed yet
      if (!this.optionsDisplayed) return;
      
      // Use any gamepad button as a "select" action
      if (this.menuButtons.length > 0 && this.buttonIndex >= 0 && this.buttonIndex < this.menuButtons.length) {
        // Simulate a click on the currently selected button
        if (index === 0 || index === 9) { // A button or Start button
          const selectedButton = this.menuButtons[this.buttonIndex];
          if (selectedButton && selectedButton.emit) {
            selectedButton.emit('pointerdown');
          }
        }
      }
    });
    
    // Update method for gamepad navigation
    this.events.on('update', this.updateGamepadNavigation, this);
    
    // Highlight the first button
    this.buttonIndex = 0;
    this.updateSelectedButton();
  }
  
  // Update gamepad navigation
  updateGamepadNavigation() {
    // Skip if options aren't displayed yet
    if (!this.optionsDisplayed) return;
    
    const time = this.time.now;
    
    // Handle gamepad navigation
    if (this.input.gamepad && this.input.gamepad.total > 0) {
      const gamepad = this.input.gamepad.getPad(0);
      
      // Add a cooldown to prevent too rapid navigation
      if (gamepad && time > this.gamepadLastActive + 300) {
        // Vertical navigation (D-pad or left stick)
        const verticalInput = 
          gamepad.buttons[12].value - gamepad.buttons[13].value || // D-pad up/down
          gamepad.axes[1].value; // Left stick vertical
        
        if (Math.abs(verticalInput) > 0.5) {
          if (verticalInput < -0.5) {
            // Navigate up
            this.buttonIndex = Math.max(0, this.buttonIndex - 1);
            this.updateSelectedButton();
            this.gamepadLastActive = time;
          } else if (verticalInput > 0.5) {
            // Navigate down
            this.buttonIndex = Math.min(this.menuButtons.length - 1, this.buttonIndex + 1);
            this.updateSelectedButton();
            this.gamepadLastActive = time;
          }
        }
      }
    }
  }
  
  // Update selected button highlight
  updateSelectedButton() {
    // Skip if options aren't displayed yet
    if (!this.optionsDisplayed || this.menuButtons.length === 0) return;
    
    // Remove highlight from all buttons
    this.menuButtons.forEach((button, index) => {
      if (index === this.buttonIndex) {
        // Highlight selected button
        button.setScale(1.1);
        if (button.style && button.style.backgroundColor) {
          // Make background brighter for selected button
          if (button.style.backgroundColor === '#880000') {
            button.setStyle({ backgroundColor: '#aa0000' });
          } else if (button.style.backgroundColor === '#3f3f3f') {
            button.setStyle({ backgroundColor: '#575757' });
          } else if (button.style.backgroundColor === '#4b7bec') {
            button.setStyle({ backgroundColor: '#3867d6' });
          }
        }
      } else {
        // Reset non-selected buttons
        button.setScale(1);
        if (button.style && button.style.backgroundColor) {
          // Reset background color
          if (button.style.backgroundColor === '#aa0000') {
            button.setStyle({ backgroundColor: '#880000' });
          } else if (button.style.backgroundColor === '#575757') {
            button.setStyle({ backgroundColor: '#3f3f3f' });
          } else if (button.style.backgroundColor === '#3867d6') {
            button.setStyle({ backgroundColor: '#4b7bec' });
          }
        }
      }
    });
  }
  
  getFormattedText() {
    let result = '';
    
    // Add completed lines
    for (let i = 0; i < this.currentTextIndex; i++) {
      result += this.reportText[i] + '\n';
    }
    
    // Add current line being typed
    if (this.currentTextIndex < this.reportText.length) {
      result += this.typedText;
    }
    
    return result;
  }
  
  blinkCursor() {
    if (this.typingFinished) {
      // Keep cursor visible after typing is done
      this.cursor.setVisible(true);
      return;
    }
    
    this.cursorVisible = !this.cursorVisible;
    this.cursor.setVisible(this.cursorVisible);
  }
  
  updateCursorPosition() {
    // Calculate cursor position based on the last character position
    const text = this.getFormattedText();
    const lastLineBreak = text.lastIndexOf('\n');
    const currentLineText = lastLineBreak >= 0 ? text.substring(lastLineBreak + 1) : text;
    
    // Calculate new position
    const textMetrics = this.typewriterText.getTextMetrics();
    const lineHeight = textMetrics.lineHeight;
    const lineCount = text.split('\n').length;
    
    // Position cursor at end of current line
    this.cursor.setPosition(
      this.typewriterText.x + this.getTextWidth(currentLineText),
      this.typewriterText.y + (lineCount - 1) * lineHeight
    );
  }
  
  getTextWidth(text) {
    // Check if device is in portrait mode
    const isPortrait = window.innerHeight > window.innerWidth;
    
    // Approximate width calculation for monospace font
    // This will need adjustment based on the specific font used
    const charWidth = isPortrait ? 9.6 : 12.5; // 30% larger width for landscape mode
    return text.length * charWidth; // Estimated character width in pixels
  }
  
  // Play keystroke sound immediately
  queueKeystrokeSound() {
    // Use random keystroke sound from array
    const randomIndex = Math.floor(Math.random() * this.keystrokeSounds.length);
    const keystrokeSound = this.keystrokeSounds[randomIndex];
    
    // Create a clone of the sound for independent playback
    const soundInstance = this.sound.add(keystrokeSound.key, {
      volume: 0.5,
      rate: 1.0
    });
    
    // Play the sound immediately
    soundInstance.play();
    
    // Clean up the sound instance after it completes
    soundInstance.once('complete', () => {
      soundInstance.destroy();
    });
  }
  
  // Play typewriter sound immediately
  queueTypewriterSound() {
    // Create a clone of the sound for independent playback
    const soundInstance = this.sound.add('typewriter', {
      volume: 0.5,
      rate: 2.5,
      detune: 600
    });
    
    // Play the sound immediately
    soundInstance.play();
    
    // Clean up the sound instance after it completes
    soundInstance.once('complete', () => {
      soundInstance.destroy();
    });
  }
  
  // Process the next sound in queue - kept for backward compatibility
  processNextSound() {
    // This method is no longer used but kept for compatibility
    // Sounds are now played immediately without queuing
  }
  
  showButtons() {
    // This method is no longer used, but we'll keep a simplified version that
    // would navigate to the menu scene if it were ever called
    console.log('showButtons method is deprecated');
    
    // Stop all sounds
    this.sound.stopAll();
    
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
}