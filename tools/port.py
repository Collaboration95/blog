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
    'aws-certs': {'title': 'AWS certifications', 'line': ''},
    'claude-code-notes': {'title': 'Claude Code notes', 'line': ''},
}

# id, source folder, date, approx?, project, kind, label, activity id
P = [
 ('primech-internship','primech-internship','2024-09-25',0,None,'career','Primech A&P internship','7244587865471361025'),
 ('agent-done-notifier','2025-03-10-cursor-to-claude-code','2026-03-04',0,'claude-code-notes','tool','Agent-done notifier skill','7434982735221338113'),
 ('aws-cloud-practitioner','2025-03-02-aws-cloud-practitioner','2026-03-07',0,'aws-certs','cert','AWS Cloud Practitioner','7436048088559071232'),
 ('aws-ai-practitioner','2025-02-24-aws-ai-practitioner','2026-03-10',0,'aws-certs','cert','AWS AI Practitioner','7437162933094227968'),
 ('cursor-to-claude-code','cursor-to-claude-code-migration','2026-03-21',0,'claude-code-notes','reflection','Cursor to Claude Code migration','7441153705384603648'),
 ('agent-context-layer','agent-context-layer','2026-03-24',0,'claude-code-notes','tool','Agent context layer','7442248751899066369'),
 ('screenshot-declutterer-1','ss-cdl','2026-04-02',0,'screenshot-declutterer','project','Screenshot Declutterer, first post','7445500278713348096'),
 ('pr-flow','cc-pr-skill','2026-04-10',0,'claude-code-notes','tool','PR flow skill','7448404333127417856'),
 ('aws-saa','2026-04-10-aws-solutions-architect','2026-04-18',0,'aws-certs','cert','AWS Solutions Architect Associate','7451279575390609408'),
 ('aws-dva','2026-04-23-aws-dva-c02','2026-04-23',0,'aws-certs','cert','AWS Developer Associate','7452900932851380224'),
 ('stylemind','2026-06-15-stylemind','2026-05-04',0,None,'project','StyleMind','7457092933930967040'),
 ('aws-sap','2026-06-08-aws-sap-c02','2026-06-08',0,'aws-certs','cert','AWS Solutions Architect Professional','7469676877729759232'),
 ('screenshot-declutterer-2','2026-06-15-ss-cdl-2','2026-06-12',0,'screenshot-declutterer','project','Screenshot Declutterer, OCR rename','7471186821297676289'),
 ('apple-health-import','tti-post-1','2026-07-02',0,None,'project','Apple Health import rewrite','7478418199626080256'),
 ('anthropic-shared-chats','anthropic-shared-chat-privacy','2026-07-26',0,None,'reflection','Anthropic shared-chat privacy','7487062668315344896'),
 ('screenshot-declutterer-3','2026-08-15-ss-dcl-3','2026-08-18',0,'screenshot-declutterer','project','Screenshot Declutterer, LiteRT-LM','7495317303589343232'),
 ('mandateflow','mandateflow-tiktok-techjam','2026-09-01',0,None,'project','MandateFlow, TikTok TechJam','7500451311562375170'),
 ('singhacks-day-1','singhacks-2026-day-1','2026-09-05',0,'researchagent','event','SingHacks 2026, day 1','7501841567545106432'),
 ('singhacks-finalist','singhacks-researchagent','2026-09-07',0,'researchagent','reflection','SingHacks 2026, finalists','7502550000044752896'),
 ('deepseek-off-peak','deepseek-off-peak-pricing','2026-09-11',0,None,'project','DeepSeek off-peak pricing site','7504106389385084928'),
 ('friday-hacks-300','nus-hackers-300th-friday-hacks','2026-09-11',0,None,'event','Friday Hacks #300','7504180994317385728'),
 ('handoff','handoff-finance-workflow-agent','2026-09-12',0,None,'project','Handoff finance workflow agent','7504445479192276992'),
 ('gpt-6-astra-night','gpt-6-astra-demo-night','2026-09-16',0,None,'event','GPT-6 Astra Demo Night','7505994639787851777'),
 ('friday-hacks-301','nus-hackers-301','2026-09-19',1,None,'event','Friday Hacks #301',None),
 ('researchagent-invitation','researchagent-ai-tinkerers-invitation','2026-10-02',1,'researchagent','project','ResearchAgent, demo invitation',None),
 ('researchagent-team-repost','researchagent-demo-announcement-repost','2026-10-03',1,'researchagent','repost','ResearchAgent, team repost',None),
 ('yald','yald-llm-dashboard','2026-10-04',1,None,'project','YALD, an LLM dashboard',None),
 ('researchagent-lineup-repost','researchagent-demo-lineup-repost','2026-10-06',1,'researchagent','repost','ResearchAgent, lineup repost',None),
 ('hermes-agent-night','hermes-ai-agent-night-aws','2026-10-07',1,'researchagent','event','Hermes AI Agent Night at AWS',None),
 ('lorong-speech-embeddings','lorong-ai-embeddings-speech','2026-10-08',1,None,'event','Lorong AI, speech and embeddings',None),
 ('sq-collective-jev','sq-collective-jev','2026-10-09',1,None,'event','SQ Collective, Jev talk',None),
 ('researchagent-demo','researchagent-ai-tinkerers-demo','2026-10-11',1,'researchagent','project','ResearchAgent, AI Tinkerers demo',None),
 ('commons-best-use-of-tech','2026-10-12-common-ground-best-use-of-tech','2026-10-12',0,'the-commons','project','The Commons, Best Use of Tech',None),
 ('commons-peoples-choice','2026-10-12-common-ground-peoples-choice','2026-10-12',0,'the-commons','project',"The Commons, People's Choice",None),
 ('commons-agent-logs','2026-10-13-common-ground-agent-logs','2026-10-13',0,'the-commons','project','The Commons, the day in data','7515625184553537536'),
 ('commons-claude-switch','2026-10-14-common-ground-claude-code-sg','2026-10-14',0,'the-commons','project','The Commons, moving to Claude','7515981913485127680'),
]

# Images per post, in reading order. Lorong filenames don't match their contents, so these go by what the image shows.
IMG = {
 'aws-dva': [('assets/cda-card.png','Certificate card: AWS Certified Developer Associate, listing the cert stack.'),
             ('assets/db-caching.png','Diagram of lazy loading, write-through and write-behind caching between app, cache and DB.')],
 'aws-sap': [('Disaster-Recovery-image.png','AWS disaster recovery strategies from Backup and Restore to Multi-site Active-Active, ordered by cost and recovery time.')],
 'screenshot-declutterer-2': [('assets/ss-dcl-image-2.png','Screenshot Declutterer, the arc: before, sort and trash, then naming.'),
             ('assets/ss-dcl-image-1.png','Naming a screenshot: vision model versus OCR plus a text LLM.')],
 'stylemind': [('assets/StyleMind-overview.png','StyleMind overview: learns your style from conversation and recommends with context.'),
             ('assets/architecture.png','StyleMind architecture: CLI and web UI, FastAPI, RAG and persona layers, Neo4j.'),
             ('assets/graph-traversal.png','Outfit graph traversal, from anchor product through coherence filter to the suggestion.')],
 'screenshot-declutterer-3': [('ss-dcl-demo-before-after.png','Before and after of the rename feature in Screenshot Declutterer.'),
             ('abc.png','Whiteboard sketch: how LiteRT-LM makes Gemma 4 E2B practical on-device.')],
 'commons-best-use-of-tech': [('assets/01-title-slide.png','Title slide of the pitch deck: "The Commons, a room that builds itself", over a pixel-art void deck at dusk.'),
             ('assets/02-presenting.png','Guru presenting at a lectern; behind them a large screen shows The Commons live.'),
             ('assets/03-award.jpg','Winners and organisers in front of a "Common Ground" screen; Guru holds the award plaque.')],
 'commons-peoples-choice': [('assets/01-slide-codex-loop.png','Slide: behind the scenes, the Codex loop from phone wish to live sprite.')],
 'commons-agent-logs': [('assets/01-schedule-countdown.jpeg','The event schedule on a big screen: "Now: Build session 02" with a live countdown.'),
             ('assets/02-room-building.jpeg','Wide shot of the venue, rows of people building at laptops.'),
             ('assets/03-table-selfie.jpg','Selfie of builders around one table, laptops open.'),
             ('assets/04-cost-page-day-chart.png','Bar chart of tokens per 15 minutes from 23:41 to 17:45, Claude Code in orange and Codex in teal.'),
             ('assets/05-cost-page-hero.png','The cost page header: "What it cost", 300M tokens, a $2.79 API bill.')],
 'commons-claude-switch': [('assets/01-whats-new-for-builders.jpg','Speakers on stage in front of a "What\'s new for Builders" slide.'),
             ('assets/02-chengyu-calendar.jpg','Chengyu Calendar demo on stage, a daily Chinese idiom widget.'),
             ('assets/03-handmade-demo.jpg','Handmade demo slide: "Design in code. No round trip."'),
             ('assets/04-page-hero.jpg','Page hero: "I switched to Claude. A pet goes live in 15 seconds. It took 47."')],
 'pr-flow': [('assets/cc-pr-skill-modal.png','PR flow skill card: "Ship faster. Without shipping garbage."'),
             ('assets/cc-pr-skill-cli.png','The PR flow skill running in the terminal.')],
 'lorong-speech-embeddings': [('assets/05-singlish-speech-slide.jpeg','Selfie of Guru and En Lih Lye after the session.'),
             ('assets/04-goto-embedding-results.jpeg','Slide: "Singaporean speech is hard for generic models. Eh, you makan already a not ah?"'),
             ('assets/01-selfie-en-lih.jpg','Slide: two problems with training many tasks at once.'),
             ('assets/03-sequence-packing.jpeg','Speaker introduction slide for Nguyen Vincent Thong on the stage screen.'),
             ('assets/02-vincent-goto-intro.jpeg','Results table slide: "Where we are today and what we did".'),
             ('assets/06-moonstone-multitask-training.jpeg','Speaker in front of a "Sequence Packing" slide.')],
 # Only speaker-selfie-01 is confirmed as posted. Handwritten notes stay out of a public port.
 'friday-hacks-301': [('assets/speaker-selfie-01.jpeg','Selfie of Guru with a speaker after Friday Hacks #301, thumbs up.'),
             ('assets/ai-code-review-not-security-testing.jpeg','Slide: "AI code review is not security testing".'),
             ('assets/terraform-entrypoint.jpeg','Slide: "What\'s the entrypoint for Terraform?"')],
 'sq-collective-jev': [('assets/1.jpg','Selfie of Guru and Gang Rui at SQ Collective.'),
             ('assets/2.jpg','Gang Rui presenting Jev in a dark room, a product UI on the projector.'),
             ('assets/3.jpg','Gang Rui on stage with the slide "How do you define a useful task for Jev?"')],
}

URL = re.compile(r'https?://[^\s)\]]+')
JOINERS = {'in','by','a','an','the','to','of','and','with','on','for','from','my','be','at'}


def clean_body(raw):
    t = re.split(r'^\*\*Notes:\*\*', raw, flags=re.M)[0].rstrip()
    t = re.sub(r'\n-{3,}\s*$', '', t).rstrip()
    assert 'Notes:' not in t and 'DATE UNKNOWN' not in t
    return t


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
        dest = LINKS.get(raw, raw)
        out.append(html.escape(text[pos:m.start()], quote=False))
        out.append(f'<a href="{html.escape(dest)}">{html.escape(show(dest), quote=False)}</a>')
        links.append(dest)
        pos = m.start() + len(raw)
    out.append(html.escape(text[pos:], quote=False))
    return ''.join(out), links


def process_image(src, dst):
    subprocess.run(['magick', str(src), '-auto-orient', '-strip', '-resize', '1600x1600>',
                    '-quality', '80', str(dst)], check=True)
    w, h = subprocess.run(['magick', 'identify', '-format', '%w %h', str(dst)],
                          check=True, capture_output=True, text=True).stdout.split()
    return int(w), int(h)


def main():
    folders = {d.name for d in SRC.iterdir() if d.is_dir()}
    assert folders == {p[1] for p in P}, folders ^ {p[1] for p in P}
    if OUT.exists():
        shutil.rmtree(OUT)
    posts = []
    for pid, folder, date, approx, project, kind, label, act in P:
        d = OUT / 'posts' / pid
        d.mkdir(parents=True)
        body = clean_body((SRC / folder / 'post.md').read_text())
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
        posts.append({'id': pid, 'date': date, 'dateApprox': bool(approx), 'project': project, 'kind': kind,
                      'label': label, 'opening': html.unescape(plain), 'blocks': blocks, 'images': imgs,
                      'words': len(body.split()), 'links': sorted(set(links)),
                      'linkedin': ACTIVITY.format(act) if act else None})
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
