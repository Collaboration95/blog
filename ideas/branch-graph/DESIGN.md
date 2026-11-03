# branch-graph

**Idea.** The site is a `git log --graph` drawn as a diagram on a light ground: time runs down, each project is a coloured branch, each post a commit, one-offs sit on main.

**The system.** `build.mjs` computes everything from `content/posts.json`. Lanes are assigned greedily (lowest lane free for a project's whole run). Each project forks from main below its oldest post and merges above its newest if main carries on. Open tips are left open. Forks and merges are SVG arcs with a paper-coloured case so crossings read. Hashes are real SHA-1 of the parent hash plus the post text.

**Type.** One family and one rule: what Guru wrote is Source Serif 4 at any size, what the system generated (dates, hashes, counts, captions) is Commit Mono 400. Variable file, optical size auto for text; h1 and loud lines use the Display cut (opsz 60, 700, -.012em). A loud line is the same sentence getting louder, not a headline from another voice. Chosen by looking, in context, over Newsreader, Archivo, Plex Condensed, Schibsted, Franklin, Overpass. Figures are lining: this file has no oldstyle set. Fonts total 170 KB.
**Colour.** Paper #F5F6F2, ink #15171C, mute #5E636B, hair #D2D5CE. Branches: #E3350D, #1B4FD8, #0B8457, #E09F00, #C4166F (one per project, ink for main).
**Grid.** 4 lanes. Lane pitch 9px on phones (a thin rail), 14px on desktop posts, 34px on the desktop index. Stroke 2px, 2.5px on desktop. Desktop post: 280px map column, 86px gutter, fixed 590px measure (61 characters a line, 1100 up). The margin gives way, not the text: pictures hang from 1240px, below that they sit in the column.

**Details I like.**
- Filled node = post has images, ring = text only. Reposts get a smaller node.
- Index text trails off by stepping the last six words down in opacity, no ellipsis.
- Every paragraph has a tick on the rail linking to its anchor. The target tick grows.
- Post pages carry a clipped slice of the real graph as a map (side column on desktop, two short rails on phones).
- Images fork off the rail on a small siding with `alt` as the caption, and open whole in a dialog.
- Posts with no image get a generated OG card showing their place in the graph.
- Rail geometry resolves on body, so the page rail is the same line as the map's lane, on every lane, at every width.

**The graph reacts to the sentence.** A figure may interrupt a sentence only when it draws what the sentence says, graphics only, aria-hidden, and its numbers come from that sentence. Three primitives:
- `{{drop 10}}`: branches that die ("All ten were dropped").
- `{{merged 23}}`: its opposite, branches that land ("23 pull requests", researchagent-demo).
- `{{span 21m 26m}}`: a branch whose length is the number, as a share of the column. Apple Health 26m, 21m, then 26m to 9.77s, a true 160:1. Also 3m to 44s (commons-agent-logs) and 6.5s against 20.9s (screenshot-declutterer-3).

**Authoring.** In `placements.txt`, under `@post-id`:
`"exact words before the image" ![[02 wide]]` (sizes: wide, hang, half), `"exact words" {{span 21m 26m}}` for figures. Without an entry, images are placed at the nearest sentence end, spread evenly through the post. Hand placement beats that when the copy names the picture: lorong-speech-embeddings and commons-best-use-of-tech each put a picture on the sentence it belongs to.

**Transfers.** Dated rail as navigation, node fill for image vs text, trailing-off openings, per-paragraph ticks. **Stays here.** The lane maths, the sidings, and the figure primitives, though the rule behind them (a diagram may only react to its own sentence) transfers.

**Weakest.** Most posts are still auto-placed, so the sentence-level care stops at the ones with entries. The Commons in red serif on a pale ground sits nearer the brief's terracotta warning than the other branches do; the cool paper and five-colour system are what keep it clear. Opening an image full size needs JS: the check forbids links out of the concept folder, so they are buttons. The gutter is fixed at 4 lanes, so a fifth parallel project would need it widened.
