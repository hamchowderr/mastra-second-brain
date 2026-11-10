# AGENTS.md: Conventions for AI Coding Agents

For AI coding agents (Claude Code, Cursor, Copilot and others) working on this codebase.

## Boot Order (critical)

`src/mastra/index.ts` initializes in this exact order:

```
1. env validation   (import { env } from '../lib/env')
2. AIMock setup     (configureAIMock())
3. Mastra instance  (new Mastra({ ... }))
```

The AI SDK reads provider base URLs when a client is constructed and caches them, so AIMock must rewrite them first. Never construct an `Agent`, a `Knowledge` instance or an `@ai-sdk/*` client before `configureAIMock()` runs.

## Import Rules

- Relative imports inside `src/mastra/`; `src/lib/env` is the only cross-boundary import.
- Never import from `src/mastra/` in `src/lib/`.
- No barrel files: import the specific module.

## Environment Variables

All env flows through `src/lib/env.ts`. Never read `process.env` elsewhere. A new variable goes into the Zod schema and `.env.example` in the same change.

## Knowledge

- There is one instance, `knowledge` in `src/mastra/lib/knowledge.ts`, registered as `knowledge: { main }`. Agents attach it with `knowledge: 'main'`, never on `Memory` (that option was removed in core 1.82 and throws).
- A run must hold at least one scope that matches a declared scope type, or Knowledge throws. Agents always pass `scopes: [knowledgeOrgScope]`; the memory thread and resource add `thread:` and `resource:`.
- Host code writes with `upsertPage` / `removePage` / `addNote`. The `scope#path` is a page's identity, so sync jobs must derive paths deterministically from the source.
- Knowledge is experimental. Keep every `@mastra/*` version pinned exactly, bump them together, and run `typecheck`, `build` and the AIMock eval after a bump.

## Agent Conventions

- One agent per file in `src/mastra/agents/<kebab-name>.ts`, with `id`, `name`, a non-empty `description` (MCPServer needs it), `instructions`, `model: env.MODEL`, `memory: createDefaultMemory()` and the shared processors.
- Register a new agent in **both** the `Mastra` instance and the `MCPServer` in `src/mastra/index.ts`.
- Add eval cases to `evals/` and matching AIMock fixtures to `fixtures/` for every behavior you rely on.

## Things to Never Do

- Never read `process.env` directly outside `src/lib/env.ts`.
- Never construct an AI SDK client before `configureAIMock()`.
- Never set `ANTHROPIC_BASE_URL` to the bare AIMock URL; it must end in `/v1`.
- Never put secrets, passwords or API keys into Knowledge pages or notes.
- Never point `TURSO_DATABASE_URL` at a client's production database from a dev machine without asking.
- Never run the eval without AIMock unless the user agreed to pay for the model calls.

## Useful Commands

```bash
npm run dev               # Studio at localhost:4111 (long-running)
npm run knowledge:sync    # mirror ./knowledge into the org scope
npm run typecheck         # covers src/ and scripts/
npm run build             # mastra build
npm run eval              # exits 0 on pass; USE_AIMOCK=true with AIMock running = free
```
