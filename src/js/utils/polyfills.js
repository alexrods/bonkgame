/**
 * Polyfills for Web3 and Metaplex libraries
 * This file provides the objects necessary that are normally available in Node.js
 * but not in the browser, such as global, Buffer and process.
 */

// Import the Buffer polyfill as an ES module
import { Buffer as BufferPolyfill } from 'buffer/';

// Polyfill for global
if (typeof global === 'undefined') {
  window.global = window;
}

// Polyfill for process
if (typeof process === 'undefined') {
  window.process = {
    env: { NODE_ENV: 'production' },
    version: '',
    nextTick: function(fn) { setTimeout(fn, 0); }
  };
}

// Polyfill for Buffer
if (typeof Buffer === 'undefined') {
  window.Buffer = BufferPolyfill;
}

// Polyfill for crypto
if (window.crypto && !window.crypto.subtle && window.crypto.webkitSubtle) {
  window.crypto.subtle = window.crypto.webkitSubtle;
}

// Polyfill for TextEncoder/TextDecoder if not available
if (typeof window.TextEncoder === 'undefined') {
  window.TextEncoder = function TextEncoder() {};
  window.TextEncoder.prototype.encode = function encode(str) {
    const encoded = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      encoded[i] = str.charCodeAt(i);
    }
    return encoded;
  };
}

if (typeof window.TextDecoder === 'undefined') {
  window.TextDecoder = function TextDecoder() {};
  window.TextDecoder.prototype.decode = function decode(bytes) {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  };
}
