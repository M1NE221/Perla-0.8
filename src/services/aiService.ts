import axios from 'axios';
import FormData from 'form-data';

// Enhanced SaleData interface with transaction ID that groups multiple products
export interface SaleData {
  id: string;        // Unique ID for this product entry
  transactionId?: string; // Groups products sold in the same transaction
  product: string;
  amount: number;
  price: number;
  totalPrice: number;
  paymentMethod: string;
  client: string;
  date: string;
  needsPriceUpdate?: boolean; // Flag for sales that need price information
  normalizedProduct?: string; // Normalized version of the product name
  normalizedClient?: string;  // Normalized version of the client name
}

// Debug logging utility to only log in development
const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

export interface ActionResult {
  success: boolean;
  message: string;
  data?: {
    message: string;
    [key: string]: any;
  };
  usage?: any;
  response_time_ms?: number;
  sale?: SaleData;
  sales?: SaleData[]; // For multi-product transactions
  deletedId?: string;
  deletedIds?: string[]; // For bulk delete operations
  updatedSales?: SaleData[]; // For returning the updated sales list
  insight?: string;
  pendingAction?: 'update_prices' | 'confirm_entity_match' | 'request_clarification' | 'suggestion'; // Added 'suggestion'
  potentialMatches?: { // For entity matching confirmation
    products?: Array<{original: string, potential: string}>;
    clients?: Array<{original: string, potential: string}>;
    paymentMethods?: Array<{original: string, potential: string}>;
  };
  missingInfo?: { // New field for clarification requests
    type: 'product_details' | 'quantity' | 'price' | 'other';
    question: string;
  };
  suggestion?: string; // Added to store user suggestions
}

// Entity similarity threshold (0-1 where 1 is exact match)
const SIMILARITY_THRESHOLD = 0.8;
const HIGH_CONFIDENCE_THRESHOLD = 0.9;

// Helper function to normalize text for comparison
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/gi, "")        // Remove special characters
    .trim();
};

// Calculate similarity between two strings (0-1)
const calculateSimilarity = (str1: string, str2: string): number => {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) return 1;
  
  // One string is contained within the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    // Calculate ratio based on length difference
    const longerLength = Math.max(normalized1.length, normalized2.length);
    const shorterLength = Math.min(normalized1.length, normalized2.length);
    return shorterLength / longerLength;
  }
  
  // Levenshtein distance for more complex comparisons
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  return 1 - distance / maxLength;
};

// Levenshtein distance implementation
const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;
  
  // Create a matrix of size (m+1) x (n+1)
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // deletion
        dp[i][j - 1] + 1,        // insertion
        dp[i - 1][j - 1] + cost  // substitution
      );
    }
  }
  
  return dp[m][n];
};

// Find similar entities in previous sales
const findSimilarEntities = (
  sales: SaleData[], 
  newEntities: { 
    product?: string; 
    client?: string; 
    paymentMethod?: string;
  }
): {
  products: Array<{original: string, similarity: number}>;
  clients: Array<{original: string, similarity: number}>;
  paymentMethods: Array<{original: string, similarity: number}>;
} => {
  // Initialize result
  const result = {
    products: [] as Array<{original: string, similarity: number}>,
    clients: [] as Array<{original: string, similarity: number}>,
    paymentMethods: [] as Array<{original: string, similarity: number}>
  };
  
  // Early return if no sales or no new entities
  if (!sales.length || !newEntities) return result;
  
  // Get unique existing values - using Array.from to fix the linter error
  const uniqueProducts = Array.from(new Set(sales.map(s => s.product)));
  const uniqueClients = Array.from(new Set(sales.map(s => s.client)));
  const uniquePaymentMethods = Array.from(new Set(sales.map(s => s.paymentMethod)));
  
  // Check for similar products
  if (newEntities.product) {
    uniqueProducts.forEach(existingProduct => {
      const similarity = calculateSimilarity(existingProduct, newEntities.product!);
      if (similarity >= SIMILARITY_THRESHOLD && similarity < 1) {
        result.products.push({ original: existingProduct, similarity });
      }
    });
    // Sort by similarity descending
    result.products.sort((a, b) => b.similarity - a.similarity);
  }
  
  // Check for similar clients
  if (newEntities.client) {
    uniqueClients.forEach(existingClient => {
      const similarity = calculateSimilarity(existingClient, newEntities.client!);
      if (similarity >= SIMILARITY_THRESHOLD && similarity < 1) {
        result.clients.push({ original: existingClient, similarity });
      }
    });
    result.clients.sort((a, b) => b.similarity - a.similarity);
  }
  
  // Check for similar payment methods
  if (newEntities.paymentMethod) {
    uniquePaymentMethods.forEach(existingMethod => {
      const similarity = calculateSimilarity(existingMethod, newEntities.paymentMethod!);
      if (similarity >= SIMILARITY_THRESHOLD && similarity < 1) {
        result.paymentMethods.push({ original: existingMethod, similarity });
      }
    });
    result.paymentMethods.sort((a, b) => b.similarity - a.similarity);
  }
  
  return result;
};

// Apply entity normalization based on matches
const normalizeEntities = (
  sale: SaleData, 
  highConfidenceMatches: {
    product?: string;
    client?: string;
    paymentMethod?: string;
  }
): SaleData => {
  const normalizedSale = { ...sale };
  
  // Replace with high confidence matches
  if (highConfidenceMatches.product) {
    normalizedSale.normalizedProduct = highConfidenceMatches.product;
  }
  
  if (highConfidenceMatches.client) {
    normalizedSale.normalizedClient = highConfidenceMatches.client;
  }
  
  if (highConfidenceMatches.paymentMethod) {
    normalizedSale.paymentMethod = highConfidenceMatches.paymentMethod;
  }
  
  return normalizedSale;
};

// Variable para almacenar el endpoint seleccionado
let selectedEndpoint = process.env.NEXT_PUBLIC_API_URL || 'https://perla-backend-production-6e4d.up.railway.app';
let usingLocalBackend = false;
let localBackendPort = 3333; // Puerto predeterminado

// Función para seleccionar el endpoint correcto
const getApiEndpoint = () => {
  // Check for Railway endpoint from Electron API
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  
  if (selectedEndpoint) {
    return selectedEndpoint;
  }
  
  // Obtener endpoint desde API de Electron si está disponible
  let railwayEndpoint = '';
  if (isElectron && window.electronAPI?.getRailwayEndpoint) {
    railwayEndpoint = window.electronAPI.getRailwayEndpoint();
    debugLog('Usando endpoint desde API:', railwayEndpoint);
    
    if (railwayEndpoint) {
      selectedEndpoint = railwayEndpoint;
      return railwayEndpoint;
    }
  }
  
  // Si no hay endpoint disponible, usar el que esté configurado
  if (usingLocalBackend) {
    return `http://localhost:${localBackendPort}`;
  } else if (isElectron) {
    debugLog('Detectado entorno Electron');
    // En Electron, intentar con la API primero
    if (window.electronAPI?.getRailwayEndpoint) {
      railwayEndpoint = window.electronAPI.getRailwayEndpoint();
      debugLog('Endpoint Railway obtenido:', railwayEndpoint);
      
      if (railwayEndpoint) {
        selectedEndpoint = railwayEndpoint;
        return railwayEndpoint;
      }
    }
    
    // Si no hay API o no devuelve un endpoint, usar valores predefinidos
    selectedEndpoint = 'https://perla-backend-production-6e4d.up.railway.app';
    debugLog(`Usando endpoint Railway: ${railwayEndpoint}`);
    return selectedEndpoint;
  }
  
  if (railwayEndpoint) {
    debugLog('Endpoint Railway disponible');
    selectedEndpoint = railwayEndpoint;
    return railwayEndpoint;
  }
  
  // Fallback al endpoint remoto
  selectedEndpoint = 'https://perla-backend-production-6e4d.up.railway.app';
  return selectedEndpoint;
};

// Inicializar la configuración del endpoint (solo en entorno Electron)
if (typeof window !== 'undefined' && window !== null && 'electronAPI' in window) {
  console.log('Detectado entorno Electron');
  
  // @ts-ignore - electronAPI es inyectada por el preload script
  if (window.electronAPI.getRailwayEndpoint) {
    try {
      // @ts-ignore - electronAPI es inyectada por el preload script
      const railwayEndpoint = window.electronAPI.getRailwayEndpoint();
      console.log('Endpoint Railway obtenido:', railwayEndpoint);
      selectedEndpoint = railwayEndpoint;
    } catch (error) {
      console.error('Error al obtener endpoint de Railway:', error);
    }
  }
}

// Initializing the AI service is now just a check if the API is available
export const initializeAI = async (): Promise<boolean> => {
  // Verificar si estamos en un entorno Electron con su IPC
  const isElectron = typeof window !== 'undefined' && window !== null && 'electronAPI' in window;
  
  debugLog('Iniciando AI service, entorno Electron:', isElectron);
  
  // Si ya tenemos un endpoint seleccionado y no es local, devolverlo
  if (selectedEndpoint && !usingLocalBackend) {
    debugLog(`Usando endpoint Railway: ${selectedEndpoint}`);
    return true;
  }
  
  // Si el endpoint se puede obtener desde Electron API
  if (isElectron && window.electronAPI?.getRailwayEndpoint) {
    const railwayEndpoint = window.electronAPI.getRailwayEndpoint();
    if (railwayEndpoint) {
      debugLog('Endpoint Railway disponible');
      selectedEndpoint = railwayEndpoint;
      usingLocalBackend = false;
      return true;
    }
  }
  
  // Intentar conectar al backend local primero (entorno de desarrollo)
  if (typeof window !== 'undefined') {
    try {
      try {
        debugLog('Verificando backend local en localhost:3333...');
        const response = await fetch('http://localhost:3333', { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          debugLog('Backend local disponible en puerto 3333');
          usingLocalBackend = true;
          localBackendPort = 3333;
          return true;
        }
      } catch (error) {
        // Intentar con puerto alternativo
        debugLog('Verificando backend local en localhost:3334...');
        try {
          const altResponse = await fetch('http://localhost:3334', { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (altResponse.ok) {
            debugLog('Backend local disponible en puerto 3334');
            usingLocalBackend = true;
            localBackendPort = 3334;
            return true;
          }
        } catch (error) {
          console.warn('Error al conectar con backend local en puertos 3333 y 3334:', error);
        }
      }
    } catch (error) {
      console.warn('Error general al conectar con backend local:', error);
    }
  }
  
  // Como fallback, intentar el endpoint remoto por defecto
  try {
    debugLog('Verificando backend remoto por defecto...');
    const response = await fetch('https://perla-backend-production-6e4d.up.railway.app/health', {
      method: 'GET'
    });
    
    if (response.ok) {
      debugLog('Backend remoto disponible, usando endpoint remoto por defecto');
      selectedEndpoint = 'https://perla-backend-production-6e4d.up.railway.app';
      usingLocalBackend = false;
      return true;
    } else {
      console.warn('Backend remoto respondió con error:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Error al inicializar el servicio de AI:', error);
    return false;
  }
};

// Add a debug function that shows component state with labels
const debugState = (label: string, obj: any) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔍 ${label}:`, obj);
  }
};

// Tipo para datos de venta sin validar
type UnvalidatedSale = {
  id?: string;
  product?: string;
  amount?: number | string;
  price?: number | string;
  totalPrice?: number | string;
  paymentMethod?: string;
  client?: string;
  date?: string;
  [key: string]: any;
};

// Function to validate sale data
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const validateSaleObject = (sale: any): SaleData | null => {
  if (!sale || typeof sale !== 'object') {
    debugLog('❌ Invalid sale object:', sale);
    return null;
  }

  try {
    // Check required fields
    if (!sale.product || (sale.amount === undefined && sale.quantity === undefined) || sale.price === undefined) {
      debugLog('❌ Sale missing required fields:', sale);
      
      // Try to fix common issues
      if (!sale.product && sale.name) {
        debugLog('⚠️ Using "name" as "product"');
        sale.product = sale.name;
      }
      
      if (sale.amount === undefined && sale.quantity !== undefined) {
        debugLog('⚠️ Using "quantity" as "amount"');
        sale.amount = sale.quantity;
      }
      
      // If still missing required fields after fixes, return null
      if (!sale.product || sale.amount === undefined || sale.price === undefined) {
        return null;
      }
    }

    // Ensure numeric fields are numbers
    const amount = Number(sale.amount);
    const price = Number(sale.price);
    const totalPrice = sale.totalPrice !== undefined 
      ? Number(sale.totalPrice) 
      : amount * price;

    if (isNaN(amount) || isNaN(price) || isNaN(totalPrice)) {
      debugLog('❌ Sale has invalid numeric fields:', { amount, price, totalPrice });
      return null;
    }

    // Ensure there's a unique ID
    const id = sale.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Return a well-formed sale object
    const validatedSale: SaleData = {
      id,
      product: String(sale.product),
      amount,
      price,
      totalPrice,
      paymentMethod: sale.paymentMethod || 'Efectivo',
      client: sale.client || 'Cliente',
      date: sale.date || new Date().toISOString().split('T')[0]
    };

    debugLog('✅ Validated sale object:', validatedSale);
    return validatedSale;
  } catch (error) {
    debugLog('❌ Error validating sale:', error);
    return null;
  }
};

// Función para procesar texto de venta con detección automática de endpoint
export const processSaleInput = async (
  messagesOrInput: string | { role: 'user' | 'assistant', content: string }[], 
  previousSales: SaleData[] = [], 
  selectedSales: string[] = []
): Promise<ActionResult> => {
  try {
    const endpoint = getApiEndpoint();
    debugLog(`Procesando venta con endpoint: ${endpoint}`);
    
    // Asegurar que la URL no tenga barra al final
    const url = `${endpoint}/ask`.replace(/\/$/, '');
    debugLog(`URL final de procesamiento: ${url}`);
    
    // Datos a enviar - comprobar si es string o array de mensajes
    const requestData = typeof messagesOrInput === 'string'
      ? {
          prompt: messagesOrInput,
          previousSales,
          selectedSales
        }
      : {
          messages: messagesOrInput,
          previousSales,
          selectedSales
        };
    
    // Log detailed information about selectedSales
    if (selectedSales && selectedSales.length > 0) {
      debugLog(`Enviando ${selectedSales.length} ventas seleccionadas:`, selectedSales);
      
      // Log the details of selected sales if available
      const selectedSalesDetails = previousSales.filter(sale => selectedSales.includes(sale.id));
      if (selectedSalesDetails.length > 0) {
        debugLog('Detalles de ventas seleccionadas:', selectedSalesDetails);
      } else {
        debugLog('⚠️ No se encontraron detalles para las ventas seleccionadas con IDs:', selectedSales);
      }
    }
    
    debugLog('Enviando datos:', JSON.stringify(requestData).substring(0, 100) + '...');
    
    // Usar la ruta correcta '/ask' que espera el backend
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    debugLog(`Respuesta recibida: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error('Error en la respuesta de API:', response.status, response.statusText);
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('Contenido del error:', errorText);
      } catch (textError) {
        console.error('No se pudo leer el texto del error');
      }
      
      // Intentar con el endpoint remoto como fallback
      if (usingLocalBackend) {
        debugLog('Intentando con endpoint remoto como fallback...');
        usingLocalBackend = false;
        return processSaleInput(messagesOrInput, previousSales, selectedSales);
      }
      
      return {
        success: false,
        message: `Error al procesar la venta: ${response.status} ${response.statusText}`,
        data: {
          message: `Error al procesar la venta: ${response.status} ${response.statusText}`
        }
      };
    }

    // Ensure proper parsing of the response as JSON
    const responseText = await response.text();
    debugLog('Response text received:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing response JSON:', e);
      debugLog('Full response text that failed to parse:', responseText);
      return {
        success: false,
        message: 'Error al procesar la respuesta del servidor',
        data: { message: 'Error al procesar la respuesta del servidor' }
      };
    }
    
    // In development mode, log the full parsed response
    if (process.env.NODE_ENV !== 'production') {
      debugLog('Parsed response from backend:', parsed);
      
      // Log específicamente los campos importantes
      if (parsed.sale) {
        debugLog('Sale found in response:', parsed.sale);
      }
      if (parsed.sales) {
        debugLog('Sales array found in response:', parsed.sales);
      }
      if (parsed.fallback) {
        debugLog('Respuesta de fallback recibida:', parsed.message);
      }
    }
    
    // Si es una respuesta de fallback (conversacional), manejarla apropiadamente
    if (parsed.fallback) {
      return {
        success: true,
        message: parsed.message || 'Respuesta recibida',
        data: { message: parsed.message || 'Respuesta recibida' }
      };
    }
    
    // Process and validate any sales data in the response
    let validatedSale = null;
    let validatedSales = null;
    
    if (parsed.sale) {
      validatedSale = validateSaleObject(parsed.sale);
      if (validatedSale) {
        console.log('🛒 Venta validada en frontend:', validatedSale);
      } else {
        console.error('❌ Venta inválida recibida del backend:', parsed.sale);
      }
    }
    
    if (parsed.sales && Array.isArray(parsed.sales)) {
      validatedSales = parsed.sales
        .map((sale: any) => validateSaleObject(sale))
        .filter(Boolean);
      
      console.log(`🛒 ${validatedSales.length} ventas validadas de ${parsed.sales.length} recibidas`);
    }
    
    // The backend now returns a clean, standardized response structure
    // with only the necessary fields, so we can use it directly
    return {
      success: parsed.success !== false, // Default to true if not explicitly false
      message: parsed.message || '',
      data: { message: parsed.message || '' },
      ...(validatedSale && { sale: validatedSale }),
      ...(validatedSales && validatedSales.length > 0 && { sales: validatedSales }),
      ...(parsed.updatedSales && { updatedSales: parsed.updatedSales }),
      ...(parsed.deletedId && { deletedId: parsed.deletedId }),
      ...(parsed.deletedIds && { deletedIds: parsed.deletedIds }),
      ...(parsed.pendingAction && { pendingAction: parsed.pendingAction }),
      ...(parsed.missingInfo && { missingInfo: parsed.missingInfo }),
      ...(parsed.suggestion && { suggestion: parsed.suggestion })
    };
  } catch (error) {
    console.error('Error en procesamiento de venta:', error);
    
    // Intentar con el endpoint remoto como fallback
    if (usingLocalBackend) {
      debugLog('Error con backend local, intentando con endpoint remoto...');
      usingLocalBackend = false;
      return processSaleInput(messagesOrInput, previousSales, selectedSales);
    }
    
    return {
      success: false,
      message: `Error al procesar la venta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      data: {
        message: `Error al procesar la venta: ${error instanceof Error ? error.message : 'Error desconocido'}`
      }
    };
  }
};

// Actualizar la función de insights para usar el endpoint correcto
export const generateInsights = async (sales: SaleData[]): Promise<string> => {
  if (!sales.length) return '';
  
  try {
    const endpoint = getApiEndpoint();
    debugLog(`Generando insights con endpoint: ${endpoint}`);
    
    // Eliminar posible barra final
    const url = `${endpoint}/insights`.replace(/\/$/, '');
    
    // Usar la ruta correcta '/insights' en lugar de '/api/insights'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sales }),
    });

    if (!response.ok) {
      console.error('Error al generar insights:', response.status, response.statusText);
      return '';
    }

    const data = await response.json();
    return data.insight || '';
  } catch (error) {
    console.error('Error al generar insights:', error);
    return '';
  }
};

// Actualizar la función de transcripción para usar el endpoint correcto
export const transcribeAudio = async (audioBlob: Blob): Promise<{ success: boolean; text?: string; error?: string }> => {
  try {
    const endpoint = getApiEndpoint();
    debugLog(`Transcribiendo audio con endpoint: ${endpoint}`);
    
    // Eliminar posible barra final
    const url = `${endpoint}/transcribe`.replace(/\/$/, '');
    
    debugLog("transcribeAudio called with blob size:", audioBlob.size, "type:", audioBlob.type);
    
    // Verify the blob is not empty
    if (audioBlob.size === 0) {
      return {
        success: false,
        error: "The audio recording is empty."
      };
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    
    // Usar la ruta correcta '/transcribe' en lugar de '/api/transcribe'
    const response = await fetch(url, {
      method: 'POST',
      body: formData as unknown as BodyInit
    });
    
    debugLog(`API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      
      let errorMessage = `Error ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = `Error ${response.status}: ${errorData.message || JSON.stringify(errorData)}`;
      } catch (parseError) {
        errorMessage = `Error ${response.status}: ${errorText.substring(0, 100)}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    debugLog("Transcription result:", data);
    
    if (data.text) {
      return {
        success: true,
        text: data.text
      };
    } else if (data.message) {
      // Si hay un mensaje pero no text, probablemente sea un error
      throw new Error(data.message);
    } else {
      throw new Error("No text in API response");
    }
  } catch (error: any) {
    console.error("Error transcribing audio:", error);
    
    // More detailed error reporting
    let errorMessage = "Error en la transcripción";
    if (error.response) {
      console.error("Error response data:", error.response.data);
      errorMessage = `Error ${error.response.status}: ${error.response.data.message || errorMessage}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};