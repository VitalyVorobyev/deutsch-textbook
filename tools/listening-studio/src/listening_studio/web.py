from __future__ import annotations

import json
import secrets
from html import escape
from datetime import UTC, datetime
from pathlib import Path

import yaml

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .adapters import (
    assemble,
    draft_prompt,
    engine_for,
    engine_revision,
    generate_draft,
    generate_lines,
    mix_context,
    transcribe,
    wav_duration,
)
from .domain import (
    Line,
    RevisionPayload,
    Stage,
    lock_voice_profiles,
    reassign_voice_profiles,
)
from .adapters import model_lock
from .generative.locks import set_models_root
from .export import sha256
from .qa import check_transcripts
from .speaker_qa import SpeakerQACalibration, check_speaker_consistency
from .soundscape import soundscape_report
from .storage import Store, remember_editor, remembered_editor
from . import ui
from .studio_api import router as studio_router
from .reading_audio import load_reading_sources


PACKAGE_ROOT = Path(__file__).resolve().parents[2]


def app(
    store: Store,
    repo: Path,
    token: str | None = None,
    *,
    allow_test_adapters: bool = False,
) -> FastAPI:
    api = FastAPI(title="Deutsch-Atlas Listening Studio")
    # The course repository this server was started against is also where `.models/` is looked
    # for. Stated once here rather than re-derived from this file's position on every lookup.
    set_models_root(repo)
    secret = token or secrets.token_urlsafe(24)
    frontend = PACKAGE_ROOT / "frontend" / "dist"
    if frontend.exists():
        # Vite's base is `/studio-assets/`, so the document requests
        # `/studio-assets/assets/<hash>`. Mount the dist root, not dist/assets, or every built
        # CSS/JS request gains one unmatched `assets/` segment and 404s.
        api.mount("/studio-assets", StaticFiles(directory=frontend), name="studio-assets")

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
                metrics: dict[str, object] = {
                    "stage": "planned",
                    "speaker_count": int(artifact.get("speakers", {}).get("min", 0)),
                    "line_count": 0,
                    "context_count": 0,
                    "bed_count": 0,
                    "event_count": 0,
                    "duration_seconds": None,
                    "within_similarity_min": None,
                    "cross_similarity_max": None,
                    "ambience_rms_dbfs": None,
                }
                if project:
                    project_id = project.id
                    _, revision, payload = store.get(project.id)
                    stage = Stage(project.stage)
                    metrics.update(
                        {
                            "stage": str(stage),
                            "speaker_count": len(payload.speakers),
                            "line_count": len(payload.lines),
                            "context_count": len(payload.context_sounds),
                            "bed_count": sum(
                                sound.role == "bed" for sound in payload.context_sounds
                            ),
                            "event_count": sum(
                                sound.role == "event" for sound in payload.context_sounds
                            ),
                            "duration_seconds": wav_duration(
                                store.root / "projects" / str(project.id) / "final.wav"
                            ),
                        }
                    )
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
                        speaker = qa.get("speaker_consistency", {})
                        if isinstance(speaker, dict):
                            within = [
                                float(row["minimum_similarity"])
                                for row in speaker.get("characters", [])
                                if isinstance(row, dict)
                                and row.get("minimum_similarity") is not None
                            ]
                            cross = [
                                float(row["similarity"])
                                for row in speaker.get("different_characters", [])
                                if isinstance(row, dict) and row.get("similarity") is not None
                            ]
                            metrics["within_similarity_min"] = min(within) if within else None
                            metrics["cross_similarity_max"] = max(cross) if cross else None
                        soundscape = qa.get("soundscape", {})
                        if isinstance(soundscape, dict):
                            metrics["ambience_rms_dbfs"] = soundscape.get(
                                "measured_ambience_rms_dbfs"
                            )
                    if stage is Stage.HUMAN_APPROVED:
                        state = "approved"
                    if stage is Stage.EXPORTED:
                        state = "published"
                published = repo / "content" / "listening" / unit["level"].lower() / f"{artifact['id']}.mp3"
                rows.append(
                    {
                        "id": artifact["id"],
                        "unit": unit["unit"],
                        "level": unit["level"],
                        "wave": artifact["wave"],
                        "scenario": artifact["scenario"],
                        "state": state,
                        "project_id": project_id,
                        "published_exists": published.exists(),
                        **metrics,
                    }
                )
        return rows

    def plan_duration(slug: str) -> tuple[float, float] | None:
        """The `duration_seconds` window the curriculum asked this recording for, if any.

        Stated on the approval page beside the measured length: nine of the twelve Wave-1 takes
        came out shorter than planned, and nothing in the studio or the repository validator
        compares the two — a take is never wrong-length, it is only ever wrong-worded.
        """

        source = repo / "data" / "listening-plan.yaml"
        if not source.exists():
            return None
        plan = yaml.safe_load(source.read_text())
        for unit in plan["units"]:
            for artifact in unit["artifacts"]:
                if artifact["id"] != slug:
                    continue
                window = artifact.get("duration_seconds") or {}
                if "min" in window and "max" in window:
                    return float(window["min"]), float(window["max"])
                return None
        return None

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/", response_class=HTMLResponse)
    def index() -> HTMLResponse:
        built = frontend / "index.html"
        if built.exists():
            # Keep the initial document self-describing for accessibility, smoke tests and a
            # JavaScript failure. React fetches richer data from /api/dashboard after mount.
            bootstrap = json.dumps(plan_rows(), ensure_ascii=False).replace("</", "<\u002f")
            return HTMLResponse(
                built.read_text().replace(
                    "</body>",
                    f"<script id='studio-bootstrap' type='application/json'>{bootstrap}</script>"
                    "<noscript><span class='project-grid button-link'>Deutsch-Atlas Audiokorpus · "
                    "Sprachniveau · geplant. Listening Studio requires JavaScript for charts "
                    "and editing.</span></noscript>"
                    "</body>",
                )
            )
        return HTMLResponse(ui.index_page(plan_rows()))

    api.include_router(studio_router(store, repo))

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
                # Qwen is the engine; the project's own is listed beside it so a project on the
                # test engine still shows what it is instead of silently reading as Qwen.
                adapters=sorted({"qwen_tts", payload.tts_adapter}),
                qa=json.loads(revision.qa_json) if revision.qa_json else None,
                approval=json.loads(revision.approval_json) if revision.approval_json else None,
                root=store.root,
            )
        )

    @api.post("/projects/{project_id}/script")
    async def save_script(project_id: int, request: Request) -> RedirectResponse:
        _, _, payload = store.get(project_id)
        form = {k: str(v) for k, v in (await request.form()).items()}
        payload = lock_voice_profiles(payload)
        adapter = form.get("adapter", payload.tts_adapter)
        lines = [Line.model_validate(line) for line in ui.parse_lines(form, payload)]
        profiles = ui.parse_voice_profiles(form, payload)
        if adapter != payload.tts_adapter:
            profiles = reassign_voice_profiles(profiles, adapter)
        # Validate rather than `model_copy(update=...)`, which skips `consistent()` and would let
        # an inconsistent revision be stored — after which every `Store.get()` rejects it and the
        # project is unreachable through the Studio. A ValidationError is a ValueError, so the
        # handler below answers it as a readable 409 instead of a traceback.
        updated = RevisionPayload.model_validate(
            payload.model_dump()
            | {
                "lines": [line.model_dump() for line in lines],
                "voice_profiles": [profile.model_dump() for profile in profiles],
                "tts_adapter": adapter,
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
        engine = engine_for(payload.tts_adapter)
        try:
            paths = generate_lines(payload, work, engine)
        except Exception as exc:
            # The failure is recorded and then reported as itself. There is no second engine to
            # revise the project onto any more, and a synthesis failure was never evidence that
            # the script needed rewriting.
            failure = {
                "adapter": engine.name,
                "revision": engine.revision,
                "failed_at": datetime.now(UTC).isoformat(),
                "error_type": type(exc).__name__,
                "message": str(exc),
            }
            work.mkdir(parents=True, exist_ok=True)
            (work / f"{engine.name}-failure-rev-{revision.number}.json").write_text(
                json.dumps(failure, ensure_ascii=False, indent=2)
            )
            raise HTTPException(
                409,
                f"{engine.name} failed and the failure was recorded: {exc}",
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
        work = store.root / "projects" / str(project_id)
        adapter_revision = engine_revision(payload.tts_adapter)
        line_paths = {
            line.id: work / "cache" / f"{payload.cache_key(line, adapter_revision)}.wav"
            for line in payload.lines
        }
        if payload.tts_adapter == "fake":
            if not allow_test_adapters:
                raise HTTPException(409, "the test adapter cannot pass QA")
            transcripts = {line.id: line.spoken_text() for line in payload.lines}
            dry_transcript = " ".join(transcripts.values())
            final_transcript = dry_transcript
        else:
            transcripts = {
                line.id: transcribe(line_paths[line.id])
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
            "speaker_consistency": (
                {"status": "not-run-test-adapter"}
                if payload.tts_adapter == "fake"
                else check_speaker_consistency(
                    payload,
                    line_paths,
                    calibration=(
                        SpeakerQACalibration.model_validate_json(
                            (store.root / "speaker-qa-calibration.json").read_text()
                        )
                        if (store.root / "speaker-qa-calibration.json").exists()
                        else None
                    ),
                ).model_dump(mode="json")
            ),
            "context_sound_count": len(payload.context_sounds),
            "soundscape": soundscape_report(
                payload, work / "dry.wav", work / "final.wav"
            ).model_dump(mode="json"),
        }
        store.transition(
            project_id,
            Stage.AUDIO_GENERATED,
            Stage.AUTOMATICALLY_CHECKED,
            qa=report,
        )
        return RedirectResponse(f"/projects/{project_id}", 303)

    # GET as well as POST: the page is now long enough to scroll, and a reload that re-submits a
    # form is a bad way to get back to the top of a review you are in the middle of.
    @api.api_route(
        "/projects/{project_id}/approve", methods=["GET", "POST"], response_class=HTMLResponse
    )
    def approval_form(project_id: int, forget: int = 0) -> HTMLResponse:
        project, revision, _ = store.get(project_id)
        if Stage(project.stage) != Stage.AUTOMATICALLY_CHECKED:
            raise HTTPException(409, "QA first")
        qa_data = json.loads(revision.qa_json or "{}")
        if qa_data.get("passed") is not True:
            raise HTTPException(409, "automatic QA failed; revise or regenerate before approval")
        _, _, payload = store.get(project_id)
        if payload.tts_adapter == "fake" and not allow_test_adapters:
            raise HTTPException(409, "test audio cannot be approved")
        if forget:
            (store.root / "editor.txt").unlink(missing_ok=True)
        project_dir = store.root / "projects" / str(project_id)
        window = plan_duration(project.slug)
        return HTMLResponse(
            ui.approval_page(
                project_id=project_id,
                slug=project.slug,
                payload=payload,
                qa=qa_data,
                has_dry=(project_dir / "dry.wav").exists(),
                duration=wav_duration(project_dir / "final.wav"),
                target=window,
                editor=remembered_editor(store.root),
            )
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
        # The six statements are what approval *means*, so they are affirmed together by the one
        # button that carries them — they were never six separate decisions, only six clicks.
        # The published manifest still records all of them (scripts/validate.ts requires the full
        # list), and the page states every one directly above the button that submits this.
        certified = {key for key in ui.APPROVAL_CHECKS if key != "context"}
        if payload.context_sounds:
            certified.add("context")
        editor = str(form.get("editor", "")).strip()
        if not editor:
            raise HTTPException(400, "an approval needs the name of the person giving it")
        remember_editor(store.root, editor)
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
            "editor": editor,
            "reviewed_at": datetime.now(UTC).isoformat(),
            "checklist": sorted(certified),
            "audio_sha256": sha256(final_wav),
            "dry_audio_sha256": sha256(dry_wav) if dry_wav.exists() else None,
        }
        store.transition(
            project_id, Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED, approval=approval
        )
        return RedirectResponse(f"/projects/{project_id}", 303)

    @api.get("/readings/{project_id}/approve", response_class=HTMLResponse)
    def reading_approval_form(project_id: int) -> HTMLResponse:
        project, revision, payload = store.get_reading(project_id)
        if Stage(project.stage) != Stage.AUTOMATICALLY_CHECKED:
            raise HTTPException(409, "reading QA must run before approval")
        qa_data = json.loads(revision.qa_json or "{}")
        if qa_data.get("passed") is not True:
            raise HTTPException(409, "automatic reading QA failed")
        final_wav = store.root / "readings" / str(project_id) / "final.wav"
        if not final_wav.exists():
            raise HTTPException(409, "no reading master to review")
        editor = remembered_editor(store.root) or ""
        checks = (
            "natural_long_prosody", "sentence_connection", "quotation_delivery",
            "cefr_clarity", "stable_narrator_identity", "no_fatigue_clicks_or_bad_joins",
        )
        items = "".join(f"<li><code>{key}</code></li>" for key in checks)
        return HTMLResponse(
            "<!doctype html><html lang='de'><meta charset='utf-8'><title>Lesetext prüfen</title>"
            "<style>body{font:16px system-ui;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.5}"
            "audio{width:100%;margin:20px 0}button{padding:12px 18px}input{padding:9px;width:100%;box-sizing:border-box}</style>"
            f"<h1>{escape(payload.title_de)}</h1><p>{escape(payload.reading_id)} · {escape(payload.narration_profile_id)}</p>"
            "<p><strong>Сначала прослушайте целиком без чтения текста.</strong> Затем подтвердите, что проверили:</p>"
            f"<audio controls src='/api/readings/{project_id}/audio'></audio><ul>{items}</ul>"
            f"<form method='post' action='/readings/{project_id}/approve/confirm'>"
            f"<label>Редактор<input name='editor' required value='{escape(editor, quote=True)}'></label>"
            "<label><input name='certify' type='checkbox' value='yes' required style='width:auto'> Я прослушал(а) эти точные байты и подтверждаю весь список.</label><p>"
            "<button type='submit'>Утвердить точную WAV-версию</button></p></form></html>"
        )

    @api.post("/readings/{project_id}/approve/confirm")
    async def approve_reading(project_id: int, request: Request) -> RedirectResponse:
        project, revision, payload = store.get_reading(project_id)
        if Stage(project.stage) != Stage.AUTOMATICALLY_CHECKED:
            raise HTTPException(409, "reading QA must run before approval")
        qa_data = json.loads(revision.qa_json or "{}")
        if qa_data.get("passed") is not True:
            raise HTTPException(409, "automatic reading QA failed")
        form = await request.form()
        editor = str(form.get("editor", "")).strip()
        if not editor or form.get("certify") != "yes":
            raise HTTPException(400, "the named editor must certify the complete review")
        final_wav = store.root / "readings" / str(project_id) / "final.wav"
        if not final_wav.exists():
            raise HTTPException(409, "no reading master to approve")
        current_source = next(
            (row for row in load_reading_sources(repo) if row.id == payload.reading_id), None
        )
        if current_source is None or current_source.source_sha256 != payload.source_sha256:
            raise HTTPException(409, "the source Lesetext changed; create a new narration revision")
        remember_editor(store.root, editor)
        approval: dict[str, object] = {
            "status": "complete",
            "editor": editor,
            "reviewed_at": datetime.now(UTC).isoformat(),
            "checklist": [
                "natural_long_prosody", "sentence_connection", "quotation_delivery",
                "cefr_clarity", "stable_narrator_identity", "no_fatigue_clicks_or_bad_joins",
            ],
            "audio_sha256": sha256(final_wav),
            "source_sha256": payload.source_sha256,
        }
        store.transition_reading(
            project_id,
            Stage.AUTOMATICALLY_CHECKED,
            Stage.HUMAN_APPROVED,
            approval=approval,
        )
        return RedirectResponse(f"/#/project/reading/{project_id}", 303)

    api.state.session_token = secret
    api.state.repo = repo
    return api
