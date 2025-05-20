import { GAME_WIDTH, GAME_HEIGHT, WEB3_CONFIG } from '../../config.js';

export class CoopHostScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CoopHostScene' });
    this.waitingText = null;
    this.waitingPlayer = null;
    this.waitingAnimation = null;
    this.lobbyTimer = 0;
    this.playerId = null;
    this.socket = null;
    this.totalPlayers = 0;
    this.debugText = null;
    this.cancelButton = null;
    this.isAlreadyStarted = false;
  }

  create() {
    // Set background color
    this.cameras.main.setBackgroundColor(0x120326);

    // Create debug text
    this.debugText = this.add.text(10, 10, '', {
      font: '16px Arial',
      fill: '#ffffff'
    });

    // Create waiting text
    this.waitingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      font: '32px Arial',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // Create cancel button
    this.cancelButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, 'Cancel', {
      font: '24px Arial',
      fill: '#ffffff'
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        this.cleanupLobby();
        this.scene.start('MenuScene');
      });

    // Set up socket connection
    this.setupSocketConnection();

    // Start loading animation
    this.startLoadingAnimation();
  }

  setupSocketConnection() {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Connect to the socket.io server
    console.log('Connecting to socket.io server');
    this.socket = io('http://localhost:9031', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000
    });

    // Connection established
    this.socket.on('connect', () => {
      console.log('Connected to matchmaking server with id:', this.socket.id);
      this.debugText.setText(`Debug: Connected to server | Socket ID: ${this.socket.id.substring(0, 8)}...`);

      // Initialize player ID
      this.playerId = this.socket.id;

      // Register with server
      this.socket.emit('coop_hostPlayer', {
        playerId: this.playerId
      });
    });

    // Game start event from server
    this.socket.on('gameStart', (data) => {
      if(!(this.registry.get('isGameStarted') || false)) {
        console.log('Game starting with players:', data.players);
        this.startGame();
        this.registry.set('isGameStarted', true);
      }
    });

    // Player disconnected event
    this.socket.on('playerDisconnected', (data) => {
      console.log('Player disconnected:', data);
      // this.totalPlayers = data.totalPlayers;
      // this.updateWaitingText();

      // // If we're in game and players drop below 2, return to menu
      // if (this.totalPlayers < 2) {
      //   this.showDisconnectMessage();
      // }
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.debugText.setText(`Debug: Connection error - ${error.message}`);
      this.showConnectionError();
    });

    // Reconnection attempts
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
      this.debugText.setText(`Debug: Reconnecting... Attempt ${attemptNumber}`);
    });

    // Reconnection failed
    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to server');
      this.debugText.setText('Debug: Failed to reconnect');
      this.showConnectionError();
    });

    // Handle reconnection
    this.socket.on('reconnect', () => {
      console.log('Reconnected to server');
      this.debugText.setText('Debug: Reconnected to server');

      // Re-register with server
      this.socket.emit('registerPlayer', {
        playerId: this.playerId
      });
    });
  }

  updateWaitingText() {
    this.waitingText.setText(`Waiting for players...\nPlayers: ${this.totalPlayers}/2`);
  }

  startLoadingAnimation() {
    this.loadingDots = '';
    this.dotCount = 0;
    this.waitingAnimation = this.time.addEvent({
      delay: 500,
      callback: () => {
        this.dotCount = (this.dotCount + 1) % 4;
        this.loadingDots = '.'.repeat(this.dotCount);
        this.updateWaitingText();
      },
      loop: true
    });
  }

  showDisconnectMessage() {
    this.waitingText.setText('Not enough players\nReturning to menu...');
    this.time.delayedCall(2000, () => {
      this.cleanupLobby();
      this.scene.start('MenuScene');
    });
  }

  showConnectionError() {
    this.waitingText.setText('Connection error\nReturning to menu...');
    this.time.delayedCall(2000, () => {
      this.cleanupLobby();
      this.scene.start('MenuScene');
    });
  }

  cleanupLobby() {
    // Only disconnect socket if we're returning to menu
    if (this.waitingAnimation) {
      this.waitingAnimation.destroy();
    }
  }

  startGame() {
    // Don't disconnect socket when starting game
    if (this.waitingAnimation) {
      this.waitingAnimation.destroy();
    }

    // Pass the socket to the multiplayer game scene
    this.scene.start('MultiplayerGameScene', {
      socket: this.socket
    });
  }

  update(time, delta) {
    this.lobbyTimer += delta;
  }
}