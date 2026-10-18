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

#: Artifacts where a speaker's median F0 spans more than 60 Hz inside one dialogue — the point
#: at which the drift stops sounding like intonation and starts sounding like a second person.
#: Measured across all 68 speakers with three or more lines: median spread 47 Hz, these 19 above
#: 60 Hz, worst 126.2 Hz (ls-reisen-verkehr-01's Durchsage, 93.0-219.2 Hz).
#:
#: **Deliberately not the whole corpus.** Re-synthesis changes the bytes, and an approval is
#: bound to `final_sha256`/`dry_sha256` precisely so a manifest can never claim a human approved
#: audio they did not hear. Touching only what measurably needs it keeps 22 of the 41 approvals
#: standing instead of none.
DRIFTED = [
    "ls-reisen-verkehr-01", "ls-modalverben-01", "ls-freunde-feste-01", "ls-konsum-umwelt-01",
    "ls-einkaufen-reklamation-01", "ls-man-und-besitz-01", "ls-verbindungen-folgen-01",
    "ls-termine-vereinbaren-01", "ls-alltag-zeit-01", "ls-stadt-wege-01",
    "ls-nebensaetze-plaene-01", "ls-trennbare-verben-01", "ls-biografie-erfahrungen-01",
    "ls-wohnen-umzug-01", "ls-perfekt-haben-sein-01", "ls-wohnen-01",
    "ls-praesens-wortstellung-01", "ls-dativ-01", "ls-erfahrungen-erzaehlen-01",
]

#: Explicit overrides where a hand-picked pair is already known good.
SPEAKER_SEEDS: dict[str, dict[str, int]] = {
    "ls-gesundheit-wohlbefinden-01": {"Herr Klein": 100, "Beraterin": 105},
}


def seeds_for(payload: RevisionPayload) -> dict[str, int]:
    """One seed per speaker, spaced so two characters are never drawn from the same point."""

    order: list[str] = []
    for line in payload.lines:
        if line.speaker not in order:
            order.append(line.speaker)
    return {speaker: 100 + 5 * index for index, speaker in enumerate(order)}


def main() -> None:
    store = Store()
    by_slug = {p.slug: p for p in store.projects()}
    plan = dict(SPEAKER_SEEDS)
    for slug in DRIFTED:
        if slug not in plan:
            _, _, payload = store.get(by_slug[slug].id)
            plan[slug] = seeds_for(payload)

    for slug, seeds in plan.items():
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
