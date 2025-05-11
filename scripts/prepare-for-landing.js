// Script para preparar la aplicación para la landing page
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const packageJson = require('../package.json');

// Configuración
const appName = packageJson.productName || packageJson.name || 'Perla Sales';
const version = packageJson.version;
const distDir = path.join(__dirname, '../dist');
const landingInfoDir = path.join(distDir, 'landing-info');

// Asegurarse de que el directorio existe
if (!fs.existsSync(landingInfoDir)) {
  fs.mkdirSync(landingInfoDir, { recursive: true });
}

// Función principal
async function main() {
  try {
    console.log(`Preparando ${appName} v${version} para la landing page...`);
    
    // 0. Arreglar el icono para Windows
    console.log('Arreglando el icono para Windows...');
    execSync('node scripts/fix-icon.js', { stdio: 'inherit' });
    
    // 1. Verificar que los iconos existen
    checkIcons();
    
    // 2. Actualizar el archivo package.json para asegurar una compilación correcta
    updatePackageJson();
    
    // 3. Compilar para Windows
    console.log('Compilando para Windows...');
    execSync('npm run package:win', { stdio: 'inherit' });
    
    // 4. Generar información para la landing page
    generateLandingInfo();
    
    console.log('¡Proceso completado con éxito!');
    console.log(`Los ejecutables se encuentran en: ${distDir}`);
    console.log(`La información para la landing page se encuentra en: ${landingInfoDir}`);
  } catch (error) {
    console.error('Error durante el proceso de preparación:', error);
    process.exit(1);
  }
}

// Verificar que los iconos necesarios existen
function checkIcons() {
  const requiredIcons = [
    '../public/icon.ico',
    '../public/icon.png',
    '../public/icon-512.png'
  ];
  
  console.log('Verificando iconos...');
  
  for (const iconPath of requiredIcons) {
    const fullPath = path.join(__dirname, iconPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Icono no encontrado: ${fullPath}`);
      process.exit(1);
    }
  }
  
  console.log('Todos los iconos necesarios están presentes.');
}

// Actualizar package.json para asegurar una compilación correcta
function updatePackageJson() {
  console.log('Verificando configuración en package.json...');
  
  const buildConfig = {
    appId: `com.perla.sales`,
    productName: appName,
    files: [
      "out/**/*",
      "electron/**/*"
    ],
    directories: {
      buildResources: "public",
      output: "dist"
    },
    win: {
      target: "nsis",
      icon: "public/icon.ico"
    }
  };
  
  // Solo actualizar si es necesario
  if (JSON.stringify(packageJson.build) !== JSON.stringify(buildConfig)) {
    console.log('Actualizando configuración de compilación en package.json...');
    packageJson.build = buildConfig;
    
    fs.writeFileSync(
      path.join(__dirname, '../package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }
}

// Generar información para la landing page
function generateLandingInfo() {
  console.log('Generando información para la landing page...');
  
  // Buscar el archivo exe generado
  const exeFiles = fs.readdirSync(distDir)
    .filter(file => file.endsWith('.exe'))
    .map(file => path.join(distDir, file));
  
  if (exeFiles.length === 0) {
    console.error('Error: No se encontró ningún archivo .exe en el directorio dist/');
    process.exit(1);
  }
  
  // Obtener estadísticas del archivo
  const exePath = exeFiles[0];
  const exeStats = fs.statSync(exePath);
  const exeSizeInMB = (exeStats.size / (1024 * 1024)).toFixed(2);
  
  // Crear información para la landing page
  const landingInfo = {
    name: appName,
    version: version,
    fileName: path.basename(exePath),
    filePath: exePath,
    sizeInMB: exeSizeInMB,
    releaseDate: new Date().toISOString().split('T')[0],
    downloadUrl: `REPLACE_WITH_ACTUAL_URL/${path.basename(exePath)}`,
    instructions: "1. Descarga el archivo\n2. Haz doble clic para instalar\n3. Sigue las instrucciones en pantalla"
  };
  
  // Guardar la información en un archivo JSON
  fs.writeFileSync(
    path.join(landingInfoDir, 'app-info.json'),
    JSON.stringify(landingInfo, null, 2)
  );
  
  // Crear un HTML de ejemplo para la landing page
  const htmlTemplate = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Descargar ${appName}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .download-btn { 
            display: inline-block; 
            background-color: #4CAF50; 
            color: white; 
            padding: 12px 20px; 
            text-decoration: none; 
            border-radius: 4px; 
            font-weight: bold; 
            margin: 20px 0;
        }
        .app-info { margin: 20px 0; }
        .app-info span { font-weight: bold; }
    </style>
</head>
<body>
    <h1>Descargar ${appName}</h1>
    <p>Versión ${version} - Publicada el ${landingInfo.releaseDate}</p>
    
    <a href="${landingInfo.downloadUrl}" class="download-btn">Descargar para Windows</a>
    
    <div class="app-info">
        <p><span>Tamaño del archivo:</span> ${exeSizeInMB} MB</p>
        <p><span>Nombre del archivo:</span> ${landingInfo.fileName}</p>
    </div>
    
    <h2>Instrucciones de instalación</h2>
    <p>${landingInfo.instructions.replace(/\n/g, '<br>')}</p>
    
    <h2>Requisitos del sistema</h2>
    <ul>
        <li>Windows 10 o superior</li>
        <li>4 GB de RAM mínimo</li>
        <li>100 MB de espacio en disco</li>
    </ul>
</body>
</html>
  `;
  
  fs.writeFileSync(
    path.join(landingInfoDir, 'download-example.html'),
    htmlTemplate
  );
  
  console.log(`Información generada en: ${landingInfoDir}/app-info.json`);
  console.log(`Ejemplo HTML generado en: ${landingInfoDir}/download-example.html`);
}

// Ejecutar el script
main(); 