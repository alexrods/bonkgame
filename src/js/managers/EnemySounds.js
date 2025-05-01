export class EnemySounds {
  constructor(scene) {
    this.scene = scene;
    this.expletiveSounds = null;
    this.deathSounds = null;
    this.lastExpletiveTime = 0;
    this.userHasInteracted = false;
    this.audioPool = {}; // Pool for audio elements to reduce creation
  }

  init() {
    // Initialize sound arrays
    this.expletiveSounds = [];
    this.deathSounds = [];
    
    // Load sounds directly
    this.loadSoundsDirectly();
    
    // Track user interaction for audio play
    this.scene.input.on('pointerdown', () => {
      this.userHasInteracted = true;
    });
  }
  
  loadSoundsDirectly() {
    // Create empty arrays for sounds
    this.expletiveSounds = [];
    this.deathSounds = [];
    
    // Load expletive sounds
    const expletiveSoundURLs = [
      '/assets/sound/expelatives/fock_im.mp3',
      '/assets/sound/expelatives/get_im.mp3',
      '/assets/sound/expelatives/degen.mp3',
      '/assets/sound/expelatives/grab_im.mp3',
      '/assets/sound/expelatives/kill_im.mp3',
      '/assets/sound/expelatives/kill_ya.mp3'
    ];
    
    // Load death sounds (mixture of moans and grunts)
    const deathSoundURLs = [
      '/assets/sound/enemy_die/moan_1.mp3',
      '/assets/sound/enemy_die/moan_2.mp3',
      '/assets/sound/enemy_die/moan_3.mp3',
      '/assets/sound/enemy_die/moan_4.mp3',
      '/assets/sound/enemy_die/grunt_1.mp3',
      '/assets/sound/enemy_die/grunt_2.mp3',
      '/assets/sound/enemy_die/grunt_3.mp3',
      '/assets/sound/enemy_die/grunt_4.mp3'
    ];
    
    // Create HTML audio elements for expletives
    expletiveSoundURLs.forEach(url => {
      try {
        const audio = new Audio(url);
        audio.volume = 0.7;
        this.expletiveSounds.push(audio);
      } catch (e) {}
    });
    
    // Create HTML audio elements for death sounds
    deathSoundURLs.forEach(url => {
      try {
        const audio = new Audio(url);
        audio.volume = 0.7;
        this.deathSounds.push(audio);
      } catch (e) {}
    });
  }

  // Get audio from pool or create new one
  getAudio(url, volume = 0.7) {
    if (!this.audioPool[url]) {
      this.audioPool[url] = [];
    }
    
    // Try to find an available audio element
    for (let i = 0; i < this.audioPool[url].length; i++) {
      const audio = this.audioPool[url][i];
      if (audio.paused || audio.ended) {
        audio.currentTime = 0;
        audio.volume = volume;
        return audio;
      }
    }
    
    // If no available audio, create a new one (max 3 per sound)
    if (this.audioPool[url].length < 3) {
      try {
        const audio = new Audio(url);
        audio.volume = volume;
        this.audioPool[url].push(audio);
        return audio;
      } catch (e) {
        return null;
      }
    }
    
    // If we have max sounds, reuse the first one
    const audio = this.audioPool[url][0];
    audio.currentTime = 0;
    audio.volume = volume;
    return audio;
  }

  // Play a random expletive sound if available (with 25% chance and 4 second cooldown)
  playRandomExpletive() {
    const currentTime = Date.now();
    
    // First check cooldown - must wait 4 seconds between expletives
    if (currentTime - this.lastExpletiveTime < 4000) {
      return;
    }
    
    // Then check if we should play a sound (25% chance)
    if (Math.random() > 0.25) {
      return;
    }
    
    // Only play if we have sounds
    if (this.expletiveSounds && this.expletiveSounds.length > 0) {
      // Choose a random sound
      const randomIndex = Math.floor(Math.random() * this.expletiveSounds.length);
      
      try {
        // Get the audio element
        const audioElement = this.expletiveSounds[randomIndex];
        
        // Reset to beginning
        audioElement.currentTime = 0;
        
        // Play with managed volume
        audioElement.volume = 0.7;
        const playPromise = audioElement.play();
        
        // Update the last expletive time
        this.lastExpletiveTime = currentTime;
        
        // Handle promise silently
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } catch (error) {}
    }
  }
  
  // Play a random death sound when an enemy dies
  playRandomDeathSound() {
    // Only play if we have sounds
    if (this.deathSounds && this.deathSounds.length > 0) {
      // Choose a random sound
      const randomIndex = Math.floor(Math.random() * this.deathSounds.length);
      
      try {
        // Get the audio element
        const audioElement = this.deathSounds[randomIndex];
        
        // Reset to beginning
        audioElement.currentTime = 0;
        
        // Play with managed volume
        audioElement.volume = 0.7;
        const playPromise = audioElement.play();
        
        // Handle promise silently
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } catch (error) {}
    }
  }
}