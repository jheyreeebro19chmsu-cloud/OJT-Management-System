const fs = require('fs');
const path = require('path');
const parser = require('../node_modules/@babel/parser');
const file = path.join(__dirname, '..', 'screens', 'RegisterScreen.tsx');
const code = fs.readFileSync(file, 'utf8');
try {
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx', 'classProperties'] });
  console.log('Parsed OK');
} catch (err) {
  console.error('Parse error:');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
