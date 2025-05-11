// Integración del servidor Express dentro de Electron
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Función para buscar módulos en varias ubicaciones
function findModule(moduleName) {
  const possiblePaths = [
    // Rutas estándar
    path.join(app.getAppPath(), 'node_modules', moduleName),
    path.join(process.resourcesPath || '', 'node_modules', moduleName),
    
    // Rutas específicas de Electron empaquetado
    path.join(process.resourcesPath || '', 'app.asar', 'node_modules', moduleName),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', moduleName),
    
    // Rutas para desarrollo
    path.join(__dirname, '..', 'node_modules', moduleName),
    
    // Rutas absolutas de electron-builder
    path.join(process.resourcesPath || '', 'node_modules', moduleName),
    path.join(process.env.APPDATA || '', 'node_modules', moduleName)
  ];
  
  // Filtrar rutas inválidas (cuando resourcesPath no está definido)
  const validPaths = possiblePaths.filter(p => !p.includes('undefined'));
  
  console.log(`🔍 Buscando módulo '${moduleName}' en las siguientes rutas:`, validPaths);
  
  for (const modulePath of validPaths) {
    try {
      if (fs.existsSync(modulePath)) {
        console.log(`✅ Módulo '${moduleName}' encontrado en: ${modulePath}`);
        return require(modulePath);
      }
    } catch (err) {
      // Continuar buscando
    }
  }
  
  // Si no encontramos el módulo en rutas específicas, intentar load normal
  try {
    return require(moduleName);
  } catch (err) {
    throw new Error(`No se pudo encontrar el módulo '${moduleName}' en ninguna ubicación`);
  }
}

// Configurar los paths para resolver módulos en producción
if (app.isPackaged) {
  const resourcesPath = process.resourcesPath;
  module.paths.push(path.join(resourcesPath, 'node_modules'));
  module.paths.push(path.join(app.getAppPath(), 'node_modules'));
  module.paths.push(path.join(resourcesPath, 'app.asar/node_modules'));
  console.log('Paths de módulos adicionales en backend:', module.paths);
}

// Intenta cargar express de varias maneras posibles
let express, cors, OpenAI;
try {
  express = findModule('express');
  cors = findModule('cors');
  const openai = findModule('openai');
  OpenAI = openai.OpenAI || openai;
  console.log('✅ Módulos cargados correctamente');
} catch (error) {
  console.error('❌ Error fatal cargando módulos:', error.message);
  throw new Error(`No se pudieron cargar los módulos necesarios: ${error.message}`);
}

// Función para iniciar el servidor backend
function startBackendServer(mainWindow) {
  console.log('Iniciando servidor backend Express...');
  
  try {
  const expressApp = express();
    let port = 3333; // Puerto predeterminado para comunicación local
    const isDev = !app.isPackaged;
    
    // Array de puertos para intentar en orden
    const ports = [3333, 3334, 3335, 3336, 3337, 3338, 3339, 3340];
    let portFound = false;
    
    // Si estamos en desarrollo, encontrar un puerto disponible
    if (isDev) {
      console.log('Buscando un puerto disponible...');
      
      // Función auxiliar asíncrona para verificar un puerto
      const checkPortAvailability = async (testPort) => {
        return new Promise((resolve) => {
          const testServer = require('net').createServer();
          
          testServer.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              console.log(`El puerto ${testPort} está ocupado, probando el siguiente...`);
              resolve(false);
            }
            testServer.close();
            resolve(false);
          });
          
          testServer.once('listening', () => {
            testServer.close();
            resolve(true);
          });
          
          testServer.listen(testPort);
        });
      };
      
      // Probar puertos secuencialmente usando async/await
      (async () => {
        for (const testPort of ports) {
          try {
            const available = await checkPortAvailability(testPort);
            if (available) {
              port = testPort;
              portFound = true;
              console.log(`¡Puerto disponible encontrado! Usando puerto ${port}`);
              break;
            }
          } catch (err) {
            console.log(`Error al verificar puerto ${testPort}: ${err.message}`);
          }
        }
        
        if (!portFound) {
          console.log('No se encontró ningún puerto disponible. Usando puerto 3380 como último recurso.');
          port = 3380; // Puerto alto menos probable que esté en uso
        }
        
        // Iniciar el servidor una vez que se haya determinado el puerto
        startExpressServer();
      })();
      
      // Devolver un objeto vacío por ahora, se reemplazará cuando el servidor realmente arranque
      return { pendingServer: true, port: null };
    } else {
      // En producción, usar el puerto predeterminado directamente
      return startExpressServer();
    }
    
    // Función para iniciar el servidor Express con el puerto seleccionado
    function startExpressServer() {
      // Configuración detallada de paths y configuración
      console.log('Configurando rutas del backend...');
      console.log('User data path:', app.getPath('userData'));

  // Ruta para guardar la clave API de OpenAI
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'perla-config.json');
      console.log('Ruta de configuración:', configPath);

  // Función para leer la configuración
  function readConfig() {
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
            console.log('Configuración leída correctamente');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading config:', error);
    }
    // Valor predeterminado con API key incorporada
        console.log('Usando API key predeterminada');
    return { apiKey: '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' };
  }

  // Función para guardar la configuración
  function saveConfig(data) {
    try {
      fs.writeFileSync(configPath, JSON.stringify(data), 'utf8');
          console.log('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  // Middleware
  expressApp.use(cors());
  expressApp.use(express.json());

  // Ruta básica de verificación
  expressApp.get('/', (req, res) => {
        console.log('Petición recibida en ruta raíz');
    res.status(200).json({ status: 'OK', message: 'Perla backend integrado está funcionando' });
  });

  // Configurar OpenAI
  let openaiClient = null;

  function setupOpenAI() {
        console.log('Configurando cliente OpenAI...');
    const config = readConfig();
    if (config.apiKey) {
          try {
      openaiClient = new OpenAI({
        apiKey: config.apiKey,
      });
            console.log('Cliente OpenAI configurado correctamente');
      return true;
          } catch (error) {
            console.error('Error al configurar cliente OpenAI:', error);
      return false;
    }
        }
        return false;
      }

      // Intentar configurar OpenAI al inicio
      setupOpenAI();
      
      // Iniciar el servidor HTTP con el puerto seleccionado
      console.log(`Intentando iniciar servidor Express en puerto ${port}...`);
      const server = expressApp.listen(port, () => {
        console.log(`Servidor Express iniciado exitosamente en puerto ${port}`);
        
        // Notificar a la ventana principal qué puerto se está usando
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('backend-port', { port });
        }
      });

      // Manejar errores del servidor de manera más detallada
      server.on('error', (error) => {
        console.error('Error en el servidor Express:', error);
        if (error.code === 'EADDRINUSE') {
          console.error(`Error crítico: El puerto ${port} ya está en uso a pesar de verificación previa.`);
        }
      });

      // Agregar el puerto como propiedad del servidor para fácil acceso
      server.port = port;

      return { server, port }; // Devolver tanto el servidor como el puerto seleccionado
    }
  } catch (error) {
    console.error('Error fatal al iniciar el servidor backend:', error);
    return null;
  }
}

module.exports = { startBackendServer }; 