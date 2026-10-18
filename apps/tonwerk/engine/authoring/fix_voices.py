"""Give two women a woman's voice.

`Line.voice` defaults to `"Ryan"`, a male preset, so a line whose voice was never set
silently ships as a man. Across the corpus 76 of 78 speaker/voice pairs agree with their
speaker label; the two that do not are both `Ryan` on a `Frau`, which is what a forgotten
field looks like rather than a choice. Vitaly heard `Frau Behrens` in `ls-arbeit-beruf-01`;
the audit that followed found `Frau Kaya` in `ls-termine-vereinbaren-01` as well.

It matters more than it sounds. These are comprehension items where the learner has to
track who says what, and a voice that contradicts its own speaker label removes the
strongest cue for doing that.

Each replacement is a female preset the scene is not already using, so the two speakers
stay distinguishable: `ls-arbeit-beruf-01` already has Mira on Vivian, and
`ls-termine-vereinbaren-01` has the Praxis on Serena.

Changing a voice changes `line_cache_key`, so these lines are genuinely re-synthesised —
unlike the mix-only fixes. `ls-arbeit-beruf-01` is approved, and the new bytes will need
approving again.
"""

from __future__ import annotations

from listening_studio.domain import RevisionPayload
from listening_studio.storage import Store

#: slug -> {speaker: voice}
VOICES: dict[str, dict[str, str]] = {
    "ls-arbeit-beruf-01": {"Frau Behrens": "Ono_Anna"},
    "ls-termine-vereinbaren-01": {"Frau Kaya": "Vivian"},
}


def main() -> None:
    store = Store()
    by_slug = {p.slug: p for p in store.projects()}

    for slug, wanted in VOICES.items():
        project = by_slug[slug]
        _, _, payload = store.get(project.id)
        lines = []
        for line in payload.lines:
            voice = wanted.get(line.speaker)
            lines.append(line.model_dump() | ({"voice": voice} if voice else {}))
        updated = RevisionPayload.model_validate(payload.model_dump() | {"lines": lines})
        if updated.canonical_json() == payload.canonical_json():
            print(f"  {slug:32s} unchanged")
            continue
        store.revise(project.id, updated)
        changed = ", ".join(f"{s} -> {v}" for s, v in wanted.items())
        print(f"  {slug:32s} {changed}")


if __name__ == "__main__":
    main()
