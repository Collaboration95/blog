tldr , i analysed data from my hackathon project , its really cool ( trust me ) . 
try -> https://lnkd.in/gFeZhSD2
vote for it -> https://lnkd.in/gkruffB9

I kept every prompt, token and timestamp from Sunday's hackathon. Here is what 18 hours with two coding agents cost.

The night before @ 2am ish , i launched a few agents to prototype some ideas that popped in my head throughout the week. 
All ten were dropped within the first hour of the hackathon, once the organisers explained more. Picking the new idea took 50 minutes. The build itself took 2 hours 47 minutes.

Plenty broke. Four agent-session restarts took down the server and the public tunnel, so the room had four different URLs in one afternoon. A background-job time limit killed the tunnel at 17:11, in the middle of the demo window.

Across the whole day, about 300 million tokens went through my agents, and 96% of them were cache re-reads. Only about 2 million were actually generated. At API prices that is roughly $182. On subscriptions I paid nothing extra.

The one real bill was the OpenAI API key that redrew the venue photo. It came to $2.79 for the day, and it still ran dry a few minutes before the demo. I had to rush a top-up so the room could redraw itself on stage.

The biggest bill now is the server. Keeping the room alive for three days of public voting costs about $8 on AWS.

Once the room was public, a pet took about 3 minutes under load. The logs showed the model drawing each sprite sheet three to six times because saving kept failing. It now draws once, and coding starts while the wish is still being screened.

A pet now takes 44 seconds with six wishes in flight, about 4x faster.

Every number here comes from my own agent logs, aggregated with YALD, the usage dashboard I built. 

i put them all in a writeup ( just click through the website , its very cool ( if i say so myself ). 

and the CTA once again , Vote for it -> https://lnkd.in/gkruffB9
