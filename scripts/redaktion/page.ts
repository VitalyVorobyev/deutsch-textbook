/**
 * The page shell: styles, the client-side router and filter, and the HTML frame.
 *
 * Still ONE self-contained file that opens from `file://` with zero network requests. That is not
 * incidental — it is why the console works on a plane, why it needs no server, and why it can be
 * gitignored and regenerated instead of maintained. Every view is rendered at generation time and
 * hidden/shown by the router below; nothing is fetched, nothing is bundled from a CDN.
 */
export const CSS = `
:root {
  color-scheme: light dark;
  --bg: #f7f7f5;
  --panel: #ffffff;
  --panel-2: #f1f1ee;
  --fg: #1b1b19;
  --muted: #6b6b65;
  --border: #d9d9d3;
  --accent: #2f5d8a;
  --ok-fg: #1c6b3f;
  --ok-bg: #e2f2e8;
  --ok-br: #8dc9a8;
  --warn-fg: #8a5a12;
  --warn-bg: #faf0dd;
  --warn-br: #dcb572;
  --miss-fg: #9a2b2b;
  --miss-bg: #fbeaea;
  --miss-br: #d99a9a;
  --info-fg: #2f5d8a;
  --info-bg: #e6eef6;
  --info-br: #9dbcd8;
  --code-bg: #eeeeea;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16171a;
    --panel: #1e2024;
    --panel-2: #24272c;
    --fg: #e6e6e2;
    --muted: #9a9a94;
    --border: #34373d;
    --accent: #8fb8e0;
    --ok-fg: #86d6a8;
    --ok-bg: #1c2f25;
    --ok-br: #34694b;
    --warn-fg: #e0b872;
    --warn-bg: #302819;
    --warn-br: #6b5424;
    --miss-fg: #e79a9a;
    --miss-bg: #2e1e1e;
    --miss-br: #7c3a3a;
    --info-fg: #9dc4e8;
    --info-bg: #1b262f;
    --info-br: #3a5670;
    --code-bg: #2a2d33;
  }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
}
code, .mono { font-family: var(--mono); font-size: 0.86em; background: var(--code-bg); padding: 0.08em 0.34em; border-radius: 3px; }
a { color: var(--accent); }
h2 { font-size: 1.5rem; margin: 0 0 0.4rem; letter-spacing: -0.01em; }
h3 { font-size: 1.15rem; margin: 1.6rem 0 0.5rem; letter-spacing: -0.01em; }
h4 { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin: 1.3rem 0 0.4rem; font-weight: 600; }
p { margin: 0.4rem 0; }
.muted { color: var(--muted); }

/* --- sidebar --- */
#side {
  position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
  background: var(--panel); border-right: 1px solid var(--border); padding: 1.1rem 0.9rem;
}
#side h1 { font-size: 1.05rem; margin: 0 0 0.15rem; letter-spacing: -0.01em; }
#side .sub { color: var(--muted); font-size: 0.78rem; margin-bottom: 0.9rem; }
#filter { width: 100%; padding: 0.45rem 0.55rem; border: 1px solid var(--border); border-radius: 6px;
  background: var(--panel-2); color: var(--fg); font: inherit; font-size: 0.86rem; }
#filter-count { font-size: 0.74rem; color: var(--muted); min-height: 1.1em; display: block; margin: 0.3rem 0 0.8rem; }
#nav a { display: block; padding: 0.34rem 0.5rem; border-radius: 5px; text-decoration: none; color: var(--fg); font-size: 0.9rem; }
#nav a:hover { background: var(--panel-2); }
#nav a.current { background: var(--info-bg); color: var(--info-fg); font-weight: 600; }
#nav .sublinks { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0 0.5rem 0.4rem 1.1rem; }
#nav .sublinks a { padding: 0.1rem 0.4rem; font-size: 0.78rem; background: var(--panel-2); }
#nav .group-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 1rem 0 0.25rem 0.5rem; }

/* --- main --- */
main { padding: 1.6rem 2rem 5rem; max-width: 1180px; min-width: 0; }
.lede { color: var(--muted); max-width: 78ch; }
.note { font-size: 0.82rem; color: var(--muted); background: var(--panel); border: 1px solid var(--border);
  border-radius: 7px; padding: 0.5rem 0.7rem; margin: 0.7rem 0; max-width: 90ch; }
.warnnote { border-color: var(--miss-br); color: var(--miss-fg); }
.doc { white-space: nowrap; }

/* --- overview cards --- */
.cards { display: grid; gap: 1rem; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.1rem; }
.card h3 { margin-top: 0; }
.kpis { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.9rem; }
.kpi { background: var(--panel-2); border-radius: 7px; padding: 0.4rem 0.65rem; min-width: 84px;
  text-decoration: none; color: inherit; display: block; }
a.kpi:hover { background: var(--info-bg); }
.kpi b { display: block; font-size: 1.12rem; letter-spacing: -0.02em; }
.kpi span { font-size: 0.72rem; color: var(--muted); }
.metric { border-top: 1px solid var(--border); padding-top: 0.7rem; margin-top: 0.7rem; }
.metric-head { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.9rem; }
.metric-head b { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.pcttag { font-size: 0.78rem; color: var(--muted); }
.metric-sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.25rem; }
.bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--panel-2); margin-top: 0.4rem; }
.bar-cards { background: var(--ok-br); }
.bar-grammar { background: var(--info-br); }
.bar-late { background: var(--warn-br); }
details summary { cursor: pointer; font-size: 0.82rem; color: var(--accent); margin-top: 0.5rem; }

/* --- chips --- */
.chip { display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.73rem; line-height: 1.5;
  padding: 0.06rem 0.42rem; border-radius: 999px; border: 1px solid transparent; white-space: nowrap; }
.chip.ok { background: var(--ok-bg); border-color: var(--ok-br); color: var(--ok-fg); }
.chip.info { background: var(--info-bg); border-color: var(--info-br); color: var(--info-fg); }
.chip.warn { background: var(--warn-bg); border-color: var(--warn-br); color: var(--warn-fg); }
.chip.miss { background: transparent; border-style: dashed; border-color: var(--miss-br); color: var(--miss-fg); }
.chip.none { background: transparent; border-style: dashed; border-color: var(--border); color: var(--muted); }
.badges { display: flex; flex-wrap: wrap; gap: 0.28rem; margin: 0.35rem 0; }
.tag { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
  border: 1px solid var(--border); border-radius: 4px; padding: 0 0.3rem; }
.tag.alt { color: var(--accent); border-color: var(--info-br); }
.tag.ok-tag { color: var(--ok-fg); border-color: var(--ok-br); }
.tag.warn-tag { color: var(--warn-fg); border-color: var(--warn-br); }
.tagcode { color: var(--accent); }
a.tagcode, a.tagref { text-decoration: none; font-family: var(--mono); font-size: 0.8rem;
  background: var(--code-bg); padding: 0.05em 0.34em; border-radius: 3px; }
a.tagcode:hover, a.tagref:hover { background: var(--info-bg); }
.dangling { color: var(--miss-fg); text-decoration: underline dotted; }
.status-covered, .status-ok { color: var(--ok-fg); }
.status-late { color: var(--warn-fg); }
.status-missing { color: var(--miss-fg); }
.status-none { color: var(--muted); }
.flag { font-size: 0.7rem; }
.flag.over { color: var(--miss-fg); }
.flag.at { color: var(--warn-fg); }

/* --- Sprachkarte --- */
table.karte { table-layout: fixed; }
table.karte th.karte-strand-head { width: 15rem; }
.karte-head { text-align: left; }
.karte-level { display: block; font-size: 1rem; color: var(--fg); letter-spacing: -0.01em; }
.karte-sub { display: block; font-size: 0.7rem; font-weight: 400; text-transform: none; letter-spacing: 0; }
.karte-strand { text-align: left; vertical-align: top; padding: 0.5rem 0.55rem; border-bottom: 1px solid var(--border);
  background: var(--panel-2); font-weight: 400; }
.karte-strand a { font-weight: 600; text-decoration: none; font-size: 0.92rem; }
.karte-count { font-size: 0.7rem; color: var(--muted); margin-left: 0.35rem; font-variant-numeric: tabular-nums; }
.karte-was { display: block; font-size: 0.72rem; color: var(--muted); margin-top: 0.15rem; text-transform: none; letter-spacing: 0; }
.karte-cell { vertical-align: top; padding: 0.35rem 0.4rem; }
.karte-cell.empty { background: repeating-linear-gradient(45deg, transparent, transparent 5px, var(--panel-2) 5px, var(--panel-2) 10px); }
.karte-chip { display: block; font-size: 0.72rem; font-family: var(--mono); text-decoration: none;
  border: 1px solid var(--border); border-radius: 5px; padding: 0.1rem 0.3rem; margin-bottom: 0.2rem;
  color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.karte-chip:hover { border-color: var(--accent); }
.karte-chip.st-covered { border-left: 3px solid var(--ok-br); }
.karte-chip.st-late { border-left: 3px solid var(--warn-br); background: var(--warn-bg); }
.karte-chip.st-missing { border-left: 3px solid var(--miss-br); background: var(--miss-bg); }
.karte-mark { display: inline-block; min-width: 1em; }
.karte-early { color: var(--info-fg); font-size: 0.68rem; margin-left: 0.2rem; }
.lvl-pair { display: inline-flex; gap: 0.2rem; align-items: baseline; white-space: nowrap; }
.ladder-child { padding-left: 1.1rem; border-left: 2px solid var(--info-br); }
table.strang td { font-variant-numeric: tabular-nums; }
table.strang td:nth-child(3) { min-width: 26ch; }

/* --- spine --- */
.level-block { margin-bottom: 1.6rem; }
.unit { background: var(--panel); border: 1px solid var(--border); border-radius: 9px; padding: 0.6rem 0.85rem; margin-bottom: 0.55rem; }
.unit h4 { margin: 0 0 0.35rem; font-size: 0.8rem; text-transform: none; letter-spacing: 0; color: var(--fg); }
.unit-n { display: inline-block; min-width: 1.5em; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
.row { padding: 0.45rem 0; border-top: 1px dashed var(--border); }
.unit .row:first-of-type { border-top: 0; }
.row-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.45rem; }
.row-title a { font-weight: 600; text-decoration: none; }
.row-title a:hover { text-decoration: underline; }
.row-id { color: var(--muted); }
.mix { display: flex; flex-wrap: wrap; gap: 0.7rem; font-size: 0.75rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.mix b { color: var(--fg); }
.mix .cap { opacity: 0.65; margin-left: 0.2rem; }

/* --- node cards --- */
.topic-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 1rem 1.2rem 1.3rem; margin-bottom: 1.1rem; scroll-margin-top: 1rem; }
.topic-card.flash { outline: 2px solid var(--accent); }
.topic-card h3 { margin-top: 0; }
.topic-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.82rem; }
.titles { margin: 0.4rem 0; }
.lang { font-size: 0.84rem; }
.lang b { display: inline-block; min-width: 1.7em; color: var(--muted); font-weight: 600; font-size: 0.74rem; text-transform: uppercase; }
.edges { display: grid; gap: 0.25rem; }
.edge { font-size: 0.84rem; display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: baseline; }
.edge-label { min-width: 15em; color: var(--muted); font-size: 0.76rem; }
.set { border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; margin-bottom: 0.4rem; background: var(--panel-2); }
.set-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.84rem; }
.set-body { margin-top: 0.3rem; display: grid; gap: 0.2rem; }
.role { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.05rem 0.35rem;
  border-radius: 4px; border: 1px solid var(--border); }
.role-practice { color: var(--ok-fg); border-color: var(--ok-br); }
.role-drill { color: var(--info-fg); border-color: var(--info-br); }
.role-pretest, .role-checkpoint, .role-placement, .role-probe, .role-exam-practice { color: var(--warn-fg); border-color: var(--warn-br); }
.hists { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
.hist-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); min-width: 4em; }
.hist { display: inline-flex; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.hist-k { padding: 0 0.3rem; }
.hist-v { padding: 0 0.3rem; background: var(--border); font-variant-numeric: tabular-nums; }
.path { display: inline-flex; align-items: baseline; gap: 0.3rem; font-size: 0.8rem; }
.gh { text-decoration: none; }
.sub { font-size: 0.76rem; color: var(--muted); margin: 0.6rem 0 0.3rem; }
.rownote { font-size: 0.79rem; color: var(--muted); border-left: 2px solid var(--border); padding-left: 0.5rem; margin-top: 0.3rem; }
.teacher { display: flex; align-items: center; gap: 0.28rem; flex-wrap: wrap; }
.teacher.mismatch { background: var(--warn-bg); border-radius: 4px; padding: 0 0.2rem; }

/* --- tables --- */
.scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); }
table { border-collapse: collapse; width: 100%; font-size: 0.84rem; }
thead th { position: sticky; top: 0; z-index: 1; background: var(--panel-2); text-align: left;
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted);
  padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--border); }
td { padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--border); vertical-align: top; }
tbody tr:last-child td { border-bottom: 0; }
table.compact td { padding: 0.22rem 0.5rem; font-size: 0.8rem; }
table.outcomes td:nth-child(4) { min-width: 30ch; }
table.inv td:nth-child(2) { min-width: 26ch; }

footer { margin-top: 2.5rem; padding-top: 0.8rem; border-top: 1px solid var(--border);
  font-size: 0.78rem; color: var(--muted); }

@media (max-width: 900px) {
  body { grid-template-columns: 1fr; }
  #side { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--border); }
  main { padding: 1.2rem 1rem 4rem; }
  .edge-label { min-width: 100%; }
  table.karte th.karte-strand-head { width: 9rem; }
}
@media print { #side { display: none; } .view { display: block !important; } }
`;

/**
 * The router. Two jobs, and the second is what makes this a navigator rather than four pages:
 * a bare `#view` shows that view, and ANY element id — `#struktur-dativ-verben`, `#fokus-wo-wohin`,
 * `#quellen-goethe-a1-sd1` — resolves to whichever view contains it, shows it, and scrolls there.
 * So every node is a permalink that survives reload, and every cross-link between views works
 * without either view knowing about the other.
 */
export const JS = `
(function () {
  var views = Array.prototype.slice.call(document.querySelectorAll('.view'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('#nav a[data-view]'));
  var flashed = null;

  function showView(id) {
    var found = false;
    views.forEach(function (v) {
      var on = v.id === 'view-' + id;
      v.hidden = !on;
      if (on) found = true;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('current', a.getAttribute('data-view') === id);
    });
    return found;
  }

  function route() {
    var hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (flashed) { flashed.classList.remove('flash'); flashed = null; }
    if (!hash) { showView('sprachkarte'); return; }
    if (document.getElementById('view-' + hash)) { showView(hash); window.scrollTo(0, 0); return; }
    var el = document.getElementById(hash);
    if (!el) { showView('sprachkarte'); return; }
    var view = el.closest('.view');
    if (view) showView(view.id.replace(/^view-/, ''));
    el.scrollIntoView();
    if (el.classList.contains('topic-card')) { el.classList.add('flash'); flashed = el; }
  }

  window.addEventListener('hashchange', route);

  var input = document.getElementById('filter');
  var count = document.getElementById('filter-count');
  var searchables = Array.prototype.slice.call(document.querySelectorAll('[data-search]'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-group]'));

  function applyFilter() {
    var q = input.value.trim().toLowerCase();
    var hits = 0;
    searchables.forEach(function (el) {
      var on = q === '' || el.getAttribute('data-search').indexOf(q) !== -1;
      el.hidden = !on;
      if (on) hits++;
    });
    groups.forEach(function (g) {
      var kids = g.querySelectorAll('[data-search]');
      if (!kids.length) { g.hidden = false; return; }
      var any = Array.prototype.some.call(kids, function (el) { return !el.hidden; });
      g.hidden = !any;
    });
    count.textContent = q === '' ? searchables.length + ' Einträge' : hits + ' von ' + searchables.length + ' Treffern';
  }

  input.addEventListener('input', applyFilter);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; applyFilter(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });

  applyFilter();
  route();
})();
`;
