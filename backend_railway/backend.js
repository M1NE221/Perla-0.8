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

WORKING WITH SELECTED SALES:
- When the user has selected sales (indicated by a non-empty selectedSales array containing IDs), these are the ONLY sales that should be considered for updates or deletions.
- The selectedSales IDs are provided to you in a special system message that includes the IDs and details of the selected sales.
- You will see a message like "ATTENTION: The user has explicitly selected X sale(s)" before the user's actual message.
- When the user says phrases like "update this sale", "change the price of this", or "delete these sales", ALWAYS use ONLY the selected sales.
- NEVER ask for sale IDs when sales are already selected. The selection is the user's explicit choice of which sales to modify.
- If the selectedSales details show that one or more sales are selected, assume any update or delete command refers to these selected sales.
- When updating sales, ALWAYS return the complete sale object with all fields, not just the updated ones.
- CRITICAL: When updating, NEVER CHANGE original values for fields not mentioned by the user. Keep everything EXACTLY as it was.
- NEVER change a product name from one thing to another unless the user explicitly asks to change the product name.
- If multiple sales are selected but the user's command only makes sense for one sale, use the first selected sale.
- If selectedSales is empty but the user is explicitly trying to update or delete sales, ask them to select the sales first.

CRITICAL RESPONSE FORMAT REQUIREMENTS:
- You MUST ALWAYS include the appropriate data structure in your response.
- For CREATE operations, ALWAYS include the "sale" object or "sales" array with ALL required fields.
- NEVER return just a success message without the corresponding data structure.
- The frontend CANNOT display or save sales without the structured data objects.
- If you understand a sale request, you MUST return the data in the correct format.
- Failure to include "sale" or "sales" in your response will result in the transaction not being saved.

OPERATIONS AND RESPONSE FORMAT:
1. CREATE SALE:
You MUST use this exact format for creating a single sale:
{
  "success": true,
  "message": "¡Venta registrada! [confirmation details in a tone matching the user's style]",
  "sale": {
    "id": "[generate_unique_id]",
    "product": "[product_name]",
    "amount": [quantity],
    "price": [unit_price],
    "totalPrice": [total_price],
    "client": "[client_name or default to 'Cliente']",
    "paymentMethod": "[payment_method or default to 'Efectivo']",
    "date": "[date or use today's date]"
  }
}

Example for "Vendí 2 bandejas de ravioles de ricota y nuez a 2500 cada una":
{
  "success": true,
  "message": "¡Venta confirmada! Has vendido 2 bandejas de ravioles de ricota y nuez a $2500 cada una.",
  "sale": {
    "id": "sale-1234567890",
    "product": "ravioles de ricota y nuez",
    "amount": 2,
    "price": 2500,
    "totalPrice": 5000,
    "client": "Cliente",
    "paymentMethod": "Efectivo", 
    "date": "2023-05-10"
  }
}

2. CREATE MULTIPLE SALES:
When multiple products are mentioned in the same input, you MUST use this exact format:
{
  "success": true,
  "message": "¡Ventas registradas! [confirmation details in a tone matching the user's style]",
  "sales": [
    {
      "id": "[generate_unique_id_1]",
      "product": "[product_1_name]",
      "amount": [quantity_1],
      "price": [unit_price_1],
      "totalPrice": [total_price_1],
      "client": "[client_name or default to 'Cliente']",
      "paymentMethod": "[payment_method or default to 'Efectivo']",
      "date": "[date or use today's date]"
    },
    {
      "id": "[generate_unique_id_2]",
      "product": "[product_2_name]",
      "amount": [quantity_2],
      "price": [unit_price_2],
      "totalPrice": [total_price_2],
      "client": "[client_name or default to 'Cliente']",
      "paymentMethod": "[payment_method or default to 'Efectivo']",
      "date": "[date or use today's date]"
    }
  ]
}

3. UPDATE SALE(s):
For updating sales, you MUST use this exact format:
{
  "success": true,
  "message": "¡Venta actualizada! [confirmation details]",
  "updatedSales": [array_of_updated_sales]
}

CRITICAL FOR UPDATES:
- When updating a field, ONLY modify the specific field mentioned by the user
- ALWAYS preserve all original values for fields that weren't explicitly mentioned
- When updating a sale, copy ALL original data first, then modify ONLY the requested field
- DO NOT change product names, quantities, clients, or other fields unless specifically requested
- If the user says "update the price", only change the price field and keep everything else identical
- For numeric updates, recalculate totalPrice only if amount or price changes

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
    
    // Add explicit information about selected sales if present
    if (selectedSales && selectedSales.length > 0) {
      console.log(`User has selected ${selectedSales.length} sales with IDs:`, selectedSales);
      
      // Get the details of the selected sales from previousSales
      const selectedSalesDetails = previousSales ? 
        previousSales.filter(sale => selectedSales.includes(sale.id)) : [];
      
      // Create a message that explicitly tells the AI about the selected sales
      let selectedSalesMessage = {
        role: 'system',
        content: `ATTENTION: The user has explicitly selected ${selectedSales.length} sale(s) to operate on.\n\nSelected Sales IDs: ${selectedSales.join(', ')}\n\n`
      };
      
      // Include details of selected sales if available
      if (selectedSalesDetails.length > 0) {
        selectedSalesMessage.content += "Details of selected sales:\n";
        selectedSalesDetails.forEach((sale, index) => {
          selectedSalesMessage.content += `Sale ${index + 1}: ID=${sale.id}, Product=${sale.product}, Amount=${sale.amount}, Price=${sale.price}, TotalPrice=${sale.totalPrice}, Client=${sale.client || 'Cliente'}\n`;
        });
        selectedSalesMessage.content += "\nWhen the user asks to update or delete sales, use ONLY these selected sales.";
      } else {
        selectedSalesMessage.content += `WARNING: Sale details for IDs [${selectedSales.join(', ')}] were not found in the provided sales data. Use just the IDs for operations.`;
      }
      
      // Add the explicit selected sales info
      messageArray.push(selectedSalesMessage);
      console.log('Added explicit selected sales message to prompt');
    } else {
      console.log('No sales selected by user');
    }
    
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
    
    // Validate response structure for sale creation
    if (parsedContent.success === true && 
        typeof parsedContent.message === 'string' &&
        (parsedContent.message.toLowerCase().includes('venta registrada') || 
         parsedContent.message.toLowerCase().includes('venta confirmada') ||
         parsedContent.message.toLowerCase().includes('ventas registradas')) && 
        !parsedContent.sale && 
        !parsedContent.sales) {
      
      console.log('WARNING: Sale creation response missing structured sale data!');
      
      // Attempt to extract information from the message
      const messageText = parsedContent.message;
      
      // Try to build a minimal sale object
      try {
        // Basic regex matching to try to extract product and quantity
        // This is a fallback mechanism and won't be perfect
        const quantityMatch = messageText.match(/(\d+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)(a|por|en|de)\s*\$?(\d+)/i);
        
        if (quantityMatch) {
          const amount = parseInt(quantityMatch[1], 10);
          const product = quantityMatch[2].trim();
          const price = parseInt(quantityMatch[4], 10);
          const totalPrice = amount * price;
          
          console.log('Reconstructed sale from message:', { product, amount, price, totalPrice });
          
          // Create a proper sale object
          parsedContent.sale = {
            id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            product,
            amount,
            price,
            totalPrice,
            client: 'Cliente',
            paymentMethod: 'Efectivo',
            date: new Date().toISOString().split('T')[0]
          };
          
          console.log('WARNING: Added missing sale object:', parsedContent.sale);
        } else {
          console.log('ERROR: Could not extract sale information from message:', messageText);
        }
      } catch (extractError) {
        console.error('Error trying to extract sale information:', extractError);
      }
    }
    
    // Check for updates that don't properly preserve original data
    if (parsedContent.success === true && 
        parsedContent.updatedSales && 
        Array.isArray(parsedContent.updatedSales) && 
        parsedContent.updatedSales.length > 0 &&
        selectedSales && 
        selectedSales.length > 0 && 
        previousSales && 
        previousSales.length > 0) {
      
      console.log('Validating update preservation...');
      
      // For each updated sale, check if any fields that weren't mentioned in the user's message were changed
      const updatedSales = parsedContent.updatedSales.map(updatedSale => {
        // Find the original sale from previousSales
        const originalSale = previousSales.find(sale => sale.id === updatedSale.id);
        
        if (originalSale) {
          const lastUserMessage = messages[messages.length - 1].content.toLowerCase();
          
          // Create a fixed version that preserves all original values except those that were mentioned
          const fixedSale = { ...originalSale };
          
          // Try to identify what the user wanted to change
          if (lastUserMessage.includes('monto') || lastUserMessage.includes('cantidad')) {
            updateField = 'amount';
            const amountMatch = lastUserMessage.match(/(\d+)/);
            if (amountMatch) updateValue = parseInt(amountMatch[1], 10);
            console.log('Detected amount update with value:', updateValue);
          } else if (lastUserMessage.includes('precio') || 
                     lastUserMessage.includes('valor') || 
                     lastUserMessage.includes('cuesta') ||
                     lastUserMessage.includes('por unidad') ||
                     lastUserMessage.includes('cada unidad') ||
                     lastUserMessage.includes('cada uno')) {
            updateField = 'price';
            const priceMatch = lastUserMessage.match(/(\d+)/);
            if (priceMatch) updateValue = parseInt(priceMatch[1], 10);
            console.log('Detected price update with value:', updateValue);
          } else if (lastUserMessage.includes('cliente')) {
            // User wants to change client
            const clientMatch = lastUserMessage.match(/cliente\s+([a-zñáéíóúü\s]+)($|[\.,;\s])/i);
            if (clientMatch) {
              fixedSale.client = clientMatch[1].trim();
            }
          } else if (lastUserMessage.includes('producto')) {
            // User wants to change product
            const productMatch = lastUserMessage.match(/producto\s+([a-zñáéíóúü\s]+)($|[\.,;\s])/i);
            if (productMatch) {
              fixedSale.product = productMatch[1].trim();
            }
          }
          
          // Log what we're doing
          if (JSON.stringify(fixedSale) !== JSON.stringify(updatedSale)) {
            console.log('WARNING: AI changed fields that weren\'t mentioned. Fixing...');
            console.log('Original sale:', originalSale);
            console.log('AI\'s updatedSale:', updatedSale);
            console.log('Fixed sale:', fixedSale);
            return fixedSale;
          }
          
          return updatedSale;
        }
        
        return updatedSale;
      });
      
      // Replace the updatedSales array with our fixed version
      parsedContent.updatedSales = updatedSales;
    }
    
    // Check if this is a failure response (missing info)
    if (parsedContent.success === false) {
      console.log('Response indicates failure, reason:', parsedContent.message);
      
      // Check if the AI is asking for unnecessary clarification despite having selected sales
      if (selectedSales && selectedSales.length > 0 && 
          typeof parsedContent.message === 'string' &&
          (parsedContent.message.toLowerCase().includes('id de la venta') ||
           parsedContent.message.toLowerCase().includes('cuál es el id') ||
           parsedContent.message.toLowerCase().includes('qué venta') ||
           parsedContent.message.toLowerCase().includes('cuál venta') ||
           parsedContent.message.toLowerCase().includes('que venta') ||
           parsedContent.message.toLowerCase().includes('cual venta') ||
           parsedContent.message.toLowerCase().includes('identificar la venta') ||
           // Add new patterns for unnecessarily asking for quantities/amounts
           parsedContent.message.toLowerCase().includes('cuántas unidades') ||
           parsedContent.message.toLowerCase().includes('cuántos') ||
           parsedContent.message.toLowerCase().includes('qué cantidad') ||
           parsedContent.message.toLowerCase().includes('cuál es la cantidad') ||
           // Add new patterns for asking about which specific sale despite selection
           parsedContent.message.toLowerCase().includes('qué venta específica') ||
           parsedContent.message.toLowerCase().includes('cuál venta específica') ||
           parsedContent.message.toLowerCase().includes('qué venta te gustaría') ||
           parsedContent.message.toLowerCase().includes('cuál venta te gustaría') ||
           parsedContent.message.toLowerCase().includes('qué venta deseas') ||
           parsedContent.message.toLowerCase().includes('cuál venta deseas'))) {
        
        console.log('WARNING: AI is asking for unnecessary clarification despite having selected sales');
        
        // Get details for the first selected sale
        const selectedSale = previousSales ? 
          previousSales.find(sale => sale.id === selectedSales[0]) : null;
          
        if (selectedSale) {
          console.log('Updating using the first selected sale:', selectedSale);
          
          // Try to determine what to update based on user message
          const lastUserMessage = messages[messages.length - 1].content.toLowerCase();
          
          // First determine if this is a delete operation
          if (lastUserMessage.includes('eliminar') || 
              lastUserMessage.includes('borrar') || 
              lastUserMessage.includes('quitar') ||
              lastUserMessage.includes('remover')) {
            console.log('Detected DELETE operation in user message');
            
            // Create a proper delete response
            parsedContent = {
              success: true,
              message: `¡Venta eliminada! He eliminado la venta seleccionada.`,
              deletedId: selectedSale.id
            };
            
            console.log('Auto-corrected response for DELETE operation:', parsedContent);
            return res.json(parsedContent);
          }
          
          // Otherwise it's an update operation
          let updateField = 'amount';
          let updateValue = null;
          
          if (lastUserMessage.includes('monto') || lastUserMessage.includes('cantidad')) {
            updateField = 'amount';
            const amountMatch = lastUserMessage.match(/(\d+)/);
            if (amountMatch) updateValue = parseInt(amountMatch[1], 10);
          } else if (lastUserMessage.includes('precio') || 
                     lastUserMessage.includes('valor') || 
                     lastUserMessage.includes('cuesta') ||
                     lastUserMessage.includes('por unidad') ||
                     lastUserMessage.includes('cada unidad') ||
                     lastUserMessage.includes('cada uno')) {
            updateField = 'price';
            const priceMatch = lastUserMessage.match(/(\d+)/);
            if (priceMatch) updateValue = parseInt(priceMatch[1], 10);
          } else if (lastUserMessage.includes('cliente')) {
            updateField = 'client';
            // Extract client name (anything after "cliente" and before end or punctuation)
            const clientMatch = lastUserMessage.match(/cliente\s+([a-zñáéíóúü\s]+)($|[\.,;\s])/i);
            if (clientMatch) updateValue = clientMatch[1].trim();
          }
          
          if (updateValue !== null) {
            // Create a proper update response
            const updatedSale = { ...selectedSale };
            updatedSale[updateField] = updateValue;
            
            // Recalculate totalPrice if needed
            if (updateField === 'amount' || updateField === 'price') {
              updatedSale.totalPrice = updatedSale.amount * updatedSale.price;
            }
            
            parsedContent = {
              success: true,
              message: `¡Venta actualizada! He cambiado el ${updateField === 'amount' ? 'monto' : 
                                              updateField === 'price' ? 'precio' : 
                                              updateField === 'client' ? 'cliente' : updateField} a ${updateValue}.`,
              updatedSales: [updatedSale]
            };
            
            console.log('Auto-corrected response to:', parsedContent);
          } else {
            // If we couldn't determine what to update but there's a selected sale, 
            // and the AI is asking for clarification, assume the user wants to see the sale details
            console.log('Could not determine update field and value, returning sale details');
            parsedContent = {
              success: true,
              message: `Aquí está la información de la venta seleccionada: ${selectedSale.product}, cantidad: ${selectedSale.amount}, precio: ${selectedSale.price}, cliente: ${selectedSale.client || 'Cliente'}`,
              info: { type: 'sale_details', sale: selectedSale }
            };
          }
        }
      }
      
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