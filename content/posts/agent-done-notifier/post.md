If you use Cursor agents, Claude Code, or similar agentic coding tools a lot ( especially kicking off multiple async tasks) , this post will be useful. 

TLDR: shared across a SKILL.md that solved a problem of mine 

I often encountered the same issue: starting an agent on a task, then getting distracted while waiting for it to finish, only to realize I had no idea when it completed or if there were any roadblocks. I would either check too early (still running) or too late (finished 30 minutes ago). I needed a notification system that could work across all these tools, as I switch between Cursor, Open Code, Gemini-CLI, and Codex.

Spent about 10 minutes and put together a simple solution using https://ntfy.sh/ .

 It's a free, open-source notification service -- no account, no server, no API keys. ( as long as you remain <250 daily notifications, but you can self-host it for free ) . 

The agent POSTs a message to a topic URL as its final step, and your phone gets a push notification.

 I turned it into a reusable agent skill with pre-built folders for Cursor, Claude Code, and OpenCode. Clone, copy one folder, subscribe on your phone. That's it.

https://lnkd.in/gYhfNGzs -> contains drag and drop for cursor, Claude, and agentskills format.
