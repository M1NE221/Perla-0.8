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
      getAppPath: () => string;
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
// Import Firebase service functions
import { 
  saveSalesToFirestore, 
  loadSalesFromFirestore,
  savePreferencesToFirestore,
  loadPreferencesFromFirestore,
  updateSaleInFirestore,
  deleteSalesFromFirestore,
  saveSuggestionToFirestore,
} from '@/services/firebaseService';
import { useAuth } from '@/components/AuthGate';
import { requireAuth, auth } from '@/lib/auth';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useAuth();

  // One-time email/password sign-in for demo purposes
  useEffect(() => {
    (async () => {
      try {
        await requireAuth('demo@perla.app', 'superSecret123');
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Authenticated UID:', auth.currentUser?.uid);
        }
      } catch (err: any) {
        console.error('Auth error', err);
        alert(
          `${err?.message ?? err}\nHint: Make sure E-mail/Password provider is enabled in Firebase Console.`
        );
      }
    })();
  }, []);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    if (!user) return; // ensure user is present
    const setupFirebase = async () => {
      try {
        // Load data from Firestore
        const cloudSales = await loadSalesFromFirestore();
        if (cloudSales) {
          console.log('Loaded sales data from Firestore');
          setSales(cloudSales);
        } else {
          // Fall back to localStorage if no cloud data
          const savedSales = localStorage.getItem('sales');
          if (savedSales) {
            try {
              const parsedSales = JSON.parse(savedSales);
              setSales(parsedSales);
              // Upload local data to Firestore for future use
              saveSalesToFirestore(parsedSales).catch(err => 
                console.error('Error syncing local sales to Firestore:', err)
              );
            } catch (e) {
              console.error('Error loading saved sales', e);
            }
          }
        }
        
        // Load preferences from Firestore
        const cloudPreferences = await loadPreferencesFromFirestore();
        if (cloudPreferences) {
          if (cloudPreferences.activeFields) {
            setActiveFields(cloudPreferences.activeFields);
          }
          
          if (cloudPreferences.columnOrder) {
            setColumnOrder(cloudPreferences.columnOrder);
          } else if (cloudPreferences.activeFields) {
            // Initialize column order based on active fields if no specific order
            setColumnOrder(cloudPreferences.activeFields);
          }
        } else {
          // Fall back to localStorage if no cloud preferences
          // Check for saved activeFields configuration
          const savedActiveFields = localStorage.getItem('activeFields');
          if (savedActiveFields) {
            try {
              const fields = JSON.parse(savedActiveFields);
              setActiveFields(fields);
              setColumnOrder(fields); // Initialize column order based on active fields
              
              // Upload local preferences to Firestore
              savePreferencesToFirestore({ activeFields: fields }).catch(err =>
                console.error('Error syncing local active fields to Firestore:', err)
              );
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
              const order = JSON.parse(savedColumnOrder);
              setColumnOrder(order);
              
              // Upload local preferences to Firestore
              savePreferencesToFirestore({ columnOrder: order }).catch(err =>
                console.error('Error syncing local column order to Firestore:', err)
              );
            } catch (e) {
              console.error('Error loading column order', e);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing Firebase:', error);
        
        // Fall back to localStorage if Firebase fails
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
      }
      
      // Test the backend connection and update initialization status
      try {
        const isConnected = await initializeAI();
        if (!isConnected) {
          console.warn("Failed to connect to backend API");
        }
      } catch (error) {
        console.error("Error checking backend connection:", error);
      }
    };
    
    setupFirebase();
  }, [user]);

  // Save sales whenever they change
  useEffect(() => {
    // Save to localStorage as backup
    localStorage.setItem('sales', JSON.stringify(sales));
    
    // Save to Firestore
    if (sales.length > 0) {
      console.log("Sales array to be saved:", sales);
      saveSalesToFirestore(sales).catch(err => 
        console.error('Error saving sales to Firestore:', err)
      );
      
      // Generate insights for the sales data
      generateInsights(sales).then(insight => {
        if (insight) setInsight(insight);
      });
    }
  }, [sales]);

  // Save active fields configuration
  useEffect(() => {
    // Save to localStorage as backup
    localStorage.setItem('activeFields', JSON.stringify(activeFields));
    
    // Save to Firestore
    savePreferencesToFirestore({ activeFields }).catch(err => 
      console.error('Error saving active fields to Firestore:', err)
    );
  }, [activeFields]);
  
  // Save column order
  useEffect(() => {
    // Save to localStorage as backup
    localStorage.setItem('columnOrder', JSON.stringify(columnOrder));
    
    // Save to Firestore
    savePreferencesToFirestore({ columnOrder }).catch(err => 
      console.error('Error saving column order to Firestore:', err)
    );
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
    setSelectedSales(prev => {
      const wasSelected = prev.includes(id);
      const newSelectedSales = wasSelected 
        ? prev.filter(saleId => saleId !== id) 
        : [...prev, id];
      
      console.log(`${wasSelected ? '🔳 Deseleccionando' : '☑️ Seleccionando'} venta con ID: ${id}`);
      console.log('ℹ️ Total seleccionadas:', newSelectedSales.length);
      
      return newSelectedSales;
    });
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
    
    // Evitar múltiples envíos simultáneos o envíos con input vacío / grabación activa
    if (isSubmitting || !input.trim() || isRecordingActive) return;
    setIsSubmitting(true);

    // DEBUG - Inicio del procesamiento con info del estado actual
    console.log('🔍 handleSubmit - Estado actual:', { 
      pendingClarification, 
      inputLength: input.length,
      currentSalesCount: sales.length,
      selectedSalesCount: selectedSales.length
    });
    console.log('📋 Estado de chatHistory al iniciar handleSubmit:', chatHistory);

    // Copiamos el texto actual y limpiamos de inmediato el campo para que el usuario lo vea vacío
    const currentInput = input.trim();
    setInput('');
    // Guardar la entrada actual para el historial
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
    
    // Create array of messages to send to backend
    // Si estamos en clarificación, añadir al historial existente, sino comenzar nuevo
    const messages = pendingClarification
      ? [...chatHistory, newUserMessage]
      : [newUserMessage];
    
    console.log('📤 Enviando mensajes al backend:', JSON.stringify(messages));
    console.log('🔍 Ventas seleccionadas:', selectedSales);
    
    // Process input through AI with messages array
    const result = await processSaleInput(
      messages as { role: 'user' | 'assistant', content: string }[], 
      sales, 
      selectedSales
    );
    
    console.log('📥 Respuesta recibida del backend:', result);
    
    // Handle the result based on the action performed
    if (result.success) {
      console.log('✅ Respuesta exitosa del backend');
      
      // Check if it's a specific kind of pending action
      if (result.pendingAction === 'request_clarification') {
        // Set UI to clarification mode
        console.log('Se requiere clarificación:', result.missingInfo);
        setPendingClarification(true);
        setClarificationQuestion(result.missingInfo?.question || result.message);
        setChatHistory(messages);
        setIsSubmitting(false);
        return;
      }
      
      // Handle suggestions if detected in the response
      if (result.pendingAction === 'suggestion' && result.suggestion) {
        console.log('Sugerencia detectada:', result.suggestion);
        try {
          // Save suggestion to Firestore
          await saveSuggestionToFirestore(result.suggestion);
          setConfirmation('¡Gracias por tu sugerencia! La hemos registrado y la tomaremos en cuenta para mejorar Perla.');
        } catch (error) {
          console.error('Error al guardar sugerencia:', error);
          setConfirmation('Recibimos tu sugerencia, pero hubo un error al guardarla. Por favor, intenta nuevamente.');
        }
        
        // Reset state for next interaction
        setInput('');
        setChatHistory([]);
        setIsSubmitting(false);
        return;
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
        console.log('💾 Estado completo después de la venta:', {
          pendingClarification,
          clarificationQuestion,
          chatHistoryLength: chatHistory.length,
          conversationHistoryLength: conversationHistory.length,
          currentSalesCount: sales.length
        });
        
        const newSalesArray = [newSale, ...sales];
        setSales(prev => [newSale, ...prev]);
        
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
        setSales(prev => [...newSales, ...prev]);
        
        // Extra logging para verificar que se está ejecutando esta rama de código
        console.log('✅ Múltiples ventas añadidas correctamente, nuevo recuento:', newSalesArray.length);
        // Forzar renderizado para ver el cambio
        setTimeout(() => {
          console.log('🔄 Verificación después de timeout, conteo de ventas:', sales.length);
        }, 100);
      } else if (result.updatedSales) {
        // Update or delete operation that returns the full updated list
        console.log('✏️ Actualizando ventas:', result.updatedSales);
        
        // Get what changed by comparing with current sales
        const updatedSaleIds = result.updatedSales
          .filter(updatedSale => {
            const originalSale = sales.find(s => s.id === updatedSale.id);
            // Return true if this sale exists and has been modified
            return originalSale && JSON.stringify(originalSale) !== JSON.stringify(updatedSale);
          })
          .map(sale => sale.id);
        
        if (updatedSaleIds.length > 0) {
          console.log('✅ Ventas modificadas con IDs:', updatedSaleIds);
          
          // For each updated sale, call updateSaleInFirestore
          const updatePromises = result.updatedSales
            .filter(sale => updatedSaleIds.includes(sale.id))
            .map(sale => updateSaleInFirestore(sale));
          
          // Wait for all updates to complete
          Promise.all(updatePromises).catch(err => 
            console.error('Error updating sales in Firestore:', err)
          );
        }
        
        // Update state with the new sales list
        setSales(result.updatedSales);
        // Clear selections after successful bulk operation
        setSelectedSales([]);
      } else if (result.deletedId) {
        // Delete operation that returns just the ID to remove
        console.log('🗑️ Eliminando venta con ID:', result.deletedId);
        
        // Update Firebase using the specific delete function
        deleteSalesFromFirestore([result.deletedId]).catch(err => 
          console.error('Error deleting sale from Firestore:', err)
        );
        
        // Update local state
        setSales(prevSales => prevSales.filter(sale => sale.id !== result.deletedId));
      } else if (result.deletedIds) {
        // Bulk delete operation
        console.log('🗑️ Eliminando ventas con IDs:', result.deletedIds);
        
        // Update Firebase using the specific delete function
        deleteSalesFromFirestore(result.deletedIds).catch(err => 
          console.error('Error deleting multiple sales from Firestore:', err)
        );
        
        // Update local state
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
          // Additional detailed debugging information
          console.log('Response data details:', {
            hasSuccess: result.success,
            hasMessage: Boolean(result.message),
            messageLength: result.message ? result.message.length : 0,
            messagePreview: result.message ? result.message.substring(0, 50) + '...' : '',
            hasSale: Boolean(result.sale),
            hasSales: Boolean(result.sales),
            hasUpdatedSales: Boolean(result.updatedSales),
            hasDeletedId: Boolean(result.deletedId),
            hasDeletedIds: Boolean(result.deletedIds),
            fullResultKeys: Object.keys(result),
          });
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
              setSales(prev => [messageJson.sale, ...prev]);
            } else if (messageJson.sales && Array.isArray(messageJson.sales)) {
              console.log('Found sales array in parsed message:', messageJson.sales);
              setSales(prev => [...messageJson.sales, ...prev]);
            }
          }
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Error parsing message as JSON:', e);
          }
        }
      }
      
      // Reset pending clarification since we processed a valid sale action
      setPendingClarification(false);
      // Reset input after successful processing
      setInput('');
      setIsSubmitting(false);
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
        setIsSubmitting(false);
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
      setIsSubmitting(false);
    }
    // Reset input after processing
    setInput('');
    setIsSubmitting(false);
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
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24 bg-black text-green-400 font-mono">
      <div className="w-full max-w-3xl mx-auto relative" ref={containerRef}>
        {/* Matrix-style title */}
        <div className="absolute top-0 right-0 opacity-20 text-xs tracking-wider">
          <div className="text-green-500">PERLA v1.0</div>
        </div>
        
        {/* Input form */}
        <form onSubmit={handleSubmit} className="mb-8 border border-green-900/30 rounded-lg p-6 shadow-lg shadow-green-900/10 backdrop-blur-sm">
          <div className="flex items-center border-b border-green-800 pb-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pendingClarification ? clarificationQuestion : "¿Qué vendiste?"}
              className="w-full p-2 bg-transparent focus:outline-none placeholder:text-green-800 text-lg"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isRecordingActive) {
                  e.preventDefault(); // Prevent form submission during recording
                }
              }}
            />
            <AudioRecorder 
              onTranscriptionComplete={handleTranscriptionComplete}
              onTranscriptionError={handleTranscriptionError}
              onStartRecording={startAudioProcessing}
              isProcessing={isProcessingAudio}
              onRecordingStateChange={setIsRecordingActive}
            />
          </div>
          
          {/* Custom fields button row */}
          <div className="flex flex-wrap gap-2 mt-4 mb-4">
            {AVAILABLE_FIELDS.map(field => (
              <button
                key={field.key}
                type="button"
                className={`text-xs px-2 py-1 rounded transition-all duration-300 ${
                  activeFields.includes(field.key) 
                    ? 'bg-green-900/30 text-green-400 border border-green-800 shadow-sm shadow-green-800/50' 
                    : 'bg-black text-green-800 border border-green-900/20 hover:border-green-800/50'
                }`}
                onClick={() => toggleField(field.key)}
              >
                {field.name}
              </button>
            ))}
          </div>
          
          {/* Selection mode toggle */}
          <div className="flex justify-between mb-4">
            <button
              type="button"
              className={`text-xs px-3 py-1.5 rounded-full transition-all duration-300 ${
                selectionMode 
                  ? 'bg-green-900/30 text-green-300 border border-green-700' 
                  : 'bg-black text-green-800 border border-green-900/30 hover:border-green-800/50'
              }`}
              onClick={toggleSelectionMode}
            >
              {selectionMode ? 'Salir del modo selección' : 'Modo selección'}
            </button>
            
            {selectionMode && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-full border border-green-900/30 hover:border-green-800 text-green-600 hover:text-green-500 transition-all"
                  onClick={selectAllSales}
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-full border border-green-900/30 hover:border-green-800 text-green-600 hover:text-green-500 transition-all"
                  onClick={clearSelections}
                >
                  Limpiar selección
                </button>
                <span className="text-xs px-3 py-1.5 text-green-700">
                  {selectedSales.length} seleccionados
                </span>
              </div>
            )}
          </div>
          
          {/* Helper message for selection mode */}
          {selectionMode && (
            <div className="my-3 text-xs text-green-600/80 bg-green-950/10 p-2 rounded border border-green-900/20">
              {selectedSales.length === 0 ? (
                <p>Modo selección activo. Haga clic en las ventas para seleccionarlas, luego escriba comandos.</p>
              ) : (
                <>
                  <p className="font-bold text-green-500">
                    ✓ {selectedSales.length} {selectedSales.length === 1 ? 'venta seleccionada' : 'ventas seleccionadas'}
                  </p>
                  <p className="mt-1">Puedes escribir comandos como:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>"Actualiza el monto a 5750 en las ventas seleccionadas"</li>
                    <li>"Elimina las ventas seleccionadas"</li>
                    <li>"Cambia el cliente a Juan en esta venta"</li>
                  </ul>
                </>
              )}
            </div>
          )}
          
          {/* Confirmation animation */}
          {(confirmation || clarificationQuestion) && (
            <div className="my-4 text-green-500 border-l-2 border-green-800 pl-3 pb-1">
              <TypingResponse 
                text={confirmation || clarificationQuestion} 
                className="font-mono tracking-wide" 
              />
            </div>
          )}
        </form>
        
        {/* Insights */}
        {insight && (
          <div className="p-4 mb-6 border border-green-900/20 rounded-md text-sm opacity-80 bg-green-950/10">
            <div className="text-green-600 mb-1 uppercase text-xs tracking-wider">Insights</div>
            <div className="text-green-400/90">{insight}</div>
          </div>
        )}
        
        {/* Sales table */}
        <div className="mb-8 overflow-hidden border border-green-900/30 rounded-lg shadow-lg shadow-green-900/10">
          {/* Table headers */}
          <div className="sales-header grid gap-1 p-3 bg-green-950/30 border-b border-green-800/30 text-xs uppercase tracking-wider">
            {columnOrder.filter(key => activeFields.includes(key)).map(key => (
              <div 
                key={key}
                className={`${draggingColumn === key ? 'text-white' : 'text-green-400'} cursor-move`}
                draggable={true}
                onDragStart={(e) => handleColumnDragStart(e, key)}
                onDragOver={handleColumnDragOver}
                onDrop={(e) => handleColumnDrop(e, key)}
              >
                : {getFieldName(key)}
              </div>
            ))}
          </div>
          
          {/* Table body */}
          <div className="bg-black/90">
            <AnimatePresence>
              {sales.map((sale, index) => (
                <motion.div 
                  key={sale.id}
                  className={`grid gap-1 p-3 border-b border-green-900/20 hover:bg-green-950/10 transition-colors ${selectionMode && selectedSales.includes(sale.id) ? 'bg-green-950/30' : ''}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => selectionMode && toggleSaleSelection(sale.id)}
                  style={{
                    gridTemplateColumns: `repeat(${columnOrder.filter(key => activeFields.includes(key)).length}, minmax(0, 1fr))`
                  }}
                >
                  {columnOrder.filter(key => activeFields.includes(key)).map(key => (
                    <div key={`${sale.id}-${key}`} className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {key === 'product' && <span className="text-white">{sale.product}</span>}
                      {key === 'amount' && <span className="text-green-300">{sale.amount}</span>}
                      {key === 'price' && <span className="text-green-400">${sale.price.toFixed(2)}</span>}
                      {key === 'totalPrice' && <span className="text-green-300">${sale.totalPrice.toFixed(2)}</span>}
                      {key === 'paymentMethod' && <span className="text-green-400/80">{sale.paymentMethod || 'Efectivo'}</span>}
                      {key === 'client' && <span className="text-green-400/80">{sale.client || 'Anónimo'}</span>}
                      {key === 'date' && <span className="text-green-600 text-xs">{sale.date ? format(new Date(sale.date), 'dd/MM/yyyy') : ''}</span>}
                    </div>
                  ))}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Sales summary */}
        <div className="flex justify-between items-center p-3 border border-green-900/30 rounded-lg bg-green-950/10 shadow-inner shadow-green-900/5">
          <div className="text-green-600 font-mono text-sm">Total ventas: {sales.length}</div>
          <div className="text-green-300 text-lg font-bold">
            ${sales.reduce((sum, sale) => sum + sale.totalPrice, 0).toFixed(2)}
          </div>
        </div>
        
        {/* Matrix-style decorative elements */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 border border-green-500/20 rounded-full"></div>
          <div className="absolute bottom-20 right-20 w-40 h-40 border border-green-500/10 rounded-full"></div>
          <div className="absolute top-1/3 right-1/4 w-20 h-20 border border-green-500/20 rounded-full"></div>
        </div>
      </div>
    </main>
  );
} 