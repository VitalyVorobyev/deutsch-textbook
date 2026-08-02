"""Drive validate -> generate -> qa over every Wave-2 project, reporting as it goes."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from listening_studio.adapters import wav_duration
from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path("../..").resolve()

WAVE2_SLUGS = [
    "ls-praesens-wortstellung-01", "ls-artikel-genus-01", "ls-akkusativ-01",
    "ls-essen-einkaufen-01", "ls-wohnen-01", "ls-dativ-01", "ls-trennbare-verben-01",
    "ls-modalverben-01", "ls-perfekt-haben-sein-01", "ls-alltag-tagesablauf-01",
    "ls-wohnen-umzug-01", "ls-einkaufen-reklamation-01", "ls-adjektive-deklination-01",
    "ls-verben-mit-praepositionen-01", "ls-nebensaetze-plaene-01", "ls-infinitiv-mit-zu-01",
    "ls-relativsaetze-01", "ls-biografie-erfahrungen-01", "ls-verbindungen-folgen-01",
    "ls-man-und-besitz-01", "ls-freunde-feste-01", "ls-aemter-dienstleistungen-01",
    "ls-leben-veraendern-01", "ls-gesundheit-wohlbefinden-01", "ls-arbeit-bewerbung-01",
    "ls-meinung-medien-01", "ls-konsum-umwelt-01", "ls-regeln-verantwortung-01",
    "ls-reisen-probleme-01",
]


def main() -> None:
    only = sys.argv[1:] or WAVE2_SLUGS
    store = Store()
    client = TestClient(app(store, REPO, token="t"))
    by_slug = {p.slug: p for p in store.projects()}

    for index, slug in enumerate(only, 1):
        project = by_slug[slug]
        for action in ["validate", "generate", "qa"]:
            response = client.post(f"/projects/{project.id}/{action}?token=t")
            if response.status_code != 200:
                print(f"[{index:2d}/{len(only)}] !! {slug} {action} -> {response.status_code}", flush=True)
                break
        else:
            _, revision, _ = store.get(project.id)
            qa = json.loads(revision.qa_json or "{}")
            inner = qa.get("final", qa)
            duration = wav_duration(store.root / "projects" / str(project.id) / "final.wav") or 0.0
            verdict = "PASS" if qa.get("passed") is True else "FAIL"
            print(
                f"[{index:2d}/{len(only)}] {verdict} {slug:34s} "
                f"WER {inner.get('full_wer', 0):.2f}  {duration:5.1f}s",
                flush=True,
            )


if __name__ == "__main__":
    main()
