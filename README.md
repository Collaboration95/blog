# Guru's blog

My LinkedIn posts, restyled, so I can hand someone a link to one project instead of digging through LinkedIn.
Static HTML, no framework, no runtime dependencies. Served by GitHub Pages at <https://collaboration95.github.io/blog/>.

## Layout

| Path | What it is |
| --- | --- |
| `content/` | The posts: `posts.json` (verbatim copy, dates, projects, image sizes and alt text) and the images. |
| `designs/` | The live designs. Each `build.mjs` reads `content/` and writes its pages next to itself. |
| `build.mjs` | Builds the live site into `dist/`: Cut and Paste at the root, Rebus under `rebus/`, with the switch between them. |
| `labs/` | Designs that aren't live: Character Grid (kept as a template) and the retired concepts. Each still builds. |
| `tools/` | `series.mjs` (the series rail every design uses), `check.mjs`, `shots.mjs`, `port.py`. |
| `ideas/` | Ideas kept without code (Branch Graph). |
| `NOTES.md`, `BRIEF.md` | Decisions so far, and the original design brief. |

## Two designs, one site

Every page exists in both designs at the same path. Readers get one design per day (they alternate), unless they pick one with the small switch in the top right; that choice is remembered. Share previews and `rel=canonical` always point at the root copy. To change the default or the rotation, edit `DESIGNS` and `steer()` in `build.mjs`.

## Working on it

```sh
node build.mjs        # dist/, open dist/index.html straight from disk
npm install           # Playwright, only needed for the check and screenshots
npm run check         # crawls both designs at 1280 and 390 wide; must end in PASS
npm run shots         # screenshots into gallery/shots/
```

Pushing to `main` deploys (`.github/workflows/pages.yml`).

## Adding a post

`tools/port.py` regenerates `content/` from the private posts repo checked out next to this one (`../linkedin/published`, or set `LINKEDIN_PUBLISHED`). Add the post to `P` (and its pictures to `IMG`) in the script, add any new `lnkd.in` link to `tools/links.json`, and run it. Private notes in the source are stripped and never published. Post copy stays verbatim: typos, spacing and all.
