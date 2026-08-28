const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js';
const outDir = path.join(__dirname, '..', 'public', 'vendor');
const outFile = path.join(outDir, 'face-api.js');

fs.mkdirSync(outDir, { recursive: true });

console.log('Downloading face-api.js from', url);

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed to download. Status code:', res.statusCode);
    process.exit(1);
  }

  const file = fs.createWriteStream(outFile);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Saved face-api.js to', outFile);
  });
}).on('error', (err) => {
  console.error('Download error:', err.message);
  process.exit(1);
});
