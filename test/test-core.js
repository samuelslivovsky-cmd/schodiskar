// Testy výpočtového jadra: node test/test-core.js
'use strict';
const C = require('../src/core.js');

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  ✗ ' + msg); } };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' vs ' + b + ')');
const finite = x => typeof x === 'number' && isFinite(x);

function invariants(name, inp, expectErr) {
  const r = C.compute(inp);
  const tag = name + ' [' + (inp.smer || 'vlavo') + ']';
  if (expectErr) {
    ok(r.errors.length > 0, tag + ': očakávaná chyba');
    ok(r.stav === 'chyba', tag + ': stav chyba');
    return r;
  }
  ok(r.errors.length === 0, tag + ': bez chýb ' + JSON.stringify(r.errors));
  if (r.errors.length) return r;
  const N = r.N;
  ok(r.edges.length === N, tag + ': počet hrán = N');
  ok(r.treads.length === N - 1, tag + ': počet stupňov = N-1');
  near(r.h * N, r.input.H, 1e-6, tag + ': N*h = H');
  for (let i = 1; i < N; i++) {
    if (!(r.input.typ === 'tocite' && r.input.Rs === 0)) ok(r.treads[i - 1].kind === 'podesta' ? r.edges[i].t >= r.edges[i - 1].t : r.edges[i].t > r.edges[i - 1].t, tag + ': t rastie pri ' + i);
    ok(r.edges[i].u > r.edges[i - 1].u, tag + ': u rastie pri ' + i);
    ok(r.edges[i].s > r.edges[i - 1].s, tag + ': s rastie pri ' + i);
  }
  let sumA = 0;
  for (const t of r.treads) {
    ok(t.plocha > 0, tag + ': plocha stupňa ' + t.n + ' > 0 (' + t.plocha + ')');
    ok(t.plochaSPresahom >= t.plocha - 1e-6, tag + ': presah zväčšuje plochu ' + t.n);
    ok(finite(t.prirez.dlzka) && finite(t.prirez.sirka), tag + ': prírez číselný ' + t.n);
    ok(t.prirez.dlzka * t.prirez.sirka >= t.plochaSPresahom - 1, tag + ': prírez pokrýva tvar ' + t.n);
    for (const k of ['vnutri', 'vystup', 'vonku']) ok(finite(t.sirky[k]) && (t.sirky[k] > 0 || (k === 'vnutri' && (t.kind === 'podesta' || r.input.Rs === 0))), tag + ': šírka ' + k + ' st. ' + t.n);
    ok(t.poly.every(p => finite(p.x) && finite(p.y) && finite(p.b)), tag + ': súradnice ' + t.n);
    // orientácia CCW aj po zrkadlení
    ok(C.polyArea(t.poly) > 0, tag + ': CCW ' + t.n);
    if (t.kind === 'stupen' && r.input.typ !== 'Lp' && r.input.typ !== 'Up' && !r.upravy.ds) near(t.sirky.vystup, r.b, 1e-6, tag + ': b na výstupnej čiare st. ' + t.n);
    if (t.kind === 'stupen' && (r.input.typ === 'Lp' || r.input.typ === 'Up')) near(t.sirky.vystup, r.b, 1e-6, tag + ': b podesta-typ st. ' + t.n);
    sumA += t.plocha;
  }
  near(sumA, C.polyArea(r.geom.outline), 1e-3 * Math.abs(sumA), tag + ': súčet plôch stupňov = plocha obrysu');
  // presah: plocha navyše ~ presah * dĺžka nástupnej hrany (pri kolmých hranách presne)
  ok(r.checks.length >= 3, tag + ': kontroly');
  ok(['ok', 'pozor'].includes(r.stav), tag + ': stav ' + r.stav);
  ok(r.unfold && r.unfold.vnutorna.profil.length === 2 * N, tag + ': profil schodnice');
  for (const sh of r.unfold.vnutorna.tvary.concat(r.unfold.vonkajsia.tvary)) {
    ok(sh.poly.length >= 3 && sh.poly.every(p => finite(p.x) && finite(p.y)), tag + ': tvar schodnice');
  }
  return r;
}

function mirrorCheck(name, inp) {
  const a = C.compute(Object.assign({}, inp, { smer: 'vlavo' }));
  const b = C.compute(Object.assign({}, inp, { smer: 'vpravo' }));
  if (a.errors.length || b.errors.length) { ok(a.errors.length === b.errors.length, name + ': zrkadlo – rovnaké chyby'); return; }
  ok(a.N === b.N, name + ': zrkadlo N');
  for (let i = 0; i < a.edges.length; i++) {
    near(a.edges[i].P.y, -b.edges[i].P.y, 1e-9, name + ': zrkadlo P.y ' + i);
    near(a.edges[i].Q.x, b.edges[i].Q.x, 1e-9, name + ': zrkadlo Q.x ' + i);
  }
  for (let j = 0; j < a.treads.length; j++) {
    near(a.treads[j].plocha, b.treads[j].plocha, 1e-6, name + ': zrkadlo plocha ' + j);
    near(a.treads[j].prirez.dlzka, b.treads[j].prirez.dlzka, 1e-6, name + ': zrkadlo prírez ' + j);
    near(a.treads[j].prirez.sirka, b.treads[j].prirez.sirka, 1e-6, name + ': zrkadlo prírez š ' + j);
  }
}

function both(name, inp, expectErr) {
  const r1 = invariants(name, Object.assign({}, inp, { smer: 'vlavo' }), expectErr);
  invariants(name, Object.assign({}, inp, { smer: 'vpravo' }), expectErr);
  if (!expectErr) mirrorCheck(name, inp);
  return r1;
}

function summary(name, r) {
  if (r.errors.length) { console.log(name.padEnd(34), 'CHYBA:', r.errors[0]); return; }
  const kl = r.najuzsiKlin ? C.fmt(r.najuzsiKlin.hodnota, 1) : '-';
  console.log(name.padEnd(34), 'N=' + r.N, 'h=' + C.fmt(r.h, 1), 'b=' + C.fmt(r.b, 1), '2h+b=' + C.fmt(r.krok, 1),
    'klin=' + kl, 'vnútri min=' + (r.najuzsiVnutri != null ? C.fmt(r.najuzsiVnutri, 1) : '-'), 'stav=' + r.stav,
    r.checks.filter(c => !c.ok).map(c => c.id).join(','));
}

// ---------------------------------------------------------------- prípady
console.log('— základné typy');
const cases = [
  ['rovné', { typ: 'rovne', L: 3800 }],
  ['L ostrý roh', { typ: 'L' }],
  ['L polomer 200', { typ: 'L', r: 200 }],
  ['L nb=0 r=400', { typ: 'L', nb: 0, r: 400 }],
  ['L nb=5', { typ: 'L', nb: 5 }],
  ['L nesúmerné 3400/1800', { typ: 'L', A: 3400, B: 1800 }],
  ['L výst. čiara 350', { typ: 'L', w: 350 }],
  ['L pevné N=17', { typ: 'L', N: 17 }],
  ['U zrkadlo 150', { typ: 'U' }],
  ['U zrkadlo 0', { typ: 'U', M: 0 }],
  ['U zrkadlo 400 r=200', { typ: 'U', M: 400, r: 200 }],
  ['U široké zrkadlo 1000', { typ: 'U', M: 1000, R1: 2600, R2: 2600, H: 3200 }],
  ['L podesta', { typ: 'Lp', A: 3200, B: 2600 }],
  ['U podesta', { typ: 'Up', R1: 2900, R2: 2900, M: 200 }],
  ['U 3 ramená', { typ: 'U3', R1: 2170, S: 3370, R2: 1110 }],
  ['U 3 ramená nb=2 r=150', { typ: 'U3', R1: 2600, S: 3600, R2: 2600, H: 3200, nb: 2, r: 150 }],
  ['točité 360°', { typ: 'tocite' }],
  ['točité 270° R=900', { typ: 'tocite', uhol: 270, Rv: 900, H: 2600 }],
  ['točité 450°', { typ: 'tocite', uhol: 450, H: 3200 }],
  ['točité stĺp 0', { typ: 'tocite', Rs: 0, w: 500 }]
];
const results = {};
for (const [n, inp] of cases) { results[n] = both(n, inp); summary(n, results[n]); }

console.log('— krajné prípady');
const edge = [
  ['L krátke rameno A=1300', { typ: 'L', A: 1300, B: 3600 }],
  ['L krátke obe 1500/1500', { typ: 'L', A: 1500, B: 1500, H: 2000 }],
  ['L ostrý roh nb=0', { typ: 'L', nb: 0 }],
  ['U zrkadlo 0 nb=0', { typ: 'U', M: 0, nb: 0 }],
  ['U zrkadlo 0 nb=0 r=0 dlhé', { typ: 'U', M: 0, nb: 0, R1: 3000, R2: 3000, H: 3400 }],
  ['U krátke ramená 1300', { typ: 'U', R1: 1300, R2: 1300, M: 0, H: 2400 }],
  ['L r väčší než rameno', { typ: 'L', r: 5000 }],
  ['U r > zrkadlo/2', { typ: 'U', M: 100, r: 300 }],
  ['rovné krátke', { typ: 'rovne', L: 1000, H: 1000 }],
  ['L podesta krátka', { typ: 'Lp', A: 1400, B: 1400 }]
];
for (const [n, inp] of edge) {
  const r = C.compute(Object.assign({ smer: 'vlavo' }, inp));
  const r2 = C.compute(Object.assign({ smer: 'vpravo' }, inp));
  ok(r.errors.length === r2.errors.length, n + ': rovnaký výsledok oboch smerov');
  if (!r.errors.length) { invariants(n, inp); invariants(n, Object.assign({}, inp, { smer: 'vpravo' })); }
  else ok(/Zväčšite|musí|príliš|nemožno/.test(r.errors[0]), n + ': chyba má radu');
  summary(n, r);
}

console.log('— neplatné vstupy');
both('W = 0', { typ: 'L', W: 0 }, true);
both('A < W', { typ: 'L', A: 800 }, true);
both('w > W', { typ: 'L', w: 1000 }, true);
both('točité Rv < Rs', { typ: 'tocite', Rv: 100, Rs: 200 }, true);
both('H = 0', { typ: 'rovne', H: 0 }, true);

console.log('— špecifické kontroly');
{
  const r = results['rovné'];
  for (const t of r.treads) {
    near(t.sirky.vnutri, r.b, 1e-6, 'rovné: vnútri = b');
    near(t.sirky.vonku, r.b, 1e-6, 'rovné: vonku = b');
    near(t.prirez.dlzka, 900, 1e-6, 'rovné: prírez dĺžka = W');
    near(t.prirez.sirka, r.b + 30, 1e-6, 'rovné: prírez šírka = b + presah');
  }
  near(r.b, 3800 / (r.N - 1), 1e-9, 'rovné: b = L/(N-1)');
}
{
  const r = results['L ostrý roh'];
  // vyrovnanie: zachovaná dĺžka na vnútornej hrane a plynulé zužovanie
  const reg = r.eq[0];
  ok(r.eq.length === 1, 'L: jedna oblasť vyrovnania');
  const d = r.treads.map(t => t.sirky.vnutri);
  const tot = d.reduce((a, b) => a + b, 0);
  near(tot, r.edges[r.N - 1].t - r.edges[0].t, 1e-6, 'L: súčet šírok vnútri = dĺžka vnútornej hrany');
  near(r.edges[r.N - 1].t, 1700 + 1700, 1e-6, 'L: dĺžka vnútornej hrany ostrý roh');
  // monotónne do rohu a späť
  const mi = d.indexOf(Math.min.apply(null, d));
  let mono = true;
  for (let j = reg.od; j < mi + 1; j++) if (d[j - 1] < d[j] - 1e-6) mono = false;
  for (let j = mi + 1; j < reg.po; j++) if (d[j] < d[j - 1] - 1e-6) mono = false;
  ok(mono, 'L: klinové stupne sa plynulo zužujú a rozširujú');
  // súmernosť pre súmerné ramená
  for (let j = 0; j < d.length; j++) near(d[j], d[d.length - 1 - j], 1e-6, 'L: súmernosť šírok ' + j);
  // stupne mimo oblasti majú plnú šírku
  for (let j = 1; j < reg.od; j++) near(d[j - 1], r.b, 1e-6, 'L: mimo oblasti b ' + j);
  console.log('  šírky vnútri:', d.map(x => Math.round(x)).join(' '));
  console.log('  šírky 150 mm:', r.treads.map(t => Math.round(t.sirky.kontrola)).join(' '));
  console.log('  šírky vonku :', r.treads.map(t => Math.round(t.sirky.vonku)).join(' '));
}
{
  const r = C.compute({ typ: 'L', nb: 0 });
  ok(r.errors.length && /vyrovnaných/.test(r.errors[0]), 'L ostrý roh nb=0: chyba s radou');
  const a = results['L nb=0 r=400'], b = C.compute({ typ: 'L', nb: 3, r: 400 });
  ok(a.eq[0].n < b.eq[0].n, 'nb=0 menšia oblasť vyrovnania');
  ok(a.najuzsiKlin.hodnota < b.najuzsiKlin.hodnota, 'nb=0 užší klin ako nb=3');
}
{
  const r = results['točité 360°'];
  for (const e of r.edges) near(e.P.x * e.Q.y - e.P.y * e.Q.x, 0, 1e-6, 'točité: hrana radiálna');
  const dth = 360 / (r.N - 1);
  near(r.treads[0].sirky.vystup, (100 + 450) * dth * Math.PI / 180, 1e-6, 'točité: b na výstupnej čiare');
  ok(r.checks.some(c => c.id === 'podchod'), 'točité: kontrola podchodnej výšky');
  console.log('  podchodná výška:', Math.round(r.podchod));
}
{
  const r = results['točité 450°'];
  ok(r.checks.find(c => c.id === 'podchod').ok === (r.podchod >= 2100), 'točité 450: podchod konzistentný');
}
{
  const r = results['L podesta'];
  const p = r.treads.filter(t => t.kind === 'podesta');
  ok(p.length === 1, 'podesta: jedna podesta');
  const st = r.treads.filter(t => t.kind === 'stupen');
  for (const t of st) near(t.sirky.vnutri, r.b, 1e-6, 'podesta: stupne kolmé');
  ok(r.unfold.vnutorna.tvary.length === 2, 'podesta: dve schodnice');
  ok(!r.warnings.some(w => /Presah/.test(w)), 'podesta: presah všetkých stupňov vypočítaný');
  for (const t of st) near(t.prirez.sirka, r.b + 30, 1e-6, 'podesta: prírez = b + presah, st. ' + t.n);
}
{
  const r = results['U zrkadlo 150'];
  ok(r.eq.length >= 1, 'U: vyrovnanie');
  near(r.edges[r.N - 1].t, (2200 - 900) * 2 + 150, 1e-6, 'U: dĺžka vnútornej hrany');
}
{
  // vyrovnanie – samostatná funkcia
  const t = [0, 280, 560, 840, 840, 840, 1100, 1380, 1660, 1940];
  const e = C.equalize(t, 280, 2);
  near(e.t[9], 1940, 1e-9, 'equalize: koniec zachovaný');
  near(e.t[0], 0, 1e-9, 'equalize: začiatok zachovaný');
  for (let i = 1; i < 10; i++) ok(e.t[i] > e.t[i - 1], 'equalize: rastie ' + i);
}
{
  // ručné úpravy hrán
  const base = C.compute({});
  const N = base.N;
  const up = { N, typ: 'L', hrany: { 3: { ds: 15 }, 7: { dt: -25 }, 0: { ds: 40, dt: 10 } } };
  for (const smer of ['vlavo', 'vpravo']) {
    const r = invariants('L úpravy', { smer, upravy: up });
    ok(r.upravy.pocet === 3 && r.upravy.ds, 'úpravy: počet a ds [' + smer + ']');
    near(r.edges[3].s - base.edges[3].s, 15, 1e-6, 'úpravy: ds na výstupnej čiare');
    near(r.edges[7].t - base.edges[7].t, -25, 1e-6, 'úpravy: dt pri vnútornej hrane');
    near(r.edges[7].s, base.edges[7].s, 1e-9, 'úpravy: dt nemení výstupnú čiaru');
    near(r.edges[0].s, 0, 1e-9, 'úpravy: prvá hrana pevná na výstupnej čiare');
    near(r.edges[0].t, base.edges[0].t + 10, 1e-6, 'úpravy: dt aj na prvej hrane');
    ok(r.checks.some(c => c.id === 'brov' && !c.ok), 'úpravy: kontrola rovnakej šírky');
    near(r.treads[2].sirky.vystup, base.b + 15, 1e-6, 'úpravy: šírka stupňa 3');
    near(r.treads[3].sirky.vystup, base.b - 15, 1e-6, 'úpravy: šírka stupňa 4');
  }
  const stale = C.compute({ N: N + 1, upravy: up });
  ok(stale.upravy.pocet === 0 && stale.warnings.some(w => w.indexOf('Ručné úpravy') === 0), 'úpravy: iný N sa nepoužije');
  ok(C.compute({ upravy: { N, typ: 'L', hrany: { 5: { ds: base.b + 10 } } } }).errors.length > 0, 'úpravy: prekríženie je chyba');
  ok(!C.normalize({ upravy: { N, typ: 'L', hrany: { 2: { ds: 0, dt: 0 } } } }).upravy, 'úpravy: nulové sa zahodia');
}
{
  // nášľapné vrstvy
  const a = C.compute({ typ: 'rovne' }), r = C.compute({ typ: 'rovne', podlahaDole: 20, podlahaHore: 15 });
  near(r.h, a.h, 1e-9, 'podlahy: h sa nemení (H je čistá výška)');
  near(r.podlaha.hruba, 2800 + 20 - 15, 1e-9, 'podlahy: hrubá výška');
  near(r.risers[0].vyska, r.h - 40 + 20, 1e-9, 'podlahy: prvá podstupnica po hrubú podlahu');
  near(r.risers[r.N - 1].vyska, r.h - 15, 1e-9, 'podlahy: posledná podstupnica');
  near(r.risers[1].vyska, r.h - 40, 1e-9, 'podlahy: ostatné podstupnice');
  const sh = r.unfold.vnutorna.tvary[0];
  near(Math.min.apply(null, sh.poly.map(p => p.y)), -20, 1e-6, 'podlahy: schodnica stojí na hrubej podlahe');
}
{
  // otvor v strope: pri potrebnej dĺžke je podchod presne na limite
  for (const typ of ['rovne', 'L', 'U', 'Lp', 'Up']) {
    const r0 = C.compute({ typ });
    const om = r0.strop.otvorMin;
    ok(om > 0 && om < r0.Lw, typ + ': potrebný otvor v rozsahu (' + om + ')');
    const r1 = C.compute({ typ, otvor: om });
    near(r1.strop.svetla, 2100, 1e-6, typ + ': podchod pri potrebnom otvore');
    ok(r1.checks.find(c => c.id === 'podchodStrop').ok, typ + ': kontrola OK');
    const r2 = C.compute({ typ, otvor: om - 300 });
    ok(!r2.checks.find(c => c.id === 'podchodStrop').ok, typ + ': krátky otvor nevyhovuje');
  }
  ok(!C.compute({ typ: 'tocite' }).strop, 'točité: bez otvoru (vlastný podchod)');
}
{
  // zábradlie a rozloženie na dosky
  const r = C.compute({ typ: 'L' });
  for (const t of ['ocel', 'nerez', 'sklo', 'drevo']) {
    const R = C.railing(r, t);
    ok(R && R.madlo > Math.hypot(r.unfold.vnutorna.dlzka * 0.5, r.input.H) && R.posts.length >= 2, 'zábradlie ' + t);
    ok(R.posts.concat(R.rods).every(q => q.z1 > q.z0), 'zábradlie ' + t + ': kladné dĺžky');
  }
  ok(C.railing(r, 'ziadne') === null, 'bez zábradlia');
  const pcs = [{ n: 'a', w: 1000, h: 500 }, { n: 'b', w: 1000, h: 500 }, { n: 'c', w: 900, h: 690 }, { n: 'd', w: 5000, h: 100 }];
  const n = C.nest(pcs, 3000, 1200, 4);
  ok(n.nevojde.length === 1 && n.nevojde[0].n === 'd', 'dosky: príliš dlhý dielec');
  ok(n.boards.length === 1, 'dosky: zmestí sa na jednu');
  const all = n.boards[0].parts;
  ok(all.every(p => p.x >= 0 && p.y >= 0 && p.x + p.w <= 3000 + 1e-6 && p.y + p.h <= 1200 + 1e-6), 'dosky: vnútri dosky');
  let overlap = false;
  for (let i = 0; i < all.length; i++) for (let k = i + 1; k < all.length; k++) {
    const A = all[i], B = all[k];
    if (A.x < B.x + B.w + 4 - 1e-6 && B.x < A.x + A.w + 4 - 1e-6 && A.y < B.y + B.h + 4 - 1e-6 && B.y < A.y + A.h + 4 - 1e-6 &&
      !(A.x + A.w + 4 <= B.x + 1e-6 || B.x + B.w + 4 <= A.x + 1e-6 || A.y + A.h + 4 <= B.y + 1e-6 || B.y + B.h + 4 <= A.y + 1e-6)) overlap = true;
  }
  ok(!overlap, 'dosky: dielce sa neprekrývajú (vrátane rezu)');
}

{
  // U s 3 ramenami = U so zrkadlom M = S − 2W
  const a = C.compute({ typ: 'U3', R1: 2170, S: 3370, R2: 1110, W: 900 });
  const b = C.compute({ typ: 'U', R1: 2170, M: 1570, R2: 1110, W: 900 });
  ok(a.errors.length === 0 && a.N === b.N, 'U3: rovnaký počet výšok ako U');
  ok(a.edges.every((e, i) => Math.abs(e.t - b.edges[i].t) < 1e-6 && Math.abs(e.u - b.edges[i].u) < 1e-6), 'U3: rovnaké hrany ako U');
  ok(a.checks.some(c => c.id === 'klin'), 'U3: kontrola klinu');
  ok(C.compute({ typ: 'U3', S: 1700, W: 900 }).errors.length > 0, 'U3: krátke stredné rameno je chyba');
}

console.log('\n' + passes + ' OK, ' + fails + ' chýb');
process.exit(fails ? 1 : 0);
