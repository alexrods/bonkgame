import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';
import { MultiplayerPlayerManager } from '../managers/MultiplayerPlayerManager.js';
import { PlayerManager } from '../managers/PlayerManager.js';
import { preloadSprites } from '../utils/AssetLoader.js';
import { createBulletTexture } from '../utils/TextureGenerator.js';
import { createAnimations } from '../utils/Animations.js';

export class MultiplayerGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MultiplayerGameScene' });
    this.player = null;
    this.remotePlayers = new Map();
    this.socket = null;
    this.debugText = null;
  }

  init(data) {
    this.socket = data.socket;
    if (!this.socket) {
      console.error('No socket connection provided for multiplayer game');
      this.scene.start('MenuScene');
      return;
    }
  }

  preload() {
    // Add loading text
    const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Loading...', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Load all game sprites
    preloadSprites(this);

    // Create bullet texture
    createBulletTexture(this);

    // Load bullet sprite
    this.load.image('bullet', 'assets/bullet.png');
  }

  create() {
    // Create all animations
    createAnimations(this);

    // Create player manager
    this.playerManager = new MultiplayerPlayerManager(this);

    // Create player
    this.player = this.playerManager.createPlayer();

    if (this.player) {
      // Setup camera to follow player
      this.cameras.main.startFollow(this.player, true);

      // Setup multiplayer events
      this.setupMultiplayerEvents();


      // Setup player collision
      this.setupPlayerCollision();

      // Create debug text
      this.createDebugText();
    } else {
      console.error('Player not created properly');
      this.scene.start('MenuScene');
    }
  }


  setupPlayerCollision() {
    // Add collision between players
    this.physics.add.collider(this.player, Array.from(this.remotePlayers.values()));

    // Add collision between remote players
    const remotePlayers = Array.from(this.remotePlayers.values());
    for (let i = 0; i < remotePlayers.length; i++) {
      for (let j = i + 1; j < remotePlayers.length; j++) {
        this.physics.add.collider(remotePlayers[i], remotePlayers[j]);
      }
    }

    // Add collision between bullets and players
    this.physics.add.overlap(
      this.playerManager.bullets,
      Array.from(this.remotePlayers.values()),
      this.handleBulletHit,
      null,
      this
    );
  }

  handleBulletHit(bullet, player) {
    if (!bullet || !player || !bullet.active || !player.active) return;

    // Prevent multiple damage events from the same bullet
    if (bullet.hasDealtDamage) return;

    // Mark bullet as having dealt damage
    bullet.hasDealtDamage = true;

    // Apply damage to player
    const damage = 10; // Base damage
    const isDefeated = this.playerManager.handlePlayerHit(damage);

    // Emit hit event
    this.socket.emit('playerHit', {
      playerId: player.playerId,
      damage: damage,
      isDefeated: isDefeated
    });

    // Deactivate bullet
    bullet.setActive(false);
    bullet.setVisible(false);
  }

  setupMultiplayerEvents() {
    // Handle initial player list
    this.socket.on('currentPlayers', (players) => {
      console.log('Received current players:', players);
      players.forEach(player => {
        if (player.id !== this.socket.id) {
          this.updateRemotePlayer({
            playerId: player.id,
            x: player.x || GAME_WIDTH / 2,
            y: player.y || GAME_HEIGHT / 2,
            health: player.health || 100,
            score: player.score || 0,
            isMoving: false,
            direction: 'side'
          });
        }
      });
    });

    // Handle player movement updates
    this.socket.on('playerUpdate', (data) => {
      console.log('Received playerUpdate:', data);
      if (data.playerId !== this.socket.id) {
        this.updateRemotePlayer(data);
      }
    });

    // Handle remote bullet spawn
    this.socket.on('bulletSpawned', (data) => {
      console.log('Received bulletSpawned:', data);
      if (data.playerId !== this.socket.id) {
        this.spawnRemoteBullet(data);
      }
    });

    // Handle player disconnection
    this.socket.on('playerDisconnected', (playerId) => {
      console.log('Player disconnected:', playerId);
      const remotePlayer = this.remotePlayers.get(playerId);
      if (remotePlayer) {
        remotePlayer.destroy();
        this.remotePlayers.delete(playerId);
      }
    });

    // Handle player hit
    this.socket.on('playerHit', (data) => {
      console.log('Player hit:', data);
      if (data.playerId === this.socket.id) {
        // Handle local player hit
        this.playerManager.handlePlayerHit(data.damage);
      }
    });

    // Handle player defeat
    this.socket.on('playerDefeated', (data) => {
      console.log('Player defeated:', data);
      if (data.defeatedId === this.socket.id) {
        // Handle local player defeat
        this.handlePlayerDefeat();
      }
    });

    // Log socket connection status
    this.socket.on('connect', () => {
      console.log('Socket connected with ID:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Request current players list
    this.socket.emit('getCurrentPlayers');
  }

  spawnRemoteBullet(data) {
    console.log('Spawning remote bullet:', data);
    const bullet = this.add.sprite(data.x, data.y, 'bullet');
    bullet.setScale(0.5);
    bullet.angle = Phaser.Math.RadToDeg(data.angle);

    // Enable physics on the bullet
    this.physics.world.enable(bullet);
    bullet.body.setCollideWorldBounds(true);

    // Set bullet velocity
    const speed = 800;
    bullet.body.velocity.x = Math.cos(data.angle) * speed;
    bullet.body.velocity.y = Math.sin(data.angle) * speed;

    // Add collision with local player
    this.physics.add.overlap(bullet, this.player, (bullet, player) => {
      if (bullet.active && player.active) {
        // Handle bullet hit
        this.handleBulletHit(bullet, player);
      }
    });

    // Destroy bullet after 1 second
    this.time.delayedCall(1000, () => {
      if (bullet.active) {
        bullet.destroy();
      }
    });
  }

  updateRemotePlayer(data) {
    console.log('Updating remote player:', data);
    let remotePlayer = this.remotePlayers.get(data.playerId);

    if (!remotePlayer) {
      console.log('Creating new remote player for ID:', data.playerId);
      // Create new remote player if it doesn't exist
      remotePlayer = this.physics.add.sprite(data.x, data.y, 'side_idle_1');
      remotePlayer.setScale(0.5);
      remotePlayer.setCollideWorldBounds(true);
      remotePlayer.playerId = data.playerId;
      remotePlayer.health = data.health || 100;
      remotePlayer.score = data.score || 0;
      remotePlayer.isLocalPlayer = false;

      // Play idle animation by default
      remotePlayer.play('side_idle');

      this.remotePlayers.set(data.playerId, remotePlayer);
      this.setupPlayerCollision(); // Update collisions when new player joins
    }

    // Update remote player position and rotation
    remotePlayer.x = data.x;
    remotePlayer.y = data.y;
    remotePlayer.flipX = data.flipX;
    remotePlayer.health = data.health;
    remotePlayer.score = data.score;

    // Update animation based on movement and direction
    if (data.isMoving) {
      if (data.direction === 'side') {
        remotePlayer.play('side_walk', true);
      } else if (data.direction === 'down') {
        remotePlayer.play('down_walk', true);
      } else if (data.direction === 'up') {
        remotePlayer.play('up_walk', true);
      } else if (data.direction === 'down_corner') {
        remotePlayer.play('down_corner_walk', true);
      } else if (data.direction === 'up_corner') {
        remotePlayer.play('up_corner_walk', true);
      }
    } else {
      if (data.direction === 'side') {
        remotePlayer.play('side_idle', true);
      } else if (data.direction === 'down') {
        remotePlayer.play('down_idle', true);
      } else if (data.direction === 'up') {
        remotePlayer.play('up_idle', true);
      } else if (data.direction === 'down_corner') {
        remotePlayer.play('down_corner_idle', true);
      } else if (data.direction === 'up_corner') {
        remotePlayer.play('up_corner_idle', true);
      }
    }

    // Handle shooting state
    if (data.isShooting) {
      // You can add shooting animation or effects here if needed
      console.log('Remote player shooting:', data.shootingDirection);
    }
  }

  updateRemotePlayerState(data) {
    const remotePlayer = this.remotePlayers.get(data.playerId);
    if (remotePlayer) {
      remotePlayer.health = data.health;
      remotePlayer.score = data.score;
    }
  }

  handlePlayerDefeat() {
    // Reset player
    this.playerManager.resetPlayer();

    // Emit player respawn event
    this.socket.emit('playerRespawn');
  }

  createDebugText() {
    this.debugText = this.add.text(10, 10, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff'
    });
  }

  update() {
    if (!this.player) return;

    // Update player manager
    this.playerManager.update();

    // Send player state to server
    // if (this.socket) {
    //   const playerState = {
    //     x: this.player.x,
    //     y: this.player.y,
    //     flipX: this.player.flipX,
    //     health: this.player.health,
    //     score: this.player.score,
    //     isMoving: this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0,
    //     direction: this.playerManager.lastDirection
    //   };
    //   console.log('Sending player state:', playerState);
    //   this.socket.emit('playerUpdate', playerState);
    // }

    // Update debug text
    if (this.debugText) {
      this.debugText.setText([
        `Health: ${this.player.health}`,
        `Score: ${this.player.score}`,
        `Remote Players: ${this.remotePlayers.size}`,
        `Socket ID: ${this.socket ? this.socket.id : 'Not connected'}`
      ]);
    }
  }
} 