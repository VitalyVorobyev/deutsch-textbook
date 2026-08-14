/**
 * The shell: sidebar, route table, and the loading/error states that matter for a local tool.
 *
 * The navigation is grouped the way the model is: **Sprache** is the language itself with the
 * course painted on, **Kurs** is what exists, **Beleg** is what backs it. That ordering is the
 * design commitment — a console whose first view is a list of files can only ever answer questions
 * about files.
 */
import { Chip, Empty, Heading } from '@da/ui/primitives';
import { useCorpus } from './data';
import { href, useRoute, useScrollReset } from './router';
import { Ueberblick } from './views/Ueberblick';
import { Themen } from './views/Themen';
import { Thema } from './views/Thema';
import { Luecken } from './views/Luecken';
import { Fokus } from './views/Fokus';
import { Sprachkarte } from './views/Sprachkarte';
import { Struktur } from './views/Struktur';
import { Quellen } from './views/Quellen';
import { Lexik } from './views/Lexik';

const NAV: { group: string; items: { view: string; label: string }[] }[] = [
  {
    group: 'Sprache',
    items: [
      { view: 'sprachkarte', label: 'Sprachkarte' },
      { view: 'struktur', label: 'Strukturen' },
      { view: 'fokus', label: 'Fokus-Tags' },
    ],
  },
  {
    group: 'Kurs',
    items: [
      { view: 'ueberblick', label: 'Überblick' },
      { view: 'themen', label: 'Einheiten & Themen' },
      { view: 'lexik', label: 'Lexik' },
    ],
  },
  {
    group: 'Beleg',
    items: [
      { view: 'quellen', label: 'Quellen' },
      { view: 'luecken', label: 'Lücken' },
    ],
  },
];

function toggleTheme(): void {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('da:redaktion-theme', next);
  } catch {
    /* private mode; the theme simply does not persist */
  }
}

export function App() {
  const { graph, error, revision } = useCorpus();
  const [route] = useRoute();
  useScrollReset(`${route.view}/${route.id ?? ''}`);

  const body = () => {
    if (error) {
      return (
        <Empty>
          Der Korpus ließ sich nicht laden: {error}. Läuft der Entwicklungsserver (<code>bun run redaktion</code>)?
        </Empty>
      );
    }
    if (!graph) return <Empty>Korpus wird gelesen …</Empty>;
    switch (route.view) {
      case 'themen':
        return <Themen graph={graph} />;
      case 'thema':
        return route.id ? <Thema graph={graph} id={route.id} /> : <Themen graph={graph} />;
      case 'luecken':
        return <Luecken graph={graph} />;
      case 'fokus':
        return <Fokus graph={graph} id={route.id} />;
      case 'sprachkarte':
        return <Sprachkarte graph={graph} />;
      case 'struktur':
        return <Struktur graph={graph} id={route.id} />;
      case 'quellen':
        return <Quellen graph={graph} />;
      case 'lexik':
        return <Lexik graph={graph} />;
      default:
        return <Ueberblick graph={graph} />;
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] gap-6 px-4 py-6">
      <nav className="sticky top-6 hidden h-fit w-52 shrink-0 md:block">
        <a href={href('ueberblick')} className="mb-4 block text-sm font-semibold tracking-tight text-ink">
          Redaktion
          <span className="block text-xs font-normal text-ink-muted">Deutsch-Atlas</span>
        </a>
        {NAV.map((group) => (
          <div key={group.group} className="mb-4">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-muted">{group.group}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.view}>
                  <a
                    href={href(item.view)}
                    className={`block rounded px-2 py-1 text-sm ${
                      route.view === item.view ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-surface-sunken'
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button type="button" onClick={toggleTheme} className="mt-2 text-xs text-ink-muted hover:text-ink">
          Hell / Dunkel
        </button>
        {graph?.notes.length ? (
          <p className="mt-4 text-xs text-warn" title={graph.notes.join('\n')}>
            {graph.notes.length} Ladehinweis(e)
          </p>
        ) : null}
        {revision > 0 ? (
          <p className="mt-3 text-[10px] text-ink-muted">Korpus neu gelesen ({revision})</p>
        ) : null}
      </nav>

      <main className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap gap-1 md:hidden">
          {NAV.flatMap((g) => g.items).map((item) => (
            <a key={item.view} href={href(item.view)}>
              <Chip tone={route.view === item.view ? 'brand' : 'neutral'}>{item.label}</Chip>
            </a>
          ))}
        </div>
        {body()}
      </main>
    </div>
  );
}

export { Heading };
