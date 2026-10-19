/* Schodiskár – rozhranie */
(function () {
  'use strict';
  const C = window.SchodyCore, D = window.SchodyDraw, E = window.SchodyExport;
  const fmt = C.fmt;
  const $ = s => document.querySelector(s);
  const STORE = 'schodiskar.zadanie.v1';

  // ---------------------------------------------------------------- polia formulára
  const ALL = 'rovne L U U3 Lp Up tocite';
  const FIELDS = {
    fDims: [
      ['H', 'Konštrukčná výška H', 'mm', ALL, 'čistá podlaha – čistá podlaha'],
      ['podlahaDole', 'Nášľapná vrstva dole', 'mm', ALL, 'podlaha pri nástupe'],
      ['podlahaHore', 'Nášľapná vrstva hore', 'mm', ALL, 'podlaha pri výstupe'],
      ['N', 'Počet výšok N', 'ks', ALL, '0 = automaticky'],
      ['W', 'Šírka ramena W', 'mm', 'rovne L U U3 Lp Up'],
      ['L', 'Dĺžka L', 'mm', 'rovne'],
      ['A', 'Rameno A', 'mm', 'L Lp', 'vonkajší rozmer'],
      ['B', 'Rameno B', 'mm', 'L Lp', 'vonkajší rozmer'],
      ['R1', 'Rameno 1', 'mm', 'U U3 Up', 'vonkajší rozmer', false, { U3: ['Rameno 1 – nástupné', 'vonkajší rozmer'] }],
      ['S', 'Stredné rameno', 'mm', 'U3', 'vonkajší rozmer'],
      ['R2', 'Rameno 2', 'mm', 'U U3 Up', 'vonkajší rozmer', false, { U3: ['Rameno 3 – výstupné', 'vonkajší rozmer'] }],
      ['M', 'Zrkadlo', 'mm', 'U Up', 'medzera medzi ramenami'],
      ['r', 'Polomer vnútorného rohu', 'mm', 'L U U3 Lp Up', '0 = ostrý roh'],
      ['Rv', 'Vonkajší polomer R', 'mm', 'tocite'],
      ['Rs', 'Polomer stĺpa', 'mm', 'tocite'],
      ['uhol', 'Celkové otočenie', '°', 'tocite']
    ],
    fWalk: [
      ['w', 'Výstupná čiara od vnútornej hrany', 'mm', ALL, '0 = stred ramena'],
      ['nb', 'Vyrovnané stupne pred a za zákrutou', 'ks', 'L U U3']
    ],
    fCons: [
      ['presah', 'Presah stupňa', 'mm'],
      ['hrubka', 'Hrúbka stupňa', 'mm'],
      ['hrubkaPodst', 'Hrúbka podstupnice', 'mm'],
      ['sirkaSchodnice', 'Šírka schodnice', 'mm'],
      ['hrubkaSchodnice', 'Hrúbka schodnice', 'mm']
    ],
    fStrop: [
      ['strop', 'Hrúbka stropu', 'mm', 'rovne L U U3 Lp Up', 'vrátane podlahy hore'],
      ['otvor', 'Dĺžka otvoru v strope', 'mm', 'rovne L U U3 Lp Up', 'po výstupnej čiare od výstupu; 0 = len vypočítať']
    ],
    fMat: [
      ['vyskaZabradlia', 'Výška zábradlia', 'mm', ALL, 'madlo nad hranou stupňa'],
      ['doskaDlzka', 'Doska – dĺžka', 'mm', ALL, 'v smere vlákien'],
      ['doskaSirka', 'Doska – šírka', 'mm'],
      ['rez', 'Šírka rezu', 'mm']
    ],
    fLim: [
      ['lim.hMin', 'Výška stupňa min.', 'mm'],
      ['lim.hMax', 'Výška stupňa max.', 'mm'],
      ['lim.bMin', 'Šírka stupňa b min.', 'mm'],
      ['lim.kMin', '2h + b min.', 'mm'],
      ['lim.kMax', '2h + b max.', 'mm'],
      ['lim.kCiel', '2h + b cieľ (auto N)', 'mm'],
      ['lim.klinMin', 'Najužší klin min.', 'mm'],
      ['lim.klinVzd', 'Klin meraný od vnútornej hrany', 'mm'],
      ['lim.podchod', 'Podchodná výška (točité)', 'mm']
    ],
    fProj: [
      ['vypracoval', 'Vypracoval', '', ALL, null, true]
    ]
  };

  const TYPE_ICONS = {
    rovne: '<path d="M6 8h28v24H6z"/><path d="M11 8v24M16 8v24M21 8v24M26 8v24M31 8v24" class="t"/>',
    L: '<path d="M4 34V22h18V4h14v30z"/><path d="M8 22v12M12 22v12M17 22l-2 12M22 22l14-4M22 22l14 4M22 22l6 12M22 22l10 10M22 18h14M22 13h14M22 8h14" class="t"/>',
    U3: '<path d="M4 34V6h32v20h-9V15H13v19z"/><path d="M4 30h9M4 26h9M4 22h9M13 15L4 11M13 15l-5-9M13 15l3-9M18 6v9M23 6v9M27 15l-3-9M27 15l5-9M27 15l9-4M27 19h9M27 23h9" class="t"/>',
    U: '<path d="M4 4h32v32H4V24h18v-8H4z"/><path d="M9 4v12M14 4v12M19 4l2 12M22 16l14-10M22 20h14M22 24l14 10M19 36l2-12M14 36V24M9 36V24" class="t"/>',
    Lp: '<path d="M4 34V22h18V4h14v30z"/><path d="M22 20h14v14H22z" class="f"/><path d="M8 22v12M12 22v12M16 22v12M22 15h14M22 10h14" class="t"/>',
    Up: '<path d="M4 4h32v32H4V24h18v-8H4z"/><path d="M22 4h14v32H22z" class="f"/><path d="M8 4v12M12 4v12M16 4v12M8 24v12M12 24v12M16 24v12" class="t"/>',
    tocite: '<circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="3" class="f"/><path d="M20 4v13M31.3 8.7l-9.2 9.2M36 20H23M31.3 31.3l-9.2-9.2M20 36V23M8.7 31.3l9.2-9.2M4 20h13" class="t"/>'
  };
  const TYPE_SHORT = { rovne: 'Rovné', L: 'L klinové', U: 'U klinové', U3: 'U 3 ramená', Lp: 'L podesta', Up: 'U podesta', tocite: 'Točité' };

  // ---------------------------------------------------------------- stav
  let input = loadStored() || C.normalize({});
  let startView = null;
  (function urlParams() {
    // voliteľné parametre v adrese, napr. ?typ=U&smer=vpravo&H=3000&priestor=loft&pohlad=nastup
    let q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    if (![...q.keys()].length) return;
    const raw = JSON.parse(JSON.stringify(input));
    const vizKeys = ['priestor', 'stupne', 'podstupnice', 'schodnice', 'zabradlie'];
    for (const [k, val] of q) {
      if (k === 'pohlad') startView = val;
      else if (vizKeys.indexOf(k) >= 0) { raw.viz = raw.viz || {}; raw.viz[k] = val; }
      else if (k === 'poschodie') { raw.viz = raw.viz || {}; raw.viz.poschodie = val !== '0'; }
      else if (k in raw) raw[k] = val;
    }
    input = C.normalize(raw);
  })();
  let res = null;
  const TABS = ['plan', '3d', 'unfold', 'parts', 'boc', 'bom', 'checks'];
  let tab = TABS.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : 'plan';
  let viewBoxState = {};

  function loadStored() {
    try { const s = localStorage.getItem(STORE); if (s) return C.normalize(JSON.parse(s)); } catch (e) { /* bez úložiska */ }
    return null;
  }
  let saveT = null;
  function store() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(input)); } catch (e) { /* ignorovať */ } }, 250);
  }

  const SPIN = '<span class="spin" aria-hidden="true"><button type="button" tabindex="-1" data-d="1">▲</button><button type="button" tabindex="-1" data-d="-1">▼</button></span>';
  const getK = k => k.indexOf('lim.') === 0 ? input.lim[k.slice(4)] : input[k];
  const setK = (k, v) => { if (k.indexOf('lim.') === 0) input.lim[k.slice(4)] = v; else input[k] = v; };

  // ---------------------------------------------------------------- formulár
  function buildForm() {
    const types = $('#types');
    types.innerHTML = Object.keys(C.TYPY).map(t =>
      '<button role="radio" data-typ="' + t + '" title="' + C.TYPY[t] + '"><svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' +
      TYPE_ICONS[t].replace(/class="t"/g, 'stroke-width="1" opacity=".75"').replace(/class="f"/g, 'fill="currentColor" fill-opacity=".18" stroke="none"') +
      '</g></svg>' + TYPE_SHORT[t] + '</button>').join('');
    types.addEventListener('click', e => {
      const b = e.target.closest('button[data-typ]');
      if (!b) return;
      input.typ = b.dataset.typ; changed(true);
    });
    $('#dirRow').addEventListener('click', e => {
      const b = e.target.closest('button[data-smer]');
      if (!b) return;
      input.smer = b.dataset.smer; changed(true);
    });
    for (const [box, list] of Object.entries(FIELDS)) {
      const el = document.getElementById(box);
      el.innerHTML = list.map(([k, label, unit, types, hint, wide, alt]) =>
        '<div class="fld' + (wide ? ' wide' : '') + '" data-types="' + (types || ALL) + '"' + (alt ? ' data-alt="' + JSON.stringify(Object.assign({ '*': [label, hint] }, alt)).replace(/"/g, '&quot;') + '"' : '') + '>' +
        '<label for="in-' + k + '">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</label>' +
        '<div class="inp' + (wide ? '' : ' sp') + '"><input id="in-' + k + '" data-key="' + k + '" ' + (wide ? '' : 'inputmode="decimal" data-min="0" data-step="' + (['N', 'nb'].includes(k) ? 1 : 10) + '" ') + 'autocomplete="off" spellcheck="false">' +
        (unit ? '<span class="u">' + unit + '</span>' : '') + (wide ? '' : SPIN) + '</div></div>').join('');
    }
    document.querySelectorAll('input[data-key]').forEach(bindInput);
  }

  function bindInput(inp) {
    inp.addEventListener('input', () => onField(inp));
    inp.addEventListener('change', () => onField(inp, true));
    inp.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const k = inp.dataset.key;
      if (typeof getK(k) !== 'number') return;
      e.preventDefault();
      const step = (+inp.dataset.step || (['N', 'nb'].includes(k) ? 1 : 10)) * (e.shiftKey ? 10 : 1);
      const v = (parseNum(inp.value) || 0) + (e.key === 'ArrowUp' ? step : -step);
      inp.value = String(Math.max(0, Math.round(v * 100) / 100)).replace('.', ',');
      onField(inp, true);
    });
  }

  function parseNum(s) {
    const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function onField(inp, commit) {
    const k = inp.dataset.key;
    if (typeof getK(k) === 'number') {
      const n = parseNum(inp.value);
      inp.classList.toggle('bad', n === null);
      if (n === null) return;
      setK(k, n);
    } else setK(k, inp.value);
    changed(false);
    if (commit) { syncForm(true); commitHist(); }
  }

  function syncForm(onlyBlurred) {
    document.querySelectorAll('input[data-key]').forEach(inp => {
      if (onlyBlurred && inp === document.activeElement) return;
      const v = getK(inp.dataset.key);
      inp.value = typeof v === 'number' ? String(v).replace('.', ',') : (v || '');
      inp.classList.remove('bad');
    });
    document.querySelectorAll('select[data-key]').forEach(s => { s.value = getK(s.dataset.key); });
    document.querySelectorAll('#types button').forEach(b => { const on = b.dataset.typ === input.typ; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    document.querySelectorAll('#dirRow button').forEach(b => { const on = b.dataset.smer === input.smer; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $('#dirRow').hidden = input.typ === 'rovne';
    $('#dirRow').querySelector('span').textContent = input.typ === 'tocite' ? 'Smer otáčania' : 'Zákruta';
    document.querySelectorAll('.fld').forEach(f => { f.hidden = f.dataset.types.split(' ').indexOf(input.typ) < 0; });
    document.querySelectorAll('.fld[data-alt]').forEach(f => {
      const alt = JSON.parse(f.dataset.alt), l = alt[input.typ] || alt['*'];
      f.querySelector('label').innerHTML = l[0] + (l[1] ? '<small>' + l[1] + '</small>' : '');
    });
    document.querySelectorAll('.grp[data-auto]').forEach(g => { g.hidden = !g.querySelector('.fld:not([hidden])'); });
  }

  let renderT = null;
  function changed(full) {
    if (full) commitHist();
    store();
    if (full) syncForm();
    else syncForm(true);
    clearTimeout(renderT);
    renderT = setTimeout(recompute, full ? 0 : 60);
  }

  // ---------------------------------------------------------------- výpočet a súhrn
  function recompute() {
    try { res = C.compute(input); }
    catch (e) { res = { input, errors: ['Neočakávaná chyba výpočtu: ' + e.message], warnings: [], checks: [], stav: 'chyba' }; console.error(e); }
    renderSummary();
    renderUpInfo();
    renderView();
  }

  function kpi(k, v, bad) { return '<div class="kpi' + (bad ? ' bad' : '') + '"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
  function chk(id) { const c = res.checks.find(x => x.id === id); return c && !c.ok; }

  function renderSummary() {
    const s = $('#summary');
    let h = '';
    if (res.N) {
      h += kpi('Výšky N × h', res.N + ' × ' + fmt(res.h, 1) + ' <small>mm' + (res.autoN ? ', auto' : '') + '</small>', chk('h'));
      h += kpi('Stupne', (res.N - 1) + (res.podesta ? ' <small>vr. podesty</small>' : ''));
      const bs = res.upravy && res.upravy.ds && res.treads ? res.treads.filter(t => t.kind === 'stupen').map(t => t.sirky.vystup) : [];
      h += kpi('Šírka b', (bs.length ? fmt(Math.min.apply(null, bs), 1) + '–' + fmt(Math.max.apply(null, bs), 1) : fmt(res.b, 1)) + ' <small>mm</small>', chk('b') || chk('brov'));
      h += kpi('2h + b', fmt(res.krok, 1) + ' <small>mm</small>', chk('k'));
      h += kpi('Sklon', fmt(res.sklon, 1) + '°');
      if (res.najuzsiKlin) h += kpi('Najužší klin', fmt(res.najuzsiKlin.hodnota, 1) + ' <small>mm, st. ' + res.najuzsiKlin.stupen + '</small>', chk('klin'));
      if (res.podchod != null) h += kpi('Podchod', fmt(res.podchod) + ' <small>mm</small>', chk('podchod'));
      if (res.strop) h += input.otvor > 0
        ? kpi('Podchod pod stropom', fmt(res.strop.svetla) + ' <small>mm</small>', chk('podchodStrop'))
        : kpi('Otvor v strope', (isFinite(res.strop.otvorMin) ? '≥ ' + fmt(Math.ceil(res.strop.otvorMin)) : '—') + ' <small>mm</small>');
      if (res.podlaha && (res.podlaha.dole || res.podlaha.hore)) h += kpi('Hrubá výška', fmt(res.podlaha.hruba) + ' <small>mm</small>');
    } else h += kpi('Výpočet', '—');
    const st = { ok: 'OK', pozor: 'POZOR', chyba: 'CHYBA' }[res.stav];
    h += '<div class="status ' + res.stav + '">' + st + '</div>';
    s.innerHTML = h;
    const m = $('#msgs');
    // chyby: odkaz na pole v zadaní a overené automatické opravy
    let diag = [];
    try { diag = res.errors.length && res.input ? C.navrhOprav(input, res) : res.errors.map(text => ({ text, pole: [], navrhy: [] })); }
    catch (e) { console.error(e); diag = res.errors.map(text => ({ text, pole: [], navrhy: [] })); }
    const pole = diag.filter(d => d.pole.length && fldOf(d.pole[0]));
    m.innerHTML = diag.map((d, i) => '<div class="msg err"><span>' + esc(d.text) + '</span>' +
        (d.pole.length && fldOf(d.pole[0]) ? '<button class="msgBtn" data-ukaz="' + i + '">Ukázať pole</button>' : '') +
        d.navrhy.map((n, j) => '<button class="msgBtn fix" data-fix="' + i + ':' + j + '" title="Po zmene ' + (n.zostane ? 'ostane ' + n.zostane + ' iná chyba' : 'nebude žiadna chyba') + '">Opraviť: ' + esc(n.popis) + '</button>').join('') +
        '</div>').join('') +
      res.warnings.map(e => '<div class="msg warn">' + esc(e) + '</div>').join('');
    document.querySelectorAll('.fld.errFld').forEach(f => f.classList.remove('errFld'));
    for (const d of pole) for (const k of d.pole) { const f = fldOf(k); if (f) f.classList.add('errFld'); }
    m.querySelectorAll('[data-ukaz]').forEach(b => b.addEventListener('click', () => ukazPole(diag[+b.dataset.ukaz].pole[0])));
    m.querySelectorAll('[data-fix]').forEach(b => b.addEventListener('click', () => {
      const [i, j] = b.dataset.fix.split(':').map(Number), z = diag[i].navrhy[j].zmena;
      for (const k of Object.keys(z)) { if (z[k] === null) delete input[k]; else setK(k, z[k]); }
      changed(true);
      toast('Opravené: ' + diag[i].navrhy[j].popis);
    }));
  }
  // pole zadania v bočnom paneli podľa kľúča
  function fldOf(k) { const inp = document.querySelector('#in-' + k); return inp ? inp.closest('.fld') : null; }
  function ukazPole(k) {
    const f = fldOf(k);
    if (!f) return;
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    f.classList.remove('blink'); void f.offsetWidth; f.classList.add('blink');
    const inp = f.querySelector('input, select');
    if (inp) setTimeout(() => { inp.focus(); if (inp.select) inp.select(); }, 350);
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------------------------------------------------------------- pohľady
  function renderView() {
    document.querySelectorAll('.tabs button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const v = $('#view');
    hideTip();
    if (tab !== '3d' && viewer) viewer.stop();
    if (tab === 'plan') return viewDrawing(v, D.plan(res), 'plan', true);
    if (tab === '3d') return view3d(v);
    if (tab === 'unfold') return viewUnfold(v);
    if (tab === 'parts') return viewParts(v);
    if (tab === 'bom') return viewBom(v);
    if (tab === 'boc') return viewBoc(v);
    if (tab === 'checks') return viewChecks(v);
  }

  function noData(v) { v.innerHTML = '<div class="empty">Pre zadané hodnoty nie je výsledok. Opravte chyby uvedené vyššie.</div>'; }

  function viewDrawing(v, dr, key, legend) {
    if (!dr.bbox) return noData(v);
    const plan = key === 'plan';
    if (plan && sel && !edDrag && !(res.N && sel <= res.N - 1)) sel = null;
    const editing = plan && sel && res.edges && sel <= res.N - 1;
    let svgStr = D.toSVG(dr.items, dr.bbox);
    if (editing) svgStr = svgStr.replace('</svg>', handlesSVG(dr.ts) + '</svg>');
    v.innerHTML = '<div class="canvas' + (edDrag ? ' edit' : '') + '" id="cv">' + svgStr + '</div>' +
      (legend ? '<div class="legend"><span><i style="border-color:#c2410c;border-top-style:dashed"></i>výstupná čiara</span><span><i style="border-color:#1d2733"></i>výstupná hrana (s presahom)</span><span><i style="border-color:#64748b;border-top-style:dashed"></i>podstupnica</span><span><i style="border-color:#2f7d4f"></i>kóty pri stene</span>' +
        (res.upravy && res.upravy.pocet ? '<span><i style="border-color:#2563eb"></i>upravená hrana</span>' : '') +
        (res.geom && res.geom.ramena ? '<span><i style="border-color:#dc2626;border-top-style:dashed"></i>hranica ramena</span>' : '') +
        (res.strop ? '<span><i style="border-color:#7c3aed;border-top-style:dashed"></i>' + (input.otvor > 0 ? 'hrana stropu' : 'min. otvor v strope') + '</span>' : '') + '</div>' : '') +
      '<div class="zoomhint">' + (plan ? 'klik na stupeň = úprava · ' : '') + 'koliesko = zoom · ťahanie = posun · dvojklik = celé</div>' +
      (editing ? editPanel() : '');
    const cv = $('#cv'), svg = cv.querySelector('svg');
    enableZoom(cv, svg, key);
    if (plan) {
      svg.addEventListener('mousemove', e => {
        if (edDrag) return;
        const p = e.target.closest && e.target.closest('.hov');
        if (p) showTip(+p.dataset.n, e.clientX, e.clientY); else hideTip();
      });
      svg.addEventListener('mouseleave', hideTip);
      // klik (bez posunu výkresu) na stupeň = výber na úpravu
      // stupeň sa určí pri stlačení: posun výkresu zachytáva ukazovateľ, takže click by mieril na plátno
      let down = null;
      svg.addEventListener('pointerdown', e => {
        const p = e.button === 0 && e.target.closest && e.target.closest('.hov');
        down = p ? { x: e.clientX, y: e.clientY, n: +p.dataset.n } : null;
      });
      cv.addEventListener('pointerup', e => {
        const d = down;
        down = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
        sel = d.n; hideTip(); renderView();
      });
      svg.querySelectorAll('.hov').forEach(p => p.classList.toggle('hl', +p.dataset.n === sel));
      svg.querySelectorAll('.hd').forEach(c => c.addEventListener('pointerdown', startEdgeDrag));
      if (editing) bindEditPanel(v.querySelector('.edp'));
    }
  }

  // ---------------------------------------------------------------- ručná úprava stupňov
  let sel = null, edDrag = null, edFocus = null;
  const innerFixed = () => input.typ === 'tocite' && input.Rs <= 0; // vnútorná hrana je bod
  const edgeFixedS = i => i === 0 || i === res.N - 1;

  function editsFor() {
    const up = input.upravy;
    return up && up.N === res.N && up.typ === input.typ ? up.hrany : {};
  }
  function setEdit(i, k, val) {
    val = Math.round(val);
    const up = input.upravy && input.upravy.N === res.N && input.upravy.typ === input.typ ? input.upravy : { N: res.N, typ: input.typ, hrany: {} };
    const e = Object.assign({ ds: 0, dt: 0 }, up.hrany[i]);
    if (e[k] === val) return;
    e[k] = val;
    if (!e.ds && !e.dt) delete up.hrany[i]; else up.hrany[i] = e;
    if (Object.keys(up.hrany).length) input.upravy = up; else delete input.upravy;
    store();
    if (!edDrag) { commitHist(); return recompute(); }
    if (!edDrag.raf) edDrag.raf = requestAnimationFrame(() => { if (edDrag) edDrag.raf = 0; recompute(); });
  }
  function clearEdits(idx) {
    if (!input.upravy) return;
    if (idx) { for (const i of idx) delete input.upravy.hrany[i]; if (!Object.keys(input.upravy.hrany).length) delete input.upravy; }
    else delete input.upravy;
    store(); commitHist(); recompute();
  }

  function handlesSVG(ts) {
    const r = 1.7 * ts;
    let h = '';
    for (const i of [sel - 1, sel]) {
      const e = res.edges[i];
      if (!e) continue;
      const on = k => edDrag && edDrag.i === i && edDrag.k === k ? ' on' : '';
      if (!innerFixed()) h += '<circle class="hd' + on('dt') + '" data-e="' + i + '" data-k="dt" cx="' + e.P.x + '" cy="' + (-e.P.y) + '" r="' + r + '"><title>Ťahaním posuniete hranu ' + (i + 1) + ' pri vnútornej hrane</title></circle>';
      if (!edgeFixedS(i)) h += '<circle class="hd s' + on('ds') + '" data-e="' + i + '" data-k="ds" cx="' + e.W.x + '" cy="' + (-e.W.y) + '" r="' + r + '"><title>Ťahaním posuniete hranu ' + (i + 1) + ' po výstupnej čiare</title></circle>';
    }
    return h;
  }

  // parameter najbližšieho bodu lomenej čiary (vzorky {x, y, s}), len v okolí s0
  function projectS(samples, pt, s0, win) {
    let best = null;
    for (let k = 0; k < samples.length - 1; k++) {
      const a = samples[k], b = samples[k + 1];
      if (Math.max(a.s, b.s) < s0 - win || Math.min(a.s, b.s) > s0 + win) continue;
      const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
      const f = L2 > 1e-9 ? Math.min(1, Math.max(0, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / L2)) : 0;
      const d = Math.hypot(a.x + dx * f - pt.x, a.y + dy * f - pt.y);
      if (!best || d < best.d - 1e-9) best = { d, s: a.s + (b.s - a.s) * f };
    }
    return best ? best.s : s0;
  }

  function startEdgeDrag(ev) {
    ev.stopPropagation(); ev.preventDefault();
    const i = +ev.target.dataset.e, k = ev.target.dataset.k, e = res.edges[i];
    // základ = poloha bez vlastnej úpravy; posun = premietnutý parameter − základ
    edDrag = { i, k, base: k === 'ds' ? e.s - e.ds : e.t - e.dt, s0: k === 'ds' ? e.s : e.t, raf: 0 };
    hideTip();
    $('#cv').classList.add('edit');
    const move = m => {
      const svg = $('#cv svg');
      if (!svg || !edDrag) return;
      const pt = svg.createSVGPoint(); pt.x = m.clientX; pt.y = m.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      const G = res.geom || {};
      const smp = edDrag.k === 'ds' ? G.walkS : G.innerS;
      if (!smp) return;
      setEdit(edDrag.i, edDrag.k, projectS(smp, { x: q.x, y: -q.y }, edDrag.s0, 1500) - edDrag.base);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (edDrag && edDrag.raf) cancelAnimationFrame(edDrag.raf);
      edDrag = null;
      commitHist();
      recompute();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function editPanel() {
    const N = res.N, E = editsFor();
    const tr = res.treads && res.treads[sel - 1];
    const field = (i, k, label, dot) => {
      const dis = k === 'ds' ? edgeFixedS(i) : innerFixed();
      return '<div class="row"><label for="ed-' + i + k + '"><i style="background:' + dot + '"></i>' + label + '</label><div class="inp sp"><input id="ed-' + i + k + '" data-e="' + i + '" data-k="' + k + '" data-step="1" inputmode="decimal" autocomplete="off" value="' + (dis ? '—' : fmt((E[i] && E[i][k]) || 0)) + '"' +
        (dis ? ' disabled title="' + (k === 'ds' ? 'Prvá a posledná hrana sú pevné (podlahy).' : 'Vnútorná hrana je bod.') + '"' : '') + '><span class="u">mm</span>' + (dis ? '' : SPIN) + '</div></div>';
    };
    const edge = (i, title) => {
      const has = E[i] && (E[i].ds || E[i].dt);
      return '<h5>' + title + ' · hrana ' + (i + 1) + (has ? '<span class="upr">upravená</span>' : '') + '</h5>' +
        field(i, 'ds', 'Posun po výstupnej čiare', '#c2410c') + field(i, 'dt', 'Posun pri vnútornej hrane', '#2563eb');
    };
    const kind = tr && tr.kind === 'podesta' ? 'Podesta ' : 'Stupeň ';
    const nUp = Object.keys(E).length;
    return '<div class="edp" role="dialog" aria-label="Úprava stupňa">' +
      '<header><button data-act="prev" title="Predošlý stupeň"' + (sel <= 1 ? ' disabled' : '') + '>‹</button><b>' + kind + sel + '</b><button data-act="next" title="Ďalší stupeň"' + (sel >= N - 1 ? ' disabled' : '') + '>›</button><button data-act="close" title="Zavrieť (Esc)">×</button></header>' +
      edge(sel - 1, 'Nástupná hrana') + edge(sel, 'Zadná hrana') +
      (tr ? '<p class="w">Šírka vnútri / výst. čiara / vonku: <b>' + fmt(tr.sirky.vnutri) + ' / ' + fmt(tr.sirky.vystup) + ' / ' + fmt(tr.sirky.vonku) + '</b> mm' +
        (tr.sirky.kontrola != null ? '<br>Šírka ' + input.lim.klinVzd + ' mm od vnútra: <b>' + fmt(tr.sirky.kontrola, 1) + '</b> mm' : '') + '</p>' : '') +
      '<p class="hint">Body na výkrese možno ťahať myšou. Kladný posun = smerom hore po schodoch. Šípky ↑↓ = ±1 mm (Shift ±10).</p>' +
      '<footer><button data-act="reset">Zrušiť úpravy stupňa</button>' + (nUp ? '<button data-act="resetAll">Zrušiť všetky (' + nUp + ')</button>' : '') + '</footer></div>';
  }

  function bindEditPanel(p) {
    p.addEventListener('pointerdown', e => e.stopPropagation());
    p.addEventListener('wheel', e => e.stopPropagation());
    p.addEventListener('dblclick', e => e.stopPropagation());
    p.addEventListener('click', e => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'prev' && sel > 1) sel--;
      else if (a === 'next' && sel < res.N - 1) sel++;
      else if (a === 'close') sel = null;
      else if (a === 'reset') return clearEdits([sel - 1, sel]);
      else if (a === 'resetAll') return clearEdits();
      renderView();
    });
    p.querySelectorAll('input[data-k]').forEach(inp => {
      const commit = () => {
        const n = parseNum(inp.value);
        inp.classList.toggle('bad', n === null);
        if (n !== null) setEdit(+inp.dataset.e, inp.dataset.k, n);
      };
      inp.addEventListener('change', commit);
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { edFocus = inp.id; commit(); return; }
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const st = e.shiftKey ? 10 : 1;
        inp.value = String((parseNum(inp.value) || 0) + (e.key === 'ArrowUp' ? st : -st));
        edFocus = inp.id; commit();
      });
    });
    if (edFocus) { const f = document.getElementById(edFocus); edFocus = null; if (f) { f.focus(); f.select(); } }
  }

  function renderUpInfo() {
    const el = $('#upInfo');
    const n = res.upravy ? res.upravy.pocet : 0;
    const stale = !!input.upravy && !n;
    el.hidden = !n && !stale;
    if (el.hidden) return;
    el.innerHTML = '<span>' + (n ? 'Ručne upravené hrany: <b>' + n + '</b>' : 'Ručné úpravy sa nepoužili') + '</span><button type="button">Zrušiť</button>';
    el.querySelector('button').onclick = () => clearEdits();
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sel && tab === 'plan' && !edDrag) { sel = null; renderView(); }
  });

  function enableZoom(cv, svg, key) {
    const vb0 = svg.getAttribute('viewBox').split(' ').map(Number);
    const sig = key + ':' + vb0.map(x => Math.round(x)).join(',');
    let vb = (viewBoxState[key] && viewBoxState[key].sig === sig) ? viewBoxState[key].vb.slice() : vb0.slice();
    const apply = () => { svg.setAttribute('viewBox', vb.join(' ')); viewBoxState[key] = { sig, vb: vb.slice() }; };
    apply();
    const toModel = (cx, cy) => {
      const r = svg.getBoundingClientRect();
      const s = Math.max(vb[2] / r.width, vb[3] / r.height);
      const ox = vb[0] + (vb[2] - r.width * s) / 2, oy = vb[1] + (vb[3] - r.height * s) / 2;
      return { x: ox + (cx - r.left) * s, y: oy + (cy - r.top) * s, s };
    };
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const k = Math.exp((e.deltaY > 0 ? 1 : -1) * 0.15);
      const m = toModel(e.clientX, e.clientY);
      const nw = Math.min(vb0[2] * 4, Math.max(vb0[2] / 30, vb[2] * k));
      const kk = nw / vb[2];
      vb = [m.x - (m.x - vb[0]) * kk, m.y - (m.y - vb[1]) * kk, vb[2] * kk, vb[3] * kk];
      apply();
    }, { passive: false });
    let drag = null;
    cv.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, vb: vb.slice(), s: toModel(e.clientX, e.clientY).s };
      cv.setPointerCapture(e.pointerId);
      cv.classList.add('drag');
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      vb = [drag.vb[0] - (e.clientX - drag.x) * drag.s, drag.vb[1] - (e.clientY - drag.y) * drag.s, drag.vb[2], drag.vb[3]];
      apply();
    });
    const end = () => { drag = null; cv.classList.remove('drag'); };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => { vb = vb0.slice(); apply(); });
  }

  function showTip(n, x, y) {
    const t = res.treads && res.treads[n - 1];
    if (!t) return hideTip();
    document.querySelectorAll('.hov.hl').forEach(p => p.classList.remove('hl'));
    const tip = $('#tip');
    const rows = [
      ['Šírka vnútri', fmt(t.sirky.vnutri, 1)],
      ['Šírka na výstupnej čiare', fmt(t.sirky.vystup, 1)],
      ['Šírka vonku', fmt(t.sirky.vonku, 1)]
    ];
    if (t.sirky.kontrola != null) rows.push(['Šírka ' + input.lim.klinVzd + ' mm od vnútra', fmt(t.sirky.kontrola, 1)]);
    rows.push(['Prírez', fmt(t.prirez.dlzka) + ' × ' + fmt(t.prirez.sirka) + ' × ' + fmt(input.hrubka)]);
    rows.push(['Plocha s presahom', fmt(t.plochaSPresahom / 1e6, 3) + ' m²']);
    tip.innerHTML = '<h4>' + (t.kind === 'podesta' ? 'Podesta ' : 'Stupeň ') + t.n + ' <span class="sub">· výška +' + fmt(t.vyska) + ' mm</span></h4><table>' +
      rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let X = x + 16, Y = y + 16;
    if (X + w > window.innerWidth - 8) X = x - w - 16;
    if (Y + h > window.innerHeight - 8) Y = y - h - 16;
    tip.style.left = X + 'px'; tip.style.top = Y + 'px';
  }
  function hideTip() { const t = $('#tip'); if (t) t.hidden = true; }

  // ---------------------------------------------------------------- 3D
  let viewer = null, viewerRes = null, viewerKey = '', viewerTyp = '', ro = null;
  function view3d(v) {
    const VZ = window.SchodyViz;
    if (!VZ || !VZ.available || !VZ.webglOK()) { v.innerHTML = '<div class="empty">3D zobrazenie nie je v tomto prehliadači dostupné (chýba WebGL).</div>'; return; }
    if (!res.treads || !res.treads.length) return noData(v);
    const S = VZ.settings(input.viz);
    const nm = k => k === 'ziadne' ? 'bez podstupníc' : VZ.MAT[k].n;
    const sel = (key, label, list, name) =>
      '<label class="row3d"><span>' + label + '</span><span class="selw' + (name ? ' plain' : '') + '">' + (name ? '' : '<i class="sw" style="background:' + VZ.swatch(S[key]) + '"></i>') +
      '<select data-viz="' + key + '">' + list.map(k => '<option value="' + k + '"' + (k === S[key] ? ' selected' : '') + '>' + (name ? name(k) : nm(k)) + '</option>').join('') + '</select></span></label>';
    v.innerHTML = '<div class="v3d"><div class="host" id="host3d"></div>' +
      '<details class="panel3d" open><summary>Priestor a materiály</summary>' +
      sel('priestor', 'Priestor', Object.keys(VZ.PRIESTORY), k => VZ.PRIESTORY[k].n) +
      sel('stupne', 'Stupne', VZ.STUPNE) +
      sel('podstupnice', 'Podstupnice', VZ.PODSTUPNICE) +
      sel('schodnice', input.typ === 'tocite' ? 'Schodnica a stĺp' : 'Schodnice', VZ.SCHODNICE) +
      sel('zabradlie', 'Zábradlie', Object.keys(VZ.ZABRADLIE), k => VZ.ZABRADLIE[k]) +
      '<label class="chk3d"><input type="checkbox" data-viz="poschodie"' + (S.poschodie ? ' checked' : '') + '> Horné podlažie so stropom</label>' +
      '</details>' +
      '<div class="views3d">' + Object.keys(VZ.VIEWS).map(k => '<button data-view="' + k + '">' + VZ.VIEWS[k] + '</button>').join('') +
      '<button data-walk class="walk">▶ Prechádzka</button><button data-shot>Uložiť obrázok</button></div>' +
      '<div class="zoomhint">ľavé tlačidlo = otáčanie · pravé = posun · koliesko = zoom</div></div>';
    if (!viewer) { const cv = document.createElement('canvas'); cv.className = 'c3d'; viewer = VZ.Viewer(cv); }
    const host = $('#host3d');
    host.appendChild(viewer.canvas);
    if (ro) ro.disconnect();
    ro = new ResizeObserver(() => viewer.resize(host.clientWidth, host.clientHeight));
    ro.observe(host);
    viewer.resize(host.clientWidth, host.clientHeight);
    const key = JSON.stringify(S);
    if (res !== viewerRes || key !== viewerKey) {
      viewer.update(res, S);
      if (viewerTyp !== input.typ + input.smer || !viewerRes) viewer.setView(startView && VZ.VIEWS[startView] ? startView : 'celok');
      viewerRes = res; viewerKey = key; viewerTyp = input.typ + input.smer;
    }
    viewer.start();
    v.querySelector('.panel3d').addEventListener('change', e => {
      const el = e.target.closest('[data-viz]');
      if (!el) return;
      input.viz = Object.assign({}, S, input.viz || {}, { [el.dataset.viz]: el.type === 'checkbox' ? el.checked : el.value });
      store(); commitHist();
      const sw = el.parentNode.querySelector('.sw');
      if (sw) sw.style.background = VZ.swatch(el.value);
      const S2 = VZ.settings(input.viz);
      viewer.update(res, S2);
      viewerKey = JSON.stringify(S2);
    });
    const walkBtn = v.querySelector('[data-walk]');
    v.querySelector('.views3d').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.view) { viewer.setView(b.dataset.view); walkBtn.textContent = '▶ Prechádzka'; }
      else if (b.hasAttribute('data-walk')) {
        if (viewer.walking) { viewer.stopWalk(); walkBtn.textContent = '▶ Prechádzka'; }
        else { viewer.startWalk(() => { walkBtn.textContent = '▶ Prechádzka'; }); walkBtn.textContent = '■ Zastaviť'; }
      } else if (b.hasAttribute('data-shot')) {
        const url = viewer.snapshot(null, 1920, 1080, 'image/png');
        const a = document.createElement('a'); a.href = url; a.download = slug() + '-3d.png';
        document.body.appendChild(a); a.click(); a.remove();
      }
    });
  }

  function viewUnfold(v) {
    if (!res.unfold) return noData(v);
    // usporiadanie (pod sebou / vedľa seba) podľa tvaru okna
    const U0 = res.unfold;
    const ts = Math.max(U0.vnutorna.dlzka, U0.vonkajsia.dlzka, input.H) / 120;
    const W = Math.max(300, v.clientWidth), Hh = Math.max(240, window.innerHeight * 0.62 - 34);
    const fit = d => Math.min(W / d.bbox.w, Hh / d.bbox.h);
    const dv = D.unfold(res, { layout: 'v', ts }), dh = D.unfold(res, { layout: 'h', ts });
    const dr = fit(dh) > fit(dv) ? dh : dv;
    const U = res.unfold;
    let tb = '<table class="tb"><thead><tr><th class="n">Hrana</th><th class="n">Výška [mm]</th><th class="n">Vnútorná schodnica od nástupu [mm]</th><th class="n">Vonkajšia schodnica od nástupu [mm]</th><th class="n">Rozostup vnútri</th><th class="n">Rozostup vonku</th></tr></thead><tbody>';
    res.edges.forEach((e, i) => {
      const a = U.vnutorna.pos, b = U.vonkajsia.pos;
      tb += '<tr><td class="n">' + (i + 1) + '</td><td class="n">' + fmt((i + 1) * res.h, 1) + '</td><td class="n">' + fmt(a[i] - a[0], 1) + '</td><td class="n">' + fmt(b[i] - b[0], 1) + '</td><td class="n">' + (i ? fmt(a[i] - a[i - 1], 1) : '') + '</td><td class="n">' + (i ? fmt(b[i] - b[i - 1], 1) : '') + '</td></tr>';
    });
    tb += '</tbody></table>';
    const corners = k => U[k].rohy.map(r => r.typ + ' ' + fmt(r.s, 1)).join(', ') || '—';
    v.innerHTML = '<div style="position:relative;height:62vh;border-bottom:1px solid var(--line)"><div class="canvas" id="cv">' + D.toSVG(dr.items, dr.bbox) + '</div><div class="zoomhint">koliesko = zoom · ťahanie = posun · dvojklik = celé</div></div>' +
      '<div class="pane"><h3>Polohy výstupných hrán na schodniciach (na rysovanie)</h3>' +
      '<p class="note">Merané po hrane od nástupu (hrana 1 = prvá podstupnica). Rohy – vnútorná: ' + corners('vnutorna') + ' mm; vonkajšia: ' + corners('vonkajsia') + ' mm. ' +
      'Orientačný tvar schodnice: šírka ' + fmt(input.sirkaSchodnice) + ' mm, horná hrana 50 mm nad hranami stupňov.</p>' + tb + '</div>';
    enableZoom($('#cv'), $('#cv svg'), 'unfold');
  }

  function viewParts(v) {
    const capFields = [['hrubka', 'Hrúbka stupňa', 'mm', 1]].concat(BOC_FIELDS.filter(f => ['spoj', 'capHrubka', 'drazkaHlbka', 'capOdsadenie', 'capOdsadenieZad'].indexOf(f[0]) >= 0));
    const list = sideForm(v, 'cap', 'Čapy stupňov', capFields, 'Čap = výstupok stupňa do drážky bočnice. Dĺžka po hrane stupňa = hrana − odsadenie vpredu a vzadu, hĺbka = hĺbka drážky, hrúbka centrovaná – frézuje sa (hrúbka stupňa − hrúbka čapu) / 2 z každej strany. Rovnaké hodnoty sú aj v záložke Bočnice.');
    if (!res.treads || !res.treads.length) { list.innerHTML = '<div class="empty">Pre zadané hodnoty nie je výsledok. Opravte chyby uvedené vyššie.</div>'; return; }
    let h = '<div class="parts">';
    for (const t of res.treads) {
      const ts = Math.max(t.prirez.dlzka, t.prirez.sirka * 2.4) / 95;
      const p = D.part(res, t, ts);
      const bb = D.itemsBBox(p.items);
      h += '<div class="part"><header><b>' + (t.kind === 'podesta' ? 'Podesta ' : 'Stupeň ') + t.n + '</b><span>' + fmt(t.prirez.dlzka) + ' × ' + fmt(t.prirez.sirka) + ' × ' + fmt(input.hrubka) + '</span></header>' +
        D.toSVG(p.items, bb, { pad: ts * 2 }) +
        '<dl><dt>Šírka vnútri / výst. / vonku</dt><dd>' + fmt(t.sirky.vnutri) + ' / ' + fmt(t.sirky.vystup) + ' / ' + fmt(t.sirky.vonku) + '</dd>' +
        (t.sirky.kontrola != null ? '<dt>Šírka ' + input.lim.klinVzd + ' mm od vnútra</dt><dd>' + fmt(t.sirky.kontrola, 1) + '</dd>' : '') +
        '<dt>Plocha tvaru / prírezu</dt><dd>' + fmt(t.plochaSPresahom / 1e6, 3) + ' / ' + fmt(t.plochaPrirez / 1e6, 3) + ' m²</dd>' +
        '<dt>Výška stupňa</dt><dd>+' + fmt(t.vyska) + '</dd>' +
        (t.caps || []).map(c => '<dt>Čap ' + (c.strana === 'vonku' ? 'vonku' : 'vnútri') + ' (dĺ. × hĺ. × hr.)</dt><dd>' + fmt(c.dlzka) + ' × ' + fmt(c.hlbka) + ' × ' + fmt(c.hrubka) +
          (input.hrubka > c.hrubka ? ', frézovať 2 × ' + fmt((input.hrubka - c.hrubka) / 2, (input.hrubka - c.hrubka) % 2 ? 1 : 0) : '') + '</dd>').join('') + '</dl></div>';
    }
    list.innerHTML = h + '</div>';
  }

  function viewBom(v) {
    if (!res.treads || !res.treads.length) return noData(v);
    const b = E.bom(res);
    const minK = res.najuzsiKlin ? res.najuzsiKlin.stupen : null;
    let h = '<div class="pane"><h3>Stupne</h3><table class="tb"><thead><tr><th class="n">Č.</th><th>Druh</th><th class="n">Prírez d × š × t</th><th class="n">Plocha tvaru</th><th class="n">Objem prírezu</th><th class="n">Šírka vnútri</th><th class="n">Na výst. čiare</th><th class="n">Vonku</th><th class="n">' + input.lim.klinVzd + ' mm od vnútra</th></tr></thead><tbody>';
    for (const s of b.stupne) h += '<tr' + (s.n === minK ? ' class="min" title="najužší klin"' : '') + '><td class="n">' + s.n + '</td><td>' + s.druh + '</td><td class="n">' + fmt(s.dlzka) + ' × ' + fmt(s.sirka) + ' × ' + fmt(s.hrubka) + '</td><td class="n">' + fmt(s.plocha, 3) + ' m²</td><td class="n">' + fmt(s.objem, 4) + ' m³</td><td class="n">' + fmt(s.vnutri, 1) + '</td><td class="n">' + fmt(s.vystup, 1) + '</td><td class="n">' + fmt(s.vonku, 1) + '</td><td class="n">' + (s.kontrola == null ? '' : fmt(s.kontrola, 1)) + '</td></tr>';
    h += '<tr class="sum"><td></td><td>' + b.sucty.stupneKs + ' ks</td><td></td><td class="n">' + fmt(b.sucty.stupnePlocha, 3) + ' m² prírezov</td><td class="n">' + fmt(b.sucty.stupneObjem, 3) + ' m³</td><td colspan="4"></td></tr></tbody></table>';
    h += '<h3>Podstupnice</h3><table class="tb"><thead><tr><th class="n">Č.</th><th class="n">Dĺžka</th><th class="n">Výška</th><th class="n">Hrúbka</th><th class="n">Objem</th></tr></thead><tbody>';
    for (const s of b.podst) h += '<tr><td class="n">' + s.n + '</td><td class="n">' + fmt(s.dlzka) + '</td><td class="n">' + fmt(s.vyska) + '</td><td class="n">' + fmt(s.hrubka) + '</td><td class="n">' + fmt(s.objem, 4) + ' m³</td></tr>';
    h += '<tr class="sum"><td></td><td class="n">' + b.sucty.podstKs + ' ks</td><td></td><td></td><td class="n">' + fmt(b.sucty.podstObjem, 3) + ' m³</td></tr></tbody></table>';
    h += '<h3>Schodnice</h3><table class="tb"><thead><tr><th>Názov</th><th>Stupne</th><th class="n">Prírez d × š × t</th><th class="n">Objem</th></tr></thead><tbody>';
    for (const s of b.schodnice) h += '<tr><td>' + s.nazov + '</td><td>' + s.stupne + '</td><td class="n">' + fmt(s.dlzka) + ' × ' + fmt(s.sirka) + ' × ' + fmt(s.hrubka) + '</td><td class="n">' + fmt(s.objem, 3) + ' m³</td></tr>';
    h += '</tbody></table><p class="note">Prírezy stupňov sú obdĺžniky natočené podľa nástupnej hrany (vrátane presahu), bez prídavkov na opracovanie. Podstupnica: výška = h − hrúbka stupňa; prvá siaha na hrubú podlahu, posledná po hrubú podlahu hore. Schodnica: orientačný prírez rozvinutého tvaru.</p>';

    // zábradlie
    const zt = (input.viz && C.ZABRADLIE[input.viz.zabradlie]) ? input.viz.zabradlie : 'ocel';
    h += '<h3 id="bomExtra">Zábradlie</h3><label class="selz">Druh <select id="selZabr">' + Object.keys(C.ZABRADLIE).map(k => '<option value="' + k + '"' + (k === zt ? ' selected' : '') + '>' + C.ZABRADLIE[k] + '</option>').join('') + '</select></label>';
    if (b.zabradlie) {
      h += '<table class="tb"><thead><tr><th>Položka</th><th class="n">Ks</th><th class="n">Dĺžka / rozmer [mm]</th><th class="n">Spolu</th><th>Poznámka</th></tr></thead><tbody>';
      for (const z of b.zabradlie.polozky) h += '<tr><td>' + esc(z.nazov) + '</td><td class="n">' + z.ks + '</td><td class="n">' + z.rozmer + '</td><td class="n">' + z.spolu + '</td><td>' + esc(z.pozn || '') + '</td></tr>';
      h += '</tbody></table><p class="note">Madlo ' + fmt(b.zabradlie.HR) + ' mm nad hranami stupňov, na ' + (input.typ === 'tocite' ? 'vonkajšej' : 'vnútornej (voľnej)') + ' strane. Rovnaké rozmiestnenie ako v 3D vizualizácii.</p>';
    } else h += '<p class="note">Bez zábradlia.</p>';

    // rozloženie na dosky
    h += '<h3>Rozloženie prírezov na dosky</h3>';
    if (!b.dosky.length) h += '<p class="note">Zadajte rozmer dosky v ľavom paneli.</p>';
    else {
      h += '<p class="note">Doska ' + fmt(input.doskaDlzka) + ' × ' + fmt(input.doskaSirka) + ' mm, rez ' + fmt(input.rez) + ' mm. Obdĺžnikové prírezy bez otáčania (vlákna po dĺžke dosky). ' +
        b.dosky.map(g => '<b>' + fmt(g.hrubka) + ' mm</b> (' + g.nazvy.join(', ') + '): ' + g.boards.length + ' ks' + (g.nevojde.length ? ', <span class="bad">nevojde ' + g.nevojde.map(q => q.n + ' ' + fmt(q.w) + '×' + fmt(q.h)).join(', ') + '</span>' : '')).join(' · ') + '</p><div class="boards">';
      for (const g of b.dosky) g.boards.forEach((bd, k) => {
        const D = input.doskaDlzka, S = input.doskaSirka, f = Math.max(D, S) / 100;
        let svg = '<svg viewBox="0 0 ' + D + ' ' + S + '" class="board" preserveAspectRatio="xMinYMin meet"><rect x="0" y="0" width="' + D + '" height="' + S + '" class="bd"/>';
        for (const q of bd.parts) {
          svg += '<rect x="' + q.x + '" y="' + q.y + '" width="' + q.w + '" height="' + q.h + '" class="pc"><title>' + q.n + ': ' + fmt(q.w) + ' × ' + fmt(q.h) + ' mm (x ' + fmt(q.x) + ', y ' + fmt(q.y) + ')</title></rect>';
          const fs = Math.min(3.2 * f, q.h * 0.42, q.w / Math.max(2, q.n.length) * 1.3);
          if (fs > 1.2 * f) svg += '<text x="' + (q.x + q.w / 2) + '" y="' + (q.y + q.h / 2) + '" font-size="' + fs + '" text-anchor="middle" dominant-baseline="central">' + q.n + '</text>';
        }
        svg += '</svg>';
        h += '<figure><figcaption><b>' + fmt(g.hrubka) + ' mm · doska ' + (k + 1) + '</b><span>využitie ' + fmt(bd.vyuzitie * 100) + ' %</span></figcaption>' + svg + '</figure>';
      });
      h += '</div>';
    }
    v.innerHTML = h + '</div>';
    $('#selZabr').addEventListener('change', e => {
      input.viz = Object.assign({}, input.viz || {}, { zabradlie: e.target.value });
      store(); commitHist(); renderView();
    });
  }

  // ---------------------------------------------------------------- bočnice pre CNC (editor)
  const BOC_FIELDS = [
    ['sirkaSchodnice', 'Šírka bočnice', 'mm', 10, 'kolmo na sklon'],
    ['hrubkaSchodnice', 'Hrúbka bočnice', 'mm', 1],
    ['wBoc', 'Šírka ramena W a polomer', [['ano', 'vrátane bočníc'], ['nie', 'medzi bočnicami (svetlá)']]],
    ['bocTvar', 'Tvar bočnice', [['plynula', 'plynulá – oblé napojenie'], ['rovna', 'rovné dosky po úsekoch']]],
    ['bocNad', 'Nad hranami stupňov', 'mm', 5, 'horná hrana nad nástupnými hranami'],
    ['bocPod', 'Pod stupňami', 'mm', 5, 'materiál pod stupňom a drážkou'],
    ['bocZaoblenie', 'Zaoblenie prechodov', 'mm', 50, 'dĺžka vyhladenia, len plynulá'],
    ['bocOkraj', 'Prídavok prírezu', 'mm', 5, 'na každej strane, pre upnutie a rez'],
    ['spoj', 'Uloženie stupňa', [['cap', 'čap v drážke'], ['plna', 'celá hrúbka v drážke'], ['ziadna', 'bez drážok']]],
    ['capHrubka', 'Hrúbka čapu', 'mm', 1, 'centrovaný v hrúbke stupňa'],
    ['drazkaHlbka', 'Hĺbka drážky', 'mm', 1, '= dĺžka čapu'],
    ['capOdsadenie', 'Čap od prednej hrany', 'mm', 5, 'drážka nevyjde na čelo'],
    ['capOdsadenieZad', 'Čap od zadnej hrany', 'mm', 5, 'zub pri podstupnici'],
    ['vola', 'Vôľa drážky', 'mm', 0.1],
    ['freza', 'Priemer frézy', 'mm', 1, 'polomer v rohoch drážok'],
    ['drazkaPodst', 'Drážky pre podstupnice', [['ano', 'áno'], ['nie', 'nie']]]
  ];
  // bočný formulár pohľadu (ostáva pri prekreslení, aby sa nestratil fokus pri písaní); vracia kontajner zoznamu
  function sideForm(v, id, title, fields, note) {
    let list = v.querySelector('#' + id + 'List');
    if (list) return list;
    v.innerHTML = '<div class="boc"><form class="bocForm" id="' + id + 'Form" onsubmit="return false"><h3>' + title + '</h3>' +
      fields.map(([k, label, unit, step, hint]) => Array.isArray(unit)
        ? '<div class="fld" data-types="' + ALL + '"><label for="' + id + '-' + k + '">' + label + '</label><select id="' + id + '-' + k + '" data-key="' + k + '">' + unit.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select></div>'
        : '<div class="fld" data-types="' + ALL + '"><label for="' + id + '-' + k + '">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</label><div class="inp sp"><input id="' + id + '-' + k + '" data-key="' + k + '" inputmode="decimal" data-min="0" data-step="' + step + '" autocomplete="off"><span class="u">' + unit + '</span>' + SPIN + '</div></div>').join('') +
      '<p class="note">' + note + '</p></form><div class="bocList" id="' + id + 'List"></div></div>';
    v.querySelectorAll('#' + id + 'Form input[data-key]').forEach(bindInput);
    v.querySelectorAll('#' + id + 'Form select[data-key]').forEach(s => s.addEventListener('change', () => { setK(s.dataset.key, s.value); changed(true); }));
    syncForm(true);
    return v.querySelector('#' + id + 'List');
  }

  function viewBoc(v) {
    const list = sideForm(v, 'boc', 'Bočnice a spoj', BOC_FIELDS, 'Stupne dostanú na koncoch čap, bočnice drážky rovnakého tvaru. Rohy drážok majú polomer frézy – čelo čapu zaobliť rovnako.');
    if (!res.bocnice || !res.bocnice.length) { list.innerHTML = '<div class="empty">Pre zadané hodnoty nie sú bočnice. Opravte chyby uvedené vyššie.</div>'; return; }
    const bs = res.bocnice;
    if (bocSel && !bs.some(b => b.key === bocSel)) bocSel = null;
    const nG = bs.reduce((a, b) => a + b.drazky.length, 0);
    const kus = n => n + (n === 1 ? ' dielec' : n < 5 ? ' dielce' : ' dielcov');
    let h = '<div class="bocHead"><div><b>' + kus(bs.length) + '</b> · ' + nG + ' drážok hĺbky ' + fmt(input.drazkaHlbka) + ' mm · hrúbka ' + fmt(input.hrubkaSchodnice) + ' mm' +
      '<br><span class="muted">Pohľad na stranu s drážkami, dielce natočené na najmenší prírez. DXF vrstvy: REZ_OBRYS (rez naskrz), DRAZKA_H' + fmt(input.drazkaHlbka, 1).replace(',0', '').replace(',', '_') + ' (vrecká), PRIREZ, POPIS.</span></div>' +
      '<button class="btnS" data-dxf="">DXF všetkých bočníc</button></div>' + bocEditorHTML();
    for (const b of bs) {
      const ts = Math.max(b.prirez.dlzka, b.prirez.sirka * 3) / 110;
      const d = D.bocnica(res, b, ts, { fill: true, title: false });
      const bb = D.itemsBBox(d.items);
      h += '<div class="bocCard' + (b.key === bocSel ? ' on' : '') + '" data-k="' + b.key + '"><header><b>' + b.id + ' · ' + esc(b.nazov) + '</b><span>st. ' + b.stupne + ' · prírez ' + fmt(b.prirez.dlzka) + ' × ' + fmt(b.prirez.sirka) + ' × ' + fmt(b.hrubka) + ' mm</span>' +
        (b.oblukova ? '<span class="warnTag">oblúková – CNC len rozvinutá, ohýbaná bočnica</span>' : '') +
        '<button class="btnS" data-dxf="' + b.id + '">DXF</button></header>' + D.toSVG(d.items, bb, { pad: ts * 2 }) + '</div>';
    }
    list.innerHTML = h;
    list.querySelectorAll('[data-dxf]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.dxf;
      download(E.dxfBocnice(res, id || null), slug() + '-bocnice' + (id ? '-' + id : '') + '.dxf', 'application/dxf');
    }));
    list.querySelectorAll('.bocCard header').forEach(hd => hd.addEventListener('click', () => {
      const k = hd.parentNode.dataset.k;
      bocSel = bocSel === k ? null : k;
      renderView();
      const st = $('#bocList .bocSide .f-bocSel');
      if (st) st.closest('.bocSide').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
    bindBocEditor(list);
  }

  // ---------------------------------------------------------------- editor bočníc na výkrese (polia s vynášacími čiarami)
  let bocSel = null; // kľúč vybraného dielca – polia menia len jeho úpravy; inak globálne hodnoty
  // f = pole úpravy dielca, g = globálny parameter, a = kotva vo výkrese
  const BOC_ED = [
    { f: 'nad', g: 'bocNad', a: 'nad', label: 'Nad hranami', band: 'top' },
    { f: 'predK', a: 'predK', label: 'Predĺženie konca', band: 'top', piece: true },
    { g: 'bocZaoblenie', a: 'zaoblenie', label: 'Zaoblenie', band: 'top', smooth: true },
    { f: 'predZ', a: 'predZ', label: 'Predĺženie začiatku', band: 'bot', piece: true },
    { f: 'sirka', g: 'sirkaSchodnice', a: 'sirka', label: 'Šírka bočnice', band: 'bot' },
    { f: 'pod', g: 'bocPod', a: 'pod', label: 'Pod stupňami', band: 'bot' }
  ];
  const sideOfKey = k => k && (k[0] === 'u' ? 'vonkajsia' : 'vnutorna');
  function bocSides() {
    return [['vonkajsia', input.typ === 'tocite' ? 'Vonkajšia bočnica' : 'Bočnica pri stene'], ['vnutorna', 'Vnútorná bočnica']]
      .filter(([k]) => res.unfold && res.unfold[k] && res.unfold[k].tvary.length && (k !== 'vnutorna' || input.typ !== 'tocite'));
  }
  function bocEditorHTML() {
    const piece = bocSel && res.bocnice.find(b => b.key === bocSel);
    let h = '<div class="bocEd"><div class="bocEdBar">' + (piece
      ? '<span>Upravujete <b>' + piece.id + ' · ' + esc(piece.nazov) + '</b> – polia na výkrese menia len tento dielec.</span>' +
        (piece.upravena ? '<button class="btnS" data-bocreset="1">Zrušiť úpravy dielca</button>' : '') + '<button class="btnS" data-bocdone="1">Hotovo</button>'
      : '<span>Hodnoty na výkrese platia pre všetky bočnice. <b>Kliknite na dielec</b> a upravte len ten.</span>' +
        (input.bocUpravy ? '<button class="btnS" data-bocreset="all">Zrušiť úpravy dielcov</button>' : '')) + '</div>';
    for (const [k, title] of bocSides())
      h += '<div class="bocSide" data-side="' + k + '"><div class="bocSideH">' + title + ' – rozvinutie</div><div class="bocStage"></div></div>';
    return h + '</div>';
  }
  function bocVal(e, band) {
    if (bocSel && e.f) {
      const o = (input.bocUpravy || {})[bocSel] || {};
      if (o[e.f] != null) return o[e.f];
      return band[e.f] != null ? band[e.f] : 0;
    }
    return input[e.g];
  }
  function setBocVal(e, n) {
    if (bocSel && e.f) {
      const all = Object.assign({}, input.bocUpravy || {});
      all[bocSel] = Object.assign({}, all[bocSel] || {}, { [e.f]: n });
      input.bocUpravy = all;
    } else input[e.g] = n;
    changed(true);
  }
  function bindBocEditor(root) {
    const bar = root.querySelector('.bocEdBar');
    if (!bar) return;
    const rs = bar.querySelector('[data-bocreset]');
    if (rs) rs.addEventListener('click', () => {
      if (rs.dataset.bocreset === 'all') delete input.bocUpravy;
      else if (input.bocUpravy) { delete input.bocUpravy[bocSel]; if (!Object.keys(input.bocUpravy).length) delete input.bocUpravy; }
      changed(true);
    });
    const dn = bar.querySelector('[data-bocdone]');
    if (dn) dn.addEventListener('click', () => { bocSel = null; renderView(); });
    root.querySelectorAll('.bocSide').forEach(sd => {
      const key = sd.dataset.side, stage = sd.querySelector('.bocStage');
      const sel = bocSel && sideOfKey(bocSel) === key ? bocSel : null;
      const dr = D.bocStrana(res, key, { sel });
      if (!dr) return;
      stage.innerHTML = D.toSVG(dr.items, dr.bbox, { pad: dr.ts * 2 }) + '<svg class="bocLead"></svg>';
      const svg = stage.querySelector('svg.vykres');
      svg.addEventListener('click', ev => {
        const p = ev.target.closest && ev.target.closest('[data-k]');
        const k = p ? p.dataset.k : null;
        if (!k && !bocSel) return;
        bocSel = k && k !== bocSel ? k : null;
        renderView();
      });
      // pri vybranom dielci majú polia len jeho strana; globálne polia bez výberu
      const show = bocSel && !sel ? [] : BOC_ED.filter(e => (sel ? e.f : !e.piece) && (!e.smooth || input.bocTvar !== 'rovna'));
      const els = show.map(e => {
        const an = dr.anchors[e.a];
        if (!an) return null;
        const d = document.createElement('label');
        d.className = 'bocFld';
        const v = bocVal(e, dr.band);
        const own = sel && e.f && ((input.bocUpravy || {})[sel] || {})[e.f] != null;
        d.innerHTML = '<span>' + e.label + '</span><input inputmode="decimal" autocomplete="off" value="' + String(Math.round(v * 10) / 10).replace('.', ',') + '"' + (own ? ' class="own"' : '') + '><i>mm</i>';
        const inp = d.querySelector('input');
        const commit = () => {
          const n = parseNum(inp.value);
          if (n === null || n < 0) { inp.classList.add('bad'); return; }
          if (Math.abs(n - v) > 1e-9) setBocVal(e, n);
        };
        inp.addEventListener('change', commit);
        inp.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
          if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
            ev.preventDefault();
            const st = (e.g === 'bocZaoblenie' ? 50 : 5) * (ev.shiftKey ? 10 : 1);
            inp.value = String(Math.max(0, (parseNum(inp.value) || 0) + (ev.key === 'ArrowUp' ? st : -st))).replace('.', ',');
            commit();
          }
        });
        stage.appendChild(d);
        return { e, an, d };
      }).filter(Boolean);
      const layout = () => {
        const ctm = svg.getScreenCTM(), r = stage.getBoundingClientRect();
        if (!ctm || !r.width) return;
        const px = q => ({ x: ctm.a * q.x - ctm.c * q.y + ctm.e - r.left, y: ctm.b * q.x - ctm.d * q.y + ctm.f - r.top });
        const W = r.width, Hs = r.height;
        let lead = '';
        for (const bandName of ['top', 'bot']) {
          const row = els.filter(o => o.e.band === bandName).map(o => {
            const a = px(o.an.a), b = o.an.b ? px(o.an.b) : a;
            return Object.assign(o, { a, b, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, w: o.d.offsetWidth });
          }).sort((p, q) => p.m.x - q.m.x);
          let xr = 4;
          for (const o of row) { o.x = Math.max(xr, Math.min(W - o.w - 4, o.m.x - o.w / 2)); xr = o.x + o.w + 8; }
          for (let i = row.length - 1, xl = W - 4; i >= 0; i--) { const o = row[i]; if (o.x + o.w > xl) o.x = xl - o.w; xl = o.x - 8; }
          for (const o of row) {
            const y = bandName === 'top' ? 6 : Hs - o.d.offsetHeight - 6;
            o.d.style.left = o.x + 'px';
            o.d.style.top = y + 'px';
            const ly = bandName === 'top' ? y + o.d.offsetHeight : y, lx = o.x + o.w / 2;
            lead += '<path d="M' + lx + ' ' + ly + 'L' + o.m.x + ' ' + o.m.y + '" class="ld"/>';
            if (o.an.b && Math.hypot(o.a.x - o.b.x, o.a.y - o.b.y) > 2) {
              lead += '<path d="M' + o.a.x + ' ' + o.a.y + 'L' + o.b.x + ' ' + o.b.y + '" class="dm"/>';
              for (const q of [o.a, o.b]) lead += '<path d="M' + (q.x - 6) + ' ' + q.y + 'L' + (q.x + 6) + ' ' + q.y + '" class="dm"/>';
            } else lead += '<circle cx="' + o.m.x + '" cy="' + o.m.y + '" r="3.5" class="dt"/>';
          }
        }
        const ls = stage.querySelector('svg.bocLead');
        ls.setAttribute('viewBox', '0 0 ' + W + ' ' + Hs);
        ls.innerHTML = lead;
      };
      layout();
      if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
    });
  }

  function viewChecks(v) {
    let h = '<div class="pane"><h3>Kontroly</h3><div class="checks">';
    for (const c of res.checks) {
      const cl = c.ok ? 'ok' : c.level === 'err' ? 'err' : 'warn';
      h += '<div class="chk ' + cl + '"><div class="ic">' + (c.ok ? '✓' : '!') + '</div><div>' + esc(c.nazov) + '</div><div class="val">' + esc(c.hodnota) + '</div><div class="lim">' + esc(c.limit) + '</div></div>';
    }
    if (!res.checks.length) h += '<p class="note">Kontroly nie sú k dispozícii.</p>';
    h += '</div>';
    if (res.eq && res.eq.length) {
      h += '<h3 style="margin-top:22px">Vyrovnanie klinových stupňov</h3><p class="note">';
      h += res.eq.map(R => 'Oblasť stupňov ' + R.od + '–' + R.po + ' (' + R.n + ' stupňov, v zákrute ' + R.stupne.map(x => x[0] + '–' + x[1]).join(', ') + '): šírky pri vnútornej hrane d = b − k·p, k = ' + fmt(R.K, 1) + ' mm.').join('<br>');
      h += ' Celková dĺžka vnútornej hrany v oblasti je zachovaná, p rastie lineárne od okraja oblasti k rohu.</p>';
    }
    if (res.N) {
      h += '<h3 style="margin-top:22px">Výpočet</h3><p class="note">Dĺžka výstupnej čiary ' + fmt(res.Lw, 1) + ' mm, výstupná čiara ' + fmt(res.w) + ' mm od vnútornej hrany. ' +
        (res.podesta ? 'Podesta je stupeň č. ' + res.podesta.index + ' (rameno 1: ' + res.podesta.n1 + ' st., rameno 2: ' + res.podesta.n2 + ' st.). ' : 'b = dĺžka výstupnej čiary / (N − 1). ') +
        (res.autoN ? 'Počet výšok zvolený automaticky (najmenšie |2h + b − ' + input.lim.kCiel + '| + 0,15·|h − ' + fmt((input.lim.hMin + input.lim.hMax) / 2) + '|).' : 'Počet výšok zadaný ručne.') + '</p>';
    }
    v.innerHTML = h + '</div>';
  }

  // ---------------------------------------------------------------- exporty
  function slug() {
    const s = (input.projekt || 'schody').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return (s || 'schody') + '-' + input.typ;
  }
  function download(data, name, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function needResult() {
    if (!res || res.errors.length || !res.treads || !res.treads.length) { toast('Najprv opravte chyby v zadaní.'); return false; }
    return true;
  }

  // obrázky 3D vizualizácie pre PDF (ak prehliadač podporuje WebGL)
  function pdfImages() {
    const VZ = window.SchodyViz;
    if (!VZ || !VZ.available || !VZ.webglOK()) return {};
    try {
      const images = VZ.renders(res, input.viz, ['celok', 'nastup', 'poschodie'], 1600, 1000);
      const S = VZ.settings(input.viz);
      const vizText = [['Priestor', VZ.PRIESTORY[S.priestor].n], ['Stupne', VZ.MAT[S.stupne].n],
        ['Podstupnice', S.podstupnice === 'ziadne' ? 'bez podstupníc' : VZ.MAT[S.podstupnice].n],
        ['Schodnice', VZ.MAT[S.schodnice].n], ['Zábradlie', VZ.ZABRADLIE[S.zabradlie]]];
      return { images, vizText };
    } catch (err) { console.warn('3D obrázky do PDF:', err); return {}; }
  }

  function bindActions() {
    $('#btnPdf').addEventListener('click', () => {
      if (!needResult()) return;
      toast('Pripravujem PDF…');
      setTimeout(() => {
        try {
          const doc = E.pdf(res, window.jspdf.jsPDF, window.SCHODY_FONTS, pdfImages());
          doc.save(slug() + '.pdf');
        } catch (e) { console.error(e); toast('PDF sa nepodarilo vytvoriť: ' + e.message); }
      }, 30);
    });
    $('#btnDxf').addEventListener('click', () => { if (needResult()) download(E.dxf(res), slug() + '.dxf', 'application/dxf'); });
    $('#btnCsv').addEventListener('click', () => { if (needResult()) download(E.csv(res), slug() + '-rozpis.csv', 'text/csv;charset=utf-8'); });
    $('#btnSave').addEventListener('click', () => download(E.projectJSON(input), slug() + '.json', 'application/json'));
    $('#btnOpen').addEventListener('click', () => $('#fileOpen').click());
    $('#fileOpen').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { input = E.parseProject(rd.result); viewBoxState = {}; changed(true); toast('Projekt načítaný: ' + f.name); }
        catch (err) { toast('Súbor sa nedá načítať: ' + err.message); }
      };
      rd.readAsText(f, 'utf-8');
      e.target.value = '';
    });
    $('#btnNew').addEventListener('click', () => {
      if (!confirm('Začať nový projekt? Aktuálne zadanie sa nahradí predvolenými hodnotami.')) return;
      input = C.normalize({}); viewBoxState = {}; changed(true);
    });
    document.querySelector('.tabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      tab = b.dataset.tab;
      try { history.replaceState(null, '', '#' + tab); } catch (err) { /* file:// bez histórie */ }
      renderView();
    });
  }

  // ---------------------------------------------------------------- šípky ▲▼ pri číselných poliach (podržaním opakujú)
  let spin = null;
  function spinTick() {
    const inp = spin && document.getElementById(spin.id);
    if (!inp || inp.disabled) return;
    const st = (+inp.dataset.step || 10) * (spin.shift ? 10 : 1);
    let v = Math.round(((parseNum(inp.value) || 0) + spin.d * st) * 100) / 100;
    if (inp.dataset.min != null) v = Math.max(+inp.dataset.min, v);
    inp.value = String(v).replace('.', ',');
    if (inp.dataset.key) onField(inp);
    else setEdit(+inp.dataset.e, inp.dataset.k, v);
  }
  function spinStop() {
    if (!spin) return;
    clearTimeout(spin.t);
    const id = spin.id;
    spin = null;
    commitHist();
    syncForm(true);
    const inp = document.getElementById(id);
    if (inp && inp.dataset.key) inp.blur();
  }
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.spin button');
    if (!b || e.button !== 0) return;
    const inp = b.closest('.inp').querySelector('input');
    if (!inp || inp.disabled) return;
    e.preventDefault(); e.stopPropagation();
    spinStop();
    spin = { id: inp.id, d: +b.dataset.d, shift: e.shiftKey, t: 0 };
    spinTick();
    const rep = delay => { spin.t = setTimeout(() => { if (!spin) return; spinTick(); rep(70); }, delay); };
    rep(420);
  }, true);
  window.addEventListener('pointerup', spinStop);
  window.addEventListener('pointercancel', spinStop);
  window.addEventListener('blur', spinStop);

  // ---------------------------------------------------------------- späť / znova
  let past = [], future = [], histBase = null;
  const snap = () => JSON.stringify(input);
  function commitHist() {
    if (spin) return; // podržaná šípka = jeden krok po pustení
    const cur = snap();
    if (histBase === null || cur === histBase) { histBase = cur; return updHist(); }
    past.push(histBase);
    if (past.length > 200) past.shift();
    future = [];
    histBase = cur;
    updHist();
  }
  function restoreHist(str) {
    input = C.normalize(JSON.parse(str));
    histBase = snap();
    store(); syncForm(); recompute(); updHist();
  }
  function undo() {
    commitHist(); // rozpísané pole sa uloží ako krok
    if (!past.length) return toast('Nie je čo vrátiť.');
    future.push(histBase);
    restoreHist(past.pop());
  }
  function redo() {
    if (!future.length) return;
    past.push(histBase);
    restoreHist(future.pop());
  }
  function updHist() {
    const u = $('#btnUndo'), r = $('#btnRedo');
    if (u) u.disabled = !past.length && snap() === histBase;
    if (r) r.disabled = !future.length;
  }
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k !== 'z' && k !== 'y') return;
    const t = e.target;
    if (t && t.matches && t.matches('#projekt, .fld.wide input, textarea')) return; // text: natívne späť
    if (edDrag) return;
    e.preventDefault();
    if (k === 'y' || e.shiftKey) redo(); else undo();
  });

  buildForm();
  bindActions();
  syncForm();
  recompute();
  commitHist();
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
})();
