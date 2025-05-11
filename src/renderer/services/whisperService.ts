import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';

// Define custom window interface for TypeScript
declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      getAppPath: () => string;
      getRailwayEndpoint: () => string;
    };
  }
}

// Types
interface TranscriptionEvents {
  on(event: 'transcription', listener: (text: string) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'end', listener: () => void): this;
  emit(event: 'transcription', text: string): boolean;
  emit(event: 'error', error: Error): boolean;
  emit(event: 'end'): boolean;
}

class TranscriptionEmitter extends EventEmitter implements TranscriptionEvents {}

// Configuration
let whisperProcess: ChildProcessWithoutNullStreams | null = null;
let audioStream: any = null;
const transcriptionEmitter = new TranscriptionEmitter();

// Get the correct binary path based on platform
function getWhisperBinaryPath(): string {
  let platform: string;
  
  // Get platform
  if (typeof window !== 'undefined' && window.electronAPI) {
    platform = window.electronAPI.platform;
  } else {
    platform = os.platform();
  }
  
  // Generate base path - in Electron this will be in frontend/resources
  const resourcePath = 'frontend/resources/whisper';
  
  // Determine executable name based on platform
  let executableName = '';
  
  switch (platform) {
    case 'win32':
      executableName = 'whisper.exe';
      break;
    case 'darwin': // macOS
      executableName = 'whisper';
      break;
    case 'linux':
      executableName = 'whisper';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  
  return path.resolve(resourcePath, platform, executableName);
}

// Helper to get app path in different environments
function getAppPath(): string {
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getAppPath) {
    return window.electronAPI.getAppPath();
  }
  return process.cwd();
}

// Get model path
function getModelPath(): string {
  // Generate base path - in Electron this will be in frontend/resources
  const resourcePath = 'frontend/resources/whisper';
  
  return path.resolve(resourcePath, 'models', 'small.en.bin');
}

// Initialize the mic stream
async function initMicrophoneStream(): Promise<any> {
  try {
    // Check if browser's getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser');
    }
    
    // Request audio stream with specific format for whisper.cpp
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    // Create an AudioContext to process the stream
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    
    // Create a ScriptProcessorNode to access raw audio data
    // Note: ScriptProcessorNode is deprecated but still widely supported
    // In the future, this should be replaced with AudioWorklet
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    return {
      stream,
      audioContext,
      processor,
      source,
      getAudioChunk: (callback: (chunk: Int16Array) => void) => {
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array (required format for whisper.cpp)
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // Convert float [-1.0, 1.0] to int16 [-32768, 32767]
            int16Data[i] = Math.min(1, Math.max(-1, inputData[i])) * 32767;
          }
          
          callback(int16Data);
        };
      },
      stop: () => {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      }
    };
  } catch (error) {
    console.error('Error initializing microphone:', error);
    throw error;
  }
}

/**
 * Start live transcription with whisper.cpp
 * @returns An EventEmitter that emits transcription events
 */
export function startLiveTranscription(): TranscriptionEvents {
  // Check if already running
  if (whisperProcess) {
    throw new Error('Transcription already running');
  }
  
  try {
    // Start the whisper.cpp process
    const binaryPath = getWhisperBinaryPath();
    const modelPath = getModelPath();
    
    // Start whisper.cpp in streaming mode
    whisperProcess = spawn(binaryPath, [
      '--model', modelPath,
      '--language', 'es',
      '--threads', '4',
      '--step', '500',
      '--length', '5000',
      '--beam-size', '5',
      '--no-timestamps',
      '--stream',
      '-'  // Read from stdin
    ]);
    
    // Handle process errors
    whisperProcess.on('error', (error) => {
      console.error('Error starting whisper.cpp process:', error);
      transcriptionEmitter.emit('error', error);
      stopLiveTranscription();
    });
    
    // Process stdout (transcription text)
    let buffer = '';
    whisperProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      
      // Process complete lines
      if (buffer.includes('\n')) {
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('[')) {
            transcriptionEmitter.emit('transcription', trimmedLine);
          }
        }
      }
    });
    
    // Process stderr (usually contains progress information)
    whisperProcess.stderr.on('data', (data) => {
      console.log('whisper.cpp stderr:', data.toString());
    });
    
    // Handle process exit
    whisperProcess.on('close', (code) => {
      console.log(`whisper.cpp process exited with code ${code}`);
      transcriptionEmitter.emit('end');
      whisperProcess = null;
    });
    
    // Initialize microphone stream
    initMicrophoneStream().then((micStream) => {
      audioStream = micStream;
      
      // Send audio chunks to whisper.cpp
      audioStream.getAudioChunk((chunk: Int16Array) => {
        if (whisperProcess && whisperProcess.stdin.writable) {
          // Create buffer from Int16Array
          const buffer = Buffer.from(chunk.buffer);
          whisperProcess.stdin.write(buffer);
        }
      });
    }).catch(error => {
      transcriptionEmitter.emit('error', error);
      stopLiveTranscription();
    });
    
    return transcriptionEmitter;
  } catch (error) {
    console.error('Error in startLiveTranscription:', error);
    throw error;
  }
}

/**
 * Stop the live transcription process
 */
export function stopLiveTranscription(): void {
  try {
    // Close audio stream if exists
    if (audioStream) {
      audioStream.stop();
      audioStream = null;
    }
    
    // Terminate whisper process if running
    if (whisperProcess) {
      // End stdin to signal EOF
      if (whisperProcess.stdin.writable) {
        whisperProcess.stdin.end();
      }
      
      // Give the process a moment to clean up
      setTimeout(() => {
        if (whisperProcess) {
          whisperProcess.kill();
          whisperProcess = null;
        }
      }, 500);
    }
    
    transcriptionEmitter.emit('end');
  } catch (error) {
    console.error('Error stopping live transcription:', error);
  }
}

// Verify whisper.cpp binary and model files exist
export async function verifyWhisperFiles(): Promise<boolean> {
  try {
    const binaryPath = getWhisperBinaryPath();
    const modelPath = getModelPath();
    
    // Check if binary exists
    await fs.access(binaryPath);
    
    // Check if model exists
    await fs.access(modelPath);
    
    return true;
  } catch (error) {
    console.error('Whisper files verification failed:', error);
    return false;
  }
}

export default {
  startLiveTranscription,
  stopLiveTranscription,
  verifyWhisperFiles
}; 