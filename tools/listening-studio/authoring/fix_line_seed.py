"""Re-roll a single line whose take came out wrong.

Qwen3-TTS is deterministic per `line_cache_key`, and the seed is part of that key, so a
line that lands badly is re-rolled rather than argued with. Two Wave-2 lines were fixed
this way already — `Davor` read as "Der Woa", and `Einen Kaffee … einen Salat` reduced to
`Ein … ein` in the recording whose whole job is the accusative.

This one is a tempo failure rather than a pronunciation one. `ls-gesundheit-wohlbefinden-01`
line-9, "Und das Essen am Schreibtisch?", came out at 8.32 s for five words — 0.60 w/s,
with five internal pauses totalling 2.08 s, roughly 0.45 s between every word. The
comparable five-word line in the same dialogue ("So wenig soll etwas bringen?") runs 3.20 s
with no internal pause at all. Vitaly heard it as jagged tempo, and a corpus-wide scan for
the signature (three or more internal gaps of 0.28 s or longer) found this line and one
false positive — a thirteen-word sentence pausing at its commas, which is correct prosody.

The line keeps its "höflich und etwas zögernd" style: hesitancy is right for the character
asking for help, and the model simply took it to an extreme on a short question.
"""

from __future__ import annotations

from listening_studio.domain import RevisionPayload
from listening_studio.storage import Store

#: slug -> {line_id: new seed}
SEEDS: dict[str, dict[str, int]] = {
    "ls-gesundheit-wohlbefinden-01": {"line-9": 908},
}


def main() -> None:
    store = Store()
    by_slug = {p.slug: p for p in store.projects()}

    for slug, wanted in SEEDS.items():
        project = by_slug[slug]
        _, _, payload = store.get(project.id)
        lines = []
        for line in payload.lines:
            seed = wanted.get(line.id)
            lines.append(line.model_dump() | ({"seed": seed} if seed is not None else {}))
        updated = RevisionPayload.model_validate(payload.model_dump() | {"lines": lines})
        if updated.canonical_json() == payload.canonical_json():
            print(f"  {slug:32s} unchanged")
            continue
        store.revise(project.id, updated)
        changed = ", ".join(f"{lid} -> seed {s}" for lid, s in wanted.items())
        print(f"  {slug:32s} {changed}")


if __name__ == "__main__":
    main()
