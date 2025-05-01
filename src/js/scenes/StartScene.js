import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
    this.transitioning = false; // Track when we're transitioning between logos or scenes
  }
  
  preload() {
    this.load.image('solana_logo', '/assets//start/solana.png');
    this.load.image('ponzi_labs_logo', '/assets//start/PonziLabsLogo.png');
    this.load.image('breakout_logo', '/assets//start/breakout_logo.png');
    this.load.image('start_bg', '/assets//start/start_bg.png');
    this.load.image('start_bgPortrait', '/assets//start/start_bgPortrait.png');
  }
  
  create() {
    // Hide wallet UI in StartScene
    const walletUI = document.getElementById('wallet-ui');
    if (walletUI) {
      walletUI.style.display = 'none';
    }
    
    // Determine if we're in portrait or landscape mode
    const isPortrait = this.scale.orientation === Phaser.Scale.PORTRAIT || window.innerHeight > window.innerWidth;
    
    // Add background image based on orientation
    this.bg = this.add.image(
      GAME_WIDTH / 2, 
      GAME_HEIGHT / 2, 
      isPortrait ? 'start_bgPortrait' : 'start_bg'
    );
    
    // Scale the background to cover the screen
    this.bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    
    // Add responsive handling for orientation changes
    this.scale.on('orientationchange', this.handleOrientationChange, this);
    
    // Disable keyboard and gamepad input for this scene
    this.input.keyboard.enabled = false;
    if (this.input.gamepad) {
      this.input.gamepad.enabled = false;
    }
    
    // Set current stage to control the sequence of logos
    this.currentStage = 'breakout'; // First show Breakout logo, then Ponzi Labs logo, then Solana logo
    
    // Add breakout logo to the center of the screen first
    this.breakoutLogo = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'breakout_logo');
    
    // Scale the breakout logo appropriately (start small)
    // Increase size by 20% in landscape and 33% in portrait
    const baseScaleFactor = Math.min(
      (GAME_WIDTH * (isPortrait ? 0.6 : 0.4)) / this.breakoutLogo.width,
      (GAME_HEIGHT * (isPortrait ? 0.4 : 0.3)) / this.breakoutLogo.height
    );
    
    // Apply the size increase
    const sizeMultiplier = isPortrait ? 1.33 : 1.2;
    const breakoutScaleFactor = baseScaleFactor * sizeMultiplier * 0.5; // Start at 50% of final size
    
    this.breakoutLogo.setScale(breakoutScaleFactor);
    
    // In portrait mode, move the logo up by 10% (adjusted from 20%)
    if (isPortrait) {
      this.breakoutLogo.y = GAME_HEIGHT / 2 - (GAME_HEIGHT * 0.1); // Move up by 10% of screen height
    }
    
    // Set initial transparency to 0 (invisible)
    this.breakoutLogo.setAlpha(0);
    
    // Add a 222ms delay before starting the breakout logo animation
    this.time.delayedCall(222, () => {
      // Create grow and fade-in tween for Breakout logo
      this.tweens.add({
        targets: this.breakoutLogo,
        scale: breakoutScaleFactor * 2, // Double the size during animation
        alpha: 1,
        duration: 1800,
        ease: 'Back.easeOut', // Elastic effect as it grows
        onComplete: () => {
          // Add pulse effect once fully grown
          this.tweens.add({
            targets: this.breakoutLogo,
            scale: { from: breakoutScaleFactor * 2, to: breakoutScaleFactor * 2.1 },
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
          });
        }
      });
      
      // Fade in the prompt text after the Breakout logo
      this.tweens.add({
        targets: this.breakoutPromptText,
        alpha: 1,
        duration: 1000,
        delay: 2000, // Show after Breakout logo is fully visible
        ease: 'Power2'
      });
      
      // Pulse animation for the prompt text
      this.tweens.add({
        targets: this.breakoutPromptText,
        alpha: 0.5,
        duration: 1000,
        delay: 3000,
        ease: 'Power2',
        yoyo: true,
        repeat: -1
      });
    });
    
    // Add PonziLabs logo to the center of the screen (initially hidden)
    this.ponziLogo = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ponzi_labs_logo');
    
    // Scale the PonziLabs logo appropriately
    const ponziScaleFactor = Math.min(
      (GAME_WIDTH * (isPortrait ? 0.9 : 0.6)) / this.ponziLogo.width,
      (GAME_HEIGHT * (isPortrait ? 0.9 : 0.6)) / this.ponziLogo.height
    );
    this.ponziLogo.setScale(ponziScaleFactor);
    
    // Apply green tint like the game over scene
    this.ponziLogo.setTint(0x33ff33);
    
    // Set Ponzi logo invisible initially
    this.ponziLogo.setAlpha(0);
    
    // Add prompt text for Breakout logo
    this.breakoutPromptText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.8,
      'Tap or click to continue',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
        align: 'center'
      }
    );
    
    this.breakoutPromptText.setOrigin(0.5);
    this.breakoutPromptText.setAlpha(0);
    
    // Add Ponzi prompt text (initially hidden)
    this.ponziPromptText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.8,
      'Tap or click to continue',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
        align: 'center'
      }
    );
    
    this.ponziPromptText.setOrigin(0.5);
    this.ponziPromptText.setAlpha(0);
    
    // Add Solana logo to the center of the screen (initially hidden)
    this.solanaLogo = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'solana_logo');
    
    // Scale the Solana logo appropriately
    const solanaScaleFactor = Math.min(
      (GAME_WIDTH * 0.7) / this.solanaLogo.width,
      (GAME_HEIGHT * 0.7) / this.solanaLogo.height
    );
    this.solanaLogo.setScale(solanaScaleFactor);
    
    // Hide Solana logo initially
    this.solanaLogo.setAlpha(0);
    
    // Second prompt text for Solana logo (initially hidden)
    this.solanaPromptText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.8,
      'Tap or click to continue',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
        align: 'center'
      }
    );
    
    this.solanaPromptText.setOrigin(0.5);
    this.solanaPromptText.setAlpha(0);
    
    // Set up touch/mouse input
    this.setupTouchMouseInput();
    
    // Add scanline effect last so it's on top of the logos
    this.scanlines = this.createScanlines();
    this.scanlines.setDepth(100); // Ensure it's above all other elements
  }
  
  // Show the Ponzi logo after the Breakout logo
  showPonziLogo() {
    // Stop any running tweens
    this.tweens.killTweensOf(this.breakoutLogo);
    this.tweens.killTweensOf(this.breakoutPromptText);
    
    // Immediately destroy the breakout logo
    if (this.breakoutLogo) {
      this.breakoutLogo.destroy();
      this.breakoutLogo = null;
    }
    
    // Immediately destroy the breakout prompt text
    if (this.breakoutPromptText) {
      this.breakoutPromptText.destroy();
      this.breakoutPromptText = null;
    }
    
    // Fade out background
    this.tweens.add({
      targets: this.bg,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        // Set background color to black
        this.cameras.main.setBackgroundColor(0x000000);
        
        // Add a green overlay covering the whole screen
        this.greenOverlay = this.add.rectangle(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2,
          GAME_WIDTH,
          GAME_HEIGHT,
          0x33ff33,
          0.1 // Subtle green tint
        );
        this.greenOverlay.setAlpha(0);
        
        // Fade in Ponzi logo and green overlay
        this.tweens.add({
          targets: [this.ponziLogo, this.greenOverlay],
          alpha: { from: 0, to: function(target, key, value, targetIndex) { 
            return targetIndex === 1 ? 0.1 : 1; // greenOverlay is at index 1 in the array
          } },
          duration: 1500,
          ease: 'Power2'
        });
        
        // Fade in Ponzi prompt text
        this.tweens.add({
          targets: this.ponziPromptText,
          alpha: 1,
          duration: 1000,
          delay: 1500, // Show after Ponzi logo is visible
          ease: 'Power2'
        });
        
        // Pulse animation for Ponzi prompt text
        this.tweens.add({
          targets: this.ponziPromptText,
          alpha: 0.5,
          duration: 1000,
          delay: 2500,
          ease: 'Power2',
          yoyo: true,
          repeat: -1,
          onComplete: () => {
            this.transitioning = false;
          }
        });
        
        // Update current stage
        this.currentStage = 'ponzi';
        
        // Allow clicks again after the logo is fully visible
        this.time.delayedCall(1800, () => {
          this.transitioning = false;
        });
      }
    });
  }
  
  // Show the Solana logo after the Ponzi logo
  showSolanaLogo() {
    // Stop any running tweens
    this.tweens.killTweensOf(this.ponziLogo);
    this.tweens.killTweensOf(this.ponziPromptText);
    
    // Immediately destroy the Ponzi logo
    if (this.ponziLogo) {
      this.ponziLogo.destroy();
      this.ponziLogo = null;
    }
    
    // Immediately destroy the Ponzi prompt text
    if (this.ponziPromptText) {
      this.ponziPromptText.destroy();
      this.ponziPromptText = null;
    }
    
    // Fade out green overlay
    this.tweens.add({
      targets: this.greenOverlay,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        // Destroy green overlay
        if (this.greenOverlay) {
          this.greenOverlay.destroy();
          this.greenOverlay = null;
        }
        
        // Set background color to black
        this.cameras.main.setBackgroundColor(0x000000);
        
        // Fade in Solana logo
        this.tweens.add({
          targets: this.solanaLogo,
          alpha: 1,
          duration: 1500,
          ease: 'Power2'
        });
        
        // Fade in Solana prompt text
        this.tweens.add({
          targets: this.solanaPromptText,
          alpha: 1,
          duration: 1000,
          delay: 1500, // Show after Solana logo is visible
          ease: 'Power2'
        });
        
        // Pulse animation for Solana prompt text
        this.tweens.add({
          targets: this.solanaPromptText,
          alpha: 0.5,
          duration: 1000,
          delay: 2500,
          ease: 'Power2',
          yoyo: true,
          repeat: -1,
          onComplete: () => {
            // Reset transitioning flag once animations are done
            this.transitioning = false;
          }
        });
        
        // Update current stage
        this.currentStage = 'solana';
        
        // Allow clicks again after the logo is fully visible
        this.time.delayedCall(1800, () => {
          this.transitioning = false;
        });
      }
    });
  }
  
  setupTouchMouseInput() {
    // Detect touch/mouse input to proceed through the logo sequence
    this.input.on('pointerdown', () => {
      // Don't handle clicks if we're already transitioning
      if (this.transitioning) return;
      
      // First stage: show Breakout logo
      if (this.currentStage === 'breakout') {
        // Make sure the logo is fully visible before allowing clicks
        if (this.breakoutLogo.alpha < 0.8) return;
        
        // First click: Show Ponzi logo
        this.transitioning = true;
        this.showPonziLogo();
      } 
      // Second stage: PonziLabs logo is shown
      else if (this.currentStage === 'ponzi') {
        // Make sure the Ponzi logo is fully visible before allowing clicks
        if (this.ponziLogo.alpha < 0.8) return;
        
        // Second click: Show Solana logo
        this.transitioning = true;
        this.showSolanaLogo();
      }
      // Third stage: Solana logo is shown
      else if (this.currentStage === 'solana') {
        // Make sure the Solana logo is fully visible before allowing clicks
        if (this.solanaLogo.alpha < 0.8) return;
        
        // Third click: Proceed to next scene
        this.transitioning = true;
        this.proceedToNextScene();
      }
    });
  }
  
  proceedToNextScene() {
    // Unlock audio context if needed
    if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
      this.sound.context.resume().then(() => {
        console.log('Audio context resumed after user interaction');
        this.registry.set('audioUnlocked', true);
      });
    } else {
      // Mark audio as unlocked even if it wasn't suspended
      // This ensures IntroScene will play audio immediately
      this.registry.set('audioUnlocked', true);
    }
    
    // Stop all tweens
    this.tweens.killAll();
    
    // Immediately destroy the Solana logo
    if (this.solanaLogo) {
      this.solanaLogo.destroy();
      this.solanaLogo = null;
    }
    
    // Immediately destroy the Solana prompt text
    if (this.solanaPromptText) {
      this.solanaPromptText.destroy();
      this.solanaPromptText = null;
    }
    
    // Clean up any remaining objects
    if (this.breakoutLogo) {
      this.breakoutLogo.destroy();
      this.breakoutLogo = null;
    }
    
    if (this.breakoutPromptText) {
      this.breakoutPromptText.destroy();
      this.breakoutPromptText = null;
    }
    
    if (this.ponziLogo) {
      this.ponziLogo.destroy();
      this.ponziLogo = null;
    }
    
    if (this.ponziPromptText) {
      this.ponziPromptText.destroy();
      this.ponziPromptText = null;
    }
    
    if (this.greenOverlay) {
      this.greenOverlay.destroy();
      this.greenOverlay = null;
    }
    
    // Transition to intro scene with a fade
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('IntroScene');
    });
  }
  
  handleOrientationChange(orientation) {
    // Update background image when orientation changes
    const isPortrait = orientation === Phaser.Scale.PORTRAIT || window.innerHeight > window.innerWidth;
    
    // Change the background texture
    this.bg.setTexture(isPortrait ? 'start_bgPortrait' : 'start_bg');
    
    // Resize to fill screen
    this.bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    
    // Update logo sizes based on new orientation
    if (this.breakoutLogo && this.breakoutLogo.active) {
      const baseScaleFactor = Math.min(
        (GAME_WIDTH * (isPortrait ? 0.6 : 0.4)) / this.breakoutLogo.width,
        (GAME_HEIGHT * (isPortrait ? 0.4 : 0.3)) / this.breakoutLogo.height
      );
      
      // Apply the size increase (20% in landscape, 33% in portrait)
      const sizeMultiplier = isPortrait ? 1.33 : 1.2;
      const breakoutScaleFactor = baseScaleFactor * sizeMultiplier;
      
      // Adjust position based on orientation
      if (isPortrait) {
        this.breakoutLogo.y = GAME_HEIGHT / 2 - (GAME_HEIGHT * 0.1); // Move up by 10% of screen height
      } else {
        this.breakoutLogo.y = GAME_HEIGHT / 2; // Center vertically in landscape
      }
      
      // Keep the current scaling effect intact
      if (this.breakoutLogo.scale < breakoutScaleFactor) {
        // If it's in the growing animation
        this.breakoutLogo.setScale(this.breakoutLogo.scale);
      } else {
        this.breakoutLogo.setScale(breakoutScaleFactor * 2);
      }
    }
    
    if (this.ponziLogo && this.ponziLogo.active) {
      const ponziScaleFactor = Math.min(
        (GAME_WIDTH * (isPortrait ? 0.9 : 0.6)) / this.ponziLogo.width,
        (GAME_HEIGHT * (isPortrait ? 0.9 : 0.6)) / this.ponziLogo.height
      );
      this.ponziLogo.setScale(ponziScaleFactor);
    }
    
    if (this.solanaLogo && this.solanaLogo.active) {
      const solanaScaleFactor = Math.min(
        (GAME_WIDTH * 0.7) / this.solanaLogo.width,
        (GAME_HEIGHT * 0.7) / this.solanaLogo.height
      );
      this.solanaLogo.setScale(solanaScaleFactor);
    }
    
    // Recreate scanlines for new dimensions
    if (this.scanlines) {
      this.scanlines.clear();
      this.scanlines.destroy();
      this.scanlines = this.createScanlines();
      this.scanlines.setDepth(100);
    }
  }
  
  shutdown() {
    // Clean up resources when shutting down
    this.tweens.killAll();
    
    // Clean up any event listeners
    this.input.off('pointerdown');
    this.scale.off('orientationchange', this.handleOrientationChange, this);
    
    // Clean up scanlines to prevent persistence after scene transition
    if (this.scanlines) {
      this.scanlines.clear();
      this.scanlines.destroy();
      this.scanlines = null;
    }
    
    // Clean up green overlay
    if (this.greenOverlay) {
      this.greenOverlay.destroy();
      this.greenOverlay = null;
    }
    
    // Re-enable keyboard and gamepad for other scenes
    this.input.keyboard.enabled = true;
    if (this.input.gamepad) {
      this.input.gamepad.enabled = true;
    }
  }
  
  createScanlines() {
    const scanlineGraphics = this.add.graphics();
    scanlineGraphics.lineStyle(1, 0x000000, 0.3); // Black scanlines with slightly higher opacity
    
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