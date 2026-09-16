const https = require('https');
const fs = require('fs');
const path = require('path');

const urls = [
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/dist/face-api.min.js',
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
];
const outDir = path.join(__dirname, '..', 'public', 'vendor');
const outFile = path.join(outDir, 'face-api.js');

fs.mkdirSync(outDir, { recursive: true });

function downloadFrom(urlList, index = 0) {
  if (index >= urlList.length) {
    console.error('All face-api.js download sources failed.');
    process.exit(1);
  }
  const currentUrl = urlList[index];
  console.log('Downloading face-api.js from', currentUrl);

  const req = https.get(currentUrl, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return https.get(res.headers.location, (redirectRes) => {
        if (redirectRes.statusCode !== 200) {
          console.warn(`Redirect failed with status ${redirectRes.statusCode}, trying fallback...`);
          return downloadFrom(urlList, index + 1);
        }
        const file = fs.createWriteStream(outFile);
        redirectRes.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Saved face-api.js to', outFile);
        });
      }).on('error', () => downloadFrom(urlList, index + 1));
    }

    if (res.statusCode !== 200) {
      console.warn(`Download failed with status ${res.statusCode}, trying fallback...`);
      return downloadFrom(urlList, index + 1);
    }

    const file = fs.createWriteStream(outFile);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Saved face-api.js to', outFile);
    });
  });

  req.on('error', (err) => {
    console.warn('Error downloading:', err.message, 'trying next source...');
    downloadFrom(urlList, index + 1);
  });
}

downloadFrom(urls);
