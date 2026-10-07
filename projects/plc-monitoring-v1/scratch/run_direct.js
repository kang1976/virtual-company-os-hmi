process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', err => {
  console.error('UNHANDLED REJECTION:', err);
});

console.log('Loading server module from:', require.resolve('../src/server.js'));
try {
  require('../src/server.js');
  console.log('require succeeded!');
} catch (e) {
  console.error('SYNC CATCH:', e);
}
