#!/usr/bin/env node
// Screenshot a concept's key pages into gallery/shots/<name>/.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = resolve(process.argv[2] ?? '')
const out = join(root, 'gallery/shots', basename(dir))
mkdirSync(out, { recursive: true })

const pages = {
  index: 'index.html',
  project: 'projects/the-commons.html',
  'post-images': 'posts/commons-agent-logs.html',
  'post-text': 'posts/apple-health-import.html',
}

const browser = await chromium.launch()
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w === 390 ? 2 : 1 })
  const page = await ctx.newPage()
  for (const [name, path] of Object.entries(pages)) {
    await page.goto(pathToFileURL(join(dir, path)).href, { waitUntil: 'load' })
    await page.evaluate(() => { document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager' }) })
    await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 3000) }))))
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))))
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: join(out, `${name}-${w}.png`) })
    const full = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.screenshot({ path: join(out, `${name}-${w}-full.png`), clip: { x: 0, y: 0, width: w, height: Math.min(full, 5000) }, fullPage: true })
  }
  await ctx.close()
}
await browser.close()
console.log(`wrote ${out}`)
