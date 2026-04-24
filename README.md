# Retrieval-Augmented Personal Agent

A context-aware personal assistant with structured memory, scheduled ingestion, and a conversational interface — built to give **personalized, relevant responses** grounded in your actual data.

## What it does

- Maintains a **persistent memory** of user context via structured embeddings stored in PostgreSQL with pgvector
- Runs **scheduled data ingestion** to keep context fresh without manual updates
- Delivers **real-time notifications** via SSE (Server-Sent Events) with zero polling — end-to-end latency under 100ms
- Provides a clean **React-based chat interface** connected to a FastAPI backend

## Architecture

```
React Frontend → FastAPI → PostgreSQL (pgvector) → Gemini API
                       ↓
              asyncpg listener ← PostgreSQL NOTIFY → SSE push
```

## Performance

| Metric | Before | After | Improvement |
|---|---|---|---|
| Semantic retrieval latency | 1612ms | 384ms | **76% reduction** |
| Notification delivery | polling (~1s+) | <100ms | zero-poll pipeline |

> Replaced Python cosine similarity loops with pgvector in-database retrieval over 3072-dim embeddings.

## Tech stack

`FastAPI` · `React` · `PostgreSQL` · `pgvector`
