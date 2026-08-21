#!/usr/bin/env node
/** Erzeugt server/assets/invoice-logo.png aus dem Original-Logo-Mark (kein Nachzeichnen). */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'server/assets'), { recursive: true });
const src = resolve(root, 'public/brand/bc-charge-mark.png');
await sharp(src)
  .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(resolve(root, 'server/assets/invoice-logo.png'));
console.log('server/assets/invoice-logo.png aktualisiert (original mark)');
