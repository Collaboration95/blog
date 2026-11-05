A while back I built a little Flask app to clean up the screenshot graveyard on my
desktop. Drag to keep, drag to trash, gone. 

But sorting was only half the problem.

Every screenshot I kept still had a name like Screenshot 2026-04-11 at 6.25.28 PM.png.  Good luck finding any of them later without opening each one first.

Since the first post, I've added the usual quality-of-life things: more image
formats, keyboard shortcuts, a full-size preview. Under the hood, there's now a small memory store, so the app doesn't re-analyse a screenshot it's already seen. It fingerprints each file by name + size, no hashing, basically free since it already reads both.

I also added rename, so you can fix a file's name straight from the card.
Renaming by hand works. But the obvious next thing was to try to automate it by hand and have the app look at a screenshot and suggest a name itself. 

The obvious way is a vision model: hand the whole screenshot to a local LLM and ask for a name. Gemma4:e2b does it well. It also wants ~7.7 GB of RAM and a second or two per image. On a 16 GB laptop, that's most of the machine. 

I am lucky since my M1 Mac's Unified Memory means I can treat ram like VRAM ( generalising here) and it allows more headroom. 

So I started poking in the other direction. Most screenshots are mostly text. What if I OCR the image first (pytesseract, no GPU), then send just the text to a tiny ~1.5 GB text-only model? Early numbers look like ~10x faster and ~80% less GPU RAM at similar quality. Either way, nothing leaves the machine.
