/** Transport-neutral access to the checked-out corpus. */
import { useEffect, useState } from 'react';
import type { Diagnostic, FileSnapshot, SaveFileInput, SaveFileResult } from '@da/content/editor';
import type { ChunkName, GraphPayload } from '@da/content/payload';
import type { WritePatch, WriteResult } from '@da/content/write';

export type { Diagnostic, FileSnapshot, GraphPayload, SaveFileInput, SaveFileResult };

export interface WorkspaceInfo {
  root: string;
  writable: boolean;
  transport: 'vite' | 'tauri';
  platform: string;
}

export interface ValidationRun {
  ok: boolean;
  output: string;
  startedAt: string;
  finishedAt: string;
}

export interface CorpusEvent {
  type: 'changed' | 'workspace';
  file?: string;
}

export interface WritableField {
  class: string;
  field: string;
  values: readonly string[];
}

export interface CorpusClient {
  openWorkspace(path: string): Promise<WorkspaceInfo>;
  workspace(): Promise<WorkspaceInfo>;
  getGraph(): Promise<GraphPayload>;
  getChunk<T>(name: ChunkName): Promise<T>;
  readFile(path: string): Promise<FileSnapshot>;
  saveFile(input: SaveFileInput): Promise<SaveFileResult>;
  validateWorkspace(): Promise<ValidationRun>;
  assetUrl(path: string): Promise<string>;
  writableFields(): Promise<WritableField[]>;
  writeField(input: WritePatch): Promise<WriteResult>;
  markTopicReviewed(topicId: string, expectedRevision: string): Promise<WriteResult>;
  subscribe(listener: (event: CorpusEvent) => void): () => void;
}

async function response<T>(request: Promise<Response>): Promise<T> {
  const result = await request;
  const body = await result.json();
  if (!result.ok && !(body && typeof body === 'object' && 'ok' in body))
    throw new Error((body as { error?: string }).error ?? `${result.status} ${result.statusText}`);
  return body as T;
}

class HttpCorpusClient implements CorpusClient {
  openWorkspace(_path: string) { return this.workspace(); }
  workspace() { return response<WorkspaceInfo>(fetch('/__workspace')); }
  getGraph() { return response<GraphPayload>(fetch('/__graph')); }
  getChunk<T>(name: ChunkName) { return response<T>(fetch(`/__chunk/${name}`)); }
  readFile(path: string) { return response<FileSnapshot>(fetch(`/__file?path=${encodeURIComponent(path)}`)); }
  saveFile(input: SaveFileInput) {
    return response<SaveFileResult>(fetch('/__file', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }));
  }
  validateWorkspace() { return response<ValidationRun>(fetch('/__validate', { method: 'POST' })); }
  assetUrl(path: string) { return Promise.resolve(`/__asset?path=${encodeURIComponent(path)}`); }
  async writableFields() {
    return (await response<{ fields: WritableField[] }>(fetch('/__writable'))).fields;
  }
  writeField(input: WritePatch) {
    return response<WriteResult>(fetch('/__write', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }));
  }
  markTopicReviewed(topicId: string, expectedRevision: string) {
    return response<WriteResult>(fetch('/__review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId, expectedRevision }),
    }));
  }
  subscribe(listener: (event: CorpusEvent) => void): () => void {
    const handler = (event: { file?: string } = {}) => listener({ type: 'changed', file: event.file });
    import.meta.hot?.on('redaktion:corpus-changed', handler);
    return () => import.meta.hot?.off?.('redaktion:corpus-changed', handler);
  }
}

class TauriCorpusClient implements CorpusClient {
  private async rpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>('rpc_request', { method, params });
  }
  openWorkspace(path: string) { return this.rpc<WorkspaceInfo>('openWorkspace', { path }); }
  workspace() { return this.rpc<WorkspaceInfo>('workspace'); }
  getGraph() { return this.rpc<GraphPayload>('getGraph'); }
  getChunk<T>(name: ChunkName) { return this.rpc<T>('getChunk', { name }); }
  readFile(path: string) { return this.rpc<FileSnapshot>('readFile', { path }); }
  saveFile(input: SaveFileInput) { return this.rpc<SaveFileResult>('saveFile', input as unknown as Record<string, unknown>); }
  validateWorkspace() { return this.rpc<ValidationRun>('validateWorkspace'); }
  assetUrl(path: string) { return this.rpc<string>('readAsset', { path }); }
  writableFields() { return this.rpc<WritableField[]>('writableFields'); }
  writeField(input: WritePatch) { return this.rpc<WriteResult>('writeField', input as unknown as Record<string, unknown>); }
  markTopicReviewed(topicId: string, expectedRevision: string) {
    return this.rpc<WriteResult>('markTopicReviewed', { topicId, expectedRevision });
  }
  subscribe(listener: (event: CorpusEvent) => void): () => void {
    let stopped = false;
    let last = -1;
    const poll = async () => {
      try {
        const next = await this.rpc<number>('revision');
        if (last >= 0 && next !== last) listener({ type: 'changed' });
        last = next;
      } catch { /* the next foreground request will surface a stopped sidecar */ }
    };
    void poll();
    const timer = window.setInterval(() => { if (!stopped) void poll(); }, 1500);
    return () => { stopped = true; window.clearInterval(timer); };
  }
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const corpusClient: CorpusClient = isTauri() ? new TauriCorpusClient() : new HttpCorpusClient();

const chunkCache = new Map<string, Promise<unknown>>();
export function loadChunk<T>(name: ChunkName): Promise<T> {
  let pending = chunkCache.get(name);
  if (!pending) {
    pending = corpusClient.getChunk<T>(name);
    chunkCache.set(name, pending);
  }
  return pending as Promise<T>;
}

export interface CorpusState {
  graph?: GraphPayload;
  workspace?: WorkspaceInfo;
  error?: string;
  revision: number;
}

export function useCorpus(): CorpusState {
  const [state, setState] = useState<CorpusState>({ revision: 0 });
  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    const load = async () => {
      try {
        const workspace = await corpusClient.workspace();
        if (!workspace.root) { if (!cancelled) setState({ workspace, revision }); return; }
        const graph = await corpusClient.getGraph();
        if (!cancelled) setState({ graph, workspace, revision });
      } catch (error) {
        if (!cancelled) setState({ error: error instanceof Error ? error.message : String(error), revision });
      }
    };
    void load();
    const unsubscribe = corpusClient.subscribe(() => {
      chunkCache.clear();
      revision += 1;
      void load();
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);
  return state;
}
