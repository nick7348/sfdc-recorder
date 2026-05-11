import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, basename, extname } from 'node:path';
import kleur from 'kleur';
import { generateSpec, migrateRecording } from '@sfdc-recorder/codegen';

export interface GenOptions {
  output?: string;
  fallbackHints?: boolean;
  insertWaits?: boolean;
  groupsAsFunctions?: boolean;
  parameterize?: boolean;
}

export async function genCommand(input: string, opts: GenOptions): Promise<void> {
  const raw = await readFile(input, 'utf8');
  const recording = migrateRecording(JSON.parse(raw));

  const code = generateSpec(recording, {
    testName: recording.name,
    includeFallbackHints: opts.fallbackHints ?? true,
    insertSalesforceWaits: opts.insertWaits ?? true,
    emitGroupsAsFunctions: opts.groupsAsFunctions ?? true,
    parameterizeFixtures: opts.parameterize ?? false,
  });

  const outPath = opts.output ?? deriveOutputPath(input);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, code, 'utf8');

  console.log(kleur.green('✓'), 'Wrote', kleur.cyan(outPath));
  const groupsCount = recording.groups?.length ?? 0;
  const varsCount = recording.variables?.length ?? 0;
  console.log(
    kleur.dim(
      `  ${recording.steps.length} step(s) · ${groupsCount} group(s) · ${varsCount} var(s) · ${recording.context}`,
    ),
  );
  if (varsCount > 0 && !opts.parameterize) {
    console.log(
      kleur.yellow('  hint:'),
      kleur.dim(`recording uses $VARs (${recording.variables?.join(', ')}); re-run with --parameterize to wire fixtures`),
    );
  }
}

function deriveOutputPath(input: string): string {
  const stem = basename(input, extname(input)).replace(/\.recording$/, '');
  return `tests/${stem}.spec.ts`;
}
