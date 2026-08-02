/**
 * Which build ships the reviewed listening WAVs.
 *
 * The same content tree serves two very different targets. The GitHub Pages demo is a public
 * static site where 40+ MB of WAV would be most of the download, and the desktop app is a
 * local bundle where the audio is the point — so the recordings ship there and nowhere else.
 * An `audio-comprehension` item carries its script either way (`source.turns`), and the
 * validator holds that script equal to the recording's transcript, so the two builds ask the
 * learner exactly the same question. Only the voice differs: a reviewed take, or browser TTS.
 *
 * `PUBLIC_ATLAS_AUDIO_BUNDLE=1` turns it on. The name is deliberately `PUBLIC_` — Vite exposes
 * only that prefix to client code, and `AudioComprehension.tsx` has to read the same flag that
 * decided whether the files were copied. One boolean rather than a per-id manifest, because
 * the copy is all-or-nothing and the validator already guarantees every committed artifact has
 * its WAV: an item whose recording resolves in the content tree cannot be missing from a
 * bundled build.
 *
 * `dist/audio/manifest.json` is written either way. It is not read at runtime — it exists so
 * that "did this build ship audio, and which?" is answerable from the build output alone,
 * rather than by listing directories and hoping.
 */
import type { AstroIntegration } from 'astro';
import { existsSync, mkdirSync, readdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { listeningArtifactSchema, listeningWavPath } from '../lib/schemas';
import { AUDIO_BUNDLE_ENV, bundlesAudio } from '../lib/audio';

interface Shipped {
  id: string;
  level: string;
  /** repo-relative source, so a manifest is traceable back to the reviewed file */
  source: string;
  bytes: number;
}

/** Every reviewed recording in the content tree, whether or not this build ships it. */
export function reviewedRecordings(root: string): Shipped[] {
  const base = join(root, 'content', 'listening');
  if (!existsSync(base)) return [];
  const out: Shipped[] = [];
  for (const levelDir of readdirSync(base, { withFileTypes: true })) {
    if (!levelDir.isDirectory()) continue;
    for (const name of readdirSync(join(base, levelDir.name))) {
      if (!name.endsWith('.yaml')) continue;
      const parsed = listeningArtifactSchema.safeParse(
        YAML.parse(readFileSync(join(base, levelDir.name, name), 'utf8')),
      );
      // Malformed records are `bun run validate`'s business, not the build's — skipping one
      // here would hide it, and failing the build would report it in the wrong voice.
      if (!parsed.success) continue;
      const { id, level } = parsed.data;
      const source = listeningWavPath(level, id);
      const wav = join(root, source);
      if (!existsSync(wav)) continue;
      out.push({ id, level, source, bytes: readFileSync(wav).byteLength });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function audioBundle(): AstroIntegration {
  return {
    name: 'audio-bundle',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const root = process.cwd();
        const outDir = fileURLToPath(dir);
        const audioDir = join(outDir, 'audio');
        const bundle = bundlesAudio(process.env[AUDIO_BUNDLE_ENV]);
        const available = reviewedRecordings(root);

        mkdirSync(audioDir, { recursive: true });
        const shipped = bundle ? available : [];
        // Flat target: ids are globally unique, and the component has no level to build a
        // path from. See lib/audio.ts.
        for (const rec of shipped) copyFileSync(join(root, rec.source), join(audioDir, `${rec.id}.wav`));
        writeFileSync(
          join(audioDir, 'manifest.json'),
          `${JSON.stringify({ bundled: bundle, recordings: shipped }, null, 2)}\n`,
        );

        const megabytes = (shipped.reduce((sum, r) => sum + r.bytes, 0) / 1e6).toFixed(1);
        logger.info(
          bundle
            ? `shipped ${shipped.length} reviewed recording(s), ${megabytes} MB → ${relative(root, audioDir)}`
            : `${available.length} reviewed recording(s) withheld (${AUDIO_BUNDLE_ENV} unset) — items fall back to browser TTS`,
        );
      },
    },
  };
}
