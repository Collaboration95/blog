# Rebus

**Idea.** Images are words: each sits inside the sentence at text height, whole and at its real ratio. Tap one and the line parts, the picture grows in the gap, and the text below is pushed down. Tap again and it closes.

**System.** Every glyph is one tile on the same 1em band (descender to ascender), set 0.24em after its word. The word, the glyph and its punctuation are glued (`.w`, nowrap) so a line never breaks inside the join; when a picture opens the punctuation stays up with the hole, so the sentence ends before the picture. Opened height is rounded up to a whole number of lines, so the text lands back on the line grid. Measures (`$182`, `26 minutes`) are black bars drawn to scale against the post's largest.
**Three states of the band.** Picture: the tile is full. Hole: the tile is empty, `#c5c5c5` with a hairline, and closes the picture. Link: a hole with the word still in it, `#c5c5c5` band with only its floor drawn; it turns white on hover and focus.
**Index.** Every post is its own entry, strictly newest first; a post in a project carries a quiet label `14 Oct · The Commons · 4 of 4` (the project part links to its page). No site totals, no LinkedIn link, no sheet numbers. Each entry's first picture is set open in the HTML (hole, punctuation, picture, tab: the parts a tap makes), so it is whole without script and shuts the same way. Script only trues up the tab and the line grid. If a clause ends before the next glyph, the open picture waits for it. At 390 it fills the column; above that it follows the post rule, 74vh tall at most.
**Project page.** Title and its line, then the project's posts oldest first as separate entries in the same running paragraph (first picture open, seams), each linking to its own post.
**Series rail.** Post pages in a project import `railHTML` and `RAIL_CSS` from `tools/series.mjs`; `build.mjs` splices the base CSS into `site.css` between the `rail:base` / `rail:end` markers and the overrides follow (greys, one family, hole-tinted preview with an ink hairline). From 1100px a fixed dash rail sits in the left margin and the text column moves right by 44px (`body.railed`) so they never touch. Below that the nav is a numbered list at the end of the post (`#series`); the header already reads `The Commons · 3 of 4` on the first screen and links to the project.
**Seams.** A seam is a cut with no picture in it: the line breaks at the last faded word and the next entry starts one line down, at the x where the last one stopped. If fewer than 4em would be left after its label, it starts at the margin.

**Type.** Schibsted Grotesk variable (46 KB, one family): body 440, headings 640. Text `clamp(27px, 17.6px + 2.4vw, 50px)`, line-height 1.22 rounded to whole px, tracking -0.012em. Labels `clamp(13px, 10.8px + 0.5vw, 17px)`, weight 500. Column 23.2em.
**Colour.** Greys only (R=G=B): paper #d4d4d4, hole #c5c5c5, ink #0b0b0b, mid #4a4a4a, white for focus and hover. Colour comes from the images alone.
**Grid.** One column, side margin `clamp(16px, 3.6vw, 56px)`, labels in two columns at 390 and a row at 760+.

**Details.**
1. Glyph and tap target: 44px hit area around a 1em picture, without moving the layout.
2. The hole left by an open picture stays on the line above (`.mortise`) and closes it.
3. Index excerpts fade over the last 7 words in 7 grey steps: trailing off in ink.
4. `#f3` links arrive with that picture open; every paragraph has a numbered anchor.
5. Open a picture or shut it and no word moves in x, so seams and tabs stay true; the open caption carries the real pixel size as a button to the full file (a button because `check.mjs` refuses `a[href]` out of the folder).

**Authoring.** Put `[[n]]` after the word in a fragment of the post, in `placements.txt`:
`so the room[[2]] had four`  (image 2 stands after "room")
`roughly $182[[=]].`  (a bar drawn from the number before it)
Posts with no marker are placed by the rule in `build.mjs` (`autoPlace`).

**Transfers.** The 1em tile band, glue-to-word, whole-line gap heights, fading excerpts, anchors, the hollow-band link. **Stays here:** the parting animation, the all-grey palette, the single running paragraph index, the stepped seam.

**Weakest.** Measure bars are now the only solid black in the text, and in `apple-health-import` they lean towards redaction. Stepped seams and tabs need script, so a slow load can show entries at the margin first (a fair fallback, but it shifts). Glyphs of dark captures and the tall 770x1307 picture are recognisable tiles, not readable ones, until opened, and `autoPlace` can still cut a phrase: the open picture in `stylemind` falls after "a stab".
