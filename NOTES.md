# Notes

## Planned split

1. **Posts**: the content (`content/` today).
2. **Live site**: what GitHub Pages serves.
3. **Frontend**: the shared design language the live site uses.
4. **Labs** (`/labs`): experiments with different models and UIs, plus a place to demo widgets.

## Decisions, 5 Nov 2026

- **Images follow the live LinkedIn posts.** Each post shows the pictures its LinkedIn post shows, in the same order (the "sync … from LinkedIn" captures in the posts repo). Where a capture matches a full-size original in the same folder, the original is published instead of the small capture. Dates and LinkedIn links now come from each post's Notes line, so none are approximate.
- **Cut and Paste front page:** each card shows only the post's opening line (or the line after it, when the first line is already the headline), set larger and ending in a pink `…`. It replaced the torn-paper excerpt. Pictures are scaled to fit within a square (never cropped), and the stack beside a picture takes one to three scraps, whichever comes closest to the picture card's height.

## Decisions, 4 Nov 2026

- **Live site:** Cut and Paste (at the root) and Rebus (under `rebus/`), same pages in both. One design per day, alternating; a small switch in the top right picks one and remembers it. Its icon is a tiny picture of the other design.
- **Character Grid** is kept in `labs/` as a template, not on the live site.

## Decisions, 3 Nov 2026

- **Index:** one entry per post, strictly newest first. Projects no longer collapse into one entry, so the first screens are a true chronology even when projects interleave.
- **Project membership** is shown on the post: the series rail in `tools/series.mjs`, modelled on a chat minimap. On desktop it's a column of dashes in the left margin, one per post in the project, oldest at the top. Dash length follows post length, and hovering a dash previews that post. On phones it becomes a `Project · 3 of 4` marker near the top and a numbered list at the end.
- **Project pages** list their posts as separate entries; they don't run the full text together.
- **Site name** is `Guru's blog` (`site` in `content/posts.json`). No site totals, no sheet or page numbers, no LinkedIn link on posts.
- **Branch Graph** was deleted. Its idea is kept in `ideas/branch-graph/` (design notes and screenshots).

## Retired concepts, parts to bring back as widgets

Drafting Sheet and Marginalia were set aside on 3 Nov 2026 to revisit later. They're in `retired/` too, with Drafting Sheet's 2 Nov edits (no bottom title block, no grid over pictures).

Broadsheet and Contact Sheet were dropped on 2 Nov 2026 for looking too generic. Their code is in `retired/` and still builds.

**Contact Sheet**
- **The post strip** at the foot of each post: one cell per post, oldest to newest. A cell is filled if the post has pictures, outlined in yellow if it's in the same project, and red for the post you're on. It shows where a post sits in the whole run at a glance. See `roll()` in `retired/contact-sheet/build.mjs`.
- Grease-pencil marks that start on a picture and carry across the gutter onto the words they refer to.

**Broadsheet**
- The post's own first line is the headline. Your posts have no titles, so this works without inventing any.
- Headline size scales by 1/√length, so short first lines are set big and long ones stay calm.
- One-line reposts set as small classified-style entries.
