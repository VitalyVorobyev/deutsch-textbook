"""Consented voice references: create one, list them, audition one, withdraw one.

Five routes and one shape of refusal, and the refusals are the interesting part.

* **400 names a rule.** A consent that does not satisfy the policy is answered with the rule id it
  failed (`publication-permits-course`), never with "invalid consent". The rule vocabulary is
  served by `GET /api/voices` so the form can print the rules *before* it is held to them; an
  editor who learns a requirement from a rejection learns it once per rejection.
* **409 means the machine, not the request.** Absent weights, the fake engine outside the test
  gate, a voice whose consent has been withdrawn. The request was fine and this machine cannot
  answer it.
* **404 means the voice does not exist**, and is kept apart from a revoked one on purpose: a
  withdrawal is a fact somebody needs to see, and turning it into "not found" would hide it.

**No route here ever returns the reference recording.** It is the personal data the whole design is
built around; the demos are what an audition needs, and they are synthesized rather than excerpted.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping, cast

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..adapters import CLONING_ENGINES, ENGINES, engine_for, transcribe
from ..catalogs import load_character_catalog
from ..generative.gateway import (
    ClonableVoice,
    CloningSpeechGenerator,
    SpeechRequest,
    VoiceRef,
    supports_cloning,
)
from ..generative.locks import set_models_root
from ..generative.voices import (
    CONSENT_RULES,
    ConsentViolation,
    clonable_of,
    demo_dir,
    parse_consent,
    reference_path,
    revoke,
    store_reference,
    voice_row,
)
from ..storage import Store
from .workflow import Transcriber

#: How many demo phrases a voice is auditioned with. Three, the same number and the same reason as
#: the character roster: one is a sample and five is a session.
DEMO_COUNT = 3

#: What a 409 for absent weights tells the reader to run. Named once — the alternative is a 500
#: with a `RuntimeError` in it on the one machine that can actually fix the problem.
INSTALL_HINT = (
    "the cloning checkpoint is not installed on this machine; run "
    "`atlas-listening models fetch qwen_tts_base` (or "
    "`python scripts/download-qwen3-tts.py --variant base` from the repository root)"
)


def demo_phrases(repo: Path) -> list[str]:
    """The three lines every voice is auditioned with, taken from the character roster.

    Not a new list. The roster's phrases are what twelve voices are already compared by ear on, and
    a cloned voice is cast beside those twelve — auditioning it on different words would make the
    one comparison the page exists for impossible.

    The three chosen are the **most widely shared** phrases across the roster, which is not an
    arbitrary reduction: the roster gives every character one common line plus a register variant
    plus one of their own, so ranking by frequency yields exactly the neutral line and the du/Sie
    pair, and drops the twelve personal lines that belong to somebody else's persona.
    """

    counts: dict[str, int] = {}
    order: dict[str, int] = {}
    for character in load_character_catalog(repo).characters:
        for index, phrase in enumerate(character.demo_phrases):
            counts[phrase] = counts.get(phrase, 0) + 1
            order.setdefault(phrase, len(order) * 10 + index)
    ranked = sorted(counts, key=lambda phrase: (-counts[phrase], order[phrase]))
    return ranked[:DEMO_COUNT]


def _engine(
    name: str,
    *,
    allow_test_adapters: bool,
    voices: Mapping[str, ClonableVoice] | None = None,
) -> CloningSpeechGenerator:
    if name not in ENGINES:
        raise HTTPException(
            400, f"unknown synthesis engine {name}; known: {', '.join(sorted(ENGINES))}"
        )
    if name not in CLONING_ENGINES:
        raise HTTPException(
            400,
            f"{name} has no cloning capability; "
            f"engines that do: {', '.join(sorted(CLONING_ENGINES))}",
        )
    if name.startswith("fake") and not allow_test_adapters:
        raise HTTPException(409, f"{name} clones nothing; it exists for the test suite")
    engine = engine_for(name, voices or {})
    if not supports_cloning(engine):  # pragma: no cover - CLONING_ENGINES already decided this
        raise HTTPException(400, f"{name} has no cloning capability")
    # The cast is the one place the two protocols are joined, and it is guarded by the check above
    # rather than asserted: `CLONING_ENGINES` says which names have the capability and
    # `supports_cloning` reads it off the object, so the cast follows a fact rather than a hope.
    return cast(CloningSpeechGenerator, engine)


def router(
    store: Store,
    repo: Path,
    *,
    allow_test_adapters: bool = False,
    transcribe_fn: Transcriber | None = None,
) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["voices"])

    def stored(voice_id: str) -> Any:
        row = store.get_voice(voice_id)
        if row is None:
            raise HTTPException(404, f"no voice reference {voice_id}")
        return row

    @api.get("/voices")
    def voices() -> dict[str, Any]:
        """Every stored voice, **and the rules a new one is held to.**

        The rules are served beside the rows rather than from a route of their own, because the one
        surface that needs them is the one that lists the voices, and a second endpoint would be a
        second thing to remember to call before rendering a form that is about to reject something.
        """

        return {
            "voices": [voice_row(store.root, row) for row in store.voice_references()],
            "rules": [rule.as_json() for rule in CONSENT_RULES],
            "engines": sorted(
                name
                for name in CLONING_ENGINES
                if allow_test_adapters or not name.startswith("fake")
            ),
            "demo_phrases": demo_phrases(repo),
        }

    @api.post("/voices", status_code=201)
    async def create_voice(
        voice_id: str = Form(...),
        consent: str = Form(...),
        reference: UploadFile = File(...),
        ref_text: str | None = Form(default=None),
        x_vector_only: bool = Form(default=False),
        engine: str = Form(default="qwen_tts_base"),
    ) -> dict[str, Any]:
        """Register one consented voice: check the document, keep the bytes, bind the identity.

        The order is the argument. The consent is parsed and its rules applied **before** the
        recording is written anywhere, the recording is bound to the consent by digest before an
        engine is constructed, and the engine is asked for an identity before a row exists. So
        every failure leaves the store exactly as it was, and there is no state in which a
        reference recording is on disk without the document that permitted it.
        """

        audio = await reference.read()
        if not audio:
            raise HTTPException(400, "the reference recording is empty")
        try:
            document = parse_consent(consent)
        except ConsentViolation as error:
            raise HTTPException(400, str(error)) from error
        except ValueError as error:
            raise HTTPException(400, f"consent-shape: {error}") from error

        if store.get_voice(voice_id) is not None:
            raise HTTPException(409, f"voice reference {voice_id} already exists")

        clone = _engine(engine, allow_test_adapters=allow_test_adapters)
        set_models_root(repo)
        try:
            reference_sha256, consent_sha256 = store_reference(store.root, audio, document)
        except ConsentViolation as error:
            raise HTTPException(400, str(error)) from error

        transcript = (ref_text or "").strip() or None
        if transcript is None and not x_vector_only:
            transcript = _transcribe(store.root, reference_sha256, transcribe_fn)

        try:
            bound: VoiceRef = clone.make_voice(
                voice_id=voice_id,
                reference=reference_path(store.root, reference_sha256),
                reference_sha256=reference_sha256,
                ref_text=transcript,
                consent_sha256=consent_sha256,
                x_vector_only=x_vector_only,
            )
        except RuntimeError as error:
            raise HTTPException(409, f"{INSTALL_HINT} ({error})") from error
        except ValueError as error:
            raise HTTPException(400, str(error)) from error

        row = store.create_voice(
            voice_id=voice_id,
            reference_sha256=reference_sha256,
            reference_text=transcript,
            subject_display_name=document.subject.display_name,
            scope=document.scope,
            consent_sha256=consent_sha256,
            guardian_consent=document.guardian_consent is not None
            and document.guardian_consent.confirmed,
            child_assent=document.child_assent is not None and document.child_assent.confirmed,
            retention=document.retention.policy,
            engine=bound.engine,
            model_revision=bound.model_revision,
            x_vector_only=x_vector_only,
        )
        return voice_row(store.root, row)

    @api.post("/voices/{voice_id}/demo")
    def render_demo(voice_id: str) -> dict[str, Any]:
        """Synthesize the three audition phrases through this voice.

        Not node-cached and not part of any render: a demo is an audition, it never reaches a
        scene, and giving it a place in the content-addressed store would put a voice's audio one
        hash lookup away from a published take.
        """

        row = stored(voice_id)
        if row.revoked_at is not None:
            raise HTTPException(
                409,
                f"voice reference {voice_id} was revoked on {row.revoked_at[:10]}; "
                "no further synthesis is made through it",
            )
        if not reference_path(store.root, row.reference_sha256).exists():
            raise HTTPException(
                409,
                f"voice reference {voice_id} has no reference recording on this machine; "
                "references live in app-data and do not travel with a checkout",
            )
        clone = _engine(
            row.engine,
            allow_test_adapters=allow_test_adapters,
            voices={voice_id: clonable_of(store.root, row)},
        )
        set_models_root(repo)
        target = demo_dir(store.root, voice_id)
        target.mkdir(parents=True, exist_ok=True)
        phrases = demo_phrases(repo)
        for index, phrase in enumerate(phrases, 1):
            request = SpeechRequest(
                text=phrase,
                voice=row.subject_display_name,
                language="German",
                seed=100,
                voice_ref=voice_id,
            )
            try:
                clone.generate(request, target / f"demo-{index}.wav")
            except RuntimeError as error:
                raise HTTPException(409, f"{INSTALL_HINT} ({error})") from error
            except ValueError as error:
                raise HTTPException(400, str(error)) from error
        return voice_row(store.root, row) | {"phrases": phrases}

    @api.get("/voices/{voice_id}/demo/{index}")
    def demo(voice_id: str, index: int) -> FileResponse:
        if index not in range(DEMO_COUNT):
            raise HTTPException(404, "demo does not exist")
        stored(voice_id)
        target = demo_dir(store.root, voice_id) / f"demo-{index + 1}.wav"
        if not target.exists():
            raise HTTPException(404, "demo has not been generated")
        return FileResponse(target, media_type="audio/wav")

    @api.post("/voices/{voice_id}/revoke")
    def revoke_voice(voice_id: str) -> dict[str, Any]:
        """Withdraw consent. Refuses future synthesis, deletes the recording and the demos.

        Idempotent by design — `Store.revoke_voice` keeps the first date — so a second press
        answers with the same withdrawal rather than a conflict. Somebody withdrawing consent
        twice is somebody making sure, and an error is a bad answer to that.
        """

        stored(voice_id)
        return revoke(store, store.root, voice_id)

    return api


def _transcribe(root: Path, reference_sha256: str, transcribe_fn: Transcriber | None) -> str | None:
    """The reference transcript, when this machine can produce one.

    Best effort, and **None is a legitimate answer**: an absent local ASR is not a reason to refuse
    a consented recording. The caller stores None, the engine refuses to synthesize until a
    transcript arrives, and the editor is asked to type what is said — which they can, because they
    are the one who made the recording. A guessed transcript would be worse: the clone conditions
    on it, so a wrong one is a voice that sounds slightly like somebody else.
    """

    path = reference_path(root, reference_sha256)
    try:
        return ((transcribe_fn or transcribe)(path)).strip() or None
    except Exception:
        return None


def voices_json(store: Store, root: Path) -> str:
    """The CLI's `--json` envelope for the list, so the two surfaces print one shape."""

    return json.dumps(
        {"voices": [voice_row(root, row) for row in store.voice_references()]},
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
