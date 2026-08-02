"""One seed per speaker, so a character keeps the same voice for a whole dialogue.

Lines were seeded `100 + index`, which gives every line of a dialogue its own seed. Qwen3-TTS
holds the *timbre* of a preset but not the speaker's age or energy: with the preset fixed and
the seed varying, the same character drifts from line to line.

Measured on `ls-gesundheit-wohlbefinden-01`, median F0 per line (autocorrelation, 70-300 Hz,
voiced frames only):

    Herr Klein   141.6 · 166.7 · 146.8 · 98.2 · 185.3 · 95.8 Hz    spread 89.5 Hz, sd 32.9
    Beraterin    254.0 · 235.3 · 250.0 · 233.6 · 254.0 · 275.9 Hz  spread 42.3 Hz, sd 14.1

Herr Klein covers nearly an octave inside one conversation — 95.8 Hz is an old, failing voice
and 185.3 Hz is a much younger one. Vitaly heard exactly that: "in the first phrase the man
sounds like he is almost dying, and by the end he is young and full of energy."

Seeding per speaker rather than per line removes the variable. The text still differs line by
line, so the audio does too; what stays fixed is the sampling point the voice is drawn from.
"""

from __future__ import annotations

from listening_studio.domain import RevisionPayload
from listening_studio.storage import Store

#: slug -> {speaker: seed}. Distinct seeds per speaker inside an artifact, so two characters
#: are never drawn from the same point.
SPEAKER_SEEDS: dict[str, dict[str, int]] = {
    "ls-gesundheit-wohlbefinden-01": {"Herr Klein": 100, "Beraterin": 105},
}


def main() -> None:
    store = Store()
    by_slug = {p.slug: p for p in store.projects()}

    for slug, seeds in SPEAKER_SEEDS.items():
        project = by_slug[slug]
        _, _, payload = store.get(project.id)
        unknown = {line.speaker for line in payload.lines} - set(seeds)
        if unknown:
            raise SystemExit(f"{slug}: no seed given for {sorted(unknown)}")
        lines = [line.model_dump() | {"seed": seeds[line.speaker]} for line in payload.lines]
        updated = RevisionPayload.model_validate(payload.model_dump() | {"lines": lines})
        if updated.canonical_json() == payload.canonical_json():
            print(f"  {slug:32s} unchanged")
            continue
        store.revise(project.id, updated)
        shown = ", ".join(f"{s} -> {v}" for s, v in seeds.items())
        print(f"  {slug:32s} {shown}")


if __name__ == "__main__":
    main()
