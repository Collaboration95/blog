I thought I had a slow import problem.

What I actually had was a bad mental model of where the time was going.
But rewriting my architecture cut my import time by 163x.

I'm building a project that adds a conversational layer on top of Apple Watch / Apple Health data.

Before any of the interesting product work could matter, I needed a reliable way to take a Health export from my iPhone and ingest it into the system.
For my own testing, I cut the export down to the last 6 months.

It was still roughly 600MB. The first full import took 26 minutes.
I did the obvious round of improvements first.

Wrapped the database writes in a transaction.
Replaced slow timestamp parsing.
Collapsed multiple XML passes into one.
Cleaned up some regex usage.
That got the import down to 21 minutes.

If 6 months of my own data took 21 minutes, the real use case was going to be worse.

So I went back to basics and asked what the program was actually spending its time doing.

The bottleneck wasn't DuckDB.
It wasn't disk I/O either.
It was Python doing Python things 1.35 million times in a row.

The XML parser was building Python objects for every record, then pulling attributes back through the C/Python boundary one field at a time, all under the GIL.

So the second round was not tuning.

It was an architectural rewrite.

The new version mmap'd the export, split the file across workers, used regex byte-scans to extract the records directly, wrote Parquet shards, then loaded 
them into DuckDB.

That took the import from 26 minutes to 9.77 seconds on the same 6-month test export.

The useful lesson for me was simple:
The first optimisation pass can prove your theory wrong.
Sometimes the real work starts when you stop tuning and start questioning the shape of the system.
