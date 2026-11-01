/**
 * A line diff between the revision the owner last reviewed and the file as it is now, for the
 * Prüfen inbox (ADR 0014).
 */
import { useEffect, useState } from 'react';
import { corpusClient } from '../data';
import { diffLines, type DiffOp } from '../diff';

/** The changed lines with three lines of context, runs of unchanged lines folded. */
function hunks(ops: DiffOp[], context = 3): (DiffOp | { type: 'gap'; count: number })[] {
  const keep = ops.map((op, i) =>
    ops.slice(Math.max(0, i - context), i + context + 1).some((near) => near.type !== 'same'),
  );
  const out: (DiffOp | { type: 'gap'; count: number })[] = [];
  let gap = 0;
  ops.forEach((op, i) => {
    if (keep[i]) {
      if (gap) out.push({ type: 'gap', count: gap });
      gap = 0;
      out.push(op);
    } else gap++;
  });
  if (gap) out.push({ type: 'gap', count: gap });
  return out;
}

const TONE: Record<DiffOp['type'], string> = {
  same: 'text-fg-muted',
  add: 'bg-normal/12 text-fg',
  del: 'bg-defect/12 text-fg line-through decoration-defect/50',
};
const MARK: Record<DiffOp['type'], string> = { same: ' ', add: '+', del: '−' };

/** The diff of one file, from `fromRevision` (a git blob hash) to the current text. */
export function Zeilendiff({ file, fromRevision }: { file: string; fromRevision?: string }) {
  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'ready'; ops: DiffOp[] | undefined; baseline: boolean }
    | { phase: 'error'; message: string }
  >({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = (await corpusClient.readFile(file)).text;
        const before = fromRevision ? await corpusClient.reviewedText(fromRevision) : null;
        if (cancelled) return;
        setState({
          phase: 'ready',
          ops: diffLines((before ?? '').split('\n'), current.split('\n')),
          baseline: before !== null,
        });
      } catch (error) {
        if (!cancelled)
          setState({
            phase: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, fromRevision]);

  if (state.phase === 'loading')
    return <p className="text-xs text-fg-muted">Diff wird gelesen …</p>;
  if (state.phase === 'error') return <p className="text-xs text-defect">{state.message}</p>;
  if (!state.ops)
    return (
      <p className="text-xs text-fg-muted">
        Die Datei wurde weitgehend neu geschrieben; ein Zeilendiff hilft hier nicht. Öffne sie ganz.
      </p>
    );
  return (
    <div>
      {!state.baseline ? (
        <p className="mb-2 text-xs text-fg-muted">
          {fromRevision
            ? 'Die geprüfte Fassung wurde nie committet; gezeigt wird die ganze Datei.'
            : 'Noch nie von dir geprüft; gezeigt wird die ganze Datei.'}
        </p>
      ) : null}
      <pre className="max-h-[28rem] overflow-auto rounded-control border border-line bg-raised p-2 font-mono text-xs leading-5">
        {hunks(state.ops).map((row, i) =>
          row.type === 'gap' ? (
            <div key={i} className="select-none text-fg-subtle">
              ⋯ {row.count} unveränderte Zeilen
            </div>
          ) : (
            <div key={i} className={TONE[row.type]}>
              <span className="select-none pr-2 text-fg-subtle">{MARK[row.type]}</span>
              {row.text || ' '}
            </div>
          ),
        )}
      </pre>
    </div>
  );
}
