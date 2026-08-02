"""Attach context sounds to the Wave-2 recordings.

Two rules decide every placement here, and both were learned the hard way in Wave 1.

**A bed has to outlast the speech.** `mix_context` does not loop, and `amix duration=first` cuts
the mix to the speech, so a 13-second room tone under a 45-second dialogue is 13 seconds of
ambience followed by an audible drop into silence. Long room tones are therefore the only
sources used as beds; the short specific sounds — a door, a bottle, a drip, a dial tone — are
used as events at the top of a scene, where stopping is what they are supposed to do.

**The scene decides, not the plan's wording.** Eight of the eighteen planned sounds name a place
whose defining sound is other people talking: café, market, shop floor, counter hall, party
room, community room. Intelligible speech is refused by the import contract, and it would be the
wrong choice regardless — competing voices under a comprehension item do not make it authentic,
they silently make it a harder task than the item claims to measure, at the levels least able to
absorb that. Those scenes get a neutral room tone at low level instead, and this file is the
record of that substitution.
"""

from __future__ import annotations

import json
from pathlib import Path

from listening_studio.domain import ContextSound, RevisionPayload
from listening_studio.storage import Store

WORK = Path("/private/tmp/claude-501/-Users-vitalyvorobyev-nonvision-deutsch-textbook/740c9c4c-dac1-475b-9cac-b583e6e8c946/scratchpad/sounds")

#: slug -> list of (sound_id, start_ms, duration_ms, delay_ms, gain_db)
PLACEMENT: dict[str, list[tuple[int, int, int, int, float]]] = {
    # Furniture shop. Planned "Markt-Hintergrund"; a market is voices, so a neutral shop room.
    "ls-artikel-genus-01": [(146435, 8_000, 30_000, 0, -25.0)],
    # Café. Planned "Café-Raumton"; same reason.
    "ls-akkusativ-01": [(744447, 10_000, 35_000, 0, -26.0)],
    # Outdoor market stall — the one shopping scene where distant street really is the sound.
    "ls-essen-einkaufen-01": [(457556, 2_000, 24_000, 0, -24.0)],
    # A viewing starts with a door. Exactly what the plan asked for.
    "ls-wohnen-01": [(343388, 0, 2_500, 0, -20.0), (637807, 10_000, 45_000, 0, -27.0)],
    # Neighbours at the door: the hallway as an opening event, a room tone underneath it.
    "ls-dativ-01": [(801116, 0, 12_000, 0, -24.0), (146435, 20_000, 55_000, 0, -27.0)],
    # A voice message from home. Planned door/traffic hints belong to no one in this scene.
    "ls-trennbare-verben-01": [(565536, 2_000, 30_000, 0, -26.0)],
    # A couple rearranging the afternoon — nobody is waking up, so no Weckton.
    "ls-alltag-tagesablauf-01": [(565536, 4_000, 28_000, 0, -26.0)],
    # This one is a phone call, per the plan's own scenario line.
    "ls-wohnen-umzug-01": [(765127, 500, 11_000, 0, -27.0)],
    "ls-einkaufen-reklamation-01": [(135097, 6_000, 55_000, 0, -25.0)],
    "ls-relativsaetze-01": [(637807, 8_000, 50_000, 0, -26.0)],
    # A burst pipe and a wet cellar: the drip is the incident the plan asks to hint at.
    "ls-verbindungen-folgen-01": [(547253, 1_000, 12_000, 0, -22.0), (135097, 15_000, 45_000, 0, -27.0)],
    "ls-man-und-besitz-01": [(801116, 0, 12_000, 0, -24.0), (637807, 20_000, 40_000, 0, -27.0)],
    # An invitation, not the party itself.
    "ls-freunde-feste-01": [(579571, 4_000, 38_000, 0, -26.0)],
    "ls-aemter-dienstleistungen-01": [(744447, 5_000, 60_000, 0, -25.0)],
    "ls-arbeit-bewerbung-01": [(135097, 4_000, 60_000, 0, -26.0)],
    # A bottle into the container is what the conversation is about.
    "ls-konsum-umwelt-01": [(805574, 0, 2_400, 0, -20.0), (146435, 12_000, 75_000, 0, -27.0)],
    "ls-regeln-verantwortung-01": [(146435, 6_000, 85_000, 0, -26.0)],
    # A call to customer service after the journey, not a recording made at the station.
    "ls-reisen-probleme-01": [(765127, 500, 11_000, 0, -27.0)],
}


def main() -> None:
    store = Store()
    imported: dict[str, str] = json.loads((WORK / "imported.json").read_text())
    by_slug = {p.slug: p for p in store.projects()}

    for slug, placements in PLACEMENT.items():
        project = by_slug[slug]
        _, _, payload = store.get(project.id)
        contexts = [
            ContextSound(
                source_sha256=imported[str(sound_id)],
                sound_id=sound_id,
                start_ms=start,
                duration_ms=duration,
                delay_ms=delay,
                gain_db=gain,
            ).model_dump()
            for sound_id, start, duration, delay, gain in placements
        ]
        updated = RevisionPayload.model_validate(
            payload.model_dump() | {"context_sounds": contexts}
        )
        # Idempotent for the same reason wave2.py is: revising returns a project to draft, and
        # re-running this over all eighteen to change one placement costs eighteen QA runs.
        if updated.canonical_json() == payload.canonical_json():
            continue
        store.revise(project.id, updated)
        names = ", ".join(str(p[0]) for p in placements)
        print(f"  {slug:34s} <- {names}")

    print(f"\n{len(PLACEMENT)} of 29 Wave-2 recordings carry a context sound")


if __name__ == "__main__":
    main()
