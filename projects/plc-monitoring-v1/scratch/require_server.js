try {
  console.log('Loading server.js via require("../src/server.js")...');
  require('../src/server.js');
  console.log('Server started successfully!');
} catch (e) {
  console.error('Error during require:', e);
}
