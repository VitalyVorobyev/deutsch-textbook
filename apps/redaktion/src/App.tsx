/**
 * The shell: `@vitavision/workbench`'s `AppShell` (ADR 0011), with Redaktion's eight sections as a
 * `NavRail`, the history, search and theme in the header, and the workspace facts in the status
 * bar.
 *
 * THE NAVIGATION IS THE ARGUMENT. Eight sections, and two former routes live inside them rather
 * than beside them: the per-level instruments are the strip beneath the Sprachkarte, and the
 * vocabulary decks are one kind inside Materialien. A rail with an entry per report is a file
 * menu; it asks the reader to already know which report answers their question.
 *
 * **The page scrolls inside `main`, not the window.** `AppShell` fixes the frame to the viewport,
 * so the scroll container is `#redaktion-buehne`: `Zeilentabelle`'s `<thead>` sticks to its top
 * (`top-0`), and the router resets *its* scroll position on navigation.
 */
import { useState } from 'react';
import { Button, Input, ThemeToggle } from '@vitavision/ui';
import { AppShell, NavRail, NavRailItem, StatusBar } from '@vitavision/workbench';
import {
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  Inbox,
  Library,
  Map as MapIcon,
  Settings,
} from 'lucide-react';
import { Chip, Empty } from '@da/ui/primitives';
import { Hinweis } from './components/Hinweis';
import { useCorpus } from './data';
import {
  BUEHNE_ID,
  handleInternalLinkClick,
  href,
  navigateHref,
  useRoute,
  useRouteHistory,
  useScrollReset,
} from './router';
import { Themen } from './views/Themen';
import { Thema } from './views/Thema';
import { Bestand } from './views/Bestand';
import { Luecken } from './views/Luecken';
import { Fokus } from './views/Fokus';
import { Sprachkarte } from './views/Sprachkarte';
import { Struktur } from './views/Struktur';
import { Quellen } from './views/Quellen';
import { Uebersicht } from './views/Uebersicht';
import { Einstellungen } from './views/Einstellungen';
import { Quelle } from './views/Quelle';
import { Pruefen } from './views/Pruefen';

interface NavItem {
  view: string;
  label: string;
  icon: React.ReactNode;
  /** Views that render inside this entry — a detail page keeps its section lit. */
  also?: string[];
}

const NAV: NavItem[] = [
  { view: 'uebersicht', label: 'Übersicht', icon: <Gauge /> },
  {
    view: 'grammatik',
    label: 'Grammatik',
    icon: <MapIcon />,
    also: ['sprachkarte', 'struktur', 'fokus'],
  },
  { view: 'themen', label: 'Themen', icon: <BookOpen />, also: ['thema'] },
  { view: 'materialien', label: 'Materialien', icon: <Library />, also: ['bestand', 'quelle'] },
  { view: 'pruefen', label: 'Prüfen', icon: <Inbox /> },
  { view: 'qualitaet', label: 'Qualität', icon: <ClipboardCheck />, also: ['luecken'] },
  { view: 'referenzen', label: 'Referenzen', icon: <BookMarked />, also: ['quellen'] },
  { view: 'einstellungen', label: 'Einstellungen', icon: <Settings /> },
];

function HistoryButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'back' | 'forward';
  disabled: boolean;
  onClick: () => void;
}) {
  const back = direction === 'back';
  const label = back ? 'Zurück' : 'Vorwärts';
  return (
    <Hinweis inhalt={label} fokussierbar={false}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        icon={back ? <ChevronLeft /> : <ChevronRight />}
      />
    </Hinweis>
  );
}

export function App() {
  const { graph, workspace, error, revision } = useCorpus();
  const [route] = useRoute();
  const routeHistory = useRouteHistory();
  const [globalSearch, setGlobalSearch] = useState('');
  useScrollReset(`${route.view}/${route.id ?? ''}`);

  const body = () => {
    if (error) {
      return (
        <Empty>
          Der Korpus ließ sich nicht laden: {error}. Läuft der Entwicklungsserver (
          <code>bun run redaktion</code>)?
        </Empty>
      );
    }
    if (!graph && workspace && !workspace.root) return <Einstellungen workspace={workspace} />;
    if (!graph) return <Empty>Korpus wird gelesen …</Empty>;
    switch (route.view) {
      case 'themen':
        return <Themen graph={graph} />;
      case 'thema':
        return route.id ? <Thema graph={graph} id={route.id} /> : <Themen graph={graph} />;
      case 'bestand':
      case 'materialien':
        return <Bestand graph={graph} />;
      case 'luecken':
      case 'qualitaet':
        return <Luecken graph={graph} />;
      case 'fokus':
        return <Fokus graph={graph} id={route.id} />;
      case 'struktur':
        return <Struktur graph={graph} id={route.id} />;
      case 'quellen':
      case 'referenzen':
        return <Quellen graph={graph} />;
      case 'einstellungen':
        return <Einstellungen workspace={workspace} />;
      case 'pruefen':
        return <Pruefen graph={graph} />;
      case 'quelle':
        return <Quelle graph={graph} path={route.query.pfad} />;
      case 'grammatik':
      case 'sprachkarte':
        return <Sprachkarte graph={graph} />;
      case 'uebersicht':
        return <Uebersicht graph={graph} workspace={workspace} />;
      default:
        return <Uebersicht graph={graph} workspace={workspace} />;
    }
  };

  const active = NAV.find(
    (item) => route.view === item.view || (item.also ?? []).includes(route.view),
  )?.view;

  return (
    <div onClickCapture={handleInternalLinkClick}>
      <AppShell
        header={
          <div className="flex h-12 items-center gap-4 px-4">
            <a
              href={href('uebersicht')}
              className="shrink-0 text-base font-semibold tracking-tight text-fg"
            >
              Redaktion
              <span className="ml-2 text-xs font-normal uppercase tracking-[0.14em] text-fg-muted">
                Deutsch-Atlas
              </span>
            </a>
            <div className="flex shrink-0 items-center gap-0.5" aria-label="Navigationsverlauf">
              <HistoryButton
                direction="back"
                disabled={!routeHistory.canBack}
                onClick={routeHistory.back}
              />
              <HistoryButton
                direction="forward"
                disabled={!routeHistory.canForward}
                onClick={routeHistory.forward}
              />
            </div>
            <form
              className="mx-auto hidden w-full max-w-xl md:block"
              onSubmit={(event) => {
                event.preventDefault();
                if (globalSearch.trim())
                  navigateHref(href('materialien', undefined, { q: globalSearch.trim() }));
              }}
            >
              <label className="sr-only" htmlFor="globale-suche">
                Kurs durchsuchen
              </label>
              <Input
                id="globale-suche"
                type="search"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Themen, Materialien, Fokus-Tags suchen …"
              />
            </form>
            <div className="ml-auto flex items-center gap-3">
              {graph?.problems.length ? (
                <a href={href('luecken')}>
                  <Chip tone="brand">{graph.problems.length} offene Befunde</Chip>
                </a>
              ) : null}
              <ThemeToggle storageKey="redaktion-theme" />
            </div>
          </div>
        }
        railLabel="Bereiche"
        rail={
          <NavRail value={active ?? null}>
            {NAV.map((item) => (
              <NavRailItem
                key={item.view}
                value={item.view}
                label={item.label}
                icon={item.icon}
                className="w-24"
                asChild
              >
                <a href={href(item.view)} />
              </NavRailItem>
            ))}
          </NavRail>
        }
        main={
          <div id={BUEHNE_ID} className="h-full overflow-auto">
            <div className="mx-auto max-w-[1680px] px-4 pb-16 pt-6 lg:px-6">{body()}</div>
          </div>
        }
        bottom={
          <StatusBar
            aria-label="Arbeitsbereich"
            start={[{ label: 'Korpus', value: workspace?.root ?? graph?.root }]}
            end={[
              {
                label: 'Ladehinweise',
                value: graph?.notes.length ? (
                  <span className="text-defect" title={graph.notes.join('\n')}>
                    {graph.notes.length}
                  </span>
                ) : undefined,
              },
              { label: 'neu gelesen', value: revision > 0 ? revision : undefined },
            ]}
          />
        }
      />
    </div>
  );
}
