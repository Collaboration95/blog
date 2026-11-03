// The sentence an image interrupts picks up at the exact x where it stopped,
// like a dropped line in verse. Without this script it simply restarts at the left.
function resume() {
  for (const gap of document.querySelectorAll('.gap')) {
    gap.style.width = '0'
    const at = gap.parentElement.querySelector('.at')
    const fig = gap.previousElementSibling
    if (!at || !fig || getComputedStyle(fig).float !== 'none' || getComputedStyle(fig).position === 'absolute') continue
    const x = at.getBoundingClientRect().left - gap.parentElement.getBoundingClientRect().left
    gap.style.width = x + 'px'
    // If the next word no longer fits on that line, leave it at the left edge.
    const probe = document.createRange()
    probe.setStartAfter(gap)
    probe.setEnd(gap.parentElement, gap.parentElement.childNodes.length)
    const first = probe.getClientRects()[0]
    if (first && first.top > gap.getBoundingClientRect().bottom - 2) gap.style.width = '0'
  }
}
resume()
document.fonts?.ready.then(resume)
addEventListener('resize', resume)
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  const open = document.querySelector('.fig:target .shut')
  if (open) open.click()
})
