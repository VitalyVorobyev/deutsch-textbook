/** Build distributables without requiring Finder automation permission on macOS. */
const command = [
  'bunx',
  'tauri',
  'build',
  '--config',
  'src-tauri/tauri.conf.json',
  ...process.argv.slice(2),
];

const run = Bun.spawnSync(command, {
  cwd: new URL('..', import.meta.url).pathname,
  env: process.platform === 'darwin' ? { ...process.env, CI: 'true' } : process.env,
  stdout: 'inherit',
  stderr: 'inherit',
});
process.exit(run.exitCode);
