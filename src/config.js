import { BootScene } from './js/scenes/BootScene.js';
import { StartScene } from './js/scenes/StartScene.js';
import { IntroScene } from './js/scenes/IntroScene.js';
import { MenuScene } from './js/scenes/MenuScene.js';
import { CharacterSelectScene } from './js/scenes/CharacterSelectScene.js';
import { TutorialScene } from './js/scenes/TutorialScene.js';
import { LobbyScene } from './js/scenes/LobbyScene.js';
import { GameScene } from './js/scenes/GameScene.js';
import { GameOverScene } from './js/scenes/GameOverScene.js';

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

// Get initial dimensions
let width = window.innerWidth;
let height = window.innerHeight;

// No need to swap dimensions - we'll support both orientations now

// Game Constants
export const GAME_WIDTH = width;
export const GAME_HEIGHT = height;
export const BULLET_TIME_SLOWDOWN = 0.05; // Slow down to 5% of normal speed (same as rhythm game)
export const GAME_VERSION = 'v0.420';

// Web3 Constants
export const WEB3_CONFIG = {
  // Set to true to require wallet connection to play
  walletRequired: true,
  
  // Set to true to require wallet to be whitelisted
  whitelistRequired: true,
  
  // Solana network to connect to
  network: 'devnet', // 'mainnet-beta', 'testnet', 'devnet'
  
  // Set to true to automatically try to connect to the last used wallet
  autoConnect: false,
  
  // Set to false to disable persistent wallet authentication
  persistentAuth: false,
  
  // Supported wallets
  supportedWallets: ['phantom', 'solflare', 'slope']
};

// Game Configuration
export const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    orientation: Phaser.Scale.NO_ORIENTATION, // Allow any orientation
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  input: {
    activePointers: 3, // Support multiple simultaneous touches
    touch: { capture: true }
  },
  // Set the parent element for the game canvas
  parent: 'game-container',
  // Add DOM plugin to support web3 UI
  dom: {
    createContainer: true
  },
  // Remove custom pipeline configuration from here
  // We'll create the pipeline in the BootScene instead
  scene: [BootScene, StartScene, IntroScene, MenuScene, CharacterSelectScene, TutorialScene, LobbyScene, GameScene, GameOverScene]
};