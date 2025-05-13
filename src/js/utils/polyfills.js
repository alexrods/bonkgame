/**
 * Polyfills para bibliotecas Web3 y Metaplex
 * Este archivo proporciona los objetos necesarios que normalmente están disponibles en Node.js
 * pero no en el navegador, como global, Buffer y process.
 */

// Importamos el polyfill de Buffer como un módulo ES
import { Buffer as BufferPolyfill } from 'buffer/';

// Polyfill para global
if (typeof global === 'undefined') {
  window.global = window;
}

// Polyfill para process
if (typeof process === 'undefined') {
  window.process = {
    env: { NODE_ENV: 'production' },
    version: '',
    nextTick: function(fn) { setTimeout(fn, 0); }
  };
}

// Polyfill para Buffer
if (typeof Buffer === 'undefined') {
  window.Buffer = BufferPolyfill;
}

// Polyfill para crypto
if (window.crypto && !window.crypto.subtle && window.crypto.webkitSubtle) {
  window.crypto.subtle = window.crypto.webkitSubtle;
}

// Polyfill para TextEncoder/TextDecoder si no están disponibles
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
