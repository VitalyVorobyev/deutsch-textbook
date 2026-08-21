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

**Everything a scene can say that this PR cannot render is refused, not ignored.** Rooms,
distances, device profiles and difficulty presets belong to the DSP PR. A renderer that warned
and carried on would publish audio that is not the scene that was authored, and nothing
downstream could tell.
"""

from __future__ import annotations

import json
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import Any, Callable, Mapping, Protocol, Sequence

from ..adapters import model_lock, warn_if_style_is_inert, wav_duration
from ..generative.gateway import SoundGenerator, SoundRequest, SpeechGenerator, SpeechRequest
from ..scene.model import (
    AmbienceEntry,
    AssetRef,
    Scene,
    SfxEntry,
    Sound,
    SpeechEntry,
    Utterance,
)
from .assets import AssetStore, sha256_file
from .nodes import (
    DSP_PR,
    NO_SOUND_ENGINE,
    MixInput,
    Node,
    encode_node,
    evaluate_encode,
    evaluate_import,
    evaluate_loudnorm,
    evaluate_mix,
    evaluate_pace,
    evaluate_sound_gen,
    evaluate_synth,
    evaluate_track,
    derived_provenance,
    ffmpeg_version,
    import_node,
    loudnorm_node,
    mix_node,
    pace_node,
    sound_gen_node,
    synth_node,
    track_node,
)

#: `models.lock.json`, the provenance record every generative model in this studio is pinned by.
PACKAGE_ROOT = Path(__file__).resolve().parents[3]

MANIFEST_VERSION = 1

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


# -- refusals -----------------------------------------------------------------


def _refuse_unrenderable(scene: Scene, variant: str) -> None:
    """Everything the model can express and this renderer cannot honour."""

    chosen = next((row for row in scene.variants if row.id == variant), None)
    if chosen is None:
        known = ", ".join(row.id for row in scene.variants)
        raise ValueError(f"scene {scene.slug} has no variant {variant} (it has: {known})")
    if chosen.preset is not None or chosen.overrides:
        raise ValueError(f"variant {variant} carries a preset or overrides — {DSP_PR}")
    if scene.acoustics.room is not None:
        raise ValueError(f"scene {scene.slug} names room {scene.acoustics.room!r} — {DSP_PR}")
    for entry in scene.timeline:
        placement = getattr(entry, "placement", None)
        if placement is None:
            continue
        if placement.device is not None:
            raise ValueError(f"placement names device {placement.device!r} — {DSP_PR}")
        if placement.distance != 1.0:
            raise ValueError(f"placement sets distance {placement.distance} — {DSP_PR}")


def _pan_of(entry: SpeechEntry | SfxEntry) -> float:
    return entry.placement.pan if entry.placement is not None else 0.0


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

    def mix_input(self, stem_id: str) -> MixInput:
        return MixInput(
            stem_id=stem_id,
            bus=self.bus,
            fade_in_ms=self.fade_in_ms,
            fade_in_start_ms=self.fade_in_start_ms,
            fade_out_ms=self.fade_out_ms,
            fade_out_start_ms=self.fade_out_start_ms,
        )


def _placement_of(entry: SpeechEntry | SfxEntry | AmbienceEntry, span: EntryTiming) -> _Placed:
    """Speech carries no gain (it is the reference), and only a bed is windowed and looped."""

    if isinstance(entry, SpeechEntry):
        return _Placed(bus="dialogue", pan=_pan_of(entry), gain_db=0.0, window_ms=None, loop=False)
    if isinstance(entry, SfxEntry):
        return _Placed(
            bus="sfx", pan=_pan_of(entry), gain_db=entry.gain_db, window_ms=None, loop=False
        )
    return _Placed(
        bus="ambience",
        # A bed has no `Placement` in the model at all: it is the room, and a room is not on one
        # side of the listener. Centred is the only honest reading of that.
        pan=0.0,
        gain_db=entry.gain_db,
        window_ms=span.end_ms - span.start_ms,
        loop=True,
        fade_in_ms=entry.fade_in_ms,
        fade_in_start_ms=span.start_ms,
        fade_out_ms=entry.fade_out_ms,
        fade_out_start_ms=max(0, span.end_ms - entry.fade_out_ms),
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
) -> RenderResult:
    """Render one scene under `store_dir`, reusing every node whose hash is already known."""

    _refuse_unrenderable(scene, variant)
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
            """Evaluate one node, or don't. The single place a cache hit is decided."""

            node_hash = node.node_hash()
            known = cache.get(node_hash)
            if known is not None and assets.get(known) is not None:
                runs.append(NodeRun(node_hash, node.type, node.impl_version, known, True, node.params))
                return known
            target = work / f"{node_hash}{suffix}"
            provenance = produce(target)
            asset = assets.put(target, provenance)
            cache.put(node_hash, asset)
            runs.append(NodeRun(node_hash, node.type, node.impl_version, asset, False, node.params))
            return asset

        # -- pass 1: every take exists before anything is placed ---------------

        engines = _resolve_engines(scene, speech_engines)
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
            )
            synth = synth_node(request, engine)
            take = run(synth, partial(_synth, engine, request))
            pace = pace_node(utterance.pace, take)
            paced[utterance.id] = run(pace, partial(_paced, assets, take, utterance, pace))

        sounds: dict[int, str] = {}
        for index, entry in enumerate(scene.timeline):
            if isinstance(entry, SpeechEntry):
                continue
            sounds[index] = _resolve_sound(entry.sound, assets, sound_engine, run)

        # -- pass 2: the timeline ---------------------------------------------

        durations = {
            utterance_id: _duration_ms(assets, asset) for utterance_id, asset in paced.items()
        }
        sound_durations = {index: _duration_ms(assets, asset) for index, asset in sounds.items()}
        timing, timeline, scene_end = _resolve_timing(scene, durations, sound_durations)
        ids = _entry_ids(scene)
        spans = {row.entry_id: row for row in timeline}

        # -- pass 3: placement, mix, master, derivatives -----------------------

        stems: list[tuple[str, str, str]] = []  # (stem id, asset sha, bus)
        mix_inputs: list[MixInput] = []
        for index, entry in enumerate(scene.timeline):
            stem_id = ids[index]
            span = spans[stem_id]
            source = paced[entry.utterance_id] if isinstance(entry, SpeechEntry) else sounds[index]
            placed = _placement_of(entry, span)
            node = track_node(
                pan=placed.pan,
                gain_db=placed.gain_db,
                delay_ms=span.start_ms,
                window_ms=placed.window_ms,
                loop=placed.loop,
                source_hash=source,
            )
            stem = run(node, partial(_track, assets, source, node))
            stems.append((stem_id, stem, placed.bus))
            mix_inputs.append(placed.mix_input(stem_id))

        master = _mix_and_normalize(assets, run, mix_inputs, stems, buses=set(BUS_ALL))
        dry = _mix_and_normalize(assets, run, mix_inputs, stems, buses={"dialogue"})
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
    )
    _write_manifest(result, scene, assets, engines, sound_engine)
    return result


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

    A `SoundSpec` with no generator is a **refusal**. Production renders have no sound engine
    until the Stable Audio PR lands, and a scene that asked for a generated sound and got silence
    would be a scene nobody could hear was wrong.
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
    return evaluate_sound_gen(engine, request, target).provenance | {"kind": "generated-sound"}


def _paced(
    assets: AssetStore, take: str, utterance: Utterance, node: Node, target: Path
) -> dict[str, Any]:
    evaluate_pace(assets.require(take), target, utterance.pace)
    return derived_provenance(node, {"utterance_id": utterance.id})


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
    mix = mix_node(inputs, hashes)
    mixed = run(mix, partial(_mix, assets, hashes, inputs, mix))
    normalise = loudnorm_node(mixed)
    return run(normalise, partial(_loudnorm, assets, mixed, normalise))


def _mix(
    assets: AssetStore,
    hashes: Sequence[str],
    inputs: Sequence[MixInput],
    node: Node,
    target: Path,
) -> dict[str, Any]:
    evaluate_mix([assets.require(value) for value in hashes], inputs, target)
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
    scene: Scene, durations: Mapping[str, int], sound_durations: Mapping[int, int]
) -> tuple[list[UtteranceTiming], list[EntryTiming], int]:
    """Where everything sits, once the takes exist.

    `lead_in_ms` offsets **all** speech, explicit and sequential alike: it is silence prepended to
    the dialogue so a scene-opening sound can be heard before anyone talks, and `SfxEntry.at_ms`
    is absolute scene time measured from the start of the mix. A ring at 0 with a 1 200 ms lead-in
    is therefore heard 1 200 ms before the first word — which is the whole reason lead-in exists,
    and would not be true if the lead-in were applied to the mix instead of to the speech.
    """

    lead = scene.acoustics.lead_in_ms
    ids = _entry_ids(scene)
    cursor = lead
    timing: list[UtteranceTiming] = []
    spans: dict[str, tuple[int, int]] = {}
    for index, entry in enumerate(scene.timeline):
        if not isinstance(entry, SpeechEntry):
            continue
        utterance = scene.utterance(entry.utterance_id)
        start = lead + entry.at_ms if entry.at_ms is not None else cursor
        end = start + durations[utterance.id]
        cursor = end + utterance.pause_after_ms
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
        "ffmpeg": ffmpeg_version(),
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
