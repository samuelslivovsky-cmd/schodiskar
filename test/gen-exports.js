// Vygeneruje PDF, DXF a CSV pre vybrané prípady do out/
'use strict';
const fs = require('fs');
fs.mkdirSync('out', { recursive: true });
const { jsPDF } = require('jspdf');
const C = require('../src/core.js'), E = require('../src/export.js');
const fonts = { regular: fs.readFileSync('fonts/DejaVuSans-sub.ttf').toString('base64'), bold: fs.readFileSync('fonts/DejaVuSans-Bold-sub.ttf').toString('base64') };
const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['L', 'U', 'Lr', 'Lp', 'tocite', 'rovne', 'Up'];
const defs = {
  L: { typ: 'L', projekt: 'Rodinný dom Žilina – schodisko', vypracoval: 'Ing. Ľubomír Šťastný' },
  Lr: { typ: 'L', r: 300, smer: 'vpravo' }, U: { typ: 'U' }, Lp: { typ: 'Lp', A: 3200 }, Up: { typ: 'Up', R1: 2900, R2: 2900, M: 200 },
  tocite: { typ: 'tocite' }, rovne: { typ: 'rovne' }, U0: { typ: 'U', M: 0 }, Lchyba: { typ: 'L', nb: 0 }
};
for (const k of cases) {
  const r = C.compute(defs[k]);
  const doc = E.pdf(r, jsPDF, fonts, { datum: '14. 10. 2026' });
  fs.writeFileSync('out/' + k + '.pdf', Buffer.from(doc.output('arraybuffer')));
  fs.writeFileSync('out/' + k + '.dxf', Buffer.from(E.dxf(r)));
  fs.writeFileSync('out/' + k + '.csv', E.csv(r));
  console.log(k, r.stav, 'ok');
}
