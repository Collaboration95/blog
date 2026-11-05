Just moved from Cursor to Claude Code

Here are some pointers for others looking to do the same

Setup is straightforward:
Get a Claude Max plan (5x) [recommended]
Install + authenticate https://lnkd.in/gW_Q_5Pp
Open terminal + run claude code . and follow the initial setup instructions, configure skills permissions, etc

My main concern before switching:
I was under Cursor’s 500 requests/month legacy plan which had just ended. I had tailored my workflows to be “request” efficient and not token efficient (I was loading it lots of skills, planning docs, reference PRs, etc)

I was concerned that Claude Code’s 5 hr session limit & weekly usage limits (which are themselves quite vague) would reduce my output

But I had some prior experience using opencode and decided to give this a try

Some observations after switching:
There's a real learning curve
The desktop app smooths out a lot of the friction
Claude Code doesn't do codebase indexing (unlike Cursor) — so CLAUDE.md and .context files become essential. Migrate your rules and context early
The docs are very detailed — even cover team-level adoption tracking (docs.claude.com/analytics)
Two commands worth bookmarking:
/clear — reset context when switching to a completely different task to cut token costs
/usage — check session + weekly usage at a glance

One major feature that I started using from the beginning is /remote-control, which allows an active Claude session’s responses to be streamed to your Claude app. So you can keep up with its progress and give new tasks .

This is a step up from my one-way /agent-done-notifier skill that I made a post about earlier ( check it here https://lnkd.in/gdDQYqNz ) 

Quick tip: I would recommend using the Claude Code plugin for your IDE (VS Code / Cursor / JetBrains, etc) if the terminal feels confusing.

Feels very smooth to use, and you can still look at the files, etc.
