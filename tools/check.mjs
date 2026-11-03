#!/usr/bin/env node
// Crawl a built design from file:// at desktop and phone widths. Exits non-zero on any failure.
// node tools/check.mjs <dir> [--within <outer dir>]: links into <outer dir> are allowed but not crawled.
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = resolve(process.argv[2] ?? '')
const w = process.argv.indexOf('--within')
const withinUrl = w > 0 ? pathToFileURL(resolve(process.argv[w + 1])).href + '/' : null
const entry = join(dir, 'index.html')
if (!existsSync(entry)) { console.error(`no index.html in ${dir}`); process.exit(2) }

const data = JSON.parse(readFileSync(join(root, 'content/posts.json'), 'utf8'))
const dirUrl = pathToFileURL(dir).href + '/'
const squash = s => s.replace(/\s+/g, '')
const strip = h => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const fails = []
const fail = (where, what) => fails.push(`${where}: ${what}`)
const rel = u => u.replace(dirUrl, '')

const inspect = () => {
  const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, images: [], text: document.body.textContent,
    html: document.documentElement.outerHTML, links: [...document.querySelectorAll('a[href]')].map(a => a.href), title: document.title,
    desc: !!document.querySelector('meta[name="description"]'), og: !!document.querySelector('meta[property="og:title"]') }
  for (const img of document.images) {
    const src = img.getAttribute('src') ?? ''
    if (!src.includes('content/posts/')) continue
    const r = img.getBoundingClientRect()
    const cs = getComputedStyle(img)
    let clipped = null
    for (let n = img.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (![s.overflow, s.overflowX, s.overflowY].some(v => v === 'hidden' || v === 'clip')) continue
      const b = n.getBoundingClientRect()
      if (r.width > 1 && (r.left < b.left - 2 || r.right > b.right + 2 || r.top < b.top - 2 || r.bottom > b.bottom + 2)) { clipped = n.tagName; break }
    }
    out.images.push({ src, loaded: img.complete && img.naturalWidth > 0, nw: img.naturalWidth, nh: img.naturalHeight, w: r.width, h: r.height,
      fit: cs.objectFit, alt: img.getAttribute('alt'), hasDims: img.hasAttribute('width') && img.hasAttribute('height'), clipped })
  }
  return out
}

const browser = await chromium.launch()
const allText = new Map()
const usedImages = new Set()
const seen = new Set()

for (const [vw, vh] of [[1280, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } })
  await ctx.addInitScript(() => { window.BLOG_NO_SWITCH = true })   // stay on the design being checked
  const page = await ctx.newPage()
  let cur = ''
  page.on('pageerror', e => fail(`${rel(cur)}@${vw}`, `script error: ${e.message}`))
  page.on('requestfailed', r => { if (r.url().startsWith('file:')) fail(`${rel(cur)}@${vw}`, `missing file ${r.url().split('/').slice(-3).join('/')}`) })
  page.on('request', r => { if (/^https?:/.test(r.url())) fail(`${rel(cur)}@${vw}`, `remote resource ${r.url()}`) })
  const queue = [pathToFileURL(entry).href]
  const visited = new Set()
  while (queue.length) {
    cur = queue.shift()
    if (visited.has(cur)) continue
    visited.add(cur)
    await page.goto(cur, { waitUntil: 'load' })
    await page.evaluate(() => { document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager' }) })
    await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 3000) }))))
    const p = await page.evaluate(inspect)
    const where = `${rel(cur)}@${vw}`
    seen.add(rel(cur))
    if (p.overflow > 1) fail(where, `sideways scroll by ${p.overflow}px`)
    if (/lnkd\.in|\*\*Notes:|DATE UNKNOWN|Live LinkedIn wording/.test(p.html)) fail(where, 'private note or shortlink present')
    if (!p.title) fail(where, 'no <title>')
    if (rel(cur) !== 'index.html' && (!p.desc || !p.og)) fail(where, 'missing description or og:title')
    for (const i of p.images) {
      usedImages.add(i.src.replace(/^(\.\.\/)+/, ''))
      if (!i.loaded) fail(where, `broken image ${i.src}`)
      if (!i.alt) fail(where, `no alt on ${i.src}`)
      if (!i.hasDims) fail(where, `no width/height on ${i.src}`)
      if (i.fit === 'cover') fail(where, `object-fit cover on ${i.src}`)
      if (i.clipped) fail(where, `image clipped by ${i.clipped}: ${i.src}`)
      if (i.w > 1 && i.h > 1 && Math.abs((i.w / i.h) / (i.nw / i.nh) - 1) > 0.03 && i.fit !== 'contain') fail(where, `distorted ratio on ${i.src}`)
    }
    allText.set(rel(cur), squash(p.text))
    for (const href of p.links) {
      const clean = href.split('#')[0]
      if (!clean.startsWith('file:')) continue
      if (!clean.startsWith(dirUrl)) {
        if (withinUrl && clean.startsWith(withinUrl) && existsSync(fileURLToPath(clean))) continue
        fail(where, `link leaves site: ${clean}`); continue
      }
      if (!existsSync(fileURLToPath(clean))) { fail(where, `dead link ${rel(clean)}`); continue }
      if (clean.endsWith('.html')) queue.push(clean)
    }
  }
  await ctx.close()
}
await browser.close()

for (const p of [...data.projects]) if (!seen.has(`projects/${p.id}.html`)) fail('coverage', `no page for project ${p.id}`)
for (const p of data.posts) {
  const key = `posts/${p.id}.html`
  const text = allText.get(key)
  if (!text) { fail('coverage', `no page for post ${p.id}`); continue }
  for (const b of p.blocks) if (!text.includes(squash(strip(b.html)))) fail(key, `copy altered near: ${strip(b.html).slice(0, 60)}`)
  for (const i of p.images) if (!usedImages.has(i.src)) fail(key, `image never shown: ${i.src}`)
}

const uniq = [...new Set(fails)]
if (uniq.length) {
  console.log(uniq.slice(0, 40).join('\n'))
  if (uniq.length > 40) console.log(`...and ${uniq.length - 40} more`)
  console.log(`FAIL ${uniq.length} issue(s) across ${seen.size} pages`)
  process.exit(1)
}
console.log(`PASS ${seen.size} pages at 1280 and 390`)
