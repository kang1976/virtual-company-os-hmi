const modules = [
  './timeUtils',
  './gridManager',
  './memoryAreas',
  './dataTypes',
  './trendManager',
  './excelImport',
  './plcSession'
];

for (const m of modules) {
  try {
    console.log('Testing require of', m);
    require('../src/' + m);
    console.log(' -> OK');
  } catch (e) {
    console.error(' -> ERROR:', e);
  }
}
