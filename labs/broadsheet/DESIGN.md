# Broadsheet
**Idea.** A real newspaper made of his words: text is the material, pictures are halftone plates cut into it, in one ink on grey newsprint.
**System.** One baseline (23px phone, 22px desktop), 1px and 3px rules, headline size proportional to 1/√length so every headline covers the same area of paper. Page numbers count up from the oldest post, so a new post never renumbers the paper.

## Values
- Type: Libre Caslon Condensed 700 (headlines), Newsreader (text, justified, auto-hyphenated, 16-17px), Libre Franklin 500/700 (labels, captions, 11-13px). Fonts are under 260 KB.
- Headline: `--fit` = min(1, √(32 / characters)) × 19cqi (phone), 15cqi (700px+), 13cqi (1100px+) of its own cell, leading 1.2 − .26 × fit. The same rule sets post, index, project and repost headlines.
- Colour: paper #dfdfd9, ink #141412, tone #565651. Nothing else. Four prints: `photo` 2.5-3px halftone; `slide` for pictures of screens (alt says slide, screen or projector), tone kept with a light dot over it, because the halftone blows projected text to white; `line` greyscaled for diagrams; `reverse` inverted for dark UI. Hover restores the original, opening shows it in colour at full size. Where grey loses colour keys (`line`, `reverse`) the caption ends "Opens in colour."
- Grid: story columns 1 (phone), 3 (700px+), 3-5 (1100px+, set by `cols`), gap 28px, column rules. A one-column figure is a block in its column (a float on phones only; Safari slices floats across column breaks). A wider one is a band: `column-span: all`, the columns stop, the picture crosses them, they restart below. Lone pictures keep to the column grid with the caption beside them; pictures sharing a band meet at one height. No script, so nothing can overlap and it reads the same without JS. Front page is a six-column imposition: lead, bands, briefs, classifieds for the one-line reposts.

## Details I like
1. Links are a line of halftone dots that closes to a solid rule on hover; focus is a reverse block.
2. Every paragraph has an anchor; the margin number is generated, so it never gets copied.
3. Numbers become rules drawn to scale (`bar 10 180/180`, 26 minutes against 9.77 seconds).
4. Jump lines ("Continued on page N") instead of "Read more", and "— 30 —" ends each story.
5. `Fig. n` captions reuse the alt text; the plate opens the full colour original.

## Authoring primitive
`![04 wider](went through my agents,)` in `desk.md` cuts image 04 into the text right after that phrase. Flags: `wide` (a band, picture 2 columns), `wider` (3), `reverse`, `line`, `slide`, `photo`. Two cuts at the same phrase share one band. Roles: `deck 1 2`, `lede 3`, `list 8 9`, `stair 15 16 17`, `big 22`. A post with no section is still set: `autoCuts` matches each image's alt to the paragraph that talks about it and cuts in at the first comma or full stop. It allows one band per 170 words, in the middle 25-70% of the story, diagrams first, so columns never thin to strips.

## Transfers / does not
- Transfers: alt as caption, Fig. numbers, headline size by length, anchor numbers, scaled rules, jump lines.
- Concept only: justified columns, halftone, the one-ink paper.

## Weakest
- A band ends the columns, so text cannot run past a picture in a third column the way a pasted-up page does. Bands read as tiers. The old spacer script tried for that and overlapped on 23 of 68 page widths; I gave up the look for something that cannot fail.
- A lone band in a wide story leaves a hole: in `commons-agent-logs` the chart takes 3 of 5 columns and the other 2 hold only the caption. A tall figure also sets the height of its tier, so short columns beside it run out early (`stylemind`).
- Posts under 170 words get no band, so their slides stay one column wide and rely on opening.
- `column-span` in a nested block is checked in Chromium and WebKit (Safari needs the `.brk` column break, or it repaints the text after a band above it). Firefox is unchecked: it isn't installed here.
