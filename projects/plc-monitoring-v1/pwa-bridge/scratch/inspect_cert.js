const tls = require('tls');
const fs = require('fs');
const path = require('path');

const certPath = path.join(__dirname, '..', 'certs', 'server.pem');
const certPem = fs.readFileSync(certPath);

// X509Certificate API 사용
const { X509Certificate } = require('crypto');
const x509 = new X509Certificate(certPem);

console.log('=== SSL Certificate Info ===');
console.log('Subject:', x509.subject);
console.log('Subject Alt Names (SAN):', x509.subjectAltName);
console.log('Valid From:', x509.validFrom);
console.log('Valid To:', x509.validTo);
