const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

// Configuración
const appName = packageJson.build.productName || packageJson.name;
const version = packageJson.version;
const distDir = path.join(__dirname, '../dist');
const landingInfoDir = path.join(distDir, 'landing-info');
const executablePath = path.join(distDir, 'Perla-Sales-Portable.exe');

// Asegurarse de que el directorio existe
if (!fs.existsSync(landingInfoDir)) {
  fs.mkdirSync(landingInfoDir, { recursive: true });
}

console.log('Generando información para la landing page...');

// Verificar que el ejecutable existe
if (!fs.existsSync(executablePath)) {
  console.error(`Error: No se encontró el ejecutable en ${executablePath}`);
  console.error(
    'Por favor, asegúrate de haber ejecutado admin-create-exe.bat primero.'
  );
  process.exit(1);
}

// Obtener estadísticas del archivo
const exeStats = fs.statSync(executablePath);
const exeSizeInMB = (exeStats.size / (1024 * 1024)).toFixed(2);

// Crear información para la landing page
const landingInfo = {
  name: appName,
  version: version,
  fileName: path.basename(executablePath),
  filePath: executablePath,
  sizeInMB: exeSizeInMB,
  releaseDate: new Date().toISOString().split('T')[0],
  downloadUrl: `REPLACE_WITH_ACTUAL_URL/${path.basename(executablePath)}`,
  instructions:
    '1. Descarga el archivo\n2. Haz doble clic para ejecutar directamente (no requiere instalación)',
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
    
    <h2>Instrucciones</h2>
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
console.log(
  `Ejemplo HTML generado en: ${landingInfoDir}/download-example.html`
);
