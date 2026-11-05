#!/usr/bin/env python3
"""Port linkedin/published into content/. Reads the source repo; writes only under content/."""
import html, json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# The private posts repo, checked out next to this one. Only post.md and listed images are read.
SRC = Path(os.environ.get('LINKEDIN_PUBLISHED', ROOT.parent / 'linkedin' / 'published'))
OUT = ROOT / 'content'
# lnkd.in short links resolved to where they go. A new short link must be added here before porting.
LINKS = json.load(open(ROOT / 'tools' / 'links.json'))
ACTIVITY = 'https://www.linkedin.com/feed/update/urn:li:activity:{}/'

PROJECTS = {
    'the-commons': {'title': 'The Commons', 'line': 'a room that builds itself'},
    'researchagent': {'title': 'ResearchAgent', 'line': 'a research agent with a wallet.'},
    'screenshot-declutterer': {'title': 'Screenshot Declutterer', 'line': 'My desktop used to be a graveyard of screenshots.'},
    'yald': {'title': 'yald', 'line': 'the dashboard I built to see where my AI coding tokens go.'},
    'plotline': {'title': 'Plotline', 'line': ''},
    'ai-grand-prix': {'title': 'AI Grand Prix', 'line': ''},
    'aws-certs': {'title': 'AWS certifications', 'line': ''},
    'claude-code-notes': {'title': 'Claude Code notes', 'line': ''},
}

# id, source folder (a folder holding post.md, relative to SRC), date, project, kind, label.
# The date must match the "Published YYYY-MM-DD" in the post's Notes line when it has one.
P = [
 ('primech-internship','primech-internship','2024-09-25',None,'career','Primech A&P internship'),
 ('agent-done-notifier','2026-03-04-cursor-to-claude-code','2026-03-04','claude-code-notes','tool','Agent-done notifier skill'),
 ('aws-cloud-practitioner','2026-03-07-aws-cloud-practitioner','2026-03-07','aws-certs','cert','AWS Cloud Practitioner'),
 ('aws-ai-practitioner','2026-03-10-aws-ai-practitioner','2026-03-10','aws-certs','cert','AWS AI Practitioner'),
 ('cursor-to-claude-code','2026-03-21-cursor-to-claude-code-migration','2026-03-21','claude-code-notes','reflection','Cursor to Claude Code migration'),
 ('agent-context-layer','2026-03-24-agent-context-layer','2026-03-24','claude-code-notes','tool','Agent context layer'),
 ('screenshot-declutterer-1','2026-04-02-ss-cdl','2026-04-02','screenshot-declutterer','project','Screenshot Declutterer, first post'),
 ('pr-flow','2026-04-10-cc-pr-skill','2026-04-10','claude-code-notes','tool','PR flow skill'),
 ('aws-saa','2026-04-18-aws-solutions-architect','2026-04-18','aws-certs','cert','AWS Solutions Architect Associate'),
 ('aws-dva','2026-04-23-aws-dva-c02','2026-04-23','aws-certs','cert','AWS Developer Associate'),
 ('stylemind','2026-05-04-stylemind','2026-05-04',None,'project','StyleMind'),
 ('aws-sap','2026-06-08-aws-sap-c02','2026-06-08','aws-certs','cert','AWS Solutions Architect Professional'),
 ('screenshot-declutterer-2','2026-06-12-ss-cdl-2','2026-06-12','screenshot-declutterer','project','Screenshot Declutterer, OCR rename'),
 ('apple-health-import','2026-07-02-tti-post-1','2026-07-02',None,'project','Apple Health import rewrite'),
 ('anthropic-shared-chats','2026-07-26-anthropic-shared-chat-privacy','2026-07-26',None,'reflection','Anthropic shared-chat privacy'),
 ('screenshot-declutterer-3','2026-08-18-ss-dcl-3','2026-08-18','screenshot-declutterer','project','Screenshot Declutterer, LiteRT-LM'),
 ('mandateflow','2026-09-01-mandateflow-tiktok-techjam','2026-09-01',None,'project','MandateFlow, TikTok TechJam'),
 ('singhacks-day-1','2026-09-05-singhacks-2026-day-1','2026-09-05','researchagent','event','SingHacks 2026, day 1'),
 ('singhacks-finalist','2026-09-07-singhacks-researchagent','2026-09-07','researchagent','reflection','SingHacks 2026, finalists'),
 ('deepseek-off-peak','2026-09-11-deepseek-off-peak-pricing','2026-09-11',None,'project','DeepSeek off-peak pricing site'),
 ('friday-hacks-300','2026-09-11-nus-hackers-300th-friday-hacks','2026-09-11',None,'event','Friday Hacks #300'),
 ('handoff','2026-09-12-handoff-finance-workflow-agent','2026-09-12',None,'project','Handoff finance workflow agent'),
 ('gpt-6-astra-night','2026-09-16-gpt-6-astra-demo-night','2026-09-16',None,'event','GPT-6 Astra Demo Night'),
 ('friday-hacks-301','2026-09-19-nus-hackers-301','2026-09-19',None,'event','Friday Hacks #301'),
 ('researchagent-invitation','2026-09-21-researchagent-ai-tinkerers-invitation','2026-09-21','researchagent','project','ResearchAgent, demo invitation'),
 ('researchagent-lineup-repost','2026-09-23-researchagent-demo-lineup-repost','2026-09-23','researchagent','repost','ResearchAgent, lineup repost'),
 ('hermes-agent-night','2026-09-30-hermes-ai-agent-night-aws','2026-09-30','researchagent','event','Hermes AI Agent Night at AWS'),
 ('researchagent-team-repost','2026-10-02-researchagent-demo-announcement-repost','2026-10-02','researchagent','repost','ResearchAgent, team repost'),
 ('yald','2026-10-07-yald-llm-dashboard','2026-10-07','yald','project','yald, an LLM dashboard'),
 ('lorong-speech-embeddings','2026-10-08-lorong-ai-embeddings-speech','2026-10-08',None,'event','Lorong AI, speech and embeddings'),
 ('sq-collective-jev','2026-10-10-sq-collective-jev','2026-10-10',None,'event','SQ Collective, Jev talk'),
 ('researchagent-demo','2026-10-12-researchagent-ai-tinkerers-demo','2026-10-12','researchagent','project','ResearchAgent, AI Tinkerers demo'),
 ('commons-best-use-of-tech','2026-10-12-common-ground-best-use-of-tech','2026-10-12','the-commons','project','The Commons, Best Use of Tech'),
 ('commons-peoples-choice','2026-10-12-common-ground-peoples-choice','2026-10-12','the-commons','project',"The Commons, People's Choice"),
 ('commons-agent-logs','2026-10-13-common-ground-agent-logs','2026-10-13','the-commons','project','The Commons, the day in data'),
 ('commons-claude-switch','2026-10-14-common-ground-claude-code-sg','2026-10-14','the-commons','project','The Commons, moving to Claude'),
 ('plotline','hack-and-hire-plotline/post-1','2026-10-21','plotline','project','Plotline, Hack&Hire'),
 ('yald-meet-yaldi','2026-10-23-post-2-meet-yaldi','2026-10-23','yald','project','yald 0.2.0, meet Yaldi'),
 ('plotline-track-win','hack-and-hire-plotline/post-2','2026-10-23','plotline','project','Plotline, track win'),
 ('prompt-fu','2026-10-26-openai-aigp-hackathon','2026-10-26','ai-grand-prix','project','Prompt Fu, AI Grand Prix'),
 ('ai-grand-prix-team','2026-10-27-ai-grandprix-hackathon','2026-10-27','ai-grand-prix','event','AI Grand Prix, team build'),
 ('yald-speed','2026-11-03-post-3-speed','2026-11-03','yald','project','yald 0.3.0, faster'),
]

# Images per post, in the order the live LinkedIn post shows them (the "sync … from LinkedIn" captures in
# the source repo). Where a capture has a full-size original in the same folder, the original is used.
# Paths are relative to the post's folder.
IMG = {
 'agent-done-notifier': [('assets/01-ntfy-notifications.jpg','Three ntfy notifications titled "Agent Update", each reporting a finished Claude Code task.')],
 'aws-cloud-practitioner': [('assets/01-certification-thumbnail.jpg',"LinkedIn's animated certification card: a book of illustrated pages flipping.")],
 'aws-ai-practitioner': [('assets/01-certification-thumbnail.jpg',"LinkedIn's animated certification card: binoculars looking out over a sea with a bird.")],
 'cursor-to-claude-code': [('assets/01-claude-code.jpg','Claude Code open in a terminal window on the desktop.')],
 'agent-context-layer': [('assets/01-claude-sessions.jpg','Two Claude Code sessions side by side, one showing /context token usage, the other the /config settings.')],
 'screenshot-declutterer-1': [('assets/01-board.jpg','Screenshot Declutterer board with Keep, Unsorted and Trash columns of screenshots.'),
             ('assets/02-trash.jpg','Confirm dialog: "Move 3 screenshots to Trash?", recoverable from the macOS Trash.')],
 'pr-flow': [('assets/cc-pr-skill-modal.png','PR flow skill card: "Ship faster. Without shipping garbage."'),
             ('assets/cc-pr-skill-cli.png','The PR flow skill running in the terminal.')],
 'aws-saa': [('assets/01-certification.jpg','Certificate card: AWS Certified Solutions Architect Associate, score 911/1000.')],
 'aws-dva': [('assets/db-caching.png','Diagram of lazy loading, write-through and write-behind caching between app, cache and DB.'),
             ('assets/cda-card.png','Certificate card: AWS Certified Developer Associate, listing the cert stack.')],
 'stylemind': [('assets/StyleMind-overview.png','StyleMind overview: learns your style from conversation and recommends with context.'),
             ('assets/architecture.png','StyleMind architecture: CLI and web UI, FastAPI, RAG and persona layers, Neo4j.'),
             ('assets/graph-traversal.png','Outfit graph traversal, from anchor product through coherence filter to the suggestion.')],
 'aws-sap': [('assets/Disaster-Recovery-image.png','AWS disaster recovery strategies from Backup and Restore to Multi-site Active-Active, ordered by cost and recovery time.')],
 'screenshot-declutterer-2': [('assets/ss-dcl-image-2.png','Screenshot Declutterer, the arc: before, sort and trash, then naming.'),
             ('assets/ss-dcl-image-1.png','Naming a screenshot: vision model versus OCR plus a text LLM.')],
 'apple-health-import': [('assets/01-import-benchmark.jpg','Infographic "How I made a 26-min import run in 9.77 seconds (163x faster)": baseline, first optimisations, profiling, rewrite, result.')],
 'anthropic-shared-chats': [('assets/01-shared-chat.jpg','A shared Claude chat page answering a question about Kansas attorney ethics reporting rules.')],
 'screenshot-declutterer-3': [('assets/abc.png','Whiteboard sketch: how LiteRT-LM makes Gemma 4 E2B practical on-device.'),
             ('assets/ss-dcl-demo-before-after.png','Before and after of the rename feature in Screenshot Declutterer.')],
 'mandateflow': [('assets/01-title.jpg','Title slide: "MandateFlow." for TikTok TechJam 2026, by team Cache Me If You Can.'),
             ('assets/02-flow.jpg','MandateFlow flow: agent calls pass through a gateway that allows them, denies them or offers a safe aggregate.')],
 'singhacks-day-1': [('assets/01-payments.jpg','A speaker in front of a curved screen showing an "Agentic payments" maturity curve.'),
             ('assets/02-blockchain.jpg','Slide "Agentic payments and blockchain": a Venn diagram beside trust, transparency, velocity, anonymity and autonomy.'),
             ('assets/03-stage.jpg','The SingHacks 2026 title on a curved red screen.'),
             ('assets/04-laptop.jpg','A laptop on a desk beside a coffee cup and a wooden fork.')],
 'singhacks-finalist': [('assets/01-team.jpg','The team on stage in front of "The Fast and The Fungible".'),
             ('assets/02-selfie.jpg','Selfie of the team giving thumbs up.'),
             ('assets/03-workspace.jpg','Selfie of the team at their table, one holding up a laptop.'),
             ('assets/04-architecture.jpg','ResearchAgent architecture: researcher, research desk, an API with query planner, budget guard and cited synthesizer.')],
 'deepseek-off-peak': [('assets/01-countdown.jpg','DeepSeek API pricing page: "Peak right now.", with a countdown to off-peak.'),
             ('assets/02-benchmarks.jpg','Benchmark table comparing DeepSeek V4 models with GLM, Kimi, GPT and Claude.')],
 'friday-hacks-300': [('assets/01-group.jpg','Selfie of Guru with two friends at Friday Hacks.'),
             ('assets/02-quack.jpg','A duck mascot on stage at Friday Hacks #300.'),
             ('assets/03-talk.jpg','A speaker presenting "Getting the word out (without being annoying)".')],
 'handoff': [('assets/01-team.jpg','Selfie of Guru with a teammate at their laptops.'),
             ('assets/02-diagram.jpg','Slide "Behind the scenes": Handoff goes from a live meeting through the voice agent and finance API to human approval.')],
 'gpt-6-astra-night': [('assets/01-group.jpg','Selfie of Guru with two others at GPT-6 Astra Demo Night.'),
             ('assets/02-demo.jpg','A dense illustrated scene of Singapore on the big screen.'),
             ('assets/03-audience.jpg','The audience facing a lit stage in a dark room.'),
             ('assets/04-selfie.jpg','Selfie of Guru with a friend in the audience.'),
             ('assets/05-game.jpg','A browser game demo on the projector.')],
 'friday-hacks-301': [('assets/speaker-selfie-01.jpeg','Selfie of Guru with a speaker after Friday Hacks #301, thumbs up.'),
             ('assets/handwritten-notes-01.jpeg','A notebook page of handwritten questions from the talks, on AI code review, agent memory and model-found exploits.'),
             ('assets/terraform-entrypoint.jpeg','Slide: "What\'s the entrypoint for Terraform?"')],
 'researchagent-invitation': [('assets/01-research-loop.jpg','Diagram "ResearchAgent: a calm research loop": the research desk, a pause to price a source, an optional checkout, back to the answer.'),
             ('assets/02-receipt.jpg','Slide "A better kind of receipt. Not a chat transcript. Not a vibes score." beside a one-page research briefing.')],
 'hermes-agent-night': [('assets/01-bedrock.jpg','A speaker at an AWS podium presenting "So what is Bedrock AgentCore?"'),
             ('assets/02-group.jpg','Instant photo of Guru with three others at the event.'),
             ('assets/03-stage.jpg','A speaker on stage at AWS, two screens and a seated audience.'),
             ('assets/04-speaker.jpg','Instant photo of a speaker at a podium.'),
             ('assets/05-attendees.jpg','Group photo of the attendees on the steps at AWS.')],
 'researchagent-team-repost': [('assets/01-speaker-spotlight.jpg','AI Tinkerers Singapore speaker spotlight: "ResearchAgent: An Evidence Procurement Guard for AI Research", Guruprasath Gopal, Saturday 10 October 2026.')],
 'yald': [('assets/01-heatmap.jpg','yald activity heatmap by weekday and hour, one cell at 170.7M tokens.'),
             ('assets/02-usage.jpg','yald Usage page: totals, token composition over time and cache efficiency.')],
 'lorong-speech-embeddings': [('assets/04-goto-embedding-results.jpeg','Slide: "Singaporean speech is hard for generic models. Eh, you makan already a not ah?"'),
             ('assets/05-singlish-speech-slide.jpeg','Selfie of Guru and En Lih Lye after the session.'),
             ('assets/01-selfie-en-lih.jpg','Slide: two problems with training many tasks at once.'),
             ('assets/06-moonstone-multitask-training.jpeg','Speaker in front of a "Sequence Packing" slide.'),
             ('assets/03-sequence-packing.jpeg','Speaker introduction slide for Nguyen Vincent Thong on the stage screen.'),
             ('assets/02-vincent-goto-intro.jpeg','Results table slide: "Where we are today and what we did".')],
 'sq-collective-jev': [('assets/2.jpg','Gang Rui presenting Jev in a dark room, a product UI on the projector.'),
             ('assets/1.jpg','Selfie of Guru and Gang Rui at SQ Collective.'),
             ('assets/3.jpg','Gang Rui on stage with the slide "How do you define a useful task for Jev?"')],
 'researchagent-demo': [('assets/01-presentation.jpg','Guru at a podium presenting "Three layers: A asks, B sells, C settles".'),
             ('assets/02-group.jpg','Selfie of Guru with three others giving thumbs up.'),
             ('assets/03-speaker.jpg','AI Tinkerers main stage speaker card: "ResearchAgent: Evidence Procurement Guard", Guruprasath Gopal, Singapore, October 10.'),
             ('assets/04-audience.jpg','Selfie of Guru in the audience.'),
             ('assets/05-cityscape.jpg','A presenter on stage with an illustrated city on the screen.')],
 'commons-best-use-of-tech': [('assets/04-award-live.jpg','Winners and organisers in front of the "Common Ground" screen, holding the award.'),
             ('assets/01-title-slide.png','Title slide of the pitch deck: "The Commons, a room that builds itself", over a pixel-art void deck at dusk.'),
             ('assets/06-polaroid.jpg','Instant photo of Guru and a teammate at their laptops.'),
             ('assets/07-group.jpg','Selfie of builders around a table of laptops.'),
             ('assets/08-event.jpg','The Common Ground stage, two screens of event slides and people at laptops in front.')],
 'commons-peoples-choice': [('assets/01-slide-codex-loop.png','Slide: behind the scenes, the Codex loop from phone wish to live sprite.')],
 'commons-agent-logs': [('assets/06-linkedin-cost.jpg','Page section "One pet costs about a dime": cost per wished pet at API rates, $0.89 to $1.29 for 10 pets.'),
             ('assets/07-linkedin-server.jpg','Page section "The biggest bill is the server": a laptop and quick tunnel on demo day for $0, then a Lightsail box for about $8 over three days.'),
             ('assets/08-linkedin-design.jpg','Design boards: storyboards of the room, table sketches and pocket-stage frames.'),
             ('assets/09-linkedin-laptop.jpg','A laptop on a round table beside a plate of pastries.')],
 'commons-claude-switch': [('assets/08-linkedin-hero.jpg','Page hero: "I switched to Claude. A pet goes live in 15 seconds. It took 47."'),
             ('assets/01-whats-new-for-builders.jpg','Speakers on stage in front of a "What\'s new for Builders" slide.'),
             ('assets/02-chengyu-calendar.jpg','Chengyu Calendar demo on stage, a daily Chinese idiom widget.')],
 'plotline': [('../assets/1-hero.png','Plotline brief site: "Decision layer: algorithm, schema and benchmarks", with its headline numbers.'),
             ('../assets/2-layers.png','"Four source rasters, one decision plane": the input map layers stacked into one.'),
             ('../assets/3-store.png','The .plds byte layout of the decision store.'),
             ('../assets/5-schema.png','"20 codes, two levels": the screening and decision codes.'),
             ('../assets/7-map-no-plots.png','Forest-loss map of the sample region with a year timeline, private plots hidden.')],
 'yald-meet-yaldi': [('assets/01-yaldi-cover.png','Four poses of Yaldi, a small robot detective with a coral cap: looking through a magnifying glass, reading a bar-chart notebook, spotting a clue, and asleep.'),
             ('assets/02-overview.png','yald Overview page in light theme showing synthetic demo usage, with a Demo banner and the Yaldi mascot.'),
             ('assets/04-project-radar.png','Project Radar in light theme: synthetic project comparison against the preceding window, with Yaldi.')],
 'plotline-track-win': [('../assets/0-certificate.png','Certificate of Merit, Hack & Hire 2026: Guruprasath Gopal, Mrigakshi Roy Choudhury and Ibrahim Mammadov, ranked joint 1st of 4 entries.'),
             ('../assets/1-hero.png','Plotline brief site: "Decision layer: algorithm, schema and benchmarks", with its headline numbers.'),
             ('assets/03-linkedin-image.jpg','The Plotline wordmark drawn in map-cell dots.')],
 'prompt-fu': [('assets/01-prompt-fu-opening-slide.jpg','Prompt Fu title slide: "Make a snack. Start a food fight.", with four food fighters.'),
             ('assets/02-linkedin-image.jpg','Slide "The arena is yours too": three arena themes, Desert, Autumn Dojo and Candy Land.'),
             ('assets/03-linkedin-image.jpg','Slide "The snack lineup": Vock the avocado, Donny the donut, Shari the sushi and Greg the eggplant.'),
             ('assets/04-linkedin-image.jpg','Slide "Your phone is the controller": scan the QR code, take a fighter slot, then move and throw.'),
             ('assets/05-linkedin-image.jpg','An organiser on stage beside a "Welcome, builders. AI Grand Prix" slide.')],
 'ai-grand-prix-team': [('assets/01-linkedin-image.jpg','Slide "The idea": "Same simple text box. A new screen every time." over a wall of generated shopping screens.'),
             ('assets/02-linkedin-image.jpg','The team presenting on stage, a phone UI and a "click" slide on the projector.'),
             ('assets/03-linkedin-image.jpg','Selfie of Guru with teammates at table 8, laptops open.'),
             ('assets/04-linkedin-image.jpg','A speaker in front of a "Build the experience customers will ask for" slide.'),
             ('assets/05-team-hallway.jpg','The team in a red-lit hallway.')],
 'yald-speed': [('assets/speedup.png',"Before and after bars for yald's Cost and Usage pages on a linear scale: Cost about 33x and Usage about 20x faster on first open, with Yaldi."),
             ('assets/01-yaldi.png','Four poses of Yaldi, a small robot detective with a coral cap.')],
}

URL = re.compile(r'https?://[^\s)\]]+')
JOINERS = {'in','by','a','an','the','to','of','and','with','on','for','from','my','be','at'}


def clean_body(raw):
    t = re.split(r'^\*\*Notes:\*\*', raw, flags=re.M)[0].rstrip()
    t = re.sub(r'\n-{3,}\s*$', '', t).rstrip()
    assert 'Notes:' not in t and 'DATE UNKNOWN' not in t
    return t


def notes_of(raw):
    m = re.search(r'^\*\*Notes:\*\*(.*)$', raw, flags=re.M)
    return m.group(1) if m else ''


def blocks_of(body):
    """Split into blocks. Only whitespace changes; no word or punctuation is touched."""
    out, buf = [], []
    for ln in body.split('\n'):
        ln = ln.strip()
        if not ln:
            continue
        prev = out[-1] if out else None
        if prev and prev['k'] == 'p':
            pt = prev['t'].rstrip()
            last = pt.split()[-1].lower() if pt.split() else ''
            tail_open = pt[-1] not in '.!?:;)"”]' and not URL.search(pt.split()[-1])
            if tail_open and not ln.startswith(('http', '→', '-', '▸', '/')) and (ln[0].islower() or last in JOINERS):
                prev['t'] = pt + ' ' + ln
                continue
        if re.fullmatch(r'━+ .* ━+', ln):
            out.append({'k': 'h', 't': ln})
        elif re.search(r'[├└]──|^↓$', ln):
            if prev and prev['k'] != 'pre' and prev['t'].startswith(('global skills', 'per-repo')):
                prev['k'] = 'pre'
            if prev and prev['k'] == 'pre':
                prev['t'] += '\n' + ln
            else:
                out.append({'k': 'pre', 't': ln})
        elif prev and prev['k'] == 'pre' and ln.startswith('per-repo'):
            prev['t'] += '\n' + ln
        else:
            out.append({'k': 'p', 't': ln})
    return out


def show(url):
    """What a reader sees for a link: the destination, without scheme, www or query."""
    s = re.sub(r'^https?://(www\.)?', '', url).split('?')[0].split('#')[0].rstrip('/')
    return s[:44] + '…' if len(s) > 45 else s


def to_html(text):
    pos, out, links = 0, [], []
    for m in URL.finditer(text):
        raw = m.group(0).rstrip('.,;')
        assert not raw.startswith('https://lnkd.in/') or raw in LINKS, f'add {raw} to tools/links.json'
        dest = LINKS.get(raw, raw)
        out.append(html.escape(text[pos:m.start()], quote=False))
        out.append(f'<a href="{html.escape(dest)}">{html.escape(show(dest), quote=False)}</a>')
        links.append(dest)
        pos = m.start() + len(raw)
    out.append(html.escape(text[pos:], quote=False))
    return ''.join(out), links


def process_image(src, dst):
    # Animated sources (LinkedIn's certification cards) stay animated: coalesce, then animated WebP.
    subprocess.run(['magick', str(src), '-coalesce', '-auto-orient', '-strip', '-resize', '1600x1600>',
                    '-quality', '80', str(dst)], check=True)
    w, h = subprocess.run(['magick', 'identify', '-format', '%w %h\n', str(dst)],
                          check=True, capture_output=True, text=True).stdout.split('\n')[0].split()
    return int(w), int(h)


def main():
    folders = {str(p.parent.relative_to(SRC)) for p in SRC.rglob('post.md')}
    assert folders == {p[1] for p in P}, folders ^ {p[1] for p in P}
    assert set(IMG) <= {p[0] for p in P}, set(IMG) - {p[0] for p in P}
    if OUT.exists():
        shutil.rmtree(OUT)
    posts = []
    for pid, folder, date, project, kind, label in P:
        d = OUT / 'posts' / pid
        d.mkdir(parents=True)
        raw = (SRC / folder / 'post.md').read_text()
        notes = notes_of(raw)
        pub = re.search(r'Published (\d{4}-\d\d-\d\d)', notes)
        assert not pub or pub.group(1) == date, (pid, date, pub.group(1))
        act = re.search(r'urn:li:activity:(\d+)', notes)
        body = clean_body(raw)
        (d / 'post.md').write_text(body + '\n')
        blocks, links = [], []
        for b in blocks_of(body):
            h, l = to_html(b['t']) if b['k'] != 'pre' else (html.escape(b['t'], quote=False), [])
            blocks.append({'kind': {'p': 'p', 'h': 'heading', 'pre': 'pre'}[b['k']], 'html': h})
            links += l
        imgs = []
        for i, (rel, alt) in enumerate(IMG.get(pid, []), 1):
            name = f'{i:02d}.webp'
            w, h = process_image(SRC / folder / rel, d / name)
            imgs.append({'src': f'content/posts/{pid}/{name}', 'w': w, 'h': h, 'alt': alt})
        plain = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', blocks[0]['html'])).strip()
        posts.append({'id': pid, 'date': date, 'dateApprox': False, 'project': project, 'kind': kind,
                      'label': label, 'opening': html.unescape(plain), 'blocks': blocks, 'images': imgs,
                      'words': len(body.split()), 'links': sorted(set(links)),
                      'linkedin': ACTIVITY.format(act.group(1)) if act else None})
    posts.sort(key=lambda p: (p['date'], p['id']), reverse=True)
    projects = []
    for key, meta in PROJECTS.items():
        ids = [p['id'] for p in posts if p['project'] == key]
        projects.append({'id': key, **meta, 'posts': ids,
                         'first': min(p['date'] for p in posts if p['id'] in ids),
                         'last': max(p['date'] for p in posts if p['id'] in ids)})
    projects.sort(key=lambda p: p['last'], reverse=True)
    json.dump({'site': "Guru's blog", 'author': 'GuruPrasath Gopal', 'projects': projects, 'posts': posts},
              open(OUT / 'posts.json', 'w'), indent=1, ensure_ascii=False)
    print(len(posts), 'posts,', sum(len(p['images']) for p in posts), 'images,',
          sum(1 for p in posts if not p['images']), 'with no image')


if __name__ == '__main__':
    sys.exit(main())
