# mastra-second-brain

A Mastra agent that is your organization's second brain. It answers questions from a shared, scoped knowledge base, cites the page it used, and keeps that knowledge base current as people tell it things. It runs with **no Docker and no database server**: storage is libSQL, a local file in development and Turso Cloud in production.

## Overview

The template is built on **Knowledge**, the experimental wiki that `@mastra/core` 1.82 ships in `@mastra/core/knowledge`. It is not a RAG pipeline. There is no chunking, no ingestion job and no document corpus; knowledge is a tree of pages that agents and your code read and write directly.

- **Agent**: `secondBrain` searches Knowledge before it answers, reads the page, cites it, and says plainly when nothing is found. When someone states a durable fact, decision or preference, it records it as a page or a note.
- **Knowledge**: pages with markdown bodies, short immutable notes stamped with who wrote them, links between pages, and pins that sit in the agent's context every turn. Search is keyword plus semantic.
- **Scopes**: every page lives in one scope. `org:<id>` is shared by the whole org, `resource:<userId>` belongs to one user, and `thread:<id>` to one conversation. The agent can only see the scopes its run holds.
- **Folder sync**: `npm run knowledge:sync` mirrors a folder of markdown files into the org scope. Re-running updates pages in place, skips unchanged ones and removes pages for deleted files. Importers for Notion, Google Drive or Slack follow the same pattern.
- **Studio explorer**: Studio's Knowledge page shows the scopes and pages as a tree and a graph, with search. With auth on, each user sees only the pages they can read.
- **Storage**: one `LibSQLStore` holds memory, Knowledge pages, their embeddings and traces. Leave `TURSO_*` blank and it uses `file:./mastra.db`.
- **Eval**: `npm run eval` checks that the agent searches, cites, admits when nothing is found, and writes notes. Under [AIMock](https://github.com/CopilotKit/aimock) only the model is mocked; the Knowledge tools run for real, so the run is free and still proves storage and search work.
- **Reachability**: the agent is callable over REST, A2A and MCP, and in Studio.

> Knowledge is experimental (alpha). Its API can change between `@mastra/core` releases, so this template pins every `@mastra/*` package exactly. Re-test before you bump.

### File structure

```
src/
├── lib/env.ts                  # Zod-validated env; exits on bad config
└── mastra/
    ├── index.ts                # env → AIMock → Mastra (agent, Knowledge, explorer routes, auth)
    ├── agents/second-brain.ts  # The secondBrain agent
    └── lib/
        ├── knowledge.ts        # The Knowledge instance and the org scope
        ├── auth.ts             # JWT auth + who can browse which pages in Studio
        ├── memory.ts           # Working memory + semantic recall
        ├── embedder.ts         # fastembed locally, or a hosted embedder
        ├── processors.ts       # Shared input/output processors
        └── aimock.ts           # Routes LLM calls to AIMock when USE_AIMOCK=true
knowledge/                      # Markdown pages synced into the org scope (samples)
scripts/
├── knowledge-sync.ts           # Folder → Knowledge sync
└── eval.ts                     # Eval gate; exits 0/1
evals/second-brain.json         # Eval cases and seed pages
fixtures/second-brain.json      # AIMock fixtures for the eval
.github/workflows/ci.yml        # typecheck → build + eval
```

## Setup

**Prerequisites**: Node 22.13 or newer, and an API key for Anthropic, OpenAI or Google. You don't need Docker or a database server.

```bash
npm install
cp .env.example .env      # set APP_SECRET and one provider key
npm run knowledge:sync    # load the sample pages in ./knowledge
npm run dev               # Studio and the API on http://localhost:4111
```

Open Studio, chat with **Second Brain**, and ask "When does Acme renew?". Then open the **Knowledge** page to see the pages it read.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `APP_SECRET` | yes | At least 32 characters. `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | one of them | The key for `MODEL`'s provider. Not needed with `USE_AIMOCK=true` |
| `MODEL` | no | Model-router string, default `anthropic/claude-sonnet-4-6` |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | no | Turso Cloud database. Blank means `file:./mastra.db` |
| `EMBEDDING_MODEL` | no | Hosted embedder, e.g. `openai/text-embedding-3-small`. Blank means local fastembed |
| `KNOWLEDGE_ORG_ID` | no | The org scope is `org:<id>`, default `default`. Use one id per client |
| `KNOWLEDGE_DIR` | no | Folder the sync mirrors, default `knowledge` |
| `MASTRA_JWT_SECRET` | no | Turns on JWT auth for the API and Studio |
| `USE_AIMOCK`, `AIMOCK_URL`, `OPENAI_BASE_URL` | no | Free, deterministic runs against AIMock |
| `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID` | no | Also ship traces to hosted Mastra Observe |

`.env.example` documents each one.

## Usage

### Studio

`npm run dev` serves Studio at http://localhost:4111. Chat with the agent on the Agents page; browse what it knows on the Knowledge page.

### REST API

```bash
curl -X POST http://localhost:4111/api/agents/secondBrain/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{ "role": "user", "content": "When does Acme renew?" }],
    "memory": { "thread": "t-1", "resource": "user-1" }
  }'
```

Pass `memory.resource` so each user gets their own `resource:` pages and working memory. Without it, the agent still reads and writes the org scope.

### MCP

The MCP server exposes the agent as `ask_secondBrain`, so Claude, Cursor or an n8n MCP node can query the second brain. Its endpoint is `http://localhost:4111/api/mcp/second-brain-mcp/mcp`.

### Filling the knowledge base

There are two ways in, and they work side by side:

1. **The agent writes it.** Tell it "Remember that Acme's main contact is now Sam Lee" and it adds a note to the Acme page, stamped `agent:secondBrain`.
2. **Your code writes it.** Put markdown files in `knowledge/` and run `npm run knowledge:sync`. `clients/acme.md` becomes the page `org:default#clients/acme`, named after its first `# heading`. Run it on a schedule to keep a folder, a Git repo or a synced drive mirrored.

To pull from another app, copy `scripts/knowledge-sync.ts`: read each document from the source, call `knowledge.upsertPage({ scope, path, name, body })`, and call `removePage()` for documents that are gone. The path is the page's identity, so re-runs never duplicate pages.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Studio and the API on :4111 (long-running) |
| `npm run knowledge:sync [folder]` | Mirror a markdown folder into the org scope |
| `npm run eval` | Eval gate; exits 1 on any failure |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `scripts/` |
| `npm run build` | `mastra build` into `.mastra/output` |

### Evals

```bash
npx -y -p @copilotkit/aimock aimock -c aimock.json   # terminal 1
USE_AIMOCK=true npm run eval                         # terminal 2
```

Without AIMock, `npm run eval` calls the real model for `MODEL` and costs money. The fixtures assume `KNOWLEDGE_ORG_ID=default`.

## Customization

### One second brain per client

Deploy one copy per client with its own Turso database and `KNOWLEDGE_ORG_ID`. Add `team:` scopes for departments in `src/mastra/lib/knowledge.ts` when one org needs pages that only some people can read.

### Read-only staff Q&A

Set `tools: { read: true }` in `src/mastra/lib/knowledge.ts` so the agent can search and read but never write. Keep `tools: true` when the agent should maintain the knowledge base.

### Auth and the Knowledge explorer

With `MASTRA_JWT_SECRET` set, every route needs a Bearer JWT. `src/mastra/lib/auth.ts` maps each token to the pages its holder may browse in Studio: a `knowledge` claim (`"all"` or a list of scope addresses) wins; otherwise a user sees the org scope and their own `resource:<sub>` pages. Without auth the explorer reads everything, so only run it unauthenticated where Studio itself is private.

### Switch the model or embedder

Set `MODEL` to any model-router string. Set `EMBEDDING_MODEL` to a hosted embedder for serverless or edge deploys, where fastembed's native runtime can't load. Changing the embedder changes the vector dimension, so start from a fresh database or re-sync.

### For AI coding agents

Read [AGENTS.md](./AGENTS.md) for the boot order, env rules and the things never to do.
