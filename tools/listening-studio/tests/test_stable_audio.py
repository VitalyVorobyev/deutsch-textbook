"""The Stable Audio sound engine, without MLX, weights, a Mac or a network.

Every test here stubs the one seam the engine has — the argv it hands the pinned upstream entry
point — so what is under test is the mapping from an engine-neutral `SoundRequest` to that
invocation, plus the refusals that guard it. The audio itself is not testable here and is not
pretended to be: the real numbers live in the module docstring and were measured, not asserted.
"""

from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path
from typing import Any, Sequence

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from typer.testing import CliRunner

from test_graph_cli import flat

from listening_studio.adapters import ENGINES, SOUND_ENGINES, sound_engine_for
from listening_studio.domain import Bilingual
from listening_studio.generative.fake import FakeSpeech
from listening_studio.generative.gateway import AudioAsset, SoundRequest
from listening_studio.generative.locks import set_models_root
from listening_studio.generative.stable_audio_mlx import (
    ADAPTER_CODE_REVISION,
    ADAPTER_DIRNAME,
    DEFAULT_PARAMS,
    MODEL_ID,
    OUTPUT_CHANNELS,
    OUTPUT_CODEC,
    OUTPUT_RATE,
    REVISION,
    REVISION_STAMP,
    WEIGHT_FILES,
    StableAudioSfx,
    build_argv,
    resolve_params,
)
from listening_studio.graph.nodes import WORKING_CODEC, WORKING_RATE
from listening_studio.scene import cli as scene_cli
from listening_studio.scene.model import (
    CastMember,
    Scene,
    SceneBrief,
    SfxEntry,
    SoundSpec,
    SpeechEntry,
    Utterance,
    VoiceSpec,
)
from listening_studio.sources import generated_sound_path, import_source, list_generated_sounds
from listening_studio.storage import Store
from listening_studio.studio_api import router

REPO = Path(__file__).resolve().parents[3]


class Invocation:
    """A stub of the upstream entry point: records its argv and writes a plausible WAV.

    It writes 44.1 kHz stereo because that is what the model writes, which is the whole reason
    the engine conforms — a stub emitting the *output* format would prove the conversion happens
    by never needing it.
    """

    def __init__(self) -> None:
        self.argv: list[str] = []

    def __call__(self, argv: Sequence[str]) -> None:
        self.argv = list(argv)
        target = Path(argv[argv.index("--out") + 1])
        seconds = float(argv[argv.index("--seconds") + 1])
        target.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(target), "wb") as handle:
            handle.setnchannels(2)
            handle.setsampwidth(2)
            handle.setframerate(44_100)
            handle.writeframes(b"\0\0\0\0" * int(44_100 * seconds))

    def flag(self, name: str) -> str:
        return self.argv[self.argv.index(name) + 1]


def installed(root: Path) -> Path:
    """A directory the engine's preconditions accept, holding no weights at all.

    The download metadata is what `locks.local_checkout` reads the pinned commit out of, so
    writing it is what makes an empty file stand in for 1.8 GB of `.npz`.
    """

    adapter = root / ".models" / ADAPTER_DIRNAME
    (adapter / "scripts").mkdir(parents=True)
    (adapter / "scripts" / "sa3_mlx.py").write_text("")
    (adapter / REVISION_STAMP).write_text(ADAPTER_CODE_REVISION + "\n")
    (adapter / "models" / "mlx").mkdir(parents=True)
    for name in WEIGHT_FILES:
        (adapter / "models" / "mlx" / name).write_text("")
    weights = root / ".models" / MODEL_ID.rsplit("/", 1)[-1]
    download = weights / ".cache" / "huggingface" / "download"
    download.mkdir(parents=True)
    (download / "MLX.metadata").write_text(REVISION + "\n")
    return adapter


def generate(tmp_path: Path, request: SoundRequest) -> tuple[Invocation, AudioAsset]:
    """One generation against a stub, with `.models/` pointed at the throwaway install.

    `set_models_root` is the studio's own way of saying where `.models/` lives — the CLI calls it
    from `--repo` — so the test uses it rather than reaching inside the engine.
    """

    installed(tmp_path)
    set_models_root(tmp_path)
    try:
        runner = Invocation()
        asset = StableAudioSfx(runner).generate(request, tmp_path / "out" / "sound.wav")
    finally:
        set_models_root(None)
    return runner, asset


# -- request → invocation -----------------------------------------------------


def test_the_engine_neutral_fields_reach_the_entry_point(tmp_path: Path) -> None:
    runner, _asset = generate(
        tmp_path,
        SoundRequest(
            prompt="ruhiges Café, Tassen und leises Gemurmel",
            negative_prompt="Sprache, Musik",
            seed=4242,
            duration_seconds=7.5,
            params={"cfg": 3.0},
        ),
    )
    assert runner.flag("--prompt") == "ruhiges Café, Tassen und leises Gemurmel"
    assert runner.flag("--negative-prompt") == "Sprache, Musik"
    assert runner.flag("--seed") == "4242"
    assert runner.flag("--seconds") == "7.5"
    assert runner.flag("--cfg") == "3"


def test_the_model_is_the_engines_identity_not_a_parameter(tmp_path: Path) -> None:
    """`sm-sfx` on the SAME-S codec is what `stable_audio_sfx` *is*.

    An engine whose checkpoint could be chosen per request would publish one `revision` for two
    models, and every asset it made would name the wrong one.
    """

    runner, _asset = generate(tmp_path, SoundRequest(prompt="rain", duration_seconds=2.0))
    assert runner.flag("--dit") == "sm-sfx"
    assert runner.flag("--decoder") == "same-s"
    assert "--lora" not in runner.argv
    assert "--init-audio" not in runner.argv


def test_every_engine_parameter_is_sent_even_when_it_was_defaulted(tmp_path: Path) -> None:
    """The model is never left to its own defaults: this engine's defaults are the record.

    Upstream may change a default between two commits of the adapter code, and a run that sent
    nothing would then be reproducible only against the commit it happened to run on.
    """

    runner, asset = generate(tmp_path, SoundRequest(prompt="wind", duration_seconds=3.0))
    for flag in ("--steps", "--cfg", "--apg", "--init-noise-level", "--dit-dtype"):
        assert flag in runner.argv
    assert asset.provenance["params"] == dict(DEFAULT_PARAMS)


def test_an_unknown_parameter_is_refused_rather_than_forwarded() -> None:
    """`sa3_mlx.py` would reject an unknown flag with a usage dump; this says which one it was."""

    with pytest.raises(ValueError, match="does not accept \\['sampler'\\]"):
        resolve_params(SoundRequest(prompt="x", params={"sampler": "ddim"}))


def test_a_negative_prompt_at_cfg_one_is_refused_because_it_reaches_nothing() -> None:
    """Measured upstream: identical bytes with and without the negative prompt at cfg 1.0.

    The sampler runs no unconditional branch there, so the field is inert. Refusing rather than
    warning because a scene's author can fix it in one field — unlike a style instruction a
    small checkpoint discards, which no edit to the scene can make audible.
    """

    with pytest.raises(ValueError, match="reaches nothing at cfg 1.0"):
        resolve_params(SoundRequest(prompt="street", negative_prompt="voices"))
    resolve_params(SoundRequest(prompt="street", negative_prompt="voices", params={"cfg": 3.0}))


def test_a_duration_past_the_checkpoints_native_length_is_refused() -> None:
    with pytest.raises(ValueError, match="duration_seconds <= 120"):
        resolve_params(SoundRequest(prompt="x", duration_seconds=600.0))
    with pytest.raises(ValueError, match="duration_seconds <= 120"):
        resolve_params(SoundRequest(prompt="x", duration_seconds=0.0))


# -- output and provenance ----------------------------------------------------


def test_the_take_is_conformed_to_the_graphs_working_format(tmp_path: Path) -> None:
    """The model writes 44.1 kHz stereo; the track node takes one mono take at the working rate.

    Nothing between generation and placement would convert it, and `pan` on a stereo input reads
    channel 0 — so a stereo take would lose half of itself with every gate green.
    """

    _runner, asset = generate(tmp_path, SoundRequest(prompt="rain", duration_seconds=2.0))
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries",
            "stream=sample_rate,channels,codec_name", "-of", "json", str(asset.path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    stream = json.loads(probe.stdout)["streams"][0]
    assert (stream["sample_rate"], stream["channels"], stream["codec_name"]) == (
        str(OUTPUT_RATE),
        OUTPUT_CHANNELS,
        OUTPUT_CODEC,
    )
    assert asset.sample_rate == OUTPUT_RATE


def test_the_engines_output_format_is_the_one_the_graph_works_at() -> None:
    """The tripwire the module docstring promises: `graph.nodes` owns these values.

    They are restated in `generative/` rather than imported because an engine must not depend on
    the render graph, and a restated constant that nothing compares is a constant that drifts.
    """

    assert (OUTPUT_RATE, OUTPUT_CODEC) == (WORKING_RATE, WORKING_CODEC)


def test_an_asset_names_its_licence_and_both_pinned_revisions(tmp_path: Path) -> None:
    _runner, asset = generate(tmp_path, SoundRequest(prompt="rain", duration_seconds=2.0))
    assert asset.provenance["license"] == "Stability AI Community License"
    assert asset.provenance["model_revision"] == REVISION
    assert asset.provenance["adapter_code_revision"] == ADAPTER_CODE_REVISION
    assert asset.provenance["model_id"] == MODEL_ID


# -- install preconditions ----------------------------------------------------


def test_an_uninstalled_engine_says_so_before_it_runs_anything(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="install-stable-audio.sh"):
        StableAudioSfx().entry_point(tmp_path)


def test_adapter_code_at_the_wrong_revision_is_refused(tmp_path: Path) -> None:
    """A directory is never accepted on its name — the same rule `local_checkout` applies."""

    adapter = installed(tmp_path)
    (adapter / REVISION_STAMP).write_text("Stability-AI/stable-audio-3@" + "0" * 40 + "\n")
    with pytest.raises(RuntimeError, match="is not installed"):
        StableAudioSfx().entry_point(tmp_path)


def test_installed_code_without_the_weights_is_not_reported_as_ready(tmp_path: Path) -> None:
    """Two downloads from two hosts. One "is it installed" check would call this state ready."""

    adapter = installed(tmp_path)
    for name in WEIGHT_FILES:
        (adapter / "models" / "mlx" / name).unlink()
    with pytest.raises(RuntimeError, match="not linked into"):
        StableAudioSfx().entry_point(tmp_path)


# -- the registry and the lock ------------------------------------------------


def test_the_sound_registry_holds_both_engines_and_refuses_anything_else() -> None:
    assert sorted(SOUND_ENGINES) == ["fake", "stable_audio_sfx"]
    assert isinstance(sound_engine_for("stable_audio_sfx"), StableAudioSfx)
    with pytest.raises(ValueError, match="known: fake, stable_audio_sfx"):
        sound_engine_for("bark")


def test_speech_and_sound_registries_stay_separate() -> None:
    """One merged table would let a scene be cast on a tone generator by a single typo."""

    assert set(ENGINES) & set(SOUND_ENGINES) == {"fake"}
    assert ENGINES["fake"] is not SOUND_ENGINES["fake"]


def test_the_lock_entry_matches_the_engine(tmp_path: Path) -> None:
    """The `VOICE_SETS` pattern: a pin stated twice is a pin that can disagree with itself."""

    lock = json.loads((Path(__file__).resolve().parents[1] / "models.lock.json").read_text())
    entry = lock["models"]["stable_audio_sfx"]
    assert entry["id"] == MODEL_ID == StableAudioSfx.model_id
    assert entry["revision"] == REVISION == StableAudioSfx.revision
    assert entry["adapter_code"] == ADAPTER_CODE_REVISION == StableAudioSfx.adapter_code_revision
    assert entry["license"] == StableAudioSfx.license
    # The two claims the licence makes that this repository has to keep stating: the revenue
    # condition it terminates on, and whose statement the training-data provenance is.
    assert "1,000,000" in entry["license_condition"]
    assert "not independently verified" in entry["training_data_provenance"]
    assert "AudioSparx" in entry["training_data_provenance"]
    assert "Freesound" in entry["training_data_provenance"]


def test_the_lock_downloads_exactly_the_files_the_engine_loads() -> None:
    lock = json.loads((Path(__file__).resolve().parents[1] / "models.lock.json").read_text())
    files = lock["models"]["stable_audio_sfx"]["files"]
    assert {f"MLX/{name}" for name in WEIGHT_FILES} <= set(files)


def test_build_argv_needs_no_install_and_no_model() -> None:
    """The mapping is a pure function, so a review can read a request as its invocation."""

    argv = build_argv(
        Path("/opt/sa3/scripts/sa3_mlx.py"),
        SoundRequest(prompt="tram", seed=9, duration_seconds=4.0),
        DEFAULT_PARAMS,
        Path("/tmp/out.wav"),
    )
    assert argv[0] == "/opt/sa3/scripts/sa3_mlx.py"
    assert argv[-2:] == ["--out", "/tmp/out.wav"]


# -- `scene render --sound-engine` --------------------------------------------


def sfx_scene() -> Scene:
    """One line and one generated sound. The smallest scene that can be refused."""

    return Scene.model_validate(
        {
            "slug": "fixture-sound-engine",
            "kind": "dialogue",
            "title": Bilingual(en="A cup", ru="Чашка"),
            "brief": SceneBrief(
                level="A2", scenario="Im Café", topic="essen-trinken", vocabulary=["Kaffee"]
            ),
            "cast": [
                CastMember(role="Mara", voice=VoiceSpec(engine="fake", voice="Vivian", seed=1))
            ],
            "script": [
                Utterance(id="line-1", role="Mara", display_text="Einen Kaffee, bitte."),
            ],
            "timeline": [
                SpeechEntry(utterance_id="line-1"),
                SfxEntry(
                    sound=SoundSpec(prompt="a cup on a saucer", seed=7, duration_seconds=1.2),
                    at_ms=200,
                    gain_db=-12.0,
                ),
            ],
        }
    )


@pytest.fixture
def stored_scene(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    database = tmp_path / "studio.sqlite3"
    monkeypatch.setattr(scene_cli, "Store", lambda: Store(database))
    Store(database).create_scene(sfx_scene(), None)
    return database


def render(*flags: str) -> Any:
    # The pinned terminal from test_graph_cli: CI's colored 80-column rich rendering wraps and
    # colors BadParameter text, splitting the substrings these tests assert on.
    return CliRunner(env={"NO_COLOR": "1", "TERM": "dumb", "COLUMNS": "200"}).invoke(
        scene_cli.app, ["render", "fixture-sound-engine", "--json", *flags]
    )


def test_the_fake_sound_engine_renders_a_sound_spec_under_the_test_gate(
    stored_scene: Path,
) -> None:
    result = render("--sound-engine", "fake", "--test-adapter")
    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["duration_ms"] > 0
    manifest = json.loads(
        (stored_scene.parent / "renders" / payload["payload_sha256"] / "natural" / "render.json")
        .read_text()
    )
    # The manifest names what produced the bytes, which is the engine's own name and not the
    # registry key the command line used.
    assert manifest["engines"]["fake_sound"] == {"name": "fake_sound", "revision": "fake-sound-v1"}
    assert any(node["type"] == "sound-gen" for node in manifest["nodes"])


def test_an_unknown_sound_engine_is_refused_by_name_with_the_valid_ones(
    stored_scene: Path,
) -> None:
    result = render("--sound-engine", "bark", "--test-adapter")
    assert result.exit_code != 0
    assert "known: fake, stable_audio_sfx" in result.output


def test_the_fake_sound_engine_still_needs_the_test_gate(stored_scene: Path) -> None:
    result = render("--sound-engine", "fake")
    assert result.exit_code != 0
    assert "needs --test-adapter" in flat(result.output)


def test_no_sound_engine_keeps_the_refusal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unchanged behaviour: a production render has no generator unless one is named.

    The scene is cast on `qwen_tts` and the speech engine is swapped underneath, because that is
    the only way to reach a *production* render in a test — `--test-adapter` deals the fake
    sound engine, which is exactly the state this test has to be without.
    """

    database = tmp_path / "studio.sqlite3"
    monkeypatch.setattr(scene_cli, "Store", lambda: Store(database))
    monkeypatch.setitem(ENGINES, "qwen_tts", FakeSpeech)
    scene = sfx_scene()
    Store(database).create_scene(
        scene.model_copy(
            update={
                "cast": [
                    CastMember(
                        role="Mara", voice=VoiceSpec(engine="qwen_tts", voice="Vivian", seed=1)
                    )
                ]
            }
        ),
        None,
    )
    result = render()
    assert result.exit_code != 0
    assert "no sound engine installed" in str(result.exception)


def test_the_sound_gen_node_carries_the_engine_that_will_answer_it(stored_scene: Path) -> None:
    """The node hash is what the cache is keyed on, so the engine has to be inside it.

    Two engines answering one prompt are two different sounds; a node that named only the
    request would serve the first one's take for the second one's render.
    """

    assert render("--sound-engine", "fake", "--test-adapter").exit_code == 0
    manifest_path = next((stored_scene.parent / "renders").rglob("render.json"))
    node = next(
        row for row in json.loads(manifest_path.read_text())["nodes"] if row["type"] == "sound-gen"
    )
    assert node["params"]["engine"] == "fake_sound"
    assert node["params"]["engine_revision"] == "fake-sound-v1"
    assert node["params"]["request"]["prompt"] == "a cup on a saucer"


# -- the unified sound library ------------------------------------------------


def test_a_generated_asset_becomes_a_library_row_carrying_prompt_seed_and_licence(
    stored_scene: Path,
) -> None:
    assert render("--sound-engine", "fake", "--test-adapter").exit_code == 0
    rows = list_generated_sounds(stored_scene.parent)
    assert len(rows) == 1
    row = rows[0]
    assert row.prompt == "a cup on a saucer"
    assert row.seed == 7
    assert row.duration_seconds == 1.2
    assert row.engine == "fake_sound"
    assert row.license == "none"
    assert generated_sound_path(stored_scene.parent, row.asset_sha256) is not None


def test_the_other_assets_a_render_produced_are_not_listed_as_sounds(
    stored_scene: Path,
) -> None:
    """The store holds every intermediate — takes, stems, the master. One of them is a sound."""

    assert render("--sound-engine", "fake", "--test-adapter").exit_code == 0
    sidecars = list((stored_scene.parent / "assets").glob("*.json"))
    assert len(sidecars) > len(list_generated_sounds(stored_scene.parent))


def test_the_library_listing_labels_both_origins_and_keeps_their_schemas_apart(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Freesound rows keep `sound_id` and `editorial`; generated rows keep prompt and seed.

    Forcing either into the other's shape would put a value in a field that means something
    else — the falsification the `origin` label exists to avoid.
    """

    database = tmp_path / "studio.sqlite3"
    monkeypatch.setattr(scene_cli, "Store", lambda: Store(database))
    store = Store(database)
    store.create_scene(sfx_scene(), None)
    assert render("--sound-engine", "fake", "--test-adapter").exit_code == 0
    import_freesound_fixture(tmp_path, store.root)

    app = FastAPI()
    app.include_router(router(store, REPO))
    rows = TestClient(app).get("/api/sounds").json()
    origins = {row["origin"] for row in rows}
    assert origins == {"freesound", "generated"}
    imported = next(row for row in rows if row["origin"] == "freesound")
    generated = next(row for row in rows if row["origin"] == "generated")
    assert "sound_id" in imported and "editorial" in imported
    assert "sound_id" not in generated and "editorial" not in generated
    assert generated["prompt"] == "a cup on a saucer" and generated["seed"] == 7
    assert "prompt" not in imported
    # Both are auditionable through the one audio path, each verified against its own digest.
    client = TestClient(app)
    assert client.get(f"/api/sounds/{generated['asset_sha256']}/audio").status_code == 200
    assert client.get(f"/api/sounds/{imported['original_sha256']}/audio").status_code == 200


def import_freesound_fixture(work: Path, root: Path) -> None:
    """One imported original, so the listing has both origins to keep apart."""

    original = work / "room.wav"
    with wave.open(str(original), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16_000)
        handle.writeframes(b"\0\0" * 16_000)
    info = work / "source.json"
    info.write_text(
        json.dumps(
            {
                "sound_id": 12345,
                "page_url": "https://freesound.org/s/12345/",
                "title": "Quiet room tone",
                "uploader": "fixture-author",
                "retrieved_at": "2026-08-01",
                "license": "CC0-1.0",
                "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
                "description": "Synthetic test fixture representing a short room tone.",
                "rights_risk_note": "Synthetic fixture; production imports need source review.",
            }
        )
    )
    import_source(original, info, root)
