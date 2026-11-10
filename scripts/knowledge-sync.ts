/**
 * Mirrors a folder of markdown files into Knowledge's org scope.
 *
 *   npm run knowledge:sync            # KNOWLEDGE_DIR, default ./knowledge
 *   npm run knowledge:sync -- ./notes # any other folder
 *
 * Each file becomes one page at its path without `.md`: `clients/acme.md` is
 * `org:<KNOWLEDGE_ORG_ID>#clients/acme`. The path is the page's identity, so a
 * re-run updates pages in place, and unchanged pages are not rewritten or
 * re-embedded. The page name is the file's first `# heading`, else its file name.
 * `README.md` files are skipped. A file deleted since the last sync has its page removed; the list of synced
 * paths is kept in `.knowledge-sync.json` next to the folder.
 *
 * This is the pattern for every importer (Notion, Google Drive, Slack, a CRM):
 * read the source, call `upsertPage()` per document and `removePage()` for
 * documents that are gone.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { mastra } from '../src/mastra/index';
import { env } from '../src/lib/env';
import { knowledgeOrgScope } from '../src/mastra/lib/knowledge';

const AUTHOR = 'sync:folder';

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => {
      const full = join(dir, e.name);
      if (e.name.startsWith('.') || e.name === 'README.md') return Promise.resolve([]);
      if (e.isDirectory()) return markdownFiles(full);
      return Promise.resolve(e.name.endsWith('.md') ? [full] : []);
    }),
  );
  return nested.flat();
}

async function main() {
  const dir = resolve(process.argv[2] ?? env.KNOWLEDGE_DIR);
  if (!existsSync(dir)) throw new Error(`Folder not found: ${dir}`);
  const manifestPath = join(dirname(dir), '.knowledge-sync.json');
  const previous: string[] = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, 'utf-8')).paths ?? []
    : [];

  const knowledge = mastra.getKnowledge('main');
  const files = await markdownFiles(dir);
  const counts = { created: 0, updated: 0, unchanged: 0, removed: 0 };
  const synced: string[] = [];

  for (const file of files) {
    const body = await readFile(file, 'utf-8');
    const path = relative(dir, file).split(sep).join('/').replace(/\.md$/, '');
    const name = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path.split('/').pop()!;
    const { status } = await knowledge.upsertPage({
      scope: knowledgeOrgScope,
      path,
      name,
      body,
      author: AUTHOR,
    });
    counts[status]++;
    synced.push(path);
    if (status !== 'unchanged') console.log(`  ${status.padEnd(9)} ${knowledgeOrgScope}#${path}`);
  }

  // Deepest first, so a parent page is removed after its children.
  const gone = previous.filter((p) => !synced.includes(p)).sort((a, b) => b.length - a.length);
  for (const path of gone) {
    try {
      if (await knowledge.removePage({ scope: knowledgeOrgScope, path, author: AUTHOR })) {
        counts.removed++;
        console.log(`  removed   ${knowledgeOrgScope}#${path}`);
      }
    } catch (err) {
      // A page an agent has since added child pages under is kept.
      console.warn(`  kept      ${knowledgeOrgScope}#${path}: ${(err as Error).message}`);
    }
  }

  await writeFile(manifestPath, JSON.stringify({ scope: knowledgeOrgScope, paths: synced }, null, 2));
  console.log(
    `Synced ${files.length} file(s) from ${relative(process.cwd(), dir) || '.'}: ` +
      `${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.removed} removed.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
