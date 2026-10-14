// Náhodné vstupy: žiadne výnimky, NaN; pri úspechu platia invarianty. node test/fuzz-core.js
'use strict';
const C = require('../src/core.js');
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = (a, b) => Math.round(a + (b - a) * rnd());
const types = ['rovne', 'L', 'U', 'Lp', 'Up', 'tocite'];
const stat = {}; let bad = 0;
for (let k = 0; k < 6000; k++) {
  const typ = types[k % 6];
  const inp = { typ, smer: rnd() < .5 ? 'vlavo' : 'vpravo', H: R(800, 4000), W: R(600, 1400), L: R(1000, 6000), A: R(900, 4500), B: R(900, 4500),
    R1: R(900, 4000), R2: R(900, 4000), M: R(0, 1200), r: rnd() < .4 ? 0 : R(0, 800), Rv: R(500, 1500), Rs: R(0, 300), uhol: R(90, 720),
    w: rnd() < .5 ? 0 : R(100, 900), nb: R(0, 6), N: rnd() < .7 ? 0 : R(4, 24), presah: R(0, 50) };
  let r;
  try { r = C.compute(inp); } catch (e) { bad++; console.log('VÝNIMKA', typ, JSON.stringify(inp), e.stack); continue; }
  const key = typ + (r.errors.length ? ':chyba' : ':' + r.stav);
  stat[key] = (stat[key] || 0) + 1;
  if (r.errors.length) continue;
  const fin = x => typeof x === 'number' && isFinite(x);
  let sum = 0, okk = true;
  for (const t of r.treads) {
    sum += t.plocha;
    if (!(t.plocha > 0) || !fin(t.prirez.dlzka) || !fin(t.prirez.sirka) || t.poly.some(p => !fin(p.x) || !fin(p.y))) okk = false;
    if (t.plochaSPresahom < t.plocha - 1e-3) okk = false;
  }
  const oa = C.polyArea(r.geom.outline);
  if (Math.abs(sum - oa) > 1e-3 * Math.abs(oa)) okk = false;
  if (!okk) { bad++; if (bad < 10) console.log('INVARIANT', JSON.stringify(inp), sum, oa); }
}
console.log(stat); console.log('zlé:', bad);
process.exit(bad ? 1 : 0);
