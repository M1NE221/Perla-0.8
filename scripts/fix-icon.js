const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Comprobar si tenemos una imagen PNG de origen
const sourcePng = path.join(__dirname, '../public/icon-512.png');
const iconPath = path.join(__dirname, '../public/icon.ico');

console.log('Creando icono válido para Windows...');

// Si no existe el archivo PNG de origen, crearemos uno básico
if (!fs.existsSync(sourcePng)) {
  console.log('No se encontró el archivo PNG de origen, creando uno básico...');
  
  try {
    // Instalamos jimp para crear una imagen básica
    execSync('npm install --no-save jimp', { stdio: 'inherit' });
    
    const Jimp = require('jimp');
    
    // Crear una imagen negra básica de 512x512
    new Jimp(512, 512, '#000000', (err, image) => {
      if (err) throw err;
      
      // Añadir texto "PS" en blanco
      Jimp.loadFont(Jimp.FONT_SANS_64_WHITE).then(font => {
        image.print(font, 150, 200, 'PS', 512);
        image.write(sourcePng);
        console.log(`Imagen PNG básica creada en ${sourcePng}`);
        convertToIco();
      });
    });
  } catch (error) {
    console.error('Error al crear imagen PNG básica:', error);
    process.exit(1);
  }
} else {
  console.log(`Se encontró la imagen PNG existente en ${sourcePng}`);
  convertToIco();
}

function convertToIco() {
  try {
    // Instalamos png-to-ico para convertir PNG a ICO
    execSync('npm install --no-save png-to-ico', { stdio: 'inherit' });
    
    const pngToIco = require('png-to-ico');
    
    pngToIco(sourcePng)
      .then(buf => {
        fs.writeFileSync(iconPath, buf);
        console.log(`Icono creado correctamente en ${iconPath}`);
      })
      .catch(err => {
        console.error('Error al convertir PNG a ICO:', err);
        process.exit(1);
      });
  } catch (error) {
    console.error('Error al instalar dependencias o convertir a ICO:', error);
    process.exit(1);
  }
} 