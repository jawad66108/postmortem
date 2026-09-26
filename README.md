# Postmortem

**Paste a stack trace. Get back what actually changed.**

Postmortem is an agent built for the Nebius x NVIDIA Global AI Hackathon (track: **Best Apps and Agents**). Instead of explaining what an error message means — something any model's frozen weights can already do — it investigates *what recent dependency change most plausibly caused it*, using live web search against issue trackers, changelogs, and advisories. The answer doesn't exist in any model's training data; it exists on the internet, today, and has to be retrieved.

**Live demo:** https://postmortem-six.vercel.app
**Backend API:** https://postmortem-o5dd.onrender.com

> The backend runs on Render's free tier and spins down after 15 minutes of inactivity — the first request after idle time can take 30-50 seconds just to wake up, on top of the pipeline's own runtime. This is expected, not a bug.

## What it does

1. Paste a stack trace or error signature (any language)
2. An NVIDIA Nemotron model extracts structured metadata: language, framework, error class, implicated symbols, package names, and any version numbers visible in the trace
3. [Tavily](https://tavily.com) searches live issue trackers, changelogs, and advisories using targeted queries built from that metadata — not the raw trace text, which searches poorly
4. A larger Nemotron model reasons over the retrieved evidence and produces 1-4 ranked hypotheses, each with an explicit confidence level and citations restricted to sources it was actually given (no fabricated URLs)
5. A third Nemotron model generates a minimal, runnable reproduction of the top hypothesis

Every hypothesis card carries its source links — the citations are the visible proof that live retrieval is doing real work, not decoration.

## NVIDIA Nemotron / Nebius Token Factory usage

This project's architecture is a deliberate three-tier routing design across the Nemotron family, all served through **Nebius Token Factory**'s OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1/`):

| Stage | Model | Why this tier |
|---|---|---|
| Extraction (`extract.ts`) | `nvidia/Nemotron-3_5-Lightning` | Cheapest, fastest model in the family — structured field extraction doesn't need heavy reasoning, and running it on the smallest capable model keeps per-request cost negligible |
| Reproduction (`repro.ts`) | `nvidia/nemotron-3-super-120b-a12b` | Mid-tier — generating a runnable code snippet benefits from more capability than extraction, but doesn't need the largest model's reasoning depth |
| Ranking (`rank.ts`) | `nvidia/Nemotron-3-Ultra-550b-a55b` | Largest available Nemotron on the Public endpoint — this is the stage that actually judges which cause is most plausible given the evidence, which is where reasoning quality matters most |

This tiering is exactly the cost-efficiency pattern Nebius's own guidance recommends, and it makes a real difference: a full pipeline run costs a fraction of a cent, because only the step that genuinely needs the biggest model uses it.

All three models are reasoning models. Handling that correctly — including cases where the model reasons regardless of formatting instructions — required real engineering; see [`FEEDBACK.md`](./FEEDBACK.md) for specifics.

## Architecture

```
paste stack trace
        |
        v
 extract.ts   --> Nemotron-3.5-Lightning
        |          --> {language, framework, error_class, symbols[], packages[], versions{}}
        v
 retrieve.ts  --> Tavily (targeted, exact-match queries built from extracted metadata)
        |          --> issue threads, changelogs, advisories, with URLs and relevance scores
        v
 rank.ts      --> Nemotron-3-Ultra-550b-a55b
        |          --> ranked hypotheses + cited evidence + confidence, citations validated
        |              against the real evidence set (no hallucinated URLs)
        v
 repro.ts     --> nemotron-3-super-120b-a12b
        |          --> minimal reproduction, refuses to fabricate if the hypothesis has no
        |              real supporting evidence
        v
 React frontend: ranked hypothesis cards, each with source links + a generated repro snippet
```

Every stage that asks a model for structured JSON has retry logic and guards against silent fabrication — if the ranking model can't produce a hypothesis backed by real evidence after retries, the pipeline says so honestly rather than inventing a plausible-sounding but unsupported cause.

## Tech stack

- **Frontend:** React + Vite + TypeScript, deployed on Vercel
- **Backend:** Node + Express + TypeScript, deployed on Render
- **Models:** NVIDIA Nemotron (3.5-Lightning, 3-Super-120b, 3-Ultra-550b) via Nebius Token Factory
- **Retrieval:** Tavily Search API
- **License:** MIT (see [`LICENSE`](./LICENSE))

## Running locally

### Backend
```bash
cd server
npm install
# .env with NEBIUS_API_KEY and TAVILY_API_KEY
npx tsx index.ts
```

### Frontend
```bash
cd web
npm install
# .env with VITE_API_BASE_URL=http://localhost:3001
npm run dev
```

## Feedback for Nebius / NVIDIA

Detailed, specific feedback from building this — including a documented model behavior gap and a non-determinism finding that affects ranking quality, not just extraction — is in [`FEEDBACK.md`](./FEEDBACK.md).
