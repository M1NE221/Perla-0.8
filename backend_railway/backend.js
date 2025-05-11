const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

console.log('========== APPLICATION STARTUP ==========');
console.log('Loading modules completed');

// Load environment variables
dotenv.config();
console.log('Environment variables loaded');

// Setup error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});
console.log('Uncaught exception handler registered');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
console.log('Express app initialized');

// Log port and environment information for debugging
console.log('---------- SERVER STARTUP INFORMATION ----------');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT environment variable: ${process.env.PORT}`);
console.log(`Using PORT: ${PORT}`);
console.log('OPENAI_API_KEY configured:', process.env.OPENAI_API_KEY ? 'YES' : 'NO');
console.log('-----------------------------------------------');

// Set up multer for file uploads
const upload = multer({ 
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads');
      // Create the uploads directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `audio-${Date.now()}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});
console.log('Multer upload middleware configured');

// Middleware
console.log('Setting up CORS middleware');
app.use(cors({
  origin: '*',  // Allow all origins for testing
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
console.log('CORS middleware setup completed');

console.log('Setting up JSON middleware');
app.use(express.json());
console.log('JSON middleware setup completed');

// Log every request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
  console.log('Headers:', JSON.stringify(req.headers));
  next();
});
console.log('Request logging middleware setup completed');

// Validate API key presence
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set in the environment variables');
  process.exit(1);
}

// Initialize OpenAI client
console.log('Initializing OpenAI client...');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
console.log('OpenAI client initialized successfully');

// Routes
console.log('Setting up application routes');

app.post('/ask', async (req, res) => {
  console.log('POST /ask received');
  try {
    console.log('Request body:', JSON.stringify(req.body));
    const { prompt, model = 'gpt-3.5-turbo', max_tokens = 500, messages, previousSales, selectedSales } = req.body;
    
    if (!prompt && !messages) {
      console.error('Missing prompt or messages in request');
      return res.status(400).json({ 
        success: false, 
        error: 'Either prompt or messages is required' 
      });
    }

    // Define Perla's system prompt that will be included at the beginning of each messages array
    const perlaSystemPrompt = {
      role: 'system',
      content: `You are Perla, an intelligent sales assistant that helps small business owners track their sales.

 Your capabilities include:
1. Creating new sales (each registration is always a new, separate transaction, even if the product, price, or client is the same as a previous sale)
2. Updating existing sales (ONLY if the user explicitly identifies the sale to update, e.g., by ID or unique details)
3. Deleting sales (ONLY if the user explicitly requests it and clearly identifies the sale)
4. Answering questions about sales data
5. Engaging in natural conversation with the user

IMPORTANT SALES HANDLING RULES:
- NEVER merge, replace, or delete existing sales unless the user is explicit (e.g., says "replace the previous sale" or "delete the one from today").
- When registering a sale, ALWAYS treat it as a new transaction, even if it matches previous sales in product, price, or client.
- When the user asks to update a sale, ONLY update that exact sale if it is clearly identified (by ID or unique details). If not, ask the user for clarification, or create a new sale and leave the previous one intact.
- NEVER use fuzzy matching (like "same product" or "similar price") to identify sales for updates or deletions. Only act if the user is explicit and clear.
- If you are unsure about which sale to update or delete, ALWAYS ask the user for clarification and do not overwrite or remove anything.

STATELESS PROCESSING RULES:
- NEVER treat each user input as a completely fresh, stateless request. ALWAYS consider the full conversation history when provided.
- When answering clarification questions, you MUST look at previous messages to understand the context.
- If the user mentions multiple of the same product in one message (e.g., "Una cookie de pistacho a 12000 y otra cookie de pistacho a 12000"), register SEPARATE sales for each mention - DO NOT merge them.
- NEVER recall or reference past products/prices unless the user explicitly says phrases like "agregá otra igual" or "como la anterior".
- When the user mentions multiple products in one message, register ALL of them as separate sales.
- If a product is repeated in the same message, it is NOT a mistake - register it multiple times.

CONVERSATION STYLE ADAPTATION:
- Pay attention to how the user communicates with you and match their style
- If the user is direct and brief, be concise and to the point
- If the user is formal, maintain a professional tone
- If the user is casual or informal, respond in a friendly, relaxed manner
- If the user is humorous or uses slang, feel free to be more playful in your responses
- Adapt your language complexity to match the user's communication style
- Use similar greeting styles, sentence structures, and level of detail as the user

When the user asks to CREATE a sale, extract the following information:
- Product name(s) (REQUIRED)
- Quantity for each product (REQUIRED)
- Price per unit or total price (REQUIRED)
- Client name (OPTIONAL)
- Payment method (OPTIONAL)
- Date (use today if not specified)

IMPORTANT VERIFICATION:
- Before processing a sale, verify if all necessary information is present and clear:
- If product information is ambiguous (like "2kg" without specifying what product), request clarification.
- If quantity and unit are ambiguous (like in "vendí manzanas a 5000"), ask for the quantity.
- If measurement units are provided without clear product (like "2kg", "3 litros"), ask what product was sold.
- If price information is unclear, ask for clarification on price.

CONVERSATION HISTORY HANDLING:
- Pay careful attention to the full conversation history if provided
- The user may send messages that start with "Información inicial:" followed by bullet points with "Respuesta a"
- These messages contain a conversation history with previous responses to your clarification requests
- In these cases, extract ALL the information from the entire message to create the sale
- DO NOT ask for information that the user has already provided in the conversation history
- Example: If prompt contains information like "Información inicial: vendí 2kg a 8000" followed by "Respuesta a ¿qué producto?: papa", create a sale for 2kg of papa at 8000.

IMPORTANT ABOUT OPTIONAL FIELDS:
- Do NOT ask for optional fields if the user doesn't mention them.
- If the user indicates they don't want to provide a field (e.g., "no me importa el cliente", "sin cliente", "da igual el método de pago", etc.), proceed without asking for it.
- Never interrupt the flow to request optional information.
- Allow sales to be saved without client name or payment method if they weren't provided.
- Only required fields (product, quantity, price) must be present for a valid sale.

When the user asks to UPDATE or DELETE sales, use the selectedSales IDs to perform those operations, but ONLY if the user is explicit and the sale is clearly identified. If not, ask for clarification or do nothing.

OPERATIONS AND RESPONSE FORMAT:
1. CREATE SALE:
{
  "success": true,
  "message": "¡Venta registrada! [confirmation details in a tone matching the user's style]",
  "sale": {
    "id": "[generate_unique_id]",
    "product": "[product_name]",
    "amount": [quantity],
    "price": [unit_price],
    "totalPrice": [total_price],
    "client": "[client_name]",
    "paymentMethod": "[payment_method]",
    "date": "[date]"
  }
}

2. CREATE MULTIPLE SALES:
When multiple products are mentioned in the same input, respond with:
{
  "success": true,
  "message": "¡Ventas registradas! [confirmation details in a tone matching the user's style]",
  "sales": [
    {
      "id": "[generate_unique_id]",
      "product": "[product_name]",
      "amount": [quantity],
      "price": [unit_price],
      "totalPrice": [total_price],
      "client": "[client_name]",
      "paymentMethod": "[payment_method]",
      "date": "[date]"
    },
    {
      // Next sale with its own details
    }
  ]
}

3. UPDATE SALE(s):
{
  "success": true,
  "message": "¡Venta actualizada! [confirmation details]",
  "updatedSales": [array_of_updated_sales]
}

4. DELETE SALE(s):
{
  "success": true,
  "message": "¡Venta eliminada! [confirmation details]",
  "deletedId": "[sale_id]" 
  // OR "deletedIds": ["id1", "id2"] for multiple deletions
}

5. REQUEST CLARIFICATION (for incomplete information):
When information is incomplete or ambiguous, respond with:
{
  "success": false,
  "message": "[question to ask the user for clarification]",
  "pendingAction": "request_clarification",
  "missingInfo": {
    "type": "product_details"|"quantity"|"price"|"other",
    "question": "[pregunta específica para obtener la información faltante]"
  }
}

Examples for REQUEST CLARIFICATION:
- If user says "vendí 2kg a 8000", respond with: 
  {
    "success": false, 
    "message": "¿2kg de qué producto vendiste?", 
    "pendingAction": "request_clarification", 
    "missingInfo": {
      "type": "product_details", 
      "question": "¿2kg de qué producto vendiste?"
    }
  }
- If user says "vendí manzanas a 5000", respond with:
  {
    "success": false, 
    "message": "¿Cuántas manzanas vendiste a 5000?", 
    "pendingAction": "request_clarification", 
    "missingInfo": {
      "type": "quantity", 
      "question": "¿Cuántas manzanas vendiste a 5000?"
    }
  }

6. CONVERSATION:
If the user greets you or sends a message unrelated to sales, respond briefly and naturally, without repeating your purpose. Only mention your purpose if the user asks directly or if it is the first interaction. For repeated greetings, keep it short (e.g., "¡Hola!", "¿Qué tal?", "¡Buenas noches!").

IMPORTANT:
- When updating sales, use the IDs from selectedSales and update only those items, and only if the user is explicit and clear. If not, ask for clarification or do nothing.
- Don't create new sales when updating or deleting unless the user requests it or the update is ambiguous (in which case, keep the old sale and create a new one).
- Respond conversationally to greetings and questions.
- ALWAYS request clarification if ANY necessary information is missing.
- NEVER ask for information that was already provided in the conversation history.

Return ONLY the JSON object with no markdown formatting.`
    };

    // Set up our call to the OpenAI API
    console.log('Setting up OpenAI API call...');
    
    // Initialize the message array based on what was provided
    let messageArray = [];
    
    // Always start with the system prompt
    messageArray.push(perlaSystemPrompt);
    
    if (prompt) {
      // Handle string prompt (legacy mode)
      messageArray.push({
        role: 'user',
        content: prompt
      });
      console.log('Using single prompt mode with message array:', messageArray);
    } else if (messages && Array.isArray(messages)) {
      // Use the provided messages array
      messageArray = [perlaSystemPrompt, ...messages];
      console.log('Using messages array with length:', messageArray.length);
    }
    
    console.log('Message array:', JSON.stringify(messageArray));
    
    console.log('Calling OpenAI API...');
    
    // Añadir sistema de reintentos
    let attempts = 0;
    const maxAttempts = 3;
    let response;
    let lastError;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`Intento ${attempts}/${maxAttempts} de llamar a OpenAI API...`);
        
        response = await openai.chat.completions.create({
          model,
          messages: messageArray,
          temperature: 0.7,
          max_tokens: max_tokens,
          response_format: { type: 'json_object' }  // Forzar respuestas en formato JSON
        });
        
        console.log('OpenAI response status: OK');
        break; // Si llegamos aquí, la llamada fue exitosa
      } catch (error) {
        lastError = error;
        console.error(`Error en intento ${attempts}:`, error.message);
        
        // Si es el último intento, no esperamos
        if (attempts < maxAttempts) {
          const backoffTime = Math.pow(2, attempts) * 500; // Backoff exponencial
          console.log(`Reintentando en ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // Si todos los intentos fallaron
    if (!response) {
      console.error('Todos los intentos de llamar a OpenAI fallaron:', lastError);
      return res.status(500).json({
        success: false,
        message: 'Error al comunicarse con el servicio de IA',
        error: lastError?.message || 'Error de conexión'
      });
    }
    
    // Extract the content from the OpenAI response
    const content = response.choices[0].message.content;
    const contentFirstLine = content.split('\n')[0].substring(0, 50);
    console.log('  ' + contentFirstLine + (content.length > 50 ? '...' : ''));
    
    // Parse the content as JSON
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
      console.log('Parsed JSON content from OpenAI response:', parsedContent);
    } catch (error) {
      console.error('Error parsing JSON from OpenAI response:', error);
      console.error('Raw content causing parsing error:', content);
      
      // Intento de recuperación: crear una respuesta conversacional simple
      try {
        // Si el parsing falla, creamos una respuesta conversacional básica
        const fallbackResponse = {
          success: true,
          message: content.trim() || 'Recibido',
          fallback: true
        };
        console.log('Usando respuesta de recuperación:', fallbackResponse);
        return res.json(fallbackResponse);
      } catch (fallbackError) {
        // Si todo falla, enviar error genérico
        return res.status(400).json({ 
          success: false, 
          message: 'La respuesta no tiene un formato válido',
          rawContent: content.substring(0, 100) + '...',
          error: 'JSON parse error'
        });
      }
    }
    
    // Check if there are sales in the parsed content
    const salesArray = parsedContent.sales || [];
    console.log('Sales array found in parsed content:', salesArray.length > 0 ? 'yes' : 'no');
    
    // Check if this is a failure response (missing info)
    if (parsedContent.success === false) {
      console.log('Response indicates failure, reason:', parsedContent.message);
      
      // Check for pendingAction
      if (parsedContent.pendingAction) {
        console.log('Response includes pendingAction:', parsedContent.pendingAction);
      }
      
      // Send the full parsed content as the response
      console.log('Final response being sent to client:', JSON.stringify(parsedContent));
      return res.json(parsedContent);
    }
    
    // Send the successful response with all relevant data
    console.log('Final response being sent to client:', JSON.stringify(parsedContent));
    return res.json(parsedContent);
    
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor al procesar la solicitud',
      error: error.message
    });
  }
});

// Transcription endpoint
app.post('/transcribe', upload.single('file'), async (req, res) => {
  console.log('POST /transcribe received');
  try {
    console.log('Request body:', JSON.stringify(req.body));
    console.log('File:', req.file ? `Found: ${req.file.originalname}` : 'Not found');
    
    if (!req.file) {
      console.error('No audio file provided in request');
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    console.log(`Processing audio file: ${req.file.originalname}, size: ${req.file.size}, type: ${req.file.mimetype}`);

    // Call OpenAI's audio API
    console.log('Calling OpenAI Whisper API for transcription...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-1',
      language: req.body.language || 'es'
    });

    // Delete the temporary file after use
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temporary file:', err);
      else console.log('Temporary file deleted successfully');
    });

    console.log('Transcription successful');
    console.log('Transcription result:', transcription.text ? 'Text received' : 'No text received');
    
    return res.json({
      success: true,
      text: transcription.text
    });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    console.error('Error stack:', error.stack);

    // Check if it's an OpenAI-specific error
    if (error.name === 'APIError') {
      console.error('OpenAI API Error Type:', error.type);
      console.error('OpenAI API Error Message:', error.message);
    }

    // Clean up temporary file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting temporary file:', err);
        else console.log('Temporary file deleted successfully');
      });
    }
    
    const statusCode = error.status || 500;
    const errorMessage = error.message || 'Failed to process transcription request';
    
    return res.status(statusCode).json({
      success: false,
      message: `Error en la transcripción: ${errorMessage}`
    });
  }
});

// Insights endpoint
app.post('/insights', async (req, res) => {
  console.log('POST /insights received');
  try {
    console.log('Request body:', JSON.stringify(req.body));
    const { sales } = req.body;
    
    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      console.log('No sales data provided or invalid format');
      return res.status(400).json({
        success: false,
        error: 'No sales data provided or invalid format'
      });
    }

    // Generate insights using OpenAI
    const prompt = `
      Analiza los siguientes datos de ventas y proporciona insights útiles para el negocio:
      ${JSON.stringify(sales, null, 2)}
      
      Proporciona insights sobre:
      1. Productos más vendidos
      2. Tendencias de ventas
      3. Patrones de clientes
      4. Recomendaciones comerciales
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Eres un asistente de análisis de ventas experto en identificar patrones e insights útiles.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800
    });

    const insightText = response.choices[0].message.content;
    console.log('Insights generated successfully');
    
    return res.json({
      success: true,
      insights: insightText
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    
    return res.status(500).json({
      success: false,
      message: `Error generando insights: ${error.message}`
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('GET /health received');
  const healthData = { 
    status: 'OK',
    timestamp: new Date().toISOString(),
    openai_api_configured: !!process.env.OPENAI_API_KEY,
    openai_client_initialized: !!openai,
    node_env: process.env.NODE_ENV || 'development',
    port: PORT,
    api_version: 'v4'
  };
  console.log('Health check response:', JSON.stringify(healthData));
  res.json(healthData);
});

// Root endpoint - doesn't require OpenAI
app.get('/', (req, res) => {
  console.log('GET / received');
  const response = {
    service: 'Perla Backend API',
    status: 'running',
    openai_status: 'initialized',
    endpoints: [
      { path: '/health', method: 'GET', description: 'Health check endpoint' },
      { path: '/ask', method: 'POST', description: 'OpenAI chat completions API' },
      { path: '/transcribe', method: 'POST', description: 'Audio transcription API' }
    ],
    version: '1.0.0',
    api_version: 'OpenAI v4'
  };
  console.log('Root endpoint response:', JSON.stringify(response));
  res.json(response);
});

// Add a catch-all route handler for debugging
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error handler caught:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

console.log('All routes and middleware setup completed, starting server...');

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Root endpoint available at http://localhost:${PORT}/`);
  console.log('SERVER IS NOW FULLY OPERATIONAL');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥');
  console.error(err.name, err.message);
  console.error(err.stack);
  server.close(() => {
    process.exit(1);
  });
});
console.log('Unhandled rejection handler registered');
console.log('========== APPLICATION STARTUP COMPLETE ==========');

// Función auxiliar para procesar y validar objetos de venta
function processAndValidateSale(sale) {
  try {
    if (!sale || typeof sale !== 'object') {
      console.log('Sale is not an object:', sale);
      return null;
    }
    
    // Verificar campos obligatorios
    if (!sale.product || sale.amount === undefined || sale.price === undefined) {
      console.log('Sale missing required fields:', sale);
      return null;
    }
    
    // Asegurar que los campos numéricos son realmente números
    const amount = Number(sale.amount);
    const price = Number(sale.price);
    
    if (isNaN(amount) || isNaN(price)) {
      console.log('Sale has invalid numeric fields:', { amount, price });
      return null;
    }
    
    // Calcular totalPrice si no existe
    const totalPrice = sale.totalPrice !== undefined 
      ? Number(sale.totalPrice) 
      : amount * price;
    
    if (isNaN(totalPrice)) {
      console.log('Calculated totalPrice is invalid');
      return null;
    }
    
    // Asegurar que hay un ID único
    const id = sale.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Asegurar una fecha válida
    const date = sale.date || new Date().toISOString().split('T')[0];
    
    // Devolver un objeto venta bien formado
    const validatedSale = {
      id,
      product: String(sale.product),
      amount,
      price,
      totalPrice,
      paymentMethod: sale.paymentMethod || 'Efectivo',
      client: sale.client || 'Cliente',
      date
    };
    
    console.log('Validated sale object:', JSON.stringify(validatedSale));
    return validatedSale;
  } catch (error) {
    console.error('Error validating sale:', error);
    return null;
  }
}