from __future__ import annotations

import json
import secrets
from datetime import UTC, datetime
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
    Line,
    RevisionPayload,
    Stage,
    line_cache_key,
)
from .adapters import model_lock
from .export import sha256
from .qa import check_transcripts
from .storage import Store
from . import ui


PACKAGE_ROOT = Path(__file__).resolve().parents[2]


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
        return HTMLResponse(body)

    @api.exception_handler(ValueError)
    def workflow_error(request: Request, exc: ValueError) -> HTMLResponse:
        """A refused step is the editor's answer, not a server fault.

        `Store.transition` raises ValueError for anything that is not the legal next step, and
        nothing caught it — so a project already at `automatically_checked` answered a bare 500
        traceback to Validate, Generate and QA alike. That is most of the buttons for most of a
        project's life, showing a stack trace instead of one sentence.
        """

        return HTMLResponse(
            ui.error_page(str(exc), request.headers.get("referer")), status_code=409
        )

    def plan_rows() -> list[dict[str, object]]:
        """Every planned recording with its derived production state.

        Derived, never stored: a status column kept in step with the filesystem by hand drifts
        the first time anything is regenerated outside the UI.
        """

        plan = yaml.safe_load((repo / "data" / "listening-plan.yaml").read_text())
        projects = {p.slug: p for p in store.projects()}
        rows: list[dict[str, object]] = []
        for unit in plan["units"]:
            for artifact in unit["artifacts"]:
                project = projects.get(artifact["id"])
                state = "planned"
                project_id = None
                if project:
                    project_id = project.id
                    _, revision, payload = store.get(project.id)
                    stage = Stage(project.stage)
                    placeholder = any(
                        "redaktionellen Platzhalter" in line.display_text for line in payload.lines
                    )
                    state = "seeded" if placeholder else "drafted"
                    if stage in {Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED}:
                        state = "audio"
                    if revision.qa_json:
                        qa = json.loads(revision.qa_json)
                        inner = qa.get("final", qa)
                        state = "qa_passed" if inner.get("passed") is True else "qa_failed"
                    if stage is Stage.HUMAN_APPROVED:
                        state = "approved"
                    if stage is Stage.EXPORTED:
                        state = "published"
                published = repo / "content" / "listening" / unit["level"].lower() / f"{artifact['id']}.mp3"
                if published.exists():
                    state = "published"
                rows.append(
                    {
                        "id": artifact["id"],
                        "unit": unit["unit"],
                        "level": unit["level"],
                        "wave": artifact["wave"],
                        "scenario": artifact["scenario"],
                        "state": state,
                        "project_id": project_id,
                    }
                )
        return rows

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/", response_class=HTMLResponse)
    def index() -> HTMLResponse:
        return HTMLResponse(ui.index_page(plan_rows()))

    def voices_for(adapter: str) -> list[str]:
        lock = model_lock(PACKAGE_ROOT / "models.lock.json")
        models = lock.get("models", {})
        entry = models.get(adapter, {}) if isinstance(models, dict) else {}
        voices = entry.get("voices", []) if isinstance(entry, dict) else []
        return [str(v) for v in voices] if isinstance(voices, list) else []

    @api.get("/projects/{project_id}", response_class=HTMLResponse)
    def project(project_id: int) -> HTMLResponse:
        try:
            current, revision, payload = store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        return HTMLResponse(
            ui.project_page(
                project_id=project_id,
                slug=current.slug,
                stage=Stage(current.stage),
                revision_number=revision.number,
                payload=payload,
                voices=voices_for(payload.tts_adapter),
                adapters=["parler_tts", "qwen_tts"],
                qa=json.loads(revision.qa_json) if revision.qa_json else None,
                approval=json.loads(revision.approval_json) if revision.approval_json else None,
                root=store.root,
            )
        )

    @api.post("/projects/{project_id}/script")
    async def save_script(project_id: int, request: Request) -> RedirectResponse:
        _, _, payload = store.get(project_id)
        form = {k: str(v) for k, v in (await request.form()).items()}
        updated = payload.model_copy(
            update={
                "lines": [Line.model_validate(line) for line in ui.parse_lines(form, payload)],
                "tts_adapter": form.get("adapter", payload.tts_adapter),
                "max_replays": int(form.get("max_replays", payload.max_replays)),
            }
        )
        store.revise(project_id, updated)
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.post("/projects/{project_id}/questions")
    async def save_questions(project_id: int, request: Request) -> RedirectResponse:
        _, _, payload = store.get(project_id)
        form = {k: str(v) for k, v in (await request.form()).items()}
        store.revise(project_id, payload.model_copy(update={"questions": ui.parse_questions(form, payload)}))
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.post("/projects/{project_id}/regenerate")
    def regenerate(project_id: int) -> RedirectResponse:
        """Send a generated take back to `validated` so it can be produced again.

        A take that sounds wrong — or one whose QA failed — was otherwise a dead end: approval
        refuses it, and every earlier step is an illegal transition. The only escape was to edit
        the script, which is not what a bad *voice* needs. The revision is untouched, so the
        line cache still applies to everything that did not change.
        """

        current, _, _ = store.get(project_id)
        stage = Stage(current.stage)
        if stage not in {Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED}:
            raise ValueError(f"this project is at {stage}; there is no take to redo yet")
        store.reset_to(project_id, Stage.VALIDATED)
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.get("/projects/{project_id}/audio")
    def project_audio(project_id: int, take: str = "final") -> FileResponse:
        """The assembled take. `?take=dry` serves the speech before any context sound is mixed.

        Both are worth hearing separately: a context bed can mask a pronunciation defect, and
        the dry take is also what the QA transcription ran against, so a QA difference the
        final mix does not obviously explain is usually audible here.
        """

        try:
            store.get(project_id)
        except KeyError:
            raise HTTPException(404) from None
        name = "dry.wav" if take == "dry" else "final.wav"
        wav = store.root / "projects" / str(project_id) / name
        if not wav.exists():
            raise HTTPException(404, "audio has not been generated")
        return FileResponse(wav, media_type="audio/wav", filename=f"project-{project_id}-{take}.wav")

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
