const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const fs = require('fs');

// Añadir el directorio de módulos al PATH en producción
if (!isDev) {
  const extraResourcesPath = process.resourcesPath;
  module.paths.push(path.join(extraResourcesPath, 'node_modules'));
  module.paths.push(path.join(app.getAppPath(), 'node_modules'));
  module.paths.push(path.join(process.resourcesPath, 'app.asar/node_modules'));
  
  console.log('Paths de módulos adicionales:');
  console.log(module.paths);
}

// Set app name
app.name = 'Perla';

// Resolver problema de icono en Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.perla.sales');
}

let mainWindow;

// Set the app icon directly from the image path
function setAppIcon() {
  // Try multiple potential icon paths, prioritizing platform-specific formats
  const iconPaths = [];
  
  // Platform-specific icons first
  if (process.platform === 'darwin') {
    iconPaths.push(path.join(__dirname, '../public/perla.icns')); // New macOS icon
    iconPaths.push(path.join(__dirname, '../public/icon.icns'));
  } else if (process.platform === 'win32') {
    iconPaths.push(path.join(__dirname, '../public/perla.ico')); // Nuevo nombre primero
    iconPaths.push(path.join(__dirname, '../public/icon.ico'));
  }
  
  // Then universal formats
  iconPaths.push(path.join(__dirname, '../public/icon-512.png'));
  iconPaths.push(path.join(__dirname, '../public/icon.png'));
  
  let icon = null;
  let iconPath = null;
  
  for (const potentialPath of iconPaths) {
    try {
      if (fs.existsSync(potentialPath)) {
        iconPath = potentialPath;
        icon = nativeImage.createFromPath(potentialPath);
        if (!icon.isEmpty()) {
          break;
        }
      }
    } catch (error) {
      // Continuar con la siguiente ruta
    }
  }
  
  return { icon, iconPath };
}

// Create the window and explicitly handle the icon for each platform
function createWindow() {
  // Set the app icon
  const { icon, iconPath } = setAppIcon();
  
  // Configuración específica para Windows
  let windowOptions = {
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    // Remove the window frame, create a frameless window
    frame: false,
    titleBarStyle: 'hiddenInset',
  };
  
  // Agregar el icono de manera específica según la plataforma
  if (process.platform === 'win32') {
    if (iconPath) {
      windowOptions.icon = iconPath; // En Windows es mejor usar la ruta directamente
    }
  } else {
    if (icon && !icon.isEmpty()) {
      windowOptions.icon = icon; // En otras plataformas usamos el objeto nativeImage
    }
  }
  
  // Create the browser window
  mainWindow = new BrowserWindow(windowOptions);

  // Para Windows, intentar establecer el icono de la barra de tareas explícitamente
  if (process.platform === 'win32' && iconPath) {
    try {
      mainWindow.setIcon(iconPath);
    } catch (error) {
      // Continuar en caso de error
    }
  }

  // For macOS, try to set the represented filename for proper icon display
  if (process.platform === 'darwin') {
    try {
      const appPath = path.join(__dirname, '../');
      mainWindow.setRepresentedFilename(appPath);
    } catch (error) {
      // Continuar en caso de error
    }
  }

  if (isDev) {
    // In development, load from the local dev server
    const port = process.env.PORT || 3333;
    mainWindow.loadURL(`http://localhost:${port}`);
    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
  } else {
    // Cargar la interfaz directamente, sin esperar a un backend local
    loadUI();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Cargar la interfaz
function loadUI() {
  console.log('Cargando la interfaz de usuario...');
  
  // En producción, buscar el archivo index.html
  const indexPath = path.join(__dirname, '../out/index.html');
  
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
    mainWindow.webContents.openDevTools();  // ← esto es temporal para debug
  } else {
    // Intentar cargar desde la carpeta raíz como alternativa
    const altPath = path.join(__dirname, '../out/index/index.html');
    if (fs.existsSync(altPath)) {
      mainWindow.loadFile(altPath);
      mainWindow.webContents.openDevTools();  // ← esto es temporal para debug
    } else {
      // Mostrar mensaje de error si no se encuentra el archivo
      mainWindow.loadURL(`data:text/html,<html><body><h1>Error: No se encontró el archivo index.html</h1><p>La aplicación no puede iniciarse porque faltan archivos necesarios.</p></body></html>`);
      mainWindow.webContents.openDevTools();  // ← esto es temporal para debug
    }
  }
}

// Set up IPC events for API key configuration via the Railway backend
function setupIPC() {
  // Usar directamente el endpoint de Railway para la configuración de API key
  const railwayEndpoint = 'https://perla-backend-production-6e4d.up.railway.app';
  
  // Manejar configuración de API key
  ipcMain.handle('set-api-key', async (event, apiKey) => {
    try {
      console.log('Intentando configurar API key en Railway...');
      const response = await fetch(`${railwayEndpoint}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      
      const result = await response.json();
      console.log('Resultado de configuración de API key:', result);
      return result;
    } catch (error) {
      console.error('Error al configurar API key:', error);
      return { success: false, message: 'Error al guardar la API key' };
    }
  });
  
  // Manejar obtención de configuración
  ipcMain.handle('get-config', async () => {
    try {
      console.log('Intentando obtener configuración desde Railway...');
      const response = await fetch(`${railwayEndpoint}/api/config`);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const config = await response.json();
      return config;
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      return { success: false, message: 'Error al obtener la configuración' };
    }
  });
}

// App event listeners
app.on('ready', () => {
  createWindow();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle app shutdown
app.on('before-quit', async () => {
  console.log('Aplicación cerrándose...');
}); 