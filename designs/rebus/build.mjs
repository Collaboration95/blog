#!/usr/bin/env node
// Rebus. Reads content/posts.json and placements.txt, writes the whole site next to this file.
// No dependencies. Optional: SITE_URL=https://you.github.io/repo/concepts/rebus node build.mjs (absolute og:image).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { railHTML, RAIL_CSS } from '../../tools/series.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const data = JSON.parse(readFileSync(join(root, 'content/posts.json'), 'utf8'))
const site = (process.env.SITE_URL ?? '').replace(/\/$/, '')
const postById = new Map(data.posts.map(p => [p.id, p]))
const OPEN = '', SHUT = '' // a glyph waiting to be set, inside a text string
const mark = k => `${OPEN}${k}${SHUT}`
const markRe = new RegExp(`${OPEN}(\\d+)${SHUT}`, 'g')

/* ---------- small helpers ---------- */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = s => esc(s).replace(/"/g, '&quot;')
const strip = h => h.replace(/<[^>]+>/g, '')
const plain = h => strip(h).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parts = d => { const [y, m, n] = d.split('-').map(Number); return { y, m: months[m - 1], d: n } }
const when = p => { const t = parts(p.date); return p.dateApprox ? `c. ${t.m} ${t.y}` : `${t.d} ${t.m} ${t.y}` }
const whenShort = p => { const t = parts(p.date); return p.dateApprox ? `c. ${t.m}` : `${t.d} ${t.m}` }
const span = (a, b) => {
  const x = parts(a.date), y = parts(b.date)
  if (a.id === b.id) return when(a)
  if (!a.dateApprox && !b.dateApprox && x.m === y.m && x.y === y.y) return `${x.d} – ${y.d} ${y.m} ${y.y}`
  const left = a.dateApprox ? `c. ${x.m}` : `${x.d} ${x.m}`
  return `${left}${x.y === y.y ? '' : ` ${x.y}`} – ${when(b)}`
}
const num = s => s.replace(/\d+/g, '<i class="d">$&</i>')
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

/* ---------- placements.txt ---------- */
function readPlacements() {
  const posts = new Map(), projects = new Map()
  let cur = null
  for (const raw of readFileSync(join(here, 'placements.txt'), 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('@@ ')) { cur = { excerpt: 40 }; projects.set(line.slice(3).trim(), cur); continue }
    if (line.startsWith('@ ')) { cur = { fragments: [], gaps: new Set() }; posts.set(line.slice(2).trim(), cur); continue }
    if (!cur) throw new Error(`placements.txt: no post for "${line}"`)
    if (line.startsWith('/ ')) line.slice(2).trim().split(/\s+/).forEach(n => cur.gaps.add(Number(n)))
    else if (line.startsWith('picture ')) { const [, id, n] = line.split(/\s+/); cur.picture = { id, n: Number(n) } }
    else if (line.startsWith('excerpt ')) cur.excerpt = Number(line.split(/\s+/)[1])
    else cur.fragments.push(line)
  }
  return { posts, projects }
}
const hand = readPlacements()

/* ---------- measures: [[=]] reads the number just before it ---------- */
function reading(textBefore) {
  const money = textBefore.match(/\$([\d.,]+)$/)
  if (money) return { unit: '$', value: Number(money[1].replace(/,/g, '')), text: money[0] }
  const time = textBefore.match(/([\d.]+) (hours?|minutes?|seconds?)$/)
  if (time) return { unit: 's', value: Number(time[1]) * { h: 3600, m: 60, s: 1 }[time[2][0]], text: time[0] }
  throw new Error(`[[=]] with no number before it: "${textBefore.slice(-30)}"`)
}

/* ---------- the placement rule, for posts with no markers ---------- */
const stop = new Set('a an and are as at be but by can could did do for from had has have he her his i if in into is it its just me more my no not of on one or our out so some than that the their them then there they this to too up us was we were what when which who will with would you your about after again all also am any because been before being both each even few got how like made make many most much now off once only other over own same she should still such very while'.split(' '))
const clean = w => w.replace(/&[a-z]+;/g, '').replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%]+$/gu, '')
const stem = w => w.toLowerCase().slice(0, 5)

function slots(html, block) { // every place a glyph may stand in one paragraph: right after a word, before its punctuation
  const out = []
  let at = 0
  for (const piece of html.split(/(<a\b[^>]*>.*?<\/a>)/s)) {
    if (!piece.startsWith('<a')) for (const m of piece.matchAll(/\S+/g)) {
      const w = clean(m[0])
      if (!w) continue
      const tail = m[0].length - m[0].replace(/[.,;:!?)]+$/, '').length
      out.push({ block, offset: at + m.index + m[0].length - tail, word: w, tail })
    }
    at += piece.length
  }
  return out
}

function autoPlace(post, wanted, blocks) { // wanted: image numbers, 1-based. Returns {block, offset, n}
  const inText = []
  blocks.forEach((b, i) => {
    if (b.kind !== 'p') return
    const words = strip(b.html).split(/\s+/).length
    if (words < 6) return
    slots(b.html, i).forEach((s, k, all) => { if (k >= 2 && k < all.length - 1) inText.push(s) })
  })
  const chosen = []
  let last = -12
  wanted.forEach((n, i) => {
    const alt = new Set(post.images[n - 1].alt.toLowerCase().split(/\W+/).filter(w => w.length > 3).map(stem))
    const target = inText.length * (i + 0.45) / wanted.length
    let best = null, top = -Infinity
    inText.forEach((s, k) => {
      if (k < last + 12) return
      const low = s.word.toLowerCase()
      let score = -Math.abs(k - target) / Math.max(inText.length, 1) * 18
      if (stop.has(low) || /^\d/.test(low) || s.word.length < 3) score -= 30
      if (alt.has(stem(low))) score += 7
      if (/^\p{Lu}/u.test(s.word)) score += 0.6
      if (s.tail) score += 1 // the end of a clause reads as a natural pause, the picture takes it
      if (score > top) { top = score; best = k }
    })
    if (best === null) return
    last = best
    chosen.push({ ...inText[best], n })
  })
  return chosen
}

/* ---------- plan one post: where every glyph goes ---------- */
function plan(post) {
  const blocks = post.blocks.map(b => ({ ...b }))
  const glyphs = []
  const add = g => { glyphs.push(g); return mark(glyphs.length - 1) }
  const rules = hand.posts.get(post.id)
  const placedImages = new Set()

  for (const frag of rules?.fragments ?? []) {
    const bare = esc(frag.replace(/\[\[[^\]]*\]\]/g, ''))
    const block = blocks.find(b => b.html.replace(markRe, '').includes(bare))
    if (!block) throw new Error(`${post.id}: not verbatim in the post: "${frag}"`)
    // walk the fragment, marker by marker, through the block
    const start = (() => { // index in block.html where the bare fragment begins, ignoring marks already set
      const map = []
      block.html.split('').forEach((c, i) => { map.push(i) })
      const flat = block.html.replace(markRe, '')
      const hit = flat.indexOf(bare)
      let seen = 0, i = 0
      while (seen < hit) { if (block.html[i] === OPEN) { i = block.html.indexOf(SHUT, i) + 1; continue } seen++; i++ }
      return i
    })()
    let cursor = start, out = block.html.slice(0, start)
    for (const piece of frag.split(/(\[\[[^\]]*\]\])/)) {
      const m = piece.match(/^\[\[(.*)\]\]$/)
      if (m) {
        const key = m[1].trim()
        if (key === '=') {
          const r = reading(plain(out.replace(markRe, '')))
          out += add({ kind: 'measure', ...r })
        } else {
          const n = Number(key)
          if (!post.images[n - 1]) throw new Error(`${post.id}: no image ${n}`)
          placedImages.add(n)
          out += add({ kind: 'image', n })
        }
      } else {
        const len = esc(piece).length
        let taken = 0
        while (taken < len) {
          if (block.html[cursor] === OPEN) { const e = block.html.indexOf(SHUT, cursor) + 1; out += block.html.slice(cursor, e); cursor = e; continue }
          out += block.html[cursor]; cursor++; taken++
        }
      }
    }
    block.html = out + block.html.slice(cursor)
  }

  const missing = post.images.map((_, i) => i + 1).filter(n => !placedImages.has(n))
  if (missing.length) {
    const spots = autoPlace(post, missing, blocks).sort((a, b) => b.block - a.block || b.offset - a.offset)
    if (spots.length !== missing.length) throw new Error(`${post.id}: could not place every image`)
    for (const s of spots) {
      const b = blocks[s.block]
      b.html = b.html.slice(0, s.offset) + add({ kind: 'image', n: s.n }) + b.html.slice(s.offset)
    }
  }
  const top = {}
  for (const g of glyphs) if (g.kind === 'measure') top[g.unit] = Math.max(top[g.unit] ?? 0, g.value)
  for (const g of glyphs) if (g.kind === 'measure') {
    g.ratio = g.value / top[g.unit]
    const max = glyphs.find(x => x.unit === g.unit && x.value === top[g.unit])
    g.cap = g.value === top[g.unit] ? g.text : `${g.text} / ${max.text}`
  }
  return { post, blocks, glyphs, gaps: rules?.gaps ?? autoGaps(post) }
}

// No hand input: a blank line wherever a short run ends, so one-liners keep their rhythm and long paragraphs breathe.
function autoGaps(post) {
  const gaps = new Set()
  const size = post.blocks.map(b => strip(b.html).split(/\s+/).length)
  post.blocks.forEach((b, i) => {
    if (i === 0) return
    if (b.kind === 'heading' || b.kind === 'pre' || post.blocks[i - 1].kind === 'pre') gaps.add(i + 1)
    else if (size[i - 1] >= 22 || size[i] >= 30) gaps.add(i + 1)
  })
  return gaps
}

const plans = new Map(data.posts.map(p => [p.id, plan(p)]))

/* ---------- glyph html ---------- */
function setGlyph(g, post, R, id, lazy, opened = false, tail = '') {
  if (g.kind === 'measure') {
    const r = Math.round(g.ratio * 1e5) / 1e5
    return `<span class="g m" id="${id}" data-cap="${attr(g.cap)}" data-r="${r}"><a href="#${id}" role="button" aria-expanded="false" aria-label="${attr(g.cap)}, drawn to scale"><span class="bar" style="--r:${r}"></span></a></span>`
  }
  const img = post.images[g.n - 1]
  const src = `${R}../../${img.src}`
  const tag = `<img src="${attr(src)}" width="${img.w}" height="${img.h}" alt="${attr(img.alt)}"${lazy ? ' loading="lazy"' : ''}>`
  const data = `id="${id}" data-cap="${attr(img.alt)}" data-full="${attr(src)}"`
  if (!opened) return `<span class="g" ${data}><a href="#${id}" role="button" aria-expanded="false">${tag}</a></span>${tail}`
  // Already tapped: the same parts site.js makes on a tap (hole, the word's punctuation, picture, tab), so it closes the same way.
  const a = Math.round(img.w / img.h * 1e4) / 1e4
  return `<span class="mortise" style="--a:${a}" aria-hidden="true"></span>${tail}<span class="g open" ${data} style="--a:${a}"><a href="#${id}" role="button" aria-expanded="true">${tag}</a><span class="cap">${esc(img.alt)} <span class="size">${img.w} × ${img.h}</span></span></span><span class="tab" aria-hidden="true"></span>`
}
// A glyph is glued to the word before it and to the punctuation after it.
const glue = (html, set) => html.replace(new RegExp(`([^\\s<>]*)${OPEN}(\\d+)${SHUT}([.,;:!?)]*)`, 'g'), (_, word, k, tail) => `<span class="w">${word}${set(Number(k))}${tail}</span>`)

/* ---------- excerpts: the start of a post, trailing off ---------- */
const INK_STEPS = 7
function tokens(pl) {
  const out = []
  for (const b of pl.blocks) for (const w of strip(b.html).split(/\s+/)) if (w.replace(markRe, '')) out.push(w)
  return out
}
function excerpt(pl, words, { prefix, href, R, auto = 0, openFirst = false, eager = false }) {
  const all = tokens(pl)
  let cut = all.slice(0, words)
  const trailing = all.length > words
  let local = pl.glyphs
  const safe = cut.length - (trailing ? INK_STEPS + 1 : 0)
  if (auto) { // index: keep hand glyphs that fall inside, otherwise thread the first images through the opening
    const has = cut.some(w => w.includes(OPEN))
    if (!has && pl.post.images.length) {
      local = [...pl.glyphs]
      cut = cut.map(w => w.replace(markRe, ''))
      const n = Math.min(auto, pl.post.images.length, Math.max(1, Math.floor(safe / 8)))
      for (let i = 0; i < n; i++) {
        let k = Math.max(2, Math.floor(safe * (i + 0.45) / n))
        while (k < safe - 1 && (stop.has(clean(cut[k]).toLowerCase()) || !clean(cut[k]))) k++
        local.push({ kind: 'image', n: i + 1 })
        cut[k] = cut[k].replace(/([.,;:!?)]*)$/, `${mark(local.length - 1)}$1`)
      }
    }
  }
  if (openFirst) { // an open picture cuts the sentence hardest: it waits for the clause to end, if one ends before the next glyph
    const at = cut.findIndex(w => [...w.matchAll(markRe)].some(m => local[Number(m[1])].kind === 'image'))
    const hit = at < 0 ? null : [...cut[at].matchAll(markRe)].find(m => local[Number(m[1])].kind === 'image')
    if (hit && cut[at].endsWith(hit[0])) {
      for (let j = at + 1; j < safe && !cut[j].includes(OPEN); j++) {
        if (!clean(cut[j]) || !/[.,;:!?)]$/.test(cut[j])) continue
        cut[at] = cut[at].replace(hit[0], '')
        cut[j] = cut[j].replace(/([.,;:!?)]*)$/, `${hit[0]}$1`)
        break
      }
    }
  }
  const fadeFrom = trailing ? cut.length - INK_STEPS : Infinity
  let waiting = openFirst
  const set = (k, tail) => {
    const opened = waiting && local[k].kind === 'image'
    if (opened) waiting = false
    return setGlyph(local[k], pl.post, R, `${prefix}${k + 1}`, !(opened && eager), opened, tail)
  }
  const a = `<a href="${href}">`
  let html = '', open = false
  const on = () => { if (!open) { html += a; open = true } }
  const off = () => { if (open) { html += '</a>'; open = false } }
  cut.forEach((w, i) => {
    const space = i ? ' ' : ''
    const tone = i >= fadeFrom ? i - fadeFrom + 1 : 0
    if (w.includes(OPEN)) {
      const m = w.match(new RegExp(`^(.*?)${OPEN}(\\d+)${SHUT}(.*)$`))
      off()
      html += `${space}<span class="w">${a}${m[1]}</a>${set(Number(m[2]), m[3].replace(markRe, ''))}</span>`
    } else {
      on()
      const text = /\w\.[a-z]{2,}|\w\/\w/.test(w) ? `<span class="u">${w}</span>` : w // an address never takes a hyphen
      html += space + (tone ? `<span class="f${tone}">${text}</span>` : text)
    }
  })
  off()
  return html
}

// Where one entry ends the run breaks, and site.js steps the next entry out to the x the last one stopped at.
const SEAM = '<br><span class="tab" aria-hidden="true"></span>'

/* ---------- page shell ---------- */
function shell({ R, title, desc, ogImage, ogTitle, kind = 'website', body, cls }) {
  const image = ogImage ? (site ? `${site}/${ogImage.replace(/^(\.\.\/)+/, m => '')}` : `${R}${ogImage}`) : ''
  const meta = desc ? `<meta name="description" content="${attr(desc)}">
<meta property="og:title" content="${attr(ogTitle ?? title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:type" content="${kind}">
<meta property="og:site_name" content="${attr(data.site)}">${image ? `
<meta property="og:image" content="${attr(image)}">` : ''}
<meta name="twitter:card" content="summary_large_image">` : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#d4d4d4">
<title>${esc(title)}</title>
<meta name="author" content="${attr(data.author)}">
${meta}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23d4d4d4'/%3E%3Crect x='2' y='5' width='12' height='6' fill='%230b0b0b'/%3E%3C/svg%3E">
<script>document.documentElement.className='js'</script>
<link rel="stylesheet" href="${R}site.css">
<script src="${R}site.js" defer></script>
</head>
<body class="${cls}">
${body}
</body>
</html>
`
}

const description = p => { const s = p.opening.replace(/\s+/g, ' ').trim(); return s.length > 180 ? `${s.slice(0, 178).replace(/\s+\S*$/, '')}…` : s }
function ogFor(p) { // a rendered card if og.mjs has made one, otherwise the post's first picture
  if (existsSync(join(here, `og/${p.id}.png`))) return `og/${p.id}.png`
  return null
}
const firstPicture = (posts, R) => { for (const p of posts) if (p.images.length) return `../../${p.images[0].src}`; return null }

/* ---------- post page ---------- */
function postPage(pl) {
  const { post } = pl
  const R = '../'
  const project = post.project ? data.projects.find(p => p.id === post.project) : null
  const pictures = pl.glyphs.filter(g => g.kind === 'image').length
  const measures = pl.glyphs.length - pictures
  let seenWords = 0
  const set = k => {
    const g = pl.glyphs[k]
    const id = g.kind === 'image' ? `f${g.n}` : `m${pl.glyphs.filter((x, i) => x.kind === 'measure' && i <= k).length}`
    return setGlyph(g, post, R, id, seenWords > 70)
  }
  const blocks = pl.blocks.map((b, i) => {
    const n = i + 1
    const gap = pl.gaps.has(n) ? ' gap' : ''
    const number = `<a class="n" href="#p${n}" aria-label="Paragraph ${n}">${n}</a>`
    seenWords += strip(b.html).split(/\s+/).length
    if (b.kind === 'heading') return `<h2 id="p${n}" class="h${gap}">${number}${glue(b.html, set)}</h2>`
    if (b.kind === 'pre') return `<pre id="p${n}" class="${gap.trim()}">${b.html.split('\n').map(l => `<span>${l}</span>`).join('\n')}</pre>`
    const tag = i === 0 ? 'h1' : 'p'
    return `<${tag} id="p${n}" class="${glyphClass(b.html)}${gap}">${number}${glue(b.html, set)}</${tag}>`
  }).join('\n')

  const list = project ? project.posts.map(id => postById.get(id)) : data.posts
  const at = list.findIndex(p => p.id === post.id)
  const rail = railHTML(data, post).replace('<nav class="rail"', '<nav id="series" class="rail"')
  const near = (p, word) => {
    if (!p) return ''
    const lab = `${word}, ${whenShort(p)}`
    const pp = plans.get(p.id)
    return `<span class="e"><span class="w"><span class="v">${num(lab)}</span></span> ${excerpt(pp, 16, { prefix: `${word[0]}`, href: `${p.id}.html`, R })}</span>`
  }
  const newer = list[at - 1], older = list[at + 1]
  const seq = project ? `· ${list.length - at} of ${list.length}` : ''
  const count = pictures ? plural(pictures, 'picture') : measures ? plural(measures, 'measure') : ''
  const onlyThe = pictures ? 'p' : 'm'
  const body = `<header class="lab">
<a href="../index.html">${esc(data.site)}</a>
<span>${num(when(post))}</span>
${project ? `<a href="../projects/${project.id}.html">${esc(project.title)} ${num(seq)}</a>` : ''}
${count ? `<button class="all" type="button" data-only="${onlyThe}" data-label="${count}" hidden>Open ${count}</button>` : ''}
</header>
<main class="text">
<article>
${blocks}
</article>
</main>
${rail}
<footer>
<div class="lab">
${project ? `<a href="../projects/${project.id}.html">${esc(project.title)}</a>` : `<a href="../index.html">All posts</a>`}
</div>
<p class="run">${[near(newer, 'Newer'), near(older, 'Older')].filter(Boolean).join(SEAM)}</p>
</footer>`
  const ogImage = ogFor(post) ?? firstPicture([post], R)
  return shell({ R, title: `${post.label} · ${data.site}`, ogTitle: post.label, desc: description(post), ogImage, kind: 'article', body, cls: project ? 'post railed' : 'post' })
}
const glyphClass = html => (html.includes(OPEN) ? 'set' : '')

/* ---------- shared: the quiet marker that says a post belongs to a project ---------- */
// "14 Oct · The Commons · 4 of 4": the date, then where in the project it sits (oldest = 1). The project part links to its page.
function label(p, R) {
  const t = parts(p.date).y === 2026 ? whenShort(p) : when(p)
  if (!p.project) return num(t)
  const project = data.projects.find(x => x.id === p.project)
  const at = project.posts.length - project.posts.indexOf(p.id)
  return `${num(t)} · <a href="${R}projects/${project.id}.html">${esc(project.title)} · ${num(`${at} of ${project.posts.length}`)}</a>`
}

/* ---------- project page ---------- */
function projectPage(project) {
  const R = '../'
  const rules = hand.projects.get(project.id) ?? {}
  const posts = project.posts.map(id => postById.get(id))
  const oldestFirst = [...posts].reverse()
  const dates = span(oldestFirst[0], posts[0])
  const pick = rules.picture ? { post: postById.get(rules.picture.id), n: rules.picture.n }
    : (() => { const p = posts.find(x => x.images.length); return p ? { post: p, n: 1 } : null })()
  const titleGlyph = pick ? setGlyph({ kind: 'image', n: pick.n }, pick.post, R, 'top', false) : ''
  const head = `<h1 class="set"><span class="w">${esc(project.title)}${titleGlyph}</span>${project.line ? ` ${esc(project.line)}` : ''}</h1>`
  // Each post is its own entry, oldest first, in the index's running paragraph.
  let eager = true
  const rows = oldestFirst.map((p, i) => {
    const pl = plans.get(p.id)
    const o = { R, openFirst: true, eager }; if (p.images.length) eager = false
    const text = excerpt(pl, 28, { ...o, prefix: `${p.id}-`, href: `../posts/${p.id}.html`, auto: 3 })
    return `<span class="e"><span class="w"><span class="v">${num(`${i + 1} of ${oldestFirst.length}, ${whenShort(p)}`)}</span></span> ${text}</span>`
  }).join(SEAM)
  const body = `<header class="lab">
<a href="../index.html">${esc(data.site)}</a>
<span>${num(dates)}</span>
</header>
<main class="text project">
${head}
<p class="run">${rows}</p>
</main>
<footer>
<div class="lab">
<a href="../index.html">All posts</a>
</div>
</footer>`
  const lead = posts[0]
  const ogPath = existsSync(join(here, `og/${project.id}.png`)) ? `og/${project.id}.png` : firstPicture(rules.picture ? [postById.get(rules.picture.id), ...posts] : posts, R)
  const desc = project.line ? `${project.title}, ${project.line}` : description(lead)
  return shell({ R, title: `${project.title} · ${data.site}`, ogTitle: project.title, desc, ogImage: ogPath, body, cls: 'proj' })
}

/* ---------- index: every post is its own entry, newest first ---------- */
function indexPage() {
  const R = ''
  let eager = true // only the first open picture is sure to be on the first screen
  const rows = data.posts.map(p => {
    const pl = plans.get(p.id)
    const o = { R, openFirst: true, eager }; if (p.images.length) eager = false
    return `<span class="e"><span class="w"><span class="v">${label(p, R)}</span></span> ${excerpt(pl, 28, { ...o, prefix: `${p.id}-`, href: `posts/${p.id}.html`, auto: 3 })}</span>`
  })
  const body = `<header class="lab">
<a href="index.html" aria-current="page">${esc(data.site)}</a>
</header>
<main class="text">
<p class="run">${rows.join(SEAM)}</p>
</main>`
  return shell({ R, title: data.site, desc: `Posts from ${data.site}, newest first.`, body, cls: 'index', ogImage: existsSync(join(here, 'og/index.png')) ? 'og/index.png' : null })
}

/* ---------- write ---------- */
mkdirSync(join(here, 'posts'), { recursive: true })
mkdirSync(join(here, 'projects'), { recursive: true })
writeFileSync(join(here, 'index.html'), indexPage())
{ // site.css is hand-written; the shared rail base is spliced in between its two markers, and the overrides follow them.
  const css = readFileSync(join(here, 'site.css'), 'utf8')
  const [a, b] = ['/* rail:base */', '/* rail:end */']
  writeFileSync(join(here, 'site.css'), css.slice(0, css.indexOf(a) + a.length) + RAIL_CSS + css.slice(css.indexOf(b)))
}
for (const p of data.projects) writeFileSync(join(here, `projects/${p.id}.html`), projectPage(p))
for (const pl of plans.values()) writeFileSync(join(here, `posts/${pl.post.id}.html`), postPage(pl))
console.log(`built ${data.posts.length} posts, ${data.projects.length} projects, index`)
