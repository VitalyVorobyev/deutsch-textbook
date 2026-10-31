/**
 * Which build ships the reviewed listening recordings.
 *
 * Both shipping targets do. This started as a desktop/web split — the recordings would have been
 * most of a public static site's download — but the measured corpus is 14.2 MB of 64 kbps mono
 * MP3 against a 69 MB site and a 1 GB Pages limit, fetched per item only when a learner opens
 * one. So the demo ships them too, and what the flag actually distinguishes is a shipping build
 * from a lean one that carries no binaries.
 *
 * An `audio-comprehension` item carries its script either way (`source.turns`), and the
 * validator holds that script equal to the recording's transcript, so a build without audio asks
 * the learner exactly the same question. Only the voice differs: a reviewed take, or browser TTS.
 *
 * `PUBLIC_ATLAS_AUDIO_BUNDLE=1` turns it on. The name is deliberately `PUBLIC_` — Vite exposes
 * only that prefix to client code, and `AudioComprehension.tsx` has to read the same flag that
 * decided whether the files were copied. One boolean rather than a per-id manifest, because
 * the copy is all-or-nothing and the validator already guarantees every committed artifact has
 * its MP3: an item whose recording resolves in the content tree cannot be missing from a
 * bundled build.
 *
 * `dist/audio/manifest.json` is written either way. It is not read at runtime — it exists so
 * that "did this build ship audio, and which?" is answerable from the build output alone,
 * rather than by listing directories and hoping.
 */
import type { AstroIntegration } from 'astro';
import { repoRoot } from '@da/content/repo-root';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  copyFileSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import {
  listeningArtifactSchema,
  listeningAudioPath,
  type ListeningCue,
  readingAudioArtifactSchema,
  readingAudioPath,
} from '@da/schema';
import { AUDIO_BUNDLE_ENV, bundlesAudio } from '../lib/audio';

interface Shipped {
  id: string;
  level: string;
  /** repo-relative source, so a manifest is traceable back to the reviewed file */
  source: string;
  bytes: number;
}

/** A dialogue recording, with the turn cues its record carries (written beside the MP3). */
interface ShippedRecording extends Shipped {
  cues?: ListeningCue[];
}

/** The cue file a recording ships with: what `AudioComprehension` fetches after an answer. */
function cueFile(rec: ShippedRecording): string | null {
  return rec.cues ? `${JSON.stringify({ id: rec.id, cues: rec.cues })}\n` : null;
}

/** Every reviewed recording in the content tree, whether or not this build ships it. */
export function reviewedRecordings(root: string): ShippedRecording[] {
  const base = join(root, 'content', 'listening');
  if (!existsSync(base)) return [];
  const out: ShippedRecording[] = [];
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
      const source = listeningAudioPath(level, id);
      const wav = join(root, source);
      if (!existsSync(wav)) continue;
      out.push({
        id,
        level,
        source,
        bytes: readFileSync(wav).byteLength,
        ...(parsed.data.cues ? { cues: parsed.data.cues } : {}),
      });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Every approved Lesetext narration in the content tree. */
export function reviewedReadingAudio(root: string): Shipped[] {
  const base = join(root, 'content', 'reading-audio');
  if (!existsSync(base)) return [];
  const out: Shipped[] = [];
  for (const levelDir of readdirSync(base, { withFileTypes: true })) {
    if (!levelDir.isDirectory()) continue;
    for (const name of readdirSync(join(base, levelDir.name))) {
      if (!name.endsWith('.yaml')) continue;
      const parsed = readingAudioArtifactSchema.safeParse(
        YAML.parse(readFileSync(join(base, levelDir.name, name), 'utf8')),
      );
      if (!parsed.success) continue;
      const source = readingAudioPath(parsed.data.level, parsed.data.id);
      if (!existsSync(join(root, source))) continue;
      out.push({
        id: parsed.data.id,
        level: parsed.data.level,
        source,
        bytes: readFileSync(join(root, source)).byteLength,
      });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Serve audio the way a static host does, with byte ranges.
 *
 * A browser can seek only in a file whose server honours `Range`: without `Accept-Ranges` the
 * seekable range is empty and setting `currentTime` lands back at 0. Replaying one turn of a
 * recording is a seek, so a dev server that sent whole files would play every turn from the start.
 */
export function sendAudio(
  rangeHeader: string | undefined,
  bytes: Buffer,
  res: {
    statusCode: number;
    setHeader(name: string, value: string): unknown;
    end(body?: Buffer): unknown;
  },
): void {
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  const range = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? '');
  if (!range || (range[1] === '' && range[2] === '')) {
    res.setHeader('Content-Length', String(bytes.byteLength));
    res.end(bytes);
    return;
  }
  const last = bytes.byteLength - 1;
  const start =
    range[1] === '' ? Math.max(0, bytes.byteLength - Number(range[2])) : Number(range[1]);
  const end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), last) : last;
  if (start > end || start > last) {
    res.statusCode = 416;
    res.setHeader('Content-Range', `bytes */${bytes.byteLength}`);
    res.end();
    return;
  }
  res.statusCode = 206;
  res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.byteLength}`);
  res.setHeader('Content-Length', String(end - start + 1));
  res.end(bytes.subarray(start, end + 1));
}

export function audioBundle(): AstroIntegration {
  return {
    name: 'audio-bundle',
    hooks: {
      /**
       * The dev server never reaches `astro:build:done`, so without this `bun tauri dev` sets
       * the bundle flag, the component asks for `/audio/<id>.mp3`, and every reviewed recording
       * 404s — the one command anyone would use to check that a freshly published take plays.
       * Serving from the content tree rather than a copy also means an edited recording is
       * audible on reload, which is what a dev server is for.
       */
      'astro:server:setup': ({ server, logger }) => {
        if (!bundlesAudio(process.env[AUDIO_BUNDLE_ENV])) return;
        const root = repoRoot();
        server.middlewares.use((req, res, next) => {
          const path = (req.url ?? '').split('?')[0] ?? '';
          const readingMatch = /^\/audio\/readings\/(a1|a2|b1)\/([a-z0-9-]+)\.mp3$/.exec(path);
          if (readingMatch) {
            const rec = reviewedReadingAudio(root).find(
              (row) => row.level.toLowerCase() === readingMatch[1] && row.id === readingMatch[2],
            );
            if (!rec) return next();
            sendAudio(req.headers.range, readFileSync(join(root, rec.source)), res);
            return;
          }
          const cueMatch = /^\/audio\/([a-z0-9-]+)\.cues\.json$/.exec(path);
          if (cueMatch) {
            const rec = reviewedRecordings(root).find((r) => r.id === cueMatch[1]);
            const body = rec ? cueFile(rec) : null;
            if (!body) return next();
            res.setHeader('Content-Type', 'application/json');
            res.end(body);
            return;
          }
          const match = /^\/audio\/([a-z0-9-]+)\.mp3$/.exec(path);
          if (!match) return next();
          // Re-read per request: a recording republished while the server runs is served fresh.
          const rec = reviewedRecordings(root).find((r) => r.id === match[1]);
          if (!rec) return next();
          sendAudio(req.headers.range, readFileSync(join(root, rec.source)), res);
        });
        logger.info(
          `serving ${reviewedRecordings(root).length} dialogue(s) and ${reviewedReadingAudio(root).length} reading narration(s)`,
        );
      },
      'astro:build:done': ({ dir, logger }) => {
        const root = repoRoot();
        const outDir = fileURLToPath(dir);
        const audioDir = join(outDir, 'audio');
        const bundle = bundlesAudio(process.env[AUDIO_BUNDLE_ENV]);
        const available = reviewedRecordings(root);
        const availableReadings = reviewedReadingAudio(root);

        mkdirSync(audioDir, { recursive: true });
        const shipped = bundle ? available : [];
        // Flat target: ids are globally unique, and the component has no level to build a
        // path from. See lib/audio.ts.
        for (const rec of shipped) {
          copyFileSync(join(root, rec.source), join(audioDir, `${rec.id}.mp3`));
          const cues = cueFile(rec);
          if (cues) writeFileSync(join(audioDir, `${rec.id}.cues.json`), cues);
        }
        const readingDir = join(audioDir, 'readings');
        const shippedReadings = bundle ? availableReadings : [];
        for (const rec of shippedReadings) {
          const levelDir = join(readingDir, rec.level.toLowerCase());
          mkdirSync(levelDir, { recursive: true });
          copyFileSync(join(root, rec.source), join(levelDir, `${rec.id}.mp3`));
        }
        writeFileSync(
          join(audioDir, 'manifest.json'),
          `${JSON.stringify(
            {
              bundled: bundle,
              recordings: shipped.map(({ cues, ...rec }) => ({ ...rec, cues: cues?.length ?? 0 })),
              readings: shippedReadings,
            },
            null,
            2,
          )}\n`,
        );

        const megabytes = (
          [...shipped, ...shippedReadings].reduce((sum, r) => sum + r.bytes, 0) / 1e6
        ).toFixed(1);
        logger.info(
          bundle
            ? `shipped ${shipped.length} dialogue(s) and ${shippedReadings.length} reading narration(s), ${megabytes} MB → ${relative(root, audioDir)}`
            : `${available.length + availableReadings.length} reviewed audio artifact(s) withheld (${AUDIO_BUNDLE_ENV} unset) — items fall back to browser TTS`,
        );
      },
    },
  };
}
