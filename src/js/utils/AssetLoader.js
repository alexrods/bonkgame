// Loads all assets (sprites, images, and sounds) used in the game.
export function preloadSprites(scene) {
  // Try multiple audio formats and approaches
  try {
    // First set the base path for all assets
    scene.load.setPath('');
    
    // Custom fonts are loaded via CSS instead of Phaser's loader
    // This approach avoids the error with hasCacheConflict
    
    // Try loading with multiple formats for browser compatibility
    scene.load.audio('shot', [
      '/assets/sound/sfx/shot.mp3'
    ]);
    
    // Load intro music
    scene.load.audio('intro_music', [
      '/assets/sound/music/intro.mp3'
    ]);
    
    // Load scroll beat music
    scene.load.audio('scroll_beat', [
      '/assets/sound/music/scroll_beat.mp3'
    ]);
    
    // Load game over music
    scene.load.audio('gameover_music', [
      '/assets/sound/music/gameover.mp3'
    ]);
    
    // Load keystroke sound effects
    scene.load.audio('keystroke', [
      '/assets/sound/sfx/keystroke.mp3'
    ]);
    scene.load.audio('keystroke1', [
      '/assets/sound/sfx/keystroke1.mp3'
    ]);
    scene.load.audio('keystroke3', [
      '/assets/sound/sfx/keystroke3.mp3'
    ]);
    
    // Load interference sound effect (keeping for compatibility)
    scene.load.audio('interference', [
      '/assets/sound/sfx/interference.mp3'
    ]);
    
    // Load narration sound effect
    scene.load.audio('narration', [
      '/assets/sound/sfx/narration.mp3'
    ]);
    
    // Load drone buzz sound effect
    scene.load.audio('drone_buzz', [
      '/assets/sound/sfx/drone_buzz.mp3'
    ]);
    
    // Load reload sounds
    scene.load.audio('reload', [
      '/assets/sound/sfx/rifle_reload.mp3'
    ]);
    
    // Load reloading announcement
    scene.load.audio('reloading_announce', [
      '/assets/sound/sfx/reloading.mp3'
    ]);
    
    // Load empty magazine sound effect
    scene.load.audio('empty_mag', [
      '/assets/sound/sfx/empty_shot.mp3'
    ]);
    
    // Load low ammo sound effect
    scene.load.audio('low_ammo', [
      '/assets/sound/sfx/lowAmmo.mp3'
    ]);
    
    // Load last magazine sound effect
    scene.load.audio('last_mag', [
      '/assets/sound/sfx/lastMag.mp3'
    ]);
    
    // Load beep sound effect for proximity mine
    scene.load.audio('mine_beep', [
      '/assets/sound/sfx/beep.mp3'
    ]);
    
    // Load explosion sound effect for proximity mine
    scene.load.audio('mine_explosion', [
      '/assets/sound/sfx/explosion.mp3'
    ]);
    
    // Load survive sound effect
    scene.load.audio('survive', [
      '/assets/sound/sfx/survive.mp3'
    ]);
    
    // Load whoo sound effect
    scene.load.audio('whoo', [
      '/assets/sound/sfx/whoo.mp3'
    ]);
    
    // Load story dialog sounds - use direct paths without array for better compatibility
    console.log("Loading dialog sound files...");
    scene.load.audio('dialog1', '/assets/sound/story/degen/intro/dialog1.mp3');
    scene.load.audio('dialog2', '/assets/sound/story/degen/intro/dialog2.mp3');
    scene.load.audio('dialog3', '/assets/sound/story/degen/intro/dialog3.mp3');
    scene.load.audio('dialog4', '/assets/sound/story/degen/intro/dialog4.mp3');



    
    // Load character3 (Toaster) dialog sounds
    console.log("Loading toaster dialog sound files...");
    scene.load.audio('character3_dialog1', '/assets/sound/story/toaster/intro/character3_dialog1.mp3');
    scene.load.audio('character3_dialog2', '/assets/sound/story/toaster/intro/character3_dialog2.mp3');
    scene.load.audio('character3_dialog3', '/assets/sound/story/toaster/intro/character3_dialog3.mp3');
    scene.load.audio('character3_dialog4', '/assets/sound/story/toaster/intro/character3_dialog4.mp3');
    
    // Load character5 (Flex) dialog sounds
    console.log("Loading flex dialog sound files...");
    scene.load.audio('character5_dialog1', '/assets/sound/story/flex/intro/character5_dialog1.mp3');
    scene.load.audio('character5_dialog2', '/assets/sound/story/flex/intro/character5_dialog2.mp3');
    scene.load.audio('character5_dialog3', '/assets/sound/story/flex/intro/character5_dialog3.mp3');
    scene.load.audio('character5_dialog4', '/assets/sound/story/flex/intro/character5_dialog4.mp3');
    
    // Load dialog portrait images
    console.log("Loading dialog portrait images...");
    scene.load.image('story/degen/intro/degen', '/assets/story/degen/intro/degen.png');
    scene.load.image('story/degen/intro/networkExec', '/assets/story/degen/intro/networkExec.png');
    scene.load.image('story/degen/intro/girl', '/assets/story/degen/intro/girl.png');
    
    // Load character3 (Toaster) dialog portraits
    console.log("Loading toaster dialog portrait images...");
    scene.load.image('story/character3/intro/toaster', '/assets/story/character3/intro/toaster.png');
    scene.load.image('story/character3/intro/kid', '/assets/story/character3/intro/kid.png');
    scene.load.image('story/character3/intro/networkExec', '/assets/story/character3/intro/networkExec.png');

    // Load character2 (Drainer) dialog portraits
    console.log("Loading drainer dialog portrait images...");
    scene.load.image('story/character2/intro/drainer', '/assets/story/character2/intro/drainer.png');
    scene.load.image('story/character2/intro/networkExec', '/assets/story/character2/intro/networkExec.png');
    
    // Load character5 (Flex) dialog portraits
    console.log("Loading flex dialog portrait images...");
    scene.load.image('story/character5/intro/flex', '/assets/story/character5/intro/flex.png');
    scene.load.image('story/character5/intro/grandma', '/assets/story/character5/intro/grandma.png');
    scene.load.image('story/character5/intro/networkExec', '/assets/story/character5/intro/networkExec.png');

    // Load 100 kills character 6  portrait
    console.log("Loading 100 kills milestone portrait...");
    scene.load.image('story/vibe', '/assets/story/vibe.png');
    //scene.load.image('story/degen', '/assets/story/degen.png');


    // Load 100 kills character 6  portrait
    console.log("Loading 100 kills milestone portrait...");
    scene.load.image('story/dvd', '/assets/story/dvd.png');
    //scene.load.image('story/degen', '/assets/story/degen.png');
    
    // Load Network Drone Pilot portrait and sound
    console.log("Loading Network Drone Pilot portrait image and sound...");
    scene.load.image('story/networkDronePilot', '/assets/story/networkDronePilot.png');
    scene.load.audio('dronePilot_50kills', '/assets/sound/story/all/50kills/dronePilot.mp3');
    
    
    
    // Load degen 50 kills sounds
    console.log("Loading degen 50 kills sounds...");
    scene.load.audio('degen_50kills', '/assets/sound/story/degen/50kills/degen50kills.mp3');
    scene.load.audio('degen_50kills1', '/assets/sound/story/degen/50kills/degen50kills1.mp3');
    
    // Load flex 50 kills sounds
    console.log("Loading flex 50 kills sounds...");
    scene.load.audio('flex50kills', '/assets/sound/story/flex/50kills/flex50kills.mp3');
    scene.load.audio('flex50kills1', '/assets/sound/story/flex/50kills/flex50kills1.mp3');
    
    // Load toaster 50 kills sounds
    console.log("Loading toaster 50 kills sounds...");
    scene.load.audio('toaster50kills', '/assets/sound/story/toaster/50kills/toaster50kills.mp3');
    scene.load.audio('toaster50kills1', '/assets/sound/story/toaster/50kills/toaster50kills1.mp3');

    // Load 300 kills Omen and Degen portrait
    console.log("Loading 300 kills milestone portrait...");
    scene.load.image('story/omen', '/assets/story/omen.png');
    //scene.load.image('story/degen', '/assets/story/degen.png');
    
    // Load credit collection sound effects
    scene.load.audio('credit', [
      '/assets/sound/sfx/credit.mp3'
    ]);
    
    // Load crowd roar sound effect
    scene.load.audio('crowd_roar', [
      '/assets/sound/sfx/crowd_roar.mp3'
    ]);
    
    // Load crowd sounds
    scene.load.audio('crowd_chant', [
      '/assets/sound/sfx/crowdChant.mp3'
    ]);
    scene.load.audio('crowd_cheer', [
      '/assets/sound/sfx/crowdCheer.mp3'
    ]);
    scene.load.audio('crowd_cheer1', [
      '/assets/sound/sfx/crowdCheer1.mp3'
    ]);
    scene.load.audio('crowd_cheer2', [
      '/assets/sound/sfx/crowdCheer2.mp3'
    ]);
    scene.load.audio('crowd_ooooh', [
      '/assets/sound/sfx/ooooh.mp3'
    ]);
    scene.load.audio('crowd_aaaah', [
      '/assets/sound/sfx/aaaah.mp3'
    ]);
    
    // Load kill milestone sound effects
    scene.load.audio('kills_firstblood', [
      '/assets/sound/sfx/firstblood.mp3'
    ]);
    scene.load.audio('kills_10', [
      'src//assets/sound/sfx/10kills.mp3'
    ]);
    scene.load.audio('kills_50', [
      'src//assets/sound/sfx/50kills.mp3'
    ]);
    scene.load.audio('kills_100', [
      'src//assets/sound/sfx/100kills.mp3'
    ]);
    scene.load.audio('kills_200', [
      '/assets/sound/sfx/200kills.mp3'
    ]);
    scene.load.audio('kills_300', [
      '/assets/sound/sfx/300kills.mp3'
    ]);
    scene.load.audio('kills_400', [
      '/assets/sound/sfx/400kills.mp3'
    ]);
    scene.load.audio('kills_500', [
      '/assets/sound/sfx/500kills.mp3'
    ]);
    scene.load.audio('kills_666', [
      '/assets/sound/sfx/666kills.mp3'
    ]);
    scene.load.audio('kills_pandemonium', [
      '/assets/sound/sfx/PANDEMODIUM.mp3'
    ]);
    
    // Load tutorial sounds
    scene.load.audio('tutorial_welcome', [
      '/assets/sound/tutorial/tutorial_welcome.mp3'
    ]);
    scene.load.audio('tutorial_move', [
      '/assets/sound/tutorial/tutorial_move.mp3'
    ]);
    scene.load.audio('move_passed', [
      '/assets/sound/tutorial/move_passed.mp3'
    ]);
    scene.load.audio('tutorial_shoot', [
      '/assets/sound/tutorial/tutorial_shoot.mp3'
    ]);
    scene.load.audio('shots_passed', [
      '/assets/sound/tutorial/shots_passed.mp3'
    ]);
    scene.load.audio('targets_passed', [
      '/assets/sound/tutorial/targets_passed.mp3'
    ]);
    scene.load.audio('tutorial_complete', [
      '/assets/sound/tutorial/tutorial_complete.mp3'
    ]);
    
    // Load expletive sound effects for enemy spawning with explicit paths
    console.log("Attempting to load expletive sounds...");
    scene.load.audio('expletive_fock', '/assets/sound/expelatives/fock_im.mp3');
    scene.load.audio('expletive_get', '/assets/sound/expelatives/get_im.mp3');
    scene.load.audio('expletive_degen', '/assets/sound/expelatives/degen.mp3');
    scene.load.audio('expletive_grab', '/assets/sound/expelatives/grab_im.mp3');
    scene.load.audio('expletive_kill_im', '/assets/sound/expelatives/kill_im.mp3');
    scene.load.audio('expletive_kill_ya', '/assets/sound/expelatives/kill_ya.mp3');
    
    // Load loot assets
    scene.load.image('cash', '/assets/loot/cash.png');
    scene.load.image('coins', '/assets/loot/coins.png');
    scene.load.image('bonk', '/assets/loot/bonk.png');
    
    // Load powerup assets
    scene.load.image('powerup_rapid_fire', '/assets/powerups/rapidFire.png');
    scene.load.image('powerup_shield', '/assets/powerups/shield.png');
    scene.load.image('powerup_ammo', '/assets/powerups/ammo.png');
    scene.load.image('powerup_shotgun', '/assets/powerups/shotgun.png');
    scene.load.image('powerup_box_closed', '/assets/powerups/boxClosed.png');
    scene.load.image('powerup_box_open', '/assets/powerups/boxOpen.png');
    
    // Load game logo
    scene.load.image('game_logo', '/assets/logo/logo.png');
    
    // Load Ponzi Labs Logo and Solana logo for StartScene
    scene.load.image('ponzi_labs_logo', '/assets/start/PonziLabsLogo.png');
    scene.load.image('solana_logo', '/assets/start/solana.png');
    
    // Load taunt image
    scene.load.image('taunt', '/assets/taunt/taunt.png');
    
    // Load drone assets
    scene.load.image('drone', '/assets/Drone/drone.png');
    // Load drone animation frames - individual images
    scene.load.image('drone_anim_1', '/assets/Drone/anim/1.png');
    scene.load.image('drone_anim_2', '/assets/Drone/anim/2.png');
    scene.load.image('drone_anim_3', '/assets/Drone/anim/3.png');
    scene.load.image('drone_anim_4', '/assets/Drone/anim/4.png');
    scene.load.image('drone_anim_5', '/assets/Drone/anim/5.png');
    scene.load.image('drone_anim_6', '/assets/Drone/anim/6.png');
    
    // Load enemy drone animation frames
    scene.load.image('enemy_drone_anim_1', '/assets/Drone/enemyDrone/1.png');
    scene.load.image('enemy_drone_anim_2', '/assets/Drone/enemyDrone/2.png');
    scene.load.image('enemy_drone_anim_3', '/assets/Drone/enemyDrone/3.png');
    scene.load.image('enemy_drone_anim_4', '/assets/Drone/enemyDrone/4.png');
    scene.load.image('enemy_drone_anim_5', '/assets/Drone/enemyDrone/5.png');
    scene.load.image('enemy_drone_anim_6', '/assets/Drone/enemyDrone/6.png');
    
    // Load drone wheel UI
    scene.load.image('dronewheel', '/assets/UI/dronewheel.png');
    scene.load.image('bullets', '/assets/UI/bullets.png');
    scene.load.image('pills', '/assets/UI/pills.png');
    scene.load.image('shield', '/assets/UI/shield.png');
    
    // Load player markers for versus mode
    scene.load.image('greenMark', '/assets/UI/greenMark.png');
    scene.load.image('redMark', '/assets/UI/redMark.png');
    
    // Load combat robot assets
    // Idle states
    scene.load.image('robot_idle_down', '/assets/combatRobot/Idle/Down.png');
    scene.load.image('robot_idle_down_corner', '/assets/combatRobot/Idle/Down Corner.png');
    scene.load.image('robot_idle_side', '/assets/combatRobot/Idle/Side.png');
    scene.load.image('robot_idle_up_corner', '/assets/combatRobot/Idle/Up Corner.png');
    scene.load.image('robot_idle_up', '/assets/combatRobot/Idle/Up.png');
    
    // Attacking states
    scene.load.image('robot_attack_down', '/assets/combatRobot/Attacking/Down.png');
    scene.load.image('robot_attack_down_corner', '/assets/combatRobot/Attacking/Down Corner.png');
    scene.load.image('robot_attack_side', '/assets/combatRobot/Attacking/Side.png');
    scene.load.image('robot_attack_up_corner', '/assets/combatRobot/Attacking/Up Corner.png');
    scene.load.image('robot_attack_up', '/assets/combatRobot/Attacking/Up.png');
    
    // Load commercial assets
    scene.load.image('bonkosPortrait', '/assets/cutscenes/comercial/bonkosPortrait.png');
    scene.load.image('bonkosWide', '/assets/cutscenes/comercial/bonkosWide.png');
    scene.load.image('organtradePortrait', '/assets/cutscenes/comercial/organtradePortrait.png');
    scene.load.image('organtradeWide', '/assets/cutscenes/comercial/organtradeWide.png');
    scene.load.image('psg1Portrait', '/assets/cutscenes/comercial/psg1Portrait.png');
    scene.load.image('psg1Wide', '/assets/cutscenes/comercial/psg1Wide.png');
    scene.load.image('wifPortrait', '/assets/cutscenes/comercial/wifPortrait.png');
    scene.load.image('wifWide', '/assets/cutscenes/comercial/wifWide.png');
    
    // Load enter arena cutscene assets
    scene.load.image('cutscene_landscape', '/assets/cutscenes/enter_arena/arenaLandscape.png');
    scene.load.image('cutscene_portrait', '/assets/cutscenes/enter_arena/arenaPortrait.png');
    scene.load.image('cutscene_character', '/assets/cutscenes/enter_arena/character.png');
    scene.load.image('cutscene_character2', '/assets/cutscenes/enter_arena/character2.png');
    scene.load.image('cutscene_character3', '/assets/cutscenes/enter_arena/character3.png');
    scene.load.image('cutscene_character5', '/assets/cutscenes/enter_arena/character5.png');
    
    // Load commercial sounds
    scene.load.audio('becomeSponsor', '/assets/sound/comercials/becomeSponsor.mp3');
    scene.load.audio('buyAdd', '/assets/sound/comercials/buyAdd.mp3');
    scene.load.audio('organTrading', '/assets/sound/comercials/organTrading.mp3');
    scene.load.audio('psg1', '/assets/sound/comercials/psg1.mp3');
    scene.load.audio('sonponsoredBy', '/assets/sound/comercials/sonponsoredBy.mp3');
    scene.load.audio('todaysgames', '/assets/sound/comercials/todaysgames.mp3');
    scene.load.audio('wif', '/assets/sound/comercials/wif.mp3');
    
    // Load enemy death animations - front (killed from below)
    for (let i = 1; i <= 12; i++) {
      scene.load.image(`enemy_death_front_${i}`, `/assets/Enemy/enemyDeath/death1/grey/front/${i}.png`);
    }
    
    // Load enemy death animations - back (killed from above)
    for (let i = 1; i <= 12; i++) {
      scene.load.image(`enemy_death_back_${i}`, `/assets/Enemy/enemyDeath/death1/grey/back/${i}.png`);
    }
    
    // Load enemy death animations - left (killed from right)
    for (let i = 1; i <= 12; i++) {
      scene.load.image(`enemy_death_left_${i}`, `/assets/Enemy/enemyDeath/death1/grey/killed_from_right/${i}.png`);
    }
    
    // Load enemy death animations - right (killed from left)
    for (let i = 1; i <= 12; i++) {
      scene.load.image(`enemy_death_right_${i}`, `/assets/Enemy/enemyDeath/death1/grey/killed_from_left/${i}.png`);
    }
    
    // Load colored enemy death animations
    // Define colors for death animations
    const enemyColors = ['blue', 'blueElite', 'green', 'greenElite', 'gold', 'goldElite'];
    
    // Load death animations for each color
    enemyColors.forEach(color => {
      // Load front death animations (killed from below)
      for (let i = 1; i <= 12; i++) {
        scene.load.image(`enemy_death_${color}_front_${i}`, `/assets/Enemy/enemyDeath/death1/${color}/front/${i}.png`);
      }
      
      // Load back death animations (killed from above)
      for (let i = 1; i <= 12; i++) {
        scene.load.image(`enemy_death_${color}_back_${i}`, `/assets/Enemy/enemyDeath/death1/${color}/back/${i}.png`);
      }
      
      // Load left death animations (killed from right)
      for (let i = 1; i <= 12; i++) {
        scene.load.image(`enemy_death_${color}_left_${i}`, `/assets/Enemy/enemyDeath/death1/${color}/killed_from_right/${i}.png`);
      }
      
      // Load right death animations (killed from left)
      for (let i = 1; i <= 12; i++) {
        scene.load.image(`enemy_death_${color}_right_${i}`, `/assets/Enemy/enemyDeath/death1/${color}/killed_from_left/${i}.png`);
      }
    });
    
    // Load explosion animations - small
    for (let i = 1; i <= 8; i++) {
      scene.load.image(`explosion_small_${i}`, `/assets/explosion/small/SmallExplo${i}.png`);
    }
    
    // Load explosion animations - medium
    for (let i = 1; i <= 8; i++) {
      scene.load.image(`explosion_medium_${i}`, `/assets/explosion/medium/MediumExplo${i}.png`);
    }
    
    // Load explosion animations - big
    for (let i = 1; i <= 8; i++) {
      scene.load.image(`explosion_big_${i}`, `/assets/explosion/big/BigExplo${i}.png`);
    }
    
    // Set up timeout to check if sounds loaded
    setTimeout(() => {
      console.log("Checking after timeout if sounds loaded:");
      console.log("- shot sound loaded:", scene.cache.audio.exists('shot'));
      console.log("- interference sound loaded:", scene.cache.audio.exists('interference'));
      console.log("- dialog1 loaded:", scene.cache.audio.exists('dialog1'));
      console.log("- dialog2 loaded:", scene.cache.audio.exists('dialog2'));
      console.log("- dialog3 loaded:", scene.cache.audio.exists('dialog3'));
      console.log("- dialog4 loaded:", scene.cache.audio.exists('dialog4'));
      console.log("- character3_dialog1 loaded:", scene.cache.audio.exists('character3_dialog1'));
      console.log("- character3_dialog2 loaded:", scene.cache.audio.exists('character3_dialog2'));
      console.log("- character3_dialog3 loaded:", scene.cache.audio.exists('character3_dialog3'));
      console.log("- character3_dialog4 loaded:", scene.cache.audio.exists('character3_dialog4'));
      console.log("- expletive_fock loaded:", scene.cache.audio.exists('expletive_fock'));
      console.log("- expletive_get loaded:", scene.cache.audio.exists('expletive_get'));
      console.log("- expletive_degen loaded:", scene.cache.audio.exists('expletive_degen'));
      console.log("- expletive_grab loaded:", scene.cache.audio.exists('expletive_grab'));
      console.log("- expletive_kill_im loaded:", scene.cache.audio.exists('expletive_kill_im'));
      console.log("- expletive_kill_ya loaded:", scene.cache.audio.exists('expletive_kill_ya'));
    }, 1000);
  } catch (e) {
    console.error('Error during sound preloading:', e);
  }
  
  // Then set the path for other assets
  scene.load.path = '/assets/';
  
  // Define available characters
  const characters = [
    'default',
    // Add more character IDs here as they become available
    'character2',
    'character3',
    'character4',
    'character5',
    'character6',
    'character7',
    // etc...
  ];
  
  // Store available characters in the registry for other scenes to access
  scene.registry.set('availableCharacters', characters);
  
  // Get the currently selected character (default to first one if not set)
  const selectedCharacter = scene.registry.get('selectedCharacter') || characters[0];
  
  // Store the selected character for later use
  scene.registry.set('selectedCharacter', selectedCharacter);
  
  // Load assets for ALL available characters to ensure they're ready
  // This prevents issues when switching characters
  for (const character of characters) {
    loadCharacterAssets(character);
  }
  
  // Function to load character assets
  function loadCharacterAssets(characterId) {
    const basePath = `characters/${characterId}/`;
    const prefix = characterId === 'default' ? '' : `${characterId}_`;
    
    // Handle character3's extra idle frames
    // Note: character5 was intended to have 9 frames but only has 4 in the file system
    const hasExtraIdleFrames = characterId === 'character3';
    const idleFrameCount = hasExtraIdleFrames ? 9 : 4;
    
    // Player assets - Down animations
    for (let i = 1; i <= idleFrameCount; i++) {
      scene.load.image(`${prefix}down_idle_${i}`, `${basePath}Down/Idle/${i}.png`);
    }
    
    scene.load.image(`${prefix}down_walk_1`, `${basePath}Down/Walk/1.png`);
    scene.load.image(`${prefix}down_walk_2`, `${basePath}Down/Walk/2.png`);
    scene.load.image(`${prefix}down_walk_3`, `${basePath}Down/Walk/3.png`);
    scene.load.image(`${prefix}down_walk_4`, `${basePath}Down/Walk/4.png`);
    
    // Up animations
    for (let i = 1; i <= idleFrameCount; i++) {
      scene.load.image(`${prefix}up_idle_${i}`, `${basePath}Up/Idle/${i}.png`);
    }
    
    scene.load.image(`${prefix}up_walk_1`, `${basePath}Up/Walk/1.png`);
    scene.load.image(`${prefix}up_walk_2`, `${basePath}Up/Walk/2.png`);
    scene.load.image(`${prefix}up_walk_3`, `${basePath}Up/Walk/3.png`);
    scene.load.image(`${prefix}up_walk_4`, `${basePath}Up/Walk/4.png`);
    
    // Side animations
    for (let i = 1; i <= idleFrameCount; i++) {
      scene.load.image(`${prefix}side_idle_${i}`, `${basePath}Side/Idle/${i}.png`);
    }
    
    scene.load.image(`${prefix}side_walk_1`, `${basePath}Side/Walk/1.png`);
    scene.load.image(`${prefix}side_walk_2`, `${basePath}Side/Walk/2.png`);
    scene.load.image(`${prefix}side_walk_3`, `${basePath}Side/Walk/3.png`);
    scene.load.image(`${prefix}side_walk_4`, `${basePath}Side/Walk/4.png`);
    
    // Down Corner animations
    for (let i = 1; i <= idleFrameCount; i++) {
      scene.load.image(`${prefix}down_corner_idle_${i}`, `${basePath}Down Corner/Idle/${i}.png`);
    }
    
    // Handle the inconsistent file names for Down Corner walk animations
    const downCornerWalkFiles = characterId === 'default' ? ['01.png', '02.png', '03.png', '04.png'] : ['1.png', '2.png', '3.png', '4.png'];
    
    scene.load.image(`${prefix}down_corner_walk_1`, `${basePath}Down Corner/Walk/${downCornerWalkFiles[0]}`);
    scene.load.image(`${prefix}down_corner_walk_2`, `${basePath}Down Corner/Walk/${downCornerWalkFiles[1]}`);
    scene.load.image(`${prefix}down_corner_walk_3`, `${basePath}Down Corner/Walk/${downCornerWalkFiles[2]}`);
    scene.load.image(`${prefix}down_corner_walk_4`, `${basePath}Down Corner/Walk/${downCornerWalkFiles[3]}`);
    
    // Up Corner animations
    if (characterId === 'character5') {
      // Standard handling for character5 - using numbered files just like other characters
      for (let i = 1; i <= idleFrameCount; i++) {
        scene.load.image(`${prefix}up_corner_idle_${i}`, `${basePath}Up Corner/Idle/${i}.png`);
      }
      
      scene.load.image(`${prefix}up_corner_walk_1`, `${basePath}Up Corner/Walk/1.png`);
      scene.load.image(`${prefix}up_corner_walk_2`, `${basePath}Up Corner/Walk/2.png`);
      scene.load.image(`${prefix}up_corner_walk_3`, `${basePath}Up Corner/Walk/3.png`);
      scene.load.image(`${prefix}up_corner_walk_4`, `${basePath}Up Corner/Walk/4.png`);
      
      // Load Run animations for character5's Up Corner (now with proper paths)
      scene.load.image(`${prefix}up_corner_run_1`, `${basePath}Up Corner/Run/1.png`);
      scene.load.image(`${prefix}up_corner_run_2`, `${basePath}Up Corner/Run/2.png`);
      scene.load.image(`${prefix}up_corner_run_3`, `${basePath}Up Corner/Run/3.png`);
      scene.load.image(`${prefix}up_corner_run_4`, `${basePath}Up Corner/Run/4.png`);
      scene.load.image(`${prefix}up_corner_run_5`, `${basePath}Up Corner/Run/5.png`);
      scene.load.image(`${prefix}up_corner_run_6`, `${basePath}Up Corner/Run/6.png`);
      scene.load.image(`${prefix}up_corner_run_7`, `${basePath}Up Corner/Run/7.png`);
      scene.load.image(`${prefix}up_corner_run_8`, `${basePath}Up Corner/Run/8.png`);
    } else {
      // Standard handling for other characters
      for (let i = 1; i <= idleFrameCount; i++) {
        scene.load.image(`${prefix}up_corner_idle_${i}`, `${basePath}Up Corner/Idle/${i}.png`);
      }
      
      scene.load.image(`${prefix}up_corner_walk_1`, `${basePath}Up Corner/Walk/1.png`);
      scene.load.image(`${prefix}up_corner_walk_2`, `${basePath}Up Corner/Walk/2.png`);
      scene.load.image(`${prefix}up_corner_walk_3`, `${basePath}Up Corner/Walk/3.png`);
      scene.load.image(`${prefix}up_corner_walk_4`, `${basePath}Up Corner/Walk/4.png`);
    }
    
    // Player death animation - Load frames
    console.log(`Loading ${characterId} character death animation frames`);
    
    // Handle character3 and character5's different death animation file naming
    if (characterId === 'character3' || characterId === 'character5') {
      for (let i = 1; i <= 12; i++) {
        scene.load.image(`${prefix}player_death_${i}`, `${basePath}PlayerDeath/${i}.png`);
      }
    } else {
      // For default and character2
      scene.load.image(`${prefix}player_death_1`, `${basePath}PlayerDeath/Dead1.png`);
      scene.load.image(`${prefix}player_death_2`, `${basePath}PlayerDeath/Dead2.png`);
      scene.load.image(`${prefix}player_death_3`, `${basePath}PlayerDeath/Dead3.png`);
      scene.load.image(`${prefix}player_death_4`, `${basePath}PlayerDeath/Dead4.png`);
      scene.load.image(`${prefix}player_death_5`, `${basePath}PlayerDeath/Dead5.png`);
      scene.load.image(`${prefix}player_death_6`, `${basePath}PlayerDeath/Dead6.png`);
      scene.load.image(`${prefix}player_death_7`, `${basePath}PlayerDeath/Dead7.png`);
      scene.load.image(`${prefix}player_death_8`, `${basePath}PlayerDeath/Dead8.png`);
      scene.load.image(`${prefix}player_death_9`, `${basePath}PlayerDeath/Dead9.png`);
      scene.load.image(`${prefix}player_death_10`, `${basePath}PlayerDeath/Dead10.png`);
      scene.load.image(`${prefix}player_death_11`, `${basePath}PlayerDeath/Dead11.png`);
    }
  }
  
  // Load assets for the selected character
  loadCharacterAssets(selectedCharacter);
  
  // Regular grey enemy idle animations - Down
  scene.load.image('enemy_idle_down1', 'Enemy/grey/Idle/e1 idle down1.png');
  scene.load.image('enemy_idle_down2', 'Enemy/grey/Idle/e1 idle down2.png');
  scene.load.image('enemy_idle_down3', 'Enemy/grey/Idle/e1 idle down3.png');
  scene.load.image('enemy_idle_down4', 'Enemy/grey/Idle/e1 idle down4.png');
  scene.load.image('enemy_idle_down5', 'Enemy/grey/Idle/e1 idle down5.png');
  scene.load.image('enemy_idle_down6', 'Enemy/grey/Idle/e1 idle down6.png');
  
  // Function to load enemies with different colors
  function loadEnemyAssets(colorType) {
    const directions = ['down', 'up', 'side', 'down_corner', 'up_corner'];
    
    // Convert js direction format to folder structure
    function getFolderPath(direction) {
      // Convert 'down_corner' to 'Down corner', 'side' to 'Side', etc.
      let folderDir = direction.replace('_corner', ' corner');
      return folderDir.charAt(0).toUpperCase() + folderDir.slice(1);
    }
    
    // Load idle animations for all directions
    directions.forEach(direction => {
      // Get the proper folder path
      const folderPath = getFolderPath(direction);
      
      for (let i = 1; i <= 6; i++) {
        scene.load.image(
          `enemy_${colorType}_idle_${direction}${i}`, 
          `Enemy/${colorType}/${folderPath}/Idle/${i}.png`
        );
      }
    });
    
    // Load run animations for all directions
    directions.forEach(direction => {
      // Get the proper folder path
      const folderPath = getFolderPath(direction);
      
      for (let i = 1; i <= 8; i++) {
        scene.load.image(
          `enemy_${colorType}_run_${direction}${i}`, 
          `Enemy/${colorType}/${folderPath}/Run/${i}.png`
        );
      }
    });
    
    // Load attack animations for all directions
    directions.forEach(direction => {
      // Get the proper folder path
      const folderPath = getFolderPath(direction);
      
      for (let i = 1; i <= 9; i++) {
        scene.load.image(
          `enemy_${colorType}_attack_${direction}${i}`, 
          `Enemy/${colorType}/${folderPath}/Attack/${i}.png`
        );
      }
    });
  }
  
  // Load colored enemy assets
  loadEnemyAssets('blue');
  loadEnemyAssets('green');
  loadEnemyAssets('gold');
  loadEnemyAssets('blueElite');
  loadEnemyAssets('greenElite');
  loadEnemyAssets('goldElite');
  
  // Enemy idle animations - Up.
  scene.load.image('enemy_idle_up1', 'Enemy/grey/Idle/e1 idle up1.png');
  scene.load.image('enemy_idle_up2', 'Enemy/grey/Idle/e1 idle up2.png');
  scene.load.image('enemy_idle_up3', 'Enemy/grey/Idle/e1 idle up3.png');
  scene.load.image('enemy_idle_up4', 'Enemy/grey/Idle/e1 idle up4.png');
  scene.load.image('enemy_idle_up5', 'Enemy/grey/Idle/e1 idle up5.png');
  scene.load.image('enemy_idle_up6', 'Enemy/grey/Idle/e1 idle up6.png');
  
  // Enemy idle animations - Right.
  scene.load.image('enemy_idle_right1', 'Enemy/grey/Idle/e1 idle right1.png');
  scene.load.image('enemy_idle_right2', 'Enemy/grey/Idle/e1 idle right2.png');
  scene.load.image('enemy_idle_right3', 'Enemy/grey/Idle/e1 idle right3.png');
  scene.load.image('enemy_idle_right4', 'Enemy/grey/Idle/e1 idle right4.png');
  scene.load.image('enemy_idle_right5', 'Enemy/grey/Idle/e1 idle right5.png');
  scene.load.image('enemy_idle_right6', 'Enemy/grey/Idle/e1 idle right6.png');
  
  // Enemy idle animations - Right Down.
  scene.load.image('enemy_idle_right_down1', 'Enemy/grey/Idle/e1 idle right down1.png');
  scene.load.image('enemy_idle_right_down2', 'Enemy/grey/Idle/e1 idle right down2.png');
  scene.load.image('enemy_idle_right_down3', 'Enemy/grey/Idle/e1 idle right down3.png');
  scene.load.image('enemy_idle_right_down4', 'Enemy/grey/Idle/e1 idle right down4.png');
  scene.load.image('enemy_idle_right_down5', 'Enemy/grey/Idle/e1 idle right down5.png');
  scene.load.image('enemy_idle_right_down6', 'Enemy/grey/Idle/e1 idle right down6.png');
  
  // Enemy idle animations - Right Up.
  scene.load.image('enemy_idle_right_up1', 'Enemy/grey/Idle/e1 idle right up1.png');
  scene.load.image('enemy_idle_right_up2', 'Enemy/grey/Idle/e1 idle right up2.png');
  scene.load.image('enemy_idle_right_up3', 'Enemy/grey/Idle/e1 idle right up3.png');
  scene.load.image('enemy_idle_right_up4', 'Enemy/grey/Idle/e1 idle right up4.png');
  scene.load.image('enemy_idle_right_up5', 'Enemy/grey/Idle/e1 idle right up5.png');
  scene.load.image('enemy_idle_right_up6', 'Enemy/grey/Idle/e1 idle right up6.png');
  
  // Enemy run animations - Down.
  scene.load.image('enemy_run_down1', 'Enemy/grey/Run/e1 run down1.png');
  scene.load.image('enemy_run_down2', 'Enemy/grey/Run/e1 run down2.png');
  scene.load.image('enemy_run_down3', 'Enemy/grey/Run/e1 run down3.png');
  scene.load.image('enemy_run_down4', 'Enemy/grey/Run/e1 run down4.png');
  scene.load.image('enemy_run_down5', 'Enemy/grey/Run/e1 run down5.png');
  scene.load.image('enemy_run_down6', 'Enemy/grey/Run/e1 run down6.png');
  scene.load.image('enemy_run_down7', 'Enemy/grey/Run/e1 run down7.png');
  scene.load.image('enemy_run_down8', 'Enemy/grey/Run/e1 run down8.png');
  
  // Enemy run animations - Up.
  scene.load.image('enemy_run_up1', 'Enemy/grey/Run/e1 run up1.png');
  scene.load.image('enemy_run_up2', 'Enemy/grey/Run/e1 run up2.png');
  scene.load.image('enemy_run_up3', 'Enemy/grey/Run/e1 run up3.png');
  scene.load.image('enemy_run_up4', 'Enemy/grey/Run/e1 run up4.png');
  scene.load.image('enemy_run_up5', 'Enemy/grey/Run/e1 run up5.png');
  scene.load.image('enemy_run_up6', 'Enemy/grey/Run/e1 run up6.png');
  scene.load.image('enemy_run_up7', 'Enemy/grey/Run/e1 run up7.png');
  scene.load.image('enemy_run_up8', 'Enemy/grey/Run/e1 run up8.png');
  
  // Enemy run animations - Right.
  scene.load.image('enemy_run_right1', 'Enemy/grey/Run/e1 run right1.png');
  scene.load.image('enemy_run_right2', 'Enemy/grey/Run/e1 run right2.png');
  scene.load.image('enemy_run_right3', 'Enemy/grey/Run/e1 run right3.png');
  scene.load.image('enemy_run_right4', 'Enemy/grey/Run/e1 run right4.png');
  scene.load.image('enemy_run_right5', 'Enemy/grey/Run/e1 run right5.png');
  scene.load.image('enemy_run_right6', 'Enemy/grey/Run/e1 run right6.png');
  scene.load.image('enemy_run_right7', 'Enemy/grey/Run/e1 run right7.png');
  scene.load.image('enemy_run_right8', 'Enemy/grey/Run/e1 run right8.png');
  
  // Enemy run animations - Right Down.
  scene.load.image('enemy_run_right_down1', 'Enemy/grey/Run/e1 run right down1.png');
  scene.load.image('enemy_run_right_down2', 'Enemy/grey/Run/e1 run right down2.png');
  scene.load.image('enemy_run_right_down3', 'Enemy/grey/Run/e1 run right down3.png');
  scene.load.image('enemy_run_right_down4', 'Enemy/grey/Run/e1 run right down4.png');
  scene.load.image('enemy_run_right_down5', 'Enemy/grey/Run/e1 run right down5.png');
  scene.load.image('enemy_run_right_down6', 'Enemy/grey/Run/e1 run right down6.png');
  scene.load.image('enemy_run_right_down7', 'Enemy/grey/Run/e1 run right down7.png');
  scene.load.image('enemy_run_right_down8', 'Enemy/grey/Run/e1 run right down8.png');
  
  // Enemy run animations - Right Up (note the typo in the filename).
  scene.load.image('enemy_run_right_up1', 'Enemy/grey/Run/e1 run righ upt1.png');
  scene.load.image('enemy_run_right_up2', 'Enemy/grey/Run/e1 run righ upt2.png');
  scene.load.image('enemy_run_right_up3', 'Enemy/grey/Run/e1 run righ upt3.png');
  scene.load.image('enemy_run_right_up4', 'Enemy/grey/Run/e1 run righ upt4.png');
  scene.load.image('enemy_run_right_up5', 'Enemy/grey/Run/e1 run righ upt5.png');
  scene.load.image('enemy_run_right_up6', 'Enemy/grey/Run/e1 run righ upt6.png');
  scene.load.image('enemy_run_right_up7', 'Enemy/grey/Run/e1 run righ upt7.png');
  scene.load.image('enemy_run_right_up8', 'Enemy/grey/Run/e1 run righ upt8.png');
  
  // Enemy attack animations - Down
  scene.load.image('enemy_attack_down1', 'Enemy/grey/attack/e1 attack down1.png');
  scene.load.image('enemy_attack_down2', 'Enemy/grey/attack/e1 attack down2.png');
  scene.load.image('enemy_attack_down3', 'Enemy/grey/attack/e1 attack down3.png');
  scene.load.image('enemy_attack_down4', 'Enemy/grey/attack/e1 attack down4.png');
  scene.load.image('enemy_attack_down5', 'Enemy/grey/attack/e1 attack down5.png');
  scene.load.image('enemy_attack_down6', 'Enemy/grey/attack/e1 attack down6.png');
  scene.load.image('enemy_attack_down7', 'Enemy/grey/attack/e1 attack down7.png');
  scene.load.image('enemy_attack_down8', 'Enemy/grey/attack/e1 attack down8.png');
  scene.load.image('enemy_attack_down9', 'Enemy/grey/attack/e1 attack down9.png');
  
  // Enemy attack animations - Up
  scene.load.image('enemy_attack_up1', 'Enemy/grey/attack/e1 attack up1.png');
  scene.load.image('enemy_attack_up2', 'Enemy/grey/attack/e1 attack up2.png');
  scene.load.image('enemy_attack_up3', 'Enemy/grey/attack/e1 attack up3.png');
  scene.load.image('enemy_attack_up4', 'Enemy/grey/attack/e1 attack up4.png');
  scene.load.image('enemy_attack_up5', 'Enemy/grey/attack/e1 attack up5.png');
  scene.load.image('enemy_attack_up6', 'Enemy/grey/attack/e1 attack up6.png');
  scene.load.image('enemy_attack_up7', 'Enemy/grey/attack/e1 attack up7.png');
  scene.load.image('enemy_attack_up8', 'Enemy/grey/attack/e1 attack up8.png');
  scene.load.image('enemy_attack_up9', 'Enemy/grey/attack/e1 attack up9.png');
  
  // Enemy attack animations - Right
  scene.load.image('enemy_attack_right1', 'Enemy/grey/attack/e1 attack right1.png');
  scene.load.image('enemy_attack_right2', 'Enemy/grey/attack/e1 attack right2.png');
  scene.load.image('enemy_attack_right3', 'Enemy/grey/attack/e1 attack right3.png');
  scene.load.image('enemy_attack_right4', 'Enemy/grey/attack/e1 attack right4.png');
  scene.load.image('enemy_attack_right5', 'Enemy/grey/attack/e1 attack right5.png');
  scene.load.image('enemy_attack_right6', 'Enemy/grey/attack/e1 attack right6.png');
  scene.load.image('enemy_attack_right7', 'Enemy/grey/attack/e1 attack right7.png');
  scene.load.image('enemy_attack_right8', 'Enemy/grey/attack/e1 attack right8.png');
  scene.load.image('enemy_attack_right9', 'Enemy/grey/attack/e1 attack right9.png');
  
  // Enemy attack animations - Right Down
  scene.load.image('enemy_attack_right_down1', 'Enemy/grey/attack/e1 attack right down1.png');
  scene.load.image('enemy_attack_right_down2', 'Enemy/grey/attack/e1 attack right down2.png');
  scene.load.image('enemy_attack_right_down3', 'Enemy/grey/attack/e1 attack right down3.png');
  scene.load.image('enemy_attack_right_down4', 'Enemy/grey/attack/e1 attack right down4.png');
  scene.load.image('enemy_attack_right_down5', 'Enemy/grey/attack/e1 attack right down5.png');
  scene.load.image('enemy_attack_right_down6', 'Enemy/grey/attack/e1 attack right down6.png');
  scene.load.image('enemy_attack_right_down7', 'Enemy/grey/attack/e1 attack right down7.png');
  scene.load.image('enemy_attack_right_down8', 'Enemy/grey/attack/e1 attack right down8.png');
  scene.load.image('enemy_attack_right_down9', 'Enemy/grey/attack/e1 attack right down9.png');
  
  // Enemy attack animations - Right Up
  scene.load.image('enemy_attack_right_up1', 'Enemy/grey/attack/e1 attack right up1.png');
  scene.load.image('enemy_attack_right_up2', 'Enemy/grey/attack/e1 attack right up2.png');
  scene.load.image('enemy_attack_right_up3', 'Enemy/grey/attack/e1 attack right up3.png');
  scene.load.image('enemy_attack_right_up4', 'Enemy/grey/attack/e1 attack right up4.png');
  scene.load.image('enemy_attack_right_up5', 'Enemy/grey/attack/e1 attack right up5.png');
  scene.load.image('enemy_attack_right_up6', 'Enemy/grey/attack/e1 attack right up6.png');
  scene.load.image('enemy_attack_right_up7', 'Enemy/grey/attack/e1 attack right up7.png');
  scene.load.image('enemy_attack_right_up8', 'Enemy/grey/attack/e1 attack right up8.png');
  scene.load.image('enemy_attack_right_up9', 'Enemy/grey/attack/e1 attack right up9.png');
}