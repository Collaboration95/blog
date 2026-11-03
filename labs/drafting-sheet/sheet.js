// Enhancement only. With no script: no leaders, and figures stay a few pixels off the grid.
// 1. snap: every block that isn't text ends on a 24px grid line, so the text after it is back on the grid.
// 2. leaders: a red pencil line leaves a phrase from the side and lands on the point of the picture it means.
// 3. scale: the printed scale is the scale you are really looking at.
(() => {
  const sheet = document.querySelector('.sheet')
  const frame = document.querySelector('.frame')
  if (!sheet || !frame) return
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.classList.add('leaders'); svg.setAttribute('aria-hidden', 'true')
  sheet.appendChild(svg)
  const el = (name, attrs) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e }

  function snap() {
    const top = frame.getBoundingClientRect().top
    for (const b of document.querySelectorAll('.text .fig:not(.side), .text .fig.side.never, .text .dims, .text .rep, .text .ga, .text .detail, .text .hl')) {
      if (getComputedStyle(b).float !== 'none') continue
      b.style.marginBottom = ''
    }
    for (const b of document.querySelectorAll('.text .fig, .text .dims, .text .rep, .text .ga, .text .detail, .text .hl')) {
      if (getComputedStyle(b).float !== 'none') continue
      const mb = parseFloat(getComputedStyle(b).marginBottom) || 0
      const end = b.getBoundingClientRect().bottom + mb - top
      const rem = end % 24
      if (rem > .5 && rem < 23.5) b.style.marginBottom = `${mb + 24 - rem}px`
    }
  }

  function scales() {
    for (const f of document.querySelectorAll('.fig')) {
      const img = f.querySelector('img'); const cap = f.querySelector('.cap')
      const w = img.getBoundingClientRect().width
      if (w) cap.dataset.s = `1:${(+img.dataset.w / w).toFixed(1)}`
    }
  }

  // Leaders are routed, not drawn at an angle. A leader travels only through margins and gutters, in
  // orthogonal runs, and every candidate is tested against all the text and drawings on the sheet. The word
  // is underlined; the leader leaves it from the side, or, with more words in the way, picks up on the same
  // line past the last glyph, as a line does when it passes behind something.
  function leaders() {
    svg.replaceChildren()
    const text = document.querySelector('.text')
    if (!text) return
    const o = sheet.getBoundingClientRect()
    const box = r => ({ l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top })
    const T = box(text.getBoundingClientRect())
    const rail = Math.min(T.r + 12, box(frame.getBoundingClientRect()).r - 6)

    const ink = []
    const walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    while (walk.nextNode()) {
      if (!walk.currentNode.data.trim()) continue
      range.selectNodeContents(walk.currentNode)
      for (const r of range.getClientRects()) if (r.width > 1) ink.push(box(r))
    }
    const drawn = [...text.querySelectorAll('.n,.cap,.plate,.chains,.dims,.rep,.ga,.detail,.prebox')]
    const floats = [...text.querySelectorAll('.fig')].filter(f => getComputedStyle(f).float !== 'none')
    const stroke = pts => `M${pts.map(p => p.join(' ')).join('L')}`
    const crosses = (pts, rects) => pts.slice(1).some((p, i) => {
      const a = pts[i]
      const l = Math.min(a[0], p[0]) - 2; const r = Math.max(a[0], p[0]) + 2
      const t = Math.min(a[1], p[1]); const b = Math.max(a[1], p[1])
      return rects.some(k => k.l < r && k.r > l && k.t < b && k.b > t)
    })

    for (const f of document.querySelectorAll('.fig[data-from]')) {
      const from = document.getElementById(f.dataset.from)
      const plate = f.querySelector('.plate')
      if (!from || !plate) continue
      const rects = [...from.getClientRects()].filter(r => r.width > 1).map(box)
      if (!rects.length) continue
      const dw = f.querySelector('.dw'); const dh = f.querySelector('.dh')
      dw.style.removeProperty('--x'); dh.style.removeProperty('--y')

      const word = rects[rects.length - 1]
      const y0 = Math.round(word.b) - .5
      const mid = (word.t + word.b) / 2
      const lineEnd = Math.max(...ink.filter(k => k.t < mid && k.b > mid).map(k => k.r), word.r)
      const joined = word.r >= lineEnd - 1
      const sx = joined ? word.r : lineEnd + 6

      const P = box(plate.getBoundingClientRect())
      const pw = P.r - P.l; const ph = P.b - P.t
      const pin = (f.dataset.pin || '').split(',').map(Number)
      const hasPin = pin.length === 2
      const floated = getComputedStyle(f).float !== 'none'
      const qx = P.l + pw * pin[0] / 100
      const qy = hasPin ? P.t + ph * pin[1] / 100 : P.t + Math.min(ph / 2, 24)
      const start = [sx, y0]

      const routes = []
      // straight down from the word's line into the top of the picture
      const dropX = hasPin ? qx : Math.min(Math.max(sx + 12, P.l + 12), P.r - 12)
      if (P.t > y0 && dropX >= sx && f.dataset.enter !== 'side') routes.push([start, [dropX, y0], [dropX, hasPin ? qy : P.t]])
      // along the gutter beside a floated figure
      const lane = P.l - 30
      if (floated && lane >= sx) routes.push([start, [lane, y0], [lane, qy], [hasPin ? qx : P.l, qy]])
      // out to the margin rail, along it, and in from the side
      if (rail >= sx) {
        if (hasPin || P.r <= rail) routes.push([start, [rail, y0], [rail, qy], [hasPin ? qx : P.r, qy]])
        else if (P.t > y0) routes.push([start, [rail, y0], [rail, P.t]])
      }
      // down the gutter of a float that stands in the way, under it, and into the picture from above
      for (const g of floats) {
        if (g === f || P.t <= y0) continue
        const gx = box(g.querySelector('.plate').getBoundingClientRect()).l - 30
        if (gx >= sx) routes.push([start, [gx, y0], [gx, P.t - 27], [dropX, P.t - 27], [dropX, hasPin ? qy : P.t]])
      }

      const others = drawn.filter(e => !f.contains(e)).map(e => box(e.getBoundingClientRect()))
      const route = routes.find(r => !crosses([[sx + 3, y0], ...r.slice(1)], [...ink, ...others]))

      for (const u of rects) el('path', { d: `M${u.l} ${Math.round(u.b) - .5}H${u.r}`, class: 'u' })
      if (!route) continue
      if (!joined) el('path', { d: `M${sx} ${y0 - 3}v6`, class: 'u' })

      // dimension text moves aside for a leader, as it does on paper
      route.slice(1).forEach((p, i) => {
        const a = route[i]
        if (a[0] === p[0] && Math.min(a[1], p[1]) < P.t - 9 && Math.max(a[1], p[1]) > P.t - 9 && Math.abs(p[0] - (P.l + P.r) / 2) < 54) dw.style.setProperty('--x', p[0] > (P.l + P.r) / 2 ? '26%' : '74%')
        if (a[1] === p[1] && Math.min(a[0], p[0]) < P.l - 15 && Math.max(a[0], p[0]) > P.l - 15 && Math.abs(p[1] - (P.t + P.b) / 2) < 36) dh.style.setProperty('--y', p[1] > (P.t + P.b) / 2 ? '26%' : '74%')
      })

      // a pale ground under the part that lies on the picture
      const over = route.slice(1).flatMap((p, i) => {
        const a = route[i]
        const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
        const x1 = cl(a[0], P.l, P.r); const x2 = cl(p[0], P.l, P.r); const y1 = cl(a[1], P.t, P.b); const y2 = cl(p[1], P.t, P.b)
        const on = a[0] === p[0] ? (a[0] >= P.l && a[0] <= P.r && y1 !== y2) : (a[1] >= P.t && a[1] <= P.b && x1 !== x2)
        return on ? [`M${x1} ${y1}L${x2} ${y2}`] : []
      })
      if (over.length) el('path', { d: over.join(''), class: 'halo' })
      el('path', { d: stroke(route) })

      const [ex, ey] = route[route.length - 1]
      if (hasPin) { el('circle', { cx: ex, cy: ey, r: 2.4 }); el('circle', { cx: ex, cy: ey, r: 6, class: 'tgt' }) } else {
        // an edge takes an arrowhead, a surface takes a dot
        const [bx, by] = route[route.length - 2]
        const sw = Math.sign(ex - bx); const sv = Math.sign(ey - by)
        el('path', { d: sv ? `M${ex} ${ey}l-1.6 ${-sv * 9}h3.2z` : `M${ex} ${ey}l${-sw * 9} -1.6v3.2z`, class: 'ah' })
      }
    }
  }

  const run = () => { snap(); scales(); leaders() }
  run()
  document.fonts?.ready.then(run)
  addEventListener('load', run)
  let raf = 0
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run) }).observe(document.documentElement)
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && location.hash.startsWith('#d')) location.hash = `#f${location.hash.slice(2)}`
  })
})()
