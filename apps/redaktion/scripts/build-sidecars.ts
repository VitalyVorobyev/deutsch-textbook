/** Build the two self-contained binaries Tauri packages as externalBin resources. */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const host = Bun.spawnSync(['rustc', '-vV'], { stdout: 'pipe', stderr: 'inherit' }).stdout.toString().match(/^host:\s*(.+)$/m)?.[1];
if (!host) throw new Error('rustc -vV did not report a host target');

const bunTarget = ({
  'aarch64-apple-darwin': 'bun-darwin-arm64',
  'x86_64-apple-darwin': 'bun-darwin-x64',
  'aarch64-unknown-linux-gnu': 'bun-linux-arm64',
  'x86_64-unknown-linux-gnu': 'bun-linux-x64',
  'x86_64-pc-windows-msvc': 'bun-windows-x64',
} as Record<string, string>)[host];
if (!bunTarget) throw new Error(`no Bun compile target for ${host}`);

const root = join(import.meta.dirname, '..', '..', '..');
const output = join(root, 'apps', 'redaktion', 'src-tauri', 'binaries');
mkdirSync(output, { recursive: true });

for (const [name, entry] of [
  ['redaktion-sidecar', join(root, 'apps', 'redaktion', 'sidecar', 'index.ts')],
  ['redaktion-validate', join(root, 'scripts', 'validate.ts')],
] as const) {
  const outfile = join(output, `${name}-${host}${host.includes('windows') ? '.exe' : ''}`);
  const run = Bun.spawnSync(['bun', 'build', '--compile', `--target=${bunTarget}`, `--outfile=${outfile}`, entry], {
    cwd: root,
    env: host.endsWith('apple-darwin') ? { ...process.env, BUN_NO_CODESIGN_MACHO_BINARY: '1' } : process.env,
    stdout: 'inherit', stderr: 'inherit',
  });
  if (run.exitCode !== 0) process.exit(run.exitCode);
  // macOS may SIGKILL an unsigned Bun-compiled Mach-O before it reaches main. Tauri's release
  // signing can replace this ad-hoc signature; local `tauri dev` still needs an executable the
  // kernel will launch.
  if (host.endsWith('apple-darwin')) {
    const sign = Bun.spawnSync(['codesign', '--force', '--sign', '-', outfile], {
      cwd: root, stdout: 'inherit', stderr: 'inherit',
    });
    if (sign.exitCode !== 0) process.exit(sign.exitCode);
  }
}
