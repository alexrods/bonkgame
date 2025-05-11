/**
 * Polyfills para bibliotecas Web3 y Metaplex
 * Este archivo proporciona los objetos necesarios que normalmente están disponibles en Node.js
 * pero no en el navegador, como global, Buffer y process.
 */

// Polyfill para el objeto global
if (typeof window !== 'undefined') {
  window.global = window;
}

// Polyfill para process
if (typeof window.process === 'undefined') {
  window.process = { env: { NODE_ENV: 'production' } };
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

console.log('Web3 polyfills cargados correctamente');
