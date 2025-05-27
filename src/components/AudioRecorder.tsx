declare global {
  interface Window {
    api?: {
      askPerla: (
        prompt: string,
        previousSales?: any[],
        selectedSales?: string[]
      ) => Promise<any>;
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

('use client');

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  onTranscriptionError?: (error: string) => void;
  isProcessing: boolean;
  onStartRecording?: () => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

// Error modal component to display errors more clearly
const ErrorModal = ({ message, onClose }: ErrorModalProps) => {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#1a1a1a] border border-white/10 rounded-lg p-5 max-w-md w-full mx-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-medium mb-2">
            Error al procesar el audio
          </h3>
          <p className="text-gray-300 text-sm mb-4">{message}</p>
          <div className="text-sm text-gray-400 mb-4">
            <p>Asegúrate de que:</p>
            <ul className="list-disc pl-5 mt-1">
              <li>Tu conexión a Internet sea estable</li>
              <li>El micrófono funcione correctamente</li>
              <li>Intentaste nuevamente en unos momentos</li>
            </ul>
          </div>
          <button
            className="bg-accent/20 hover:bg-accent/30 text-accent py-1.5 px-4 rounded-md w-full transition-colors"
            onClick={onClose}
          >
            Cerrar
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function AudioRecorder({
  onTranscriptionComplete,
  onTranscriptionError,
  isProcessing,
  onStartRecording,
  onRecordingStateChange,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Request microphone permissions on component mount
  useEffect(() => {
    requestMicrophonePermission();

    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Notify parent component when recording state changes
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [isRecording, onRecordingStateChange]);

  // Function to request microphone permissions
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just wanted to check for permission
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setPermissionDenied(true);
    }
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      if (onStartRecording) {
        onStartRecording();
      }

      // Request high quality audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
      });

      // Reset state
      audioChunksRef.current = [];
      setRecordingDuration(0);

      // Test different MIME types in order of preference
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/mpeg',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/wav',
      ];

      // Find first supported MIME type
      let mimeType = '';
      let options: MediaRecorderOptions = {};

      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          options = { mimeType };
          console.log(`Using MIME type: ${mimeType}`);
          break;
        }
      }

      if (!mimeType) {
        console.log('No preferred MIME type supported, using browser default');
      }

      // Create new MediaRecorder instance with the best supported options
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      // Setup event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms for smoother data collection
      setIsRecording(true);

      // Set up timer to track recording duration
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setPermissionDenied(true);
    }
  };

  // Stop recording
  const stopRecording = () => {
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current) {
      console.log('Stopping recording');
      mediaRecorderRef.current.stop();

      mediaRecorderRef.current.onstop = () => {
        console.log(
          'MediaRecorder stopped, audio chunks:',
          audioChunksRef.current.length
        );

        if (audioChunksRef.current.length > 0) {
          const firstChunk = audioChunksRef.current[0];
          if (!firstChunk) {
            console.error('First audio chunk is undefined');
            setErrorMessage('Error en la grabación. Inténtelo de nuevo.');
            return;
          }

          const audioType = firstChunk.type;
          console.log('Recording MIME type:', audioType);

          const audioBlob = new Blob(audioChunksRef.current, {
            type: audioType,
          });
          console.log('Audio blob created, size:', audioBlob.size);

          // Process the audio for transcription
          processAudioRecording(audioBlob);

          // Reset for next recording
          audioChunksRef.current = [];

          // Stop all tracks from the stream
          mediaRecorderRef.current?.stream
            ?.getTracks()
            .forEach((track) => track.stop());
        } else {
          console.error('No audio chunks recorded');
          setErrorMessage('No se grabó audio. Inténtelo de nuevo.');
        }
      };
    }
  };

  // Process the recording
  const processAudioRecording = async (audioBlob: Blob) => {
    try {
      // Check if audio blob is empty
      if (audioBlob.size === 0) {
        const errorMsg =
          'La grabación está vacía. Por favor, inténtalo de nuevo.';
        console.error(errorMsg);
        setErrorMessage(errorMsg);

        if (onTranscriptionError) {
          onTranscriptionError(errorMsg);
        }

        return;
      }

      console.log(
        'Processing audio recording, blob size:',
        audioBlob.size,
        'type:',
        audioBlob.type
      );

      // Determine the file extension based on MIME type
      let fileExtension = 'webm';
      let mimeType = audioBlob.type;

      // Map MIME types to file extensions recognized by Whisper API
      if (mimeType.includes('webm')) {
        fileExtension = 'webm';
      } else if (mimeType.includes('mp4')) {
        fileExtension = 'mp4';
      } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
        fileExtension = 'mp3';
      } else if (mimeType.includes('wav')) {
        fileExtension = 'wav';
      } else if (mimeType.includes('ogg')) {
        fileExtension = 'ogg';
      } else {
        console.warn(`Unknown MIME type: ${mimeType}, using .webm extension`);
      }

      // Convert the blob to a proper File object with appropriate extension
      const audioFile = new File([audioBlob], `recording.${fileExtension}`, {
        type: audioBlob.type,
      });

      console.log(
        `Prepared audio file (${audioFile.size} bytes) with type: ${audioFile.type} and name: ${audioFile.name}`
      );

      // Create a FormData object
      const formData = new FormData();
      formData.append('file', audioFile);

      let transcriptionResult;

      // Verificar si estamos en Electron y tenemos acceso a la API
      if (
        typeof window !== 'undefined' &&
        window.api &&
        typeof window.api.askPerla === 'function'
      ) {
        try {
          // Usar la API de Electron para transcribir si está disponible
          // Intentamos usar el endpoint de Railway a través de api.transcribe
          const railwayEndpoint =
            window.electronAPI?.getRailwayEndpoint?.() ||
            'https://perla-backend-production-6e4d.up.railway.app';
          const url = `${railwayEndpoint}/transcribe`;

          console.log(`Enviando audio a transcribir a: ${url}`);

          // Usar fetch para enviar el FormData
          const response = await fetch(url, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Error en la transcripción: ${response.status}`);
          }

          transcriptionResult = await response.json();
        } catch (error) {
          console.error('Error al transcribir usando API de Electron:', error);
          throw error;
        }
      } else {
        // Fallback para entorno web
        const BASE_URL =
          process.env.NEXT_PUBLIC_API_URL ||
          'https://perla-backend-production-6e4d.up.railway.app';
        const response = await fetch(`${BASE_URL}/transcribe`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        transcriptionResult = await response.json();
      }

      console.log('Resultado de transcripción:', transcriptionResult);

      if (transcriptionResult.text) {
        console.log('Transcription received:', transcriptionResult.text);
        onTranscriptionComplete(transcriptionResult.text);
      } else {
        throw new Error(
          transcriptionResult.error ||
            'Error: no se recibió texto de la transcripción'
        );
      }
    } catch (error: any) {
      console.error('Error processing audio:', error);
      const errorMsg = error?.message || 'Error al procesar el audio';
      setErrorMessage(errorMsg);

      if (onTranscriptionError) {
        onTranscriptionError(errorMsg);
      }
    }
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle recording button click
  const handleRecordClick = (e: React.MouseEvent) => {
    // Ensure the event doesn't propagate to parent elements or trigger form submission
    e.preventDefault();
    e.stopPropagation();

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center gap-3">
      {permissionDenied ? (
        <div className="text-red-500 text-xs">
          Se requiere acceso al micrófono para grabación de voz
        </div>
      ) : (
        <>
          <div className="relative group">
            <motion.button
              // Remove onClick handler to disable functionality
              // onClick={handleRecordClick}
              disabled={true}
              className="transition-colors flex items-center justify-center text-gray-600 cursor-not-allowed opacity-40"
              type="button"
            >
              {/* Microphone icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </motion.button>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black border border-green-800 text-green-400 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              Próximamente
            </div>
          </div>

          {isProcessing && (
            <motion.div
              className="text-xs font-mono text-gray-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Procesando audio...
            </motion.div>
          )}
        </>
      )}

      {/* Error Modal */}
      {errorMessage && (
        <ErrorModal
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
}
