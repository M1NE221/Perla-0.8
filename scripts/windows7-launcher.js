// Windows 7 compatibility launcher script
// This script can be packaged with the installer to provide a Windows 7 compatible entry point

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// Detect Windows version
function getWindowsVersion() {
  const os = require('os');
  const release = os.release().split('.');
  const major = parseInt(release[0], 10);
  const minor = parseInt(release[1], 10);
  
  // Windows 7 is NT 6.1, Windows 8 is 6.2, Windows 8.1 is 6.3, Windows 10+ is 10.0+
  if (major === 6 && minor === 1) {
    return 'windows7';
  } else if (major === 6 && minor === 2) {
    return 'windows8';
  } else if (major === 6 && minor === 3) {
    return 'windows8.1';
  } else if (major >= 10) {
    return 'windows10+';
  }
  return 'unknown';
}

// Check if we need compatibility mode
const winVersion = getWindowsVersion();
console.log(`Detected Windows version: ${winVersion}`);

// Determine installer location
const appDir = path.dirname(process.execPath);
const exePath = path.join(appDir, 'Perla.exe');

console.log(`Launcher starting, application path: ${exePath}`);

// For Windows 7 or 8, use compatibility flags
if (winVersion === 'windows7' || winVersion === 'windows8' || winVersion === 'unknown') {
  console.log('Using Windows 7/8 compatibility mode');
  
  try {
    // Set specific environment variables for Windows 7 compatibility
    const env = {
      ...process.env,
      ELECTRON_FORCE_DISCRETE_GPU: '0',
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_NO_ASAR: '1'
    };
    
    // Execute the application with compatibility settings
    const child = execFile(exePath, [], { env });
    
    child.stdout.on('data', (data) => {
      console.log(`Perla output: ${data}`);
    });
    
    child.stderr.on('data', (data) => {
      console.error(`Perla error: ${data}`);
    });
    
    child.on('close', (code) => {
      console.log(`Perla exited with code ${code}`);
      process.exit(code);
    });
  } catch (error) {
    console.error('Failed to start Perla:', error);
    // Write to a log file for diagnostics
    const logPath = path.join(appDir, 'perla-launcher-error.log');
    fs.writeFileSync(logPath, `Error: ${error.message}\n${error.stack}`);
    process.exit(1);
  }
} else {
  // For Windows 10+, launch directly
  console.log('Using standard launch mode for modern Windows');
  try {
    execFile(exePath);
    process.exit(0);
  } catch (error) {
    console.error('Failed to start Perla:', error);
    process.exit(1);
  }
} 