import { BULLET_TIME_SLOWDOWN } from '../../config.js';
import { updateEarnCount } from '../utils/api.js';

export class BonkRhythmGame {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config || {};
    this.gameContainer = null;
    this.isActive = false;
    this.hackCompleted = false;
    this.timeStarted = 0;
    this.notes = [];
    this.hitZoneY = 500;
    this.hitThreshold = 50;
    this.laneX = [200, 300, 400, 500];
    this.lanes = ['A', 'S', 'D', 'F'];
    this.speed = 200; // Normal speed for note movement in the rhythm game
    this.score = 0;
    this.maxScore = 0;
    this.syncsRequired = 6;
    this.syncedHits = 0;
    
    // Variable dedicada para rastrear los BONK en la arena (independiente del display)
    this.arenaBonkCount = 0;
    this.successCallback = null;
    this.failCallback = null;
    this.touchActive = false;
    this.gamepadButtonsState = [false, false, false, false];
    
    // Sound effects
    this.bonkBeat = null;
    this.bonkHitGood = null;
    this.bonkHitBad = null;
    
    // Define the beatmap (timing and lanes)
    this.beatmap = [
      { time: 1.0, lane: 0 },
      { time: 1.5, lane: 1 },
      { time: 2.0, lane: 2 },
      { time: 2.5, lane: 3 },
      { time: 3.0, lane: 0 },
      { time: 3.3, lane: 1 },
      { time: 3.6, lane: 2 },
      { time: 4.0, lane: 3 },
      { time: 4.5, lane: 0 },
      { time: 4.8, lane: 1 },
      { time: 5.1, lane: 2 },
      { time: 5.4, lane: 3 },
    ];
  }
  
  preload() {
    // Preload assets if needed
    if (!this.scene.textures.exists('bonk-note')) {
      this.scene.load.image('bonk-note', '/assets/logo/logo.png');
    }
    
    // Load audio files if needed - use new synth sounds
    if (!this.scene.cache.audio.exists('bonk-beat')) {
      this.scene.load.audio('bonk-beat', '/assets/sound/sfx/synth/bonk_beat_loop_louder.wav');
    }
    
    if (!this.scene.cache.audio.exists('bonk-hit-good')) {
      this.scene.load.audio('bonk-hit-good', '/assets/sound/sfx/synth/bonk_hit_good.wav');
    }
    
    if (!this.scene.cache.audio.exists('bonk-hit-bad')) {
      this.scene.load.audio('bonk-hit-bad', '/assets/sound/sfx/synth/bonk_hit_bad.wav');
    }
    
    // Make sure all assets are loaded before continuing
    this.scene.load.start();
    
    console.log('Preloaded rhythm game assets');
  }
  
  create() {
    // Set the default values for the game
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    
    // Recalculate lane positions based on screen width
    this.laneX = [
      width * 0.25, 
      width * 0.4, 
      width * 0.6, 
      width * 0.75
    ];
    
    this.hitZoneY = height * 0.75; // Position hit zone at 3/4 of screen height
    
    // Create the game container that will follow the camera
    this.gameContainer = this.scene.add.container(0, 0);
    this.gameContainer.setDepth(1100); // Higher than DroneWheel
    
    // Create background
    const bg = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000, 0.8
    );
    this.gameContainer.add(bg);
    
    // Add title
    const title = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      50,
      'BONK WITHDRAWAL RHYTHM HACK',
      {
        fontFamily: 'Tektur',
        fontSize: '28px',
        color: '#00ff00',
        align: 'center'
      }
    );
    title.setOrigin(0.5);
    this.gameContainer.add(title);
    
    // Add result text
    this.resultText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      '',
      {
        fontFamily: 'Tektur',
        fontSize: '24px',
        color: '#00ff00',
        align: 'center'
      }
    );
    this.resultText.setOrigin(0.5);
    this.gameContainer.add(this.resultText);
    
    // Add progress indicator
    this.progressText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      150,
      'SYNC PROGRESS: 0/' + this.syncsRequired,
      {
        fontFamily: 'Tektur',
        fontSize: '20px',
        color: '#00ff00',
        align: 'center'
      }
    );
    this.progressText.setOrigin(0.5);
    this.gameContainer.add(this.progressText);
    
    // Create lanes
    for (let i = 0; i < 4; i++) {
      // Vertical lane guides
      const lane = this.scene.add.rectangle(
        this.laneX[i],
        this.scene.cameras.main.height / 2,
        80,
        height * 0.7, // 70% of screen height
        0x00ff00, 0.05
      );
      this.gameContainer.add(lane);
      
      // Hit zone line
      const hitLine = this.scene.add.rectangle(
        this.laneX[i],
        this.hitZoneY,
        80,
        5,
        0x00ff00, 1
      );
      this.gameContainer.add(hitLine);
      
      // Create pulsing effect for hit zones
      this.scene.tweens.add({
        targets: hitLine,
        alpha: { from: 0.3, to: 1 },
        duration: 500,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
      
      // Lane label with appropriate control keys
      let controlLabel = this.lanes[i];
      
      // Add arrow key symbols for alternative controls
      if (i === 0) controlLabel = '← ' + controlLabel; // Left
      if (i === 1) controlLabel = '↓ ' + controlLabel; // Down
      if (i === 2) controlLabel = controlLabel + ' →'; // Right
      if (i === 3) controlLabel = controlLabel + ' ↑'; // Up
      
      const laneLabel = this.scene.add.text(
        this.laneX[i],
        this.hitZoneY + 30,
        '[' + controlLabel + ']',
        {
          fontFamily: 'Tektur',
          fontSize: '16px',
          color: '#00ff00',
          align: 'center'
        }
      );
      laneLabel.setOrigin(0.5);
      this.gameContainer.add(laneLabel);
    }
    
    // Create scanline effect
    this.createScanlines();
    
    // Add instructions
    const instruction1 = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height - 70,
      'Press WASD, Arrow keys, or tap screen when notes reach the green line',
      {
        fontFamily: 'Tektur',
        fontSize: '14px',
        color: '#00ff00',
        align: 'center'
      }
    );
    instruction1.setOrigin(0.5);
    this.gameContainer.add(instruction1);
    
    // Add gamepad instruction if gamepad is detected
    if (this.scene.input.gamepad && this.scene.input.gamepad.total > 0) {
      const gamepadInstruction = this.scene.add.text(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height - 45,
        'Or use gamepad face buttons: A, B, X, Y',
        {
          fontFamily: 'Tektur',
          fontSize: '14px',
          color: '#00ff00',
          align: 'center'
        }
      );
      gamepadInstruction.setOrigin(0.5);
      this.gameContainer.add(gamepadInstruction);
    }
    
    // Add escape instruction
    const escInstruction = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height - 20,
      'Press ESC to cancel',
      {
        fontFamily: 'Tektur',
        fontSize: '14px',
        color: '#999999',
        align: 'center'
      }
    );
    escInstruction.setOrigin(0.5);
    this.gameContainer.add(escInstruction);
    
    // Setup keyboard input
    this.keyA = this.scene.input.keyboard.addKey('A');
    this.keyS = this.scene.input.keyboard.addKey('S');
    this.keyD = this.scene.input.keyboard.addKey('D');
    this.keyF = this.scene.input.keyboard.addKey('F');
    this.keyLeft = this.scene.input.keyboard.addKey('LEFT');
    this.keyRight = this.scene.input.keyboard.addKey('RIGHT');
    this.keyUp = this.scene.input.keyboard.addKey('UP');
    this.keyDown = this.scene.input.keyboard.addKey('DOWN');
    
    // Initialize audio
    this.bonkBeat = this.scene.sound.add('bonk-beat', { loop: true, volume: 0.6 });
    this.bonkHitGood = this.scene.sound.add('bonk-hit-good', { volume: 0.5 });
    this.bonkHitBad = this.scene.sound.add('bonk-hit-bad', { volume: 0.4 });
    
    // Hide initially
    this.gameContainer.setAlpha(0);
  }
  
  createScanlines() {
    // Create a scanline effect using a shader or multiple thin lines
    for (let y = 0; y < this.scene.cameras.main.height; y += 3) {
      const line = this.scene.add.rectangle(
        this.scene.cameras.main.width / 2,
        y,
        this.scene.cameras.main.width,
        1,
        0x00ff00, 0.03
      );
      this.gameContainer.add(line);
    }
  }
  
  spawnNotes() {
    // Clear any existing notes
    this.notes.forEach(note => {
      if (note.sprite) {
        // Clean up glitch timers if they exist
        if (note.sprite.glitchTimer) {
          note.sprite.glitchTimer.remove();
        }
        note.sprite.destroy();
      }
    });
    this.notes = [];
    
    // Create notes from beatmap
    this.beatmap.forEach(beat => {
      // Create a distinctive sprite for the note
      const noteSize = 30;
      
      // If the logo asset is loaded, use it
      let sprite;
      if (this.scene.textures.exists('bonk-note')) {
        sprite = this.scene.add.sprite(
          this.laneX[beat.lane],
          -50, // Start above the screen
          'bonk-note'
        );
        sprite.setScale(0.15); // Smaller scale for logo
        sprite.setTint(0x00ff00);
        
        // Add glitching effect to the logo
        this.applyGlitchEffect(sprite);
      } else {
        // Fallback to a rectangle if the image isn't loaded
        sprite = this.scene.add.rectangle(
          this.laneX[beat.lane],
          -50,
          noteSize,
          noteSize,
          0x00ff00
        );
      }
      
      // Add to container
      this.gameContainer.add(sprite);
      
      // Store the note data
      this.notes.push({
        sprite,
        time: beat.time,
        lane: beat.lane,
        hit: false,
        missed: false,
        y: -50
      });
    });
    
    // Calculate max possible score
    this.maxScore = this.beatmap.length;
    
    // Debug log
    console.log(`Spawned ${this.notes.length} notes for rhythm game`);
  }
  
  // Sincroniza nuestra variable arenaBonkCount con la de la escena
  syncBonkCount() {
    // Si la escena tiene una variable arenaBonkCount, usarla
    if (this.scene && typeof this.scene.arenaBonkCount !== 'undefined') {
      this.arenaBonkCount = this.scene.arenaBonkCount;
      console.log(`Sincronizado arenaBonkCount con el valor de la escena: ${this.arenaBonkCount}`);
    } else {
      // Si no existe, mantener nuestro valor (que puede ser 0)
      console.log(`No se encontró arenaBonkCount en la escena, manteniendo valor actual: ${this.arenaBonkCount}`);
    }
  }
  
  start(onSuccess, onFail) {
    this.isActive = true;
    this.hackCompleted = false;
    this.score = 0;
    this.syncedHits = 0;
    
    // Sincronizar el contador de BONK con la escena
    this.syncBonkCount();
    
    // Store callbacks
    this.successCallback = onSuccess;
    this.failCallback = onFail;
    
    // Check if we came from the ATM which came from the wheel
    this.fromAtmFromWheel = this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel;
    
    // Save previous time scales for restoration later
    this.previousTimeScale = this.scene.time.timeScale;
    this.previousAnimsTimeScale = this.scene.anims.globalTimeScale;
    this.previousPhysicsTimeScale = this.scene.physics.world.timeScale;
    
    // The rhythm mini-game UI should operate at normal speed, but the rest of the game at 5% speed
    const gameSlowdownTimeScale = 0.05; // 5% speed for the rest of the game
    
    // We don't need to adjust the note movement speed since the mini-game itself runs at normal speed
    
    // Completely pause game objects but keep rhythm game responsive
    if (this.scene.enemyManager) {
      this.scene.enemyManager.setPaused(true);
    }
    
    // Disable player controls during minigame
    if (this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = false;
    }
    
    // Emit event to pause enemy spawning (for additional safety/redundancy)
    this.scene.events.emit('withdrawGameStarted');
    
    // Store and pause projectiles
    if (this.scene.projectiles) {
      this.projectilesState = [];
      this.scene.projectiles.getChildren().forEach(projectile => {
        this.projectilesState.push({
          obj: projectile,
          velX: projectile.body.velocity.x,
          velY: projectile.body.velocity.y
        });
        projectile.body.setVelocity(0, 0); // Completely stop projectiles
      });
    }
    
    // Use TimeScaleManager if available, otherwise apply time scales directly
    if (this.scene.timeScaleManager) {
      console.log("BonkRhythmGame: Using TimeScaleManager to slow enemies");
      
      // Ensure rhythm game effect is active and time scale is at 5%
      console.log("BonkRhythmGame: Ensuring rhythm game time effect is active");
      
      // IMPORTANT: Don't deactivate the rhythm game time effect here - it should already be active
      // from the deposit menu. Just ensure all the right flags are set
      
      // Ensure we're starting from a clean slate
      this.scene.timeScaleManager.exemptEntities.player = true;
      this.scene.timeScaleManager.exemptEntities.playerBullets = true;
      this.scene.timeScaleManager.exemptEntities.playerReload = true;
      
      // Ensure rhythm game effect is active (should already be set from the transition)
      this.scene.timeScaleManager.activeTimeEffects.rhythmGame = true;
      
      // Force immediate update of time scales to ensure 5% is applied
      this.scene.timeScaleManager.updateTimeScales();
      
      // Apply direct slow down to 5% for all enemies for the minigame specifically
      if (this.scene.enemyManager && this.scene.enemyManager.getEnemies) {
        const enemies = this.scene.enemyManager.getEnemies().getChildren();
        if (enemies && enemies.length > 0) {
          console.log(`BonkRhythmGame: Directly applying slowdown to ${enemies.length} enemies (5% speed)`);
          enemies.forEach(enemy => {
            if (enemy.body && enemy.body.velocity) {
              // Override with 5% speed for minigame (same as the deposit menu)
              enemy.body.velocity.x = enemy.body.velocity.x * 0.05; // Apply 0.05 factor to original velocities
              enemy.body.velocity.y = enemy.body.velocity.y * 0.05;
            }
            if (enemy.anims) {
              enemy.anims.timeScale = 0.05; // Force to 5%
            }
            if (enemy.speed !== undefined) {
              // Get the default speed based on enemy type
              let defaultSpeed = 100; // Default fallback
              if (enemy.enemyType === 'blue') defaultSpeed = 110;
              if (enemy.enemyType === 'green') defaultSpeed = 120;
              if (enemy.enemyType === 'gold') defaultSpeed = 130;
              
              // Apply 5% of default speed
              enemy.speed = defaultSpeed * 0.05;
            }
          });
        }
      }
    } else {
      // Fallback to direct time scale adjustment
      console.log("BonkRhythmGame: No TimeScaleManager, using direct time scale");
      this.scene.time.timeScale = gameSlowdownTimeScale;
      this.scene.physics.world.timeScale = gameSlowdownTimeScale;
      this.scene.anims.globalTimeScale = gameSlowdownTimeScale;
    }
    
    console.log(`RhythmGame start - applied game world slowdown to ${gameSlowdownTimeScale * 100}% speed while rhythm game runs at normal speed`);
    
    
    // Always pause game objects but keep rhythm game responsive
    if (this.scene.enemyManager) {
      this.scene.enemyManager.setPaused(true);
    }
    if (this.scene.playerManager) {
      // Disable player movement but keep UI interactions
      this.scene.playerManager.controlsEnabled = false;
    }
    if (this.scene.projectiles) {
      // Store current projectile velocities and stop them
      this.projectilesState = [];
      this.scene.projectiles.getChildren().forEach(projectile => {
        this.projectilesState.push({
          obj: projectile,
          velX: projectile.body.velocity.x,
          velY: projectile.body.velocity.y
        });
        projectile.body.setVelocity(0, 0);
      });
    }
    
    // Update UI
    this.resultText.setText('');
    this.progressText.setText('SYNC PROGRESS: 0/' + this.syncsRequired);
    
    // Create the notes
    this.spawnNotes();
    
    // Show the game
    this.scene.tweens.add({
      targets: this.gameContainer,
      alpha: 1,
      duration: 500,
      ease: 'Power2'
    });
    
    // Double check that enemy speeds are properly set to 5%
    if (this.scene.timeScaleManager && this.scene.enemyManager && this.scene.enemyManager.getEnemies) {
      const enemies = this.scene.enemyManager.getEnemies().getChildren();
      if (enemies && enemies.length > 0) {
        console.log(`BonkRhythmGame: Final verification of ${enemies.length} enemies at 5% speed`);
        enemies.forEach(enemy => {
          if (enemy.anims) {
            enemy.anims.timeScale = 0.05;
          }
          if (enemy.speed !== undefined) {
            // Get the default speed based on enemy type if possible
            const defaultSpeed = enemy.enemyType === 'blue' ? 110 : 
                               enemy.enemyType === 'green' ? 120 : 
                               enemy.enemyType === 'gold' ? 130 : 100;
            enemy.speed = defaultSpeed * 0.05;
          }
        });
      }
    }
    
    // Start the beat
    this.bonkBeat.play();
    
    // Record start time
    this.timeStarted = this.scene.time.now / 1000;
    
    // Setup update loop
    this.updateEvent = this.scene.time.addEvent({
      delay: 16,
      callback: this.update,
      callbackScope: this,
      loop: true
    });
    
    // Set up escape key to cancel
    this.escapeKey = this.scene.input.keyboard.addKey('ESC');
    this.scene.input.keyboard.on('keydown-ESC', () => {
      if (this.isActive) {
        // Mark as not active immediately to prevent multiple calls
        this.isActive = false;
        console.log("BonkRhythmGame: ESC pressed - canceling game");
        
        // Show cancellation message
        this.showResult('CANCELLED', '#ffff00');
        
        // Force immediate time scale and control restoration
        // This is the most critical part - restore normal time and controls NOW
        if (this.scene.time) {
          this.scene.time.timeScale = 1.0;
        }
        if (this.scene.physics && this.scene.physics.world) {
          this.scene.physics.world.timeScale = 1.0;
        }
        if (this.scene.anims) {
          this.scene.anims.globalTimeScale = 1.0;
        }
        
        // Force player controls enabled immediately
        if (this.scene.playerManager) {
          console.log("BonkRhythmGame ESC: FORCIBLY enabling player controls");
          this.scene.playerManager.controlsEnabled = true;
        }
        
        // Force enemies unpaused immediately
        if (this.scene.enemyManager) {
          this.scene.enemyManager.setPaused(false);
        }
        
        // Reset TimeScaleManager if available
        if (this.scene.timeScaleManager) {
          // First, force restore all enemy speeds
          console.log("BonkRhythmGame ESC: Forcibly restoring enemy speeds");
          this.scene.timeScaleManager.restoreEnemySpeeds();
          this.scene.timeScaleManager.resetAllEnemySpeeds();
          
          // Then disable all time effects and reset flags
          this.scene.timeScaleManager.activeTimeEffects.rhythmGame = false;
          this.scene.timeScaleManager.activeTimeEffects.droneWheel = false;
          this.scene.timeScaleManager.activeTimeEffects.bulletTime = false;
          
          // Reset all entity exemptions
          this.scene.timeScaleManager.exemptEntities.player = false;
          this.scene.timeScaleManager.exemptEntities.playerBullets = false;
          this.scene.timeScaleManager.exemptEntities.playerReload = false;
          
          // Force apply normal time scale
          this.scene.timeScaleManager.applyTimeScales(1.0);
        }
        
        // Reset drone wheel flag immediately
        if (this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel) {
          this.scene.droneWheel.openingAtmFromWheel = false;
        }
        
        // Stop audio
        if (this.bonkBeat) {
          this.bonkBeat.stop();
        }
        
        // Restore projectile velocities immediately
        if (this.projectilesState && this.projectilesState.length > 0) {
          this.projectilesState.forEach(pState => {
            if (pState.obj && pState.obj.active) {
              pState.obj.body.setVelocity(pState.velX, pState.velY);
            }
          });
          this.projectilesState = [];
        }
        
        // Stop the game UI with fade out
        this.stop();
        
        // Call the failCallback to properly handle cancellation
        if (this.failCallback) {
          this.failCallback();
        }
      }
    });
  }
  
  update() {
    if (!this.isActive) return;
    
    const currentTime = this.scene.time.now / 1000 - this.timeStarted;
    
    // Make the container follow the camera
    const camera = this.scene.cameras.main;
    this.gameContainer.setPosition(camera.scrollX, camera.scrollY);
    
    // Update notes
    this.notes.forEach(note => {
      if (!note.hit && !note.missed) {
        // Calculate position based on time (normal speed for the rhythm game)
        const elapsed = currentTime - note.time;
        const targetY = 100 + (elapsed * this.speed);
        note.y = targetY;
        note.sprite.y = targetY;
        
        // Check if note was missed
        if (targetY > this.hitZoneY + this.hitThreshold * 1.5 && !note.hit) {
          note.missed = true;
          note.sprite.setAlpha(0.3);
          this.showResult('DESYNC ❌', '#ff0000');
        }
      }
    });
    
    // Check for key presses
    this.checkKeyPress();
    
    // Check if all notes are processed
    const allProcessed = this.notes.every(note => note.hit || note.missed);
    if (allProcessed && !this.hackCompleted) {
      this.completeHack();
    }
  }
  
  checkKeyPress() {
    // Check keyboard inputs
    // WASD controls
    if (Phaser.Input.Keyboard.JustDown(this.keyA)) {
      this.processLaneHit(0);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keyS)) {
      this.processLaneHit(1);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keyD)) {
      this.processLaneHit(2);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keyF)) {
      this.processLaneHit(3);
    }
    
    // Arrow keys as alternative
    if (Phaser.Input.Keyboard.JustDown(this.keyLeft)) {
      this.processLaneHit(0);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      this.processLaneHit(1);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keyRight)) {
      this.processLaneHit(2);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      this.processLaneHit(3);
    }
    
    // Check gamepad if available
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (gamepad) {
        // Face buttons (A, B, X, Y) for gamepad
        if (gamepad.buttons[0].pressed && !this.gamepadButtonsState[0]) {
          this.gamepadButtonsState[0] = true;
          this.processLaneHit(0);
        } else if (!gamepad.buttons[0].pressed && this.gamepadButtonsState[0]) {
          this.gamepadButtonsState[0] = false;
        }
        
        if (gamepad.buttons[1].pressed && !this.gamepadButtonsState[1]) {
          this.gamepadButtonsState[1] = true;
          this.processLaneHit(1);
        } else if (!gamepad.buttons[1].pressed && this.gamepadButtonsState[1]) {
          this.gamepadButtonsState[1] = false;
        }
        
        if (gamepad.buttons[2].pressed && !this.gamepadButtonsState[2]) {
          this.gamepadButtonsState[2] = true;
          this.processLaneHit(2);
        } else if (!gamepad.buttons[2].pressed && this.gamepadButtonsState[2]) {
          this.gamepadButtonsState[2] = false;
        }
        
        if (gamepad.buttons[3].pressed && !this.gamepadButtonsState[3]) {
          this.gamepadButtonsState[3] = true;
          this.processLaneHit(3);
        } else if (!gamepad.buttons[3].pressed && this.gamepadButtonsState[3]) {
          this.gamepadButtonsState[3] = false;
        }
      }
    }
    
    // Check for touch inputs
    if (this.scene.input.pointer1.isDown && !this.touchActive) {
      this.touchActive = true;
      const touchX = this.scene.input.pointer1.x;
      const screenWidth = this.scene.cameras.main.width;
      
      // Divide screen width into 4 sections for the lanes
      const laneWidth = screenWidth / 4;
      const laneIndex = Math.floor(touchX / laneWidth);
      
      // Ensure lane index is within bounds
      const clampedLaneIndex = Math.max(0, Math.min(3, laneIndex));
      this.processLaneHit(clampedLaneIndex);
    } else if (!this.scene.input.pointer1.isDown && this.touchActive) {
      this.touchActive = false;
    }
  }
  
  processLaneHit(laneIndex) {
    if (!this.isActive) return;
    
    let hitSuccess = false;
    
    // Check if there's a note in the hit zone for this lane
    this.notes.forEach(note => {
      if (note.lane === laneIndex && !note.hit && !note.missed) {
        // Check if the note is in the hit zone
        if (Math.abs(note.y - this.hitZoneY) <= this.hitThreshold) {
          note.hit = true;
          
          // Visual feedback
          note.sprite.setScale(0.7);
          this.scene.tweens.add({
            targets: note.sprite,
            alpha: 0,
            scale: 1,
            duration: 300,
            ease: 'Power2'
          });
          
          // Play hit sound
          this.bonkHitGood.play();
          
          // Show result
          this.showResult('SYNCED BONK ✓', '#00ff00');
          
          // Update score
          this.score++;
          this.syncedHits++;
          this.progressText.setText('SYNC PROGRESS: ' + this.syncedHits + '/' + this.syncsRequired);
          
          hitSuccess = true;
        }
      }
    });
    
    // If no note was hit, play bad sound
    if (!hitSuccess) {
      this.bonkHitBad.play();
      this.showResult('DESYNC ❌', '#ff0000');
    }
    
    // Check if we have enough synced hits to complete the hack
    if (this.syncedHits >= this.syncsRequired && !this.hackCompleted) {
      this.completeHack();
    }
  }
  
  showResult(text, color) {
    this.resultText.setText(text);
    this.resultText.setColor(color);
    
    // Clear after a delay
    this.scene.time.delayedCall(700, () => {
      if (this.resultText) {
        this.resultText.setText('');
      }
    });
  }
  
  completeHack() {
    this.hackCompleted = true;
    this.isActive = false;
    
    // Cancel update loop
    if (this.updateEvent) {
      this.updateEvent.remove();
    }
    
    // Emit event to resume enemy spawning (for additional safety/redundancy)
    this.scene.events.emit('withdrawGameEnded');
    
    // Calculate success percentage
    const successPercent = Math.round((this.syncedHits / this.maxScore) * 100);
    
    // Show final result
    if (this.syncedHits >= this.syncsRequired) {
      this.showResult('HACK SUCCESSFUL!', '#00ff00');
      
      // Start restoring game state immediately
      this.restoreGameState();
      
      // Get the entire arena balance
      let arenaBalance = this.scene.ui ? this.scene.ui.getMoney() : 0;
      
      console.log(`BonkRhythmGame: Getting arena balance before withdrawal. Current value: ${arenaBalance}`);
      
      // Force UI refresh to ensure we're getting the most up-to-date value
      if (this.scene.ui && this.scene.ui.moneyText) {
        console.log(`Current UI text: ${this.scene.ui.moneyText.text}`);
        // Try to parse the amount from UI text as a fallback
        const moneyMatch = this.scene.ui.moneyText.text.match(/\$(\d+(\.\d+)?)/);
        if (moneyMatch && moneyMatch[1]) {
          const parsedBalance = parseFloat(moneyMatch[1]);
          if (!isNaN(parsedBalance) && parsedBalance > 0) {
            arenaBalance = parsedBalance;
            console.log(`Using parsed balance from UI text: ${arenaBalance}`);
          }
        }
      }
      
      // Debugging: If arena balance is 0 but we still got here, use a minimum test value
      if (arenaBalance <= 0) {
        console.log("WARNING: Arena balance is 0 or negative in withdrawal. Using minimum test value.");
        arenaBalance = 0; // Minimum test value
        // Force update UI if it exists
        if (this.scene.ui && this.scene.ui.updateMoney) {
          this.scene.ui.updateMoney(0);
          console.log("Updated UI money for testing purposes");
          
          // Force update the text display as well
          if (this.scene.ui.moneyText) {
            this.scene.ui.moneyText.setText(`💵 Arena: $${arenaBalance.toFixed(2)}`);
          }
        }
      }
      
      let actualWithdrawal = 0;
      let amountStayingInArena = 0;
      
      // Get the player's BONK balance (if available)
      // Similar a la estrategia usada para los créditos, obtenemos el balance de BONK usando múltiples métodos
      let arenaBonkBalance = 0;
      
      // Método 1: Usar la variable arenaBonkCount de la escena (más confiable)
      if (this.scene && typeof this.scene.arenaBonkCount === 'number') {
        arenaBonkBalance = this.scene.arenaBonkCount;
        console.log(`BONK: Obtenido de scene.arenaBonkCount: ${arenaBonkBalance}`);
      }
      // Método 2: Verificar en la UI si hay un contador de BONK
      else if (this.scene.ui && typeof this.scene.ui.bonkCount === 'number') {
        arenaBonkBalance = this.scene.ui.bonkCount;
        console.log(`BONK: Obtenido de UI bonkCount: ${arenaBonkBalance}`);
      }
      // Método 3: Verificar en el registro global
      else if (this.scene.registry && this.scene.registry.get('bonkCount') !== undefined) {
        arenaBonkBalance = this.scene.registry.get('bonkCount');
        console.log(`BONK: Obtenido de registry: ${arenaBonkBalance}`);
      }
      
      console.log(`BONK: Balance final detectado: ${arenaBonkBalance}`);
      
      // Asegurar que sea un número válido
      if (isNaN(arenaBonkBalance) || arenaBonkBalance < 0) {
        arenaBonkBalance = 0;
        console.log(`BONK: Corregido a 0 por ser inválido`);
      }
      
      // Guardar el valor detectado para transferir
      let playerBonkBalance = arenaBonkBalance;
      
      console.log(`BONK to transfer from arena to account: ${playerBonkBalance}`);
      
      // Calculate withdrawal amount based on new rules
      if (successPercent === 100) {
        // 100% hits: get full amount (no bonus)
        actualWithdrawal = Math.floor(arenaBalance);
        amountStayingInArena = 0;
        // No BONK transfer - only what player already has
      } else if (successPercent >= 50) {
        // More than 50%: get half, half stays in arena
        actualWithdrawal = Math.floor(arenaBalance / 2);
        amountStayingInArena = Math.floor(arenaBalance / 2);
        // Good performance gets 50% of BONK tokens transferred
        playerBonkBalance = Math.floor(playerBonkBalance / 2);
      } else {
        // Less than 50%: lose 25% of funds, get 75%
        actualWithdrawal = Math.floor(arenaBalance * 0.75);
        amountStayingInArena = Math.floor(arenaBalance * 0.25);
      }
      
      // Process withdrawal from arena to game account
      let withdrawalSuccessful = false;
      if (this.scene.playerAccount && arenaBalance > 0) {
        // Withdraw from arena to game account only if there's a positive balance
        withdrawalSuccessful = this.scene.playerAccount.withdrawFromArena(actualWithdrawal, arenaBalance);
        console.log(`Withdrew ${actualWithdrawal} credits from arena balance of ${arenaBalance}: ${withdrawalSuccessful ? 'success' : 'failed'}`);
        
        // Persist updated credits (credit_count) in DB
        const newCreditCount = this.scene.playerAccount.getGameAccountBalance();
        this.scene.playerAccount.setCreditCount(newCreditCount).catch(err => console.error('Error updating credit_count in DB:', err));
        
        // Siempre actualizar el balance de BONK en la base de datos, incluso si es 0
        if (withdrawalSuccessful && this.scene.playerAccount) {
          // Persist earned BONK tokens (earn) in DB
          const newBonkBalance = this.scene.playerAccount.updateBonkBalance(playerBonkBalance);
          console.log(`Transferred ${playerBonkBalance} BONK tokens; new account balance: ${newBonkBalance}`);
          updateEarnCount(this.scene.playerAccount.authToken, newBonkBalance)
            .then(() => console.log(`Updated bonk_balance in DB: ${newBonkBalance}`))
            .catch(err => console.error('Error updating bonk_balance in DB:', err));
          
          // RESETEO EXHAUSTIVO DE BONK - similar a withdrawFromArena para créditos
          console.log(`FULL BONK WITHDRAWAL: Setting arena BONK balance to 0 (was: ${playerBonkBalance})`);
          
          try {
            // Resetear TODOS los posibles lugares donde el valor puede estar almacenado
            
            // 1. Resetear la variable de la escena principal si existe
            if (this.scene && typeof this.scene.arenaBonkCount !== 'undefined') {
              this.scene.arenaBonkCount = 0;
              console.log(`BONK: Reset scene.arenaBonkCount = 0`);
            }
            
            // 2. Resetear el contador de la UI mediante updateBonkCount
            if (this.scene.ui && this.scene.ui.bonkCounter && 
                typeof this.scene.ui.bonkCounter.updateBonkCount === 'function') {
              this.scene.ui.bonkCounter.updateBonkCount(0);
              console.log(`BONK: Reset via updateBonkCount(0)`);
            }
            
            // 3. Resetear directamente la propiedad bonkCount de la UI
            if (this.scene.ui && typeof this.scene.ui.bonkCount !== 'undefined') {
              this.scene.ui.bonkCount = 0;
              console.log(`BONK: Reset UI bonkCount = 0 directly`);
            }
            
            // 4. Actualizar la visualización si hay un método específico
            if (this.scene.ui && typeof this.scene.ui.updateBonkDisplay === 'function') {
              this.scene.ui.updateBonkDisplay(0);
              console.log(`BONK: Called updateBonkDisplay(0)`);
            }
            
            // 5. Resetear el registro global
            if (this.scene.registry) {
              this.scene.registry.set('bonkCount', 0);
              console.log(`BONK: Reset registry bonkCount = 0`);
            }
            
            // 6. Emitir múltiples eventos para notificar a todos los componentes
            this.scene.events.emit('arenaBonkCountUpdated', 0);
            this.scene.events.emit('bonkBalanceUpdated', 0);
            this.scene.events.emit('resetBonkCount', true);
            console.log(`BONK: Emitted all update events with value 0`);
            
            // 7. Verificar que el reseteo funcionó
            let verifyBonkCount = 'unknown';
            if (this.scene && typeof this.scene.arenaBonkCount === 'number') {
              verifyBonkCount = this.scene.arenaBonkCount;
            } else if (this.scene.ui && typeof this.scene.ui.bonkCount === 'number') {
              verifyBonkCount = this.scene.ui.bonkCount;
            } else if (this.scene.registry) {
              verifyBonkCount = this.scene.registry.get('bonkCount');
            }
            
            console.log(`BONK VERIFICATION: Arena BONK balance after withdrawal: ${verifyBonkCount}`);
          } catch (error) {
            console.warn(`Error resetting BONK count: ${error.message}`);
          }
        }
      } else {
        // Fallback if playerAccount isn't available - directly update UI
        if (arenaBalance > 0) {
          // Deduct the full arena balance
          this.scene.ui.updateMoney(-arenaBalance);
          // Add the calculated amount to player credits
          if (this.scene.playerManager && this.scene.playerManager.addCredits) {
            this.scene.playerManager.addCredits(actualWithdrawal);
          } else {
            console.warn("PlayerManager addCredits method not found");
          }
          withdrawalSuccessful = true;
        }
      }
      
      // Force an additional direct UI update to ensure the arena is shown as empty
      if (withdrawalSuccessful && this.scene.ui) {
        // Set money to 0 through both methods
        if (typeof this.scene.ui.money === 'number') {
          this.scene.ui.money = 0;
        }
        
        // Update text display
        if (this.scene.ui.moneyText) {
          this.scene.ui.moneyText.setText('💵 Arena: $0.00');
        }
        
        // Emit events to notify all listeners
        this.scene.events.emit('moneyUpdated', 0);
        this.scene.events.emit('arenaBalanceUpdated', 0);
        
        console.log(`FORCE RESET: Arena balance UI set to 0 after withdrawal`);
      }
      
      // Fade out
      this.scene.tweens.add({
        targets: this.gameContainer,
        alpha: 0,
        duration: 1000,
        ease: 'Power2',
        onComplete: () => {
          // Stop audio
          if (this.bonkBeat) {
            this.bonkBeat.stop();
          }
          
          // Reset the ATM flag when done with withdrawal operation
          if (this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel) {
            console.log("BonkRhythmGame: Resetting openingAtmFromWheel flag");
            this.scene.droneWheel.openingAtmFromWheel = false;
          }
          
          // Full state restoration after animation
          this.restoreGameState();
          
          // Multiple restoration attempts to ensure player regains control
          this.forceMultipleControlRestoration();
          
          // Show result message based on withdrawal result and accuracy
          if (withdrawalSuccessful) {
            // Create message based on success percentage
            let message = '';
            if (successPercent === 100) {
              message = `PERFECT HACK! WITHDRAWN $${actualWithdrawal} (+10% BONUS) TO GAME ACCOUNT`;
              
              // Show BONK transfer as a separate message with safety checks
              if (playerBonkBalance > 0 && this.scene.playerManager && this.scene.playerManager.player) {
                try {
                  this.scene.events.emit('showFloatingText', {
                    x: this.scene.playerManager.player.x,
                    y: this.scene.playerManager.player.y - 90, // Higher position
                    text: `+ ${playerBonkBalance} BONK TOKENS TRANSFERRED!`,
                    color: '#ffe234' // Bonk yellow color
                  });
                } catch (error) {
                  console.warn(`Failed to show BONK token message: ${error.message}`);
                }
              }
            } else if (successPercent >= 50) {
              message = `WITHDRAWN $${actualWithdrawal} TO GAME ACCOUNT ($${amountStayingInArena} STAYS IN ARENA)`;
              
              // Show BONK transfer as a separate message with safety checks
              if (playerBonkBalance > 0 && this.scene.playerManager && this.scene.playerManager.player) {
                try {
                  this.scene.events.emit('showFloatingText', {
                    x: this.scene.playerManager.player.x,
                    y: this.scene.playerManager.player.y - 90, // Higher position
                    text: `+ ${playerBonkBalance} BONK TOKENS TRANSFERRED!`,
                    color: '#ffe234' // Bonk yellow color
                  });
                } catch (error) {
                  console.warn(`Failed to show BONK token message: ${error.message}`);
                }
              }
            } else {
              message = `WITHDRAWN $${actualWithdrawal} TO GAME ACCOUNT (LOST $${amountStayingInArena})`;
            }
            
            this.scene.events.emit('showFloatingText', {
              x: this.scene.playerManager.player.x,
              y: this.scene.playerManager.player.y - 50,
              text: message,
              color: '#00ff00'
            });
          } else {
            this.scene.events.emit('showFloatingText', {
              x: this.scene.playerManager.player.x,
              y: this.scene.playerManager.player.y - 50,
              text: `WITHDRAWAL FAILED - INSUFFICIENT FUNDS`,
              color: '#ff0000'
            });
          }
          
          // Call success callback
          if (this.successCallback) {
            this.successCallback(successPercent);
          }
        }
      });
    } else {
      this.showResult('HACK FAILED!', '#ff0000');
      
      // Start restoring game state immediately
      this.restoreGameState();
      
      // Fade out
      this.scene.tweens.add({
        targets: this.gameContainer,
        alpha: 0,
        duration: 1000,
        ease: 'Power2',
        onComplete: () => {
          // Stop audio
          if (this.bonkBeat) {
            this.bonkBeat.stop();
          }
          
          // Reset the ATM flag when done with withdrawal operation
          if (this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel) {
            console.log("BonkRhythmGame: Resetting openingAtmFromWheel flag on fail");
            this.scene.droneWheel.openingAtmFromWheel = false;
          }
          
          // Full state restoration after animation
          this.restoreGameState();
          
          // Multiple restoration attempts to ensure player regains control
          this.forceMultipleControlRestoration();
          
          // Call fail callback
          if (this.failCallback) {
            this.failCallback();
          }
        }
      });
    }
  }
  
  stop() {
    // Only do animation if we're not already closing from ESC key handler
    // This prevents race conditions and double-restoration
    const wasStoppedByEsc = !this.isActive;
    
    // Mark as inactive to prevent further updates
    this.isActive = false;
    
    // Cancel update loop
    if (this.updateEvent) {
      this.updateEvent.remove();
    }
    
    // Force remove keyboard listener to prevent memory leaks
    this.scene.input.keyboard.off('keydown-ESC');
    
    // If we're already stopping from ESC, skip most of this since it was already done
    if (!wasStoppedByEsc) {
      console.log("BonkRhythmGame stop(): Not stopped by ESC, doing full restoration");
      
      // Stop audio immediately
      if (this.bonkBeat) {
        this.bonkBeat.stop();
      }
      
      // Direct fix for game state
      if (this.scene.time) {
        this.scene.time.timeScale = 1.0;
      }
      if (this.scene.physics && this.scene.physics.world) {
        this.scene.physics.world.timeScale = 1.0;
      }
      if (this.scene.anims) {
        this.scene.anims.globalTimeScale = 1.0;
      }
      
      // Force player controls enabled
      if (this.scene.playerManager) {
        console.log("BonkRhythmGame stop: FORCIBLY enabling player controls");
        this.scene.playerManager.controlsEnabled = true;
      }
      
      // Force enemies unpaused
      if (this.scene.enemyManager) {
        this.scene.enemyManager.setPaused(false);
      }
      
      // Reset TimeScaleManager
      if (this.scene.timeScaleManager) {
        this.scene.timeScaleManager.restoreEnemySpeeds();
        this.scene.timeScaleManager.resetAllEnemySpeeds();
        this.scene.timeScaleManager.activeTimeEffects.rhythmGame = false;
        this.scene.timeScaleManager.activeTimeEffects.droneWheel = false;
        this.scene.timeScaleManager.activeTimeEffects.bulletTime = false;
        this.scene.timeScaleManager.exemptEntities.player = false;
        this.scene.timeScaleManager.exemptEntities.playerBullets = false;
        this.scene.timeScaleManager.exemptEntities.playerReload = false;
        this.scene.timeScaleManager.applyTimeScales(1.0);
      }
      
      // Reset drone wheel flag
      if (this.scene.droneWheel && this.scene.droneWheel.openingAtmFromWheel) {
        this.scene.droneWheel.openingAtmFromWheel = false;
      }
      
      // Restore projectile velocities
      if (this.projectilesState && this.projectilesState.length > 0) {
        this.projectilesState.forEach(pState => {
          if (pState.obj && pState.obj.active) {
            pState.obj.body.setVelocity(pState.velX, pState.velY);
          }
        });
        this.projectilesState = [];
      }
    }
    
    // Schedule additional control restoration attempts to be extra safe
    this.forceMultipleControlRestoration();
    
    // Hide the game (do this regardless of how it was stopped)
    this.scene.tweens.add({
      targets: this.gameContainer,
      alpha: 0,
      duration: 300, // Faster hide to improve responsiveness
      ease: 'Power2',
      onComplete: () => {
        // Final restoration when animation completes
        if (this.scene.playerManager) {
          this.scene.playerManager.controlsEnabled = true;
        }
        
        // Make double sure game is running at normal speed
        if (this.scene.time) {
          this.scene.time.timeScale = 1.0;
        }
        if (this.scene.physics && this.scene.physics.world) {
          this.scene.physics.world.timeScale = 1.0;
        }
        if (this.scene.anims) {
          this.scene.anims.globalTimeScale = 1.0;
        }
      }
    });
  }
  
  /**
   * Restore game state - can be called multiple times safely
   * This ensures that game state is fully restored even if animation is interrupted
   */
  restoreGameState() {
    // Restore previous time scales
    console.log(`RhythmGame restoring time scales: game=${this.previousTimeScale}, physics=${this.previousPhysicsTimeScale}, anims=${this.previousAnimsTimeScale}`);
    
    // Use TimeScaleManager if available, otherwise restore directly
    if (this.scene.timeScaleManager) {
      console.log("BonkRhythmGame: Using TimeScaleManager to restore time");
      
      // Deactivate rhythm game time effect first
      if (this.scene.timeScaleManager.activeTimeEffects.rhythmGame) {
        this.scene.timeScaleManager.deactivateRhythmGameTime();
      }
      
      // Remove player exemptions
      this.scene.timeScaleManager.exemptEntities.player = false;
      this.scene.timeScaleManager.exemptEntities.playerBullets = false;
      this.scene.timeScaleManager.exemptEntities.playerReload = false;
      
      // Force restore enemy speeds to make sure they're reset
      console.log("BonkRhythmGame: Forcing enemy speed restoration");
      this.scene.timeScaleManager.restoreEnemySpeeds();
      
      // Make a second direct call to reset all enemies
      this.scene.timeScaleManager.resetAllEnemySpeeds();
      
      // Force time scales to normal
      this.scene.timeScaleManager.applyTimeScales(1.0);
    } else {
      // Fallback to direct time scale restoration
      console.log("BonkRhythmGame: No TimeScaleManager, restoring time directly");
      this.scene.time.timeScale = 1.0;
      this.scene.anims.globalTimeScale = 1.0;
      this.scene.physics.world.timeScale = 1.0;
    }
      
    // Always unpause game objects and enable player controls
    if (this.scene.enemyManager) {
      this.scene.enemyManager.setPaused(false);
    }
    
    // Always enable player controls
    if (this.scene.playerManager) {
      this.scene.playerManager.controlsEnabled = true;
    }
    
    // Restore projectile velocities if any were stored
    if (this.projectilesState && this.projectilesState.length > 0) {
      this.projectilesState.forEach(pState => {
        if (pState.obj && pState.obj.active) {
          pState.obj.body.setVelocity(pState.velX, pState.velY);
        }
      });
      this.projectilesState = [];
    }
  }
  
  /**
   * Force multiple control restoration attempts to ensure player control is regained
   * Similar to the approach used in DepositWithdrawPrompt
   */
  forceMultipleControlRestoration() {
    console.log("BonkRhythmGame: Starting aggressive control restoration sequence");
    
    // Schedule multiple attempts to restore control with increasing delays
    const delays = [100, 300, 500, 800, 1000];
    
    delays.forEach(delay => {
      this.scene.time.delayedCall(delay, () => {
        if (!this.scene) return; // Scene might have changed by now
        
        console.log(`Delayed rhythm game control restoration attempt at ${delay}ms`);
        
        // Reset all possible time-altering states
        if (this.scene.timeScaleManager) {
          this.scene.timeScaleManager.activeTimeEffects.rhythmGame = false;
          this.scene.timeScaleManager.exemptEntities.player = false;
          this.scene.timeScaleManager.exemptEntities.playerBullets = false;
          this.scene.timeScaleManager.exemptEntities.playerReload = false;
          this.scene.timeScaleManager.applyTimeScales(1.0);
        }
        
        // Force time scales directly as well
        this.scene.time.timeScale = 1.0;
        this.scene.physics.world.timeScale = 1.0;
        this.scene.anims.globalTimeScale = 1.0;
        
        // Force unpause everything
        if (this.scene.enemyManager) {
          this.scene.enemyManager.paused = false;
          this.scene.enemyManager.setPaused(false);
        }
        
        // Force enable player controls
        if (this.scene.playerManager) {
          this.scene.playerManager.controlsEnabled = true;
        }
      });
    });
  }
  
  applyGlitchEffect(sprite) {
    // Don't continue if sprite doesn't exist or scene is being destroyed
    if (!sprite || !sprite.scene || !this.scene) return;
    
    // Set up a random glitch interval
    const glitchInterval = Phaser.Math.Between(100, 300);
    
    // Create a timer for glitching effect
    const glitchTimer = this.scene.time.addEvent({
      delay: glitchInterval,
      callback: () => {
        if (!sprite.active || !sprite.scene) {
          // Remove the timer if sprite is destroyed
          glitchTimer.remove();
          return;
        }
        
        // Random chance for each glitch effect
        const glitchChance = Math.random();
        
        if (glitchChance < 0.5) {
          // Position glitch - slight random offset
          const offsetX = Phaser.Math.Between(-5, 5);
          const offsetY = Phaser.Math.Between(-5, 5);
          sprite.x += offsetX;
          sprite.y += offsetY;
          
          // Reset position after short delay
          this.scene.time.delayedCall(50, () => {
            if (sprite.active && sprite.scene) {
              sprite.x -= offsetX;
              sprite.y -= offsetY;
            }
          });
        } else {
          // Scale/flip glitch
          const originalScaleX = sprite.scaleX;
          const originalScaleY = sprite.scaleY;
          
          // Apply random scale or flip
          sprite.scaleX = originalScaleX * Phaser.Math.FloatBetween(0.8, 1.2);
          sprite.scaleY = originalScaleY * Phaser.Math.FloatBetween(0.8, 1.2);
          
          if (Math.random() > 0.5) {
            sprite.scaleX *= -1; // Flip horizontally
          }
          
          // Reset scale after short delay
          this.scene.time.delayedCall(60, () => {
            if (sprite.active && sprite.scene) {
              sprite.scaleX = originalScaleX;
              sprite.scaleY = originalScaleY;
            }
          });
        }
        
        // Random delay for next glitch
        glitchTimer.delay = Phaser.Math.Between(150, 500);
      },
      callbackScope: this,
      loop: true
    });
    
    // Store the timer on the sprite for cleanup later
    sprite.glitchTimer = glitchTimer;
  }

  cleanup() {
    // Stop audio
    if (this.bonkBeat) {
      this.bonkBeat.stop();
    }
    
    // Remove keyboard bindings
    if (this.keyA) this.scene.input.keyboard.removeKey('A');
    if (this.keyS) this.scene.input.keyboard.removeKey('S');
    if (this.keyD) this.scene.input.keyboard.removeKey('D');
    if (this.keyF) this.scene.input.keyboard.removeKey('F');
    if (this.keyLeft) this.scene.input.keyboard.removeKey('LEFT');
    if (this.keyRight) this.scene.input.keyboard.removeKey('RIGHT');
    if (this.keyUp) this.scene.input.keyboard.removeKey('UP');
    if (this.keyDown) this.scene.input.keyboard.removeKey('DOWN');
    if (this.escapeKey) this.scene.input.keyboard.removeKey('ESC');
    
    // Remove event listeners
    this.scene.input.keyboard.off('keydown-ESC');
    
    // Cancel update event
    if (this.updateEvent) {
      this.updateEvent.remove();
      this.updateEvent = null;
    }
    
    // Clean up glitch timers
    if (this.notes) {
      this.notes.forEach(note => {
        if (note.sprite && note.sprite.glitchTimer) {
          note.sprite.glitchTimer.remove();
        }
      });
    }
    
    // Destroy container and contents
    if (this.gameContainer) {
      this.gameContainer.destroy();
    }
    
    this.isActive = false;
    this.touchActive = false;
    this.gamepadButtonsState = [false, false, false, false];
  }
}