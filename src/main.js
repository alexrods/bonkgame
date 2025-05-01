import { config, WEB3_CONFIG } from './config.js';

// Detect if the device is mobile
const isMobile = (
  navigator.userAgent.match(/Android/i) ||
  navigator.userAgent.match(/webOS/i) ||
  navigator.userAgent.match(/iPhone/i) ||
  navigator.userAgent.match(/iPad/i) ||
  navigator.userAgent.match(/iPod/i) ||
  navigator.userAgent.match(/BlackBerry/i) ||
  navigator.userAgent.match(/Windows Phone/i) ||
  (window.innerWidth <= 800 && window.innerHeight <= 1200)
);

// Make WEB3_CONFIG available globally
window.WEB3_CONFIG = WEB3_CONFIG;

// Set up DOM-based loading screen
document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBar = document.getElementById('loading-bar');
  const loadingPercent = document.getElementById('loading-percent');
  const loadingAsset = document.getElementById('loading-asset');
  
  window.addEventListener('game-loading-progress', (event) => {
    const { value, currentAsset } = event.detail;
    const percent = Math.floor(value * 100);
    
    loadingBar.style.width = `${percent}%`;
    loadingPercent.textContent = `${percent}%`;
    
    if (currentAsset) {
      let assetName = currentAsset;
      if (assetName.includes('_')) {
        assetName = assetName
          .replace(/_/g, ' ')
          .replace(/\\b\\w/g, l => l.toUpperCase());
      }
      loadingAsset.textContent = `Loading: ${assetName}`;
    }
  });
  
  window.addEventListener('game-loading-complete', () => {
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }, 300);
  });
});

// Force font preloading
const preloadFonts = () => {
  const fonts = [
    { name: 'Creepster', text: 'Drainer' },
    { name: 'Bungee', text: 'Toaster' },
    { name: 'Tektur', text: 'Menu Text' },
    { name: 'Metal Mania', text: 'Headings' },
    { name: 'Audiowide', text: 'UI Text' }
  ];

  fonts.forEach(font => {
    const span = document.createElement('span');
    span.innerHTML = font.text;
    span.style.fontFamily = `'${font.name}', Arial`;
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = '96px';
    document.body.appendChild(span);
    
    setTimeout(() => {
      document.body.removeChild(span);
    }, 5000);
  });
};

preloadFonts();

// Initialize the game
const game = new Phaser.Game(config);
window.game = game;

// Handle audio unlock for browsers
const handleAudioUnlock = () => {
  if (game.sound?.context?.state === 'suspended') {
    game.sound.context.resume();
  }
};

// Handle visibility change to prevent sound pile-up
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden - pause all audio
    if (game.sound && game.sound.sounds) {
      game.sound.sounds.forEach(sound => {
        if (sound.isPlaying) {
          sound.pause();
        }
      });
    }
    
    // Also pause any HTML Audio elements
    document.querySelectorAll('audio').forEach(audio => {
      if (!audio.paused) {
        audio.pause();
        audio._wasPlaying = true;
      }
    });
  } else {
    // Page is visible again
    if (game.sound && game.sound.sounds) {
      game.sound.sounds.forEach(sound => {
        if (sound.isPaused) {
          sound.resume();
        }
      });
    }
    
    // Resume HTML Audio elements that were playing
    document.querySelectorAll('audio').forEach(audio => {
      if (audio._wasPlaying) {
        audio.play().catch(() => {});
        delete audio._wasPlaying;
      }
    });
  }
});

// Initialize gamepad support
game.events.once('ready', () => {
  if (game.input?.gamepad) {
    game.input.gamepad.enabled = true;
  }
});

// Add global event listeners to unlock audio
window.addEventListener('click', handleAudioUnlock, false);
window.addEventListener('touchend', handleAudioUnlock, false);
window.addEventListener('keydown', handleAudioUnlock, false);
window.addEventListener('gamepadconnected', handleAudioUnlock, false);
window.addEventListener('gamepaddisconnected', handleAudioUnlock, false);

// Helper function to poll gamepad inputs for audio unlocking
const pollGamepadForAudioUnlock = () => {
  if (navigator.getGamepads) {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const pad = gamepads[i];
      if (pad) {
        // Check if any button is pressed
        for (let j = 0; j < pad.buttons.length; j++) {
          if (pad.buttons[j] && pad.buttons[j].pressed) {
            handleAudioUnlock();
            return;
          }
        }
        
        // Check if any axis has significant movement
        for (let j = 0; j < pad.axes.length; j++) {
          if (Math.abs(pad.axes[j]) > 0.5) {
            handleAudioUnlock();
            return;
          }
        }
      }
    }
  }
};

// Poll for gamepad input to unlock audio
const gamepadPollInterval = setInterval(() => {
  pollGamepadForAudioUnlock();
  
  // Stop polling after 30 seconds
  setTimeout(() => {
    clearInterval(gamepadPollInterval);
  }, 30000);
}, 100);

// Handle window resizing - debounced to reduce processing
let resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    game.scale.resize(width, height);
    
    // Check for portrait mode and adjust game scale
    const isPortrait = height > width;
    
    // Set a game flag for portrait mode that scenes can use
    game.registry.set('isPortrait', isPortrait);
    
    // Emit an event that scenes can listen for
    game.events.emit('orientationChange', { isPortrait });
    
    // Redraw scanlines with delay to ensure resize is complete
    setTimeout(() => {
      const redrawScanlines = game.registry.get('redrawScanlines');
      if (typeof redrawScanlines === 'function') {
        redrawScanlines();
      }
    }, 100);
  }, 250); // 250ms debounce
}, false);

// Listen for orientation changes - debounced to reduce processing
let orientationTimer;
window.addEventListener('orientationchange', function() {
  clearTimeout(orientationTimer);
  orientationTimer = setTimeout(() => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    game.scale.resize(width, height);
    
    const isPortrait = height > width;
    game.registry.set('isPortrait', isPortrait);
    game.events.emit('orientationChange', { isPortrait });
    
    setTimeout(() => {
      const redrawScanlines = game.registry.get('redrawScanlines');
      if (typeof redrawScanlines === 'function') {
        redrawScanlines();
      }
    }, 100);
  }, 300); // 300ms debounce
});

// Handle wallet UI
window.addEventListener('DOMContentLoaded', () => {
  const walletUI = document.getElementById('wallet-ui');
  if (walletUI) {
    walletUI.style.zIndex = '1000';
    walletUI.style.display = 'none';
  }
  
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.style.width = '100%';
    gameContainer.style.height = '100%';
    gameContainer.style.position = 'absolute';
    gameContainer.style.top = '0';
    gameContainer.style.left = '0';
  }
});
