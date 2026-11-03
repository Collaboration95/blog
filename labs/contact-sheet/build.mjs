#!/usr/bin/env node
// Contact sheet. node build.mjs [SITE_URL=https://...] rebuilds the whole site from content/posts.json
// and marks.md. No dependencies. SITE_URL only makes og:image absolute for link unfurls.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
await import('./assets/pencil.js')
const { hash, rng, ring, cross, box, line, stroke, arrow } = globalThis.Pencil

const data = JSON.parse(readFileSync(join(root, 'content/posts.json'), 'utf8'))
const SITE = (process.env.SITE_URL ?? '').replace(/\/$/, '')
const AUTHOR = data.author

/* ---------- numbering: the archive is one roll, oldest exposure first ---------- */
const chrono = [...data.posts].reverse().map((p, i) => [p, i]).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[1] - b[1]).map(x => x[0])
const num = new Map(chrono.map((p, i) => [p.id, i + 1]))
const total = chrono.length
const byId = new Map(data.posts.map(p => [p.id, p]))
const projectOf = new Map(data.projects.map(p => [p.id, p]))
const two = n => String(n).padStart(2, '0')
const letter = i => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]
const shot = (post, i) => `${two(num.get(post.id))}${letter(i)}`

/* ---------- small helpers ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const stripTags = h => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parts = d => d.split('-').map(Number)
const dateText = p => { const [y, m, d] = parts(p.date); return p.dateApprox ? `c. ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]} ${y}` }
function rangeText(project) {
  const posts = project.posts.map(id => byId.get(id))
  const a = posts.at(-1), b = posts[0]
  const [ya, ma, da] = parts(a.date), [yb, mb, db] = parts(b.date)
  if (a.dateApprox || b.dateApprox) return `${a.dateApprox ? 'c. ' + MONTHS[ma - 1] : da + ' ' + MONTHS[ma - 1]} – ${dateText(b)}`
  if (ya === yb && ma === mb) return `${da}–${db} ${MONTHS[mb - 1]} ${yb}`
  return ya === yb ? `${da} ${MONTHS[ma - 1]} – ${db} ${MONTHS[mb - 1]} ${yb}` : `${dateText(a)} – ${dateText(b)}`
}
const describe = p => { const t = stripTags(p.opening ?? '').replace(/\s+/g, ' ').trim(); return t.length > 155 ? t.slice(0, 154).replace(/\s\S*$/, '') + '…' : t }

/* ---------- seven-segment date-back stamp ---------- */
const SEG = { a: 'M2 0h8l-1.6 1.6H3.6z', b: 'M10.6.6v8l-1.6-1V2.2z', c: 'M10.6 9.4v8l-1.6-1.6v-5.4z', d: 'M2 18h8l-1.6-1.6H3.6z', e: 'M1.4 9.4v8L3 15.8v-5.4z', f: 'M1.4.6v8l1.6-1V2.2z', g: 'M2.2 9l1.4-.8h4.8l1.4.8-1.4.8H3.6z' }
const DIGIT = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', c: 'deg' }
function stamp(post) {
  const [y, m, d] = parts(post.date)
  const glyphs = [...(post.dateApprox ? 'c' : two(d)), ' ', ...two(m), ' ', "'", ...two(y % 100)]
  let x = 0, out = ''
  for (const g of glyphs) {
    if (g === ' ') { x += 7; continue }
    if (g === "'") { out += `<path d="M${x + 1} 0h2l-1 5h-1.4z"/>`; x += 6; continue }
    out += `<g transform="translate(${x})">${[...DIGIT[g]].map(s => `<path d="${SEG[s]}"/>`).join('')}</g>`; x += 13.5
  }
  return `<span class="stamp" role="img" aria-label="${esc(dateText(post))}"><svg viewBox="0 0 ${x} 18" aria-hidden="true">${out}</svg></span>`
}

/* ---------- marks.md: the markup Guru would actually write ---------- */
function parseMarks(text) {
  const out = {}
  let cur = null
  for (const raw of text.split('\n')) {
    const l = raw.trim()
    if (!l || l.startsWith('//')) continue
    let m
    if ((m = l.match(/^# (project )?(\S+)$/))) { cur = out[m[2]] = { images: [], words: [], draws: [], chains: [], frames: {}, strips: [], lede: null, side: null, picks: [], preview: null }; continue }
    if ((m = l.match(/^!\[([^\]]+)\]\((.*)\)$/))) {
      const toks = m[1].split(/\s+/)
      cur.images.push({ nums: toks.filter(t => /^\d+$/.test(t)).map(Number), caret: m[2], in: toks.includes('in') }); continue
    }
    if ((m = l.match(/^\((o|x|_)( red)?( \d+)?\)\[(.+)\]$/))) { cur.words.push({ kind: m[1], red: !!m[2], block: m[3] ? +m[3] : null, text: m[4] }); continue }
    if ((m = l.match(/^@(\d+) (ring|cross|box)((?: [\d.]+)*)(?: -> (.+))?$/))) { cur.draws.push({ img: +m[1], kind: m[2], nums: m[3].trim().split(' ').filter(Boolean).map(Number), to: m[4] ?? null }); continue }
    if ((m = l.match(/^~ (.+) -> (.+)$/))) { cur.chains.push([m[1], m[2]]); continue }
    if ((m = l.match(/^lede (\d+)(?:-(\d+))?$/))) { cur.lede = [+m[1], +(m[2] ?? m[1])]; continue }
    if ((m = l.match(/^side (\d+)$/))) { cur.side = +m[1]; continue }
    if ((m = l.match(/^frame (\d+)((?: exp [\d.]+| cross| pick| in)*)$/))) { const e = m[2].match(/exp ([\d.]+)/); cur.frames[+m[1]] = { exp: e ? +e[1] : null, cross: /cross/.test(m[2]), pick: /pick/.test(m[2]), in: / in/.test(m[2]) }; continue }
    if ((m = l.match(/^strip (\d+)-(\d+)$/))) { cur.strips.push([+m[1], +m[2]]); continue }
    if ((m = l.match(/^preview (\S+) (\d+)$/))) { cur.preview = [m[1], +m[2]]; continue }
    if ((m = l.match(/^pick (\S+) (.+) \| (.+)$/))) { cur.picks.push({ post: m[1], text: m[2], word: m[3] }); continue }
    throw new Error(`marks.md: cannot read "${l}"`)
  }
  return out
}
const marks = parseMarks(readFileSync(join(here, 'marks.md'), 'utf8'))
const blank = () => ({ images: [], words: [], draws: [], chains: [], frames: {}, strips: [], lede: null, side: null, picks: [], preview: null })

/* ---------- placement rule for every post without a section in marks.md ---------- */
// Images go inside paragraphs, at the sentence break nearest the middle, spread evenly down the
// post. Four or more images travel in pairs. The first frame gets the editor's circle, and the first
// hard number in the text gets a yellow ring.
function autoSection(post) {
  const s = blank()
  const blocks = post.blocks.map((b, i) => ({ ...b, i })).filter(b => b.kind === 'p')
  const n = post.images.length
  if (n) {
    const per = n >= 4 ? 2 : 1, slots = Math.ceil(n / per)
    const usable = blocks.filter(b => !b.html.includes('<a') && stripTags(b.html).length > 70)
    const pool = usable.length >= slots ? usable : blocks
    const used = new Set()
    for (let j = 0; j < slots; j++) {
      const target = Math.floor((j + .75) * post.blocks.length / (slots + .25))
      const b = pool.filter(x => !used.has(x.i)).sort((a, c) => Math.abs(a.i - target) - Math.abs(c.i - target))[0]
      if (!b) break
      used.add(b.i)
      const nums = Array.from({ length: per }, (_, k) => j * per + k + 1).filter(k => k <= n)
      s.images.push({ nums, at: { block: b.i, pos: sentenceBreak(b.html) } })
    }
    s.draws.push({ img: 1, kind: 'ring', nums: [50, 50, 54, 56], to: null })
  }
  const all = post.blocks.map(b => stripTags(b.html)).join('\n')
  const hit = all.match(/\$\d[\d.,]*|\b\d+(?:\.\d+)?(?:x|%)(?=[\s.,)])|\b\d+(?:\.\d+)? (?:seconds|minutes|hours|days)\b/)
  if (hit) s.words.push({ kind: 'o', red: false, block: null, text: hit[0] })
  if (post.words < 30) { s.frames[1] = { exp: 0, cross: false, pick: false } }
  return s
}
function sentenceBreak(html) {
  const mid = html.length / 2
  const hits = [...html.matchAll(/[.?!] (?=\S)/g)].map(m => m.index + 2)
  if (!hits.length) hits.push(...[...html.matchAll(/, (?=\S)/g)].map(m => m.index + 2))
  return hits.length ? hits.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0] : html.length
}

/* ---------- pieces ---------- */
const wid = t => 'w-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function wordSvg(text, kind, seed) {
  const W = Math.max(36, text.length * 9.2 + 18), H = 34
  const d = kind === 'x' ? line(2, H * .68, W - 2, H * .32, { w: 2.8, seed, bow: .02, wob: .8 })
    : kind === '_' ? line(1, H - 3, W - 1, H - 5, { w: 3, seed, bow: .02, wob: .7 })
      : ring(W / 2, H / 2, W / 2 - 3.5, H / 2 - 3.5, { w: 2.5, seed })
  return `<svg class="wm" viewBox="0 0 ${W.toFixed(0)} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`
}
function wrapWord(html, w, id) {
  let from = 0
  for (;;) {
    const i = html.indexOf(w.text, from)
    if (i < 0) return null
    if (html.lastIndexOf('<', i) > html.lastIndexOf('>', i)) { from = i + 1; continue }
    const cls = `w ${w.red ? 'red' : 'yel'}`
    return html.slice(0, i) + `<span class="${cls}" data-w="${wid(w.text)}">${w.text}${wordSvg(w.text, w.kind, hash(id + w.text))}</span>` + html.slice(i + w.text.length)
  }
}
const IMGW = 338 // marks are drawn for the phone frame: it is the primary screen
function imageMarks(post, i, sec, leads, frameId) {
  const img = post.images[i], W = IMGW, H = W * img.h / img.w
  const seed = hash(post.id + i)
  let d = ''
  sec.draws.filter(x => x.img === i + 1).forEach((m, k) => {
    const n = m.nums, s = seed + k * 13, px = x => x / 100 * W, py = y => y / 100 * H
    let anchor
    if (m.kind === 'ring') { d += ring(px(n[0]), py(n[1]), px(n[2]), py(n[3]), { w: 3.6, seed: s }); anchor = [n[0], n[1], n[2], n[3]] }
    if (m.kind === 'cross') { d += cross(px(n[0]), py(n[1]), px(n[2]), py(n[3] ?? n[2]), { w: 3.8, seed: s, bow: .04 }); anchor = [n[0], n[1], n[2] * .4, (n[3] ?? n[2]) * .4] }
    if (m.kind === 'box') { d += box(W * .012, H * .015, W * .976, H * .97, { w: 3.6, seed: s, bow: .012 }); anchor = [50, 50, 49, 49] }
    if (m.to) leads.push({ a: { f: frameId, x: anchor[0], y: anchor[1], rx: anchor[2], ry: anchor[3] }, b: wid(m.to) })
  })
  return d ? `<svg class="pm" viewBox="0 0 ${W} ${H.toFixed(1)}" aria-hidden="true"><path d="${d}"/></svg>` : ''
}
// Above the fold a frame paints with the page, never black first. On a sheet the first 13 frames
// cover the fold at 1440 and on a phone, and the first 20 cover it at 1920.
const FAR = ' loading="lazy" decoding="async"'
const sheetLoad = n => n < 13 ? '' : n < 20 ? ' loading="lazy"' : FAR
function frameHtml(post, i, sec, leads, srcPrefix, load) {
  const img = post.images[i], id = `img-${two(i + 1)}`, r = (img.w / img.h).toFixed(4)
  const label = shot(post, i)
  return `<span class="fr${img.w < img.h ? ' tall' : ''}" id="${id}" data-n="${label}" data-alt="${esc(img.alt)}" style="--r:${r}"><a class="ph" href="#${id}" data-full="${srcPrefix}${img.src}" data-alt="${esc(img.alt)}" data-n="${label}" aria-label="Open frame ${label} at full size"><img src="${srcPrefix}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}"${load}></a>${imageMarks(post, i, sec, leads, id)}</span>`
}
function stripHtml(post, group, sec, leads, srcPrefix, load) {
  return `<span class="strip${group.in ? ' in' : ''}">${group.nums.map(n => frameHtml(post, n - 1, sec, leads, srcPrefix, load)).join('')}</span>`
}
function frameMarks(fr, seed) {
  let d = ''
  const W = 300, H = 200
  if (fr.cross) d += cross(W / 2, H / 2, W * .47, H * .44, { w: 4, seed, bow: .03 })
  if (fr.pick) d += ring(W / 2, H / 2, W * .515, H * .54, { w: 4.4, seed })
  return d ? `<svg class="pm tf-m" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>` : ''
}
const NUMA = n => `<a class="n" href="#p${n}" aria-label="Link to paragraph ${n}">${two(n)}</a>`

function expStyle(exp) {
  // Luminance of the frame is the exposure. Above .5 the text prints dark.
  const v = Math.round(10 + 238 * Math.pow(exp, 1.25))
  const c = `rgb(${v} ${Math.round(v * .975)} ${Math.round(v * .925)})`
  return `--bg:${c};--fg:${exp > .45 ? '#141210' : '#ece7da'}`
}

function renderPost(post) {
  const sec = marks[post.id] ?? autoSection(post)
  const leads = []
  const srcPrefix = '../../../'
  // Resolve carets to placeholders, block by block.
  const blocks = post.blocks.map(b => ({ ...b, inserts: [], before: [] }))
  sec.images.forEach((g, k) => {
    if (g.at) { const b = blocks[g.at.block]; const atEnd = g.at.pos >= b.html.length; b.html = b.html.slice(0, g.at.pos) + `${k}` + b.html.slice(g.at.pos); b.inserts.push(k); b.endAt = atEnd; return }
    const [l, r] = g.caret.split('^').map(s => s.trim())
    const needle = l && r ? `${l} ${r}` : l || r
    const b = blocks.find(x => x.html.includes(needle))
    if (!b) throw new Error(`${post.id}: caret text not found: ${g.caret}`)
    if (!l) { b.before.push(k); return }
    const pos = b.html.indexOf(needle) + l.length + (r ? 1 : 0)
    b.html = b.html.slice(0, pos) + `${k}` + b.html.slice(pos)
    b.inserts.push(k)
  })
  const wordsLeft = new Set(sec.words)
  for (const w of sec.words) {
    for (let i = 0; i < blocks.length; i++) {
      if (w.block && w.block !== i + 1) continue
      const next = wrapWord(blocks[i].html, w, post.id)
      if (next) { blocks[i].html = next; wordsLeft.delete(w); break }
    }
  }
  if (wordsLeft.size) throw new Error(`${post.id}: word not found: ${[...wordsLeft].map(w => w.text)}`)

  let strips = 0 // the first four strips can be on the first screen
  const stripOf = g => stripHtml(post, g, sec, leads, srcPrefix, ++strips > 4 ? FAR : '')
  const ledeRange = sec.lede ?? [1, 1]
  const inStrip = n => sec.strips.find(([a, b]) => n >= a && n <= b)
  const out = []
  const para = (b, n) => {
    const split = b.html.split(/(\d+)/)
    let inner = split[0]
    for (let j = 1; j < split.length; j += 2) {
      const after = split[j + 1]
      inner += `${after ? '<i class="caret"></i>' : ''}${stripOf(sec.images[+split[j]])}${after ? `<span class="cont">${after}</span>` : ''}`
    }
    return inner
  }
  const textFrame = (b, n, fr) => {
    const style = fr.exp != null ? ` style="${expStyle(fr.exp)}"` : ''
    return `<p class="tf-x${fr.exp > .45 ? ' lit' : ''}" id="p${n}"${style}>${NUMA(n)}<span class="tf-t">${para(b, n)}</span>${frameMarks(fr, hash(post.id + n))}</p>`
  }
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i], n = i + 1
    for (const k of b.before) out.push(`<div class="brk">${stripOf(sec.images[k])}</div>`)
    const range = inStrip(n)
    if (range && n === range[0]) {
      const fs = []
      for (let k = range[0]; k <= range[1]; k++) fs.push(textFrame(blocks[k - 1], k, sec.frames[k] ?? { exp: null }))
      const c = fs.length
      out.push(`<div class="strip tx${c > 2 ? ' small' : ''}">${fs.join('')}</div>`)
      i = range[1] - 1
      continue
    }
    if (sec.frames[n]) {
      out.push(`<div class="strip tx one${sec.frames[n].in ? ' in' : ''}">${textFrame(b, n, sec.frames[n])}</div>`)
      continue
    }
    if (b.kind === 'heading') { out.push(`<h2 id="p${n}">${NUMA(n)}${b.html}</h2>`); continue }
    if (b.kind === 'pre') { out.push(`<pre id="p${n}">${NUMA(n)}${b.html.split('\n').map(l => `<span class="ln">${l}</span>`).join('')}</pre>`); continue }
    const lede = n >= ledeRange[0] && n <= ledeRange[1]
    const len = stripTags(b.html).length
    const up = n === sec.side ? ' up' : ''
    const cls = lede ? (n === ledeRange[0] ? ` class="lede ${len < 60 ? 'l1' : len < 120 ? 'l2' : 'l3'}${up}"` : ` class="lede l3${up}"`) : ''
    out.push(`<p id="p${n}"${cls}>${NUMA(n)}${para(b, n)}</p>`)
  }
  for (const [a, b] of sec.chains) leads.push({ a: { w: wid(a) }, b: wid(b) })
  return { html: out.join('\n'), leads, side: post.images.length > 0 || Object.keys(sec.frames).length > 1 }
}

/* ---------- page shell ---------- */
const DEFS = `<svg class="defs" aria-hidden="true" width="0" height="0"><filter id="wax" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.5 .8" numOctaves="2" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -5 3.7" result="h"/><feComposite in="d" in2="h" operator="in"/></filter></svg>`
function shell({ title, desc, og, depth, body, cls, leads = [], type = 'article', date }) {
  const up = '../'.repeat(depth)
  const ogUrl = og ? (SITE ? `${SITE}/${og.src}` : `${up}${og.web}`) : null
  const meta = [
    `<title>${esc(title)}</title>`,
    desc ? `<meta name="description" content="${esc(desc)}">` : '',
    `<meta property="og:title" content="${esc(title)}">`,
    desc ? `<meta property="og:description" content="${esc(desc)}">` : '',
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${esc(AUTHOR)}">`,
    ogUrl ? `<meta property="og:image" content="${esc(ogUrl)}"><meta property="og:image:width" content="${og.w}"><meta property="og:image:height" content="${og.h}"><meta property="og:image:alt" content="${esc(og.alt)}"><meta name="twitter:card" content="summary_large_image">` : '',
    date ? `<meta property="article:published_time" content="${date}">` : '',
  ].filter(Boolean).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#060605">
<meta name="color-scheme" content="dark">
${meta}
<link rel="stylesheet" href="${up}assets/site.css">
<script src="${up}assets/pencil.js" defer></script>
<script src="${up}assets/site.js" defer></script>
</head>
<body class="${cls}"${leads.length ? ` data-leads="${esc(JSON.stringify(leads))}"` : ''}>
${DEFS}
${body}
</body>
</html>
`
}
function ogFor(post) {
  if (post.images[0]) { const i = post.images[0]; return { src: i.src, web: `../../${i.src}`, w: i.w, h: i.h, alt: i.alt } }
  const file = `og/${post.id}.jpg`
  if (existsSync(join(here, file))) return { src: `concepts/contact-sheet/${file}`, web: file, w: 1200, h: 630, alt: post.label }
  return null
}

/* ---------- post page ---------- */
const roll = current => {
  const cur = byId.get(current)
  return `<div class="roll" aria-hidden="true">${chrono.map(p => {
    const c = [p.images.length ? 'im' : '', p.id === current ? 'now' : '', cur.project && p.project === cur.project ? 'mate' : ''].filter(Boolean).join(' ')
    return `<i${c ? ` class="${c}"` : ''}></i>`
  }).join('')}</div>`
}
function postPage(post) {
  const { html, leads, side } = renderPost(post)
  const n = num.get(post.id)
  const project = post.project ? projectOf.get(post.project) : null
  const order = project ? [...project.posts].reverse() : null
  const seq = order ? order.map(id => byId.get(id)) : chrono
  const at = seq.findIndex(p => p.id === post.id)
  const prev = seq[at - 1], next = seq[at + 1]
  const navItem = (p, rel) => p ? `<a class="nx ${rel}" href="${p.id}.html" rel="${rel}"><span class="nn">${two(num.get(p.id))}</span><span class="nl">${esc(p.label)}</span></a>` : `<span class="nx ${rel} end"></span>`
  const slate = [
    `<span>Strip ${two(n)} of ${total}</span>`,
    project ? `<a href="../projects/${project.id}.html">${esc(project.title)}</a><span>${at + 1} of ${seq.length}</span>` : '',
    `<span>${esc(dateText(post))}</span>`,
  ].join('')
  const body = `<main class="film" id="film">
<header class="leader">
<a class="home" href="../index.html">${esc(AUTHOR)}</a>
<p class="slate">${slate}</p>
<p class="name">${esc(post.label)}</p>
</header>
<div class="copy">
${html}
</div>
<footer class="tail">
${post.linkedin ? `<a class="src" href="${esc(post.linkedin)}">LinkedIn</a>` : ''}
${roll(post.id)}
<nav class="nav" aria-label="Neighbouring strips">${navItem(prev, 'prev')}${navItem(next, 'next')}</nav>
<a class="back" href="${project ? `../projects/${project.id}.html` : '../index.html'}">${project ? esc(project.title) : 'Contact sheet'}</a>
</footer>
</main>`
  return shell({ title: `${post.label} · ${AUTHOR}`, desc: describe(post), og: ogFor(post), depth: 1, body, cls: `post p-${post.id}${side ? ' two' : ''}`, leads, date: post.date })
}

/* ---------- index + project: frames laid on the sheet ---------- */
function textFrame({ href, n, title, meta, opening, post, stampPost, cls = '' }) {
  return `<a class="tf ${cls}" href="${href}" data-n="${n}"><span class="tf-h">${esc(title)}</span><span class="tf-d">${esc(meta)}</span>${opening ? `<span class="tf-o">${esc(opening)}</span>` : ''}${stampPost ? stamp(stampPost) : ''}</a>`
}
const ringFrame = (r, seed) => {
  const H = 200, W = H * r
  return `<svg class="pm" viewBox="0 0 ${W.toFixed(0)} ${H}" aria-hidden="true"><path d="${ring(W / 2, H / 2, W * .515, H * .56, { w: 4.6, seed })}"/></svg>`
}
const sheetFrame = (post, i, href, up, { pick = false, load = FAR, sec = null, leads = null } = {}) => {
  const img = post.images[i], r = img.w / img.h, label = shot(post, i)
  const marksSvg = sec ? imageMarks(post, i, sec, leads, `img-${post.id}-${i}`) : ''
  return `<span class="fr${pick ? ' pick' : ''}" id="img-${post.id}-${i}" data-n="${label}" style="--r:${r.toFixed(4)}"><a class="ph" href="${href}"><img src="${up}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}"${load}></a>${pick ? ringFrame(r, hash(post.id + i)) : marksSvg}</span>`
}

function indexPage() {
  const entries = []
  const seen = new Set()
  for (const p of data.posts) {
    if (p.project) {
      if (seen.has(p.project)) continue
      seen.add(p.project)
      entries.push({ project: projectOf.get(p.project), posts: projectOf.get(p.project).posts.map(id => byId.get(id)) })
    } else entries.push({ posts: [p] })
  }
  let seq = 0
  const body = entries.map(e => {
    const head = e.posts[0]
    const href = e.project ? `projects/${e.project.id}.html` : `posts/${head.id}.html`
    const framesAll = e.posts.flatMap(p => p.images.map((_, i) => [p, i]))
    const chosen = marks[e.project?.id]?.preview
    const pickF = chosen ? framesAll.find(([p, i]) => p.id === chosen[0] && i === chosen[1] - 1) : framesAll[0]
    const openerPost = e.project ? e.posts.find(p => p.words > 30 && p.opening) ?? head : head
    const title = e.project ? e.project.title : head.label
    const meta = e.project ? `${e.posts.length} posts · ${rangeText(e.project)}` : dateText(head)
    const nums = e.posts.map(p => num.get(p.id))
    const tf = textFrame({ href, n: two(Math.max(...nums)), title, meta, opening: e.project?.line || openerPost.opening, stampPost: head, cls: framesAll.length ? '' : 'solo' })
    if (!pickF) return `<article class="entry">${tf}</article>`
    const lead = sheetFrame(pickF[0], pickF[1], e.project ? href : `posts/${pickF[0].id}.html`, '../../', { pick: true, load: sheetLoad(seq++) })
    const rest = framesAll.filter(f => f !== pickF).map(([p, i]) => sheetFrame(p, i, `posts/${p.id}.html`, '../../', { load: sheetLoad(seq++) }))
    return `<article class="entry"><div class="pair">${tf}${lead}</div>${rest.length ? `<div class="more">${rest.join('')}</div>` : ''}</article>`
  }).join('\n')
  const first = chrono[0], last = chrono.at(-1)
  return shell({
    title: AUTHOR, desc: `${total} posts, ${MONTHS[parts(first.date)[1] - 1]} ${parts(first.date)[0]} to ${MONTHS[parts(last.date)[1] - 1]} ${parts(last.date)[0]}`, depth: 0, cls: 'index', type: 'website',
    og: (() => { const p = data.posts.find(x => x.images[0]); const i = p.images[0]; return { src: i.src, web: `../../${i.src}`, w: i.w, h: i.h, alt: i.alt } })(),
    body: `<header class="sheet-head"><h1 class="home">${esc(AUTHOR)}</h1><p class="slate"><span>${total} strips</span><span>${first.date.slice(0, 4)}–${last.date.slice(0, 4)}</span></p></header>
<main class="sheet">
${body}
</main>`,
  }).replaceAll('="../../assets', '="assets')
}

function projectPage(project) {
  const sec = marks[project.id] ?? blank()
  const leads = []
  const posts = [...project.posts].reverse().map(id => byId.get(id))
  let seq = 0
  const runs = posts.map(p => {
    const postSec = marks[p.id] ?? blank()
    const tf = textFrame({ href: `../posts/${p.id}.html`, n: two(num.get(p.id)), title: p.label, meta: dateText(p), opening: p.opening, stampPost: p, cls: p.images.length ? '' : 'solo' })
    const frames = p.images.map((_, i) => sheetFrame(p, i, `../posts/${p.id}.html`, '../../../', { load: sheetLoad(seq++), sec: postSec, leads: [] })).join('')
    const pick = sec.picks.find(x => x.post === p.id)
    let q = ''
    if (pick) {
      const all = p.blocks.map(b => stripTags(b.html)).join('\n')
      if (!all.includes(pick.text)) throw new Error(`pick not verbatim: ${pick.text}`)
      const w = { kind: 'o', red: true, text: pick.word }
      q = `<a class="tf note" href="../posts/${p.id}.html"><span class="tf-q">${wrapWord(esc(pick.text).replaceAll('&quot;', '"'), w, p.id)}</span></a>`
    }
    return `<section class="run">${tf}${frames}${q}</section>`
  }).join('\n')
  for (const [a, b] of sec.chains) leads.push({ a: { w: wid(a) }, b: wid(b), rail: 1 })
  const opener = posts.find(p => p.images[0]) ?? posts[0]
  const sum = sec.preview ? byId.get(sec.preview[0]).images[sec.preview[1] - 1] : opener.images[0]
  const og = sum ? { src: sum.src, web: `../../${sum.src}`, w: sum.w, h: sum.h, alt: sum.alt } : ogFor(posts[0])
  const body = `<header class="sheet-head proj"><a class="home" href="../index.html">${esc(AUTHOR)}</a>
<h1>${esc(project.title)}</h1>${project.line ? `<p class="line">${esc(project.line)}</p>` : ''}
<p class="slate"><span>${posts.length} posts</span><span>${esc(rangeText(project))}</span></p></header>
<main class="sheet big" id="film">
${runs}
</main>
<footer class="sheet-foot"><a class="back" href="../index.html">Contact sheet</a></footer>`
  const desc = project.line ? `${project.line}. ${posts.length} posts, ${rangeText(project)}.` : `${posts.length} posts, ${rangeText(project)}.`
  return shell({ title: `${project.title} · ${AUTHOR}`, desc, og, depth: 1, body, cls: `project p-${project.id}`, leads, type: 'website' })
}

/* ---------- film stock, generated so its proportions are in one place ---------- */
function stock() {
  // Tile is one perforation pitch. KS perforation: 1.98 x 2.79 mm on a 4.75 mm pitch.
  const hole = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * .26}" fill="#060605"/>`
  const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`
  const P = 20, R = 26, along = P * .417, across = along * 1.41
  writeFileSync(join(here, 'assets/rail-l.svg'), svg(R, P, hole(2.5, (P - along) / 2, across, along)))
  writeFileSync(join(here, 'assets/rail-r.svg'), svg(R, P, hole(R - 2.5 - across, (P - along) / 2, across, along)))
  writeFileSync(join(here, 'assets/rail-t.svg'), svg(P, R, hole((P - along) / 2, 2.5, along, across)))
  writeFileSync(join(here, 'assets/rail-b.svg'), svg(P, R, hole((P - along) / 2, R - 2.5 - across, along, across)))
  const tile = (name, gauge) => {
    const rail = 30, pitch = 23, a = pitch * .417, c = a * 1.41, gap = 16, H = gauge + rail * 2
    writeFileSync(join(here, `assets/${name}.svg`), svg(pitch, H + gap, `<rect width="${pitch}" height="${H}" fill="#1b1916"/>` + hole((pitch - a) / 2, 3, a, c) + hole((pitch - a) / 2, H - 3 - c, a, c)))
  }
  tile('sheet-s', 200); tile('sheet-b', 300)
  const u = line(0, 4, 64, 4.5, { w: 2.2, seed: 11, bow: .01, wob: .9 })
  writeFileSync(join(here, 'assets/u.svg'), svg(64, 8, `<path fill="#ffd338" d="${u}"/>`))
}

/* ---------- write ---------- */
stock()
mkdirSync(join(here, 'posts'), { recursive: true })
mkdirSync(join(here, 'projects'), { recursive: true })
writeFileSync(join(here, 'index.html'), indexPage())
for (const p of data.posts) writeFileSync(join(here, 'posts', `${p.id}.html`), postPage(p))
for (const p of data.projects) writeFileSync(join(here, 'projects', `${p.id}.html`), projectPage(p))
console.log(`built ${data.posts.length} posts, ${data.projects.length} projects`)
