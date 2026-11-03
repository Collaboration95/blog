# One-off, not part of build.mjs. Patches Courier Prime (OFL) so that every glyph the posts use
# lives in one font and one cell: box drawing runs the full 1.4em line box so tree lines connect,
# arrows match the stem weight, and Nguyen Tran's two Vietnamese vowels stop falling back.
# Usage: python make-font.py CourierPrime-Regular.ttf CourierPrime-Bold.ttf   (needs fonttools, brotli)
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Subsetter, Options
from math import hypot

ADV, TOP, BOT, MID, AXIS = 1228, 1890, -990, 462, 582   # cell width, line box at 1.4em, box mid, hyphen axis

def bar(pen, x0, y0, x1, y1, t):
    dx, dy = x1 - x0, y1 - y0
    n = hypot(dx, dy); nx, ny = -dy / n * t / 2, dx / n * t / 2
    pts = [(x0 + nx, y0 + ny), (x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny)]
    pts = [(round(a), round(b)) for a, b in pts]
    pen.moveTo(pts[0]); [pen.lineTo(p) for p in pts[1:]]; pen.closePath()

def poly(pen, pts):
    pen.moveTo(pts[0]); [pen.lineTo(p) for p in pts[1:]]; pen.closePath()

def build(src, out, s, h, a):
    f = TTFont(src); gs = f.getGlyphSet(); order = f.getGlyphOrder(); cm = f['cmap']
    x = ADV // 2
    def add(cp, name, draw):
        pen = TTGlyphPen(gs); draw(pen); g = pen.glyph()
        order.append(name); f['glyf'][name] = g; f['hmtx'][name] = (ADV, 0)
        for t in cm.tables:
            if t.isUnicode(): t.cmap[cp] = name
    add(0x2500, 'boxlight', lambda p: bar(p, -6, MID, ADV + 6, MID, s))
    add(0x2501, 'boxheavy', lambda p: bar(p, -6, MID, ADV + 6, MID, h))
    add(0x251C, 'boxtee', lambda p: (bar(p, x, BOT, x, TOP, s), bar(p, x, MID, ADV + 6, MID, s)))
    add(0x2514, 'boxell', lambda p: (bar(p, x, MID - s // 2, x, TOP, s), bar(p, x, MID, ADV + 6, MID, s)))
    add(0x2192, 'arrowr', lambda p: (bar(p, 120, AXIS, 1090, AXIS, a), bar(p, 1100, AXIS, 760, AXIS + 320, a), bar(p, 1100, AXIS, 760, AXIS - 320, a)))
    add(0x2190, 'arrowl', lambda p: (bar(p, 138, AXIS, 1108, AXIS, a), bar(p, 128, AXIS, 468, AXIS + 320, a), bar(p, 128, AXIS, 468, AXIS - 320, a)))
    add(0x2193, 'arrowd', lambda p: (bar(p, x, 1220, x, 0, a), bar(p, x, -20, x - 320, 320, a), bar(p, x, -20, x + 320, 320, a)))
    add(0x25B8, 'trir', lambda p: poly(p, [(300, 262), (300, 902), (950, 582)]))
    def stacked(cp, name, base, mark, sx, sy, dx, dy):
        def draw(p):
            p.addComponent(base, (1, 0, 0, 1, 0, 0))
            p.addComponent(mark, (sx, 0, 0, sy, dx, dy))
        add(cp, name, draw)
    stacked(0x1EA7, 'acircgrave', 'acircumflex', 'grave', .72, .72, 520, 680)
    stacked(0x1EC5, 'ecirctilde', 'ecircumflex', 'tilde', .86, .86, 80, 500)
    f.setGlyphOrder(order)
    f['maxp'].numGlyphs = len(order)
    o = Options(); o.hinting = False; o.layout_features = []; o.notdef_outline = True; o.name_IDs = ['*']; o.flavor = 'woff2'
    sub = Subsetter(o); sub.populate(unicodes=[u for t in cm.tables if t.isUnicode() for u in t.cmap]); sub.subset(f)
    for rec in f['name'].names:
        if rec.nameID in (1, 3, 4, 6, 16):
            rec.string = str(rec).replace('Courier Prime', 'Courier Prime Cell').replace('CourierPrime', 'CourierPrimeCell')
    f.flavor = 'woff2'; f.save(out)

build(sys.argv[1], 'courier-prime-cell-400.woff2', 130, 270, 130)
build(sys.argv[2], 'courier-prime-cell-700.woff2', 190, 340, 200)
