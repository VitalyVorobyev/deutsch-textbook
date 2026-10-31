from pathlib import Path

from listening_studio.catalogs import load_character_catalog, load_narration_catalog


REPO = Path(__file__).resolve().parents[4]


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



def test_every_roster_character_speaks_a_designed_voice() -> None:
    """ADR 0013: one designed voice per character, on one checkpoint, named by its digest."""

    catalog = load_character_catalog(REPO)
    profiles = [row.voice_profile for row in catalog.characters]
    assert {profile.engine for profile in profiles} == {"qwen_tts_designed"}
    assert all(profile.style is None for profile in profiles)
    # Twelve characters, twelve references: no two share a voice the way the presets did.
    assert len({profile.voice for profile in profiles}) == len(profiles)
    assert all(row.version >= 2 for row in catalog.characters)
