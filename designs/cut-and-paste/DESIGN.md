# 05 cut-and-paste

A photocopied zine. Every post is one sheet (no sheet numbers or site totals are shown; the site name is `data.site`). Pictures are paper prints stuck into the running text. The system is strict so the mess can be too. Run `node build.mjs`; it rebuilds the whole site from `content/posts.json` and `pastes/*.txt`. `style.css` is generated: the shared series rail CSS from `tools/series.mjs` (breakpoint raised to 1200), then `site.css`, which is the file to edit.

**Inks.** Two only: blue `#1B2DB5` and pink `#FF3FA4`, where blue over pink gives a dark `#190A78`. Only the photos have other colours. Blue is ink, never a backdrop: the paper `#F1F2EE` runs to the edge of the screen, and on desktop the sheet is defined by blue trim marks and a registration target (the pink target sits off by the sheet's seeded offset). Stock is paper, pink flood (text-only posts) or blue (reposts, a slip 800 wide, because a one-line post has no claim to a sheet of ink). The full-size viewer is paper too.

**Misregistration.** The pink plate is offset once per sheet, seeded by post id. Headings, highlighter, sub-heads and the page-number box all share that one offset.

**Type.** Special Elite is Guru's words. Protest Revolution (marker) is for headlines and the occasional `**big**` figure. Courier Prime Bold on "dymo" label tape is everything the site adds (dates, project markers). His words are never set in the label face.

**Fasteners fix the angle.** staple 1.2 to 3.2 deg, clip 0.8 to 2, tape 0.4 to 1.2, glue 0.4, in 0.4 steps. Tall images get a clip, slides and screenshots get tape, photos get a staple. A `true` option makes a print level. There are no free angles.

**Overlap rule.** A print may cover only its own white border with tape, staple or clip. It never covers text. Only the pen marks (rings, arrows, tallies) touch text. Short lines become scissor-cut strips, one in about eight.

**Never cropped.** Prints are `width:100%; height:auto`. The border is the only thing that is rotated or clipped, never the picture. Tap a print for the full size (`#view-n`, no JS). On a phone, a landscape picture turns sideways in the viewer.

**Pen.** Arrows, circles, tallies and strikes are filled SVG strokes with pressure and wobble, generated in `build.mjs` and seeded. Ink on a picture is placed in 1000-unit coordinates in the paste file.

**Placement.** The generic rule puts each image after a sentence near the middle of a paragraph, spaced evenly, never at the end. `pastes/<id>.txt` can override it with `after "phrase" ![n](fastener side size)`.

**Showcase.** `commons-agent-logs` is hand placed: five prints, ringed numbers, an X for each of "All ten" and a tally for "Four". `apple-health-import` has no images; the page is a ruler 26 minutes tall. The run is a grid of 26 equal rows and `minutes 7-12:5 13:2 ...` in the paste file pins paragraphs to ticks, so the content sets the size of a minute and the ruler cannot drift at any width. The three figures are the landmarks: each stands on its tick, 26, 21 and 0, on a pen line drawn back to the ruler. Pink marks the five minutes the first round saved. The blue stub at the bottom is 9.77 seconds at true scale, about 9px on a strip about 1570px tall.

**Index.** A paste-up in bands, 7 and 5 columns of 12, strictly newest first, one scrap per post (nothing is grouped). A picture leads its band; the next two scraps fill the column beside it. Runs of text with no picture coming up are cut into threes. Scraps are trimmed to the band's depth: the excerpt takes the leftover height and the tear falls wherever that lands, so no band has a hole. Each scrap: headline, date, the first picture whole, the opening torn off. A post in a project carries a quiet pen-underlined marker (`The Commons · 2 of 4`) that links to the project. Openings of 120 characters or fewer are shown whole, not torn.

**Series rail.** Post pages in a project use the shared `railHTML`. At 1200px and up it is a fixed column of marker strokes in the left margin (length follows post length, the current one blue over pink, offset by the sheet's misregistration); hover or focus lifts a taped scrap with the label, date and opening. Below 1200 the paper's left-hanging prints would sit under it, so it becomes a numbered list at the foot of the sheet, and the dymo marker in the slug at the top (`The Commons · 2 of 4`, pink-shadowed) jumps to it, so a phone says "series" on the first screen. Wide screens point that marker at the project page instead.

**Project page.** Title and line, then each post as its own entry, oldest first: date, label, first picture whole (small taped print, links to the post), opening torn off. No post text is repeated in full.

**Known weak spot.** On `apple-health-import` at 1440 the wide right margin beside the ruler stays empty. Two consecutive bands lead from the same side because date order decides, so the board's rhythm is steadier than a hand paste-up. An excerpt tear can land mid-line, which is the idea but looks accidental on a short scrap.
