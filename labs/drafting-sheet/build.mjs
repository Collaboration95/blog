#!/usr/bin/env node
// drafting-sheet: every post is a sheet of a drawing set. Zero dependencies.
//   node build.mjs                 relative og:image paths
//   SITE_URL=https://x.y/z node build.mjs    absolute og:image paths
// Placement lives in sheets/<post-id>.txt (grammar in DESIGN.md). No file = auto placement.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const data = JSON.parse(readFileSync(join(root, 'content/posts.json'), 'utf8'))
const SITE = (process.env.SITE_URL ?? '').replace(/\/$/, '')
const CONCEPT = 'concepts/drafting-sheet/'

const { posts, projects, author } = data
const byId = Object.fromEntries(posts.map(p => [p.id, p]))
const total = posts.length
const sheetNo = Object.fromEntries(posts.map((p, i) => [p.id, total - i]))   // oldest is sheet 1, so numbers never move
const pad = n => String(n).padStart(2, '0')

// ---------------------------------------------------------------- small helpers
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const strip = h => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
const ymd = d => d.split('-').map(Number)
const fmtDate = (d, approx) => {
  const [y, m, day] = ymd(d)
  return approx ? `c. ${MONTHS[m - 1]} ${y}` : `${day} ${MONTHS[m - 1]} ${y}`
}
const fmtPost = p => fmtDate(p.date, p.dateApprox)
const fmtRange = (a, b) => {           // a = oldest post, b = newest post
  if (a.id === b.id) return fmtPost(a)
  const [ya, ma, da] = ymd(a.date); const [yb, mb, db] = ymd(b.date)
  if (a.dateApprox || b.dateApprox) return `${fmtPost(a)} – ${fmtPost(b)}`
  if (ya === yb && ma === mb) return da === db ? fmtPost(b) : `${da}–${db} ${MONTHS[mb - 1]} ${yb}`
  if (ya === yb) return `${da} ${MONTHS[ma - 1]} – ${db} ${MONTHS[mb - 1]} ${yb}`
  return `${fmtPost(a)} – ${fmtPost(b)}`
}
const revLetter = i => 'ABCDEFGHJKLMNPRTUVWY'[i]          // A–Y minus I, O, Q, S, X, Z: ASME Y14.35
const projectOf = p => projects.find(x => x.id === p.project)
const chrono = pr => [...pr.posts].reverse().map(id => byId[id])
const figsOf = p => p.images.length
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

// Keep the end of a run together so no line is left holding one word or a lone " .". Same characters,
// fewer break points. Only spaces outside any element count, a figure placeholder ends the search,
// and anything too long to stay on a narrow line is left free to wrap.
const WORD = /[\p{L}\p{N}]/u
const HELD = /[\uE100-\uE9FF]/
function tie(raw, cap = 28) {
  const html = raw.replace(/-&gt;/g, '<span class="nb">-&gt;</span>')     // "->" must not split at its hyphen
  const end = html.length - html.match(/(?:[\uE100-\uE9FF]|\s)*$/)[0].length
  const body = html.slice(0, end)
  const gaps = []; let depth = 0
  for (const m of body.matchAll(/<\/?[a-z][^>]*>|\s+|[\uE100-\uE9FF]/gi)) {
    if (m[0][0] === '<') depth += m[0][1] === '/' ? -1 : 1
    else if (!depth) gaps.push({ at: m.index, to: m.index + m[0].length, held: HELD.test(m[0]) })
  }
  let start = -1; let right = end; let found = 0
  for (const g of gaps.reverse()) {                 // two words, plus any bare "(" or "->" that opens them
    const word = WORD.test(strip(body.slice(g.to, right)))
    if (g.held || (found === 2 && word) || strip(body.slice(g.to, end)).length > cap) break
    if (word) found++
    start = g.to; right = g.at
  }
  return start < 0 ? html : `${html.slice(0, start)}<span class="nb">${html.slice(start, end)}</span>${html.slice(end)}`
}
const TIE_TITLE = 18      // wide letters in narrow boxes

// ---------------------------------------------------------------- quantities in running text
const UNIT = '(?:seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|tokens|cents|times)'
const MAG = '(?:\\s?(?:million|billion|[kKMB]\\b))'
const NUM = '\\d[\\d,]*(?:\\.\\d+)?'
const QTY = new RegExp(
  `[$€£]${NUM}${MAG}?` +                                       // $2.79
  `|(?<![\\w.:#-])${NUM}x\\b` +                                // 163x
  `|(?<![\\w.:#-])${NUM}%` +                                   // 96%
  `|(?<![\\w.:#-])${NUM}\\s?(?:MB|GB|TB|KB|ms)\\b` +           // 600MB
  `|(?<![\\w.:#-])${NUM}\\s(?:million|billion)(?:\\s${UNIT})?` + // 1.35 million times
  `|(?<![\\w.:#-])${NUM}\\s${UNIT}\\b(?:\\s${NUM}\\s${UNIT}\\b)?`, 'g') // 2 hours 47 minutes
function dimensionNumbers(html) {
  let inA = 0
  return html.split(/(<[^>]+>)/).map(seg => {
    if (seg.startsWith('<')) { if (/^<a\b/.test(seg)) inA++; if (/^<\/a/.test(seg)) inA--; return seg }
    return inA ? seg : seg.replace(QTY, m => `<span class="q">${m}</span>`)
  }).join('')
}

// ---------------------------------------------------------------- sheets/*.txt grammar
function tokens(line) {
  const out = []; const re = /"([^"]*)"|(\S+)/g; let m
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? { q: m[1] } : m[2])
  return out
}
function parseSheet(id) {
  const f = join(here, 'sheets', `${id}.txt`)
  if (!existsSync(f)) return null
  return readFileSync(f, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(tokens)
}
const q = t => { if (!t || t.q === undefined) throw new Error(`expected a "phrase", got ${JSON.stringify(t)}`); return t.q }
const named = (toks, key) => { const i = toks.indexOf(key); return i < 0 ? undefined : toks[i + 1] }

// ---------------------------------------------------------------- figures
const SIZES = { mid: 624, wide: 984, side: 420 }
// Every number is the image's own w or h. 1600 is the resize limit, not a measurement, so it says so,
// and a dimension equal to the one before it on the sheet is written EQ, as a drafter would.
const CAP = 1600
function dimmer() {
  let w; let h
  const say = (v, prev) => (v === prev ? 'EQ' : v === CAP ? `${v} px MAX` : `${v} px`)
  return img => { const out = { w: say(img.w, w), h: say(img.h, h) }; w = img.w; h = img.h; return out }
}
function figHTML(img, n, o, dots) {
  const r = (img.h / img.w).toFixed(4)
  const cls = ['fig', o.size, img.h > img.w * 1.05 ? 'tall' : ''].filter(Boolean).join(' ')
  const lead = o.from ? ` data-from="${o.from}" data-pin="${o.pin ?? ''}"${o.enter ? ` data-enter="${o.enter}"` : ''}` : ''
  const scale = (img.w / SIZES[o.size]).toFixed(1)
  const chain = o.chains?.length ? chainHTML(o.chains) : ''
  return `<span class="${cls}" id="f${n}" style="--r:${r}"${lead}>` +
    `<span class="dw" data-l="${o.dim.w}"></span>` +
    `<span class="plate"><a href="#d${n}" aria-label="Open Fig. ${n} at full size">` +
    `<img src="${dots}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}"${n > 1 ? ' loading="lazy"' : ''} data-w="${img.w}"></a>` +
    `<span class="dh" data-l="${o.dim.h}"></span></span>${chain}` +
    `<span class="cap" data-f="Fig. ${n}" data-s="1:${scale}" data-t="${esc(img.alt)}"></span></span>`
}
function chainHTML(chains) {
  const rows = Math.max(...chains.map(c => c.row))
  const wits = new Set(chains.flatMap(c => [c.l, c.r]))
  const bottom = c => c
  return `<span class="chains" style="--rows:${rows}">` +
    chains.map(c => `<span class="c ${c.side}" style="left:${c.l}%;width:${(c.r - c.l).toFixed(2)}%;top:${(c.row - 1) * 24}px" data-l="${esc(c.label)}"></span>`).join('') +
    [...wits].map(x => { const low = Math.max(...chains.filter(c => c.l === x || c.r === x).map(c => c.row)); return `<i class="wit" style="left:${x}%;--low:${low}"></i>` }).join('') +
    `</span>`
}
function detailHTML(img, n, dots) {
  const land = img.w >= img.h
  return `<div class="det${land ? ' land' : ''}" id="d${n}" role="dialog" aria-label="Fig. ${n} at full size">` +
    `<a class="det-x" href="#f${n}">Close Fig. ${n}</a>` +
    `<input type="checkbox" id="z${n}" class="zt" aria-label="Toggle 1:1"><label class="det-p" for="z${n}">` +
    `<img src="${dots}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}" loading="lazy" style="--w:${img.w}px;--h:${img.h}px"></label>` +
    `<p class="det-c" data-d="${img.w} × ${img.h} px" data-t="${esc(img.alt)}"></p></div>`
}

// ---------------------------------------------------------------- dimension rows and named drawings
const OUT_BELOW = 28   // percent of measure below which arrows go outside the witness lines, as a drafter would
function dimRows(rows, max) {
  return rows.map(([label, v]) => {
    const pct = v / max * 100
    return `<span class="d${pct < OUT_BELOW ? ' out' : ''}" style="--v:${pct.toFixed(2)}%" data-l="${esc(label)}"></span>`
  }).join('')
}
const dimsHTML = (rows, max) => `<span class="dims">${dimRows(rows, max)}</span>`

const noteOf = (postId, phrase) => {
  const i = byId[postId].blocks.findIndex(b => b.html.includes(phrase))
  if (i < 0) throw new Error(`"${phrase}" not found in ${postId}`)
  return i + 1
}

const drawings = {
  tokens: () => `<span class="dims tok">` +
    `<span class="d" style="--v:100%" data-l="300 million tokens"></span>` +
    `<span class="bar"><i class="hatch" style="width:96%"></i><i class="solid" style="left:99.33%;width:.67%"></i></span>` +
    `<span class="d" style="--v:96%" data-l="96%"></span>` +
    `<span class="d out ll" style="--v:.67%;margin-left:99.33%" data-l="2 million"></span></span>`,

  repeat: () => `<span class="rep" data-l="1.35 million times"></span>`,

  // Item balloons key this drawing to the words of the sentence above it. It carries no text of its own.
  rewrite: () => readFileSync(join(here, 'sheets/rewrite.svg'), 'utf8'),

  // 9.77 s at the same scale as the 26-minute measure, then a true 48:1 detail of the sliver.
  sliver: () => {
    const p = 9.77 / 1560 * 100
    return `<span class="dims final">` +
      `<span class="d" style="--v:100%" data-l="26 minutes"></span>` +
      `<span class="d out" style="--v:${p.toFixed(3)}%" data-l="9.77 seconds"></span></span>` +
      `<span class="detail" data-s="48:1"><span class="ring"></span>` +
      `<svg aria-hidden="true"><line x1="11" y1="0" x2="52%" y2="46%"/></svg>` +
      `<span class="lens"><span class="ld" data-l="9.77 seconds"></span><span class="lw"></span></span></span>`
  },

  petdims: () => {
    const row = (post, phrase, label, a, b = a, rev) => {
      const n = noteOf(post, phrase)
      return `<a class="pet" href="../posts/${post}.html#n${n}" data-rev="${rev}" aria-label="Rev ${rev}, note ${n}">` +
        `<span class="d${a / 180 * 100 < 40 ? ' out' : ''}" style="--v:${(a / 1.8).toFixed(2)}%${b !== a ? `;--t:${((b - a) / 1.8).toFixed(2)}%` : ''}" data-l="${esc(label)}"></span></a>`
    }
    return `<div class="pets">` +
      row('commons-best-use-of-tech', 'About a minute later', 'About a minute later', 60, 60, 'A') +
      row('commons-peoples-choice', 'about a minute later', 'about a minute later', 60, 60, 'B') +
      row('commons-agent-logs', 'about 3 minutes', 'about 3 minutes', 180, 180, 'C') +
      row('commons-agent-logs', '44 seconds', '44 seconds', 44, 44, 'C') +
      row('commons-claude-switch', '13 to 16 seconds', '13 to 16 seconds', 13, 16, 'D') +
      `</div>`
  },
}

// ---------------------------------------------------------------- automatic placement
const STOP = new Set('with from that this them they then have were been into onto over about their there which while slide screen shot photo selfie after front large behind'.split(' '))
const words = s => (s.toLowerCase().match(/[a-z0-9$#.]{4,}/g) ?? []).map(w => w.replace(/\.+$/, '')).filter(w => !STOP.has(w))

// Sentence ends in a block, as offsets into its html, skipping tags and links.
function sentenceEnds(html) {
  const ends = []; let off = 0; let inA = 0
  for (const seg of html.split(/(<[^>]+>)/)) {
    if (seg.startsWith('<')) { if (/^<a\b/.test(seg)) inA++; if (/^<\/a/.test(seg)) inA--; off += seg.length; continue }
    if (!inA) for (const m of seg.matchAll(/[.!?)]\s+(?=\S)/g)) ends.push(off + m.index + m[0].trimEnd().length)
    off += seg.length
  }
  return ends
}
function autoPlace(post) {
  const n = post.images.length
  if (!n) return []
  const cands = []; let seen = 0
  const totalW = post.blocks.reduce((s, b) => s + strip(b.html).split(/\s+/).length, 0)
  post.blocks.forEach((b, i) => {
    if (b.kind !== 'p') return
    let last = 0
    for (const pos of [...sentenceEnds(b.html), b.html.length]) {
      const piece = strip(b.html.slice(last, pos))
      const w = piece.split(/\s+/).filter(Boolean).length
      seen += w
      // never inside the headline block; a paragraph-final slot is allowed but mid-paragraph is preferred
      if (i > 0) cands.push({ i, pos, seen, piece, html: b.html.slice(last, pos), mid: pos < b.html.length })
      last = pos
    }
  })
  if (!cands.length) cands.push({ i: 0, pos: post.blocks[0].html.length, seen: 1, piece: '', html: '', mid: false })
  const picks = []; let from = 0
  post.images.forEach((img, k) => {
    const target = totalW * (k + .6) / (n + .1)
    const altW = new Set(words(img.alt))
    let best = null; let bestScore = -Infinity
    for (let c = from; c <= cands.length - (n - k); c++) {
      const cd = cands[c]
      const shared = words(cd.piece).filter(w => altW.has(w)).length
      const score = shared * .35 - Math.abs(cd.seen - target) / totalW * 3 + (cd.mid ? .25 : 0)
      if (score > bestScore) { bestScore = score; best = c }
    }
    if (best === null) best = Math.min(from, cands.length - 1)
    const cd = cands[best]; from = best + 1
    // the leader starts from a word the caption shares with the sentence, else the sentence's last three words
    const hit = cd.piece.match(/\S+/g)?.find(w => w.length > 3 && altW.has(w.toLowerCase().replace(/[^a-z0-9$#.]/g, '').replace(/\.+$/, '')))
    const plain = strip(cd.html).trim()
    const tail = plain.split(/\s+/).slice(-3).join(' ')
    let phrase = hit ?? tail
    if (!cd.html.includes(phrase)) phrase = cd.html.includes(tail) ? tail : ''
    const size = img.h > img.w * 1.05 || (n < 4 && k % 2 === 0) ? 'side' : 'mid'
    picks.push({ img: k, i: cd.i, pos: cd.pos, size, phrase })
  })
  return picks
}

// ---------------------------------------------------------------- block rendering
function renderBlocks(post, dots) {
  const blocks = post.blocks.map(b => ({ ...b, cls: [], pre: '', post: '' }))
  const hold = []                                 // placeholders so number-marking never sees inserted markup
  const put = s => { hold.push(s); return String.fromCharCode(0xE100 + hold.length - 1) }
  const figs = []
  const dirs = parseSheet(post.id)
  const dim = dimmer()
  let leadId = 0

  const find = phrase => {
    const i = blocks.findIndex(b => b.html.includes(phrase))
    if (i < 0) throw new Error(`${post.id}: phrase not found: "${phrase}"`)
    return i
  }
  const wrap = (i, phrase, open, close = '</span>') => { blocks[i].html = blocks[i].html.replace(phrase, () => open + phrase + close) }
  const insertAt = (i, pos, s) => {
    let p = pos
    while (blocks[i].html.startsWith('</', p)) p = blocks[i].html.indexOf('>', p) + 1
    blocks[i].html = blocks[i].html.slice(0, p) + put(s) + blocks[i].html.slice(p)
  }
  const after = (phrase) => { const i = find(phrase); return [i, blocks[i].html.indexOf(phrase) + phrase.length] }

  // Figure numbers follow reading order, so collect first.
  const addFig = (k, i, pos, size, phrase, pin, chains = [], enter = '') => {
    const n = figs.length + 1; const id = `L${n}`
    figs.push(post.images[k])
    insertAt(i, pos, figHTML(post.images[k], n, { size, from: phrase ? id : '', pin, enter, chains, dim: dim(post.images[k]) }, dots))
    if (phrase) {
      const j = blocks.findIndex((b, x) => x === i && b.html.includes(phrase))
      const jj = j >= 0 ? j : find(phrase)
      wrap(jj, phrase, `<span class="lead" id="${id}">`)
    }
  }

  if (dirs) {
    const chains = {}
    for (const t of dirs) if (t[0] === 'chain') (chains[t[1]] ??= []).push({ label: q(t[2]), l: +t[3], r: +t[4], row: +t[5], side: t[6] ?? 'in' })
    for (const t of dirs) {
      const [cmd] = t
      if (cmd === 'fig') {
        const [i, pos] = after(q(t[3]))
        addFig(+t[1] - 1, i, pos, t[4], named(t, 'from') ? q(named(t, 'from')) : '', named(t, 'pin'), chains[t[1]], named(t, 'enter'))
      } else if (cmd === 'dims') {
        const [i, pos] = after(q(t[2]))
        const max = +t[4]; const rows = []
        for (let x = 5; x < t.length; x += 2) rows.push([q(t[x]), +t[x + 1]])
        insertAt(i, pos, dimsHTML(rows, max))
      } else if (cmd === 'draw') {
        const [i, pos] = after(q(t[2]))
        insertAt(i, pos, drawings[t[3]]())
      } else if (cmd === 'mark') {
        const phrase = q(t[2]); const i = find(phrase)
        if (t[1] === 'cloud') blocks[i].cls.push('cloud')
        else if (t[1] === 'balloon') wrap(i, phrase, `<span class="bal" data-n="${t[3]}">`)
        else wrap(i, phrase, `<span class="${t[1]}">`)
      } else if (cmd === 'group') {
        const a = find(q(t[1])); const b = find(q(t[2]))
        blocks[a].pre = `<div class="${t[3]}"${t[4] ? ` style="--x:${t[4]}"` : ''}>` + blocks[a].pre
        blocks[b].post += '</div>'
      } else if (cmd !== 'chain') throw new Error(`${post.id}: unknown directive ${cmd}`)
    }
    if (figs.length !== post.images.length) throw new Error(`${post.id}: placed ${figs.length} of ${post.images.length} images`)
  } else {
    const picks = autoPlace(post)
    // insert back to front so offsets stay valid; number by reading order
    picks.forEach((p, n) => { p.n = n; p.dim = dim(post.images[p.img]) })
    for (const p of [...picks].reverse()) {
      const n = p.n + 1
      insertAt(p.i, p.pos, figHTML(post.images[p.img], n, { size: p.size, from: p.phrase ? `L${n}` : '', pin: '', dim: p.dim }, dots))
      if (p.phrase) {
        const h = blocks[p.i].html; const end = h.indexOf(String.fromCharCode(0xE100 + hold.length - 1))
        const at = h.lastIndexOf(p.phrase, end)
        if (at >= 0) blocks[p.i].html = h.slice(0, at) + `<span class="lead" id="L${n}">${p.phrase}</span>` + h.slice(at + p.phrase.length)
      }
    }
    for (const p of picks) figs.push(post.images[p.img])
  }

  const firstWords = strip(blocks[0].html).split(/\s+/).length
  const html = blocks.map((b, i) => {
    const n = i + 1
    const pn = `<a class="n" href="#n${n}" data-n="${n}" aria-label="Link to note ${n}"></a>`
    const cls = [...b.cls]
    const restore = h => h.replace(/[\uE100-\uE9FF]/g, c => hold[c.charCodeAt(0) - 0xE100])
    let inner
    if (b.kind === 'pre') inner = restore(b.html)
    else if (i === 0 && b.kind === 'p') {
      // the post's own first sentence is the headline, inside the same paragraph.
      // A break only counts if real words follow it: " ." after a bracket stays with the headline.
      const ends = sentenceEnds(b.html).filter(e => WORD.test(strip(b.html.slice(e))))
      if (firstWords > 16 && ends.length && !HELD.test(b.html)) {
        const cut = ends[0]
        inner = `<span class="hl">${tie(dimensionNumbers(b.html.slice(0, cut)), TIE_TITLE)}</span>${tie(dimensionNumbers(b.html.slice(cut)))}`
        cls.push('lede')
      } else {
        inner = restore(tie(dimensionNumbers(b.html), TIE_TITLE))
        cls.push('hl')
      }
    } else inner = restore(tie(dimensionNumbers(b.html), b.kind === 'heading' ? TIE_TITLE : undefined))
    const c = cls.length ? ` class="${cls.join(' ')}"` : ''
    if (b.kind === 'heading') return `${b.pre}<h2 id="n${n}"${c}>${pn}${inner}</h2>${b.post}`
    if (b.kind === 'pre') return `${b.pre}<div class="prebox" id="n${n}">${pn}<pre>${inner}</pre></div>${b.post}`
    return `${b.pre}<p id="n${n}"${c}>${pn}${inner}</p>${b.post}`
  }).join('\n')
  return { html, figs }
}

// ---------------------------------------------------------------- page chrome
function head({ title, desc, dots, ogImage, ogPath, type = 'article' }) {
  const abs = p => (SITE ? `${SITE}/${p}` : `${dots}${p}`)
  const img = ogImage ? `<meta property="og:image" content="${esc(abs(ogImage.src))}">
<meta property="og:image:width" content="${ogImage.w}"><meta property="og:image:height" content="${ogImage.h}">
<meta property="og:image:alt" content="${esc(ogImage.alt)}"><meta name="twitter:card" content="summary_large_image">` : ''
  const up = dots === '../../' ? '' : '../'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${SITE && ogPath ? `<meta property="og:url" content="${SITE}/${ogPath}">` : ''}
${img}
<meta name="theme-color" content="#e8e9e3">
<link rel="stylesheet" href="${up}sheet.css">
</head>
`
}
const up = depth => (depth ? '../' : '')

function revTable(pr, currentId, depth) {
  const href = id => (depth ? '' : 'posts/') + `${id}.html`
  const prefix = depth === 'project' ? '../posts/' : ''
  return `<table class="rt"><caption>Revisions</caption><thead><tr><th>Rev</th><th>Date</th><th>Description</th></tr></thead><tbody>` +
    chrono(pr).map((p, i) => {
      const cur = p.id === currentId
      return `<tr${cur ? ' class="cur" aria-current="page"' : ''}><td><span class="tri">${revLetter(i)}</span></td><td>${fmtPost(p)}</td>` +
        `<td><a href="${prefix}${href(p.id)}">${tie(esc(p.label), 14)}</a></td></tr>`
    }).join('') + `</tbody></table>`
}

const SCRIPT = d => `<script src="${d}sheet.js" defer></script>`

function frame() { return `<div class="frame" aria-hidden="true"></div>` }

// ---------------------------------------------------------------- post page
function postPage(post) {
  const dots = '../../../'
  const { html, figs } = renderBlocks(post, dots)
  const pr = projectOf(post)
  const revs = pr ? chrono(pr) : [post]
  const revI = revs.findIndex(p => p.id === post.id)
  const rev = pr ? `${revLetter(revI)} of ${revLetter(revs.length - 1)}` : 'A'
  const idx = posts.findIndex(p => p.id === post.id)
  const newer = posts[idx - 1]; const older = posts[idx + 1]
  const projLink = pr ? `<a href="../projects/${pr.id}.html">${esc(pr.title)}</a>` : 'None'
  const single = post.blocks.length === 1
  const fold = `<header class="fold">
<a class="who" href="../index.html">${esc(author)}</a><span class="sh">Sheet ${pad(sheetNo[post.id])} of ${total}</span>
<h1>${tie(esc(post.label), TIE_TITLE)}</h1>
<span class="m"><i>Date</i>${fmtPost(post)}</span><span class="m"><i>Rev</i>${rev}</span><span class="m p"><i>Project</i>${projLink}</span>
</header>`
  const strip_ = pr ? `<aside class="strip" aria-label="Revisions">${revTable(pr, post.id, 'post')}</aside>` : ''
  const src = post.linkedin ? `<p class="src"><i>Source</i><a href="${esc(post.linkedin)}" rel="noopener">LinkedIn</a></p>` : ''
  const match = (p, dir) => p
    ? `<a class="match ${dir}" href="${p.id}.html"><span class="ml">Match line</span><span class="sh">Sheet ${pad(sheetNo[p.id])}</span><span class="lb">${tie(esc(p.label), 14)}</span></a>`
    : `<span class="match ${dir} end"><span class="ml">End of set</span></span>`
  return head({
    title: `${post.label} · ${author}`, desc: post.opening, dots, ogImage: post.images[0] ?? { src: `${CONCEPT}og/${post.id}.png`, w: 1200, h: 630, alt: post.label },
    ogPath: `${CONCEPT}posts/${post.id}.html`,
  }) + `<body class="post${single ? ' single' : ''}" id="${esc(post.id)}">
<div class="sheet">
${frame()}
${fold}
<main class="field">
<article class="text" style="--words:${post.words}">
<span class="vd" data-l="${post.words} words"></span>
${html}
${single ? '<p class="void" data-t="Remainder of sheet left blank" aria-hidden="true"></p>' : ''}
</article>
${src}
<nav class="matches" aria-label="Adjacent sheets">${match(older, 'prev')}${match(newer, 'next')}</nav>
</main>
${strip_}
</div>
${figs.map((img, i) => detailHTML(img, i + 1, dots)).join('\n')}
${SCRIPT('../')}
</body></html>
`
}

// ---------------------------------------------------------------- opening text that stops at a break line
function trail(post, n) {
  const words_ = post.blocks.filter(b => b.kind === 'p').map(b => strip(b.html)).join(' ').split(/\s+/).filter(Boolean)
  const cut = words_.length > n
  return tie(esc(words_.slice(0, n).join(' ')) + (cut ? '<span class="brk" aria-hidden="true"></span>' : ''))
}
const COVER = Object.fromEntries((parseSheet('covers') ?? []).map(t => [t[0], [t[1], +t[2]]]))
function previewOf(pr) {
  if (COVER[pr.id]) { const [pid, k] = COVER[pr.id]; return { post: byId[pid], img: byId[pid].images[k - 1] } }
  for (const id of pr.posts) if (byId[id].images.length) return { post: byId[id], img: byId[id].images[0] }
  return null
}

// ---------------------------------------------------------------- index
const INDEX_SCALE = 4
function plateAtScale(img, dots, k, href, label, d) {
  return `<a class="ip" href="${href}" aria-label="${esc(label)}" style="--pw:${img.w};--ph:${img.h};--r:${(img.h / img.w).toFixed(4)}">` +
    `<span class="dw" data-l="${d.w}"></span><span class="plate"><img src="${dots}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}"${k > 0 ? ' loading="lazy"' : ''}>` +
    `<span class="dh" data-l="${d.h}"></span></span></a>`
}
function wordPlate(post, href, n = 22) {
  const out = post.words < 60
  return `<a class="wp" href="${href}"><span class="wd${out ? ' out' : ''}" style="--words:${post.words}" data-l="${post.words} words"></span>` +
    `<span class="wt">${trail(post, n)}</span></a>`
}
function indexPage() {
  const dots = '../../'
  const seenP = new Set(); const entries = []
  for (const p of posts) {
    if (p.project) {
      if (seenP.has(p.project)) continue
      seenP.add(p.project); entries.push({ project: projectOf(p), post: p })
    } else entries.push({ post: p })
  }
  const dim = dimmer()
  const rows = entries.map((e, k) => {
    const { project: pr, post: p } = e
    const href = pr ? `projects/${pr.id}.html` : `posts/${p.id}.html`
    const list = pr ? chrono(pr) : [p]
    const a = sheetNo[list[0].id]; const b = sheetNo[list[list.length - 1].id]
    const nos = list.length === 1 ? pad(a) : list.map(x => sheetNo[x.id]).join(' ') === Array.from({ length: list.length }, (_, i) => a + i).join(' ') ? `${pad(a)}–${pad(b)}` : `${pad(a)}…${pad(b)}`
    const title = pr ? pr.title : p.label
    const meta = pr
      ? `<span>${plural(list.length, 'rev')}</span><span>${fmtRange(list[0], list[list.length - 1])}</span>`
      : `<span>${fmtPost(p)}</span>`
    const prev = pr ? previewOf(pr) : (p.images[0] ? { post: p, img: p.images[0] } : null)
    const main = prev
      ? plateAtScale(prev.img, dots, k, href, title, dim(prev.img)) + `<p class="op">${trail(p, 30)}</p>`
      : wordPlate(p, href)
    return `<article class="e${prev ? '' : ' txt'}"><div class="eh"><span class="no">${nos}</span><h2><a href="${href}">${tie(esc(title), TIE_TITLE)}</a></h2><div class="meta">${meta}</div></div><div class="eb">${main}</div></article>`
  }).join('\n')
  const dates = posts.map(p => p.date).sort()
  return head({ title: author, desc: `${total} sheets`, dots, type: 'website', ogImage: { src: `${CONCEPT}og/index.png`, w: 1200, h: 630, alt: author } }) +
    `<body class="index"><div class="sheet">
${frame()}
<header class="fold"><h1 class="who">${esc(author)}</h1><span class="sh">${total} sheets</span><span class="m"><i>Register</i>${entries.length} entries</span></header>
<main class="field reg">${rows}</main>
</div>${SCRIPT('')}</body></html>
`
}

// ---------------------------------------------------------------- project page
// On the phone a revision's figures are set in runs that fill the measure at one height, so nothing is cropped.
const RUNS = { 3: [1, 2], 4: [1, 3], 5: [2, 3] }
function projectPage(pr) {
  const dots = '../../../'
  const list = chrono(pr)
  const range = fmtRange(list[0], list[list.length - 1])
  const newest = list[list.length - 1]
  const prev = previewOf(pr)
  const ogImage = prev?.img ?? { src: `${CONCEPT}og/${pr.id}.png`, w: 1200, h: 630, alt: pr.title }
  const revs = list.map((p, i) => {
    // Figures in the post's reading order, so each one links to its own Fig. number.
    const plates = renderBlocks(p, dots).figs.map((img, k) =>
      `<a class="ip" href="../posts/${p.id}.html#f${k + 1}" aria-label="${esc(p.label)}, Fig. ${k + 1}" style="--pw:${img.w};--ph:${img.h};--r:${(img.h / img.w).toFixed(4)};--a:${(img.w / img.h).toFixed(4)}">` +
      `<span class="plate"><img src="${dots}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}" loading="lazy"></span></a>`)
    let at = 0
    const imgs = (RUNS[plates.length] ?? [plates.length]).map(n => `<span class="run">${plates.slice(at, at += n).join('')}</span>`).join('')
    return `<section class="rv"><div class="rh"><span class="tri">${revLetter(i)}</span><span class="no">Sheet ${pad(sheetNo[p.id])}</span><span class="dt">${fmtPost(p)}</span></div>` +
      `<h2><a href="../posts/${p.id}.html">${tie(esc(p.label), TIE_TITLE)}</a></h2>${imgs ? `<div class="ims">${imgs}</div>` : ''}<p class="op">${trail(p, 30)}</p>` +
      `<div class="rf"><span class="wd" style="--words:${p.words}" data-l="${p.words} words"></span></div></section>`
  }).join('\n')
  const hand = pr.id === 'the-commons' ? drawings.petdims() : ''
  return head({
    title: `${pr.title} · ${author}`, desc: pr.line || `${plural(list.length, 'rev')}, ${range}`, dots, ogImage, ogPath: `${CONCEPT}projects/${pr.id}.html`,
  }) + `<body class="project p-${pr.id}"><div class="sheet">
${frame()}
<header class="fold"><a class="who" href="../index.html">${esc(author)}</a><span class="sh">${plural(list.length, 'rev')}</span>
<h1>${esc(pr.title)}</h1>
<span class="m"><i>Date</i>${range}</span></header>
<main class="field">
<div class="ph">${pr.line ? `<p class="hl">${esc(pr.line)}</p>` : `<p class="hl">${esc(pr.title)}</p>`}</div>
${hand}
<div class="revs n${list.length}">${revs}</div>
</main>
<aside class="strip" aria-label="Revisions">${revTable(pr, null, 'project')}</aside>
</div>${SCRIPT('../')}</body></html>
`
}

// ---------------------------------------------------------------- write
mkdirSync(join(here, 'posts'), { recursive: true })
mkdirSync(join(here, 'projects'), { recursive: true })
writeFileSync(join(here, 'index.html'), indexPage())
for (const p of posts) writeFileSync(join(here, 'posts', `${p.id}.html`), postPage(p))
for (const p of projects) writeFileSync(join(here, 'projects', `${p.id}.html`), projectPage(p))
console.log(`built ${posts.length} posts, ${projects.length} projects, index`)
