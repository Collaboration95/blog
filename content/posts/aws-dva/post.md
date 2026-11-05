Excited to announce that i passed the AWS Certified Developer – Associate (DVA-C02). 

Same playbook as SAA: Stéphane Maarek's  course on Udemy, followed by  TutorialsDojo practice tests.

The topic I came away actually thinking about was DynamoDB caching. I'd been writing code against cached data for years without naming the tradeoffs I was making.

There are only two hard things in Computer Science: cache invalidation and naming things.

Heres my attempt to simplify some caching concepts : 

Lazy loading (cache-aside). Read from cache, miss, fetch from the DB, populate. Simple and cheap. The cost is stale data, and the first read after a miss is always slow.

Write-through. Every write hits the cache and the DB in the same path. Cache stays fresh for anything you wrote through it. You pay to cache data that may never be read, and any DB-only write still leaves the cache stale.

Write-behind. Write to the cache first, flush to the DB asynchronously. Fast writes, but if the cache dies before the flush lands, the write is gone.


Excited to apply the skills i learnt to better architect production systems ! 

disclaimer: caching diagram generated via gpt-image-2 ( OpenAI's SOTA image-gen model )
