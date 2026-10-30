"""`GET /api/registry` — the join of plan, published content, studio database and exercises.

The fixture is a whole small course repository rather than a mock, because every finding this
endpoint produces is a *disagreement between two files*, and a mock of one side cannot disagree
with anything. Four planned artifacts and one Lesetext are enough to put one row in each state
the vocabulary has, including the one no file-only derivation can reach: `stale`.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import yaml
from fastapi.testclient import TestClient

from listening_studio.domain import Bilingual, Stage
from listening_studio.scene.model import Scene
from listening_studio.storage import Store
from listening_studio.web import app
from test_graph_render import cafe_scene, narration_scene, tone_in_store

AUTH = {"Authorization": "Bearer test"}


def plan_entry(slug: str, wave: int = 1) -> dict[str, Any]:
    return {
        "id": slug,
        "wave": wave,
        "purpose": "listening-outcome",
        "scenario": f"Szenario {slug}",
        "duration_seconds": {"min": 20, "max": 40},
        "speakers": {"min": 2, "max": 2},
        "item_types": ["audio-comprehension"],
    }


def provenance(slug: str, scene_sha: str | None, *, approved: bool = True) -> dict[str, Any]:
    """A published provenance manifest, cut down to the fields the registry reads.

    `scene_sha=None` is a pre-scene manifest: version 1, which hashes another document and names
    no scene at all.
    """

    return {
        "version": 2 if scene_sha else 1,
        "id": slug,
        **({"scene_sha256": scene_sha} if scene_sha else {"revision_sha256": "f" * 64}),
        "qa": {"passed": True},
        "approval": {
            "status": "complete" if approved else "declined",
            "editor": "Vitaly Vorobyev",
            "checklist": ["accent"],
        },
    }


def publish(repo: Path, slug: str, level: str, manifest: dict[str, Any]) -> None:
    """Everything `deriveStatus` calls published: the record, the audio and the provenance."""

    listening = repo / "content" / "listening" / level.lower()
    listening.mkdir(parents=True, exist_ok=True)
    (listening / f"{slug}.yaml").write_text(yaml.safe_dump({"id": slug}))
    (listening / f"{slug}.mp3").write_bytes(b"ID3fake-mp3")
    audio_provenance = repo / "data" / "audio-provenance" / level.lower()
    audio_provenance.mkdir(parents=True, exist_ok=True)
    (audio_provenance / f"{slug}.json").write_text(json.dumps(manifest))


def exercise_set(repo: Path, level: str, name: str, items: list[dict[str, Any]]) -> None:
    target = repo / "content" / "exercises" / level.lower()
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{name}.yaml").write_text(
        yaml.safe_dump({"topic": "fixture", "role": "practice", "items": items}, allow_unicode=True)
    )


def reading(repo: Path, level: str, slug: str, paragraphs: list[str]) -> None:
    target = repo / "content" / "reading" / level.lower()
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{slug}.yaml").write_text(
        yaml.safe_dump(
            {
                "topic": "fixture",
                "title_de": "Ein kurzer Text",
                "kind": "intensive",
                "text": paragraphs,
            },
            allow_unicode=True,
        )
    )


def course_repo(tmp_path: Path) -> Path:
    """Four planned recordings, one Lesetext, three exercise items.

    Stated in full because every assertion below depends on it. The old `web.py` fixture note
    applies here too: a fixture that does not state what its assertion rests on protects the
    defect instead of catching it.
    """

    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    (repo / "data" / "listening-plan.yaml").write_text(
        yaml.safe_dump(
            {
                "version": 1,
                "units": [
                    {
                        "unit": "fixture-unit",
                        "level": "A1",
                        "artifacts": [
                            plan_entry("ls-published-01"),
                            plan_entry("ls-stale-01"),
                            plan_entry("ls-working-01"),
                            plan_entry("ls-planned-01", wave=2),
                        ],
                    }
                ],
            }
        )
    )
    reading(repo, "A1", "lena-erster-tag", ["Lena kommt an.", "Sie sucht das Büro."])
    exercise_set(
        repo,
        "A1",
        "ls-published-01-hoeren",
        [
            {"id": "q1", "type": "audio-comprehension", "recording": "ls-published-01"},
            {"id": "q2", "type": "audio-comprehension", "recording": "ls-published-01"},
            # No `recording`: this item plays browser TTS.
            {"id": "q3", "type": "audio-comprehension"},
            # A reference to a recording no plan contains — linked-looking, and just as silent.
            {"id": "q4", "type": "audio-comprehension", "recording": "ls-never-planned-99"},
            # Not a listening item at all, and must not be counted as one.
            {"id": "q5", "type": "cloze"},
        ],
    )
    return repo


def scene_for(store: Store, slug: str) -> Scene:
    return cafe_scene(tone_in_store(store.root)).model_copy(update={"slug": slug})


def registry_of(tmp_path: Path) -> tuple[dict[str, Any], Store, Path]:
    repo = course_repo(tmp_path)
    store = Store(tmp_path / "db.sqlite3")

    # `ls-published-01`: published, and the studio holds exactly the scene it was published
    # from — the ordinary healthy row.
    published = scene_for(store, "ls-published-01")
    store.create_scene(published)
    publish(repo, "ls-published-01", "A1", provenance("ls-published-01", published.sha256()))

    # `ls-stale-01`: published, and then revised in the studio. Both files are present and
    # internally consistent, so `listening-inventory.ts` reads this as `published`; only the
    # database says otherwise.
    stale = scene_for(store, "ls-stale-01")
    stale_project = store.create_scene(stale)
    publish(repo, "ls-stale-01", "A1", provenance("ls-stale-01", stale.sha256()))
    store.revise_scene(
        stale_project.id, stale.model_copy(update={"title": Bilingual(en="Later", ru="Позже")})
    )

    # `ls-working-01`: a take the machine has measured and failed. Nothing published.
    working = store.create_scene(scene_for(store, "ls-working-01"))
    store.transition_scene(working.id, Stage.DRAFT, Stage.VALIDATED)
    store.transition_scene(working.id, Stage.VALIDATED, Stage.AUDIO_GENERATED)
    store.record_scene_qa(working.id, "natural", {"passed": False, "variant": "natural"})

    # `ls-planned-01`: commissioned and nothing else.

    http = TestClient(app(store, repo, token="test"))
    response = http.get("/api/registry", headers=AUTH)
    assert response.status_code == 200, response.text
    return response.json(), store, repo


def by_id(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {row["id"]: row for row in document["rows"]}


def test_every_row_carries_the_status_the_four_sources_agree_on(tmp_path: Path) -> None:
    document, _store, _repo = registry_of(tmp_path)
    rows = by_id(document)

    assert rows["ls-published-01"]["status"] == "published"
    assert rows["ls-published-01"]["project"]["kind"] == "scene"
    assert rows["ls-published-01"]["audio"] is True
    assert rows["ls-published-01"]["artifact"] is True

    # The whole reason this endpoint exists beside the TypeScript one.
    assert rows["ls-stale-01"]["status"] == "stale"
    assert (
        rows["ls-stale-01"]["project"]["revision_sha256"]
        != json.loads(
            (_repo / "data" / "audio-provenance" / "a1" / "ls-stale-01.json").read_text()
        )["scene_sha256"]
    )

    assert rows["ls-working-01"]["status"] == "qa_failed"
    assert rows["ls-working-01"]["project"]["qa_passed"] is False
    assert rows["ls-working-01"]["audio"] is False

    assert rows["ls-planned-01"]["status"] == "planned"
    assert rows["ls-planned-01"]["project"] is None

    assert rows["a1/lena-erster-tag"]["kind"] == "reading"
    assert rows["a1/lena-erster-tag"]["status"] == "planned"
    assert rows["a1/lena-erster-tag"]["source_drift"] is False


def test_the_status_vocabulary_is_the_one_the_typescript_inventory_publishes(
    tmp_path: Path,
) -> None:
    """Two implementations, one vocabulary. A seventh name here would be a silent fork.

    Read out of `scripts/listening-inventory.ts` rather than restated, so the day someone adds a
    status there this fails instead of the two drifting apart unnoticed.
    """

    source = (Path(__file__).resolve().parents[4] / "scripts" / "listening-inventory.ts").read_text()
    declared = source.split("export type ListeningInventoryStatus =", 1)[1].split(";", 1)[0]
    published = set(re.findall(r"'([a-z_]+)'", declared))

    from listening_studio.api.registry import Status

    ours = set(Status.__args__)  # type: ignore[attr-defined]
    assert published < ours
    assert ours - published == {"stale"}


def test_both_linkage_directions_are_reported(tmp_path: Path) -> None:
    """A recording nothing asks about, and an item that asks about nothing."""

    document, _store, _repo = registry_of(tmp_path)

    # `ls-published-01` has two questions; the other three planned recordings have none.
    assert by_id(document)["ls-published-01"]["exercise_items"] == 2
    assert document["recordings_without_exercises"] == [
        "ls-stale-01",
        "ls-working-01",
        "ls-planned-01",
    ]

    unlinked = {(row["item"], row["reason"]) for row in document["exercises_without_recordings"]}
    assert unlinked == {("q3", "no-recording"), ("q4", "unknown-recording")}
    # `q5` is a cloze. Counting it would make every set look like a listening set.
    assert document["summary"]["audio_comprehension_items"] == 4


def test_a_pre_scene_manifest_is_never_compared_with_a_scene(tmp_path: Path) -> None:
    """A version-1 manifest hashes another document, so a scene beside it reads `published`.

    Comparing them would report every artifact `stale` on the day it was converted — a
    hundred-percent false-positive rate for a signal whose only value is that it is rare. Once the
    scene publisher writes a `scene_sha256`, the comparison is possible, and a scene revised after
    publication reads `stale`.
    """

    repo = course_repo(tmp_path)
    store = Store(tmp_path / "db.sqlite3")
    scene = scene_for(store, "ls-published-01")
    store.create_scene(scene)
    publish(repo, "ls-published-01", "A1", provenance("ls-published-01", None))

    http = TestClient(app(store, repo, token="test"))
    row = by_id(http.get("/api/registry", headers=AUTH).json())["ls-published-01"]
    assert row["project"]["kind"] == "scene"
    assert row["project"]["revision_sha256"] == scene.sha256()
    assert row["status"] == "published"

    manifest = provenance("ls-published-01", hashlib.sha256(b"an earlier scene").hexdigest())
    publish(repo, "ls-published-01", "A1", manifest)
    later = by_id(http.get("/api/registry", headers=AUTH).json())["ls-published-01"]
    assert later["status"] == "stale"


def test_a_narration_scene_is_joined_to_its_lesetext_by_the_flattened_slug(
    tmp_path: Path,
) -> None:
    """`a1/lena-erster-tag` is the reading; `a1-lena-erster-tag` is the scene slug.

    The join is by the flattened id — `scene.convert.reading_slug` — and not by the file name
    the published narration is written under, which drops the level. Getting it wrong fails
    silently: the lookup simply never matches, and every converted narration goes on reporting
    as an unconverted `planned` reading. This test was written after exactly that.
    """

    from listening_studio.scene.convert import reading_slug
    from test_graph_render import narration_scene

    repo = course_repo(tmp_path)
    store = Store(tmp_path / "db.sqlite3")
    scene = narration_scene().model_copy(update={"slug": reading_slug("a1/lena-erster-tag")})
    assert scene.slug == "a1-lena-erster-tag"
    store.create_scene(scene)

    http = TestClient(app(store, repo, token="test"))
    row = by_id(http.get("/api/registry", headers=AUTH).json())["a1/lena-erster-tag"]
    assert row["project"] is not None, "the narration scene was not joined to its Lesetext"
    assert row["project"]["kind"] == "scene"
    assert row["project"]["revision_sha256"] == scene.sha256()
    assert row["status"] == "drafted"
    # The fixture scene narrates other words than the repository's Lesetext.
    assert row["source_drift"] is True


def test_a_narration_scene_of_the_current_lesetext_has_no_source_drift(tmp_path: Path) -> None:
    """`source_drift` compares the scene's script with the Lesetext the repository holds now."""

    from listening_studio.scene.convert import reading_slug

    repo = course_repo(tmp_path)
    store = Store(tmp_path / "db.sqlite3")
    base = narration_scene()
    paragraphs = ["Lena kommt an.", "Sie sucht das Büro."]
    script = [
        base.script[index].model_copy(update={"display_text": text})
        for index, text in enumerate(paragraphs)
    ]
    scene = Scene.model_validate(
        base.model_dump(mode="json")
        | {
            "slug": reading_slug("a1/lena-erster-tag"),
            "script": [row.model_dump(mode="json") for row in script],
            "timeline": [{"type": "speech", "utterance_id": row.id} for row in script],
        }
    )
    store.create_scene(scene)

    http = TestClient(app(store, repo, token="test"))
    row = by_id(http.get("/api/registry", headers=AUTH).json())["a1/lena-erster-tag"]
    assert row["source_drift"] is False

    # Watched failing: edit the Lesetext and the same scene drifts.
    reading(repo, "A1", "lena-erster-tag", ["Lena kommt an.", "Sie sucht die Küche."])
    row = by_id(http.get("/api/registry", headers=AUTH).json())["a1/lena-erster-tag"]
    assert row["source_drift"] is True


def test_a_collection_recording_is_owned_by_its_set_and_planned_for_its_items(
    tmp_path: Path,
) -> None:
    """An exam set's recording has no unit, and is not a recording nothing asks about.

    Its items name it only once it is published, so before that the plan's `serves` is the only
    link — and without it every planned exam recording would be listed as unused.
    """

    repo = course_repo(tmp_path)
    plan_path = repo / "data" / "listening-plan.yaml"
    plan = yaml.safe_load(plan_path.read_text())
    plan["collections"] = [
        {
            "collection": "pruefung-fixture-hoeren",
            "level": "A1",
            "artifacts": [plan_entry("ls-pruefung-fixture-hoeren-01") | {"serves": ["t1", "t2"]}],
        }
    ]
    plan_path.write_text(yaml.safe_dump(plan))
    store = Store(tmp_path / "db.sqlite3")
    document = TestClient(app(store, repo, token="test")).get("/api/registry", headers=AUTH).json()

    row = by_id(document)["ls-pruefung-fixture-hoeren-01"]
    assert (row["unit"], row["collection"], row["level"]) == (None, "pruefung-fixture-hoeren", "A1")
    assert row["serves"] == ["t1", "t2"]
    assert row["status"] == "planned"
    assert "ls-pruefung-fixture-hoeren-01" not in document["recordings_without_exercises"]
    assert by_id(document)["ls-planned-01"]["collection"] is None
