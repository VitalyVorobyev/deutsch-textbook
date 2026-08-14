import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { listeningAudioPath, listeningPlanSchema } from '@da/schema';

export type ListeningInventoryStatus =
  | 'planned'
  | 'drafted'
  | 'qa_failed'
  | 'awaiting_approval'
  | 'approved'
  | 'published';

export function deriveStatus(input: {
  brief: boolean;
  manifest?: { qa?: { passed?: boolean }; approval?: { status?: string } };
  artifact: boolean;
  audio: boolean;
}): ListeningInventoryStatus {
  const approved = input.manifest?.approval?.status === 'complete';
  if (approved && input.artifact && input.audio) return 'published';
  if (approved) return 'approved';
  if (input.manifest?.qa?.passed === true) return 'awaiting_approval';
  if (input.manifest?.qa?.passed === false) return 'qa_failed';
  if (input.brief || input.manifest) return 'drafted';
  return 'planned';
}

export function inventory(root: string) {
  const plan = listeningPlanSchema.parse(
    YAML.parse(readFileSync(join(root, 'data/listening-plan.yaml'), 'utf8')),
  );
  const promptsDir = join(root, 'data/prompts');
  const prompts = existsSync(promptsDir) ? readdirSync(promptsDir) : [];
  return plan.units.flatMap((unit) => unit.artifacts.map((artifact) => {
    const level = unit.level.toLowerCase();
    const manifestPath = join(root, 'data/audio-provenance', level, `${artifact.id}.json`);
    const manifest = existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, 'utf8')) as {
          qa?: { passed?: boolean };
          approval?: { status?: string };
        }
      : undefined;
    const status = deriveStatus({
      brief: prompts.some((name) => name.endsWith(`-${artifact.id}-listening.md`)),
      manifest,
      artifact: existsSync(join(root, 'content/listening', level, `${artifact.id}.yaml`)),
      // The published derivative, not the studio's WAV master — `listeningAudioPath` is the
      // one place that spells the layout, so this cannot drift from what publish writes again.
      audio: existsSync(join(root, listeningAudioPath(unit.level, artifact.id))),
    });
    return { level: unit.level, unit: unit.unit, artifact: artifact.id, wave: artifact.wave, status };
  }));
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '..');
  const rows = inventory(root);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    console.log('LEVEL\tWAVE\tSTATUS\tUNIT\tARTIFACT');
    for (const row of rows)
      console.log(`${row.level}\t${row.wave}\t${row.status}\t${row.unit}\t${row.artifact}`);
    const totals = Object.groupBy(rows, (row) => row.status);
    console.log(`\n${rows.length} planned · ${Object.entries(totals).map(([key, value]) => `${value?.length ?? 0} ${key}`).join(' · ')}`);
  }
}
