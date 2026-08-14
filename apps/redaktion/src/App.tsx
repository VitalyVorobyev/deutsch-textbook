/**
 * The shell: navigation, the sticky header the tables anchor to, and the states that matter for a
 * local tool.
 *
 * THE NAVIGATION IS THE ARGUMENT. Nine flat routes became seven, and two of them disappeared by
 * being **absorbed** rather than deleted: `Überblick`'s per-level instruments are the strip beneath
 * the Sprachkarte, where "how far is A2" sits next to the map of what A2 is; and `Lexik` is one
 * kind inside `Bestand`, which covers the other fourteen it never showed. A sidebar with an entry
 * per report is a file menu — it asks the reader to already know which report answers their
 * question.
 *
 * **Sprachkarte leads.** The first view a tool opens with is its claim about what it is for: a list
 * of files can only ever answer questions about files. This one opens on the language.
 *
 * The header is sticky and 56 px tall, which is not decoration — `Zeilentabelle`'s `<thead>` sticks
 * to `top-14` underneath it. At 98 and 102 rows the column meanings scroll away in the first
 * gesture, which is how the screenshots that prompted this redesign were taken.
 */
import { Chip, Empty } from '@da/ui/primitives';
import { useCorpus } from './data';
import { href, useRoute, useScrollReset } from './router';
import { Themen } from './views/Themen';
import { Thema } from './views/Thema';
import { Bestand } from './views/Bestand';
import { Luecken } from './views/Luecken';
import { Fokus } from './views/Fokus';
import { Sprachkarte } from './views/Sprachkarte';
import { Struktur } from './views/Struktur';
import { Quellen } from './views/Quellen';

interface NavItem {
  view: string;
  label: string;
  /** Views that render inside this entry — a detail page keeps its section lit. */
  also?: string[];
}

const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ view: 'sprachkarte', label: 'Sprachkarte' }] },
  {
    group: 'Kurs',
    items: [
      { view: 'themen', label: 'Einheiten & Themen', also: ['thema'] },
      { view: 'bestand', label: 'Bestand' },
    ],
  },
  {
    group: 'Sprache',
    items: [
      { view: 'struktur', label: 'Strukturen' },
      { view: 'fokus', label: 'Fokus-Tags' },
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

const TITLES: Record<string, string> = {
  sprachkarte: 'Sprachkarte',
  themen: 'Einheiten & Themen',
  thema: 'Thema',
  bestand: 'Bestand',
  struktur: 'Strukturen',
  fokus: 'Fokus-Tags',
  quellen: 'Quellen',
  luecken: 'Lücken',
};

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
      case 'bestand':
        return <Bestand graph={graph} />;
      case 'luecken':
        return <Luecken graph={graph} />;
      case 'fokus':
        return <Fokus graph={graph} id={route.id} />;
      case 'struktur':
        return <Struktur graph={graph} id={route.id} />;
      case 'quellen':
        return <Quellen graph={graph} />;
      default:
        return <Sprachkarte graph={graph} />;
    }
  };

  const active = (item: NavItem) => route.view === item.view || (item.also ?? []).includes(route.view);
  const flat = NAV.flatMap((g) => g.items);

  return (
    <div className="min-h-screen bg-surface">
      {/* h-14, and `Zeilentabelle` sticks its header to `top-14` under it. */}
      <header className="sticky top-0 z-30 h-14 border-b border-border-subtle bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1500px] items-center gap-4 px-4">
          <a href={href('sprachkarte')} className="shrink-0 text-sm font-bold tracking-tight text-ink">
            Redaktion
            <span className="ml-2 font-normal text-ink-muted">Deutsch-Atlas</span>
          </a>
          <span className="hidden text-sm text-ink-muted sm:inline">/ {TITLES[route.view] ?? route.view}</span>
          <div className="ml-auto flex items-center gap-3">
            {graph?.problems.length ? (
              <a href={href('luecken')} className="text-xs text-ink-muted hover:text-ink">
                <Chip tone="warn">{graph.problems.length} Befunde</Chip>
              </a>
            ) : null}
            <button type="button" onClick={toggleTheme} className="text-xs text-ink-muted hover:text-ink">
              Hell / Dunkel
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] gap-8 px-4 py-6">
        <nav className="sticky top-20 hidden h-fit w-48 shrink-0 md:block">
          {NAV.map((group, i) => (
            <div key={group.group ?? `top-${i}`} className="mb-5">
              {group.group ? (
                <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  {group.group}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.view}>
                    <a
                      href={href(item.view)}
                      aria-current={active(item) ? 'page' : undefined}
                      className={`block rounded px-2 py-1.5 text-sm ${
                        active(item)
                          ? 'bg-brand-soft font-medium text-brand-ink'
                          : 'text-ink hover:bg-surface-sunken'
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {graph?.notes.length ? (
            <p className="mt-4 text-xs text-warn-ink" title={graph.notes.join('\n')}>
              {graph.notes.length} Ladehinweis(e)
            </p>
          ) : null}
          {revision > 0 ? <p className="mt-3 text-[0.65rem] text-ink-muted">Korpus neu gelesen ({revision})</p> : null}
        </nav>

        <main className="min-w-0 flex-1 pb-16">
          <div className="mb-4 flex flex-wrap gap-1 md:hidden">
            {flat.map((item) => (
              <a key={item.view} href={href(item.view)}>
                <Chip tone={active(item) ? 'brand' : 'neutral'}>{item.label}</Chip>
              </a>
            ))}
          </div>
          {body()}
        </main>
      </div>
    </div>
  );
}
