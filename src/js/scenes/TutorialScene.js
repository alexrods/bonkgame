import { GAME_WIDTH, GAME_HEIGHT, WEB3_CONFIG } from '../../config.js';
import { PlayerManager } from '../managers/PlayerManager.js';
import { EnemyManager } from '../managers/EnemyManager.js';
import { GameUI } from '../ui/GameUI.js';
import { LabEnvironment } from '../environment/LabEnvironment.js';
import { PlayerAccount } from '../web3/PlayerAccount.js';
import { GamepadController } from '../utils/GamepadController.js';
import { DroneWheel } from '../ui/DroneWheel.js';
import { DroneManager } from '../managers/DroneManager.js';
import { WeaponsMenu } from '../ui/WeaponsMenu.js';

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TutorialScene' });
    this.introMusic = null;
    this.playerAccount = null;
    this.tutorialStep = 0;
    this.targets = null;
    this.targetHits = 0;
    this.movementCompleted = false;
    this.shootingCompleted = false;
    this.enemiesSpawned = false;
    this.enemiesDefeated = 0;
    this.directionsMovedIn = new Set();
    this.tutorialSounds = {};
    this.droneWheelStep = 0; // Track drone wheel tutorial sub-steps
    this.droneOrderedAmmo = false; // Track if ammo was ordered
    this.droneOrderedShield = true; // Track if shield was ordered
    this.weaponsMenuCompleted = false; // Track if weapons menu tutorial is completed
    this.weaponSelected = false; // Track if weapon has been selected
    this.skipButton = null; // Skip tutorial button
    this.confirmDialog = null; // Confirmation dialog
    this.isConfirmDialogOpen = false; // Track if confirmation dialog is open
  }
  
  preload() {
    // Preload tutorial-specific sounds that might not be in the global asset loader
    this.load.audio('got_ammo', '/assets//sound/tutorial/got_ammo.mp3');
    
    // Preload dialog assets that will be needed for GameScene
    // This ensures assets are available when transitioning from tutorial to game
    this.load.image('degen', '/assets//story/degen/intro/degen.png');
    this.load.image('girl', '/assets//story/degen/intro/girl.png');
    this.load.image('networkExec', '/assets//story/degen/intro/networkExec.png');
  }
  
  // Method to show floating text messages
  showFloatingText(data) {
    const { x, y, text, color } = data;
    const floatingText = this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: color || '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center'
    });
    floatingText.setOrigin(0.5);
    floatingText.setDepth(100);
    
    // Animate the text
    this.tweens.add({
      targets: floatingText,
      y: floatingText.y - 30,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        floatingText.destroy();
      }
    });
    
    return floatingText;
  }
  
  init() {
    // Hide wallet UI during tutorial
    const walletUI = document.getElementById('wallet-ui');
    if (walletUI) {
      walletUI.style.display = 'none';
    }
    
    this.directionsShot = new Set();
    
    // Flag to control whether drone wheel can be accessed (only after receiving credits)
    this.canAccessDroneWheel = false;
    
    // Create a background color matching the concrete tutorial floor
    this.cameras.main.setBackgroundColor(0x888888);
    
    // According to the pattern: "Tutorial - intro.mp3"
    // First check if menu music is playing and stop it (different music type)
    const menuMusic = this.registry.get('menuMusic');
    if (menuMusic && menuMusic.isPlaying) {
      console.log('Stopping menu music in TutorialScene');
      menuMusic.stop();
    }

    // Check if existing intro_music is already playing from GameScene or CharacterSelect
    const existingGameMusic = this.registry.get('gameMusic');
    const existingCharSelectMusic = this.registry.get('characterSelectMusic');
    let existingIntroMusic = existingGameMusic || existingCharSelectMusic;
    
    if (existingIntroMusic && existingIntroMusic.isPlaying) {
      // Continue using the existing intro_music instance
      console.log("Using existing intro_music in TutorialScene");
      this.tutorialMusic = existingIntroMusic;
      
      // Adjust volume for tutorial
      this.tutorialMusic.setVolume(0.5);
      
      // Store in registry with tutorial key
      this.registry.set('tutorialMusic', this.tutorialMusic);
    } 
    // No existing intro_music, need to create a new instance
    else if (this.cache.audio.exists('intro_music')) {
      // Create new intro music instance
      this.tutorialMusic = this.sound.add('intro_music', {
        volume: 0.5, // Medium volume for tutorial
        loop: true
      });
      
      // Play the intro music for the tutorial scene
      this.tutorialMusic.play();
      console.log('Starting new intro_music in TutorialScene');
      
      // Store in registry for other scenes that need it
      this.registry.set('tutorialMusic', this.tutorialMusic);
      this.registry.set('introMusicInstance', this.tutorialMusic); // Generic key for any scene using intro.mp3
    } else {
      console.warn("intro_music not found in cache for TutorialScene");
    }
    
    // Initialize player account and web3 connection
    this.initializePlayerAccount();
    
    // Initialize our component managers
    this.initializeManagers();
    
    // Track collected powerups to prevent picking up the same one multiple times
    this.collectedPowerups = {
      magazine: false,
      armor: false,
      speed: false,
      fireRate: false,
      bulletTime: false,
      shotgun: false,
      emote: false,
      robot: false,
      withdraw: false
    };
  }
  
  initializePlayerAccount() {
    // Get the existing PlayerAccount from registry
    const existingAccount = this.registry.get('playerAccount');
    if (existingAccount) {
      this.playerAccount = existingAccount;
      console.log('TutorialScene: Using existing PlayerAccount from registry');
    } else {
      // Create player account manager if not in registry
      console.warn('TutorialScene: No PlayerAccount in registry, creating new one');
      this.playerAccount = new PlayerAccount(this);
      this.registry.set('playerAccount', this.playerAccount);
    }
  }
  
  initializeManagers() {
    // Initialize lab environment first (for floor and containers)
    this.environment = new LabEnvironment(this);
    this.environment.init();
    
    // Initialize UI for tutorial instructions
    this.ui = new GameUI(this);
    this.ui.init();
    
    // Initialize player with reference to scene
    this.playerManager = new PlayerManager(this);
    this.playerManager.init();
    
    // Initialize enemy manager with reference to blood container
    this.enemyManager = new EnemyManager(this, this.environment.getBloodContainer());
    this.enemyManager.init();
    
    // Initialize drone manager
    this.droneManager = new DroneManager(this);
    this.droneManager.init();
    
    // Initialize drone wheel UI
    this.droneWheel = new DroneWheel(this);
    this.droneWheel.init();
    
    // Initialize gamepad controller
    this.gamepadController = new GamepadController(this);
    this.gamepadController.init();
    
    // Create target group for the target practice step
    this.targets = this.physics.add.group({
      allowGravity: false,
      collideWorldBounds: true
    });
  }
  
  // Method to initialize drone wheel tutorial features
  setupDroneWheelTutorial() {
    if (!this.droneWheel) {
      console.error("DroneWheel not initialized");
      return;
    }
    
    // Set up overrides for tutorial
    this.setupDroneWheelOverrides();
  }
  
  // Set up the overrides for the drone wheel in tutorial mode
  setupDroneWheelOverrides() {
    if (!this.droneWheel) {
      console.error("DroneWheel could not be initialized");
      return;
    }
    
    console.log("Setting up drone wheel overrides for tutorial");
    
    // Save the original confirmSelection method
    this.originalConfirmSelection = this.droneWheel.confirmSelection;
    
    // Override the confirmation method for tutorial
    this.droneWheel.confirmSelection = () => {
      if (!this.droneWheel.isVisible) return false;
      
      // If no option is selected, do nothing
      if (this.droneWheel.selectedIndex === -1) return false;
      
      const upgrade = this.droneWheel.availableUpgrades[this.droneWheel.selectedIndex];
      let upgradeLevel = 1;
      let upgradeEffect = 0;
      let upgradeDuration = 0;
      
      // Check which upgrade was selected in tutorial mode
      if (this.tutorialStep === 4) { // Drone wheel tutorial step
        // For drone wheel tutorial, we only allow specific upgrades based on droneWheelStep
        if (this.droneWheelStep === 0) {
          // First step: Only allow selecting ammo
          if (upgrade.type !== 'magazine') {
            this.tutorialText.setText("For this tutorial, please select AMMO first");
            this.droneWheel.flashDescriptionText();
            return false;
          }
          // Mark ammo as ordered
          this.droneOrderedAmmo = true;
          // Don't mark as collected yet - wait for actual pickup
        } else if (this.droneWheelStep === 1) {
          // Second step: Only allow selecting shield
          if (upgrade.type !== 'armor') {
            this.tutorialText.setText("Now, please select SHIELD");
            this.droneWheel.flashDescriptionText();
            return false;
          }
          // Mark shield as ordered
          this.droneOrderedShield = true;
          // Don't mark as collected yet - wait for actual pickup
        }
      }
      
      // Get specific upgrade details
      if (upgrade.type === 'magazine') {
        upgradeLevel = 1;
        upgradeEffect = 4; // Explicitly set to 4 magazines to ensure consistency
        upgradeDuration = 0;
        
        // Don't add magazines directly anymore - wait for pickup
        console.log(`Tutorial: Setting up magazine delivery`);
      } else if (upgrade.type === 'armor') {
        upgradeLevel = 1;
        upgradeEffect = upgrade.levels[0].effect;
        upgradeDuration = 0;
      }
      
      // In tutorial mode, check funds and deduct them, but still proceed with the upgrade
      if (this.tutorialStep === 4) {
        // For magazine
        if (upgrade.type === 'magazine') {
          const magazinesToAdd = upgradeEffect;
          const upgradeCost = upgrade.levels[0].cost;
          console.log(`Tutorial: Calling drone to deliver ${magazinesToAdd} magazines. Cost: ${upgradeCost}`);
          
          // Get current money and deduct the cost
          const currentMoney = this.ui.getMoney();
          console.log(`Current money before purchase: ${currentMoney}`);
          
          // Deduct the cost
          this.ui.updateMoney(-upgradeCost);
          console.log(`Purchase cost ${upgradeCost} deducted. New balance: ${this.ui.getMoney()}`);
          
          // Call drone to deliver magazines
          const nextUpgrade = {
            level: upgradeLevel,
            effect: magazinesToAdd,
            duration: 0
          };
          
          this.droneWheel.requestDroneDelivery(upgrade, nextUpgrade);
          
          // Hide the wheel and update text
          this.droneWheel.hide();
          this.droneWheelStep = 1; // Move to shield step
          this.tutorialText.setText("Great! Drone is delivering ammo. Pick up the crate when it lands, then summon drone again for SHIELD.");
          return true;
        }
        
        // For shield
        if (upgrade.type === 'armor') {
          // Extra safety check - if we're in step 1 after collecting ammo, force shield flag to false
          if (this.droneWheelStep === 1 && this.collectedPowerups.magazine && !this.collectedPowerups.armor) {
            console.log("[DEBUG] Forcing shield flag to FALSE - we know it should be orderable at this point");
            this.droneOrderedShield = false;
          }
          
          // Prevent ordering multiple shields
          console.log("Shield selection state:", {
            step: this.tutorialStep,
            droneWheelStep: this.droneWheelStep,
            collectedArmor: this.collectedPowerups['armor'],
            droneOrderedShield: this.droneOrderedShield
          });
            
          if (this.collectedPowerups['armor'] || this.droneOrderedShield) {
            this.tutorialText.setText("You've already ordered a shield!");
            this.droneWheel.hide();
            return false;
          }
          
          const upgradeCost = upgrade.levels[0].cost;
          console.log(`Tutorial: Calling drone to deliver shield. Cost: ${upgradeCost}`);
          
          // Get current money and deduct the cost
          const currentMoney = this.ui.getMoney();
          console.log(`Current money before purchase: ${currentMoney}`);
          
          // Deduct the cost
          this.ui.updateMoney(-upgradeCost);
          console.log(`Purchase cost ${upgradeCost} deducted. New balance: ${this.ui.getMoney()}`);
          
          // Call drone to deliver shield
          const nextUpgrade = {
            level: upgradeLevel,
            effect: upgradeEffect,
            duration: 0
          };
          
          this.droneWheel.requestDroneDelivery(upgrade, nextUpgrade);
          
          // Hide the wheel
          this.droneWheel.hide();
          this.droneWheelStep = 2; // Complete drone wheel tutorial
          this.droneOrderedShield = true; // Ensure flag is set to true
          this.tutorialText.setText("Perfect! Drone is delivering a shield. Pick up the crate when it lands.");
          
          // Wait for shield pickup before advancing to next tutorial step
          // The advancement happens in handleUpgradeCollection now
          
          return true;
        }
      } else {
        // Use the original method for non-tutorial mode
        return this.originalConfirmSelection.call(this.droneWheel);
      }
    };
  }
  
  // Method to initialize weapons menu tutorial
  setupWeaponsMenuTutorial() {
    // Check if weapons menu was created
    if (!this.weaponsMenu) {
      console.log("Creating weapons menu for tutorial");
      this.weaponsMenu = new WeaponsMenu(this);
    }
    
    // Ensure the weapons menu is initialized
    if (!this.weaponsMenu.container) {
      this.weaponsMenu.create();
    }
  }
  
  // Method to clean up weapons menu tutorial
  cleanupWeaponsMenuTutorial() {
    // Clean up weapon menu indicators
    if (this.weaponKeyIndicator) {
      this.weaponKeyIndicator.destroy();
      this.weaponKeyIndicator = null;
    }
    
    // Restore original drone wheel confirmation method if it was overridden
    if (this.originalDroneWheelConfirmation && this.droneWheel) {
      this.droneWheel.confirmSelection = this.originalDroneWheelConfirmation;
      this.originalDroneWheelConfirmation = null;
    }
  }
  
  create() {
    // Create player and load sounds
    this.playerManager.createPlayer();
    this.playerManager.loadSounds();
    
    // Initialize health for tutorial (health system should be defined in PlayerManager.createPlayer)
    // Check if health is undefined and set it if needed
    if (this.playerManager.health === undefined) this.playerManager.health = 2;
    if (this.playerManager.maxHealth === undefined) this.playerManager.maxHealth = 10;
    
    // Make sure the health display is created and visible
    if (typeof this.playerManager.createHealthDisplay === 'function') {
      this.playerManager.createHealthDisplay();
    }
    
    // Update the health display after initialization
    if (typeof this.playerManager.updateHealthDisplay === 'function') {
      this.playerManager.updateHealthDisplay();
    }
    
    // Load tutorial sounds
    this.loadTutorialSounds();
    
    // Setup collision detection between bullets and targets
    this.physics.add.overlap(
      this.playerManager.getBullets(),
      this.targets,
      this.handleBulletTargetCollision,
      null,
      this
    );
    
    // Setup collision detection between bullets and enemies
    this.physics.add.overlap(
      this.playerManager.getBullets(),
      this.enemyManager.getEnemies(),
      this.handleBulletEnemyCollision,
      (bullet, enemy) => this.enemyManager.checkBulletEnemyCollision(bullet, enemy),
      this
    );
    
    // Create loot group for the drone to deliver upgrade boxes
    this.lootGroup = this.physics.add.group();
    
    // Setup collision for player collecting upgrades
    this.physics.add.overlap(
      this.playerManager.getPlayer(),
      this.lootGroup,
      this.handleUpgradeCollection,
      null,
      this
    );
    
    // Create tutorial instructions text
    this.createTutorialText();
    
    // Setup drone wheel tutorial
    this.setupDroneWheelTutorial();
    
    // Setup weapons menu tutorial
    this.setupWeaponsMenuTutorial();
    
    // Setup keyboard controls for drone wheel and other interactions
    this.setupKeyboardControls();
    
    // Setup event listener for floating text
    this.events.on('showFloatingText', this.showFloatingText, this);
    
    // Initialize ammoAudioPlaying flag
    this.ammoAudioPlaying = false;
    
    // Start the tutorial
    this.startTutorial();
  }
  
  // Handle player collecting upgrade boxes
  handleUpgradeCollection(player, box) {
    if (box.active && this.droneManager) {
      console.log(`Player collected ${box.upgradeName} (${box.upgradeType})`);
      
      // Check if player already collected this type of powerup
      if (this.collectedPowerups[box.upgradeType]) {
        console.log(`Player already collected ${box.upgradeType}, silently handling duplicate`);
        
        // Simply destroy the duplicate box without showing UI notification
        if (box && box.active) {
          // Add a small flash effect for feedback but no text
          const flash = this.add.circle(box.x, box.y, 50, 0xffffff, 0.4);
          flash.setDepth(5);
          
          // Quick fade-out animation
          this.tweens.add({
            targets: flash,
            scale: 1.2,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              flash.destroy();
              box.destroy();
            }
          });
        }
        
        return; // Skip applying duplicate upgrade
      }
      
      // Mark this powerup as collected
      this.collectedPowerups[box.upgradeType] = true;
      
      // Check for tutorial-specific upgrade collection handling
      if (this.tutorialStep === 4) {
        // Handle tutorial-specific powerup logic for magazine/ammo
        if (box.upgradeType === 'magazine') {
          console.log('Player collected ammo in tutorial step');
          
          // Apply the upgrade through the drone manager
          this.droneManager.applyUpgrade(player, box);
          
          // Show a message about the ammo
          const ammoText = this.add.text(
            player.x, 
            player.y - 50, 
            "+4 MAGAZINES", 
            {
              fontFamily: 'Arial',
              fontSize: '24px',
              color: '#ffff00',
              stroke: '#000000',
              strokeThickness: 4,
              align: 'center'
            }
          );
          ammoText.setOrigin(0.5);
          ammoText.setDepth(100);
          
          // Animate the text
          this.tweens.add({
            targets: ammoText,
            y: ammoText.y - 30,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
              ammoText.destroy();
            }
          });
          
          // If this was collected during the first drone wheel step, update text
          if (this.droneWheelStep === 1 && !this.droneOrderedShield) {
            this.tutorialText.setText("Great! You collected ammo. Now summon drone again to order a SHIELD.");
            
            // Play got_ammo sound and wait for it to finish before allowing shield ordering
            if (this.tutorialSounds.gotAmmo) {
              // Store a reference to prevent user from ordering shield immediately
              const gotAmmoSound = this.tutorialSounds.gotAmmo.play();
              
              // Set a temporary flag to prevent shield ordering during audio
              this.ammoAudioPlaying = true;
              
              // Allow shield ordering after the 12-second audio completes
              this.time.delayedCall(12000, () => {
                this.ammoAudioPlaying = false;
                // Force correct state and show prompt for shield
                console.log("[DEBUG] Audio finished - shield order state before:", this.droneOrderedShield);
                
                // FORCE the shield flag to be false since we know the player should be able to order it now
                this.droneOrderedShield = false;
                
                console.log("[DEBUG] Audio finished - shield order state after:", this.droneOrderedShield);
                this.tutorialText.setText("Now summon drone again to order a SHIELD.");
              });
            }
          } else if (this.droneOrderedShield) {
            // If shield is already ordered but not collected, don't prompt to order again
            this.tutorialText.setText("Go pick up the shield that was delivered!");
          }
          
          return;
        }
        
        // Handle tutorial-specific powerup logic for shield/armor
        if (box.upgradeType === 'armor') {
          console.log('Player collected shield in tutorial step');
          
          // Apply the upgrade through the drone manager
          this.droneManager.applyUpgrade(player, box);
          
          // Make sure health is initialized
          if (this.playerManager.health === undefined) this.playerManager.health = 2;
          if (this.playerManager.maxHealth === undefined) this.playerManager.maxHealth = 10;
          
          // Increase health by 2 points when shield is collected
          this.playerManager.health = Math.min(this.playerManager.health + 2, this.playerManager.maxHealth);
          
          // Update the health display
          if (typeof this.playerManager.updateHealthDisplay === 'function') {
            this.playerManager.updateHealthDisplay();
          }
          
          // Show a message about the shield
          const shieldText = this.add.text(
            player.x, 
            player.y - 50, 
            "+2 SHIELD", 
            {
              fontFamily: 'Arial',
              fontSize: '24px',
              color: '#00ffff',
              stroke: '#000000',
              strokeThickness: 4,
              align: 'center'
            }
          );
          shieldText.setOrigin(0.5);
          shieldText.setDepth(100);
          
          // Animate the text
          this.tweens.add({
            targets: shieldText,
            y: shieldText.y - 30,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
              shieldText.destroy();
            }
          });
          
          // After collecting shield, complete the drone wheel tutorial and advance to next step
          if (this.droneWheelStep === 2) {
            this.tutorialText.setText("Perfect! You've learned how to order and collect supplies. Your shield has been increased to protect you from enemies.");
            
            // Wait a moment then advance to enemies
            this.time.delayedCall(5000, () => {
              this.tutorialStep++;
              this.showNextStep();
            });
          }
          
          return;
        }
      } else {
        // For non-tutorial mode, apply upgrade normally
        this.droneManager.applyUpgrade(player, box);
        
        // For shield upgrades, also increase player health
        if (box.upgradeType === 'armor') {
          console.log('Player collected shield upgrade, increasing health');
          
          // Make sure health is initialized
          if (this.playerManager.health === undefined) this.playerManager.health = 2;
          if (this.playerManager.maxHealth === undefined) this.playerManager.maxHealth = 10;
          
          // Increase health by 2 points when shield is collected
          this.playerManager.health = Math.min(this.playerManager.health + 2, this.playerManager.maxHealth);
          
          // Update the health display
          if (typeof this.playerManager.updateHealthDisplay === 'function') {
            this.playerManager.updateHealthDisplay();
          }
          
          // Show a message about the shield
          const shieldText = this.add.text(
            player.x, 
            player.y - 50, 
            "+2 SHIELD", 
            {
              fontFamily: 'Arial',
              fontSize: '24px',
              color: '#00ffff',
              stroke: '#000000',
              strokeThickness: 4,
              align: 'center'
            }
          );
          shieldText.setOrigin(0.5);
          shieldText.setDepth(100);
          
          // Animate the text
          this.tweens.add({
            targets: shieldText,
            y: shieldText.y - 30,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
              shieldText.destroy();
            }
          });
        }
      }
    }
  }
  
  setupKeyboardControls() {
    // E key to open drone wheel while held down
    this.input.keyboard.on('keydown-E', () => {
      // Activate in both drone wheel tutorial step (4) and weapons menu tutorial step (5)
      if (this.tutorialStep === 4 || this.tutorialStep === 5) {
        // Check if player has received credits yet
        if (!this.canAccessDroneWheel) {
          // Flash a message that player needs to wait
          const player = this.playerManager.getPlayer();
          if (player) {
            this.events.emit('showFloatingText', {
              x: player.x,
              y: player.y - 50,
              text: "WAIT FOR CREDITS...",
              color: '#ffff00'
            });
          }
          return; // Prevent drone wheel from opening before credits
        }
        
        // Only show drone wheel if it's not already visible
        if (!this.droneWheel.isVisible) {
          // Check if we're in the post-ammo audio lockout period
          if (this.ammoAudioPlaying) {
            // Flash a message that player needs to wait for audio to finish
            const player = this.playerManager.getPlayer();
            if (player) {
              this.events.emit('showFloatingText', {
                x: player.x,
                y: player.y - 50,
                text: "PLEASE WAIT...",
                color: '#ffff00'
              });
            }
            return; // Prevent drone wheel from opening during audio
          }
          
          // Force correct shield ordering flag state based on step
          if (this.tutorialStep === 4 && this.droneWheelStep === 1 && !this.collectedPowerups.magazine) {
            console.log("[DEBUG] Opening wheel in step 1 - forcing shield flag to false");
            this.droneOrderedShield = false;
          }
          
          this.droneWheel.show();
        }
      }
    });
    
    // Release E key to close drone wheel
    this.input.keyboard.on('keyup-E', () => {
      // Only handle if drone wheel is visible
      if (this.droneWheel.isVisible) {
        // Make selection if an option is selected
        if (this.droneWheel.selectedIndex !== -1) {
          this.droneWheel.confirmSelection();
        } else {
          // Just close the wheel if no selection
          this.droneWheel.hide();
        }
      }
    });
    
    // Arrow keys for drone wheel navigation
    this.input.keyboard.on('keydown-RIGHT', () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.selectNext();
      }
    });
    
    this.input.keyboard.on('keydown-LEFT', () => {
      if (this.droneWheel.isVisible) {
        this.droneWheel.selectPrevious();
      }
    });
    
    // ESC key to skip tutorial
    this.input.keyboard.on('keydown-ESC', () => {
      // Don't show confirmation if it's already open
      if (!this.isConfirmDialogOpen) {
        this.showSkipConfirmation();
      } else {
        // If dialog is already open, close it
        this.closeConfirmDialog();
      }
    });
  }
  
  loadTutorialSounds() {
    // Load all tutorial sounds with 25% increased volume
    const voiceVolume = 1.0;  // Base volume
    const volumeIncrease = 0.25;  // 25% increase
    
    this.tutorialSounds.welcome = this.sound.add('tutorial_welcome', { volume: voiceVolume + volumeIncrease });
    this.tutorialSounds.move = this.sound.add('tutorial_move', { volume: voiceVolume + volumeIncrease });
    this.tutorialSounds.movePassed = this.sound.add('move_passed', { volume: voiceVolume + volumeIncrease });
    this.tutorialSounds.shoot = this.sound.add('tutorial_shoot', { volume: voiceVolume + volumeIncrease });
    this.tutorialSounds.shotsPassed = this.sound.add('shots_passed', { volume: voiceVolume + volumeIncrease });
    this.tutorialSounds.targetsPassed = this.sound.add('targets_passed', { volume: voiceVolume + volumeIncrease });
    this.tutorialSounds.tutorialComplete = this.sound.add('tutorial_complete', { volume: voiceVolume + volumeIncrease });
    this.tutorialSounds.gotAmmo = this.sound.add('got_ammo', { volume: voiceVolume + volumeIncrease });
    
    // Preload enemy expletive sounds for use when enemies spawn
    this.tutorialSounds.expletives = [
      'expletive_fock',
      'expletive_get',
      'expletive_degen',
      'expletive_grab',
      'expletive_kill_im',
      'expletive_kill_ya'
    ].map(name => this.sound.add(name, { volume: 0.8 }));
  }
  
  // Play a single expletive when enemies spawn in tutorial
  playTutorialExpletive() {
    // Disable random expletives from enemySounds to prevent duplicates
    if (this.enemyManager && this.enemyManager.sounds) {
      // Make backup of the original function
      this.originalPlayRandomExpletive = this.enemyManager.sounds.playRandomExpletive;
      
      // Replace with empty function to prevent random expletives during tutorial
      this.enemyManager.sounds.playRandomExpletive = () => {
        console.log("Random expletives disabled during tutorial");
      };
    }
    
    // Just choose a fixed expletive for consistency (could also be random)
    const expletiveSound = this.tutorialSounds.expletives[2]; // "degen" (or choose another index)
    
    if (expletiveSound) {
      console.log("Playing tutorial expletive sound");
      expletiveSound.play();
    } else {
      console.warn("Tutorial expletive sound not available");
    }
  }
  
  createTutorialText() {
    // Create container for tutorial text
    const textY = 80;
    
    // Create background for tutorial text
    this.textBg = this.add.rectangle(
      GAME_WIDTH / 2,
      textY,
      GAME_WIDTH * 0.9,
      100,
      0x000000,
      0.7
    );
    this.textBg.setStrokeStyle(2, 0x00ffff);
    
    // Create tutorial text
    this.tutorialText = this.add.text(
      GAME_WIDTH / 2,
      textY,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: GAME_WIDTH * 0.85 }
      }
    ).setOrigin(0.5);
    
    // Create skip tutorial button
    this.createSkipButton();
  }
  
  createSkipButton() {
    // Position in bottom-right corner
    const buttonX = GAME_WIDTH - 90;
    const buttonY = GAME_HEIGHT - 30;
    
    // Create button background with CRT effect
    const buttonBg = this.add.rectangle(
      buttonX,
      buttonY,
      160,
      40,
      0x000000,
      0.8
    );
    buttonBg.setStrokeStyle(3, 0xff0000);
    
    // Add scanlines to button
    const scanlines = this.add.graphics();
    scanlines.fillStyle(0x000000, 0.3);
    
    // Draw scanlines
    for (let y = buttonY - 20; y < buttonY + 20; y += 2) {
      scanlines.fillRect(buttonX - 80, y, 160, 1);
    }
    
    // Create glowing effect for the button
    const buttonGlow = this.add.rectangle(
      buttonX,
      buttonY,
      164,
      44,
      0xff0000,
      0.3
    );
    
    // Create button text with 80s style font
    const buttonText = this.add.text(
      buttonX,
      buttonY,
      'SKIP TUTORIAL',
      {
        fontFamily: 'Tektur',
        fontSize: '16px',
        color: '#00ffff',
        align: 'center',
        stroke: '#ff00ff',
        strokeThickness: 1,
      }
    ).setOrigin(0.5);
    
    // Add text shadow for neon effect
    const buttonTextShadow = this.add.text(
      buttonX + 2,
      buttonY + 2,
      'SKIP TUTORIAL',
      {
        fontFamily: 'Tektur',
        fontSize: '16px',
        color: '#000000',
        align: 'center',
      }
    ).setOrigin(0.5).setAlpha(0.5);
    
    // Make button interactive
    buttonBg.setInteractive({ useHandCursor: true });
    
    // Add hover effect with CRT flicker
    buttonBg.on('pointerover', () => {
      buttonBg.setStrokeStyle(4, 0xff5555);
      buttonText.setScale(1.1);
      
      // Add CRT flicker effect
      this.flickerTween = this.tweens.add({
        targets: [buttonText, buttonGlow],
        alpha: { from: 1, to: 0.7 },
        duration: 100,
        yoyo: true,
        repeat: -1
      });
    });
    
    buttonBg.on('pointerout', () => {
      buttonBg.setStrokeStyle(3, 0xff0000);
      buttonText.setScale(1);
      
      // Stop flicker effect
      if (this.flickerTween) {
        this.flickerTween.stop();
        buttonText.setAlpha(1);
        buttonGlow.setAlpha(0.3);
      }
    });
    
    // On click, show confirmation dialog
    buttonBg.on('pointerdown', () => {
      this.showSkipConfirmation();
    });
    
    // Group button components
    this.skipButton = this.add.container(0, 0, [buttonTextShadow, buttonGlow, buttonBg, scanlines, buttonText]);
    
    // Set to high depth to ensure it's always visible
    this.skipButton.setDepth(1000);
  }
  
  showSkipConfirmation() {
    // Don't show dialog if it's already open
    if (this.isConfirmDialogOpen) return;
    
    this.isConfirmDialogOpen = true;
    
    // Create semi-transparent background
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.8
    );
    
    // Create dialog box with CRT-style glow
    const dialogBox = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      400,
      200,
      0x000033,
      0.9
    );
    dialogBox.setStrokeStyle(4, 0xff0000);
    
    // Add outer glow
    const dialogGlow = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      410,
      210,
      0xff00ff,
      0.2
    );
    
    // Add scanlines to dialog
    const dialogScanlines = this.add.graphics();
    dialogScanlines.fillStyle(0x000000, 0.2);
    for (let y = GAME_HEIGHT/2 - 100; y < GAME_HEIGHT/2 + 100; y += 2) {
      dialogScanlines.fillRect(GAME_WIDTH/2 - 200, y, 400, 1);
    }
    
    // Create title text with 80s style
    const titleText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 70,
      'SKIP TUTORIAL?',
      {
        fontFamily: 'Tektur',
        fontSize: '26px',
        color: '#00ffff',
        align: 'center',
        stroke: '#ff00ff',
        strokeThickness: 2,
      }
    ).setOrigin(0.5);
    
    // Add text shadow for neon effect
    const titleShadow = this.add.text(
      GAME_WIDTH / 2 + 2,
      GAME_HEIGHT / 2 - 68,
      'SKIP TUTORIAL?',
      {
        fontFamily: 'Tektur',
        fontSize: '26px',
        color: '#000000',
        align: 'center',
      }
    ).setOrigin(0.5).setAlpha(0.5);
    
    // Add CRT flicker to title
    this.dialogFlicker = this.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.8 },
      duration: 120,
      yoyo: true,
      repeat: -1
    });
    
    // Create message text with 80s style
    const messageText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 20,
      'Are you sure you want to skip the tutorial\nand head straight to the grueling arena?',
      {
        fontFamily: 'Tektur',
        fontSize: '16px',
        color: '#00ff00',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 1,
      }
    ).setOrigin(0.5);
    
    // Create scanlines for the buttons
    const buttonScanlines = this.add.graphics();
    buttonScanlines.fillStyle(0x000000, 0.3);
    
    // Draw scanlines for yes button
    for (let y = GAME_HEIGHT/2 + 30; y < GAME_HEIGHT/2 + 70; y += 2) {
      buttonScanlines.fillRect(GAME_WIDTH/2 - 140, y, 120, 1);
    }
    
    // Draw scanlines for no button
    for (let y = GAME_HEIGHT/2 + 30; y < GAME_HEIGHT/2 + 70; y += 2) {
      buttonScanlines.fillRect(GAME_WIDTH/2 + 20, y, 120, 1);
    }
    
    // Create Yes button with CRT effect
    const yesButtonBg = this.add.rectangle(
      GAME_WIDTH / 2 - 80,
      GAME_HEIGHT / 2 + 50,
      120,
      40,
      0x660000,
      0.9
    );
    yesButtonBg.setStrokeStyle(3, 0xff0000);
    
    // Add glow to yes button
    const yesButtonGlow = this.add.rectangle(
      GAME_WIDTH / 2 - 80,
      GAME_HEIGHT / 2 + 50,
      124,
      44,
      0xff0000,
      0.3
    );
    
    const yesButtonText = this.add.text(
      GAME_WIDTH / 2 - 80,
      GAME_HEIGHT / 2 + 50,
      'YES, SKIP',
      {
        fontFamily: 'Tektur',
        fontSize: '16px',
        color: '#ff3333',
        align: 'center',
        stroke: '#ffffff',
        strokeThickness: 1,
      }
    ).setOrigin(0.5);
    
    // Create No button with CRT effect
    const noButtonBg = this.add.rectangle(
      GAME_WIDTH / 2 + 80,
      GAME_HEIGHT / 2 + 50,
      120,
      40,
      0x006600,
      0.9
    );
    noButtonBg.setStrokeStyle(3, 0x00ff00);
    
    // Add glow to no button
    const noButtonGlow = this.add.rectangle(
      GAME_WIDTH / 2 + 80,
      GAME_HEIGHT / 2 + 50,
      124,
      44,
      0x00ff00,
      0.3
    );
    
    const noButtonText = this.add.text(
      GAME_WIDTH / 2 + 80,
      GAME_HEIGHT / 2 + 50,
      'NO, STAY',
      {
        fontFamily: 'Tektur',
        fontSize: '16px',
        color: '#33ff33',
        align: 'center',
        stroke: '#ffffff', 
        strokeThickness: 1,
      }
    ).setOrigin(0.5);
    
    // Make buttons interactive
    yesButtonBg.setInteractive({ useHandCursor: true });
    noButtonBg.setInteractive({ useHandCursor: true });
    
    // Add hover effects with CRT flicker
    yesButtonBg.on('pointerover', () => {
      yesButtonBg.setFillStyle(0x990000, 0.9);
      yesButtonText.setScale(1.1);
      
      // Add CRT flicker effect
      this.yesFlickerTween = this.tweens.add({
        targets: [yesButtonText, yesButtonGlow],
        alpha: { from: 1, to: 0.7 },
        duration: 80,
        yoyo: true,
        repeat: -1
      });
    });
    
    yesButtonBg.on('pointerout', () => {
      yesButtonBg.setFillStyle(0x660000, 0.9);
      yesButtonText.setScale(1);
      
      // Stop flicker effect
      if (this.yesFlickerTween) {
        this.yesFlickerTween.stop();
        yesButtonText.setAlpha(1);
        yesButtonGlow.setAlpha(0.3);
      }
    });
    
    noButtonBg.on('pointerover', () => {
      noButtonBg.setFillStyle(0x009900, 0.9);
      noButtonText.setScale(1.1);
      
      // Add CRT flicker effect
      this.noFlickerTween = this.tweens.add({
        targets: [noButtonText, noButtonGlow],
        alpha: { from: 1, to: 0.7 },
        duration: 80,
        yoyo: true,
        repeat: -1
      });
    });
    
    noButtonBg.on('pointerout', () => {
      noButtonBg.setFillStyle(0x006600, 0.9);
      noButtonText.setScale(1);
      
      // Stop flicker effect
      if (this.noFlickerTween) {
        this.noFlickerTween.stop();
        noButtonText.setAlpha(1);
        noButtonGlow.setAlpha(0.3);
      }
    });
    
    // Button actions
    yesButtonBg.on('pointerdown', () => {
      this.skipTutorial();
    });
    
    noButtonBg.on('pointerdown', () => {
      // Close dialog
      this.closeConfirmDialog();
    });
    
    // Group all dialog components
    this.confirmDialog = this.add.container(0, 0, [
      overlay, dialogGlow, dialogBox, dialogScanlines, titleShadow, titleText, messageText, 
      yesButtonGlow, noButtonGlow, yesButtonBg, noButtonBg, buttonScanlines, yesButtonText, noButtonText
    ]);
    
    // Set to highest depth to ensure it's on top
    this.confirmDialog.setDepth(1001);
  }
  
  closeConfirmDialog() {
    if (this.confirmDialog) {
      // Stop any existing flickering animations
      if (this.dialogFlicker) {
        this.dialogFlicker.stop();
      }
      if (this.yesFlickerTween) {
        this.yesFlickerTween.stop();
      }
      if (this.noFlickerTween) {
        this.noFlickerTween.stop();
      }
      
      // Add glitch effect on close
      const glitchEffect = () => {
        this.confirmDialog.setAlpha(Math.random() * 0.5 + 0.5);
        this.confirmDialog.setX(Math.random() * 6 - 3);
      };
      
      // Run glitch effect a few times before closing
      const glitchInterval = setInterval(glitchEffect, 50);
      
      // Fade out and destroy with CRT turn-off effect
      this.tweens.add({
        targets: this.confirmDialog,
        scaleY: 0.1,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          clearInterval(glitchInterval);
          this.confirmDialog.destroy();
          this.confirmDialog = null;
          this.isConfirmDialogOpen = false;
        }
      });
    }
  }
  
  skipTutorial() {
    console.log('Skipping tutorial...');
    
    // Stop all tutorial sounds
    this.stopAllTutorialSounds();
    
    // Mark the tutorial as completed in localStorage
    localStorage.setItem('tutorialCompleted', 'true');
    
    // Restore any original money the player had
    if (this.tutorialCredits && this.preExistingMoney !== undefined) {
      console.log(`Tutorial: Restoring player's original money: ${this.preExistingMoney}`);
      // Calculate current money (may have used some) and reset to original value
      const currentMoney = this.ui.getMoney();
      this.ui.money = this.preExistingMoney; // Direct assignment to avoid triggering events
      if (this.ui.moneyCounter) {
        this.ui.moneyCounter.updateMoney(this.preExistingMoney);
      }
      console.log(`Tutorial: Money reset from ${currentMoney} to ${this.preExistingMoney}`);
    }
    
    // Transition to MenuScene with startHypeScreen flag
    this.scene.start('MenuScene', { startHypeScreen: true });
  }
  
  stopAllTutorialSounds() {
    // Stop all tutorial sound effects that might be playing but leave music
    if (this.tutorialSounds) {
      Object.values(this.tutorialSounds).forEach(sound => {
        // Check if the sound is an array (like expletives)
        if (Array.isArray(sound)) {
          sound.forEach(s => {
            if (s && s.isPlaying) {
              console.log(`Stopping tutorial sound array item`);
              s.stop();
            }
          });
        } else if (sound && sound.isPlaying) {
          console.log(`Stopping tutorial sound: ${sound.key}`);
          sound.stop();
        }
      });
    }
    
    // DO NOT stop tutorial music - let it continue
    // This is intentional to maintain musical continuity
    
    // Instead of stopping all sounds which would include music,
    // we've already stopped the individual tutorial sound effects above
  }
  
  startTutorial() {
    // Reset tutorial state
    this.tutorialStep = 0;
    this.showNextStep();
  }
  
  showNextStep() {
    // Clear any previous targets or enemies
    this.clearTargets();
    
    // Update tutorial text based on current step
    switch (this.tutorialStep) {
      case 0: // Welcome
        this.tutorialText.setText("Welcome to the tutorial! You'll learn how to move, shoot, and survive against enemies.");
        
        // Add a 1-second buffer before playing audio
        this.time.delayedCall(1000, () => {
          // Play welcome tutorial sound
          if (this.tutorialSounds.welcome) {
            this.tutorialSounds.welcome.play();
          }
        });
        
        // Wait for audio to finish (12.5 seconds) plus 1-second buffer before continuing
        this.time.delayedCall(13500, () => {
          this.tutorialStep++;
          this.showNextStep();
        });
        break;
        
      case 1: // Movement tutorial
        this.tutorialText.setText("MOVEMENT: Use WASD keys, left joystick, or left touch control to move in 5 DIFFERENT DIRECTIONS. Try moving now!");
        
        // Add a 1-second buffer before playing audio
        this.time.delayedCall(1000, () => {
          // Play movement tutorial sound
          if (this.tutorialSounds.move) {
            this.tutorialSounds.move.play();
          }
        });
        
        this.watchForMovement();
        break;
        
      case 2: // Shooting tutorial
        this.tutorialText.setText("SHOOTING: Use arrow keys, right joystick, or right touch control to shoot in 5 DIFFERENT DIRECTIONS!");
        
        // Add a 1-second buffer before playing audio
        this.time.delayedCall(1000, () => {
          // Play shooting tutorial sound
          if (this.tutorialSounds.shoot) {
            this.tutorialSounds.shoot.play();
          }
        });
        
        this.watchForShooting();
        break;
        
      case 3: // Target practice
        this.tutorialText.setText("TARGET PRACTICE: Shoot all 5 targets to continue.");
        this.createTargets();
        break;
        
      case 4: // Drone wheel tutorial
        // Reset drone wheel tutorial steps and flags
        this.droneWheelStep = 0;
        this.droneOrderedAmmo = false;
        this.droneOrderedShield = false;
        // Also make sure the armor isn't marked as collected yet
        this.collectedPowerups.armor = false;
        
        // Store the player's current money before the tutorial
        this.preExistingMoney = this.ui.getMoney();
        console.log(`Tutorial: Saving player's current money: ${this.preExistingMoney}`);
        
        // Credit player with 500 tutorial credits - used only for this tutorial
        this.ui.updateMoney(500);
        this.tutorialCredits = true; // Mark that we're using tutorial credits
        
        // Enable drone wheel access once credits are received
        this.canAccessDroneWheel = true;
        
        // Show credit added message
        const player = this.playerManager.getPlayer();
        if (player) {
          const creditText = this.add.text(
            player.x, 
            player.y - 50, 
            "+500 CREDITS", 
            {
              fontFamily: 'Arial',
              fontSize: '24px',
              color: '#ffff00',
              stroke: '#000000',
              strokeThickness: 4,
              align: 'center'
            }
          );
          creditText.setOrigin(0.5);
          creditText.setDepth(100);
          
          // Animate the text
          this.tweens.add({
            targets: creditText,
            y: creditText.y - 30,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
              creditText.destroy();
            }
          });
        }
        
        // Update UI text with instructions after a short delay
        this.time.delayedCall(500, () => {
          this.tutorialText.setText("SUPPLIES: You have 500 credits. Press E to open the Drone Wheel and order AMMO. In combat, this is how you get supplies.");
        });
        
        // Add visual indicator for the E key
        const keyIndicator = this.add.text(
          player.x, 
          player.y - 80, 
          "Summon Drone", 
          {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#00ffff',
            stroke: '#000000',
            strokeThickness: 3,
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
          }
        );
        keyIndicator.setOrigin(0.5);
        keyIndicator.setDepth(100);
        
        // Add a pulsing animation to make it more noticeable
        this.tweens.add({
          targets: keyIndicator,
          scale: { from: 1, to: 1.2 },
          alpha: { from: 1, to: 0.7 },
          duration: 800,
          yoyo: true,
          repeat: -1
        });
        
        // Store reference to remove it later
        this.keyIndicator = keyIndicator;
        
        // Check for drone wheel completion
        this.droneWheelCheckTimer = this.time.addEvent({
          delay: 1000,
          callback: () => {
            // Remove the indicator once both items are ordered
            if (this.droneOrderedAmmo && this.droneOrderedShield) {
              if (this.keyIndicator) {
                this.keyIndicator.destroy();
                this.keyIndicator = null;
              }
              
              // Stop checking
              if (this.droneWheelCheckTimer) {
                this.droneWheelCheckTimer.remove();
                this.droneWheelCheckTimer = null;
              }
            }
          },
          callbackScope: this,
          loop: true
        });
        break;
        
      case 5: // Weapons Menu tutorial (NEW STEP)
        // Clean up any drone wheel timers or indicators
        if (this.droneWheelCheckTimer) {
          this.droneWheelCheckTimer.remove();
          this.droneWheelCheckTimer = null;
        }
        
        if (this.keyIndicator) {
          this.keyIndicator.destroy();
          this.keyIndicator = null;
        }
        
        // Reset weapons menu tutorial flags
        this.weaponsMenuCompleted = false;
        this.weaponSelected = false;
        
        // Make sure we have enough credits for weapon selection
        if (this.ui.getMoney() < 100) {
          // If player doesn't have enough credits, give them some
          this.ui.updateMoney(100);
        }
        
        this.tutorialText.setText("WEAPON SELECT: Press E to open the Drone Wheel and select RAPID FIRE (the gun icon). This will let you choose between the ASSAULT RIFLE and SHOTGUN.");
        
        // Get player reference
        const playerObj = this.playerManager.getPlayer();
        
        // Add visual indicator for the E key
        const weaponKeyIndicator = this.add.text(
          playerObj.x, 
          playerObj.y - 80, 
          "Open Drone Wheel (E)", 
          {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 3,
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
          }
        );
        weaponKeyIndicator.setOrigin(0.5);
        weaponKeyIndicator.setDepth(100);
        
        // Add a pulsing animation to make it more noticeable
        this.tweens.add({
          targets: weaponKeyIndicator,
          scale: { from: 1, to: 1.2 },
          alpha: { from: 1, to: 0.7 },
          duration: 800,
          yoyo: true,
          repeat: -1
        });
        
        // Store reference to remove it later
        this.weaponKeyIndicator = weaponKeyIndicator;
        
        // Override drone wheel confirmation to allow only the fire rate option
        this.originalDroneWheelConfirmation = this.droneWheel.confirmSelection;
        
        // Enable drone wheel access
        this.canAccessDroneWheel = true;
        
        // Override the drone wheel confirmSelection for this step
        this.droneWheel.confirmSelection = () => {
          if (!this.droneWheel.isVisible) return false;
          
          // If no option is selected, do nothing
          if (this.droneWheel.selectedIndex === -1) return false;
          
          const upgrade = this.droneWheel.availableUpgrades[this.droneWheel.selectedIndex];
          
          // Only allow selecting the fire rate (weapon) option
          if (upgrade.type !== 'fireRate') {
            this.tutorialText.setText("For this tutorial, please select RAPID FIRE (the gun icon)");
            this.droneWheel.flashDescriptionText();
            return false;
          }
          
          // Hide the wheel first
          this.droneWheel.hide();
          
          // For tutorial, do NOT deduct money yet (will be done in the callback)
          const upgradeCost = upgrade.levels[0].cost;
          console.log(`Tutorial: Will deduct ${upgradeCost} after weapon selection`);
          
          // Make sure player has enough money
          if (this.ui.getMoney() < upgradeCost) {
            this.ui.updateMoney(upgradeCost + 100); // Give them enough money plus extra
          }
          
          // Create local references to weapons menu, its elements and methods to ensure they're properly available
          if (!this.weaponsMenu || !this.weaponsMenu.container) {
            console.log("Recreating weapons menu for tutorial");
            this.weaponsMenu = new WeaponsMenu(this);
            this.weaponsMenu.create();
          }
          
          // Force rebuild the menu
          try {
            if (this.weaponsMenu.container) {
              this.weaponsMenu.container.destroy();
              this.weaponsMenu.container = null;
            }
            this.weaponsMenu.create();
          } catch (e) {
            console.error("Error rebuilding weapons menu:", e);
          }
          
          // Debug current state
          console.log("About to show weapons menu, current state:", {
            weaponsMenuExists: !!this.weaponsMenu,
            containerExists: this.weaponsMenu ? !!this.weaponsMenu.container : false,
            isVisible: this.weaponsMenu ? this.weaponsMenu.isVisible : false
          });
          
          // Show the weapons menu with a delay to ensure everything is set up
          this.time.delayedCall(100, () => {
            this.weaponsMenu.show(
              // Weapon selected callback
              (weaponType) => {
                console.log(`Tutorial: Selected weapon: ${weaponType}`);
                this.weaponSelected = true;
                
                // Deduct the cost now (like the main game does)
                this.ui.updateMoney(-upgradeCost);
                console.log(`Purchase cost ${upgradeCost} deducted. New balance: ${this.ui.getMoney()}`);
                
                // Remove indicator
                if (this.weaponKeyIndicator) {
                  this.weaponKeyIndicator.destroy();
                  this.weaponKeyIndicator = null;
                }
                
                const weaponName = weaponType === 'shotgun' ? 'SHOTGUN' : 'ASSAULT RIFLE';
                
                // Update tutorial text
                this.tutorialText.setText(`Great choice! You selected the ${weaponName}. Drone is delivering your weapon upgrade.`);
                
                // Deliver the selected weapon via drone
                if (weaponType === 'shotgun') {
                  // For shotgun, deliver shotgun upgrade
                  this.droneManager.deliverSpecificUpgrade(
                    'shotgun',
                    1,
                    1,
                    30000  // 30 second duration for weapon upgrades
                  );
                } else {
                  // For rifle, deliver rapid fire upgrade
                  this.droneManager.deliverSpecificUpgrade(
                    'fireRate',
                    1,
                    0.7,  // This is the fire rate multiplier (smaller = faster firing)
                    30000  // 30 second duration for weapon upgrades
                  );
                }
                
                // After a longer delay to allow for drone delivery, advance to enemy practice
                this.time.delayedCall(6000, () => {
                  this.weaponsMenuCompleted = true;
                  this.tutorialStep++;
                  this.showNextStep();
                });
              },
              // Cancel callback
              () => {
                console.log("Tutorial: Weapon selection cancelled, prompting again");
                this.tutorialText.setText("Please select a weapon! Press E to open the Drone Wheel again and select RAPID FIRE.");
              }
            );
          });
          
          return true;
        };
        
        break;
        
      case 6: // Enemy practice (now case 6)
        // Clean up weapons menu tutorial elements
        this.cleanupWeaponsMenuTutorial();
        
        this.tutorialText.setText("ENEMY PRACTICE: Time to put your skills to use! Defeat all 3 enemies to continue.");
        
        // Add a 1 second buffer before spawning enemies
        this.time.delayedCall(1000, () => {
          this.spawnEnemies();
        });
        break;
        
      case 7: // Tutorial complete (previously case 6)
        // Clear any remaining timers
        if (this.enemyCheckTimer) {
          this.enemyCheckTimer.remove();
          this.enemyCheckTimer = null;
        }
        
        // If we were using tutorial credits, restore player's original money
        if (this.tutorialCredits && this.preExistingMoney !== undefined) {
          console.log(`Tutorial: Restoring player's original money: ${this.preExistingMoney}`);
          // Calculate current money (may have used some) and reset to original value
          const currentMoney = this.ui.getMoney();
          this.ui.money = this.preExistingMoney; // Direct assignment to avoid triggering events
          if (this.ui.moneyCounter) {
            this.ui.moneyCounter.updateMoney(this.preExistingMoney);
          }
          console.log(`Tutorial: Money reset from ${currentMoney} to ${this.preExistingMoney}`);
        }
        
        // Double check to restore original random expletive function if it wasn't restored earlier
        if (this.originalPlayRandomExpletive && this.enemyManager && this.enemyManager.sounds) {
          this.enemyManager.sounds.playRandomExpletive = this.originalPlayRandomExpletive;
          console.log("Final restoration of original random expletive function");
          this.originalPlayRandomExpletive = null;
        }
        
        // Set completion message
        this.tutorialText.setText("TUTORIAL COMPLETE! You're ready for the real challenge. Starting game in 3 seconds...");
        
        // Play the tutorial complete sound
        if (this.tutorialSounds.tutorialComplete) {
          this.tutorialSounds.tutorialComplete.play();
        }
        
        // Transition to main game (3 seconds for audio + 1 second buffer = 4 seconds total)
        this.time.delayedCall(4000, () => {
          // Clean up any tutorial resources
          if (this.weaponsMenu) {
            this.weaponsMenu.cleanup();
          }
          
          // Mark the tutorial as completed in localStorage
          localStorage.setItem('tutorialCompleted', 'true');
          
          // Ensure dialog assets are in the texture cache before transitioning
          if (!this.textures.exists('girl') || !this.textures.exists('degen') || !this.textures.exists('networkExec')) {
            console.error("Missing dialog assets before transition! Trying to load them again...");
            
            // Final attempt to ensure dialog assets are loaded before transition
            this.load.image('degen', '/assets//story/degen/intro/degen.png');
            this.load.image('girl', '/assets//story/degen/intro/girl.png');
            this.load.image('networkExec', '/assets//story/degen/intro/networkExec.png');
            
            // Start loading and wait briefly
            this.load.start();
            this.time.delayedCall(300, () => {
              console.log("Transition after final asset load attempt. Asset status:", {
                degen: this.textures.exists('degen'),
                girl: this.textures.exists('girl'),
                networkExec: this.textures.exists('networkExec')
              });
              
              // Go to the "GET HYPED" scene from MenuScene
              this.scene.start('MenuScene', { startHypeScreen: true });
            });
          } else {
            console.log("All dialog assets confirmed loaded before transition");
            // Go to the "GET HYPED" scene from MenuScene
            this.scene.start('MenuScene', { startHypeScreen: true });
          }
        });
        break;
    }
  }
  
  watchForMovement() {
    // Store initial player position
    const initialX = this.playerManager.getPlayer().x;
    const initialY = this.playerManager.getPlayer().y;
    let movementCheckActive = false; // Start with movement check inactive
    let lastDirectionMoved = null;
    let previousPositionX = initialX;
    let previousPositionY = initialY;
    
    // Reset directions moved in
    this.directionsMovedIn.clear();
    
    // Create visual indicators for movement directions
    this.createMovementIndicators();
    
    // Original tutorial text with 5 directions requirement
    this.tutorialText.setText("MOVEMENT: Use WASD keys, left joystick, or left touch control to move in 5 DIFFERENT DIRECTIONS. Try moving now!");
    
    // Wait for move tutorial audio to finish before enabling movement tracking
    const moveAudioDuration = 8000; // 8 seconds for the tutorial_move audio
    this.time.delayedCall(moveAudioDuration, () => {
      movementCheckActive = true; // Only start checking movement after audio finished
      this.tutorialText.setText("MOVEMENT: Use WASD keys, left joystick, or left touch control to move in 5 DIFFERENT DIRECTIONS. Try moving now! (0/5)");
    });
    
    // Function to check if player has moved
    const checkMovement = () => {
      if (!movementCheckActive) return;
      
      const player = this.playerManager.getPlayer();
      
      // Calculate movement vector from previous position
      const dx = player.x - previousPositionX;
      const dy = player.y - previousPositionY;
      
      // Only check for significant movement
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        // Determine direction based on movement angle
        let angle = Math.atan2(dy, dx);
        let degrees = (angle * 180 / Math.PI + 360) % 360;
        let direction;
        
        // Convert angle to 8 cardinal directions
        if (degrees >= 337.5 || degrees < 22.5) direction = "right";
        else if (degrees >= 22.5 && degrees < 67.5) direction = "down-right";
        else if (degrees >= 67.5 && degrees < 112.5) direction = "down";
        else if (degrees >= 112.5 && degrees < 157.5) direction = "down-left";
        else if (degrees >= 157.5 && degrees < 202.5) direction = "left";
        else if (degrees >= 202.5 && degrees < 247.5) direction = "up-left";
        else if (degrees >= 247.5 && degrees < 292.5) direction = "up";
        else if (degrees >= 292.5 && degrees < 337.5) direction = "up-right";
        
        // If direction is different from last one, record it
        if (direction !== lastDirectionMoved) {
          lastDirectionMoved = direction;
          this.directionsMovedIn.add(direction);
          
          // Update display to show progress
          this.tutorialText.setText(`MOVEMENT: Move in 5 DIFFERENT DIRECTIONS. Progress: ${this.directionsMovedIn.size}/5 directions`);
          
          // Check if player has moved in 5 directions
          if (this.directionsMovedIn.size >= 5) {
            // Stop checking movement
            movementCheckActive = false;
            this.events.off('update', checkMovement);
            
            // Show success message
            this.tutorialText.setText("Great job moving in all directions! Now let's learn to shoot.");
            
            // Clear movement indicators
            this.clearMovementIndicators();
            
            // Play the move passed sound
            if (this.tutorialSounds.movePassed) {
              this.tutorialSounds.movePassed.play();
            }
            
            // Only wait for 3 seconds total (including the move_passed sound)
            const delayTime = 3000;
            
            // Move to next step after appropriate delay
            this.time.delayedCall(delayTime, () => {
              this.tutorialStep++;
              this.showNextStep();
            });
          }
        }
        
        // Update previous position
        previousPositionX = player.x;
        previousPositionY = player.y;
      }
    };
    
    // Add movement check to update loop
    this.events.on('update', checkMovement);
  }
  
  createMovementIndicators() {
    // Create container for movement indicators
    this.movementIndicators = this.add.container(0, 0);
    
    // Create directional indicators around player
    const player = this.playerManager.getPlayer();
    const distance = 100;
    const directions = [
      { x: 0, y: -1, label: "↑", angle: 270 },  // Up
      { x: 1, y: -1, label: "↗", angle: 315 }, // Up-Right
      { x: 1, y: 0, label: "→", angle: 0 },     // Right
      { x: 1, y: 1, label: "↘", angle: 45 },  // Down-Right
      { x: 0, y: 1, label: "↓", angle: 90 },    // Down
      { x: -1, y: 1, label: "↙", angle: 135 }, // Down-Left
      { x: -1, y: 0, label: "←", angle: 180 },  // Left
      { x: -1, y: -1, label: "↖", angle: 225 } // Up-Left
    ];
    
    // Add arrows for each direction
    directions.forEach(dir => {
      const arrowX = player.x + dir.x * distance;
      const arrowY = player.y + dir.y * distance;
      
      // Create arrow
      const arrow = this.add.image(arrowX, arrowY, 'bullet');
      arrow.setScale(2);
      arrow.setAngle(dir.angle);
      arrow.setTint(0x00ffff);
      
      // Create label
      const label = this.add.text(
        arrowX + dir.x * 15, 
        arrowY + dir.y * 15, 
        dir.label, 
        {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#000000',
          padding: { x: 5, y: 2 }
        }
      ).setOrigin(0.5);
      
      // Add to container
      this.movementIndicators.add(arrow);
      this.movementIndicators.add(label);
    });
  }
  
  clearMovementIndicators() {
    if (this.movementIndicators) {
      this.tweens.add({
        targets: this.movementIndicators,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.movementIndicators.destroy();
        }
      });
    }
  }
  
  watchForShooting() {
    // Store the original shoot method
    const originalShoot = this.playerManager.shoot;
    let shootingCheckActive = false; // Start with shooting check inactive
    
    // Reset directions shot
    this.directionsShot.clear();
    
    // Create visual indicators for shooting directions
    this.createShootingIndicators();
    
    // Updated tutorial text with 5 directions requirement
    this.tutorialText.setText("SHOOTING: Use arrow keys, right joystick, or right touch control to shoot in 5 DIFFERENT DIRECTIONS!");
    
    // Wait for shoot tutorial audio to finish before enabling shooting tracking
    const shootAudioDuration = 7000; // 7 seconds for the tutorial_shoot audio
    this.time.delayedCall(shootAudioDuration, () => {
      shootingCheckActive = true; // Only start checking shots after audio finished
      this.tutorialText.setText("SHOOTING: Use arrow keys, right joystick, or right touch control to shoot in 5 DIFFERENT DIRECTIONS! (0/5)");
    });
    
    // Override shoot method to detect when player shoots
    this.playerManager.shoot = function() {
      // Call original method first
      originalShoot.apply(this, arguments);
      
      if (shootingCheckActive) {
        // Get shooting direction
        const shootX = this.shootingDirection.x;
        const shootY = this.shootingDirection.y;
        
        if (shootX !== 0 || shootY !== 0) {
          // Determine direction based on shooting angle
          let angle = Math.atan2(shootY, shootX);
          let degrees = (angle * 180 / Math.PI + 360) % 360;
          let direction;
          
          // Convert angle to 8 cardinal directions
          if (degrees >= 337.5 || degrees < 22.5) direction = "right";
          else if (degrees >= 22.5 && degrees < 67.5) direction = "down-right";
          else if (degrees >= 67.5 && degrees < 112.5) direction = "down";
          else if (degrees >= 112.5 && degrees < 157.5) direction = "down-left";
          else if (degrees >= 157.5 && degrees < 202.5) direction = "left";
          else if (degrees >= 202.5 && degrees < 247.5) direction = "up-left";
          else if (degrees >= 247.5 && degrees < 292.5) direction = "up";
          else if (degrees >= 292.5 && degrees < 337.5) direction = "up-right";
          
          // Add this direction to the set of directions shot
          this.scene.directionsShot.add(direction);
          
          // Update display to show progress
          this.scene.tutorialText.setText(`SHOOTING: Shoot in 5 DIFFERENT DIRECTIONS. Progress: ${this.scene.directionsShot.size}/5 directions`);
          
          // Check if player has shot in 5 directions
          if (this.scene.directionsShot.size >= 5) {
            shootingCheckActive = false;
            
            // Show success message and continue to next step
            this.scene.tutorialText.setText("Great job shooting in all directions! Now let's practice hitting targets.");
            
            // Clear shooting indicators
            this.scene.clearShootingIndicators();
            
            // Play the shots passed sound
            if (this.scene.tutorialSounds.shotsPassed) {
              this.scene.tutorialSounds.shotsPassed.play();
            }
            
            // Restore original shoot method
            this.shoot = originalShoot;
            
            // Account for shots_passed.mp3 duration (6 seconds)
            const shotPassedDuration = 6000; // 6 seconds
            
            // Move to next step after appropriate delay
            this.scene.time.delayedCall(shotPassedDuration, () => {
              this.scene.tutorialStep++;
              this.scene.showNextStep();
            });
          }
        }
      }
    };
  }
  
  createShootingIndicators() {
    // Create container for shooting indicators
    this.shootingIndicators = this.add.container(0, 0);
    
    // Create directional indicators around player
    const player = this.playerManager.getPlayer();
    const distance = 100;
    const directions = [
      { x: 0, y: -1, label: "↑", angle: 270 },  // Up
      { x: 1, y: -1, label: "↗", angle: 315 }, // Up-Right
      { x: 1, y: 0, label: "→", angle: 0 },     // Right
      { x: 1, y: 1, label: "↘", angle: 45 },  // Down-Right
      { x: 0, y: 1, label: "↓", angle: 90 },    // Down
      { x: -1, y: 1, label: "↙", angle: 135 }, // Down-Left
      { x: -1, y: 0, label: "←", angle: 180 },  // Left
      { x: -1, y: -1, label: "↖", angle: 225 } // Up-Left
    ];
    
    // Add arrows for each direction
    directions.forEach(dir => {
      const arrowX = player.x + dir.x * distance;
      const arrowY = player.y + dir.y * distance;
      
      // Create arrow
      const arrow = this.add.image(arrowX, arrowY, 'bullet');
      arrow.setScale(3);
      arrow.setAngle(dir.angle);
      arrow.setTint(0xff0000);
      
      // Create label
      const label = this.add.text(
        arrowX + dir.x * 15, 
        arrowY + dir.y * 15, 
        dir.label, 
        {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#000000',
          padding: { x: 5, y: 2 }
        }
      ).setOrigin(0.5);
      
      // Add to container
      this.shootingIndicators.add(arrow);
      this.shootingIndicators.add(label);
    });
  }
  
  clearShootingIndicators() {
    if (this.shootingIndicators) {
      this.tweens.add({
        targets: this.shootingIndicators,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.shootingIndicators.destroy();
        }
      });
    }
  }
  
  createTargets() {
    // Reset target hit counter
    this.targetHits = 0;
    
    // Create 5 target objects around the player
    const player = this.playerManager.getPlayer();
    const targetsCount = 5;
    
    for (let i = 0; i < targetsCount; i++) {
      // Create targets in an arc in front of the player
      const angle = (i / (targetsCount - 1)) * Math.PI; // 180-degree arc
      const distance = 200;
      
      const x = player.x + Math.cos(angle) * distance;
      const y = player.y - Math.sin(angle) * distance; // Negative for y axis
      
      // Create target with bullseye emoji
      const target = this.add.text(x, y, '🎯', { 
        fontSize: '50px', 
        fontFamily: 'Arial' 
      });
      target.setOrigin(0.5);
      target.setDepth(5);
      
      // Enable physics for collision detection
      this.targets.add(target);
      target.setData('hit', false);
      
      // Add glow effect
      const glow = this.add.circle(x, y, 35, 0x00ffff, 0.2);
      glow.setDepth(1);
      target.setData('glow', glow);
      
      // Add pulsing animation to target
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.2, to: 0.6 },
        duration: 1000,
        yoyo: true,
        repeat: -1
      });
    }
  }
  
  handleBulletTargetCollision(bullet, target) {
    // Destroy the bullet
    bullet.destroy();
    
    // If target already hit, ignore
    if (target.getData('hit')) return;
    
    // Mark target as hit
    target.setData('hit', true);
    
    // Get glow object
    const glow = target.getData('glow');
    
    // Create explosion effect
    this.createExplosion(target.x, target.y);
    
    // Fade out target
    this.tweens.add({
      targets: [target, glow],
      scale: { from: 1, to: 1.5 },
      alpha: { from: 1, to: 0 },
      duration: 300,
      onComplete: () => {
        if (glow) glow.destroy();
        target.destroy();
      }
    });
    
    // Play hit sound
    if (this.sound.get('shot')) {
      this.sound.play('shot', { volume: 0.5 });
    }
    
    // Increment hit counter
    this.targetHits++;
    
    // If all targets hit, advance to next step
    if (this.targetHits >= 5) {
      this.time.delayedCall(1000, () => {
        this.tutorialText.setText("Excellent shooting! Hit all targets!");
        
        // Play the targets passed sound
        if (this.tutorialSounds.targetsPassed) {
          this.tutorialSounds.targetsPassed.play();
        }
        
        // Account for targets_passed.mp3 duration (22 seconds)
        // Advance to next step after audio finishes (credits will be given in next step)
        const targetsPassedDuration = 22000; // 22 seconds
        
        this.time.delayedCall(targetsPassedDuration, () => {
          // Skip showing the transition text and go straight to the next step
          this.tutorialStep++;
          this.showNextStep();
        });
      });
    }
  }
  
  spawnEnemies() {
    // Mark that enemies have been spawned
    this.enemiesSpawned = true;
    this.enemiesDefeated = 0;
    
    // Reset any existing timer
    if (this.enemyCheckTimer) {
      this.enemyCheckTimer.remove();
      this.enemyCheckTimer = null;
    }
    
    const enemyCount = 3;
    
    // Update text to emphasize requirement
    this.tutorialText.setText(`ENEMY PRACTICE: Enemies defeated: ${this.enemiesDefeated}/${enemyCount}. You must defeat ALL enemies to continue!`);
    
    // Play a single expletive sound when enemies appear
    this.playTutorialExpletive();
    
    // Get camera view to ensure enemies spawn at edges
    const camera = this.cameras.main;
    const cameraX = camera.scrollX;
    const cameraY = camera.scrollY;
    const cameraWidth = camera.width;
    const cameraHeight = camera.height;
    
    // Spawn offset to ensure enemies start off screen
    const spawnOffset = 100;
    
    // Spawn enemies at different edges of the screen
    for (let i = 0; i < enemyCount; i++) {
      let x, y, initialAnim;
      const spawnEdge = i % 4; // Use different edges (0=top, 1=bottom, 2=left, 3=right)
      
      if (spawnEdge === 0) { // Top edge
        x = Phaser.Math.Between(cameraX + 100, cameraX + cameraWidth - 100);
        y = cameraY - spawnOffset;
        initialAnim = 'enemy_run_down';
      } else if (spawnEdge === 1) { // Bottom edge
        x = Phaser.Math.Between(cameraX + 100, cameraX + cameraWidth - 100);
        y = cameraY + cameraHeight + spawnOffset;
        initialAnim = 'enemy_run_up';
      } else if (spawnEdge === 2) { // Left edge
        x = cameraX - spawnOffset;
        y = Phaser.Math.Between(cameraY + 100, cameraY + cameraHeight - 100);
        initialAnim = 'enemy_run_right';
      } else { // Right edge
        x = cameraX + cameraWidth + spawnOffset;
        y = Phaser.Math.Between(cameraY + 100, cameraY + cameraHeight - 100);
        initialAnim = 'enemy_run_right';
        // Flip for right edge
        this.enemyManager.spawner.createEnemy(x, y, initialAnim, true);
        continue; // Skip the regular createEnemy call below
      }
      
      // Create the enemy
      this.enemyManager.spawner.createEnemy(x, y, initialAnim);
    }
    
    // Log the initial enemy count
    console.log(`Initial enemy count: ${this.enemyManager.getEnemies().getChildren().length}`);
    
    // Schedule a first check after enemies are spawned
    this.time.delayedCall(500, () => {
      this.checkEnemiesDefeated();
    });
  }
  
  handleBulletEnemyCollision(bullet, enemy) {
    // Use the enemy manager to handle the collision
    this.enemyManager.hitEnemy(bullet, enemy, () => {
      // This callback is fired when the enemy is destroyed
      this.enemiesDefeated++;
      
      // Force a check after a short delay to ensure animations complete and physics updates
      this.time.delayedCall(500, () => {
        this.checkEnemiesDefeated();
      });
    });
  }
  
  // New method to check if all enemies are defeated
  checkEnemiesDefeated() {
    // Skip if we've already moved past the enemy step
    if (this.tutorialStep > 6) {
      return;
    }
    
    // Check the actual number of remaining enemies
    const enemies = this.enemyManager.getEnemies().getChildren();
    const remainingEnemies = enemies.length;
    const totalDefeated = 3 - remainingEnemies;
    
    console.log(`Enemy check: ${totalDefeated}/3 defeated, ${remainingEnemies} remaining`);
    
    // Log details about remaining enemies to help debug
    if (remainingEnemies > 0) {
      enemies.forEach((enemy, index) => {
        console.log(`Enemy ${index}: exists=${!!enemy}, active=${enemy.active}, visible=${enemy.visible}`);
      });
    }
    
    // Only update text if we're still in the enemy step
    if (this.tutorialStep === 6) {
      this.tutorialText.setText(`ENEMY PRACTICE: Enemies defeated: ${totalDefeated}/3. You must defeat ALL enemies to continue!`);
    }
    
    // Check for tutorial completion - using both exact count and counter as fallback
    if (this.enemiesSpawned && (remainingEnemies === 0 || this.enemiesDefeated >= 3) && this.tutorialStep === 6) {
      console.log("All enemies defeated, advancing tutorial");
      this.tutorialText.setText("Great job! You've defeated all enemies!");
      
      // Clean up the enemy check timer
      if (this.enemyCheckTimer) {
        this.enemyCheckTimer.remove();
        this.enemyCheckTimer = null;
      }
      
      // Set a flag to prevent multiple advances
      this.enemiesSpawned = false;
      
      // Restore original random expletive function if we disabled it
      if (this.originalPlayRandomExpletive && this.enemyManager && this.enemyManager.sounds) {
        this.enemyManager.sounds.playRandomExpletive = this.originalPlayRandomExpletive;
        console.log("Restored original random expletive function");
        this.originalPlayRandomExpletive = null;
      }
      
      // Play the tutorial complete sound in the final step transition
      this.time.delayedCall(2000, () => {
        this.tutorialStep++;
        this.showNextStep();
      });
    }
  }
  
  clearTargets() {
    // Clear all targets
    this.targets.clear(true, true);
    
    // Find and destroy any glow effects
    this.children.list.forEach(child => {
      if (child.type === 'Arc' && child.fillColor === 0x00ffff) {
        child.destroy();
      }
    });
  }
  
  createExplosion(x, y) {
    // Create particle explosion effect
    const particleCount = 10;
    const colors = [0x00ffff, 0xffff00, 0xff00ff];
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      const particle = this.add.image(x, y, 'bullet');
      particle.setScale(0.8 + Math.random() * 0.4);
      particle.setTint(colors[Math.floor(Math.random() * colors.length)]);
      particle.setAlpha(0.8);
      
      // Animate the particle
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scale: 0,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
    
    // Create flash effect
    const flash = this.add.circle(x, y, 45, 0xffffff, 0.8);
    
    // Animate flash
    this.tweens.add({
      targets: flash,
      scale: 0,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        flash.destroy();
      }
    });
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
  
  update() {
    // Debug check for the shield ordering flag on step 4
    if (this.tutorialStep === 4 && this.droneOrderedShield === true) {
      console.log("[DEBUG] Shield flag is true in update()");
      // Reset it if we know the shield hasn't been ordered yet
      if (this.droneWheelStep === 0 || (this.droneWheelStep === 1 && !this.collectedPowerups.magazine)) {
        console.log("[DEBUG] Forcibly resetting incorrect droneOrderedShield flag");
        this.droneOrderedShield = false;
      }
    }
    
    // Update gamepad controller first for input handling
    if (this.gamepadController) {
      this.gamepadController.update();
      
      // Check for gamepad button 7 (RT/R2) to skip tutorial
      if (this.gamepadController.isButtonPressed('RT') && !this.isConfirmDialogOpen) {
        // Show skip confirmation dialog
        this.showSkipConfirmation();
      }
      
      // Special handling for LB button (drone wheel) in the tutorial
      if ((this.tutorialStep === 4 || this.tutorialStep === 5) && this.gamepadController.isButtonPressed('LB')) {
        // Check if player has received credits yet
        if (!this.canAccessDroneWheel) {
          // Flash a message that player needs to wait
          const player = this.playerManager.getPlayer();
          if (player) {
            this.events.emit('showFloatingText', {
              x: player.x,
              y: player.y - 50,
              text: "WAIT FOR CREDITS...",
              color: '#ffff00'
            });
          }
          return; // Prevent drone wheel from opening before credits
        }
        
        // Only show drone wheel if it's not already visible
        if (!this.droneWheel.isVisible) {
          // Check if we're in the post-ammo audio lockout period
          if (this.ammoAudioPlaying) {
            // Flash a message that player needs to wait for audio to finish
            const player = this.playerManager.getPlayer();
            if (player) {
              this.events.emit('showFloatingText', {
                x: player.x,
                y: player.y - 50,
                text: "PLEASE WAIT...",
                color: '#ffff00'
              });
            }
            return; // Prevent drone wheel from opening during audio
          }
          
          // Force correct shield ordering flag state based on step
          if (this.tutorialStep === 4 && this.droneWheelStep === 1 && !this.collectedPowerups.magazine) {
            console.log("[DEBUG] Opening wheel in step 1 - forcing shield flag to false");
            this.droneOrderedShield = false;
          }
          
          this.droneWheel.show();
        }
      }
    }
    
    // Update player (handles movement, shooting, animations)
    this.playerManager.update();
    
    // Update enemies (handles movement, animations)
    this.enemyManager.update(this.playerManager.getPlayer());
    
    // Update drone wheel key indicator position if it exists
    if (this.keyIndicator && this.tutorialStep === 4) {
      const player = this.playerManager.getPlayer();
      if (player) {
        this.keyIndicator.x = player.x;
        this.keyIndicator.y = player.y - 80;
      }
    }
    
    // Update weapons menu key indicator position if it exists
    if (this.weaponKeyIndicator && this.tutorialStep === 5) {
      const player = this.playerManager.getPlayer();
      if (player) {
        this.weaponKeyIndicator.x = player.x;
        this.weaponKeyIndicator.y = player.y - 80;
      }
    }
    
    // Check for player-enemy collisions (for enemy attacks)
    if (this.enemiesSpawned && this.tutorialStep === 6) { // Now step 6 is enemy practice
      this.checkPlayerEnemyCollisions();
      
      // Periodically check if all enemies are defeated
      // Use a timer to avoid checking every frame
      if (!this.enemyCheckTimer) {
        this.enemyCheckTimer = this.time.addEvent({
          delay: 1000, // Check once per second
          callback: this.checkEnemiesDefeated,
          callbackScope: this,
          loop: true
        });
      }
    } else if (this.enemyCheckTimer && this.tutorialStep !== 6) {
      // Clean up timer if we're not in the enemy step anymore
      this.enemyCheckTimer.remove();
      this.enemyCheckTimer = null;
    }
  }
  
  // Handle collisions between player and enemies for attacks
  checkPlayerEnemyCollisions() {
    const player = this.playerManager.getPlayer();
    
    const enemies = this.enemyManager.getEnemies();
    if (!enemies || !enemies.children) return;
    
    enemies.children.each(enemy => {
      if (enemy.isAttacking) return;
      
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const attackRange = player.oval.radiusX + enemy.oval.radiusX - 90;
      
      if (d <= attackRange) {
        // Start enemy attack animation
        this.enemyManager.startEnemyAttack(enemy, player, () => this.handlePlayerDeath());
        
        // Create blood splatter if player isn't already dying
        if (!player.isDying) {
          this.enemyManager.createPlayerBloodSplatter(player);
        }
      }
    }, this);
  }
  
  // Clean up on scene shutdown
  shutdown() {
    // Clean up any drone wheel related resources
    if (this.droneWheelCheckTimer) {
      this.droneWheelCheckTimer.remove();
      this.droneWheelCheckTimer = null;
    }
    
    if (this.keyIndicator) {
      this.keyIndicator.destroy();
      this.keyIndicator = null;
    }
    
    // Clean up weapons menu tutorial resources
    this.cleanupWeaponsMenuTutorial();
    
    if (this.weaponsMenu) {
      this.weaponsMenu.cleanup();
    }
    
    // Clean up any other timers or resources
    if (this.enemyCheckTimer) {
      this.enemyCheckTimer.remove();
      this.enemyCheckTimer = null;
    }
  }
  
  // Handle when the player is hit
  handlePlayerDeath() {
    // Get player reference
    const player = this.playerManager.getPlayer();
    
    // If player is already dying, don't handle death again
    if (player.isDying) {
      console.log('Player already dying, ignoring duplicate death event');
      return;
    }
    
    // Make sure health is initialized
    if (this.playerManager.health === undefined) this.playerManager.health = 2;
    if (this.playerManager.maxHealth === undefined) this.playerManager.maxHealth = 10;
    
    // Check if player has health. If health > 0, reduce it instead of killing the player
    if (this.playerManager.health > 0) {
      console.log(`Player hit! Health reduced from ${this.playerManager.health} to ${this.playerManager.health - 1}`);
      
      // Reduce health by 1
      this.playerManager.health--;
      
      // Update the health display
      if (typeof this.playerManager.updateHealthDisplay === 'function') {
        this.playerManager.updateHealthDisplay();
      }
      
      // Flash the player to show damage was taken
      this.tweens.add({
        targets: player,
        alpha: 0.5,
        duration: 100,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          player.alpha = 1;
        }
      });
      
      // Create violent screen shake
      this.cameras.main.shake(500, 0.03);
      
      // Create red pulse overlay effect
      this.createRedPulseEffect();
      
      // Create some blood splatter but don't kill player
      this.enemyManager.createPlayerBloodSplatter(player);
      
      return;
    }
    
    // If health is 0 or below, handle death normally
    // Store original scale to avoid conflicts
    const originalPlayerScale = { x: player.scaleX, y: player.scaleY };
    
    // Create blood explosion first (behind player)
    this.enemyManager.createPlayerDeathBlood(player);
    
    // Mark player as dying with visual effects
    this.playerManager.createPlayerDeathBlood();
    
    // Make sure player scale doesn't get modified by other effects
    player.setScale(originalPlayerScale.x, originalPlayerScale.y);
    
    // Show death message
    this.tutorialText.setText("You were killed! Don't worry, you can try again.");
    
    // Clean up any drone wheel tutorial indicators if active
    if (this.keyIndicator) {
      this.keyIndicator.destroy();
      this.keyIndicator = null;
    }
    
    if (this.droneWheelCheckTimer) {
      this.droneWheelCheckTimer.remove();
      this.droneWheelCheckTimer = null;
    }
    
    // Clean up any weapons menu tutorial elements if active
    this.cleanupWeaponsMenuTutorial();
    
    // Define a helper function to avoid duplicating code
    this.goToGameOverScene = () => {
      if (this.scene.isActive('TutorialScene')) {
        this.scene.start('GameOverScene', { 
          score: 0,
          isAuthenticated: this.playerAccount.isPlayerAuthenticated(),
          highScore: this.playerAccount.getHighScore()
        });
      }
    };
    
    // Remove any previous animation listeners to prevent duplicates
    player.off('animationcomplete');
    player.off('manual-death-complete');
    
    // Listen for standard animation completion
    player.on('animationcomplete', (animation) => {
      console.log('Player animation completed:', animation.key);
      if (animation.key === 'player_death') {
        console.log('Death animation completed, transitioning to game over');
        this.goToGameOverScene();
      }
    });
    
    // Listen for manual animation completion too
    player.on('manual-death-complete', () => {
      console.log('Manual death animation completed, transitioning to game over');
      this.goToGameOverScene();
    });
    
    // Fallback timer in case both animation methods fail - match GameScene's 1800ms
    this.time.delayedCall(1800, () => {
      if (this.scene.isActive('TutorialScene')) {
        console.log('Player death animation timed out, transitioning to game over');
        this.goToGameOverScene();
      }
    });
  }
}