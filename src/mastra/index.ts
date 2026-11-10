// 1. Env validation FIRST: crashes the process if misconfigured
import { env } from '../lib/env';

// 2. AIMock provider switch: must run before any AI SDK client constructs
import { configureAIMock } from './lib/aimock';
configureAIMock();

// 3. Mastra imports: agents constructed below now see the right base URLs
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, SensitiveDataFilter, MastraPlatformExporter } from '@mastra/observability';
import { MastraEditor } from '@mastra/editor';
import { MCPServer } from '@mastra/mcp';
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';
import { secondBrainAgent } from './agents/second-brain';
import { knowledge } from './lib/knowledge';
import { createAuth } from './lib/auth';

const mcpServer = new MCPServer({
  id: 'second-brain-mcp',
  name: 'mastra-second-brain',
  version: '0.1.0',
  description: 'Ask the second brain from any MCP client (Claude, Cursor, an n8n MCP node).',
  tools: {},
  agents: { secondBrain: secondBrainAgent },
});

// One libSQL/Turso database for everything: memory, Knowledge pages and their
// embeddings, and traces. Local dev uses a file DB; set TURSO_* for Turso Cloud.
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

// Studio's Knowledge explorer (read-only tree, graph and search) is served by
// KNOWLEDGE_ROUTES. Without MASTRA_JWT_SECRET it reads the whole instance, so
// only expose an unauthenticated server where Studio itself is private.
// NB: name this `serverConfig`, not `server`: `mastra dev`'s generated entry
// declares its own top-level `server`, which collides in the bundler.
const serverConfig = {
  apiRoutes: [...KNOWLEDGE_ROUTES],
  ...(env.MASTRA_JWT_SECRET ? { auth: createAuth(env.MASTRA_JWT_SECRET) } : {}),
};

export const mastra = new Mastra({
  server: serverConfig,
  agents: { secondBrain: secondBrainAgent },
  knowledge: { main: knowledge },
  mcpServers: { secondBrainMcp: mcpServer },
  storage,
  logger: new PinoLogger({ name: 'Mastra', level: env.LOG_LEVEL }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra-second-brain',
        exporters: [
          new DefaultExporter(),
          ...(env.MASTRA_PLATFORM_ACCESS_TOKEN && env.MASTRA_PROJECT_ID
            ? [new MastraPlatformExporter()]
            : []),
        ],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  editor: new MastraEditor(),
});
