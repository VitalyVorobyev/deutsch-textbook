"""HTML rendering for the Listening Studio.

Split out of `web.py` on 2026-08-02, when the editor stopped being a `<textarea>` of payload
JSON. Editing a recording means choosing a voice, nudging the pace, fixing one word of German
and hearing it back — none of which is served by hand-editing a JSON blob, and all of which the
forms below expose directly. Nothing in the studio asks anyone to read JSON any more; QA results
and approvals render as tables too.

Rendering lives here rather than in the route handlers because the routes are already the
workflow state machine, and mixing two hundred lines of markup into that made both unreadable.
"""

from __future__ import annotations

from html import escape
from pathlib import Path

from .domain import (
    Question,
    RevisionPayload,
    SingleChoice,
    Stage,
    VoiceProfile,
    lock_voice_profiles,
)

CSS = """
:root{color-scheme:light dark;--ink:#292524;--muted:#78716c;--paper:#fffdf9;--line:#e7e1d8;--accent:#b45309;--accent-soft:#fff4df;--green:#166534;--red:#b91c1c}
*{box-sizing:border-box}
body{font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:1240px;margin:auto;padding:1.5rem 2rem 4rem;background:linear-gradient(180deg,#f3eee6 0,#faf8f4 18rem);color:var(--ink)}
header{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;padding:.7rem 0}
h1{font:700 1.25rem/1.2 ui-serif,Georgia,serif;letter-spacing:-.02em;margin:0}
h2,h3,h4{line-height:1.2;letter-spacing:-.015em}
a{color:#92400e;text-decoration:none}
a:hover{text-decoration:underline;text-underline-offset:3px}
nav a,.button-link{display:inline-flex;align-items:center;justify-content:center;min-height:2.35rem;padding:.45rem .85rem;border:1px solid #d6cec2;border-radius:999px;background:rgba(255,255,255,.72);color:#57534e;font-weight:650;box-shadow:0 1px 2px rgba(41,37,36,.05)}
nav a:hover,.button-link:hover{border-color:#c7904e;background:white;text-decoration:none}
label{display:block;margin:.6rem 0;font-size:.85rem;color:#57534e}
input,select,textarea{box-sizing:border-box;width:100%;padding:.5rem;border:1px solid #d6d3d1;border-radius:6px;background:white;font:inherit;color:inherit}
textarea{min-height:4.5rem}
button{padding:.62rem 1rem;border:0;border-radius:8px;background:#44403c;color:white;cursor:pointer;font:inherit;font-weight:650}
button.ghost{background:white;color:#44403c;border:1px solid #d6d3d1}
.card{background:rgba(255,253,249,.94);border:1px solid var(--line);border-radius:16px;padding:1.25rem;margin:1rem 0;box-shadow:0 8px 30px rgba(68,53,38,.06)}
.hero{padding:1.55rem 1.65rem;background:linear-gradient(135deg,#fffaf0,#fff 65%)}
.hero h2{font:700 1.75rem/1.1 ui-serif,Georgia,serif;margin:.1rem 0 .45rem}
.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.75rem;margin:1rem 0}
.metric{padding:1rem;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.72)}
.metric strong{display:block;font:700 1.65rem/1 ui-serif,Georgia,serif;margin-bottom:.35rem}
.metric span{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.055em}
.level-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:.9rem}
.level-head h3{font:700 1.4rem ui-serif,Georgia,serif;margin:0}
.project-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:.8rem}
.project-card{display:flex;flex-direction:column;min-height:12.5rem;padding:1rem;border:1px solid var(--line);border-radius:13px;background:#fff;transition:transform .15s,border-color .15s,box-shadow .15s}
.project-card:hover{transform:translateY(-2px);border-color:#d6b27e;box-shadow:0 9px 22px rgba(68,53,38,.08)}
.project-card h4{margin:.55rem 0 .3rem;font-size:1rem;overflow-wrap:anywhere}
.project-card .scenario{margin:0 0 auto;color:#57534e}
.project-meta{display:flex;flex-wrap:wrap;gap:.35rem .7rem;margin-top:.8rem;padding-top:.7rem;border-top:1px solid #eee9e2;color:var(--muted);font-size:.76rem}
.stage{font-weight:700;color:#9a3412}
.actions{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.muted{color:#78716c;font-size:.85rem}
.pass{color:#166534;font-weight:600}
.fail{color:#b91c1c;font-weight:600}
audio{width:100%;margin:.4rem 0}
summary{cursor:pointer;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th,td{text-align:left;padding:.45rem .5rem;border-bottom:1px solid #e7e5e4;vertical-align:top}
th{font-size:.75rem;text-transform:uppercase;letter-spacing:.03em;color:#78716c}
.grid{display:grid;gap:.75rem}
.line{border:1px solid #e7e5e4;border-radius:8px;padding:.8rem;margin:.6rem 0;background:#fafaf9}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:.5rem}
.chip{display:inline-block;width:max-content;border-radius:999px;padding:.18rem .62rem;font-size:.72rem;font-weight:700;letter-spacing:.01em}
.chip.todo{background:#f5f5f4;color:#78716c}
.chip.work{background:#fef3c7;color:#92400e}
.chip.ready{background:#dcfce7;color:#166534}
.chip.blocked{background:#fee2e2;color:#991b1b}
.chip.info{background:#e0f2fe;color:#075985}
.chip-row{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
.certify{margin:.4rem 0 1.1rem;padding-left:1.2rem}
.certify li{margin:.45rem 0;font-size:.95rem}
@media(prefers-color-scheme:dark){
 :root{--ink:#f5f5f4;--muted:#a8a29e;--paper:#211e1b;--line:#48413a}
 body{background:linear-gradient(180deg,#171412,#211d19 18rem);color:#e7e5e4}
 .card,.hero,.metric,.project-card,input,select,textarea{background:#292524;border-color:#44403c}
 .line{background:#1c1917;border-color:#44403c}
 .project-meta{border-color:#44403c}.project-card .scenario{color:#d6d3d1}
 th,td{border-color:#44403c}
 button.ghost{background:#292524;color:#e7e5e4}
 nav a,.button-link{background:#292524;border-color:#57534e;color:#e7e5e4}
 label,.muted,th{color:#a8a29e}
}
@media(max-width:640px){body{padding:1rem}.project-grid{grid-template-columns:1fr}.hero{padding:1.2rem}}
"""


def page(body: str, title: str = "Listening Studio") -> str:
    return (
        "<!doctype html><html lang=en><meta charset=utf-8>"
        f"<meta name=viewport content='width=device-width,initial-scale=1'><title>{escape(title)}</title>"
        f"<style>{CSS}</style><body><header><h1>Listening Studio</h1>"
        "<nav><a href='/'>Alle Aufnahmen</a></nav></header>" + body + "</body></html>"
    )


# --- index -----------------------------------------------------------------

#: Derived production state, in the order a recording passes through it.
STATE_CHIP = {
    "planned": ("todo", "geplant"),
    "seeded": ("todo", "Projekt angelegt"),
    "drafted": ("work", "Skript vorhanden"),
    "audio": ("work", "Audio erzeugt"),
    "qa_failed": ("blocked", "QA gescheitert"),
    "qa_passed": ("work", "QA bestanden"),
    "approved": ("ready", "freigegeben"),
    "published": ("ready", "veröffentlicht"),
}


def index_page(rows: list[dict[str, object]]) -> str:
    """Every planned recording and where it stands — the whole corpus on one screen.

    The old page listed twelve, selected by a database-id window, and there was nowhere at all
    to see the other twenty-nine. Production state is derived here rather than stored: a stage
    column that has to be kept in step with the filesystem drifts the first time anything is
    regenerated outside the UI.
    """

    def number(value: object | None) -> float | None:
        try:
            return float(str(value)) if value is not None else None
        except ValueError:
            return None

    qa_passed = sum(row["state"] in {"qa_passed", "approved", "published"} for row in rows)
    ambience = sum((number(row.get("bed_count")) or 0) > 0 for row in rows)
    approved = sum(row["state"] in {"approved", "published"} for row in rows)
    published = sum(bool(row.get("published_exists")) for row in rows)
    body = [
        "<section class='card hero'><span class=muted>Deutsch-Atlas Audiokorpus</span>"
        f"<h2>{len(rows)} Hördialoge, eine redaktionelle Pipeline</h2>"
        "<p class=muted>Stimmen, Verständlichkeit, Umgebung und Freigabe auf einen Blick — "
        "nach Stufe gruppiert, aus Projekten und QA abgeleitet.</p>"
        "<div class=metric-grid>"
        f"<div class=metric><strong>{qa_passed}/{len(rows)}</strong><span>QA bestanden</span></div>"
        f"<div class=metric><strong>{ambience}/{len(rows)}</strong><span>durchgehende Umgebung</span></div>"
        f"<div class=metric><strong>{approved}</strong><span>aktuelle Fassung freigegeben</span></div>"
        f"<div class=metric><strong>{published}</strong><span>Fassung im Kurs</span></div>"
        "</div></section>"
    ]
    by_level: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        by_level.setdefault(str(row["level"]), []).append(row)
    for level in sorted(by_level):
        level_rows = by_level[level]
        level_qa = sum(
            row["state"] in {"qa_passed", "approved", "published"} for row in level_rows
        )
        level_ambience = sum((number(row.get("bed_count")) or 0) > 0 for row in level_rows)
        durations = [value for row in level_rows if (value := number(row.get("duration_seconds")))]
        duration_label = f"{sum(durations) / len(durations):.0f} s" if durations else "—"
        within = [
            value
            for row in level_rows
            if (value := number(row.get("within_similarity_min"))) is not None
        ]
        cross = [
            value
            for row in level_rows
            if (value := number(row.get("cross_similarity_max"))) is not None
        ]
        within_label = f"{min(within):.3f}" if within else "—"
        cross_label = f"{max(cross):.3f}" if cross else "—"
        cells = []
        for row in level_rows:
            chip, label = STATE_CHIP[str(row["state"])]
            name = escape(str(row["id"]))
            link = (
                f"<a class=button-link href='/projects/{row['project_id']}'>Öffnen</a>"
                if row["project_id"]
                else "<span class=muted>Noch kein Projekt</span>"
            )
            duration = number(row.get("duration_seconds"))
            project_duration_label = f"{duration:.0f} s" if duration else "— s"
            environment = (
                f"Umgebung {row.get('bed_count', 0)} Bett · {row.get('event_count', 0)} Ereignis"
                if (number(row.get("context_count")) or 0) > 0
                else "keine Umgebung"
            )
            live = (
                "<span class='chip todo'>ältere Fassung im Kurs</span>"
                if row.get("published_exists") and row["state"] != "published"
                else ""
            )
            cells.append(
                "<article class=project-card>"
                f"<div class=chip-row><span class='chip {chip}'>{label}</span>{live}</div><h4>{name}</h4>"
                f"<p class=scenario>{escape(str(row['scenario']))}</p>"
                "<div class=project-meta>"
                f"<span>{row.get('speaker_count', 0)} Figuren</span>"
                f"<span>{row.get('line_count', 0)} Repliken</span>"
                f"<span>{project_duration_label}</span>"
                f"<span>{escape(environment)}</span><span>Welle {row['wave']}</span>"
                f"</div><div style='margin-top:.8rem'>{link}</div></article>"
            )
        body.append(
            "<section class=card><div class=level-head>"
            f"<div><span class=muted>Sprachniveau</span><h3>{escape(level)}</h3></div>"
            f"<span class=muted>{len(level_rows)} Dialoge</span></div>"
            "<div class=metric-grid>"
            f"<div class=metric><strong>{level_qa}/{len(level_rows)}</strong><span>QA</span></div>"
            f"<div class=metric><strong>{level_ambience}/{len(level_rows)}</strong><span>Umgebungsbett</span></div>"
            f"<div class=metric><strong>{duration_label}</strong><span>Ø Dauer</span></div>"
            f"<div class=metric><strong>{within_label}</strong><span>niedrigste Identität</span></div>"
            f"<div class=metric><strong>{cross_label}</strong><span>höchste Figurenähnlichkeit</span></div>"
            "</div>"
            f"<div class=project-grid>{''.join(cells)}</div></section>"
        )
    return page("".join(body))


# --- project editor --------------------------------------------------------


def _options(values: list[str], selected: str) -> str:
    return "".join(
        f"<option{' selected' if v == selected else ''}>{escape(v)}</option>" for v in values
    )


def script_form(project_id: int, payload: RevisionPayload, voices: list[str], adapters: list[str]) -> str:
    """Character identity once, turn delivery once per line."""

    locked = lock_voice_profiles(payload)
    profiles = []
    assert locked.voice_profiles is not None
    for index, profile in enumerate(locked.voice_profiles):
        profiles.append(
            "<div class=line><div class=row>"
            f"<label>Figur<input value='{escape(profile.speaker, quote=True)}' disabled></label>"
            f"<label>Stimme<select name='profile.{index}.voice'>"
            f"{_options(voices or [profile.voice], profile.voice)}</select></label>"
            f"<label>Identitäts-Seed<input value='{profile.seed}' disabled></label>"
            "</div>"
            f"<label>Grundsätzliche Sprechweise<input name='profile.{index}.style' "
            f"value='{escape(profile.style or '', quote=True)}' "
            "placeholder='z. B. Sprich freundlich, ruhig und deutlich.'></label>"
            f"<button class=ghost name=reroll value='{index}'>Neue Variante für diese Figur</button>"
            "</div>"
        )

    lines = []
    for index, line in enumerate(locked.lines):
        lines.append(
            f"<div class=line><div class=row>"
            f"<label>Sprecher<select name='line.{index}.speaker'>{_options(locked.speakers, line.speaker)}</select></label>"
            f"<label>Tempo<input name='line.{index}.pace' type=number step=0.01 min=0.7 max=1.15 value='{line.pace}'></label>"
            f"<label>Pause danach (ms)<input name='line.{index}.pause' type=number min=0 max=5000 value='{line.pause_after_ms}'></label>"
            "</div>"
            f"<label>Text<textarea name='line.{index}.text' required>{escape(line.display_text)}</textarea></label>"
            f"<label class=muted>Sprechweise nur für diese Replik (optional)"
            f"<input name='line.{index}.delivery' value='{escape(line.delivery or '', quote=True)}' "
            f"placeholder='z. B. Antworte erleichtert, aber nicht überschwänglich.'></label>"
            f"<label class=muted>Aussprache-Text (optional, nur für die Synthese)"
            f"<input name='line.{index}.synthesis' value='{escape(line.synthesis_text or '')}' placeholder='leer = wie oben'></label>"
            "</div>"
        )
    return (
        f"<div class=card><h3>Skript &amp; Stimmen</h3><form method=post action='/projects/{project_id}/script'>"
        "<p class=muted>Stimme, Grundstil und Seed gehören zur Figur. Eine neue Variante erzeugt "
        "später alle Repliken dieser Figur neu; einzelne Repliken bekommen keinen eigenen Seed.</p>"
        + "".join(profiles)
        + "<h4>Repliken</h4>"
        + "".join(lines)
        + "<div class=row>"
        f"<label>Synthese-Modell<select name=adapter>{_options(adapters, payload.tts_adapter)}</select></label>"
        f"<label>Max. Wiederholungen<input name=max_replays type=number min=1 max=10 value='{payload.max_replays}'></label>"
        "</div>"
        "<p class=muted>Speichern legt eine neue Revision an und setzt das Projekt zurück auf <em>draft</em>. "
        "Zwischengespeicherte Zeilen-Audios werden wiederverwendet, solange Text, Figurenprofil und Tempo gleich bleiben. "
        "Beim Wechsel des Synthese-Modells bekommt jede Sprecherin und jeder Sprecher automatisch eine Stimme des "
        "neuen Modells — danach hier pro Figur anpassen.</p>"
        "<button>Skript speichern</button></form></div>"
    )


def questions_form(project_id: int, payload: RevisionPayload) -> str:
    cards = []
    for index, question in enumerate(payload.questions):
        response = question.response
        if not isinstance(response, SingleChoice):
            cards.append(
                f"<div class=line><strong>{escape(question.id)}</strong>"
                f"<p class=fail>Alte Frageform «{escape(response.kind)}» — kein Aufgabentyp kann sie darstellen.</p>"
                "<p class=muted>Mit <code>atlas-listening normalize-questions</code> in eine "
                "Single-Choice-Frage umwandeln; der verfasste Text bleibt erhalten.</p></div>"
            )
            continue
        opts = "".join(
            f"<div class=row><label>Option {j + 1}<input name='q.{index}.opt.{j}' value='{escape(opt)}'></label>"
            f"<label>richtig<input type=radio name='q.{index}.correct' value='{j}'"
            f"{' checked' if j == response.correct else ''}></label></div>"
            for j, opt in enumerate(response.options)
        )
        cards.append(
            f"<div class=line><label>Frage<input name='q.{index}.prompt' value='{escape(response.prompt)}' required></label>"
            + opts
            + f"<label>Erklärung (EN)<input name='q.{index}.explain_en' value='{escape(question.explain.en)}'></label>"
            f"<label>Erklärung (RU)<input name='q.{index}.explain_ru' value='{escape(question.explain.ru)}'></label></div>"
        )
    return (
        f"<div class=card><h3>Fragen</h3><form method=post action='/projects/{project_id}/questions'>"
        + "".join(cards)
        + "<button>Fragen speichern</button></form></div>"
    )


def qa_card(qa: dict[str, object]) -> str:
    """QA as a table of what was said against what Whisper heard.

    This was a `<pre>` of the raw report. The only question it has to answer is *which line
    came out wrong and how*, and a JSON dump makes that the reader's job.
    """

    final = qa.get("final") if isinstance(qa.get("final"), dict) else qa
    assert isinstance(final, dict)
    lines = final.get("lines") or []
    rows = []
    for entry in lines if isinstance(lines, list) else []:
        if not isinstance(entry, dict):
            continue
        ok = entry.get("passed") is True
        missing = entry.get("missing_protected") or []
        rows.append(
            f"<tr><td>{escape(str(entry.get('line_id','')))}</td>"
            f"<td>{escape(str(entry.get('expected','')))}</td>"
            f"<td>{escape(str(entry.get('transcript','')))}</td>"
            f"<td>{float(entry.get('wer') or 0):.0%}</td>"
            f"<td class={'pass' if ok else 'fail'}>{'ok' if ok else 'Abweichung'}"
            + (f"<div class=muted>fehlt: {escape(', '.join(map(str, missing)))}</div>" if missing else "")
            + "</td></tr>"
        )
    passed = final.get("passed") is True
    verdict = (
        "<span class=pass>Automatische Prüfung bestanden</span>"
        if passed
        else "<span class=fail>Automatische Prüfung gescheitert</span>"
    )
    failures = final.get("failures") or []
    failure_html = (
        "<ul class=muted>" + "".join(f"<li>{escape(str(f))}</li>" for f in failures) + "</ul>"
        if isinstance(failures, list) and failures
        else ""
    )
    speaker = qa.get("speaker_consistency")
    speaker_html = ""
    if isinstance(speaker, dict) and isinstance(speaker.get("characters"), list):
        def shown_similarity(row: dict[str, object]) -> str:
            value = row.get("minimum_similarity")
            return "—" if value is None else f"{float(str(value)):.3f}"

        def shown_pitch(row: dict[str, object]) -> str:
            value = row.get("pitch_spread_hz")
            return "—" if value is None else f"{float(str(value)):.1f} Hz"

        character_rows = "".join(
            f"<tr><td>{escape(str(row.get('speaker', '')))}</td>"
            f"<td>{escape(str(row.get('measured_lines', 0)))}/{escape(str(row.get('line_count', 0)))}</td>"
            f"<td>{shown_similarity(row)}</td><td>{shown_pitch(row)}</td></tr>"
            for row in speaker["characters"]
            if isinstance(row, dict)
        )
        pair_rows = "".join(
            f"<tr><td>{escape(' / '.join(map(str, row.get('speakers', []))))}</td>"
            f"<td>{float(row.get('similarity') or 0):.3f}</td></tr>"
            for row in speaker.get("different_characters", [])
            if isinstance(row, dict)
        )
        warnings = speaker.get("warnings") or []
        warning_html = (
            "<ul class=muted>" + "".join(f"<li>{escape(str(w))}</li>" for w in warnings) + "</ul>"
            if isinstance(warnings, list) and warnings
            else ""
        )
        speaker_html = (
            "<h4>Stimmkonsistenz · Warninstrument, noch ohne Grenzwert</h4>"
            "<table><thead><tr><th>Figur</th><th>messbare Repliken</th><th>kleinste Ähnlichkeit</th><th>Tonhöhenspanne</th></tr></thead>"
            f"<tbody>{character_rows}</tbody></table>"
            + (
                "<table><thead><tr><th>Figurenpaar</th><th>Ähnlichkeit</th></tr></thead>"
                f"<tbody>{pair_rows}</tbody></table>"
                if pair_rows
                else ""
            )
            + warning_html
            + "<p class=muted>Niedrige Werte innerhalb einer Figur und hohe Werte zwischen Figuren "
            "verdienen Aufmerksamkeit. Bis zur Kalibrierung entscheidet ausschließlich die Anhörung.</p>"
        )
    soundscape = qa.get("soundscape")
    soundscape_html = ""
    if isinstance(soundscape, dict):
        rms = soundscape.get("measured_ambience_rms_dbfs")
        rms_label = "—" if rms is None else f"{float(rms):.1f} dBFS"
        soundscape_html = (
            "<h4>Umgebung</h4><div class=metric-grid>"
            f"<div class=metric><strong>{soundscape.get('bed_count', 0)}</strong><span>durchgehende Betten</span></div>"
            f"<div class=metric><strong>{soundscape.get('event_count', 0)}</strong><span>Ereignisse</span></div>"
            f"<div class=metric><strong>{float(soundscape.get('configured_coverage_ratio') or 0):.0%}</strong><span>konfigurierte Abdeckung</span></div>"
            f"<div class=metric><strong>{rms_label}</strong><span>gemessene Umgebung</span></div>"
            "</div><p class=muted>Das ist eine Mischungsdiagnose, kein Lautheitsurteil. "
            "Bei der Anhörung muss die Szene erkennbar bleiben, ohne eine Silbe zu verdecken.</p>"
        )
    return (
        f"<div class=card><h3>Automatische Prüfung</h3><p>{verdict} · Gesamt-WER "
        f"{float(final.get('full_wer') or 0):.1%}</p>{failure_html}"
        "<table><thead><tr><th>Zeile</th><th>Erwartet</th><th>Gehört</th><th>WER</th><th></th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
        "<p class=muted>Die automatische Prüfung findet Abweichungen im Wortlaut. Sie sagt nichts "
        "über Aussprache, Tempo oder Natürlichkeit — das entscheidet die Anhörung.</p>"
        f"{speaker_html}{soundscape_html}</div>"
    )


def approval_card(approval: dict[str, object]) -> str:
    checklist = approval.get("checklist") or []
    items = "".join(f"<li>{escape(str(c))}</li>" for c in checklist) if isinstance(checklist, list) else ""
    return (
        "<div class=card><h3>Freigabe</h3>"
        f"<p><strong>{escape(str(approval.get('editor','')))}</strong> · {escape(str(approval.get('reviewed_at','')))}</p>"
        f"<ul class=muted>{items}</ul>"
        f"<p class=muted>Gebunden an genau diese Audiodatei: <code>{escape(str(approval.get('audio_sha256',''))[:16])}…</code></p></div>"
    )


#: What the editor certifies, key → the sentence they are certifying.
#:
#: The keys are written into the published provenance manifest (`approval.checklist`), so they
#: are fixed and must never be renamed; only the wording beside them moves. Until 2026-08-02 the
#: form showed the bare keys — six English words, no audio, no questions, no QA — and asked a
#: named human to vouch for all of them. A checklist that shows nothing it asks about is a
#: rubber stamp, and `docs/product-protection.md` exists to make this signature mean something.
APPROVAL_CHECKS: dict[str, str] = {
    "accent": (
        "Die Aussprache ist verständliches Standarddeutsch. Kein Wort ist so verfärbt, "
        "dass ein Lernender es falsch abspeichern würde."
    ),
    "naturalness": "Es klingt nach einer sprechenden Person, nicht nach einer vorlesenden Maschine.",
    "intelligibility": (
        "Auf {level} ist jedes Wort heraushörbar — beim Hören, ohne Mitlesen im Skript."
    ),
    "identity": (
        "Jede Figur bleibt über alle Repliken dieselbe erkennbare Person — Alter, Stimmfarbe "
        "und Grundenergie springen nicht mitten im Gespräch."
    ),
    "speakers": "Die verschiedenen Figuren sind durchgehend voneinander unterscheidbar.",
    "pace": "Das Tempo passt zu {level}: nicht gehetzt, aber auch nicht künstlich gedehnt.",
    "questions": (
        "Jede Frage ist allein aus dem Gehörten beantwortbar, und die markierte Antwort "
        "ist die einzige richtige."
    ),
    "context": "Die Hintergrundgeräusche sind hörbar, überdecken aber keine Silbe.",
}


def transcript_card(payload: RevisionPayload) -> str:
    """The script, collapsed.

    Deliberately not open: reading along makes a listener hear words that were never said, which
    is precisely what the `intelligibility` check is supposed to catch. Listen first.
    """

    rows = "".join(
        f"<tr><td>{escape(line.speaker)}</td>"
        f"<td class=muted>{escape(payload.resolved_line(line).voice or '—')}</td>"
        f"<td class=muted>{escape(payload.resolved_line(line).style or '—')}</td>"
        f"<td>{escape(line.display_text)}</td></tr>"
        for line in payload.lines
    )
    return (
        "<div class=card><details><summary>Skript einblenden</summary>"
        "<p class=muted>Erst hören, dann aufklappen — beim Mitlesen hört man Wörter, "
        "die nicht gesprochen wurden.</p>"
        "<table><thead><tr><th>Sprecher</th><th>Stimme</th><th>Sprechweise</th><th>Text</th></tr>"
        f"</thead><tbody>{rows}</tbody></table></details></div>"
    )


def question_review_card(payload: RevisionPayload) -> str:
    """The questions as the learner meets them, with the key marked.

    The `questions` check asks whether each one is answerable from the audio alone and whether
    the marked answer is right. Both of those are unanswerable without seeing the options — and
    every one of Wave 1's drafted questions was template residue that no gate could see.
    """

    blocks = []
    for question in payload.questions:
        response = question.response
        if not isinstance(response, SingleChoice):
            blocks.append(
                f"<div class=line><p class=fail>«{escape(response.kind)}» — alte Frageform, "
                "kein Aufgabentyp kann sie darstellen.</p></div>"
            )
            continue
        options = "".join(
            f"<li{' class=pass' if index == response.correct else ''}>{escape(option)}"
            + (" ✓" if index == response.correct else "")
            + "</li>"
            for index, option in enumerate(response.options)
        )
        blocks.append(
            f"<div class=line><p><strong>{escape(response.prompt)}</strong></p>"
            f"<ol>{options}</ol>"
            f"<p class=muted>{escape(question.explain.en)}<br>{escape(question.explain.ru)}</p></div>"
        )
    return "<div class=card><h3>Fragen</h3>" + "".join(blocks) + "</div>"


def soundscape_card(payload: RevisionPayload) -> str:
    """Show what creates the scene and why each placement exists."""

    if not payload.context_sounds:
        return (
            "<div class=card><h3>Umgebung</h3>"
            "<p class=fail>Kein Umgebungsbett konfiguriert.</p></div>"
        )
    sounds = []
    for sound in payload.context_sounds:
        role = "Umgebungsbett" if sound.role == "bed" else "Ereignis"
        authoring = {
            "human": "menschlich platziert",
            "ai-assisted": "KI-unterstützt platziert",
            "legacy": "ältere Platzierung",
        }[sound.placement_authoring]
        reason = sound.editorial_reason or "Keine redaktionelle Begründung aus der Altversion."
        sounds.append(
            "<article class=project-card>"
            f"<span class='chip info'>{role}</span><h4>Quelle {sound.sound_id}</h4>"
            f"<p>{escape(reason)}</p><div class=project-meta>"
            f"<span>{sound.gain_db:g} dB</span><span>{authoring}</span>"
            f"<span>Start {sound.start_ms / 1000:g} s</span></div></article>"
        )
    return (
        "<div class=card><h3>Umgebung</h3>"
        "<p class=muted>Betten laufen bis zum Dialogende; Ereignisse bleiben einmalig. "
        "Die Begründung beschreibt eine Platzierungsentscheidung, keine menschliche Freigabe.</p>"
        f"<div class=project-grid>{''.join(sounds)}</div></div>"
    )


def approval_page(
    *,
    project_id: int,
    slug: str,
    payload: RevisionPayload,
    qa: dict[str, object],
    has_dry: bool,
    duration: float | None,
    target: tuple[float, float] | None,
    editor: str | None,
) -> str:
    """Everything the six checks are about, on one screen, above the signature."""

    level = escape(payload.brief.level)
    keys = [key for key in APPROVAL_CHECKS if key != "context"]
    if payload.context_sounds:
        keys.append("context")
    # Stated, not ticked. Six checkboxes look like six independent judgements and are not: nobody
    # decides six times, they click six times. One button over six visible sentences is the same
    # single act of assent, minus the ceremony that teaches a reviewer to click without reading.
    checks = "".join(
        f"<li>{APPROVAL_CHECKS[key].format(level=level)}</li>" for key in keys
    )
    signature = (
        f"<input type=hidden name=editor value='{escape(editor, quote=True)}'>"
        f"<button>Gehört und freigegeben — {escape(editor)}</button>"
        "<p class=muted>Ein anderer Name? <a href='?forget=1'>Zurücksetzen</a></p>"
        if editor
        else "<label>Name der freigebenden Person<input name=editor required autofocus></label>"
        "<button>Gehört und freigegeben</button>"
        "<p class=muted>Der Name wird lokal gemerkt und danach nicht mehr abgefragt.</p>"
    )

    length = "<span class=muted>Dauer unbekannt</span>"
    if duration is not None:
        within = target is None or target[0] <= duration <= target[1]
        window = f" · Plan {target[0]:g}–{target[1]:g} s" if target else ""
        length = (
            f"<span class={'pass' if within else 'fail'}>Dauer {duration:.1f} s</span>{window}"
        )

    return page(
        f"<div class=card><h2>Freigabe · {escape(slug)}</h2>"
        f"<p class=muted>{level} · {escape(payload.brief.scenario)} · {length}</p>"
        f"<p><a href='/projects/{project_id}'>Zurück zum Projekt</a></p></div>"
        + player_card(project_id, True, has_dry)
        + question_review_card(payload)
        + transcript_card(payload)
        + qa_card(qa)
        + "<div class=card><h3>Mit der Freigabe bestätigen Sie</h3>"
        f"<ul class=certify>{checks}</ul>"
        f"<form method=post action='/projects/{project_id}/approve/confirm'>{signature}</form>"
        "<p class=muted>Die Freigabe wird an den Hash genau dieser Audiodatei gebunden. Wird "
        "danach neu erzeugt, verfällt sie.</p></div>"
        "<div class='card actions'>"
        f"<form method=post action='/projects/{project_id}/regenerate'>"
        "<button class=ghost>Stimmt etwas nicht — neu erzeugen</button></form>"
        "<span class=muted>Nicht freigeben ist ein Schritt, kein Schließen des Tabs.</span></div>",
        f"Freigabe · {slug}",
    )


def player_card(project_id: int, has_final: bool, has_dry: bool) -> str:
    if not has_final:
        return "<div class=card><h3>Anhören</h3><p class=muted>Noch kein Audio erzeugt.</p></div>"
    dry = (
        f"<p class=muted>Nur Sprache, ohne Hintergrund:</p><audio controls preload=metadata src='/projects/{project_id}/audio?take=dry'></audio>"
        if has_dry
        else ""
    )
    return (
        f"<div class=card><h3>Anhören</h3><audio controls preload=metadata src='/projects/{project_id}/audio'></audio>{dry}"
        "<p class=muted>Beurteilen Sie Aussprache, Tempo, Sprechertrennung und ob die Fragen "
        "allein aus dem Gehörten beantwortbar sind.</p></div>"
    )


#: Which action is offered at each stage, and what it is called.
NEXT_ACTION = {
    Stage.DRAFT: ("validate", "Prüfen und freigeben zur Synthese"),
    Stage.VALIDATED: ("generate", "Audio erzeugen"),
    Stage.AUDIO_GENERATED: ("qa", "Automatische Prüfung"),
    Stage.AUTOMATICALLY_CHECKED: ("approve", "Anhören und freigeben"),
}


def actions_card(project_id: int, stage: Stage, qa_passed: bool | None) -> str:
    """Offer the one step that is legal here, not five that mostly are not.

    Every button was shown at every stage, so four of five answered an error — which is how a
    tool teaches its user to distrust it. The regeneration escape hatch is separate and always
    available, because a take that sounds wrong has to be redoable without editing the script.
    """

    step = NEXT_ACTION.get(stage)
    buttons = []
    if step:
        action, label = step
        blocked = action == "approve" and qa_passed is False
        if blocked:
            buttons.append(
                "<p class=fail>Die automatische Prüfung ist gescheitert. Erst Skript oder "
                "Einstellungen ändern und neu erzeugen.</p>"
            )
        else:
            buttons.append(
                f"<form method=post action='/projects/{project_id}/{action}'><button>{label}</button></form>"
            )
    if stage in {Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED}:
        buttons.append(
            f"<form method=post action='/projects/{project_id}/regenerate'>"
            "<button class=ghost>Neu erzeugen</button></form>"
        )
    return (
        "<div class='card actions'>"
        + "".join(buttons)
        + f"<span class=muted>Stand: <span class=stage>{escape(str(stage))}</span></span></div>"
    )


def project_page(
    *,
    project_id: int,
    slug: str,
    stage: Stage,
    revision_number: int,
    payload: RevisionPayload,
    voices: list[str],
    adapters: list[str],
    qa: dict[str, object] | None,
    approval: dict[str, object] | None,
    root: Path,
) -> str:
    final = root / "projects" / str(project_id) / "final.wav"
    dry = root / "projects" / str(project_id) / "dry.wav"
    qa_passed = None
    if qa:
        inner = qa.get("final") if isinstance(qa.get("final"), dict) else qa
        qa_passed = bool(inner.get("passed")) if isinstance(inner, dict) else None
    body = (
        f"<div class=card><h2>{escape(slug)}</h2>"
        f"<p class=muted>{escape(payload.brief.level)} · {escape(payload.brief.scenario)} · "
        f"Revision {revision_number}</p></div>"
        + player_card(project_id, final.exists(), dry.exists())
        + actions_card(project_id, stage, qa_passed)
        + (qa_card(qa) if qa else "")
        + (approval_card(approval) if approval else "")
        + soundscape_card(payload)
        + script_form(project_id, payload, voices, adapters)
        + questions_form(project_id, payload)
    )
    return page(body, f"{slug} · Listening Studio")


def error_page(message: str, back: str | None) -> str:
    return page(
        "<div class=card><h2>Dieser Schritt ist gerade nicht möglich</h2>"
        f"<p class=fail>{escape(message)}</p>"
        + (f"<p><a href='{escape(back, quote=True)}'>Zurück</a></p>" if back else "")
        + "</div>"
    )


def parse_lines(form: dict[str, str], payload: RevisionPayload) -> list[dict[str, object]]:
    """Rebuild the line list from the flat form, keeping anything the form does not expose."""

    out: list[dict[str, object]] = []
    for index, line in enumerate(payload.lines):
        current = line.model_dump(mode="json")
        synthesis = form.get(f"line.{index}.synthesis", "").strip()
        current.update(
            {
                "speaker": form.get(f"line.{index}.speaker", line.speaker),
                "display_text": form.get(f"line.{index}.text", line.display_text).strip(),
                "synthesis_text": synthesis or None,
                "delivery": form.get(f"line.{index}.delivery", "").strip() or None,
                "pace": float(form.get(f"line.{index}.pace", line.pace)),
                "pause_after_ms": int(form.get(f"line.{index}.pause", line.pause_after_ms)),
            }
        )
        out.append(current)
    return out


def parse_voice_profiles(
    form: dict[str, str], payload: RevisionPayload
) -> list[VoiceProfile]:
    locked = lock_voice_profiles(payload)
    assert locked.voice_profiles is not None
    reroll = form.get("reroll")
    profiles: list[VoiceProfile] = []
    for index, profile in enumerate(locked.voice_profiles):
        profiles.append(
            profile.model_copy(
                update={
                    "voice": form.get(f"profile.{index}.voice", profile.voice),
                    "style": form.get(f"profile.{index}.style", "").strip() or None,
                    "seed": profile.seed + 1 if reroll == str(index) else profile.seed,
                }
            )
        )
    return profiles


def parse_questions(form: dict[str, str], payload: RevisionPayload) -> list[Question]:
    out: list[Question] = []
    for index, question in enumerate(payload.questions):
        response = question.response
        if not isinstance(response, SingleChoice):
            out.append(question)
            continue
        options = [
            form.get(f"q.{index}.opt.{j}", opt).strip() or opt
            for j, opt in enumerate(response.options)
        ]
        out.append(
            question.model_copy(
                update={
                    "response": SingleChoice(
                        kind="single-choice",
                        prompt=form.get(f"q.{index}.prompt", response.prompt).strip(),
                        options=options,
                        correct=int(form.get(f"q.{index}.correct", response.correct)),
                    ),
                    "explain": question.explain.model_copy(
                        update={
                            "en": form.get(f"q.{index}.explain_en", question.explain.en),
                            "ru": form.get(f"q.{index}.explain_ru", question.explain.ru),
                        }
                    ),
                }
            )
        )
    return out
