const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const cwd = 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google';
const logFile = path.join(cwd, 'logs', 'server_daemon.log');

if (!fs.existsSync(path.join(cwd, 'logs'))) {
  fs.mkdirSync(path.join(cwd, 'logs'), { recursive: true });
}

const out = fs.openSync(logFile, 'a');
const err = fs.openSync(logFile, 'a');

const child = spawn(process.execPath, [path.join(cwd, 'src', 'server.js')], {
  cwd,
  detached: true,
  stdio: ['ignore', out, err],
  windowsHide: true
});

child.unref();
console.log('Daemon launched with PID:', child.pid);
