import { useEffect, useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';

type Kind = 'dialogue' | 'reading';
type Artifact = {
  kind: Kind; id: string; level: 'A1' | 'A2' | 'B1'; state: string; project_id: number | null;
  scenario?: string; title?: string; duration_seconds?: number | null; target_min?: number;
  target_max?: number; within_similarity_min?: number | null; cross_similarity_max?: number | null;
  ambience_rms_dbfs?: number | null; wer?: number | null; line_count?: number; speaker_count?: number;
  word_count?: number; paragraph_count?: number; reading_kind?: string; profile_id?: string;
  voiced_pace?: number | null; cue_coverage?: number; stale?: boolean; approved: boolean; published: boolean;
  worst_line_id?: string | null; worst_paragraph_index?: number | null;
};
type Issue = { severity: string; code: string; artifact: string; kind: Kind; value: number | null; project_id: number | null };
type Dashboard = { dialogues: Artifact[]; readings: Artifact[]; issues: Issue[]; summary: Record<string, number> };
type Character = {
  id: string; display_name: string; age_band: string; persona: string; registers: string[]; roles: string[];
  casting_tags: string[]; narration_capable: boolean; incompatible_with: string[]; status: string;
  portrait_path: string | null; selected_portrait_url: string | null; portrait_candidate_urls: string[]; usage_count: number; demo_urls: string[]; demo_phrases: string[]; voice_profile: { voice: string; seed: number; style: string; pace: number };
};
// Two origins, two schemas, never one. An import is somebody else's recording with a reviewed
// licence record; a generated sound is a prompt, a seed and a model revision. The discriminated
// union is what stops a component reading `title` off a row that has a prompt instead.
type ImportedSound = {
  origin: 'freesound';
  original_sha256: string; sound_id: number; title: string; uploader: string; license: string; duration_seconds: number;
  description: string; usage_count: number; peaks: number[]; editorial: {
    category: string; scene_tags: string[]; allowed_roles: string[]; default_gain_db: number;
    loop_quality: string; review_status: string; notes: string;
  };
};
type GeneratedSound = {
  origin: 'generated';
  asset_sha256: string; engine: string; model_id: string; model_revision: string;
  adapter_code_revision: string; license: string; prompt: string; negative_prompt: string | null;
  seed: number; duration_seconds: number; params: Record<string, unknown>; peaks: number[];
};
type Sound = ImportedSound | GeneratedSound;
const soundKey = (sound: Sound) => sound.origin === 'freesound' ? sound.original_sha256 : sound.asset_sha256;
type ContextSound = { source_sha256: string; sound_id: number; start_ms: number; duration_ms: number; delay_ms: number; gain_db: number; role: 'bed' | 'event'; editorial_reason?: string; placement_authoring: 'legacy' | 'ai-assisted' | 'human' };

const NAV = [
  ['overview', 'Обзор'], ['recordings', 'Записи'], ['readings', 'Lesetexte'],
  ['characters', 'Персонажи'], ['sounds', 'Звуки'], ['drafts', 'Agent drafts'], ['research', 'Research'],
] as const;

function useHash() {
  const [hash, setHash] = useState(() => location.hash.slice(2) || 'overview');
  useEffect(() => { const change = () => setHash(location.hash.slice(2) || 'overview'); addEventListener('hashchange', change); return () => removeEventListener('hashchange', change); }, []);
  return hash;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let live = true; getJson<T>(url).then((value) => live && setData(value)).catch((reason: unknown) => live && setError(String(reason))); return () => { live = false; }; }, [url]);
  return { data, error };
}

function EChart({ option, onPoint, label }: { option: EChartsOption; onPoint?: (value: unknown) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    let live = true; let dispose = () => {};
    void import('./charts').then(({ initChart }) => {
      if (!live || !ref.current) return;
      const chart = initChart(ref.current, undefined, { renderer: 'svg' });
      chart.setOption(option);
      if (onPoint) chart.on('click', (event) => onPoint(event.data));
      const resize = () => chart.resize(); addEventListener('resize', resize);
      dispose = () => { removeEventListener('resize', resize); chart.dispose(); };
    });
    return () => { live = false; dispose(); };
  }, [option, onPoint]);
  return <div ref={ref} className="chart" role="img" aria-label={label} />;
}

function Status({ value }: { value: string }) {
  const tone = value.includes('approved') || value === 'human_approved' || value === 'exported' ? 'good' : value.includes('fail') || value.includes('stale') ? 'bad' : 'work';
  return <span className={`status ${tone}`}>{value.replaceAll('_', ' ')}</span>;
}

function AppShell({ page, children }: { page: string; children: React.ReactNode }) {
  return <div className="shell">
    <aside>
      <a className="brand" href="#/overview"><span className="brand-mark">DA</span><span>Listening Studio<small>Editorial audio workspace</small></span></a>
      <nav>{NAV.map(([id, label]) => <a key={id} className={page === id ? 'active' : ''} href={`#/${id}`}><span>{label}</span></a>)}</nav>
      <div className="aside-note"><strong>Local only</strong><span>Аудио и research artifacts не загружаются наружу.</span></div>
    </aside>
    <main>{children}</main>
  </div>;
}

function Header({ title, eyebrow, actions }: { title: string; eyebrow: string; actions?: React.ReactNode }) {
  return <header className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>{actions}</header>;
}

function Filters({ level, setLevel, search, setSearch }: { level: string; setLevel: (value: string) => void; search: string; setSearch: (value: string) => void }) {
  return <div className="toolbar"><div className="segmented">{['Alle', 'A1', 'A2', 'B1'].map((value) => <button key={value} className={level === value ? 'selected' : ''} onClick={() => setLevel(value)}>{value}</button>)}</div><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по корпусу" /></label></div>;
}

function ArtifactLink({ row, children }: { row: Artifact; children?: React.ReactNode }) {
  if (!row.project_id) return <span>{children ?? row.id}</span>;
  return <a href={`#/project/${row.kind}/${row.project_id}`}>{children ?? row.id}</a>;
}

export function artifactQaDeepLink(point: { project?: number; kind?: string; focus?: string | number | null }): string | null {
  if (!point.project || !point.kind) return null;
  return `#/project/${point.kind}/${point.project}?tab=QA${point.focus == null ? '' : `&focus=${point.focus}`}`;
}

function Overview({ dashboard }: { dashboard: Dashboard }) {
  const [level, setLevel] = useState('Alle'); const [search, setSearch] = useState('');
  const dialogues = dashboard.dialogues.filter((row) => (level === 'Alle' || row.level === level) && `${row.id} ${row.scenario}`.toLowerCase().includes(search.toLowerCase()));
  const readings = dashboard.readings.filter((row) => (level === 'Alle' || row.level === level) && `${row.id} ${row.title}`.toLowerCase().includes(search.toLowerCase()));
  const levels = ['A1', 'A2', 'B1'];
  const pipeline = useMemo<EChartsOption>(() => ({
    animationDuration: 250, tooltip: { trigger: 'axis' }, legend: { top: 0, textStyle: { color: '#81786f' } }, grid: { left: 36, right: 12, top: 38, bottom: 24 },
    xAxis: { type: 'category', data: levels, axisTick: { show: false } }, yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#e7e1d8' } } },
    series: [
      { name: 'Диалоги', type: 'bar', stack: 'all', data: levels.map((name) => dialogues.filter((row) => row.level === name).length), itemStyle: { color: '#315f72', borderRadius: [3, 3, 0, 0] } },
      { name: 'Lesetexte', type: 'bar', stack: 'all', data: levels.map((name) => readings.filter((row) => row.level === name).length), itemStyle: { color: '#c88a3d', borderRadius: [3, 3, 0, 0] } },
    ],
  }), [dialogues, readings]);
  const identity = useMemo<EChartsOption>(() => ({
    tooltip: { formatter: (params: unknown) => { const p = params as { data: { value: [number, number, number]; name: string } }; return `${p.data.name}<br/>identity ${p.data.value[0].toFixed(3)}<br/>separation ${p.data.value[1].toFixed(3)}`; } },
    grid: { left: 48, right: 16, top: 18, bottom: 40 }, xAxis: { name: 'identity →', min: 0.75, max: 1 }, yAxis: { name: 'cross similarity →', min: 0.35, max: 1 },
    series: [{ type: 'scatter', symbolSize: (value: number[]) => 8 + Math.min(18, (value[2] || 20) / 4), data: dialogues.filter((row) => row.within_similarity_min != null && row.cross_similarity_max != null).map((row) => ({ name: row.id, project: row.project_id, kind: row.kind, focus: row.worst_line_id, value: [row.within_similarity_min, row.cross_similarity_max, row.duration_seconds ?? 20], itemStyle: { color: row.level === 'A1' ? '#437d88' : row.level === 'A2' ? '#c88a3d' : '#8f5e72' } })) }],
  }), [dialogues]);
  const readingPlot = useMemo<EChartsOption>(() => ({
    tooltip: { formatter: (params: unknown) => { const p = params as { data: { value: [number, number, number]; name: string } }; return `${p.data.name}<br/>pace ${p.data.value[0] || '—'}<br/>WER ${p.data.value[1] || '—'}`; } },
    grid: { left: 48, right: 16, top: 18, bottom: 40 }, xAxis: { name: 'voiced pace →', min: 1.5, max: 4 }, yAxis: { name: 'WER →', min: 0, max: 0.2 },
    series: [{ type: 'scatter', symbolSize: (value: number[]) => 7 + Math.sqrt(value[2] || 80), data: readings.filter((row) => row.voiced_pace != null && row.wer != null).map((row) => ({ name: row.id, project: row.project_id, kind: row.kind, focus: row.worst_paragraph_index, value: [row.voiced_pace, row.wer, row.word_count], itemStyle: { color: '#c88a3d' } })) }],
  }), [readings]);
  const styleDistribution = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'item' }, legend: { orient: 'vertical', right: 4, top: 'middle', textStyle: { fontSize: 9, color: '#81786f' } },
    series: [{ type: 'pie', radius: ['48%', '72%'], center: ['34%', '52%'], label: { show: false }, data: [...new Set(readings.map((row) => row.profile_id).filter((profile): profile is string => Boolean(profile)))].map((profile) => ({ name: profile, value: readings.filter((row) => row.profile_id === profile).length })) }],
  }), [readings]);
  const durationDistribution = useMemo<EChartsOption>(() => {
    const buckets = [[0, 30], [30, 45], [45, 60], [60, 90], [90, Number.POSITIVE_INFINITY]] as const;
    return { tooltip: { trigger: 'axis' }, legend: { top: 0, textStyle: { fontSize: 9 } }, grid: { left: 34, right: 8, top: 34, bottom: 25 }, xAxis: { type: 'category', data: ['<30', '30–45', '45–60', '60–90', '90+'] }, yAxis: { type: 'value', minInterval: 1 }, series: [{ name: 'Диалоги', type: 'bar', data: buckets.map(([min, max]) => dialogues.filter((row) => (row.duration_seconds ?? -1) >= min && (row.duration_seconds ?? -1) < max).length), itemStyle: { color: '#315f72' } }, { name: 'Чтения', type: 'bar', data: buckets.map(([min, max]) => readings.filter((row) => (row.duration_seconds ?? -1) >= min && (row.duration_seconds ?? -1) < max).length), itemStyle: { color: '#c88a3d' } }] };
  }, [dialogues, readings]);
  const go = (point: unknown) => { const target = artifactQaDeepLink(point as { project?: number; kind?: string; focus?: string | number | null }); if (target) location.hash = target.slice(1); };
  return <>
    <Header eyebrow="Deutsch-Atlas Audiokorpus" title="Редакторский обзор" actions={<a className="primary" href="#/drafts">Agent draft</a>} />
    <Filters level={level} setLevel={setLevel} search={search} setSearch={setSearch} />
    <section className="status-strip">
      <div><strong>{dashboard.summary.dialogues_approved}/{dashboard.summary.dialogues}</strong><span>диалогов утверждено</span></div>
      <div><strong>{dashboard.summary.readings_approved}/{dashboard.summary.readings}</strong><span>Lesetexte озвучено</span></div>
      <div><strong>{dashboard.summary.paragraphs}</strong><span>абзацев в очереди</span></div>
      <div><strong>{dashboard.summary.characters}</strong><span>персонажей</span></div>
      <div><strong>{dashboard.summary.sounds}</strong><span>естественных звуков</span></div>
    </section>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-head"><div><span>Корпус</span><h2>Распределение по уровню</h2></div><small>{dialogues.length + readings.length} артефактов</small></div><EChart option={pipeline} label="Распределение диалогов и текстов по уровню" /></section>
      <section className="panel issue-panel"><div className="panel-head"><div><span>Триаж</span><h2>Требует внимания</h2></div><a href="#/recordings">Вся очередь</a></div><div className="issue-list">{dashboard.issues.slice(0, 8).map((issue, index) => <a key={`${issue.artifact}-${issue.code}-${index}`} href={issue.project_id ? `#/project/${issue.kind}/${issue.project_id}` : issue.kind === 'reading' ? '#/readings' : '#/recordings'}><span className={`issue-dot ${issue.severity}`} /><span><strong>{issue.artifact}</strong><small>{issue.code}{issue.value == null ? '' : ` · ${issue.value.toFixed(3)}`}</small></span><b>›</b></a>)}</div></section>
      <section className="panel chart-panel wide"><div className="panel-head"><div><span>Голоса диалогов</span><h2>Идентичность и разделение</h2></div><small>клик открывает артефакт</small></div><EChart option={identity} onPoint={go} label="Идентичность голосов внутри и между персонажами" /></section>
      <section className="panel chart-panel"><div className="panel-head"><div><span>Озвучка чтения</span><h2>Pace и intelligibility</h2></div><small>{readings.filter((row) => row.voiced_pace != null).length}/{readings.length} измерено</small></div><EChart option={readingPlot} onPoint={go} label="Темп и WER текстов для чтения" /></section>
      <section className="panel chart-panel"><div className="panel-head"><div><span>Narration</span><h2>Профили чтения</h2></div><small>выбранный стиль на текст</small></div><EChart option={styleDistribution} label="Распределение narration profiles" /></section>
      <section className="panel chart-panel"><div className="panel-head"><div><span>Хронометраж</span><h2>Распределение длительности</h2></div><small>секунды</small></div><EChart option={durationDistribution} label="Распределение длительности аудио" /></section>
    </div>
  </>;
}

const columnHelper = createColumnHelper<Artifact>();
const columns = [
  columnHelper.accessor('id', { header: 'Артефакт', cell: (info) => <ArtifactLink row={info.row.original}><strong>{info.getValue()}</strong></ArtifactLink> }),
  columnHelper.accessor('level', { header: 'Уровень' }),
  columnHelper.accessor('kind', { header: 'Тип' }),
  columnHelper.accessor('state', { header: 'Состояние', cell: (info) => <Status value={info.getValue()} /> }),
  columnHelper.accessor((row) => row.duration_seconds ?? null, { id: 'duration', header: 'Длительность', cell: (info) => info.getValue() == null ? '—' : `${Number(info.getValue()).toFixed(0)} s` }),
  columnHelper.accessor((row) => row.kind === 'dialogue' ? row.within_similarity_min : row.voiced_pace, { id: 'identity', header: 'Identity / pace', cell: (info) => info.getValue() == null ? '—' : Number(info.getValue()).toFixed(3) }),
  columnHelper.accessor((row) => row.wer, { id: 'wer', header: 'WER', cell: (info) => info.getValue() == null ? '—' : `${(Number(info.getValue()) * 100).toFixed(1)}%` }),
  columnHelper.accessor('published', { header: 'Курс', cell: (info) => info.getValue() ? 'Да' : '—' }),
];

function ArtifactTable({ rows }: { rows: Artifact[] }) {
  const [sorting, setSorting] = useState<SortingState>([]); const [filter, setFilter] = useState('');
  const [level, setLevel] = useState('all'); const [kind, setKind] = useState('all'); const [stage, setStage] = useState('all');
  const [profile, setProfile] = useState('all'); const [duration, setDuration] = useState('all'); const [publication, setPublication] = useState('all');
  const stages = [...new Set(rows.map((row) => row.state))].sort(); const profiles = [...new Set(rows.map((row) => row.profile_id).filter((value): value is string => Boolean(value)))].sort();
  const filtered = rows.filter((row) => {
    if (level !== 'all' && row.level !== level) return false;
    if (kind !== 'all' && row.kind !== kind) return false;
    if (stage !== 'all' && row.state !== stage) return false;
    if (profile !== 'all' && row.profile_id !== profile) return false;
    const seconds = row.duration_seconds;
    if (duration === 'short' && (seconds == null || seconds >= 45)) return false;
    if (duration === 'medium' && (seconds == null || seconds < 45 || seconds >= 75)) return false;
    if (duration === 'long' && (seconds == null || seconds < 75)) return false;
    if (publication === 'approved' && !row.approved) return false;
    if (publication === 'unapproved' && row.approved) return false;
    if (publication === 'published' && !row.published) return false;
    if (publication === 'unpublished' && row.published) return false;
    if (publication === 'stale' && !row.stale) return false;
    return true;
  });
  const table = useReactTable({ data: filtered, columns, state: { sorting, globalFilter: filter }, onSortingChange: setSorting, onGlobalFilterChange: setFilter, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel() });
  return <section className="panel table-panel"><div className="table-tools table-filters"><label className="search"><span>⌕</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Фильтр таблицы" /></label><select aria-label="Уровень" value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">Все уровни</option><option>A1</option><option>A2</option><option>B1</option></select><select aria-label="Тип" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Все типы</option><option value="dialogue">Диалоги</option><option value="reading">Lesetexte</option></select><select aria-label="Stage" value={stage} onChange={(event) => setStage(event.target.value)}><option value="all">Все stages</option>{stages.map((value) => <option key={value}>{value}</option>)}</select>{profiles.length > 0 && <select aria-label="Narration profile" value={profile} onChange={(event) => setProfile(event.target.value)}><option value="all">Все profiles</option>{profiles.map((value) => <option key={value}>{value}</option>)}</select>}<select aria-label="Длительность" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="all">Любая длина</option><option value="short">до 45 s</option><option value="medium">45–75 s</option><option value="long">75+ s</option></select><select aria-label="Approval и публикация" value={publication} onChange={(event) => setPublication(event.target.value)}><option value="all">Любой статус</option><option value="approved">Утверждено</option><option value="unapproved">Не утверждено</option><option value="published">В курсе</option><option value="unpublished">Не в курсе</option><option value="stale">Stale</option></select><span>{table.getRowModel().rows.length}/{rows.length}</span></div><div className="table-scroll"><table><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}><button onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}</button></th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div></section>;
}

function Recordings({ rows }: { rows: Artifact[] }) { return <><Header eyebrow="Production corpus" title="Диалоги" actions={<a className="primary" href="#/drafts">Новая сцена через агента</a>} /><ArtifactTable rows={rows} /></>; }

function Readings({ rows, refresh }: { rows: Artifact[]; refresh: () => void }) {
  const [busy, setBusy] = useState('');
  const seed = async (row: Artifact) => { setBusy(row.id); const response = await fetch(`/api/readings/${row.id}/seed`, { method: 'POST' }); setBusy(''); if (!response.ok) alert(await response.text()); else refresh(); };
  return <><Header eyebrow="59 Texte · 8 220 Wörter" title="Lesetexte" /><section className="reading-summary"><p>Высококачественная озвучка хранится отдельно от исходного текста. Один выбранный narration-профиль, paragraph cues и system TTS только как fallback.</p><div className="legend"><span><i className="swatch clear" />Besonders klar</span><span><i className="swatch neutral" />Neutral</span><span><i className="swatch warm" />Erzählerisch</span><span><i className="swatch formal" />Formell</span></div></section><section className="panel"><div className="compact-list">{rows.map((row) => <div className="reading-row" key={row.id}><span className={`profile-mark ${row.profile_id}`} /><div><strong>{row.title}</strong><small>{row.id} · {row.word_count} Wörter · {row.paragraph_count} Absätze</small></div><span>{row.level}</span><span>{row.reading_kind}</span><Status value={row.stale ? 'stale' : row.state} />{row.project_id ? <ArtifactLink row={row}>Открыть</ArtifactLink> : <button disabled={busy === row.id} onClick={() => void seed(row)}>{busy === row.id ? '…' : 'Создать draft'}</button>}</div>)}</div></section></>;
}

function PortraitChoices({ character }: { character: Character }) { const [reason, setReason] = useState(''); const choose = async (index: number) => { const editor = window.prompt('Имя редактора, который выбирает portrait'); if (!editor || reason.trim().length < 8) return; const response = await fetch(`/api/characters/${character.id}/portrait-selection`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ candidate_id: String.fromCharCode(65 + index), editor, reason: reason.trim() }) }); if (response.ok) location.reload(); }; return <><div className="portrait-variants">{character.portrait_candidate_urls.map((url, index) => <button onClick={() => void choose(index)} key={url} title={`Выбрать вариант ${String.fromCharCode(65 + index)}`}><img src={url} alt={`Portrait candidate ${String.fromCharCode(65 + index)}`} /></button>)}</div><input className="selection-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Причина выбора (минимум 8 знаков)" /></>; }

function Characters() {
  const { data, error } = useApi<{ characters: Character[] }>('/api/characters');
  if (error) return <ErrorState message={error} />; if (!data) return <Loading />;
  return <><Header eyebrow="Versioned production roster" title="12 постоянных персонажей" /><section className="character-grid">{data.characters.map((character) => <article className="character" key={character.id}><div className="portrait">{character.selected_portrait_url ? <img src={character.selected_portrait_url} alt={character.display_name} /> : character.portrait_path ? <img src={character.portrait_path} alt="" /> : character.portrait_candidate_urls[2] ? <img src={character.portrait_candidate_urls[2]} alt={`Draft portrait candidate for ${character.display_name}`} /> : <span>{character.display_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>}<small>{character.age_band} · {character.selected_portrait_url ? 'selected' : 'draft C'}</small></div><div className="character-body"><div className="character-title"><h2>{character.display_name}</h2><Status value={character.status} /></div><p>{character.persona}</p><PortraitChoices character={character} /><dl><div><dt>Voice</dt><dd>{character.voice_profile.voice} · seed {character.voice_profile.seed}</dd></div><div><dt>Роли</dt><dd>{character.roles.join(', ')}</dd></div><div><dt>Использование</dt><dd>{character.usage_count} сцен</dd></div></dl><div className="demo-row">{character.demo_phrases.map((phrase, index) => character.demo_urls[index] ? <audio key={phrase} controls preload="none" src={character.demo_urls[index]} aria-label={phrase} /> : <span key={phrase} title={phrase}>Demo {index + 1} pending</span>)}</div>{character.narration_capable && <span className="narrator">Narration profile</span>}{character.incompatible_with.length > 0 && <small>Не совмещать: {character.incompatible_with.join(', ')}</small>}</div></article>)}</section></>;
}

function Waveform({ peaks }: { peaks: number[] }) { return <svg className="wave" viewBox={`0 0 ${Math.max(1, peaks.length)} 24`} preserveAspectRatio="none" aria-hidden="true">{peaks.map((peak, index) => <line key={index} x1={index} x2={index} y1={12 - peak * 10} y2={12 + peak * 10} />)}</svg>; }
function Sounds() {
  const { data, error } = useApi<Sound[]>('/api/sounds');
  const audio = useRef<HTMLAudioElement>(null); const [playing, setPlaying] = useState(''); const [search, setSearch] = useState(''); const [category, setCategory] = useState('all');
  if (error) return <ErrorState message={error} />; if (!data) return <Loading />;
  // `all` and `generated` are the two pseudo-categories: an editorial category is a reviewer's
  // judgement about an import, and a generated sound has no reviewer to have made one.
  const categories = [...new Set(data.flatMap((sound) => sound.origin === 'freesound' ? [sound.editorial.category] : []))].sort();
  const haystack = (sound: Sound) => sound.origin === 'freesound' ? `${sound.title} ${sound.description} ${sound.editorial.scene_tags.join(' ')}` : `${sound.prompt} ${sound.engine}`;
  const inCategory = (sound: Sound) => category === 'all' || (category === 'generated' ? sound.origin === 'generated' : sound.origin === 'freesound' && sound.editorial.category === category);
  const visible = data.filter((sound) => inCategory(sound) && haystack(sound).toLowerCase().includes(search.toLowerCase()));
  const play = (sound: Sound) => { if (!audio.current) return; audio.current.src = `/api/sounds/${soundKey(sound)}/audio`; void audio.current.play(); setPlaying(soundKey(sound)); };
  const imported = data.filter((sound) => sound.origin === 'freesound').length;
  return <><Header eyebrow={`${imported} imported · ${data.length - imported} generated`} title="Звуковая библиотека" /><div className="toolbar"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Все категории</option><option value="generated">Сгенерированные</option>{categories.map((value) => <option key={value}>{value}</option>)}</select><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название, промпт или scene tag" /></label></div><audio ref={audio} onEnded={() => setPlaying('')} /><section className="panel sound-list">{visible.map((sound) => <article className="sound-row" key={soundKey(sound)}><button className="play" onClick={() => play(sound)} aria-label={`Прослушать ${sound.origin === 'freesound' ? sound.title : sound.prompt}`}>{playing === soundKey(sound) ? '■' : '▶'}</button><div className="sound-main">{sound.origin === 'freesound'
    ? <div><strong>{sound.title}</strong><small>{sound.editorial.category} · {sound.duration_seconds.toFixed(1)} s · {sound.license} · {sound.usage_count} сцен</small></div>
    : <div><strong>{sound.prompt}</strong><small>{sound.engine} · seed {sound.seed} · {sound.duration_seconds.toFixed(1)} s · {sound.license}</small></div>}<Waveform peaks={sound.peaks} /></div><div className="sound-tags">{sound.origin === 'freesound'
    ? <>{sound.editorial.allowed_roles.map((tag) => <span key={tag}>{tag}</span>)}<Status value={sound.editorial.review_status} /></>
    : <span>generated</span>}</div></article>)}</section></>;
}

function Drafts({ rows }: { rows: Artifact[] }) { const drafts = rows.filter((row) => !row.approved); return <><Header eyebrow="Agent-first workflow" title="Черновики и редакторская очередь" /><div className="callout"><strong>Первую полную версию создаёт агент.</strong><p>Skill подбирает каст и окружение, синтезирует, запускает QA и останавливается до human approval. Здесь редактор слушает и исправляет результат.</p><code>Use $create-listening-scene to create …</code></div><ArtifactTable rows={drafts} /></>; }

function SoundscapeEditor({ projectId, revision, current }: { projectId: string; revision: number; current: ContextSound[] }) {
  const { data: sounds, error } = useApi<Sound[]>('/api/sounds'); const [selected, setSelected] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  if (error) return <ErrorState message={error} />;
  // Imports only: a `ContextSound` names an imported `sound_id`, and the soundscape endpoint
  // refuses anything else — offering a generated row here would be a control that cannot work.
  const importable = sounds?.filter((row): row is ImportedSound => row.origin === 'freesound');
  const source = importable?.find((row) => row.original_sha256 === selected);
  const assign = async () => { if (!source || !reason.trim()) return; setBusy(true); const role = source.editorial.allowed_roles[0] as 'bed' | 'event'; const next: ContextSound[] = [...current, { source_sha256: source.original_sha256, sound_id: source.sound_id, start_ms: 0, duration_ms: Math.min(120000, Math.max(1, Math.round(source.duration_seconds * 1000))), delay_ms: 0, gain_db: source.editorial.default_gain_db, role, editorial_reason: reason.trim(), placement_authoring: 'human' }]; const response = await fetch(`/api/projects/${projectId}/soundscape?revision_number=${revision}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }); if (!response.ok) { setBusy(false); throw new Error(await response.text()); } location.reload(); };
  return <div className="sound-picker"><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Источник окружения…</option>{importable?.map((sound) => <option value={sound.original_sha256} key={sound.original_sha256}>{sound.title} · {sound.editorial.allowed_roles.join('/')}</option>)}</select><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Почему звук нужен этой сцене" /><button disabled={!source || !reason.trim() || busy} onClick={() => void assign()}>Назначить</button></div>;
}

function Project({ route }: { route: string }) {
  const [path, query = ''] = route.split('?'); const [, kind, id] = path.split('/'); const params = new URLSearchParams(query); const focus = params.get('focus'); const { data, error } = useApi<Record<string, unknown>>(`/api/projects/${id}?kind=${kind}`);
  const [tab, setTab] = useState(params.get('tab') ?? (kind === 'reading' ? 'Narration' : 'Script'));
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  if (error) return <ErrorState message={error} />; if (!data) return <Loading />;
  const payload = data.payload as Record<string, unknown>;
  const tabs = kind === 'reading' ? ['Narration', 'Paragraphs', 'QA', 'Provenance', 'History'] : ['Script', 'Cast', 'Soundscape', 'QA', 'Provenance', 'History'];
  const lines = (payload.lines ?? []) as { id: string; speaker: string; display_text: string; delivery?: string; pace?: number }[];
  const paragraphs = (payload.paragraphs ?? []) as { index: number; display_text: string }[];
  let content: React.ReactNode;
  if (tab === 'Script') content = <div className="editor-list">{lines.map((line) => <div key={line.id}><strong>{line.speaker}</strong><p>{line.display_text}</p><small>{line.delivery || 'baseline delivery'} · pace {line.pace ?? 1}</small><audio controls preload="none" src={`/api/projects/${id}/lines/${line.id}/audio`} /></div>)}</div>;
  else if (tab === 'Cast') content = <div className="editor-list">{((payload.cast ?? []) as { speaker: string; character_id: string; character_version: number }[]).map((row) => <div key={row.speaker}><strong>{row.speaker}</strong><p>{row.character_id} · v{row.character_version}</p></div>)}</div>;
  else if (tab === 'Soundscape') { const current = (payload.context_sounds ?? []) as ContextSound[]; content = <><SoundscapeEditor projectId={id} revision={Number(data.revision)} current={current} /><div className="editor-list">{current.map((row) => <div key={`${row.source_sha256}-${row.role}-${row.delay_ms}`}><strong>{row.role} · {row.gain_db} dB</strong><p>{row.editorial_reason || 'legacy placement'}</p><audio controls preload="none" src={`/api/sounds/${row.source_sha256}/audio`} /></div>)}</div></>; }
  else if (tab === 'Narration') { const available = Object.keys(previewUrls).length ? previewUrls : (data.preview_urls ?? {}) as Record<string, string>; const profiles = (data.narration_profiles ?? []) as { id: string; allowed_kinds: string[] }[]; const selectProfile = async (profile: string) => { const response = await fetch(`/api/readings/${id}/profile?profile_id=${profile}&revision_number=${String(data.revision)}`, { method: 'PUT' }); if (response.ok) location.reload(); }; content = <><dl className="fact-grid"><div><dt>Profile</dt><dd>{String(payload.narration_profile_id)}</dd></div><div><dt>Narrator</dt><dd>{String(payload.character_id)}</dd></div><div><dt>Pace</dt><dd>{String(payload.pace)}</dd></div><div><dt>Paragraph gap</dt><dd>{String(payload.paragraph_pause_ms)} ms</dd></div></dl><div className="preview-bank"><button onClick={() => { void fetch(`/api/readings/${id}/previews?revision_number=${String(data.revision)}`, { method: 'POST' }).then((response) => response.json()).then((value: Record<string, string>) => setPreviewUrls(value)); }}>Синтезировать 4 profile previews</button>{Object.entries(available).map(([profile, url]) => <label key={profile}><span>{profile}</span><audio controls preload="none" src={url} /><button disabled={profile === payload.narration_profile_id || !profiles.find((row) => row.id === profile)?.allowed_kinds.includes(String(payload.kind))} onClick={() => void selectProfile(profile)}>Выбрать</button></label>)}</div></>; }
  else if (tab === 'Paragraphs') content = <div className="editor-list">{paragraphs.map((paragraph) => <div key={paragraph.index}><strong>Absatz {paragraph.index + 1}</strong><p>{paragraph.display_text}</p><audio controls preload="none" src={`/api/readings/${id}/paragraphs/${paragraph.index}/audio`} /></div>)}</div>;
  else if (tab === 'QA') content = <>{focus != null && <div className="focus-audio"><strong>Проблемный фрагмент: {kind === 'reading' ? `абзац ${Number(focus) + 1}` : focus}</strong><audio autoPlay controls src={kind === 'reading' ? `/api/readings/${id}/paragraphs/${focus}/audio` : `/api/projects/${id}/lines/${focus}/audio`} /></div>}<pre>{JSON.stringify(data.qa ?? 'QA ещё не запускался', null, 2)}</pre></>;
  else if (tab === 'History') content = <div className="editor-list">{((data.history ?? []) as { number: number; created_at: string; payload_sha256: string; has_qa: boolean; has_approval: boolean }[]).map((row) => <div key={row.number}><strong>Revision {row.number}</strong><p>{row.created_at}</p><small>{row.payload_sha256.slice(0, 16)}… · QA {row.has_qa ? 'yes' : 'no'} · approval {row.has_approval ? 'yes' : 'no'}</small></div>)}</div>;
  else content = <pre>{JSON.stringify({ source_sha256: payload.source_sha256, approval: data.approval, payload }, null, 2)}</pre>;
  return <><Header eyebrow={`${kind} · revision ${String(data.revision ?? '—')}`} title={String(data.slug ?? data.reading_id ?? 'Проект')} actions={kind === 'dialogue' ? <a className="primary" href={`/projects/${id}`}>Расширенный редактор</a> : <a className="primary" href={`/readings/${id}/approve`}>Прослушать и утвердить</a>} /><section className="project-layout"><div className="panel sticky-player"><span>Stage</span><Status value={String(data.stage)} />{kind === 'dialogue' ? <><audio controls src={`/projects/${id}/audio`} /><a href={`/projects/${id}/audio?take=dry`}>Dry take</a></> : <audio controls src={`/api/readings/${id}/audio`} />}</div><div className="panel detail"><div className="tabs">{tabs.map((name) => <button className={tab === name ? 'active' : ''} onClick={() => setTab(name)} key={name}>{name}</button>)}</div><h2>{String(payload.title_de ?? (payload.title as { en?: string } | undefined)?.en ?? '')}</h2>{content}</div></section></>;
}

function Research() { return <><Header eyebrow="Isolated local workspace" title="Research" /><div className="research-warning"><strong>Не production boundary</strong><p>Приватный human-reference clone хранится только в <code>.private/</code>. Он не появляется в casting API, не экспортируется и не может быть назначен учебной сцене.</p></div></>; }
function Loading() { return <div className="loading">Загрузка корпуса…</div>; }
function ErrorState({ message }: { message: string }) { return <div className="error"><strong>Не удалось загрузить Studio</strong><pre>{message}</pre></div>; }

export function App() {
  const route = useHash(); const page = route.split('/')[0] || 'overview'; const [nonce, setNonce] = useState(0);
  const { data, error } = useApi<Dashboard>(`/api/dashboard?v=${nonce}`);
  let body: React.ReactNode = <Loading />;
  if (error) body = <ErrorState message={error} />;
  else if (data) {
    if (route.startsWith('project/')) body = <Project key={route} route={route} />;
    else if (page === 'overview') body = <Overview dashboard={data} />;
    else if (page === 'recordings') body = <Recordings rows={data.dialogues} />;
    else if (page === 'readings') body = <Readings rows={data.readings} refresh={() => setNonce((value) => value + 1)} />;
    else if (page === 'characters') body = <Characters />;
    else if (page === 'sounds') body = <Sounds />;
    else if (page === 'drafts') body = <Drafts rows={[...data.dialogues, ...data.readings]} />;
    else body = <Research />;
  }
  return <AppShell page={page}>{body}</AppShell>;
}
