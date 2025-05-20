import { GAME_WIDTH, GAME_HEIGHT, WEB3_CONFIG, VERSUS_MODE_COST } from '../../config.js';
import { setCreditCount } from '../utils/api.js';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
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
    // Set up socket connection
    this.setupSocketConnection();

    // Set background color
    this.cameras.main.setBackgroundColor(0x000);

    // Create debug text
    this.debugText = this.add.text(10, 10, '', {
      font: '16px Arial',
      fill: '#ffffff'
    });

    // Create waiting text
    this.waitingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `You will lose ${VERSUS_MODE_COST} credits for this game`, {
      font: '32px Arial',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // Create cancel button
    this.cancelButton = this.add.text(GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2 + 100, 'Cancel', {
      font: '24px Arial',
      fill: '#ffffff'
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        this.cleanupLobby();
        this.scene.start('MenuScene');
      });

    // Create cancel button
    this.confirmButton = this.add.text(GAME_WIDTH / 2 + 100, GAME_HEIGHT / 2 + 100, 'Confirm', {
      font: '24px Arial',
      fill: '#ffffff'
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        this.cleanupLobby();
        this.socket.emit('confirmPlayer', {
          playerId: this.playerId
        });
      });
  }

  setupSocketConnection() {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Connect to the socket.io server
    // Get the base URL from environment variable and remove the '/api' suffix
    const baseURL = import.meta.env.VITE_BASE_API_URL.replace('/api', '');
    console.log('Connecting to socket.io server at:', baseURL);
    this.socket = io(baseURL, {
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
      this.socket.emit('registerPlayer', {
        playerId: this.playerId
      });
    });

    // Game start event from server
    this.socket.on('gameStart', (data) => {
      if (!(this.registry.get('isGameStarted') || false)) {
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
    const existingAccount = this.registry.get("playerAccount");
    existingAccount.gameAccountBalance -= VERSUS_MODE_COST;
    setCreditCount(existingAccount.authToken, existingAccount.gameAccountBalance);
    this.registry.set('playerAccount', existingAccount);

    // Pass the socket to the multiplayer game scene
    this.scene.start('MultiplayerGameScene', {
      socket: this.socket
    });
  }

  update(time, delta) {
    this.lobbyTimer += delta;
  }
}