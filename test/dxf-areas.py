import sys, json, ezdxf
from ezdxf import path
from ezdxf.math import area
doc = ezdxf.readfile(sys.argv[1]); msp = doc.modelspace()
a = [round(area(list(path.make_path(e).flattening(0.01)))) for e in msp.query('POLYLINE[layer=="DIELCE"]')]
core = json.load(open(sys.argv[2]))
print('DXF :', a); print('core:', core)
print('max rozdiel mm2:', max(abs(x - y) for x, y in zip(a, core)))
