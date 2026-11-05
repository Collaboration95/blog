Yald , My dashboard to track expensive AI usage , was itself getting slow. Fixed Now ! ( v0.3.0 out ) 

On my real history (about 157k requests) the Cost page took 4.5 seconds to open. The cause was dumb: it worked out each request's timezone bucket over and over, about 5 times per request. That was 2.2 million lookups for one Cost request. Now it's 3,624.

The Cost page now opens in about 0.14 s, roughly 30x faster, and in under 10 ms when you come back to it. Usage went from 3.5 s to under 0.2 s. Every number is unchanged: 401 API responses came back byte-identical.


While I was in there, it got three new views: a Context page (how long your contexts get, per model), Spend structure on Cost (how concentrated your spend is across sessions), and Spend spikes in Labs, where Yaldi flags days above 2.5x your trailing median.

More features in the works , going to be a busy week !
