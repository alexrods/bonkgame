import { GAME_WIDTH, GAME_HEIGHT, BULLET_TIME_SLOWDOWN } from '../../config.js';
import { BonkRhythmGame } from './BonkRhythmGame.js';
import { DepositWithdrawPrompt } from './DepositWithdrawPrompt.js';
import { WeaponsMenu } from './WeaponsMenu.js';

export class DroneWheel {
  constructor(scene) {
    this.scene = scene;
    this.isVisible = false;
    this.wheelContainer = null;
    this.centerX = GAME_WIDTH / 2;
    this.centerY = GAME_HEIGHT / 2;
    this.radius = 120;
    this.selectedIndex = -1; // No option preselected by default
    this.upgradeOptions = [];
    this.selectedSegment = null;
    this.selectionCursor = null;
    this.rhythmGame = null;
    this.depositWithdrawPrompt = null;
    this.weaponsMenu = null;
    this.enabled = true; // Flag to control whether the wheel can be shown

    console.log("DroneWheel constructor called");

    // Define available upgrades with costs and levels
    this.availableUpgrades = [
      {
        type: 'speed',
        name: 'Speed Boots',
        sprite: 'speed',
        color: 0x00ffff,
        levels: [
          { level: 1, cost: 25, effect: 1.1, description: '+10% Speed' },
          { level: 2, cost: 50, effect: 1.2, description: '+20% Speed' },
          { level: 3, cost: 100, effect: 1.3, description: '+30% Speed' },
          { level: 4, cost: 200, effect: 1.4, description: '+40% Speed' }
        ]
      },
      {
        type: 'armor',
        name: 'Shield',
        emoji: null,
        sprite: 'shield',
        color: 0xffff00,
        levels: [
          { level: 1, cost: 100, effect: 1, description: '+1 HP (max 10)' }
        ]
      },
      {
        type: 'magazine',
        name: 'Ammo',
        emoji: null,
        sprite: 'bullets',
        color: 0x00ff00,
        levels: [
          { level: 1, cost: 20, effect: 4, description: '4 Magazines' }
        ]
      },
      {
        type: 'emote',
        name: 'Emote',
        emoji: '😊',
        color: 0xcc6600,
        levels: [
          { level: 1, cost: 10, effect: 1, description: 'Express yourself' }
        ]
      }
    ];

    // Store upgrade level progress
    this.currentUpgradeLevels = {
      speed: 0,
      fireRate: 0,
      armor: 0,
      magazine: 0,
      bulletTime: 0,
      emote: 0,
    };
    // Disable drone wheel until the game starts (after SURVIVE)
    this.enabled = false;
  }

  init() {
    // Create the main container for the wheel - position will be updated in show()
    this.wheelContainer = this.scene.add.container(0, 0);
    this.wheelContainer.setDepth(1000); // Set high depth to appear above everything
    this.wheelContainer.setAlpha(0); // Initially hidden

    // Create the background panel - darker and slightly transparent
    const background = this.scene.add.circle(0, 0, this.radius + 40, 0x000000, 0.7);
    this.wheelContainer.add(background);

    // Create segments for each upgrade
    this.createUpgradeSegments();

    // Create a selection cursor
    this.createSelectionCursor();

    // Add a title with better styling
    const title = this.scene.add.text(0, -this.radius - 25, 'DRONE UPGRADES', {
      fontFamily: 'Tektur, Arial',
      fontSize: '20px',
      color: '#00ffff',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3
    });
    title.setOrigin(0.5);
    this.wheelContainer.add(title);

    // Add credit display with improved styling
    this.creditText = this.scene.add.text(0, this.radius + 20, 'TOKENS: $0', {
      fontFamily: 'Tektur, Arial',
      fontSize: '16px',
      color: '#ffff00',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.creditText.setOrigin(0.5);
    this.wheelContainer.add(this.creditText);

    // Add description text with improved styling
    this.descriptionText = this.scene.add.text(0, this.radius + 45, '', {
      fontFamily: 'Tektur, Arial',
      fontSize: '14px',
      color: '#ffffff',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.descriptionText.setOrigin(0.5);
    this.wheelContainer.add(this.descriptionText);

    // Initialize rhythm game
    this.rhythmGame = new BonkRhythmGame(this.scene);
    this.rhythmGame.preload();

    // Initialize deposit/withdraw prompt (initially null in tutorial mode)
    if (this.scene.scene.key !== 'TutorialScene') {
      this.depositWithdrawPrompt = new DepositWithdrawPrompt(this.scene);
      this.depositWithdrawPrompt.create();
    } else {
      // In tutorial mode, don't create the deposit/withdraw prompt yet
      this.depositWithdrawPrompt = null;
    }

    // Initialize weapons menu
    this.weaponsMenu = new WeaponsMenu(this.scene);

    // Initial setup
    this.updateSelection();
  }

  createUpgradeSegments() {
    const segmentCount = this.availableUpgrades.length;
    console.log(`Creating wheel with ${segmentCount} upgrade options`);
    const segmentAngle = (Math.PI * 2) / segmentCount;

    this.upgradeOptions = [];

    // Load the drone wheel image
    const wheelImage = this.scene.add.image(0, 0, 'dronewheel_formultiplayer');
    wheelImage.setAlpha(0.9);
    wheelImage.setScale(0.45); // 20% larger than 0.375
    // wheelImage.setAngle(22.5); // Rotate 22.5 degrees clockwise
    this.wheelContainer.add(wheelImage);

    // Create segments for each upgrade
    for (let i = 0; i < segmentCount; i++) {
      const angle = i * segmentAngle;
      const upgrade = this.availableUpgrades[i];
      console.log(`Creating segment ${i}: ${upgrade.name} (${upgrade.type})`);
      // Move icons inward by 20% of the radius
      const adjustedRadius = this.radius * 0.8;
      const x = Math.cos(angle) * adjustedRadius;
      const y = Math.sin(angle) * adjustedRadius;

      // Create segment background (smaller and more transparent with the wheel image behind it)
      const segment = this.scene.add.circle(x, y, 28, upgrade.color, 0.25);
      this.wheelContainer.add(segment);

      // Add icon (either emoji or sprite)
      let icon;
      if (upgrade.sprite) {
        // For shield, position it slightly further from center
        let posX = x;
        let posY = y;

        if (upgrade.type === 'armor') {
          posY = y + 2;
        } else if (upgrade.type === 'speed') {
          posY = y + 5;
        } else if (upgrade.type === 'magazine') {
          posX = x - 1;
          posY = y + 1;
        }

        // Use sprite image
        icon = this.scene.add.image(posX, posY, upgrade.sprite);
        icon.setScale(0.45);
      } else {
        // Use emoji as fallback
        icon = this.scene.add.text(x, y, upgrade.emoji, {
          fontSize: '24px'
        });
      }
      icon.setOrigin(0.5);
      this.wheelContainer.add(icon);

      // Add price display aligned with center of wheel
      let levelText;

      // Calculate position that points to center with specified distance
      const angleToCenter = Math.atan2(y, x) + Math.PI; // Add PI to point toward center
      const textDistance = 38; // Set to exactly 38px as requested
      const textX = x + Math.cos(angleToCenter) * textDistance;
      const textY = y + Math.sin(angleToCenter) * textDistance;

      // Reduce font size by 25% from the increased size (21px * 0.75 = ~16px)
      const fontSize = '16px';

      if (upgrade.type === 'withdraw') {
        levelText = this.scene.add.text(textX, textY, '', {
          fontFamily: 'Arial',
          fontSize: fontSize,
          color: '#ffffff'
        });
      } else if (upgrade.type === 'robot') {
        levelText = this.scene.add.text(textX, textY, '100🅒', {
          fontFamily: 'Arial',
          fontSize: fontSize,
          color: '#ffffff'
        });
      } else {
        levelText = this.scene.add.text(textX, textY, upgrade.levels[0].cost + '🅒', {
          fontFamily: 'Arial',
          fontSize: fontSize,
          color: '#ffffff'
        });
      }
      levelText.setOrigin(0.5);
      this.wheelContainer.add(levelText);

      // Store references
      this.upgradeOptions.push({
        segment,
        icon,
        levelText,
        type: upgrade.type,
        name: upgrade.name,
        levels: upgrade.levels,
        index: i
      });
    }

    console.log(`Total upgrade options created: ${this.upgradeOptions.length}`);
  }

  createSelectionCursor() {
    this.selectionCursor = this.scene.add.graphics();
    this.wheelContainer.add(this.selectionCursor);
    this.updateSelectionCursor();
  }

  updateSelectionCursor() {
    if (!this.selectionCursor) return;

    this.selectionCursor.clear();

    // If no selection (-1) or no options, don't draw cursor
    if (this.selectedIndex === -1 || this.upgradeOptions.length === 0) return;

    const selected = this.upgradeOptions[this.selectedIndex];
    const segment = selected.segment;

    // Draw a more attractive glowing ring around the selected segment
    // First draw a slightly larger outer glow
    this.selectionCursor.lineStyle(5, 0x00ffff, 0.3);
    this.selectionCursor.strokeCircle(segment.x, segment.y, 42);

    // Then draw a bright inner ring
    this.selectionCursor.lineStyle(3, 0x00ffff, 0.8);
    this.selectionCursor.strokeCircle(segment.x, segment.y, 38);

    // Add a pulsing animation to the selection cursor
    if (!this.pulseAnimation) {
      this.pulseAnimation = this.scene.tweens.add({
        targets: this.selectionCursor,
        alpha: { from: 0.8, to: 1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  updateSelection() {
    console.log(`updateSelection with selectedIndex=${this.selectedIndex}, options length=${this.upgradeOptions.length}`);

    // Reset all segments to default appearance
    this.upgradeOptions.forEach(option => {
      option.segment.setAlpha(0.3);
    });

    // If no selection (-1), don't highlight any segment or show description
    if (this.selectedIndex === -1) {
      // Clear description text
      this.descriptionText.setText('Use arrow keys to select an upgrade');

      // Update selection cursor (will hide it)
      this.updateSelectionCursor();
      return;
    }

    // Safety check to ensure valid selected index
    if (this.selectedIndex < 0 || this.selectedIndex >= this.upgradeOptions.length) {
      console.error(`Invalid selectedIndex: ${this.selectedIndex}. Resetting to 0`);
      this.selectedIndex = 0;
    }

    // Highlight the selected segment
    const selected = this.upgradeOptions[this.selectedIndex];
    if (!selected) {
      console.error(`No option found at index ${this.selectedIndex}`);
      return;
    }
    selected.segment.setAlpha(0.8);

    // Update selection cursor
    this.updateSelectionCursor();

    // Update description text
    const upgrade = this.availableUpgrades[this.selectedIndex];
    if (!upgrade) {
      console.error(`No upgrade found at index ${this.selectedIndex}`);
      return;
    }

    // Special case for each upgrade type
    if (upgrade.type === 'withdraw') {
      this.descriptionText.setText(
        `${upgrade.name}\nHack Network\nEarn BONK Tokens`
      );
    } else if (upgrade.type === 'armor') {
      const shieldCost = upgrade.levels[0].cost;
      this.descriptionText.setText(
        `${upgrade.name}\n${upgrade.levels[0].description}\n$${shieldCost} per shield`
      );
    } else if (upgrade.type === 'magazine') {
      const magazineCost = upgrade.levels[0].cost;
      this.descriptionText.setText(
        `${upgrade.name}\n${upgrade.levels[0].description}\n$${magazineCost}`
      );
    } else if (upgrade.type === 'bulletTime') {
      const stimCost = upgrade.levels[0].cost;
      this.descriptionText.setText(
        `${upgrade.name}\n${upgrade.levels[0].description}\n$${stimCost}`
      );
    } else if (upgrade.type === 'robot') {
      const robotCost = upgrade.levels[0].cost;
      this.descriptionText.setText(
        `${upgrade.name}\n${upgrade.levels[0].description}\n$${robotCost}`
      );
    } else if (upgrade.type === 'fireRate') {
      this.descriptionText.setText(
        `${upgrade.name}\n${upgrade.levels[0].description}\n$${upgrade.levels[0].cost}`
      );
    } else if (upgrade.type === 'shotgun') {
      this.descriptionText.setText(
        `${upgrade.name}\n${upgrade.levels[0].description}\n$${upgrade.levels[0].cost}`
      );
    } else if (upgrade.type === 'speed') {
      // Speed boots have multiple levels
      const currentLevel = this.currentUpgradeLevels[upgrade.type];
      const nextLevel = currentLevel + 1;

      if (nextLevel <= upgrade.levels.length) {
        const nextUpgrade = upgrade.levels[nextLevel - 1];
        this.descriptionText.setText(
          `${upgrade.name} Lvl ${nextLevel}\n${nextUpgrade.description}\n$${nextUpgrade.cost}`
        );
      } else {
        this.descriptionText.setText(`${upgrade.name}\nMAX LEVEL REACHED`);
      }
    }
  }

  /**
   * Gets the total available balance (arena + game account)
   * @returns {Object} Object with gameBalance, arenaBalance, and totalBalance
   */
  getTotalBalance() {
    let gameBalance = 0;
    let arenaBalance = 0;

    // Get game account balance
    if (this.scene.playerAccount) {
      gameBalance = this.scene.playerAccount.getGameAccountBalance();
    }

    // Get arena balance
    if (this.scene.ui && typeof this.scene.ui.getMoney === 'function') {
      arenaBalance = this.scene.ui.getMoney();
    } else if (this.scene.ui && typeof this.scene.ui.money === 'number') {
      arenaBalance = this.scene.ui.money;
    }

    // Calculate total available balance
    const totalBalance = gameBalance + arenaBalance;

    return { gameBalance, arenaBalance, totalBalance };
  }

  show() {
    // Log for debugging
    console.log('DroneWheel show() - enabled:', this.enabled, 'isTutorial:', this.scene.isTutorial);

    // Update credit text with the latest amount
    this.updateCredits();

    // Don't show if it's already visible
    if (this.isVisible) return;

    this.isVisible = true;

    // Position the wheel relative to the camera center, not the world center
    const camera = this.scene.cameras.main;
    const centerX = camera.scrollX + camera.width / 2;
    const centerY = camera.scrollY + camera.height / 2;
    this.wheelContainer.setPosition(centerX, centerY);

    // Force update credit text with the latest amount
    this.updateCredits();

    // Log wheel state for debugging
    console.log(`Opening drone wheel with ${this.upgradeOptions.length} upgrade options:`);
    this.upgradeOptions.forEach((option, index) => {
      console.log(`Option ${index}: ${option.name} (${option.type})`);
    });

    // Start with no selection when opened by keyboard
    this.selectedIndex = -1;

    // Obtener el balance total y actualizarlo en el texto
    const { gameBalance, arenaBalance, totalBalance } = this.getTotalBalance();

    // Log para debugging
    console.log(`Current balances - Game: $${gameBalance.toFixed(2)}, Arena: $${arenaBalance.toFixed(2)}, Total: $${totalBalance.toFixed(2)}`);

    // Actualizar el saldo en la UI
    this.updateCredits();

    // Reset scale to prepare for animation
    this.wheelContainer.setScale(0.7);

    // Enhanced opening animation without rotation
    this.scene.tweens.add({
      targets: this.wheelContainer,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    // Update selection to ensure cursor is visible
    this.updateSelection();
  }

  hide() {
    // Don't hide if it's already hidden
    if (!this.isVisible) return;

    this.isVisible = false;

    // Stop the pulse animation if it exists
    if (this.pulseAnimation) {
      this.pulseAnimation.stop();
      this.pulseAnimation = null;
    }

    // Enhanced closing animation
    this.scene.tweens.add({
      targets: this.wheelContainer,
      alpha: 0,
      scale: 0.8,
      duration: 250,
      ease: 'Back.easeIn'
    });
  }

  // Clean up resources - call this when shutting down or changing scenes
  shutdown() {
    // Clean up rhythm game if it exists
    if (this.rhythmGame) {
      this.rhythmGame.cleanup();
    }

    // Clean up deposit/withdraw prompt if it exists
    if (this.depositWithdrawPrompt) {
      this.depositWithdrawPrompt.cleanup();
    }

    // Clean up weapons menu if it exists
    if (this.weaponsMenu) {
      this.weaponsMenu.cleanup();
    }
  }

  // Enable the DroneWheel to allow showing it
  enable() {
    if (!this.enabled) {
      console.log('DroneWheel enabled');
      this.enabled = true;
    }
  }

  // Disable the DroneWheel to prevent showing it
  disable() {
    if (this.enabled) {
      console.log('DroneWheel disabled');
      this.enabled = false;

      // If currently visible, hide it
      if (this.isVisible) {
        this.hide();
      }
    }
  }

  selectNext() {
    console.log(`Before selectNext: selectedIndex=${this.selectedIndex}, upgradeOptions.length=${this.upgradeOptions.length}`);
    // If no selection, start at index 0
    if (this.selectedIndex === -1) {
      this.selectedIndex = 0;
    } else {
      this.selectedIndex = (this.selectedIndex + 1) % this.upgradeOptions.length;
    }
    console.log(`After selectNext: new selectedIndex=${this.selectedIndex}`);
    this.updateSelection();
  }

  selectPrevious() {
    console.log(`Before selectPrevious: selectedIndex=${this.selectedIndex}, upgradeOptions.length=${this.upgradeOptions.length}`);
    // If no selection, start at last index
    if (this.selectedIndex === -1) {
      this.selectedIndex = this.upgradeOptions.length - 1;
    } else {
      this.selectedIndex = (this.selectedIndex - 1 + this.upgradeOptions.length) % this.upgradeOptions.length;
    }
    console.log(`After selectPrevious: new selectedIndex=${this.selectedIndex}`);
    this.updateSelection();
  }

  confirmSelection() {
    if (!this.isVisible) return;

    // If no option is selected, do nothing
    if (this.selectedIndex === -1) return false;

    const upgrade = this.availableUpgrades[this.selectedIndex];
    let upgradeCost = 0;
    let upgradeLevel = 1;
    let upgradeEffect = 0;
    let upgradeDuration = 0;

    // Handle different upgrade types differently
    if (upgrade.type === 'speed') {
      // Speed boots have multiple levels
      const currentLevel = this.currentUpgradeLevels[upgrade.type];
      const nextLevel = currentLevel + 1;

      // Check if there's a next level available
      if (nextLevel <= upgrade.levels.length) {
        const nextUpgrade = upgrade.levels[nextLevel - 1];
        upgradeCost = nextUpgrade.cost;
        upgradeLevel = nextLevel;
        upgradeEffect = nextUpgrade.effect;

        // Get duration from droneManager if available
        const droneUpgrade = this.scene.droneManager.upgradeTypes.find(u => u.type === upgrade.type);
        if (droneUpgrade && droneUpgrade.levels && droneUpgrade.levels[0]) {
          upgradeDuration = droneUpgrade.levels[0].duration;
        } else {
          upgradeDuration = 10000; // Default duration
        }
      } else {
        // Already at max level
        console.log(`Purchase failed: Already at max level (${currentLevel}/${upgrade.levels.length})`);
        this.flashDescriptionText();
        return false;
      }
    } else if (upgrade.type === 'armor') {
      // Shield gives +1 HP, up to 10 shields
      upgradeCost = upgrade.levels[0].cost;
      upgradeLevel = 1;
      upgradeEffect = upgrade.levels[0].effect;
      upgradeDuration = 0; // Permanent effect

      // Maximum of 10 shields at a time
      if (this.currentUpgradeLevels[upgrade.type] >= 10) {
        console.log("Purchase failed: Maximum shields (10) reached");
        this.flashDescriptionText();
        return false;
      }
    } else {
      // Handle other upgrades (magazine, bulletTime, etc.)
      upgradeCost = upgrade.levels[0].cost;
      upgradeLevel = 1;
      upgradeEffect = upgrade.levels[0].effect;

      // Get duration from droneManager if available
      const droneUpgrade = this.scene.droneManager.upgradeTypes.find(u => u.type === upgrade.type);
      if (droneUpgrade && droneUpgrade.levels && droneUpgrade.levels[0]) {
        upgradeDuration = droneUpgrade.levels[0].duration;
      } else {
        upgradeDuration = 10000; // Default duration
      }
    }

    // Obtener saldo de ambas cuentas
    const gameAccountBalance = this.scene.playerAccount.getGameAccountBalance();
    const arenaBalance = this.scene.ui && typeof this.scene.ui.getMoney === 'function' ? this.scene.ui.getMoney() : 0;

    console.log(`Attempting to purchase ${upgrade.name} (${upgrade.type})`);
    console.log(`Arena balance: $${arenaBalance.toFixed(2)}, Game account balance: $${gameAccountBalance.toFixed(2)}, Upgrade cost: $${upgradeCost}`);

    // Verificar si hay suficiente dinero combinando ambas cuentas
    const totalBalance = arenaBalance + gameAccountBalance;

    if (totalBalance >= upgradeCost) {
      // Primero usar el saldo de arena hasta donde alcance
      let remainingCost = upgradeCost;
      let arenaSpent = 0;
      let gameAccountSpent = 0;

      if (arenaBalance > 0) {
        arenaSpent = Math.min(arenaBalance, remainingCost);
        remainingCost -= arenaSpent;

        // Actualizar el balance de arena
        if (arenaSpent > 0 && this.scene.ui) {
          // Primero obtener el balance actual para evitar race conditions
          const currentArenaBalance = this.scene.ui.getMoney ? this.scene.ui.getMoney() : this.scene.ui.money || 0;
          const newArenaBalance = currentArenaBalance - arenaSpent;

          console.log(`Using ${arenaSpent.toFixed(2)} from arena balance. New arena balance: $${newArenaBalance.toFixed(2)}`);

          // Actualizar usando métodos UI
          if (typeof this.scene.ui.updateMoney === 'function') {
            this.scene.ui.updateMoney(-arenaSpent);
          } else {
            // Actualización directa si no hay método updateMoney
            this.scene.ui.money = newArenaBalance;

            // Actualizar texto si existe
            if (this.scene.ui.moneyText) {
              this.scene.ui.moneyText.setText("💵 Arena: $" + newArenaBalance.toFixed(2));
            }

            // Emitir eventos
            this.scene.events.emit("moneyUpdated", newArenaBalance);
            this.scene.events.emit("arenaBalanceUpdated", newArenaBalance);
          }
        }
      }

      // Si queda costo por cubrir, usar la cuenta del juego
      if (remainingCost > 0) {
        gameAccountSpent = remainingCost;

        // Actualizar el balance de la cuenta del juego
        this.scene.playerAccount.updateGameAccountBalance(-gameAccountSpent);
        console.log(`Using ${gameAccountSpent.toFixed(2)} from game account. New game account balance: $${this.scene.playerAccount.getGameAccountBalance().toFixed(2)}`);
      }

      console.log(`Purchase successful! Used: $${arenaSpent.toFixed(2)} from arena + $${gameAccountSpent.toFixed(2)} from game account = $${upgradeCost.toFixed(2)} total`);

      // Update credit display
      this.updateCredits();

      // For magazine, call drone to deliver
      if (upgrade.type === 'magazine') {
        // The effect value (4) is the number of magazines to add
        const magazinesToAdd = upgradeEffect;
        console.log(`Calling drone to deliver ${magazinesToAdd} magazines`);

        // Call drone to deliver magazines
        const nextUpgrade = {
          level: upgradeLevel,
          effect: magazinesToAdd,
          duration: 0
        };

        this.requestDroneDelivery(upgrade, nextUpgrade);

        // Hide the wheel
        this.hide();
        return true;
      }

      // For speed, update level 
      if (upgrade.type === 'speed') {
        this.currentUpgradeLevels[upgrade.type] = upgradeLevel;

        // Update price display to show next level price
        const option = this.upgradeOptions[this.selectedIndex];
        if (upgradeLevel < upgrade.levels.length) {
          const nextLevelCost = upgrade.levels[upgradeLevel].cost;
          option.levelText.setText(`${nextLevelCost}🅒`);
        } else {
          option.levelText.setText(`MAX`);
        }
      }

      // For shield, increment level (counts number of shields)
      if (upgrade.type === 'armor') {
        this.currentUpgradeLevels[upgrade.type]++;
      }

      // Special handling for direct activation upgrades
      if (upgrade.type === 'robot' || upgrade.type === 'withdraw' || upgrade.type === 'bulletTime' || upgrade.type === 'fireRate') {
        this.scene.events.emit('showFloatingText', {
          x: this.scene.playerManager.player.x,
          y: this.scene.playerManager.player.y - 50,
          text: 'Does not support on Versus Mode',
          color: '#ff0000'
        });
        this.hide();
        return false;
      } else {
        // Call drone to deliver other upgrades
        const nextUpgrade = {
          level: upgradeLevel,
          effect: upgradeEffect,
          duration: upgradeDuration
        };

        this.requestDroneDelivery(upgrade, nextUpgrade);

        // Hide the wheel
        this.hide();
      }

      return true;
    } else {
      console.log(`Purchase failed: Not enough credits. Need $${upgradeCost}, have $${totalBalance.toFixed(2)}`);
      // Show floating notification and close the wheel
      this.scene.events.emit('showFloatingText', {
        x: this.scene.playerManager.player.x,
        y: this.scene.playerManager.player.y - 50,
        text: 'NOT ENOUGH CREDITS',
        color: '#ff0000'
      });
      this.hide();
      return false;
    }
  }

  flashCreditText() {
    const originalColor = '#ffff00';
    this.creditText.setColor('#ff0000');

    this.scene.time.delayedCall(300, () => {
      this.creditText.setColor(originalColor);
    });
  }

  flashDescriptionText() {
    const originalColor = '#ffffff';
    this.descriptionText.setColor('#ff0000');

    this.scene.time.delayedCall(300, () => {
      this.descriptionText.setColor(originalColor);
    });
  }

  updateCredits() {
    if (this.creditText) {
      // Obtener el balance total usando el método centralizado
      const { totalBalance } = this.getTotalBalance();

      // Mostrar el balance total
      this.creditText.setText(`CREDITS: $${totalBalance.toFixed(2)}`);
    }
  }

  requestDroneDelivery(upgrade, levelData) {
    if (this.scene.droneManager) {
      // Find the matching upgrade type in the drone manager to get the duration
      const droneUpgrade = this.scene.droneManager.upgradeTypes.find(u => u.type === upgrade.type);
      let duration = 10000; // Default duration if not found

      // Get the duration from the drone manager's upgrade levels
      if (droneUpgrade && droneUpgrade.levels && droneUpgrade.levels[levelData.level - 1]) {
        duration = droneUpgrade.levels[levelData.level - 1].duration;
      }

      
      // Call the drone manager with all necessary parameters including duration
      this.scene.droneManager.deliverSpecificUpgrade(
        upgrade.type,
        levelData.level,
        levelData.effect,
        duration,
        0
      );

      console.log(`Requesting drone delivery: ${upgrade.type} Level ${levelData.level} (Effect: ${levelData.effect}, Duration: ${duration}ms)`);

      // Reset magazine upgrade level so it can be purchased again if it's a magazine
      if (upgrade.type === 'magazine') {
        this.currentUpgradeLevels.magazine = 0;
      }
    }
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  // New method to handle wheel navigation by direction
  selectByDirection(directionX, directionY) {
    // Don't process if wheel isn't visible
    if (!this.isVisible) return;

    console.log(`selectByDirection called with x=${directionX}, y=${directionY}`);

    // Using angle calculation to determine which segment to select
    const angle = Math.atan2(directionY, directionX);
    const degrees = (Math.atan2(directionY, directionX) * 180 / Math.PI + 360) % 360;

    // Calculate segment size based on actual number of options
    const segmentCount = this.upgradeOptions.length;
    const segmentSize = 360 / segmentCount;

    // Convert angle to segment index
    const segmentIndex = Math.floor(((degrees + (segmentSize / 2)) % 360) / segmentSize);

    console.log(`Calculated segmentIndex=${segmentIndex} from angle=${degrees.toFixed(2)}°, segmentSize=${segmentSize.toFixed(2)}°`);

    // Only update if the direction magnitude is significant
    const magnitude = Math.sqrt(directionX * directionX + directionY * directionY);
    if (magnitude > 0.3) { // Threshold to avoid accidental selection
      if (this.selectedIndex !== segmentIndex) {
        console.log(`Changing selectedIndex from ${this.selectedIndex} to ${segmentIndex}`);
        this.selectedIndex = segmentIndex;
        this.updateSelection();
      }
    } else {
      console.log(`Direction magnitude ${magnitude.toFixed(2)} too small, ignoring`);
    }
  }
}
