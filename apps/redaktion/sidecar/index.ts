/** Persistent JSONL corpus service bundled with the Redaktion desktop app. */
import { existsSync, readFileSync, realpathSync, statSync, watch, type FSWatcher } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { contentGraph, invalidateContentGraph } from '@da/content/graph';
import { graphChunk, graphPayload, type ChunkName } from '@da/content/payload';
import { readSource, saveSource, type SaveFileInput } from '@da/content/editor';
import { applyPatch, writableFields, type WritePatch } from '@da/content/write';
import { renderSource, type RenderSourceInput } from '@da/content/preview';

const PROTOCOL_VERSION = 1;
interface RpcRequest { version?: number; id: number; method: string; params?: Record<string, unknown> }
interface RpcResponse { version: number; id: number; result?: unknown; error?: string }

let workspaceRoot: string | undefined;
let revision = 0;
let watchers: FSWatcher[] = [];

function workspaceInfo() {
  return { root: workspaceRoot ?? '', writable: !!workspaceRoot, transport: 'tauri', platform: process.platform };
}

function validateCheckout(path: string): string {
  const root = realpathSync(resolve(path));
  for (const sentinel of ['package.json', 'CLAUDE.md', 'content/atlas.yaml'])
    if (!existsSync(join(root, sentinel))) throw new Error(`kein Deutsch-Atlas Checkout: ${sentinel} fehlt`);
  return root;
}

function openWorkspace(path: string) {
  workspaceRoot = validateCheckout(path);
  for (const w of watchers) w.close();
  watchers = [];

  // Two narrow watches rather than one recursive watch of the whole checkout. The old shape
  // watched `workspaceRoot` recursively and filtered by prefix *after* the event arrived, so the
  // OS was reporting every write under `node_modules/`, `dist/` and `src-tauri/target/` — a Rust
  // build or a `bun install` delivered thousands of events the sidecar then discarded one by one.
  // Watching the two directories the corpus actually lives in costs nothing and never sees them.
  //
  // Coalesced for the same reason as the Vite plugin: one logical edit is several file events,
  // and each used to bump `revision`, which is what the client polls.
  const COALESCE_MS = 120;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const bump = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      invalidateContentGraph(workspaceRoot!);
      revision += 1;
    }, COALESCE_MS);
  };
  for (const dir of ['content', 'data']) {
    const target = join(workspaceRoot, dir);
    if (!existsSync(target)) continue;
    watchers.push(watch(target, { recursive: true }, bump));
  }
  revision += 1;
  return workspaceInfo();
}

function root(): string {
  if (!workspaceRoot) throw new Error('workspace-not-selected');
  return workspaceRoot;
}

function validatorPath(): string {
  const executable = process.execPath;
  const candidate = join(dirname(executable), process.platform === 'win32' ? 'redaktion-validate.exe' : 'redaktion-validate');
  if (!existsSync(candidate)) throw new Error(`Redaktion validator fehlt: ${candidate}`);
  return candidate;
}

function validateWorkspace(): Promise<{ ok: boolean; output: string; startedAt: string; finishedAt: string }> {
  const startedAt = new Date().toISOString();
  return new Promise((done) => {
    const child = spawn(validatorPath(), [], { env: { ...process.env, DEUTSCH_ATLAS_ROOT: root() }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    child.on('error', (error) => done({ ok: false, output: error.message, startedAt, finishedAt: new Date().toISOString() }));
    child.on('close', (code) => done({ ok: code === 0, output, startedAt, finishedAt: new Date().toISOString() }));
  });
}

function verifiedPatch(patch: WritePatch, expectedRevision?: string) {
  return applyPatch(patch, root(), {
    expectedRevision,
    verify: () => {
      const run = Bun.spawnSync([validatorPath()], {
        env: { ...process.env, DEUTSCH_ATLAS_ROOT: root() }, stdout: 'pipe', stderr: 'pipe',
      });
      return run.exitCode === 0 ? undefined : `${run.stdout.toString()}${run.stderr.toString()}`.trim();
    },
  });
}

async function dispatch(method: string, params: Record<string, unknown>) {
  switch (method) {
    case 'openWorkspace': return openWorkspace(String(params.path ?? ''));
    case 'workspace': return workspaceInfo();
    case 'revision': return revision;
    case 'getGraph': return graphPayload(contentGraph(root()));
    case 'getChunk': return graphChunk(contentGraph(root()), String(params.name) as ChunkName);
    case 'readFile': return readSource(root(), String(params.path ?? ''));
    case 'renderSource': return renderSource(params as unknown as RenderSourceInput);
    case 'saveFile': {
      const result = await saveSource(root(), params as unknown as SaveFileInput);
      if (result.ok && result.changed) { invalidateContentGraph(root()); revision += 1; }
      return result;
    }
    case 'validateWorkspace': return validateWorkspace();
    case 'writableFields': return writableFields();
    case 'writeField': {
      const result = verifiedPatch(params as unknown as WritePatch);
      if (result.ok && result.changed) { invalidateContentGraph(root()); revision += 1; }
      return result;
    }
    case 'readAsset': {
      const checkout = realpathSync(root());
      const target = realpathSync(resolve(checkout, String(params.path ?? '')));
      if (!target.startsWith(join(checkout, 'content', 'listening') + sep) || !target.endsWith('.mp3') || !statSync(target).isFile())
        throw new Error('only committed listening MP3 files are readable');
      return `data:audio/mpeg;base64,${readFileSync(target).toString('base64')}`;
    }
    case 'markTopicReviewed': {
      const topicId = String(params.topicId ?? '');
      const expectedRevision = String(params.expectedRevision ?? '');
      const topic = contentGraph(root()).topics.get(topicId);
      if (!topic || !expectedRevision) throw new Error('topicId and expectedRevision are required');
      const result = verifiedPatch({ file: topic.file, field: 'status', value: 'reviewed' }, expectedRevision);
      if (result.ok && result.changed) { invalidateContentGraph(root()); revision += 1; }
      return result;
    }
    default: throw new Error(`unknown RPC method "${method}"`);
  }
}

const initial = process.argv.indexOf('--workspace');
if (initial >= 0 && process.argv[initial + 1]) {
  try { openWorkspace(process.argv[initial + 1]!); } catch { /* first-run picker will replace it */ }
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', (line) => {
  void (async () => {
    let request: RpcRequest;
    try { request = JSON.parse(line) as RpcRequest; }
    catch { process.stdout.write(`${JSON.stringify({ version: PROTOCOL_VERSION, id: -1, error: 'invalid JSON' })}\n`); return; }
    if (request.version !== PROTOCOL_VERSION) {
      process.stdout.write(`${JSON.stringify({ version: PROTOCOL_VERSION, id: request.id, error: `unsupported protocol version ${request.version ?? 'missing'}` })}\n`);
      return;
    }
    let response: RpcResponse;
    try { response = { version: PROTOCOL_VERSION, id: request.id, result: await dispatch(request.method, request.params ?? {}) }; }
    catch (error) { response = { version: PROTOCOL_VERSION, id: request.id, error: error instanceof Error ? error.message : String(error) }; }
    process.stdout.write(`${JSON.stringify(response)}\n`);
  })();
});
lines.on('close', () => { for (const w of watchers) w.close(); });
