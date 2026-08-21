"""Scene checks that need a repository, kept out of both the CLI and the API.

`catalog_warnings` used to live in `scene/cli.py` as a private helper. It moved here when the
HTTP API grew a `POST /api/scenes/{slug}/validate` that has to answer exactly what
`atlas-listening scene validate --repo` answers: one implementation, or the two surfaces drift
and the studio and the desktop app disagree about whether a scene is renderable. The API must
not import the CLI to get it — the dependency runs the other way — so the shared half is a
module of its own.
"""

from __future__ import annotations

from pathlib import Path

from .model import Scene, SfxEntry, SpeechEntry


def catalog_warnings(scene: Scene, repo: Path) -> list[str]:
    """Acoustic ids this scene names that the repository's catalogs do not define.

    **Warnings, never failures.** A scene document is valid standalone — that is what makes it
    publishable and readable by another implementation — so holding it against a catalog it does
    not ship with would mean a scene becomes invalid on a machine whose `data/` is a week older.
    What the check is genuinely for is the other direction: an id that will refuse at render time
    should be visible while the file is being edited, not twenty minutes into a synthesis run.
    """

    # Imported here, not at module scope: `scene validate` is the one verb that costs no model
    # download, and `dsp.profiles` pulls the DSP stack in behind it.
    from ..dsp.profiles import (
        DELTA_KEYS,
        DIFFICULTY_PATH,
        PROFILES_PATH,
        load_acoustic_profiles,
        load_difficulty_presets,
    )

    found: list[str] = []
    try:
        profiles = load_acoustic_profiles(repo)
    except (OSError, ValueError) as error:
        found.append(f"cannot read {PROFILES_PATH}: {error}")
    else:
        if scene.acoustics.room is not None and scene.acoustics.room not in profiles.rooms:
            found.append(
                f"room {scene.acoustics.room!r} is not in {PROFILES_PATH} "
                f"(it defines: {', '.join(sorted(profiles.rooms))})"
            )
        named = sorted(
            {
                entry.placement.device
                for entry in scene.timeline
                if isinstance(entry, (SpeechEntry, SfxEntry))
                and entry.placement is not None
                and entry.placement.device is not None
            }
        )
        for device in named:
            if device not in profiles.devices:
                found.append(
                    f"device {device!r} is not in {PROFILES_PATH} "
                    f"(it defines: {', '.join(sorted(profiles.devices))})"
                )
    try:
        presets = load_difficulty_presets(repo)
    except (OSError, ValueError) as error:
        found.append(f"cannot read {DIFFICULTY_PATH}: {error}")
        return found
    for variant in scene.variants:
        if variant.preset is not None and variant.preset not in presets.presets:
            found.append(
                f"variant {variant.id}: preset {variant.preset!r} is not in {DIFFICULTY_PATH} "
                f"(it defines: {', '.join(sorted(presets.presets))})"
            )
        unknown = sorted(set(variant.overrides) - set(DELTA_KEYS))
        if unknown:
            found.append(
                f"variant {variant.id}: unknown override key(s) {', '.join(unknown)}; "
                f"the vocabulary is {', '.join(DELTA_KEYS)}"
            )
    return found
