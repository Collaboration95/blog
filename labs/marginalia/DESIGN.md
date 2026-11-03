# marginalia

**Idea.** One column of text and one ruled blue line. The line is a measuring axis: it stays put at rest, and when a post states a number, the line steps left or right by that many pixels, so the margin becomes a bar chart you read without noticing.
**System.** Everything left of the line is margin (dates, captions, figures, run labels, all set sideways, read with the head tilted left). Text sits on a 30px baseline (27px on phones). Every figure height is a whole number of lines. Images get equal area: tall ones narrow, wide ones long, none dominates, and that area shrinks until the stack fits the text beside it. A figure hangs left from the line it interrupts; when the left margin is taken (by the title or a neighbour) it notches into the right margin instead of waiting. Text and margin finish together.
**Type, colour, grid.** Sorts Mill Goudy 400 and italic, latin and latin-ext (68 KB of woff2), fallback Iowan Old Style, Palatino, Georgia. 18px root, 21px at 1000px and up. Oldstyle and tabular figures. **Colour:** paper #f3f4f1, ink #17181c, soft #62656e, blue #1d3fd0 (line, figure labels, selection, links). **Grid:** Datum x0 = clamp(18px, 46vw - 214px, 640px). Text measure 600px, right edge fixed. Phone: 36px strip on the left for sideways title, date and captions. Below 700px the line moves half as far and the printed key says so (1 px = 19.54 seconds), so the measure stays 250px or more at 390 and never drops under 230px.
**Details.**
1. Figure captions and "Fig. n" are drawn by CSS from data attributes, so no words of ours land inside Guru's sentences (and the copy check stays honest).
2. A sentence an image interrupts resumes at the exact x where it stopped, like a dropped verse line (margin.js).
3. Each paragraph has a number in the margin that is its anchor; the targeted one gets a blue bar.
4. Opening paragraphs are set large when short; images open full size with no script via :target, wide ones turn on portrait phones.
5. Index entries show the gap since the previous entry as sideways "n days", and the trailing text wraps a triangular shape-outside.
**Authoring primitive** (marks.txt, text stays in content/posts.json):
```
## post-id
![03 cross 7] after "( trust me ) ."   image 03 straight after those words; modes cross, out, notch; 7 = lines tall (optional)
| 8-8 | 182 | $182                    paragraphs 8 to 8 move the line 182px, labelled with the post's own words
scale 1 px = $1 | 1 px = $2           the key, then after | the phone's
```
A post with no marks is placed by the rules at the top of build.mjs. Anchors are chosen by reading: a picture goes at the sentence that names it, not in file order.
**No collisions by construction.** On desktop the title, cross and out figures are all left floats that clear left, and notches are right floats that clear right, so none can overlap whatever the words measure (tested with titles up to 860px). The big sideways word is capped to its stretch of text with container units, or hangs clear of the next line.
**Transfers.** The data-attribute caption trick, whole-line figure heights, paragraph anchors, "c. Mon YYYY" dates, sideways metadata as a phone answer to the missing margin, and float-only margins. **Only here:** the moving line and number-led runs, which need hand-written marks and only suit posts with numbers.
**Weakest.** Unmarked posts are only budgeted, not read: on `sq-collective-jev` a figure sits 277px below its sentence, and `friday-hacks-301` has too little text for three pictures, so its margin ends 177px after the text. The budget's 80 characters per line is an estimate, so a miss leaves the page a line or two uneven, never colliding. The phone key is hand-written and its 2:1 bends below about 370px, where the 230px measure wins. Tablet index (700 to 999px) was not reviewed. Marks are matched by quoted phrase, so a changed post text breaks the build loudly.
