const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'server.log');
const out = fs.openSync(logFile, 'a');
const err = fs.openSync(logFile, 'a');

console.log('Launching server detached...');
const child = spawn(process.execPath, ['src/server.js'], {
  cwd: 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google',
  detached: true,
  stdio: ['ignore', out, err]
});

child.unref();
console.log('Server spawned with PID:', child.pid);
