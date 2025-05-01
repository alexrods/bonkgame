export class EnemyCollisions {
  constructor(scene) {
    this.scene = scene;
  }

  // Custom collision check for bullet-enemy collisions using the enemy's oval.
  checkBulletEnemyCollision(bullet, enemy) {
    // Log if bullet is not active or visible
    if (!bullet.active) {
      //console.warn(`Collision check failed: Bullet not active at (${bullet.x}, ${bullet.y})`);
      return false;
    }
    
    if (!bullet.visible) {
      //console.warn(`Collision check failed: Bullet not visible at (${bullet.x}, ${bullet.y})`);
      return false;
    }
    
    // More detailed validation
    if (!bullet.body) {
      console.warn(`Collision check failed: Bullet has no physics body at (${bullet.x}, ${bullet.y})`);
      return false;
    }
    
    if (!enemy.body) {
      console.warn(`Collision check failed: Enemy has no physics body at (${enemy.x}, ${enemy.y})`);
      return false;
    }
    
    if (!enemy.active) {
      //console.warn(`Collision check failed: Enemy not active at (${enemy.x}, ${enemy.y})`);
      return false;
    }
    
    if (!enemy.oval) {
      console.warn('Enemy oval is undefined in collision check');
      return false;
    }
    
    // Use a more generous collision area for better hit detection
    const expandedRadiusX = enemy.oval.radiusX + 8; // Increased from 5 to 8
    const expandedRadiusY = enemy.oval.radiusY + 8; // Increased from 5 to 8
    
    const dx = bullet.x - enemy.x;
    const dy = bullet.y - enemy.y;
    const normalizedDistance = Math.pow(dx / expandedRadiusX, 2) + Math.pow(dy / expandedRadiusY, 2);
    
    // Debug log for close bullet-enemy interactions (but not too frequently)
    if (normalizedDistance <= 1.5 && Math.random() < 0.2) {
      console.log(`Bullet near enemy: Normalized distance = ${normalizedDistance.toFixed(2)}`);
    }
    
    // Detect hit when bullet is within the expanded oval
    return normalizedDistance <= 1;
  }

  // Custom collision check for player-enemy using elliptical hitboxes.
  checkPlayerEnemyCollision(player, enemy) {
    if (!player.body || !enemy.body || !player.active || !enemy.active || enemy.isAttacking || enemy.isDying) return false;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const theta = Math.atan2(dy, dx);
    const playerEffective = (player.oval.radiusX * player.oval.radiusY) /
      Math.sqrt(Math.pow(player.oval.radiusY * Math.cos(theta), 2) + Math.pow(player.oval.radiusX * Math.sin(theta), 2));
    const enemyEffective = (enemy.oval.radiusX * enemy.oval.radiusY) /
      Math.sqrt(Math.pow(enemy.oval.radiusY * Math.cos(theta), 2) + Math.pow(enemy.oval.radiusX * Math.sin(theta), 2));
    return d <= (playerEffective + enemyEffective);
  }
}