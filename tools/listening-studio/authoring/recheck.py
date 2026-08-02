"""Re-run QA on named projects without re-synthesising them.

The audio is already generated and unchanged; what changed is the comparison. `Store.revise`
would reset the project to draft and throw the takes away, so this walks the stage machine back
to AUDIO_GENERATED instead and re-runs the check against the same bytes.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from listening_studio.adapters import wav_duration
from listening_studio.domain import Stage
from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path("../..").resolve()


def main() -> None:
    slugs = sys.argv[1:]
    store = Store()
    client = TestClient(app(store, REPO, token="t"))
    by_slug = {p.slug: p for p in store.projects()}

    for slug in slugs:
        project = by_slug[slug]
        if Stage(project.stage) is not Stage.AUDIO_GENERATED:
            store.reset_to(project.id, Stage.AUDIO_GENERATED)
        response = client.post(f"/projects/{project.id}/qa?token=t")
        _, revision, _ = store.get(project.id)
        qa = json.loads(revision.qa_json or "{}")
        inner = qa.get("final", qa)
        duration = wav_duration(store.root / "projects" / str(project.id) / "final.wav") or 0.0
        verdict = "PASS" if qa.get("passed") is True else "FAIL"
        print(
            f"{verdict} {slug:34s} WER {inner.get('full_wer', 0):.2f}  {duration:5.1f}s"
            f"  (http {response.status_code})",
            flush=True,
        )


if __name__ == "__main__":
    main()
