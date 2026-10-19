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
    { name: 'DIELCE', color: 2, lt: 'CONTINUOUS' },
    { name: 'CAPY', color: 4, lt: 'CONTINUOUS' },
    { name: 'STROP', color: 210, lt: 'DASHED' },
    { name: 'RAMENA', color: 1, lt: 'DASHED' }
  ];
  // vrstvy CNC výkresu bočníc (hĺbka drážky v názve vrstvy)
  const CNC_LAYERS = d => [
    { name: 'PRIREZ', color: 8, lt: 'CONTINUOUS' },
    { name: 'REZ_OBRYS', color: 7, lt: 'CONTINUOUS' },
    { name: 'DRAZKA_H' + d, color: 4, lt: 'CONTINUOUS' },
    { name: 'POPIS', color: 3, lt: 'CONTINUOUS' }
  ];

  const P = (x, y) => ({ x, y });
  const sub = (a, b) => P(a.x - b.x, a.y - b.y);
  const add = (a, b) => P(a.x + b.x, a.y + b.y);
  const mul = (a, k) => P(a.x * k, a.y * k);
  const len = a => Math.hypot(a.x, a.y);
  const norm = a => { const l = len(a) || 1; return P(a.x / l, a.y / l); };
  const perp = a => P(-a.y, a.x);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const dist = (a, b) => len(sub(a, b));
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

    // pás hrúbky t von od schodov (od obrysu) pozdĺž lomenej čiary, v rohoch s miterom
    const outward = (pts, t) => {
      const off = [];
      for (let i = 0; i < pts.length; i++) {
        const i0 = Math.min(i, pts.length - 2);
        const a = pts[i0], b = pts[i0 + 1];
        let n = perp(norm(sub(b, a)));
        const test = add(mul(add(a, b), 0.5), mul(n, (G.bocHrubka || 0) + 5));
        if (pointInPoly(test, outlinePts)) n = mul(n, -1);
        let k = 1;
        if (i > 0 && i < pts.length - 1) {
          const n1 = perp(norm(sub(pts[i], pts[i - 1]))), n2 = perp(norm(sub(pts[i + 1], pts[i])));
          const cosHalf = Math.sqrt(Math.max(0.01, (1 + n1.x * n2.x + n1.y * n2.y) / 2));
          k = 1 / cosHalf;
          const bis = norm(add(n1, n2));
          n = (n.x * bis.x + n.y * bis.y) > 0 ? bis : mul(bis, -1);
        }
        off.push(add(pts[i], mul(n, t * k)));
      }
      return off;
    };
    const wallV = G.wallReal || G.wall, tb = G.bocHrubka || 0;
    // stena: pás za stenou (líce steny = vonkajšia strana bočnice)
    if (G.hasWall) {
      const wall = C.sampleVerts(wallV, false, 4 * DEG);
      items.push(pl(vv(wall.concat(outward(wall, 120).reverse())), { c: true, L: 'STENA', fill: 'stena', lw: 'tenka' }));
      items.push(pl(wallV, { L: 'STENA', lw: 'hruba' }));
    }
    // bočnice v pôdoryse: pri stene medzi lícom bočnice a stenou, vnútorná von od vnútornej hrany
    if (tb > 0) {
      const sw = C.sampleVerts(G.wall, false, 4 * DEG);
      items.push(pl(vv(sw.concat(outward(sw, tb).reverse())), { c: true, L: 'SCHODNICA', fill: 'schodnica', lw: 'tenka' }));
      if (inp.typ !== 'tocite') {
        const si = C.sampleVerts(G.inner, false, 4 * DEG);
        items.push(pl(vv(si.concat(outward(si, tb).reverse())), { c: true, L: 'SCHODNICA', fill: 'schodnica', lw: 'tenka' }));
      }
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

    // ramená: hranice zákrut a popisy
    if (G.ramena && opt.ramena !== false) {
      for (const hr of G.ramena.hranice) items.push(line(hr[0], hr[1], { L: 'RAMENA', dash: '-', lw: 'tenka' }));
      for (const q of G.ramena.popisy) {
        let ang = Math.atan2(q.dir.y, q.dir.x) / DEG;
        if (ang > 90.01) ang -= 180; if (ang < -89.99) ang += 180;
        items.push(tx(q.p.x, q.p.y, q.nazov + ' · ' + q.stupne, 2 * ts, { L: 'RAMENA', ang, vmid: true, bold: true }));
      }
    }

    // hrana otvoru v strope (zadaná, inak najmenšia potrebná)
    const st = res.strop;
    if (st && res.edges && res.edges.length > 1) {
      const sv = st.sEdge != null ? st.sEdge : st.sReq;
      const E = res.edges, n = E.length;
      if (sv != null && sv > E[0].s - 1e-6 && sv < E[n - 1].s) {
        let i = 0;
        while (i < n - 2 && sv > E[i + 1].s) i++;
        const f = (sv - E[i].s) / (E[i + 1].s - E[i].s || 1);
        const lerp = (a, b) => add(a, mul(sub(b, a), f));
        const A = lerp(E[i].P, E[i + 1].P), B = lerp(E[i].Q, E[i + 1].Q);
        const zad = st.sEdge != null;
        items.push(line(A, B, { L: 'STROP', dash: '-', lw: 'stredna' }));
        const d = norm(sub(B, A));
        let ang = Math.atan2(d.y, d.x) / DEG;
        if (ang > 90.01) ang -= 180; if (ang < -89.99) ang += 180;
        const m = add(mul(add(A, B), 0.5), mul(perp(d), 1.6 * ts));
        items.push(tx(m.x, m.y, zad ? 'hrana stropu (otvor ' + fmt(inp.otvor) + ')' : 'min. otvor ' + fmt(Math.ceil(st.otvorMin)), 1.8 * ts, { L: 'STROP', ang, vmid: true }));
      }
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
        const wv = wallV;
        for (let i = 0; i < wv.length - 1; i++) {
          if (Math.abs(wv[i].b) > 1e-9) continue;
          const a = wv[i], b = wv[i + 1];
          const d = norm(sub(b, a));
          let n = perp(d);
          const mid = mul(add(a, b), 0.5);
          if (pointInPoly(add(mid, mul(n, tb + 5)), outlinePts)) n = mul(n, -1);
          const extra = 150; // za stenou
          const A2 = add(a, mul(n, extra)), B2 = add(b, mul(n, extra));
          items.push(...dim(A2, B2, n, off2, fmt(len(sub(b, a))), ts, { noExt: false }));
          // reťazec polôh hrán pri stene
          const L = len(sub(b, a));
          const ps = [0];
          for (const e of res.edges) {
            const q = sub(e.Q, a), along = q.x * d.x + q.y * d.y, across = Math.abs(q.x * n.x + q.y * n.y);
            if (across < tb + 1 && along > 1 && along < L - 1) ps.push(along);
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
      if (inp.typ !== 'tocite') {
        items.push(...dim(s0, s1, back, off1, fmt(res.W) + (tb > 0 ? ' svetlá' : ''), ts));
        if (tb > 0) {
          // celková šírka ramena vrátane bočníc
          const dn = norm(sub(s1, s0));
          items.push(...dim(add(s0, mul(dn, -tb)), add(s1, mul(dn, tb)), back, off2, fmt(res.W + 2 * tb), ts));
        }
      }
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
      // hrubé podlahy (pod nášľapnou vrstvou)
      const pd = res.podlaha || {};
      if (pd.dole > 0) { its.push(line(P(-200, -pd.dole), P(S.pos[0] + 100, -pd.dole), { L: 'ROZVINUTIE', dash: '-' })); its.push(tx(-260, -pd.dole - 3 * ts, 'hrubá −' + fmt(pd.dole), 1.8 * ts, { L: 'TEXT', al: 'r', vmid: true })); }
      if (pd.hore > 0) { its.push(line(P(S.pos[S.pos.length - 1] - 100, H - pd.hore), P(S.pos[S.pos.length - 1] + 400, H - pd.hore), { L: 'ROZVINUTIE', dash: '-' })); its.push(tx(S.pos[S.pos.length - 1] + 450, H - pd.hore - 3 * ts, 'hrubá +' + fmt(H - pd.hore), 1.8 * ts, { L: 'TEXT', al: 'l', vmid: true })); }
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

  // zvislý rez obrysom v x: [najnižšie y, najvyššie y] alebo null
  function polyYRange(poly, x) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) continue;
      const y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return isFinite(lo) ? [lo, hi] : null;
  }

  // rozvinutá strana s bočnicami na úpravu (editor bočníc): dielce s data-k, kotevné body pre polia s vynášacími čiarami
  function bocStrana(res, key, opt) {
    opt = opt || {};
    const U = res.unfold && res.unfold[key];
    if (!U || !U.tvary.length) return null;
    const inp = res.input, h = res.h, H = inp.H, N = res.N;
    const items = [];
    const ids = {};
    for (const b of res.bocnice || []) ids[b.key] = b.id;
    const x0 = U.tvary.reduce((m, b) => Math.min(m, b.x0), U.pos[0]) - 150, x1 = U.pos[U.pos.length - 1] + 300;
    const pd = res.podlaha || {};
    items.push(line(P(x0, 0), P(U.pos[0] + 60, 0), { L: 'ROZVINUTIE', lw: 'stredna' }));
    items.push(line(P(U.pos[U.pos.length - 1] - 60, H), P(x1, H), { L: 'ROZVINUTIE', lw: 'stredna' }));
    if (pd.dole > 0) items.push(line(P(x0, -pd.dole), P(U.pos[0] + 60, -pd.dole), { L: 'ROZVINUTIE', dash: '-' }));
    if (pd.hore > 0) items.push(line(P(U.pos[U.pos.length - 1] - 60, H - pd.hore), P(x1, H - pd.hore), { L: 'ROZVINUTIE', dash: '-' }));
    for (const b of U.tvary) items.push(pl(vv(b.poly), { c: true, L: 'SCHODNICA', lw: 'stredna', fill: b.key === opt.sel ? 'bocSel' : b.upravena ? 'bocUpr' : 'schodnica', dk: b.key }));
    for (const g of U.drazky) items.push(pl(vv([P(g.x0, g.y0), P(g.x1, g.y0), P(g.x1, g.y1), P(g.x0, g.y1)]), { c: true, L: 'DRAZKA', lw: 'tenka', dash: '-' }));
    for (let j = 1; j < N; j++) {
      const tr = res.treads[j - 1], y = j * h, xs = U.pos[j - 1] - inp.presah;
      items.push(pl(vv([P(xs, y), P(U.pos[j], y), P(U.pos[j], y - inp.hrubka), P(xs, y - inp.hrubka)]), { c: true, L: 'ROZVINUTIE', lw: 'tenka', fill: tr && tr.kind === 'podesta' ? 'podesta' : 'stupen' }));
    }
    for (const r of U.rohy) items.push(line(P(r.s, -150), P(r.s, H + 150), { L: 'ROZVINUTIE', dash: '-.' }));
    const ts = opt.ts || Math.max(x1 - x0, H) / 150;
    for (const b of U.tvary) {
      const pts = b.poly, bb = C.bbox(pts), cx = (bb.minX + bb.maxX) / 2, r = polyYRange(pts, cx);
      if (r) items.push(tx(cx, (r[0] + r[1]) / 2, ids[b.key] || '', 3.4 * ts, { L: 'TEXT', vmid: true, bold: true }));
    }
    // kotvy: dielec na úpravu (vybraný, inak najdlhší), stupeň v jeho strede
    const band = U.tvary.find(b => b.key === opt.sel) || U.tvary.slice().sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))[0];
    const inBand = [];
    for (let k = 1; k < N; k++) {
      const tr = res.treads[k - 1];
      if (tr && tr.kind === 'stupen' && U.pos[k - 1] > band.x0 + 30 && U.pos[k] < band.x1 - 30) inBand.push(k);
    }
    const anchors = {};
    if (inBand.length) {
      const k = inBand[Math.floor((inBand.length - 1) / 2)];
      const xa = U.pos[k - 1], ra = polyYRange(band.poly, xa + 1);
      if (ra) anchors.nad = { a: P(xa, k * h), b: P(xa, ra[1]) };
      const xm = (U.pos[k - 1] + U.pos[k]) / 2, rm = polyYRange(band.poly, xm);
      if (rm) anchors.pod = { a: P(xm, k * h - inp.hrubka), b: P(xm, rm[0]) };
      const k2 = inBand[Math.min(inBand.length - 1, Math.floor((inBand.length - 1) / 2) + 1)];
      const xw = k2 === k ? xm + (U.pos[k] - U.pos[k - 1]) * 0.3 : (U.pos[k2 - 1] + U.pos[k2]) / 2, rw = polyYRange(band.poly, xw);
      if (rw) anchors.sirka = { a: P(xw, rw[1]), b: P(xw, rw[0]) };
    }
    // zaoblenie: roh dráhy (prechod do zákruty), inak stred dielca
    const roh = U.rohy.find(q => q.s > band.x0 && q.s < band.x1) || U.rohy[0];
    const xr = roh ? roh.s : (band.x0 + band.x1) / 2;
    const bz = U.tvary.find(b => xr >= b.x0 && xr <= b.x1) || band, rz = polyYRange(bz.poly, xr);
    if (rz) anchors.zaoblenie = { a: P(xr, rz[1]), b: P(xr, rz[1]) };
    anchors.predZ = { a: P(band.x0, (polyYRange(band.poly, band.x0 + 1) || [0, 0])[0]), b: null };
    anchors.predK = { a: P(band.x1, (polyYRange(band.poly, band.x1 - 1) || [0, 0])[1]), b: null };
    return { items, ts, bbox: itemsBBox(items), anchors, band };
  }

  // ---------------------------------------------------------------- dielce
  function part(res, tr, ts) {
    const s = C.partShape(tr);
    const items = [];
    items.push(pl(vv([P(0, 0), P(s.w, 0), P(s.w, s.h), P(0, s.h)]), { c: true, L: 'KOTY', dash: '-', lw: 'tenka' }));
    items.push(pl(s.poly, { c: true, L: 'DIELCE', lw: 'hruba', fill: tr.kind === 'podesta' ? 'podesta' : 'stupen' }));
    // obrys stupňa bez čapov (len informatívne, nerezať)
    if (s.over) items.push(pl(s.over, { c: true, L: 'KOTY', dash: '-', lw: 'tenka', noExport: true }));
    // čapy do drážok bočníc – zvýraznené (súčasť obrysu na rez, samostatne sa neexportujú)
    const cutPts = C.sampleVerts(s.poly, true, 3 * DEG);
    for (const c of s.caps) {
      items.push(pl(c.poly, { c: true, L: 'CAPY', lw: 'stredna', fill: 'cap', noExport: true }));
      // kóta čapu: dĺžka × hĺbka, hrúbka a frézovanie z oboch strán – vo vnútri stupňa popri čape
      const cp = C.sampleVerts(c.poly, true, 3 * DEG);
      let ia = 0, best = -1;
      for (let i = 0; i < cp.length; i++) { const L = dist(cp[i], cp[(i + 1) % cp.length]); if (L > best) { best = L; ia = i; } }
      const a = cp[ia], b = cp[(ia + 1) % cp.length], d = norm(sub(b, a));
      let nn = perp(d);
      const mid = mul(add(a, b), 0.5);
      const cc = C.bbox(cutPts), ctr = P((cc.minX + cc.maxX) / 2, (cc.minY + cc.maxY) / 2);
      if (dot(nn, sub(ctr, mid)) < 0) nn = mul(nn, -1);
      const tp = add(mid, mul(nn, c.hlbka + 5.2 * ts));
      let ang = Math.atan2(d.y, d.x) / DEG;
      if (ang > 90.01) ang -= 180; if (ang < -89.99) ang += 180;
      const fr = (res.input.hrubka - c.hrubka) / 2;
      let lab = 'čap ' + fmt(c.dlzka) + ' × ' + fmt(c.hlbka) + ', hr. ' + fmt(c.hrubka) + (fr > 0 ? ' (fréza 2 × ' + fmt(fr, fr % 1 ? 1 : 0) + ')' : '');
      if (lab.length * 0.55 * 1.6 * ts > c.dlzka * 1.1) lab = 'čap ' + fmt(c.dlzka); // krátky čap – plný rozmer je v tabuľke dielca
      items.push(tx(tp.x, tp.y, lab, 1.6 * ts, { L: 'CAPY', ang, vmid: true }));
    }
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

  // bočnica v prírezе: obrys na rez, drážky, kóty prírezu a popisy (súradnice prírezu, mm)
  function bocnica(res, b, ts, o) {
    o = o || {};
    const items = [], W = b.prirez.dlzka, H = b.prirez.sirka, dL = 'DRAZKA_H' + fmt(b.drazky.length ? b.drazky[0].hlbka : 0, 1).replace(',0', '').replace(',', '_');
    items.push(pl(vv([P(0, 0), P(W, 0), P(W, H), P(0, H)]), { c: true, L: 'PRIREZ', dash: '-', lw: 'tenka', fill: o.fill ? 'priRez' : null }));
    items.push(pl(b.obrys, { c: true, L: 'REZ_OBRYS', lw: 'hruba', fill: o.fill ? 'bocnica' : null }));
    for (const g of b.drazky) {
      items.push(pl(g.verts, { c: true, L: dL, lw: 'stredna', fill: o.fill ? (g.typ === 'stupen' ? 'drazka' : 'drazkaP') : null }));
      if (o.labels !== false) items.push(tx(g.lab.x, g.lab.y, (g.typ === 'stupen' ? 'S' : 'P') + g.n, 1.6 * ts, { L: 'POPIS', vmid: true }));
    }
    if (o.dims !== false) {
      items.push(...dim(P(0, 0), P(W, 0), P(0, -1), 5 * ts, fmt(W), ts));
      items.push(...dim(P(W, 0), P(W, H), P(1, 0), 5 * ts, fmt(H), ts));
      if (o.title !== false) items.push(tx(0, H + 3 * ts, b.id + ' · ' + b.nazov + ' · st. ' + b.stupne + ' · hrúbka ' + fmt(b.hrubka) + (b.oblukova ? ' · OBLÚKOVÁ (rozvinutá)' : ''), 2.4 * ts, { L: 'POPIS', al: 'l', bold: true }));
    }
    return { items, w: W, h: H };
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
        if (it.dk) cls.push('pk');
        const sw = lwMap[it.lw || 'tenka'];
        out += '<path class="' + cls.join(' ') + '" d="' + svgPath(it.v, it.c) + '" stroke-width="' + sw + '"' +
          (it.hover ? ' data-n="' + it.hover + '"' : '') + (it.dk ? ' data-k="' + esc(it.dk) + '"' : '') + '/>';
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
    '.L-PRIREZ{stroke:#94a3b8}.f-priRez{fill:#f8fafc}.L-REZ_OBRYS{stroke:#1d2733}.f-bocnica{fill:#efe2cf}[class*=L-DRAZKA]{stroke:#0e7490}.f-drazka{fill:#a5d8e6}.f-drazkaP{fill:#cbe9f0}.T-POPIS{fill:#155e75}' +
    '.L-STROP{stroke:#7c3aed}.T-STROP{fill:#7c3aed}.L-RAMENA{stroke:#dc2626}.T-RAMENA{fill:#dc2626}.f-stupen{fill:#f4efe6}.f-podesta{fill:#e7efe0}.L-DIELCE{stroke:#1d2733}.L-CAPY{stroke:#0e7490}.f-cap{fill:#7dc4d8}.err{stroke:#dc2626}',
    '.hov{stroke:none}.f-bocSel{fill:#bcd3f5}.f-bocUpr{fill:#f3d9b8}.L-DRAZKA{stroke:#0e7490}',
    'text{font-family:"DejaVu Sans",Arial,sans-serif;fill:#1d2733}.T-KOTY{fill:#2f7d4f}.T-CAPY{fill:#0e7490}.b{font-weight:700}'
  ].join('');

  return { LAYERS, CNC_LAYERS, bocnica, bocStrana, polyYRange, plan, unfold, part, partsLayout, moveItems, itemsBBox, toSVG, svgPath, SVG_STYLE, dim };
});
