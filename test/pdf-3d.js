// PDF s listom 3D vizualizácie (obrázky z out/*.jpg ako náhrada za WebGL render)
'use strict';
const fs = require('fs');
const { jsPDF } = require('jspdf');
const C = require('../src/core.js'), E = require('../src/export.js');
const fonts = { regular: fs.readFileSync('fonts/DejaVuSans-sub.ttf').toString('base64'), bold: fs.readFileSync('fonts/DejaVuSans-Bold-sub.ttf').toString('base64') };
const img = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
const r = C.compute({ typ: 'U' });
const images = [{ nazov: 'Celkový pohľad', url: img('out/i1.jpg') }, { nazov: 'Z nástupu', url: img('out/i2.jpg') }, { nazov: 'Z poschodia', url: img('out/i3.jpg') }];
const vizText = [['Priestor', 'Loft (tehla, betón)'], ['Stupne', 'Orech'], ['Podstupnice', 'bez podstupníc'], ['Schodnice', 'Čierna oceľ'], ['Zábradlie', 'Sklo s nerezovým madlom']];
fs.writeFileSync('out/viz.pdf', Buffer.from(E.pdf(r, jsPDF, fonts, { images, vizText, datum: '14. 10. 2026' }).output('arraybuffer')));
console.log('ok');
