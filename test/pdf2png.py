import sys, pymupdf, os
for f in sys.argv[1:]:
    d = pymupdf.open(f)
    for i, pg in enumerate(d):
        pg.get_pixmap(dpi=int(os.environ.get('DPI', '90'))).save(os.path.splitext(f)[0] + '-p%d.png' % (i + 1))
    print(f, len(d), 'strán')
