#!/usr/bin/env node
// Sets the whole paper from content/posts.json and desk.md. Zero dependencies.
//   node concepts/broadsheet/build.mjs
//   SITE_URL=https://example.github.io/repo/concepts/broadsheet node ...   for absolute og:image
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const data = JSON.parse(readFileSync(join(root, 'content/posts.json'), 'utf8'))
const SITE = (process.env.SITE_URL ?? '').replace(/\/$/, '')
const AUTHOR = data.author
const posts = data.posts
const byId = Object.fromEntries(posts.map(p => [p.id, p]))
const projects = Object.fromEntries(data.projects.map(p => [p.id, p]))

// ---- helpers ---------------------------------------------------------------

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const words = s => s.trim().split(/\s+/).filter(Boolean)
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ymd = s => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() } }
const mon = m => MONTH[m].slice(0, 3)
const short = p => { const t = ymd(p.date); return p.dateApprox ? `c. ${mon(t.m)} ${t.y}` : `${t.d} ${mon(t.m)} ${t.y}` }
const long = p => { const t = ymd(p.date); return p.dateApprox ? `c. ${mon(t.m)} ${t.y}` : `${DAY[t.wd]} ${t.d} ${MONTH[t.m]} ${t.y}` }

// Pages count up from the oldest post, so a new post never renumbers the paper.
const pageOf = Object.fromEntries(posts.map((p, i) => [p.id, posts.length - i]))
const inOrder = [...posts].reverse()

function range(pr) {
  const list = pr.posts.map(id => byId[id])
  const newest = list[0], oldest = list[list.length - 1]
  const a = ymd(oldest.date), b = ymd(newest.date)
  if (newest.dateApprox || oldest.dateApprox) {
    const from = oldest.dateApprox ? `c. ${mon(a.m)}` : `${a.d} ${mon(a.m)}`
    return (a.m === b.m && oldest.dateApprox) ? `c. ${mon(b.m)} ${b.y}` : `${from} – c. ${mon(b.m)} ${b.y}`
  }
  if (a.y === b.y && a.m === b.m) return a.d === b.d ? `${a.d} ${mon(a.m)} ${a.y}` : `${a.d}–${b.d} ${mon(a.m)} ${a.y}`
  if (a.y === b.y) return `${a.d} ${mon(a.m)} – ${b.d} ${mon(b.m)} ${b.y}`
  return `${a.d} ${mon(a.m)} ${a.y} – ${b.d} ${mon(b.m)} ${b.y}`
}

function pagesOf(pr) {
  const ns = pr.posts.map(id => pageOf[id]).sort((a, b) => a - b)
  const contiguous = ns.every((n, i) => !i || n === ns[i - 1] + 1)
  return contiguous ? `pages ${ns[0]}–${ns[ns.length - 1]}` : `pages ${ns.join(', ')}`
}

// ---- the desk --------------------------------------------------------------

function readDesk() {
  const desk = { print: {}, preview: {}, posts: {}, projects: {} }
  let sec = null
  for (const raw of readFileSync(join(here, 'desk.md'), 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('# ')) continue
    if (line.startsWith('## ')) {
      const name = line.slice(3).trim()
      if (name === 'print' || name === 'preview') sec = { kind: name }
      else if (name.startsWith('project ')) sec = desk.projects[name.slice(8)] = { lead: null, show: [] }
      else sec = desk.posts[name] = { cuts: [], bars: {}, roles: {} }
      continue
    }
    if (!sec) continue
    if (sec.kind === 'print') { const [mode, path] = line.split(/\s+/); desk.print[path] = mode; continue }
    if (sec.kind === 'preview') { const [id, path] = line.split(/\s+/); desk.preview[id] = path; continue }
    if (sec.show) {
      const [verb, a, ...rest] = line.split(/\s+/)
      if (verb === 'lead') sec.lead = a
      if (verb === 'show') sec.show.push({ id: a, images: rest })
      continue
    }
    const cut = line.match(/^!\[(\d+)((?:\s+\w+)*)\]\((.+)\)$/)
    if (cut) { sec.cuts.push({ n: cut[1], flags: words(cut[2]), after: cut[3] }); continue }
    const [verb, ...rest] = line.split(/\s+/)
    if (verb === 'cols') sec.cols = +rest[0]
    else if (verb === 'bar') {
      const [v, max] = rest[1].split('/').map(Number)
      ;(sec.bars[rest[0]] ??= []).push(v / max)
    } else for (const n of rest) sec.roles[n] = verb
  }
  return desk
}
const desk = readDesk()

const PRINTS = ['reverse', 'line', 'slide', 'photo']
const imageKey = img => img.src.replace('content/posts/', '').replace('.webp', '')
// Dots threshold away anything fine, so a picture of a screen goes on the press
// as `slide`: tone kept, dots only over it. The desk can overrule per image.
const SCREEN = /\b(slide|screen|projector)\b/i
const printOf = (img, flags = []) => flags.find(f => PRINTS.includes(f)) ?? desk.print[imageKey(img)] ?? (SCREEN.test(img.alt) ? 'slide' : 'photo')

// ---- automatic cuts: where an image goes when the desk says nothing ---------

const STOP = new Set('the a an of on in to and with for from at by is are was were how that this it its'.split(' '))
const keys = s => new Set(words(s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ')).filter(w => w.length > 2 && !STOP.has(w)))

// A band stops the columns and starts them again, so it needs text on both
// sides or it leaves a strip of two-line columns. One band per 170 words; the
// pictures that need the size most get them: diagrams and screens before photos.
const isWide = img => img.w >= img.h * 1.15
function banded(post) {
  const need = img => ({ line: 0, reverse: 1, slide: 1, photo: 2 })[printOf(img)]
  const room = Math.floor(post.words / 170)
  return new Set(post.images.filter(isWide).sort((a, b) => need(a) - need(b)).slice(0, room))
}

// Each image goes to the paragraph that talks about it most, nudged toward an
// even spread down the story, and cuts in at the first comma or full stop past
// a third of the way through. A short paragraph takes the image at its end.
// Bands only land in the middle of the story, for the same reason as above.
function autoCuts(post) {
  const ps = post.blocks.map((b, i) => ({ ...b, i })).filter(b => b.kind === 'p' && b.i > 0)
  if (!ps.length) return []
  const total = ps.reduce((n, p) => n + words(plain(p.html)).length, 0)
  let seen = 0
  for (const p of ps) { p.from = seen / total; seen += words(plain(p.html)).length }
  const bands = banded(post)
  const used = new Set()
  return post.images.map((img, k) => {
    const band = bands.has(img)
    const want = (k + 1) / (post.images.length + 1)
    const alt = keys(img.alt)
    const pool = band ? ps.filter(p => p.from >= .25 && p.from <= .7) : ps
    let best = null, bestScore = -Infinity
    ;(pool.length ? pool : ps).forEach(p => {
      const text = keys(plain(p.html))
      let overlap = 0
      for (const w of alt) if (text.has(w)) overlap++
      const score = overlap * 2 - Math.abs(ps.indexOf(p) / ps.length - want) * 6 - (used.has(p.i) ? 4 : 0)
      if (score > bestScore) { bestScore = score; best = p }
    })
    used.add(best.i)
    return { n: img.src.match(/(\d+)\.webp$/)[1], flags: band ? ['wider'] : [], block: best.i, at: cutPoint(best.html) }
  })
}

function cutPoint(html) {
  if (plain(html).length < 90) return html.length
  const from = Math.floor(html.length / 3)
  const re = /[.,] /g
  re.lastIndex = from
  for (let m; (m = re.exec(html));) {
    const before = html.slice(0, m.index)
    const inLink = before.lastIndexOf('<a ') > before.lastIndexOf('</a>')
    if (before.lastIndexOf('<') <= before.lastIndexOf('>') && !inLink) return m.index + 1
  }
  return html.length
}

// ---- pieces ----------------------------------------------------------------

// Headline size goes with 1/sqrt(length), so every headline covers about the
// same area of paper: a long first line sets smaller and runs more lines, a short
// one sets larger and runs fewer. Nothing becomes a wall or a stub, and the text
// starts at about the same height on every page. 1 is the largest size, at 32 characters.
const fit = n => `--fit:${Math.min(1, Math.sqrt(32 / n)).toFixed(3)}`

function picture(img, up, { lazy = true, print } = {}) {
  return `<span class="ht ${print}"><img src="${up}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}"${lazy ? ' loading="lazy"' : ''}></span>`
}

// A one-column figure sits in the column. `wide` and `wider` go in a band
// across the story (see .cut); figures cut at the same phrase share one band.
function figure(img, up, n, flags, lazy) {
  const print = printOf(img, flags)
  const tall = img.h > img.w ? ' tall' : ''
  // Grey loses these prints' colour keys, so the caption says where to find them.
  const colour = ['line', 'reverse'].includes(print) ? ' data-more="Opens in colour."' : ''
  return `<button type="button" class="fig${tall}" id="fig-${n}" popovertarget="plate-${n}" style="--r:${(img.w / img.h).toFixed(3)}">${picture(img, up, { lazy, print })}<span class="cap" data-n="Fig. ${n}" data-cap="${esc(img.alt)}"${colour}></span></button>`
}

function band(figs) {
  const [only] = figs
  const s = figs.length > 1 ? '' : ` solo" style="--s:${only.flags.includes('wider') ? (only.img.w >= only.img.h * 2 ? 4 : 3) : 2}`
  return `<span class="brk"></span><span class="cut${s}">${figs.map(f => f.html).join('')}</span>`
}

function plate(img, up, n) {
  const land = img.w > img.h ? ' land' : ''
  return `<div popover id="plate-${n}" class="plate${land}" style="--r:${(img.w / img.h).toFixed(3)}"><button type="button" popovertarget="plate-${n}" popovertargetaction="hide"><img src="${up}${img.src}" width="${img.w}" height="${img.h}" alt="${esc(img.alt)}" loading="lazy"><span class="plate-cap">Fig. ${n}. ${esc(img.alt)}</span></button></div>`
}

const bar = v => {
  const pct = Math.round(v * 10000) / 100
  return `<span class="bar" style="--v:${pct}%" role="img" aria-label="Rule drawn to scale: ${pct}% of full length"></span>`
}

function dropCap(html) {
  const m = html.match(/^(["“'(]?[\p{L}\p{N}])/u)
  return m ? `<span class="dc">${m[1]}</span>${html.slice(m[1].length)}` : html
}

const graf = i => `<a class="graf" href="#p${i}" data-n="${i}" aria-label="Link to paragraph ${i}"></a>`

function isUrlish(html) {
  const longest = Math.max(0, ...[...html.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map(m => m[1].length))
  return longest > 24
}

// Set the body of a post: paragraphs with their cuts, bars and roles.
function setBody(post, up) {
  const d = desk.posts[post.id] ?? { cuts: [], bars: {}, roles: {} }
  const roles = d.roles
  const cuts = {}
  const place = (block, at, html) => { (cuts[block] ??= []).push({ at, html }) }
  const order = []

  const planned = d.cuts.length ? d.cuts.map(c => {
    const img = post.images.find(i => i.src.endsWith(`/${c.n}.webp`))
    if (!img) throw new Error(`${post.id}: no image ${c.n}`)
    const block = post.blocks.findIndex((b, i) => i > 0 && b.html.includes(c.after))
    if (block < 0) throw new Error(`${post.id}: phrase not found: ${c.after}`)
    return { img, flags: c.flags, block, at: post.blocks[block].html.indexOf(c.after) + c.after.length }
  }) : autoCuts(post).map(c => ({ img: post.images.find(i => i.src.endsWith(`/${c.n}.webp`)), flags: c.flags, block: c.block, at: c.at }))

  planned.sort((a, b) => a.block - b.block || a.at - b.at)
  const spans = c => c.flags.includes('wide') || c.flags.includes('wider')
  const bands = []
  planned.forEach((c, k) => {
    const n = k + 1
    order.push({ img: c.img, n })
    const html = figure(c.img, up, n, c.flags, k > 0)
    if (!spans(c)) { place(c.block, c.at, html); return }
    const last = bands.at(-1)
    if (last && last[0].block === c.block && last[0].at === c.at) last.push({ ...c, html })
    else bands.push([{ ...c, html }])
  })
  for (const b of bands) place(b[0].block, b[0].at, band(b))

  const lede = Object.keys(roles).find(k => roles[k] === 'lede')
    ?? String(post.blocks.findIndex((b, i) => i > 0 && b.kind === 'p' && !roles[i]))

  const para = (b, i, cls = []) => {
    let html = b.html
    const list = (cuts[i] ?? []).sort((x, y) => y.at - x.at)
    for (const c of list) {
      // The text after a cut goes on as the same paragraph: no indent under the
      // figure. On a phone the figure floats and .run is plain inline text.
      const rest = html.slice(c.at), gap = rest.match(/^\s*/)[0], tail = rest.slice(gap.length)
      html = html.slice(0, c.at) + gap + c.html + (tail ? `<span class="run">${tail}</span>` : '')
    }
    if (String(i) === lede) { html = `<span class="dl">${esc(short(post))} — </span>${dropCap(html)}`; cls.push('lede') }
    if (isUrlish(b.html)) cls.push('rag')
    if (b.html.length < 2) cls.push('rag')
    const c = cls.length ? ` class="${cls.join(' ')}"` : ''
    return `<p id="p${i}"${c}>${graf(i)}${html}</p>${(d.bars[i] ?? []).map(bar).join('')}`
  }

  const out = []
  for (let i = 1; i < post.blocks.length; i++) {
    const b = post.blocks[i], role = roles[i]
    if (role === 'deck' || role === 'refer') continue
    if (b.kind === 'heading') { out.push(`<h2 class="cross" id="p${i}">${b.html}</h2>`); continue }
    if (b.kind === 'pre') { out.push(`<div class="pre" id="p${i}"><pre>${b.html}</pre></div>`); continue }
    if (role === 'stair' || role === 'list') {
      const run = []
      while (roles[i] === role) run.push(para(post.blocks[i], i++))
      i--
      out.push(role === 'stair' ? `<div class="stair">${run.join('')}</div>` : `<div class="list">${run.join('')}</div>`)
      continue
    }
    if (role === 'big') { out.push(`<div class="big">${para(b, i)}</div>`); continue }
    out.push(para(b, i))
  }

  const pull = role => Object.keys(roles).filter(k => roles[k] === role).map(k => `<p id="p${k}">${post.blocks[k].html}</p>`).join('')
  const deck = pull('deck'), refer = pull('refer')
  return {
    html: out.join('\n'),
    deck: deck ? `<div class="deck">${deck}</div>` : '',
    refer: refer ? `<div class="refer">${refer}</div>` : '',
    plates: order.map(o => plate(o.img, up, o.n)).join(''),
    cols: d.cols,
    hasDl: true,
  }
}

// Columns come from how much there is to set. A story with pictures takes fewer,
// because a band needs its text deep enough on either side.
function colsFor(post) {
  if (post.images.length) {
    // Three leave two columns for the rail, so they need a rail worth reading
    // beside a tall story: an empty one is a blank third of the page.
    const tall = banded(post).size > 0
    return !tall || (post.project && post.words < 260) ? 3 : 4
  }
  const area = post.words + post.blocks.filter(b => b.kind !== 'p').length * 40
  return Math.max(3, Math.min(5, Math.ceil(area / 90)))
}

// ---- page shell ------------------------------------------------------------

function shell({ title, desc, up, image, body, cls = '', canonical }) {
  const img = image ? (SITE ? `${SITE}/${image.abs}` : `${up}${image.rel}`) : ''
  const url = SITE && canonical ? `<meta property="og:url" content="${SITE}/${canonical}">` : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${img ? `<meta property="og:image" content="${img}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
${url}
<meta name="theme-color" content="#dfdfd9">
<link rel="stylesheet" href="${up}style.css">
</head>
<body class="${cls}">
${body}
</body>
</html>
`
}

const description = s => {
  const t = plain(s).replace(/\s+/g, ' ').trim()
  if (t.length <= 155) return t
  return t.slice(0, 155).replace(/\s+\S*$/, '') + '…'
}

function ogImage(post) {
  const relUp = ''
  if (post?.images?.length) return { rel: `../../${post.images[0].src}`, abs: `../../${post.images[0].src}` }
  if (post && existsSync(join(here, `og/${post.id}.png`))) return { rel: `${relUp}og/${post.id}.png`, abs: `og/${post.id}.png` }
  return existsSync(join(here, 'og/paper.png')) ? { rel: `${relUp}og/paper.png`, abs: 'og/paper.png' } : null
}

const folio = (up, mid, right) => `<header class="folio"><a class="name" href="${up}index.html">${esc(AUTHOR)}</a><span class="mid">${mid}</span><span class="pg">${right}</span></header>`

// ---- rail: where this post sits ---------------------------------------------

function series(post) {
  if (!post.project) return ''
  const pr = projects[post.project]
  const rows = pr.posts.map(id => {
    const p = byId[id]
    const here = id === post.id
    const name = esc(p.label)
    return `<li${here ? ' aria-current="page"' : ''}><a href="${id}.html"><span class="n">${pageOf[id]}</span><span class="t">${name}</span><span class="d">${esc(short(p))}</span></a></li>`
  }).join('')
  return `<section class="series"><h2><a href="../projects/${pr.id}.html">${esc(pr.title)}</a></h2><ol>${rows}</ol></section>`
}

function turn(post) {
  const i = inOrder.findIndex(p => p.id === post.id)
  const prev = inOrder[i - 1], next = inOrder[i + 1]
  const link = (p, rel) => p ? `<a rel="${rel}" href="${p.id}.html"><span class="pgn">Page ${pageOf[p.id]}</span><span class="t">${esc(p.label)}</span></a>` : '<span></span>'
  return `<nav class="turn" aria-label="Previous and next page">${link(prev, 'prev')}${link(next, 'next')}</nav>`
}

// ---- post page ---------------------------------------------------------------

function postPage(post) {
  const up = '../'
  const imgUp = '../../../'
  const pr = post.project ? projects[post.project] : null
  const part = pr ? pr.posts.length - pr.posts.indexOf(post.id) : 0
  const source = post.linkedin ? `<a class="src" href="${esc(post.linkedin)}">LinkedIn</a>` : ''
  const head0 = post.blocks[0].html
  const slug = pr
    ? `<a href="../projects/${pr.id}.html">${esc(pr.title)}</a><span>Part ${part} of ${pr.posts.length}</span>`
    : `<span>${esc(post.label)}</span>`

  if (post.kind === 'repost') {
    const body = `${folio(up, esc(long(post)), `Page ${pageOf[post.id]} of ${posts.length}`)}
<main class="page classified-page" style="--cols:3">
  <p class="slug">${slug}</p>
  <article class="ad"><h1 class="hed" id="p0" style="${fit(plain(head0).length)}">${head0}</h1><p class="ad-d">${esc(short(post))}</p></article>
  <aside class="rail">${series(post)}${turn(post)}</aside>
</main>`
    return shell({ title: `${post.label}, ${AUTHOR}`, desc: description(head0), up, image: ogImage(post), body, canonical: `posts/${post.id}.html` })
  }

  const s = setBody(post, imgUp)
  const n = plain(head0).length
  const cols = s.cols ?? colsFor(post)
  const body = `${folio(up, esc(long(post)), `Page ${pageOf[post.id]} of ${posts.length}`)}
<main class="page" style="--cols:${cols}">
  <header class="head">
    <p class="slug">${slug}</p>
    <h1 class="hed" id="p0" style="${fit(n)}">${head0}</h1>
    ${s.deck}
    ${s.refer}
  </header>
  <article class="body">
    <div class="story">
${s.html}
    </div>
    <footer class="end"><span class="thirty">— 30 —</span>${source}</footer>
  </article>
  <aside class="rail">${series(post)}${turn(post)}</aside>
</main>
<div class="plates">${s.plates}</div>`
  return shell({ title: `${post.label}, ${AUTHOR}`, desc: description(head0), up, image: ogImage(post), body, canonical: `posts/${post.id}.html` })
}

// ---- entries on the front page and on project pages --------------------------

// The start of a post, cut at a word count. It stops where the column stops,
// mid-sentence, and the jump line picks it up.
function trail(post, budget, from = 0) {
  let left = budget
  const out = []
  for (const b of post.blocks.slice(from)) {
    if (b.kind !== 'p' || left <= 0) continue
    const w = plain(b.html).split(/(\s+)/)
    const count = w.filter(x => x.trim()).length
    if (count <= left) { out.push(esc(plain(b.html))); left -= count; continue }
    let kept = '', n = 0
    for (const piece of w) { if (piece.trim() && ++n > left) break; kept += piece }
    out.push(esc(kept.trimEnd()))
    left = 0
  }
  return out.map(t => `<p>${t}</p>`).join('')
}

const entryImage = list => {
  for (const p of list) if (p.images.length) return p.images[0]
  return null
}

function entries() {
  const seen = new Set()
  const out = []
  for (const p of posts) {
    if (p.project) {
      const pr = projects[p.project]
      if (pr.posts.length > 1) {
        if (seen.has(pr.id)) continue
        seen.add(pr.id)
        const list = pr.posts.map(id => byId[id])
        const key = desk.preview[pr.id]
        const img = key ? posts.flatMap(x => x.images).find(i => imageKey(i) === key) : entryImage(list)
        const lead = list.find(x => x.kind !== 'repost')
        out.push({
          href: `projects/${pr.id}.html`, title: pr.title, deck: pr.line, img, post: lead, from: 0, isProject: true,
          meta: `${pr.posts.length} posts, ${range(pr)}`, jump: `Continued on ${pagesOf(pr)}`,
        })
        continue
      }
    }
    out.push({
      href: `posts/${p.id}.html`, title: plain(p.blocks[0].html), deck: '', img: p.images[0] ?? null, post: p, from: 1,
      meta: short(p), jump: `Continued on page ${pageOf[p.id]}`,
    })
  }
  return out
}

function cell(e, size, { lazy = true, up = '../../' } = {}) {
  const budget = { lead: 150, pic: 62, half: 70, rail: 44, brief: 34 }[size]
  const pic = e.img ? `<a class="pic" href="${e.href}" tabindex="-1" aria-hidden="false">${picture(e.img, up, { lazy, print: printOf(e.img) })}</a>` : ''
  const hc = e.isProject ? ' p-hed' : `" style="${fit(e.title.length)}`
  const body = `<p class="meta">${esc(e.meta)}</p>
<h2 class="hed${hc}"><a href="${e.href}">${esc(e.title)}</a></h2>
${e.deck ? `<p class="line">${esc(e.deck)}</p>` : ''}`
  const text = `<div class="trail">${trail(e.post, budget, e.from)}<a class="jump" href="${e.href}">${esc(e.jump)}</a></div>`
  if (size === 'lead') return `<article class="e lead">${body}<div class="lead-row">${text}${pic}<div class="lead-rail"></div></div></article>`
  return `<article class="e ${size}">${size === 'pic' || size === 'half' ? pic + body : body + pic}${text}</article>`
}

// Imposition: walk the entries newest first and pack each run into a band of
// six columns. Pictures take four columns, or three when two pictures meet.
// Text-only entries stack in a two-column rail beside the next picture, or
// fill a band of briefs when there are more than a rail can hold.
function impose(list) {
  const bands = []
  let i = 0
  const text = k => list[k] && !list[k].img
  const pic = k => list[k] && list[k].img
  while (i < list.length) {
    if (pic(i) && pic(i + 1)) {
      bands.push(`<section class="band"><div class="s3">${cell(list[i], 'half')}</div><div class="s3">${cell(list[i + 1], 'half')}</div></section>`)
      i += 2
    } else if (pic(i)) {
      const rail = []
      let k = i + 1
      while (text(k) && rail.length < 2) rail.push(list[k++])
      if (rail.length) bands.push(`<section class="band"><div class="s4">${cell(list[i], 'pic')}</div><div class="s2 stack">${rail.map(e => cell(e, 'rail')).join('')}</div></section>`)
      else bands.push(`<section class="band"><div class="s6">${cell(list[i], 'pic')}</div></section>`)
      i = k
    } else {
      let k = i
      while (text(k)) k++
      const run = k - i
      if (run >= 3 || k === list.length) {
        const take = Math.min(run, 4)
        const span = { 1: 's6', 2: 's3', 3: 's2', 4: 's15' }[take]
        bands.push(`<section class="band briefs">${list.slice(i, i + take).map(e => `<div class="${span}">${cell(e, 'brief')}</div>`).join('')}</section>`)
        i += take
      } else {
        bands.push(`<section class="band"><div class="s2 stack">${list.slice(i, k).map(e => cell(e, 'rail')).join('')}</div><div class="s4">${cell(list[k], 'pic')}</div></section>`)
        i = k + 1
      }
    }
  }
  return bands.join('\n')
}

function classifieds(up) {
  const ads = posts.filter(p => p.kind === 'repost')
  if (!ads.length) return ''
  return `<section class="classifieds"><h2>Classifieds</h2><div class="ads">${ads.map(p => `<a class="ad" href="${up}posts/${p.id}.html"><p>${esc(plain(p.blocks[0].html))}</p><p class="ad-d">${esc(short(p))}, page ${pageOf[p.id]}</p></a>`).join('')}</div></section>`
}

// ---- front page -----------------------------------------------------------------

function frontPage() {
  const list = entries()
  const [lead, ...rest] = list
  // The two entries after the lead take the outer column beside the picture.
  const side = []
  let k = 0
  while (k < rest.length && side.length < 2 && !rest[k].img) side.push(rest[k++])
  if (!side.length) side.push(rest[k++])
  const leadHtml = cell(lead, 'lead', { lazy: false }).replace('<div class="lead-rail"></div>', `<div class="lead-rail">${side.map(e => cell(e, 'brief')).join('')}</div>`)
  const oldest = inOrder[0], newest = posts[0]
  const span = `${mon(ymd(oldest.date).m)} ${ymd(oldest.date).y} to ${mon(ymd(newest.date).m)} ${ymd(newest.date).y}`
  const body = `${folio('', `${posts.length} posts`, esc(span))}
<main class="front">
<section class="band top">${leadHtml}</section>
${impose(rest.slice(k))}
${classifieds('')}
</main>`
  return shell({
    title: AUTHOR, desc: `${posts.length} posts by ${AUTHOR}.`, up: '', image: ogImage(null), body,
    cls: 'is-front', canonical: 'index.html',
  })
}

// ---- project page ----------------------------------------------------------------

function projectPage(pr) {
  const up = '../'
  const imgUp = '../../../'
  const d = desk.projects[pr.id]
  const list = pr.posts.map(id => byId[id])
  const leadImg = d?.lead ? posts.flatMap(p => p.images).find(i => imageKey(i) === d.lead) : entryImage(list)
  const items = list.map(p => {
    const rule = d?.show.find(s => s.id === p.id)
    const imgs = rule ? rule.images.map(n => p.images.find(i => i.src.endsWith(`/${n}.webp`))) : p.images.slice(0, 1)
    if (p.kind === 'repost') return `<article class="item item-ad"><a class="ad" href="../posts/${p.id}.html"><p>${esc(plain(p.blocks[0].html))}</p><p class="ad-d">${esc(short(p))}, page ${pageOf[p.id]}</p></a></article>`
    const pics = imgs.length ? `<a class="pics n${imgs.length}" href="../posts/${p.id}.html">${imgs.map(i => picture(i, imgUp, { print: printOf(i) })).join('')}</a>` : ''
    const title = plain(p.blocks[0].html)
    return `<article class="item${imgs.length ? ' has-pic' : ''}">
<p class="meta"><span>${esc(short(p))}</span><span>Page ${pageOf[p.id]}</span></p>
<h2 class="hed" style="${fit(title.length)}"><a href="../posts/${p.id}.html">${esc(title)}</a></h2>
${pics}
<div class="trail">${trail(p, imgs.length ? 80 : 56, 1)}<a class="jump" href="../posts/${p.id}.html">Continued on page ${pageOf[p.id]}</a></div>
</article>`
  }).join('\n')
  const body = `${folio(up, esc(range(pr)), `${pr.posts.length} posts`)}
<main class="section">
<header class="sect-head${leadImg ? ' has-pic' : ''}">
  <h1 class="hed p-top" style="--w:${Math.max(...words(pr.title).map(w => w.length))}">${esc(pr.title)}</h1>
  ${pr.line ? `<p class="line">${esc(pr.line)}</p>` : ''}
  ${leadImg ? `<div class="sect-pic">${picture(leadImg, imgUp, { lazy: false, print: printOf(leadImg) })}</div>` : ''}
</header>
<div class="items">
${items}
</div>
</main>`
  const firstImg = list.find(p => p.images.length)
  return shell({
    title: `${pr.title}, ${AUTHOR}`,
    desc: description(pr.line ? `${pr.title}: ${pr.line}` : `${pr.title}. ${pr.posts.length} posts, ${range(pr)}.`),
    up, image: leadImg ? { rel: `../../${leadImg.src}`, abs: `../../${leadImg.src}` } : ogImage(firstImg), body, canonical: `projects/${pr.id}.html`,
  })
}

// ---- press run -----------------------------------------------------------------

mkdirSync(join(here, 'posts'), { recursive: true })
mkdirSync(join(here, 'projects'), { recursive: true })
writeFileSync(join(here, 'index.html'), frontPage())
for (const p of posts) writeFileSync(join(here, 'posts', `${p.id}.html`), postPage(p))
for (const p of data.projects) writeFileSync(join(here, 'projects', `${p.id}.html`), projectPage(p))
console.log(`set ${posts.length} posts, ${data.projects.length} projects, 1 front page`)
