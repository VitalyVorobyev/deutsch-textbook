/**
 * Run `dev` or `build` with the reviewed listening recordings bundled in.
 *
 * This exists for one reason: `PUBLIC_ATLAS_AUDIO_BUNDLE=1 bun run build` is a POSIX-shell
 * construct, and Tauri runs `beforeBuildCommand` through `cmd /C` on Windows — where a leading
 * `NAME=value` is not a command prefix but a program name, so the release build would fail
 * before reaching Bun. `.github/workflows/release.yml` builds `windows-latest`, so that failure
 * would have cost the Windows installers on the next tag.
 *
 * Setting the variable in-process instead is portable everywhere Bun runs.
 */
import { spawnSync } from 'node:child_process';

import { AUDIO_BUNDLE_ENV } from '../src/lib/audio';

const script = process.argv[2];
if (script !== 'dev' && script !== 'build') {
  console.error('usage: bun scripts/with-audio.ts <dev|build>');
  process.exit(2);
}

// `process.execPath` is the Bun binary already running this file — no PATH lookup, no shell.
const result = spawnSync(process.execPath, ['run', script], {
  stdio: 'inherit',
  env: { ...process.env, [AUDIO_BUNDLE_ENV]: '1' },
});

process.exit(result.status ?? 1);
