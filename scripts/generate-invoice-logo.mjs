#!/usr/bin/env node
/** Erzeugt server/assets/invoice-logo.png aus public/bc-icon.svg (für PDF-Rechnungen). */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'server/assets'), { recursive: true });
const svg = readFileSync(resolve(root, 'public/bc-icon.svg'));
await sharp(svg).resize(128, 128).png().toFile(resolve(root, 'server/assets/invoice-logo.png'));
console.log('server/assets/invoice-logo.png aktualisiert');
