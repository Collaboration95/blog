#!/usr/bin/env node
// cut-and-paste: a photocopied zine. Run: node build.mjs (zero dependencies).
// Reads ../../content/posts.json and pastes/<post-id>.txt. Writes index.html, projects/, posts/.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { railHTML, RAIL_CSS } from '../../tools/series.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(here, '../../content/posts.json'), 'utf8'))
const SITE = (process.env.SITE_URL ?? '').replace(/\/$/, '') // set to the GitHub Pages URL for absolute og:image
const PAPER = '#F1F2EE'

/* ---------- seeded randomness: the same id always gives the same wobble ---------- */
const fnv = s => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const seeded = s => { let a = fnv(s); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const pick = (r, a) => a[Math.floor(r() * a.length)]
const f1 = n => +n.toFixed(1)

/* ---------- THE RULES. Angle is bounded by the fastener, in 0.4 degree steps. ---------- */
const ANGLES = { staple: [1.2, 1.6, 2, 2.4, 2.8, 3.2], clip: [.8, 1.2, 1.6, 2], tape: [.4, .8, 1.2], glue: [.4] }
const angle = (fast, r) => { const a = pick(r, ANGLES[fast]); return (r() < .5 ? -1 : 1) * a }
// The pink plate is misregistered by one offset per sheet, seeded by post id. Everything pink shares it.
const plate = id => { const r = seeded('plate:' + id); const s = () => (r() < .5 ? -1 : 1); return { mx: s() * (1.5 + Math.round(r() * 4) / 4), my: s() * (1 + Math.round(r() * 4) / 4) } }

/* ---------- the pen: variable-width filled strokes, not uniform SVG lines ---------- */
function spline(pts, step = 3) {
  const out = [], P = [pts[0], ...pts, pts.at(-1)]
  for (let i = 0; i < P.length - 3; i++) {
    const [a, b, c, d] = [P[i], P[i + 1], P[i + 2], P[i + 3]]
    const n = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / step))
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t
      const q = j => .5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3)
      out.push([q(0), q(1)])
    }
  }
  out.push(pts.at(-1)); return out
}
function pen(pts, r, { w = 3.2, wob = 1, head = .14, tail = .1 } = {}) {
  const s = spline(pts), ph = [r() * 6.3, r() * 6.3, r() * 6.3], L = [], R = []; let d = 0
  s.forEach((p, i) => {
    const q = s[Math.min(i + 1, s.length - 1)], o = s[Math.max(i - 1, 0)]
    let tx = q[0] - o[0], ty = q[1] - o[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l
    const u = i / (s.length - 1); if (i) d += Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1])
    const off = wob * (Math.sin(d / 31 + ph[0]) * .9 + Math.sin(d / 11 + ph[1]) * .3)
    const press = Math.min(1, u / head * .55 + .45) * Math.min(1, (1 - u) / tail * .8 + .2)
    const hw = w / 2 * press * (1 + .17 * Math.sin(d / 17 + ph[2]))
    const cx = p[0] - ty * off, cy = p[1] + tx * off
    L.push([cx - ty * hw, cy + tx * hw]); R.unshift([cx + ty * hw, cy - tx * hw])
  })
  return 'M' + [...L, ...R].map(p => `${f1(p[0])} ${f1(p[1])}`).join('L') + 'Z'
}
const paths = (ds, cls = '') => ds.map(d => `<path d="${d}"${cls ? ` class="${cls}"` : ''}/>`).join('')
const svg = (w, h, ds, cls, extra = '') => `<svg class="${cls}" viewBox="0 0 ${f1(w)} ${f1(h)}" aria-hidden="true" focusable="false"${extra}>${paths(ds)}</svg>`

const ringPts = (cx, cy, rx, ry, r, turns = 1.12) => {
  const n = 26, start = -2.0 + r() * .5, pts = [], dr = .05 + r() * .05
  for (let i = 0; i <= n; i++) { const a = start + (i / n) * turns * 2 * Math.PI, k = 1 + dr * (i / n - .4); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]) }
  return pts
}
const arrowDs = (pts, r, o = {}) => {
  const w = o.w ?? 3, s = spline(pts), e = s.at(-1), b = s[Math.max(0, s.length - 6)], a = Math.atan2(e[1] - b[1], e[0] - b[0]), len = o.len ?? 15
  const arm = t => [[e[0] + Math.cos(a + t) * len, e[1] + Math.sin(a + t) * len], [e[0] + Math.cos(a + t * .92) * len * .5 + r(), e[1] + Math.sin(a + t * .92) * len * .5], e]
  return [pen(pts, r, { w, wob: o.wob ?? 1.2 }), pen(arm(2.62), r, { w: w * .92, wob: .3, tail: .05 }), pen(arm(-2.55), r, { w: w * .92, wob: .3, tail: .05 })]
}
const inlineTally = (n, r) => {
  const ds = [], gap = 7; let x = 3
  for (let i = 1; i <= n; i++) {
    ds.push(pen([[x + r() * 1.4, 2 + r() * 2], [x + 1 + r() * 1.4, 20 + r() * 2]], r, { w: 2.5, wob: .4 }))
    if (i % 5 === 0) { ds.push(pen([[x - gap * 4 - 2, 16], [x + 3, 5]], r, { w: 2.4, wob: .4 })); x += 7 } x += gap
  }
  return svg(x + 2, 24, ds, 'gl')
}
const inlineXs = (n, r) => {
  const ds = [], s = 11; let x = 2
  for (let i = 0; i < n; i++) {
    const j = () => r() * 1.6
    ds.push(pen([[x + j(), 5 + j()], [x + s - 2 + j(), 18 + j()]], r, { w: 2.3, wob: .3 }), pen([[x + s - 2 + j(), 5 + j()], [x + j(), 18 + j()]], r, { w: 2.3, wob: .3 })); x += s + 1.6
  }
  return svg(x + 2, 24, ds, 'gl')
}
const tickDs = (r) => [pen([[3, 14 + r() * 2], [9, 21 + r()], [12, 22], [24, 3 + r() * 2]], r, { w: 3.2, wob: .4 })]
const scribble = (w, r, pass = 2) => { const pts = []; for (let i = 0; i <= pass; i++) { const y = 3 + i * 3 + r(); pts.push(i % 2 ? [w - 2 - r() * 6, y] : [2 + r() * 6, y]) } return pts }
const coil = (w, r, h = 34) => {
  const pts = []; let x = 4; const step = 19
  for (let i = 0; x < w - 8; i++) { const t = i * Math.PI * .5, k = 1 + r() * .22; pts.push([x + Math.cos(t + Math.PI) * 13 * k, h / 2 + Math.sin(t + Math.PI) * (h / 2 - 5) * k]); x += step / 4 }
  return pts
}

/* ---------- small helpers ---------- */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parts = d => { const [y, m, dd] = d.split('-').map(Number); return { y, m, d: dd } }
const fdate = p => { const { y, m, d } = parts(p.date); return p.dateApprox ? `c. ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]} ${y}` }
const frange = (a, b) => {
  const A = parts(a), B = parts(b)
  if (a === b) return `${B.d} ${MONTHS[B.m - 1]} ${B.y}`
  if (A.y === B.y && A.m === B.m) return `${A.d}–${B.d} ${MONTHS[B.m - 1]} ${B.y}`
  if (A.y === B.y) return `${MONTHS[A.m - 1]}–${MONTHS[B.m - 1]} ${B.y}`
  return `${MONTHS[A.m - 1]} ${A.y}–${MONTHS[B.m - 1]} ${B.y}`
}
const posts = data.posts
const byId = Object.fromEntries(posts.map(p => [p.id, p]))
const chrono = [...posts].reverse().sort((a, b) => a.date.localeCompare(b.date))
const SITE_NAME = data.site
const projOf = p => data.projects.find(x => x.id === p.project)
const orient = i => i.h > i.w * 1.1 ? 'tall' : i.w > i.h * 1.6 ? 'long' : 'std'
const isDoc = i => /slide|screen|diagram|chart|card|terminal|hero|sketch|overview|architecture|graph|strategies|arc\b|before and after|naming|cost page/i.test(i.alt) && !/selfie|presenting|wide shot|speakers on stage|on stage|lectern|winners/i.test(i.alt)
const headlineOf = p => {
  const first = p.blocks[0], len = plain(first.html).length
  return first.kind === 'p' && len <= 66 && !/<a/.test(first.html) ? { first: true, text: plain(first.html) } : { first: false, text: p.label }
}

/* ---------- paste files: the small markdown-like input ---------- */
function readPaste(id) {
  const f = join(here, 'pastes', id + '.txt'); const out = { prints: [], marks: [], stock: null, hand: false }
  if (!existsSync(f)) return out
  out.hand = true; let cur = null
  for (const raw of readFileSync(f, 'utf8').split('\n')) {
    const line = raw.trimEnd(); if (!line.trim() || line.trim().startsWith('#')) continue
    const ind = /^\s/.test(line), t = line.trim(); let m
    if (ind && cur) {
      if ((m = t.match(/^ring ([\d. ]+)$/))) cur.ink.push({ t: 'ring', a: m[1].split(' ').map(Number) })
      else if ((m = t.match(/^arrow ([-\d. ]+)$/))) cur.ink.push({ t: 'arrow', a: m[1].split(' ').map(Number) })
      else if ((m = t.match(/^under ([\d. ]+)$/))) cur.ink.push({ t: 'under', a: m[1].split(' ').map(Number) })
      else throw new Error(`bad ink line in ${id}: ${t}`)
      continue
    }
    cur = null
    if ((m = t.match(/^stock (\w+)$/))) out.stock = m[1]
    else if ((m = t.match(/^after "(.+)" !\[(\d+)\]\((.*)\)$/))) { cur = { phrase: m[1], n: +m[2], opts: m[3].split(/\s+/).filter(Boolean), ink: [] }; out.prints.push(cur) }
    else if ((m = t.match(/^(?:p(\d+) )?==(.+)==$/))) out.marks.push({ t: 'hi', p: m[1], s: m[2] })
    else if ((m = t.match(/^(?:p(\d+) )?~~(.+)~~$/))) out.marks.push({ t: 'strike', p: m[1], s: m[2] })
    else if ((m = t.match(/^(?:p(\d+) )?\(\((.+)\)\)$/))) out.marks.push({ t: 'ring', p: m[1], s: m[2] })
    else if ((m = t.match(/^(?:p(\d+) )?\*\*(.+)\*\*$/))) out.marks.push({ t: 'big', p: m[1], s: m[2] })
    else if ((m = t.match(/^(?:p(\d+) )?__(.+)__$/))) out.marks.push({ t: 'tail', p: m[1], s: m[2] })
    else if ((m = t.match(/^tally "(.+)" (\d+)$/))) out.marks.push({ t: 'tally', s: m[1], n: +m[2] })
    else if ((m = t.match(/^xs "(.+)" (\d+)$/))) out.marks.push({ t: 'xs', s: m[1], n: +m[2] })
    else if ((m = t.match(/^arrow "(.+)" (-?\d+) (-?\d+) (-?\d+)(?: \| (-?\d+) (-?\d+) (-?\d+))?$/))) out.marks.push({ t: 'arrow', s: m[1], ph: [+m[2], +m[3], +m[4]], dt: m[5] ? [+m[5], +m[6], +m[7]] : null })
    else if ((m = t.match(/^stroke p(\d+) (\d+)\/(\d+)$/))) out.marks.push({ t: 'stroke', p: m[1], a: +m[2], b: +m[3] })
    else if ((m = t.match(/^strip p(\d+)$/))) out.marks.push({ t: 'strip', p: m[1] })
    else if ((m = t.match(/^tick p(\d+)$/))) out.marks.push({ t: 'tick', p: m[1] })
    else if ((m = t.match(/^coil p(\d+)$/))) out.marks.push({ t: 'coil', p: m[1] })
    else if ((m = t.match(/^ruler (.+)$/))) out.ruler = Object.fromEntries(m[1].split(' ').map(x => x.split('=')).map(([k, v]) => [k, +v]))
    else if ((m = t.match(/^minutes (.+)$/))) out.ruler.cells = m[1].split(' ').map(x => x.match(/^(\d+)(?:-(\d+))?:(\d+)$/)).map(c => ({ a: +c[1], b: +(c[2] ?? c[1]), n: +c[3] }))
    else throw new Error(`bad paste line in ${id}: ${t}`)
  }
  return out
}

/* The generic rule, for every post without a paste file: images go inside paragraphs, spaced
   evenly, each one after a sentence near the middle of the paragraph. Short lines become strips,
   figures with a unit get the highlighter. */
const SENT = /[.!?)]\s+(?=[A-Z("“a-z])/g
function autoPaste(p) {
  const out = { prints: [], marks: [], stock: null, hand: false }, r = seeded('auto:' + p.id)
  const isP = i => p.blocks[i]?.kind === 'p' && plain(p.blocks[i].html).length > 30 && !/^<a/.test(p.blocks[i].html)
  const cand = p.blocks.map((_, i) => i).filter(isP), n = p.images.length, used = new Set()
  p.images.forEach((im, k) => {
    let want = cand[Math.min(cand.length - 1, Math.floor((k + .35) / n * cand.length))], best = want, bs = -1e9
    for (const c of cand) { if (used.has(c)) continue; const s = plain(p.blocks[c].html).length / 40 - Math.abs(c - want) * 3 - (c === 0 ? 2 : 0); if (s > bs) { bs = s; best = c } }
    used.add(best)
    const text = p.blocks[best].html, stops = [...text.matchAll(SENT)].map(m => m.index + 1)
    const mid = stops.length ? stops.reduce((a, b) => Math.abs(b - text.length / 2) < Math.abs(a - text.length / 2) ? b : a) : text.length
    out.prints.push({ block: best, at: mid, n: k + 1, opts: [], ink: [] })
  })
  if (!n) {
    // figures with units: at most three, never in adjacent paragraphs
    const hit = /(?<![\w.$-])(\$\d[\d,.]*|\d[\d,.]*(?:%|x\b|\s?(?:GB|MB|ms|seconds?|minutes?|hours?|hrs?|days?|weeks?|cents?|tokens|pull requests|commits|prompts)\b)|\d{3}\/\d{4})/
    let last = -9, c = 0
    p.blocks.forEach((b, i) => { if (b.kind !== 'p' || c >= 3 || i - last < 3) return; const t = b.html.replace(/<a [^]*?<\/a>/g, ''); const m = t.match(hit); if (m) { out.marks.push({ t: 'hi', p: String(i), s: m[1] }); last = i; c++ } })
  }
  // one short line in about every eight becomes a pasted strip
  let gap = 4
  const start = headlineOf(p).first ? 1 : 0
  p.blocks.forEach((b, i) => { gap++; if (b.kind === 'p' && i > start && gap > 7) { const t = plain(b.html); if (t.length >= 8 && t.length <= 58 && !/<a/.test(b.html) && !t.endsWith(':')) { out.marks.push({ t: 'strip', p: String(i) }); gap = 0 } } })
  return out
}

// Operate on text nodes only, so attributes and tags are never touched.
function inText(html, phrase, fn) {
  const needle = escText(phrase).replace(/&quot;/g, '"'); let pos = 0, intag = false
  for (const seg of html.split(/(<[^>]+>)/)) {
    if (seg.startsWith('<')) { const open = /^<(svg|a class="print)/.test(seg); pos += seg.length; if (open) intag = true; if (/^<\/(svg|a)>/.test(seg)) intag = false; continue }
    const i = intag ? -1 : seg.indexOf(needle)
    if (i >= 0) return fn(pos + i, pos + i + needle.length)
    pos += seg.length
  }
  return null
}
const applyAt = (blocks, s, p, make) => {
  const list = p != null ? [+p] : blocks.map((_, i) => i)
  for (const i of list) {
    const res = inText(blocks[i].html, s, (a, b) => make(blocks[i].html, a, b))
    if (res != null) { blocks[i] = { ...blocks[i], html: res }; return i }
  }
  throw new Error(`phrase not found: "${s}"`)
}

/* ---------- prints ---------- */
function printHtml(post, img, fig, opts, ink, depth, { noView = false } = {}) {
  const r = seeded(`${post.id}:fig:${fig}`), o = orient(img)
  const has = k => opts.includes(k)
  const fast = has('staple') ? 'staple' : has('tape') ? 'tape' : has('clip') ? 'clip' : has('glue') ? 'glue' : o === 'tall' ? 'clip' : isDoc(img) ? 'tape' : 'staple'
  const side = has('left') ? 'left' : has('right') ? 'right' : has('center') ? 'center' : fig % 2 ? 'right' : 'left'
  const size = has('full') ? 'full' : has('wide') ? 'wide' : has('half') ? 'half' : o === 'tall' ? 'half' : o === 'long' ? 'wide' : 'half'
  const ang = opts.map(x => x.match(/^a(-?[\d.]+)$/)).find(Boolean)?.[1] ?? angle(fast, r)
  const flat = has('true') ? 0 : ang
  const src = `${depth}content/${img.src.replace(/^content\//, '')}`
  const lazy = '' // eager: at most five prints a page, and unloaded lazy images report complete
  let fasteners = ''
  if (fast === 'staple') {
    const left = r() < .5 ? 1 : 0, st = Math.round((r() - .5) * 26)
    fasteners = `<svg class="staple ${left ? 'sl' : 'sr'}" style="--st:${st}deg" viewBox="0 0 30 9" aria-hidden="true"><path class="dent" d="M1 7.5h2M27 7.5h2"/><path class="wire" d="M2 7V4.2Q2 2.4 3.8 2.4H26.2Q28 2.4 28 4.2V7"/><path class="glint" d="M5 2.2H19"/></svg>`
  } else if (fast === 'tape') {
    const kind = opts.find(x => /^(clear|washi|gaffer)$/.test(x)) ?? (r() < .55 ? 'washi' : 'clear')
    const j = () => (r() - .5) * 8
    fasteners = `<span class="t t-${kind} tl" style="--tj:${f1(j())}deg"></span><span class="t t-${kind} tr" style="--tj:${f1(j())}deg"></span>`
  } else if (fast === 'clip') {
    fasteners = `<svg class="clipback" viewBox="0 0 22 66" aria-hidden="true"><path d="M6 12V50a5 5 0 0 0 10 0V8a4 4 0 0 0-8 0"/></svg><svg class="clipfront" viewBox="0 0 22 66" aria-hidden="true"><path d="M8 8V40a5 5 0 0 0 7 0"/></svg>`
  }
  const iw = 1000, ih = Math.round(1000 * img.h / img.w), rr = seeded(`${post.id}:ink:${fig}`)
  const ds = []
  for (const k of ink) {
    if (k.t === 'ring') ds.push(pen(ringPts(k.a[0], k.a[1], k.a[2], k.a[3], rr), rr, { w: 7.5, wob: 2 }))
    if (k.t === 'under') ds.push(pen(scribble(k.a[2], rr).map(([x, y]) => [x + k.a[0], y * 3 + k.a[1]]), rr, { w: 6, wob: 1.5 }))
    if (k.t === 'arrow') { const pts = []; for (let i = 0; i < k.a.length; i += 2) pts.push([k.a[i], k.a[i + 1]]); ds.push(...arrowDs(pts, rr, { w: 7, len: 34, wob: 2.5 })) }
  }
  const inkSvg = ds.length ? svg(iw, ih, ds, 'ink') : ''
  const cap = `fig. ${fig}  ${img.alt}`
  const cls = `print f-${fast} s-${side} z-${size} o-${o}${has('nocap') ? ' nocap' : ''}`
  const inner = `<span class="pic"><img src="${src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}"${lazy}>${inkSvg}</span>${fasteners}`
  return `<a class="${cls}" id="fig-${fig}" href="#view-${fig}" data-cap="${esc(cap)}" style="--r:${flat}deg;--ar:${(img.w / img.h).toFixed(3)}" aria-label="Open fig. ${fig} at full size">${inner}</a>`
}
const viewer = (post, depth) => post.images.map((img, i) => {
  const src = `${depth}content/${img.src.replace(/^content\//, '')}`
  return `<div class="view" id="view-${i + 1}"><a href="#fig-${i + 1}" class="vclose ${img.w > img.h ? 'land' : ''}" aria-label="Close"><img src="${src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}" loading="lazy"></a><span class="dymo vdy">fig. ${i + 1} &middot; ${img.w} &times; ${img.h}</span></div>`
}).join('')

/* ---------- post body ---------- */
function renderBlocks(post, paste, depth) {
  const r = seeded('marks:' + post.id), blocks = post.blocks.map(b => ({ ...b }))
  const before = {}, after = {}, pcls = {}, pstyle = {}, pre = {}
  // prints first, so phrases are matched against the plain text
  for (const pr of paste.prints) {
    const img = post.images[pr.n - 1]; if (!img) throw new Error(`${post.id}: no image ${pr.n}`)
    const html = printHtml(post, img, pr.n, pr.opts, pr.ink, depth)
    if (pr.phrase) applyAt(blocks, pr.phrase, null, (h, a, b) => h.slice(0, b) + ' ' + html + h.slice(b))
    else { const h = blocks[pr.block].html; blocks[pr.block].html = h.slice(0, pr.at) + ' ' + html + h.slice(pr.at) }
  }
  for (const m of paste.marks) {
    const wrap = (cls, inner = '') => (h, a, b) => `${h.slice(0, a)}<span class="${cls}">${h.slice(a, b)}${inner}</span>${h.slice(b)}`
    const chars = m.s ? m.s.length : 0
    if (m.t === 'hi') applyAt(blocks, m.s, m.p, wrap(`hi hi${1 + Math.floor(r() * 3)}`))
    if (m.t === 'big') applyAt(blocks, m.s, m.p, wrap('big', paste.ruler ? svg(400, 10, [pen([[2, 6], [200, 4], [398, 6]], r, { w: 3.4, wob: .5, head: .02, tail: .04 })], 'lead', ' preserveAspectRatio="none"') : ''))
    if (m.t === 'tail') applyAt(blocks, m.s, m.p, wrap('tail'))
    if (m.t === 'strike') { const w = chars * 10; applyAt(blocks, m.s, m.p, wrap('mk', svg(w, 20, [pen([[1, 12 + r() * 3], [w * .5, 9 + r() * 3], [w - 1, 7 + r() * 4]], r, { w: 2.8, wob: .6 })], 'over'))) }
    if (m.t === 'ring') { const w = chars * 10 + 18; applyAt(blocks, m.s, m.p, wrap('mk', `<svg class="around" viewBox="0 0 ${w} 40" preserveAspectRatio="none" aria-hidden="true">${paths([pen(ringPts(w / 2, 20, w / 2 - 5, 15, r), r, { w: 2.6, wob: .8 })])}</svg>`)) }
    if (m.t === 'tally') applyAt(blocks, m.s, null, (h, a, b) => `${h.slice(0, b)}<span class="glyph">${inlineTally(m.n, r)}</span>${h.slice(b)}`)
    if (m.t === 'xs') applyAt(blocks, m.s, null, (h, a, b) => `${h.slice(0, b)}<span class="glyph">${inlineXs(m.n, r)}</span>${h.slice(b)}`)
    if (m.t === 'arrow') {
      const one = (d, cls) => { const [dx, dy, bend] = d, W = Math.abs(dx) + 40, H = Math.abs(dy) + 30, x0 = dx < 0 ? W - 20 : 20, y0 = dy < 0 ? H - 12 : 12, x1 = x0 + dx, y1 = y0 + dy
        return `<svg class="hookarrow ${cls}" style="left:${f1(-x0)}px;top:${f1(-y0)}px;width:${W}px;height:${H}px" viewBox="0 0 ${W} ${H}" aria-hidden="true">${paths(arrowDs([[x0, y0], [(x0 + x1) / 2 + bend, (y0 + y1) / 2], [x1, y1]], r))}</svg>` }
      applyAt(blocks, m.s, null, (h, a, b) => `${h.slice(0, a)}<span class="hook">${h.slice(a, b)}<span class="hanchor">${one(m.ph, 'ph')}${m.dt ? one(m.dt, 'dt') : ''}</span></span>${h.slice(b)}`)
    }
    if (m.t === 'stroke') (after[m.p] ??= []).push(`<svg class="stroke" style="width:${f1(m.a / m.b * 100)}%" viewBox="0 0 ${Math.round(m.a / m.b * 600)} 16" aria-hidden="true">${paths([pen([[3, 9], [Math.round(m.a / m.b * 600) * .5, 7], [Math.round(m.a / m.b * 600) - 3, 8]], r, { w: 9, wob: 1, head: .03, tail: .03 })])}</svg>`)
    if (m.t === 'strip') { pcls[m.p] = (pcls[m.p] ?? '') + ' strip'; pstyle[m.p] = `--r:${angle('tape', r)}deg;--tj:${f1((r() - .5) * 12)}deg;--strip-x:${Math.round(r() * 22)}px` }
    if (m.t === 'tick') { pcls[m.p] = (pcls[m.p] ?? '') + ' ticked'; pre[m.p] = svg(26, 26, tickDs(r), 'tick') }
    if (m.t === 'coil') (after[m.p] ??= []).push(svg(700, 40, [pen(coil(700, r), r, { w: 2.6, wob: .5, head: .02, tail: .02 })], 'coil'))
  }
  const firstIsHead = headlineOf(post).first
  return blocks.map((b, i) => {
    if (i === 0 && firstIsHead) return null
    const n = `<a class="pn" href="#p${i}" aria-label="Link to paragraph ${i}">${i}</a>`
    const a = (after[i] ?? []).join('')
    if (b.kind === 'heading') return `<h2 class="sub" id="p${i}">${b.html}</h2>${a}`
    if (b.kind === 'pre') return `<div class="printout" id="p${i}" style="--r:${angle('tape', r)}deg" tabindex="0"><span class="t t-clear tl"></span><span class="t t-clear tr"></span><pre>${b.html.split('\n').map(l => `<span>${l}</span>`).join('\n')}</pre></div>${a}`
    const cls = (pcls[i] ?? '').trim(), st = pstyle[i]
    return `<p id="p${i}"${cls ? ` class="${cls}"` : ''}${st ? ` style="${st}"` : ''}>${n}${pre[i] ?? ''}${b.html}</p>${a}`
  })
}

/* ---------- page furniture ---------- */
const dust = id => {
  const r = seeded('dust:' + id); let s = ''
  for (let i = 0; i < 46; i++) { const x = Math.round(r() * 800), y = Math.round(r() * 1200), q = r() < .8 ? .5 : .9; s += `<circle cx='${x}' cy='${y}' r='${q}'/>` }
  for (let i = 0; i < 5; i++) { const x = Math.round(r() * 800), y = Math.round(r() * 1200); s += `<path d='M${x} ${y}q${Math.round(r() * 8)} ${Math.round(r() * 6)} ${Math.round(r() * 16)} ${Math.round(r() * 3)}' fill='none' stroke-width='.5' stroke='%231B2DB5'/>` }
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1200' fill='%231B2DB5' fill-opacity='.42'%3E${s.replace(/</g, '%3C').replace(/>/g, '%3E')}%3C/svg%3E")`
}
const css = depth => `<link rel="stylesheet" href="${depth}style.css">`
const fonts = () => '' // no preload: crossorigin preloads fail from file://
function head({ title, desc, depth, ogImg, type = 'article', path }) {
  const img = ogImg ? (SITE ? `${SITE}/${ogImg}` : `${depth}${ogImg}`) : null
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="author" content="${esc(data.author)}"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${type}"><meta property="og:site_name" content="${esc(SITE_NAME)}">${path && SITE ? `<meta property="og:url" content="${SITE}/${path}">` : ''}${img ? `<meta property="og:image" content="${img}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="${PAPER}">${fonts(depth)}${css(depth)}</head>`
}
const ogFor = id => existsSync(join(here, 'og', id + '.jpg')) ? `concepts-og/${id}` : null
const ogPath = (id, fallback) => existsSync(join(here, 'og', id + '.jpg')) ? `og/${id}.jpg` : fallback
const bodyOpen = (id, stock, extra = '') => { const { mx, my } = plate(id); return `<body class="stock-${stock} ${extra}" style="--mx:${mx}px;--my:${my}px;--dust:${dust(id).replace(/"/g, '&quot;')}">` }
// printer's marks: the blue plate's target, and the pink one off by this sheet's offset
const target = '<circle cx="11" cy="11" r="5.5"/><path d="M0 11H22M11 0V22"/>'
const regm = ['top', 'bot'].map(c => `<svg class="regm ${c}" viewBox="0 0 22 22" aria-hidden="true" focusable="false"><g class="pk">${target}</g><g>${target}</g></svg>`).join('')
const reg = (tag, text, cls = '', r = 0, inner = null) => `<${tag} class="reg ${cls}" data-t="${esc(text)}" style="--r:${r}deg">${inner ?? escText(text)}</${tag}>`
const script = `<script>addEventListener('keydown',function(e){if(e.key==='Escape'&&/^#view-/.test(location.hash))location.hash=location.hash.replace('view','fig')})</script>`

const shortArrow = (seed, dir) => { const r = seeded(seed); return svg(46, 20, arrowDs(dir < 0 ? [[43, 11], [24, 9], [4, 10]] : [[3, 10], [22, 11], [42, 10]], r, { w: 2.8, len: 10, wob: .6 }), 'nava') }

function navFor(post, depth) {
  const i = chrono.indexOf(post), older = chrono[i - 1], newer = chrono[i + 1]
  const tab = (p, dir) => p ? `<a class="tab ${dir < 0 ? 'older' : 'newer'}" href="${p.id}.html" rel="${dir < 0 ? 'prev' : 'next'}"><span class="tn">${dir < 0 ? shortArrow('o' + post.id, -1) : ''}<span class="dymo">${fdate(p)}</span>${dir > 0 ? shortArrow('n' + post.id, 1) : ''}</span><span class="tl-t">${escText(p.label)}</span></a>` : '<span></span>'
  // the series rail (tools/series.mjs): fixed dashes in the margin on wide screens, a list in flow here on phones
  const series = post.project ? `<div class="series" id="series">${railHTML(data, post)}</div>` : ''
  return `<footer class="foot">${series}<nav class="tabs" aria-label="Older and newer posts">${tab(older, -1)}${tab(newer, 1)}</nav>
<p class="src"><a class="dymo" href="${depth}index.html">${escText(SITE_NAME)}</a></p></footer>`
}
const slug = (post) => {
  const proj = projOf(post), idx = proj ? [...proj.posts].reverse().indexOf(post.id) + 1 : 0
  const mark = proj ? `${escText(proj.title)} &middot; ${idx} of ${proj.posts.length}` : ''
  // phone: the marker jumps to the list at the foot of the sheet; desktop: the rail is already in the margin, so it goes to the project
  return `<header class="slug"><a class="dymo name" href="../index.html">${escText(SITE_NAME)}</a>
<div class="slug2">${proj ? `<a class="dymo pk pk-m" href="#series">${mark}</a><a class="dymo pk pk-d" href="../projects/${proj.id}.html">${mark}</a>` : ''}<span class="dymo">${fdate(post)}</span></div></header>`
}

/* ---------- post pages ---------- */
function postPage(post) {
  const depth = '../../../'.slice(0, 3 * 1), siteDepth = '../'
  const contentDepth = '../../../'
  let paste = readPaste(post.id); if (!paste.hand) paste = autoPaste(post)
  const stock = paste.stock ?? (post.kind === 'repost' ? 'blue' : post.images.length ? 'white' : 'pink')
  const head1 = headlineOf(post), r = seeded('title:' + post.id)
  const tr = (r() < .5 ? -1 : 1) * pick(r, [.4, .8, 1.2, 1.6])
  const rendered = renderBlocks(post, paste, contentDepth)
  const title = `${post.label} — ${SITE_NAME}`
  const desc = post.opening
  const ogImg = ogPath(post.id, post.images[0] ? post.images[0].src : null)
  const ogRel = ogImg ? (ogImg.startsWith('og/') ? ogImg : `../content/${ogImg.replace(/^content\//, '')}`) : null
  let body
  if (paste.ruler) body = rulerBody(post, rendered, paste.ruler)
  else body = rendered.filter(Boolean).join('\n')
  const isOne = post.blocks.length === 1
  const h1 = isOne ? '' : ''
  return `${head({ title, desc, depth: siteDepth, ogImg: ogRel, path: `posts/${post.id}.html` })}
${bodyOpen(post.id, stock, `kind-${post.kind}${isOne ? ' one' : ''}${paste.ruler ? ' has-ruler' : ''}`)}
<div class="sheet">${regm}<div class="plate">
${slug(post)}
<main><article>
${reg('h1', head1.text, head1.first ? 'own' : '', tr)}
<div class="body">
${body}
</div>
</article></main>
${navFor(post, siteDepth)}
</div></div>
${viewer(post, contentDepth)}${script}
</body></html>`
}

/* apple-health-import: the page is a 26 minute ruler. The run is a grid of 26 equal rows, one a
   minute, and each paragraph is pinned to the tick it starts on, so the ruler can't drift from
   the text at any width. The grid sizes its rows from the content, so ticks stay even. */
function rulerBody(post, rendered, R) {
  const seg = (a, b) => rendered.slice(a, b + 1).filter(Boolean).join('\n')
  const total = R.total, ticks = [], last = R.cells.at(-1)
  if (R.cells.reduce((s, c) => s + c.n, 0) !== total) throw new Error('minutes must add up to the ruler total')
  for (let m = total - 1; m > 0; m--) ticks.push(`<i style="top:calc(${total - m} / ${total} * 100%)"${m % 5 === 0 || m === 21 ? ' class="maj"' : ''}>${m}</i>`)
  let row = 1
  const cells = R.cells.map(c => {
    const html = `<div class="m${c.b > c.a ? ' spread' : ''}${c === last ? ' zero' : ''}" style="grid-row:${row} / span ${c.n}">${seg(c.a, c.b)}</div>`
    row += c.n; return html
  }).join('\n')
  return `${seg(0, R.cells[0].a - 1)}
<section class="run" style="--secs:${(R.secs / 60).toFixed(4)};--mins:${total}">
<div class="ruler" aria-hidden="true"><b class="left21"></b>${ticks.join('')}<b class="stub"></b><span class="t t-gaffer rt"></span></div>
${cells}
</section>
<section class="flood">${tornEdge(post.id)}${seg(last.b + 1, rendered.length - 1)}</section>`
}
function tornEdge(id) {
  const r = seeded('torn:' + id); let d = 'M0 24'; const n = 42
  for (let i = 0; i <= n; i++) d += `L${f1(i / n * 1000)} ${f1(8 + r() * 13 + Math.sin(i * .7) * 3)}`
  d += 'L1000 24Z'
  return `<svg class="torn" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`
}

/* ---------- index and project pages ---------- */
const trailText = p => {
  let out = '', n = 0
  for (const b of p.blocks) { if (b.kind !== 'p') continue; const t = plain(b.html); out += (out ? ' ' : '') + t; if (out.length > 1200) break }
  return escText(out.slice(0, 1200))
}
const previewOf = list => { for (const p of list) if (p.images.length) { const i = [...p.images].find(x => orient(x) === 'std') ?? p.images[0]; return { post: p, img: i } } return null }

// the excerpt is torn through its last line, unless the whole opening is short enough to show
const wholeOpening = p => plain(trailText(p).replace(/&amp;/g, '&')).length <= 120

function entryFor(p) {
  const pj = projOf(p), r = seeded('entry:' + p.id), im = p.images[0]
  // U+2060 stops a line break after a hyphen before a digit ("GPT-6"), in both plates alike
  const hl = headlineOf(p).text.replace(/-(?=\d)/g, '-⁠')
  const stock = im ? 'white' : p.kind === 'repost' ? 'blue' : 'pink'
  const ang = im ? angle('glue', r) : angle('tape', r) // big scraps lean least
  const tape = `<span class="t t-${im ? 'washi' : 'clear'} top" style="--tx:${18 + Math.round(r() * 56)}%;--tj:${f1((r() - .5) * 7)}deg"></span>`
  const img = im ? `<span class="pv"><img src="../../content/${im.src.replace(/^content\//, '')}" width="${im.w}" height="${im.h}" alt="${esc(im.alt)}" loading="lazy" decoding="async"></span>` : ''
  const mark = pj ? `<a class="proj" href="projects/${pj.id}.html">${escText(pj.title)} &middot; ${[...pj.posts].reverse().indexOf(p.id) + 1} of ${pj.posts.length}</a>` : ''
  return { pic: !!im, html: `<article class="clip c-${stock}" style="--r:${ang}deg"><div class="scrap">${tape}
${reg('h2', hl, '', 0, `<a href="posts/${p.id}.html">${escText(hl)}</a>`)}
<p class="meta"><span class="dymo">${fdate(p)}</span>${mark}</p>
${img}<p class="trail${wholeOpening(p) ? ' whole' : ''}">${trailText(p)}</p>
</div></article>` }
}

function indexPage() {
  // every post is its own entry, strictly newest first (stable, so same-day posts keep the data order)
  const entries = [...posts].sort((a, b) => b.date.localeCompare(a.date)).map(entryFor), bands = []
  // The board is pasted up in bands, read in strict date order. A picture leads its band at 7 of
  // 12 columns and the scraps next to it fill the other 5, trimmed to the same depth, so no band
  // has a hole. Runs of text with no picture coming up are cut into threes.
  const html = list => list.map(e => e.html).join('\n')
  for (let i = 0; i < entries.length;) {
    const next = entries.slice(i + 1, i + 3), k = next.findIndex(e => e.pic)
    if (entries[i].pic) { bands.push(`<div class="band lead-l">${html([entries[i]])}<div class="stack">${html(next)}</div></div>`); i += 1 + next.length }
    else if (k >= 0) { bands.push(`<div class="band lead-r"><div class="stack">${html(entries.slice(i, i + k + 1))}</div>${html([next[k]])}</div>`); i += k + 2 }
    else { const row = entries.slice(i, i + 3); bands.push(`<div class="band row">${html(row)}</div>`); i += row.length }
  }
  const ogImg = ogPath('index', null)
  return `${head({ title: SITE_NAME, desc: SITE_NAME, depth: '', ogImg, type: 'website', path: 'index.html' })}
${bodyOpen('index', 'white', 'index')}
<div class="sheet">${regm}<div class="plate">
<header class="slug top"><span class="dymo name">${escText(SITE_NAME)}</span></header>
<main class="board">${bands.join('\n')}</main>
</div></div></body></html>`
}

function projectPage(pj) {
  const list = [...pj.posts].reverse().map(id => byId[id]), r = seeded('proj:' + pj.id), depth = '../../../'
  const hand = pj.id === 'the-commons'
  const stock = list.some(p => p.images.length) ? 'white' : 'pink'
  // each post is its own entry, oldest first: date, label, the first picture whole, the opening trailing off
  const sheets = list.map(p => {
    const im = p.images[0], href = `../posts/${p.id}.html`
    const pr = im ? printHtml(p, im, 1, ['nocap', 'center'], [], depth).replace(/ id="fig-\d+"/, '').replace(/href="#view-\d+"/, `href="${href}"`).replace(/aria-label="[^"]*"/, `aria-label="${esc(p.label)}: ${esc(im.alt)}"`) : ''
    const tr = (r() < .5 ? -1 : 1) * pick(r, [.4, .8, 1.2])
    return `<section class="leaf n${p.images.length ? 1 : 0}">
<p class="meta"><span class="dymo">${fdate(p)}</span></p>
${reg('h2', p.label, '', tr, `<a href="${href}">${escText(p.label)}</a>`)}
${pr ? `<div class="wall">${pr}</div>` : ''}
<p class="trail${wholeOpening(p) ? ' whole' : ''}">${trailText(p)}</p>
</section>`
  }).join('\n')
  const first = list.find(p => p.images.length)
  const ogImg = ogPath('project-' + pj.id, first ? `../content/${first.images[0].src.replace(/^content\//, '')}` : null)
  const tr = (r() < .5 ? -1 : 1) * pick(r, [.8, 1.2, 1.6])
  return `${head({ title: `${pj.title} — ${SITE_NAME}`, desc: pj.line || list[0].opening, depth: '../', ogImg, path: `projects/${pj.id}.html` })}
${bodyOpen('project:' + pj.id, stock, `project ${hand ? 'hand' : ''}`)}
<div class="sheet">${regm}<div class="plate">
<header class="slug"><a class="dymo name" href="../index.html">${escText(SITE_NAME)}</a><div class="slug2"><span class="dymo">${frange(pj.first, pj.last)}</span></div></header>
<main>
${reg('h1', pj.title, '', tr)}
${pj.line ? `<p class="pline">${escText(pj.line)}</p>` : ''}
${sheets}
</main>
<footer class="foot"><p class="src"><a class="dymo" href="../index.html">${escText(SITE_NAME)}</a></p></footer>
</div></div></body></html>`
}

/* ---------- write everything ---------- */
mkdirSync(join(here, 'posts'), { recursive: true }); mkdirSync(join(here, 'projects'), { recursive: true })
for (const p of posts) writeFileSync(join(here, 'posts', p.id + '.html'), postPage(p))
for (const p of data.projects) writeFileSync(join(here, 'projects', p.id + '.html'), projectPage(p))
writeFileSync(join(here, 'index.html'), indexPage())

/* the stylesheet = the shared series rail (tools/series.mjs) with its breakpoint raised, then site.css, which restyles it.
   Raised to 1200: the paper runs edge to edge and the left-hanging prints start at about 84px, so below 1200 the rail would sit on them. */
const rail = RAIL_CSS.replaceAll('(min-width:1100px)', '(min-width:1200px)').replaceAll('(max-width:1099.98px)', '(max-width:1199.98px)')
writeFileSync(join(here, 'style.css'), `/* generated by build.mjs: the shared rail, then site.css. Edit site.css. */\n${rail}\n${readFileSync(join(here, 'site.css'), 'utf8')}`)
console.log(`built ${posts.length} posts, ${data.projects.length} projects, index, style.css`)
