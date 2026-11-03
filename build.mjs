#!/usr/bin/env node
// Builds the live site into dist/.
//
// Two designs share one set of pages. Cut and Paste lives at the site root, Rebus under rebus/,
// and every page has the same path in both. A reader sees one design per day (they alternate),
// unless they've picked one with the switch in the top right corner, which is remembered.
//
//   node build.mjs                 builds dist/
//   SITE_URL=https://… node build.mjs   absolute URLs for share previews (set in CI)

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const SITE = (process.env.SITE_URL ?? 'https://collaboration95.github.io/blog').replace(/\/$/, '')
const dist = join(root, 'dist')

// The first design is served at the root. Order also sets the daily rotation.
const DESIGNS = [
  { id: 'cut-and-paste', name: 'Cut and Paste', prefix: '' },
  { id: 'rebus', name: 'Rebus', prefix: 'rebus/' },
]
const SKIP = new Set(['build.mjs', 'DESIGN.md', 'placements.txt', 'pastes'])

// A small picture of each design, used as the switch to it.
const ICON = {
  rebus: `<svg viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" fill="#d4d4d4"/><g stroke="#0b0b0b" stroke-width="2"><path d="M4 7.5h18M4 13h7M20 13h2M4 18.5h11"/></g><rect x="12.5" y="10" width="6" height="5.5" fill="#4a4a4a"/></svg>`,
  'cut-and-paste': `<svg viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" fill="#F1F2EE"/><g transform="rotate(-7 13 14)"><rect x="5.5" y="7" width="15" height="13" fill="#fff" stroke="#1B2DB5" stroke-width="1.4"/><path d="M8 17h10" stroke="#1B2DB5" stroke-width="1.4"/></g><rect x="9" y="4.5" width="9" height="3.6" fill="#FF3FA4" opacity=".9" transform="rotate(9 13.5 6.3)"/></svg>`,
}

const STYLE = `<style>
.blog-switch{position:absolute;top:6px;right:6px;z-index:60;display:grid;place-items:center;width:44px;height:44px;color:inherit}
.blog-switch svg{display:block;width:26px;height:26px;box-shadow:0 0 0 1px rgba(0,0,0,.3);transition:transform .15s}
.blog-switch:hover svg{transform:rotate(-5deg) scale(1.08)}
.blog-switch:focus-visible{outline:2px solid currentColor;outline-offset:-4px}
@media (prefers-reduced-motion:reduce){.blog-switch svg{transition:none}}
</style>`

// Before the page paints: go to the reader's design. A saved choice wins, otherwise the day decides.
const steer = (here, there) => `<script>(function(){if(window.BLOG_NO_SWITCH)return;var a=${JSON.stringify(DESIGNS.map(d => d.id))},d;try{d=localStorage.getItem("blog-design")}catch(e){}if(a.indexOf(d)<0){var t=new Date();d=a[Math.floor(Date.UTC(t.getFullYear(),t.getMonth(),t.getDate())/864e5)%a.length]}if(d!==${JSON.stringify(here)})location.replace(${JSON.stringify(there)}+location.hash)})()</script>`

const run = f => execFileSync(process.execPath, [join(root, f)], { stdio: 'inherit', env: { ...process.env, SITE_URL: SITE } })
const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p] })

for (const d of DESIGNS) run(`designs/${d.id}/build.mjs`)

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
for (const f of walk(join(root, 'content/posts')).filter(f => f.endsWith('.webp'))) {
  const to = join(dist, relative(root, f)); mkdirSync(dirname(to), { recursive: true }); cpSync(f, to)
}

const pagesOf = {}
for (const d of DESIGNS) {
  const src = join(root, 'designs', d.id), out = join(dist, d.prefix)
  for (const f of readdirSync(src)) if (!SKIP.has(f)) cpSync(join(src, f), join(out, f), { recursive: true })
  pagesOf[d.id] = walk(out).filter(f => f.endsWith('.html') && (d.prefix || !f.startsWith(join(dist, 'rebus/')))).map(f => relative(out, f))
}

const [home, other] = DESIGNS
for (const d of DESIGNS) {
  const alt = d === home ? other : home
  const out = join(dist, d.prefix)
  const toDist = d.prefix ? '../' : ''
  for (const page of pagesOf[d.id]) {
    if (!pagesOf[alt.id].includes(page)) throw new Error(`${page} exists in ${d.id} but not ${alt.id}`)
    const up = '../'.repeat(page.split('/').length - 1)
    const there = d === home ? `${up}${alt.prefix}${page}` : `${up}../${page}`
    const file = join(out, page)
    let html = readFileSync(file, 'utf8')
      // images: each design was built one folder deeper than it is served
      .replaceAll('../../content/', `${toDist}content/`)
      // share previews need absolute URLs
      .replace(/(<meta (?:property|name)="(?:og|twitter):image" content=")(?:https?:\/\/[^"]*?\/)?(?:\.\.\/)*(content\/[^"]+)"/g, `$1${SITE}/$2"`)
    const canonical = `<link rel="canonical" href="${SITE}/${page}">`
    html = html.replace(/<meta charset="utf-8">/i, m => `${m}\n${steer(d.id, there)}\n${canonical}\n${STYLE}`)
    if (!html.includes('blog-design')) throw new Error(`${d.id}/${page}: no <meta charset> to hook the switch onto`)
    const link = `<a class="blog-switch" href="${there}" onclick="try{localStorage.setItem('blog-design','${alt.id}')}catch(e){}this.hash=location.hash" title="Switch to ${alt.name}" aria-label="Switch design to ${alt.name}">${ICON[alt.id]}</a>`
    html = html.replace(/<\/body>/i, `${link}\n</body>`)
    writeFileSync(file, html)
  }
}
for (const f of walk(dist).filter(f => /\.(css|js)$/.test(f))) {
  const s = readFileSync(f, 'utf8')
  if (s.includes('../../content/')) throw new Error(`${relative(dist, f)} points at ../../content/; teach build.mjs to rewrite it`)
}
writeFileSync(join(dist, '.nojekyll'), '')
console.log(`dist/: ${DESIGNS.map(d => `${d.name} ${pagesOf[d.id].length} pages`).join(', ')}; ${SITE}`)
