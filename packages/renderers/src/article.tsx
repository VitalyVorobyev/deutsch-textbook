import type { ReactNode } from 'react';
import type { PreviewDiagnostic, PreviewNode, PreviewPayload } from '@da/content/preview';

export interface ArticlePreviewProps {
  payload: PreviewPayload;
  className?: string;
}

const children = (nodes: PreviewNode[] | undefined): ReactNode =>
  nodes?.map((node, index) => <Node key={`${node.type}-${index}`} node={node} />);

function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^(?:https?:|mailto:|#|\/)/.test(value)) return value;
  return undefined;
}

function Node({ node }: { node: PreviewNode }): ReactNode {
  switch (node.type) {
    case 'text': return node.value;
    case 'paragraph': return <p>{children(node.children)}</p>;
    case 'heading': {
      const Heading = `h${node.depth}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return <Heading>{children(node.children)}</Heading>;
    }
    case 'strong': return <strong>{children(node.children)}</strong>;
    case 'emphasis': return <em>{children(node.children)}</em>;
    case 'delete': return <del>{children(node.children)}</del>;
    case 'inlineCode': return <code>{node.value}</code>;
    case 'code': return <pre><code>{node.value}</code></pre>;
    case 'blockquote': return <blockquote>{children(node.children)}</blockquote>;
    case 'break': return <br />;
    case 'thematicBreak': return <hr />;
    case 'link': {
      const href = safeHref(node.url);
      return href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{children(node.children)}</a> : <span>{children(node.children)}</span>;
    }
    case 'image': return <figure><img src={safeHref(node.url)} alt={node.alt ?? ''} /><figcaption>{node.alt}</figcaption></figure>;
    case 'list': {
      const List = node.ordered ? 'ol' : 'ul';
      return <List start={node.ordered ? node.start : undefined}>{children(node.children)}</List>;
    }
    case 'listItem': return <li>{children(node.children)}</li>;
    case 'table': {
      const [head, ...body] = node.children;
      return <div className="atlas-preview-table-wrap"><table>{head ? <thead><Node node={head} /></thead> : null}<tbody>{children(body)}</tbody></table></div>;
    }
    case 'tableRow': return <tr>{children(node.children)}</tr>;
    case 'tableCell': {
      const Cell = node.header ? 'th' : 'td';
      return <Cell>{children(node.children)}</Cell>;
    }
    case 'component': return <LearningComponent name={node.name} props={node.props} />;
    case 'unsupported': return <Unsupported label={node.label} />;
    case 'root': return <>{children(node.children)}</>;
    default: return null;
  }
}

const RAILS: Record<string, { label: string; tokens: Array<[string, string]> }> = {
  v2: { label: 'Hauptsatz', tokens: [['Heute', '1'], ['arbeitet', 'Position 2'], ['Nina', '3'], ['im Büro.', '4']] },
  separable: { label: 'Trennbares Verb', tokens: [['Nina', '1'], ['ruft', 'Position 2'], ['ihre Mutter', '3'], ['an.', 'Ende']] },
  modal: { label: 'Modalverb', tokens: [['Nina', '1'], ['muss', 'Position 2'], ['am Samstag', '3'], ['arbeiten.', 'Ende']] },
  perfekt: { label: 'Perfekt', tokens: [['Nina', '1'], ['hat', 'Position 2'], ['den Schrank', '3'], ['aufgebaut.', 'Ende']] },
  subordinate: { label: 'weil-Nebensatz', tokens: [['weil', 'Signal'], ['Nina', '2'], ['am Samstag', '3'], ['arbeiten muss.', 'Ende']] },
  indirect: { label: 'Indirekte Frage', tokens: [['Weißt du,', '1'], ['wann', 'Signal'], ['der Kurs', '3'], ['beginnt?', 'Ende']] },
  zu: { label: 'Infinitiv mit zu', tokens: [['Nina', '1'], ['versucht,', 'Position 2'], ['früher', '3'], ['aufzustehen.', 'Ende']] },
};

function LearningComponent({ name, props }: { name: string; props: Record<string, string | boolean> }) {
  if (name === 'SentenceRail') {
    const rail = RAILS[String(props.view)] ?? RAILS.v2!;
    return (
      <figure className="atlas-preview-figure">
        <figcaption>{rail.label}</figcaption>
        <div className="atlas-preview-rail" aria-label={rail.tokens.map(([token]) => token).join(' ')}>
          {rail.tokens.map(([token, position]) => <span key={`${position}-${token}`}><small>{position}</small><strong>{token}</strong></span>)}
        </div>
      </figure>
    );
  }
  return (
    <figure className="atlas-preview-figure">
      <figcaption>{name}</figcaption>
      <p className="atlas-preview-component-note">Atlas-Lernfigur · {Object.entries(props).map(([key, value]) => `${key}: ${String(value)}`).join(' · ') || 'Standardansicht'}</p>
    </figure>
  );
}

function Unsupported({ label }: { label: string }) {
  return <div className="atlas-preview-unsupported" role="note">Nicht sicher renderbar: {label}</div>;
}

function Diagnostics({ diagnostics }: { diagnostics: PreviewDiagnostic[] }) {
  if (!diagnostics.length) return null;
  return (
    <aside className="atlas-preview-diagnostics" aria-label="Vorschauhinweise">
      <p>Vorschauhinweise</p>
      <ul>{diagnostics.map((item) => <li key={item.id}>{item.message}</li>)}</ul>
    </aside>
  );
}

export function ArticlePreview({ payload, className = '' }: ArticlePreviewProps) {
  return (
    <div className={className}>
      <Diagnostics diagnostics={payload.diagnostics} />
      {payload.available ? <article className="atlas-article-preview" lang={payload.language}><Node node={payload.root} /></article> : (
        <div className="atlas-preview-empty">Für diese Quelle ist keine {payload.language.toUpperCase()}-Fassung verfasst.</div>
      )}
    </div>
  );
}
