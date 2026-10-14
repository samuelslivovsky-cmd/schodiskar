// Zostaví jeden súbor index.html (HTML + CSS + JS + jsPDF + písmo), funguje offline.
'use strict';
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const safe = js => js.replace(/<\/script/gi, '<\/script');
const font = f => fs.readFileSync(path.join(__dirname, f)).toString('base64');
const scripts = [
  ['jsPDF 2.5.2 (MIT)', rd('node_modules/jspdf/dist/jspdf.umd.min.js')],
  ['Písmo DejaVu Sans (podmnožina, voľná licencia DejaVu/Bitstream Vera)', 'window.SCHODY_FONTS={regular:"' + font('fonts/DejaVuSans-sub.ttf') + '",bold:"' + font('fonts/DejaVuSans-Bold-sub.ttf') + '"};'],
  ['three.js 0.169 (MIT) – vybrané časti', rd('vendor/three.min.js')],
  ['Výpočtové jadro', rd('src/core.js')],
  ['Výkresy', rd('src/draw.js')],
  ['Exporty', rd('src/export.js')],
  ['3D vizualizácia', rd('src/viz3d.js')],
  ['Rozhranie', rd('src/app.js')]
];
let html = rd('src/template.html');
html = html.replace('/*STYLE*/', () => rd('src/style.css'));
html = html.replace('<!--SCRIPTS-->', () => scripts.map(([n, js]) => '<script>/* ' + n + ' */\n' + safe(js) + '\n</script>').join('\n'));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' kB');
