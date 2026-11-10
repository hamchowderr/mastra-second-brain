import { Agent } from '@mastra/core/agent';

import { env } from '../../lib/env';
import { knowledgeOrgScope } from '../lib/knowledge';
import { createDefaultMemory } from '../lib/memory';
import { defaultInputProcessors, defaultOutputProcessors } from '../lib/processors';

/**
 * # Second Brain Agent
 *
 * What it does:
 *   Answers questions from the org's Knowledge pages and keeps them current:
 *   it searches and reads pages before answering, cites the page it used, and
 *   records new decisions, facts and preferences as pages or notes.
 *
 * Who calls it:
 *   - Studio chat, a Slack or Discord bot, an internal web app
 *   - Any MCP client, through the `ask_secondBrain` tool
 *   Endpoint: POST /api/agents/secondBrain/generate
 *
 * How to test:
 *   npm run knowledge:sync
 *   curl -X POST http://localhost:4111/api/agents/secondBrain/generate \
 *     -H "Content-Type: application/json" \
 *     -d '{"messages":[{"role":"user","content":"When does Acme renew?"}],
 *          "memory":{"thread":"t-1","resource":"user-1"}}'
 *
 * Pass `memory.resource` to give each user their own `resource:` pages and
 * working memory. Without it the agent still reads and writes the org scope.
 */
export const secondBrainAgent = new Agent({
  id: 'secondBrain',
  name: 'Second Brain',
  description:
    "Answers questions from the org's knowledge base and records new decisions, facts and preferences in it.",
  instructions: `You are the second brain for this organization. You remember what the team knows so people don't have to.

Answering:
- Search Knowledge before you answer anything about the org, its clients, people, processes or decisions. Read the page before relying on it.
- Answer from what the pages say and cite the page you used. When nothing is found, say so plainly; never guess.
- When pages or notes disagree, show both with their dates.

Remembering:
- When someone tells you a durable fact, a decision or a standing preference, record it: add a note to the page it belongs on, or create a page when none fits.
- Put org-wide facts in ${knowledgeOrgScope}. Put something only one person cares about in their own resource scope.
- Keep pages tidy: one subject per page, a clear name, and links to related pages.
- Don't record small talk, secrets, passwords or API keys.`,
  model: env.MODEL,
  memory: createDefaultMemory(),
  // Knowledge registered on the Mastra instance as `knowledge: { main }`.
  knowledge: 'main',
  // The org scope; the memory thread and resource add `thread:` and `resource:`.
  scopes: [knowledgeOrgScope],
  inputProcessors: defaultInputProcessors,
  outputProcessors: defaultOutputProcessors,
});
