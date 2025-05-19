// Script para convertir todas las imágenes PNG, JPG y GIF a formato WebP
// Este script debe ejecutarse con Node.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const ASSETS_DIR = path.resolve(__dirname, '../public/assets');
const QUALITY = 80; // Calidad de las imágenes WebP (0-100)
const RESIZE_MOBILE = false; // Si queremos redimensionar para móviles

// Extensiones para convertir
const VALID_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif'];

// Verifica si cwebp está instalado
function checkCwebp() {
  try {
    execSync('cwebp -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('Error: cwebp no está instalado. Por favor, instala libwebp:');
    console.error('  En macOS: brew install webp');
    console.error('  En Linux: sudo apt-get install webp');
    return false;
  }
}

// Convierte una imagen a WebP
function convertToWebP(filePath) {
  const fileExt = path.extname(filePath).toLowerCase();
  if (!VALID_EXTENSIONS.includes(fileExt)) return;
  
  const outputPath = filePath.replace(fileExt, '.webp');
  
  // Verifica si el WebP ya existe y es más reciente que el original
  if (fs.existsSync(outputPath)) {
    const originalStat = fs.statSync(filePath);
    const webpStat = fs.statSync(outputPath);
    
    // Si el WebP es más reciente, no hace falta reconvertir
    if (webpStat.mtime > originalStat.mtime) {
      console.log(`Omitiendo ${path.basename(filePath)} (ya está actualizado)`);
      return;
    }
  }
  
  try {
    let command = `cwebp -q ${QUALITY} "${filePath}" -o "${outputPath}"`;
    
    // Si es una imagen animada (GIF), usamos gif2webp
    if (fileExt === '.gif') {
      command = `gif2webp -q ${QUALITY} "${filePath}" -o "${outputPath}"`;
    }
    
    console.log(`Convirtiendo: ${path.basename(filePath)}`);
    execSync(command);
    
    // Comparación de tamaños
    const originalSize = fs.statSync(filePath).size;
    const webpSize = fs.statSync(outputPath).size;
    const savings = ((1 - webpSize / originalSize) * 100).toFixed(2);
    
    console.log(`  ✓ Ahorro: ${savings}% (${formatSize(originalSize)} → ${formatSize(webpSize)})`);
  } catch (error) {
    console.error(`  ✗ Error convirtiendo ${path.basename(filePath)}: ${error.message}`);
  }
}

// Formatea tamaño en bytes a KB o MB
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Recorre el directorio recursivamente
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (stat.isFile()) {
      convertToWebP(filePath);
    }
  });
}

// Función principal
function main() {
  if (!checkCwebp()) {
    process.exit(1);
  }
  
  console.log(`Convirtiendo imágenes en ${ASSETS_DIR} a WebP (calidad: ${QUALITY})...`);
  
  // Verifica si el directorio de assets existe
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Error: El directorio de assets no existe: ${ASSETS_DIR}`);
    process.exit(1);
  }
  
  // Procesa todos los archivos
  processDirectory(ASSETS_DIR);
  
  console.log('¡Conversión completada!');
}

main();
