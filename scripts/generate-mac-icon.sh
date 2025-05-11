#!/bin/bash

# Script to generate macOS icon set (.icns) from a 512x512 or larger PNG

# Check if we have the required source icon
SOURCE_ICON="public/icon-512.png"
if [ ! -f "$SOURCE_ICON" ]; then
  echo "Error: Source icon $SOURCE_ICON not found"
  exit 1
fi

# Create the iconset directory if it doesn't exist
ICONSET_DIR="public/perla.iconset"
mkdir -p "$ICONSET_DIR"

# Generate the various icon sizes for macOS
echo "Generating iconset from $SOURCE_ICON..."

# 16x16
sips -z 16 16 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16.png"
# 16x16@2x (32x32)
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png"
# 32x32
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32.png"
# 32x32@2x (64x64)
sips -z 64 64 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png"
# 128x128
sips -z 128 128 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128.png"
# 128x128@2x (256x256)
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png"
# 256x256
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256.png"
# 256x256@2x (512x512)
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png"
# 512x512
cp "$SOURCE_ICON" "$ICONSET_DIR/icon_512x512.png"
# 512x512@2x (1024x1024) - using the same icon since we don't have a larger one
cp "$SOURCE_ICON" "$ICONSET_DIR/icon_512x512@2x.png"

# Convert the iconset to .icns file
echo "Converting iconset to .icns file..."
iconutil -c icns "$ICONSET_DIR" -o "public/perla.icns"

# Clean up if desired
# rm -rf "$ICONSET_DIR"

echo "macOS icon generation complete: public/perla.icns" 