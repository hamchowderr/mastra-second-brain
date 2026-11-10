import { z } from 'zod';

const boolish = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
  .transform((v) => v === 'true' || v === '1');

// `KEY=` in .env arrives as "", which would skip a .default(); treat it as unset.
const blankAsUnset = (v: unknown) => (v === '' ? undefined : v);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 chars'),


    // libSQL / Turso: THE store (memory, Knowledge pages and embeddings,
    // observability, and semantic-recall vectors). Local dev defaults to a file DB
    // (no cloud needed); set a libsql:// URL + TURSO_AUTH_TOKEN for Turso Cloud
    // (serverless / production).
    TURSO_DATABASE_URL: z.preprocess(blankAsUnset, z.string().default('file:./mastra.db')),
    TURSO_AUTH_TOKEN: z.preprocess(blankAsUnset, z.string().optional()),


    // The model every agent, workflow and scorer uses, as a Mastra model-router
    // string "<provider>/<model-id>": e.g. anthropic/claude-sonnet-4-6,
    // openai/gpt-5.5, google/gemini-3.5-flash. Set the matching key below.
    MODEL: z.preprocess(
      blankAsUnset,
      z
        .string()
        .regex(/^[a-z0-9-]+\/.+$/, 'MODEL must look like "<provider>/<model-id>"')
        .default('anthropic/claude-sonnet-4-6'),
    ),

    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

    // Embedder for memory semantic recall. Empty = local fastembed (bge-small,
    // 384-dim, no key). Set to a hosted model (e.g. "openai/text-embedding-3-small")
    // for serverless/edge, where fastembed's native ONNX runtime can't run.
    EMBEDDING_MODEL: z.string().default(''),

    // Knowledge: the org scope every agent run holds is org:<KNOWLEDGE_ORG_ID>.
    // Use one id per client when you deploy this template per client.
    KNOWLEDGE_ORG_ID: z.preprocess(
      blankAsUnset,
      z.string().regex(/^[A-Za-z0-9_-]+$/, 'KNOWLEDGE_ORG_ID: letters, digits, - and _ only').default('default'),
    ),
    // Folder `npm run knowledge:sync` mirrors into the org scope.
    KNOWLEDGE_DIR: z.preprocess(blankAsUnset, z.string().default('knowledge')),

    USE_AIMOCK: boolish.default(false),
    AIMOCK_URL: z.string().url().default('http://localhost:4010'),

    MASTRA_TELEMETRY_DISABLED: z.string().optional(),
    // Hosted Mastra Observe (MastraPlatformExporter) — set BOTH to also ship traces.
    MASTRA_PLATFORM_ACCESS_TOKEN: z.string().optional(),
    MASTRA_PROJECT_ID: z.string().optional(),


    // Shared HMAC secret for JWT auth (@mastra/auth). When set, the server
    // gates all /api/* routes AND Studio behind a Bearer JWT signed with this
    // secret. Leave unset for open local dev. Must be HS256-safe (>=32 chars).
    MASTRA_JWT_SECRET: z.string().min(32, 'MASTRA_JWT_SECRET must be at least 32 chars').optional(),
  })
  .refine(
    // AIMock answers every provider and configureAIMock() fills in mock keys,
    // so a mocked run needs no real key.
    (e) =>
      e.USE_AIMOCK ||
      Boolean(e.ANTHROPIC_API_KEY || e.OPENAI_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY),
    {
      message:
        'At least one LLM provider key required (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY)',
    },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n');
  for (const [key, errors] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${key}: ${(errors as string[]).join(', ')}`);
  }
  for (const err of parsed.error.flatten().formErrors) {
    console.error(`  ${err}`);
  }
  console.error('\nSee .env.example for the full list of required variables.');
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
