"""Move every scene-opening sound off the dialogue and in front of it.

Five artifacts placed a sound that names a moment *before* anyone speaks — a ring-back
tone, a Freizeichen, an answering-machine beep — at `delay_ms=0` over the opening line.
The result is a phone ringing while the person who answered it is already talking. Vitaly
heard it in `ls-termine-vereinbaren-01` and `ls-wohnen-umzug-01`; the same placement was
on three more.

It was not an authoring slip so much as a missing capability: `adelay` moves a context
sound later and never earlier, and `amix duration=first` cuts the mix to the speech, so
the mixer could not express "ring, then hello" at all. `RevisionPayload.lead_in_ms` adds
the silence the sound needs, and this script sets it.

The rule used here: **the lead-in equals the sound's own length**, so the opener finishes
exactly as the first word starts. Gains rise at the same time — these were mixed to sit
under speech at -20 to -26 dB, and a cue that now plays alone has to be audible.

Two of the five (`ls-erste-schritte-01`, `ls-alltag-zeit-01`) were already approved. The
mix changes, so the approval no longer vouches for these bytes and the studio will ask
for it again. That is the contract working, not a regression.
"""

from __future__ import annotations

import json

from listening_studio.domain import ContextSound, RevisionPayload
from listening_studio.storage import Store

#: slug -> (lead_in_ms, start_ms, duration_ms, gain_db)
#:
#: Every window below was measured off the source rather than guessed, because a trim that
#: keeps a file's trailing silence buys a dead gap in front of the dialogue — the first pass
#: gave `ls-erste-schritte-01` 1.5 s of ringing followed by 2 s of nothing:
#:   765127 — 2 s on / 2 s off, three times; 2200 ms is one whole ring plus a breath.
#:   178819 — audible only for its first 1.5 s of 4.0 s.
#:   369880 — 0.5 s of silence, then a beep every 0.5 s to the end; one beep is 500 ms in.
FIX: dict[str, tuple[int, int, int, float]] = {
    "ls-erste-schritte-01": (1700, 0, 1600, -17.0),
    "ls-termine-vereinbaren-01": (2200, 0, 2200, -17.0),
    "ls-wohnen-umzug-01": (2200, 0, 2200, -17.0),
    "ls-reisen-probleme-01": (2200, 0, 2200, -17.0),
}

#: Artifacts whose opener is removed rather than moved.
#:
#: `ls-alltag-zeit-01` wanted an answering-machine beep before the voice message, and the
#: imported source cannot supply one: its beep sits at -43 dBFS, so even at the loudest gain
#: the model permits it lands ~24 dB under the speech — measured at -59.6 dBFS against -18.9
#: after the lead-in was added. `gain_db` is capped at -12 dB because contextual audio must
#: stay under the dialogue, which is the right rule for a bed and the wrong one for a cue
#: playing alone; raising the cap for this file would still leave the beep inaudible, because
#: the source is quiet, not the gain. A cue nobody can hear is a provenance entry and a hash
#: for no learner benefit, so the message simply starts — which its first line already
#: establishes ("Hallo Tom, hier ist Sara"). Filed as the capability gap it is.
DROP = ["ls-alltag-zeit-01"]

#: Both imported descriptions were wrong about what the file contains, and one of them
#: produced the placement Vitaly heard. Provenance text that misdescribes a file is the same
#: defect as the mix it justifies, so it is corrected from the measured envelope.
REDESCRIBE = {
    765127: "Europäischer Rufton (Freizeichen) vor dem Abheben; gemessene Kadenz 2 s an / 2 s aus.",
    369880: "Anrufbeantworter-Signalton, im Original alle 0,5 s wiederholt; verwendet wird ein einzelner Ton.",
}


def main() -> None:
    store = Store()
    by_slug = {p.slug: p for p in store.projects()}

    for sound_id, description in REDESCRIBE.items():
        for path in (store.root / "sources").rglob("source.json"):
            data = json.loads(path.read_text())
            if data.get("sound_id") != sound_id or data["description"] == description:
                continue
            data["description"] = description
            path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
            print(f"  redescribed {sound_id}")

    for slug in DROP:
        project = by_slug[slug]
        _, _, payload = store.get(project.id)
        updated = RevisionPayload.model_validate(
            payload.model_dump() | {"context_sounds": [], "lead_in_ms": 0}
        )
        if updated.canonical_json() == payload.canonical_json():
            print(f"  {slug:32s} unchanged")
            continue
        store.revise(project.id, updated)
        print(f"  {slug:32s} opener removed (source too quiet to be heard)")

    for slug, (lead_in, start, duration, gain) in FIX.items():
        project = by_slug[slug]
        _, _, payload = store.get(project.id)
        if len(payload.context_sounds) != 1:
            raise SystemExit(f"{slug} carries {len(payload.context_sounds)} sounds, expected 1")
        old = payload.context_sounds[0]
        updated = RevisionPayload.model_validate(
            payload.model_dump()
            | {
                "lead_in_ms": lead_in,
                "context_sounds": [
                    ContextSound(
                        source_sha256=old.source_sha256,
                        sound_id=old.sound_id,
                        start_ms=start,
                        duration_ms=duration,
                        delay_ms=0,
                        gain_db=gain,
                    ).model_dump()
                ],
            }
        )
        # Idempotent for the same reason the wave scripts are: revising returns a project to
        # draft and throws its QA away.
        if updated.canonical_json() == payload.canonical_json():
            print(f"  {slug:32s} unchanged")
            continue
        store.revise(project.id, updated)
        print(f"  {slug:32s} lead-in {lead_in} ms, sound {old.sound_id} {duration} ms @ {gain} dB")


if __name__ == "__main__":
    main()
