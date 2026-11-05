Last week, I took a stab at building a fashion chatbot that learns your style from conversation — without ever asking for it.

That's StyleMind. Every message runs through an extraction layer. The LLM outputs structured JSON (aesthetic preferences, disliked materials, budget signals, and occasions), and those signals update a StylePersona node in Neo4j. Turn one: pure vector ranking, confidence at 0.0. By turn five, the reranker is boosting matched aesthetics, penalising dismissed materials, and filtering by budget tier.

Neo4j handles both the property graph and the vector indexes. Ten node types, fifteen relationship types: brands, aesthetics, occasions, outfit pairings, budget tiers. Product embeddings sit in native vector indexes alongside the graph data. One system, no separate store to sync. Outfit coherence runs as a Cypher traversal: a PAIRS_WITH edge only holds if both products share season and occasion overlap. Deterministic, not guessed by the model.

The RAG pipeline is simple. No LangChain, no LlamaIndex. Retriever, reranker, and generator each built from scratch, around 150 lines apiece. When vector search returns fewer than three results, it falls back through the graph to products sharing the same aesthetic.

Tokens stream via SSE. After the stream closes, persona inference fires as a background asyncio task (completely decoupled).

Served as both a CLI & Streamlit app with a proper web UI.

Next post covers the build process and tooling.

Github -> https://lnkd.in/gxeCap-H
