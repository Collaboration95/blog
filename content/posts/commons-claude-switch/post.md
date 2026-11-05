Yesterday,  I went to Claude Code SG at Grab. A day later my pets run on Claude, and they show up three times faster.

I built Commons to increase async group interactions. You wish for a creature, and it walks onto the projector. 

Every wish goes through three AI steps. Screen it, write its code, draw it. Until this week all three ran on my ChatGPT subscription, so if my plan ran out, the public vote would go down with it.
 ( had GPT-6 astra empty out my credits yesterday night after working for 6hrs on a "research" job) 

Meanwhile $100 a month of Anthropic API credit sat unused.

So I wrote the test before picking a model. 43 labelled wishes, 29 that must get through and 14 that must be declined, from real people and brand logos to prompt injection. Every check is deterministic, so no AI grades AI. Spend was capped at $5.

Claude Haiku 5.5 got all 43 verdicts right, and all 29 of its creatures ran in the simulator. It writes a creature's code in 4.9 seconds. The Codex setup I was running took 17 to 19. 

Four pets at once went live in 13 to 16 seconds. If the API fails, that pet falls back to Codex.

The other slowdown was my own code. Six concurrent Claude calls took six times as long as one and It was the SDK's default fetch queueing them.

 A plain HTTP/1.1 agent took 25 seconds down to 4.4. Twice this week the slow part was the plumbing. The models were fine.

The Claude side of the experiment cost me $2.62. The image API is on my OpenAI bill, and costs me 30cents ( including usage + evals) 

Thanks to Rishikesh Radhakrishnan for the talk and Fiachra (Fiki) MacFadden 马骏 and the presenters for their demos.
