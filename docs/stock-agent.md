# Stock Agent

This folder contains the autonomous stock-clip selection agent and helper edge-function stubs.

How it works

- Client calls runStockAgent(sceneDescription, desiredDuration, orientation, opts).
- The agent uses a combination of:
  - Generated queries from an LLM (groq-generate-queries)
  - Searches against Pexels and Pixabay (edge functions)
  - Heuristic scoring
  - LLM reranking (groq-rerank)
- If no suitable clip is found, it triggers Pollinations fallback via /api/pollinations-generate.

Environment variables (for edge functions)

- GROQ_API_KEY — API key for Groq (or compatible LLM provider) used by groq-generate-queries and groq-rerank.
- PEXELS_API_KEY — Pexels API key used by pexels-search.
- PIXABAY_API_KEY — Pixabay API key used by pixabay-search.

Testing

1. Add secrets to your Supabase / Edge Functions settings: GROQ_API_KEY, PEXELS_API_KEY, PIXABAY_API_KEY.
2. Deploy edge functions in supabase/functions/*.
3. In the app, import and call runStockAgent(...) from a scene editor or the render pre-flight.
4. Review logs and candidates in the StockAgentModal.
