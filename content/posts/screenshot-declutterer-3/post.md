When I built Screenshot Declutterer, I added a few features to help rename the screenshots I wanted to keep.

The obvious next step was automated renaming.

I started with Ollama and Gemma 4 E2B. It was a small model by current LLM standards, but it still wanted about 7.7 GB of GPU memory on my 16 GB Mac. It also took around 21 seconds to suggest a name for one screenshot.

That is a long time to wait for "customer-support-chat.png".

So I tried to avoid the vision model altogether.

Apple already has text recognition. I could OCR each screenshot, send the extracted text to a small text-only LLM, and use that to build the filename.

It was lighter. It was also becoming a second system to maintain. Screenshots are more than their text. Layouts, charts, UI state, diagrams. I couldn't get to a version I liked.

I even considered adding a bring-your-own-key option and sending the screenshots to a hosted provider like Groq.

That would have made Screenshot Declutterer a worse version of Windows Recall: it would look through your screenshots, and you would still need to bring your own API key.

Then YouTube recommended a video of Google developers getting Gemma 4 E2B running on a Raspberry Pi 5.

A model that felt too heavy for my Mac was running on a tiny board. That made me look at the runtime again.

That led me to LiteRT-LM.

LiteRT-LM averaged 6.5 seconds per image, compared with 20.9 seconds with Ollama.

Under the hood, the gain comes from a few edge-focused choices. Gemma 4 E2B uses mixed 2-, 4-, and 8-bit weights, which cuts the model size. LiteRT-LM memory-maps the large embedding layers, keeps the KV cache bounded, and loads the model weights once instead of duplicating them for every session. Less data, less duplication, and a smaller working set.

The model on disk dropped from 7.2 GB to 2.4 GB. The whole app plus LiteRT-LM uses about 1.8 GB of RAM on my machine. 

The rename feature is now local, optional, and actually usable. The image goes to localhost, the model runs on the Mac, and nothing leaves the machine.

Small models only become useful when they fit the machine. That makes features like this possible inside a normal desktop app.

That opens up a lot more room for local agentic software. The model can work beside the app instead of every input being sent to a cloud API.
