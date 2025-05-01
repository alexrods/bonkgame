export class MoneyCounter {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.scale = 0.5; // Half size mode
    this.container = null;
    this.segmentDisplays = [];
    this.decimalPoints = [];
    this.currentAmount = 100;
    this.hasBeenShown = false;
    this.isPortrait = scene.registry.get('isPortrait');
    this.init();
  }

  init() {
    this.createContainer();
    this.createBackground();
    this.createDisplays();
    this.createDecimalPoints();
  }

  createContainer() {
    this.container = this.scene.add.container(this.x, this.y);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);
  }

  createBackground() {
    // Individual background for this counter
    const bgWidth = 200; // Width for just this counter - increased to fit label
    const bgHeight = 50; // Height for just this counter
    
    // Create a black background with border
    const bg = this.scene.add.rectangle(
      0,
      0,
      bgWidth,
      bgHeight,
      0x000000,
      0.9 // Higher opacity for better visibility
    );
    bg.setStrokeStyle(2, 0x444444); // Same style as KillCounter
    
    // Add subtle inner border for depth
    const innerBorder = this.scene.add.rectangle(
      0,
      0, 
      bgWidth - 6,
      bgHeight - 6,
      0x000000,
      0
    );
    innerBorder.setStrokeStyle(1, 0x222222);
    
    // Add backgrounds to container
    this.container.add(bg);
    this.container.add(innerBorder);
    
    // Add "CREDITS" label with symbol - positioned right after the digits
    const moneyLabel = this.scene.add.text(
      65, // Position right after the last digit
      0, // Centered vertically
      "🅒", 
      { 
        fontSize: '18px',
        fontFamily: 'Audiowide, monospace',
        fill: '#00bb99', // Match the exact high ammo color from AmmoDisplay
        stroke: '#000000',
        strokeThickness: 2
      }
    );
    moneyLabel.setOrigin(0, 0.5);
    this.container.add(moneyLabel);
  }

  createDisplays() {
    // Create five 14-segment displays (3 before decimal, 2 after) aligned to the left
    const positions = [
      -80, // Hundreds - moved left
      -50, // Tens - moved left
      -20,  // Ones - moved left
      10,  // Tenths - moved left
      40   // Hundredths - moved left
    ];
    
    positions.forEach(x => {
      this.create14SegmentDisplay(x, 0); // Centered vertically in background
    });
  }
  
  createDecimalPoints() {
    // Create a decimal point EXACTLY matching the magazine indicator style from AmmoDisplay
    const yPos = 0; // Match the new vertical position of digits
    
    // Create circle with EXACT same specifications as magazine indicators
    // In AmmoDisplay: circle = this.scene.add.circle(pos.x, yPos, 2 * this.scale, 0x111111);
    const decimalCircle = this.scene.add.circle(
      -5, // Between ones and tenths (adjusted for new spacing)
      yPos,
      2 * 0.75, // Half the original size: 2 * (1.5 * 0.5)
      0x00bb99 // Match the exact high ammo color from AmmoDisplay
    );
    // In AmmoDisplay: circle.setStrokeStyle(0.5, 0x000000);
    decimalCircle.setStrokeStyle(0.5, 0x000000); // EXACT same stroke
    
    // Add a dot in the center with EXACT same specifications
    // In AmmoDisplay: dot = this.scene.add.circle(pos.x, yPos, 0.5 * this.scale, 0x000000);
    const centerDot = this.scene.add.circle(
      -5, 
      yPos, 
      0.5 * 0.75, // Half the original size: 0.5 * (1.5 * 0.5)
      0x000000 // EXACT same color
    );
    
    // Add both elements to container in the same order as AmmoDisplay
    this.container.add(decimalCircle);
    this.container.add(centerDot);
    
    this.decimalPoints.push(decimalCircle);
    this.decimalPoints.push(centerDot);
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

  setActiveSegments(displayIndex, value) {
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
      ' ': new Array(14).fill(0)
    };

    const pattern = patterns[value] || patterns[' '];
    const segments = this.segmentDisplays[displayIndex];
    if (!segments) {
      console.error('No segments found for displayIndex:', displayIndex);
      return;
    }
    
    // Green color for money counter - matching AmmoDisplay's good ammo state
    const activeColor = 0x00bb99; // Exact match to AmmoDisplay's high ammo color
    const inactiveColor = 0x111111;
    
    segments.forEach((segment, i) => {
      segment.fillColor = pattern[i] ? activeColor : inactiveColor;
      
      // Add subtle glow effect to active segments
      if (pattern[i]) {
        // Subtle glow with thin stroke - matching AmmoDisplay
        segment.setStrokeStyle(1, 0x009977, 0.4); // Same as AmmoDisplay stroke color
      } else {
        segment.setStrokeStyle(0.5, 0x000000);
      }
    });
  }

  updateMoney(amount) {
    // Update cached portrait mode status
    this.isPortrait = this.scene.registry.get('isPortrait');
    
    // In portrait mode, only show if the amount changes
    if (this.isPortrait && Math.abs(amount - this.currentAmount) < 0.01 && this.hasBeenShown) {
      return;
    }
    
    // Remember that we've shown this counter
    this.hasBeenShown = true;
    this.currentAmount = amount;
    
    // Make container visible first (in case it was hidden)
    if (this.container) {
      this.container.setVisible(true);
    }
    
    // Make all segments visible
    this.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(true)));
    // Make decimal points visible too
    this.decimalPoints.forEach(point => point.setVisible(true));

    // Format to 5 digits (3 before decimal, 2 after)
    // Limit to 999.99 maximum
    const clampedAmount = Math.min(amount, 999.99);
    
    // Format with 2 decimal places
    const formattedAmount = clampedAmount.toFixed(2);
    
    // Split into digits, handle the decimal point
    const parts = formattedAmount.split('.');
    const integerPart = parts[0].padStart(3, '0'); // Ensure 3 digits
    const decimalPart = parts[1] || '00';  // Ensure 2 decimal digits
    
    // Set each digit in the integer part
    for (let i = 0; i < 3; i++) {
      this.setActiveSegments(i, integerPart[i]);
    }
    
    // Set each digit in the decimal part
    for (let i = 0; i < 2; i++) {
      this.setActiveSegments(i + 3, decimalPart[i]);
    }
    
    // In portrait mode, show briefly then hide after a delay
    if (this.isPortrait) {
      // Clear any existing hide timer
      if (this.hideTimer) {
        this.scene.time.removeEvent(this.hideTimer);
      }
      
      // Set a timer to hide the counter after 1.5 seconds
      this.hideTimer = this.scene.time.delayedCall(1500, () => {
        // Only hide if still in portrait mode and in the scene
        if (this.scene && this.scene.registry && this.scene.registry.get('isPortrait')) {
          if (this.container) {
            this.container.setVisible(false);
          } else {
            this.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(false)));
            this.decimalPoints.forEach(point => point.setVisible(false));
          }
        }
      });
    }
  }
}