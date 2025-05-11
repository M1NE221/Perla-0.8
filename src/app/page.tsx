// Make sure this type definition is consistent with what we added in AudioRecorder.tsx
declare global {
  interface Window {
    api?: {
      askPerla: (prompt: string, previousSales?: any[], selectedSales?: string[]) => Promise<any>;
      openai: (model: string, messages: any[]) => Promise<any>;
      getConfig: () => Promise<any>;
      setConfig: (apiKey: string) => Promise<any>;
    };
    electronAPI?: {
      platform: string;
      getRailwayEndpoint: () => string;
    };
  }
}

'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import DraggableField from '@/components/DraggableField';
import TypingResponse from '@/components/TypingResponse';
import { initializeAI, processSaleInput, generateInsights, SaleData, ActionResult } from '@/services/aiService';
import { motion, AnimatePresence } from 'framer-motion';
import AudioRecorder from '@/components/AudioRecorder';

// Define available fields for customization
const AVAILABLE_FIELDS = [
  { name: 'Producto', key: 'product' },
  { name: 'Cantidad', key: 'amount' },
  { name: 'Precio', key: 'price' },
  { name: 'Total', key: 'totalPrice' },
  { name: 'Método de pago', key: 'paymentMethod' },
  { name: 'Cliente', key: 'client' },
  { name: 'Fecha', key: 'date' }
];

// Sales table area bounds for drop detection
const TABLE_AREA = {
  minX: 0,
  maxX: 700,
  minY: 300,
  maxY: 800
};

export default function Home() {
  const [input, setInput] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [insight, setInsight] = useState('');
  const [sales, setSales] = useState<SaleData[]>([]);
  const [activeFields, setActiveFields] = useState<string[]>(['product', 'amount', 'totalPrice', 'date']);
  const [isAIInitialized, setIsAIInitialized] = useState(true); // Always initialized by default
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null);
  // Add selected sales state
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  // Add selection mode state
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  
  // Estado para el manejo de clarificaciones
  const [pendingClarification, setPendingClarification] = useState(false);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [previousContext, setPreviousContext] = useState('');
  // Agregar historial de conversación para UI
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  // Nuevo estado para chat history con formato de mensajes
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  // Agregar estado para saber si hay una grabación en curso
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  
  // Load saved data from localStorage on component mount
  useEffect(() => {
    const savedSales = localStorage.getItem('sales');
    if (savedSales) {
      try {
        setSales(JSON.parse(savedSales));
      } catch (e) {
        console.error('Error loading saved sales', e);
      }
    }
    
    // Check for saved activeFields configuration
    const savedActiveFields = localStorage.getItem('activeFields');
    if (savedActiveFields) {
      try {
        const fields = JSON.parse(savedActiveFields);
        setActiveFields(fields);
        setColumnOrder(fields); // Initialize column order based on active fields
      } catch (e) {
        console.error('Error loading active fields', e);
      }
    } else {
      // Default column order
      setColumnOrder(['product', 'amount', 'totalPrice', 'date']);
    }
    
    // Check for saved column order
    const savedColumnOrder = localStorage.getItem('columnOrder');
    if (savedColumnOrder) {
      try {
        setColumnOrder(JSON.parse(savedColumnOrder));
      } catch (e) {
        console.error('Error loading column order', e);
      }
    }
    
    // Test the backend connection and update initialization status
    (async () => {
      try {
        const isConnected = await initializeAI();
        if (!isConnected) {
          console.warn("Failed to connect to backend API");
        }
      } catch (error) {
        console.error("Error checking backend connection:", error);
      }
    })();
  }, []);

  // Save sales to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('sales', JSON.stringify(sales));
    
    // Generate insights for the sales data
    if (sales.length > 0) {
      generateInsights(sales).then(insight => {
        if (insight) setInsight(insight);
      });
    }
  }, [sales]);

  // Save active fields configuration
  useEffect(() => {
    localStorage.setItem('activeFields', JSON.stringify(activeFields));
  }, [activeFields]);
  
  // Save column order
  useEffect(() => {
    localStorage.setItem('columnOrder', JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // Clear selections when exiting selection mode
      setSelectedSales([]);
    }
    setSelectionMode(prev => !prev);
  };
  
  // Toggle selection of a sale
  const toggleSaleSelection = (id: string) => {
    setSelectedSales(prev => 
      prev.includes(id) 
        ? prev.filter(saleId => saleId !== id) 
        : [...prev, id]
    );
  };
  
  // Select all visible sales
  const selectAllSales = () => {
    setSelectedSales(sales.map(sale => sale.id));
  };
  
  // Clear all selections
  const clearSelections = () => {
    setSelectedSales([]);
  };
  
  // Toggle a field in the active fields list
  const toggleField = (key: string) => {
    if (activeFields.includes(key)) {
      // Remove field
      setActiveFields(prev => prev.filter(field => field !== key));
      setColumnOrder(prev => prev.filter(col => col !== key));
    } else {
      // Add field
      setActiveFields(prev => [...prev, key]);
      
      // Add to column order if not already there
      if (!columnOrder.includes(key)) {
        setColumnOrder(prev => [...prev, key]);
      }
    }
  };

  // Start dragging a column
  const handleColumnDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData('text/plain', key);
    setDraggingColumn(key);
  };

  // Handle column drag over
  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
  };

  // Handle column drop to reorder
  const handleColumnDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const draggedKey = e.dataTransfer.getData('text/plain');
    
    if (!draggedKey || draggedKey === targetKey) {
      setDraggingColumn(null);
      return;
    }

    // Reorder columns
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const dragIndex = newOrder.indexOf(draggedKey);
      const targetIndex = newOrder.indexOf(targetKey);

      if (dragIndex !== -1 && targetIndex !== -1) {
        // Remove dragging column
        newOrder.splice(dragIndex, 1);
        // Insert at target position
        newOrder.splice(targetIndex, 0, draggedKey);
      }

      return newOrder;
    });

    setDraggingColumn(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // No procesar si el input está vacío o se está grabando audio
    if (!input.trim() || isRecordingActive) return;

    // DEBUG - Inicio del procesamiento con info del estado actual
    console.log('🔍 handleSubmit - Estado actual:', { 
      pendingClarification, 
      inputLength: input.length,
      currentSalesCount: sales.length,
      selectedSalesCount: selectedSales.length
    });

    // Log selected sales IDs to help with debugging
    if (selectedSales.length > 0) {
      console.log('🔍 Selected sales IDs:', selectedSales);
      console.log('🔍 Selected sales objects:', sales.filter(sale => selectedSales.includes(sale.id)));
    }

    // Guardar la entrada actual para el historial
    const currentInput = input.trim();
    let newHistory = [...conversationHistory];
    
    // Si estamos en proceso de clarificación, agregar la respuesta al historial
    if (pendingClarification) {
      console.log('🔄 Continuando flujo de clarificación, pregunta:', clarificationQuestion);
      newHistory.push(`Respuesta a "${clarificationQuestion}": ${currentInput}`);
    } else {
      // Es una nueva entrada
      console.log('🆕 Nueva entrada de usuario:', currentInput);
      newHistory = [currentInput]; // Reiniciar el historial para una nueva venta
    }
    
    // Crear el nuevo mensaje del usuario para el chatHistory
    const newUserMessage = { 
      role: 'user' as const, 
      content: pendingClarification 
        ? `Respuesta a tu pregunta "${clarificationQuestion}": ${currentInput}` 
        : currentInput 
    };
    
    // Crear array de mensajes para enviar al backend
    // Si estamos en clarificación, añadir al historial existente, sino comenzar nuevo
    const messages = pendingClarification
      ? [...chatHistory, newUserMessage]
      : [newUserMessage];
    
    console.log('📤 Enviando mensajes al backend:', JSON.stringify(messages));
    
    // Process input through AI with messages array
    // Make sure we're passing the selected sales IDs
    const result = await processSaleInput(
      messages as { role: 'user' | 'assistant', content: string }[], 
      sales, 
      selectedSales // Ensures selected sales are passed correctly
    );
    
    console.log('📥 Respuesta recibida del backend:', result);
    
    // Handle the result based on the action performed
    if (result.success) {
      console.log('✅ Respuesta exitosa del backend');
      
      // Handle clarification requests
      if (result.pendingAction === 'request_clarification') {
        console.log('❓ Se requiere clarificación:', result.missingInfo);
        // Es una solicitud de clarificación
        setPendingClarification(true);
        
        // Extraer el mensaje de clarificación de forma segura
        const clarificationMsg = typeof result.message === 'string'
          ? result.message
          : result.missingInfo?.question || "Necesito más información.";
          
        setClarificationQuestion(clarificationMsg);
        
        // Solo guardar el contexto previo si es una nueva consulta
        if (!pendingClarification) {
          setPreviousContext(currentInput);
        }
        
        // Actualizar el historial de conversación UI
        setConversationHistory(newHistory);
        
        // Agregar mensaje del asistente (con la pregunta) al chat history
        const clarificationMessage = { 
          role: 'assistant' as const, 
          content: clarificationMsg
        };
        setChatHistory([...messages, clarificationMessage]);
        
        // Set confirmation message
        setConfirmation(clarificationMsg);
        console.log('🔄 Estado de clarificación configurado, esperando respuesta del usuario');
        return;
      } else {
        // Si no es una clarificación, reiniciar el estado
        console.log('✅ No es una clarificación, reseteando estado de clarificación');
        setConversationHistory([]);
        setPendingClarification(false);
        setClarificationQuestion('');
        setPreviousContext('');
      }
      
      // Convertir mensaje a string de forma segura para mostrar confirmación
      const safeMessage = typeof result?.message === 'string'
        ? result.message
        : typeof result?.data?.message === 'string'
          ? result.data.message
          : JSON.stringify(result || '');
            
      // Actualizar el mensaje de confirmación
      setConfirmation(safeMessage);
      console.log('💬 Mensaje de confirmación actualizado:', safeMessage);
      
      // Log debugging en modo desarrollo
      console.log('🛒 Datos de venta recibidos:', {
        hasSale: !!result.sale,
        hasSalesArray: !!(result.sales && Array.isArray(result.sales)),
        salesArrayLength: result.sales?.length || 0,
        fullResult: result
      });
      
      if (result.sale) {
        // Single product sale
        console.log('📝 Venta individual encontrada:', result.sale);
        
        // Importante: crear copia de la venta para asegurar que es un objeto válido
        const newSale = {
          ...result.sale,
          id: result.sale.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        };
        
        console.log('➕ Añadiendo venta al estado:', newSale);
        const newSalesArray = [newSale, ...sales];
        setSales(newSalesArray);
        
        // Extra logging para verificar que se está ejecutando esta rama de código
        console.log('✅ Venta añadida correctamente, nuevo recuento:', newSalesArray.length);
        // Forzar renderizado para ver el cambio
        setTimeout(() => {
          console.log('🔄 Verificación después de timeout, conteo de ventas:', sales.length);
        }, 100);
      } else if (result.sales && Array.isArray(result.sales)) {
        // Multiple products in one transaction
        console.log('📝 Múltiples ventas encontradas:', result.sales);
        
        // Importante: asegurar que todas las ventas tengan ID
        const newSales = result.sales.map(sale => ({
          ...sale,
          id: sale.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        }));
        
        console.log('➕ Añadiendo múltiples ventas al estado:', newSales);
        const newSalesArray = [...newSales, ...sales];
        setSales(newSalesArray);
        
        // Extra logging para verificar que se está ejecutando esta rama de código
        console.log('✅ Múltiples ventas añadidas correctamente, nuevo recuento:', newSalesArray.length);
        // Forzar renderizado para ver el cambio
        setTimeout(() => {
          console.log('🔄 Verificación después de timeout, conteo de ventas:', sales.length);
        }, 100);
      } else if (result.updatedSales) {
        // Fix for the editing issue - properly merge updated sales with existing ones
        console.log('🔄 Actualizando ventas existentes:', result.updatedSales);
        
        // Create a map of existing sales by ID for quick lookups
        const salesMap = new Map(sales.map(sale => [sale.id, sale]));
        
        // Process each updated sale
        const mergedSales = result.updatedSales.map(updatedSale => {
          // Get the existing sale if available
          const existingSale = salesMap.get(updatedSale.id);
          
          if (existingSale) {
            // Merge the updated sale with the existing one, preserving fields
            // that weren't explicitly changed
            console.log(`🔄 Merging sale ${updatedSale.id}:`, {
              existing: existingSale,
              updated: updatedSale
            });
            
            return {
              ...existingSale,  // Keep all existing fields
              ...updatedSale,    // Overwrite with updated fields
              // Ensure these fields are always present
              id: updatedSale.id || existingSale.id,
              product: updatedSale.product || existingSale.product,
              amount: updatedSale.amount ?? existingSale.amount,
              price: updatedSale.price ?? existingSale.price,
              totalPrice: updatedSale.totalPrice ?? existingSale.totalPrice,
              paymentMethod: updatedSale.paymentMethod || existingSale.paymentMethod,
              client: updatedSale.client || existingSale.client,
              date: updatedSale.date || existingSale.date
            };
          }
          
          // If it's a new sale (shouldn't happen in edit case, but just in case)
          return updatedSale;
        });
        
        // Get IDs from updated sales
        const updatedIds = new Set(result.updatedSales.map(sale => sale.id));
        
        // Preserve any sales that weren't updated
        const preservedSales = sales.filter(sale => !updatedIds.has(sale.id));
        
        // Combine preserved and merged sales
        const newSalesArray = [...mergedSales, ...preservedSales];
        console.log('✅ Sales array after merging:', newSalesArray);
        
        setSales(newSalesArray);
        // Clear selections after successful bulk operation
        setSelectedSales([]);
      } else if (result.deletedId) {
        // Delete operation that returns just the ID to remove
        setSales(prevSales => prevSales.filter(sale => sale.id !== result.deletedId));
      } else if (result.deletedIds) {
        // Bulk delete operation
        setSales(prevSales => prevSales.filter(sale => !result.deletedIds?.includes(sale.id)));
        // Clear selections after successful bulk operation
        setSelectedSales([]);
      } else if (result.pendingAction === 'confirm_entity_match' && result.potentialMatches) {
        // Generate response options for entity matching
        let matches: Array<{type: string, original: string, new: string}> = [];
        
        // Add product matches to confirm
        if (result.potentialMatches.products && result.potentialMatches.products.length > 0) {
          matches = [
            ...matches,
            ...result.potentialMatches.products.map(p => ({
              type: 'product',
              original: p.original,
              new: p.potential
            }))
          ];
        }
        
        // Add client matches to confirm
        if (result.potentialMatches.clients && result.potentialMatches.clients.length > 0) {
          matches = [
            ...matches,
            ...result.potentialMatches.clients.map(c => ({
              type: 'client',
              original: c.original,
              new: c.potential
            }))
          ];
        }
        
        // Add payment method matches to confirm
        if (result.potentialMatches.paymentMethods && result.potentialMatches.paymentMethods.length > 0) {
          matches = [
            ...matches,
            ...result.potentialMatches.paymentMethods.map(p => ({
              type: 'paymentMethod',
              original: p.original,
              new: p.potential
            }))
          ];
        }
        
        // Build confirmation message with options for each entity to match
        let confirmationOptions = "¿Quieres normalizar los siguientes datos?\n";
        
        matches.forEach(match => {
          const typeLabel = match.type === 'product' ? 'Producto' : 
                           match.type === 'client' ? 'Cliente' : 'Método de pago';
          
          confirmationOptions += `${typeLabel}: "${match.original}" → "${match.new}"\n`;
        });
        
        confirmationOptions += "\nResponde 'sí' para confirmar todos, o 'no' para mantener los originales.";
        
        setConfirmation(confirmationOptions);
      } else {
        // Check for sales in other possible locations
        if (process.env.NODE_ENV !== 'production') {
          console.log('No direct sales found in result, checking other locations');
        }
        
        // Try to parse the message as JSON if it's a string
        try {
          if (typeof result.message === 'string' && result.message.trim().startsWith('{')) {
            const messageJson = JSON.parse(result.message);
            if (process.env.NODE_ENV !== 'production') {
              console.log('Parsed message JSON:', messageJson);
            }
            
            if (messageJson.sale) {
              console.log('Found sale in parsed message:', messageJson.sale);
              setSales([messageJson.sale, ...sales]);
            } else if (messageJson.sales && Array.isArray(messageJson.sales)) {
              console.log('Found sales array in parsed message:', messageJson.sales);
              setSales([...messageJson.sales, ...sales]);
            }
          }
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Error parsing message as JSON:', e);
          }
        }
      }
      
      // Reset input after successful processing
      setInput('');
      return;
    } else {
      // Handle error case
      if (result.pendingAction === 'request_clarification') {
        console.log('Se requiere clarificación (pero con error):', result.missingInfo);
        // Es una solicitud de clarificación, aún con error
        setPendingClarification(true);
        
        // Extraer el mensaje de clarificación de forma segura
        const clarificationMsg = typeof result.message === 'string'
          ? result.message
          : result.missingInfo?.question || "Necesito más información.";
          
        setClarificationQuestion(clarificationMsg);
        
        // Solo guardar el contexto previo si es una nueva consulta
        if (!pendingClarification) {
          setPreviousContext(currentInput);
        }
        
        // Actualizar el historial de conversación UI
        setConversationHistory(newHistory);
        
        // Agregar mensaje del asistente (con la pregunta) al chat history
        const clarificationMessage = { 
          role: 'assistant' as const, 
          content: clarificationMsg
        };
        setChatHistory([...messages, clarificationMessage]);
        
        // Set confirmation message
        setConfirmation(clarificationMsg);
        console.log('Estado de clarificación configurado, esperando respuesta del usuario');
        return;
      }
      
      // Handle general error responses
      const errorMessage = typeof result.message === 'string' 
        ? result.message 
        : 'Error al procesar la venta. Intente de nuevo.';
      
      // Mostrar un mensaje de error amigable al usuario
      let userFriendlyError = errorMessage;
      
      // Si es un error de parsing o formato, usar un mensaje más amigable
      if (errorMessage.includes('parse error') || 
          errorMessage.includes('formato válido') ||
          errorMessage.includes('Error 400')) {
        userFriendlyError = "Lo siento, hubo un problema al procesar tu mensaje. ¿Puedes intentarlo de nuevo?";
      }
      
      // Si es un error de conexión, usar un mensaje específico
      if (errorMessage.includes('Error al comunicarse') || 
          errorMessage.includes('Error 500') ||
          errorMessage.includes('connection')) {
        userFriendlyError = "Parece que hay un problema de conexión. Por favor, verifica tu internet e intenta nuevamente.";
      }
      
      setConfirmation(userFriendlyError);
      console.error('Error en procesamiento:', errorMessage);
    }
    // Reset input after processing
    setInput('');
  };
  
  // Obtener el nombre legible de un campo
  const getFieldName = (key: string) => {
    const field = AVAILABLE_FIELDS.find(f => f.key === key);
    return field?.name || key;
  };

  // Handle transcription completion
  const handleTranscriptionComplete = (text: string) => {
    setTranscription(text);
    setInput(text); // Auto-fill the input field with transcribed text
    setIsProcessingAudio(false);
  };

  // Handle error in transcription
  const handleTranscriptionError = (error: string) => {
    console.error("Transcription error:", error);
    setConfirmation(`Error: ${error}`);
    setIsProcessingAudio(false);
  };

  // Start audio processing
  const startAudioProcessing = () => {
    setIsProcessingAudio(true);
    setTranscription(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-start p-6 relative">
      {/* Light rays background element */}
      <div className="light-rays"></div>
      
      <div className="w-full max-w-5xl" ref={containerRef}>
        {/* Simple input field */}
        <div className="mb-6">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <div className="flex-grow relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={pendingClarification 
                  ? "Responde a la aclaración..." 
                  : selectedSales.length > 0 
                    ? `Operando con ${selectedSales.length} item${selectedSales.length > 1 ? 's' : ''} seleccionado${selectedSales.length > 1 ? 's' : ''}...` 
                    : "Escribe una venta o consulta..."
                }
                className="w-full rounded-xl p-4 glass-input"
                disabled={isProcessingAudio || isRecordingActive}
              />
            </div>
            
            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || isProcessingAudio || isRecordingActive}
              className={`p-2 rounded-full transition-colors ${
                !input.trim() || isProcessingAudio || isRecordingActive
                  ? 'bg-white/5 text-slate-300/50 cursor-not-allowed'
                  : 'bg-white/10 hover:bg-amber-500/10 text-amber-600 hover:text-amber-700'
              }`}
            >
              <SendIcon />
            </button>
            
            {/* Mic button */}
            <AudioRecorder
              onTranscriptionComplete={handleTranscriptionComplete}
              onTranscriptionError={handleTranscriptionError}
              isProcessing={isProcessingAudio}
              onStartRecording={startAudioProcessing}
              onRecordingStateChange={setIsRecordingActive}
            />
          </form>
          
          {/* Show transcription if available */}
          {transcription && (
            <div className="mt-3 text-sm">
              <p className="opacity-70">Transcripción: {transcription}</p>
            </div>
          )}
          
          {isProcessingAudio && (
            <div className="mt-3 text-sm animate-pulse">
              <p className="opacity-70">Procesando audio...</p>
            </div>
          )}
          
          {/* Indicator for selected items */}
          {selectedSales.length > 0 && (
            <div className="mt-2 flex items-center">
              <span className="text-sm text-amber-600 flex items-center gap-1">
                <SelectionIcon />
                {selectedSales.length} {selectedSales.length === 1 ? 'elemento seleccionado' : 'elementos seleccionados'}
              </span>
              <button 
                onClick={clearSelections}
                className="ml-2 text-xs px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
        
        {/* AI Response area - directly below input */}
        {(confirmation || pendingClarification || conversationHistory.length > 0) && (
          <div className="mb-10 max-w-2xl">
            {/* Handle clarification questions */}
            {pendingClarification && (
              <div className="mb-3">
                <p className="text-sm opacity-80">
                  <TypingResponse text={clarificationQuestion} typingSpeed={25} />
                </p>
              </div>
            )}
            
            {/* Conversation history */}
            {conversationHistory.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto scrollbar-thin">
                {conversationHistory.map((message, index) => (
                  <div 
                    key={index} 
                    className={`mb-2 p-2 rounded-lg text-sm ${
                      index % 2 === 0 
                        ? 'bg-white/5 opacity-90' 
                        : 'bg-white/10 opacity-90'
                    }`}
                  >
                    {message}
                  </div>
                ))}
              </div>
            )}
            
            {confirmation && (
              <div className="confirmation">
                <TypingResponse text={confirmation} typingSpeed={20} />
              </div>
            )}
          </div>
        )}
        
        {/* Minimal controls for selection */}
        <div className="flex justify-between items-center mb-4 max-w-full overflow-x-auto">
          {selectionMode ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm">
                {selectedSales.length} {selectedSales.length === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
              <button 
                onClick={selectAllSales}
                className="text-xs px-2 py-1 rounded-lg bg-white/10"
              >
                Seleccionar todo
              </button>
              <button 
                onClick={clearSelections}
                className="text-xs px-2 py-1 rounded-lg bg-white/10"
              >
                Limpiar
              </button>
              <button 
                onClick={toggleSelectionMode}
                className="text-xs px-2 py-1 rounded-lg bg-white/10"
              >
                Salir
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_FIELDS.map(field => (
                  <button
                    key={field.key}
                    onClick={() => toggleField(field.key)}
                    className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                      activeFields.includes(field.key)
                        ? 'bg-white/20 text-slate-800'
                        : 'bg-white/5 opacity-50'
                    }`}
                  >
                    {field.name}
                  </button>
                ))}
              </div>
              <button 
                onClick={toggleSelectionMode}
                className="text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 transition-colors ml-2 whitespace-nowrap"
              >
                Seleccionar
              </button>
            </div>
          )}
        </div>
        
        {/* Sales table - simple and minimal */}
        <div className="glass-panel rounded-xl overflow-hidden max-w-full" ref={tableRef}>
          <div className="sales-header grid gap-2 p-3 border-b border-white/10" style={{ gridTemplateColumns: `repeat(${activeFields.length}, minmax(0, 1fr))` }}>
            {columnOrder
              .filter(key => activeFields.includes(key))
              .map(key => (
                <div 
                  key={key}
                  draggable
                  onDragStart={(e) => handleColumnDragStart(e, key)}
                  onDragOver={handleColumnDragOver}
                  onDrop={(e) => handleColumnDrop(e, key)}
                  className={`px-2 font-medium text-sm select-none cursor-move ${
                    draggingColumn === key ? 'opacity-50' : ''
                  }`}
                >
                  {getFieldName(key)}
                </div>
              ))
            }
          </div>
          
          <div className="sales-list max-h-[60vh] overflow-y-auto scrollbar-thin">
            <AnimatePresence initial={false}>
              {sales.length > 0 ? (
                sales.map((sale) => (
                  <motion.div
                    key={sale.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.2 }}
                    className={`sales-row grid gap-2 p-3 border-t border-white/5 ${
                      selectionMode && 'cursor-pointer'
                    } ${
                      selectionMode && selectedSales.includes(sale.id) ? 'bg-white/10' : ''
                    }`}
                    style={{ gridTemplateColumns: `repeat(${activeFields.length}, minmax(0, 1fr))` }}
                    onClick={() => selectionMode && toggleSaleSelection(sale.id)}
                  >
                    {columnOrder
                      .filter(key => activeFields.includes(key))
                      .map(key => {
                        // Get the value based on the key
                        let value = '';
                        const field = key as keyof SaleData;
                        
                        if (key === 'totalPrice' && typeof sale.totalPrice === 'number') {
                          value = `$${sale.totalPrice.toLocaleString('es-MX')}`;
                        } else if (key === 'price' && typeof sale.price === 'number') {
                          value = `$${sale.price.toLocaleString('es-MX')}`;
                        } else if (key === 'date' && sale.date) {
                          value = format(new Date(sale.date), 'dd/MM/yyyy');
                        } else {
                          value = String(sale[field] || '');
                        }
                        
                        return (
                          <div key={`${sale.id}-${key}`} className="px-2 text-sm truncate">
                            {value}
                          </div>
                        );
                      })
                    }
                  </motion.div>
                ))
              ) : (
                <div className="text-center p-8 opacity-60">
                  No hay ventas registradas
                </div>
              )}
            </AnimatePresence>
          </div>
          
          {sales.length > 0 && (
            <div className="p-3 border-t border-white/10 flex justify-between">
              <span className="text-sm opacity-70">Total: {sales.length} ventas</span>
              <span className="text-sm font-medium">
                ${sales.reduce((sum, sale) => sum + (sale.totalPrice || 0), 0).toLocaleString('es-MX')}
              </span>
            </div>
          )}
        </div>
        
        {/* Simple insights at the bottom if available */}
        {insight && (
          <div className="mt-6 max-w-3xl">
            <TypingResponse text={insight} />
          </div>
        )}
      </div>
    </main>
  );
}

// Send icon component
const SendIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M22 2L11 13" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M22 2L15 22L11 13L2 9L22 2Z" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Selection icon
const SelectionIcon = () => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M9 11L12 14L20 6" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M20 12V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6C4 4.89543 4.89543 4 6 4H15" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
); 