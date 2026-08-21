"""The published JSON Schema for Scene v1.

The scene model is Python, and the consumers are not: the Astro site, `packages/schema`'s Zod
shapes and any later renderer all have to agree on what a scene is. A schema regenerated on
demand is a description; a schema **committed and held byte-identical by a test** is a contract,
because a field added in Python without a schema commit fails the build rather than reaching
another language as a silent optional.

Determinism is the whole job here. `model_json_schema()` is stable for a pinned pydantic, and
`sort_keys=True` removes the one remaining source of churn — definition order, which follows
first-reference order and therefore moves when an unrelated field is reordered.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .model import Scene


#: Where the contract lives, relative to the repository root. Under `packages/schema` rather
#: than under this tool: the schema is read by the site and the editorial app, and a contract
#: kept inside one of its consumers is a contract that consumer owns.
SCHEMA_PATH = Path("packages") / "schema" / "schemas" / "audio-scene.v1.schema.json"
FIXTURE_DIR = SCHEMA_PATH.parent / "fixtures"

DIALECT = "https://json-schema.org/draft/2020-12/schema"
SCHEMA_ID = "https://deutsch-atlas.local/schemas/audio-scene.v1.schema.json"


def scene_schema() -> dict[str, Any]:
    """The Scene v1 JSON Schema, with the two keys pydantic does not emit."""

    schema: dict[str, Any] = Scene.model_json_schema(mode="serialization")
    # `$schema` says which dialect the keywords come from and `$id` gives the document a name to
    # be referenced by; pydantic emits neither, and a validator handed a schema with no dialect
    # picks one, which is how the same document ends up meaning two things.
    return {"$schema": DIALECT, "$id": SCHEMA_ID, **schema}


def scene_schema_json() -> str:
    """The exact bytes the committed contract file holds."""

    return json.dumps(scene_schema(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def write_scene_schema(repo: Path) -> Path:
    target = repo / SCHEMA_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(scene_schema_json())
    return target


def scene_schema_matches(repo: Path) -> bool:
    """False when the committed contract is absent or has drifted from the model."""

    target = repo / SCHEMA_PATH
    return target.exists() and target.read_text() == scene_schema_json()
