#!/usr/bin/env node
// character-grid: a compositor, not a template. The browser never wraps a line on this site.
// Every line break, hole, page and figure is decided here, twice: once for an 80-column sheet
// and once for a 42-column sheet. Both sets of breaks live in one text stream as <br class="d|m">.
// Run: node build.mjs   Add a post: posts.json, plus an optional placements/<post-id>.md
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { card } from './card.mjs'
import { railHTML, RAIL_CSS } from '../../tools/series.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const data = JSON.parse(readFileSync(join(root, 'content/posts.json'), 'utf8'))
const SITE = process.env.SITE_URL?.replace(/\/$/, '') ?? ''   // absolute og:image once the Pages URL is known
const AUTHOR = data.author      // only for <meta name="author">
const NAME = data.site          // the site's name, everywhere it is shown

// ---- the grid -------------------------------------------------------------------------------
// A cell is 3 wide by 7 high. Courier Prime's advance is 0.6em, so line-height is exactly 1.4em.
const CW = 3, CH = 7
const LAYOUTS = {
  d: { sheet: 80, fx: 4, fw: 72, x: 7, w: 69, page: 58, gap: 2, head: 4, foot: 4, minSeg: 16 },
  m: { sheet: 42, fx: 1, fw: 40, x: 4, w: 37, page: 37, gap: 2, head: 3, foot: 3, minSeg: 12 },
}
const KEYS = ['d', 'm']
const NUM = 4     // cells to the right of a left-hand figure: the paragraph number needs its own gutter there too
const RUN = 2     // rows of full-measure text before the next side figure may start

// ---- text atoms -----------------------------------------------------------------------------
const cellWidth = cp => (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || cp >= 0x1f300 || cp === 0x2728 ? 2 : 1
const isEmoji = cp => cp >= 0x1f300 || cp === 0x2728
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = s => esc(s).replace(/"/g, '&quot;')
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const vis = h => [...plain(h)].reduce((n, c) => n + cellWidth(c.codePointAt(0)), 0)
const sp = n => ' '.repeat(Math.max(0, n))

function cellify(raw, cp) {            // anything outside the font still takes whole cells
  if (cellWidth(cp) === 1) return raw
  return `<i class="${isEmoji(cp) ? 'e' : 'w'}">${raw}</i>`
}

function atomize(html) {
  const atoms = []
  let pre = ''
  const re = /(<[^>]+>)|(&(?:amp|lt|gt);)|([\s\S])/gu
  for (const m of html.matchAll(re)) {
    if (m[1]) {
      if (m[1].startsWith('</') && atoms.length) atoms[atoms.length - 1].post += m[1]
      else pre += m[1]
      continue
    }
    const raw = m[2] ?? esc(m[3])
    const ch = m[2] ? plain(m[2]) : m[3]
    const cp = ch.codePointAt(0)
    atoms.push({ ch, raw: cellify(raw, cp), w: cellWidth(cp), pre, post: '' })
    pre = ''
  }
  return atoms
}

function tokenize(atoms) {
  const toks = []
  let i = 0, id = 0
  while (i < atoms.length) {
    while (i < atoms.length && /[ \n]/.test(atoms[i].ch)) { if (toks.length) { toks.at(-1).sp++; if (atoms[i].ch === '\n') toks.at(-1).nl = true } i++ }
    if (i >= atoms.length) break
    const s = i
    let w = 0
    while (i < atoms.length && !/[ \n]/.test(atoms[i].ch)) w += atoms[i++].w
    toks.push({ s, e: i, w, sp: 0, id: id++ })
  }
  return toks
}

function splitTok(tok, atoms, avail) {
  let w = 0, hard = tok.s, soft = -1
  for (let i = tok.s; i < tok.e; i++) {
    if (w + atoms[i].w > avail) break
    w += atoms[i].w
    hard = i + 1
    if (/[\/\-.?=&_]/.test(atoms[i].ch) && w >= avail * 0.45) soft = i + 1
  }
  const cut = soft > tok.s ? soft : hard
  const width = (a, b) => atoms.slice(a, b).reduce((n, x) => n + x.w, 0)
  return [{ ...tok, e: cut, w: width(tok.s, cut), sp: 0, part: true }, { ...tok, s: cut, w: width(cut, tok.e) }]
}

const wrapWords = (text, width) => {
  const lines = []
  let cur = ''
  const push = () => { if (cur) lines.push(cur); cur = '' }
  for (let word of text.split(/\s+/).filter(Boolean)) {
    while (vis(word) > width) { push(); lines.push(word.slice(0, width)); word = word.slice(width) }
    if (vis(cur) + (cur ? 1 : 0) + vis(word) > width) push()
    cur += (cur ? ' ' : '') + word
  }
  push()
  return lines
}

// ---- images on the grid ---------------------------------------------------------------------
// The width is the decision: it lands on the column asked for, so right edges line up. The height
// rounds up to whole lines and the picture sits in that box at its own ratio, so what is left over
// is at most 0.9 of a line of paper under it. Only if that fails does the width give up a column.
let worstSlack = 0
function fitCells(w, h, target, maxH = 999) {
  const r = w / h
  const exact = W => W * CW / (CH * r)
  let best = null
  for (let W = target; W >= Math.max(4, target - 3); W--) {
    const H = Math.max(1, Math.ceil(exact(W) - 0.02))
    if (H > maxH) continue
    const slack = H - exact(W)
    if (slack <= 0.9) return { W, H, slack }
    if (!best || slack < best.slack) best = { W, H, slack }
  }
  if (!best) return fitCells(w, h, Math.floor(maxH * CH * r / CW), maxH)
  return best
}

// ---- the compositor -------------------------------------------------------------------------
class Flow {
  constructor(k) {
    this.k = k; this.L = LAYOUTS[k]; this.rects = []; this.pending = []
    this.y = this.bodyStart(0); this.last = this.y
  }
  get pitch() { return this.L.page + this.L.gap }
  pageOf(y) { return Math.floor(y / this.pitch) }
  bodyStart(p) { return p * (this.L.page + this.L.gap) + (p === 0 ? 2 : this.L.head) }
  bodyEnd(p) { return p * this.pitch + this.L.page - this.L.foot }
  next(y) { const p = this.pageOf(y); return y + 1 < this.bodyEnd(p) ? y + 1 : this.bodyStart(p + 1) }
  isTop(y) { return y === this.bodyStart(this.pageOf(y)) }
  blocked(y) { return this.rects.some(r => r.y0 <= y && y < r.y1) }

  segs(y, base) {
    const R = this.L.x + this.L.w
    let out = [[base, R]]
    for (const r of this.rects) {
      if (y < r.y0 || y >= r.y1) continue
      if (r.block) return []
      const a = r.x0 - 2, b = r.x1 + (r.x0 === this.L.x ? NUM : 2), next = []
      for (const [s, e] of out) {
        if (a > s) next.push([s, Math.min(a, e)])
        if (b < e) next.push([Math.max(b, s), e])
      }
      out = next
    }
    return out.filter(([s, e]) => e - s >= this.L.minSeg)
  }

  startBlock(gap, need = 1) {
    let y = this.y
    for (let i = 0; i < gap && !this.isTop(y); i++) y = this.next(y)
    const p = this.pageOf(y)
    if (this.bodyEnd(p) - y < need) y = this.bodyStart(p + 1)
    // A paragraph that opened in the last rows beside a figure would get a short line or two and
    // then jump back out, leaving a hole. It waits and opens at the full measure instead.
    while (this.rects.some(r => r.side && r.y1 - RUN <= y && y < r.y1)) y = this.next(y)
    this.y = y
    this.tryPending(y)
  }

  tryPending(y) {                      // figures keep their order: one that is stuck holds the rest back
    const waiting = this.pending; this.pending = []
    for (let i = 0; i < waiting.length; i++) {
      if (this.place(waiting[i], y, null)) continue
      this.pending.push(...waiting.slice(i + 1))
      break
    }
  }

  below(y) { const n = this.next(y); return this.isTop(n) ? n : this.next(n) }   // one clear row, none at a page top
  clear(y) { return !this.isTop(y) && this.ink === y - 1 ? this.next(y) : y }

  place(fig, y, col) {
    const { L, k } = this
    if (col !== null && this.pending.length) { this.pending.push(fig); return false }
    const s = fig.spec[k], d = fig.dims[k]
    const { mode } = s
    const X = L.x, R = L.x + L.w, dx = s.dx ?? 0
    const rx = R - d.W - dx
    // A side figure with no usable column beside it is a block figure that happens to hang right.
    const beside = mode === 'right' ? rx - X - 2 >= L.minSeg : mode === 'left' ? R - (X + d.W + NUM) >= L.minSeg : false
    let x, y0
    if (mode === 'at') { x = col === null ? X + dx : Math.min(col + 2, R - d.W); y0 = y }
    else {
      x = mode === 'bleed' ? 0 : mode === 'full' ? L.fx : mode === 'right' ? rx : mode === 'left' ? X : X + dx
      y0 = col === null ? this.clear(y) : beside && mode === 'right' && col + 2 <= x ? this.next(y) : this.below(y)
    }
    const p = this.pageOf(y0)
    const top = mode === 'at' || this.isTop(y0) ? y0 : y0 - 1     // the clear row above belongs to the figure
    const y1 = y0 + d.total + 1
    // A block figure has no text beside it, so it shares its rows only with a figure from the same anchor.
    const clash = this.rects.some(r => top < r.y1 && r.y0 < y1 && (x - 2 < r.x1 && r.x0 < x + d.W + 2 || (!beside && mode !== 'at' && r.fig !== fig.anchor)))
    const crowded = beside && this.rects.some(r => this.pageOf(r.y1 - 1) === p && top < r.y1 + RUN)
    if (y0 + d.total > this.bodyEnd(p) || clash || crowded) { this.pending.push(fig); return false }
    if (mode === 'left' && top < y0) this.rects.push({ x0: X, x1: R, y0: top, y1: y0, fig: fig.anchor })   // text enters beside it, not above it
    this.rects.push({ x0: x, x1: x + d.W, y0: top, y1, side: beside, block: !beside && mode !== 'at', fig: fig.anchor })
    fig.pos[k] = { x, y: y0, W: d.W, H: d.H }
    return col !== null && mode !== 'at' && (!beside || mode === 'left') ? 'break' : true
  }

  flush() {                            // the text has run out: anything still waiting goes before the end matter
    const waiting = this.pending; this.pending = []
    if (!waiting.length) return
    for (const fig of waiting) {
      const was = fig.spec[this.k]
      if (was.mode === 'right' || was.mode === 'left') fig.spec[this.k] = { ...was, mode: 'wide', dx: 0 }
      let y = this.y
      while (!this.place(fig, y, null)) { this.pending.pop(); y = this.next(y) }
    }
    this.y = Math.max(...this.rects.map(r => r.y1))
    this.last = this.y - 1
  }

  finish() {
    let y = this.last
    while (this.pending.length) { y = this.next(y); this.tryPending(y) }
    const bottom = Math.max(y, ...this.rects.map(r => r.y1 - 1))
    this.pages = this.pageOf(bottom) + 1
    this.total = this.pages * this.pitch - this.L.gap
  }
}

function flowPara(F, it) {
  const { k, L } = F
  const X = L.x
  const opts = it.opts?.[k] ?? {}
  const base = X + (opts.indent ?? 0)
  const hang = it.hang ?? 0
  const ins = {}
  const add = (i, s) => { ins[i] = (ins[i] ?? '') + s }
  const gap = opts.tight ?? it.tight ? 0 : 1
  if (opts.wait && F.pending.length) {       // this paragraph must not pass its pictures
    let at = F.y
    while (F.pending.length) { F.tryPending(at); at = F.next(at) }
    F.y = at
  }
  F.startBlock(gap, it.need ?? (it.toks.length > 4 ? 2 : 1))
  let y = F.y, y0 = null, nx = 0
  let lineBase = base, segs = F.segs(y, lineBase), si = 0, col = null, pendBr = 0
  const nextLine = () => {
    const ny = F.next(y); pendBr += ny - y; y = ny
    lineBase = base + hang
    F.tryPending(y)
    segs = F.segs(y, lineBase); si = 0; col = null
  }
  const queue = [...it.toks]
  let prevSp = 0
  while (queue.length) {
    const tok = queue.shift()
    const need = tok.w
    let guard = 0
    for (;;) {
      if (++guard > 5000) throw new Error(`no room for "${it.id}" in layout ${k}`)
      const seg = segs[si]
      if (!seg) { nextLine(); continue }
      if (col === null) {
        const fitAt = segs.findIndex((s, i) => i >= si && need <= s[1] - s[0])
        const widest = Math.max(...segs.map(s => s[1] - s[0]))
        if (fitAt < 0 && need <= L.w - (lineBase - X) && widest < L.w - (lineBase - X)) { nextLine(); continue }
        if (fitAt < 0) {
          const [a, b] = splitTok(tok, it.atoms, seg[1] - seg[0])
          queue.unshift(b); placeAndGo(a, seg[0], true); break
        }
        placeAndGo(tok, segs[fitAt][0], false, fitAt); break
      }
      if (col + prevSp + need <= seg[1]) { col += prevSp + need; after(tok); break }
      if (need > L.w - hang && seg[1] - (col + prevSp) >= 8) {
        const [a, b] = splitTok(tok, it.atoms, seg[1] - (col + prevSp))
        queue.unshift(b); col += prevSp + a.w; prevSp = 0
        add(b.s, '')
        after(a, true); break
      }
      const nxt = segs.findIndex((s, i) => i > si && need <= s[1] - s[0])
      if (nxt > 0) {
        add(tok.s, `<i class="${k}">${sp(segs[nxt][0] - (col + prevSp))}</i>`)
        si = nxt; col = segs[nxt][0] + need
        after(tok); break
      }
      nextLine()
    }
    function placeAndGo(t, a, broke, idx) { // first word in a line
      if (idx !== undefined) si = idx
      if (y0 === null) pendBr = 0                // the block's top is this line, nothing to skip
      let s = `<br class="${k}">`.repeat(pendBr); pendBr = 0
      const off = a - X
      if (y0 === null) { y0 = y; nx = off; if (off > 0) s = `<i class="${k}">${sp(off)}</i>` }
      else if (off > 0) s += `<i class="${k}">${sp(off)}</i>`
      if (s) add(t.s, s)
      F.ink = y
      col = a + t.w
      return after(t, broke)
    }
    function after(t, broke) {
      prevSp = broke ? 0 : t.sp
      if (broke) { pendBr = 0; nextLine() }
      if (!t.part) {
        for (const fig of it.figs?.filter(f => f.tok === t.id) ?? []) {
          const r = F.place(fig, y, col)
          if (r === 'break') { segs = []; si = 0 }
          else if (r) { segs = F.segs(y, lineBase); si = Math.max(0, segs.findIndex(s => col <= s[1])); if (segs.length && col > segs[si][1]) segs = [] }
        }
      }
      if (t.nl) { nextLine() }
    }
  }
  it.figs?.filter(f => f.tok === -1).forEach(f => F.place(f, y, null))
  F.last = y
  F.y = F.next(y)
  it.pos[k] = { x: X, y: y0, nx, ins }
}

function flowRows(F, it) {
  const { k, L } = F
  const rows = (typeof it.rows === 'function' ? it.rows(k) : it.rows[k]) ?? []
  if (!rows.length) { it.pos[k] = []; return }
  F.startBlock(it.gap ?? 1, it.keep ? rows.length : (it.need ?? 1))
  let y = F.y
  const out = []
  rows.forEach((html, i) => {
    while (F.blocked(y)) y = F.next(y)
    if (it.mark && i === 0) it.mark(k, F.pageOf(y) + 1, y)
    out.push({ y, html })
    F.last = F.ink = y
    y = F.next(y)
  })
  F.y = y
  it.pos[k] = out.map(r => ({ ...r, x: it.body ? L.x : L.fx }))
}

function flowEntry(F, it) {          // an index entry: rows and a picture placed as one unit
  const { k, L } = F
  const e = it.build(k)
  F.startBlock(1, e.h)
  const y = F.y
  it.mark?.(k, F.pageOf(y) + 1, y)
  it.pos[k] = { y, rows: e.rows.map(r => ({ ...r, y: y + r.y })), fig: e.fig && { ...e.fig, y: y + e.fig.y } }
  F.last = y + e.h - 1
  F.y = F.next(F.last)
}

function layout(items) {
  const flows = {}
  for (const k of KEYS) {
    const F = flows[k] = new Flow(k)
    for (const it of items) {
      if (it.t === 'para') flowPara(F, it)
      else if (it.t === 'rows') flowRows(F, it)
      else if (it.t === 'entry') flowEntry(F, it)
      else if (it.t === 'flush') F.flush()
      else if (it.t === 'newpage') { F.y = F.bodyStart(F.pageOf(F.last) + 1); F.last = F.y }
    }
    F.finish()
  }
  return flows
}

// ---- input: placements ----------------------------------------------------------------------
function readPlacements(id) {
  const file = join(here, 'placements', `${id}.md`)
  const out = { figs: [], index: [], opts: [], ascii: {} }
  if (!existsSync(file)) return null
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || line.startsWith('# ')) continue
    if (line.startsWith('@@ ')) {
      const [, name, k] = line.split(/\s+/)
      const rows = []
      while (!lines[++i].startsWith('@@')) rows.push(lines[i])
      ;(out.ascii[name] ??= {})[k] = rows
      continue
    }
    if (line.startsWith('== ')) { out.index.push(line.slice(3).trim()); continue }
    if (line.startsWith('~ ')) {
      const [, range, key, val] = line.split(/\s+/)
      const onlyK = line.match(/\s([dm])$/)?.[1]
      const [a, b = a] = range.split('-').map(Number)
      for (let n = a; n <= b; n++) out.opts.push({ n, key, val: Number(val ?? 1), k: onlyK })
      continue
    }
    const m = line.match(/^(.*?)\[\[(.+?)\]\](.*)$/)
    if (!m) throw new Error(`${id}: cannot read placement line: ${line}`)
    out.figs.push({ before: m[1].trim(), ref: m[2].trim(), after: m[3].trim() })
  }
  return out
}

function parseRef(ref) {
  const [dPart, mPart = ''] = ref.split('|').map(s => s.trim())
  const [name, ...rest] = dPart.split(/\s+/)
  const spec = t => {
    const s = {}
    for (const w of t) {
      if (/^\d+$/.test(w)) s.w = Number(w)
      else if (/^\+\d+$/.test(w)) s.dx = Number(w)
      else if (w === 'nocap') s.nocap = true
      else s.mode = w
    }
    return s
  }
  return { name, d: spec(rest), m: spec(mPart.split(/\s+/).filter(w => w && w !== 'm')) }
}

// Where the marker falls in the block's plain text. Spaces are forgiven, words are not.
function findAnchor(atoms, before, after, id) {
  const text = atoms.map(a => a.ch).join('')
  const squeeze = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  const pat = new RegExp(`${squeeze(before)}(?=\\s*${squeeze(after)})`)
  const m = text.match(pat)
  if (!m) return null
  return m.index + m[0].length
}

// The rules for every post nobody has hand-placed. Images go inside the text at the sentence end
// nearest an even share of the words, wide pictures across the measure, the rest hung off the right
// edge. Automatic figures never go left: the text keeps its left edge, so it always has one place
// to return to. A left-hand figure is a decision, so it needs a person.
function autoFigs(post, paras) {
  const sentenceEnds = []
  let words = 0
  const total = paras.reduce((n, p) => n + p.toks.length, 0)
  paras.forEach((p, pi) => {
    p.toks.forEach((t, ti) => {
      words++
      const last = p.atoms[t.e - 1]?.ch
      if (/[.?!:]/.test(last ?? '')) sentenceEnds.push({ pi, atom: t.e, words, mid: ti < p.toks.length - 1 })
      else if (ti === p.toks.length - 1) sentenceEnds.push({ pi, atom: t.e, words, mid: false })
    })
  })
  const n = post.images.length
  const used = new Set()
  const spots = post.images.map((_, i) => {
    const want = Math.min(0.92, (i + 0.5) / n * 0.9 + 0.04) * total
    const pool = sentenceEnds.filter(c => !used.has(c.pi))
    const pick = (pool.length ? pool : sentenceEnds).reduce((a, c) => (Math.abs(c.words - want) - (c.mid ? 6 : 0) < Math.abs(a.words - want) - (a.mid ? 6 : 0) ? c : a))
    used.add(pick.pi)
    return pick
  }).sort((a, b) => a.words - b.words)
  // A hung figure holds about 17 rows of 30 columns. If they would outrun the text, the wide sheet
  // sets two landscape pictures on one row, so the pictures stay inside the post.
  const chars = paras.reduce((c, p) => c + p.atoms.length, 0)
  const hung = post.images.filter(i => i.w / i.h < 1.62).length
  let over = hung * 17 * 30 > chars
  const out = post.images.map((img, i) => {
    const r = img.w / img.h
    const d = r >= 1.62 ? { mode: 'wide', w: 69 } : r >= 1 ? { mode: 'right', w: 37 } : { mode: 'right', w: 26 }
    const m = r >= 1 ? { mode: 'wide', w: 37 } : { mode: 'right', w: 28 }
    return { img, ...spots[i], spec: { d, m } }
  })
  for (let i = 0; over && i + 1 < n; i++) {
    const [a, b] = [out[i], out[i + 1]]
    const landscape = f => f.img.w / f.img.h >= 1 && f.img.w / f.img.h < 1.62
    if (!landscape(a) || !landscape(b)) continue
    a.spec.d = { mode: 'wide', w: 33 }
    b.spec.d = { mode: 'wide', w: 33, dx: 36 }
    b.pi = a.pi; b.atom = a.atom
    i++
  }
  return out
}

// In an ascii figure {.33} is one cell holding a mark that wide, for what a whole character would overstate.
const SPECK = /\{([\d.]+)\}/g

// ---- a post as items --------------------------------------------------------------------------
const paraId = (prefix, n) => `${prefix}p${n}`

function makeFig(src, n, prefix, spec) {
  const dims = {}
  const fig = { spec, dims, pos: {}, n, prefix }
  if (src.ascii) {
    fig.ascii = src.ascii; fig.caption = src.caption
    for (const k of KEYS) {
      const rows = src.ascii[k] ?? src.ascii.d
      const W = Math.max(...rows.map(r => r.replace(SPECK, ' ').length)), H = rows.length
      const cap = spec[k].nocap || !src.caption ? [] : wrapWords(`Fig. ${n}. ${src.caption}`, Math.max(W, 30))
      dims[k] = { W, H, cap, total: H + cap.length + (cap.length ? 1 : 0) }
    }
  } else {
    fig.img = src
    for (const k of KEYS) {
      const L = LAYOUTS[k]
      const s = spec[k]
      const target = s.mode === 'bleed' ? L.sheet : s.mode === 'full' ? L.fw : Math.min(s.w ?? L.w, L.w)
      const f = fitCells(src.w, src.h, target, s.maxH ?? L.page - L.head - L.foot - 5)
      worstSlack = Math.max(worstSlack, f.slack)
      const label = `Fig. ${n} (${f.W}x${f.H}). ${src.alt}`
      const cap = s.nocap ? [] : wrapWords(label, s.mode === 'bleed' ? L.fw : Math.max(f.W, 24))
      dims[k] = { W: f.W, H: f.H, cap, total: f.H + cap.length }
    }
  }
  return fig
}

function postItems(post, { prefix = '', figStart = 1, numberParas = true } = {}) {
  const hand = readPlacements(post.id)
  const paras = []
  const items = []
  let n = 0
  for (const b of post.blocks) {
    const atoms = atomize(b.kind === 'pre' ? b.html : b.html)
    const it = { t: 'para', kind: b.kind, atoms, toks: tokenize(atoms), pos: {}, figs: [], opts: {} }
    if (b.kind === 'p') {
      it.n = ++n
      it.id = paraId(prefix, n)
      const txt = plain(b.html)
      const lead = txt.match(/^(- |▸ |→ |\d\. )/)
      if (lead) { it.hang = lead[1].length; it.list = true }
      paras.push(it)
    } else if (b.kind === 'heading') {
      it.id = `${prefix}h${items.length}`; it.need = 4; it.heading = plain(b.html); it.gapBefore = 2
    } else {
      it.id = `${prefix}x${items.length}`; it.hang = 4
    }
    items.push(it)
  }
  paras.forEach((p, i) => { if (p.list && paras[i - 1]?.list) p.tight = true })

  const figs = []
  let count = figStart
  const addFig = (para, atom, src, spec) => {
    const fig = makeFig(src, src.ascii && !src.caption ? 0 : count, prefix, spec)
    if (!(src.ascii && !src.caption)) count++
    const tok = para.toks.filter(t => t.s < atom).at(-1)
    fig.tok = tok ? tok.id : -1
    fig.anchor = `${para.id}:${fig.tok}`
    fig.para = para
    para.figs.push(fig)
    figs.push(fig)
  }
  if (hand) {
    for (const f of hand.figs) {
      const p = paras.find(p => findAnchor(p.atoms, f.before, f.after) !== null)
      if (!p) throw new Error(`${post.id}: placement text not found: ${f.before} [[…]] ${f.after}`)
      const ref = parseRef(f.ref)
      const atom = findAnchor(p.atoms, f.before, f.after)
      const img = post.images.find(i => i.src.endsWith(`/${ref.name}.webp`))
      const asc = hand.ascii[ref.name]
      if (!img && !asc) throw new Error(`${post.id}: unknown figure ${ref.name}`)
      if (!ref.m.mode) ref.m = { mode: 'wide', w: 37, ...ref.m }
      const caption = asc?.caption
      addFig(p, atom, img ?? { ascii: asc, caption: asc.d?.[0]?.startsWith('%') ? null : caption }, ref)
    }
    for (const o of hand.opts) {
      const p = paras[o.n - 1]
      for (const k of KEYS) if (!o.k || o.k === k) (p.opts[k] ??= {})[o.key] = o.val
    }
    for (const ph of hand.index) {
      for (const p of paras) {
        const text = p.atoms.map(a => a.ch).join('')
        const at = text.indexOf(ph)
        if (at < 0) continue
        p.atoms[at].pre += '<b>'
        p.atoms[at + [...ph].length - 1].post = '</b>' + p.atoms[at + [...ph].length - 1].post
        ;(p.marks ??= []).push(ph)
        break
      }
    }
  } else {
    for (const a of autoFigs(post, paras)) addFig(paras[a.pi], a.atom, a.img, a.spec)
  }
  const index = hand ? hand.index.map(ph => ({ ph, para: paras.find(p => p.marks?.includes(ph)) })).filter(e => e.para) : []
  return { items, figs, paras, index, nextFig: count }
}

// ---- rows ------------------------------------------------------------------------------------
const row = (left, right, W) => left + sp(W - vis(left) - vis(right)) + right
const center = (h, W) => sp(Math.floor((W - vis(h)) / 2)) + h
function leader(left, right, W, x) {           // dots land on even sheet columns, so they align
  const a = vis(left), b = vis(right)
  let s = ''
  for (let c = a; c < W - b; c++) {
    const near = c === a || c >= W - b - 1
    s += !near && (c + x) % 2 === 0 ? '.' : ' '
  }
  return left + s + right
}
const link = (href, text) => `<a href="${attr(href)}">${text}</a>`
const tocLink = (href, text) => `<a class="toc" href="${attr(href)}">${text}</a>`   // the dots are already a rule

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const parts = d => { const [y, m, day] = d.split('-').map(Number); return { y, m: m - 1, day } }
const mon = i => MONTHS[i].slice(0, 3)
const dateLong = p => { const { y, m, day } = parts(p.date); return p.dateApprox ? `c. ${mon(m)} ${y}` : `${day} ${MONTHS[m]} ${y}` }
const dateShort = p => { const { y, m, day } = parts(p.date); return p.dateApprox ? `c. ${mon(m)} ${y}` : `${day} ${mon(m)} ${y}` }
const headDate = p => { const { y, m } = parts(p.date); return `${p.dateApprox ? 'c. ' : ''}${mon(m)} ${y}` }
function rangeOf(project) {
  const ps = project.posts.map(id => byId[id])
  const hi = ps[0], lo = ps.at(-1)
  const a = parts(lo.date), b = parts(hi.date)
  if (ps.length === 1) return dateShort(hi)
  if (ps.some(p => p.dateApprox)) return `c. ${a.m === b.m ? '' : mon(a.m) + '-'}${mon(b.m)} ${b.y}`
  if (a.m === b.m) return `${a.day}-${b.day} ${mon(b.m)} ${b.y}`
  return `${a.day} ${mon(a.m)}-${b.day} ${mon(b.m)} ${b.y}`
}

const byId = Object.fromEntries(data.posts.map(p => [p.id, p]))
const projectOf = Object.fromEntries(data.projects.map(p => [p.id, p]))
// "The Commons · 2 of 4": where a post sits in its project. The only count left on the site.
const marker = (post, up = '') => {
  const proj = projectOf[post.project]
  return link(`${up}projects/${proj.id}.html`, esc(`${proj.title} · ${proj.posts.length - proj.posts.indexOf(post.id)} of ${proj.posts.length}`))
}

// ---- emit ------------------------------------------------------------------------------------
const cellStyle = (pos, keys = ['x', 'y']) => KEYS.map(k => keys.map(n => pos[k] && pos[k][n] !== undefined ? `--${k}${n}:${pos[k][n]}` : '').filter(Boolean).join(';')).filter(Boolean).join(';')

function emitPara(it) {
  let body = ''
  const trim = it.atoms.map(() => '')            // spaces that end a line hang off the sheet: hide them there
  for (const k of KEYS) for (const [i, s] of Object.entries(it.pos[k].ins))
    if (s.includes(`<br class="${k}">`)) for (let j = i - 1; j >= 0 && it.atoms[j].ch === ' '; j--) trim[j] += ' t' + k
  it.atoms.forEach((a, i) => {
    for (const k of KEYS) if (it.pos[k].ins[i]) body += it.pos[k].ins[i]
    body += a.pre + (trim[i] ? `<span class="${trim[i].trim()}">${a.raw}</span>` : a.raw) + a.post
  })
  const style = `${cellStyle(it.pos)};--dnx:${it.pos.d.nx};--mnx:${it.pos.m.nx}`
  if (it.kind === 'heading') return `<h2 class="at p hd" id="${it.id}" style="${style}">${body}</h2>`
  if (it.kind === 'pre') return `<pre class="at p" style="${style}">${body}</pre>`
  const num = `<a class="n" href="#${it.id}" aria-label="Link to paragraph ${it.n}">${it.n}</a>`
  return `<p class="at p" id="${it.id}" style="${style}">${num}${body}</p>`
}

function emitFig(fig, up, returnTo) {
  const id = `${fig.prefix}f${fig.n}`
  const pos = {}
  for (const k of KEYS) pos[k] = { ...fig.pos[k], w: fig.pos[k].W, h: fig.pos[k].H }
  const style = cellStyle(pos, ['x', 'y', 'w', 'h'])
  const caps = KEYS.map(k => fig.dims[k].cap.length ? `<span class="${k}">${fig.dims[k].cap.map(esc).join('<br>')}</span>` : '').join('')
  const cap = caps ? `<figcaption>${caps}</figcaption>` : ''
  if (fig.ascii) {
    const ink = r => esc(r).replace(/━+/g, '<b>$&</b>').replace(SPECK, '<i class="speck" style="--v:$1"> </i>')
    const pres = KEYS.map(k => `<pre class="${k}">${(fig.ascii[k] ?? fig.ascii.d).map(ink).join('\n')}</pre>`).join('')
    return `<figure class="at fig asc" aria-hidden="true" style="${style}">${pres}${cap}</figure>`
  }
  const lazy = fig.first ? '' : ' loading="lazy"'
  const src = up + fig.img.src
  const img = `<img src="${attr(src)}" width="${fig.img.w}" height="${fig.img.h}" alt="${attr(fig.img.alt)}"${lazy} decoding="async">`
  const plate = `<div class="plate" id="${id}"><a class="shut" href="#${returnTo}">[close]</a><img src="${attr(src)}" width="${fig.img.w}" height="${fig.img.h}" alt="${attr(fig.img.alt)}" loading="lazy"><p>Fig. ${fig.n}. ${esc(fig.img.alt)}  ${fig.img.w}x${fig.img.h}</p></div>`
  return { html: `<figure class="at fig" style="${style}"><a class="pic" href="#${id}" aria-label="Open figure ${fig.n} at full size">${img}</a>${cap}</figure>`, plate }
}

function furniture(flows, foot) {
  let out = ''
  for (const k of KEYS) {
    const F = flows[k], L = F.L
    for (let p = 0; p < F.pages; p++) {
      const top = p * F.pitch
      out += `<div class="sheet ${k}" style="--y:${top};--n:${L.page}"></div>`
      if (p > 0) out += `<div class="ln ${k}" style="--x:${L.fx};--y:${top + 1}">${foot.head(k, L.fw, p + 1)}</div>`
      out += `<div class="ln ${k}" style="--x:${L.fx};--y:${top + L.page - 2}">${foot.foot(k, L.fw, p + 1)}</div>`
      if (p < F.pages - 1) out += `<div class="ln ff ${k}" style="--x:${L.fx};--y:${top + L.page}">^L</div>`
    }
  }
  return `<div class="furn" aria-hidden="true">${out}</div>`
}

function emitItems(items, up) {
  let html = '', plates = ''
  for (const it of items) {
    if (it.t === 'para') {
      html += emitPara(it)
      for (const fig of it.figs) {
        const r = emitFig(fig, up, it.id)
        if (typeof r === 'string') html += r
        else { html += r.html; plates += r.plate }
      }
    } else if (it.t === 'rows') {
      let inner = ''
      for (const k of KEYS) for (const r of it.pos[k]) inner += `<div class="ln ${k}${it.cls ? ' ' + it.cls : ''}" style="--x:${r.x};--y:${r.y}">${r.html}</div>`
      html += it.tag ? `<${it.tag} class="wrap"${it.id ? ` id="${it.id}"` : ''}>${inner}</${it.tag}>` : inner
    } else if (it.t === 'entry') {
      let inner = ''
      for (const k of KEYS) {
        for (const r of it.pos[k].rows) inner += `<div class="ln ${k}" style="--x:${r.x};--y:${r.y}">${r.html}</div>`
      }
      const f = it.preview
      if (f) {
        const pos = {}
        for (const k of KEYS) { const p = it.pos[k].fig; pos[k] = { x: p.x, y: p.y, w: p.W, h: p.H } }
        html += `<article class="wrap" id="${it.id}">${inner}<a class="at fig pic" href="${attr(it.href)}" style="${cellStyle(pos, ['x', 'y', 'w', 'h'])}"><img src="${attr(up + f.src)}" width="${f.w}" height="${f.h}" alt="${attr(f.alt)}" loading="lazy" decoding="async"></a></article>`
      } else html += `<article class="wrap" id="${it.id}">${inner}</article>`
    }
  }
  return { html, plates }
}

function page({ title, desc, up, cssUp, canonicalImg, flows, items, foot, ogType = 'article', rail = '' }) {
  const { html, plates } = emitItems(items, up)
  const heights = `--dT:${flows.d.total};--mT:${flows.m.total}`
  const fullImg = canonicalImg ? (SITE && !canonicalImg.startsWith('http') ? `${SITE}/${canonicalImg.replace(/^(\.\.\/)+/, '')}` : canonicalImg) : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}">
<meta name="theme-color" content="#f4f5f2">
<meta name="author" content="${attr(AUTHOR)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${attr(NAME)}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
${fullImg ? `<meta property="og:image" content="${attr(fullImg)}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
<link rel="stylesheet" href="${cssUp}style.css">
</head>
<body>
<main class="book" style="${heights}">
${furniture(flows, foot)}
${html}
</main>
${plates}
${rail ? `<div class="series" id="series">${snapRail(rail)}</div>\n` : ''}</body>
</html>
`
}

// Dashes are whole cells long: 6 cells is the longest, 1 the shortest.
const snapRail = h => h.replace(/--rail-w:([\d.]+)/g, (_, v) => `--rail-w:${(Math.max(1, Math.round(v * 6)) / 6).toFixed(3)}`)

const write = (rel, s) => { const f = join(here, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s) }

// ---- front and end matter ---------------------------------------------------------------------

function titleRows(text, sub) {
  const build = k => {
    const W = LAYOUTS[k].fw
    const out = wrapWords(text, W - 4).map(l => center(`<b>${esc(l)}</b>`, W))
    if (sub) for (const l of wrapWords(sub, W - 4)) out.push(center(esc(l), W))
    return out
  }
  return { d: build('d'), m: build('m') }
}

function kv(label, html, k, keyW) {
  const W = LAYOUTS[k].fw
  const lab = label + sp(keyW - label.length)
  const inline = vis(html) + keyW <= W
  return inline ? [lab + html] : [label, sp(2) + html]
}

function references(post) {
  if (!post.links.length) return null
  return k => {
    const L = LAYOUTS[k]
    const rows = []
    post.links.forEach((u, i) => {
      const tag = `[${i + 1}]`
      const lines = []
      for (let s = u; s.length; ) { const take = Math.min(L.w - 4, s.length); lines.push(s.slice(0, take)); s = s.slice(take) }
      lines.forEach((l, j) => rows.push((j === 0 ? tag + sp(4 - tag.length) : sp(4)) + `<a href="${attr(u)}">${esc(l)}</a>`))
    })
    return rows
  }
}

function neighbours(post) {
  if (post.project) {
    const list = projectOf[post.project].posts
    const i = list.indexOf(post.id)
    return { older: byId[list[i + 1]], newer: byId[list[i - 1]] }
  }
  const i = data.posts.indexOf(post)
  return { older: data.posts[i + 1], newer: data.posts[i - 1] }
}

function endMatter(post, up, base) {
  const { older, newer } = neighbours(post)
  const proj = post.project && projectOf[post.project]
  const rows = k => {
    const keyW = k === 'd' ? 13 : 13
    const out = []
    if (older) out.push(...kv('Follows:', link(`${older.id}.html`, esc(older.label)), k, keyW))
    if (newer) out.push(...kv('Followed by:', link(`${newer.id}.html`, esc(newer.label)), k, keyW))
    if (proj) out.push(...kv('Part of:', link(`../projects/${proj.id}.html`, esc(proj.title)), k, keyW))
    out.push(...kv('All posts:', link('../index.html', esc(NAME)), k, keyW))
    return out
  }
  return { t: 'rows', rows, pos: {}, keep: true, gap: 2, tag: 'nav' }
}

function numbersIndex(index, base = '') {
  if (!index.length) return []
  const head = { t: 'rows', rows: { d: ['<b>Index</b>'], m: ['<b>Index</b>'] }, pos: {}, gap: 2, need: 3, tag: 'h2' }
  const body = { t: 'rows', pos: {}, gap: 1, tag: 'div', rows: Object.fromEntries(KEYS.map(k => {
    const L = LAYOUTS[k]
    return [k, index.map(e => sp(L.x - L.fx) + tocLink(`#${e.para.id}`, leader(esc(e.ph), String(e.para.n), L.w, L.x)))]
  })) }
  return [head, body]
}

// ---- pages -------------------------------------------------------------------------------------
function runningFor(post) {
  return {
    head: (k, W) => {
      const label = esc(post.label), date = headDate(post)
      return vis(label) + vis(date) + 2 <= W ? row(label, date, W) : label
    },
    foot: (k, W) => {
      return row(esc(NAME), post.kind, W)
    },
  }
}

function buildPost(post) {
  const proj = post.project && projectOf[post.project]
  const { items, figs, index } = postItems(post)
  if (figs[0]) figs[0].first = true
  const front = {
    t: 'rows', pos: {}, gap: 0, tag: 'header',
    rows: k => {
      const W = LAYOUTS[k].fw
      const home = link('../index.html', esc(NAME))
      const mk = proj ? marker(post, '../') : ''
      if (k === 'd') return [row(`Kind: ${post.kind}`, home, W), row(mk, dateLong(post), W)]
      if (!proj) return [row(home, dateShort(post), W), post.kind]
      return [row(home, dateShort(post), W), ...(vis(mk) + post.kind.length + 2 <= W ? [row(mk, post.kind, W)] : [mk, post.kind])]
    },
  }
  const title = { t: 'rows', pos: {}, gap: 2, tag: 'h1', rows: titleRows(post.label) }
  const heads = items.filter(i => i.kind === 'heading')
  const toc = []
  if (heads.length > 1) {
    // the figure at the end of each line is the number of the paragraph that follows the heading
    heads.forEach(h => { h.pn = items.slice(items.indexOf(h)).find(i => i.n)?.n ?? '' })
    toc.push({ t: 'rows', pos: {}, gap: 2, rows: { d: ['Table of Contents'], m: ['Table of Contents'] }, cls: 'tochead', need: 4 })
    toc.push({ t: 'rows', pos: {}, gap: 1, tag: 'nav', keep: true, rows: k => {
      const L = LAYOUTS[k]
      return heads.map((h, i) => sp(L.x - L.fx) + tocLink(`#${h.id}`, leader(`${i + 1}. ${esc(h.heading.replace(/━/g, '').trim())}`, String(h.pn), L.w, L.x)))
    } })
  }
  const refs = references(post)
  const tail = []
  if (index.length) tail.push(...numbersIndex(index))
  if (refs) {
    tail.push({ t: 'rows', pos: {}, gap: 2, need: 3, tag: 'h2', rows: { d: ['<b>References</b>'], m: ['<b>References</b>'] } })
    tail.push({ t: 'rows', pos: {}, gap: 1, rows: k => refs(k).map(r => sp(LAYOUTS[k].x - LAYOUTS[k].fx) + r) })
  }
  tail.push(endMatter(post))
  const all = [front, title, ...toc, ...items, { t: 'flush' }, ...tail]
  const flows = layout(all)
  const first = post.images[0]
  const ogImg = first ? `../../../${first.src}` : cardFor(post.id, post.label, post.opening, `${dateShort(post)}`)
  write(`posts/${post.id}.html`, page({
    title: `${post.label}, ${NAME}`, desc: post.opening, up: '../../../', cssUp: '../', canonicalImg: ogImg, flows, items: all, foot: runningFor(post),
    rail: railHTML(data, post),
  }))
  return { flows }
}

function cardFor(id, title, opening, date) {
  const file = `cards/${id}.png`
  const out = join(here, file)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, card({ title, opening, date, site: NAME }))
  return SITE ? `${SITE}/concepts/character-grid/${file}` : `../${file}`
}

// An entry: date, label, the first picture whole, the opening trailing off. The index and the
// project pages use the same one. `mk` is the project marker (index only); `n` flips the picture.
function entryItem(post, n, { href, mk = '' }) {
  const firstImage = post.images[0]
  return {
    t: 'entry', pos: {}, id: `e-${post.id}`, preview: firstImage, href,
    build: k => {
      const L = LAYOUTS[k]
      const gut = L.x - L.fx
      const rows = []
      const when = dateShort(post)
      const head = sp(gut) + `<b>${link(href, esc(post.label))}</b>`
      let y = 0
      if (vis(head) + vis(when) + 2 <= L.fw) rows.push({ x: L.fx, y: y++, html: row(head, when, L.fw) })
      else { rows.push({ x: L.fx, y: y++, html: head }); rows.push({ x: L.x, y: y++, html: when }) }
      if (mk) rows.push({ x: L.x, y: y++, html: mk })
      let fig = null
      if (firstImage) {
        const r = firstImage.w / firstImage.h
        if (k === 'd') {
          const target = r >= 1.62 ? 40 : r >= 1 ? 34 : 18
          const f = fitCells(firstImage.w, firstImage.h, target)
          worstSlack = Math.max(worstSlack, f.slack)
          const flip = n % 2 === 1
          const textW = L.w - f.W - 3
          const y0 = y + 1
          fig = { x: flip ? L.x : L.x + L.w - f.W, y: y0, W: f.W, H: f.H }
          const lines = trailing(post, textW, Math.max(3, Math.min(f.H - 1, 7)), '', flip ? L.x + f.W + 3 : L.x)
          lines.forEach((html, i) => rows.push({ x: flip ? L.x + f.W + 3 : L.x, y: y0 + i, html }))
          y = y0 + f.H
        } else {
          const f = fitCells(firstImage.w, firstImage.h, r >= 1 ? 37 : 22)
          worstSlack = Math.max(worstSlack, f.slack)
          fig = { x: L.x, y: y + 1, W: f.W, H: f.H }
          y = y + 1 + f.H + 1
          const lines = trailing(post, L.w, 3, '', L.x)
          lines.forEach((html, i) => rows.push({ x: L.x, y: y + i, html }))
          y += lines.length
        }
      } else {
        y += 1
        const lines = trailing(post, L.w, 3, '', L.x)
        lines.forEach((html, i) => rows.push({ x: L.x, y: y + i, html }))
        y += lines.length
      }
      return { rows, fig, h: y }
    },
  }
}

function trailing(post, W, lines, tail, x) {     // the opening runs into a dot leader and trails off
  const text = post.blocks.filter(b => b.kind === 'p').map(b => plain(b.html)).join(' ').replace(/\s+/g, ' ')
  const out = wrapWords(text, W).slice(0, lines)
  const room = W - vis(tail) - 4
  const last = wrapWords(out.pop() ?? '', room)[0] ?? ''
  return [...out.map(esc), leader(esc(last), tail, W, x)]
}

function buildProject(project) {
  const posts = [...project.posts].reverse().map(id => byId[id])  // oldest first
  const range = rangeOf(project)
  const front = {
    t: 'rows', pos: {}, gap: 0, tag: 'header',
    rows: k => {
      const W = LAYOUTS[k].fw
      const home = link('../index.html', esc(NAME))
      return k === 'd' ? [row('Kind: project', home, W), range] : [row(home, range, W), 'project']
    },
  }
  const title = { t: 'rows', pos: {}, gap: 2, tag: 'h1', rows: titleRows(project.title, project.line) }
  const entries = posts.map((p, i) => entryItem(p, i, { href: `../posts/${p.id}.html` }))
  const back = { t: 'rows', pos: {}, gap: 2, keep: true, tag: 'nav', rows: k => kv('All posts:', link('../index.html', esc(NAME)), k, 13) }
  const all = [front, title, ...entries, back]
  const flows = layout(all)
  const pick = posts.flatMap(p => p.images)[0]
  const ogImg = pick ? `../../../${pick.src}` : cardFor(`project-${project.id}`, project.title, project.line || posts[0].opening, range)
  write(`projects/${project.id}.html`, page({
    title: `${project.title}, ${NAME}`, desc: project.line ? `${project.title}: ${project.line}` : `${project.title}, ${range}`,
    up: '../../../', cssUp: '../', canonicalImg: ogImg, flows, items: all,
    foot: runningFor({ label: project.title, date: byId[project.posts[0]].date, dateApprox: byId[project.posts[0]].dateApprox, kind: 'project' }),
  }))
}

// The index is the posts themselves, newest first, one entry each. A post that belongs to a project
// carries a quiet marker; nothing is grouped.
function buildIndex() {
  const items = []
  items.push({
    t: 'rows', pos: {}, gap: 0, tag: 'header',
    rows: k => [row('Index', `Updated: ${dateShort(data.posts[0])}`, LAYOUTS[k].fw)],
  })
  items.push({ t: 'rows', pos: {}, gap: 2, tag: 'h1', rows: titleRows(NAME) })
  data.posts.forEach((post, n) => items.push(entryItem(post, n, { href: `posts/${post.id}.html`, mk: post.project ? marker(post) : '' })))
  const flows = layout(items)
  const foot = {
    head: (k, W) => row(esc(NAME), 'Index', W),
    foot: (k, W) => center(esc(NAME), W),
  }
  const lead = data.posts.find(p => p.images.length).images[0]
  write('index.html', page({
    title: NAME, desc: `${NAME}. Latest: ${data.posts[0].label}.`, up: '../../', cssUp: '', canonicalImg: `../../${lead.src}`, flows, items, foot, ogType: 'website',
  }))
}

// ---- run ----------------------------------------------------------------------------------------
for (const post of data.posts) buildPost(post)
for (const project of data.projects) buildProject(project)
buildIndex()

// The stylesheet is the shared rail's base CSS followed by this concept's own, which restyles it.
write('style.css', RAIL_CSS.trim() + '\n\n' + readFileSync(join(here, 'style.src.css'), 'utf8'))
console.log(`built ${data.posts.length} posts, ${data.projects.length} projects. most paper under a picture ${worstSlack.toFixed(2)} of a line`)
