import { GAME_WIDTH, GAME_HEIGHT, WEB3_CONFIG } from '../../config.js';
import { setCreditCount } from '../utils/api.js';


export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.waitingText = null;
    this.waitingPlayer = null;
    this.lobbyTimer = 0;
    this.playerId = null;
    this.sessionId = null;
    this.loadingDots = '';
    this.dotCount = 0;
    this.cancelButton = null;
    this.isAlreadyStarted = false;
  }

  create() {
    // Set up socket connection
    this.setupSocketConnection();

    /*
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
    */

    this.scanlines = this.createScanlines();
    this.scanlines.setDepth(1000);
    // Create a container for the dialog
    const dialogContainer = this.add.container(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2
    );

    // Create dialog background
    const dialogBg = this.add.rectangle(0, 0, 400, 400, 0x330033, 0.9);
    dialogBg.setStrokeStyle(2, 0x00ffff);
    dialogContainer.add(dialogBg);

    // Create dialog title
    const title = this.add.text(0, -170, "SELECT ROOM", {
      fontFamily: "Tektur, Arial",
      fontSize: "24px",
      color: "#00ffff",
      align: "center",
    });
    title.setOrigin(0.5);
    dialogContainer.add(title);

    // Create 10K Room button
    const K10Room = this.add.rectangle(0, -100, 250, 60, 0x006699, 0.8);
    K10Room.setStrokeStyle(2, 0xffffff);
    dialogContainer.add(K10Room);

    const K10Text = this.add.text(0, -100, "10K Room", {
      fontFamily: "Tektur, Arial",
      fontSize: "20px",
      color: "#ffffff",
    });
    K10Text.setOrigin(0.5);
    dialogContainer.add(K10Text);

    // Create 50K Room button
    const K50Room = this.add.rectangle(0, -10, 250, 60, 0x006699, 0.8);
    K50Room.setStrokeStyle(2, 0xffffff);
    dialogContainer.add(K50Room);

    const K50RoomText = this.add.text(0, -10, "50K Room", {
      fontFamily: "Tektur, Arial",
      fontSize: "20px",
      color: "#ffffff",
    });
    K50RoomText.setOrigin(0.5);
    dialogContainer.add(K50RoomText);

    // Create 100K Room button
    const K100Room = this.add.rectangle(0, 80, 250, 60, 0x006699, 0.8);
    K100Room.setStrokeStyle(2, 0xffffff);
    dialogContainer.add(K100Room);

    const K100RoomText = this.add.text(0, 80, "100K Room", {
      fontFamily: "Tektur, Arial",
      fontSize: "20px",
      color: "#ffffff",
    });
    K100RoomText.setOrigin(0.5);
    dialogContainer.add(K100RoomText);

    // Create cancel button
    const cancelButton = this.add.rectangle(0, 160, 150, 40, 0x333333, 0.8);
    cancelButton.setStrokeStyle(1, 0xaaaaaa);
    dialogContainer.add(cancelButton);

    const cancelText = this.add.text(0, 160, "CANCEL", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#aaaaaa",
    });
    cancelText.setOrigin(0.5);
    dialogContainer.add(cancelText);

    // Make buttons interactive
    K10Room.setInteractive({ useHandCursor: true });
    K50Room.setInteractive({ useHandCursor: true });
    K100Room.setInteractive({ useHandCursor: true });
    cancelButton.setInteractive({ useHandCursor: true });

    // Add hover effects
    K10Room.on("pointerover", () => {
      K10Room.fillColor = 0x00aaff;
      K10Text.setScale(1.1);
    });

    K10Room.on("pointerout", () => {
      K10Room.fillColor = 0x006699;
      K10Text.setScale(1);
    });

    K50Room.on("pointerover", () => {
      K50Room.fillColor = 0x00aaff;
      K50RoomText.setScale(1.1);
    });

    K50Room.on("pointerout", () => {
      K50Room.fillColor = 0x006699;
      K50RoomText.setScale(1);
    });

    K100Room.on("pointerover", () => {
      K100Room.fillColor = 0x00aaff;
      K100RoomText.setScale(1.1);
    });

    K100Room.on("pointerout", () => {
      K100Room.fillColor = 0x006699;
      K100RoomText.setScale(1);
    });

    cancelButton.on("pointerover", () => {
      cancelButton.fillColor = 0x555555;
      cancelText.setScale(1.1);
    });

    cancelButton.on("pointerout", () => {
      cancelButton.fillColor = 0x333333;
      cancelText.setScale(1);
    });

    const existingAccount = this.registry.get("playerAccount");

    K10Room.on("pointerdown", () => {
      if (existingAccount.gameAccountBalance < 10000) {
        this.showNotEnoughAccountBalanceWarning();
        return;
      }
      this.socket.emit('joinVersusGame', {
        playerId: this.playerId,
        roomId: 10
      });
    });

    K50Room.on("pointerdown", () => {
      if (existingAccount.gameAccountBalance < 50000) {
        this.showNotEnoughAccountBalanceWarning();
        return;
      }
      this.socket.emit('joinVersusGame', {
        playerId: this.playerId,
        roomId: 50
      });
    });

    K100Room.on("pointerdown", () => {
      if (existingAccount.gameAccountBalance < 100000) {
        this.showNotEnoughAccountBalanceWarning();
        return;
      }
      this.socket.emit('joinVersusGame', {
        playerId: this.playerId,
        roomId: 100
      });
    });

    cancelButton.on("pointerdown", () => {
      this.socket.close();
      this.registry.set('isGameStarted', false);
      this.scene.start('MenuScene');
    });

    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => {
      this.socket.close();
      this.registry.set('isGameStarted', false);
      this.scene.start('MenuScene');
    });
  }


  showNotEnoughAccountBalanceWarning() {
    // Check if warning already exists
    if (this.warningText) {
      // If it exists, reset the animation
      // this.warningText.destroy();
      // this.warningText = null;
      return;
    }
    // Calculate responsive font size for warning text
    const screenWidth = this.cameras.main.width;
    let warningFontSize = Math.max(20, Math.floor(screenWidth * 0.038)); // 3.8% of screen width, minimum 20px

    // Create warning text matching the style of other menu elements but in red
    this.warningText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height * 0.88, // Positioned below tutorial button
      "You do not have enough balance to play!",
      {
        fontFamily: "Arial Black", // Same as other menu text
        fontSize: `${warningFontSize}px`,
        color: "#ff0000", // Red text
        stroke: "#000000",
        strokeThickness: 6,
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: "#aa0000", // Darker red shadow
          blur: 5,
          stroke: true,
          fill: true,
        },
      }
    );
    this.warningText.setOrigin(0.5);

    // Just animate the warning text
    const warningElements = [this.warningText];

    // Add shaking animation to the warning text
    this.tweens.add({
      targets: warningElements,
      x: {
        from: this.cameras.main.width / 2 - 10,
        to: this.cameras.main.width / 2 + 10,
      },
      duration: 60,
      yoyo: true,
      repeat: 5,
      ease: "Sine.easeInOut",
    });

    // Fade out after 2 seconds
    this.warningFadeEvent = this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: warningElements,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          if (this.warningText) {
            this.warningText.destroy();
            this.warningText = null;
          }
        },
      });
    });
  }

  createScanlines() {
    const scanlineGraphics = this.add.graphics();
    scanlineGraphics.lineStyle(1, 0x000000, 0.2);

    // Draw horizontal lines across the screen
    for (let y = 0; y < this.cameras.main.height; y += 4) {
      scanlineGraphics.beginPath();
      scanlineGraphics.moveTo(0, y);
      scanlineGraphics.lineTo(this.cameras.main.width, y);
      scanlineGraphics.closePath();
      scanlineGraphics.strokePath();
    }

    return scanlineGraphics;
  }

  setupSocketConnection() {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Connect to the socket.io server
    console.log('Connecting to socket.io server');
    
    // Construir la URL de conexión
    const serverUrl = new URL(import.meta.env.VITE_BASE_API_URL);
    const wsProtocol = serverUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${serverUrl.host}`;
    
    console.log('WebSocket URL:', wsUrl);
    
    this.socket = io(wsUrl, {
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    
    // Manejar eventos de conexión/desconexión
    this.socket.on('connect_error', (error) => {
      console.error('Error de conexión Socket.IO:', error);
      this.showConnectionError();
    });

    // Connection established
    this.socket.on('connect', () => {
      console.log('Connected to matchmaking server with id:', this.socket.id);
      // this.debugText.setText(`Debug: Connected to server | Socket ID: ${this.socket.id.substring(0, 8)}...`);

      // Initialize player ID
      this.playerId = this.socket.id;

      // Register with server
      this.socket.emit('registerPlayer', {
        playerId: this.playerId
      });
    });

    // Game start event from server
    this.socket.on('versus_playerJoined', (data) => {
      console.log('versus_playerJoined event triggered', data);
      if (data.playerId != this.playerId) return;
      if (!(this.registry.get('isGameStarted') || false)) {
        this.startGame(data.roomId);
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

  startGame(roomId) {
    const existingAccount = this.registry.get("playerAccount");
    existingAccount.gameAccountBalance -= roomId * 1000;
    setCreditCount(existingAccount.authToken, existingAccount.gameAccountBalance);
    this.registry.set('playerAccount', existingAccount);

    // Pass the socket to the multiplayer game scene
    this.scene.start('MultiplayerGameScene', {
      socket: this.socket,
      roomId: roomId
    });
  }

  update(time, delta) {
    this.lobbyTimer += delta;
  }
}
