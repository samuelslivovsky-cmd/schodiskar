/*
 * Schodiskár – výpočtové jadro
 * Jednotky: mm, uhly v stupňoch na vstupe, v radiánoch vo vnútri.
 * Geometria sa počíta v jednej polohe (zákruta vľavo, 1. rameno v smere +x),
 * pri smere "vpravo" sa výsledok zrkadlí podľa osi x (y -> -y).
 *
 * Mnohouholníky sú zoznamy vrcholov {x, y, b}, kde b je "bulge" úseku
 * z vrcholu do nasledujúceho (b = tan(uhol/4), kladné = proti smeru hodinových ručičiek).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SchodyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------- vektory
  const v = (x, y) => ({ x, y });
  const add = (a, b) => v(a.x + b.x, a.y + b.y);
  const sub = (a, b) => v(a.x - b.x, a.y - b.y);
  const mul = (a, k) => v(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const len = a => Math.hypot(a.x, a.y);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const norm = a => { const l = len(a); return l < 1e-12 ? v(0, 0) : v(a.x / l, a.y / l); };
  const perp = a => v(-a.y, a.x);
  const rotate = (a, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return v(a.x * c - a.y * s, a.x * s + a.y * c); };

  // ---------------------------------------------------------------- dráhy (úsečky a oblúky)
  function Line(a, b, dir) { return { t: 'L', a, b, d: dir || null }; }
  function Arc(c, r, a0, sw) { return { t: 'A', c, r, a0, sw }; }

  function makePath(prims) {
    let s = 0;
    for (const p of prims) {
      p.s0 = s;
      if (p.t === 'L') {
        p.len = dist(p.a, p.b);
        p.u = p.len > 1e-9 ? norm(sub(p.b, p.a)) : (p.d ? norm(p.d) : v(1, 0));
      } else {
        p.len = Math.abs(p.r * p.sw);
      }
      s += p.len;
    }
    const first = prims[0], last = prims[prims.length - 1];
    const path = { prims, len: s };
    path.start = primPoint(first, 0);
    path.end = primPoint(last, last.len);
    path.t0 = primTangent(first, 0);
    path.t1 = primTangent(last, last.len);
    return path;
  }

  function primAngle(p, ds) { return p.a0 + (p.len > 1e-12 ? p.sw * ds / p.len : 0); }
  function primPoint(p, ds) {
    if (p.t === 'L') return add(p.a, mul(p.u, ds));
    const a = primAngle(p, ds);
    return v(p.c.x + p.r * Math.cos(a), p.c.y + p.r * Math.sin(a));
  }
  function primTangent(p, ds) {
    if (p.t === 'L') return p.u;
    const a = primAngle(p, ds), sg = p.sw < 0 ? -1 : 1;
    return v(-Math.sin(a) * sg, Math.cos(a) * sg);
  }
  function primIndex(path, s) {
    const ps = path.prims;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].len > 1e-9 && s <= ps[i].s0 + ps[i].len + 1e-9) return i;
    }
    for (let i = ps.length - 1; i >= 0; i--) if (ps[i].len > 1e-9) return i;
    return ps.length - 1;
  }
  function pathPoint(path, s) {
    if (s < 0) return add(path.start, mul(path.t0, s));
    if (s > path.len) return add(path.end, mul(path.t1, s - path.len));
    const p = path.prims[primIndex(path, s)];
    return primPoint(p, s - p.s0);
  }
  function pathTangent(path, s) {
    if (s <= 0) return path.t0;
    if (s >= path.len) return path.t1;
    const p = path.prims[primIndex(path, s)];
    return primTangent(p, s - p.s0);
  }

  // Priesečníky priamky P + lam*d s dráhou. Konce dráhy možno predĺžiť (tails).
  function intersectPath(path, P, d, tails) {
    const out = [];
    const lineHit = (A, u, sMin, sMax, sBase) => {
      const den = cross(d, u);
      if (Math.abs(den) < 1e-12) return;
      const w = sub(A, P);
      const lam = cross(w, u) / den;
      const sig = cross(w, d) / den;
      if (sig < sMin - 1e-7 || sig > sMax + 1e-7) return;
      out.push({ s: sBase + sig, lam, pt: add(A, mul(u, sig)) });
    };
    if (tails) lineHit(path.start, path.t0, -Infinity, 0, 0);
    for (const p of path.prims) {
      if (p.len <= 1e-9) continue;
      if (p.t === 'L') { lineHit(p.a, p.u, 0, p.len, p.s0); continue; }
      const f = sub(P, p.c);
      const A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - p.r * p.r;
      const D = B * B - 4 * A * C;
      if (D < 0) continue;
      const sq = Math.sqrt(D);
      const lams = D < 1e-12 ? [-B / (2 * A)] : [(-B - sq) / (2 * A), (-B + sq) / (2 * A)];
      const sg = p.sw < 0 ? -1 : 1;
      for (const lam of lams) {
        const pt = add(P, mul(d, lam));
        const phi = Math.atan2(pt.y - p.c.y, pt.x - p.c.x);
        let del = ((phi - p.a0) * sg) % TAU;
        if (del < 0) del += TAU;
        if (TAU - del < 1e-9) del = 0;
        for (let k = 0; del + k * TAU <= Math.abs(p.sw) + 1e-9; k++) {
          out.push({ s: p.s0 + p.r * (del + k * TAU), lam, pt });
        }
      }
    }
    if (tails) lineHit(path.end, path.t1, 0, Infinity, path.len);
    return out;
  }

  // Prevod parametra medzi dvoma rovnobežnými (offset) dráhami rovnakej skladby.
  function mapOffset(src, dst, s) {
    if (s <= 0) return s;
    if (s >= src.len) return dst.len + (s - src.len);
    const i = primIndex(src, s), p = src.prims[i], q = dst.prims[i];
    const f = p.len > 1e-12 ? (s - p.s0) / p.len : 0;
    return q.s0 + f * q.len;
  }

  // body dráhy s parametrom s (rohy a oblúky zahrnuté), krok na oblúkoch max. step
  function samplePathS(path, step) {
    const out = [];
    const push = (p, s0) => { const l = out[out.length - 1]; if (!l || Math.abs(l.s - s0) > 1e-9) out.push({ x: p.x, y: p.y, s: s0 }); };
    for (const p of path.prims) {
      if (p.len <= 1e-9) continue;
      if (p.t === 'L') { push(p.a, p.s0); push(p.b, p.s0 + p.len); continue; }
      const n = Math.max(2, Math.ceil(p.len / step));
      for (let k = 0; k <= n; k++) push(primPoint(p, p.len * k / n), p.s0 + p.len * k / n);
    }
    if (!out.length) out.push({ x: path.start.x, y: path.start.y, s: 0 });
    return out;
  }

  // ---------------------------------------------------------------- bulge polyline
  function bv(p, b) { return { x: p.x, y: p.y, b: b || 0 }; }

  function cleanVerts(verts, closed) {
    let out = verts.slice();
    // odstrániť nulové úseky
    for (let k = 0; k < out.length - 1;) {
      if (dist(out[k], out[k + 1]) < 1e-6) {
        // úsek k -> k+1 má nulovú dĺžku: zahodiť vrchol k, bulge predošlého úseku ostáva
        out.splice(k, 1);
      } else k++;
    }
    if (closed && out.length > 1 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
    // zlúčiť kolineárne úsečky
    const n0 = out.length;
    if (n0 > 2) {
      const res = [];
      for (let k = 0; k < out.length; k++) {
        const isEnd = !closed && (k === 0 || k === out.length - 1);
        if (!isEnd) {
          const prev = out[(k - 1 + out.length) % out.length], cur = out[k], nxt = out[(k + 1) % out.length];
          if (Math.abs(prev.b) < 1e-12 && Math.abs(cur.b) < 1e-12) {
            const a = sub(cur, prev), c = sub(nxt, cur);
            if (Math.abs(cross(norm(a), norm(c))) < 1e-9 && dot(a, c) > 0) continue;
          }
        }
        res.push(out[k]);
      }
      out = res;
    }
    return out;
  }

  // časť dráhy od sA po sB (sA <= sB), oblúky rozdelené po max. 90°
  function pathPieceFwd(path, sA, sB) {
    const verts = [bv(pathPoint(path, sA), 0)];
    const segs = [];
    if (sA < 0) segs.push({ a: sA, z: Math.min(0, sB), p: null });
    for (const p of path.prims) {
      const a = Math.max(sA, p.s0), z = Math.min(sB, p.s0 + p.len);
      if (z - a > 1e-9) segs.push({ a, z, p });
    }
    if (sB > path.len) segs.push({ a: Math.max(sA, path.len), z: sB, p: null });
    for (const sg of segs) {
      if (sg.p && sg.p.t === 'A') {
        const sweep = sg.p.sw * (sg.z - sg.a) / sg.p.len;
        const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
        for (let k = 1; k <= n; k++) {
          const sz = sg.a + (sg.z - sg.a) * k / n;
          verts[verts.length - 1].b = Math.tan(sweep / n / 4);
          verts.push(bv(primPoint(sg.p, sz - sg.p.s0), 0));
        }
      } else {
        verts[verts.length - 1].b = 0;
        verts.push(bv(pathPoint(path, sg.z), 0));
      }
    }
    return verts;
  }
  function reverseOpen(verts) {
    const n = verts.length, out = [];
    for (let i = 0; i < n; i++) out.push({ x: verts[n - 1 - i].x, y: verts[n - 1 - i].y, b: i < n - 1 ? -verts[n - 2 - i].b : 0 });
    return out;
  }
  function reverseClosed(verts) {
    const n = verts.length, out = [];
    for (let k = 0; k < n; k++) {
      const src = verts[n - 1 - k];
      const segIdx = (n - 2 - k + n) % n; // úsek v_{n-2-k} -> v_{n-1-k}
      out.push({ x: src.x, y: src.y, b: -verts[segIdx].b });
    }
    return out;
  }
  function pathPiece(path, s1, s2) {
    return s1 <= s2 ? pathPieceFwd(path, s1, s2) : reverseOpen(pathPieceFwd(path, s2, s1));
  }
  function joinPieces(pieces, closed) {
    let out = [];
    for (const pc of pieces) {
      if (!pc.length) continue;
      if (out.length && dist(out[out.length - 1], pc[0]) < 1e-6) out.pop();
      out = out.concat(pc.map(q => ({ x: q.x, y: q.y, b: q.b })));
    }
    return cleanVerts(out, closed);
  }

  function arcOfBulge(p1, p2, b) {
    const th = 4 * Math.atan(b);
    const c = sub(p2, p1), L = len(c);
    const mid = mul(add(p1, p2), 0.5);
    const nL = mul(perp(c), 1 / L);
    const d = (L / 2) / Math.tan(th / 2);
    const center = add(mid, mul(nL, d));
    const R = dist(p1, center);
    const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
    return { center, R, a1, th };
  }

  // vzorkovanie na body (pre kreslenie, plochy, obálky)
  function sampleVerts(verts, closed, stepRad) {
    stepRad = stepRad || 2 * DEG;
    const pts = [];
    const n = verts.length;
    const segN = closed ? n : n - 1;
    for (let i = 0; i < segN; i++) {
      const p1 = verts[i], p2 = verts[(i + 1) % n];
      pts.push(v(p1.x, p1.y));
      if (Math.abs(p1.b) > 1e-12 && dist(p1, p2) > 1e-9) {
        const a = arcOfBulge(p1, p2, p1.b);
        const k = Math.max(2, Math.ceil(Math.abs(a.th) / stepRad));
        for (let j = 1; j < k; j++) {
          const ang = a.a1 + a.th * j / k;
          pts.push(v(a.center.x + a.R * Math.cos(ang), a.center.y + a.R * Math.sin(ang)));
        }
      }
    }
    if (!closed && n) pts.push(v(verts[n - 1].x, verts[n - 1].y));
    return pts;
  }

  function polyArea(verts) {
    let A = 0;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const p = verts[i], q = verts[(i + 1) % n];
      A += cross(p, q) / 2;
      if (Math.abs(p.b) > 1e-12) {
        const a = arcOfBulge(p, q, p.b), th = Math.abs(a.th);
        A += Math.sign(a.th) * a.R * a.R / 2 * (th - Math.sin(th));
      }
    }
    return A;
  }

  function bbox(pts) {
    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const p of pts) {
      if (p.x < b.minX) b.minX = p.x; if (p.x > b.maxX) b.maxX = p.x;
      if (p.y < b.minY) b.minY = p.y; if (p.y > b.maxY) b.maxY = p.y;
    }
    b.w = b.maxX - b.minX; b.h = b.maxY - b.minY;
    return b;
  }

  function transformVerts(verts, fn) { return verts.map(q => { const p = fn(q); return { x: p.x, y: p.y, b: q.b }; }); }

  // orezanie mnohouholníka polrovinou n·p <= c (Sutherland–Hodgman)
  function clipHalf(pts, n, c) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const da = dot(n, a) - c, db = dot(n, b) - c;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        out.push(v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- vstupy
  const TYPY = {
    rovne: 'Rovné',
    L: 'Zalomené do L (klinové stupne)',
    U: 'Zalomené do U (klinové stupne)',
    Lp: 'L s podestou',
    Up: 'U s podestou',
    tocite: 'Točité vretenové'
  };

  const DEFAULTS = {
    projekt: 'Nový projekt', vypracoval: '',
    typ: 'L', smer: 'vlavo',
    H: 2800, N: 0, W: 900,
    L: 3800,
    A: 2600, B: 2600,
    R1: 2200, R2: 2200, M: 150,
    r: 0,
    Rv: 1000, Rs: 100, uhol: 360,
    w: 0, nb: 3,
    presah: 30, hrubka: 40, hrubkaPodst: 20,
    sirkaSchodnice: 300, hrubkaSchodnice: 60,
    podlahaDole: 0, podlahaHore: 0,
    strop: 250, otvor: 0,
    vyskaZabradlia: 900,
    doskaDlzka: 3000, doskaSirka: 1200, rez: 4,
    lim: { hMin: 150, hMax: 200, bMin: 220, kMin: 600, kMax: 650, kCiel: 630, klinMin: 100, klinVzd: 150, podchod: 2100 }
  };

  function num(x, def) {
    if (typeof x === 'number') return isFinite(x) ? x : def;
    if (typeof x === 'string') {
      const n = parseFloat(x.replace(',', '.').replace(/\s/g, ''));
      return isFinite(n) ? n : def;
    }
    return def;
  }

  function normalize(inp) {
    inp = inp || {};
    const P = {};
    for (const k of Object.keys(DEFAULTS)) {
      if (k === 'lim') continue;
      const d = DEFAULTS[k];
      P[k] = typeof d === 'number' ? num(inp[k], d) : (inp[k] != null ? String(inp[k]) : d);
    }
    P.lim = {};
    const li = inp.lim || {};
    for (const k of Object.keys(DEFAULTS.lim)) P.lim[k] = num(li[k], DEFAULTS.lim[k]);
    // nastavenia vizualizácie (len textové hodnoty) sa prenášajú bez zmeny
    if (inp.viz && typeof inp.viz === 'object') {
      P.viz = {};
      for (const k of Object.keys(inp.viz)) if (typeof inp.viz[k] === 'string' || typeof inp.viz[k] === 'boolean') P.viz[k] = inp.viz[k];
    }
    if (!TYPY[P.typ]) P.typ = DEFAULTS.typ;
    if (P.smer !== 'vpravo') P.smer = 'vlavo';
    P.N = Math.max(0, Math.round(P.N));
    P.nb = Math.max(0, Math.round(P.nb));
    // ručné úpravy výstupných hrán: { N, typ, hrany: { index hrany: { ds, dt } } }
    // ds = posun na výstupnej čiare, dt = dodatočný posun pri vnútornej hrane (mm)
    const up = inp.upravy;
    if (up && typeof up === 'object' && up.hrany && typeof up.hrany === 'object') {
      const hrany = {};
      for (const k of Object.keys(up.hrany)) {
        const i = parseInt(k, 10), e = up.hrany[k] || {};
        const ds = num(e.ds, 0), dt = num(e.dt, 0);
        if (i >= 0 && (ds || dt)) hrany[i] = { ds, dt };
      }
      if (Object.keys(hrany).length) P.upravy = { N: Math.round(num(up.N, 0)), typ: String(up.typ || ''), hrany };
    }
    return P;
  }

  // platné úpravy pre daný počet výšok a typ (inak null)
  function activeEdits(P, N) {
    const up = P.upravy;
    return up && up.N === N && up.typ === P.typ ? up.hrany : null;
  }

  // ---------------------------------------------------------------- geometria typov
  function geometry(P, res) {
    const T = P.typ;
    const err = m => res.errors.push(m);
    const g = { typ: T };
    let W = P.W;
    if (T === 'tocite') {
      W = P.Rv - P.Rs;
      if (P.Rs < 0) err('Polomer stĺpa nemôže byť záporný.');
      if (W <= 0) err('Vonkajší polomer musí byť väčší ako polomer stĺpa.');
      if (P.uhol <= 0) err('Celkové otočenie musí byť kladné.');
      if (P.uhol > 1080) err('Celkové otočenie je príliš veľké (max. 1080°).');
    } else if (W <= 0) err('Šírka ramena musí byť kladná.');
    g.W = W;
    let r = Math.max(0, P.r);
    if (T === 'rovne') {
      if (P.L <= 0) err('Dĺžka schodov musí byť kladná.');
    } else if (T === 'L' || T === 'Lp') {
      const lim = Math.min(P.A - W, P.B - W);
      if (P.A <= W) err('Rameno A musí byť dlhšie ako šírka ramena W.');
      if (P.B <= W) err('Rameno B musí byť dlhšie ako šírka ramena W.');
      if (r > lim && lim > 0) { res.warnings.push('Polomer vnútorného rohu bol zmenšený na ' + fmt(lim) + ' mm (krátke rameno).'); r = lim; }
    } else if (T === 'U' || T === 'Up') {
      if (P.M < 0) err('Zrkadlo nemôže byť záporné.');
      if (P.R1 <= W) err('Rameno 1 musí byť dlhšie ako šírka ramena W.');
      if (P.R2 <= W) err('Rameno 2 musí byť dlhšie ako šírka ramena W.');
      const lim = Math.min(Math.max(0, P.M) / 2, P.R1 - W, P.R2 - W);
      if (r > lim + 1e-9) {
        res.warnings.push('Polomer vnútorného rohu bol zmenšený na ' + fmt(Math.max(0, lim)) + ' mm (pri U je najviac polovica zrkadla).');
        r = Math.max(0, lim);
      }
    }
    g.r = r;
    if (res.errors.length) return g;

    const M = Math.max(0, P.M);
    if (T === 'rovne') {
      g.offset = d => makePath([Line(v(0, W - d), v(P.L, W - d))]);
      g.wall = makePath([Line(v(0, 0), v(P.L, 0))]);
      g.outer = [v(0, 0), v(P.L, 0)];
    } else if (T === 'L' || T === 'Lp') {
      const A = P.A, B = P.B, cx = A - W - r, C = v(cx, W + r);
      g.offset = d => makePath([
        Line(v(0, W - d), v(cx, W - d), v(1, 0)),
        Arc(C, r + d, -Math.PI / 2, Math.PI / 2),
        Line(v(A - W + d, W + r), v(A - W + d, B), v(0, 1))
      ]);
      g.wall = makePath([Line(v(0, 0), v(A, 0)), Line(v(A, 0), v(A, B))]);
      g.flightLen = [cx, B - W - r];
    } else if (T === 'U' || T === 'Up') {
      const L1 = P.R1, L2 = P.R2, cx = L1 - W - r;
      const C1 = v(cx, W + r), C2 = v(cx, W + M - r);
      g.offset = d => makePath([
        Line(v(0, W - d), v(cx, W - d), v(1, 0)),
        Arc(C1, r + d, -Math.PI / 2, Math.PI / 2),
        Line(v(L1 - W + d, W + r), v(L1 - W + d, W + M - r), v(0, 1)),
        Arc(C2, r + d, 0, Math.PI / 2),
        Line(v(cx, W + M + d), v(L1 - L2, W + M + d), v(-1, 0))
      ]);
      g.wall = makePath([Line(v(0, 0), v(L1, 0)), Line(v(L1, 0), v(L1, 2 * W + M)), Line(v(L1, 2 * W + M), v(L1 - L2, 2 * W + M))]);
      g.flightLen = [cx, L2 - W - r];
    } else if (T === 'tocite') {
      const th = P.uhol * DEG;
      g.offset = d => makePath([Arc(v(0, 0), P.Rs + d, -Math.PI / 2, th)]);
      g.wall = makePath([Arc(v(0, 0), P.Rv, -Math.PI / 2, th)]);
    }
    return g;
  }

  function fmt(x, d) { d = d == null ? 0 : d; return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); }

  // ---------------------------------------------------------------- vyrovnanie klinových stupňov
  function equalize(t, b, nb) {
    const N = t.length, d = [];
    for (let j = 1; j < N; j++) d[j] = t[j] - t[j - 1];
    const clusters = [];
    for (let j = 1; j < N; j++) {
      if (d[j] < 0.97 * b) {
        const last = clusters[clusters.length - 1];
        if (last && last.e === j - 1) last.e = j; else clusters.push({ a: j, e: j });
      }
    }
    const regions = [];
    if (!clusters.length) return { t: t.slice(), regions, d0: d };
    for (const c of clusters) {
      let m = 0, s = 0;
      for (let j = c.a; j <= c.e; j++) { const df = Math.max(0, b - d[j]); m += df * j; s += df; }
      c.c = s > 0 ? m / s : (c.a + c.e) / 2;
      c.ra = Math.max(1, c.a - nb);
      c.re = Math.min(N - 1, c.e + nb);
    }
    for (const c of clusters) {
      const last = regions[regions.length - 1];
      if (last && c.ra <= last.e) { last.e = Math.max(last.e, c.re); last.cs.push(c); }
      else regions.push({ a: c.ra, e: c.re, cs: [c] });
    }
    const tn = t.slice();
    for (const R of regions) {
      const n = R.e - R.a + 1;
      let L = 0;
      for (let j = R.a; j <= R.e; j++) L += d[j];
      const p = {};
      let sp = 0;
      for (let j = R.a; j <= R.e; j++) {
        let pj = 0;
        for (const c of R.cs) {
          if (j < c.ra || j > c.re) continue;
          let q = j <= c.c ? (j - (c.ra - 1)) / (c.c - (c.ra - 1)) : ((c.re + 1) - j) / ((c.re + 1) - c.c);
          q = Math.min(1, Math.max(0, q));
          if (q > pj) pj = q;
        }
        p[j] = pj; sp += pj;
      }
      const K = sp > 0 ? (n * b - L) / sp : 0;
      let acc = tn[R.a - 1];
      R.dNew = {};
      R.p = p;
      for (let j = R.a; j <= R.e; j++) {
        const dj = j === R.e ? (t[R.e] - acc) : b - K * p[j];
        R.dNew[j] = dj;
        acc += dj;
        tn[j] = j === R.e ? t[R.e] : acc;
      }
      R.K = K; R.L = L; R.n = n;
    }
    return { t: tn, regions, d0: d };
  }

  // ---------------------------------------------------------------- hlavný výpočet
  function compute(input) {
    const P = normalize(input);
    const res = { input: P, errors: [], warnings: [], checks: [], typNazov: TYPY[P.typ] };
    const g = geometry(P, res);
    res.W = g.W;
    if (res.errors.length) return finish(res);

    const W = g.W, lim = P.lim, H = P.H;
    if (H <= 0) { res.errors.push('Konštrukčná výška musí byť kladná.'); return finish(res); }
    const w = P.w > 0 ? P.w : W / 2;
    if (w >= W) { res.errors.push('Výstupná čiara musí ležať vnútri ramena (0 < w < W).'); return finish(res); }
    if (w < 1) { res.errors.push('Výstupná čiara je príliš blízko vnútornej hrany.'); return finish(res); }
    res.w = w;

    const inner = g.offset(0), walk = g.offset(w), wall = g.wall;
    const ctrlD = lim.klinVzd;
    const ctrl = ctrlD > 0 && ctrlD < W ? g.offset(ctrlD) : null;
    const Lw = walk.len;
    res.Lw = Lw;
    const landing = P.typ === 'Lp' || P.typ === 'Up';
    const hMid = (lim.hMin + lim.hMax) / 2;
    const score = (h, b) => Math.abs(2 * h + b - lim.kCiel) + 0.15 * Math.abs(h - hMid);

    // b a rozdelenie ramien pre podestu
    function landingPlan(N, h) {
      const nT = N - 2;
      if (nT < 0) return null;
      const S1 = g.flightLen[0], S2 = g.flightLen[1];
      const bIdeal = Math.max(lim.bMin, lim.kCiel - 2 * h);
      let best = null;
      for (let n1 = 0; n1 <= nT; n1++) {
        const n2 = nT - n1;
        const bmax = Math.min(n1 > 0 ? S1 / n1 : Infinity, n2 > 0 ? S2 / n2 : Infinity);
        const b = Math.min(bIdeal, bmax);
        if (!(b > 0) || !isFinite(b)) continue;
        const bal = Math.abs((S1 - n1 * b) - (S2 - n2 * b));
        if (!best || b > best.b + 1e-6 || (Math.abs(b - best.b) <= 1e-6 && bal < best.bal)) best = { n1, n2, b, bal };
      }
      return best;
    }

    // ---- počet výšok
    let N = P.N;
    const autoN = N === 0;
    if (autoN) {
      let lo = Math.max(landing ? 3 : 2, Math.ceil(H / lim.hMax - 1e-9));
      let hi = Math.floor(H / lim.hMin + 1e-9);
      if (lo > hi) {
        res.warnings.push('V rozsahu výšky stupňa ' + lim.hMin + '–' + lim.hMax + ' mm neexistuje celý počet výšok, použil sa najbližší.');
        lo = hi = Math.max(landing ? 3 : 2, Math.round(H / hMid));
      }
      let best = null;
      for (let n = lo; n <= hi; n++) {
        const h = H / n;
        let b;
        if (landing) { const lp = landingPlan(n, h); if (!lp) continue; b = lp.b; }
        else b = Lw / (n - 1);
        const sc = score(h, b);
        if (!best || sc < best.sc) best = { n, sc };
      }
      N = best ? best.n : Math.max(3, Math.round(H / hMid));
    }
    if (N < (landing ? 3 : 2)) { res.errors.push('Počet výšok je príliš malý.'); return finish(res); }
    const h = H / N;
    res.N = N; res.h = h; res.autoN = autoN;

    // ---- výstupné hrany: parametre na výstupnej čiare (s) a vnútornej hrane (t)
    let s = [], t = [], kinds = [], b, eq = null, plan = null;
    if (landing) {
      plan = landingPlan(N, h);
      if (!plan) { res.errors.push('Podestu nemožno rozvrhnúť.'); return finish(res); }
      b = plan.b;
      for (let i = 0; i <= plan.n1; i++) s.push(i * b);
      for (let k = 0; k <= plan.n2; k++) s.push(Lw - (plan.n2 - k) * b);
      for (let j = 1; j < N; j++) kinds[j] = j === plan.n1 + 1 ? 'podesta' : 'stupen';
      t = s.map(x => mapOffset(walk, inner, x));
      res.podesta = { index: plan.n1 + 1, n1: plan.n1, n2: plan.n2, dlzkaVyst: s[plan.n1 + 1] - s[plan.n1] };
    } else {
      b = Lw / (N - 1);
      for (let i = 0; i < N; i++) s.push(i * b);
      for (let j = 1; j < N; j++) kinds[j] = 'stupen';
      t = s.map(x => mapOffset(walk, inner, x));
      if (P.typ === 'L' || P.typ === 'U') {
        eq = equalize(t, b, P.nb);
        t = eq.t;
      }
    }
    res.b = b;
    res.krok = 2 * h + b;
    res.sklon = Math.atan2(h, b) / DEG;
    res.eq = eq ? eq.regions.map(R => ({ od: R.a, po: R.e, n: R.n, K: R.K, stupne: R.cs.map(c => [c.a, c.e]) })) : [];

    // ---- ručné úpravy hrán: posun na výstupnej čiare (vnútorný bod sa posunie zodpovedajúco) + posun pri vnútornej hrane
    const sBase = s.slice(), tBase = t.slice();
    const ed = activeEdits(P, N);
    res.upravy = { pocet: 0, ds: false };
    if (P.upravy && !ed) res.warnings.push('Ručné úpravy stupňov sa nepoužili – zmenil sa počet výšok alebo typ schodov.');
    if (ed) {
      for (const k of Object.keys(ed)) {
        const i = +k;
        if (i >= N) continue;
        const ds = i > 0 && i < N - 1 ? ed[k].ds : 0, dt = ed[k].dt;
        if (!ds && !dt) continue;
        const sn = s[i] + ds;
        t[i] += mapOffset(walk, inner, sn) - mapOffset(walk, inner, s[i]) + dt;
        s[i] = sn;
        res.upravy.pocet++;
        if (ds) res.upravy.ds = true;
      }
    }

    const advice = res.upravy.pocet ? 'Zmenšite ručný posun hrán alebo úpravy zrušte.' : 'Zväčšite počet vyrovnaných stupňov, polomer vnútorného rohu alebo dĺžky ramien.';
    // ---- kontrola poradia na vnútornej hrane
    const winder = P.typ === 'L' || P.typ === 'U';
    const innerPoint = inner.len < 1e-6; // točité bez stĺpa: vnútorná hrana je bod
    for (let i = 1; i < N; i++) {
      if (!(s[i] - s[i - 1] > 1e-6)) {
        res.errors.push('Výstupné hrany ' + i + ' a ' + (i + 1) + ' sa pretínajú na výstupnej čiare (ručná úprava). Zmenšite posun hrany.');
        break;
      }
    }
    for (let i = 1; i < N && !innerPoint && !res.errors.length; i++) {
      if (kinds[i] === 'podesta' ? t[i] - t[i - 1] < -1e-6 : !(t[i] - t[i - 1] > 1e-6)) {
        res.errors.push('Výstupné hrany ' + i + ' a ' + (i + 1) + ' sa pretínajú pri vnútornej hrane (stupeň ' + i + ' má nulovú alebo zápornú šírku). ' + advice);
        break;
      }
    }

    // ---- body hrán
    const edges = [];
    for (let i = 0; i < N; i++) {
      const Pi = pathPoint(inner, t[i]);
      const Wi = pathPoint(walk, s[i]);
      const d = sub(Wi, Pi);
      if (len(d) < 1e-6) { res.errors.push('Výstupná hrana ' + (i + 1) + ' je neurčitá.'); return finish(res); }
      const expU = s[i] / Lw * wall.len;
      const hits = intersectPath(wall, Pi, d, true).filter(x => x.lam > 1 - 1e-9);
      if (!hits.length) { res.errors.push('Výstupná hrana ' + (i + 1) + ' nepretína stenu. ' + advice); return finish(res); }
      const minLam = Math.min.apply(null, hits.map(x => x.lam));
      const cand = hits.filter(x => x.lam < minLam + 1e-6);
      cand.sort((a, b2) => Math.abs(a.s - expU) - Math.abs(b2.s - expU));
      const Q = cand[0];
      const up = ed && ed[i] && i < N ? ed[i] : null;
      edges.push({ i, s: s[i], t: t[i], u: Q.s, P: Pi, W: Wi, Q: Q.pt, ds: up && i > 0 && i < N - 1 ? up.ds : 0, dt: up ? up.dt : 0 });
    }

    // hrana nesmie prejsť cez vnútornú hranu (otvor / zrkadlo)
    if (!res.errors.length) {
      for (const e of edges) {
        const d = sub(e.Q, e.P);
        const hit = intersectPath(inner, e.P, d, false).find(x => x.lam > 1e-6 && x.lam < 1 - 1e-6 && dist(x.pt, e.P) > 0.01);
        if (hit) {
          res.errors.push('Výstupná hrana ' + (e.i + 1) + ' prechádza cez vnútornú hranu. ' + advice);
          break;
        }
      }
    }
    // poradie pri stene
    if (!res.errors.length) {
      for (let i = 1; i < N; i++) {
        if (!(edges[i].u - edges[i - 1].u > 1e-6)) {
          res.errors.push('Výstupné hrany ' + i + ' a ' + (i + 1) + ' sa pretínajú pri stene. ' + advice);
          break;
        }
      }
    }
    // parameter na kontrolnej čiare
    for (const e of edges) {
      e.c = null;
      if (!ctrl) continue;
      const exp = e.s / Lw * ctrl.len;
      const hits = intersectPath(ctrl, e.P, sub(e.Q, e.P), true).filter(x => x.lam >= -1e-9 && x.lam <= 1 + 1e-9);
      if (hits.length) {
        hits.sort((a, b2) => Math.abs(a.s - exp) - Math.abs(b2.s - exp));
        e.c = hits[0].s;
      }
    }
    res.edges = edges;

    // ---- stupne
    const treads = [];
    if (!res.errors.length) {
      for (let j = 1; j < N; j++) {
        const e0 = edges[j - 1], e1 = edges[j];
        const poly = joinPieces([
          [bv(e0.P), bv(e0.Q)],
          pathPiece(wall, e0.u, e1.u),
          [bv(e1.Q), bv(e1.P)],
          pathPiece(inner, e1.t, e0.t)
        ], true);
        // presah na nástupnej hrane
        const ed = norm(sub(e0.Q, e0.P));
        let n = perp(ed);
        if (dot(n, pathTangent(walk, e0.s)) > 0) n = mul(n, -1);
        let polyOver = poly, front = [e0.P, e0.Q], frontT = e0.t, frontU = e0.u;
        if (P.presah > 0) {
          const sP = add(e0.P, mul(n, P.presah)), sQ = add(e0.Q, mul(n, P.presah));
          // najbližší priesečník smerom späť po dráhe (max. parameter <= pôvodný)
          const lim = Math.max(10 * P.presah, 100);
          const pick = (path, Pt, s0) => intersectPath(path, sP, ed, true)
            .filter(x => x.s <= s0 + 1e-6 && dist(x.pt, Pt) < lim).sort((a, b2) => b2.s - a.s)[0];
          // ak posunutá hrana dráhu nepretne (napr. pri podeste za rohom), použije sa predĺženie dotyčnice v bode hrany
          const viaTangent = (path, pt, s0) => {
            const tg = pathTangent(path, s0 + 1e-3), den = cross(ed, tg); // dotyčnica na strane stupňa
            if (Math.abs(den) < 1e-9) return null;
            const lam = cross(sub(pt, sP), tg) / den;
            return add(sP, mul(ed, lam));
          };
          const pi = pick(inner, sP, e0.t), pw = pick(wall, sQ, e0.u);
          const pIn = pi ? pi.pt : viaTangent(inner, e0.P, e0.t);
          const pWa = pw ? pw.pt : viaTangent(wall, e0.Q, e0.u);
          if (pIn && pWa) {
            front = [pIn, pWa];
            polyOver = joinPieces([
              [bv(pIn), bv(pWa)],
              pw ? pathPiece(wall, pw.s, e1.u) : [bv(pWa)].concat(pathPiece(wall, e0.u, e1.u)),
              [bv(e1.Q), bv(e1.P)],
              pi ? pathPiece(inner, e1.t, pi.s) : pathPiece(inner, e1.t, e0.t).concat([bv(pIn)])
            ], true);
          } else res.warnings.push('Presah stupňa ' + j + ' sa nepodarilo vypočítať.');
        }
        const kind = kinds[j];
        const tr = {
          n: j, kind, vyska: j * h,
          poly, polyOver, front,
          sirky: {
            vnutri: e1.t - e0.t,
            vystup: e1.s - e0.s,
            vonku: e1.u - e0.u,
            kontrola: e0.c != null && e1.c != null ? e1.c - e0.c : null
          },
          plocha: polyArea(poly),
          plochaPrirez: 0
        };
        tr.plochaSPresahom = polyArea(polyOver);
        // prírez: obdĺžnik natočený podľa nástupnej hrany
        const fdir = norm(sub(front[1], front[0]));
        let ang = -Math.atan2(fdir.y, fdir.x);
        const pts = sampleVerts(polyOver, true, 1 * DEG);
        let rp = pts.map(p => rotate(sub(p, front[0]), ang));
        let bb = bbox(rp);
        if (bb.maxY + bb.minY < 0) { ang += Math.PI; rp = pts.map(p => rotate(sub(p, front[0]), ang)); bb = bbox(rp); }
        tr.prirez = { dlzka: bb.w, sirka: bb.h, uhol: ang, origin: front[0], minX: bb.minX, minY: bb.minY };
        tr.plochaPrirez = bb.w * bb.h;
        // dĺžky hrán tvaru s presahom
        tr.hrany = edgeLengths(polyOver);
        treads.push(tr);
      }
    }
    res.treads = treads;

    // ---- podstupnice
    // prvá od hrubej podlahy dole, posledná po hrubú podlahu hore
    const dole = Math.max(0, P.podlahaDole), hore = Math.max(0, P.podlahaHore);
    res.podlaha = { dole, hore, hruba: H + dole - hore };
    if (hore >= h) res.warnings.push('Nášľapná vrstva hore je hrubšia ako výška stupňa.');
    res.risers = edges.map(e => ({
      n: e.i + 1, P: e.P, Q: e.Q, dlzka: dist(e.P, e.Q),
      vyska: Math.max(0, e.i === N - 1 ? h - hore : h - P.hrubka + (e.i === 0 ? dole : 0))
    }));

    // ---- podchodná výška pod stropom (okrem točitých)
    if (!res.errors.length && P.typ !== 'tocite') res.strop = headroom(P, res, edges, kinds, N, h, H);

    // ---- geometria na kreslenie
    res.geom = {
      inner: pathPiece(inner, 0, inner.len),
      walk: pathPiece(walk, 0, walk.len),
      wall: pathPiece(wall, 0, wall.len),
      ctrl: ctrl ? pathPiece(ctrl, 0, ctrl.len) : null,
      start: [inner.start, wall.start],
      end: [inner.end, wall.end],
      walkStart: walk.start, walkEnd: walk.end, walkEndDir: walk.t1,
      column: P.typ === 'tocite' ? { c: v(0, 0), r: P.Rs } : null,
      innerS: samplePathS(inner, 40), wallS: samplePathS(wall, 40), walkS: samplePathS(walk, 40),
      hasWall: P.typ !== 'tocite'
    };
    res.geom.outline = joinPieces([
      [bv(inner.start), bv(wall.start)],
      pathPiece(wall, 0, wall.len),
      [bv(wall.end), bv(inner.end)],
      pathPiece(inner, inner.len, 0)
    ], true);

    // ---- rozvinutie schodníc
    if (!res.errors.length) res.unfold = unfold(P, res, inner, wall, edges, kinds, N, h, H);

    // ---- kontroly
    checks(P, res, winder);
    return finish(res);
  }

  function edgeLengths(verts) {
    const out = [];
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const p = verts[i], q = verts[(i + 1) % n];
      let L = dist(p, q);
      if (Math.abs(p.b) > 1e-12) { const a = arcOfBulge(p, q, p.b); L = Math.abs(a.th) * a.R; }
      out.push({ i, L, oblúk: Math.abs(p.b) > 1e-12 });
    }
    return out;
  }

  function cornerParams(path) {
    const out = [];
    const ps = path.prims;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.t === 'A' && i > 0 && i < ps.length - 1) {
        if (p.len < 1e-9) out.push({ s: p.s0, typ: 'roh' });
        else { out.push({ s: p.s0, typ: 'začiatok oblúka' }); out.push({ s: p.s0 + p.len, typ: 'koniec oblúka' }); }
      } else if (p.t === 'L' && i > 0 && ps[i - 1].t === 'L') out.push({ s: p.s0, typ: 'roh' });
    }
    return out;
  }

  // orientačný tvar schodnice
  function stringerShapes(pos, kinds, N, h, H, Ws, e, dole) {
    const groups = [];
    let cur = null;
    for (let j = 1; j < N; j++) {
      if (kinds[j] === 'podesta') { cur = null; continue; }
      if (!cur) { cur = { a: j, e: j }; groups.push(cur); } else cur.e = j;
    }
    const shapes = [];
    for (const gr of groups) {
      const U = [];
      for (let k = gr.a; k <= gr.e; k++) U.push(v(pos[k - 1], k * h + e));
      // koncový nosný bod: podlaha hore alebo predná hrana podesty
      U.push(v(pos[gr.e], (gr.e + 1) * h + e));
      const yBase = gr.a === 1 ? -(dole || 0) : (gr.a - 1) * h; // prvé rameno stojí na hrubej podlahe
      const yTop = (gr.e + 1) * h + e;
      const xEnd = pos[gr.e];
      if (U.length < 2) continue;
      // dolná hrana: zvislý posun o Ws / cos(sklon)
      const slope = k => {
        const a = U[Math.max(0, k - 1)], b = U[Math.min(U.length - 1, k + 1)];
        let ang = Math.atan2(b.y - a.y, Math.max(1e-6, b.x - a.x));
        return Math.min(ang, 70 * DEG);
      };
      const D = U.map((p, k) => v(p.x, p.y - Ws / Math.cos(slope(k))));
      // predĺženie koncov
      const ext = (arr, k0, k1, L) => { const d = norm(sub(arr[k1], arr[k0])); return add(arr[k1], mul(d, L)); };
      const big = 3 * Ws + 2 * h;
      const Ue = [ext(U, 1, 0, big)].concat(U, [ext(U, U.length - 2, U.length - 1, big)]);
      const De = [ext(D, 1, 0, big)].concat(D, [ext(D, D.length - 2, D.length - 1, big)]);
      let poly = Ue.concat(De.slice().reverse());
      poly = clipHalf(poly, v(0, -1), -yBase);       // y >= yBase
      poly = clipHalf(poly, v(0, 1), yTop);          // y <= yTop
      poly = clipHalf(poly, v(1, 0), xEnd);          // x <= xEnd
      // prírez: natočený podľa spojnice prvej a poslednej hrany
      const dir = norm(sub(U[U.length - 1], U[0]));
      const ang = -Math.atan2(dir.y, dir.x);
      const bb = bbox(poly.map(p => rotate(p, ang)));
      shapes.push({ od: gr.a, po: gr.e, poly, nosing: U, prirez: { dlzka: bb.w, sirka: bb.h, sklon: -ang / DEG } });
    }
    return shapes;
  }

  function unfold(P, res, inner, wall, edges, kinds, N, h, H) {
    const make = (path, key) => {
      const pos = edges.map(e => e[key]);
      const prof = [v(pos[0], 0)];
      for (let i = 0; i < N; i++) {
        prof.push(v(pos[i], (i + 1) * h));
        if (i < N - 1) prof.push(v(pos[i + 1], (i + 1) * h));
      }
      return {
        dlzka: path.len,
        pos,
        rohy: cornerParams(path),
        profil: prof,
        tvary: stringerShapes(pos, kinds, N, h, H, P.sirkaSchodnice, 50, Math.max(0, P.podlahaDole))
      };
    };
    return { vnutorna: make(inner, 't'), vonkajsia: make(wall, 'u') };
  }

  // výška spojnice hrán stupňov (nad podestou jej povrch) v parametri s výstupnej čiary
  function nosingZ(edges, kinds, N, h, s) {
    if (s <= edges[0].s) return h;
    for (let i = 0; i < N - 1; i++) {
      const a = edges[i].s, b = edges[i + 1].s;
      if (s <= b) return kinds[i + 1] === 'podesta' ? (i + 1) * h : (i + 1) * h + h * (s - a) / (b - a || 1);
    }
    return N * h;
  }

  // otvor v strope meraný po výstupnej čiare od výstupu
  function headroom(P, res, edges, kinds, N, h, H) {
    const Lw = edges[N - 1].s, s0 = edges[0].s;
    const zReq = H - Math.max(0, P.strop) - P.lim.podchod; // najvyššia spojnica hrán pod stropom
    let sReq;
    if (zReq <= h) sReq = s0;
    else if (zReq >= H) sReq = null;
    else {
      sReq = Lw;
      for (let i = 0; i < N - 1; i++) {
        const a = edges[i].s, b = edges[i + 1].s, z0 = (i + 1) * h;
        if (kinds[i + 1] === 'podesta') { if (z0 > zReq) { sReq = a; break; } continue; }
        if (z0 + h > zReq) { sReq = a + (b - a) * Math.max(0, zReq - z0) / h; break; }
      }
    }
    const out = { zReq, sReq, otvorMin: sReq == null ? Infinity : Lw - sReq, sEdge: null, svetla: null };
    if (P.otvor > 0) {
      out.sEdge = Lw - P.otvor;
      out.svetla = H - Math.max(0, P.strop) - nosingZ(edges, kinds, N, h, out.sEdge);
    }
    return out;
  }

  // zábradlie: rozmiestnenie prvkov podľa druhu (rovnaké pravidlá pre 3D aj rozpis)
  const ZABRADLIE = {
    ziadne: 'Bez zábradlia',
    ocel: 'Čierna oceľ – zvislé tyčky',
    nerez: 'Nerez – vodorovné priečky',
    sklo: 'Sklo s nerezovým madlom',
    drevo: 'Drevené stĺpiky a madlo'
  };
  function railing(res, typ) {
    if (!res.unfold || !res.treads || !res.treads.length || !ZABRADLIE[typ] || typ === 'ziadne') return null;
    const inp = res.input, h = res.h, N = res.N;
    const spiral = inp.typ === 'tocite';
    const pos = spiral ? res.unfold.vonkajsia.pos : res.unfold.vnutorna.pos;
    const HR = inp.vyskaZabradlia > 0 ? inp.vyskaZabradlia : 900;
    // body madla: stred každého stupňa vo výške hrany + HR
    const hp = [{ s: pos[0], z: h + HR }];
    for (let j = 1; j < N; j++) {
      const tr = res.treads[j - 1];
      if (tr.kind === 'podesta') { hp.push({ s: pos[j - 1] + 1, z: j * h + HR }); hp.push({ s: pos[j] - 1, z: j * h + HR }); }
      else hp.push({ s: (pos[j - 1] + pos[j]) / 2, z: j * h + HR });
    }
    hp.push({ s: pos[N - 1], z: inp.H + HR });
    const pts = [];
    for (const q of hp) if (!pts.length || q.s - pts[pts.length - 1].s > 8) pts.push(q); // ostrý roh
    const zAt = s => {
      if (s <= pts[0].s) return pts[0].z;
      for (let i = 1; i < pts.length; i++) if (s <= pts[i].s) return pts[i - 1].z + (pts[i].z - pts[i - 1].z) * (s - pts[i - 1].s) / (pts[i].s - pts[i - 1].s || 1);
      return pts[pts.length - 1].z;
    };
    const treadTop = s => { for (let j = 1; j < N; j++) if (s <= pos[j] + 1e-6) return j * h; return inp.H; };
    let madlo = 0;
    for (let i = 1; i < pts.length; i++) madlo += Math.hypot(pts[i].s - pts[i - 1].s, pts[i].z - pts[i - 1].z);
    const R = { typ, nazov: ZABRADLIE[typ], spiral, pos, HR, pts, zAt, treadTop, madlo, posts: [], rods: [], glass: [], prieck: 0 };
    const post = (s, w, extra, druh) => R.posts.push({ s, w, extra, druh, z0: treadTop(s), z1: zAt(s) + extra });
    post(pos[0] + 60, typ === 'drevo' ? 70 : 45, 40, 'koncový');
    post(pos[N - 1] - 60, typ === 'drevo' ? 70 : 45, 40, 'koncový');
    for (let j = 1; j < N; j++) {
      const a = pos[j - 1], b = pos[j], w = b - a;
      if (typ === 'ocel') {
        const k = w > 260 ? 3 : w > 140 ? 2 : w > 40 ? 1 : 0;
        for (let i = 1; i <= k; i++) { const s = a + w * i / (k + 1); R.rods.push({ s, j, z0: j * h, z1: zAt(s) }); }
      } else if (typ === 'drevo') {
        if (w > 40) post((a + b) / 2, 42, 0, 'medziľahlý');
      } else if (typ === 'sklo') {
        const g0 = a + Math.min(12, w * 0.1), g1 = b - Math.min(12, w * 0.1);
        if (g1 - g0 >= 20) R.glass.push({ g0, g1, j, z0: j * h + 60, z1a: zAt(g0) - 50, z1b: zAt(g1) - 50 });
      }
    }
    if (typ === 'nerez') {
      R.prieck = 4;
      for (let j = 1; j < N; j += 2) { const s = (pos[j - 1] + pos[j]) / 2; if (pos[j] - pos[j - 1] > 40) post(s, 36, -10, 'medziľahlý'); }
    }
    return R;
  }

  // rozloženie obdĺžnikových prírezov na dosky (MaxRects, bez otáčania – vlákna po dĺžke dosky)
  function nest(pieces, D, S, kerf) {
    // niekoľko poradí a kritérií, vyberie sa najmenej dosiek (potom najprázdnejšia posledná)
    const orders = [
      (a, b) => b.w * b.h - a.w * a.h || b.w - a.w,
      (a, b) => b.h - a.h || b.w - a.w,
      (a, b) => b.w - a.w || b.h - a.h,
      (a, b) => Math.max(b.w / D, b.h / S) - Math.max(a.w / D, a.h / S)
    ];
    let best = null;
    for (const ord of orders) for (const rule of ['bssf', 'bl', 'baf']) {
      const r = nestOnce(pieces.slice().sort(ord), D, S, kerf, rule);
      const last = r.boards.length ? r.boards[r.boards.length - 1].vyuzitie : 0;
      if (!best || r.boards.length < best.boards.length || (r.boards.length === best.boards.length && last < best.last)) { best = r; best.last = last; }
    }
    delete best.last;
    return best;
  }
  function nestOnce(list, D, S, kerf, rule) {
    const boards = [], nevojde = [];
    const place = (fr, w, h) => {
      let best = null;
      for (const f of fr) {
        if (w <= f.w + 1e-6 && h <= f.h + 1e-6) {
          const sc = rule === 'bl' ? f.y : rule === 'baf' ? f.w * f.h - w * h : Math.min(f.w - w, f.h - h);
          const sc2 = rule === 'bl' ? f.x : Math.min(f.w - w, f.h - h);
          if (!best || sc < best.sc || (sc === best.sc && sc2 < best.sc2) || (sc === best.sc && sc2 === best.sc2 && (f.y < best.f.y || (f.y === best.f.y && f.x < best.f.x)))) best = { f, sc, sc2 };
        }
      }
      return best && best.f;
    };
    const split = (fr, r) => {
      const out = [];
      for (const f of fr) {
        if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) { out.push(f); continue; }
        if (r.x > f.x) out.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
        if (r.x + r.w < f.x + f.w) out.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
        if (r.y > f.y) out.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
        if (r.y + r.h < f.y + f.h) out.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
      }
      return out.filter((a, i) => a.w > 1e-6 && a.h > 1e-6 && !out.some((b, k) => k !== i && b.x <= a.x + 1e-9 && b.y <= a.y + 1e-9 && b.x + b.w >= a.x + a.w - 1e-9 && b.y + b.h >= a.y + a.h - 1e-9 && (k < i || b.w * b.h > a.w * a.h)));
    };
    for (const p of list) {
      // rez sa pripočíta k dielcu; na okraji dosky netreba
      const w = p.w + kerf, hh = p.h + kerf;
      if (p.w > D + 1e-6 || p.h > S + 1e-6) { nevojde.push(p); continue; }
      let done = false;
      for (const b of boards) {
        const f = place(b.free, w, hh) || place(b.free, p.w, p.h);
        if (!f) continue;
        const r = { x: f.x, y: f.y, w: Math.min(w, D - f.x), h: Math.min(hh, S - f.y) };
        b.free = split(b.free, r);
        b.parts.push(Object.assign({}, p, { x: f.x, y: f.y }));
        done = true; break;
      }
      if (!done) {
        const b = { free: [{ x: 0, y: 0, w: D, h: S }], parts: [] };
        const r = { x: 0, y: 0, w: Math.min(w, D), h: Math.min(hh, S) };
        b.free = split(b.free, r);
        b.parts.push(Object.assign({}, p, { x: 0, y: 0 }));
        boards.push(b);
      }
    }
    for (const b of boards) { b.plocha = b.parts.reduce((a, q) => a + q.w * q.h, 0); b.vyuzitie = b.plocha / (D * S); delete b.free; }
    return { boards, nevojde, D, S, kerf };
  }

  function checks(P, res, winder) {
    const L = P.lim;
    const C = res.checks;
    const add = (id, nazov, ok, hodnota, limit, level) => C.push({ id, nazov, ok, hodnota, limit, level: ok ? 'ok' : (level || 'warn') });
    if (res.h == null) return;
    add('h', 'Výška stupňa h', res.h >= L.hMin - 1e-9 && res.h <= L.hMax + 1e-9, fmt(res.h, 1) + ' mm', L.hMin + '–' + L.hMax + ' mm');
    const tr = res.treads || [];
    // pri ručnom posune na výstupnej čiare sa šírky stupňov líšia: kontroluje sa najmenšia a najväčšia
    const bs = res.upravy && res.upravy.ds ? tr.filter(x => x.kind === 'stupen').map(x => x.sirky.vystup) : [];
    if (bs.length) {
      const bMin = Math.min.apply(null, bs), bMax = Math.max.apply(null, bs);
      add('b', 'Šírka stupňa b na výstupnej čiare (najmenšia)', bMin >= L.bMin - 1e-9, fmt(bMin, 1) + ' mm', '≥ ' + L.bMin + ' mm');
      add('k', 'Krokový modul 2h + b', 2 * res.h + bMin >= L.kMin - 1e-9 && 2 * res.h + bMax <= L.kMax + 1e-9, fmt(2 * res.h + bMin, 1) + '–' + fmt(2 * res.h + bMax, 1) + ' mm', L.kMin + '–' + L.kMax + ' mm');
      add('brov', 'Rovnaká šírka stupňov na výstupnej čiare', bMax - bMin <= 1 + 1e-9, 'rozdiel ' + fmt(bMax - bMin, 1) + ' mm', '≤ 1 mm');
    } else {
      add('b', 'Šírka stupňa b na výstupnej čiare', res.b >= L.bMin - 1e-9, fmt(res.b, 1) + ' mm', '≥ ' + L.bMin + ' mm');
      add('k', 'Krokový modul 2h + b', res.krok >= L.kMin - 1e-9 && res.krok <= L.kMax + 1e-9, fmt(res.krok, 1) + ' mm', L.kMin + '–' + L.kMax + ' mm');
    }
    const steps = tr.filter(x => x.kind === 'stupen');
    if (P.typ === 'L' || P.typ === 'U' || P.typ === 'tocite') {
      const ks = steps.map(x => x.sirky.kontrola).filter(x => x != null);
      if (ks.length) {
        const mn = Math.min.apply(null, ks);
        const which = steps.find(x => x.sirky.kontrola === mn);
        res.najuzsiKlin = { hodnota: mn, stupen: which ? which.n : null };
        add('klin', 'Najužší klin (' + L.klinVzd + ' mm od vnútornej hrany)', mn >= L.klinMin - 1e-9, fmt(mn, 1) + ' mm (st. ' + (which ? which.n : '?') + ')', '≥ ' + L.klinMin + ' mm');
      } else {
        add('klin', 'Najužší klin (' + L.klinVzd + ' mm od vnútornej hrany)', false, 'nedá sa zmerať', 'šírka ramena > ' + L.klinVzd + ' mm');
      }
      const vn = steps.map(x => x.sirky.vnutri);
      if (vn.length) res.najuzsiVnutri = Math.min.apply(null, vn);
    }
    if (P.typ === 'L' || P.typ === 'U') {
      const bad = res.errors.some(e => e.indexOf('pretínajú') >= 0 || e.indexOf('prechádza') >= 0);
      add('poradie', 'Výstupné hrany sa nepretínajú', !bad, bad ? 'pretínajú sa' : 'v poriadku', 'poradie rastie', 'err');
    }
    if (res.strop && P.otvor > 0) {
      const st = res.strop;
      add('podchodStrop', 'Podchodná výška pod stropom', st.svetla >= L.podchod - 1e-9, fmt(st.svetla) + ' mm', '≥ ' + L.podchod + ' mm (otvor ≥ ' + fmt(Math.ceil(st.otvorMin)) + ' mm)');
    }
    if (P.typ === 'tocite' && res.N) {
      const dth = P.uhol / (res.N - 1);
      const k = 360 / dth;
      const clear = Math.floor(k + 1e-9) * res.h - P.hrubka;
      res.podchod = clear;
      if (P.uhol + dth > 360) add('podchod', 'Podchodná výška (po 360°)', clear >= L.podchod - 1e-9, fmt(clear) + ' mm', '≥ ' + L.podchod + ' mm');
      else add('podchod', 'Podchodná výška (po 360°)', true, 'schody sa neprekrývajú', '≥ ' + L.podchod + ' mm');
    }
  }

  // zrkadlenie (zákruta vpravo) a stav
  function finish(res) {
    if (res.input.smer === 'vpravo' && res.edges && res.geom) mirrorResult(res);
    res.mirrored = res.input.smer === 'vpravo';
    if (res.errors.length) res.stav = 'chyba';
    else if (res.checks.some(c => !c.ok)) res.stav = 'pozor';
    else res.stav = 'ok';
    return res;
  }

  function mirrorResult(res) {
    const mp = p => p && v(p.x, -p.y);
    const mo = vs => vs && vs.map(q => ({ x: q.x, y: -q.y, b: -q.b }));
    const mc = vs => vs && reverseClosed(mo(vs));
    for (const e of res.edges) { e.P = mp(e.P); e.Q = mp(e.Q); e.W = mp(e.W); }
    for (const t of res.treads) {
      t.poly = mc(t.poly); t.polyOver = mc(t.polyOver);
      t.front = t.front.map(mp);
      // prírez: znovu určiť natočenie
      const fdir = norm(sub(t.front[1], t.front[0]));
      let ang = -Math.atan2(fdir.y, fdir.x);
      const pts = sampleVerts(t.polyOver, true, DEG);
      let rp = pts.map(p => rotate(sub(p, t.front[0]), ang));
      let bb = bbox(rp);
      if (bb.maxY + bb.minY < 0) { ang += Math.PI; rp = pts.map(p => rotate(sub(p, t.front[0]), ang)); bb = bbox(rp); }
      t.prirez = { dlzka: bb.w, sirka: bb.h, uhol: ang, origin: t.front[0], minX: bb.minX, minY: bb.minY };
      t.hrany = edgeLengths(t.polyOver);
    }
    for (const r of res.risers) { r.P = mp(r.P); r.Q = mp(r.Q); }
    const G = res.geom;
    G.inner = mo(G.inner); G.walk = mo(G.walk); G.wall = mo(G.wall); G.ctrl = mo(G.ctrl);
    G.start = G.start.map(mp); G.end = G.end.map(mp);
    G.walkStart = mp(G.walkStart); G.walkEnd = mp(G.walkEnd); G.walkEndDir = mp(G.walkEndDir);
    G.outline = mc(G.outline);
    G.innerS = G.innerS.map(q => ({ x: q.x, y: -q.y, s: q.s }));
    G.wallS = G.wallS.map(q => ({ x: q.x, y: -q.y, s: q.s }));
    G.walkS = G.walkS.map(q => ({ x: q.x, y: -q.y, s: q.s }));
    if (res.unfold) { /* rozvinutie nezávisí od smeru */ }
  }

  // tvar stupňa v polohe na výrobu: nástupná hrana dole, začiatok v (0,0)
  function partShape(tr) {
    const pr = tr.prirez;
    const tf = p => { const q = rotate(sub(p, pr.origin), pr.uhol); return v(q.x - pr.minX, q.y - pr.minY); };
    return {
      poly: transformVerts(tr.polyOver, tf),
      front: tr.front.map(tf),
      w: pr.dlzka, h: pr.sirka
    };
  }

  return {
    TYPY, DEFAULTS, ZABRADLIE, normalize, compute, equalize, railing, nest, nosingZ,
    sampleVerts, polyArea, bbox, transformVerts, reverseClosed, arcOfBulge, partShape, fmt,
    // pre testy
    _internal: { makePath, Line, Arc, pathPoint, intersectPath, mapOffset, pathPiece, joinPieces, cleanVerts }
  };
});
