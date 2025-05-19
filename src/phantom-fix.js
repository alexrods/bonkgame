/**
 * phantom-fix.js - Solución específica para Phantom Wallet
 * Este archivo debe incluirse antes que cualquier otro script del juego
 */

(function() {
  // Detectar si estamos en Phantom
  const isPhantomWallet = /Phantom/i.test(navigator.userAgent);
  
  if (isPhantomWallet) {
    console.log('[PHANTOM-FIX] Activando modo de compatibilidad extrema');
    
    // Crear registro global para comunicación entre componentes
    window.PHANTOM_COMPATIBILITY = {
      active: true,
      loadingComplete: false,
      gameStarted: false
    };
    
    // 1. Forzar finalización de carga después de tiempo establecido (3 segundos)
    setTimeout(() => {
      console.log('[PHANTOM-FIX] Forzando finalización de carga');
      window.PHANTOM_COMPATIBILITY.loadingComplete = true;
      
      // Disparar evento para cualquier listener
      try {
        window.dispatchEvent(new CustomEvent('game-loading-complete'));
        
        // Intentar también mostrar el menú directamente
        const loadingElement = document.getElementById('loading-screen');
        if (loadingElement) {
          loadingElement.style.display = 'none';
        }
        
        // Modificar mensaje de carga
        const message = document.getElementById('loading-message');
        if (message) {
          message.textContent = 'Iniciando Bonk Games (Modo compatible)';
        }
      } catch (e) {
        console.error('[PHANTOM-FIX] Error al completar carga:', e);
      }
    }, 3000);
    
    // 2. Crear funciones stub para evitar errores
    // Para Phaser
    window.stubPhaser = function() {
      if (window.Phaser) {
        // Reemplazar métodos problemáticos con versiones simplificadas
        try {
          const originalLoader = Phaser.Loader;
          if (originalLoader && originalLoader.prototype) {
            // Simplificar el cargador
            const originalLoadFile = originalLoader.prototype.loadFile;
            originalLoader.prototype.loadFile = function(file) {
              // Limitar archivos a cargar a solo los esenciales
              const isEssential = 
                file.key && (
                  file.key.includes('button') || 
                  file.key.includes('logo') ||
                  file.key.includes('intro') ||
                  file.key === 'shot'
                );
              
              if (isEssential) {
                return originalLoadFile.call(this, file);
              } else {
                // Simular carga exitosa para archivos no esenciales
                file.state = Phaser.Loader.FILE_COMPLETE;
                this.fileComplete(file);
                return this;
              }
            };
          }
          
          // Optimizar renderizador 
          if (Phaser.Renderer && Phaser.Renderer.WebGL) {
            console.log('[PHANTOM-FIX] Optimizando renderizador WebGL');
            Phaser.Renderer.WebGL.WebGLRenderer.prototype.originalMaxTextures = 
              Phaser.Renderer.WebGL.WebGLRenderer.prototype.maxTextures;
            
            // Limitar máximo de texturas
            Object.defineProperty(Phaser.Renderer.WebGL.WebGLRenderer.prototype, 'maxTextures', {
              get: function() {
                return Math.min(8, this.originalMaxTextures || 8);
              }
            });
          }
        } catch (e) {
          console.error('[PHANTOM-FIX] Error al optimizar Phaser:', e);
        }
      }
    };
    
    // 3. Configurar observador para Phaser
    const checkPhaserInterval = setInterval(() => {
      if (window.Phaser) {
        window.stubPhaser();
        clearInterval(checkPhaserInterval);
      }
    }, 100);
    
    // 4. Intervenir peticiones de red problemáticas
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      // Omitir peticiones no esenciales
      if (typeof url === 'string' && 
          (url.includes('analytics') || 
           url.includes('tracking') || 
           url.includes('telemetry'))) {
        console.log('[PHANTOM-FIX] Omitiendo petición no esencial:', url);
        return Promise.resolve(new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return originalFetch(url, options);
    };
    
    // 5. Limpiar recursos no utilizados periódicamente
    setInterval(() => {
      if (window.PHANTOM_COMPATIBILITY.gameStarted) {
        console.log('[PHANTOM-FIX] Limpiando recursos');
        try {
          // Limpiar cache de navegador
          if ('caches' in window) {
            caches.keys().then(cacheNames => {
              cacheNames.forEach(cacheName => {
                if (cacheName.includes('image')) {
                  caches.delete(cacheName);
                }
              });
            });
          }
          
          // Otras limpiezas
          if (window.gc) window.gc();
        } catch (e) {
          console.warn('[PHANTOM-FIX] Error al limpiar recursos:', e);
        }
      }
    }, 60000); // Cada minuto
    
    // 6. Mostrar mensaje de compatibilidad una vez cargada la página
    document.addEventListener('DOMContentLoaded', () => {
      const loadingContainer = document.querySelector('.loading-container');
      if (loadingContainer) {
        const compatMessage = document.createElement('div');
        compatMessage.style.color = '#0cf';
        compatMessage.style.marginTop = '10px';
        compatMessage.textContent = 'Modo de compatibilidad Phantom activo';
        loadingContainer.appendChild(compatMessage);
      }
    });
  }
})();
