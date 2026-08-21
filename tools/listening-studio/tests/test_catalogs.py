from pathlib import Path

from listening_studio.catalogs import load_character_catalog, load_narration_catalog


REPO = Path(__file__).resolve().parents[3]


def test_character_catalog_has_twelve_versioned_profiles() -> None:
    catalog = load_character_catalog(REPO)
    assert len(catalog.characters) == 12
    assert len({row.id for row in catalog.characters}) == 12
    assert sum(row.narration_capable for row in catalog.characters) == 4
    assert all(row.status != "reviewed-profile" for row in catalog.characters)


def test_narration_profiles_resolve_to_capable_characters() -> None:
    catalog = load_narration_catalog(REPO)
    assert {row.id for row in catalog.profiles} == {
        "didactic-clear",
        "neutral-editorial",
        "warm-narrative",
        "formal-informational",
    }

