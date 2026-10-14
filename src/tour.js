/* Schodiskár – interaktívny návod (prehliadka rozhrania) */
(function () {
  'use strict';
  const KEY = 'schodiskar.navod.v1';
  const $ = s => document.querySelector(s);
  const tabBtn = t => $('.tabs button[data-tab="' + t + '"]');
  const openTab = t => { const b = tabBtn(t); if (b && !b.classList.contains('on')) b.click(); };

  // krok: sel (selektor alebo zoznam – zjednotený obdĺžnik), title, text, before(), wait() = interaktívny krok
  const STEPS = [
    { title: 'Vitajte v Schodiskári', text: 'Krátka prehliadka vám za minútu ukáže, ako navrhnúť schody, upraviť jednotlivé stupne a vytlačiť výkresy. Kedykoľvek ju zavriete klávesom Esc.', next: 'Začať' },
    { sel: '#types', title: 'Typ schodov', text: 'Vyberte tvar: rovné, zalomené do L alebo U s klinovými stupňami, s podestou alebo točité. Pri zalomených zvoľte aj smer zákruty.', place: 'right' },
    { sel: '#grpDims', title: 'Rozmery', text: 'Zadajte rozmery v mm. Hodnotu meníte aj šípkami ▲▼ pri poli alebo klávesmi ↑ ↓ (so Shiftom 10× viac). Výška H je od čistej po čistú podlahu.', place: 'right' },
    { sel: '#summary', title: 'Súhrn a stav', text: 'Tu vidíte výšku a šírku stupňa, krokový modul a stav návrhu: OK, POZOR (nesplnený limit) alebo CHYBA. Podrobnosti sú v záložke Kontroly.', place: 'bottom' },
    {
      sel: '#cv', title: 'Vyskúšajte: kliknite na stupeň', text: 'V pôdoryse kliknite na ľubovoľný stupeň. Otvorí sa panel na jeho úpravu.',
      before: () => { openTab('plan'); }, wait: () => !!$('.edp'), place: 'left'
    },
    { sel: '.edp', title: 'Úprava stupňa', text: 'Posuňte nástupnú alebo zadnú hranu po výstupnej čiare, prípadne len pri vnútornej hrane (pootočenie klinu). Na výkrese môžete ťahať aj oranžový a modrý bod. Šípkami ‹ › prejdete na susedný stupeň.', place: 'right', before: () => { openTab('plan'); } },
    { sel: ['#btnUndo', '#btnRedo'], title: 'Späť a znova', text: 'Každú zmenu vrátite tlačidlom ↶ alebo klávesmi Ctrl+Z, zopakujete ↷ alebo Ctrl+Y.', place: 'bottom' },
    { sel: '.tabs', title: 'Pohľady', text: '3D vizualizácia s materiálmi a prechádzkou, rozvinutie schodníc na rysovanie, tvary dielcov, rozpis materiálu a kontroly podľa limitov.', place: 'bottom' },
    {
      sel: '.tabs button[data-tab="bom"]', title: 'Vyskúšajte: otvorte rozpis', text: 'Kliknite na záložku Rozpis materiálu.',
      wait: () => { const b = tabBtn('bom'); return !!(b && b.classList.contains('on')); }, place: 'bottom'
    },
    {
      sel: ['#bomExtra', '#selZabr'], title: 'Zábradlie a dosky', text: 'Na konci rozpisu vyberiete druh zábradlia a uvidíte, ako sa prírezy rozložia na dosky. Rozmer dosky a šírku rezu nastavíte v ľavom paneli v časti Zábradlie a dosky.',
      before: () => { openTab('bom'); const e = $('#bomExtra'); if (e) e.scrollIntoView({ block: 'start' }); }, place: 'top'
    },
    { sel: ['#btnPdf', '#btnDxf', '#btnCsv'], title: 'Výstupy', text: 'PDF s výkresmi na A3, DXF pre CAD a CNC, CSV rozpis pre Excel. Projekt si uložíte tlačidlom Uložiť a neskôr ho otvoríte tlačidlom Otvoriť.', place: 'bottom' },
    { sel: '#btnHelp', title: 'Hotovo', text: 'Návod spustíte znova týmto tlačidlom. Príjemné navrhovanie!', place: 'bottom', next: 'Dokončiť' }
  ];

  let i = -1, root = null, hole = null, pop = null, raf = 0, waitT = 0;

  function rectOf(sel) {
    const list = (Array.isArray(sel) ? sel : [sel]).map(s => $(s)).filter(e => e && e.getClientRects().length);
    if (!list.length) return null;
    const r = list.map(e => e.getBoundingClientRect());
    const x0 = Math.min.apply(null, r.map(q => q.left)), y0 = Math.min.apply(null, r.map(q => q.top));
    const x1 = Math.max.apply(null, r.map(q => q.right)), y1 = Math.max.apply(null, r.map(q => q.bottom));
    // obmedziť na viditeľnú časť okna
    const vx0 = Math.max(0, x0), vy0 = Math.max(0, y0), vx1 = Math.min(innerWidth, x1), vy1 = Math.min(innerHeight, y1);
    if (vx1 - vx0 < 4 || vy1 - vy0 < 4) return null;
    return { left: vx0, top: vy0, width: vx1 - vx0, height: vy1 - vy0 };
  }

  function build() {
    root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML = '<div class="tour-hole"></div><div class="tour-pop" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(root);
    hole = root.querySelector('.tour-hole');
    pop = root.querySelector('.tour-pop');
    pop.addEventListener('click', e => {
      const b = e.target.closest('button[data-t]');
      if (!b) return;
      const a = b.dataset.t;
      if (a === 'next') go(i + 1);
      else if (a === 'prev') go(i - 1, true);
      else end();
    });
  }

  function go(n, back) {
    clearInterval(waitT);
    if (n >= STEPS.length) return end(true);
    if (n < 0) n = 0;
    i = n;
    const st = STEPS[i];
    if (st.before) st.before();
    // interaktívny krok, ktorý je už splnený: pri dopredu ísť ďalej (napr. panel je otvorený)
    const first = st.sel && (Array.isArray(st.sel) ? st.sel[0] : st.sel);
    const el = first && $(first);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    const total = STEPS.length;
    pop.innerHTML = '<div class="tour-n">' + (i + 1) + ' / ' + total + '</div><h4>' + st.title + '</h4><p>' + st.text + '</p>' +
      (st.wait ? '<p class="tour-wait">Čakám na váš klik…</p>' : '') +
      '<footer><button data-t="end" class="tour-skip">' + (i === total - 1 ? 'Zavrieť' : 'Ukončiť návod') + '</button><span></span>' +
      (i > 0 ? '<button data-t="prev">Späť</button>' : '') +
      '<button data-t="next" class="tour-next">' + (st.wait ? 'Preskočiť' : (st.next || 'Ďalej')) + '</button></footer>';
    root.classList.toggle('interactive', !!st.wait);
    if (st.wait) {
      if (st.wait() && !back) return go(i + 1);
      waitT = setInterval(() => { if (STEPS[i] === st && st.wait()) { clearInterval(waitT); setTimeout(() => go(i + 1), 250); } }, 150);
    }
    const nb = pop.querySelector('.tour-next');
    if (nb && !st.wait) nb.focus({ preventScroll: true });
  }

  // poloha prehliadky sleduje cieľ (výkres sa prekresľuje, okno sa posúva)
  function track() {
    raf = requestAnimationFrame(track);
    if (i < 0) return;
    const st = STEPS[i];
    const r = st.sel ? rectOf(st.sel) : null;
    const pad = 6;
    if (r) {
      hole.style.display = '';
      hole.style.left = (r.left - pad) + 'px'; hole.style.top = (r.top - pad) + 'px';
      hole.style.width = (r.width + 2 * pad) + 'px'; hole.style.height = (r.height + 2 * pad) + 'px';
    } else {
      hole.style.display = 'none';
    }
    root.classList.toggle('dim', !r);
    const pw = pop.offsetWidth, ph = pop.offsetHeight, m = 12, W = innerWidth, H = innerHeight;
    let x, y;
    if (!r) { x = (W - pw) / 2; y = (H - ph) / 2; }
    else {
      const fits = {
        bottom: r.top + r.height + pad + m + ph < H,
        top: r.top - pad - m - ph > 0,
        right: r.left + r.width + pad + m + pw < W,
        left: r.left - pad - m - pw > 0
      };
      const order = [st.place || 'bottom', 'bottom', 'right', 'top', 'left'];
      const side = order.find(s => fits[s]);
      if (side === 'bottom') { x = r.left + r.width / 2 - pw / 2; y = r.top + r.height + pad + m; }
      else if (side === 'top') { x = r.left + r.width / 2 - pw / 2; y = r.top - pad - m - ph; }
      else if (side === 'right') { x = r.left + r.width + pad + m; y = r.top + r.height / 2 - ph / 2; }
      else if (side === 'left') { x = r.left - pad - m - pw; y = r.top + r.height / 2 - ph / 2; }
      else { x = W - pw - m; y = H - ph - m; } // nič sa nezmestí: do rohu
    }
    pop.style.left = Math.round(Math.max(m, Math.min(W - pw - m, x))) + 'px';
    pop.style.top = Math.round(Math.max(m, Math.min(H - ph - m, y))) + 'px';
  }

  function onKey(e) {
    if (i < 0) return;
    if (e.key === 'Escape') { e.stopImmediatePropagation(); end(); }
    else if ((e.key === 'ArrowRight' || e.key === 'Enter') && !STEPS[i].wait && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); go(i - 1, true); }
  }

  function start() {
    if (root) end();
    build();
    document.addEventListener('keydown', onKey, true);
    raf = requestAnimationFrame(track);
    go(0);
  }
  function end() {
    clearInterval(waitT);
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey, true);
    if (root) root.remove();
    root = null; i = -1;
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* bez úložiska */ }
  }

  window.SchodyTour = { start, end };
  const btn = $('#btnHelp');
  if (btn) btn.addEventListener('click', start);
  // prvá návšteva (nie pri adrese s parametrami, napr. pre snímky obrazovky)
  let seen = true;
  try { seen = !!localStorage.getItem(KEY); } catch (e) { /* bez úložiska */ }
  if (!seen && !location.search) setTimeout(start, 700);
})();
