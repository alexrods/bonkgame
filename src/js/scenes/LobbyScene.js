import { GAME_WIDTH, GAME_HEIGHT, WEB3_CONFIG } from '../../config.js';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.waitingText = null;
    this.waitingPlayer = null;
    this.waitingAnimation = null;
    this.lobbyTimer = 0;
    this.isHost = false;
    this.matchFound = false;
    this.playerId = null;
    this.sessionId = null;
    this.loadingDots = '';
    this.dotCount = 0;
    this.cancelButton = null;
    this.debugText = null;
    this.socket = null;
  }
  
  // Set up socket.io connection for multiplayer
  setupSocketConnection() {
    if (this.socket) {
      // If we already have a socket connection, disconnect it first
      this.socket.disconnect();
    }
    
    // Connect to the socket.io server
    console.log('Connecting to socket.io server');
    this.socket = io('http://localhost:3000');
    
    // Connection established
    this.socket.on('connect', () => {
      console.log('Connected to matchmaking server with id:', this.socket.id);
      this.debugText.setText(`Debug: Connected to server | Socket ID: ${this.socket.id.substring(0, 8)}...`);
      
      // Register with server as available for matchmaking
      this.socket.emit('registerPlayer', {
        playerId: this.playerId,
        gameCode: this.registry.get('gameCode')
      });
    });
    
    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.debugText.setText(`Debug: Connection error | Using local fallback mode`);
      
      // Fall back to localStorage-based matchmaking
      if (this.registry.get('forceHost')) {
        this.becomeHost();
      } else {
        this.checkForAvailableHosts();
      }
    });
    
    // Match found event
    this.socket.on('matchFound', (data) => {
      console.log('Match found!', data);
      
      // Update UI
      this.waitingText.setText('Match found! Starting game...');
      
      // Store match data in registry
      this.isHost = data.isHost;
      this.sessionId = data.sessionId;
      this.registry.set('isHost', this.isHost);
      this.registry.set('playerId', this.playerId);
      this.registry.set('sessionId', this.sessionId);
      this.registry.set('multiplayer', true);
      
      // Set match found flag
      this.matchFound = true;
      
      // Stop waiting animation
      this.waitingAnimation.stop();
      
      // Flash effect
      this.cameras.main.flash(500, 0, 255, 255);
      
      // Let host know we're both ready, to synchronize game start
      if (!this.isHost) {
        // Delay slightly to ensure we've fully joined the room first
        setTimeout(() => {
          console.log("Player 2 sending playerReady signal");
          this.socket.emit('playerReady', { sessionId: this.sessionId });
        }, 500);
      }
    });
    
    // Ready to start game event (sent when both players are ready)
    this.socket.on('startGame', () => {
      console.log('Both players ready, starting game');
      this.scene.start('GameScene');
    });
    
    // Server full event
    this.socket.on('serverFull', () => {
      console.log('Server is full, using local fallback');
      this.debugText.setText(`Debug: Server full | Using local fallback mode`);
      
      // Fall back to localStorage-based matchmaking
      if (this.registry.get('forceHost')) {
        this.becomeHost();
      } else {
        this.checkForAvailableHosts();
      }
    });
  }
  
  create() {
    // Set background color
    this.cameras.main.setBackgroundColor(0x120326);
    
    // Add title text
    const titleText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.2,
      'WAITING FOR PLAYER',
      {
        fontFamily: 'Tektur',
        fontSize: '36px',
        color: '#ff00ff',
        stroke: '#000000',
        strokeThickness: 6
      }
    );
    titleText.setOrigin(0.5);
    
    // Add debug text at the bottom of the screen
    this.debugText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.95,
      'Debug: Initializing...',
      {
        fontFamily: 'Tektur',
        fontSize: '12px',
        color: '#888888'
      }
    );
    this.debugText.setOrigin(0.5);
    
    // Create waiting text with animated dots
    this.waitingText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.3,
      'Searching for opponent...',
      {
        fontFamily: 'Tektur',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }
    );
    this.waitingText.setOrigin(0.5);
    
    // Get the selected character
    const selectedCharacter = this.registry.get('selectedCharacter') || 'default';
    
    // Set the texture prefix based on the selected character
    const prefix = selectedCharacter === 'default' ? '' : `${selectedCharacter}_`;
    
    // Create player sprite
    this.waitingPlayer = this.add.sprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.6,
      `${prefix}down_idle_1`
    );
    this.waitingPlayer.setScale(1);
    
    // Create waiting animation
    this.waitingAnimation = this.tweens.add({
      targets: this.waitingPlayer,
      y: this.waitingPlayer.y - 20,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Add cancel button
    this.cancelButton = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.85,
      200, 50,
      0xaa0000
    );
    this.cancelButton.setInteractive({ useHandCursor: true });
    
    const cancelText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.85,
      'CANCEL',
      {
        fontFamily: 'Tektur',
        fontSize: '24px',
        color: '#ffffff'
      }
    );
    cancelText.setOrigin(0.5);
    
    // Add hover effect
    this.cancelButton.on('pointerover', () => {
      this.cancelButton.fillColor = 0xff0000;
      cancelText.setScale(1.1);
    });
    
    this.cancelButton.on('pointerout', () => {
      this.cancelButton.fillColor = 0xaa0000;
      cancelText.setScale(1);
    });
    
    // Return to menu on cancel
    this.cancelButton.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
    
    // Set up the socket.io connection for multiplayer
    this.setupSocketConnection();
    
    // Generate a truly unique player ID with timestamp
    this.playerId = 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    this.isHost = false; // Default to not being host
    this.matchFound = false;
    
    // Set up the multiplayer event emitter (as fallback only)
    const multiplayerEvents = new Phaser.Events.EventEmitter();
    this.registry.set('multiplayerEvents', multiplayerEvents);
    
    // Get game code if any
    const gameCode = this.registry.get('gameCode');
    const randomMatch = this.registry.get('randomMatch');
    
    // Display game code on screen if available
    if (gameCode) {
      this.waitingText.setText(`Game code: ${gameCode}`);
    }
    
    // Clean up the lobby when the scene is shut down
    this.events.on('shutdown', this.cleanupLobby, this);
  }
  
  // Become the host player (fallback method)
  becomeHost(gameCode) {
    this.isHost = true;
    
    // If we have a game code, use it in the sessionId
    if (gameCode) {
      this.sessionId = 'code_' + gameCode + '_' + Date.now();
    } else {
      // Make sessionId more unique by adding a random component
      this.sessionId = 'session_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    }
    
    // Update debug text
    if (this.debugText) {
      const codeInfo = gameCode ? ` | Code: ${gameCode}` : '';
      this.debugText.setText(`Debug: Host mode (local) | SessionID: ${this.sessionId.substring(0, 10)}...${codeInfo}`);
    }
    
    console.log(`BECAME HOST: SessionID=${this.sessionId}, PlayerID=${this.playerId}, GameCode=${gameCode || 'NONE'}`);
  }
  
  // Check for available hosts (fallback method)
  checkForAvailableHosts() {
    if (this.matchFound) return; // Skip if we already found a match
    
    console.log("Checking for available hosts (fallback mode)...");
    
    // In fallback mode, become the host
    this.becomeHost();
    
    // Simulate finding a match after a delay
    this.time.delayedCall(3000, () => {
      if (!this.matchFound) {
        console.log("Simulating match found in fallback mode");
        
        // Store in registry
        this.registry.set('isHost', this.isHost);
        this.registry.set('playerId', this.playerId);
        this.registry.set('sessionId', this.sessionId);
        this.registry.set('multiplayer', true);
        
        // Set match found flag
        this.matchFound = true;
        
        // Show match found message
        this.waitingText.setText('Match found! Starting game...');
        
        // Stop waiting animation
        this.waitingAnimation.stop();
        
        // Flash effect
        this.cameras.main.flash(500, 0, 255, 255);
        
        // Start game after a short delay
        this.time.delayedCall(1500, () => {
          this.scene.start('GameScene');
        });
      }
    });
  }
  
  // Clean up when leaving the scene
  cleanupLobby() {
    // Disconnect socket if it exists
    if (this.socket && this.socket.connected) {
      console.log("Disconnecting from socket.io server");
      this.socket.disconnect();
    }
  }
  
  update(time, delta) {
    // Update loading dots animation
    this.lobbyTimer += delta;
    
    if (this.lobbyTimer > 500) {
      this.lobbyTimer = 0;
      this.dotCount = (this.dotCount + 1) % 4;
      this.loadingDots = '.'.repeat(this.dotCount);
      
      if (!this.matchFound) {
        this.waitingText.setText(`Searching for opponent${this.loadingDots}`);
      }
    }
  }
}