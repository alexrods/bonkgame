// Creates all animations for the game.
export function createAnimations(scene) {
  // Get the selected character
  const selectedCharacter = scene.registry.get('selectedCharacter') || 'default';
  
  // Set the texture prefix based on the selected character
  // For default, use empty prefix; for others, use "character_"
  const prefix = selectedCharacter === 'default' ? '' : `${selectedCharacter}_`;
  
  // Log the selected character and prefix for debugging
  console.log(`Creating animations for character: ${selectedCharacter} with prefix: '${prefix}'`);

  // Check for attempts to recreate animations
  const existingAnims = Object.keys(scene.anims.anims.entries);
  console.log(`Existing animations: ${existingAnims.length}`);
  
  // Drone animation
  if (!scene.anims.exists('drone_hover')) {
    scene.anims.create({
      key: 'drone_hover',
      frames: [
        { key: 'drone_anim_1' },
        { key: 'drone_anim_2' },
        { key: 'drone_anim_3' },
        { key: 'drone_anim_4' },
        { key: 'drone_anim_5' },
        { key: 'drone_anim_6' }
      ],
      frameRate: 10,
      repeat: -1
    });
  }
  
  // Enemy drone animation
  if (!scene.anims.exists('enemy_drone_hover')) {
    scene.anims.create({
      key: 'enemy_drone_hover',
      frames: [
        { key: 'enemy_drone_anim_1' },
        { key: 'enemy_drone_anim_2' },
        { key: 'enemy_drone_anim_3' },
        { key: 'enemy_drone_anim_4' },
        { key: 'enemy_drone_anim_5' },
        { key: 'enemy_drone_anim_6' }
      ],
      frameRate: 10,
      repeat: -1
    });
  }
  
  // Function to create character animations with proper prefix handling
  function createCharacterAnimations(charPrefix = '') {
    // For animation keys (like "character2_down_idle")
    const animPrefix = charPrefix ? `${charPrefix}_` : '';
    
    // Log debug info
    console.log(`Creating animations with: charPrefix='${charPrefix}', animPrefix='${animPrefix}'`);
    
    // Check texture availability for debugging
    if (charPrefix) {
      // Log a few sample textures to verify they exist
      [
        `${charPrefix}_down_idle_1`, 
        `${charPrefix}_down_walk_1`, 
        `${charPrefix}_side_idle_1`
      ].forEach(texKey => {
        console.log(`Texture ${texKey} exists: ${scene.textures.exists(texKey)}`);
      });
    }
    
    // Check if this is character3 which has more idle frames
    // Note: character5 was intended to have 9 frames but only has 4 in the file system
    const hasExtraIdleFrames = charPrefix === 'character3';
    const idleFrameCount = hasExtraIdleFrames ? 9 : 4;
    const idleFrameRate = hasExtraIdleFrames ? 10 : 8; // Slightly faster framerate for more frames
    
    // Player animations - Down Idle
    const downIdleKey = `${animPrefix}down_idle`;
    if (!scene.anims.exists(downIdleKey)) {
      // Create array of frames based on how many this character has
      const downIdleFrames = [];
      for (let i = 1; i <= idleFrameCount; i++) {
        downIdleFrames.push({ key: `${charPrefix}${charPrefix ? '_' : ''}down_idle_${i}` });
      }
      
      scene.anims.create({
        key: downIdleKey,
        frames: downIdleFrames,
        frameRate: idleFrameRate,
        repeat: -1
      });
    }
    
    // Down Walk
    const downWalkKey = `${animPrefix}down_walk`;
    if (!scene.anims.exists(downWalkKey)) {
      scene.anims.create({
        key: downWalkKey,
        frames: [
          { key: `${charPrefix}${charPrefix ? '_' : ''}down_walk_1` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}down_walk_2` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}down_walk_3` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}down_walk_4` }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
    
    // Up Idle
    const upIdleKey = `${animPrefix}up_idle`;
    if (!scene.anims.exists(upIdleKey)) {
      // Create array of frames based on how many this character has
      const upIdleFrames = [];
      for (let i = 1; i <= idleFrameCount; i++) {
        upIdleFrames.push({ key: `${charPrefix}${charPrefix ? '_' : ''}up_idle_${i}` });
      }
      
      scene.anims.create({
        key: upIdleKey,
        frames: upIdleFrames,
        frameRate: idleFrameRate,
        repeat: -1
      });
    }
    
    // Up Walk
    const upWalkKey = `${animPrefix}up_walk`;
    if (!scene.anims.exists(upWalkKey)) {
      scene.anims.create({
        key: upWalkKey,
        frames: [
          { key: `${charPrefix}${charPrefix ? '_' : ''}up_walk_1` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}up_walk_2` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}up_walk_3` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}up_walk_4` }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
    
    // Side Idle
    const sideIdleKey = `${animPrefix}side_idle`;
    if (!scene.anims.exists(sideIdleKey)) {
      // Create array of frames based on how many this character has
      const sideIdleFrames = [];
      for (let i = 1; i <= idleFrameCount; i++) {
        sideIdleFrames.push({ key: `${charPrefix}${charPrefix ? '_' : ''}side_idle_${i}` });
      }
      
      scene.anims.create({
        key: sideIdleKey,
        frames: sideIdleFrames,
        frameRate: idleFrameRate,
        repeat: -1
      });
    }
    
    // Side Walk
    const sideWalkKey = `${animPrefix}side_walk`;
    if (!scene.anims.exists(sideWalkKey)) {
      scene.anims.create({
        key: sideWalkKey,
        frames: [
          { key: `${charPrefix}${charPrefix ? '_' : ''}side_walk_1` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}side_walk_2` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}side_walk_3` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}side_walk_4` }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
    
    // Down Corner Idle
    const downCornerIdleKey = `${animPrefix}down_corner_idle`;
    if (!scene.anims.exists(downCornerIdleKey)) {
      // Create array of frames based on how many this character has
      const downCornerIdleFrames = [];
      for (let i = 1; i <= idleFrameCount; i++) {
        downCornerIdleFrames.push({ key: `${charPrefix}${charPrefix ? '_' : ''}down_corner_idle_${i}` });
      }
      
      scene.anims.create({
        key: downCornerIdleKey,
        frames: downCornerIdleFrames,
        frameRate: idleFrameRate,
        repeat: -1
      });
    }
    
    // Down Corner Walk
    const downCornerWalkKey = `${animPrefix}down_corner_walk`;
    if (!scene.anims.exists(downCornerWalkKey)) {
      scene.anims.create({
        key: downCornerWalkKey,
        frames: [
          { key: `${charPrefix}${charPrefix ? '_' : ''}down_corner_walk_1` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}down_corner_walk_2` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}down_corner_walk_3` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}down_corner_walk_4` }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
    
    // Up Corner Idle
    const upCornerIdleKey = `${animPrefix}up_corner_idle`;
    if (!scene.anims.exists(upCornerIdleKey)) {
      // Create array of frames based on how many this character has
      const upCornerIdleFrames = [];
      for (let i = 1; i <= idleFrameCount; i++) {
        upCornerIdleFrames.push({ key: `${charPrefix}${charPrefix ? '_' : ''}up_corner_idle_${i}` });
      }
      
      scene.anims.create({
        key: upCornerIdleKey,
        frames: upCornerIdleFrames,
        frameRate: idleFrameRate,
        repeat: -1
      });
    }
    
    // Up Corner Walk
    const upCornerWalkKey = `${animPrefix}up_corner_walk`;
    if (!scene.anims.exists(upCornerWalkKey)) {
      scene.anims.create({
        key: upCornerWalkKey,
        frames: [
          { key: `${charPrefix}${charPrefix ? '_' : ''}up_corner_walk_1` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}up_corner_walk_2` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}up_corner_walk_3` },
          { key: `${charPrefix}${charPrefix ? '_' : ''}up_corner_walk_4` }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
    
    // We're keeping the run animation assets loaded for future use,
    // but not creating an animation for now to maintain consistency with other characters
    
    // Player death animation
    const playerDeathKey = `${animPrefix}player_death`;
    console.log(`Creating ${playerDeathKey} animation`);
    
    try {
      if (!scene.anims.exists(playerDeathKey)) {
        // Debugging - log available death-related textures
        console.log("Available death textures:", 
          Object.keys(scene.textures.list)
          .filter(key => key.includes('death') || key.includes('Dead'))
        );
        
        // Handle character3 and character5 with different frame count and naming
        const hasSpecialDeath = charPrefix === 'character3' || charPrefix === 'character5';
        const deathFrameCount = hasSpecialDeath ? 12 : 11; // character3 and character5 have 12 frames
        
        // Create proper frame keys based on how textures are named in AssetLoader.js
        const deathFrames = [];
        for (let i = 1; i <= deathFrameCount; i++) {
          deathFrames.push(`${charPrefix}${charPrefix ? '_' : ''}player_death_${i}`);
        }
        
        // Check if all frames exist
        let allFramesExist = true;
        deathFrames.forEach(frame => {
          if (!scene.textures.exists(frame)) {
            console.error(`Death animation frame ${frame} doesn't exist!`);
            allFramesExist = false;
          }
        });
        
        if (allFramesExist) {
          scene.anims.create({
            key: playerDeathKey,
            frames: deathFrames.map(key => ({ key })),
            frameRate: 15, 
            repeat: 0, // Play only once
            hideOnComplete: false // Keep the last frame visible when animation completes
          });
          console.log(`Successfully created ${playerDeathKey} animation with ${deathFrameCount} frames`);
        } else {
          console.error(`Not all death animation frames exist, ${playerDeathKey} animation not created`);
        }
      }
    } catch (e) {
      console.error(`Error creating ${playerDeathKey} animation:`, e);
    }
  } // End of createCharacterAnimations function
  
  // Create enemy animations only if they don't exist
  if (!scene.anims.exists('enemy_idle_down')) {
    // Define enemy types for animations
    const enemyTypes = ['', 'blue_', 'green_', 'gold_', 'blueElite_', 'greenElite_', 'goldElite_'];
    
    // Store enemy type mapping for use elsewhere in the game
    scene.registry.set('enemyTypeAnimPrefixes', enemyTypes);
    
    // Function to create standard enemy animations for a specific type
    function createEnemyAnimations(typePrefix = '') {
      // For standard grey enemies
      const greyDirections = ['down', 'up', 'right', 'right_down', 'right_up'];
      
      // For colored enemies
      const colorDirections = ['down', 'up', 'side', 'down_corner', 'up_corner'];
      
      // Use the appropriate direction set based on enemy type
      const directions = typePrefix === '' ? greyDirections : colorDirections;
      
      // Create idle animations for all directions
      directions.forEach(direction => {
        let animKey, frameNameBase;
        
        if (typePrefix === '') {
          // Standard grey enemy animations
          animKey = `enemy_idle_${direction}`;
          frameNameBase = `enemy_idle_${direction}`;
        } else {
          // Colored enemy animations - map the colorDirection to the animation key direction
          let animDirection = direction;
          if (direction === 'side') animDirection = 'right';
          else if (direction === 'down_corner') animDirection = 'right_down';
          else if (direction === 'up_corner') animDirection = 'right_up';
          
          animKey = `enemy_${typePrefix}idle_${animDirection}`;
          frameNameBase = `enemy_${typePrefix.slice(0, -1)}_idle_${direction}`;
        }
        
        // Skip if this animation already exists
        if (scene.anims.exists(animKey)) return;
        
        // Log that we're creating this animation
        console.log(`Creating animation ${animKey} with frames from ${frameNameBase}`);
        
        // Build frame array
        const frames = [];
        const frameCount = 6; // All idle animations have 6 frames
        
        for (let i = 1; i <= frameCount; i++) {
          const frameName = `${frameNameBase}${i}`;
          // Check if frame exists before adding
          if (scene.textures.exists(frameName)) {
            frames.push({ key: frameName });
          } else {
            console.warn(`Frame ${frameName} not found for animation ${animKey}`);
          }
        }
        
        // Only create animation if we have frames
        if (frames.length > 0) {
        
          scene.anims.create({
            key: animKey,
            frames: frames,
            frameRate: 8,
            repeat: -1
          });
        }
      });
      
      // Create run animations for all directions
      directions.forEach(direction => {
        let animKey, frameNameBase;
        
        if (typePrefix === '') {
          // Standard grey enemy animations
          animKey = `enemy_run_${direction}`;
          frameNameBase = `enemy_run_${direction}`;
        } else {
          // Colored enemy animations - map the colorDirection to the animation key direction
          let animDirection = direction;
          if (direction === 'side') animDirection = 'right';
          else if (direction === 'down_corner') animDirection = 'right_down';
          else if (direction === 'up_corner') animDirection = 'right_up';
          
          animKey = `enemy_${typePrefix}run_${animDirection}`;
          frameNameBase = `enemy_${typePrefix.slice(0, -1)}_run_${direction}`;
        }
        
        // Skip if this animation already exists
        if (scene.anims.exists(animKey)) return;
        
        // Log that we're creating this animation
        console.log(`Creating animation ${animKey} with frames from ${frameNameBase}`);
        
        // Build frame array
        const frames = [];
        const frameCount = 8; // All run animations have 8 frames
        
        for (let i = 1; i <= frameCount; i++) {
          const frameName = `${frameNameBase}${i}`;
          // Check if frame exists before adding
          if (scene.textures.exists(frameName)) {
            frames.push({ key: frameName });
          } else {
            console.warn(`Frame ${frameName} not found for animation ${animKey}`);
          }
        }
        
        // Only create animation if we have frames
        if (frames.length > 0) {
          scene.anims.create({
            key: animKey,
            frames: frames,
            frameRate: 17.5, // Increased by 75%
            repeat: -1
          });
        }
      });
      
      // Create attack animations for all directions
      directions.forEach(direction => {
        let animKey, frameNameBase;
        
        if (typePrefix === '') {
          // Standard grey enemy animations
          animKey = `enemy_attack_${direction}`;
          frameNameBase = `enemy_attack_${direction}`;
        } else {
          // Colored enemy animations - map the colorDirection to the animation key direction
          let animDirection = direction;
          if (direction === 'side') animDirection = 'right';
          else if (direction === 'down_corner') animDirection = 'right_down';
          else if (direction === 'up_corner') animDirection = 'right_up';
          
          animKey = `enemy_${typePrefix}attack_${animDirection}`;
          frameNameBase = `enemy_${typePrefix.slice(0, -1)}_attack_${direction}`;
        }
        
        // Skip if this animation already exists
        if (scene.anims.exists(animKey)) return;
        
        // Log that we're creating this animation
        console.log(`Creating animation ${animKey} with frames from ${frameNameBase}`);
        
        // Build frame array
        const frames = [];
        const frameCount = 9; // All attack animations have 9 frames
        
        for (let i = 1; i <= frameCount; i++) {
          const frameName = `${frameNameBase}${i}`;
          // Check if frame exists before adding
          if (scene.textures.exists(frameName)) {
            frames.push({ key: frameName });
          } else {
            console.warn(`Frame ${frameName} not found for animation ${animKey}`);
          }
        }
        
        // Only create animation if we have frames
        if (frames.length > 0) {
          scene.anims.create({
            key: animKey,
            frames: frames,
            frameRate: 17.5, // Increased by 75%
            repeat: 0
          });
        }
      });
    }
    
    // Create animations for all enemy types
    enemyTypes.forEach(type => {
      createEnemyAnimations(type);
    });
    
    // Add extra compatibility mappings for side to right (colored to standard naming)
    for (const typePrefix of enemyTypes) {
      if (typePrefix === '') continue; // Skip standard enemy
      
      const typeName = typePrefix.slice(0, -1); // Remove trailing underscore
      
      // Helper to create compatibility animations
      function createCompatibilityAnim(baseAnim, compatAnim) {
        if (scene.anims.exists(baseAnim) && !scene.anims.exists(compatAnim)) {
          // Clone the original animation with new key
          const originalAnim = scene.anims.get(baseAnim);
          if (originalAnim) {
            console.log(`Creating compatibility animation: ${compatAnim} from ${baseAnim}`);
            scene.anims.create({
              key: compatAnim,
              frames: originalAnim.frames,
              frameRate: originalAnim.frameRate,
              repeat: originalAnim.repeat
            });
          }
        }
      }
      
      // Map side to right for all states (idle, run, attack)
      createCompatibilityAnim(`enemy_${typePrefix}idle_right`, `enemy_${typeName}_idle_side`);
      createCompatibilityAnim(`enemy_${typePrefix}run_right`, `enemy_${typeName}_run_side`);
      createCompatibilityAnim(`enemy_${typePrefix}attack_right`, `enemy_${typeName}_attack_side`);
      
      // Map right_down to down_corner
      createCompatibilityAnim(`enemy_${typePrefix}idle_right_down`, `enemy_${typeName}_idle_down_corner`);
      createCompatibilityAnim(`enemy_${typePrefix}run_right_down`, `enemy_${typeName}_run_down_corner`);
      createCompatibilityAnim(`enemy_${typePrefix}attack_right_down`, `enemy_${typeName}_attack_down_corner`);
      
      // Map right_up to up_corner  
      createCompatibilityAnim(`enemy_${typePrefix}idle_right_up`, `enemy_${typeName}_idle_up_corner`);
      createCompatibilityAnim(`enemy_${typePrefix}run_right_up`, `enemy_${typeName}_run_up_corner`);
      createCompatibilityAnim(`enemy_${typePrefix}attack_right_up`, `enemy_${typeName}_attack_up_corner`);
    }
  }
  
  // Create animations for the default character (no prefix)
  createCharacterAnimations('');
  
  // For selected character that is not default, create animations with the prefix
  if (prefix && selectedCharacter !== 'default') {
    // Create animations with prefixes for the selected character
    createCharacterAnimations(selectedCharacter);
  }
  
  // Create enemy death animations only if they don't exist
  if (!scene.anims.exists('enemy_death_front')) {
    // Create standard grey enemy death animations
    scene.anims.create({
      key: 'enemy_death_front',
      frames: Array.from({ length: 12 }, (_, i) => ({ key: `enemy_death_front_${i + 1}` })),
      frameRate: 12,
      repeat: 0,
      hideOnComplete: false
    });
    
    scene.anims.create({
      key: 'enemy_death_back',
      frames: Array.from({ length: 12 }, (_, i) => ({ key: `enemy_death_back_${i + 1}` })),
      frameRate: 12,
      repeat: 0,
      hideOnComplete: false
    });
    
    scene.anims.create({
      key: 'enemy_death_left',
      frames: Array.from({ length: 12 }, (_, i) => ({ key: `enemy_death_left_${i + 1}` })),
      frameRate: 12,
      repeat: 0,
      hideOnComplete: false
    });
    
    scene.anims.create({
      key: 'enemy_death_right',
      frames: Array.from({ length: 12 }, (_, i) => ({ key: `enemy_death_right_${i + 1}` })),
      frameRate: 12,
      repeat: 0,
      hideOnComplete: false
    });
    
    // Create colored enemy death animations
    const enemyColors = ['blue', 'blueElite', 'green', 'greenElite', 'gold', 'goldElite'];
    const directions = ['front', 'back', 'left', 'right'];
    
    // Create death animations for each color and direction
    enemyColors.forEach(color => {
      directions.forEach(direction => {
        const animKey = `enemy_death_${color}_${direction}`;
        
        // Create the animation with colored frames
        scene.anims.create({
          key: animKey,
          frames: Array.from({ length: 12 }, (_, i) => ({ 
            key: `enemy_death_${color}_${direction}_${i + 1}` 
          })),
          frameRate: 12,
          repeat: 0,
          hideOnComplete: false
        });
        
        console.log(`Created death animation: ${animKey}`);
      });
    });
  }

  // Log all animations for debugging
  console.log('Animations created successfully. Total animations:', Object.keys(scene.anims.anims.entries).length);
  
  // Create explosion animations for small, medium, and big explosions
  createExplosionAnimations(scene);
}

// Function to create explosion animations
function createExplosionAnimations(scene) {
  console.log("Creating explosion animations");
  
  // Check if textures for explosions exist
  let hasSmallExplosion = false;
  let hasMediumExplosion = false;
  let hasBigExplosion = false;
  
  // Check for standard naming pattern (explosion_size_frame)
  for (let i = 1; i <= 8; i++) {
    if (scene.textures.exists(`explosion_small_${i}`)) hasSmallExplosion = true;
    if (scene.textures.exists(`explosion_medium_${i}`)) hasMediumExplosion = true;
    if (scene.textures.exists(`explosion_big_${i}`)) hasBigExplosion = true;
  }

  // Log textures for debugging
  console.log("All available textures:", Object.keys(scene.textures.list).filter(key => 
    key.includes('SmallExplo') || key.includes('MediumExplo') || key.includes('BigExplo') || 
    key.includes('explosion'))
  );
  
  console.log(`Explosion textures found: small=${hasSmallExplosion}, medium=${hasMediumExplosion}, big=${hasBigExplosion}`);
  
  // Small explosion animation
  if (hasSmallExplosion && !scene.anims.exists('explosion_small')) {
    const frames = [];
    for (let i = 1; i <= 8; i++) {
      frames.push({ key: `explosion_small_${i}` });
    }
    
    scene.anims.create({
      key: 'explosion_small',
      frames: frames,
      frameRate: 15,
      repeat: 0,
      hideOnComplete: true
    });
    
    console.log("Created small explosion animation");
  }
  
  // Medium explosion animation
  if (hasMediumExplosion && !scene.anims.exists('explosion_medium')) {
    const frames = [];
    for (let i = 1; i <= 8; i++) {
      frames.push({ key: `explosion_medium_${i}` });
    }
    
    scene.anims.create({
      key: 'explosion_medium',
      frames: frames,
      frameRate: 15,
      repeat: 0,
      hideOnComplete: true
    });
    
    console.log("Created medium explosion animation");
  }
  
  // Big explosion animation
  if (hasBigExplosion && !scene.anims.exists('explosion_big')) {
    const frames = [];
    for (let i = 1; i <= 8; i++) {
      frames.push({ key: `explosion_big_${i}` });
    }
    
    scene.anims.create({
      key: 'explosion_big',
      frames: frames,
      frameRate: 15,
      repeat: 0,
      hideOnComplete: true
    });
    
    console.log("Created big explosion animation");
  }

  // If we don't have the standard animation frames, try alternative naming pattern
  let hasAltSmallExplosion = false;
  let hasAltMediumExplosion = false;
  let hasAltBigExplosion = false;
  
  // Check for alternative naming pattern (SizeExploFrame)
  for (let i = 1; i <= 8; i++) {
    if (scene.textures.exists(`SmallExplo${i}`)) hasAltSmallExplosion = true;
    if (scene.textures.exists(`MediumExplo${i}`)) hasAltMediumExplosion = true; // Fixed variable name
    if (scene.textures.exists(`BigExplo${i}`)) hasAltBigExplosion = true;
  }
  
  console.log(`Alternative explosion textures found: small=${hasAltSmallExplosion}, medium=${hasAltMediumExplosion}, big=${hasAltBigExplosion}`);
  
  // Small explosion animation with alternative naming
  if (hasAltSmallExplosion && !scene.anims.exists('explosion_small_alt')) {
    const frames = [];
    for (let i = 1; i <= 8; i++) {
      frames.push({ key: `SmallExplo${i}` });
    }
    
    scene.anims.create({
      key: 'explosion_small_alt',
      frames: frames,
      frameRate: 15,
      repeat: 0,
      hideOnComplete: true
    });
    
    console.log("Created small explosion animation with alternative naming");
  }
  
  // Medium explosion animation with alternative naming
  if (hasAltMediumExplosion && !scene.anims.exists('explosion_medium_alt')) {
    const frames = [];
    for (let i = 1; i <= 8; i++) {
      frames.push({ key: `MediumExplo${i}` });
    }
    
    scene.anims.create({
      key: 'explosion_medium_alt',
      frames: frames,
      frameRate: 15,
      repeat: 0,
      hideOnComplete: true
    });
    
    console.log("Created medium explosion animation with alternative naming");
  }
  
  // Big explosion animation with alternative naming
  if (hasAltBigExplosion && !scene.anims.exists('explosion_big_alt')) {
    const frames = [];
    for (let i = 1; i <= 8; i++) {
      frames.push({ key: `BigExplo${i}` });
    }
    
    scene.anims.create({
      key: 'explosion_big_alt',
      frames: frames,
      frameRate: 15,
      repeat: 0,
      hideOnComplete: true
    });
    
    console.log("Created big explosion animation with alternative naming");
  }
  
  // Additional check for direct asset filenames as in the provided assets folder
  if (!hasAltBigExplosion && !hasBigExplosion && !scene.anims.exists('explosion_big')) {
    // Check for assets/explosion/big/BigExplo*.png naming pattern
    let hasBigExploFiles = false;
    for (let i = 1; i <= 8; i++) {
      if (scene.textures.exists(`BigExplo${i}`)) {
        hasBigExploFiles = true;
        break;
      }
    }
    
    // If we couldn't find the files directly, create an animation using the expected file names
    // even if they're not loaded yet - they might be loaded by AssetLoader separately
    if (!hasBigExploFiles) {
      console.log("Creating big explosion animation with expected filenames from /assets/explosion/big/");
      
      // Create the frames array using the expected filenames
      const frames = [];
      for (let i = 1; i <= 8; i++) {
        frames.push({ key: `BigExplo${i}` });
      }
      
      // Create the animation
      scene.anims.create({
        key: 'explosion_big',
        frames: frames,
        frameRate: 15,
        repeat: 0,
        hideOnComplete: true
      });
      
      console.log("Created big explosion animation with expected filenames");
    }
  }
}