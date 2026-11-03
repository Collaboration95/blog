// Enhancement only. Without this the text, frames and rings are all there; what you lose
// is the pencil lines that cross the gutter, the sentence picking up where it stopped,
// and the full-size view inside the page.
(function () {
  const { hash, stroke, arrow } = Pencil
  const doc = document.documentElement
  const leads = JSON.parse(document.body.dataset.leads || '[]')
  const NS = 'http://www.w3.org/2000/svg'
  let svg

  // The sentence resumes at the column it stopped at, as if it ran under the frame.
  const wide = () => document.body.classList.contains('two') && matchMedia('(min-width:1024px)').matches
  function resume() {
    document.querySelectorAll('.cont').forEach(c => {
      c.style.textIndent = ''
      if (wide() && !c.previousElementSibling?.classList.contains('in')) return
      const caret = c.previousElementSibling?.previousElementSibling
      if (!caret?.classList.contains('caret')) return
      const box = c.getBoundingClientRect(), x = caret.getBoundingClientRect().left - box.left
      if (x > 8 && x < box.width * (wide() ? .6 : .78)) c.style.textIndent = `${Math.round(x)}px`
    })
  }

  // On a wide screen the side strip starts at the top of the page: the first frame hangs level with
  // the headline, unless its sentence is too far down to leave it. A frame of exposed words rises
  // beside the paragraph before it, so its words, at the foot of the frame, come next in the reading.
  function hang() {
    const top = 44
    const first = document.querySelector('.copy .up, .copy .strip:not(.in):not(.tx)')
    const told = [...document.querySelectorAll('.copy .strip.tx:not(.in)')]
    for (const s of [first, ...told]) if (s) s.style.marginTop = ''
    if (!wide()) return
    const film = document.getElementById('film').getBoundingClientRect().top
    if (first) {
      const lift = first.getBoundingClientRect().top - film - top
      if (lift > 0 && lift < 800) first.style.marginTop = `${-lift}px`
    }
    const lh = parseFloat(getComputedStyle(document.body).lineHeight)
    let floor = first ? first.getBoundingClientRect().bottom + 12 : film + top
    for (const s of told) {
      const r = s.getBoundingClientRect(), lift = Math.min(r.height - lh * 3, r.top - floor)
      if (lift > 0) s.style.marginTop = `${-lift}px`
      floor = s.getBoundingClientRect().bottom + 12
    }
  }

  const scr = () => ({ x: window.scrollX, y: window.scrollY })
  function point(end, toward) {
    const s = scr()
    if (end.f) {
      const r = document.getElementById(end.f)?.querySelector('img').getBoundingClientRect()
      if (!r) return null
      const cx = r.left + s.x + r.width * end.x / 100, cy = r.top + s.y + r.height * end.y / 100
      const ry = r.height * end.ry / 100
      if (wide()) return { x: cx - r.width * end.rx / 100 * .95, y: cy, img: true }
      const down = !toward || toward.y > cy
      return { x: cx, y: cy + (down ? ry : -ry) * .9, img: true }
    }
    const el = document.querySelector(`[data-w="${end.w}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + s.x + r.width / 2, y: r.top + s.y + r.height / 2, h: r.height, w: r.width, side: !!el.closest('.strip:not(.in)') }
  }
  function draw() {
    if (!leads.length) return
    if (!svg) {
      svg = document.createElementNS(NS, 'svg')
      svg.setAttribute('class', 'leads')
      svg.setAttribute('aria-hidden', 'true')
      document.body.append(svg)
    }
    svg.replaceChildren()
    const H = doc.scrollHeight, W = doc.clientWidth
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.style.height = `${H}px`
    const film = document.getElementById('film')?.getBoundingClientRect()
    const filmRight = film ? film.right + window.scrollX : W
    const railX = film ? Math.min(W - 11, filmRight - (film.width > 500 ? 18 : 12)) : W - 12
    const across = wide()
    for (const l of leads) {
      const b0 = point({ w: l.b })
      if (!b0) continue
      const a = point(l.a, b0)
      if (!a) continue
      if (across && a.img) {
        // Frame to word: out of the mark, over the rails and the gutter, then along the gap
        // between two lines of text, so it reaches the word without striking the words before it.
        const above = a.y < b0.y || Math.abs(a.y - b0.y) < 8, gap = b0.y + (above ? -1 : 1) * (b0.h * .5 + 3)
        const edge = filmRight - 40, mid = filmRight + (a.x - filmRight) * .5
        const pts = [[a.x, a.y], [mid, a.y + (gap - a.y) * .5]]
        if (b0.x + b0.w / 2 < edge - 30) pts.push([edge, gap], [b0.x + b0.w / 2 + 16, gap + (above ? -1 : 1)])
        pts.push([b0.x + b0.w * .3, b0.y + (above ? -1 : 1) * b0.h * .66])
        const p = document.createElementNS(NS, 'path')
        p.setAttribute('d', stroke(pts, { w: 3.2, seed: hash(JSON.stringify(l)), wob: 1.1 }))
        svg.append(p)
        continue
      }
      const down = b0.y > a.y
      // A word is met at its ring, from the side the line arrives.
      const b = { x: b0.x, y: b0.y + (down ? -1 : 1) * (b0.h * .62) }
      const start = a.w ? { x: a.x, y: a.y + (down ? 1 : -1) * (a.h * .62) } : a
      const dy = b.y - start.y, far = Math.abs(dy) > 150
      // On a wide screen a line between words stays on their strip: down the rail of the text strip,
      // or down the gutter when the words are exposed into frames on the side strip.
      const rail = across ? (a.side ? filmRight + 16 : filmRight - 16) : railX
      const pts = far
        ? [[start.x, start.y], [start.x + (rail - start.x) * .55, start.y + dy * .07], [rail, start.y + dy * .22], [rail, b.y - dy * .2], [b.x + (rail - b.x) * .45, b.y - dy * .06], [b.x, b.y]]
        : [[start.x, start.y], [start.x + (b.x - start.x) * .4, start.y + dy * .7], [b.x, b.y]]
      const p = document.createElementNS(NS, 'path')
      p.setAttribute('d', stroke(pts, { w: 2.8, seed: hash(JSON.stringify(l)), wob: 1.6 }))
      svg.append(p)
    }
  }

  function layout() { resume(); hang(); draw() }
  let t
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(layout, 120) })
  layout()
  document.fonts?.ready.then(layout)
  addEventListener('load', layout)

  // Full size, on black, without leaving the post. Without JS the frame is already shown whole in the page.
  const view = document.createElement('dialog')
  view.className = 'view'
  document.body.append(view)
  document.addEventListener('click', e => {
    const a = e.target.closest('a.ph[data-alt]')
    if (!a || e.metaKey || e.ctrlKey) return
    e.preventDefault()
    const img = new Image()
    img.src = a.dataset.full
    img.alt = a.dataset.alt
    view.replaceChildren(img)
    view.dataset.n = a.dataset.n
    view.showModal()
  })
  view.addEventListener('click', () => view.close())
})()
