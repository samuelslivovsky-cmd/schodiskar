# Overenie DXF: načítanie, audit, vrstvy, uzavreté tvary DIELCE, kresba do PNG
import sys, ezdxf
from ezdxf.addons.drawing import matplotlib as dm
for f in sys.argv[1:]:
    doc = ezdxf.readfile(f)
    auditor = doc.audit()
    msp = doc.modelspace()
    layers = sorted(l.dxf.name for l in doc.layers)
    cnt = {}
    for e in msp: cnt[(e.dxf.layer, e.dxftype())] = cnt.get((e.dxf.layer, e.dxftype()), 0) + 1
    closed = [e for e in msp.query('POLYLINE[layer=="DIELCE"]') if e.is_closed]
    texts = [e.dxf.text for e in msp.query('TEXT')]
    sk = [t for t in texts if any(c in t for c in 'áäčďéíľňóôŕšťúýž')]
    print(f, 'verzia', doc.dxfversion, 'kódovanie', doc.encoding, 'chyby auditu', len(auditor.errors), 'opravy', len(auditor.fixes))
    print('  vrstvy:', layers)
    print('  DIELCE uzavreté:', len(closed), ' texty s diakritikou:', sk[:4])
    print('  entity:', dict(sorted(cnt.items())))
    dm.qsave(msp, f.replace('.dxf', '-dxf.png'), bg='#FFFFFF', dpi=110)
