"""Turning a `Scene` into audio: build the node graph, evaluate what changed, write the manifest.

Three things happen here that are worth naming separately, because they are the three places a
render can be silently wrong.

**Timing is resolved after synthesis, never before.** A sequential speech entry (`at_ms=None`)
starts when the previous one has finished, and how long the previous one takes is a property of
the take — pace included. So the graph is evaluated in two passes: every synth and pace node
first, then the timeline, then everything that needs to know where things sit. This is the
generalization of `reading_pipeline.generate_reading`'s cue loop, which measured each paragraph
WAV for exactly this reason; the difference is that a scene has non-speech on the same axis.

**A node is evaluated only when its hash is not in the cache.** `cache/nodes/<hash>.json` maps a
node hash to the asset it produced, so re-rendering a scene after one line was rewritten costs
one synthesis and one pace, not twelve. `RenderResult` reports `nodes_evaluated` against
`nodes_cached` so that claim is measurable rather than asserted.

**The acoustic state is resolved once, before anything is evaluated, and written into the
manifest.** A room, a device and a difficulty preset are ids in the scene and rows in
`data/acoustic-profiles.yaml` and `data/acoustic-difficulty.yaml`; resolving them produces one
`ResolvedAcoustics` that every node then reads its parameters from. Two things follow. An unknown
id is refused with the path of the file that would have to define it, because a render that
silently ignored it would publish a scene that is not the scene that was authored. And every
resolved figure reaches the node hashes, so two difficulty variants share exactly the nodes whose
parameters they agree on — the same synthesised takes, and different paces, stems and mixes.
"""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import Any, Callable, Mapping, Protocol, Sequence

from ..adapters import model_lock, warn_if_style_is_inert, wav_duration
from ..dsp.chains import clamp, distance_send_db, stem_chain
from ..dsp.profiles import (
    AcousticProfiles,
    DeviceProfile,
    DifficultyDeltas,
    RoomProfile,
    apply_overrides,
    load_acoustic_profiles,
    load_difficulty_presets,
)
from ..generative.gateway import (
    SoundGenerator,
    SoundRequest,
    SpeechGenerator,
    SpeechRequest,
    VoiceRef,
)
from ..scene.model import (
    PACE_MAX,
    PACE_MIN,
    AmbienceEntry,
    AssetRef,
    DifficultyVariant,
    Placement,
    Scene,
    SfxEntry,
    Sound,
    SpeechEntry,
    Utterance,
)
from .assets import AssetStore, sha256_file
from .nodes import (
    NO_SOUND_ENGINE,
    MixInput,
    Node,
    RoomMix,
    encode_node,
    evaluate_encode,
    evaluate_import,
    evaluate_ir,
    evaluate_loudnorm,
    evaluate_mix,
    evaluate_pace,
    evaluate_sound_gen,
    evaluate_synth,
    evaluate_track,
    derived_provenance,
    ffmpeg_version,
    import_node,
    ir_node,
    loudnorm_node,
    mix_node,
    pace_node,
    sound_gen_node,
    synth_node,
    track_node,
)

log = logging.getLogger(__name__)

#: `models.lock.json`, the provenance record every generative model in this studio is pinned by.
PACKAGE_ROOT = Path(__file__).resolve().parents[3]

#: The repository root, where `data/acoustic-profiles.yaml` lives. Derived rather than required,
#: so `render_scene` keeps the signature every existing caller and test uses; `scene render`
#: passes its own `--repo` explicitly.
REPO_ROOT = PACKAGE_ROOT.parents[1]

#: `AmbienceEntry.gain_db`'s window. A difficulty delta is clamped into it rather than allowed to
#: leave it: a bed at speech level is not a bed, whatever a preset says.
AMBIENCE_GAIN_MIN, AMBIENCE_GAIN_MAX = -40.0, -6.0

#: `render.json`'s own version. 2 adds `voices`: the consented voice references a render spoke
#: through, keyed by cast role. Additive — a version-1 manifest is a version-2 manifest with an
#: empty `voices`, which is what every scene rendered before consent-gated cloning existed is —
#: but a reader that computes a *claim* from this document has to be able to tell "this render had
#: no cloned voices" from "this manifest predates the field", and only the version says which.
MANIFEST_VERSION = 2

#: Every bus, for the master sum. `graph.nodes.BUSES` states the order they are summed in.
BUS_ALL = ("dialogue", "ambience", "sfx")

#: What a node's evaluation does: write the bytes to `target`, return the provenance sidecar.
Produce = Callable[[Path], Mapping[str, Any]]


class RunNode(Protocol):
    """Evaluate one node, or reuse the asset a previous render left under its hash."""

    def __call__(self, node: Node, produce: Produce, suffix: str = ...) -> str: ...


# -- results ------------------------------------------------------------------


@dataclass(frozen=True)
class NodeRun:
    """One node, and whether this render had to compute it."""

    node_hash: str
    type: str
    impl_version: int
    asset: str
    cached: bool
    params: dict[str, Any]


@dataclass(frozen=True)
class UtteranceTiming:
    """Where one turn of speech sits in the finished mix.

    This is the cue table. `reading_pipeline` derived the same thing per paragraph and published
    it as `ParagraphCue`; a scene produces it for every utterance regardless of kind, which is
    what lets a narration scene keep publishing paragraph cues without a second code path.
    """

    utterance_id: str
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class EntryTiming:
    """Where any timeline entry sits, speech and sound alike."""

    entry_id: str
    type: str
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class Artifact:
    path: Path
    sha256: str
    kind: str


@dataclass
class RenderResult:
    scene_slug: str
    scene_sha256: str
    variant: str
    directory: Path
    manifest_path: Path
    artifacts: list[Artifact]
    timing: list[UtteranceTiming]
    timeline: list[EntryTiming]
    nodes: list[NodeRun] = field(default_factory=list)
    duration_ms: int = 0
    #: The resolved acoustic state this variant was rendered with. None only on a result built by
    #: hand in a test; every `render_scene` fills it in.
    acoustics: "ResolvedAcoustics | None" = None
    #: Room id → impulse-response asset sha, for every IR this render convolved with.
    ir_assets: dict[str, str] = field(default_factory=dict)
    #: Cast role → the consented voice reference it was synthesized through. Empty for a scene
    #: cast entirely on preset voices, which is every scene shipped so far.
    voices: dict[str, VoiceRef] = field(default_factory=dict)

    @property
    def nodes_evaluated(self) -> int:
        return sum(1 for row in self.nodes if not row.cached)

    @property
    def nodes_cached(self) -> int:
        return sum(1 for row in self.nodes if row.cached)

    def evaluated_of_type(self, node_type: str) -> list[NodeRun]:
        return [row for row in self.nodes if row.type == node_type and not row.cached]


# -- node cache ---------------------------------------------------------------


class NodeCache:
    """`cache/nodes/<node_hash>.json` → `{"asset": "<sha256>"}`, and nothing else.

    Deliberately not a database. The cache is derived state: deleting it costs a re-render and
    loses nothing, which is the property that makes it safe to key on a hash whose definition may
    change. It lives beside the asset store rather than under a scene, because two revisions of
    one scene — and two scenes that share a line — must hit the same entry.
    """

    def __init__(self, root: Path) -> None:
        self.directory = root / "cache" / "nodes"

    def get(self, node_hash: str) -> str | None:
        path = self.directory / f"{node_hash}.json"
        if not path.exists():
            return None
        record = json.loads(path.read_text())
        asset = record.get("asset")
        return asset if isinstance(asset, str) else None

    def put(self, node_hash: str, asset: str) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        (self.directory / f"{node_hash}.json").write_text(
            json.dumps({"asset": asset}, sort_keys=True) + "\n"
        )


def evaluate_or_reuse(
    node: Node,
    produce: Produce,
    *,
    assets: AssetStore,
    cache: NodeCache,
    work: Path,
    suffix: str = ".wav",
) -> tuple[str, bool]:
    """Evaluate one node, or don't. **The single place a cache hit is decided.**

    Lifted out of `render_scene`'s closure when the API gained a way to generate one sound on its
    own (`POST /api/sounds/generate`). That endpoint must land in the store the way a render does
    — same node hash, same cache entry, same provenance sidecar — or the sound it produced would
    be a second copy the next render does not recognise, and the library would show two rows for
    one prompt at one seed.

    Returns the asset digest and whether it came from the cache; `render_scene` turns the second
    half into a `NodeRun`, and the sound endpoint reports it as "already generated".
    """

    node_hash = node.node_hash()
    known = cache.get(node_hash)
    if known is not None and assets.get(known) is not None:
        return known, True
    target = work / f"{node_hash}{suffix}"
    provenance = produce(target)
    asset = assets.put(target, provenance)
    cache.put(node_hash, asset)
    return asset, False


def generate_sound(
    request: SoundRequest, engine: SoundGenerator, store_dir: Path
) -> tuple[str, bool]:
    """One generated sound into the asset store, outside any render.

    The same `SoundGenNode` a scene's `SoundSpec` resolves to, so a sound generated here and the
    same sound generated by a render are **one asset under one hash**: an author who auditions a
    prompt in the sound library and then writes it into a scene pays for the model once.

    Returns the asset digest and whether the node was already known.
    """

    store_dir.mkdir(parents=True, exist_ok=True)
    assets = AssetStore(store_dir)
    cache = NodeCache(store_dir)
    node = sound_gen_node(request, engine)
    with tempfile.TemporaryDirectory(prefix="sound-gen-", dir=store_dir) as raw:
        return evaluate_or_reuse(
            node,
            partial(_sound, engine, request),
            assets=assets,
            cache=cache,
            work=Path(raw),
        )


# -- acoustic resolution ------------------------------------------------------


@dataclass(frozen=True)
class ResolvedAcoustics:
    """Everything the data files say about *this* render of *this* variant, resolved once.

    Built before a single node is constructed, so that the profile lookups — and therefore every
    refusal for an unknown id — happen before any audio is generated. A render that synthesised
    twelve turns and then discovered the room does not exist would have spent the expensive half
    of the pipeline to reach a data error.
    """

    variant: str
    preset: str | None
    preset_version: int | None
    deltas: DifficultyDeltas
    room_id: str | None
    room: RoomProfile | None
    #: `room.wet` plus the variant's delta, clamped to 0..1. Zero means there is no reverb bus at
    #: all — a room whose wet a preset pulled to nothing costs no convolution.
    wet: float
    profiles: AcousticProfiles | None

    def device(self, device_id: str | None) -> DeviceProfile | None:
        if device_id is None:
            return None
        if self.profiles is None:  # pragma: no cover - `_needs_profiles` loads when one is named
            raise ValueError(
                f"placement names device {device_id!r} but the acoustic profiles were not loaded"
            )
        return self.profiles.device(device_id)

    def room_mix(self, ir_asset: str) -> RoomMix | None:
        if self.room is None or self.room_id is None or self.wet <= 0.0:
            return None
        return RoomMix(
            room_id=self.room_id, version=self.room.version, wet=self.wet, ir_asset=ir_asset
        )

    def manifest(self) -> dict[str, Any]:
        """The resolved acoustic state, as `render.json` records it per variant."""

        return {
            "variant": self.variant,
            "preset": self.preset,
            "preset_version": self.preset_version,
            "deltas": self.deltas.model_dump(mode="json"),
            "room": self.room_id,
            "room_version": self.room.version if self.room else None,
            "wet": self.wet,
            "profiles_version": self.profiles.version if self.profiles else None,
        }


def _variant_of(scene: Scene, variant: str) -> DifficultyVariant:
    chosen = next((row for row in scene.variants if row.id == variant), None)
    if chosen is None:
        known = ", ".join(row.id for row in scene.variants)
        raise ValueError(f"scene {scene.slug} has no variant {variant} (it has: {known})")
    return chosen


def _needs_profiles(scene: Scene) -> bool:
    """True when this scene names a room or a device, and therefore needs the profile file.

    Loading lazily is not an optimisation. `render_scene` is given a repository root it derives
    rather than one every caller passes, so a scene that says nothing about acoustics must render
    on a machine where `data/acoustic-profiles.yaml` is not there at all.
    """

    if scene.acoustics.room is not None:
        return True
    return any(
        isinstance(entry, (SpeechEntry, SfxEntry))
        and entry.placement is not None
        and entry.placement.device is not None
        for entry in scene.timeline
    )


def _resolve_acoustics(scene: Scene, variant: str, repo: Path) -> ResolvedAcoustics:
    """Scene ids plus a difficulty variant, against the two data files."""

    chosen = _variant_of(scene, variant)
    if chosen.preset is not None:
        preset = load_difficulty_presets(repo).preset(chosen.preset)
        base, preset_version = preset.deltas(), preset.version
    else:
        # No preset is the identity, not an error: `natural` is defined that way and every
        # converted scene carries it. Overrides still apply, and are still validated.
        base, preset_version = DifficultyDeltas(), None
    deltas = apply_overrides(base, chosen.overrides, preset=chosen.preset)

    profiles = load_acoustic_profiles(repo) if _needs_profiles(scene) else None
    room_id = scene.acoustics.room
    room = profiles.room(room_id) if (profiles is not None and room_id is not None) else None
    wet = clamp(room.wet + deltas.wet, 0.0, 1.0) if room is not None else 0.0
    return ResolvedAcoustics(
        variant=variant,
        preset=chosen.preset,
        preset_version=preset_version,
        deltas=deltas,
        room_id=room_id,
        room=room,
        wet=round(wet, 6),
        profiles=profiles,
    )


def _variant_pace(utterance: Utterance, multiplier: float) -> float:
    """The utterance's authored pace, multiplied by the variant's, held inside the model's bounds.

    Clamped rather than refused, and logged when it clamps. A preset is a scene-wide statement and
    a pace is a per-turn one; a scene with one turn already at 1.25 must not become unrenderable
    at `challenging` because 1.25 × 1.05 leaves the window by two hundredths. The note is at
    `info` because it is a fact about the render, not a defect — and it is in the log rather than
    silent because the difference between "the preset was applied" and "the preset was applied
    except here" is otherwise invisible.
    """

    raw = utterance.pace * multiplier
    paced = round(clamp(raw, PACE_MIN, PACE_MAX), 6)
    if abs(paced - raw) > 1e-9:
        log.info(
            "utterance %s: variant pace %.3f clamped to %.3f (the model's bounds are %.2f–%.2f)",
            utterance.id,
            raw,
            paced,
            PACE_MIN,
            PACE_MAX,
        )
    return paced


def _pan_of(entry: SpeechEntry | SfxEntry) -> float:
    return entry.placement.pan if entry.placement is not None else 0.0


def _placement_or_default(entry: SpeechEntry | SfxEntry) -> Placement:
    return entry.placement if entry.placement is not None else Placement()


@dataclass(frozen=True)
class _Placed:
    """How one timeline entry becomes one stem — the three kinds' differences, in one place."""

    bus: str
    pan: float
    gain_db: float
    window_ms: int | None
    loop: bool
    fade_in_ms: int = 0
    fade_in_start_ms: int = 0
    fade_out_ms: int = 0
    fade_out_start_ms: int = 0
    #: The acoustic filter chain, empty when there is nothing to do.
    fx: str = ""
    #: The readable version of `fx`, and what carries a profile's `version` into the node hash.
    acoustics: dict[str, Any] = field(default_factory=dict)
    #: This stem's level into the room's reverb bus, or None for a stem that is never sent.
    send_db: float | None = None

    def mix_input(self, stem_id: str) -> MixInput:
        return MixInput(
            stem_id=stem_id,
            bus=self.bus,
            fade_in_ms=self.fade_in_ms,
            fade_in_start_ms=self.fade_in_start_ms,
            fade_out_ms=self.fade_out_ms,
            fade_out_start_ms=self.fade_out_start_ms,
            send_db=self.send_db,
        )


def _stem_acoustics(
    entry: SpeechEntry | SfxEntry, acoustics: ResolvedAcoustics
) -> tuple[str, dict[str, Any], float]:
    """The chain, its readable parameters and the room send, for one placed entry.

    The variant's `distance` multiplies the placement's, and a placement that was never written
    counts as `distance: 1.0` — so `challenging`'s 1.25 moves *every* voice and event back, which
    is exactly what the concept document's "greater distance" asks for. A bed is not here: it has
    no `Placement` in the model, because a bed is the room and a room is not at a distance.
    """

    placement = _placement_or_default(entry)
    device = acoustics.device(placement.device)
    distance = round(placement.distance * acoustics.deltas.distance, 6)
    chain = stem_chain(device, distance)
    send_db = round(
        distance_send_db(distance) + (device.room_send_db if device is not None else 0.0), 3
    )
    readable: dict[str, Any] = {}
    if chain:
        readable = {"distance": distance}
        if device is not None:
            readable["device"] = placement.device
            readable["device_version"] = device.version
    return chain, readable, send_db


def _placement_of(
    entry: SpeechEntry | SfxEntry | AmbienceEntry,
    span: EntryTiming,
    acoustics: ResolvedAcoustics,
) -> _Placed:
    """Speech carries no gain (it is the reference), and only a bed is windowed and looped."""

    if isinstance(entry, (SpeechEntry, SfxEntry)):
        chain, readable, send_db = _stem_acoustics(entry, acoustics)
        return _Placed(
            bus="dialogue" if isinstance(entry, SpeechEntry) else "sfx",
            pan=_pan_of(entry),
            gain_db=0.0 if isinstance(entry, SpeechEntry) else entry.gain_db,
            window_ms=None,
            loop=False,
            fx=chain,
            acoustics=readable,
            send_db=send_db,
        )
    return _Placed(
        bus="ambience",
        # A bed has no `Placement` in the model at all: it is the room, and a room is not on one
        # side of the listener. Centred is the only honest reading of that.
        pan=0.0,
        # The one place a difficulty delta touches an authored level. Clamped into the model's own
        # window, so a preset can make a bed louder or quieter but cannot make it stop being a bed.
        gain_db=round(
            clamp(
                entry.gain_db + acoustics.deltas.ambience_gain_db,
                AMBIENCE_GAIN_MIN,
                AMBIENCE_GAIN_MAX,
            ),
            3,
        ),
        window_ms=span.end_ms - span.start_ms,
        loop=True,
        fade_in_ms=entry.fade_in_ms,
        fade_in_start_ms=span.start_ms,
        fade_out_ms=entry.fade_out_ms,
        fade_out_start_ms=max(0, span.end_ms - entry.fade_out_ms),
        # A recorded room tone is already a room; sending it through this one would put a second
        # room inside the first. `None` rather than a large negative number, so the mixer skips
        # the split entirely and the bed reaches the master by exactly the path it always did.
        send_db=None,
    )


# -- timeline identity --------------------------------------------------------


def _entry_ids(scene: Scene) -> dict[int, str]:
    """A stable id per timeline entry, indexed by position in `scene.timeline`.

    Speech entries are named by their utterance, which already has an id the transcript and the
    exercise both use. `SfxEntry` and `AmbienceEntry` carry no id in the model — they are
    positions, not objects — so they get one from their order among their own kind. Numbering per
    kind rather than per timeline means adding a sound does not rename an existing one unless it
    is inserted before it.
    """

    ids: dict[int, str] = {}
    counters = {"sfx": 0, "ambience": 0}
    for index, entry in enumerate(scene.timeline):
        if isinstance(entry, SpeechEntry):
            ids[index] = entry.utterance_id
        else:
            kind = entry.type
            counters[kind] += 1
            ids[index] = f"{kind}-{counters[kind]}"
    return ids


# -- the render ---------------------------------------------------------------


def render_scene(
    scene: Scene,
    store_dir: Path,
    *,
    variant: str = "natural",
    speech_engines: Mapping[str, SpeechGenerator],
    sound_engine: SoundGenerator | None = None,
    repo: Path | None = None,
    voices: Mapping[str, VoiceRef] | None = None,
) -> RenderResult:
    """Render one scene under `store_dir`, reusing every node whose hash is already known.

    `repo` is where the acoustic data files are read from and defaults to this checkout's root.
    Defaulted rather than required because a scene that names no room, no device and no preset
    reads neither file, and requiring the argument would make every caller supply a path for a
    lookup that never happens.

    `voices` is the bound identity of every stored voice reference the cast names — resolved by
    the caller, because resolving one means opening the studio database and this module opens no
    database. A cast member with a `voice_ref` that is not in here is refused rather than rendered:
    a take whose consent hash the manifest cannot state is a take nothing can publish honestly.
    """

    acoustics = _resolve_acoustics(scene, variant, repo or REPO_ROOT)
    scene_sha = scene.sha256()
    store_dir.mkdir(parents=True, exist_ok=True)
    assets = AssetStore(store_dir)
    cache = NodeCache(store_dir)
    directory = store_dir / "renders" / scene_sha / variant
    directory.mkdir(parents=True, exist_ok=True)
    runs: list[NodeRun] = []

    with tempfile.TemporaryDirectory(prefix="scene-render-", dir=store_dir) as raw:
        work = Path(raw)

        def run(node: Node, produce: Produce, suffix: str = ".wav") -> str:
            """One node through `evaluate_or_reuse`, recorded so the manifest can count it."""

            asset, cached = evaluate_or_reuse(
                node, produce, assets=assets, cache=cache, work=work, suffix=suffix
            )
            runs.append(
                NodeRun(node.node_hash(), node.type, node.impl_version, asset, cached, node.params)
            )
            return asset

        # -- pass 1: every take exists before anything is placed ---------------

        engines = _resolve_engines(scene, speech_engines)
        cast_voices = _resolve_cast_voices(scene, voices or {})
        paced: dict[str, str] = {}
        for utterance in scene.script:
            member = scene.member(utterance.role)
            engine = engines[utterance.role]
            request = SpeechRequest(
                text=utterance.spoken_text(),
                voice=member.voice.voice,
                language="German",
                style=member.voice.style,
                seed=scene.seed_for(utterance),
                voice_ref=member.voice.voice_ref,
            )
            synth = synth_node(request, engine, cast_voices.get(utterance.role))
            # Synthesis is deliberately upstream of every acoustic parameter: a difficulty variant
            # changes what happens *to* a take, never what the model is asked for, so two variants
            # of one scene share their takes however far apart they sound.
            take = run(synth, partial(_synth, engine, request))
            pace = _variant_pace(utterance, acoustics.deltas.pace)
            node = pace_node(pace, take)
            paced[utterance.id] = run(node, partial(_paced, assets, take, utterance, node, pace))

        sounds: dict[int, str] = {}
        for index, entry in enumerate(scene.timeline):
            if isinstance(entry, SpeechEntry):
                continue
            sounds[index] = _resolve_sound(entry.sound, assets, sound_engine, run)

        ir_asset = ""
        if acoustics.room is not None and acoustics.wet > 0.0 and acoustics.room_id is not None:
            node_ir = ir_node(acoustics.room_id, acoustics.room)
            ir_asset = run(node_ir, partial(_impulse_response, acoustics.room))

        # -- pass 2: the timeline ---------------------------------------------

        durations = {
            utterance_id: _duration_ms(assets, asset) for utterance_id, asset in paced.items()
        }
        sound_durations = {index: _duration_ms(assets, asset) for index, asset in sounds.items()}
        timing, timeline, scene_end = _resolve_timing(
            scene, durations, sound_durations, overlap_ms=acoustics.deltas.overlap_ms
        )
        ids = _entry_ids(scene)
        spans = {row.entry_id: row for row in timeline}

        # -- pass 3: placement, mix, master, derivatives -----------------------

        stems: list[tuple[str, str, str]] = []  # (stem id, asset sha, bus)
        mix_inputs: list[MixInput] = []
        for index, entry in enumerate(scene.timeline):
            stem_id = ids[index]
            span = spans[stem_id]
            source = paced[entry.utterance_id] if isinstance(entry, SpeechEntry) else sounds[index]
            placed = _placement_of(entry, span, acoustics)
            node = track_node(
                pan=placed.pan,
                gain_db=placed.gain_db,
                delay_ms=span.start_ms,
                window_ms=placed.window_ms,
                loop=placed.loop,
                source_hash=source,
                fx=placed.fx,
                acoustics=placed.acoustics,
            )
            stem = run(node, partial(_track, assets, source, node))
            stems.append((stem_id, stem, placed.bus))
            mix_inputs.append(placed.mix_input(stem_id))

        room = acoustics.room_mix(ir_asset) if ir_asset else None
        master = _mix_and_normalize(assets, run, mix_inputs, stems, buses=set(BUS_ALL), room=room)
        # `dry.wav` is the dialogue bus **in the same room**. The soundscape diagnostic measures
        # the master against it to ask how loud the non-speech material is, and the speech's own
        # reverb is part of the speech, not part of the background.
        dry = _mix_and_normalize(assets, run, mix_inputs, stems, buses={"dialogue"}, room=room)
        qa = run(encode_node("qa", master), partial(_encode, assets, master, "qa"))
        publish = run(
            encode_node("publish", master),
            partial(_encode, assets, master, "publish"),
            suffix=".mp3",
        )

        artifacts = _publish_artifacts(
            assets, directory, stems=stems, master=master, dry=dry, qa=qa, publish=publish
        )

    result = RenderResult(
        scene_slug=scene.slug,
        scene_sha256=scene_sha,
        variant=variant,
        directory=directory,
        manifest_path=directory / "render.json",
        artifacts=artifacts,
        timing=timing,
        timeline=timeline,
        nodes=runs,
        duration_ms=scene_end,
        acoustics=acoustics,
        ir_assets={acoustics.room_id: ir_asset} if ir_asset and acoustics.room_id else {},
        voices=cast_voices,
    )
    _write_manifest(result, scene, assets, engines, sound_engine)
    return result


def _resolve_cast_voices(
    scene: Scene, voices: Mapping[str, VoiceRef]
) -> dict[str, VoiceRef]:
    """One bound voice identity per cast role that names a reference, refusing an unresolved one.

    Refused **here** rather than at the engine, because the engine's copy of a voice cannot say
    what the manifest needs: a render that produced audio and could not state which consent
    permitted it would be exactly the artifact this whole path exists to make impossible.
    """

    resolved: dict[str, VoiceRef] = {}
    for member in scene.cast:
        voice_ref = member.voice.voice_ref
        if voice_ref is None:
            continue
        found = voices.get(voice_ref)
        if found is None:
            available = ", ".join(sorted(voices)) or "none"
            raise ValueError(
                f"role {member.role} is cast on voice reference {voice_ref}, which this render "
                f"was not given; resolved: {available}"
            )
        resolved[member.role] = found
    return resolved


def _resolve_engines(
    scene: Scene, speech_engines: Mapping[str, SpeechGenerator]
) -> dict[str, SpeechGenerator]:
    """One engine per cast role, and one inert-style warning per engine that discards style.

    Once per render and per engine, not per utterance: a twelve-turn dialogue would otherwise
    print twelve identical warnings and teach the editor to scroll past them.
    """

    resolved: dict[str, SpeechGenerator] = {}
    for member in scene.cast:
        engine = speech_engines.get(member.voice.engine)
        if engine is None:
            available = ", ".join(sorted(speech_engines)) or "none"
            raise ValueError(
                f"role {member.role} is cast on engine {member.voice.engine}, "
                f"which this render was not given (it has: {available})"
            )
        resolved[member.role] = engine
    for engine in {id(value): value for value in resolved.values()}.values():
        styled = any(
            scene.member(utterance.role).voice.style
            for utterance in scene.script
            if resolved[utterance.role] is engine
        )
        warn_if_style_is_inert(engine, bool(styled))
    return resolved


def _resolve_sound(
    sound: Sound,
    assets: AssetStore,
    sound_engine: SoundGenerator | None,
    run: RunNode,
) -> str:
    """A timeline sound as an asset: imported and trimmed, or generated.

    A `SoundSpec` with no generator is a **refusal**. A render is given a sound engine by name
    (`scene render --sound-engine`) or it has none at all, and a scene that asked for a generated
    sound and got silence would be a scene nobody could hear was wrong.
    """

    if isinstance(sound, AssetRef):
        node = import_node(sound.ref, sound.source_start_ms, sound.source_duration_ms)
        return run(node, partial(_import, assets, sound, node))
    if sound_engine is None:
        raise ValueError(f"{NO_SOUND_ENGINE}: {sound.prompt!r}")
    request = SoundRequest(
        prompt=sound.prompt,
        negative_prompt=sound.negative_prompt,
        seed=sound.seed,
        # The gateway's own default stands in when the scene states no length. A `SoundSpec`
        # without a duration is "as long as the generator's natural take"; making one up here
        # would put a number in the manifest that no author chose.
        **({"duration_seconds": sound.duration_seconds} if sound.duration_seconds else {}),
        params=sound.params,
    )
    node = sound_gen_node(request, sound_engine)
    return run(node, partial(_sound, sound_engine, request))


# -- node evaluation wrappers -------------------------------------------------
#
# Each one resolves its inputs through the store, calls the node's evaluate function and returns
# the provenance sidecar. They exist so `run` above has one shape for every node type, and they
# all take `target` **last** so a caller can `partial` everything else in. That is not a style
# preference: the alternative, a lambda closing over a loop variable, is the classic way to
# render twelve copies of the last utterance, and a default-argument lambda that avoids it is
# something mypy cannot infer a type for.


def _synth(engine: SpeechGenerator, request: SpeechRequest, target: Path) -> dict[str, Any]:
    return evaluate_synth(engine, request, target).provenance | {"kind": "speech-take"}


def _sound(engine: SoundGenerator, request: SoundRequest, target: Path) -> dict[str, Any]:
    """The engine's provenance plus the request that produced it.

    `AudioAsset.provenance` carries `request_sha256` and not the request, which is right for a
    hash but wrong for a library: a generated sound's prompt, negative prompt, seed and length
    are the editorial record of *why these bytes*, and a sidecar that can only prove the request
    was some request leaves the sound library with nothing to show beside a Freesound title.
    `sources.list_generated_sounds` reads exactly this.
    """

    provenance = evaluate_sound_gen(engine, request, target).provenance
    return provenance | {"kind": "generated-sound", "request": request.model_dump(mode="json")}


def _paced(
    assets: AssetStore, take: str, utterance: Utterance, node: Node, pace: float, target: Path
) -> dict[str, Any]:
    """The **resolved** pace, not `utterance.pace`: a variant multiplies it before it gets here."""

    evaluate_pace(assets.require(take), target, pace)
    return derived_provenance(node, {"utterance_id": utterance.id})


def _impulse_response(room: RoomProfile, target: Path) -> dict[str, Any]:
    return evaluate_ir(room, target)


def _import(assets: AssetStore, sound: AssetRef, node: Node, target: Path) -> dict[str, Any]:
    evaluate_import(
        assets.require(sound.ref), target, sound.source_start_ms, sound.source_duration_ms
    )
    return derived_provenance(node, {"source": sound.ref})


def _track(assets: AssetStore, source: str, node: Node, target: Path) -> dict[str, Any]:
    evaluate_track(
        assets.require(source),
        target,
        pan=float(node.params["pan"]),
        gain_db=float(node.params["gain_db"]),
        delay_ms=int(node.params["delay_ms"]),
        window_ms=node.params["window_ms"],
        loop=bool(node.params["loop"]),
        # `.get`, because the key is absent on a stem with no acoustic treatment — which is what
        # keeps such a stem on the node hash it had before this layer existed.
        fx=str(node.params.get("fx", "")),
    )
    return derived_provenance(node)


def _encode(assets: AssetStore, source: str, encoding: str, target: Path) -> dict[str, Any]:
    evaluate_encode(assets.require(source), target, encoding)
    return {"kind": "encode", "encoding": encoding, "source": source}


def _mix_and_normalize(
    assets: AssetStore,
    run: RunNode,
    mix_inputs: Sequence[MixInput],
    stems: Sequence[tuple[str, str, str]],
    *,
    buses: set[str],
    room: RoomMix | None = None,
) -> str:
    """Sum the requested buses, then loudness-normalise the result.

    Called twice: once for the master and once for the dialogue bus alone, which is `dry.wav` —
    the speech-only reference the soundscape diagnostic measures the final mix against. When a
    scene has no non-speech entries the two calls build the *same* node, so the second is a cache
    hit and `dry.wav` is `master.wav` by construction rather than by a copy.
    """

    selected = [
        (row, stem) for row, stem in zip(mix_inputs, stems, strict=True) if row.bus in buses
    ]
    inputs = [row for row, _ in selected]
    hashes = [stem[1] for _, stem in selected]
    mix = mix_node(inputs, hashes, room)
    mixed = run(mix, partial(_mix, assets, hashes, inputs, mix, room))
    normalise = loudnorm_node(mixed)
    return run(normalise, partial(_loudnorm, assets, mixed, normalise))


def _mix(
    assets: AssetStore,
    hashes: Sequence[str],
    inputs: Sequence[MixInput],
    node: Node,
    room: RoomMix | None,
    target: Path,
) -> dict[str, Any]:
    evaluate_mix(
        [assets.require(value) for value in hashes],
        inputs,
        target,
        room=room,
        ir_path=assets.require(room.ir_asset) if room is not None else None,
    )
    return derived_provenance(node)


def _loudnorm(assets: AssetStore, source: str, node: Node, target: Path) -> dict[str, Any]:
    evaluate_loudnorm(assets.require(source), target)
    return derived_provenance(node)


# -- timing -------------------------------------------------------------------


def _duration_ms(assets: AssetStore, asset: str) -> int:
    seconds = wav_duration(assets.require(asset))
    if seconds is None:
        raise ValueError(f"cannot measure the duration of asset {asset}")
    return round(seconds * 1000)


def _resolve_timing(
    scene: Scene,
    durations: Mapping[str, int],
    sound_durations: Mapping[int, int],
    *,
    overlap_ms: int = 0,
) -> tuple[list[UtteranceTiming], list[EntryTiming], int]:
    """Where everything sits, once the takes exist.

    `lead_in_ms` offsets **all** speech, explicit and sequential alike: it is silence prepended to
    the dialogue so a scene-opening sound can be heard before anyone talks, and `SfxEntry.at_ms`
    is absolute scene time measured from the start of the mix. A ring at 0 with a 1 200 ms lead-in
    is therefore heard 1 200 ms before the first word — which is the whole reason lead-in exists,
    and would not be true if the lead-in were applied to the mix instead of to the speech.

    `overlap_ms` is the difficulty preset's, and it moves *only* sequential turns. Three rules,
    each of which is a way the feature could otherwise be wrong:

    * **Across roles only.** A speaker never overlaps themselves — that is not a hard scene, it is
      one take mixed over itself, which is a defect in every reading.
    * **Never before the previous turn started**, so a short turn with a long overlap cannot be
      reordered by arithmetic.
    * **Never before the scene's speech start**, which is what `lead_in_ms` bought.

    An explicit `at_ms` is untouched. A scene that pinned a time already said what it wanted, and
    the whole reason explicit times exist in the model is overlap the author placed by hand.
    """

    lead = scene.acoustics.lead_in_ms
    ids = _entry_ids(scene)
    cursor = lead
    previous_role: str | None = None
    previous_start = lead
    timing: list[UtteranceTiming] = []
    spans: dict[str, tuple[int, int]] = {}
    for index, entry in enumerate(scene.timeline):
        if not isinstance(entry, SpeechEntry):
            continue
        utterance = scene.utterance(entry.utterance_id)
        if entry.at_ms is not None:
            start = lead + entry.at_ms
        else:
            start = cursor
            if overlap_ms and previous_role is not None and previous_role != utterance.role:
                start = max(start - overlap_ms, lead, previous_start)
        end = start + durations[utterance.id]
        cursor = end + utterance.pause_after_ms
        previous_role, previous_start = utterance.role, start
        timing.append(UtteranceTiming(utterance_id=utterance.id, start_ms=start, end_ms=end))
        spans[ids[index]] = (start, end)

    for index, entry in enumerate(scene.timeline):
        if isinstance(entry, SfxEntry):
            spans[ids[index]] = (entry.at_ms, entry.at_ms + sound_durations[index])

    # The scene ends when the last thing that *has* an end has ended — speech and events. A bed
    # is under the scene, so it cannot define the scene's length: `end_ms=None` fills to this
    # figure, and an explicit `end_ms` past it is clipped to it.
    #
    # Measured on the corpus, not reasoned about. Every converted dialogue's bed carries an
    # explicit `end_ms`, because the legacy manifest's `duration_ms` was how much of the looped
    # source the old mixer trimmed — an intent about the *scene*, not a second end time. Letting
    # that number extend the render made `ls-wohnen-01` 45.0 s against the 33 s artifact it was
    # converted from: eleven seconds of room tone after the last word. Clipping is visible rather
    # than silent, because `render.json`'s timeline states the span that was actually rendered.
    ends = [end for start, end in spans.values()]
    scene_end = max([lead, *ends])

    for index, entry in enumerate(scene.timeline):
        if not isinstance(entry, AmbienceEntry):
            continue
        end = min(entry.end_ms, scene_end) if entry.end_ms is not None else scene_end
        if end <= entry.start_ms:
            raise ValueError(
                f"ambience bed {ids[index]} starts at {entry.start_ms} ms and the scene ends at "
                f"{scene_end} ms; it would have no length"
            )
        spans[ids[index]] = (entry.start_ms, end)

    timeline = [
        EntryTiming(
            entry_id=ids[index],
            type=entry.type,
            start_ms=spans[ids[index]][0],
            end_ms=spans[ids[index]][1],
        )
        for index, entry in enumerate(scene.timeline)
    ]
    return timing, timeline, scene_end


# -- outputs ------------------------------------------------------------------


def _publish_artifacts(
    assets: AssetStore,
    directory: Path,
    *,
    stems: Sequence[tuple[str, str, str]],
    master: str,
    dry: str,
    qa: str,
    publish: str,
) -> list[Artifact]:
    """Copy the render's outputs out of the content-addressed store under readable names.

    Stems and masters are kept per scene sha **forever**: nothing in this module deletes a
    render, because a published artifact's stems are the only way to re-mix it without re-running
    a model whose weights may have moved on.
    """

    (directory / "stems").mkdir(parents=True, exist_ok=True)
    written: list[Artifact] = []
    for stem_id, asset, _bus in stems:
        target = directory / "stems" / f"{stem_id}.wav"
        shutil.copyfile(assets.require(asset), target)
        written.append(Artifact(path=target, sha256=asset, kind="stem"))
    for name, asset, kind in (
        ("master.wav", master, "master"),
        ("dry.wav", dry, "dry"),
        ("qa.wav", qa, "qa"),
        ("publish.mp3", publish, "publish"),
    ):
        target = directory / name
        shutil.copyfile(assets.require(asset), target)
        written.append(Artifact(path=target, sha256=asset, kind=kind))
    return written


def engine_lock(names: Sequence[str]) -> dict[str, Any]:
    """The `models.lock.json` rows for the engines this render used.

    A name with no row is recorded as `null` rather than omitted: `fake` has no locked model, and
    a manifest that simply left it out would read as a render whose engine was never stated.
    """

    try:
        lock = model_lock(PACKAGE_ROOT / "models.lock.json")
    except (OSError, ValueError):  # pragma: no cover - the lock ships with the package
        return {name: None for name in names}
    models = lock.get("models")
    rows = models if isinstance(models, dict) else {}
    return {name: rows.get(name) for name in names}


def _write_manifest(
    result: RenderResult,
    scene: Scene,
    assets: AssetStore,
    engines: Mapping[str, SpeechGenerator],
    sound_engine: SoundGenerator | None,
) -> None:
    """The render manifest: every hash, every asset, every time, and what produced them."""

    used = sorted({engine.name for engine in engines.values()})
    if sound_engine is not None:
        used.append(sound_engine.name)
    manifest = {
        "version": MANIFEST_VERSION,
        "created_at": datetime.now(UTC).isoformat(),
        "scene_slug": scene.slug,
        "scene_sha256": result.scene_sha256,
        "variant": result.variant,
        "duration_ms": result.duration_ms,
        # The resolved acoustic state: which profiles, at which versions, with which deltas, and
        # the sha of every impulse response convolved. This is the record that makes a difficulty
        # variant reproducible — the scene sha says what was authored, and this says what the two
        # data files turned it into on the day it was rendered.
        "acoustics": (
            result.acoustics.manifest() | {"ir_assets": result.ir_assets}
            if result.acoustics is not None
            else None
        ),
        "ffmpeg": ffmpeg_version(),
        # Every consented voice this render spoke through, by cast role. It is also in the synth
        # nodes' parameters, and it is stated once more here on purpose: **this is the key a
        # publisher computes its claims from.** `voice_cloning_used` is `bool(voices)` and the
        # consent hash list is `[row.consent_sha256 for row in voices.values()]` — a top-level fact
        # rather than something recovered by walking a node list and knowing which node type to
        # look at. A claim that is expensive to compute is a claim somebody hardcodes.
        "voices": {
            role: voice.as_json() for role, voice in sorted(result.voices.items())
        },
        "engines": {
            name: {"name": engine.name, "revision": engine.revision}
            for name, engine in sorted(
                {engine.name: engine for engine in engines.values()}.items()
            )
        }
        | (
            {sound_engine.name: {"name": sound_engine.name, "revision": sound_engine.revision}}
            if sound_engine is not None
            else {}
        ),
        "models_lock": engine_lock(used),
        "nodes": [
            {
                "hash": row.node_hash,
                "type": row.type,
                "impl_version": row.impl_version,
                "asset": row.asset,
                "cached": row.cached,
                "params": row.params,
            }
            for row in result.nodes
        ],
        "nodes_evaluated": result.nodes_evaluated,
        "nodes_cached": result.nodes_cached,
        "assets": {
            row.asset: assets.provenance(row.asset)
            for row in sorted(result.nodes, key=lambda value: value.asset)
        },
        "timing": [
            {"utterance_id": row.utterance_id, "start_ms": row.start_ms, "end_ms": row.end_ms}
            for row in result.timing
        ],
        "timeline": [
            {
                "entry_id": row.entry_id,
                "type": row.type,
                "start_ms": row.start_ms,
                "end_ms": row.end_ms,
            }
            for row in result.timeline
        ],
        "artifacts": [
            {
                "path": row.path.relative_to(result.directory).as_posix(),
                "sha256": row.sha256,
                "kind": row.kind,
            }
            for row in result.artifacts
        ],
    }
    result.manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )


def artifact_digest(path: Path) -> str:
    """The sha256 of a file on disk, for a CLI envelope that must not trust the store."""

    return sha256_file(path)
