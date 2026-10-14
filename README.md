# Schodiskár

Návrh schodov s klinovými stupňami a ich vyrovnaním. Celá aplikácia je jeden súbor
`index.html` – stačí ho otvoriť v prehliadači, funguje offline (jsPDF aj písmo DejaVu Sans sú vložené).

Typy: rovné, L a U s klinovými stupňami, L a U s podestou, točité vretenové.
Výstupy: pôdorys, 3D vizualizácia, rozvinutie schodníc, dielce, rozpis materiálu, kontroly;
export PDF (A3, vrátane listu s 3D pohľadmi), DXF R12 (mm, vrstvy), CSV (Excel), projekt JSON.

3D vizualizácia (three.js, vložené offline): priestory (moderný interiér, škandinávsky, loft,
drevenica, štúdio), materiály stupňov, podstupníc a schodníc (drevá, mramor, betón, lak, oceľ),
zábradlia (oceľové tyčky, nerezové priečky, sklo, drevo), pohľady a prechádzka po výstupnej čiare.
Textúry sa generujú procedurálne, bez obrázkových súborov.

Nastavenie možno zadať aj v adrese, napr. `index.html?typ=U&smer=vpravo&priestor=loft&stupne=orech&pohlad=nastup#3d`.

## Štruktúra

- `src/core.js` – výpočtové jadro (geometria, vyrovnanie klinov, kontroly), bez závislostí
- `src/draw.js` – výkresové primitíva (pôdorys, rozvinutie, dielce) a SVG
- `src/export.js` – DXF, CSV, PDF, JSON
- `src/viz3d.js` – 3D model, materiály, priestory, prehliadač
- `src/three-entry.js` – vybrané časti three.js, zbalené cez esbuild do `vendor/three.min.js`
- `src/app.js`, `src/style.css`, `src/template.html` – rozhranie
- `build.js` – zostaví `index.html`
- `fonts/` – podmnožina DejaVu Sans (latinka + symboly)

## Príkazy

```
npm install
npm run build      # zbalí three.js a vytvorí index.html
npm test           # testy jadra (všetky typy, oba smery, krajné prípady) + náhodné vstupy
npm run export-vzorky   # vzorové PDF/DXF/CSV do out/
```

Kontrola DXF a PDF (Python s `ezdxf`, `matplotlib`, `pymupdf`):

```
python test/check-dxf.py out/L.dxf
python test/pdf2png.py out/L.pdf
```
