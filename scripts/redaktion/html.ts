/**
 * Shared render helpers. Nothing here knows about the corpus — every function takes strings and
 * returns markup, so a view can be read as "what do I show" without also being "how do I escape".
 */
import { GITHUB, topics } from './model';

export const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const pct = (n: number): string => `${Math.round(n)}%`;
export const pct1 = (n: number): string => `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;

export type ChipState = 'ok' | 'miss' | 'none' | 'warn' | 'info';

export const chip = (state: ChipState, label: string, title = ''): string =>
  `<span class="chip ${state}"${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</span>`;

/** A repo path with the GitHub link beside it. */
export const path = (p: string): string =>
  `<span class="path"><code>${esc(p)}</code> <a class="gh" href="${GITHUB}/${esc(p)}" title="auf GitHub öffnen">↗</a></span>`;

export const anchor = (id: string, text: string): string =>
  `<a class="topic-link" href="#topic-${esc(id)}">${esc(text)}</a>`;

/** Links to a topic anchor when the topic exists; plain code when the id dangles. */
export const topicRef = (id: string): string =>
  topics.has(id)
    ? `<a class="topic-link" href="#topic-${esc(id)}"><code>${esc(id)}</code></a>`
    : `<code class="dangling" title="kein Thema mit dieser id">${esc(id)}</code>`;

/** Links into the Struktur view. Every grammar point is addressable from anywhere. */
export const pointRef = (id: string, label?: string): string =>
  `<a class="topic-link" href="#struktur-${esc(id)}"><code>${esc(label ?? id)}</code></a>`;

/** Links into the Fokus view. */
export const tagRef = (tag: string): string =>
  `<a class="tagcode tagref" href="#fokus-${esc(tag)}">${esc(tag)}</a>`;

/** Links into the Strang view. */
export const strandRef = (strand: string, label?: string): string =>
  `<a class="topic-link" href="#strang-${esc(strand)}">${esc(label ?? strand)}</a>`;

export const histogram = (counts: Map<string, number>): string =>
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(
      ([k, v]) =>
        `<span class="hist"><span class="hist-k">${esc(k)}</span><span class="hist-v">${v}</span></span>`,
    )
    .join('');

export const table = (head: string[], rows: string[][], cls = ''): string =>
  `<div class="scroll"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
  `</tbody></table></div>`;

/** The lowercase blob the client-side filter matches against. */
export const searchKey = (...parts: (string | undefined)[]): string =>
  esc(parts.filter(Boolean).join(' ').toLowerCase());

/**
 * The "was verweist hierher" block every node page carries. A navigator whose edges only point one
 * way is a list with extra steps: the reason to model the corpus as a graph is that arriving at a
 * structure should show the topics, items and sources that reach it, not only the ones it names.
 */
export const backlinks = (groups: { label: string; links: string[]; hint?: string }[]): string =>
  `<div class="edges">${groups
    .map(
      (g) =>
        `<div class="edge"><span class="edge-label"${g.hint ? ` title="${esc(g.hint)}"` : ''}>${esc(g.label)}</span>${
          g.links.length ? g.links.join(' ') : '<span class="muted">—</span>'
        }</div>`,
    )
    .join('')}</div>`;
