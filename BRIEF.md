# Brief: a stylised home for Guru's LinkedIn posts

Guru writes LinkedIn posts about side projects, hackathons, certs and meetups. When he wants to show someone a particular project release, digging it out of LinkedIn is painful. He wants the same posts on a static GitHub Pages site, styled, with a link he can hand over. Nothing more.

His words: "a more stylized way to post the same linkedin post". "I want it to evoke that we have thought about the tiny details." "I don't want a splashy this-is-my-personal-website type webpage." "A little bit unruly, ie images added in the middle of a paragraph." "Very stylized stuff is fine."

This is one of eight concepts. They exist so Guru can pull a shared design language out of them, so **commit hard to your one idea**. A timid version of your direction is useless to him. Each concept should be arguable: someone should be able to love it or hate it.

## The most important moment

Guru is talking to someone, takes out his phone, opens a link and holds it out. **The post page at 390px is the primary screen.** The second is someone opening a shared link, so the post and project pages need good `<title>`, description and `og:image` tags. The index is third.

## Content

Everything lives in `content/` at the project root. Do not edit it. Read `content/posts.json`:

- `author`: use as the only site name. There is no other brand, tagline or bio.
- `projects[]`: `id`, `title`, `line` (a verbatim phrase, can be empty), `posts` (ids, newest first), `first`, `last`.
- `posts[]`, newest first: `id`, `date`, `dateApprox`, `project` (or null), `kind` (project, reflection, event, cert, tool, career, repost), `label`, `opening`, `blocks[]`, `images[]`, `words`, `links`, `linkedin` (or null).
- `blocks[]`: `kind` is `p`, `heading` or `pre`. `html` is the verbatim text with links already applied. Insert it as is.
- `images[]`: `src` (relative to the project root), `w`, `h`, `alt`.

Your build must read this file, because dates and links will change after a check against the live site. Re-running it must produce the whole site.

The shape of the data is the real design problem:

- 36 posts. **23 have no image at all.** Text-only is the normal case and must look deliberate, never like a missing image.
- Two posts are a single short line (the `repost` kind). One post is 37 blocks long and has headings and a `pre` tree (`agent-context-layer`).
- Images are slides, phone photos, dark UI captures, light diagrams, a tall screenshot (770×1307). They clash with each other and were never designed to live together. Your system has to survive that.
- `dateApprox: true` means the date is an estimate. Don't show a false day. Show the month, marked as approximate (for example `c. Oct 2026`).

## Pages (fixed paths, relative links only)

Build to `concepts/<your-name>/`:

- `index.html`, the base. Sorted by date, newest first. **A project with several posts collapses to one entry**, placed at its latest post, showing its title, post count and date range. Anything without a project is its own entry. Each entry has its preview image shown **whole, never cropped** (when it has one) and the start of the post trailing off.
- `projects/<project-id>.html` for all five projects: its posts in order.
- `posts/<post-id>.html` for all 36 posts.

Every page must work when opened straight from disk (`file://`) and under a GitHub Pages subpath. So relative links only, no root-relative paths, no `fetch()` at runtime. Images are referenced at `../../content/...` from `index.html` and `../../../content/...` from subpages.

Two posts get hand placement and are your showcase. Spend your effort here:

1. `commons-agent-logs`: five mixed images in a story with numbers in it.
2. `apple-health-import`: no images at all. It must still feel as designed as the other.

And the `the-commons` project page. All other post pages come from your generic template, but that template must already put images **inside** the text, never stacked at the end. Put the placement rules in the build, so that adding a post means writing a small amount of markdown-like input.

## Hard rules

- **Verbatim copy.** Typos, odd spacing, lowercase "i", missing apostrophes, `-->`, all stay. It is his voice and he has said so. No smart-quote conversion, no fixing, no rewriting, no summarising.
- **No invented copy.** No tagline, bio, about page, mission line, or words in Guru's mouth. Your only additions are small structural labels your concept needs (dates, counts, "Fig. 3", "Sheet 12 of 36", "LinkedIn") and `alt` used as a caption. Don't make up headlines: use `label`, or let the post's own first line be the headline.
- **No cropping, anywhere.** No `object-fit: cover`, no clipping wrapper, no image shown at a different ratio. Scale, rotate, overlap, mark up or float, but the viewer sees the whole picture. Every image can be opened at full size.
- **Nothing private.** Only `content/` is the source. Don't read the private notes in the source repo.
- Static HTML and CSS, no framework, no runtime dependency, no tracking. A small amount of vanilla JS is fine for enhancement, but all text must be readable without it. Zero-dependency build script (`build.mjs` in your folder, run with node).
- Fonts self-hosted in your folder (`fonts/*.woff2`), or a system stack. The fontsource CDN works: `https://cdn.jsdelivr.net/fontsource/fonts/<family>@latest/latin-400-normal.woff2`. At most three families. Total added font weight under 300 KB.
- Stay inside `concepts/<your-name>/`. Write nothing else, apart from your screenshots through the tool below.

## Taste

The reference point is a thing made by someone who cares, not a template. Think of a beautifully set manual, a well-designed record sleeve, a good printer's proof.

Avoid: hero sections, big-name intros, "Hi, I'm", card grids with rounded corners and soft shadows, scroll-triggered fade-ins, gradient text, glassmorphism, emoji as icons, cursor followers, dark-mode toggles, nav bars with five items, reading-progress bars, tag clouds, "Read more →" buttons.

Avoid these overused defaults: Inter, Roboto, Poppins, DM Sans, Space Grotesk, JetBrains Mono, Playfair Display, Fraunces, Instrument Serif. Avoid purple gradients, and the warm cream page with a serif and a terracotta accent that every AI-designed site has now.

"Unruly" means a confident break from a strict underlying system, and you must be able to say what the system is. Random rotation sprinkled on a generic layout is not unruly, it is noise. When an image interrupts a sentence, it should feel placed by a person who read the sentence.

## Tiny details

Do these, and find better ones specific to your idea:

- `width`/`height` on every image so nothing jumps while loading. `loading="lazy"` below the fold.
- `text-wrap: pretty`, sensible hyphenation, tabular figures in dates and any aligned numbers, oldstyle or proper figures in text if the font has them.
- Each paragraph has a stable anchor, so he can link someone to one exact sentence.
- `:focus-visible` that belongs to the design. `::selection` too. Link styling that isn't the browser default and isn't a generic underline.
- `prefers-reduced-motion` honoured. Any motion is small and earned.
- The phone view is composed, not just a collapsed desktop. Tap targets are real. Unruly layouts have a specific phone answer.
- Links to `post.linkedin` where present, kept quiet, as a source reference.
- Prev/next or a way back to the project. Guru's reader may land on one post from a shared link and should see where it sits.

## Verify before you finish

From the project root:

```
node tools/check.mjs concepts/<your-name>    # must end in PASS
node tools/shots.mjs concepts/<your-name>    # writes gallery/shots/<your-name>/*.png
```

`check.mjs` crawls every page at 1280 and 390, and fails on broken images or links, sideways scroll, cropped images, missing alt text, remote resources, altered copy, and missing posts. Read the screenshots with the Read tool and actually look at them. Judge them like an art director, especially `post-*-390` ones. Fix what's weak and go round again. A passing check is the floor, not the goal.

## Write `concepts/<your-name>/DESIGN.md` (under 40 lines)

- The idea in one sentence, and the strict system underneath it.
- Type, colour, grid: exact values.
- The five tiny details you're proudest of.
- The authoring primitive: the exact markdown-like syntax Guru would type to put an image in the middle of a paragraph.
- What transfers to a shared language, and what only works inside this concept.
- What's weakest or would annoy you in a year.

Your final message to me: at most eight lines. Check status, the strongest idea, the weakest spot. Don't paste the design doc.

---

## The eight directions

**01 `character-grid`.** The site as a typeset RFC or man page. One monospaced face, everything snapped to a character cell: every image height is a whole number of lines and every width a whole number of columns, so text flows around pictures like an ASCII diagram that happens to contain photographs. Page headers and footers in the running style of an RFC (`[Page 3]`), a generated table of contents. The discipline is total, and the images are the only thing allowed to be beautiful. Not a green-on-black terminal. Think paper, a real typewriter-grade mono, one colour.

**02 `broadsheet`.** A newspaper. Justified, hyphenated multi-column text with column rules, images spanning two columns and cutting into the text mid-paragraph, drop caps, jump lines, datelines. The index is a front page, with the newest thing as the lead story and small posts as briefs. It solves the text-only problem by treating text as the main material. The one-line reposts become classifieds. On a phone it is a proper narrow single column, like a wire story. Must be a serious piece of editorial typography, not newspaper pastiche with fake mastheads and invented headlines.

**03 `rebus`.** Images are words. They sit inside the sentence at text height, whole and at their real ratio, like a glyph, and tapping one opens it in place: the line splits, the text parts and the image grows in the gap, pushing what follows downward, and it closes the same way. Large, confident single-family text setting. Near-monochrome, with colour coming only from the images. The index reads as a continuous paragraph of openings with tiny images embedded in it. This is the most literal answer to "images in the middle of a paragraph": get the mechanics perfect, including baseline alignment and how a tall image behaves at text height.

**04 `contact-sheet`.** A darkroom contact sheet. The index is frames on film stock with edge markings and frame numbers, and images in their real ratio on black. Grease-pencil marks are drawn by hand on the frames: circles, crosses, arrows, in chinagraph red or yellow. A text-only post is a frame with text exposed into it, or a blank frame with notes. Post pages intercut frames with text, with the pencil marks carrying across the gutter onto the words. Dark is earned here because photos glow on it, so reading comfort must not be an afterthought.

**05 `cut-and-paste`.** A photocopied zine. Images taped, stapled and paper-clipped into running text, slightly off-true, with a two-ink riso palette for everything except the photos. Text set in a mix of typewriter and marker where the system calls for it, misregistered colour on headings. Hand-drawn arrows and circles are SVG, and they're specific to the content. This is the most unruly direction, so it needs the strictest rules: define the angles, tape types, and exactly when a thing may overlap. Copy must stay perfectly readable and the wobble must be deterministic, seeded by post id, so a page looks the same on every visit.

**06 `branch-graph`.** The index is a `git log --graph`. Time runs down the page, each project is a coloured branch, each post a commit node on it, and one-offs are single commits on main. Projects run in parallel and you can see them overlap (ResearchAgent and The Commons in October, the AWS run through the spring). Merge lines and branch tips are real SVG computed from the data, not decoration. Post pages keep a small piece of the graph in the margin as navigation showing where you are. Images hang off commits as attachments. Must work on a phone, where the graph narrows to a thin rail. Avoid the terminal cliché: it's a diagram, drawn with care, on a light ground.

**07 `drafting-sheet`.** Every page is a sheet of technical drawing. A title block in the corner carries project, date, sheet number and revision. Images are placed as drawings with dimension lines and arrowheads showing their real pixel sizes, and with callout leaders that run from a figure across the margin to the exact line of text it belongs to. Text sits on a fine, visible construction grid. Pencil-on-vellum, not blue cyanotype. Numbers in the posts deserve special treatment here: `26 minutes` and `9.77 seconds` could be dimensioned. The dimension lines must be computed from each image's real `w`/`h`.

**08 `marginalia`.** The quiet one, and the closest to a simple blog. A single beautifully set text column in an old-style book face, with the margins doing all the unruly work. Images hang out into the margin, or sit in a notch cut into the text with `shape-outside` so lines wrap round them, sometimes starting mid-sentence. Captions and dates run sideways up the margin. It should look almost plain from a distance and reward a close read. It's the risk of the set: it can easily turn into a generic Tufte clone, so find a real idea about how margins behave, and on a phone answer the question of where a margin goes when there isn't one.
