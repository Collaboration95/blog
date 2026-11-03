// The grease pencil. Same code at build time (marks baked into the HTML) and in
// the browser (leaders measured against the real text). Seeded, so a mark is the
// same on every visit. A stroke is a filled outline with changing width, not an SVG
// stroke, because a chinagraph presses harder in the middle of a line.
(function (root) {
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  const noise = (r, n) => { const v = Array.from({ length: n + 2 }, () => r() * 2 - 1); return t => { const x = Math.min(t, .9999) * n, i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return v[i] * (1 - s) + v[i + 1] * s } }

  // Catmull-Rom through the points, resampled densely.
  const spline = (pts, steps = 10) => {
    const out = []
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
      for (let k = 0; k < steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t
        out.push([0, 1].map(a => .5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3)))
      }
    }
    out.push(pts[pts.length - 1])
    return out
  }

  const stroke = (pts, { w = 3.4, seed = 1, wob = 1, taper = true } = {}) => {
    const r = rng(seed), dense = spline(pts), n = dense.length
    const nx = noise(r, 7), ny = noise(r, 7), press = noise(r, 5)
    const line = dense.map((p, i) => { const t = i / (n - 1); return [p[0] + nx(t) * wob, p[1] + ny(t) * wob] })
    const L = [], R = []
    for (let i = 0; i < n; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)]
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, t = i / (n - 1)
      const end = taper ? Math.min(1, Math.pow(t / .05, .5), Math.pow((1 - t) / .14, .7)) : 1
      const hw = w * .5 * (.72 + .36 * press(t)) * Math.max(end, .18)
      L.push([line[i][0] - dy / d * hw, line[i][1] + dx / d * hw])
      R.push([line[i][0] + dy / d * hw, line[i][1] - dx / d * hw])
    }
    const f = p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)
    return 'M' + L.map(f).join('L') + 'L' + R.reverse().map(f).join('L') + 'Z'
  }

  // More than one turn, and it doesn't close: the hand overshoots and the radius drifts.
  const ring = (cx, cy, rx, ry, o = {}) => {
    const r = rng(o.seed ?? 1), start = -2.2 + r() * .9, turns = 1.1 + r() * .14, n = 15, drift = .05 + r() * .05
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, a = start + t * turns * Math.PI * 2, k = 1 + drift * (t - .5) * 2 + (r() - .5) * .05
      return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]
    })
    return stroke(pts, { wob: Math.min(rx, ry) * .05, ...o })
  }

  const line = (x0, y0, x1, y1, o = {}) => {
    const r = rng(o.seed ?? 1), bow = (o.bow ?? .05) * Math.hypot(x1 - x0, y1 - y0) * (r() - .4), dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1
    return stroke([[x0, y0], [(x0 + x1) / 2 - dy / d * bow, (y0 + y1) / 2 + dx / d * bow], [x1, y1]], o)
  }

  const cross = (cx, cy, rx, ry, o = {}) => {
    const s = o.seed ?? 1
    return line(cx - rx, cy - ry, cx + rx * .96, cy + ry * 1.04, { ...o, seed: s }) + line(cx + rx * 1.02, cy - ry * .94, cx - rx * .94, cy + ry, { ...o, seed: s + 7 })
  }

  // Four separate pulls of the pencil, overshooting at the corners, the way a print mark is drawn.
  const box = (x, y, w, h, o = {}) => {
    const s = o.seed ?? 1, e = Math.min(w, h) * .04
    return line(x - e, y, x + w + e, y + e * .3, { ...o, seed: s }) + line(x + w, y - e, x + w - e * .3, y + h + e, { ...o, seed: s + 1 }) +
      line(x + w + e, y + h, x - e, y + h - e * .4, { ...o, seed: s + 2 }) + line(x, y + h + e, x + e * .2, y - e, { ...o, seed: s + 3 })
  }

  const arrow = (pts, o = {}) => {
    const a = pts[pts.length - 2], b = pts[pts.length - 1], t = Math.atan2(b[1] - a[1], b[0] - a[0]), l = o.head ?? 13, s = o.seed ?? 1
    return stroke(pts, o) +
      line(b[0], b[1], b[0] + Math.cos(t + 2.6) * l, b[1] + Math.sin(t + 2.6) * l, { ...o, seed: s + 3, taper: true }) +
      line(b[0], b[1], b[0] + Math.cos(t - 2.5) * l, b[1] + Math.sin(t - 2.5) * l, { ...o, seed: s + 4, taper: true })
  }

  root.Pencil = { hash, rng, stroke, ring, line, cross, box, arrow }
})(globalThis)
