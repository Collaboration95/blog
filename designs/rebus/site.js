// Rebus. A picture is a word. Tapping it cuts the line at that word: everything before stays,
// everything after keeps its exact x and slides down, and the picture grows in the gap.
(() => {
  const calm = matchMedia('(prefers-reduced-motion: reduce)')
  const T = 460
  const EASE = 'cubic-bezier(.2,.8,.16,1)'
  const px = v => parseFloat(v) || 0
  const el = (tag, cls) => { const n = document.createElement(tag); n.className = cls; return n }
  const busy = new WeakSet()

  // What comes next on the page after this glyph, as a box: tells us if the line really continues.
  function following(g, from) {
    const scope = g.closest('p, h1, h2')
    const walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    walk.currentNode = from
    let n = walk.nextNode()
    while (n) {
      if (g.contains(n)) { n = walk.nextNode(); continue }
      if (n.nodeType === 3) {
        const at = n.data.search(/\S/)
        if (at >= 0) {
          const r = document.createRange()
          r.setStart(n, at); r.setEnd(n, at + 1)
          return r.getBoundingClientRect()
        }
      } else if (n.classList.contains('g')) return n.getBoundingClientRect()
      n = walk.nextNode()
    }
    return null
  }

  function open(g, animate = true) {
    if (g.classList.contains('open') || busy.has(g)) return
    const a = g.firstElementChild
    const pic = a.firstElementChild
    const bar = g.classList.contains('m')
    const par = g.closest('p, h1, h2')
    const cs = getComputedStyle(par)
    const lh = px(cs.lineHeight)
    const box = par.getBoundingClientRect()
    const left = box.left + px(cs.paddingLeft)
    const W = box.width - px(cs.paddingLeft) - px(cs.paddingRight)
    const from = pic.getBoundingClientRect()
    const gr = g.getBoundingClientRect()
    // The word's punctuation stays up with the hole, so a sentence ends before the picture and not under it.
    const tail = g.parentElement.matches('.w') && g.nextSibling?.nodeType === 3 ? g.nextSibling : null
    const r = document.createRange()
    r.selectNode(tail ?? g)
    const end = r.getBoundingClientRect().right
    const next = following(g, tail ?? g)
    const same = !!next && next.top < gr.bottom && next.bottom > gr.top

    const hole = el('span', 'mortise')
    hole.style.width = `${gr.width}px`
    hole.setAttribute('aria-hidden', 'true')
    const tab = el('span', 'tab')
    if (same) tab.style.width = `${end - left}px`
    tab.setAttribute('aria-hidden', 'true')
    const cap = el('span', 'cap')
    cap.textContent = g.dataset.cap
    if (g.dataset.full) {
      const link = el('button', 'full')
      link.type = 'button'
      link.textContent = `${pic.getAttribute('width')} × ${pic.getAttribute('height')}`
      link.addEventListener('click', () => { location.href = g.dataset.full })
      cap.append(' ', link)
    }

    g.before(hole)
    if (tail) g.before(tail)
    g.after(tab)
    g.classList.add('open')
    g.append(cap)
    a.setAttribute('aria-expanded', 'true')

    let w, h
    if (bar) {
      const frame = el('i', 'frame')
      a.prepend(frame)
      w = W; h = lh * 3
      a.style.height = `${h}px`
    } else {
      const ratio = pic.getAttribute('width') / pic.getAttribute('height')
      w = Math.min(W, Math.max(260, innerHeight * 0.74) * ratio)
      h = w / ratio
      pic.style.width = `${w}px`
      pic.style.height = `${h}px`
    }
    // The picture opens under its own word, as far as the column lets it.
    const inset = bar ? 0 : Math.min(Math.max(gr.left - left, 0), W - w)
    a.style.marginLeft = `${inset}px`
    cap.style.marginLeft = `${inset}px`
    cap.style.maxWidth = `${Math.max(w, 280)}px`
    const need = 7 + h + cap.offsetHeight + 10
    const total = Math.ceil(need / lh) * lh   // text after the gap lands back on the line grid
    g.style.height = `${total}px`
    const start = -(total + (same ? lh : 0))

    if (!animate || calm.matches) return
    const to = pic.getBoundingClientRect()
    const sx = from.width / to.width, sy = from.height / to.height
    const flip = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`
    const timing = { duration: T, easing: EASE }
    busy.add(g)
    pic.style.transformOrigin = '0 0'
    const main = g.animate([{ marginBottom: `${start}px` }, { marginBottom: '0px' }], timing)
    pic.animate([{ transform: flip }, { transform: 'none' }], timing)
    hole.animate([{ opacity: 0 }, { opacity: 1 }], timing)
    a.querySelector('.frame')?.animate([{ opacity: 0 }, { opacity: 1 }], timing)
    cap.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], timing)

    // If the picture would land below the screen, follow it down in step, never past its own line.
    const top = g.getBoundingClientRect().top
    const over = Math.min(top + total - innerHeight + lh, top - lh * 1.5)
    if (over > 0) {
      const y0 = scrollY
      const tick = () => {
        const p = main.effect.getComputedTiming().progress
        if (p === null) return
        scrollTo(0, y0 + over * bezier(p))
        if (main.playState === 'running') requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    main.finished.then(() => busy.delete(g), () => busy.delete(g))
  }

  // The eased curve above, sampled, so scrolling can keep pace with the gap.
  function bezier(t) {
    const [x1, y1, x2, y2] = [0.2, 0.8, 0.16, 1]
    let u = t
    for (let i = 0; i < 6; i++) {
      const x = 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3
      const d = 3 * (1 - u) ** 2 * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2)
      if (d) u -= (x - t) / d
    }
    return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3
  }

  function shut(g) {
    const hole = g.previousElementSibling
    const a = g.firstElementChild
    const pic = a.querySelector('img, .bar')
    g.nextElementSibling?.classList.contains('tab') && g.nextElementSibling.remove()
    if (hole?.classList.contains('mortise')) {
      if (hole.nextSibling !== g) g.after(hole.nextSibling)
      hole.remove()
    }
    g.querySelector('.cap')?.remove()
    g.querySelector('.frame')?.remove()
    g.classList.remove('open')
    g.removeAttribute('style')
    a.removeAttribute('style')
    pic.removeAttribute('style')
    if (pic.classList.contains('bar')) pic.style.setProperty('--r', g.dataset.r)
    a.setAttribute('aria-expanded', 'false')
  }

  function close(g, animate = true) {
    if (!g.classList.contains('open') || busy.has(g)) return
    if (!animate || calm.matches) { shut(g); return }
    const a = g.firstElementChild
    const pic = a.querySelector('img, .bar')
    const hole = g.previousElementSibling
    const tab = g.nextElementSibling
    const lh = px(getComputedStyle(g.closest('p, h1, h2')).lineHeight)
    const total = g.getBoundingClientRect().height
    const end = -(total + (tab && px(tab.style.width) > 0 ? lh : 0))
    const from = pic.getBoundingClientRect()
    const to = hole.getBoundingClientRect()
    const flip = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`
    const timing = { duration: T - 60, easing: EASE, fill: 'forwards' }
    busy.add(g)
    const main = g.animate([{ marginBottom: '0px' }, { marginBottom: `${end}px` }], timing)
    pic.animate([{ transform: 'none' }, { transform: flip }], timing)
    hole.animate([{ opacity: 1 }, { opacity: 0 }], timing)
    a.querySelector('.frame')?.animate([{ opacity: 1 }, { opacity: 0 }], timing)
    g.querySelector('.cap')?.animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], timing)
    main.finished.then(() => {
      busy.delete(g)
      g.getAnimations({ subtree: true }).forEach(x => x.cancel())
      shut(g)
    }, () => busy.delete(g))
  }

  const remember = id => { try { history.replaceState(null, '', id ? `#${id}` : location.pathname + location.search) } catch {} }
  const toggle = g => {
    if (g.classList.contains('open')) { close(g); if (location.hash === `#${g.id}`) remember('') }
    else { open(g); remember(g.id) }
  }

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey) return
    const hole = e.target.closest('.mortise')
    if (hole) { toggle(hole.nextElementSibling); return }
    const a = e.target.closest('.g > a')
    if (a) { e.preventDefault(); toggle(a.parentElement) }
  })
  document.addEventListener('keydown', e => {
    const a = e.target.closest?.('.g > a')
    if (!a) return
    if (e.key === ' ') { e.preventDefault(); toggle(a.parentElement) }
    if (e.key === 'Escape' && a.parentElement.classList.contains('open')) close(a.parentElement)
  })

  // "Open 5 pictures": sets every one out in the text at once.
  const all = document.querySelector('.all')
  if (all) {
    all.hidden = false
    const set = () => [...document.querySelectorAll(all.dataset.only === 'm' ? 'article .g.m' : 'article .g:not(.m)')]
    all.addEventListener('click', () => {
      const list = set().reverse()
      const closing = list.every(g => g.classList.contains('open'))
      list.forEach(g => (closing ? close(g, false) : open(g, false)))
      all.textContent = `${closing ? 'Open' : 'Close'} ${all.dataset.label}`
    })
  }

  // A seam is a cut with no picture in it: the next entry starts one line down, at the x the last one stopped at.
  function sew() {
    const tabs = [...document.querySelectorAll('.run > br + .tab')]
    tabs.forEach(t => t.removeAttribute('style'))
    for (const t of tabs) {
      const par = t.parentElement
      const box = par.getBoundingClientRect()
      const end = [...t.previousElementSibling.previousElementSibling.getClientRects()].pop()
      const em = px(getComputedStyle(par).fontSize)
      const x = end.right - box.left + em * 0.24
      const label = t.nextElementSibling.querySelector('.v').getBoundingClientRect().width
      if (x + label + em * 4 <= box.width) t.style.width = `${x}px` // no room for a few words: start at the margin
    }
  }

  // Measured with everything shut, because an open picture leaves every line where it was.
  function recut() {
    const list = [...document.querySelectorAll('.g.open')].reverse()
    list.forEach(g => shut(g))
    sew()
    list.forEach(g => open(g, false))
  }

  // A column that changes width re-cuts every open line.
  let width = innerWidth
  addEventListener('resize', () => {
    if (innerWidth === width) return
    width = innerWidth
    recut()
  })

  // A link to #f3 arrives with that picture open.
  const arrive = () => {
    const g = location.hash && document.getElementById(location.hash.slice(1))
    if (g && g.classList.contains('g')) {
      open(g, false)
      g.scrollIntoView({ block: 'center' })
    }
  }
  recut() // pictures that arrive open in the html get their real tab and whole-line height here
  document.fonts.ready.then(() => { recut(); arrive() })
})()
