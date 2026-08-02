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
)

CSS = """
:root{color-scheme:light dark}
body{font:16px/1.5 system-ui;max-width:1100px;margin:auto;padding:2rem;background:#f7f5f2;color:#292524}
header{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap}
h1{font-size:1.4rem;margin:0}
a{color:#9a3412}
label{display:block;margin:.6rem 0;font-size:.85rem;color:#57534e}
input,select,textarea{box-sizing:border-box;width:100%;padding:.5rem;border:1px solid #d6d3d1;border-radius:6px;background:white;font:inherit;color:inherit}
textarea{min-height:4.5rem}
button{padding:.6rem 1rem;border:0;border-radius:6px;background:#44403c;color:white;cursor:pointer;font:inherit}
button.ghost{background:white;color:#44403c;border:1px solid #d6d3d1}
.card{background:white;border:1px solid #e7e5e4;border-radius:10px;padding:1.2rem;margin:1rem 0}
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
.chip{display:inline-block;border-radius:999px;padding:.15rem .6rem;font-size:.75rem;font-weight:600}
.chip.todo{background:#f5f5f4;color:#78716c}
.chip.work{background:#fef3c7;color:#92400e}
.chip.ready{background:#dcfce7;color:#166534}
.chip.blocked{background:#fee2e2;color:#991b1b}
nav a{margin-left:1rem}
@media(prefers-color-scheme:dark){
 body{background:#1c1917;color:#e7e5e4}
 .card,input,select,textarea{background:#292524;border-color:#44403c}
 .line{background:#1c1917;border-color:#44403c}
 th,td{border-color:#44403c}
 button.ghost{background:#292524;color:#e7e5e4}
 label,.muted,th{color:#a8a29e}
}
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

    counts: dict[str, int] = {}
    for row in rows:
        counts[str(row["state"])] = counts.get(str(row["state"]), 0) + 1
    summary = " · ".join(
        f"{count} {STATE_CHIP[state][1]}" for state, count in sorted(counts.items())
    )
    body = [
        f"<div class=card><h2>{len(rows)} geplante Aufnahmen</h2><p class=muted>{escape(summary)}</p></div>"
    ]
    by_level: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        by_level.setdefault(str(row["level"]), []).append(row)
    for level in sorted(by_level):
        cells = []
        for row in by_level[level]:
            chip, label = STATE_CHIP[str(row["state"])]
            name = escape(str(row["id"]))
            link = (
                f"<a href='/projects/{row['project_id']}'>{name}</a>"
                if row["project_id"]
                else name
            )
            qa = ""
            if row["state"] == "qa_failed":
                qa = "<span class=fail>QA</span>"
            cells.append(
                f"<tr><td>{link}<div class=muted>{escape(str(row['scenario']))}</div></td>"
                f"<td>{escape(str(row['unit']))}</td>"
                f"<td><span class='chip {chip}'>{label}</span> {qa}</td>"
                f"<td class=muted>Welle {row['wave']}</td></tr>"
            )
        body.append(
            f"<div class=card><h3>{escape(level)} · {len(by_level[level])}</h3>"
            "<table><thead><tr><th>Aufnahme</th><th>Einheit</th><th>Status</th><th></th></tr></thead>"
            f"<tbody>{''.join(cells)}</tbody></table></div>"
        )
    return page("".join(body))


# --- project editor --------------------------------------------------------


def _options(values: list[str], selected: str) -> str:
    return "".join(
        f"<option{' selected' if v == selected else ''}>{escape(v)}</option>" for v in values
    )


def script_form(project_id: int, payload: RevisionPayload, voices: list[str], adapters: list[str]) -> str:
    """The script, one card per line, with the knobs that actually change a take.

    voice, pace, pause and seed are the four settings that decide what comes out of the
    synthesiser, and every one of them used to be reachable only by editing JSON.
    """

    lines = []
    for index, line in enumerate(payload.lines):
        lines.append(
            f"<div class=line><div class=row>"
            f"<label>Sprecher<select name='line.{index}.speaker'>{_options(payload.speakers, line.speaker)}</select></label>"
            f"<label>Stimme<select name='line.{index}.voice'>{_options(voices or [line.voice], line.voice)}</select></label>"
            f"<label>Tempo<input name='line.{index}.pace' type=number step=0.01 min=0.7 max=1.15 value='{line.pace}'></label>"
            f"<label>Pause danach (ms)<input name='line.{index}.pause' type=number min=0 max=5000 value='{line.pause_after_ms}'></label>"
            f"<label>Seed<input name='line.{index}.seed' type=number min=0 value='{line.seed}'></label>"
            "</div>"
            f"<label>Text<textarea name='line.{index}.text' required>{escape(line.display_text)}</textarea></label>"
            f"<label class=muted>Aussprache-Text (optional, nur für die Synthese)"
            f"<input name='line.{index}.synthesis' value='{escape(line.synthesis_text or '')}' placeholder='leer = wie oben'></label>"
            "</div>"
        )
    return (
        f"<div class=card><h3>Skript &amp; Stimmen</h3><form method=post action='/projects/{project_id}/script'>"
        + "".join(lines)
        + "<div class=row>"
        f"<label>Synthese-Modell<select name=adapter>{_options(adapters, payload.tts_adapter)}</select></label>"
        f"<label>Max. Wiederholungen<input name=max_replays type=number min=1 max=10 value='{payload.max_replays}'></label>"
        "</div>"
        "<p class=muted>Speichern legt eine neue Revision an und setzt das Projekt zurück auf <em>draft</em>. "
        "Zwischengespeicherte Zeilen-Audios werden wiederverwendet, solange Text, Stimme, Seed und Tempo gleich bleiben.</p>"
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
    return (
        f"<div class=card><h3>Automatische Prüfung</h3><p>{verdict} · Gesamt-WER "
        f"{float(final.get('full_wer') or 0):.1%}</p>{failure_html}"
        "<table><thead><tr><th>Zeile</th><th>Erwartet</th><th>Gehört</th><th>WER</th><th></th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
        "<p class=muted>Die automatische Prüfung findet Abweichungen im Wortlaut. Sie sagt nichts "
        "über Aussprache, Tempo oder Natürlichkeit — das entscheidet die Anhörung.</p></div>"
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
                "voice": form.get(f"line.{index}.voice", line.voice),
                "display_text": form.get(f"line.{index}.text", line.display_text).strip(),
                "synthesis_text": synthesis or None,
                "pace": float(form.get(f"line.{index}.pace", line.pace)),
                "pause_after_ms": int(form.get(f"line.{index}.pause", line.pause_after_ms)),
                "seed": int(form.get(f"line.{index}.seed", line.seed)),
            }
        )
        out.append(current)
    return out


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
