export class AmmoDisplay {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.scale = 1.5;
    this.maxMagazines = 10;
    this.container = null;
    this.segmentDisplays = [];
    this.magazineIndicators = [];
    this.upgradeIndicators = {};
    this.reloadTimer = null;
    this.reloadingBlinkTween = null;
    this.magazineFlashTween = null;
    this.noAmmoFlashTween = null;
    this.synchronizedFlashTween = null;
    this.init();
  }

  init() {
    this.createContainer();
    this.createBackground();
    this.createDisplays();
    this.createMagazineIndicators();
    this.createUpgradeIndicatorArea();
  }

  createContainer() {
    this.container = this.scene.add.container(this.x, this.y);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);
  }

  createBackground() {
    // Create a sleeker background with gradient-like effect
    const bgWidth = 90 * this.scale;
    const bgHeight = 50 * this.scale;
    
    // Main background
    const bg = this.scene.add.rectangle(
      0,
      0,
      bgWidth,
      bgHeight,
      0x000000,
      0.8
    );
    bg.setStrokeStyle(1, 0x444444);
    
    // Add subtle inner border for depth
    const innerBorder = this.scene.add.rectangle(
      0,
      0,
      bgWidth - 4,
      bgHeight - 4,
      0x000000,
      0
    );
    innerBorder.setStrokeStyle(1, 0x222222);
    
    this.container.add(bg);
    this.container.add(innerBorder);
    
    // Store background dimensions for positioning upgrades
    this.bgWidth = bgWidth;
    this.bgHeight = bgHeight;
  }

  createDisplays() {
    // Create two 14-segment displays at relative positions
    this.create14SegmentDisplay(-20 * this.scale, 0);
    this.create14SegmentDisplay(20 * this.scale, 0);
  }

  create14SegmentDisplay(x, y) {
    const segConfigs = [
      { dx: 0, dy: -15, w: 22, h: 3, r: 0 },          // Segment A
      { dx: 11, dy: -8, w: 3, h: 16, r: 0 },          // Segment B
      { dx: 11, dy: 8, w: 3, h: 16, r: 0 },           // Segment C
      { dx: 0, dy: 15, w: 22, h: 3, r: 0 },           // Segment D
      { dx: -11, dy: 8, w: 3, h: 16, r: 0 },          // Segment E
      { dx: -11, dy: -8, w: 3, h: 16, r: 0 },         // Segment F
      { dx: 0, dy: 0, w: 22, h: 3, r: 0 },            // Segment G - middle segment (will be added later)
      { dx: -5, dy: 0, w: 6, h: 3, r: 0.5 },          // Segment G2
      { dx: -5, dy: -8, w: 12, h: 3, r: 0.785 },      // Segment H
      { dx: 5, dy: -8, w: 12, h: 3, r: -0.785 },      // Segment I
      { dx: -5, dy: 8, w: 12, h: 3, r: -0.785 },      // Segment J
      { dx: 5, dy: 8, w: 12, h: 3, r: 0.785 },        // Segment K
      { dx: 5, dy: 0, w: 6, h: 3, r: -0.5 },          // Segment L
      { dx: 0, dy: 0, w: 4, h: 4, r: 0 }              // Segment M (dot)
    ];

    const segments = segConfigs.map(cfg => {
      const rect = this.scene.add.rectangle(
        x + cfg.dx * this.scale,
        y + cfg.dy * this.scale,
        cfg.w * this.scale,
        cfg.h * this.scale,
        0x111111
      );
      rect.setStrokeStyle(0.5, 0x000000);
      if (cfg.r) rect.setRotation(cfg.r);
      return rect;
    });
    
    // Add all segments except middle one (G) first
    for (let i = 0; i < segments.length; i++) {
      if (i !== 6) { // Skip the middle segment (G) for now
        this.container.add(segments[i]);
      }
    }
    
    // Add middle segment (G) last so it appears on top
    this.container.add(segments[6]);
    this.segmentDisplays.push(segments);
  }

  createMagazineIndicators() {
    // Using configuration for left/right positions with improved layout
    const positions = [
      { x: -40 * this.scale, count: 5 },
      { x: 40 * this.scale, count: 5 }
    ];

    positions.forEach(pos => {
      for (let i = 0; i < pos.count; i++) {
        const yPos = 12 * this.scale - i * 6 * this.scale;
        
        // Create sleeker magazine indicators with subtle border
        const circle = this.scene.add.circle(pos.x, yPos, 2 * this.scale, 0x111111);
        circle.setStrokeStyle(0.5, 0x000000);
        
        // Add a dot in the center for visual detail
        const dot = this.scene.add.circle(pos.x, yPos, 0.5 * this.scale, 0x000000);
        
        this.magazineIndicators.push(circle);
        this.container.add(circle);
        this.container.add(dot);
      }
    });
  }

  setActiveSegments(displayIndex, value, isLetter = false) {
    // Refined patterns for cleaner display
    const patterns = {
      '0': [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      '1': [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      '2': [1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      '3': [1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      '4': [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      '5': [1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      '6': [1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      '7': [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      '8': [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      '9': [1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      'R': [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0],
      'E': [1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      'L': [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      'O': [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      'A': [1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      'D': [0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0],
      'I': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      'N': [1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
      'G': [1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      ' ': new Array(14).fill(0)
    };

    const pattern = patterns[value] || patterns[' '];
    const segments = this.segmentDisplays[displayIndex];
    if (!segments) {
      console.error('No segments found for displayIndex:', displayIndex);
      return;
    }
    
    // Enhanced display with glow effect for active segments
    const activeColor = isLetter ? 0xff2200 : 0xff4444;
    const inactiveColor = 0x111111;
    
    segments.forEach((segment, i) => {
      segment.fillColor = pattern[i] ? activeColor : inactiveColor;
      
      // Add subtle glow effect to active segments
      if (pattern[i]) {
        // Subtle glow with thin stroke
        const strokeColor = isLetter ? 0xff3300 : 0x009977;
        segment.setStrokeStyle(1, strokeColor, 0.4);
      } else {
        segment.setStrokeStyle(0.5, 0x000000);
      }
    });
  }

  updateAmmo(currentAmmo, magazineSize, totalMagazines, isReloading) {
    // Ensure all segments are visible
    this.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(true)));

    if (isReloading) {
      this.stopReloadingEffects();
      this.startReloadingScrollEffect();
    } else {
      this.stopReloadingEffects();
      const tens = Math.floor(currentAmmo / 10);
      const ones = currentAmmo % 10;
      this.setActiveSegments(0, tens.toString());
      this.setActiveSegments(1, ones.toString());
      
      // Enhanced color scheme with better gradients based on ammo
      let color;
      if (currentAmmo === 0) {
        color = 0xff0000; // Red when empty
        
        // Start flashing animation for zero ammo if not already flashing from NO MAG
        if (!this.noAmmoFlashTween && !this.synchronizedFlashTween && !isReloading) {
          this.startNoAmmoFlashEffect();
        }
      } else {
        // Stop flashing if we have ammo (but don't stop synchronized flashing)
        if (this.noAmmoFlashTween && !this.synchronizedFlashTween) {
          this.stopNoAmmoFlashEffect();
        }
        
        if (currentAmmo <= magazineSize * 0.25) {
          color = 0xff3300; // Red-orange when low
        } else if (currentAmmo <= magazineSize * 0.5) {
          color = 0xff9900; // Orange when medium
        } else {
          color = 0x00bb99; // Brighter cyan-green when high
        }
      }
      
      // Only apply color if not in synchronized flashing mode
      if (!this.synchronizedFlashTween) {
        this.segmentDisplays.forEach(segs => segs.forEach(segment => {
          if (segment.fillColor !== 0x111111) {
            segment.fillColor = color;
          }
        }));
      }
    }
    this.updateMagazineIndicators(totalMagazines);
  }
  
  startNoAmmoFlashEffect() {
    // Cancel any existing flash tween
    if (this.noAmmoFlashTween) {
      this.noAmmoFlashTween.stop();
    }
    
    // Create the flash effect for digit segments
    this.noAmmoFlashTween = this.scene.tweens.add({
      targets: this.segmentDisplays.flat().filter(s => s.fillColor !== 0x111111),
      alpha: { from: 1, to: 0.3 },
      duration: 250,
      yoyo: true,
      repeat: -1
    });
  }
  
  stopNoAmmoFlashEffect() {
    if (this.noAmmoFlashTween) {
      this.noAmmoFlashTween.stop();
      this.noAmmoFlashTween = null;
      
      // Reset alpha of all segments
      this.segmentDisplays.forEach(segs => {
        segs.forEach(segment => {
          segment.alpha = 1;
        });
      });
    }
  }

  startReloadingScrollEffect() {
    const text = "RELOADING";
    let index = 0;
    
    // Reset alpha for all segments and ensure they're visible
    this.segmentDisplays.forEach(segs => {
      segs.forEach(s => {
        s.alpha = 1;
        s.setVisible(true);
      });
    });

    // Add subtle pulsing effect during reload animation
    const createPulseEffect = () => {
      if (this.reloadingBlinkTween) {
        this.reloadingBlinkTween.stop();
      }
      
      this.reloadingBlinkTween = this.scene.tweens.add({
        targets: this.segmentDisplays.flat().filter(s => s.fillColor !== 0x111111),
        alpha: { from: 1, to: 0.6 },
        duration: 500,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
    };

    this.reloadTimer = this.scene.time.addEvent({
      delay: 180, // Slightly slower for better readability
      callback: () => {
        const char1 = index < text.length ? text.charAt(index) : ' ';
        const char2 = (index + 1) < text.length ? text.charAt(index + 1) : ' ';
        
        this.setActiveSegments(0, this.getLetterPattern(char1), true);
        this.setActiveSegments(1, this.getLetterPattern(char2), true);
        
        createPulseEffect();
        
        index = (index + 1) % (text.length + 1);
      },
      callbackScope: this,
      repeat: -1
    });
  }

  getLetterPattern(char) {
    return '0123456789RELOADINGN '.includes(char) ? char : ' ';
  }
  
  createUpgradeIndicatorArea() {
    // Create a container for upgrade indicators that will appear below the ammo display
    // Position it lower to make room for the shield display
    this.upgradeContainer = this.scene.add.container(0, this.bgHeight/2 + 30);
    this.container.add(this.upgradeContainer);
  }
  
  addUpgradeIndicator(upgradeType, emoji, color) {
    // Remove existing indicator of the same type if it exists
    this.removeUpgradeIndicator(upgradeType);
    
    // Create the text with the emoji
    const indicator = this.scene.add.text(0, 0, emoji, { 
      fontSize: '16px',
      fontFamily: 'Arial'
    });
    indicator.setOrigin(0.5);
    
    // Create a small circular background
    const circle = this.scene.add.circle(0, 0, 12, color, 0.7);
    circle.setStrokeStyle(1, 0xffffff, 0.5);
    
    // Create a container for this upgrade
    const container = this.scene.add.container(0, 0);
    container.add(circle);
    container.add(indicator);
    
    // Store in the upgradeIndicators object
    this.upgradeIndicators[upgradeType] = {
      container: container,
      indicator: indicator,
      circle: circle
    };
    
    // Add to the upgradeContainer
    this.upgradeContainer.add(container);
    
    // Position all indicators
    this.repositionUpgradeIndicators();
    
    // Add a small scale pulse animation
    this.scene.tweens.add({
      targets: circle,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 1000,
      yoyo: true,
      repeat: -1
    });
    
    return container;
  }
  
  removeUpgradeIndicator(upgradeType) {
    if (this.upgradeIndicators[upgradeType]) {
      // Stop any tweens
      this.scene.tweens.killTweensOf(this.upgradeIndicators[upgradeType].circle);
      
      // Remove and destroy the container
      this.upgradeContainer.remove(this.upgradeIndicators[upgradeType].container, true);
      this.upgradeIndicators[upgradeType].container.destroy();
      
      // Remove from our tracking object
      delete this.upgradeIndicators[upgradeType];
      
      // Reposition remaining indicators
      this.repositionUpgradeIndicators();
    }
  }
  
  repositionUpgradeIndicators() {
    // Get all upgrade types
    const types = Object.keys(this.upgradeIndicators);
    
    if (types.length === 0) return;
    
    // Calculate spacing
    const totalWidth = types.length * 30; // Each indicator is ~30px wide
    const startX = -totalWidth/2 + 15; // Center the indicators
    
    // Position each indicator
    types.forEach((type, index) => {
      const indicator = this.upgradeIndicators[type].container;
      indicator.x = startX + (index * 30);
      indicator.y = 0;
    });
  }

  stopReloadingEffects() {
    if (this.reloadTimer) {
      this.reloadTimer.remove();
      this.reloadTimer = null;
    }
    if (this.reloadingBlinkTween) {
      this.reloadingBlinkTween.stop();
      this.reloadingBlinkTween = null;
      this.segmentDisplays.forEach(segs => segs.forEach(s => s.alpha = 1));
    }
    
    // Stop synchronized flashing when reloading
    this.stopSynchronizedFlashing();
    
    // Stop "00" flash effect during reloading (will restart after reload if still at 0)
    this.stopNoAmmoFlashEffect();
  }

  updateMagazineIndicators(totalMagazines) {
    const displayMagazines = Math.min(totalMagazines, this.maxMagazines);
    
    // Start flashing effect if no magazines left
    if (totalMagazines === 0) {
      this.startMagazineFlashEffect();
    } else {
      this.stopMagazineFlashEffect();
    }
    
    for (let i = 0; i < this.maxMagazines; i++) {
      const indicatorIndex = (i < 5) ? (5 + i) : (i - 5);
      
      // Enhanced color scheme with gradient effect based on ammunition amount
      let color;
      if (i < displayMagazines) {
        if (totalMagazines <= 2) {
          color = 0xff3300; // Red-orange when very low on magazines
        } else if (totalMagazines <= 4) {
          color = 0xff9900; // Orange when low on magazines
        } else {
          color = 0x00bb99; // Brighter cyan-green when sufficient magazines
        }
      } else {
        color = 0x111111; // Inactive color
      }
      
      this.magazineIndicators[indicatorIndex].fillColor = color;
      
      // Add very subtle glow effect to active indicators
      if (i < displayMagazines) {
        // Subtle glow with thin stroke
        this.magazineIndicators[indicatorIndex].setStrokeStyle(1, 0xffffff, 0.3);
      } else {
        this.magazineIndicators[indicatorIndex].setStrokeStyle(0.5, 0x000000);
      }
    }
  }
  
  startMagazineFlashEffect() {
    // Cancel any existing flash tween
    if (this.magazineFlashTween) {
      this.magazineFlashTween.stop();
    }
    
    // Create a target object for the tween
    const flashTarget = { alpha: 0 };
    
    // Create the flash effect
    this.magazineFlashTween = this.scene.tweens.add({
      targets: flashTarget,
      alpha: 1,
      duration: 300,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        // Apply flashing red to all magazine indicators
        this.magazineIndicators.forEach(indicator => {
          if (indicator.fillColor === 0x111111) {
            // Flash between dark red and normal inactive color
            indicator.fillColor = Phaser.Display.Color.Interpolate.ColorWithColor(
              { r: 17, g: 17, b: 17 },  // 0x111111
              { r: 255, g: 0, b: 0 },   // Red
              100,
              flashTarget.alpha * 100
            );
          }
        });
      }
    });
  }
  
  stopMagazineFlashEffect() {
    if (this.magazineFlashTween) {
      this.magazineFlashTween.stop();
      this.magazineFlashTween = null;
      
      // Reset colors to inactive
      this.magazineIndicators.forEach(indicator => {
        if (indicator.fillColor !== 0x00bb99 && 
            indicator.fillColor !== 0xff9900 && 
            indicator.fillColor !== 0xff3300) {
          indicator.fillColor = 0x111111;
        }
      });
    }
  }
  
  // Update the weapon type display
  updateWeaponType(weaponType) {
    // Set visual indicator for weapon type
    if (weaponType === 'shotgun') {
      // Add a shotgun indicator if it doesn't exist
      this.addUpgradeIndicator('shotgun', '🔫', 0xff6600);
    } else {
      // Remove shotgun indicator if it exists when switching back to rifle
      this.removeUpgradeIndicator('shotgun');
    }
  }
  
  // Synchronized flashing for both segments and magazine indicators
  startSynchronizedFlashing() {
    // Stop magazine flash tween but keep digit flashing
    this.stopMagazineFlashEffect();
    
    // Don't stop noAmmoFlashTween to preserve the flashing "00" effect
    
    if (this.synchronizedFlashTween) {
      this.synchronizedFlashTween.stop();
    }
    
    // Create a target object for the tween
    const flashTarget = { alpha: 0 };
    
    // Create the flash effect
    this.synchronizedFlashTween = this.scene.tweens.add({
      targets: flashTarget,
      alpha: 1,
      duration: 250,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        // Apply flashing red to all magazine indicators
        this.magazineIndicators.forEach(indicator => {
          // Flash between bright red and dark red
          indicator.fillColor = Phaser.Display.Color.Interpolate.ColorWithColor(
            { r: 50, g: 0, b: 0 },   // Dark red
            { r: 255, g: 0, b: 0 },  // Bright red
            100,
            flashTarget.alpha * 100
          );
          
          // Add pulsing glow effect
          indicator.setStrokeStyle(
            1 + flashTarget.alpha, // Stroke width pulses
            0xff5555,              // Reddish glow
            0.3 + (flashTarget.alpha * 0.7) // Alpha pulses from 0.3 to 1.0
          );
        });
        
        // We don't modify digit segments here to preserve the "00" flashing effect
        // that's handled by noAmmoFlashTween
      }
    });
    
    // If digit flashing isn't active, start it
    if (!this.noAmmoFlashTween) {
      this.startNoAmmoFlashEffect();
    }
  }
  
  stopSynchronizedFlashing() {
    if (this.synchronizedFlashTween) {
      this.synchronizedFlashTween.stop();
      this.synchronizedFlashTween = null;
      
      // Reset magazine indicators
      this.magazineIndicators.forEach(indicator => {
        indicator.fillColor = 0x111111;
        indicator.setStrokeStyle(0.5, 0x000000);
      });
      
      // Don't reset digits here - allow them to continue flashing if appropriate
      // based on current ammo state, which will be handled by updateAmmo
    }
  }
}
