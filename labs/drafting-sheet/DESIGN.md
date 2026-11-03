# drafting-sheet
**Idea.** Every post is a sheet of a drawing set: title block, revision table, images as dimensioned figures, leaders to the sentence they belong to. Pencil on vellum.
**System.** One 24px line, 6px minor unit. Text sits on the grid; dimensions are computed from each image's `w`/`h` and from quantities in the text. Graphite hairlines, one red pencil for leaders. A leader travels only through margins and gutters, in orthogonal runs, and never over a glyph: `sheet.js` tests every route against all text and drawings on the sheet.
## Type, colour, grid
- Overpass 400/600 for text (18/24); Dosis 400-600 for drawing letters. 107 KB woff2 in `fonts/`.
- vellum `#e8e9e3`, table `#d3d5cd`, graphite `#26282b`, pencil `#54585c`, grid blue `#8fb4c6` (42% at 24px, 15% at 6px), red `#c23a2a`.
- Measure 624px; figures `mid` 624, `side` 420 with a 36px gutter (text, 6, leader, 6, height dimension), `wide` 984. Title block is a right strip on desktop, a folded header on the phone.
## Details I like
- Sheet numbers are fixed (oldest is 1), so a shared number never moves.
- Dimensions are each image's own `w`/`h`. 1600 is the resize limit, so it reads `1600 px MAX`; a value equal to the one before it on the sheet reads `EQ`. So `1199 px` and `1024 px` stand out as measurements.
- The word is underlined. A leader leaves it from the side, or, if words follow, resumes on the same line past the last glyph, like a line passing behind. An edge takes an arrowhead, a surface a dot.
- Approximate dates read `c. Oct 2026`, with title-block tolerance `± 1 month`.
- Quantities in text ("26 minutes", "163x", "$2.79") get a small dimension bracket.
- In `apple-health-import`, 9.77 s is drawn to scale against 26 minutes, then in a 48:1 detail circle.
- A project's posts form a revision table (Rev A, B, C); prev/next are "match lines".
## Authoring primitive
Placement lives in `sheets/<post-id>.txt`. No file means auto placement.
```
fig 1 after "token and timestamp from Sunday's hackathon." side from "timestamp" pin 68.8,45.6
fig 5 after "It came to $2.79 for the day," side from "$2.79 for the day" pin 41.5,34.3 enter side
dims after "about 4x faster." max 180 "3 minutes" 180 "44 seconds" 44
```
`fig <image#> after "<phrase>" <mid|side|wide>` puts the image inside the paragraph after that exact phrase; `from` starts the leader, `pin` lands it (% of image; put it beside type in the picture, not on it), and `enter side` forbids the drop from above when that would run through type in the picture. Put `draw`/`dims` before any `mark` that wraps words in the same sentence.
## Transfers / stays
Transfers: fixed sheet numbers, approximate dates, quantities set apart, real pixel size as caption, paragraph anchors, tied line ends (`tie()`: the last two words and any bare punctuation stay together, characters unchanged). Concept-only: title block, revision letters, routed leaders, EQ, the grid.
## Weakest
When more words follow the anchor on its line, only collinearity ties the leader to its word. `EQ` is real drafting but cryptic to a lay reader. Only 2 posts are hand-placed; the other 34 are auto-placed and less exact, and their leaders stop at the picture's edge. The `13 to 16 seconds` row draws only the 13. The `overflow-x:clip` on the token bar is a patch.
