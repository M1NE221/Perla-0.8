const fs = require('fs');
const path = require('path');

// This is a small script to create a minimal circular icon resembling a pearl
// Create a canvas to draw our pearl
const { createCanvas } = require('canvas');

// Create a 512x512 canvas
const canvas = createCanvas(512, 512);
const ctx = canvas.getContext('2d');

// Fill with transparent background
ctx.clearRect(0, 0, 512, 512);

// Draw a pearl-like gradient
const gradient = ctx.createRadialGradient(200, 200, 0, 256, 256, 300);
gradient.addColorStop(0, '#ffffff');
gradient.addColorStop(0.5, '#f5f5f0');
gradient.addColorStop(0.7, '#e6e6d9');
gradient.addColorStop(1, '#d9d9c9');

// Draw the pearl circle
ctx.beginPath();
ctx.arc(256, 256, 250, 0, Math.PI * 2);
ctx.fillStyle = gradient;
ctx.fill();

// Add a subtle highlight
ctx.beginPath();
ctx.ellipse(200, 200, 120, 100, 0, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
ctx.fill();

// Save the canvas to a PNG file
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, '../public/icon.png'), buffer);

console.log('Pearl icon created at public/icon.png'); 