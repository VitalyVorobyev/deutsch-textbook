"""The regeneration wave, and the deletion that makes creating from a queue reversible.

Both are bulk operations over the real corpus, so both are tested two ways: the *plan* against the
real checkout, because 40 is the number that matters and a fixture of two proves nothing about it;
and the *run* against a fixture repository with `FakeSpeech`, because a real run is half an hour of
local synthesis and CI has no models.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from listening_studio.domain import Stage
from listening_studio.scene.convert import published_dialogue_ids
from listening_studio.scene.publish import deletion_refusal, published_slugs
from listening_studio.scene.wave import run_wave, wave_summary, wave_targets
from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path(__file__).resolve().parents[3]
AUTH = {"Authorization": "Bearer test"}

#: The two A1 artifacts that carry **no context sounds**, copied whole into the fixture repo.
#:
#: Two rather than one because the wave's engine cache, its numbering and its summary are per-run
#: properties a single row cannot exercise. Sound-free rather than representative, and that is a
#: deliberate trade: a converted dialogue's ambience is an `AssetRef` naming an imported Freesound
#: original, which `AssetStore` resolves under the **studio's** app-data root — so a fixture with
#: one would either read the developer's own machine or ship a copy of somebody else's recording
#: into this repository. The conversion of a scene *with* both sound entry types is covered by
#: `test_scene_convert.py` over the whole corpus; what this file is about is the wave around it.
FIXTURE_ARTIFACTS = ("a1/ls-alltag-zeit-01", "a1/ls-praesens-wortstellung-01")


def wave_repo(tmp_path: Path) -> Path:
    """A course repo carrying two published artifacts, their provenance and their exercise sets."""

    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    for name in ("acoustic-profiles.yaml", "acoustic-difficulty.yaml", "listening-plan.yaml"):
        (repo / "data" / name).write_bytes((REPO / "data" / name).read_bytes())
    for artifact_id in FIXTURE_ARTIFACTS:
        level, slug = artifact_id.split("/")
        for source, target in (
            (
                REPO / "content" / "listening" / level / f"{slug}.yaml",
                repo / "content" / "listening" / level / f"{slug}.yaml",
            ),
            (
                REPO / "data" / "audio-provenance" / level / f"{slug}.json",
                repo / "data" / "audio-provenance" / level / f"{slug}.json",
            ),
            (
                REPO / "content" / "exercises" / level / f"{slug}-hoeren.yaml",
                repo / "content" / "exercises" / level / f"{slug}-hoeren.yaml",
            ),
        ):
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    return repo


# -- the plan, against the real corpus ----------------------------------------


def test_the_dry_run_plans_every_published_artifact_level_then_id() -> None:
    """40 rows, and the order is the resume point rather than whatever the filesystem returned."""

    targets = wave_targets(REPO)
    assert len(targets) == len(published_dialogue_ids(REPO)) == 40
    assert targets == sorted(targets)
    assert targets[0].startswith("a1/")
    assert {row.split("/")[0] for row in targets} == {"a1", "a2", "b1"}

    a1 = wave_targets(REPO, "A1")
    assert a1 and all(row.startswith("a1/") for row in a1)
    assert len(a1) < len(targets)

    # `--only` matches on the bare id, so both spellings name the same row.
    assert wave_targets(REPO, None, ["ls-wohnen-01"]) == ["a1/ls-wohnen-01"]
    assert wave_targets(REPO, None, ["a1/ls-wohnen-01"]) == ["a1/ls-wohnen-01"]


def test_a_dry_run_converts_nothing_and_writes_no_rows(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    rows = run_wave(store, REPO, wave_targets(REPO), dry_run=True)
    assert len(rows) == 40
    assert wave_summary(rows) == {"planned": 40}
    assert all(row["action"] == "convert" for row in rows)
    assert all(row["scene_sha256"] for row in rows)
    assert store.scene_projects() == []


# -- the run, on a fixture repo -----------------------------------------------


def hears_each_scene_in_turn(scenes: list[Any]) -> Any:
    """A transcriber that hears exactly what each scene says, in the wave's own order.

    A QA slice's filename carries no scene: `scene_qa` cuts `line-1.wav` into a system temp
    directory, and **every converted dialogue numbers its lines from `line-1`**. Keying on the
    filename alone therefore gave artifact 2 artifact 1's words and reported four transcription
    mismatches against a take that was word-perfect — a fake engine made to look like a failing
    one, which is the failure mode a fake must not have.

    So this walks the scenes in the order the wave does, and closes each one on `qa.wav`, which is
    both the **last** call `scene_qa` makes for an artifact and the only one whose path carries the
    scene sha. That sha is asserted rather than trusted: a cursor that drifted out of step with the
    wave would otherwise measure the wrong scene silently, which is the same defect one level up.
    """

    cursor = {"index": 0}

    def transcribe(path: Path) -> str:
        scene = scenes[cursor["index"]]
        if path.stem == "qa":
            assert path.parent.parent.name == scene.sha256(), "the transcriber lost the wave"
            cursor["index"] += 1
            return " ".join(utterance.spoken_text() for utterance in scene.script)
        return str(scene.utterance(path.stem).spoken_text())

    return transcribe


@pytest.fixture
def waved(tmp_path: Path) -> Any:
    from listening_studio.scene.convert import dialogue_scene

    store = Store(tmp_path / "db.sqlite3")
    repo = wave_repo(tmp_path)
    scenes = {
        artifact_id.split("/")[-1]: dialogue_scene(repo, artifact_id)[0]
        for artifact_id in FIXTURE_ARTIFACTS
    }
    return store, repo, scenes


def test_the_wave_converts_renders_and_checks_each_artifact_and_is_idempotent(waved: Any) -> None:
    store, repo, scenes = waved
    targets = wave_targets(repo)
    assert len(targets) == 2

    first = run_wave(
        store,
        repo,
        targets,
        engine="fake",
        test_adapter=True,
        speaker_qa=False,
        transcribe_fn=hears_each_scene_in_turn(list(scenes.values())),
    )
    assert wave_summary(first) == {"checked": 2}
    assert [row["n"] for row in first] == [1, 2]
    assert all(row["nodes_evaluated"] > 0 for row in first)
    assert all(row["qa_passed"] is True for row in first)
    assert all(isinstance(row["full_wer"], float) for row in first)
    assert {project.slug for project in store.scene_projects()} == set(scenes)
    assert all(
        project.stage == Stage.AUTOMATICALLY_CHECKED for project in store.scene_projects()
    )

    # Nothing was approved and nothing was published: the wave stops before the human.
    assert published_slugs(repo) == {slug for slug in scenes}  # the *legacy* manifests, untouched
    assert not any(
        project.stage in (Stage.HUMAN_APPROVED, Stage.EXPORTED)
        for project in store.scene_projects()
    )

    # Re-running is a resume, not a second pass: every row is already done.
    second = run_wave(
        store,
        repo,
        targets,
        engine="fake",
        test_adapter=True,
        speaker_qa=False,
        transcribe_fn=hears_each_scene_in_turn(list(scenes.values())),
    )
    assert wave_summary(second) == {"already-done": 2}
    assert all(row["stage"] == str(Stage.AUTOMATICALLY_CHECKED) for row in second)


def test_an_edited_scene_is_skipped_rather_than_reverted(waved: Any) -> None:
    """Resume is by hash, so a scene somebody has since edited is left exactly as they left it."""

    store, repo, scenes = waved
    slug, scene = next(iter(scenes.items()))
    store.create_scene(scene, None)
    stored = store.get_scene_by_slug(slug)
    assert stored is not None
    edited = scene.model_copy(
        update={
            "script": [
                scene.script[0].model_copy(update={"display_text": "Ein anderer erster Satz."}),
                *scene.script[1:],
            ]
        }
    )
    store.revise_scene(stored[0].id, edited)

    rows = run_wave(store, repo, [f"a1/{slug}"], dry_run=False, engine="fake", test_adapter=True)
    assert [row["outcome"] for row in rows] == ["skipped"]
    assert rows[0]["reason"] == "scene-edited"
    again = store.get_scene_by_slug(slug)
    assert again is not None and again[2].sha256() == edited.sha256()


def test_a_failure_is_a_row_and_the_run_carries_on(waved: Any) -> None:
    """One bad target between two good ones. The wave must report three rows, not one exception."""

    store, repo, scenes = waved
    targets = wave_targets(repo)
    rows = run_wave(
        store,
        repo,
        [targets[0], "a1/gibt-es-nicht", targets[1]],
        engine="fake",
        test_adapter=True,
        speaker_qa=False,
        transcribe_fn=hears_each_scene_in_turn(list(scenes.values())),
    )
    assert [row["outcome"] for row in rows] == ["checked", "failed", "checked"]
    assert rows[1]["error_type"] == "FileNotFoundError"
    assert "gibt-es-nicht" in rows[1]["message"]


# -- P28-6: deletion ----------------------------------------------------------


def test_only_a_never_published_draft_at_revision_one_may_be_deleted(waved: Any) -> None:
    """Three refusals and one acceptance, each watched failing rather than reasoned about.

    The three are three different losses: a stage past `draft` has audio and possibly a signature,
    a second revision has edit history, and a published slug is named by a manifest in the course
    repository that would then point at a document nobody has.
    """

    store, repo, scenes = waved
    http = TestClient(app(store, repo, token="test"), raise_server_exceptions=False)
    slug, scene = next(iter(scenes.items()))

    # A slug nobody has created.
    assert http.delete("/api/scenes/gibt-es-nicht", headers=AUTH).status_code == 404

    # Published: the fixture repo carries this artifact's legacy provenance manifest.
    store.create_scene(scene, None)
    assert slug in published_slugs(repo)
    refused = http.delete(f"/api/scenes/{slug}", headers=AUTH)
    assert refused.status_code == 409
    assert "published" in refused.json()["detail"]
    assert store.get_scene_by_slug(slug) is not None

    # Past draft.
    project = store.get_scene_by_slug(slug)[0]  # type: ignore[index]
    store.transition_scene(project.id, Stage.DRAFT, Stage.VALIDATED)
    stored = store.get_scene_by_slug(slug)
    assert stored is not None
    assert deletion_refusal(stored[0], stored[1]) is not None
    assert "only a draft is deleted" in str(deletion_refusal(stored[0], stored[1]))

    # Revision 2 — back at draft (a revision returns it there) and still refused.
    store.revise_scene(
        project.id,
        scene.model_copy(
            update={
                "script": [
                    scene.script[0].model_copy(update={"display_text": "Ein anderer Satz."}),
                    *scene.script[1:],
                ]
            }
        ),
    )
    stored = store.get_scene_by_slug(slug)
    assert stored is not None and stored[0].stage == Stage.DRAFT
    assert "edit history" in str(deletion_refusal(stored[0], stored[1]))


def test_a_deletable_scene_goes_and_takes_its_revisions_with_it(tmp_path: Path) -> None:
    """The one accepted case, over HTTP, against a repository that has published nothing."""

    store = Store(tmp_path / "db.sqlite3")
    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    http = TestClient(app(store, repo, token="test"), raise_server_exceptions=False)
    created = http.post(
        "/api/scenes/from-reading", json={"reading_id": "a1/erste-schritte"}, headers=AUTH
    )
    # The reading corpus is read from `--repo`, which here holds none, so create it directly.
    assert created.status_code == 404

    from listening_studio.scene.convert import dialogue_scene

    scene, _exercise = dialogue_scene(REPO, "a1/ls-alltag-zeit-01")
    project = store.create_scene(scene, None)
    listed = http.get("/api/scenes", headers=AUTH).json()
    assert listed[0]["deletable"] is True

    gone = http.delete(f"/api/scenes/{scene.slug}", headers=AUTH)
    assert gone.status_code == 200
    assert gone.json() == {"slug": scene.slug, "deleted": True, "project_id": project.id}
    assert store.get_scene_by_slug(scene.slug) is None
    assert http.get("/api/scenes", headers=AUTH).json() == []
    # …and nothing is left pointing at a row that is not there.
    assert store.scene_history(project.id) == []
