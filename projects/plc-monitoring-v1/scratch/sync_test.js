const { execSync } = require('child_process');
try {
  const out = execSync('node src/server.js', {
    cwd: 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google',
    timeout: 2000,
    encoding: 'utf8'
  });
  console.log('Output:', out);
} catch (e) {
  console.log('Status/Error:', e.message);
  if (e.stdout) console.log('Stdout:', e.stdout);
  if (e.stderr) console.log('Stderr:', e.stderr);
}
