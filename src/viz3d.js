/*
 * Schodiskár – 3D vizualizácia (three.js): schody, zábradlie, priestor, materiály.
 * Súradnice: pôdorys (x, y) v mm -> three (x, výška, -y) v metroch.
 */
(function (root) {
  'use strict';
  const THREE = root.THREE, C = root.SchodyCore;
  const MM = 0.001;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- katalógy
  const MAT = {
    dub: { n: 'Dub', type: 'wood', base: [178, 134, 88], dark: [118, 80, 46], rough: 0.55 },
    dub_biely: { n: 'Dub bielený', type: 'wood', base: [222, 206, 182], dark: [172, 150, 120], rough: 0.6 },
    buk: { n: 'Buk', type: 'wood', base: [206, 152, 110], dark: [160, 108, 74], rough: 0.5 },
    jasen: { n: 'Jaseň', type: 'wood', base: [218, 192, 152], dark: [158, 126, 88], rough: 0.55 },
    orech: { n: 'Orech', type: 'wood', base: [112, 76, 52], dark: [56, 34, 22], rough: 0.45 },
    smrek: { n: 'Smrek', type: 'wood', base: [226, 190, 132], dark: [178, 132, 76], rough: 0.65 },
    mramor: { n: 'Mramor', type: 'marble', base: [236, 235, 231], dark: [128, 128, 134], rough: 0.18 },
    beton: { n: 'Pohľadový betón', type: 'concrete', base: [158, 157, 152], rough: 0.85 },
    biela: { n: 'Biela lakovaná', type: 'paint', base: [242, 242, 238], rough: 0.35 },
    antracit: { n: 'Antracit', type: 'paint', base: [58, 61, 66], rough: 0.5 },
    ocel: { n: 'Čierna oceľ', type: 'metal', base: [36, 37, 40], metal: 0.8, rough: 0.42 },
    nerez: { n: 'Nerez', type: 'metal', base: [205, 207, 211], metal: 1, rough: 0.22 },
    // len pre priestory
    parket_dub: { type: 'parquet', base: [186, 146, 100], dark: [126, 88, 52], rough: 0.5, size: 2 },
    parket_jasen: { type: 'parquet', base: [222, 200, 164], dark: [166, 136, 98], rough: 0.5, size: 2 },
    parket_orech: { type: 'parquet', base: [120, 84, 58], dark: [62, 40, 26], rough: 0.45, size: 2 },
    beton_podlaha: { type: 'concrete', base: [138, 138, 134], rough: 0.6, size: 2 },
    tehla: { type: 'brick', base: [150, 70, 48], dark: [100, 44, 30], rough: 0.9 },
    obklad_smrek: { type: 'panel', base: [214, 170, 112], dark: [160, 112, 62], rough: 0.7 },
    omietka_biela: { type: 'paint', base: [238, 236, 231], rough: 0.95 },
    omietka_seda: { type: 'paint', base: [214, 217, 220], rough: 0.95 },
    omietka_teplá: { type: 'paint', base: [232, 224, 210], rough: 0.95 },
    strop: { type: 'paint', base: [246, 246, 244], rough: 0.95 },
    studio: { type: 'paint', base: [226, 229, 233], rough: 0.9 }
  };
  const STUPNE = ['dub', 'dub_biely', 'buk', 'jasen', 'orech', 'smrek', 'mramor', 'beton', 'biela', 'antracit'];
  const PODSTUPNICE = ['ziadne', 'biela', 'antracit', 'dub', 'dub_biely', 'buk', 'jasen', 'orech', 'smrek', 'mramor', 'beton'];
  const SCHODNICE = ['biela', 'antracit', 'ocel', 'dub', 'buk', 'jasen', 'orech', 'smrek', 'beton'];
  const ZABRADLIE = C.ZABRADLIE;
  const PRIESTORY = {
    moderny: { n: 'Moderný interiér', wall: 'omietka_biela', floor: 'parket_dub', bg: 0xdfe3e8, sun: 0xfff1df },
    skandinavsky: { n: 'Škandinávsky', wall: 'omietka_seda', floor: 'parket_jasen', bg: 0xe6e9ec, sun: 0xffffff },
    loft: { n: 'Loft (tehla, betón)', wall: 'tehla', floor: 'beton_podlaha', bg: 0xcfd1d2, sun: 0xffe7cc },
    chata: { n: 'Drevenica', wall: 'obklad_smrek', floor: 'parket_orech', bg: 0xd8d2c8, sun: 0xffe2b8 },
    studio: { n: 'Bez priestoru (štúdio)', wall: null, floor: 'studio', bg: 0xe9ecef, sun: 0xffffff }
  };
  const DEFAULT = { priestor: 'moderny', stupne: 'dub', podstupnice: 'biela', schodnice: 'biela', zabradlie: 'ocel', poschodie: true };
  const VIEWS = { celok: 'Celkový pohľad', nastup: 'Z nástupu', zhora: 'Zhora', poschodie: 'Z poschodia' };

  function settings(viz) {
    const s = Object.assign({}, DEFAULT, viz || {});
    if (!PRIESTORY[s.priestor]) s.priestor = DEFAULT.priestor;
    if (STUPNE.indexOf(s.stupne) < 0) s.stupne = DEFAULT.stupne;
    if (PODSTUPNICE.indexOf(s.podstupnice) < 0) s.podstupnice = DEFAULT.podstupnice;
    if (SCHODNICE.indexOf(s.schodnice) < 0) s.schodnice = DEFAULT.schodnice;
    if (!ZABRADLIE[s.zabradlie]) s.zabradlie = DEFAULT.zabradlie;
    s.poschodie = s.poschodie !== false;
    return s;
  }

  // ---------------------------------------------------------------- procedurálne textúry
  function hash(x, y, sd) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((sd | 0) + 1, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // periodická hodnotová šumová funkcia (perióda px, py v bunkách)
  function vnoise(x, y, px, py, sd) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const m = (a, p) => ((a % p) + p) % p;
    const x0 = m(xi, px), x1 = m(xi + 1, px), y0 = m(yi, py), y1 = m(yi + 1, py);
    const a = hash(x0, y0, sd), b = hash(x1, y0, sd), c = hash(x0, y1, sd), d = hash(x1, y1, sd);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  function fbm(u, v, fx, fy, oct, sd) {
    let s = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < oct; o++) {
      const k = 1 << o;
      s += amp * vnoise(u * fx * k, v * fy * k, fx * k, fy * k, sd + o);
      norm += amp; amp *= 0.5;
    }
    return s / norm;
  }
  const mix = (a, b, t) => a + (b - a) * t;
  const fract = x => x - Math.floor(x);

  function woodSample(u, v, d, sd, lamN) {
    // u = pozdĺž vlákien, v = naprieč
    const lam = Math.floor(v * lamN);
    const tone = (hash(lam, 3, sd) - 0.5) * 0.16;
    const n = fbm(u, v, 3, 12, 4, sd);
    const ring = v * 36 + n * 3.4 + hash(lam, 9, sd) * 7 + fbm(u, v, 2, 2, 2, sd + 11) * 1.5;
    let g = 0.5 + 0.5 * Math.sin(ring * TAU);
    g = Math.pow(g, 3.5);
    const fine = vnoise(u * 6, v * 260, 6, 260, sd + 21);
    const t = Math.min(1, g * 0.38 + fine * 0.2);
    return [0, 1, 2].map(i => Math.max(0, Math.min(255, mix(d.base[i], d.dark[i], t) * (1 + tone))));
  }

  const texCache = {};
  function texture(key) {
    if (texCache[key]) return texCache[key];
    const d = MAT[key];
    const N = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(N, N);
    const px = img.data;
    const sd = key.length * 31 + key.charCodeAt(0);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N;
        let c;
        if (d.type === 'wood') c = woodSample(u, v, d, sd, 11);
        else if (d.type === 'panel') {
          // zvislé dosky obkladu
          const bu = u * 7, b = Math.floor(bu), f = fract(bu);
          c = woodSample(v, fract(u * 7) / 7 + b / 7, d, sd + b * 13, 1);
          if (f < 0.012 || f > 0.988) c = c.map(q => q * 0.45);
          else if (f < 0.03) c = c.map(q => q * 0.85);
        } else if (d.type === 'parquet') {
          const rows = 10, row = Math.floor(v * rows), fv = fract(v * rows);
          const off = hash(row, 5, sd) * 0.5;
          const pu = (u + off) * 2, pi = Math.floor(pu), fu = fract(pu);
          c = woodSample(fract(pu), fv * 0.18 + hash(pi, row, sd) * 3, d, sd + pi * 7 + row * 3, 1);
          const tone = (hash(pi, row + 40, sd) - 0.5) * 0.18;
          c = c.map(q => q * (1 + tone));
          if (fv < 0.025 || fu < 0.004 || fu > 0.996) c = c.map(q => q * 0.55);
        } else if (d.type === 'concrete') {
          const n = fbm(u, v, 5, 5, 5, sd), n2 = fbm(u, v, 40, 40, 2, sd + 5);
          const k = 0.84 + 0.22 * n + 0.08 * (n2 - 0.5);
          c = d.base.map(q => q * k);
          if (hash(x, y, sd + 9) < 0.003) c = c.map(q => q * 0.6);
        } else if (d.type === 'brick') {
          const rows = 13, row = Math.floor(v * rows), fv = fract(v * rows);
          const bu = u * 4 + (row % 2) * 0.5, bi = Math.floor(bu), fu = fract(bu);
          const mortar = fv < 0.16 || fu < 0.045;
          const n = fbm(u, v, 24, 24, 3, sd);
          if (mortar) c = [198, 194, 186].map(q => q * (0.9 + 0.15 * n));
          else {
            const h1 = hash(((bi % 4) + 4) % 4, row, sd), h2 = hash(((bi % 4) + 4) % 4, row + 50, sd);
            const t = 0.25 + 0.55 * h1;
            c = d.base.map((q, i) => mix(q, d.dark[i], t) * (0.88 + 0.22 * n) * (0.95 + 0.1 * h2));
          }
        } else if (d.type === 'marble') {
          const n = fbm(u, v, 3, 3, 5, sd);
          const t = Math.abs(Math.sin(Math.PI * (u * 2 + v + n * 3.2)));
          const vein = Math.pow(1 - t, 14) * 0.8 + Math.pow(1 - t, 3) * 0.12;
          const cloud = fbm(u, v, 6, 6, 3, sd + 3) * 0.06;
          c = d.base.map((q, i) => mix(q, d.dark[i], Math.min(1, vein)) * (0.97 + cloud));
        } else {
          const n = fbm(u, v, 8, 8, 3, sd);
          c = d.base.map(q => q * (0.97 + 0.05 * n));
        }
        const o = (y * N + x) * 4;
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const rep = 1 / (d.size || 1);
    t.repeat.set(rep, rep);
    texCache[key] = t;
    return t;
  }

  const matCache = {};
  function material(key) {
    if (matCache[key]) return matCache[key];
    let m;
    if (key === 'sklo') {
      m = new THREE.MeshPhysicalMaterial({ color: 0xd6eef0, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 });
    } else {
      const d = MAT[key];
      if (d.type === 'metal') m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(d.base[0] / 255, d.base[1] / 255, d.base[2] / 255, THREE.SRGBColorSpace), metalness: d.metal, roughness: d.rough, side: THREE.DoubleSide });
      else m = new THREE.MeshStandardMaterial({ map: texture(key), roughness: d.rough, metalness: 0, side: THREE.DoubleSide });
    }
    matCache[key] = m;
    return m;
  }
  function swatch(key) {
    const d = MAT[key];
    if (!d) return '#ccc';
    return 'rgb(' + d.base.map(Math.round).join(',') + ')';
  }

  // ---------------------------------------------------------------- pomocná geometria
  const P3 = (x, y, h) => new THREE.Vector3(x * MM, h * MM, -y * MM);

  // geometria z trojuholníkov: pole [p0,p1,p2] + uv
  function TriBuilder() {
    const pos = [], uv = [];
    return {
      tri(a, b, c, ua, ub, uc) { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]); },
      quad(a, b, c, d, ua, ub, uc, ud) { this.tri(a, b, c, ua, ub, uc); this.tri(a, c, d, ua, uc, ud); },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        return g;
      },
      empty() { return pos.length === 0; }
    };
  }

  // hranol z pôdorysného obdĺžnika P->Q, posunutého o hĺbku f (vektor v mm), výška z0..z1 (mm)
  function prismAlong(P, Q, f, z0, z1) {
    const tb = TriBuilder();
    const L = Math.hypot(Q.x - P.x, Q.y - P.y) * MM, D = Math.hypot(f.x, f.y) * MM, H0 = z0 * MM, H1 = z1 * MM;
    const p = [P, Q, { x: Q.x + f.x, y: Q.y + f.y }, { x: P.x + f.x, y: P.y + f.y }];
    const lo = p.map(q => P3(q.x, q.y, z0)), hi = p.map(q => P3(q.x, q.y, z1));
    const us = [0, L, L, 0];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const ua = i % 2 === 0 ? us[i] : 0, ub = i % 2 === 0 ? us[j] : D;
      tb.quad(lo[i], lo[j], hi[j], hi[i], [ua, H0], [ub, H0], [ub, H1], [ua, H1]);
    }
    tb.quad(hi[0], hi[1], hi[2], hi[3], [0, 0], [L, 0], [L, D], [0, D]);
    tb.quad(lo[0], lo[3], lo[2], lo[1], [0, 0], [0, D], [L, D], [L, 0]);
    return tb.build();
  }

  // vzorky dráhy {x,y,s} -> posunuté body (miter) o vzdialenosť d na stranu sg
  function offsetSamples(S, d, sg) {
    const n = S.length, out = [];
    const nrm = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: -dy / l * sg, y: dx / l * sg }; };
    for (let i = 0; i < n; i++) {
      let m;
      if (n === 1) m = { x: 0, y: 0 };
      else if (i === 0) m = nrm(S[0], S[1]);
      else if (i === n - 1) m = nrm(S[n - 2], S[n - 1]);
      else {
        const a = nrm(S[i - 1], S[i]), b = nrm(S[i], S[i + 1]);
        const mx = a.x + b.x, my = a.y + b.y, ml = Math.hypot(mx, my) || 1;
        const cs = (mx / ml) * a.x + (my / ml) * a.y;
        const k = 1 / Math.max(0.35, cs);
        m = { x: mx / ml * k, y: my / ml * k };
      }
      out.push({ x: S[i].x + m.x * d, y: S[i].y + m.y * d, s: S[i].s });
    }
    return out;
  }
  function atS(S, s) {
    const n = S.length;
    if (n === 1) return { x: S[0].x, y: S[0].y };
    let k = 0;
    while (k < n - 2 && S[k + 1].s < s) k++;
    const a = S[k], b = S[k + 1], ds = b.s - a.s;
    const t = ds > 1e-9 ? (s - a.s) / ds : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  // strana dovnútra schodov pre dráhu S (+1 = vľavo od smeru)
  function insideSign(S, ref) {
    if (S.length < 2) return 1;
    const dx = S[1].x - S[0].x, dy = S[1].y - S[0].y;
    return (-dy * (ref.x - S[0].x) + dx * (ref.y - S[0].y)) >= 0 ? 1 : -1;
  }

  // zvislý interval mnohouholníka (u = s, v = z) v mieste s
  function interval(poly, s) {
    const zs = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a.x <= s && s < b.x) || (b.x <= s && s < a.x)) zs.push(a.y + (b.y - a.y) * (s - a.x) / (b.x - a.x));
    }
    if (zs.length < 2) return null;
    return [Math.min.apply(null, zs), Math.max.apply(null, zs)];
  }

  // schodnica: rozvinutý tvar (s, z) ohnutý pozdĺž dráhy, hrúbka t dovnútra schodov
  function stringerGeometry(poly, S, sg, t) {
    // vonkajšia plocha 2 mm za hranou stupňov (bez z-fightingu s čelami stupňov)
    const O = offsetSamples(S, t, sg);
    S = offsetSamples(S, -2, sg);
    let s0 = Infinity, s1 = -Infinity;
    for (const p of poly) { s0 = Math.min(s0, p.x); s1 = Math.max(s1, p.x); }
    const grid = [s0, s1];
    for (const q of S) if (q.s > s0 && q.s < s1) grid.push(q.s);
    for (const p of poly) grid.push(p.x);
    for (let s = s0; s < s1; s += 150) grid.push(s);
    grid.sort((a, b) => a - b);
    const cols = [];
    for (let i = 0; i < grid.length; i++) {
      if (cols.length && grid[i] - cols[cols.length - 1].s < 0.5) continue;
      const s = Math.min(grid[i], s1 - 1e-4);
      const iv = interval(poly, Math.max(s, s0 + 1e-4));
      if (!iv) continue;
      const b = atS(S, s), o = atS(O, s);
      cols.push({ s, iv, b, o });
    }
    const tb = TriBuilder();
    const T = t * MM;
    const V = (p, z) => P3(p.x, p.y, z);
    for (let k = 0; k < cols.length - 1; k++) {
      const A = cols[k], B = cols[k + 1];
      const ua = A.s * MM, ub = B.s * MM;
      const al = A.iv[0] * MM, ah = A.iv[1] * MM, bl = B.iv[0] * MM, bh = B.iv[1] * MM;
      tb.quad(V(A.b, A.iv[0]), V(B.b, B.iv[0]), V(B.b, B.iv[1]), V(A.b, A.iv[1]), [ua, al], [ub, bl], [ub, bh], [ua, ah]);
      tb.quad(V(A.o, A.iv[0]), V(A.o, A.iv[1]), V(B.o, B.iv[1]), V(B.o, B.iv[0]), [ua, al], [ua, ah], [ub, bh], [ub, bl]);
      tb.quad(V(A.b, A.iv[1]), V(B.b, B.iv[1]), V(B.o, B.iv[1]), V(A.o, A.iv[1]), [ua, 0], [ub, 0], [ub, T], [ua, T]);
      tb.quad(V(A.b, A.iv[0]), V(A.o, A.iv[0]), V(B.o, B.iv[0]), V(B.b, B.iv[0]), [ua, 0], [ua, T], [ub, T], [ub, 0]);
    }
    for (const E of [cols[0], cols[cols.length - 1]]) {
      if (!E) continue;
      tb.quad(V(E.b, E.iv[0]), V(E.b, E.iv[1]), V(E.o, E.iv[1]), V(E.o, E.iv[0]), [0, E.iv[0] * MM], [0, E.iv[1] * MM], [T, E.iv[1] * MM], [T, E.iv[0] * MM]);
    }
    return tb.empty() ? null : tb.build();
  }

  function tube(points, r, segs) {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    return new THREE.TubeGeometry(curve, Math.max(8, segs || points.length * 10), r, 10, false);
  }
  function rod(a, b, r, sides) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    if (L < 1e-6) return null;
    const g = new THREE.CylinderGeometry(r, r, L, sides || 10);
    g.translate(0, L / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    return g;
  }
  function boxAt(x, y, z0, z1, w) {
    const g = new THREE.BoxGeometry(w * MM, (z1 - z0) * MM, w * MM);
    g.translate(x * MM, (z0 + z1) / 2 * MM, -y * MM);
    return g;
  }
  function merged(list) {
    const gs = list.filter(Boolean);
    if (!gs.length) return null;
    // zjednotiť atribúty (CylinderGeometry/TubeGeometry sú indexované)
    const flat = gs.map(g => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; });
    for (const g of flat) for (const k of Object.keys(g.attributes)) if (['position', 'normal', 'uv'].indexOf(k) < 0) g.deleteAttribute(k);
    return THREE.mergeGeometries(flat, false);
  }
  function mesh(geo, mat, shadow) {
    if (!geo) return null;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow !== false;
    m.receiveShadow = true;
    return m;
  }

  // ---------------------------------------------------------------- model schodov
  function buildStairs(res, S) {
    const inp = res.input, G = res.geom;
    const grp = new THREE.Group();
    grp.name = 'schody';
    const h = res.h, N = res.N;

    // stupne
    const treadMat = material(S.stupne);
    const tg = [];
    for (const t of res.treads) {
      const pts = C.sampleVerts(t.polyOver, true, 4 * Math.PI / 180);
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x * MM, p.y * MM)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: inp.hrubka * MM, bevelEnabled: false, curveSegments: 1 });
      // UV: vlákna pozdĺž nástupnej hrany
      const a = Math.atan2(t.front[1].y - t.front[0].y, t.front[1].x - t.front[0].x);
      const ca = Math.cos(-a), sa = Math.sin(-a);
      const P = g.attributes.position, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        const u = x * ca - y * sa, v = x * sa + y * ca;
        const nz = Math.abs(z) < 1e-9 || Math.abs(z - inp.hrubka * MM) < 1e-9;
        U.setXY(i, u, nz ? v : v + z);
      }
      g.rotateX(-Math.PI / 2);
      g.translate(0, (t.vyska - inp.hrubka) * MM, 0);
      tg.push(g);
    }
    grp.add(mesh(merged(tg), treadMat));

    // podstupnice
    if (S.podstupnice !== 'ziadne') {
      const rg = [];
      const tR = inp.hrubkaPodst;
      res.edges.forEach((e, i) => {
        const z0 = i * h, z1 = (i + 1) * h - inp.hrubka;
        if (z1 - z0 < 5) return;
        const dx = e.Q.x - e.P.x, dy = e.Q.y - e.P.y, l = Math.hypot(dx, dy) || 1;
        let f = { x: -dy / l * tR, y: dx / l * tR };
        const nx = i < res.edges.length - 1 ? res.edges[i + 1].W : { x: e.W.x + G.walkEndDir.x, y: e.W.y + G.walkEndDir.y };
        if (f.x * (nx.x - e.W.x) + f.y * (nx.y - e.W.y) < 0) f = { x: -f.x, y: -f.y };
        rg.push(prismAlong(e.P, e.Q, f, z0, i === res.edges.length - 1 ? inp.H - 15 : z1));
      });
      grp.add(mesh(merged(rg), material(S.podstupnice)));
    }

    // schodnice
    const sMat = material(S.schodnice);
    const t = inp.hrubkaSchodnice;
    const sides = [];
    if (inp.typ !== 'tocite') sides.push({ S: G.innerS, shapes: res.unfold.vnutorna.tvary });
    sides.push({ S: G.wallS, shapes: res.unfold.vonkajsia.tvary });
    const sgs = [];
    for (const sd of sides) {
      const sg = insideSign(sd.S, G.walkStart);
      for (const sh of sd.shapes) sgs.push(stringerGeometry(sh.poly, sd.S, sg, t));
    }
    grp.add(mesh(merged(sgs), sMat));

    // stĺp točitých schodov
    if (inp.typ === 'tocite' && inp.Rs > 0) {
      const top = inp.H + 1000;
      const g = new THREE.CylinderGeometry(inp.Rs * MM, inp.Rs * MM, top * MM, 40);
      g.translate(0, top / 2 * MM, 0);
      grp.add(mesh(g, sMat));
    }

    // zábradlie
    if (S.zabradlie !== 'ziadne') grp.add(buildRailing(res, S));
    return grp;
  }

  function buildRailing(res, S) {
    const G = res.geom;
    const grp = new THREE.Group();
    const R = C.railing(res, S.zabradlie);
    if (!R) return grp;
    const inp = res.input;
    const path = R.spiral ? G.wallS : G.innerS;
    const sg = insideSign(path, G.walkStart);
    const inset = Math.max(25, inp.hrubkaSchodnice / 2);
    const O = offsetSamples(path, inset, sg);
    const pts = R.pts;
    const rail = dz => pts.map(q => { const p = atS(O, q.s); return P3(p.x, p.y, q.z + dz); });

    const metal = material(S.zabradlie === 'nerez' || S.zabradlie === 'sklo' ? 'nerez' : 'ocel');
    const wood = material(S.stupne.match(/mramor|beton|biela|antracit/) ? 'dub' : S.stupne);
    const handMat = S.zabradlie === 'drevo' ? wood : metal;
    const geo = [], posts = [], glass = [];
    const hr = S.zabradlie === 'drevo' ? 0.028 : 0.022;
    geo.push(tube(rail(0), hr, pts.length * 12));
    for (const q of R.posts) { const p = atS(O, q.s); posts.push(boxAt(p.x, p.y, q.z0, q.z1, q.w)); }
    for (const q of R.rods) { const p = atS(O, q.s); geo.push(rod(P3(p.x, p.y, q.z0), P3(p.x, p.y, q.z1), 0.007, 8)); }
    for (const q of R.glass) {
      const pa = atS(O, q.g0), pb = atS(O, q.g1);
      const tb = TriBuilder();
      tb.quad(P3(pa.x, pa.y, q.z0), P3(pb.x, pb.y, q.z0), P3(pb.x, pb.y, q.z1b), P3(pa.x, pa.y, q.z1a), [0, 0], [1, 0], [1, 1], [0, 1]);
      glass.push(tb.build());
    }
    for (let k = 1; k <= R.prieck; k++) geo.push(tube(rail(-k * 165), 0.007, pts.length * 12));
    if (S.zabradlie === 'drevo') {
      grp.add(mesh(merged(geo), handMat));
      grp.add(mesh(merged(posts), wood));
    } else grp.add(mesh(merged(geo.concat(posts)), handMat));
    if (glass.length) { const m = mesh(merged(glass), material('sklo'), false); m.renderOrder = 2; grp.add(m); }
    return grp;
  }

  // ---------------------------------------------------------------- priestor
  function roomBounds(res) {
    const inp = res.input, G = res.geom;
    if (inp.typ === 'tocite') {
      const R = inp.Rv;
      return { x0: -R - 1300, x1: R + 1300, y0: -R - 1300, y1: R + 1300, walls: [true, true, true, true] };
    }
    const pts = C.sampleVerts(G.outline, true, 5 * Math.PI / 180);
    const bb = C.bbox(pts);
    const on = (side) => G.wallS.some((q, i) => {
      if (i === 0) return false;
      const a = G.wallS[i - 1];
      if (side === 0) return Math.abs(a.y - bb.minY) < 1 && Math.abs(q.y - bb.minY) < 1;
      if (side === 1) return Math.abs(a.x - bb.maxX) < 1 && Math.abs(q.x - bb.maxX) < 1;
      if (side === 2) return Math.abs(a.y - bb.maxY) < 1 && Math.abs(q.y - bb.maxY) < 1;
      return Math.abs(a.x - bb.minX) < 1 && Math.abs(q.x - bb.minX) < 1;
    });
    const m = 1700, mStart = 2200;
    const b = { x0: bb.minX, x1: bb.maxX, y0: bb.minY, y1: bb.maxY };
    // strana nástupu dostane viac miesta
    const ws = G.walkStart, d = G.start;
    const startSide = (() => {
      const cx = (d[0].x + d[1].x) / 2, cy = (d[0].y + d[1].y) / 2;
      const dd = [Math.abs(cy - bb.minY), Math.abs(cx - bb.maxX), Math.abs(cy - bb.maxY), Math.abs(cx - bb.minX)];
      return dd.indexOf(Math.min.apply(null, dd));
    })();
    void ws;
    const mm = side => on(side) ? 0 : (side === startSide ? mStart : m);
    b.y0 -= mm(0); b.x1 += mm(1); b.y1 += mm(2); b.x0 -= mm(3);
    b.walls = [true, true, true, true];
    return b;
  }

  function buildRoom(res, S, B) {
    const inp = res.input, G = res.geom;
    const PR = PRIESTORY[S.priestor];
    const grp = new THREE.Group();
    grp.name = 'priestor';
    const WT = 200, upH = 2700;
    const studio = !PR.wall;
    if (studio) {
      const g = new THREE.CylinderGeometry(Math.max(B.x1 - B.x0, B.y1 - B.y0) * MM * 1.2, Math.max(B.x1 - B.x0, B.y1 - B.y0) * MM * 1.2, 0.04, 64);
      g.translate((B.x0 + B.x1) / 2 * MM, -0.02, -(B.y0 + B.y1) / 2 * MM);
      const m = mesh(g, material('studio'), false);
      grp.add(m);
      return grp;
    }
    const X0 = B.x0 - WT, X1 = B.x1 + WT, Y0 = B.y0 - WT, Y1 = B.y1 + WT;
    // podlaha
    const fl = new THREE.Shape([new THREE.Vector2(X0 * MM, Y0 * MM), new THREE.Vector2(X1 * MM, Y0 * MM), new THREE.Vector2(X1 * MM, Y1 * MM), new THREE.Vector2(X0 * MM, Y1 * MM)]);
    const fg = new THREE.ExtrudeGeometry(fl, { depth: 0.1, bevelEnabled: false });
    fg.rotateX(-Math.PI / 2); fg.translate(0, -0.1, 0);
    grp.add(mesh(fg, material(PR.floor), false));
    // strop / horné podlažie s otvorom
    if (S.poschodie) {
      const outer = new THREE.Shape([new THREE.Vector2(X0 * MM, Y0 * MM), new THREE.Vector2(X1 * MM, Y0 * MM), new THREE.Vector2(X1 * MM, Y1 * MM), new THREE.Vector2(X0 * MM, Y1 * MM)]);
      let hole;
      if (inp.typ === 'tocite') {
        hole = new THREE.Path();
        hole.absarc(0, 0, (inp.Rv + 60) * MM, 0, TAU, false);
      } else {
        const op = C.sampleVerts(G.outline, true, 6 * Math.PI / 180);
        hole = new THREE.Path(op.map(p => new THREE.Vector2(p.x * MM, p.y * MM)));
      }
      outer.holes.push(hole);
      const slabT = 250;
      const sg = new THREE.ExtrudeGeometry(outer, { depth: (slabT - 20) * MM, bevelEnabled: false, curveSegments: 48 });
      sg.rotateX(-Math.PI / 2); sg.translate(0, (inp.H - slabT) * MM, 0);
      const slabInfo = { top: inp.H * MM, x0: X0 * MM, x1: X1 * MM, z0: -Y1 * MM, z1: -Y0 * MM };
      const m1 = mesh(sg, material('strop'));
      m1.userData.slab = slabInfo;
      grp.add(m1);
      const tg = new THREE.ExtrudeGeometry(outer, { depth: 20 * MM, bevelEnabled: false, curveSegments: 48 });
      tg.rotateX(-Math.PI / 2); tg.translate(0, (inp.H - 20) * MM, 0);
      const m2 = mesh(tg, material(PR.floor));
      m2.userData.slab = slabInfo;
      grp.add(m2);
    }
    // steny (normála dovnútra kvôli skrývaniu pri pohľade zvonku)
    const top = (S.poschodie ? inp.H + upH : Math.max(inp.H + 300, 2600));
    const wallMat = material(PR.wall);
    const walls = [
      { a: { x: X0, y: Y0 }, b: { x: X1, y: Y0 }, f: { x: 0, y: WT }, n: [0, 1] },
      { a: { x: X1, y: Y0 }, b: { x: X1, y: Y1 }, f: { x: -WT, y: 0 }, n: [-1, 0] },
      { a: { x: X1, y: Y1 }, b: { x: X0, y: Y1 }, f: { x: 0, y: -WT }, n: [0, -1] },
      { a: { x: X0, y: Y1 }, b: { x: X0, y: Y0 }, f: { x: WT, y: 0 }, n: [1, 0] }
    ];
    for (const w of walls) {
      const m = mesh(prismAlong(w.a, w.b, w.f, -100, top), wallMat);
      // vnútorná rovina steny (v metroch, three: x, -y)
      const ix = (w.a.x + w.f.x) * MM, iy = (w.a.y + w.f.y) * MM;
      m.userData.wall = { px: ix, pz: -iy, nx: w.n[0], nz: -w.n[1] };
      grp.add(m);
    }
    return grp;
  }

  // ---------------------------------------------------------------- scéna a prehliadač
  function Viewer(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8478, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    const fill = new THREE.PointLight(0xfff3e0, 6, 0, 2);
    scene.add(fill);

    let model = null, room = null, info = null, running = false, walk = null, raf = 0, w = 1, hgt = 1;

    function disposeGroup(g) {
      if (!g) return;
      g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      scene.remove(g);
    }

    function update(res, viz) {
      const S = settings(viz);
      disposeGroup(model); disposeGroup(room);
      model = room = null;
      if (!res || res.errors.length || !res.treads || !res.treads.length) { info = null; render(); return false; }
      model = buildStairs(res, S);
      scene.add(model);
      const B = roomBounds(res);
      room = buildRoom(res, S, B);
      scene.add(room);
      const PR = PRIESTORY[S.priestor];
      scene.background = new THREE.Color(PR.bg);
      sun.color.set(PR.sun);
      // svetlo
      const cx = (B.x0 + B.x1) / 2 * MM, cz = -(B.y0 + B.y1) / 2 * MM;
      const span = Math.max(B.x1 - B.x0, B.y1 - B.y0) * MM;
      const H = res.input.H * MM;
      sun.position.set(cx - span * 0.35, H + 9, cz + span * 0.55);
      sun.target.position.set(cx, 0, cz);
      const sc = sun.shadow.camera;
      sc.left = sc.bottom = -span * 0.9; sc.right = sc.top = span * 0.9; sc.near = 0.5; sc.far = H + 30;
      sc.updateProjectionMatrix();
      fill.position.set(cx, H * 0.75, cz);
      fill.intensity = PR.wall ? 7 : 2;
      const box = new THREE.Box3().setFromObject(model);
      info = { res, S, B, box, center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) };
      return true;
    }

    function setView(name, instant) {
      if (!info) return;
      stopWalk();
      const { res, box, center, size } = info, G = res.geom;
      const fovV = camera.fov * Math.PI / 180;
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
      const R = size.length() * 0.5;
      const dist = R / Math.sin(Math.min(fovV, fovH) / 2) * 1.02;
      // smer od steny k schodom = otvorená strana
      let dx = -1, dy = -1;
      if (res.input.typ !== 'tocite') {
        const op = C.sampleVerts(G.outline, true, 0.2);
        const oc = op.reduce((a, p) => ({ x: a.x + p.x / op.length, y: a.y + p.y / op.length }), { x: 0, y: 0 });
        const wc = G.wallS.reduce((a, p) => ({ x: a.x + p.x / G.wallS.length, y: a.y + p.y / G.wallS.length }), { x: 0, y: 0 });
        dx = oc.x - wc.x; dy = oc.y - wc.y;
        // šikmo cez roh miestnosti na strane nástupu
        const l1 = Math.hypot(dx, dy) || 1;
        dx /= l1; dy /= l1;
        let px = -dy, py = dx;
        if (px * (G.walkStart.x - oc.x) + py * (G.walkStart.y - oc.y) < 0) { px = -px; py = -py; }
        dx = dx + px * 0.8; dy = dy + py * 0.8;
      }
      const l = Math.hypot(dx, dy) || 1;
      const dir3 = new THREE.Vector3(dx / l, 0, -dy / l);
      let pos, target = center.clone();
      if (name === 'zhora') {
        pos = center.clone().add(new THREE.Vector3(0, dist * 1.25, 0.001));
        target = center.clone(); target.y = 0;
      } else if (name === 'nastup') {
        const ws = G.walkStart;
        const e = res.edges, d = { x: e[1].W.x - e[0].W.x, y: e[1].W.y - e[0].W.y };
        const dl = Math.hypot(d.x, d.y) || 1;
        pos = P3(ws.x - d.x / dl * 2600, ws.y - d.y / dl * 2600, 1650);
        const mid = e[Math.min(e.length - 1, Math.round(e.length * 0.45))];
        target = P3(mid.W.x, mid.W.y, res.input.H * 0.45);
      } else if (name === 'poschodie') {
        const we = G.walkEnd, wd = G.walkEndDir;
        // stáť na poschodí, ale vnútri miestnosti
        const B = info.B, cl = (v, a, b) => Math.max(a, Math.min(b, v));
        pos = P3(cl(we.x + wd.x * 3000, B.x0 + 300, B.x1 - 300), cl(we.y + wd.y * 3000, B.y0 + 300, B.y1 - 300), res.input.H + 1750);
        const e = res.edges, mid = e[Math.round(e.length * 0.4)];
        target = P3(mid.W.x, mid.W.y, res.input.H * 0.25);
      } else {
        const el = 32 * Math.PI / 180;
        pos = center.clone().add(dir3.multiplyScalar(dist * Math.cos(el))).add(new THREE.Vector3(0, dist * Math.sin(el), 0));
      }
      camera.position.copy(pos);
      controls.target.copy(target);
      camera.lookAt(target);
      controls.update();
      void box; void instant;
      render();
    }

    function hideWalls() {
      if (!room) return;
      const cp = camera.position;
      room.traverse(o => {
        const SL = o.userData && o.userData.slab;
        if (SL) {
          // strop skryť pri pohľade zhora zvonku (inak by zakryl schody)
          const outside = cp.x < SL.x0 || cp.x > SL.x1 || cp.z < SL.z0 || cp.z > SL.z1;
          o.visible = !((cp.y > SL.top && outside) || cp.y > SL.top + 2.5);
          return;
        }
        const W = o.userData && o.userData.wall;
        if (!W) return;
        // skryť steny medzi kamerou a priestorom (pohľad "domček")
        o.visible = (cp.x - W.px) * W.nx + (cp.z - W.pz) * W.nz >= -0.05;
      });
    }

    function render() {
      hideWalls();
      renderer.render(scene, camera);
    }

    function resize(width, height) {
      w = Math.max(1, width | 0); hgt = Math.max(1, height | 0);
      renderer.setSize(w, hgt, false);
      camera.aspect = w / hgt;
      camera.updateProjectionMatrix();
      render();
    }

    function loop(t) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (walk) stepWalk(t);
      else controls.update();
      render();
    }
    function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
    function stop() { running = false; cancelAnimationFrame(raf); stopWalk(); }

    // prechádzka po výstupnej čiare
    function startWalk(onEnd) {
      if (!info) return;
      const res = info.res, G = res.geom;
      const pts = C.sampleVerts(G.walk, false, 3 * Math.PI / 180);
      const S = [{ x: pts[0].x, y: pts[0].y, s: 0 }];
      for (let i = 1; i < pts.length; i++) S.push({ x: pts[i].x, y: pts[i].y, s: S[i - 1].s + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) });
      const L = S[S.length - 1].s;
      const e = res.edges;
      const zs = [{ s: -1e9, z: 0 }, { s: 0, z: 0 }];
      for (let j = 1; j < res.N; j++) zs.push({ s: (e[j - 1].s + e[j].s) / 2, z: j * res.h });
      zs.push({ s: L, z: res.input.H }, { s: 1e9, z: res.input.H });
      const zAt = s => { for (let i = 1; i < zs.length; i++) if (s <= zs[i].s) return zs[i - 1].z + (zs[i].z - zs[i - 1].z) * (s - zs[i - 1].s) / (zs[i].s - zs[i - 1].s); return res.input.H; };
      const d0 = { x: S[1].x - S[0].x, y: S[1].y - S[0].y }, l0 = Math.hypot(d0.x, d0.y) || 1;
      const d1 = G.walkEndDir;
      const at = s => {
        if (s < 0) return { x: S[0].x + d0.x / l0 * s, y: S[0].y + d0.y / l0 * s };
        if (s > L) return { x: S[S.length - 1].x + d1.x * (s - L), y: S[S.length - 1].y + d1.y * (s - L) };
        return atS(S, s);
      };
      walk = { t0: null, s0: -2200, s1: L + 1600, speed: 650, at, zAt, onEnd };
      controls.enabled = false;
      start();
    }
    function stepWalk(t) {
      if (walk.t0 == null) walk.t0 = t;
      const s = walk.s0 + (t - walk.t0) / 1000 * walk.speed;
      if (s > walk.s1) { const cb = walk.onEnd; stopWalk(); if (cb) cb(); return; }
      const p = walk.at(s), q = walk.at(s + 1300);
      camera.position.copy(P3(p.x, p.y, walk.zAt(s) + 1650));
      camera.lookAt(P3(q.x, q.y, walk.zAt(s + 1300) + 1350));
    }
    function stopWalk() {
      if (!walk) return;
      walk = null;
      controls.enabled = true;
      // pokračovať z miesta, kde prechádzka skončila
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      controls.target.copy(camera.position).add(dir.multiplyScalar(2));
      controls.update();
    }

    function snapshot(view, width, height, type) {
      const ow = w, oh = hgt;
      const pos = camera.position.clone(), tgt = controls.target.clone();
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      if (view) setView(view, true); else render();
      const url = renderer.domElement.toDataURL(type || 'image/jpeg', 0.9);
      renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      camera.position.copy(pos); controls.target.copy(tgt); controls.update();
      resize(ow, oh);
      return url;
    }

    function dispose() { stop(); disposeGroup(model); disposeGroup(room); controls.dispose(); renderer.dispose(); renderer.forceContextLoss(); }

    return { canvas, update, setView, resize, start, stop, startWalk, stopWalk, snapshot, dispose, render, get walking() { return !!walk; } };
  }

  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  // obrázky do PDF bez zobrazeného prehliadača
  function renders(res, viz, views, width, height) {
    if (!THREE || !webglOK()) return [];
    const cv = document.createElement('canvas');
    cv.width = width; cv.height = height;
    const v = Viewer(cv);
    const out = [];
    try {
      v.resize(width, height);
      if (!v.update(res, viz)) return [];
      for (const name of views) out.push({ nazov: VIEWS[name] || name, url: v.snapshot(name, width, height) });
    } finally { v.dispose(); }
    return out;
  }

  root.SchodyViz = { MAT, STUPNE, PODSTUPNICE, SCHODNICE, ZABRADLIE, PRIESTORY, VIEWS, DEFAULT, settings, Viewer, renders, webglOK, swatch, available: !!THREE };
})(typeof self !== 'undefined' ? self : this);
