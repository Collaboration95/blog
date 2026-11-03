#!/usr/bin/env node
// marginalia: one text column and one ruled line. Run with `node build.mjs`. No dependencies.
// Set SITE_URL=https://user.github.io/repo/ to make og:image absolute for link unfurlers.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const data = JSON.parse(readFileSync(join(root, 'content/posts.json'), 'utf8'))
const SITE = (process.env.SITE_URL || '').replace(/\/?$/, m => (process.env.SITE_URL ? '/' : ''))
const REST = 34 // px from the datum to the line when no number is moving it

const posts = new Map(data.posts.map(p => [p.id, p]))
const projects = new Map(data.projects.map(p => [p.id, p]))
const order = data.posts.map(p => p.id)
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

// ---- dates ----------------------------------------------------------------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ymd = s => s.split('-').map(Number)
const day = s => { const [y, m, d] = ymd(s); return Date.UTC(y, m - 1, d) / 864e5 }
const fmt = (s, approx) => { const [y, m, d] = ymd(s); return approx ? `c. ${MON[m - 1]} ${y}` : `${d} ${MON[m - 1]} ${y}` }
const postDate = p => fmt(p.date, p.dateApprox)
function range(pr) {
  const newest = posts.get(pr.posts[0]), oldest = posts.get(pr.posts.at(-1))
  const [y1, m1, d1] = ymd(pr.first), [y2, m2, d2] = ymd(pr.last)
  if (newest.dateApprox) return `${d1} ${MON[m1 - 1]} – c. ${MON[m2 - 1]} ${y2}`
  if (oldest.dateApprox) return `c. ${MON[m1 - 1]} – ${d2} ${MON[m2 - 1]} ${y2}`
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MON[m2 - 1]} ${y2}`
  return `${d1} ${MON[m1 - 1]} – ${d2} ${MON[m2 - 1]} ${y2}`
}

// ---- marks.txt ------------------------------------------------------------
function readMarks() {
  const marks = new Map()
  let cur = null
  for (const raw of readFileSync(join(here, 'marks.txt'), 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || (line.startsWith('#') && !line.startsWith('## '))) continue
    let m
    if ((m = line.match(/^## (project )?(\S+)$/))) {
      cur = { open: 1, figs: [], runs: [], scale: '' }
      marks.set((m[1] ? 'project:' : '') + m[2], cur)
    } else if ((m = line.match(/^open (\d+)$/))) cur.open = +m[1]
    else if ((m = line.match(/^!\[(\d+)(?: ([a-z]+))?(?: (\d+))?\] after "(.*)"$/))) cur.figs.push({ n: m[1], mode: m[2] || 'cross', lines: +m[3] || 0, after: m[4] })
    else if ((m = line.match(/^\| (\d+)-(\d+) \| ([\d.*/]+) \| (.+)$/))) cur.runs.push({ from: +m[1], to: +m[2], px: calc(m[3]), label: m[4] })
    else if ((m = line.match(/^\| (\S+) \| ([\d.*/]+) \| (.+)$/))) cur.runs.push({ post: m[1], px: calc(m[2]), label: m[3] })
    else if ((m = line.match(/^scale (.+?)(?: \| (.+))?$/))) { cur.scale = m[1]; cur.scalePhone = m[2] || m[1] }
    else throw new Error(`marks.txt: cannot read "${line}"`)
  }
  return marks
}
function calc(expr) {
  const m = expr.match(/^([\d.]+)(?:([*/])([\d.]+))?$/)
  if (!m) throw new Error(`marks.txt: bad number ${expr}`)
  const v = !m[2] ? +m[1] : m[2] === '*' ? m[1] * m[3] : m[1] / m[3]
  return Math.round(v * 100) / 100
}
const marks = readMarks()

// ---- image scale ----------------------------------------------------------
// Equal-area rule: every picture gets the same amount of paper, then its height is
// rounded to whole text lines. Tall ones go narrow, wide ones go long, none dominates.
const AREA = 140000, DESK_LINE = 30
const linesFor = (r, area = AREA) => Math.max(4, Math.round(Math.sqrt(area / r) / DESK_LINE))

// Budget: pictures may not outrun the words they hang beside, so the shared area shrinks
// until the stack of figures fits the text. CPL only sizes pictures. If it is wrong the
// page ends a line or two uneven; nothing can collide, because every figure is a float.
const CPL = 80, MIN_AREA = 44000, WRAP = 1.15, SPINE_LINES = 7, FIG_GAP = 14
const linesIn = b => b.kind === 'pre' ? b.html.split('\n').length * .6 : Math.ceil(plain(b.html).length / CPL)
function budget(post, placed) {
  const lines = post.blocks.map(linesIn)
  const before = i => lines.slice(0, i).reduce((s, n) => s + n, 0)
  const first = Math.max(SPINE_LINES, before(placed[0].block))
  const room = (before(lines.length) * WRAP - first) * DESK_LINE - placed.length * FIG_GAP
  const stack = placed.reduce((s, p) => s + Math.sqrt(p.img.h / p.img.w), 0)
  return Math.max(MIN_AREA, Math.min(AREA, (room / stack) ** 2))
}

// Phone: the line moves half as far, so the text keeps a readable measure. The key says so.
const phone = m => m === REST ? REST : Math.round(m * 50) / 100
const lineVars = (m, prev) => `--m:${m};--mp:${phone(m)};--p:${prev};--pp:${phone(prev)}`
const keyText = mk => mk.scale === mk.scalePhone ? esc(mk.scale) : `<span class="kd">${esc(mk.scale)}</span><span class="kp">${esc(mk.scalePhone)}</span>`

// ---- generic placement ----------------------------------------------------
// Used when marks.txt says nothing about a post's images.
//   1. Eligible paragraphs have 12 words or more and are not the opening.
//   2. Images are spread evenly through the eligible paragraphs.
//   3. Inside a paragraph the image cuts in at the first sentence end past 30% of the
//      text, else the first comma past 30%, else a word break near 40%. Never inside a link.
//   4. Taller than wide means notch. Everything else crosses the line.
function autoPlace(post) {
  const eligible = post.blocks.map((b, i) => ({ b, i })).filter(({ b, i }) => i > 0 && b.kind === 'p' && plain(b.html).split(/\s+/).length >= 12)
  const pool = eligible.length ? eligible : post.blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.kind === 'p')
  return post.images.map((img, k) => {
    const at = pool[Math.min(pool.length - 1, Math.floor(((k + 0.35) * pool.length) / post.images.length))]
    return { img, block: at.i, offset: cutPoint(at.b.html), mode: img.h > img.w ? 'notch' : 'cross' }
  })
}
function safeOffsets(html) {
  const bad = []
  for (const m of html.matchAll(/<a\b[^>]*>.*?<\/a>/gs)) bad.push([m.index, m.index + m[0].length])
  return i => !bad.some(([a, b]) => i > a && i < b)
}
function cutPoint(html) {
  const ok = safeOffsets(html), from = html.length * 0.3
  for (const re of [/[.!?:] /g, /, /g, / /g]) {
    for (const m of html.matchAll(re)) {
      const i = m.index + m[0].length - 1
      if (i >= from && ok(i) && i < html.length - 12) return i
    }
  }
  return html.length
}
function placements(post) {
  const mk = marks.get(post.id)
  if (!mk || !mk.figs.length) return autoPlace(post)
  const placed = mk.figs.map(f => {
    const img = post.images.find(i => i.src.endsWith(`/${f.n}.webp`))
    if (!img) throw new Error(`${post.id}: no image ${f.n}`)
    const needle = esc(f.after).replace(/&quot;/g, '"').replace(/&lt;/g, '&lt;')
    const block = post.blocks.findIndex(b => b.html.includes(needle) || b.html.includes(f.after))
    if (block < 0) throw new Error(`${post.id}: phrase not found: ${f.after}`)
    const html = post.blocks[block].html
    const hit = html.includes(needle) ? needle : f.after
    return { img, block, offset: html.indexOf(hit) + hit.length, mode: f.mode, lines: f.lines }
  })
  for (const img of post.images) if (!placed.some(p => p.img === img)) {
    const auto = autoPlace({ ...post, images: [img] })[0]
    placed.push(auto)
  }
  return placed
}

// ---- pieces ---------------------------------------------------------------
// Caption and label text is drawn by CSS from data attributes, so no words of ours
// land inside the sentence the figure interrupts (the alt on the img still names it).
function figure(p, no, up) {
  const { img, mode } = p
  const r = +(img.w / img.h).toFixed(4)
  const wide = r > 1.15 ? ' wide' : ''
  const lazy = no > 1 ? ' loading="lazy"' : ''
  const n = p.lines || linesFor(r, (p.area || AREA) * (mode === 'notch' ? 0.8 : 1))
  return `<span class="fig ${mode}${wide}" id="fig-${no}" style="--r:${r};--n:${n}">` +
    `<a class="open" href="#fig-${no}" aria-label="Open figure ${no} at full size">` +
    `<img src="${up}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}"${lazy}></a>` +
    `<span class="cap" aria-hidden="true" data-no="${no}" data-t="${esc(img.alt)}"></span>` +
    `<a class="shut" href="#p${p.block + 1}" aria-label="Close figure ${no}"></a></span>`
}
function markFigure(html, label) {
  // Underline the first place the post states the figure, outside any tag.
  const parts = html.split(/(<[^>]+>)/)
  for (let i = 0; i < parts.length; i += 2) {
    const at = parts[i].indexOf(label)
    if (at >= 0) {
      parts[i] = parts[i].slice(0, at) + `<mark>${label}</mark>` + parts[i].slice(at + label.length)
      break
    }
  }
  return parts.join('')
}
function paragraph(post, i, placed, run, numbered) {
  const b = post.blocks[i]
  const id = `p${i + 1}`
  const n = `<a class="n" href="#${id}" aria-label="Link to paragraph ${i + 1}">${i + 1}</a>`
  if (b.kind === 'heading') return `<h2 id="${id}">${n}${b.html}</h2>`
  if (b.kind === 'pre') return `<pre id="${id}">${n}${b.html}</pre>`
  let html = b.html
  const here = placed.filter(p => p.block === i).sort((a, c) => c.offset - a.offset)
  for (const p of here) {
    let rest = html.slice(p.offset), head = html.slice(0, p.offset)
    const sp = rest.match(/^ +/)
    if (sp) { head += sp[0]; rest = rest.slice(sp[0].length) }
    html = head + '<span class="at"></span>' + figure(p, p.no, '../../../') + (rest ? '<span class="gap"></span>' : '') + rest
  }
  if (run && run.label) html = markFigure(html, run.label)
  return `<p id="${id}"${numbered}>${n}${html}</p>`
}
function openSize(post, count) {
  const words = post.blocks.slice(0, count).reduce((s, b) => s + plain(b.html).split(/\s+/).length, 0) / count
  return words <= 14 ? 'big' : words <= 30 ? 'mid' : 'low'
}
function head({ title, desc, up, ogImage, type = 'article' }) {
  const img = ogImage ? (SITE ? SITE + ogImage : up + ogImage) : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${type}">
${img ? `<meta property="og:image" content="${esc(img)}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="#f3f4f1">
<link rel="stylesheet" href="${up}concepts/marginalia/style.css">
<script src="${up}concepts/marginalia/margin.js" defer></script>
</head>
`
}
const clip = (s, n = 155) => { const t = plain(s).replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, c.lastIndexOf(' ')) }
const ogFor = post => post.images[0]?.src ?? `concepts/marginalia/og/${post.id}.png`
function firstWords(post) {
  const words = plain(post.blocks[0].html).trim().split(/\s+/)
  let out = words[0]
  for (const w of words.slice(1)) { if ((out + ' ' + w).length > 16) break; out += ' ' + w }
  return out
}

// The big sideways word sits in the white it describes and is never longer than its
// stretch of text (CSS caps it with cqh, using --em, its length in font sizes). The one
// exception, above phone width: a word followed by another big word may hang past its
// stretch, moved left of the next line, and the next word sits at the foot of its own.
// A stretch with a picture in it keeps its word on the side with more text, because on a
// phone that picture runs the full width.
const bigLabel = g => g?.run && g.run.px >= 100
function belowFigure(g, post, placed) {
  const f = placed.find(p => g.ids.includes(p.block))
  if (!f) return false
  const size = i => post.blocks[i].html.length
  const above = g.ids.filter(i => i < f.block).reduce((s, i) => s + size(i), f.offset)
  return g.ids.reduce((s, i) => s + size(i), 0) - above > above
}
function sideways(g, next, last, key, post, placed) {
  const m = g.run.px, fs = Math.max(13, Math.min(64, Math.round((m - 34) * 0.62)))
  const hang = bigLabel(g) && bigLabel(next)
  const cls = hang ? ' hang' : (bigLabel(g) && bigLabel(last)) || belowFigure(g, post, placed) ? ' low' : ''
  const drop = m - (next?.run?.px ?? REST)   // a small word in a short stretch stands clear of the next line too
  const clear = (hang || fs < 28) && drop > 0 ? `;--clear:${drop.toFixed(1)}px` : ''
  return `<span class="mb${cls}${key ? ' keyed' : ''}" style="--fs:${fs}px;--em:${(g.run.label.length * .43).toFixed(2)}${clear}" aria-hidden="true">` +
    `<span class="ml">${esc(g.run.label)}</span>${key ? `<span class="key">${key}</span>` : ''}</span>`
}

// ---- post page ------------------------------------------------------------
function postPage(post) {
  const mk = marks.get(post.id) || { open: 1, runs: [], figs: [], scale: '' }
  const placed = placements(post).sort((a, b) => a.block - b.block || a.offset - b.offset)
  const area = placed.length ? budget(post, placed) : AREA
  placed.forEach((p, i) => { p.no = i + 1; p.area = area })
  const runFor = i => mk.runs.find(r => i + 1 >= r.from && i + 1 <= r.to) || null
  const openCount = Math.min(mk.open, post.blocks.length)
  const size = openSize(post, openCount)

  // Group blocks into stretches that share a line position.
  const groups = []
  post.blocks.forEach((b, i) => {
    const run = runFor(i)
    const last = groups.at(-1)
    if (last && last.run === run) last.ids.push(i)
    else groups.push({ run, ids: [i] })
  })
  let prev = REST, scaled = false
  const sections = groups.map((g, gi) => {
    const m = g.run ? g.run.px : REST
    const dx = prev - m
    const vars = lineVars(m, prev)
    prev = m
    const body = g.ids.map(i => {
      const large = i < openCount ? ` class="lead ${size}"` : ''
      return paragraph(post, i, placed, g.run, large)
    }).join('\n')
    const label = g.run && m >= 30 ? sideways(g, groups[gi + 1], groups[gi - 1], !scaled && mk.scale ? keyText(mk) : '', post, placed) : ''
    if (label && mk.scale) scaled = true
    const step = gi && dx ? `<i class="step"></i>` : ''
    return `<section class="run${g.run ? ' moved' : ''}" style="${vars}">${step}${label}\n${body}\n</section>`
  }).join('\n')

  const pr = post.project ? projects.get(post.project) : null
  const pos = order.indexOf(post.id)
  const newer = pos > 0 ? posts.get(order[pos - 1]) : null
  const older = pos < order.length - 1 ? posts.get(order[pos + 1]) : null
  const place = pr ? `${pr.posts.length - pr.posts.indexOf(post.id)} of ${pr.posts.length}` : ''

  const siblings = pr ? `<nav class="sibs" aria-label="${esc(pr.title)}">
<a class="pt" href="../projects/${pr.id}.html">${esc(pr.title)}</a>
<ol>${[...pr.posts].reverse().map(id => {
    const s = posts.get(id)
    const inner = `<span class="l">${esc(s.label)}</span> <span class="d">${postDate(s)}</span>`
    return id === post.id ? `<li aria-current="page">${inner}</li>` : `<li><a href="${id}.html">${inner}</a></li>`
  }).join('')}</ol>
</nav>` : ''

  const foot = `<footer class="foot" style="--m:${REST}">
${siblings}
<nav class="turn" aria-label="Neighbouring posts">
${newer ? `<a class="newer" rel="prev" href="${newer.id}.html"><span class="w">Newer</span><span class="t">${esc(newer.label)}</span></a>` : '<span></span>'}
${older ? `<a class="older" rel="next" href="${older.id}.html"><span class="c">${esc(firstWords(older))}</span><span class="t">${esc(older.label)}</span></a>` : ''}
</nav>
<p class="src"><span>${pos + 1} of ${order.length}</span>${post.linkedin ? ` <a href="${esc(post.linkedin)}">LinkedIn</a>` : ''}</p>
</footer>`

  return head({ title: `${post.label}, ${data.author}`, desc: clip(post.opening), up: '../../../', ogImage: ogFor(post) }) +
`<body class="page post">
<header class="head" style="--m:${REST}">
<a class="name" href="../index.html">${esc(data.author)}</a>
${pr ? `<a class="proj" href="../projects/${pr.id}.html">${esc(pr.title)}</a> <span class="of">${place}</span>` : ''}
</header>
<main>
<div class="spine"><h1>${esc(post.label)}</h1><time datetime="${post.date}">${postDate(post)}</time></div>
${sections}
</main>
${foot}
</body>
</html>
`
}

// ---- trailing-off text (index and project pages) ----------------------------
function trail(post, opts = {}) {
  const WORDS = opts.words || 110
  const pieces = []
  let count = 0
  for (const b of post.blocks) {
    if (count >= WORDS) break
    if (b.kind !== 'p') continue
    const text = b.html.replace(/<a\b[^>]*>/g, '').replace(/<\/a>/g, '')
    const words = plain(text).trim().split(/\s+/)
    count += words.length
    pieces.push(text)
  }
  const joined = pieces.join(' <i class="pil" aria-hidden="true">¶</i> ')
  if (post.words < 90) return `<p class="trail whole">${joined}</p>`
  return `<p class="trail"><i class="sp"></i><i class="ta"></i>${joined}</p>`
}

// ---- index ----------------------------------------------------------------
function entries() {
  const seen = new Set(), list = []
  for (const post of data.posts) {
    if (post.project) {
      if (seen.has(post.project)) continue
      seen.add(post.project)
      const pr = projects.get(post.project)
      list.push({ kind: 'project', pr, post, date: post.date })
    } else list.push({ kind: 'post', post, date: post.date })
  }
  return list
}
function indexPage() {
  const list = entries()
  const body = list.map((e, i) => {
    const days = i ? Math.round(day(list[i - 1].date) - day(e.date)) : 0
    const href = e.kind === 'project' ? `projects/${e.pr.id}.html` : `posts/${e.post.id}.html`
    const title = e.kind === 'project' ? e.pr.title : e.post.label
    const when = e.kind === 'project' ? range(e.pr) : postDate(e.post)
    const count = e.kind === 'project' ? `<span class="count">${e.pr.posts.length} posts</span>` : ''
    const preview = e.kind === 'project'
      ? e.pr.posts.map(id => posts.get(id)).find(p => p.images.length)
      : e.post.images.length ? e.post : null
    const img = preview ? preview.images[0] : null
    const r = img ? +(img.w / img.h).toFixed(4) : 0
    const fig = img ? `<a class="pv${r < 1 ? ' tall' : ''}" href="${href}" tabindex="-1" aria-hidden="false" style="--r:${r}"><img src="../../${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}"${i > 1 ? ' loading="lazy"' : ''}></a>` : ''
    const gap = days >= 7 ? `<span class="days" aria-hidden="true">${days} days</span>` : ''
    return `<article class="entry${img ? ' has' : ''}" style="--days:${days}">${gap}
<div class="spine"><time datetime="${e.date}">${when}</time></div>
${fig}<h2><a href="${href}">${esc(title)}</a>${count}</h2>
${trail(e.post)}
</article>`
  }).join('\n')
  return head({ title: data.author, desc: `${data.posts.length} posts by ${data.author}.`, up: '../../', ogImage: data.posts.find(p => p.images.length).images[0].src, type: 'website' }).replaceAll('../../concepts/marginalia/', '') +
`<body class="page home">
<header class="head" style="--m:${REST}"><h1 class="name">${esc(data.author)}</h1> <span class="of">${data.posts.length} posts</span></header>
<main class="rail">
${body}
</main>
<footer class="end" style="--m:${REST}"></footer>
</body>
</html>
`
}

// ---- project page ---------------------------------------------------------
function projectPage(pr) {
  const mk = marks.get(`project:${pr.id}`) || { runs: [], scale: '' }
  const chrono = [...pr.posts].reverse().map(id => posts.get(id))
  const firstImg = chrono.find(p => p.images.length)
  let prev = REST
  const body = chrono.map((post, i) => {
    const run = mk.runs.find(r => r.post === post.id)
    if (run && !plain(post.blocks.map(b => b.html).join(' ')).includes(run.label)) throw new Error(`${post.id}: "${run.label}" is not in the post`)
    const m = run ? run.px : REST
    const dx = prev - m
    const vars = lineVars(m, prev)
    prev = m
    const placed = post.images.length ? placements(post).sort((a, b) => a.block - b.block || a.offset - b.offset) : []
    const strip = placed.length ? `<div class="strip n${placed.length}">${placed.map((p, k) => {
      const r = +(p.img.w / p.img.h).toFixed(4)
      return `<a href="../posts/${post.id}.html#fig-${k + 1}" style="--r:${r}"><img src="../../../${p.img.src}" width="${p.img.w}" height="${p.img.h}" alt="${esc(p.img.alt)}"${i ? ' loading="lazy"' : ''}></a>`
    }).join('')}</div>` : ''
    const label = run ? `<span class="ml small" aria-hidden="true">${esc(run.label)}</span>` : ''
    const step = i && dx ? `<i class="step"></i>` : ''
    return `<section class="run item${run ? ' moved' : ''}" style="${vars}">${step}${label}
<div class="spine"><time datetime="${post.date}">${postDate(post)}</time></div>
<h2><a href="../posts/${post.id}.html"><span class="ord">${i + 1}</span> ${esc(post.label)}</a></h2>
${strip}${trail(post)}
</section>`
  }).join('\n')
  const key = mk.scale ? `<span class="key top">${keyText(mk)}</span>` : ''
  return head({ title: `${pr.title}, ${data.author}`, desc: clip(pr.line || posts.get(pr.posts[0]).opening), up: '../../../', ogImage: firstImg ? firstImg.images[0].src : `concepts/marginalia/og/${chrono[0].id}.png` }) +
`<body class="page project">
<header class="head" style="--m:${REST}">
<a class="name" href="../index.html">${esc(data.author)}</a>
<span class="of">${pr.posts.length} posts</span>
</header>
<main>
<div class="spine"><time datetime="${pr.first}">${range(pr)}</time></div>
<section class="run title" style="${lineVars(REST, REST)}">
<h1>${esc(pr.title)}</h1>
${pr.line ? `<p class="line">${esc(pr.line)}</p>` : ''}${key}
</section>
${body}
</main>
<footer class="end" style="${lineVars(prev, prev)}"></footer>
</body>
</html>
`
}

// ---- write ----------------------------------------------------------------
mkdirSync(join(here, 'posts'), { recursive: true })
mkdirSync(join(here, 'projects'), { recursive: true })
writeFileSync(join(here, 'index.html'), indexPage())
for (const pr of data.projects) writeFileSync(join(here, 'projects', `${pr.id}.html`), projectPage(pr))
for (const post of data.posts) writeFileSync(join(here, 'posts', `${post.id}.html`), postPage(post))
console.log(`built ${data.posts.length} posts, ${data.projects.length} projects`)
