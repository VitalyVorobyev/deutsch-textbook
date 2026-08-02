"""Re-roll a single line whose take came out wrong.

Qwen3-TTS is deterministic per `line_cache_key`, and the seed is part of that key, so a
line that lands badly is re-rolled rather than argued with. Two Wave-2 lines were fixed
this way already — `Davor` read as "Der Woa", and `Einen Kaffee … einen Salat` reduced to
`Ein … ein` in the recording whose whole job is the accusative.

These two are tempo failures rather than pronunciation ones, and they failed differently —
which is why it took two instruments to find them.

`line-9`, "Und das Essen am Schreibtisch?", came out at 8.32 s for five words with five
internal pauses totalling 2.08 s: roughly 0.45 s of silence between every word. The
comparable five-word line in the same dialogue runs 3.20 s with no internal pause at all.
A scan for that signature — three or more internal gaps of 0.28 s or longer — found this
line and one false positive (a thirteen-word sentence pausing at its commas, which is
correct prosody).

`line-2`, "Wie sieht denn ein normaler Tag bei Ihnen aus?", had no such signature and the
scan missed it. It was slow in three small ways at once: articulation 2.55 words per second
of speech against a corpus median of 2.96, leading silence 0.60 s against 0.43, trailing
0.78 s against 0.46. Since `assemble` then adds `pause_after_ms` on top, the gap after it
ran past 1.2 s. Words per second of *wall clock* cannot see this — short utterances are
dominated by fixed pause overhead, so that metric ranks "Und heute?" as the slowest line in
the corpus when it is perfectly normal. Words per second of *voiced audio*, with the silence
split into lead / internal / trail, is what shows it.

Both keep their authored style. Hesitancy suits a man asking for help; the model simply took
it to an extreme, and a different seed is the remedy the corpus already uses.
"""

from __future__ import annotations

from listening_studio.domain import RevisionPayload
from listening_studio.storage import Store

#: slug -> {line_id: new seed}
SEEDS: dict[str, dict[str, int]] = {
    "ls-gesundheit-wohlbefinden-01": {"line-9": 908, "line-2": 901},
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
