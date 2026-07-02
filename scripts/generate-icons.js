#!/usr/bin/env node
/**
 * Icon Generator for BC Charge PWA
 * 
 * Generates PNG icons from the SVG source for all required sizes.
 * Requires: sharp (npm install sharp)
 * 
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('Sharp not installed. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install sharp --save-dev', { stdio: 'inherit' });
    sharp = require('sharp');
  }

  const inputSvg = path.join(__dirname, '../public/bc-icon.svg');
  const outputDir = path.join(__dirname, '../public/icons');

  if (!fs.existsSync(inputSvg)) {
    console.error('SVG not found:', inputSvg);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sizes = [16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512];
  const maskableSizes = [192, 512];

  console.log('Generating icons...');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    await sharp(inputSvg)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icon-${size}.png`);
  }

  for (const size of maskableSizes) {
    const outputPath = path.join(outputDir, `icon-maskable-${size}.png`);
    const padding = Math.floor(size * 0.1);
    const innerSize = size - padding * 2;
    
    const background = Buffer.from(
      `<svg width="${size}" height="${size}">
        <rect width="${size}" height="${size}" fill="#0f1419"/>
      </svg>`
    );
    
    const icon = await sharp(inputSvg).resize(innerSize, innerSize).toBuffer();
    
    await sharp(background)
      .composite([{ input: icon, top: padding, left: padding }])
      .png()
      .toFile(outputPath);
    console.log(`  Created: icon-maskable-${size}.png`);
  }

  const appleTouchIcon = path.join(outputDir, 'apple-touch-icon.png');
  await sharp(inputSvg)
    .resize(180, 180)
    .png()
    .toFile(appleTouchIcon);
  console.log('  Created: apple-touch-icon.png');

  const shortcutIcons = ['map', 'scan', 'charge'];
  for (const name of shortcutIcons) {
    const outputPath = path.join(outputDir, `shortcut-${name}.png`);
    await sharp(inputSvg)
      .resize(96, 96)
      .png()
      .toFile(outputPath);
    console.log(`  Created: shortcut-${name}.png`);
  }

  console.log('\nDone! Icons generated in:', outputDir);
}

generateIcons().catch(console.error);
