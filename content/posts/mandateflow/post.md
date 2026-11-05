Most AI agent safety conversations start with: Which tools can the Agent call?

But there is another question that matters just as much: what data got it there?

Ie , as much as context engineering matters to the agent, it should matter to the middleware that judges agent actions.

For TikTok TechJam 2026, my team built something that solves this problem: MandateFlow. ( Public voting is now live; take a look and give us a like https://lnkd.in/gSy3ij9H ) 


We put a policy gateway between an Agent and its protected tools. It tracks where a reference came from, then checks policy BEFORE the next tool is ever called.

In our demo, we showed  the following real-life scenario

Support ticket → Case → CRM = allowed

Payment failure → Case → CRM = denied before CRM is touched

Same Agent. Same CRM permission. Same public Case type. Different provenance, different outcome.

Instead of just saying no, MandateFlow gives the Agent a safe alternative: aggregate the Payment failures without re-identifying a customer. Every decision leaves behind a redacted receipt too, so the flow can be inspected later.

We built it with React/Fastify, a disposable Codex runtime, and a Go MCP gateway that owns the policy and data lineage.

If MandateFlow resonates with you, give us a like -> https://lnkd.in/gSy3ij9H

Huge thanks to TikTok for hosting this hackathon our Team 'Cache Me If You Can' ( Andrew Nguyen Thang Nguyen Nam Dao )
