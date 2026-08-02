from __future__ import annotations

import json
import secrets
from datetime import UTC, datetime
from html import escape
from pathlib import Path

import yaml

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse

from .adapters import (
    FakeTTS,
    ParlerTTS,
    QwenTTS,
    TTSAdapter,
    assemble,
    draft_prompt,
    generate_draft,
    generate_lines,
    mix_context,
    transcribe,
)
from .domain import (
    Brief,
    Bilingual,
    Line,
    Question,
    RevisionPayload,
    SingleChoice,
    Stage,
    line_cache_key,
)
from .export import sha256
from .qa import check_transcripts
from .storage import Store


CSS = """body{font:16px system-ui;max-width:1100px;margin:auto;padding:2rem;background:#f7f5f2;color:#292524}header{display:flex;justify-content:space-between}a{color:#9a3412}textarea,input,select{box-sizing:border-box;width:100%;padding:.65rem;border:1px solid #d6d3d1;border-radius:6px;background:white}textarea{min-height:26rem;font:13px ui-monospace}button{padding:.7rem 1rem;border:0;border-radius:6px;background:#44403c;color:white;cursor:pointer}.card{background:white;border:1px solid #e7e5e4;border-radius:10px;padding:1.2rem;margin:1rem 0}.stage{font-weight:700;color:#9a3412}.actions{display:flex;gap:.5rem;flex-wrap:wrap}.muted{color:#78716c;font-size:.9rem}.pass{color:#166534}.fail{color:#b91c1c}audio{width:100%}summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap}"""


def app(
    store: Store,
    repo: Path,
    token: str | None = None,
    *,
    allow_test_adapters: bool = False,
) -> FastAPI:
    api = FastAPI(title="Deutsch-Atlas Listening Studio")
    secret = token or secrets.token_urlsafe(24)

    @api.middleware("http")
    async def local_only(request: Request, call_next):  # type: ignore[no-untyped-def]
        # /health is exempt from the token so a supervisor can poll it. It must therefore not
        # hand one out: issuing the session cookie on every response meant any client could
        # GET /health, keep the cookie, and reach every mutation endpoint without ever knowing
        # the token — the exemption became the way in. The cookie is set only for a request
        # that already proved it had the secret.
        authenticated = (
            request.query_params.get("token") == secret
            or request.cookies.get("atlas_studio") == secret
        )
        # Returned, not raised. An HTTPException raised inside an http middleware never reaches
        # FastAPI's exception handler — Starlette lets it escape as an unhandled error — so
        # every rejection here was answering 500 while looking like a 403 in the source.
        if not authenticated and request.url.path != "/health":
            return JSONResponse({"detail": "Invalid local session token"}, status_code=403)
        origin = request.headers.get("origin")
        if origin and not origin.startswith(("http://127.0.0.1", "http://localhost")):
            return JSONResponse({"detail": "Invalid origin"}, status_code=403)
        response = await call_next(request)
        if authenticated:
            response.set_cookie("atlas_studio", secret, httponly=True, samesite="strict")
        return response

    def page(body: str) -> HTMLResponse:
        return HTMLResponse(
            f"<!doctype html><html><meta charset=utf-8><title>Listening Studio</title><style>{CSS}</style><body><header><h1>Listening Studio</h1><nav><a href='/corpus/wave-1'>Wave 1 review</a> · <a href='/'>Projects</a></nav></header>{body}</body></html>"
        )

    @api.exception_handler(ValueError)
    def workflow_error(request: Request, exc: ValueError) -> HTMLResponse:
        """A refused workflow step is the editor's answer, not a server fault.

        `Store.transition` raises ValueError for any step that is not the legal next one, and
        nothing caught it — so a project already at `automatically_checked` answered a bare
        500 traceback to Validate, Generate and QA alike. That is most of the buttons on the
        page for most of a project's life, and the browser showed a stack trace rather than
        the one sentence the editor needed: where the project is and what comes next.
        """

        back = request.headers.get("referer")
        body = (
            "<div class=card><h2>That step is not available</h2>"
            f"<p class=fail>{escape(str(exc))}</p>"
            + (f"<p><a href='{escape(back, quote=True)}'>Back</a></p>" if back else "")
            + "</div>"
        )
        response = page(body)
        response.status_code = 409
        return response

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/", response_class=HTMLResponse)
    def index() -> HTMLResponse:
        rows = "".join(
            f"<div class=card><a href='/projects/{p.id}'>{p.slug}</a> <span class=stage>{p.stage}</span></div>"
            for p in store.projects()
        )
        return page(
            "<p><a href='/corpus/wave-1'>Review the 12 Wave-1 recordings</a> · <a href='/new'>New listening project</a></p>"
            + (rows or "<p>No projects yet.</p>")
        )

    def wave_slugs(wave: int) -> list[str]:
        """The wave's artifact ids, from the plan — the only thing that defines corpus identity.

        This filtered on `2 <= project.id <= 13` until 2026-08-02. A project id is database
        insertion order: against a fresh database `seed-wave` produces ids 1–12 and the window
        silently dropped the first recording, while against a database with any unrelated
        project it dropped real Wave-1 work and showed unrelated audio in its place. Either
        way the review page quietly reviewed the wrong set.
        """
        plan = yaml.safe_load((repo / "data" / "listening-plan.yaml").read_text())
        return [
            artifact["id"]
            for unit in plan["units"]
            for artifact in unit["artifacts"]
            if artifact["wave"] == wave
        ]

    @api.get("/corpus/wave-1", response_class=HTMLResponse)
    def wave_one_review() -> HTMLResponse:
        cards: list[str] = []
        planned = wave_slugs(1)
        by_slug = {project.slug: project for project in store.projects()}
        for slug in planned:
            project_row = by_slug.get(slug)
            if project_row is None:
                cards.append(
                    f"<section class=card><h2>{escape(slug)}</h2>"
                    "<p class=fail>Planned, but no local project — run <code>seed-wave</code>.</p></section>"
                )
                continue
            _, revision, payload = store.get(project_row.id)
            wav = store.root / "projects" / str(project_row.id) / "final.wav"
            qa = json.loads(revision.qa_json or "{}")
            if qa.get("passed") is True:
                verdict = "<strong class=pass>Automatic QA passed</strong>"
            elif revision.qa_json:
                verdict = "<strong class=fail>Automatic QA failed — review differences</strong>"
            else:
                verdict = "<strong>QA pending</strong>"
            transcript = "\n".join(
                f"{line.speaker}: {line.display_text}" for line in payload.lines
            )
            player = (
                f"<audio controls preload=metadata src='/projects/{project_row.id}/audio'></audio>"
                if wav.exists()
                else "<p class=fail>Audio missing</p>"
            )
            failures = qa.get("final", {}).get("failures", [])
            failure_html = (
                "<details><summary>QA differences</summary><pre>"
                + escape("\n".join(failures) or "No recorded failures")
                + "</pre></details>"
                if revision.qa_json
                else ""
            )
            cards.append(
                f"<section class=card><h2>{escape(project_row.slug)}</h2>"
                f"<p>{escape(payload.brief.level)} · {escape(payload.brief.scenario)} · {verdict}</p>"
                + player
                + "<details><summary>Transcript</summary><pre>"
                + escape(transcript)
                + "</pre></details>"
                + failure_html
                + f"<p><a href='/projects/{project_row.id}'>Open full project</a></p></section>"
            )
        return page(
            "<p>Assessment copies: clean speech only. Automatic checks detect transcript mismatches; human review must judge accent, naturalness, pace, speaker consistency and answerability.</p>"
            + "".join(cards)
        )

    @api.get("/new", response_class=HTMLResponse)
    def new_form() -> HTMLResponse:
        return page("""<div class=card><h2>New project</h2><form method=post action=/new>
        <label>Slug<input name=slug pattern='[a-z0-9-]+' required></label>
        <label>CEFR<select name=level><option>A1</option><option selected>A2</option><option>B1</option><option>B2</option></select></label>
        <label>Source text<textarea name=source_text></textarea></label><label>Vocabulary (comma-separated)<input name=vocabulary></label>
        <label>Grammar target<input name=grammar_target></label><label>Scenario<input name=scenario required></label>
        <label>Duration seconds<input name=duration type=number value=45 min=5 max=600></label><label>Speakers<input name=speakers type=number value=2 min=1 max=4></label>
        <label>Atlas topic id<input name=topic required></label><label>Outcome ids (comma-separated)<input name=outcomes required></label><button>Create editable draft</button></form></div>""")

    @api.post("/new")
    def new_project(
        slug: str = Form(),
        level: str = Form(),
        source_text: str = Form(""),
        vocabulary: str = Form(""),
        grammar_target: str = Form(""),
        scenario: str = Form(),
        duration: int = Form(45),
        speakers: int = Form(2),
        topic: str = Form(),
        outcomes: str = Form(),
    ) -> RedirectResponse:
        names = [f"Sprecher {i + 1}" for i in range(speakers)]
        brief = Brief.model_validate(
            {
                "source_text": source_text,
                "level": level,
                "vocabulary": [v.strip() for v in vocabulary.split(",") if v.strip()],
                "grammar_target": grammar_target,
                "scenario": scenario,
                "duration_seconds": duration,
                "speaker_count": speakers,
                "topic": topic,
                "outcomes": [o.strip() for o in outcomes.split(",") if o.strip()],
            }
        )
        payload = RevisionPayload(
            title=Bilingual(en=scenario, ru=scenario),
            brief=brief,
            speakers=names,
            lines=[
                Line(
                    id="line-1",
                    speaker=names[0],
                    display_text=source_text or "Entwurf",
                    voice="Ryan",
                )
            ],
            questions=[
                Question(
                    id="question-1",
                    instruction=Bilingual(en="Listen.", ru="Прослушайте."),
                    response=SingleChoice(
                        kind="single-choice",
                        prompt="Was ist richtig?",
                        options=["Option A", "Option B"],
                        correct=0,
                    ),
                    explain=Bilingual(
                        en="Complete during editing.", ru="Заполните при редактировании."
                    ),
                )
            ],
        )
        project = store.create(slug, payload)
        return RedirectResponse(f"/projects/{project.id}", 303)

    @api.get("/projects/{project_id}", response_class=HTMLResponse)
    def project(project_id: int) -> HTMLResponse:
        try:
            project, revision, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        payload_json = escape(payload.model_dump_json(indent=2))
        body = f"<div class=card><h2>{escape(project.slug)}</h2><p>Revision {revision.number} · <span class=stage>{project.stage}</span></p><form method=post action='/projects/{project_id}/revise'><textarea name=payload>{payload_json}</textarea><button>Save new revision</button></form></div>"
        final_wav = store.root / "projects" / str(project_id) / "final.wav"
        if final_wav.exists():
            body += f"<div class=card><h3>Audio preview</h3><audio controls src='/projects/{project_id}/audio'></audio><p class=muted>Cached line audio is reused unless text, voice, seed, pace, pronunciation or processing settings change.</p></div>"
        if revision.qa_json:
            body += (
                "<div class=card><h3>Automatic QA</h3><pre>"
                + escape(json.dumps(json.loads(revision.qa_json), ensure_ascii=False, indent=2))
                + "</pre></div>"
            )
        if revision.approval_json:
            body += (
                "<div class=card><h3>Approval</h3><pre>"
                + escape(
                    json.dumps(json.loads(revision.approval_json), ensure_ascii=False, indent=2)
                )
                + "</pre></div>"
            )
        actions = "".join(
            f"<form method=post action='/projects/{project_id}/{action}'><button>{label}</button></form>"
            for action, label in [
                ("validate", "Validate"),
                ("draft", "Generate structured draft"),
                ("generate", "Generate audio"),
                ("qa", "Run QA"),
                ("approve", "Human approval"),
            ]
        )
        return page(
            body
            + "<div class='card actions'>"
            + actions
            + "</div><p class=muted>Human approval requires every checklist box and the editor's real name.</p>"
        )

    @api.get("/projects/{project_id}/audio")
    def project_audio(project_id: int) -> FileResponse:
        try:
            store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        wav = store.root / "projects" / str(project_id) / "final.wav"
        if not wav.exists():
            raise HTTPException(404, "audio has not been generated")
        return FileResponse(wav, media_type="audio/wav", filename=f"project-{project_id}.wav")

    @api.post("/projects/{project_id}/revise")
    def revise(project_id: int, payload: str = Form()) -> RedirectResponse:
        store.revise(project_id, RevisionPayload.model_validate_json(payload))
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.post("/projects/{project_id}/validate")
    def validate(project_id: int) -> RedirectResponse:
        project, _, _ = store.get(project_id)
        store.transition(project_id, Stage(project.stage), Stage.VALIDATED)
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.post("/projects/{project_id}/draft")
    def draft(project_id: int) -> RedirectResponse:
        project, revision, payload = store.get(project_id)
        if Stage(project.stage) != Stage.DRAFT:
            raise HTTPException(409, "generation starts from a draft")
        prompt_dir = store.root / "projects" / str(project_id)
        prompt_dir.mkdir(parents=True, exist_ok=True)
        (prompt_dir / f"generation-prompt-rev-{revision.number}.md").write_text(
            draft_prompt(payload)
        )
        store.revise(project_id, generate_draft(payload))
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.post("/projects/{project_id}/generate")
    def generate(project_id: int) -> RedirectResponse:
        project, revision, payload = store.get(project_id)
        if Stage(project.stage) != Stage.VALIDATED:
            raise HTTPException(409, "validate first")
        work = store.root / "projects" / str(project_id)
        if payload.tts_adapter == "fake" and not allow_test_adapters:
            raise HTTPException(409, "the test adapter cannot generate approvable audio")
        adapter: TTSAdapter
        if payload.tts_adapter == "qwen_tts":
            adapter = QwenTTS()
        elif payload.tts_adapter == "parler_tts":
            adapter = ParlerTTS()
        else:
            adapter = FakeTTS()
        try:
            paths = generate_lines(payload, work, adapter)
        except Exception as exc:
            if payload.tts_adapter != "qwen_tts":
                raise
            failure = {
                "adapter": "qwen_tts",
                "revision": QwenTTS.revision,
                "failed_at": datetime.now(UTC).isoformat(),
                "error_type": type(exc).__name__,
                "message": str(exc),
                "fallback": "parler_tts",
            }
            work.mkdir(parents=True, exist_ok=True)
            (work / f"qwen-failure-rev-{revision.number}.json").write_text(
                json.dumps(failure, ensure_ascii=False, indent=2)
            )
            fallback_voices = ["Nicole", "Christopher", "Megan", "Michelle"]
            revised_lines = [
                line.model_copy(update={"voice": fallback_voices[index % len(fallback_voices)]})
                for index, line in enumerate(payload.lines)
            ]
            store.revise(
                project_id,
                payload.model_copy(update={"tts_adapter": "parler_tts", "lines": revised_lines}),
            )
            raise HTTPException(
                409,
                "Qwen failed and the failure was recorded. The new draft uses Parler official German voices; review and validate it before generating again.",
            ) from exc
        dry = work / "dry.wav"
        assemble(payload, paths, dry)
        mix_context(payload, store.root, dry, work / "final.wav")
        store.transition(project_id, Stage.VALIDATED, Stage.AUDIO_GENERATED)
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.post("/projects/{project_id}/qa")
    def qa(project_id: int) -> RedirectResponse:
        project, _, payload = store.get(project_id)
        if Stage(project.stage) != Stage.AUDIO_GENERATED:
            raise HTTPException(409, "generate first")
        if payload.tts_adapter == "fake":
            if not allow_test_adapters:
                raise HTTPException(409, "the test adapter cannot pass QA")
            transcripts = {line.id: line.spoken_text() for line in payload.lines}
            dry_transcript = " ".join(transcripts.values())
            final_transcript = dry_transcript
        else:
            adapter_revision = (
                QwenTTS.revision if payload.tts_adapter == "qwen_tts" else ParlerTTS.revision
            )
            work = store.root / "projects" / str(project_id)
            transcripts = {
                line.id: transcribe(
                    work / "cache" / f"{line_cache_key(line, adapter_revision)}.wav"
                )
                for line in payload.lines
            }
            dry_transcript = transcribe(work / "dry.wav")
            final_transcript = transcribe(work / "final.wav")
        dry_report = check_transcripts(payload, transcripts, dry_transcript)
        final_report = check_transcripts(payload, transcripts, final_transcript)
        report = {
            "passed": dry_report.passed and final_report.passed,
            "dry": dry_report.model_dump(mode="json"),
            "final": final_report.model_dump(mode="json"),
            "context_sound_count": len(payload.context_sounds),
        }
        store.transition(
            project_id,
            Stage.AUDIO_GENERATED,
            Stage.AUTOMATICALLY_CHECKED,
            qa=report,
        )
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.post("/projects/{project_id}/approve", response_class=HTMLResponse)
    def approval_form(project_id: int) -> HTMLResponse:
        project, revision, _ = store.get(project_id)
        if Stage(project.stage) != Stage.AUTOMATICALLY_CHECKED:
            raise HTTPException(409, "QA first")
        qa_data = json.loads(revision.qa_json or "{}")
        if qa_data.get("passed") is not True:
            raise HTTPException(409, "automatic QA failed; revise or regenerate before approval")
        _, _, payload = store.get(project_id)
        if payload.tts_adapter == "fake" and not allow_test_adapters:
            raise HTTPException(409, "test audio cannot be approved")
        checks = ["accent", "naturalness", "intelligibility", "speakers", "pace", "questions"]
        if payload.context_sounds:
            checks.append("context")
        fields = "".join(
            f"<label><input style='width:auto' type=checkbox name={c} required> {c}</label><br>"
            for c in checks
        )
        return page(
            f"<div class=card><h2>Human approval</h2><form method=post action='/projects/{project_id}/approve/confirm'><label>Editor<input name=editor required></label>{fields}<button>Approve this exact revision</button></form></div>"
        )

    @api.post("/projects/{project_id}/approve/confirm")
    async def approve(project_id: int, request: Request) -> RedirectResponse:
        project, revision, payload = store.get(project_id)
        if Stage(project.stage) != Stage.AUTOMATICALLY_CHECKED:
            raise HTTPException(409, "QA first")
        if json.loads(revision.qa_json or "{}").get("passed") is not True:
            raise HTTPException(409, "automatic QA failed")
        if payload.tts_adapter == "fake" and not allow_test_adapters:
            raise HTTPException(409, "test audio cannot be approved")
        form = await request.form()
        required = {"accent", "naturalness", "intelligibility", "speakers", "pace", "questions"}
        if payload.context_sounds:
            required.add("context")
        if not required.issubset(form.keys()) or not str(form.get("editor", "")).strip():
            raise HTTPException(400, "complete every check")
        # Bind the approval to the exact bytes the editor heard.
        #
        # Until 2026-08-02 the approval recorded who and when but nothing about the audio, and
        # `bundle_project()` compared nothing — so a WAV regenerated, replaced or truncated
        # after approval and before export was bundled and published carrying the old approval
        # unchanged. `scripts/validate.ts` could not catch it either: it checks the manifest
        # against the file, never the approval against the manifest. The published provenance
        # would then state that a named human approved audio nobody had ever listened to,
        # which is the exact claim docs/product-protection.md exists to make unforgeable.
        project_dir = store.root / "projects" / str(project_id)
        final_wav = project_dir / "final.wav"
        dry_wav = project_dir / "dry.wav"
        if not final_wav.exists():
            raise HTTPException(409, "no final audio to approve")
        approval: dict[str, object] = {
            "status": "complete",
            "editor": str(form["editor"]),
            "reviewed_at": datetime.now(UTC).isoformat(),
            "checklist": sorted(required),
            "audio_sha256": sha256(final_wav),
            "dry_audio_sha256": sha256(dry_wav) if dry_wav.exists() else None,
        }
        store.transition(
            project_id, Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED, approval=approval
        )
        return RedirectResponse(f"/projects/{project_id}", 303)

    api.state.session_token = secret
    api.state.repo = repo
    return api
