const { spawn } = require('child_process');
const port = process.env.PORT || '5173';
const args = ['vite', 'preview', '--port', port, '--strictPort'];

const cp = spawn('npx', args, { stdio: 'inherit', shell: true });
cp.on('exit', function(code) {
  process.exit(code);
});
