const { spawn } = require('child_process');

console.log('Starting server test...');
const proc = spawn('node', ['src/server.js'], {
  cwd: 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google'
});

proc.stdout.on('data', data => {
  console.log('[STDOUT]:', data.toString());
});

proc.stderr.on('data', data => {
  console.error('[STDERR]:', data.toString());
});

setTimeout(() => {
  console.log('Stopping test process...');
  proc.kill();
  process.exit(0);
}, 3000);
