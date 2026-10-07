const urls = [
  'http://localhost:3000/index.html',
  'http://localhost:3000/monitoring.html',
  'http://localhost:3000/grid/index.html',
  'http://localhost:3000/gms.html',
  'http://localhost:3000/gms-select.html',
  'http://localhost:3000/settings.html'
];
Promise.all(urls.map(u => fetch(u).then(r => r.text()).then(html => ({ url: u, hasBtn: html.includes('id="fullscreenToggleBtn"') }))))
.then(res => console.log('Fullscreen verification:', res))
.catch(err => console.error(err));
