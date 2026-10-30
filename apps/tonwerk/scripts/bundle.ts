/**
 * The Tonwerk bundle the engine serves, and whether it is older than its sources.
 *
 * Shared by `tonwerk:start`, which rebuilds only a stale bundle, and `tonwerk:app`, which always
 * builds one. The engine serves `apps/tonwerk/ui/dist` itself, so a stale bundle is a studio that
 * silently lacks the change just made to it.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = new URL('../../../', import.meta.url).pathname;
export const UI = join(ROOT, 'apps/tonwerk/ui');
export const ENGINE = join(ROOT, 'apps/tonwerk/engine/.venv/bin/atlas-listening');
export const INSTALL =
  'cd apps/tonwerk/engine && uv sync --extra test --extra mlx && ./install-qwen.sh';

/** Everything the bundle is built from: the app, its build config, and the Scene contract it imports. */
const INPUTS = [
  'apps/tonwerk/ui/src',
  'apps/tonwerk/ui/index.html',
  'apps/tonwerk/ui/package.json',
  'apps/tonwerk/ui/vite.config.ts',
  'apps/tonwerk/ui/tsconfig.json',
  'packages/schema/src',
];

function newest(path: string): number {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let latest = stat.mtimeMs;
  for (const entry of readdirSync(path)) latest = Math.max(latest, newest(join(path, entry)));
  return latest;
}

export function bundleIsStale(): boolean {
  const built = join(UI, 'dist/index.html');
  if (!existsSync(built)) return true;
  const sources = Math.max(
    ...INPUTS.map((input) => join(ROOT, input))
      .filter(existsSync)
      .map(newest),
  );
  return sources > statSync(built).mtimeMs;
}

export function buildBundle(): void {
  const build = Bun.spawnSync(['bun', 'run', 'build'], {
    cwd: UI,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);
}

export function requireEngine(): void {
  if (existsSync(ENGINE)) return;
  console.error(
    `Tonwerk: no engine at ${ENGINE}.\nInstall it once, from the repository root:\n  ${INSTALL}`,
  );
  process.exit(1);
}
