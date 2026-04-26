#!/usr/bin/env node
/**
 * Download face-api.js models into public/models/
 * Usage: node scripts/download-face-models.js
 */
const fs = require('fs');
const path = require('path');
const { mkdir, writeFile } = require('fs').promises;
const fetch = global.fetch || require('node-fetch');

const OUT_DIR = path.join(__dirname, '..', 'public', 'models');
const BASE = 'https://cdn.jsdelivr.net/npm/face-api.js@0.20.0/weights/';

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
];

async function downloadFile(name) {
  const url = BASE + name;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  const outPath = path.join(OUT_DIR, name);
  await writeFile(outPath, Buffer.from(buf));
  console.log('Saved', outPath);
}

async function main() {
  try {
    await mkdir(OUT_DIR, { recursive: true });
    console.log('Downloading face-api models to', OUT_DIR);
    for (const f of files) {
      process.stdout.write(`Downloading ${f}... `);
      try {
        await downloadFile(f);
        console.log('ok');
      } catch (err) {
        console.error('failed:', err.message || err);
      }
    }
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
