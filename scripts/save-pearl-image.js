const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Directory paths
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Function to create a realistic pearl image
async function createRealisticPearl(size = 512) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Clear canvas with transparent background
  ctx.clearRect(0, 0, size, size);
  
  // Create a realistic pearly gradient
  const pearlGradient = ctx.createRadialGradient(
    size * 0.5, size * 0.5, 0,
    size * 0.5, size * 0.5, size * 0.5
  );
  
  // Cream/ivory pearl colors
  pearlGradient.addColorStop(0, 'rgba(255, 253, 240, 1)');  // Center: light cream
  pearlGradient.addColorStop(0.2, 'rgba(248, 246, 230, 1)'); // Inner: warm ivory
  pearlGradient.addColorStop(0.5, 'rgba(240, 238, 225, 1)'); // Middle: soft ivory
  pearlGradient.addColorStop(0.8, 'rgba(235, 232, 215, 1)'); // Outer: light beige
  pearlGradient.addColorStop(1, 'rgba(228, 225, 205, 1)');   // Edge: warm taupe
  
  // Draw the pearl circle
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = pearlGradient;
  ctx.fill();
  
  // Add main highlight (top left)
  const highlightGradient1 = ctx.createRadialGradient(
    size * 0.4, size * 0.4, 0,
    size * 0.4, size * 0.4, size * 0.3
  );
  highlightGradient1.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  highlightGradient1.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
  highlightGradient1.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.beginPath();
  ctx.arc(size * 0.4, size * 0.4, size * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = highlightGradient1;
  ctx.fill();
  
  // Add secondary highlight (bottom right)
  const highlightGradient2 = ctx.createRadialGradient(
    size * 0.6, size * 0.6, 0,
    size * 0.6, size * 0.6, size * 0.2
  );
  highlightGradient2.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  highlightGradient2.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.beginPath();
  ctx.arc(size * 0.6, size * 0.6, size * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = highlightGradient2;
  ctx.fill();
  
  // Add some subtle iridescent streaks
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = 'rgba(200, 230, 255, 0.4)'; // Bluish streak
  
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const length = size * (0.3 + Math.random() * 0.2);
    const startX = size * 0.5 - Math.cos(angle) * size * 0.2;
    const startY = size * 0.5 - Math.sin(angle) * size * 0.2;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(
      startX + Math.cos(angle) * length,
      startY + Math.sin(angle) * length
    );
    ctx.lineWidth = 5 + Math.random() * 10;
    ctx.stroke();
  }
  
  // Reset global alpha
  ctx.globalAlpha = 1;
  
  // Add subtle shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = size * 0.05;
  ctx.shadowOffsetX = size * 0.01;
  ctx.shadowOffsetY = size * 0.01;
  
  // Draw a very subtle outer ring to define the pearl
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.48, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(210, 210, 200, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  return canvas;
}

// Function to save the pearl as PNG
function savePearlAsPNG(canvas, filename) {
  const pngBuffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, pngBuffer);
  console.log(`✅ Saved PNG icon to ${filename}`);
}

// Main function to generate and save pearl icons
async function main() {
  console.log('Generating realistic pearl icon...');
  
  // Create and save the 512px version (main icon)
  const mainPearl = await createRealisticPearl(512);
  savePearlAsPNG(mainPearl, path.join(publicDir, 'icon-512.png'));
  
  // Also save as the default icon.png
  savePearlAsPNG(mainPearl, path.join(publicDir, 'icon.png'));
  
  // Generate different sizes
  const sizes = [16, 32, 64, 128, 256];
  
  for (const size of sizes) {
    const pearl = await createRealisticPearl(size);
    savePearlAsPNG(pearl, path.join(publicDir, `icon-${size}.png`));
  }
  
  console.log('✨ Realistic pearl icon generation complete');
}

// Run the main function
main().catch(err => {
  console.error('Error generating pearl icons:', err);
}); 