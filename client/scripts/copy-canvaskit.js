#!/usr/bin/env node
/**
 * Skia on web is CanvasKit, a WebAssembly build that the browser fetches from
 * the site root at runtime. Expo serves `public/` at the root, so the binary
 * has to be copied there or the café renders a blank canvas and the console
 * fills with "both async and sync fetching of the wasm failed".
 *
 * This runs on postinstall so the copied binary always matches the installed
 * canvaskit-wasm version, instead of a stale ~7MB blob living in git.
 */
const fs = require('fs');
const path = require('path');

const source = path.join(
  __dirname,
  '..',
  'node_modules',
  'canvaskit-wasm',
  'bin',
  'full',
  'canvaskit.wasm'
);
const targetDir = path.join(__dirname, '..', 'public');
const target = path.join(targetDir, 'canvaskit.wasm');

if (!fs.existsSync(source)) {
  // Not fatal: native builds don't need CanvasKit at all.
  console.warn('[canvaskit] canvaskit-wasm not installed; skipping web copy.');
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log('[canvaskit] copied canvaskit.wasm into public/');
