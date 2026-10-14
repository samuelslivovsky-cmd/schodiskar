/* Schodiskár – rozhranie */
(function () {
  'use strict';
  const C = window.SchodyCore, D = window.SchodyDraw, E = window.SchodyExport;
  const fmt = C.fmt;
  const $ = s => document.querySelector(s);
  const STORE = 'schodiskar.zadanie.v1';

  // ---------------------------------------------------------------- polia formulára
  const ALL = 'rovne L U Lp Up tocite';
  const FIELDS = {
    fDims: [
      ['H', 'Konštrukčná výška H', 'mm'],
      ['N', 'Počet výšok N', 'ks', ALL, '0 = automaticky'],
      ['W', 'Šírka ramena W', 'mm', 'rovne L U Lp Up'],
      ['L', 'Dĺžka L', 'mm', 'rovne'],
      ['A', 'Rameno A', 'mm', 'L Lp', 'vonkajší rozmer'],
      ['B', 'Rameno B', 'mm', 'L Lp', 'vonkajší rozmer'],
      ['R1', 'Rameno 1', 'mm', 'U Up', 'vonkajší rozmer'],
      ['R2', 'Rameno 2', 'mm', 'U Up', 'vonkajší rozmer'],
      ['M', 'Zrkadlo', 'mm', 'U Up', 'medzera medzi ramenami'],
      ['r', 'Polomer vnútorného rohu', 'mm', 'L U Lp Up', '0 = ostrý roh'],
      ['Rv', 'Vonkajší polomer R', 'mm', 'tocite'],
      ['Rs', 'Polomer stĺpa', 'mm', 'tocite'],
      ['uhol', 'Celkové otočenie', '°', 'tocite']
    ],
    fWalk: [
      ['w', 'Výstupná čiara od vnútornej hrany', 'mm', ALL, '0 = stred ramena'],
      ['nb', 'Vyrovnané stupne pred a za zákrutou', 'ks', 'L U']
    ],
    fCons: [
      ['presah', 'Presah stupňa', 'mm'],
      ['hrubka', 'Hrúbka stupňa', 'mm'],
      ['hrubkaPodst', 'Hrúbka podstupnice', 'mm'],
      ['sirkaSchodnice', 'Šírka schodnice', 'mm'],
      ['hrubkaSchodnice', 'Hrúbka schodnice', 'mm']
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
    U: '<path d="M4 4h32v32H4V24h18v-8H4z"/><path d="M9 4v12M14 4v12M19 4l2 12M22 16l14-10M22 20h14M22 24l14 10M19 36l2-12M14 36V24M9 36V24" class="t"/>',
    Lp: '<path d="M4 34V22h18V4h14v30z"/><path d="M22 20h14v14H22z" class="f"/><path d="M8 22v12M12 22v12M16 22v12M22 15h14M22 10h14" class="t"/>',
    Up: '<path d="M4 4h32v32H4V24h18v-8H4z"/><path d="M22 4h14v32H22z" class="f"/><path d="M8 4v12M12 4v12M16 4v12M8 24v12M12 24v12M16 24v12" class="t"/>',
    tocite: '<circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="3" class="f"/><path d="M20 4v13M31.3 8.7l-9.2 9.2M36 20H23M31.3 31.3l-9.2-9.2M20 36V23M8.7 31.3l9.2-9.2M4 20h13" class="t"/>'
  };
  const TYPE_SHORT = { rovne: 'Rovné', L: 'L klinové', U: 'U klinové', Lp: 'L podesta', Up: 'U podesta', tocite: 'Točité' };

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
  const TABS = ['plan', '3d', 'unfold', 'parts', 'bom', 'checks'];
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
      el.innerHTML = list.map(([k, label, unit, types, hint, wide]) =>
        '<div class="fld' + (wide ? ' wide' : '') + '" data-types="' + (types || ALL) + '">' +
        '<label for="in-' + k + '">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</label>' +
        '<div class="inp"><input id="in-' + k + '" data-key="' + k + '" ' + (wide ? '' : 'inputmode="decimal" ') + 'autocomplete="off" spellcheck="false">' +
        (unit ? '<span class="u">' + unit + '</span>' : '') + '</div></div>').join('');
    }
    document.querySelectorAll('input[data-key]').forEach(inp => {
      inp.addEventListener('input', () => onField(inp));
      inp.addEventListener('change', () => onField(inp, true));
      inp.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const k = inp.dataset.key;
        if (typeof getK(k) !== 'number') return;
        e.preventDefault();
        const step = e.shiftKey ? 100 : (['N', 'nb'].includes(k) ? 1 : 10);
        const v = (parseNum(inp.value) || 0) + (e.key === 'ArrowUp' ? step : -step);
        inp.value = String(Math.max(0, Math.round(v * 100) / 100)).replace('.', ',');
        onField(inp, true);
      });
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
    if (commit) syncForm(true);
  }

  function syncForm(onlyBlurred) {
    document.querySelectorAll('input[data-key]').forEach(inp => {
      if (onlyBlurred && inp === document.activeElement) return;
      const v = getK(inp.dataset.key);
      inp.value = typeof v === 'number' ? String(v).replace('.', ',') : (v || '');
      inp.classList.remove('bad');
    });
    document.querySelectorAll('#types button').forEach(b => { const on = b.dataset.typ === input.typ; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    document.querySelectorAll('#dirRow button').forEach(b => { const on = b.dataset.smer === input.smer; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $('#dirRow').hidden = input.typ === 'rovne';
    $('#dirRow').querySelector('span').textContent = input.typ === 'tocite' ? 'Smer otáčania' : 'Zákruta';
    document.querySelectorAll('.fld').forEach(f => { f.hidden = f.dataset.types.split(' ').indexOf(input.typ) < 0; });
  }

  let renderT = null;
  function changed(full) {
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
      h += kpi('Šírka b', fmt(res.b, 1) + ' <small>mm</small>', chk('b'));
      h += kpi('2h + b', fmt(res.krok, 1) + ' <small>mm</small>', chk('k'));
      h += kpi('Sklon', fmt(res.sklon, 1) + '°');
      if (res.najuzsiKlin) h += kpi('Najužší klin', fmt(res.najuzsiKlin.hodnota, 1) + ' <small>mm, st. ' + res.najuzsiKlin.stupen + '</small>', chk('klin'));
      if (res.podchod != null) h += kpi('Podchod', fmt(res.podchod) + ' <small>mm</small>', chk('podchod'));
    } else h += kpi('Výpočet', '—');
    const st = { ok: 'OK', pozor: 'POZOR', chyba: 'CHYBA' }[res.stav];
    h += '<div class="status ' + res.stav + '">' + st + '</div>';
    s.innerHTML = h;
    const m = $('#msgs');
    m.innerHTML = res.errors.map(e => '<div class="msg err">' + esc(e) + '</div>').join('') +
      res.warnings.map(e => '<div class="msg warn">' + esc(e) + '</div>').join('');
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
    if (tab === 'checks') return viewChecks(v);
  }

  function noData(v) { v.innerHTML = '<div class="empty">Pre zadané hodnoty nie je výsledok. Opravte chyby uvedené vyššie.</div>'; }

  function viewDrawing(v, dr, key, legend) {
    if (!dr.bbox) return noData(v);
    v.innerHTML = '<div class="canvas" id="cv">' + D.toSVG(dr.items, dr.bbox) + '</div>' +
      (legend ? '<div class="legend"><span><i style="border-color:#c2410c;border-top-style:dashed"></i>výstupná čiara</span><span><i style="border-color:#1d2733"></i>výstupná hrana (s presahom)</span><span><i style="border-color:#64748b;border-top-style:dashed"></i>podstupnica</span><span><i style="border-color:#2f7d4f"></i>kóty pri stene</span></div>' : '') +
      '<div class="zoomhint">koliesko = zoom · ťahanie = posun · dvojklik = celé</div>';
    const cv = $('#cv'), svg = cv.querySelector('svg');
    enableZoom(cv, svg, key);
    if (key === 'plan') {
      svg.addEventListener('mousemove', e => {
        const p = e.target.closest && e.target.closest('.hov');
        if (p) showTip(+p.dataset.n, e.clientX, e.clientY); else hideTip();
      });
      svg.addEventListener('mouseleave', hideTip);
    }
  }

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
      store();
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
    if (!res.treads || !res.treads.length) return noData(v);
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
        '<dt>Výška stupňa</dt><dd>+' + fmt(t.vyska) + '</dd></dl></div>';
    }
    v.innerHTML = h + '</div>';
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
    h += '</tbody></table><p class="note">Prírezy stupňov sú obdĺžniky natočené podľa nástupnej hrany (vrátane presahu), bez prídavkov na opracovanie. Podstupnica: výška = h − hrúbka stupňa. Schodnica: orientačný prírez rozvinutého tvaru.</p></div>';
    v.innerHTML = h;
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

  buildForm();
  bindActions();
  syncForm();
  recompute();
})();
