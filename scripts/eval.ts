/**
 * Eval gate for the second-brain agent: `npm run eval` (exit 0 = pass).
 *
 * Seeds the pages in the dataset, then runs each case and checks which
 * Knowledge tool the agent called, what the tool returned and what the agent
 * answered. With USE_AIMOCK=true only the model is mocked: the Knowledge tools
 * run for real against the local database, so a pass proves storage, search
 * and note writes work end to end.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { mastra } from '../src/mastra/index';
import { knowledgeOrgScope } from '../src/mastra/lib/knowledge';

interface EvalCase {
  name: string;
  input: string;
  expectTool?: string;
  expectToolResultIncludes?: string;
  expectToolResultExcludes?: string;
  expectAnswerIncludes?: string;
}

interface Dataset {
  agentId: string;
  seed: { path: string; name: string; body: string }[];
  cases: EvalCase[];
}

type Chunk = { toolName?: string; result?: unknown; payload?: { toolName?: string; result?: unknown } };

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const toolName = (c: Chunk) => c.payload?.toolName ?? c.toolName;
const toolResult = (c: Chunk) => JSON.stringify(c.payload?.result ?? c.result ?? '');

const datasetPath = process.argv[2] ?? resolve(process.cwd(), 'evals/second-brain.json');
const dataset: Dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));

const agents: Record<string, ReturnType<typeof mastra.listAgents>[keyof ReturnType<typeof mastra.listAgents>]> =
  mastra.listAgents();
const agent = agents[dataset.agentId];
if (!agent) {
  console.error(red(`Agent "${dataset.agentId}" not found in Mastra instance.`));
  process.exit(1);
}

const knowledge = mastra.getKnowledge('main');
for (const page of dataset.seed) {
  await knowledge.upsertPage({ scope: knowledgeOrgScope, ...page, author: 'eval:seed' });
}

console.log(bold(`\n🧪 Eval: ${dataset.agentId}, ${dataset.cases.length} cases\n`));

let failed = 0;
for (const c of dataset.cases) {
  process.stdout.write(`  ${c.name} ... `);
  const errors: string[] = [];
  try {
    const result = await agent.generate([{ role: 'user', content: c.input }], { maxSteps: 5 });
    const calls = ((result.toolCalls ?? []) as Chunk[]).map(toolName);
    const results = ((result.toolResults ?? []) as Chunk[])
      .filter((r) => toolName(r) === c.expectTool)
      .map(toolResult)
      .join('\n')
      .toLowerCase();

    if (c.expectTool && !calls.includes(c.expectTool)) {
      errors.push(`expected a ${c.expectTool} call, got [${calls.join(', ')}]`);
    }
    if (c.expectToolResultIncludes && !results.includes(c.expectToolResultIncludes.toLowerCase())) {
      errors.push(`${c.expectTool} result does not mention "${c.expectToolResultIncludes}"`);
    }
    if (c.expectToolResultExcludes && results.includes(c.expectToolResultExcludes.toLowerCase())) {
      errors.push(`${c.expectTool} result unexpectedly mentions "${c.expectToolResultExcludes}"`);
    }
    if (results.includes('"error"') || results.includes('iserror":true')) {
      errors.push(`${c.expectTool} returned an error: ${results.slice(0, 300)}`);
    }
    if (c.expectAnswerIncludes && !result.text.toLowerCase().includes(c.expectAnswerIncludes.toLowerCase())) {
      errors.push(`answer does not include "${c.expectAnswerIncludes}": ${JSON.stringify(result.text)}`);
    }
  } catch (err) {
    errors.push(`generate failed: ${err}`);
  }

  if (errors.length === 0) {
    console.log(green('PASS'));
  } else {
    failed++;
    console.log(red('FAIL'));
    for (const e of errors) console.log(`    ${red('✗')} ${e}`);
  }
}

console.log(
  failed === 0
    ? bold(green(`\n✅ ${dataset.cases.length}/${dataset.cases.length} passed\n`))
    : bold(red(`\n❌ ${failed}/${dataset.cases.length} failed\n`)),
);
process.exit(failed === 0 ? 0 : 1);
