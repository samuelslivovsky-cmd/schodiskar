/*
 * Schodiskár – výkresové primitívy (pôdorys, rozvinutie, dielce) a SVG výstup.
 * Primitíva sú v súradniciach modelu (mm, os y hore):
 *   {k:'pl', v:[{x,y,b}], c:uzavretá, L:vrstva, lw:'tenka'|'stredna'|'hruba', dash:'-'|'-.'|null, fill, n}
 *   {k:'tx', x, y, s:text, h:výška textu (mm modelu), L, al:'l'|'c'|'r', ang:°}
 *   {k:'ci', x, y, r, L, fill}
 */
(function (root, factory) {
  const C = (typeof module === 'object' && module.exports) ? require('./core.js') : root.SchodyCore;
  const m = factory(C);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.SchodyDraw = m;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const DEG = Math.PI / 180;
  const fmt = C.fmt;

  const LAYERS = [
    { name: 'STENA', color: 8, lt: 'CONTINUOUS' },
    { name: 'OBRYS', color: 7, lt: 'CONTINUOUS' },
    { name: 'STUPNE', color: 5, lt: 'CONTINUOUS' },
    { name: 'PODSTUPNICE', color: 4, lt: 'DASHED' },
    { name: 'VYSTUPNA_CIARA', color: 1, lt: 'DASHDOT' },
    { name: 'KOTY', color: 3, lt: 'CONTINUOUS' },
    { name: 'TEXT', color: 7, lt: 'CONTINUOUS' },
    { name: 'ROZVINUTIE', color: 6, lt: 'CONTINUOUS' },
    { name: 'SCHODNICA', color: 30, lt: 'CONTINUOUS' },
    { name: 'DIELCE', color: 2, lt: 'CONTINUOUS' }
  ];

  const P = (x, y) => ({ x, y });
  const sub = (a, b) => P(a.x - b.x, a.y - b.y);
  const add = (a, b) => P(a.x + b.x, a.y + b.y);
  const mul = (a, k) => P(a.x * k, a.y * k);
  const len = a => Math.hypot(a.x, a.y);
  const norm = a => { const l = len(a) || 1; return P(a.x / l, a.y / l); };
  const perp = a => P(-a.y, a.x);
  const vv = pts => pts.map(p => ({ x: p.x, y: p.y, b: 0 }));

  function pl(v, o) { return Object.assign({ k: 'pl', v, c: false, L: 'OBRYS', lw: 'tenka', dash: null }, o || {}); }
  function line(a, b, o) { return pl(vv([a, b]), o); }
  function tx(x, y, s, h, o) { return Object.assign({ k: 'tx', x, y, s: String(s), h, L: 'TEXT', al: 'c', ang: 0 }, o || {}); }

  function pointInPoly(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  // lineárna kóta: a, b body, n jednotkový smer odsadenia, off odsadenie, ts = mierka textu
  function dim(a, b, n, off, text, ts, o) {
    o = o || {};
    const items = [];
    const ext = 2 * ts, gap = 1 * ts;
    const a2 = add(a, mul(n, off)), b2 = add(b, mul(n, off));
    const L = 'KOTY';
    if (!o.noExt) {
      items.push(line(add(a, mul(n, gap)), add(a2, mul(n, ext * 0.6)), { L }));
      items.push(line(add(b, mul(n, gap)), add(b2, mul(n, ext * 0.6)), { L }));
    }
    items.push(line(a2, b2, { L }));
    // šikmé značky
    const d = norm(sub(b2, a2));
    const tk = mul(norm(add(d, n)), 1.2 * ts);
    items.push(line(sub(a2, tk), add(a2, tk), { L, lw: 'stredna' }));
    items.push(line(sub(b2, tk), add(b2, tk), { L, lw: 'stredna' }));
    let ang = Math.atan2(d.y, d.x) / DEG;
    let side = n;
    if (ang > 90.01 || ang < -89.99) { ang += 180; }
    if (ang > 180) ang -= 360;
    const h = (o.h || 2.2) * ts;
    const mid = mul(add(a2, b2), 0.5);
    const tp = add(mid, mul(side, h * 0.75));
    items.push(tx(tp.x, tp.y, text, h, { L, ang, vmid: true }));
    return items;
  }

  function arrow(at, dir, size, o) {
    const d = norm(dir), n = perp(d);
    const tip = at, base = sub(at, mul(d, size));
    return pl(vv([tip, add(base, mul(n, size * 0.35)), sub(base, mul(n, size * 0.35))]), Object.assign({ c: true, fill: 'cur' }, o));
  }

  // ---------------------------------------------------------------- pôdorys
  function plan(res, opt) {
    opt = opt || {};
    const items = [];
    if (!res.geom) return { items, bbox: null };
    const G = res.geom, inp = res.input;
    const outlinePts = C.sampleVerts(G.outline, true, 4 * DEG);
    const bb0 = C.bbox(outlinePts);
    const ts = opt.ts || Math.max(bb0.w, bb0.h) / 160; // mm modelu na 1 mm papiera
    const th = 2.5 * ts;

    // stena: pás za vonkajšou hranou
    if (G.hasWall) {
      const wall = C.sampleVerts(G.wall, false, 4 * DEG);
      const t = 120;
      const off = [];
      for (let i = 0; i < wall.length; i++) {
        // normála von (od schodov)
        const i0 = Math.min(i, wall.length - 2);
        const a = wall[i0], b = wall[i0 + 1];
        let n = perp(norm(sub(b, a)));
        const test = add(mul(add(a, b), 0.5), mul(n, 5));
        if (pointInPoly(test, outlinePts)) n = mul(n, -1);
        // pri rohu predĺžiť (miter)
        let k = 1;
        if (i > 0 && i < wall.length - 1) {
          const n1 = perp(norm(sub(wall[i], wall[i - 1]))), n2 = perp(norm(sub(wall[i + 1], wall[i])));
          const cosHalf = Math.sqrt(Math.max(0.01, (1 + n1.x * n2.x + n1.y * n2.y) / 2));
          k = 1 / cosHalf;
          const bis = norm(add(n1, n2));
          n = (n.x * bis.x + n.y * bis.y) > 0 ? bis : mul(bis, -1);
        }
        off.push(add(wall[i], mul(n, t * k)));
      }
      items.push(pl(vv(wall.concat(off.slice().reverse())), { c: true, L: 'STENA', fill: 'stena', lw: 'tenka' }));
      items.push(pl(G.wall, { L: 'STENA', lw: 'hruba' }));
    }
    if (G.column) items.push({ k: 'ci', x: G.column.c.x, y: G.column.c.y, r: G.column.r, L: 'OBRYS', fill: 'stena' });

    // obrys
    items.push(pl(G.outline, { c: true, L: 'OBRYS', lw: 'stredna' }));

    // stupne: plocha (hover), nástupné hrany (STUPNE), podstupnice (čiarkovane)
    for (const t of res.treads || []) {
      items.push(pl(t.poly, { c: true, L: 'STUPNE', hover: t.n, lw: 'none', fill: t.kind === 'podesta' ? 'podesta' : 'stupen', noExport: true }));
    }
    for (const t of res.treads || []) items.push(line(t.front[0], t.front[1], { L: 'STUPNE', lw: 'stredna' }));
    if (res.edges && res.edges.length) {
      const last = res.edges[res.edges.length - 1];
      items.push(line(last.P, last.Q, { L: 'STUPNE', lw: 'stredna' }));
    }
    for (const r of res.risers || []) items.push(line(r.P, r.Q, { L: 'PODSTUPNICE', dash: '-' }));
    // ručne upravené hrany (len na obrazovke)
    if (opt.edits !== false) for (const e of res.edges || []) if (e.ds || e.dt) items.push(line(e.P, e.Q, { L: 'STUPNE', lw: 'hruba', upr: true, noExport: true }));
    if (res.errors && res.errors.length && res.edges) {
      for (const e of res.edges) items.push(line(e.P, e.Q, { L: 'STUPNE', err: true, lw: 'stredna' }));
    }

    // výstupná čiara
    items.push(pl(G.walk, { L: 'VYSTUPNA_CIARA', dash: '-.', lw: 'tenka' }));
    items.push({ k: 'ci', x: G.walkStart.x, y: G.walkStart.y, r: 1.4 * ts, L: 'VYSTUPNA_CIARA', fill: 'cur' });
    items.push(arrow(G.walkEnd, G.walkEndDir, 5 * ts, { L: 'VYSTUPNA_CIARA' }));

    // čísla stupňov
    for (const t of res.treads || []) {
      const e0 = res.edges[t.n - 1], e1 = res.edges[t.n];
      const m = mul(add(e0.W, e1.W), 0.5);
      // posun mierne k vonkajšej strane od výstupnej čiary
      const d = norm(sub(e1.W, e0.W)), n = perp(d);
      const nq = norm(sub(add(e0.Q, e1.Q), add(e0.P, e1.P)));
      const side = (n.x * nq.x + n.y * nq.y) > 0 ? n : mul(n, -1);
      const p = add(m, mul(side, 2.2 * ts));
      items.push(tx(p.x, p.y, t.kind === 'podesta' ? 'P' + t.n : t.n, th, { L: 'TEXT', vmid: true, bold: true }));
    }

    // kóty
    if (opt.dims !== false && res.edges && res.edges.length) {
      const off1 = 9 * ts, off2 = 17 * ts;
      if (G.hasWall) {
        // úseky steny (len priame)
        const wv = G.wall;
        for (let i = 0; i < wv.length - 1; i++) {
          if (Math.abs(wv[i].b) > 1e-9) continue;
          const a = wv[i], b = wv[i + 1];
          const d = norm(sub(b, a));
          let n = perp(d);
          const mid = mul(add(a, b), 0.5);
          if (pointInPoly(add(mid, mul(n, 5)), outlinePts)) n = mul(n, -1);
          const extra = 150; // za stenou
          const A2 = add(a, mul(n, extra)), B2 = add(b, mul(n, extra));
          items.push(...dim(A2, B2, n, off2, fmt(len(sub(b, a))), ts, { noExt: false }));
          // reťazec polôh hrán pri stene
          const L = len(sub(b, a));
          const ps = [0];
          for (const e of res.edges) {
            const q = sub(e.Q, a), along = q.x * d.x + q.y * d.y, across = Math.abs(q.x * n.x + q.y * n.y);
            if (across < 1 && along > 1 && along < L - 1) ps.push(along);
          }
          ps.push(L);
          ps.sort((x, y) => x - y);
          if (ps.length > 2) {
            for (let k = 0; k < ps.length - 1; k++) {
              const p1 = add(A2, mul(d, ps[k])), p2 = add(A2, mul(d, ps[k + 1]));
              if (ps[k + 1] - ps[k] < 1) continue;
              items.push(...dim(p1, p2, n, off1, fmt(ps[k + 1] - ps[k]), ts, { h: 1.8, noExt: true }));
            }
          }
        }
      }
      // šírka ramena na nástupe
      const s0 = G.start[0], s1 = G.start[1];
      const back = mul(norm(G.walkEndDir ? sub(res.edges[1].W, res.edges[0].W) : P(1, 0)), -1);
      if (inp.typ !== 'tocite') items.push(...dim(s0, s1, back, off1, fmt(res.W), ts));
      if (inp.typ === 'tocite') {
        const c = G.column.c;
        const a = add(c, P(0, 0));
        const ang0 = -90 * DEG;
        const pr = P(Math.cos(ang0 + Math.PI) * inp.Rv, Math.sin(ang0 + Math.PI) * inp.Rv);
        items.push(line(a, pr, { L: 'KOTY' }));
        items.push(tx(pr.x / 2 - 3 * ts, pr.y / 2, 'R ' + fmt(inp.Rv), 2.2 * ts, { L: 'KOTY', ang: 90 }));
        items.push(tx(c.x, c.y - inp.Rs - 3 * ts, 'stĺp Ø ' + fmt(2 * inp.Rs), 2 * ts, { L: 'KOTY' }));
      }
      // výška nástupu a výstupu
      const ws = G.walkStart;
      items.push(tx(ws.x, ws.y - 4 * ts, '±0', 2 * ts, { L: 'TEXT' }));
      const we = G.walkEnd, wd = norm(G.walkEndDir);
      let tp = add(we, mul(wd, 5 * ts));
      if (inp.typ === 'tocite') tp = add(we, mul(norm(sub(G.end[1], G.end[0])), -4 * ts));
      items.push(tx(tp.x, tp.y, '+' + fmt(inp.H), 2 * ts, { L: 'TEXT', vmid: true }));
    }
    return { items, ts, bbox: itemsBBox(items) };
  }

  // ---------------------------------------------------------------- rozvinutie
  function unfold(res, opt) {
    opt = opt || {};
    const items = [];
    if (!res.unfold) return { items, bbox: null };
    const inp = res.input, H = inp.H, h = res.h;
    const U = res.unfold;
    const maxLen = Math.max(U.vnutorna.dlzka, U.vonkajsia.dlzka);
    const ts = opt.ts || Math.max(maxLen, H) / 170;
    const parts = [
      { key: 'vonkajsia', title: inp.typ === 'tocite' ? 'Vonkajšia schodnica – rozvinutie' : 'Vonkajšia schodnica (pri stene) – rozvinutie' },
      { key: 'vnutorna', title: inp.typ === 'tocite' ? 'Vnútorná hrana (pri stĺpe) – rozvinutie' : 'Vnútorná schodnica – rozvinutie' }
    ];
    let offX = 0, offY = 0;
    for (const pt of parts) {
      const S = U[pt.key];
      const its = [];
      const T = p => P(p.x, p.y);
      // podlahy
      its.push(line(T(P(-200, 0)), T(P(S.pos[0] + 100, 0)), { L: 'ROZVINUTIE', lw: 'tenka' }));
      its.push(line(T(P(S.pos[S.pos.length - 1] - 100, H)), T(P(S.pos[S.pos.length - 1] + 400, H)), { L: 'ROZVINUTIE', lw: 'tenka' }));
      // orientačný tvar schodnice
      for (const sh of S.tvary) its.push(pl(vv(sh.poly.map(T)), { c: true, L: 'SCHODNICA', lw: 'stredna', fill: 'schodnica' }));
      // stupňovitý profil
      its.push(pl(vv(S.profil.map(T)), { L: 'ROZVINUTIE', lw: 'hruba' }));
      // hrúbka stupňov
      for (let j = 1; j < res.N; j++) {
        const x0 = S.pos[j - 1], x1 = S.pos[j], y = j * h;
        const tr = res.treads[j - 1];
        const xs = x0 - inp.presah;
        its.push(pl(vv([T(P(xs, y)), T(P(x1, y)), T(P(x1, y - inp.hrubka)), T(P(xs, y - inp.hrubka))]), { c: true, L: 'ROZVINUTIE', lw: 'tenka', fill: tr && tr.kind === 'podesta' ? 'podesta' : 'stupen' }));
      }
      // rohy
      for (const r of S.rohy) {
        its.push(line(T(P(r.s, -3 * ts)), T(P(r.s, H + 6 * ts)), { L: 'ROZVINUTIE', dash: '-.' }));
        its.push(tx(r.s, H + 8 * ts, r.typ, 2 * ts, { L: 'TEXT' }));
      }
      // polohy hrán od nástupu
      for (let i = 0; i < S.pos.length; i++) {
        its.push(line(T(P(S.pos[i], -1 * ts)), T(P(S.pos[i], -2.5 * ts)), { L: 'KOTY' }));
        its.push(tx(S.pos[i], -4 * ts, fmt(S.pos[i] - S.pos[0]), 1.9 * ts, { L: 'KOTY', ang: 90, al: 'r', vmid: true }));
      }
      its.push(tx(-200, H + 14 * ts, pt.title + '   (dĺžka hrany ' + fmt(S.dlzka) + ' mm)', 3.2 * ts, { L: 'TEXT', al: 'l', bold: true }));
      its.push(tx(-260, 0, '±0', 2 * ts, { L: 'TEXT', al: 'r', vmid: true }));
      its.push(tx(S.pos[S.pos.length - 1] + 450, H, '+' + fmt(H), 2 * ts, { L: 'TEXT', al: 'l', vmid: true }));
      const bb = itemsBBox(its);
      if (opt.layout === 'h') {
        items.push(...moveItems(its, offX - bb.minX, 0));
        offX += bb.w + 25 * ts;
      } else {
        items.push(...moveItems(its, 0, offY - bb.minY));
        offY += bb.h + 12 * ts;
      }
    }
    return { items, ts, bbox: itemsBBox(items) };
  }

  // ---------------------------------------------------------------- dielce
  function part(res, tr, ts) {
    const s = C.partShape(tr);
    const items = [];
    items.push(pl(vv([P(0, 0), P(s.w, 0), P(s.w, s.h), P(0, s.h)]), { c: true, L: 'KOTY', dash: '-', lw: 'tenka' }));
    items.push(pl(s.poly, { c: true, L: 'DIELCE', lw: 'hruba', fill: tr.kind === 'podesta' ? 'podesta' : 'stupen' }));
    // dĺžky hrán
    const n = s.poly.length;
    const pts = C.sampleVerts(s.poly, true, 3 * DEG);
    for (let i = 0; i < n; i++) {
      const a = s.poly[i], b = s.poly[(i + 1) % n];
      const e = tr.hrany[i];
      if (!e || e.L < 15) continue;
      let mid = mul(add(a, b), 0.5);
      if (Math.abs(a.b) > 1e-9) {
        const arc = C.arcOfBulge(a, b, a.b);
        const am = arc.a1 + arc.th / 2;
        mid = P(arc.center.x + arc.R * Math.cos(am), arc.center.y + arc.R * Math.sin(am));
      }
      const d = norm(sub(b, a));
      let nn = perp(d);
      if (!pointInPoly(add(mid, mul(nn, 3)), pts)) nn = mul(nn, -1);
      const tp = add(mid, mul(nn, 2.6 * ts));
      let ang = Math.atan2(d.y, d.x) / DEG;
      if (ang > 90.01) ang -= 180; if (ang < -89.99) ang += 180;
      items.push(tx(tp.x, tp.y, (e.oblúk ? '⌒' : '') + fmt(e.L), 2 * ts, { L: 'KOTY', ang, vmid: true }));
    }
    const c = C.bbox(pts);
    items.push(tx((c.minX + c.maxX) / 2, s.h * 0.55, (tr.kind === 'podesta' ? 'P' : '') + tr.n, 5 * ts, { L: 'TEXT', vmid: true, bold: true }));
    items.push(tx(s.w / 2, -3.5 * ts, 'prírez ' + fmt(s.w) + ' × ' + fmt(s.h) + ' × ' + fmt(res.input.hrubka), 2.2 * ts, { L: 'TEXT', vmid: true }));
    items.push(tx(s.w / 2, -6.8 * ts, '▲ nástupná hrana', 1.8 * ts, { L: 'TEXT', vmid: true }));
    return { items, w: s.w, h: s.h, top: 1 * ts, bottom: 9 * ts };
  }

  // rozloženie dielcov do riadkov (šírka v mm modelu); vracia zoznam {items posunutých, page?}
  function partsLayout(res, ts, maxW, maxH) {
    const placed = [];
    const gap = 8 * ts;
    let x = 0, y = 0, rowH = 0, page = 0;
    const ps = (res.treads || []).map(t => ({ t, p: part(res, t, ts) }));
    for (const it of ps) {
      const w = it.p.w, hh = it.p.h + it.p.bottom + it.p.top;
      if (x > 0 && x + w > maxW) { x = 0; y += rowH + gap; rowH = 0; }
      if (maxH && y > 0 && y + hh > maxH) { page++; x = 0; y = 0; rowH = 0; }
      placed.push({ n: it.t.n, page, x, y: y + it.p.bottom, w, h: it.p.h, items: it.p.items });
      x += w + gap;
      rowH = Math.max(rowH, hh);
    }
    return placed;
  }

  function moveItems(items, dx, dy) {
    return items.map(it => {
      if (it.k === 'pl') return Object.assign({}, it, { v: it.v.map(q => ({ x: q.x + dx, y: q.y + dy, b: q.b })) });
      return Object.assign({}, it, { x: it.x + dx, y: it.y + dy });
    });
  }

  function itemsBBox(items) {
    const pts = [];
    for (const it of items) {
      if (it.k === 'pl') for (const q of C.sampleVerts(it.v, it.c, 10 * DEG)) pts.push(q);
      else if (it.k === 'ci') { pts.push(P(it.x - it.r, it.y - it.r)); pts.push(P(it.x + it.r, it.y + it.r)); }
      else if (it.k === 'tx') {
        const w = it.s.length * it.h * 0.6;
        const a = (it.ang || 0) * DEG;
        const dx = P(Math.cos(a) * w, Math.sin(a) * w);
        const o = it.al === 'l' ? 0 : it.al === 'r' ? -1 : -0.5;
        const p0 = add(P(it.x, it.y), mul(dx, o));
        pts.push(p0, add(p0, dx), add(p0, P(-Math.sin(a) * it.h, Math.cos(a) * it.h)));
      }
    }
    return pts.length ? C.bbox(pts) : null;
  }

  // ---------------------------------------------------------------- SVG
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f2 = x => (Math.round(x * 100) / 100).toString();

  function svgPath(v, closed) {
    if (!v.length) return '';
    let d = 'M' + f2(v[0].x) + ' ' + f2(-v[0].y);
    const n = v.length, segN = closed ? n : n - 1;
    for (let i = 0; i < segN; i++) {
      const a = v[i], b = v[(i + 1) % n];
      if (Math.abs(a.b) > 1e-9) {
        const arc = C.arcOfBulge(a, b, a.b);
        const large = Math.abs(arc.th) > Math.PI ? 1 : 0;
        const sweep = a.b > 0 ? 0 : 1;
        d += 'A' + f2(arc.R) + ' ' + f2(arc.R) + ' 0 ' + large + ' ' + sweep + ' ' + f2(b.x) + ' ' + f2(-b.y);
      } else d += 'L' + f2(b.x) + ' ' + f2(-b.y);
    }
    if (closed) d += 'Z';
    return d;
  }

  function toSVG(items, bb, opt) {
    opt = opt || {};
    const pad = opt.pad != null ? opt.pad : Math.max(bb.w, bb.h) * 0.03;
    const vb = [bb.minX - pad, -bb.maxY - pad, bb.w + 2 * pad, bb.h + 2 * pad].map(f2).join(' ');
    let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" class="vykres"' + (opt.width ? ' width="' + opt.width + '"' : '') + (opt.height ? ' height="' + opt.height + '"' : '') + '>';
    if (opt.standalone) out += '<style>' + SVG_STYLE + '</style><rect x="' + (bb.minX - pad) + '" y="' + (-bb.maxY - pad) + '" width="' + (bb.w + 2 * pad) + '" height="' + (bb.h + 2 * pad) + '" fill="#fff"/>';
    const lwMap = { tenka: 0.7, stredna: 1.2, hruba: 2, none: 0 };
    for (const it of items) {
      if (it.k === 'pl') {
        const cls = ['L-' + it.L];
        if (it.dash === '-') cls.push('d1'); else if (it.dash === '-.') cls.push('d2');
        if (it.fill) cls.push('f-' + it.fill);
        if (it.err) cls.push('err');
        if (it.upr) cls.push('upr');
        if (it.hover) cls.push('hov');
        const sw = lwMap[it.lw || 'tenka'];
        out += '<path class="' + cls.join(' ') + '" d="' + svgPath(it.v, it.c) + '" stroke-width="' + sw + '"' +
          (it.hover ? ' data-n="' + it.hover + '"' : '') + '/>';
      } else if (it.k === 'ci') {
        out += '<circle class="L-' + it.L + (it.fill ? ' f-' + it.fill : '') + '" cx="' + f2(it.x) + '" cy="' + f2(-it.y) + '" r="' + f2(it.r) + '" stroke-width="0.8"/>';
      } else if (it.k === 'tx') {
        const anchor = it.al === 'l' ? 'start' : it.al === 'r' ? 'end' : 'middle';
        out += '<text class="T-' + it.L + (it.bold ? ' b' : '') + '" x="' + f2(it.x) + '" y="' + f2(-it.y) + '" font-size="' + f2(it.h * 1.35) + '" text-anchor="' + anchor + '"' +
          (it.vmid ? ' dominant-baseline="central"' : '') +
          (it.ang ? ' transform="rotate(' + f2(-it.ang) + ' ' + f2(it.x) + ' ' + f2(-it.y) + ')"' : '') + '>' + esc(it.s) + '</text>';
      }
    }
    return out + '</svg>';
  }

  const SVG_STYLE = [
    'path,circle{fill:none;stroke:#1d2733;vector-effect:non-scaling-stroke;stroke-linejoin:round}',
    '.d1{stroke-dasharray:6 4}.d2{stroke-dasharray:14 4 2 4}',
    '.L-STENA{stroke:#4b5563}.f-stena{fill:#d9dde3}',
    '.L-VYSTUPNA_CIARA{stroke:#c2410c}.L-VYSTUPNA_CIARA.f-cur,circle.L-VYSTUPNA_CIARA{fill:#c2410c}',
    '.L-KOTY{stroke:#2f7d4f}.L-PODSTUPNICE{stroke:#64748b}.L-SCHODNICA{stroke:#8a5a2b}.f-schodnica{fill:#e9d8c4;fill-opacity:.6}',
    '.f-stupen{fill:#f4efe6}.f-podesta{fill:#e7efe0}.L-DIELCE{stroke:#1d2733}.err{stroke:#dc2626}',
    '.hov{stroke:none}',
    'text{font-family:"DejaVu Sans",Arial,sans-serif;fill:#1d2733}.T-KOTY{fill:#2f7d4f}.b{font-weight:700}'
  ].join('');

  return { LAYERS, plan, unfold, part, partsLayout, moveItems, itemsBBox, toSVG, svgPath, SVG_STYLE, dim };
});
