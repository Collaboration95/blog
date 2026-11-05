Part 2 of my Claude Code post. This one is about context.

Context is everything in agentic coding. The more work you want to orchestrate, the better your context handling needs to be.

Two tasks side by side:

▸ Modify function argument to indicate return type
→ Doesn't need much context. Most IDEs already tell the agent which files are open.

▸ Add StreamingBuffer implementation to buffer object writes
→ Compressed or uncompressed size? What triggers a flush vs. a hard close? Callbacks per-part or only at the end?
None of that is inferable from the file alone or given intent. 

Before I switched to Claude Code, I was on Cursor + OpenCode for lighter tasks. So even then, I couldn't rely on Cursor's indexing alone.

I cobbled together a simple flow — and when I moved to CC, I took it with me with minimal changes.

━━━ THE AI CONTEXT LAYER ━━━

The idea was simple:

 global skills (update-context, plan-feature)
     ↓
 per-repo .context/ folder
    ├── SERVICE.md ← architecture, data flow, integrations
    ├── PAST_LEARNINGS.md ← append-only gotcha log
   └── CHANGELOG.context.md ← drift detection via SHA tracking

The skills read this context before doing anything.
Keeps the AI grounded. No re-explaining the codebase every session.

For Claude Code the equivalent is:

CLAUDE.md → AGENTS.md → .context/

CLAUDE.md = entry point, 3 lines, points to AGENTS.md
AGENTS.md = points to .context/ files, lists available /skills
 .context/ = the actual knowledge base (same structure as above)

Claude Code doesn't do codebase indexing (mentioned in my last post).
This is the workaround. You build the "index" yourself, once, and maintain it.

Sure, you can use Claude's built-in memory — but the moment you move to OpenCode, Codex CLI, or anything else, that context is gone. This approach is tool-agnostic.

/update-context → checks git log since last SHA, rewrites only drifted sections
/plan-feature  → reads SERVICE.md + PAST_LEARNINGS before any planning

Never explain your service topology to an AI again.

Full setup, file templates, and sample structure (github link)
→ https://lnkd.in/g32xuuSj

━━━ QUICK TIPS ━━━

/improve — prompts Claude to reflect on your session and suggest workflow improvements. Actually useful after a long task.

/color red (or any color) — changes the prompt bar color. Useful when running multiple Claude sessions in parallel — instant visual cue for which window you're in.

/context — shows how much context you're consuming in the current session. Check before kicking off something expensive. Push on or start fresh?

! <shell command> — bypasses Claude and runs directly in the CLI.
eg: ! gh pr list


━━━ NEXT UP ━━━

If you're a Claude Code power user, what do you use to orchestrate and keep track of work across sessions?

Been looking at Superset (https://superset.sh/) — looks interesting. More on that next time.
