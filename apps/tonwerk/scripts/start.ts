/**
 * `bun run tonwerk:start` — the studio in a browser tab, signed in, from one command.
 *
 * Rebuilds the bundle only when its sources are newer, then runs the checkout's engine on a free
 * port. `serve` opens the tab with a single-use launch code, so there is no token to paste.
 * Arguments are passed to `serve` and win over the defaults here: `-- --port 8765 --no-browser`
 * is the engine the Vite dev server proxies to.
 *
 * The engine is run from its venv directly, not through `uv run`, which would sync the environment
 * first and remove the speech runtime `install-qwen.sh` added.
 */
import { ENGINE, ROOT, buildBundle, bundleIsStale, requireEngine } from './bundle';

requireEngine();
if (bundleIsStale()) buildBundle();

const engine = Bun.spawn(
  [ENGINE, 'serve', '--repo', ROOT, '--port', '0', ...process.argv.slice(2)],
  {
    cwd: `${ROOT}apps/tonwerk/engine`,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
// Ctrl-C reaches the engine directly, since it shares this terminal's process group; this
// process only has to outlive it and pass its exit status on.
process.on('SIGINT', () => {});
process.exit(await engine.exited);
