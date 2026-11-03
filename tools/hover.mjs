// Screenshot the series rail with its second dash hovered, at 1440x900.
import { chromium } from 'playwright'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
for (const c of process.argv.slice(2)) {
  await page.goto(pathToFileURL(resolve(c, 'posts/commons-agent-logs.html')).href)
  await page.evaluate(() => document.fonts.ready)
  await page.hover('.rail li:nth-child(2) > a')
  await page.waitForTimeout(300)
  await page.screenshot({ path: join('/tmp', `hover-${c.split('/').pop()}.png`) })
}
await browser.close()
