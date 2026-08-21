"""The committed JSON Schema is the contract; this is its no-diff tripwire.

A field added to the Python model without regenerating the schema is invisible to every other
language that reads a scene, and no other gate here can see it: the model still validates, the
converters still convert, the tests still pass.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from listening_studio.scene.model import Scene
from listening_studio.scene.schema_export import (
    DIALECT,
    FIXTURE_DIR,
    SCHEMA_PATH,
    scene_schema,
    scene_schema_json,
)


REPO = Path(__file__).resolve().parents[3]


def test_committed_schema_is_byte_identical_to_regeneration() -> None:
    committed = (REPO / SCHEMA_PATH).read_text()
    assert committed == scene_schema_json(), (
        "packages/schema/schemas/audio-scene.v1.schema.json is stale — "
        "run `atlas-listening scene schema`"
    )


def test_schema_declares_its_dialect_and_pins_the_version() -> None:
    committed = json.loads((REPO / SCHEMA_PATH).read_text())
    assert committed["$schema"] == DIALECT
    assert committed["$id"].endswith("audio-scene.v1.schema.json")
    assert committed["properties"]["schema_version"]["const"] == 1


#: `domain.Bilingual` is reused rather than ported, and it permits extra keys. Tightening it
#: would change what the dialogue and reading forms accept, which this PR deliberately does not
#: touch. Named here so the exemption is a decision rather than a hole nobody noticed.
LENIENT_DEFS = {"Bilingual"}


def test_schema_forbids_unknown_keys_on_every_definition() -> None:
    """`extra="forbid"` has to survive the export, or the contract is looser than the model."""

    schema = scene_schema()
    for name, definition in schema["$defs"].items():
        if definition.get("type") == "object" and name not in LENIENT_DEFS:
            assert definition.get("additionalProperties") is False, name
    assert schema["additionalProperties"] is False


@pytest.mark.parametrize(
    "name",
    ["dialogue-ls-wohnen-01.scene.json", "narration-a1-erste-schritte.scene.json"],
)
def test_committed_fixtures_still_validate(name: str) -> None:
    """The cross-language fixtures: what another implementation is expected to parse."""

    scene = Scene.model_validate_json((REPO / FIXTURE_DIR / name).read_text())
    assert Scene.model_validate_json(scene.canonical_json()).sha256() == scene.sha256()


def test_the_dialogue_fixture_stays_representative() -> None:
    """It is committed because it carries both sound entry types; keep it that way."""

    scene = Scene.model_validate_json(
        (REPO / FIXTURE_DIR / "dialogue-ls-wohnen-01.scene.json").read_text()
    )
    kinds = {entry.type for entry in scene.timeline}
    assert kinds == {"speech", "sfx", "ambience"}
