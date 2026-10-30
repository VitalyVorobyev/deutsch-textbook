/**
 * `bun run tonwerk:app` — build `Tonwerk.app`: the bundle the engine serves, then the shell.
 *
 * The shell runs the engine of the checkout it was built in, so the app is built here and not
 * downloaded. `CI=true` on macOS keeps `tauri build` from asking for Finder automation.
 */
import { join } from 'node:path';
import { ROOT, buildBundle, requireEngine } from './bundle';

requireEngine();
buildBundle();

const tonwerk = join(ROOT, 'apps/tonwerk');
const build = Bun.spawnSync(
  ['bunx', 'tauri', 'build', '--config', 'src-tauri/tauri.conf.json', ...process.argv.slice(2)],
  {
    cwd: tonwerk,
    env: process.platform === 'darwin' ? { ...process.env, CI: 'true' } : process.env,
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);
console.log(`\nTonwerk: ${join(tonwerk, 'src-tauri/target/release/bundle/macos/Tonwerk.app')}`);
