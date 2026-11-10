/**
 * # Knowledge: the second brain (experimental, @mastra/core 1.82+)
 *
 * Knowledge is a tree of pages stored in the same libSQL/Turso database as
 * memory. Pages have markdown bodies, short immutable notes, links between
 * pages, and pins that are put in the agent's context every turn. No RAG
 * pipeline is involved: there is no chunking step and no separate corpus.
 * Pages are found with keyword search, blended with semantic search because a
 * vector store and embedder are passed below.
 *
 * ## Scopes
 *
 * Every page lives in one scope, and a run's scopes decide what it can read
 * and write:
 *
 *   - `org:<KNOWLEDGE_ORG_ID>`  shared by everyone in the org (editor role)
 *   - `resource:<id>`           one user's own pages (from `memory.resource`)
 *   - `thread:<id>`             one conversation's pages (from `memory.thread`)
 *
 * The agent always holds the org scope (see `knowledgeOrgScope`), so a call
 * without a memory thread, such as the MCP tool or the eval, still resolves.
 *
 * ## Filling it
 *
 *   - The agent writes it with `knowledge_page`, `knowledge_note` and `knowledge_pin`.
 *   - Your code writes it with `knowledge.upsertPage()`. `npm run knowledge:sync`
 *     mirrors `knowledge/**.md` into the org scope, and a Notion, Drive or Slack
 *     importer is the same call with a different source.
 *
 * Knowledge APIs are experimental: pin @mastra/core exactly and re-test on
 * every bump.
 */
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { LibSQLVector } from '@mastra/libsql';

import { env } from '../../lib/env';
import { embedder } from './embedder';

/** The org scope every agent run holds, e.g. `org:default`. */
export const knowledgeOrgScope = `org:${env.KNOWLEDGE_ORG_ID}`;

/**
 * The Knowledge instance. Storage comes from the Mastra instance it is
 * registered on (`knowledge: { main }`); the vector store holds page embeddings.
 */
export const knowledge = new Knowledge({
  id: 'knowledge',
  name: 'Second brain',
  description:
    'Durable knowledge for this org and its people: decisions, facts about clients and contacts, processes, runbooks and standing preferences.',
  scopes: { ...knowledgeMemoryScopes() },
  vector: new LibSQLVector({
    id: 'knowledge-vector',
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  }),
  embedder,
  tools: true,
  pinnedContext: true,
});
