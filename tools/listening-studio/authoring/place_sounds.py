"""Attach each imported context sound to its recording, then re-mix and re-check.

Placement is per scene, not per plan word. Two of the plan's `context_sound` lines were written
before the scripts existed and do not describe the scene that was drafted:

  * ls-freizeit-koennen-01 plans a "Sportstätten-Raumton", but the two speakers are deciding
    whether to go swimming and settle on the park — nobody is in a sports hall. A very quiet
    domestic room is what the dialogue actually sounds like from.
  * ls-alltag-zeit-01 plans "ein einzelner Uhr- oder Weckton" for what is an answering-machine
    message. A single short beep before the message is the cue that carries meaning here, so the
    alarm sample is trimmed to one beep and used as the answerphone tone.

Signal sounds (dial tone, line tone, beep) are short and sit at the start, before or under the
first line. Room tones run under the whole recording. Everything stays at or below -18 dB, and
the speech-only take is preserved untouched as `dry.wav` for QA.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from listening_studio.domain import ContextSound, RevisionPayload
from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path("../..").resolve()
WORK = Path("/private/tmp/claude-501/-Users-vitalyvorobyev-nonvision-deutsch-textbook/740c9c4c-dac1-475b-9cac-b583e6e8c946/scratchpad/sounds")

#: slug -> (sound_id, start_ms, duration_ms, delay_ms, gain_db)
#:
#: A room tone is taken from a settled part of the file and run long enough to cover the take;
#: `amix=duration=first` cuts it to the speech, so over-long is safe and under-long is not.
PLACEMENT: dict[str, tuple[int, int, int, int, float]] = {
    # Freizeichen: two rings, then it stops as the office picks up.
    "ls-erste-schritte-01": (178819, 0, 3_500, 0, -20.0),
    # Leitungston under the whole call, very low.
    "ls-termine-vereinbaren-01": (765127, 500, 11_000, 0, -26.0),
    # One beep, then the message. Trimmed to the first beep of the sample.
    "ls-alltag-zeit-01": (369880, 0, 900, 0, -22.0),
    "ls-stadt-wege-01": (457556, 2_000, 24_000, 0, -20.0),
    "ls-reisen-verkehr-01": (474616, 3_000, 45_000, 0, -19.0),
    "ls-menschen-familie-01": (565536, 2_000, 30_000, 0, -24.0),
    "ls-freizeit-koennen-01": (579571, 4_000, 38_000, 0, -26.0),
    "ls-gesundheit-arzttermin-01": (744447, 5_000, 90_000, 0, -24.0),
    "ls-arbeit-beruf-01": (135097, 4_000, 60_000, 0, -22.0),
    "ls-lernen-verstehen-01": (146435, 5_000, 95_000, 0, -25.0),
    "ls-lernen-zukunft-01": (637807, 5_000, 110_000, 0, -26.0),
}


def main() -> None:
    store = Store()
    client = TestClient(app(store, REPO, token="t"))
    imported: dict[str, str] = json.loads((WORK / "imported.json").read_text())
    projects = {p.slug: p for p in store.projects()}

    for slug, (sound_id, start, duration, delay, gain) in PLACEMENT.items():
        sha = imported[str(sound_id)]
        project = projects[slug]
        _, _, payload = store.get(project.id)
        context = ContextSound(
            source_sha256=sha,
            sound_id=sound_id,
            start_ms=start,
            duration_ms=duration,
            delay_ms=delay,
            gain_db=gain,
        )
        updated = RevisionPayload.model_validate(
            payload.model_dump() | {"context_sounds": [context.model_dump()]}
        )
        store.revise(project.id, updated)
        print(f"  {slug:32s} <- {sound_id} at {gain:+.0f} dB")

    print("\nre-running validate -> generate -> qa")
    for slug in PLACEMENT:
        project = projects[slug]
        for action in ["validate", "generate", "qa"]:
            response = client.post(f"/projects/{project.id}/{action}?token=t")
            if response.status_code != 200:
                print(f"  !! {slug} {action} -> {response.status_code}")
                break
        else:
            print(f"  ok {slug}")


if __name__ == "__main__":
    main()
