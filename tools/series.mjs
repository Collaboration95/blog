// The series rail: where one post sits among the other posts of its project.
// Modelled on a chat minimap: a column of short dashes, one per post, oldest at the top,
// the one you're on drawn in. Hover or focus a dash for a preview; click it to go there.
// Every concept imports this and restyles it with the --rail-* variables. No JS.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const dateText = p => {
  const [y, m, d] = p.date.split('-').map(Number)
  return p.dateApprox ? `c. ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]} ${y}`
}

/** The post's project as a list, oldest first, or null for a one-off. */
export function series(data, post) {
  if (!post.project) return null
  const project = data.projects.find(p => p.id === post.project)
  const byId = new Map(data.posts.map(p => [p.id, p]))
  const list = [...project.posts].reverse().map(id => byId.get(id))
  return { project, list, at: list.findIndex(p => p.id === post.id) }
}

// Dash length follows the post's length, as the minimap's does, on a log scale so a repost still shows.
const reach = words => Math.min(1, Math.max(0.15, Math.log(words + 1) / Math.log(600))).toFixed(3)
const clip = (s, n) => (s.length > n ? s.slice(0, s.lastIndexOf(' ', n)) + '…' : s)

/**
 * HTML for a post page. Returns '' for a post with no project.
 * `postHref(id)` and `projectHref(id)` are relative to the page the rail sits on.
 */
export function railHTML(data, post, { postHref = id => `${id}.html`, projectHref = id => `../projects/${id}.html`, esc = escape } = {}) {
  const s = series(data, post)
  if (!s) return ''
  const { project, list, at } = s
  const items = list.map((p, i) => {
    const cur = i === at
    const tip = `<span class="rail-tip"><b>${esc(p.label)}</b><i>${esc(dateText(p))}</i>${p.opening ? `<span>${esc(clip(p.opening, 96))}</span>` : ''}</span>`
    const label = `<span class="rail-n">${i + 1}</span><span class="rail-l">${esc(p.label)}</span>`
    return `<li style="--rail-w:${reach(p.words)}">` + (cur
      ? `<a href="${postHref(p.id)}" aria-current="page">${label}${tip}</a>`
      : `<a href="${postHref(p.id)}">${label}${tip}</a>`) + `</li>`
  }).join('')
  return `<nav class="rail" aria-label="${esc(project.title)}, post ${at + 1} of ${list.length}">` +
    `<a class="rail-head" href="${projectHref(project.id)}"><span class="rail-p">${esc(project.title)}</span><span class="rail-of">${at + 1} of ${list.length}</span></a>` +
    `<ol>${items}</ol></nav>`
}

/**
 * Base CSS. A concept sets the variables and may override anything below.
 * Wide screens: a fixed rail in the left margin, dashes only, previews on hover or focus.
 * Phones (or a margin narrower than --rail-room): the same nav in flow, as a short numbered list.
 */
export const RAIL_CSS = `
.rail{--rail-ink:currentColor;--rail-quiet:color-mix(in srgb,currentColor 32%,transparent);--rail-bg:Canvas;--rail-font:inherit;--rail-dash:22px;
  font:13px/18px var(--rail-font);font-variant-numeric:tabular-nums}
.rail ol{list-style:none;margin:0;padding:0}
.rail a{color:inherit;text-decoration:none}
@media (min-width:1100px){
  .rail{position:fixed;left:18px;top:50%;transform:translateY(-50%);z-index:20;width:calc(var(--rail-dash) + 8px)}
  .rail-head{position:absolute;bottom:100%;left:0;padding-bottom:10px;white-space:nowrap;color:var(--rail-quiet);opacity:0;transition:opacity .15s}
  .rail:hover .rail-head,.rail:focus-within .rail-head{opacity:1}
  .rail-head .rail-of::before{content:" · "}
  .rail li{position:relative}
  .rail li>a{display:block;height:14px;position:relative}
  .rail li>a::before{content:"";position:absolute;left:0;top:6px;height:2px;border-radius:1px;width:calc(var(--rail-dash)*var(--rail-w));background:var(--rail-quiet);transition:background .15s,width .15s}
  .rail li>a[aria-current]::before{background:var(--rail-ink);width:calc(var(--rail-dash)*var(--rail-w) + 6px)}
  .rail li>a:hover::before,.rail li>a:focus-visible::before{background:var(--rail-ink)}
  .rail li>a:focus-visible{outline:none}
  .rail-n,.rail-l{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  .rail-tip{position:absolute;left:calc(100% + 14px);top:50%;transform:translateY(-50%);width:max-content;max-width:300px;padding:9px 12px 10px;
    background:var(--rail-bg);color:var(--rail-ink);box-shadow:0 0 0 1px var(--rail-quiet);visibility:hidden;opacity:0;transition:opacity .12s}
  .rail-tip b{display:block;font-weight:600}
  .rail-tip i{display:block;font-style:normal;color:var(--rail-quiet);margin-bottom:4px}
  .rail li>a:hover .rail-tip,.rail li>a:focus-visible .rail-tip{visibility:visible;opacity:1}
}
@media (max-width:1099.98px){
  .rail{margin:24px 0}
  .rail-head{display:flex;justify-content:space-between;gap:12px;padding:0 0 6px;border-bottom:1px solid var(--rail-quiet)}
  .rail-tip{display:none}
  .rail li>a{display:grid;grid-template-columns:2ch 1fr;gap:10px;align-items:baseline;min-height:44px;padding:12px 0 0}
  .rail-n{color:var(--rail-quiet);text-align:right}
  .rail li>a[aria-current]{font-weight:600}
  .rail li>a[aria-current] .rail-n{color:var(--rail-ink)}
}
@media (prefers-reduced-motion:reduce){.rail *{transition:none!important}}
`
