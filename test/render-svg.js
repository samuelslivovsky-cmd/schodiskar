// Vygeneruje SVG pôdorysov a rozvinutí do out/ na vizuálnu kontrolu
'use strict';
const fs = require('fs');
fs.mkdirSync('out', { recursive: true });
const C = require('../src/core.js'), D = require('../src/draw.js');
const cases = {
  L: { typ: 'L' }, Lr: { typ: 'L', r: 300, smer: 'vpravo' }, U: { typ: 'U' }, U0: { typ: 'U', M: 0 },
  Lp: { typ: 'Lp', A: 3200 }, Up: { typ: 'Up', R1: 2900, R2: 2900, M: 200 }, rovne: { typ: 'rovne' },
  tocite: { typ: 'tocite' }, tocite450: { typ: 'tocite', uhol: 450, H: 3200 }, Lnb0: { typ: 'L', nb: 0 },
  Ukratke: { typ: 'U', R1: 1300, R2: 1300, M: 0, H: 2400 }
};
for (const [k, inp] of Object.entries(cases.only ? {} : cases)) {
  const r = C.compute(inp);
  const p = D.plan(r);
  if (p.bbox) fs.writeFileSync('out/plan-' + k + '.svg', D.toSVG(p.items, p.bbox, { standalone: true, width: 1400 }));
  const u = D.unfold(r);
  if (u.bbox) fs.writeFileSync('out/unfold-' + k + '.svg', D.toSVG(u.items, u.bbox, { standalone: true, width: 1400 }));
  if (r.treads && r.treads.length) {
    const pl = D.partsLayout(r, 10, 4000);
    const items = [].concat(...pl.map(q => D.moveItems(q.items, q.x, -q.y)));
    fs.writeFileSync('out/parts-' + k + '.svg', D.toSVG(items, D.itemsBBox(items), { standalone: true, width: 1400 }));
  }
  console.log(k, r.stav, r.errors[0] || '');
}
