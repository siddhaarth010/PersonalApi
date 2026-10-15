# 🤖 Step 14: Personal AI Agent & RAG (Retrieval Augmented Generation)

> **Parent:** [Implementation Tracker](./TRACKER.md)  
> **Status:** ✅ Implemented (Grounded RAG Pipeline, Ollama / OpenAI & Deterministic Fallback)  
> **Estimated Time:** 4–5 hours

---

## 🎯 Objective
Enable natural language queries over your personal life data via `POST /api/v1/insights/ask`. Allows you to ask conversational questions like:
- *"How was my October compared to September?"*
- *"What's the best time for me to do deep work based on past sleep patterns?"*
- *"Am I drinking too much coffee on days my sleep quality tanks?"*

All data remains private by utilizing a local LLM via Ollama (`llama3` or `mistral`) with optional OpenAI fallback and offline grounded synthesizer.

---

## 🏗️ Architecture & RAG Pipeline

```
User Query: "How was my week?"
   │
   ▼
1. Query Classifier & Parameter Extractor
   (Time range: last 7-14 days, Domains: sleep, commits, workouts, mood)
   │
   ▼
2. Context Retrieval Layer
   (Pulls health_metrics, commits, manual entries, streaks, goals, SLAs)
   │
   ▼
3. Grounded Prompt Formulation
   (Injects structured JSON stats as facts into system prompt)
   │
   ▼
4. Inference Generation (Ollama / OpenAI / Deterministic Local Engine)
   │
   ▼
Structured Answer returned to Dashboard / CLI / Telegram
```

---

## 💻 Implementation (`src/ai/agent.ts`)

```typescript
export interface AskAiResponse {
  query: string;
  answer: string;
  provider: 'ollama' | 'openai' | 'local-deterministic';
  model: string;
  contextSources: string[];
  generatedAt: string;
}

export function askPersonalAI(query: string): Promise<AskAiResponse>;
```

---

## 🧪 Verification & Checklist
- [x] Connect Ollama local server or OpenAI client.
- [x] Create `POST /api/v1/insights/ask` route.
- [x] Test sample queries (`"How did I sleep this week?"`, `"Compare my mood on workout days"`).
- [x] Ensure zero personal data leaves the machine when running in local Ollama mode.

---

## 🔮 Advanced Enhancements & Additions

### 1. Vector Embeddings Search (`sqlite-vec` / Chroma / Ollama Embeddings)
Upgrade from keyword/metadata filtering to dense vector similarity across lifetime journal entries and notes:
- Generate 768-dimensional or 1536-dimensional embeddings for all daily summaries, reflections, and life commits using local `nomic-embed-text` or `text-embedding-3-small`.
- Store vectors in an indexed SQLite virtual table using `sqlite-vec`.
- Semantic RAG Retrieval: When asking *"When was I feeling deeply unmotivated and how did I recover?"*, the system retrieves semantically similar days regardless of exact keyword matches.

### 2. Multi-Turn Conversation History & Chat Sessions
Enable persistent conversational sessions:
- Route: `POST /api/v1/insights/chat` taking `{ sessionId?: string, message: string }`.
- Persist message history in `ai_chat_messages` table.
- Maintain context across follow-up queries (e.g. *"Show me the workout details for that Thursday"*, *"What book was I reading then?"*).

### 3. Proactive Autonomous Coaching Mode
Shift from reactive Q&A to proactive executive life coaching:
- Nightly agent job analyzes today's metrics and prepares a single high-leverage strategic recommendation for tomorrow.
- Example: *"You have 4 hours of fragmented meetings tomorrow afternoon. Past data shows your sleep quality drops 20% on nights after >3.5h meeting days. I recommend rescheduling the 4 PM sync to preserve an evening wind-down window."*

