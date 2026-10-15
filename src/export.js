/*
 * Schodiskár – exporty: DXF R12, CSV, PDF (jsPDF), JSON projekt.
 */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const C = node ? require('./core.js') : root.SchodyCore;
  const D = node ? require('./draw.js') : root.SchodyDraw;
  const m = factory(C, D);
  if (node) module.exports = m; else root.SchodyExport = m;
})(typeof self !== 'undefined' ? self : this, function (C, D) {
  'use strict';
  const fmt = C.fmt;
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------- rozpis materiálu
  function bom(res) {
    const inp = res.input;
    const stupne = (res.treads || []).map(t => ({
      n: t.n, druh: t.kind === 'podesta' ? 'podesta' : 'stupeň',
      dlzka: t.prirez.dlzka, sirka: t.prirez.sirka, hrubka: inp.hrubka,
      plocha: t.plochaSPresahom / 1e6, plochaPrirez: t.plochaPrirez / 1e6,
      objem: t.plochaPrirez * inp.hrubka / 1e9,
      vnutri: t.sirky.vnutri, vystup: t.sirky.vystup, vonku: t.sirky.vonku, kontrola: t.sirky.kontrola
    }));
    const podst = (res.risers || []).map(r => ({ n: r.n, dlzka: r.dlzka, vyska: r.vyska, hrubka: inp.hrubkaPodst, objem: r.dlzka * r.vyska * inp.hrubkaPodst / 1e9 }));
    const schodnice = [];
    if (res.unfold) {
      const add = (key, nazov) => {
        const S = res.unfold[key];
        S.tvary.forEach((sh, i) => schodnice.push({
          nazov: nazov + (S.tvary.length > 1 ? ' – ' + (i === 0 ? 'dolné rameno' : 'horné rameno') : ''),
          stupne: sh.od + '–' + sh.po,
          dlzka: sh.prirez.dlzka, sirka: sh.prirez.sirka, hrubka: inp.hrubkaSchodnice,
          objem: sh.prirez.dlzka * sh.prirez.sirka * inp.hrubkaSchodnice / 1e9
        }));
      };
      if (inp.typ === 'tocite') {
        add('vonkajsia', 'Vonkajšia schodnica (rozvinutá, zakrivená)');
        schodnice.push({ nazov: 'Stĺp (vreteno) Ø ' + fmt(2 * inp.Rs), stupne: '1–' + (res.N - 1), dlzka: inp.H, sirka: 2 * inp.Rs, hrubka: 2 * inp.Rs, objem: Math.PI * inp.Rs * inp.Rs * inp.H / 1e9 });
      } else {
        add('vnutorna', 'Vnútorná schodnica');
        add('vonkajsia', 'Vonkajšia schodnica (pri stene)');
      }
    }
    const sum = (arr, k) => arr.reduce((a, b) => a + (b[k] || 0), 0);
    return {
      stupne, podst, schodnice,
      zabradlie: railingBom(res),
      dosky: boards(res, stupne, podst, schodnice),
      sucty: {
        stupneKs: stupne.length, stupnePlocha: sum(stupne, 'plochaPrirez'), stupneObjem: sum(stupne, 'objem'),
        podstKs: podst.length, podstObjem: sum(podst, 'objem'), schodniceObjem: sum(schodnice, 'objem')
      }
    };
  }

  function railType(inp) {
    const t = inp.viz && inp.viz.zabradlie;
    return C.ZABRADLIE[t] ? t : 'ocel';
  }

  // položky zábradlia podľa rovnakého rozmiestnenia ako v 3D
  function railingBom(res) {
    const R = C.railing(res, railType(res.input));
    if (!R) return null;
    const items = [];
    const len = arr => arr.reduce((a, q) => a + (q.z1 - q.z0), 0);
    const mx = arr => Math.max.apply(null, arr.map(q => q.z1 - q.z0));
    const madlo = R.typ === 'drevo' ? 'Madlo drevené 60 × 45' : 'Madlo Ø 44 (' + (R.typ === 'ocel' ? 'oceľ' : 'nerez') + ')';
    items.push({ nazov: madlo, ks: 1, rozmer: fmt(R.madlo), spolu: fmt(R.madlo / 1000, 2) + ' m', pozn: 'po dĺžke v sklone, bez prídavku na ohyby' });
    const ends = R.posts.filter(q => q.druh === 'koncový'), mids = R.posts.filter(q => q.druh !== 'koncový');
    const pName = w => R.typ === 'drevo' ? 'Stĺpik drevený ' + w + ' × ' + w : 'Stĺpik ' + w + ' × ' + w + (R.typ === 'ocel' ? ' (oceľ)' : ' (nerez)');
    items.push({ nazov: pName(ends[0].w) + ' – koncový', ks: ends.length, rozmer: 'max. ' + fmt(mx(ends)), spolu: fmt(len(ends) / 1000, 2) + ' m', pozn: 'od hrany stupňa po madlo' });
    if (mids.length) items.push({ nazov: pName(mids[0].w), ks: mids.length, rozmer: 'max. ' + fmt(mx(mids)), spolu: fmt(len(mids) / 1000, 2) + ' m' });
    if (R.rods.length) items.push({ nazov: 'Tyčka Ø 14 (oceľ)', ks: R.rods.length, rozmer: 'max. ' + fmt(mx(R.rods)), spolu: fmt(len(R.rods) / 1000, 2) + ' m', pozn: 'zvislé, kotvené do stupňa' });
    if (R.prieck) items.push({ nazov: 'Priečka Ø 14 (nerez)', ks: R.prieck, rozmer: fmt(R.madlo), spolu: fmt(R.prieck * R.madlo / 1000, 2) + ' m', pozn: 'rovnobežne s madlom, rozostup 165 mm' });
    if (R.glass.length) {
      let A = 0, wMax = 0, hMax = 0;
      for (const q of R.glass) { const w = q.g1 - q.g0, hh = (q.z1a + q.z1b) / 2 - q.z0; A += w * hh; wMax = Math.max(wMax, w); hMax = Math.max(hMax, Math.max(q.z1a, q.z1b) - q.z0); }
      items.push({ nazov: 'Sklo bezpečnostné (výplň)', ks: R.glass.length, rozmer: 'max. ' + fmt(wMax) + ' × ' + fmt(hMax), spolu: fmt(A / 1e6, 2) + ' m²', pozn: 'lichobežníky podľa stupňov' });
    }
    return { typ: R.typ, nazov: R.nazov, HR: R.HR, madlo: R.madlo, polozky: items };
  }

  // obdĺžnikové prírezy rozložené na dosky, zvlášť pre každú hrúbku
  function boards(res, stupne, podst, schodnice) {
    const inp = res.input;
    const D = inp.doskaDlzka, S = inp.doskaSirka, kerf = Math.max(0, inp.rez);
    if (!(D > 0 && S > 0)) return [];
    const byT = {};
    const put = (t, nazov, p) => { if (!(p.w > 1 && p.h > 1)) return; const g = byT[t] || (byT[t] = { hrubka: t, nazvy: [], pieces: [] }); if (g.nazvy.indexOf(nazov) < 0) g.nazvy.push(nazov); g.pieces.push(p); };
    for (const q of stupne) put(inp.hrubka, 'stupne', { n: (q.druh === 'podesta' ? 'P' : 'S') + q.n, w: q.dlzka, h: q.sirka });
    for (const q of podst) put(inp.hrubkaPodst, 'podstupnice', { n: 'Pd' + q.n, w: q.dlzka, h: q.vyska });
    schodnice.forEach((q, i) => { if (!/^Stĺp/.test(q.nazov)) put(inp.hrubkaSchodnice, 'schodnice', { n: 'Sch' + (i + 1), w: q.dlzka, h: q.sirka }); });
    return Object.keys(byT).map(Number).sort((a, b) => b - a).map(t => Object.assign({ hrubka: t, nazvy: byT[t].nazvy }, C.nest(byT[t].pieces, D, S, kerf)));
  }

  // ---------------------------------------------------------------- CSV
  function csv(res) {
    const b = bom(res), inp = res.input;
    const n1 = x => x == null ? '' : fmt(x, 1);
    const n0 = x => x == null ? '' : fmt(x, 0);
    const n3 = x => x == null ? '' : fmt(x, 3);
    const q = s => /[;"\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);
    const rows = [];
    rows.push(['Schodiskár – rozpis materiálu']);
    rows.push(['Projekt', inp.projekt]);
    rows.push(['Typ', res.typNazov + (inp.typ !== 'rovne' ? ', zákruta ' + (inp.smer === 'vpravo' ? 'vpravo' : 'vľavo') : '')]);
    rows.push(['Výšky', res.N + ' × ' + n1(res.h) + ' mm', 'b', n1(res.b) + ' mm', '2h+b', n1(res.krok) + ' mm']);
    rows.push([]);
    rows.push(['STUPNE']);
    rows.push(['Č.', 'Druh', 'Prírez dĺžka [mm]', 'Prírez šírka [mm]', 'Hrúbka [mm]', 'Plocha tvaru [m²]', 'Plocha prírezu [m²]', 'Objem prírezu [m³]', 'Šírka vnútri [mm]', 'Šírka na výst. čiare [mm]', 'Šírka vonku [mm]', 'Šírka ' + inp.lim.klinVzd + ' mm od vnútra [mm]']);
    for (const s of b.stupne) rows.push([s.n, s.druh, n0(s.dlzka), n0(s.sirka), n0(s.hrubka), n3(s.plocha), n3(s.plochaPrirez), n3(s.objem), n1(s.vnutri), n1(s.vystup), n1(s.vonku), n1(s.kontrola)]);
    rows.push(['Spolu', b.sucty.stupneKs + ' ks', '', '', '', '', n3(b.sucty.stupnePlocha), n3(b.sucty.stupneObjem)]);
    rows.push([]);
    rows.push(['PODSTUPNICE']);
    rows.push(['Č.', 'Dĺžka [mm]', 'Výška [mm]', 'Hrúbka [mm]', 'Objem [m³]']);
    for (const s of b.podst) rows.push([s.n, n0(s.dlzka), n0(s.vyska), n0(s.hrubka), n3(s.objem)]);
    rows.push(['Spolu', b.sucty.podstKs + ' ks', '', '', n3(b.sucty.podstObjem)]);
    rows.push([]);
    rows.push(['SCHODNICE']);
    rows.push(['Názov', 'Stupne', 'Prírez dĺžka [mm]', 'Prírez šírka [mm]', 'Hrúbka [mm]', 'Objem [m³]']);
    for (const s of b.schodnice) rows.push([s.nazov, s.stupne, n0(s.dlzka), n0(s.sirka), n0(s.hrubka), n3(s.objem)]);
    if (b.zabradlie) {
      rows.push([]);
      rows.push(['ZÁBRADLIE', b.zabradlie.nazov, 'výška ' + n0(b.zabradlie.HR) + ' mm']);
      rows.push(['Položka', 'Ks', 'Dĺžka / rozmer [mm]', 'Spolu', 'Poznámka']);
      for (const z of b.zabradlie.polozky) rows.push([z.nazov, z.ks, z.rozmer, z.spolu, z.pozn || '']);
    }
    if (b.dosky.length) {
      rows.push([]);
      rows.push(['ROZLOŽENIE PRÍREZOV NA DOSKY', 'doska ' + n0(inp.doskaDlzka) + ' × ' + n0(inp.doskaSirka) + ' mm', 'rez ' + n0(inp.rez) + ' mm']);
      rows.push(['Hrúbka [mm]', 'Doska č.', 'Dielec', 'X [mm]', 'Y [mm]', 'Dĺžka [mm]', 'Šírka [mm]', 'Využitie dosky']);
      for (const g of b.dosky) {
        g.boards.forEach((bd, k) => bd.parts.forEach((q, i) => rows.push([n0(g.hrubka), k + 1, q.n, n0(q.x), n0(q.y), n0(q.w), n0(q.h), i === 0 ? fmt(bd.vyuzitie * 100) + ' %' : ''])));
        for (const q of g.nevojde) rows.push([n0(g.hrubka), 'nevojde', q.n, '', '', n0(q.w), n0(q.h), '']);
        rows.push(['Spolu ' + n0(g.hrubka) + ' mm', g.boards.length + ' ks dosiek']);
      }
    }
    rows.push([]);
    rows.push(['POLOHY VÝSTUPNÝCH HRÁN OD NÁSTUPU']);
    rows.push(['Hrana', 'Vnútorná schodnica [mm]', 'Vonkajšia schodnica [mm]', 'Výška [mm]']);
    if (res.unfold) res.edges.forEach((e, i) => rows.push([i + 1, n1(res.unfold.vnutorna.pos[i] - res.unfold.vnutorna.pos[0]), n1(res.unfold.vonkajsia.pos[i] - res.unfold.vonkajsia.pos[0]), n1((i + 1) * res.h)]));
    return '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n') + '\r\n';
  }

  // ---------------------------------------------------------------- DXF R12
  let cp1250 = null;
  function encodeCP1250(str) {
    if (!cp1250) {
      cp1250 = {};
      try {
        const dec = new TextDecoder('windows-1250');
        for (let i = 128; i < 256; i++) { const ch = dec.decode(new Uint8Array([i])); if (ch && ch !== '�') cp1250[ch] = i; }
      } catch (e) { /* bez dekodéra: len ASCII */ }
    }
    const out = [];
    for (const ch of str) {
      const c = ch.codePointAt(0);
      if (c < 128) out.push(c);
      else if (cp1250[ch] != null) out.push(cp1250[ch]);
      else {
        const nd = ch.normalize ? ch.normalize('NFD').replace(/[̀-ͯ]/g, '') : '?';
        for (const x of (nd && nd.charCodeAt(0) < 128 ? nd : '?')) out.push(x.charCodeAt(0));
      }
    }
    return new Uint8Array(out);
  }
  function dxfText(s) {
    return String(s).replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/±/g, '%%p')
      .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/⌒/g, '').replace(/▲/g, '^').replace(/–/g, '-').replace(/[\r\n]/g, ' ');
  }

  function dxfEntities(items, w, dash) {
    const n = x => (Math.round(x * 1e4) / 1e4).toString();
    for (const it of items) {
      if (it.noExport) continue;
      const lt = it.dash === '-' ? 'DASHED' : it.dash === '-.' ? 'DASHDOT' : null;
      const layerLt = (D.LAYERS.find(l => l.name === it.L) || {}).lt;
      const ltCode = lt && lt !== layerLt ? ['6', lt] : (!lt && layerLt !== 'CONTINUOUS' ? ['6', 'CONTINUOUS'] : []);
      if (it.k === 'pl') {
        if (it.v.length < 2) continue;
        if (it.v.length === 2 && !it.c && Math.abs(it.v[0].b) < 1e-12) {
          w('0', 'LINE', '8', it.L, ...ltCode, '10', n(it.v[0].x), '20', n(it.v[0].y), '30', '0', '11', n(it.v[1].x), '21', n(it.v[1].y), '31', '0');
          continue;
        }
        w('0', 'POLYLINE', '8', it.L, ...ltCode, '66', '1', '10', '0', '20', '0', '30', '0', '70', it.c ? '1' : '0');
        for (const q of it.v) {
          const extra = Math.abs(q.b) > 1e-12 ? ['42', n(q.b)] : [];
          w('0', 'VERTEX', '8', it.L, '10', n(q.x), '20', n(q.y), '30', '0', ...extra);
        }
        w('0', 'SEQEND', '8', it.L);
      } else if (it.k === 'ci') {
        w('0', 'CIRCLE', '8', it.L, '10', n(it.x), '20', n(it.y), '30', '0', '40', n(it.r));
      } else if (it.k === 'tx') {
        const hj = it.al === 'l' ? 0 : it.al === 'r' ? 2 : 1;
        const vj = it.vmid ? 2 : 1;
        w('0', 'TEXT', '8', it.L, '10', n(it.x), '20', n(it.y), '30', '0', '40', n(it.h), '1', dxfText(it.s),
          ...(it.ang ? ['50', n(it.ang)] : []), '72', String(hj), '11', n(it.x), '21', n(it.y), '31', '0', '73', String(vj));
      }
    }
  }

  function dxfLayout(res) {
    const sections = [];
    const plan = D.plan(res, { ts: 25 });
    if (!plan.bbox) return { sections, bbox: null };
    sections.push({ items: plan.items, dx: 0, dy: 0, bb: plan.bbox });
    const pb = plan.bbox;
    const title = (x, y, s, h) => ({ k: 'tx', x, y, s, h, L: 'TEXT', al: 'l', ang: 0 });
    const head = [title(pb.minX, pb.maxY + 300, 'PÔDORYS – ' + res.typNazov + ' (mm, kreslené 1:1)', 120)];
    sections.push({ items: head, dx: 0, dy: 0 });
    if (res.unfold) {
      const u = D.unfold(res, { ts: 20 });
      const dy = pb.minY - 1500 - u.bbox.maxY;
      const dx = pb.minX - u.bbox.minX;
      sections.push({ items: u.items, dx, dy });
      sections.push({ items: [title(pb.minX, dy + u.bbox.maxY + 250, 'ROZVINUTIE SCHODNÍC', 120)], dx: 0, dy: 0 });
    }
    if (res.treads && res.treads.length) {
      const pl = D.partsLayout(res, 10, 6000);
      const x0 = pb.maxX + 2500, y0 = pb.maxY;
      for (const p of pl) sections.push({ items: p.items, dx: x0 + p.x, dy: y0 - p.y - p.h - 200 });
      sections.push({ items: [title(x0, y0 + 250, 'DIELCE – tvary stupňov 1:1 (vrstva DIELCE), nástupná hrana dole', 120)], dx: 0, dy: 0 });
    }
    return { sections };
  }

  function dxf(res) {
    const lines = [];
    const w = (...a) => { for (const x of a) lines.push(String(x)); };
    const L = dxfLayout(res);
    const all = [];
    for (const s of L.sections) all.push(...D.moveItems(s.items, s.dx, s.dy));
    const bb = D.itemsBBox(all) || { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    const n = x => (Math.round(x * 1e3) / 1e3).toString();
    // HEADER
    w('0', 'SECTION', '2', 'HEADER',
      '9', '$ACADVER', '1', 'AC1009',
      '9', '$DWGCODEPAGE', '3', 'ANSI_1250',
      '9', '$INSBASE', '10', '0', '20', '0', '30', '0',
      '9', '$EXTMIN', '10', n(bb.minX), '20', n(bb.minY), '30', '0',
      '9', '$EXTMAX', '10', n(bb.maxX), '20', n(bb.maxY), '30', '0',
      '9', '$LIMMIN', '10', n(bb.minX), '20', n(bb.minY),
      '9', '$LIMMAX', '10', n(bb.maxX), '20', n(bb.maxY),
      '9', '$LTSCALE', '40', '1',
      '9', '$MEASUREMENT', '70', '1',
      '9', '$INSUNITS', '70', '4',
      '0', 'ENDSEC');
    // TABLES
    w('0', 'SECTION', '2', 'TABLES');
    w('0', 'TABLE', '2', 'VPORT', '70', '1',
      '0', 'VPORT', '2', '*ACTIVE', '70', '0', '10', '0', '20', '0', '11', '1', '21', '1',
      '12', n((bb.minX + bb.maxX) / 2), '22', n((bb.minY + bb.maxY) / 2), '13', '0', '23', '0', '14', '10', '24', '10', '15', '10', '25', '10',
      '16', '0', '26', '0', '36', '1', '17', '0', '27', '0', '37', '0', '40', n(bb.h * 1.1 || 1000), '41', '1.6', '42', '50', '43', '0', '44', '0', '50', '0', '51', '0',
      '71', '0', '72', '100', '73', '1', '74', '3', '75', '0', '76', '0', '77', '0', '78', '0',
      '0', 'ENDTAB');
    w('0', 'TABLE', '2', 'LTYPE', '70', '3',
      '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
      '0', 'LTYPE', '2', 'DASHED', '70', '0', '3', '__ __ __', '72', '65', '73', '2', '40', '45.0', '49', '30.0', '49', '-15.0',
      '0', 'LTYPE', '2', 'DASHDOT', '70', '0', '3', '__ . __ .', '72', '65', '73', '4', '40', '80.0', '49', '50.0', '49', '-15.0', '49', '0.0', '49', '-15.0',
      '0', 'ENDTAB');
    w('0', 'TABLE', '2', 'LAYER', '70', String(D.LAYERS.length + 1),
      '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS');
    for (const l of D.LAYERS) w('0', 'LAYER', '2', l.name, '70', '0', '62', String(l.color), '6', l.lt);
    w('0', 'ENDTAB');
    w('0', 'TABLE', '2', 'STYLE', '70', '1',
      '0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0.0', '41', '1.0', '50', '0.0', '71', '0', '42', '2.5', '3', 'txt', '4', '',
      '0', 'ENDTAB');
    w('0', 'ENDSEC');
    w('0', 'SECTION', '2', 'BLOCKS', '0', 'ENDSEC');
    w('0', 'SECTION', '2', 'ENTITIES');
    dxfEntities(all, w);
    w('0', 'ENDSEC', '0', 'EOF');
    // skupinový kód odsadený podľa konvencie
    const out = [];
    for (let i = 0; i < lines.length; i += 2) {
      const code = lines[i];
      out.push((code.length < 3 ? '   '.slice(code.length) : '') + code);
      out.push(lines[i + 1] != null ? lines[i + 1] : '');
    }
    return encodeCP1250(out.join('\r\n') + '\r\n');
  }

  // ---------------------------------------------------------------- PDF (jsPDF, A3 na šírku)
  const PAGE = { w: 420, h: 297, m: 10 };
  const SCALES = [10, 20, 25, 50, 100, 200];
  const COLORS = {
    stena: [217, 221, 227], stupen: [244, 239, 230], podesta: [231, 239, 224], schodnica: [240, 228, 212],
    STENA: [75, 85, 99], VYSTUPNA_CIARA: [194, 65, 12], KOTY: [47, 125, 79], PODSTUPNICE: [100, 116, 139], SCHODNICA: [138, 90, 43], STROP: [124, 58, 237], err: [220, 38, 38]
  };
  const LW = { tenka: 0.13, stredna: 0.3, hruba: 0.5 };

  function pdf(res, jsPDF, fonts, opt) {
    opt = opt || {};
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
    let FONT = 'helvetica';
    if (fonts && fonts.regular) {
      doc.addFileToVFS('DejaVuSans.ttf', fonts.regular);
      doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
      if (fonts.bold) { doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold); doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold'); }
      FONT = 'DejaVu';
    }
    doc.setFont(FONT, 'normal');
    const inp = res.input;
    const date = opt.datum || new Date().toLocaleDateString('sk-SK');
    const pages = [];   // {kreslenie: fn, nazov, mierka}

    const setFont = (bold, size) => { doc.setFont(FONT, bold && fonts && fonts.bold ? 'bold' : 'normal'); doc.setFontSize(size); };
    const PT = 2.8346; // pt na mm
    // text s výškou v mm papiera (výška veľkých písmen ~ 0.72 em)
    function ptext(s, x, y, hmm, o) {
      o = o || {};
      setFont(o.bold, hmm / 0.72 * PT);
      const ang = (o.ang || 0) * DEG;
      const wdt = doc.getTextWidth(String(s));
      const f = o.al === 'l' ? 0 : o.al === 'r' ? 1 : 0.5;
      // posun v smere textu (na papieri: y dole)
      const dx = Math.cos(ang), dy = -Math.sin(ang);
      let X = x - dx * wdt * f, Y = y - dy * wdt * f;
      if (o.vmid) { X += Math.sin(ang) * hmm / 2; Y += Math.cos(ang) * hmm / 2; } // stred výšky písmen na bode
      doc.text(String(s), X, Y, ang ? { angle: o.ang } : undefined);
    }

    function drawItems(items, T, scale) {
      for (const it of items) {
        if (it.k === 'pl') {
          if (it.v.length < 2) continue;
          const pts = C.sampleVerts(it.v, it.c, 3 * DEG).map(T);
          const fill = it.fill && it.fill !== 'cur' ? COLORS[it.fill] : null;
          const col = it.err ? COLORS.err : (COLORS[it.L] || [29, 39, 51]);
          let style = 'S';
          if (it.fill === 'cur') { doc.setFillColor(col[0], col[1], col[2]); style = 'F'; }
          else if (fill) { doc.setFillColor(fill[0], fill[1], fill[2]); style = it.lw === 'none' ? 'F' : 'FD'; }
          else if (it.lw === 'none') continue;
          doc.setDrawColor(col[0], col[1], col[2]);
          doc.setLineWidth(LW[it.lw] || LW.tenka);
          if (it.dash === '-') doc.setLineDashPattern([2, 1.2], 0);
          else if (it.dash === '-.') doc.setLineDashPattern([5, 1.2, 0.6, 1.2], 0);
          else doc.setLineDashPattern([], 0);
          const d = [];
          for (let i = 1; i < pts.length; i++) d.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
          doc.lines(d, pts[0].x, pts[0].y, [1, 1], style, !!it.c);
          doc.setLineDashPattern([], 0);
        } else if (it.k === 'ci') {
          const c = T(it);
          const col = COLORS[it.L] || [29, 39, 51];
          doc.setDrawColor(col[0], col[1], col[2]);
          doc.setLineWidth(LW.tenka);
          const fill = it.fill === 'cur' ? col : (it.fill ? COLORS[it.fill] : null);
          if (fill) doc.setFillColor(fill[0], fill[1], fill[2]);
          doc.circle(c.x, c.y, it.r / scale, fill ? 'FD' : 'S');
        } else if (it.k === 'tx') {
          const c = T(it);
          const col = it.L === 'KOTY' || it.L === 'STROP' ? COLORS[it.L] : [29, 39, 51];
          doc.setTextColor(col[0], col[1], col[2]);
          ptext(it.s, c.x, c.y, it.h / scale, { al: it.al, ang: it.ang, vmid: it.vmid, bold: it.bold });
          doc.setTextColor(0, 0, 0);
        }
      }
    }

    // výber mierky a vloženie výkresu do oblasti {x,y,w,h} (papier, mm)
    function placeDrawing(make, area, scales) {
      let chosen = null;
      for (const s of scales) {
        const dr = make(s);
        if (!dr.bbox) return null;
        if (dr.bbox.w / s <= area.w && dr.bbox.h / s <= area.h) { chosen = { s, dr }; break; }
      }
      if (!chosen) { const s = scales[scales.length - 1]; chosen = { s, dr: make(s) }; }
      const { s, dr } = chosen, bb = dr.bbox;
      const ox = area.x + (area.w - bb.w / s) / 2, oy = area.y + (area.h - bb.h / s) / 2;
      const T = p => ({ x: ox + (p.x - bb.minX) / s, y: oy + (bb.maxY - p.y) / s });
      drawItems(dr.items, T, s);
      return s;
    }

    function frame() {
      doc.setDrawColor(0, 0, 0); doc.setLineDashPattern([], 0);
      doc.setLineWidth(0.5);
      doc.rect(PAGE.m, PAGE.m, PAGE.w - 2 * PAGE.m, PAGE.h - 2 * PAGE.m);
    }
    function stamp(vykres, mierka, list, listov) {
      const w = 180, h = 30, x = PAGE.w - PAGE.m - w, y = PAGE.h - PAGE.m - h;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.35);
      doc.rect(x, y, w, h, 'FD');
      doc.setLineWidth(0.18);
      const r = [y + 10, y + 20];
      doc.line(x, r[0], x + w, r[0]); doc.line(x, r[1], x + w, r[1]);
      doc.line(x + 120, y, x + 120, y + h);
      doc.line(x + 60, r[1], x + 60, y + h);
      doc.line(x + 150, r[0], x + 150, y + h);
      const lab = (s, X, Y) => { doc.setTextColor(90, 90, 90); ptext(s, X + 1.5, Y + 2.6, 1.6, { al: 'l' }); doc.setTextColor(0, 0, 0); };
      const val = (s, X, Y, hh, b) => ptext(s, X + 1.5, Y + 7.4, hh || 3, { al: 'l', bold: b });
      lab('Projekt', x, y); val(fit(inp.projekt, 60), x, y, 3.2, true);
      lab('Program', x + 120, y); val('Schodiskár', x + 120, y, 3, true);
      lab('Výkres', x, r[0]); val(vykres, x, r[0], 3);
      lab('Mierka', x + 120, r[0]); val(mierka, x + 120, r[0], 3);
      lab('Dátum', x + 150, r[0]); val(date, x + 150, r[0], 2.6);
      lab('Vypracoval', x, r[1]); val(fit(inp.vypracoval || '—', 26), x, r[1], 2.8);
      lab('Typ schodiska', x + 60, r[1]); val(fit(shortType(), 30), x + 60, r[1], 2.4);
      lab('List', x + 150, r[1]); val(list + ' / ' + listov, x + 150, r[1], 3);
    }
    function fit(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
    function shortType() { return { rovne: 'rovné', L: 'L, klinové stupne', U: 'U, klinové stupne', U3: 'U s 3 ramenami, klinové', Lp: 'L s podestou', Up: 'U s podestou', tocite: 'točité vretenové' }[inp.typ] + (inp.typ !== 'rovne' ? ', ' + (inp.smer === 'vpravo' ? 'vpravo' : 'vľavo') : ''); }

    function table(x, y, colW, rows, o) {
      o = o || {};
      const rh = o.rh || 5.2;
      let yy = y;
      rows.forEach((row, i) => {
        const head = o.head && i === 0;
        if (head) { doc.setFillColor(236, 238, 241); doc.rect(x, yy, colW.reduce((a, b) => a + b, 0), rh, 'F'); }
        let xx = x;
        row.forEach((cell, j) => {
          const c = cell && typeof cell === 'object' ? cell : { t: cell };
          if (c.color) doc.setTextColor(c.color[0], c.color[1], c.color[2]);
          const al = c.al || (o.align && o.align[j]) || 'l';
          const tx = al === 'r' ? xx + colW[j] - 1.2 : xx + 1.2;
          ptext(c.t == null ? '' : String(c.t), tx, yy + rh * 0.68, o.th || 2.1, { al, bold: head || c.b });
          doc.setTextColor(0, 0, 0);
          xx += colW[j];
        });
        doc.setDrawColor(200, 204, 210); doc.setLineWidth(0.1);
        doc.line(x, yy + rh, x + colW.reduce((a, b) => a + b, 0), yy + rh);
        yy += rh;
      });
      return yy;
    }

    const okCol = [21, 128, 61], warnCol = [180, 83, 9], errCol = [185, 28, 28];

    // --- list: pôdorys
    pages.push(() => {
      const area = { x: PAGE.m + 4, y: PAGE.m + 12, w: 270, h: PAGE.h - 2 * PAGE.m - 18 };
      const s = placeDrawing(sc => D.plan(res, { ts: sc }), area, [20, 25, 50, 100, 200]);
      setFont(true, 14); ptext('PÔDORYS', PAGE.m + 5, PAGE.m + 8, 4, { al: 'l', bold: true });
      ptext(res.typNazov, PAGE.m + 40, PAGE.m + 8, 2.8, { al: 'l' });
      // pravý panel
      const px = 292, pw = 118;
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.line(px - 3, PAGE.m, px - 3, PAGE.h - PAGE.m - 30);
      let y = PAGE.m + 4;
      ptext('PARAMETRE', px, y + 3, 3, { al: 'l', bold: true }); y += 6;
      const par = paramRows(res);
      y = table(px, y, [62, 56], par, { align: ['l', 'r'] });
      y += 6;
      ptext('KONTROLY', px, y + 3, 3, { al: 'l', bold: true }); y += 6;
      const kr = [['Kontrola', 'Hodnota', 'Limit', '']];
      for (const c of res.checks) kr.push([c.nazov.replace('od vnútornej hrany', 'od vnút. hrany'), c.hodnota, c.limit, { t: c.ok ? 'OK' : (c.level === 'err' ? 'CHYBA' : 'POZOR'), color: c.ok ? okCol : (c.level === 'err' ? errCol : warnCol), b: true }]);
      y = table(px, y, [50, 30, 26, 12], kr, { head: true, th: 1.9 });
      y += 4;
      const stav = res.stav === 'ok' ? 'Stav: OK – všetky kontroly splnené' : res.stav === 'chyba' ? 'Stav: CHYBA' : 'Stav: POZOR – niektoré limity nie sú splnené';
      doc.setTextColor(...(res.stav === 'ok' ? okCol : res.stav === 'chyba' ? errCol : warnCol));
      ptext(stav, px, y + 3, 2.6, { al: 'l', bold: true });
      doc.setTextColor(0, 0, 0);
      y += 7;
      for (const m of res.errors.concat(res.warnings)) {
        const lines = doc.splitTextToSize(m, pw);
        setFont(false, 2.1 / 0.72 * PT);
        for (const ln of lines) { if (y > PAGE.h - PAGE.m - 34) break; ptext(ln, px, y + 2, 2.1, { al: 'l' }); y += 3.6; }
        y += 1;
      }
      // legenda
      y = Math.max(y, PAGE.h - PAGE.m - 62);
      ptext('Legenda', px, y, 2.4, { al: 'l', bold: true });
      const leg = [['VYSTUPNA_CIARA', '-.', 'výstupná čiara (• nástup, ▶ výstup)'], ['STUPNE', null, 'výstupná hrana (s presahom)'], ['PODSTUPNICE', '-', 'podstupnica'], ['KOTY', null, 'kóty pri stene, mm']];
      if (res.strop) leg.push(['STROP', '-', inp.otvor > 0 ? 'hrana otvoru v strope' : 'najmenší potrebný otvor v strope']);
      leg.forEach((l, i) => {
        const yy = y + 4 + i * 4.2;
        const col = COLORS[l[0]] || [29, 39, 51];
        doc.setDrawColor(...col); doc.setLineWidth(0.3);
        if (l[1] === '-') doc.setLineDashPattern([2, 1.2], 0); else if (l[1] === '-.') doc.setLineDashPattern([5, 1.2, 0.6, 1.2], 0);
        doc.line(px, yy - 0.8, px + 12, yy - 0.8);
        doc.setLineDashPattern([], 0);
        ptext(l[2], px + 15, yy, 2, { al: 'l' });
      });
      return { vykres: 'Pôdorys schodiska', mierka: '1 : ' + s };
    });

    // --- list: 3D vizualizácia (obrázky z prehliadača)
    if (opt.images && opt.images.length) pages.push(() => {
      ptext('3D VIZUALIZÁCIA', PAGE.m + 5, PAGE.m + 8, 4, { al: 'l', bold: true });
      const im = opt.images;
      const big = { x: PAGE.m + 5, y: PAGE.m + 14, w: 268, h: 167.5 };
      doc.addImage(im[0].url, 'JPEG', big.x, big.y, big.w, big.h);
      doc.setDrawColor(200, 204, 210); doc.setLineWidth(0.2); doc.rect(big.x, big.y, big.w, big.h);
      ptext(im[0].nazov, big.x, big.y + big.h + 5, 2.6, { al: 'l', bold: true });
      const sx = big.x + big.w + 8, sw = PAGE.w - PAGE.m - 5 - sx, sh = sw / 1.6;
      let y = big.y;
      for (const one of im.slice(1, 3)) {
        doc.addImage(one.url, 'JPEG', sx, y, sw, sh);
        doc.setDrawColor(200, 204, 210); doc.rect(sx, y, sw, sh);
        ptext(one.nazov, sx, y + sh + 4.5, 2.4, { al: 'l', bold: true });
        y += sh + 10;
      }
      if (opt.vizText) {
        let ty = big.y + big.h + 12;
        ptext('Materiály', big.x, ty, 3, { al: 'l', bold: true }); ty += 2;
        table(big.x, ty, [40, 120], opt.vizText, {});
      }
      ptext('Ilustračná vizualizácia – farby a štruktúry materiálov sú orientačné.', big.x, PAGE.h - PAGE.m - 34, 2.2, { al: 'l' });
      return { vykres: '3D vizualizácia', mierka: '—' };
    });

    // --- list: rozvinutie
    if (res.unfold) pages.push(() => {
      const area = { x: PAGE.m + 4, y: PAGE.m + 12, w: PAGE.w - 2 * PAGE.m - 8, h: PAGE.h - 2 * PAGE.m - 50 };
      // zvoliť usporiadanie (pod sebou / vedľa seba) s väčšou mierkou
      let lay = 'v';
      for (const sc of [20, 25, 50, 100, 200]) {
        const fits = l => { const b = D.unfold(res, { ts: sc, layout: l }).bbox; return b.w / sc <= area.w && b.h / sc <= area.h; };
        if (fits('v')) { lay = 'v'; break; }
        if (fits('h')) { lay = 'h'; break; }
      }
      const s = placeDrawing(sc => D.unfold(res, { ts: sc, layout: lay }), area, [20, 25, 50, 100, 200]);
      ptext('ROZVINUTIE SCHODNÍC', PAGE.m + 5, PAGE.m + 8, 4, { al: 'l', bold: true });
      ptext('Kóty pod profilom = poloha výstupnej hrany od nástupu, merané po hrane (na rysovanie). Hnedou = orientačný tvar schodnice šírky ' + fmt(inp.sirkaSchodnice) + ' mm.', PAGE.m + 5, PAGE.h - PAGE.m - 34, 2.2, { al: 'l' });
      return { vykres: 'Rozvinutie vnútornej a vonkajšej schodnice', mierka: '1 : ' + s };
    });

    // --- listy: dielce 1:10
    if (res.treads && res.treads.length) {
      const S = 10;
      const areaW = (PAGE.w - 2 * PAGE.m - 12) * S, areaH = (PAGE.h - 2 * PAGE.m - 52) * S;
      const placed = D.partsLayout(res, S, areaW, areaH);
      const nPages = placed.length ? placed[placed.length - 1].page + 1 : 0;
      for (let pg = 0; pg < nPages; pg++) {
        const mine = placed.filter(p => p.page === pg);
        pages.push(() => {
          ptext('DIELCE – STUPNE', PAGE.m + 5, PAGE.m + 8, 4, { al: 'l', bold: true });
          ptext('Tvary stupňov s presahom, nástupná hrana dole. Čiarkovane = prírez. Rozmery v mm.', PAGE.m + 60, PAGE.m + 8, 2.4, { al: 'l' });
          const ox = PAGE.m + 6, oy = PAGE.m + 16;
          for (const p of mine) {
            const T = q => ({ x: ox + (p.x + q.x) / S, y: oy + (p.y + p.h - q.y) / S });
            drawItems(p.items, T, S);
          }
          return { vykres: 'Dielce – stupne' + (nPages > 1 ? ' (' + (pg + 1) + '/' + nPages + ')' : ''), mierka: '1 : 10' };
        });
      }
    }

    // --- list: rozpis materiálu
    pages.push(() => {
      const b = bom(res);
      ptext('ROZPIS MATERIÁLU', PAGE.m + 5, PAGE.m + 8, 4, { al: 'l', bold: true });
      let y = PAGE.m + 14;
      const x = PAGE.m + 5;
      const rows = [['Č.', 'Druh', 'Prírez d × š × t [mm]', 'Plocha [m²]', 'Objem [m³]', 'Š. vnútri', 'Š. výst. č.', 'Š. vonku', 'Š. ' + inp.lim.klinVzd + ' mm']];
      for (const s of b.stupne) rows.push([s.n, s.druh, fmt(s.dlzka) + ' × ' + fmt(s.sirka) + ' × ' + fmt(s.hrubka), fmt(s.plocha, 3), fmt(s.objem, 4), fmt(s.vnutri, 1), fmt(s.vystup, 1), fmt(s.vonku, 1), s.kontrola == null ? '' : fmt(s.kontrola, 1)]);
      rows.push([{ t: 'Spolu', b: true }, b.sucty.stupneKs + ' ks', '', '', { t: fmt(b.sucty.stupneObjem, 3), b: true }, '', '', '', '']);
      ptext('Stupne', x, y + 3, 3, { al: 'l', bold: true }); y += 5;
      const rh = Math.min(5, Math.max(3.6, 200 / (rows.length + 20)));
      y = table(x, y, [10, 18, 46, 26, 28, 22, 24, 18, 26], rows, { head: true, align: ['r', 'l', 'l', 'r', 'r', 'r', 'r', 'r', 'r'], rh, th: Math.min(2.1, rh * 0.45) });
      // podstupnice a schodnice vpravo
      const x2 = PAGE.m + 236;
      let y2 = PAGE.m + 14;
      ptext('Podstupnice', x2, y2 + 3, 3, { al: 'l', bold: true }); y2 += 5;
      const pr = [['Č.', 'Dĺžka', 'Výška', 'Hrúbka', 'Objem [m³]']];
      for (const s of b.podst) pr.push([s.n, fmt(s.dlzka), fmt(s.vyska), fmt(s.hrubka), fmt(s.objem, 4)]);
      pr.push([{ t: 'Spolu', b: true }, b.sucty.podstKs + ' ks', '', '', { t: fmt(b.sucty.podstObjem, 3), b: true }]);
      y2 = table(x2, y2, [12, 30, 26, 24, 32], pr, { head: true, align: ['r', 'r', 'r', 'r', 'r'], rh, th: Math.min(2.1, rh * 0.45) });
      y = Math.max(y, y2) + 8;
      if (y > PAGE.h - PAGE.m - 70) y = PAGE.h - PAGE.m - 70;
      ptext('Schodnice', x, y + 3, 3, { al: 'l', bold: true }); y += 5;
      const sr = [['Názov', 'Stupne', 'Prírez d × š × t [mm]', 'Objem [m³]']];
      for (const s of b.schodnice) sr.push([s.nazov, s.stupne, fmt(s.dlzka) + ' × ' + fmt(s.sirka) + ' × ' + fmt(s.hrubka), fmt(s.objem, 3)]);
      table(x, y, [92, 22, 56, 28], sr, { head: true, align: ['l', 'l', 'l', 'r'] });
      ptext('Prírezy sú obdĺžniky natočené podľa nástupnej hrany, bez prídavkov na opracovanie. Podstupnice: výška = h − hrúbka stupňa.', x, PAGE.h - PAGE.m - 34, 2.2, { al: 'l' });
      return { vykres: 'Rozpis materiálu', mierka: '—' };
    });

    // --- listy: zábradlie a rozloženie prírezov na dosky
    {
      const b = bom(res);
      const groups = [];
      for (const g of b.dosky) g.boards.forEach((bd, k) => groups.push({ g, bd, k }));
      const SC = Math.max(10, [10, 20, 25, 50].find(sc => inp.doskaDlzka / sc <= 190 && inp.doskaSirka / sc <= 60) || 50);
      const cellW = inp.doskaDlzka / SC, cellH = inp.doskaSirka / SC + 9;
      const top0 = PAGE.m + 16 + (b.zabradlie ? 12 + 5.2 * (b.zabradlie.polozky.length + 1) : 0);
      const cols = Math.max(1, Math.floor((PAGE.w - 2 * PAGE.m - 10 + 8) / (cellW + 8)));
      const rowsFirst = Math.max(0, Math.floor((PAGE.h - PAGE.m - 36 - top0) / (cellH + 4)));
      const rowsNext = Math.max(1, Math.floor((PAGE.h - PAGE.m - 36 - PAGE.m - 16) / (cellH + 4)));
      const chunks = [];
      let rest = groups.slice(), first = true;
      while (first || rest.length) {
        const n = (first ? rowsFirst : rowsNext) * cols;
        chunks.push(rest.slice(0, n)); rest = rest.slice(n); first = false;
        if (n === 0 && !rest.length) break;
      }
      if (b.zabradlie || groups.length) chunks.forEach((chunk, ci) => pages.push(() => {
        const x = PAGE.m + 5;
        let y = PAGE.m + 14;
        if (ci === 0) {
          ptext(b.zabradlie ? 'ZÁBRADLIE A ROZLOŽENIE NA DOSKY' : 'ROZLOŽENIE PRÍREZOV NA DOSKY', x, PAGE.m + 8, 4, { al: 'l', bold: true });
          if (b.zabradlie) {
            ptext(b.zabradlie.nazov + ', výška madla ' + fmt(b.zabradlie.HR) + ' mm nad hranou stupňa', x, y + 3, 2.6, { al: 'l', bold: true }); y += 5;
            const zr = [['Položka', 'Ks', 'Dĺžka / rozmer [mm]', 'Spolu', 'Poznámka']];
            for (const z of b.zabradlie.polozky) zr.push([z.nazov, String(z.ks), z.rozmer, z.spolu, z.pozn || '']);
            y = table(x, y, [70, 14, 50, 32, 120], zr, { head: true, align: ['l', 'r', 'l', 'r', 'l'] }) + 6;
          }
          y = top0 - 6;
          if (groups.length) ptext('Doska ' + fmt(inp.doskaDlzka) + ' × ' + fmt(inp.doskaSirka) + ' mm, rez ' + fmt(inp.rez) + ' mm. Obdĺžnikové prírezy, vlákna po dĺžke dosky. ' + b.dosky.map(g => fmt(g.hrubka) + ' mm: ' + g.boards.length + ' ks' + (g.nevojde.length ? ' (' + g.nevojde.length + ' nevojde)' : '')).join(', '), x, y + 3, 2.4, { al: 'l' });
          y += 6;
        } else {
          ptext('ROZLOŽENIE PRÍREZOV NA DOSKY (pokračovanie)', x, PAGE.m + 8, 4, { al: 'l', bold: true });
          y = PAGE.m + 16;
        }
        chunk.forEach((it, i) => {
          const cx = x + (i % cols) * (cellW + 8), cy = y + Math.floor(i / cols) * (cellH + 4);
          ptext('Hrúbka ' + fmt(it.g.hrubka) + ' mm · doska ' + (it.k + 1) + ' · využitie ' + fmt(it.bd.vyuzitie * 100) + ' %', cx, cy + 3, 2.2, { al: 'l', bold: true });
          const by = cy + 5;
          doc.setDrawColor(90, 90, 90); doc.setLineWidth(0.25); doc.setFillColor(248, 248, 246);
          doc.rect(cx, by, inp.doskaDlzka / SC, inp.doskaSirka / SC, 'FD');
          for (const q of it.bd.parts) {
            doc.setLineWidth(0.18); doc.setFillColor(244, 233, 214); doc.setDrawColor(138, 90, 43);
            doc.rect(cx + q.x / SC, by + q.y / SC, q.w / SC, q.h / SC, 'FD');
            const lab = q.n + (q.w / SC > 22 ? ' ' + fmt(q.w) + '×' + fmt(q.h) : '');
            if (q.h / SC > 2.6 && q.w / SC > 5) ptext(lab, cx + (q.x + q.w / 2) / SC, by + (q.y + q.h / 2) / SC, Math.min(1.8, q.h / SC * 0.4), { vmid: true });
          }
        });
        return { vykres: 'Zábradlie, rozloženie na dosky', mierka: groups.length ? '1 : ' + SC : '—' };
      }));
    }

    pages.forEach((fn, i) => {
      if (i > 0) doc.addPage('a3', 'landscape');
      frame();
      const info = fn();
      stamp(info.vykres, info.mierka, i + 1, pages.length);
    });
    doc.setProperties({ title: 'Schodiskár – ' + inp.projekt, creator: 'Schodiskár' });
    return doc;
  }

  function paramRows(res) {
    const inp = res.input;
    const r = [];
    r.push(['Typ', res.typNazov]);
    if (inp.typ !== 'rovne') r.push(['Zákruta', inp.smer === 'vpravo' ? 'vpravo' : 'vľavo']);
    r.push(['Konštrukčná výška H', fmt(inp.H) + ' mm']);
    if (inp.typ === 'rovne') r.push(['Dĺžka L × šírka W', fmt(inp.L) + ' × ' + fmt(inp.W) + ' mm']);
    if (inp.typ === 'L' || inp.typ === 'Lp') r.push(['Ramená A / B, šírka W', fmt(inp.A) + ' / ' + fmt(inp.B) + ', ' + fmt(inp.W) + ' mm']);
    if (inp.typ === 'U3') r.push(['Ramená 1 / stredné / 3, šírka W', fmt(inp.R1) + ' / ' + fmt(inp.S) + ' / ' + fmt(inp.R2) + ', ' + fmt(inp.W) + ' mm']);
    if (inp.typ === 'U' || inp.typ === 'Up') { r.push(['Ramená 1 / 2, šírka W', fmt(inp.R1) + ' / ' + fmt(inp.R2) + ', ' + fmt(inp.W) + ' mm']); r.push(['Zrkadlo', fmt(inp.M) + ' mm']); }
    if (inp.typ === 'tocite') { r.push(['Polomer vonk. / stĺpa', fmt(inp.Rv) + ' / ' + fmt(inp.Rs) + ' mm']); r.push(['Celkové otočenie', fmt(inp.uhol) + '°']); }
    if (['L', 'U', 'U3', 'Lp', 'Up'].includes(inp.typ)) r.push(['Polomer vnútorného rohu', fmt(inp.r) + ' mm']);
    if (res.N) {
      r.push(['Počet výšok N × h', res.N + ' × ' + fmt(res.h, 1) + ' mm' + (res.autoN ? ' (auto)' : '')]);
      r.push(['Počet stupňov', String(res.N - 1) + (res.podesta ? ' (vrátane podesty)' : '')]);
      r.push(['Šírka stupňa b (výst. čiara)', fmt(res.b, 1) + ' mm']);
      r.push(['Krokový modul 2h + b', fmt(res.krok, 1) + ' mm']);
      r.push(['Sklon', fmt(res.sklon, 1) + '°']);
      r.push(['Výstupná čiara od vnútra', fmt(res.w) + ' mm']);
      r.push(['Dĺžka výstupnej čiary', fmt(res.Lw) + ' mm']);
      if (inp.typ === 'L' || inp.typ === 'U' || inp.typ === 'U3') r.push(['Vyrovnané stupne pred/za', String(inp.nb)]);
      if (res.najuzsiKlin) r.push(['Najužší klin (' + inp.lim.klinVzd + ' mm)', fmt(res.najuzsiKlin.hodnota, 1) + ' mm (st. ' + res.najuzsiKlin.stupen + ')']);
      if (res.podchod != null) r.push(['Podchodná výška', fmt(res.podchod) + ' mm']);
      r.push(['Presah / hrúbka stupňa', fmt(inp.presah) + ' / ' + fmt(inp.hrubka) + ' mm']);
      if (res.podlaha && (res.podlaha.dole || res.podlaha.hore)) {
        r.push(['Nášľapná vrstva dole / hore', fmt(res.podlaha.dole) + ' / ' + fmt(res.podlaha.hore) + ' mm']);
        r.push(['Výška hrubá – hrubá podlaha', fmt(res.podlaha.hruba) + ' mm']);
      }
      if (res.strop) {
        r.push(['Potrebný otvor v strope (výst. čiara)', isFinite(res.strop.otvorMin) ? '≥ ' + fmt(Math.ceil(res.strop.otvorMin)) + ' mm' : 'nedá sa']);
        if (inp.otvor > 0) r.push(['Otvor / podchodná výška', fmt(inp.otvor) + ' / ' + fmt(res.strop.svetla) + ' mm']);
      }
    }
    return r;
  }

  function projectJSON(input) {
    return JSON.stringify({ aplikacia: 'Schodiskár', verzia: 1, ulozene: new Date().toISOString(), vstup: input }, null, 2);
  }
  function parseProject(text) {
    const o = JSON.parse(text);
    if (o && o.vstup) return C.normalize(o.vstup);
    if (o && o.typ) return C.normalize(o);
    throw new Error('Súbor neobsahuje projekt Schodiskára.');
  }

  return { bom, csv, dxf, pdf, paramRows, projectJSON, parseProject, encodeCP1250 };
});
