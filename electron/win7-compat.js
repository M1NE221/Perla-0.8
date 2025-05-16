// Windows 7 compatibility launcher
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Windows 7 compatibility launcher starting...');

// Determine app path based on current environment
let appPath;
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  // Running in portable mode
  appPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'Perla.exe');
} else {
  // Running in installed mode
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  
  // Check both Program Files locations
  const possiblePaths = [
    path.join(programFiles, 'Perla', 'Perla.exe'),
    path.join(programFilesX86, 'Perla', 'Perla.exe')
  ];
  
  appPath = possiblePaths.find(p => fs.existsSync(p));
  
  if (!appPath) {
    // Fallback to current directory if not found in Program Files
    appPath = path.join(__dirname, 'Perla.exe');
  }
}

console.log(`Launching Perla from: ${appPath}`);

// Launch the main app with specific compatibility flags
try {
  const appProcess = spawn(appPath, [], {
    env: {
      ...process.env,
      ELECTRON_FORCE_DISCRETE_GPU: '0',
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_ENABLE_STACK_DUMPING: '1',
      ELECTRON_NO_ASAR: '1'
    },
    detached: false // Keep attached to this process
  });
  
  appProcess.stdout.on('data', (data) => {
    console.log(`App output: ${data}`);
  });
  
  appProcess.stderr.on('data', (data) => {
    console.error(`App error: ${data}`);
  });
  
  appProcess.on('close', (code) => {
    console.log(`App exited with code ${code}`);
    process.exit(code);
  });
  
  appProcess.on('error', (err) => {
    console.error('Failed to start Perla:', err);
    process.exit(1);
  });
} catch (error) {
  console.error('Error launching Perla:', error);
  process.exit(1);
} 