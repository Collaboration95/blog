AI agents can do a lot nowadays, but we still aren't sure about giving them a wallet and spending ability. 

I am building an agent that can pay for paywalled articles when the article is worth the cost.

I’m excited to share that I’ll be demoing ResearchAgent: An Evidence Procurement Guard at the AI Tinkerers Singapore meetup with Joe Heitzeberg on October 10, 2026.

ResearchAgent is a project we’re actively evolving. The demo is not a polished “look what we built” pitch. It is a live walkthrough of the control boundary we’re trying to make useful:

research mandate → open evidence → evidence-family clustering → named gap → premium-source comparison → human approval → evidence unlock → impact diff

The agent starts with a question, approved sources, and a budget. It retrieves and clusters the open evidence, identifies what is still missing, and compares a candidate source by expected evidence impact—not price alone. In the canonical flow, it skips a redundant source, blocks one above the per-source ceiling, and only unlocks the approved evidence before showing how the answer changed.

If you work on retrieval, agents, evaluation, or AI systems that take real-world actions, I’d especially value your critique on three questions:

- Is marginal evidence value a defensible way to rank what an agent should buy?
- Is a self-issued evidence receipt enough accountability, or does it need independent verification?

Here's the landing page:
https://lnkd.in/gDHSF-yv

Learn more and register for the event on Oct 10:
https://lnkd.in/gg-pscjA

Thanks to Son Le for helping us out.
