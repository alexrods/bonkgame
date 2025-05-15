import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

export class MultiplayerPlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.player = null;
    this.lastShotTime = 0;
    this.fireRate = 250; // Default fire rate in ms
    this.bullets = null;
    this.cursors = null;
    this.wasd = null;
    this.shootingDirection = { x: 0, y: 0 };
    this.lastDirection = 'side';
  }

  createPlayer() {
    // Create player sprite
    this.player = this.scene.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'side_idle_1');
    this.player.setScale(0.5);
    this.player.setCollideWorldBounds(true);
    this.player.health = 100;
    this.player.score = 0;
    this.player.playerId = this.scene.socket.id;
    this.player.isLocalPlayer = true;
    
    // Create bullet group
    this.createBulletGroup();

    // Setup keyboard controls
    this.setupKeyboardControls();

    // Create animations
    this.createAnimations();
    
    return this.player;
  }

  createAnimations() {
    // Create idle animation
    this.scene.anims.create({
      key: 'player_idle',
      frames: [
        { key: 'side_idle_1' },
        { key: 'side_idle_2' },
        { key: 'side_idle_3' },
        { key: 'side_idle_4' }
      ],
      frameRate: 8,
      repeat: -1
    });

    // Create run animation
    this.scene.anims.create({
      key: 'player_run',
      frames: [
        { key: 'side_walk_1' },
        { key: 'side_walk_2' },
        { key: 'side_walk_3' },
        { key: 'side_walk_4' }
      ],
      frameRate: 12,
      repeat: -1
    });

    // Play idle animation by default
    this.player.play('player_idle');
  }

  setupKeyboardControls() {
    // Setup keyboard controls for player movement
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    
    // Add WASD controls
    this.wasd = {
      up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
  }

  createBulletGroup() {
    // Create group for bullets
    this.bullets = this.scene.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 30,
      allowGravity: false,
      runChildUpdate: true,
      collideWorldBounds: false,
      classType: Phaser.Physics.Arcade.Sprite
    });
  }

  update() {
    if (!this.player) return;

    // Handle movement
    this.handleMovement();

    // Handle shooting
    this.handleShooting();

    // Clean up bullets
    this.cleanupBullets();
  }

  handleMovement() {
    if (!this.player || !this.player.active) return;

    // Reset velocity
    this.player.setVelocity(0);

    // Handle WASD movement
    const speed = 200;
    let isMoving = false;

    if (this.wasd.left.isDown) {
      this.player.setVelocityX(-speed);
      this.lastDirection = 'side';
      this.player.flipX = true;
      isMoving = true;
    } else if (this.wasd.right.isDown) {
      this.player.setVelocityX(speed);
      this.lastDirection = 'side';
      this.player.flipX = false;
      isMoving = true;
    }

    if (this.wasd.up.isDown) {
      this.player.setVelocityY(-speed);
      if (this.lastDirection === 'side') {
        this.lastDirection = this.player.flipX ? 'up_corner' : 'up_corner';
      } else {
        this.lastDirection = 'up';
      }
      isMoving = true;
    } else if (this.wasd.down.isDown) {
      this.player.setVelocityY(speed);
      if (this.lastDirection === 'side') {
        this.lastDirection = this.player.flipX ? 'down_corner' : 'down_corner';
      } else {
        this.lastDirection = 'down';
      }
      isMoving = true;
    }

    // Update animation based on movement and direction
    if (isMoving) {
      if (this.lastDirection === 'side') {
        this.player.play('side_walk', true);
      } else if (this.lastDirection === 'down') {
        this.player.play('down_walk', true);
      } else if (this.lastDirection === 'up') {
        this.player.play('up_walk', true);
      } else if (this.lastDirection === 'down_corner') {
        this.player.play('down_corner_walk', true);
      } else if (this.lastDirection === 'up_corner') {
        this.player.play('up_corner_walk', true);
      }

        // Emit player state update
        if (this.scene.socket) {
            this.scene.socket.emit('playerUpdate', {
            x: this.player.x,
            y: this.player.y,
            health: this.player.health,
            score: this.player.score,
            isMoving: isMoving,
            direction: this.lastDirection,
            flipX: this.player.flipX
            });
        }
    } else {
      if (this.lastDirection === 'side') {
        this.player.play('side_idle', true);
      } else if (this.lastDirection === 'down') {
        this.player.play('down_idle', true);
      } else if (this.lastDirection === 'up') {
        this.player.play('up_idle', true);
      } else if (this.lastDirection === 'down_corner') {
        this.player.play('down_corner_idle', true);
      } else if (this.lastDirection === 'up_corner') {
        this.player.play('up_corner_idle', true);
      }
    }
  }

  handleShooting() {
    if (!this.player || !this.player.active) return;

    // Handle arrow key shooting
    if (this.cursors.left.isDown) {
      this.shoot('left');
    } else if (this.cursors.right.isDown) {
      this.shoot('right');
    } else if (this.cursors.up.isDown) {
      this.shoot('up');
    } else if (this.cursors.down.isDown) {
      this.shoot('down');
    }
  }

  shoot(direction) {
    if (!this.player || !this.player.active) return;

    // Get player position
    const x = this.player.x;
    const y = this.player.y;

    // Calculate bullet position and angle based on direction
    let angle = 0;
    let bulletX = x;
    let bulletY = y;

    switch (direction) {
      case 'left':
        angle = Math.PI;
        bulletX -= 20;
        break;
      case 'right':
        angle = 0;
        bulletX += 20;
        break;
      case 'up':
        angle = -Math.PI / 2;
        bulletY -= 20;
        break;
      case 'down':
        angle = Math.PI / 2;
        bulletY += 20;
        break;
    }

    // Create bullet
    const bullet = this.bullets.get();
    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.setPosition(bulletX, bulletY);
      bullet.angle = Phaser.Math.RadToDeg(angle);

      // Set bullet velocity
      const speed = 800;
      bullet.body.velocity.x = Math.cos(angle) * speed;
      bullet.body.velocity.y = Math.sin(angle) * speed;

      // Emit bullet spawn event
      if (this.scene.socket) {
        console.log('Emitting bulletSpawned event:', {
          x: bulletX,
          y: bulletY,
          angle: angle,
          direction: direction
        });
        this.scene.socket.emit('bulletSpawned', {
          x: bulletX,
          y: bulletY,
          angle: angle,
          direction: direction
        });

        // Also emit player state update after shooting
        this.scene.socket.emit('playerUpdate', {
          x: this.player.x,
          y: this.player.y,
          health: this.player.health,
          score: this.player.score,
          isMoving: this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0,
          direction: this.lastDirection,
          flipX: this.player.flipX,
          isShooting: true,
          shootingDirection: direction
        });
      }

      // Destroy bullet after 1 second
      this.scene.time.delayedCall(1000, () => {
        if (bullet.active) {
          bullet.setActive(false);
          bullet.setVisible(false);
        }
      });
    }
  }

  cleanupBullets() {
    if (!this.bullets) return;

    // Remove off-screen bullets
    const buffer = 200;
    this.bullets.children.each(bullet => {
      if (bullet.active && 
          (bullet.x < -buffer || 
           bullet.x > GAME_WIDTH + buffer || 
           bullet.y < -buffer || 
           bullet.y > GAME_HEIGHT + buffer)) {
        bullet.setActive(false);
        bullet.setVisible(false);
      }
    });
  }

  createRemotePlayer(playerId) {
    // Create remote player sprite
    const remotePlayer = this.scene.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'player_idle');
    
    // Set remote player properties
    remotePlayer.setCollideWorldBounds(true);
    remotePlayer.health = 100;
    remotePlayer.score = 0;
    remotePlayer.playerId = playerId;
    
    // Make remote player slightly transparent
    remotePlayer.setAlpha(0.8);
    
    // Set default animation
    remotePlayer.play('player_idle');
    
    return remotePlayer;
  }

  handlePlayerHit(damage) {
    if (!this.player) return;
    
    this.player.health -= damage;
    
    // Emit hit event
    this.scene.events.emit('playerHit', {
      health: this.player.health
    });
    
    return this.player.health <= 0;
  }

  resetPlayer() {
    if (!this.player) return;
    
    this.player.health = 100;
    this.player.x = GAME_WIDTH / 2;
    this.player.y = GAME_HEIGHT / 2;
    this.player.setVelocity(0);
  }
} 