const { contextBridge, ipcRenderer } = require('electron');

// Railway backend endpoint
const RAILWAY_BACKEND = 'https://perla-backend-production-6e4d.up.railway.app';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // API Key management
    setApiKey: (apiKey) => ipcRenderer.invoke('set-api-key', apiKey),
    getConfig: () => ipcRenderer.invoke('get-config'),
    
    // Add more API methods here as needed for your application
    platform: process.platform
  }
); 

// Expose direct API access to the Railway backend
contextBridge.exposeInMainWorld('api', {
  async askPerla(prompt, previousSales = [], selectedSales = []) {
    try {
      const response = await fetch(`${RAILWAY_BACKEND}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, previousSales, selectedSales }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error calling Perla API:', error);
      return {
        success: false,
        message: 'Error de conexión con el asistente. Por favor, intenta de nuevo.'
      };
    }
  },
  
  async openai(model, messages) {
    try {
      const response = await fetch(`${RAILWAY_BACKEND}/api/openai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return { error: 'Error de conexión con OpenAI' };
    }
  },
  
  async getConfig() {
    try {
      const response = await fetch(`${RAILWAY_BACKEND}/api/config`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching config:', error);
      return { hasApiKey: false };
    }
  },
  
  async setConfig(apiKey) {
    try {
      const response = await fetch(`${RAILWAY_BACKEND}/api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error setting config:', error);
      return { success: false, message: 'Error al guardar la configuración' };
    }
  }
});

// Provide environment info for the frontend
contextBridge.exposeInMainWorld('electronAPI', {
  // Basic app information
  platform: process.platform,
  
  // Let frontend know we're using Railway backend
  getRailwayEndpoint: () => RAILWAY_BACKEND
}); 