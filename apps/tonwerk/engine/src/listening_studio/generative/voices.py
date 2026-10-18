"""Consented voice references: the record, the rules it must satisfy, and where the bytes live.

This is the promotion of `human_voice_experiment`'s consent machinery from a research path into a
**production-capable** one. Everything that made the research path safe is kept and made stricter,
not bypassed:

* a consent binds the **exact reference SHA-256**, so a record cannot be re-pointed at other audio;
* a minor needs guardian consent **and** guardian-attested child assent;
* retention is stated rather than assumed;
* the reference audio never enters the repository — it lives under the studio's app-data root.

One thing changes, and it is the whole point of this module: a consent may carry
`scope: "publication"`, and a voice made from it may be cast in course audio that ships. That scope
costs more than the evaluation one, not less — the document has to *permit* course publication in
its own words and still bar redistribution outside the course. The rules are in `CONSENT_RULES`,
which is a published vocabulary: the API serves it so an editor's form can render the rules it is
about to be held to, instead of failing blind.

**Nothing here validates on the engine's behalf and nothing here loads a model.** Consent is
decided before any generator is reached; a speech engine receives an already-bound identity
(`gateway.VoiceRef`) and never a consent document. An engine that could rule on consent is an
engine that could be replaced by one that rules differently.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Literal, Sequence

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from .gateway import ClonableVoice, VoiceRef

if TYPE_CHECKING:  # pragma: no cover - typing only, and the import direction stays one-way
    from ..storage import Store, VoiceReference


#: What a consent authorises. `evaluation` is the old research path's scope by another name:
#: local listening, nothing published. `publication` is the new one, and the only one a cast
#: voice may be published under.
ConsentScope = Literal["evaluation", "publication"]

#: One kebab-case ASCII identifier, the shape every other id in this repository uses.
KEBAB = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class ConsentViolation(ValueError):
    """A consent document that does not satisfy a rule, **with the rule named.**

    The rule id is the field an error message cannot carry usefully: an editor reading "this
    consent is invalid" learns nothing, and an editor reading `publication-permits-course` can be
    shown the sentence they have to satisfy. The API turns it into a 400 whose body names it, and
    Tonwerk renders the German for that id.
    """

    def __init__(self, rule: str, message: str) -> None:
        super().__init__(f"{rule}: {message}")
        self.rule = rule
        self.detail = message


@dataclass(frozen=True)
class ConsentRule:
    """One rule, and when it applies. Serialised to the API so a form can render it."""

    id: str
    #: `always`, or the one scope it is a condition of.
    applies: Literal["always", "evaluation", "publication"]
    #: True for the two rules that exist only because the subject is a minor.
    minors_only: bool
    #: The engine's own English sentence. Tonwerk renders German for a known id and falls back to
    #: this for an unknown one, so a rule added here appears in the form rather than disappearing.
    requirement: str

    def as_json(self) -> dict[str, object]:
        return {
            "id": self.id,
            "applies": self.applies,
            "minors_only": self.minors_only,
            "requirement": self.requirement,
        }


#: The published rule vocabulary. Order is the order a form should print them in.
CONSENT_RULES: tuple[ConsentRule, ...] = (
    ConsentRule(
        "subject-named",
        "always",
        False,
        "The consent names the person whose voice was recorded.",
    ),
    ConsentRule(
        "purpose-stated",
        "always",
        False,
        "The authorised purpose is written out, not implied.",
    ),
    ConsentRule(
        "retention-stated",
        "always",
        False,
        "The consent states how long the reference recording is kept and when it is deleted.",
    ),
    ConsentRule(
        "reference-sha-binding",
        "always",
        False,
        "The consent names the SHA-256 of exactly this recording.",
    ),
    ConsentRule(
        "minor-guardian",
        "always",
        True,
        "A minor's guardian has given consent and attested it.",
    ),
    ConsentRule(
        "minor-assent",
        "always",
        True,
        "A minor's own assent is confirmed and attested by the guardian.",
    ),
    ConsentRule(
        "evaluation-bars-publication",
        "evaluation",
        False,
        "Evaluation scope: the consent explicitly prohibits upload, publication and git.",
    ),
    ConsentRule(
        "publication-permits-course",
        "publication",
        False,
        "Publication scope: a permitted use explicitly allows publishing in this course.",
    ),
    ConsentRule(
        "publication-bars-redistribution",
        "publication",
        False,
        "Publication scope: redistribution outside the course is still prohibited.",
    ),
)

#: Words that make a permitted use a *publication* permission, in either project language. Matched
#: as substrings so inflection costs nothing: `veröffentlich` covers Veröffentlichung and
#: veröffentlichen alike.
_PUBLICATION_WORDS = ("publication", "publish", "veröffentlich", "veroeffentlich")
#: …and words that tie it to **this course** rather than to publication in general. A consent that
#: permits "publication" full stop is a broader grant than this product asks for, and a broader
#: grant is exactly what must not be accepted silently.
_COURSE_WORDS = ("course", "kurs", "deutsch-atlas")
#: What publication scope must still forbid.
_REDISTRIBUTION_WORDS = ("redistribution", "redistribute", "weitergabe", "weiterverbreitung")
#: The three the evaluation scope inherits unchanged from `human_voice_experiment`.
_EVALUATION_PROHIBITIONS = ("upload", "publication", "git")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Confirmation(Strict):
    confirmed: bool
    attestation: str = Field(min_length=10)


class GuardianConfirmation(Confirmation):
    guardian: str = Field(min_length=2)


class ChildAssent(Confirmation):
    attested_by_guardian: bool


class RetentionPolicy(Strict):
    policy: str = Field(min_length=10)
    automatic_deletion: bool


class ReferenceRecord(Strict):
    """The recording this consent is about, by digest.

    `path` is deliberately absent. The research record carried one because the runner was handed a
    file; here the bytes are content-addressed under app-data the moment they arrive, so a path in
    the document would be a second, staler answer to a question the digest already settles.
    """

    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    #: How long the recording is, as the person giving consent was told. Not measured here and not
    #: checked against the file: it is part of what they agreed to, not a fact about the bytes.
    duration_seconds: float | None = Field(default=None, gt=0)


class ConsentSubject(Strict):
    display_name: str = Field(min_length=1)
    is_minor: bool


class VoiceConsent(Strict):
    """One person's consent to have their voice cloned, at one scope.

    Promoted from `human_voice_experiment.HumanVoiceConsent`. Two shapes differ, and both because
    this record can now authorise publication: the subject is typed (a minor is a field rather than
    a convention inside a free dict), and `permitted_uses` exists beside `prohibited_uses`, because
    a document that only lists prohibitions cannot express a permission and publication scope is a
    permission.
    """

    version: int = 1
    recorded_at: str = Field(min_length=4)
    scope: ConsentScope
    subject: ConsentSubject
    guardian_consent: GuardianConfirmation | None = None
    child_assent: ChildAssent | None = None
    authorized_purpose: str = Field(min_length=20)
    permitted_uses: list[str] = Field(default_factory=list)
    prohibited_uses: list[str] = Field(default_factory=list)
    retention: RetentionPolicy
    reference: ReferenceRecord

    @model_validator(mode="after")
    def satisfies_every_rule_of_its_scope(self) -> VoiceConsent:
        if self.subject.is_minor:
            guardian = self.guardian_consent
            if guardian is None or not guardian.confirmed:
                raise ConsentViolation(
                    "minor-guardian",
                    "the subject is a minor, so a confirmed guardian consent is required",
                )
            assent = self.child_assent
            if assent is None or not assent.confirmed or not assent.attested_by_guardian:
                raise ConsentViolation(
                    "minor-assent",
                    "the subject is a minor, so the child's own assent must be confirmed and "
                    "attested by the guardian",
                )

        permitted = " ".join(self.permitted_uses).casefold()
        prohibited = " ".join(self.prohibited_uses).casefold()

        if self.scope == "evaluation":
            for required in _EVALUATION_PROHIBITIONS:
                if required not in prohibited:
                    raise ConsentViolation(
                        "evaluation-bars-publication",
                        f"an evaluation consent must explicitly prohibit {required}",
                    )
            return self

        if not (
            any(word in permitted for word in _PUBLICATION_WORDS)
            and any(word in permitted for word in _COURSE_WORDS)
        ):
            raise ConsentViolation(
                "publication-permits-course",
                "a publication consent must name a permitted use that allows publishing in this "
                "course; permitting publication in general is a broader grant than this product "
                "asks for and is not accepted in its place",
            )
        if not any(word in prohibited for word in _REDISTRIBUTION_WORDS):
            raise ConsentViolation(
                "publication-bars-redistribution",
                "a publication consent must still prohibit redistribution outside the course",
            )
        return self

    def canonical_json(self) -> str:
        """Sorted keys, no whitespace — the rule every hashed document in this studio uses."""

        return json.dumps(
            self.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )

    def sha256(self) -> str:
        return sha256_bytes(self.canonical_json().encode())


#: Which published rule a **field** constraint belongs to. Pydantic reports `authorized_purpose`
#: too short as a field error rather than as a rule violation, and an editor should not have to
#: learn two vocabularies for one requirement — so the field path is mapped onto the rule the form
#: printed. Anything unmapped is a malformed document rather than an unmet rule, and says so.
_FIELD_RULES: dict[str, str] = {
    "subject": "subject-named",
    "subject.display_name": "subject-named",
    "authorized_purpose": "purpose-stated",
    "retention": "retention-stated",
    "retention.policy": "retention-stated",
    "reference": "reference-sha-binding",
    "reference.sha256": "reference-sha-binding",
    "guardian_consent": "minor-guardian",
    "child_assent": "minor-assent",
}


def parse_consent(raw: str | bytes) -> VoiceConsent:
    """Read a consent document, and report a refusal **as a named rule**.

    Two failures reach this function and they arrive in different shapes. A scope rule raises
    `ConsentViolation` inside the model validator, which pydantic wraps — the original is recovered
    from the error's context, because a wrapped exception loses the rule id and the rule id is the
    only part an editor can act on. A field constraint (`authorized_purpose` under 20 characters)
    was never a `ConsentViolation` at all, and is mapped onto the rule it belongs to.
    """

    try:
        return VoiceConsent.model_validate_json(raw)
    except ValidationError as error:
        for entry in error.errors():
            original = entry.get("ctx", {}).get("error") if isinstance(entry.get("ctx"), dict) else None
            if isinstance(original, ConsentViolation):
                raise original from error
        first = error.errors()[0]
        path = ".".join(str(part) for part in first.get("loc", ()))
        rule = _FIELD_RULES.get(path, "consent-shape")
        raise ConsentViolation(rule, f"{path or 'consent'}: {first.get('msg', 'is invalid')}") from error


def rules_for(scope: ConsentScope, *, is_minor: bool) -> list[ConsentRule]:
    """The rules a document at this scope is actually held to.

    The form renders *these*, not all nine: a rule that cannot apply printed as a requirement is
    the fastest way to teach an editor that the list is decoration.
    """

    return [
        rule
        for rule in CONSENT_RULES
        if rule.applies in ("always", scope) and (is_minor or not rule.minors_only)
    ]


# -- the reference store ------------------------------------------------------
#
# Under the studio's app-data root and never the repository. `voices/<sha256>.wav` beside
# `voices/<sha256>.consent.json`: content-addressed, so the same recording submitted twice is one
# file, and the sidecar is the document the row's `consent_sha256` was taken from.


def voices_root(root: Path) -> Path:
    return root / "voices"


def reference_path(root: Path, reference_sha256: str) -> Path:
    return voices_root(root) / f"{reference_sha256}.wav"


def consent_path(root: Path, reference_sha256: str) -> Path:
    return voices_root(root) / f"{reference_sha256}.consent.json"


def demo_dir(root: Path, voice_id: str) -> Path:
    return voices_root(root) / voice_id


def store_reference(root: Path, audio: bytes, consent: VoiceConsent) -> tuple[str, str]:
    """Write the reference and its consent sidecar; return `(reference_sha256, consent_sha256)`.

    The binding is checked **here and only here**: a consent whose `reference.sha256` is not the
    digest of these exact bytes is refused before anything is written. That is the one rule the
    whole design rests on — without it a consent record is a permission slip with the name left
    blank.
    """

    digest = sha256_bytes(audio)
    if digest != consent.reference.sha256:
        raise ConsentViolation(
            "reference-sha-binding",
            f"the consent names {consent.reference.sha256} and the uploaded recording hashes to "
            f"{digest}",
        )
    voices_root(root).mkdir(parents=True, exist_ok=True)
    reference_path(root, digest).write_bytes(audio)
    consent_path(root, digest).write_text(consent.canonical_json())
    return digest, consent.sha256()


def load_consent(root: Path, reference_sha256: str) -> VoiceConsent:
    return parse_consent(consent_path(root, reference_sha256).read_text())


def delete_reference(root: Path, reference_sha256: str) -> bool:
    """Delete the recorded voice, keeping the consent sidecar. Returns whether bytes were removed.

    **The audio goes and the document stays**, and the asymmetry is the point. The recording is the
    person's voice — the thing retention is about, and the thing a withdrawal removes. The consent
    document is the evidence that the already-published renders were made with permission, and
    deleting it would leave those artifacts with a hash in their provenance and nothing behind it.
    """

    target = reference_path(root, reference_sha256)
    existed = target.exists()
    target.unlink(missing_ok=True)
    return existed


def revoke(store: Store, root: Path, voice_id: str) -> dict[str, object]:
    """Withdraw consent for one voice: refuse future synthesis, delete the recorded bytes.

    Three things happen and a fourth deliberately does not.

    * The row is marked revoked, with the date. `synthesize` refuses it from then on.
    * The reference recording is deleted (`delete_reference`).
    * Every demo rendered *through* this voice is deleted too — a demo is the person's voice, and
      keeping an audition of a withdrawn voice is keeping the thing that was withdrawn.
    * **Past renders are untouched.** Their provenance still names this voice, this reference sha
      and this consent sha, because that is what produced those bytes and a provenance record that
      edited itself on withdrawal would be a false one. Published artifacts are retired through the
      republish/retirement path instead; `docs/authoring/product-protection.md` names it.
    """

    row = store.get_voice(voice_id)
    if row is None:
        raise KeyError(voice_id)
    revoked_at = datetime.now(UTC).isoformat()
    store.revoke_voice(voice_id, revoked_at)
    removed = delete_reference(root, row.reference_sha256)
    demos = demo_dir(root, voice_id)
    demo_count = 0
    if demos.is_dir():
        for path in sorted(demos.glob("demo-*.wav")):
            path.unlink()
            demo_count += 1
    return {
        "id": voice_id,
        "revoked_at": revoked_at,
        "reference_deleted": removed,
        "demos_deleted": demo_count,
        "consent_sha256": row.consent_sha256,
        "note": (
            "Future synthesis through this voice is refused. Renders already produced keep their "
            "provenance; retiring published artifacts is the republish/retirement path."
        ),
    }


def voice_ref_of(row: VoiceReference) -> VoiceRef:
    """The stored row as the bound identity an engine and a node hash are given."""

    return VoiceRef(
        id=row.id,
        engine=row.engine,
        model_revision=row.model_revision,
        reference_sha256=row.reference_sha256,
        consent_sha256=row.consent_sha256,
    )


def clonable_of(root: Path, row: VoiceReference) -> ClonableVoice:
    """The row plus the bytes, as the cloning engine consumes it."""

    return ClonableVoice(
        ref=voice_ref_of(row),
        reference_path=reference_path(root, row.reference_sha256),
        ref_text=row.reference_text,
        x_vector_only=bool(row.x_vector_only),
    )


@dataclass(frozen=True)
class ResolvedVoices:
    """Everything a render needs to synthesize through stored voices.

    Two maps rather than one because they are consumed in two places that must not import each
    other: `clonable` goes into the engine, `refs` goes into the node parameters. A render that had
    only the engine's copy could not put the consent hash in the manifest, and a render that had
    only the identity could not make a sound.
    """

    clonable: dict[str, ClonableVoice]
    refs: dict[str, VoiceRef]


def resolve_voices(store: Store, root: Path, ids: Sequence[str]) -> ResolvedVoices:
    """Look up every named voice, refusing an unknown or a revoked one **by name**.

    Revocation is enforced here rather than in the engine for the same reason consent is: an
    engine that decided it could be swapped for one that did not.
    """

    clonable: dict[str, ClonableVoice] = {}
    refs: dict[str, VoiceRef] = {}
    for voice_id in dict.fromkeys(ids):
        row = store.get_voice(voice_id)
        if row is None:
            raise ValueError(
                f"this scene is cast on voice reference {voice_id}, which this studio does not "
                "have; create it under Figuren or with `atlas-listening voices create`"
            )
        if row.revoked_at is not None:
            raise ValueError(
                f"voice reference {voice_id} was revoked on {row.revoked_at[:10]}; consent was "
                "withdrawn and no further synthesis is made through it"
            )
        reference = reference_path(root, row.reference_sha256)
        if not reference.exists():
            raise ValueError(
                f"voice reference {voice_id} has no reference recording on this machine "
                f"({reference.name}); references are never in the repository and do not travel "
                "with a checkout"
            )
        clonable[voice_id] = clonable_of(root, row)
        refs[voice_id] = voice_ref_of(row)
    return ResolvedVoices(clonable=clonable, refs=refs)


def voice_row(root: Path, row: VoiceReference) -> dict[str, object]:
    """One stored voice as the API and the CLI render it.

    `reference_present` is measured rather than inferred from `revoked_at`: a checkout on another
    machine has the row (it is in the database) and not the bytes (they never leave app-data), and
    reporting that as *revoked* would invent a withdrawal that never happened.
    """

    return {
        "id": row.id,
        "subject_display_name": row.subject_display_name,
        "scope": row.scope,
        "engine": row.engine,
        "model_revision": row.model_revision,
        "reference_sha256": row.reference_sha256,
        "consent_sha256": row.consent_sha256,
        "guardian_consent": bool(row.guardian_consent),
        "child_assent": bool(row.child_assent),
        "retention": row.retention,
        "x_vector_only": bool(row.x_vector_only),
        "created_at": row.created_at,
        "revoked_at": row.revoked_at,
        "reference_present": reference_path(root, row.reference_sha256).exists(),
        "demo_urls": [
            f"/api/voices/{row.id}/demo/{index}"
            for index in range(3)
            if (demo_dir(root, row.id) / f"demo-{index + 1}.wav").exists()
        ],
    }
