export class AccuracyMeter {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.scale = 0.5; // Half size mode
    this.container = null;
    this.leds = [];
    this.totalLeds = 10; // 10 LEDs for the meter
    this.init();
  }

  init() {
    this.createContainer();
    this.createBackground();
    this.createLeds();
  }

  createContainer() {
    this.container = this.scene.add.container(this.x, this.y);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);
  }

  createBackground() {
    // Create a sleeker background with gradient-like effect - same width as counters
    const bgWidth = 120 * 1.5; // Use same dimensions as other counters
    const bgHeight = 30 * 1.5; // Slightly shorter than counters for the bar style
    
    // Transparent background (no dark background)
    const bg = this.scene.add.rectangle(
      0,
      0,
      bgWidth,
      bgHeight,
      0x000000,
      0 // Completely transparent
    );
    bg.setStrokeStyle(0, 0x000000, 0); // No border
    
    // No inner border for transparent containers
    /*
    const innerBorder = this.scene.add.rectangle(
      0,
      0,
      bgWidth - 4,
      bgHeight - 4,
      0x000000,
      0
    );
    innerBorder.setStrokeStyle(0, 0x000000, 0);
    */
    
    // Only add the background
    this.container.add(bg);
    
    // No label needed with transparent background
    /*
    const labelText = this.scene.add.text(
      -bgWidth/2 + 15,
      -bgHeight/2 + 10,
      "ACC",
      { 
        fontFamily: 'Arial', 
        fontSize: 10, 
        color: '#888888' 
      }
    );
    labelText.setOrigin(0, 0);
    this.container.add(labelText);
    */
  }

  createLeds() {
    // Calculate spacing between LEDs
    const bgWidth = 120 * 1.5;
    const ledAreaWidth = bgWidth - 30; // Leave margins
    const ledSpacing = ledAreaWidth / (this.totalLeds - 1); // Space between LED centers
    
    const ledRadius = 4; // LED size 
    const yPosition = 5; // Position LEDs in the lower half of the container
    
    // Create LED colors from red to green
    const colors = this.generateLedColors(this.totalLeds);
    
    // Create LEDs
    for (let i = 0; i < this.totalLeds; i++) {
      // Calculate position based on index
      const xPosition = -ledAreaWidth/2 + (i * ledSpacing);
      
      // Create LED circle
      const led = this.scene.add.circle(
        xPosition,
        yPosition,
        ledRadius,
        colors[i],
        0.3 // Start with low alpha (dimmed)
      );
      led.setStrokeStyle(0.5, 0x000000);
      
      // Add center dot like magazine indicators
      const centerDot = this.scene.add.circle(
        xPosition,
        yPosition,
        ledRadius * 0.25, // Small center dot
        0x000000
      );
      
      // Add both to container
      this.container.add(led);
      this.container.add(centerDot);
      
      // Store LED reference
      this.leds.push({ led: led, centerDot: centerDot, color: colors[i] });
    }
    
    // Initialize to 0% accuracy (all off)
    this.updateAccuracy(0);
  }

  // Generate colors from red to green
  generateLedColors(count) {
    const colors = [];
    
    for (let i = 0; i < count; i++) {
      // Calculate percentage through the gradient
      const percent = i / (count - 1);
      
      // Red component decreases from 255 to 0
      const r = Math.max(0, Math.floor(255 * (1 - percent)));
      
      // Green component increases from 0 to 255
      const g = Math.max(0, Math.floor(255 * percent));
      
      // Convert RGB to hex
      const color = (r << 16) | (g << 8) | 0;
      colors.push(color);
    }
    
    return colors;
  }

  updateAccuracy(accuracyPercent) {
    // Ensure the percentage is between 0 and 100
    const percent = Math.max(0, Math.min(100, accuracyPercent));
    
    // Calculate how many LEDs should be lit
    // 40% or less only lights up the first LED
    // 90% or more lights up all LEDs
    let activeLeds = 0;
    
    if (percent <= 40) {
      // Below 40%, only show the first LED
      activeLeds = 1;
    } else if (percent >= 90) {
      // Above 90%, show all LEDs
      activeLeds = this.totalLeds;
    } else {
      // Between 40% and 90%, scale appropriately
      // 40% = 1 LED, 90% = 10 LEDs
      const range = 90 - 40; // 50%
      const normalizedPercent = percent - 40;
      activeLeds = Math.ceil(1 + (normalizedPercent / range) * (this.totalLeds - 1));
    }
    
    // Update LEDs
    this.leds.forEach((ledObj, index) => {
      if (index < activeLeds) {
        // Active LED - full brightness 
        ledObj.led.setAlpha(1.0);
      } else {
        // Inactive LED - dimmed
        ledObj.led.setAlpha(0.3);
      }
    });
  }
}