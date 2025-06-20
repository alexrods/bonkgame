import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';
import { KillCounter } from './KillCounter.js';
import { MoneyCounter } from './MoneyCounter.js';
import { BonkCounter } from './BonkCounter.js';

export class GameUI {
  constructor(scene) {
    this.scene = scene;
    this.killCount = 0;
    this.money = 0;
    this.highScore = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.killCountText = null;
    this.moneyText = null;
    this.bonkText = null;
    this.gameAccountText = null;
    this.highScoreText = null;
    this.accuracyText = null;
    this.killCounter = null;
    this.moneyCounter = null;
    this.bonkCounter = null;
    // Removed accuracyMeter as requested
  }

  init() {
    this.killCount = 0;
    this.money = 0; // ZERO. NADA. NULL. Welcome to the Bonk Games.
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.createGameDisplay();
  }

  createGameDisplay() {
    // Calculate responsive font size
    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;
    let textFontSize = Math.max(14, Math.floor(screenWidth * 0.025)); // 2.5% of screen width, minimum 14px
    
    if (this.scene.isMultiplayer) {
      // Use same y-coordinate as ammo display for alignment
      const counterX = Math.max(120, screenWidth * 0.15); // 15% of screen width from left, minimum 120px

      // Check if we're in portrait mode
      const isPortrait = this.scene.registry.get('isPortrait');

      // Initialize the digital kill counter display with responsive positioning at the top
      // Position the counter at the same vertical position (25px) as the AmmoDisplay for perfect alignment
      this.killCounter = new KillCounter(this.scene, counterX, 25);
      this.killCounter.updateKillCount(0);

      // In portrait mode, immediately hide the counters until they change
      if (isPortrait) {
        // Hide the entire container instead of just segments
        if (this.killCounter.container) {
          this.killCounter.container.setVisible(false);
        } else {
          this.killCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(false)));
        }
      }
      // Create hidden kill count text object for compatibility but position it off-screen
      this.killCountText = this.scene.add.text(
        -1000,
        -1000,
        'Kills: 0',
        { fontSize: `${textFontSize}px`, fill: '#fff' }
      );
      this.killCountText.setAlpha(0); // Hide the text version completely

      return;
    }

    // Check if we're in the tutorial scene
    const isTutorialScene = this.scene.constructor.name === 'TutorialScene';
    
    if (!isTutorialScene) {
      // Calculate position for bottom right alignment with padding
      const rightPadding = 10;
      const bottomPadding = 10;
      const lineSpacing = 30;
      
      // Use same y-coordinate as ammo display for alignment
      const counterX = Math.max(120, screenWidth * 0.15); // 15% of screen width from left, minimum 120px
      const counterYBase = 50; // Same y-coordinate as AmmoDisplay to align perfectly
      const counterSpacing = Math.max(35, screenHeight * 0.05); // 5% of screen height between counters, minimum 35px
      
      // Check if we're in portrait mode
      const isPortrait = this.scene.registry.get('isPortrait');
      
      // Initialize the digital kill counter display with responsive positioning at the top
      // Position the counter at the same vertical position (25px) as the AmmoDisplay for perfect alignment
      this.killCounter = new KillCounter(this.scene, counterX, 25);
      this.killCounter.updateKillCount(0);
      
      // In portrait mode, immediately hide the counters until they change
      if (isPortrait) {
        // Hide the entire container instead of just segments
        if (this.killCounter.container) {
          this.killCounter.container.setVisible(false);
        } else {
          this.killCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(false)));
        }
      }
      
      // Position money counter below kill counter with responsive spacing
      this.moneyCounter = new MoneyCounter(this.scene, counterX, 25 + counterSpacing + 10);
      this.moneyCounter.updateMoney(0.00);

      // In portrait mode, immediately hide the money counter until it changes
      if (isPortrait) {
        // Hide the entire container instead of just segments
        if (this.moneyCounter.container) {
          this.moneyCounter.container.setVisible(false);
        } else {
          this.moneyCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(false)));
          this.moneyCounter.decimalPoints.forEach(point => point.setVisible(false));
        }
      }
      
      // Position BONK counter below money counter with responsive spacing
      this.bonkCounter = new BonkCounter(this.scene, counterX, 25 + (counterSpacing * 2) + 20);
      
      // Always start with 0 BONK in the arena
      let arenaBonkBalance = 0;
      
      // Initialize arena account to 0 if available
      if (this.scene.playerAccount && this.scene.playerAccount.arenaBonkAccount) {
        // Make sure arena account is initialized with 0
        if (typeof this.scene.playerAccount.arenaBonkAccount.init === 'function') {
          this.scene.playerAccount.arenaBonkAccount.init();
        }
        // Force set the balance to 0
        if (typeof this.scene.playerAccount.arenaBonkAccount.setBonkBalance === 'function') {
          this.scene.playerAccount.arenaBonkAccount.setBonkBalance(0);
        }
        console.log(`GameUI: Initialized arena BONK balance to 0`);
      }
      
      // Always update counter with 0 balance at start
      this.bonkCounter.updateBonkCount(0);
      
      // In portrait mode, immediately hide the bonk counter until it changes
      if (isPortrait) {
        // Hide the entire container instead of just segments
        if (this.bonkCounter.container) {
          this.bonkCounter.container.setVisible(false);
        } else {
          this.bonkCounter.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(false)));
          this.bonkCounter.decimalPoints.forEach(point => point.setVisible(false));
        }
      }
      
      // No accuracy meter - removed as requested
      
      // Create hidden kill count text object for compatibility but position it off-screen
      this.killCountText = this.scene.add.text(
        -1000, 
        -1000, 
        'Kills: 0', 
        { fontSize: `${textFontSize}px`, fill: '#fff' }
      );
      this.killCountText.setAlpha(0); // Hide the text version completely
      
      // Create hidden text elements for all UI that would be in bottom right
      // All these UI elements are now placed off-screen
      
      // Create hidden money text
      this.moneyText = this.scene.add.text(
        -1000, 
        -1000, 
        `💵 Arena: $${this.money.toFixed(2)}`, 
        { fontSize: `${textFontSize}px`, fill: '#00ff00' }
      );
      this.moneyText.setAlpha(0);
      
      // Get initial BONK balance from player account if available
      let bonkBalance = 0;
      if (this.scene.playerAccount) {
        bonkBalance = this.scene.playerAccount.getBonkBalance();
      }
      
      // Create hidden BONK text
      this.bonkText = this.scene.add.text(
        -1000, 
        -1000, 
        `🪙 BONK: ${bonkBalance}`, 
        { fontSize: `${textFontSize}px`, fill: '#ffe234' }
      );
      this.bonkText.setAlpha(0);
      
      // Hidden account balance
      this.gameAccountText = this.scene.add.text(
        -1000, 
        -1000, 
        '', 
        { fontSize: `${textFontSize}px`, fill: '#00ffff' }
      );
      
      // Hidden accuracy text
      this.accuracyText = this.scene.add.text(
        -1000, 
        -1000, 
        'Accuracy: 0%', 
        { fontSize: `${textFontSize}px`, fill: '#fff' }
      );
      this.accuracyText.setAlpha(0);
      
      // Hidden high score text
      let highScoreFontSize = Math.max(12, Math.floor(screenWidth * 0.02)); 
      this.highScoreText = this.scene.add.text(
        -1000, 
        -1000, 
        'High Score: $0', 
        { fontSize: `${highScoreFontSize}px`, fill: '#ffcc00' }
      );
      this.highScoreText.setAlpha(0);
      
      // Listen for game account and BONK balance updates
      if (this.scene.events) {
        this.scene.events.on('gameAccountUpdated', this.updateGameAccountDisplay, this);
        this.scene.events.on('bonkBalanceUpdated', this.updateBonkDisplay, this);
      }
    } else {
      // In tutorial, create dummy text objects that aren't visible
      // This prevents errors when other methods try to access these text objects
      this.killCountText = this.scene.add.text(-1000, -1000, '');
      this.moneyText = this.scene.add.text(-1000, -1000, '');
      this.bonkText = this.scene.add.text(-1000, -1000, '');
      this.gameAccountText = this.scene.add.text(-1000, -1000, '');
      this.accuracyText = this.scene.add.text(-1000, -1000, '');
      this.highScoreText = this.scene.add.text(-1000, -1000, '');
    }
  }
  

  updateKillCount() {
    // Increment the kill count when an enemy is fully destroyed
    this.killCount += 1;
    
    // Update the text-based kill count (kept for compatibility but invisible)
    this.killCountText.setText('Kills: ' + this.killCount);
    
    // Update the digital display kill counter if it exists
    if (this.killCounter) {
      this.killCounter.updateKillCount(this.killCount);
    } else {
      // Create the kill counter if it doesn't exist yet
      this.killCounter = new KillCounter(this.scene, 120, 25);
      this.killCounter.updateKillCount(this.killCount);
    }
    
    return this.killCount;
  }
  
  updateMoney(amount) {
    // Capture the starting balance for debugging
    const startingBalance = this.money;
    
    // Update the money value with the amount
    this.money += amount;
    
    // Ensure we don't have negative money
    if (this.money < 0) {
      console.warn(`Money would go negative (${this.money}), clamping to 0`);
      this.money = 0;
    }
    
    // Update hidden text for compatibility
    if (this.moneyText) {
      this.moneyText.setText('💵 Arena: $' + this.money.toFixed(2));
    }
    
    // Update the digital money counter
    if (this.moneyCounter) {
      this.moneyCounter.updateMoney(this.money);
    } else {
      // Create the money counter if it doesn't exist yet
      const bgHeight = 50 * 1.5 * 0.5;
      const padding = 5;
      this.moneyCounter = new MoneyCounter(this.scene, 120, 50 + bgHeight + padding);
      this.moneyCounter.updateMoney(this.money);
    }
    
    // Check if current money exceeds high score
    if (this.money > this.highScore) {
      this.setHighScore(this.money);
    }
    
    // Log detailed info about money changes for debugging
    console.log(`GameUI.updateMoney: ${startingBalance} + ${amount} = ${this.money}`);
    
    // Emit an event so other components (like drone wheel) can update
    this.scene.events.emit('moneyUpdated', this.money);
    
    // Return the new balance so callers can verify the update worked
    return this.money;
  }
  
  // Get game account balance
  getGameAccountBalance() {
    if (this.scene.playerAccount) {
      return this.scene.playerAccount.getGameAccountBalance();
    }
    return 0;
  }
  
  // Update game account display
  updateGameAccountDisplay(newBalance) {
    // Update hidden text for compatibility
    if (this.gameAccountText) {
      this.gameAccountText.setText('💰 Account: $' + newBalance.toFixed(2));
    }
  }
  
  // Update BONK display
  updateBonkDisplay(newBalance) {
    console.log(`GameUI.updateBonkDisplay called with balance: ${newBalance}`);
    
    // FIXED: Only use arena-specific bonk balance, not the global account balance
    let validBalance = 0;
    
    // First priority: Try to get the arena-specific balance directly
    if (this.scene.playerAccount && this.scene.playerAccount.arenaBonkAccount) {
      // Get ONLY the arena balance (not the global balance)
      validBalance = this.scene.playerAccount.arenaBonkAccount.getBonkBalance();
      console.log('Using arena-specific BONK balance:', validBalance);
    } 
    // Second priority: Use the parameter if it's valid and we couldn't get arena balance
    else if (typeof newBalance === 'number' && !isNaN(newBalance)) {
      validBalance = newBalance;
      console.log('Using provided balance parameter:', validBalance);
    }
    // If all else fails, use 0
    else {
      validBalance = 0;
      console.log('Using default balance of 0');
    }
    
    // Update hidden text for compatibility
    if (this.bonkText && this.bonkText.scene) {
      try {
        this.bonkText.setText('🪙 BONK: ' + validBalance);
        console.log('BONK text updated successfully');
      } catch (error) {
        console.warn('Error updating BONK text:', error.message);
      }
    } else {
      console.warn('bonkText element not found or destroyed in UI');
    }
    
    // Update the digital bonk counter
    if (this.bonkCounter) {
      // BONK is typically shown as a whole number, but our display includes decimals
      // Parse as float to handle both formats
      const bonkAmount = parseFloat(validBalance);
      this.bonkCounter.updateBonkCount(bonkAmount);
    } else {
      // Create the bonk counter if it doesn't exist yet
      const bgHeight = 50 * 1.5 * 0.5;
      const padding = 5;
      this.bonkCounter = new BonkCounter(this.scene, 120, 50 + (bgHeight + padding) * 2);
      this.bonkCounter.updateBonkCount(parseFloat(validBalance));
    }
  }
  
  // Get current money amount
  getMoney() {
    // If we have a money counter, make sure it's updated with the current amount
    if (this.moneyCounter) {
      this.moneyCounter.updateMoney(this.money);
    }
    return this.money;
  }
  
  // Check if this is a tutorial scene
  isTutorialScene() {
    return this.scene.key === 'TutorialScene' || this.scene.constructor.name === 'TutorialScene';
  }
  
  trackShot(hit = false) {
    this.shotsFired++;
    if (hit) {
      this.shotsHit++;
    }
    this.updateAccuracy();
  }
  
  // Track when a bullet hits an enemy
  trackHit() {
    this.shotsHit++;
    this.updateAccuracy();
  }
  
  updateAccuracy() {
    // Calculate accuracy based on kills / shots fired
    const accuracy = this.shotsFired > 0 ? Math.round((this.killCount / this.shotsFired) * 100) : 0;
    
    // Update the text version for compatibility, even though it's hidden
    if (this.accuracyText) {
      this.accuracyText.setText('Accuracy: ' + accuracy + '%');
    }
    
    // No accuracy meter - removed as requested
    
    return accuracy;
  }
  
  setHighScore(score) {
    if (score > this.highScore) {
      this.highScore = score;
      // Update hidden text for compatibility
      if (this.highScoreText) {
        this.highScoreText.setText('High Score: $' + this.highScore.toFixed(2));
      }
    }
  }

  getScore() {
    return this.money; // Now using money as the score
  }
  
  getHighScore() {
    return this.highScore;
  }
  
  getAccuracy() {
    const accuracy = this.shotsFired > 0 ? (this.killCount / this.shotsFired) * 100 : 0;
    
    // Keep the accuracy meter updated when accuracy is requested
    if (this.accuracyMeter) {
      this.accuracyMeter.updateAccuracy(accuracy);
    }
    
    return accuracy;
  }
  
  getKillCount() {
    // If we have a kill counter, make sure it's updated with the current count
    if (this.killCounter) {
      this.killCounter.updateKillCount(this.killCount);
    }
    return this.killCount;
  }
  
  // Método para guardar el killCount cuando se inicia la escena de game over
  saveKillCountOnGameOver() {
    try {
      const gameId = this.scene.key || 'arenaGame';
      // Guardamos el contador de kills actual
      const killData = {
        killCount: this.killCount,
        timestamp: Date.now()
      };
      localStorage.setItem(`bonkgames_lastKills_${gameId}`, JSON.stringify(killData));
      console.log(`Kill count guardado al game over: ${this.killCount} kills`);
      return true;
    } catch (error) {
      console.warn('Error al guardar killCount en localStorage:', error);
      return false;
    }
  }
}