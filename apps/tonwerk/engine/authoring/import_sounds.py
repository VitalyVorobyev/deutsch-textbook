"""Fetch the reviewed Freesound context sounds and import them into the studio.

Every sound here was found by search, opened, and checked against the import contract before it
reached this file: CC0, no speech, no music, no brand, short enough to import whole. The file
actually downloaded is the site's public preview transcode — the uploader's master needs a
Freesound account — which is why each record carries `source_file` saying so rather than letting
`original_sha256` imply a file this repository never had.
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

#: sound_id -> (title, uploader, what it is used for, why it is safe to publish)
SOUNDS: dict[int, tuple[str, str, str, str]] = {
    178819: (
        "dialing tone_europe.mp3",
        "Felfa",
        "Kurzer europäischer Freizeichen-Ton vor einem Behördenanruf.",
        "Reiner Signalton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    765127: (
        "landline phone tone (loop)",
        "Anonio82",
        "Sehr leiser Leitungston unter einem Telefongespräch mit einer Arztpraxis.",
        "Elektronischer Ton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    369880: (
        "Alarm clock beep close perspective.wav",
        "SpliceSound",
        "Einzelner Signalton vor einer Nachricht auf dem Anrufbeantworter.",
        "Kurzer Piepton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    # A Berlin balcony recording would have suited the course better, but at 270 s it exceeds the
    # 120 s import cap, and trimming it before import would mean committing a file no Freesound
    # page serves. This one is distant city at 26.6 s and imports whole.
    457556: (
        "City far away",
        "florianreichelt",
        "Leiser, entfernter Straßenraum unter einer Wegauskunft im Freien.",
        "Entfernter Stadtraum ohne verständliche Sprache, Musik oder Marken; CC0 freigegeben.",
    ),
    474616: (
        "Railway Station Platform",
        "mycompasstv",
        "Leiser Bahnsteig unter einer Gleisdurchsage.",
        "Bahnsteigatmosphäre ohne verständliche Sprache, Musik oder Marken; CC0 freigegeben.",
    ),
    565536: (
        "Room tone Medium living room Apartment suburbia wood floor",
        "visionear",
        "Sehr leiser Wohnraum unter einer Sprachnachricht aus der Familie.",
        "Reiner Raumton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    579571: (
        "A quiet bedroom room tone with an ambient background",
        "leonelmail",
        "Sehr leiser Wohnraum unter einem privaten Gespräch über Freizeit.",
        "Reiner Raumton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    744447: (
        "Soft Room Tone",
        "callmethefoo",
        "Sehr leiser Wartezimmerton unter einem Gespräch am Praxisempfang.",
        "Reiner Raumton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    135097: (
        "Room Tone Office Quiet Distant Traffic.wav",
        "mzui",
        "Leiser Büroraum unter einer Arbeitsanweisung.",
        "Raumton mit entferntem Verkehr, ohne Sprache, Musik oder Marken; CC0 freigegeben.",
    ),
    146435: (
        "room tone_M24",
        "pushkin",
        "Leiser Unterrichtsraum unter einer Kursanweisung.",
        "Reiner Raumton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
    637807: (
        "room tone small space dead quiet air tone.flac",
        "kyles",
        "Sehr leiser kleiner Beratungsraum unter einem Beratungsgespräch.",
        "Reiner Raumton ohne Sprache, Musik oder Marken; CC0 vom Uploader freigegeben.",
    ),
}

CC0 = "https://creativecommons.org/publicdomain/zero/1.0/"


def preview_url(sound_id: int) -> tuple[str, str]:
    """The public preview URL and the canonical page URL, read off the sound page."""

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
    (WORK / "imported.json").write_text(json.dumps(imported, indent=2))
    print(f"\n{len(imported)}/{len(SOUNDS)} imported")


if __name__ == "__main__":
    main()
