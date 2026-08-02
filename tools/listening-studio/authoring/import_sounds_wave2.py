"""Four more reviewed Freesound sources, for the Wave-2 scenes the Wave-1 set does not cover.

Deliberately small. Eighteen Wave-2 artifacts name a context sound, but most of those names —
café, market, shop floor, counter hall, party room — describe places whose defining sound is
other people talking. A recording of intelligible speech is refused by the import contract, and
it would be the wrong choice even if it were not: competing voices under a listening exercise
do not make it authentic, they make it a different and harder task than the one the item claims
to measure. Those scenes reuse the neutral room tones already imported, at low level.

What is imported here is what the Wave-1 set genuinely lacks: a stairwell, a door, a dripping
cellar and a bottle going into a glass container — all of them specific, none of them speech.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

from listening_studio.sources import import_source
from listening_studio.storage import Store

WORK = Path("/private/tmp/claude-501/-Users-vitalyvorobyev-nonvision-deutsch-textbook/740c9c4c-dac1-475b-9cac-b583e6e8c946/scratchpad/sounds")

SOUNDS: dict[int, tuple[str, str, str, str]] = {
    801116: (
        "Cold Hallway Ambience",
        "9voltplasma",
        "Leiser Hausflur unter Nachbarschaftsgesprächen im Treppenhaus.",
        "Reiner Raumton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    343388: (
        "Household door close, INT.wav",
        "LOVEBURD",
        "Kurzes Türgeräusch am Anfang einer Wohnungsszene.",
        "Einzelnes Türgeräusch ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    547253: (
        "Drip drops leaky basement",
        "antwerpsounddesign",
        "Leises Tropfen im nassen Keller nach einem Rohrbruch.",
        "Wassertropfen ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    805574: (
        "Glass bottle tossed into recycling",
        "giddster",
        "Kurzes Glasgeräusch am Anfang eines Gesprächs über Recycling.",
        "Einzelnes Glasgeräusch ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
}

CC0 = "https://creativecommons.org/publicdomain/zero/1.0/"


def preview_url(sound_id: int) -> tuple[str, str]:
    page = subprocess.run(
        ["curl", "-sL", "--max-time", "30", "-A", "Mozilla/5.0", f"https://freesound.org/s/{sound_id}/"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    if "publicdomain/zero" not in page:
        raise ValueError(f"{sound_id} is not CC0 on the page — refusing to import")
    previews = sorted(set(re.findall(r"https://cdn\.freesound\.org/previews/[^\"' ]+-hq\.mp3", page)))
    if not previews:
        raise ValueError(f"{sound_id} exposes no hq preview")
    return previews[0], f"https://freesound.org/s/{sound_id}/"


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    store = Store()
    imported: dict[int, str] = {}
    for sound_id, (title, uploader, description, risk) in SOUNDS.items():
        url, page_url = preview_url(sound_id)
        audio = WORK / f"{sound_id}.mp3"
        if not audio.exists():
            subprocess.run(["curl", "-sL", "--max-time", "90", "-A", "Mozilla/5.0", url, "-o", str(audio)], check=True)
        metadata = WORK / f"{sound_id}.json"
        metadata.write_text(
            json.dumps(
                {
                    "sound_id": sound_id,
                    "page_url": page_url,
                    "title": title,
                    "uploader": uploader,
                    "retrieved_at": str(date.today()),
                    "license": "CC0-1.0",
                    "license_url": CC0,
                    "description": description,
                    "rights_risk_note": risk,
                    "source_file": "preview-hq",
                    "contains_speech": False,
                    "contains_music": False,
                    "contains_brands": False,
                    "contains_personal_data": False,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        try:
            source = import_source(audio, metadata, store.root)
        except Exception as exc:  # noqa: BLE001
            print(f"  !! {sound_id}: {exc}", file=sys.stderr)
            continue
        imported[sound_id] = source.original_sha256
        print(f"  ok {sound_id:7d}  {source.duration_seconds:6.1f}s  {source.original_bytes/1e6:5.2f} MB  {title[:44]}")

    existing = json.loads((WORK / "imported.json").read_text())
    existing.update({str(k): v for k, v in imported.items()})
    (WORK / "imported.json").write_text(json.dumps(existing, indent=2))
    print(f"\n{len(imported)}/{len(SOUNDS)} imported; {len(existing)} sources total")


if __name__ == "__main__":
    main()
