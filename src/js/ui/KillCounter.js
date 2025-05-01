export class KillCounter {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.scale = 0.5; // Half size mode
    this.container = null;
    this.segmentDisplays = [];
    this.currentCount = 0;
    this.hasBeenShown = false;
    this.isPortrait = scene.registry.get('isPortrait');
    this.init();
  }

  init() {
    this.createContainer();
    this.createBackground();
    this.createDisplays();
  }

  createContainer() {
    this.container = this.scene.add.container(this.x, this.y);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);
  }

  createBackground() {
    // Create a sleeker background with gradient-like effect
    const bgWidth = 200; // Width for just this counter - increased to fit label
    const bgHeight = 50; // Height for just this counter
    
    // Main background positioned to align with ammo meter at the top
    const bg = this.scene.add.rectangle(
      0, 
      0, // Centered vertically on the killCounter's position
      bgWidth,
      bgHeight,
      0x000000,
      0.9 // Higher opacity for better visibility
    );
    bg.setStrokeStyle(2, 0x444444); // Thicker border
    
    // Add subtle inner border for depth
    const innerBorder = this.scene.add.rectangle(
      0,
      0, // Match position of main background
      bgWidth - 6,
      bgHeight - 6,
      0x000000,
      0
    );
    innerBorder.setStrokeStyle(1, 0x222222);
    
    this.container.add(bg);
    this.container.add(innerBorder);
    
    // Add "KILLS" label with color matching the AmmoDisplay - positioned right after the digits
    const killsLabel = this.scene.add.text(
      37, // Position right after the last digit
      0, // Centered vertically
      "KILLS", 
      { 
        fontSize: '12px',
        fontFamily: 'Audiowide, monospace',
        fill: '#ff4444', // Match the exact color of the AmmoDisplay digits
        stroke: '#000000',
        strokeThickness: 2
      }
    );
    killsLabel.setOrigin(0, 0.5);
    this.container.add(killsLabel);
  }

  createDisplays() {
    // Create three 14-segment displays aligned to the left
    const positions = [
      -75, // First digit moved to the left
      -35, // Second digit
      5    // Third digit
    ];
    
    positions.forEach(x => {
      this.create14SegmentDisplay(x, 0); // Centered vertically in background
    });
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
    
    // Red color for kill counter - matching the AmmoDisplay colors
    const activeColor = 0xff4444; // Using the exact same color as AmmoDisplay digits
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

  updateKillCount(count) {
    // Update cached portrait mode status
    this.isPortrait = this.scene.registry.get('isPortrait');
    
    // In portrait mode, only show if the count changes
    if (this.isPortrait && count === this.currentCount && this.hasBeenShown) {
      return;
    }
    
    // Remember that we've shown this counter
    this.hasBeenShown = true;
    this.currentCount = count;
    
    // Make container visible first (in case it was hidden)
    if (this.container) {
      this.container.setVisible(true);
    }
    
    // Make all segments visible
    this.segmentDisplays.forEach(segs => segs.forEach(s => s.setVisible(true)));

    // Format to 3 digits with leading zeros
    const formattedCount = count.toString().padStart(3, '0');
    
    // Set each digit
    this.setActiveSegments(0, formattedCount[0]);
    this.setActiveSegments(1, formattedCount[1]);
    this.setActiveSegments(2, formattedCount[2]);
    
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
          }
        }
      });
    }
  }
}