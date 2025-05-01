export class GamepadController {
  constructor(scene) {
    this.scene = scene;
    this.gamepad = null;
    this.movementVector = { x: 0, y: 0 };
    this.shootingVector = { x: 0, y: 0 };
    this.buttonState = {
      A: false,
      B: false,
      X: false,
      Y: false,
      RB: false,
      LB: false,
      RT: false,
      LT: false,
      Back: false,
      Start: false,
      DPadUp: false,
      DPadDown: false,
      DPadLeft: false,
      DPadRight: false,
      LeftStickPress: false,
      RightStickPress: false
    };
    this.prevButtonState = {...this.buttonState};
    this.deadzone = 0.25;
    
    // Flag to indicate when weapons menu is active
    // Used to disable LB/RB buttons when weapons menu is open
    this.weaponsMenuActive = false;
  }

  init() {
    // Add gamepad connected/disconnected event listeners
    window.addEventListener('gamepadconnected', (e) => {
      console.log(`Gamepad connected: ${e.gamepad.id}`);
      this.updateGamepadStatus();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`Gamepad disconnected: ${e.gamepad.id}`);
      this.updateGamepadStatus();
    });

    // Show a status message if a gamepad is connected
    this.updateGamepadStatus();
  }

  updateGamepadStatus() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    // Remove any existing status message
    if (this.statusText) {
      this.statusText.destroy();
      this.statusText = null;
    }

    // Just log to console if a gamepad is connected
    const connectedGamepad = Array.from(gamepads).find(gamepad => gamepad && gamepad.connected);
    if (connectedGamepad) {
      console.log(`Gamepad connected: ${connectedGamepad.id}`);
    }
  }

  update() {
    // Update gamepad state
    this.updateGamepadState();
  }

  updateGamepadState() {
    // Save previous button state
    this.prevButtonState = {...this.buttonState};
    
    // Get the current gamepad state
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    // Use the first connected gamepad we find
    this.gamepad = Array.from(gamepads).find(gamepad => gamepad && gamepad.connected);

    if (!this.gamepad) {
      // Reset vectors when no gamepad is connected
      this.movementVector.x = 0;
      this.movementVector.y = 0;
      this.shootingVector.x = 0;
      this.shootingVector.y = 0;
      
      // Reset button states
      Object.keys(this.buttonState).forEach(key => {
        this.buttonState[key] = false;
      });
      
      return;
    }

    // D-pad for movement (buttons 12-15)
    let dpadX = 0;
    let dpadY = 0;
    
    // Update D-pad button states
    this.buttonState.DPadUp = this.gamepad.buttons[12] && this.gamepad.buttons[12].pressed;
    this.buttonState.DPadDown = this.gamepad.buttons[13] && this.gamepad.buttons[13].pressed;
    this.buttonState.DPadLeft = this.gamepad.buttons[14] && this.gamepad.buttons[14].pressed;
    this.buttonState.DPadRight = this.gamepad.buttons[15] && this.gamepad.buttons[15].pressed;
    
    // Set dpad direction for movement
    if (this.buttonState.DPadUp) dpadY = -1; // Up
    if (this.buttonState.DPadDown) dpadY = 1;  // Down
    if (this.buttonState.DPadLeft) dpadX = -1; // Left
    if (this.buttonState.DPadRight) dpadX = 1;  // Right
    
    // Update face button states
    this.buttonState.A = this.gamepad.buttons[0] && this.gamepad.buttons[0].pressed;
    this.buttonState.B = this.gamepad.buttons[1] && this.gamepad.buttons[1].pressed;
    this.buttonState.X = this.gamepad.buttons[2] && this.gamepad.buttons[2].pressed;
    this.buttonState.Y = this.gamepad.buttons[3] && this.gamepad.buttons[3].pressed;
    
    // Update shoulder button states
    this.buttonState.LB = this.gamepad.buttons[4] && this.gamepad.buttons[4].pressed;
    this.buttonState.RB = this.gamepad.buttons[5] && this.gamepad.buttons[5].pressed;
    
    // Update trigger states
    this.buttonState.LT = this.gamepad.buttons[6] && this.gamepad.buttons[6].pressed;
    this.buttonState.RT = this.gamepad.buttons[7] && this.gamepad.buttons[7].pressed;
    
    // Update other button states
    this.buttonState.Back = this.gamepad.buttons[8] && this.gamepad.buttons[8].pressed;
    this.buttonState.Start = this.gamepad.buttons[9] && this.gamepad.buttons[9].pressed;
    this.buttonState.LeftStickPress = this.gamepad.buttons[10] && this.gamepad.buttons[10].pressed;
    this.buttonState.RightStickPress = this.gamepad.buttons[11] && this.gamepad.buttons[11].pressed;
    
    // Handle drone wheel display using RB (button index 5)
    // Open wheel with RB hold, close on release
    // Skip if weapons menu is active
    if (!this.weaponsMenuActive) {
      if (this.buttonState.RB && !this.prevButtonState.RB) {
        // Check if deposit/withdraw prompt or rhythm minigame is active
        const depositPromptActive = this.scene.droneWheel && 
                                   this.scene.droneWheel.depositWithdrawPrompt && 
                                   this.scene.droneWheel.depositWithdrawPrompt.isVisible;
        const rhythmGameActive = this.scene.droneWheel && 
                                this.scene.droneWheel.rhythmGame && 
                                this.scene.droneWheel.rhythmGame.isActive;
        
        // RB was just pressed - open drone wheel only if not in other menus
        if (this.scene.droneWheel && !this.scene.droneWheel.isVisible && 
            !depositPromptActive && !rhythmGameActive) {
          this.scene.droneWheel.show();
        }
      } else if (!this.buttonState.RB && this.prevButtonState.RB) {
        // Check if deposit/withdraw prompt or rhythm minigame is active
        const depositPromptActive = this.scene.droneWheel && 
                                   this.scene.droneWheel.depositWithdrawPrompt && 
                                   this.scene.droneWheel.depositWithdrawPrompt.isVisible;
        const rhythmGameActive = this.scene.droneWheel && 
                                this.scene.droneWheel.rhythmGame && 
                                this.scene.droneWheel.rhythmGame.isActive;
        
        // RB was just released - confirm selection and close wheel only if not in other menus
        if (this.scene.droneWheel && this.scene.droneWheel.isVisible && 
            !depositPromptActive && !rhythmGameActive) {
          this.scene.droneWheel.confirmSelection();
          this.scene.droneWheel.hide();
        }
      }
    }
    
    // Handle reload with LB button (when wheel is not visible and weapons menu is not active)
    if ((!this.scene.droneWheel || !this.scene.droneWheel.isVisible) && !this.weaponsMenuActive) {
      if (this.buttonState.LB && !this.prevButtonState.LB) {
        // Left bumper was just pressed - trigger reload
        if (this.scene.playerManager) {
          this.scene.playerManager.reload();
        }
      }
    }
    
    // Handle wheel navigation when it's visible and gamepad is connected
    if (this.gamepad && this.scene.droneWheel && this.scene.droneWheel.isVisible) {
      console.log("GamepadController handling drone wheel navigation");
      
      // Navigate wheel using left stick direction
      const leftX = this.applyDeadzone(this.gamepad.axes[0]);
      const leftY = this.applyDeadzone(this.gamepad.axes[1]);
      
      if (leftX !== 0 || leftY !== 0) {
        this.scene.droneWheel.selectByDirection(leftX, leftY);
      }
      
      // Fallback to D-pad for navigation
      if (this.buttonState.DPadLeft && !this.prevButtonState.DPadLeft) {
        console.log("GamepadController: D-pad Left pressed");
        this.scene.droneWheel.selectPrevious();
      }
      
      if (this.buttonState.DPadRight && !this.prevButtonState.DPadRight) {
        console.log("GamepadController: D-pad Right pressed");
        this.scene.droneWheel.selectNext();
      }
      
      // Allow B button to cancel without confirming
      if (this.buttonState.B && !this.prevButtonState.B) {
        this.scene.droneWheel.hide();
      }
    }
    
    // Set movement from D-pad
    this.movementVector.x = dpadX;
    this.movementVector.y = dpadY;

    // Also support left stick as alternative for movement (some controllers might not have good D-pads)
    if (dpadX === 0 && dpadY === 0) {
      const leftX = this.applyDeadzone(this.gamepad.axes[0]);
      const leftY = this.applyDeadzone(this.gamepad.axes[1]);
      
      if (leftX !== 0 || leftY !== 0) {
        this.movementVector.x = leftX;
        this.movementVector.y = leftY;
      }
    }

    // Reset shooting vector
    this.shootingVector.x = 0;
    this.shootingVector.y = 0;
    
    // Face buttons for shooting direction
    let shootX = 0;
    let shootY = 0;
    
    // Update button states and set shooting direction based on face buttons
    this.buttonState.A = this.gamepad.buttons[0] && this.gamepad.buttons[0].pressed;
    this.buttonState.B = this.gamepad.buttons[1] && this.gamepad.buttons[1].pressed;
    this.buttonState.X = this.gamepad.buttons[2] && this.gamepad.buttons[2].pressed;
    this.buttonState.Y = this.gamepad.buttons[3] && this.gamepad.buttons[3].pressed;
    
    // A button (bottom) = down
    if (this.buttonState.A) {
      shootY = 1;
    }
    // Y button (top) = up
    if (this.buttonState.Y) {
      shootY = -1;
    }
    // X button (left) = left
    if (this.buttonState.X) {
      shootX = -1;
    }
    // B button (right) = right
    if (this.buttonState.B) {
      shootX = 1;
    }
    
    // If any face button pressed, set shooting vector
    if (shootX !== 0 || shootY !== 0) {
      // Normalize the vector
      const magnitude = Math.sqrt(shootX * shootX + shootY * shootY);
      this.shootingVector.x = shootX / magnitude;
      this.shootingVector.y = shootY / magnitude;
    }
    
    // Also support right stick as alternative for shooting (for gamers who prefer it)
    if (shootX === 0 && shootY === 0) {
      const rightX = this.applyDeadzone(this.gamepad.axes[2]);
      const rightY = this.applyDeadzone(this.gamepad.axes[3]);
      
      if (Math.abs(rightX) > this.deadzone || Math.abs(rightY) > this.deadzone) {
        // Normalize the vector
        const magnitude = Math.sqrt(rightX * rightX + rightY * rightY);
        this.shootingVector.x = rightX / magnitude;
        this.shootingVector.y = rightY / magnitude;
      }
    }
  }

  applyDeadzone(value) {
    // Apply deadzone to avoid drift from small analog stick movements
    return Math.abs(value) < this.deadzone ? 0 : value;
  }

  getMovementVector() {
    // Return zero vector if drone wheel is open
    if (this.scene.droneWheel && this.scene.droneWheel.isVisible) {
      return { x: 0, y: 0 };
    }
    return this.movementVector;
  }

  getShootingVector() {
    // Return zero vector if drone wheel is open
    if (this.scene.droneWheel && this.scene.droneWheel.isVisible) {
      return { x: 0, y: 0 };
    }
    return this.shootingVector;
  }

  isButtonPressed(button) {
    return this.buttonState[button] || false;
  }

  isShootButtonPressed() {
    // Don't allow shooting if drone wheel is open
    if (this.scene.droneWheel && this.scene.droneWheel.isVisible) {
      return false;
    }
    
    // Any face button (A, B, X, Y) is considered a shoot button
    // We also keep right trigger (button 7) as a universal shoot button
    return (this.gamepad && 
           ((this.gamepad.buttons[7] && this.gamepad.buttons[7].pressed) || 
            this.buttonState.A || this.buttonState.B || this.buttonState.X || this.buttonState.Y));
  }
  
  /**
   * Check if any button on the gamepad is pressed
   * @returns {boolean} Whether any button is pressed
   */
  isAnyButtonPressed() {
    if (!this.gamepad) return false;
    
    for (let i = 0; i < this.gamepad.buttons.length; i++) {
      if (this.gamepad.buttons[i] && this.gamepad.buttons[i].pressed) {
        // Try to unlock audio context when any button is pressed
        if (window.game && window.game.sound && window.game.sound.context) {
          if (window.game.sound.context.state === 'suspended') {
            window.game.sound.context.resume();
            console.log("Audio context resumed by gamepad button press");
          }
        }
        return true;
      }
    }
    
    // Also check analog sticks
    for (let i = 0; i < this.gamepad.axes.length; i++) {
      if (Math.abs(this.gamepad.axes[i]) > 0.5) {
        // Try to unlock audio context when any axis is moved significantly
        if (window.game && window.game.sound && window.game.sound.context) {
          if (window.game.sound.context.state === 'suspended') {
            window.game.sound.context.resume();
            console.log("Audio context resumed by gamepad axis movement");
          }
        }
        return true;
      }
    }
    
    return false;
  }
}