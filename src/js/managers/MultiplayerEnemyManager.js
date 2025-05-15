import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';
import { MultiplayerEnemy } from './MultiplayerEnemy.js';

export class MultiplayerEnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.bullets = null;
        this.enemies = [];
    }

    init() {
        // Initialize sound property
        this.createBulletGroup();
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

        // Add debug message
        console.log("Bullet group created, configured and ready");
    }

    cleanupBullets() {
        // Remove off-screen bullets - use a larger boundary to prevent premature cleanup
        // Add a 200px buffer to each dimension
        const buffer = 200;
        this.bullets.children.each(function (bullet) {
            if (bullet.active &&
                (bullet.x < -buffer ||
                    bullet.x > GAME_WIDTH + buffer ||
                    bullet.y < -buffer ||
                    bullet.y > GAME_HEIGHT + buffer)) {

                // Debug log removed
                bullet.setActive(false);
                bullet.setVisible(false);
                bullet.body.enable = false; // Disable physics body
            }
        }, this);

        // Log active bullet count occasionally for debugging
        // Debugging logs removed
    }

    // Used for bullet-enemy collision detection
    getBullets() {
        return this.bullets;
    }

    getEnemies() {
        return this.enemies;
    }

    addEnemy(enemy) {
        console.log("Adding enemy:", enemy);
        for(let i = 0; i < this.enemies.length; i++) {
            if(this.enemies[i].playerId == enemy.playerId) {
                console.log("Enemy already exists");
                return;
            }
        }
        const newEnemy = new MultiplayerEnemy(this.scene, enemy.playerId);
        newEnemy.createPlayer(enemy.x, enemy.y);
        console.log("New enemy created");
        this.enemies.push(newEnemy);
    }

    updateEnemyMovenment(data) {
        for (let i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].playerId == data.playerId) {
                this.enemies[i].handleMovement(data);
            }
        }
    }

    removeEnemy(playerId) {
        for (let i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].playerId === playerId) {
                this.enemies[i].handlePlayerDeath();
                this.enemies.splice(i, 1);
                return;
            }
        }
        console.log("Enemy removed");
    }

    getEnemyCount() {
        return this.enemies.length;
    }
}