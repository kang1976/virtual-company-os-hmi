const http = require('http');

http.get('http://localhost:3000/gms.html', res => {
  console.log('StatusCode:', res.statusCode);
}).on('error', err => {
  console.error('Error detail:', err);
});
