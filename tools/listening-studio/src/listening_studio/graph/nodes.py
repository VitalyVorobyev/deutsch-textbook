"""The render nodes: what each computation is, what identifies it, and how it is evaluated.

A node is **data plus one function**, never a class hierarchy. `Node` carries a type name, an
implementation version, a canonical parameter dict and the hashes of its inputs; each node type
has a constructor that fills those in and an `evaluate_*` function that produces the bytes. There
is no base class with behaviour, because the only thing every node genuinely shares is its
identity rule, and that is a free function.

Identity
--------

    node_hash = sha256(type + ":" + impl_version + ":" + canonical_json(params) + ":" +
                       ",".join(sorted(input_hashes)))

Two nodes with the same hash compute the same audio, so the result is cached under it
(`graph.render.NodeCache`) and an unchanged subtree of a re-rendered scene costs nothing.

**The cache-invalidation contract.** `IMPL_VERSIONS` maps each node type to the version of *its
own* computation. Bumping one entry invalidates exactly that class of node and nothing else: a
change to how a take is paced must not re-run synthesis, and a change to the limiter must not
re-run either. This is the discipline `domain.line_cache_key`'s `processor_version` established
with a single global number — one number for the whole render meant every DSP fix threw away
every take. Change the audio a node produces, bump that node's version in the same commit; a
change that cannot alter the bytes (a comment, a refactor with identical ffmpeg arguments) does
not touch it.

Formats
-------

The working master is **stereo 48 kHz `pcm_s24le`**. Speech models here emit mono at their own
rate — Qwen3-TTS at 24 kHz — and a take is upsampled to 48 kHz on its way to the timeline. That
upsample is a resample, not new information: the source fidelity of a rendered scene is the
model's 24 kHz, and 48 kHz is the rate the mix is *computed* at so that resampling happens once,
before summing, rather than once per bus. Two derivatives are always produced beside the master:
`qa.wav` (mono 16 kHz `pcm_s16le`), which is what Whisper and WavLM consume, and `publish.mp3`.
"""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

from ..adapters import conform
from ..dsp.chains import reverb_chains
from ..dsp.ir import IR_IMPL_VERSION, IR_RATE, write_ir
from ..dsp.profiles import RoomProfile
from ..generative.gateway import (
    AudioAsset,
    SoundGenerator,
    SoundRequest,
    SpeechGenerator,
    SpeechRequest,
)

# -- formats ------------------------------------------------------------------

#: The rate every node above `SynthNode` works at, and the rate `master.wav` is written at.
WORKING_RATE = 48_000
WORKING_CHANNELS = 2
WORKING_CODEC = "pcm_s24le"

#: What Whisper and WavLM consume. `speaker_qa._trimmed_audio` *refuses* anything else, so this
#: is a contract with the QA layer rather than a preference.
QA_RATE = 16_000
QA_CHANNELS = 1
QA_CODEC = "pcm_s16le"

#: The published derivative. 48 kHz because the master already is — resampling to 44.1 kHz on the
#: way out would be one more conversion for no listener-audible gain — and 128 kbps because the
#: shipped corpus encodes at 64 kbps *mono* (`export.MP3_BITRATE`, with its measured argument
#: about 16 kHz speech), and two channels at that same per-channel rate is 128 kbps. The number is
#: the corpus's, doubled for the channel count it was never asked about.
PUBLISH_BITRATE = "128k"
PUBLISH_RATE = 48_000

#: The loudness target of the shipped corpus. Stated once here and reused, because a scene
#: rendered at a different target would be louder or quieter than the 41 artifacts beside it in
#: the same lesson, which no learner-facing gate would catch.
LOUDNORM = "loudnorm=I=-19:TP=-1.5:LRA=7"

#: The look-ahead limiter the legacy mixer ends on: -1.5 dBFS, the same ceiling as `TP` above.
LIMITER = "alimiter=limit=0.8414"

#: Buses, in the order they are summed into the master. Speech first for the same reason the
#: legacy mixer put it first: it is the signal every other decision is measured against.
BUSES = ("dialogue", "ambience", "sfx")


# -- identity -----------------------------------------------------------------

#: The cache-invalidation contract; see the module docstring. All nine start at 1 — including
#: `ir`, whose version is `dsp.ir.IR_IMPL_VERSION` rather than a second number: the impulse
#: response generator lives in `dsp` because it touches no node, and two versions for one
#: computation would be two things to remember to bump.
IMPL_VERSIONS: dict[str, int] = {
    "synth": 1,
    "pace": 1,
    "sound-gen": 1,
    "import": 1,
    "ir": IR_IMPL_VERSION,
    "track": 1,
    "mix": 1,
    "loudnorm": 1,
    "encode": 1,
}


def canonical_json(value: object) -> str:
    """Sorted keys, no whitespace, UTF-8 as itself — the rule `Scene.canonical_json` uses.

    `sort_keys=True` recurses, which is what makes a node's hash independent of the order its
    parameters happened to be written in.
    """

    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


@dataclass(frozen=True)
class Node:
    """One computation, named by what it is and by everything it consumes."""

    type: str
    impl_version: int
    params: dict[str, Any]
    inputs: tuple[str, ...] = field(default=())

    def node_hash(self) -> str:
        payload = (
            f"{self.type}:{self.impl_version}:{canonical_json(self.params)}:"
            + ",".join(sorted(self.inputs))
        )
        return hashlib.sha256(payload.encode()).hexdigest()


def _node(node_type: str, params: dict[str, Any], inputs: Sequence[str] = ()) -> Node:
    return Node(
        type=node_type,
        impl_version=IMPL_VERSIONS[node_type],
        params=params,
        inputs=tuple(inputs),
    )


# -- filtergraph builders -----------------------------------------------------
#
# Every one of these returns a string and touches no audio, so the mix can be asserted exactly
# in a test that needs neither ffmpeg nor a WAV. A filter chain is the part of this pipeline that
# is wrong silently: an `adelay` with one value on a stereo stream delays one channel, an
# `afade` whose `st` is in milliseconds fades nothing, and the render still succeeds.


def _seconds(milliseconds: int) -> str:
    """Milliseconds as the seconds string ffmpeg wants, at fixed precision.

    Fixed rather than `%g`: the filter string is part of a node's parameters in spirit and of
    several test assertions in fact, and `0.35` versus `3.5e-01` is the kind of difference that
    only shows up as a cache miss.
    """

    return f"{milliseconds / 1000:.3f}"


def pan_filter(pan: float) -> str:
    """A mono take positioned in the stereo field by the constant-power (sine/cosine) law.

    With `θ = (pan + 1)·π/4`, the left gain is `cos θ` and the right gain is `sin θ`. Centre is
    `θ = π/4`, so both channels get `√2/2 ≈ 0.707` and `L² + R² = 1` at every position — the
    take keeps the same *power* as it moves, which is what stops a panned voice from sounding
    quieter than a centred one. A linear law (`1-p`/`p`) would lose 3 dB in the middle.
    """

    angle = (pan + 1.0) * math.pi / 4.0
    left = math.cos(angle)
    right = math.sin(angle)
    return f"pan=stereo|c0={left:.6f}*c0|c1={right:.6f}*c0"


def track_filters(
    *, pan: float, gain_db: float, delay_ms: int, window_ms: int | None, fx: str = ""
) -> str:
    """The filter chain that turns one mono take into one positioned stereo stem.

    Order is load-bearing. The window trim comes first so a looped bed is cut to length before
    anything is spent on it; the acoustic chain (`dsp.chains.stem_chain` — distance, then device)
    runs next, while the take is still mono, because a telephone is a one-channel channel and
    running its band-limiting twice on a panned pair costs double for the same result; `pan` is
    what makes the stream stereo, and `adelay` needs one value per channel; `volume` sits between
    them so the gain a placement asks for is applied to the take rather than to the delay's
    silence.

    `fx` defaults to empty and contributes nothing when it is, which is what keeps every stem in
    every scene rendered before this PR on the node hash it already had.
    """

    chain: list[str] = []
    if window_ms is not None:
        chain.append(f"atrim=duration={_seconds(window_ms)}")
        chain.append("asetpts=PTS-STARTPTS")
    if fx:
        chain.append(fx)
    chain.append(pan_filter(pan))
    if gain_db:
        chain.append(f"volume={gain_db:g}dB")
    if delay_ms:
        chain.append(f"adelay={delay_ms}|{delay_ms}")
    return ",".join(chain)


@dataclass(frozen=True)
class MixInput:
    """One stem as the mixer sees it: which bus it belongs to, and its fade if it has one.

    `send_db` is this stem's level into the room's reverb bus, or None for a stem that is never
    sent — which is every ambience bed, because a recorded room tone already *is* a room and
    convolving it would put that room inside this one. It is read only when the mix has a room;
    with no room there is no reverb bus, and a value that cannot reach the audio must not reach
    the node hash either.
    """

    stem_id: str
    bus: str
    fade_in_ms: int = 0
    fade_in_start_ms: int = 0
    fade_out_ms: int = 0
    fade_out_start_ms: int = 0
    send_db: float | None = None


@dataclass(frozen=True)
class RoomMix:
    """The scene's room, as the mixer needs it: which profile, how wet, and which IR asset."""

    room_id: str
    version: int
    wet: float
    ir_asset: str


def mix_filtergraph(inputs: Sequence[MixInput], room: RoomMix | None = None) -> str:
    """Per-bus `amix`, then the master sum and the limiter, as one `-filter_complex` string.

    Fades are applied here rather than in `track_filters` because a fade is a statement about
    where a bed sits *in the scene* — `st` is absolute scene time, which is only true after the
    stem has been delayed into place — while a track is a statement about one take.

    `duration=longest` and `normalize=0` throughout: the legacy mixer used `duration=first`
    because speech was always input zero and the mix was defined to end with it, which is exactly
    the assumption a bed extending past the last word breaks. `normalize=0` keeps every stem at
    the gain the scene asked for; amix's default divides by the input count, so adding one quiet
    sfx would silently drop the dialogue by 3 dB.

    **The room is a send-return, not an insert.** Every sent stem is split: one copy goes to its
    bus dry, the other through its own send gain into a single summed bus, which is convolved once
    against the room's impulse response and added to the master as a fourth input. So a scene with
    twelve stems still costs one convolution, and a distant speaker can still be wetter than a
    close one.

    The wet return is *added* at the room's level rather than crossfaded against the dry sum. A
    `(1-wet)` dry gain would attenuate the ambience bus, which is the one bus this design promises
    to leave alone, and the loudness normalisation downstream removes the level offset that adding
    introduces.
    """

    if not inputs:
        raise ValueError("a mix needs at least one stem")
    chains: list[str] = []
    labels: dict[str, list[str]] = {bus: [] for bus in BUSES}
    sends: list[str] = []
    for index, row in enumerate(inputs):
        source = f"[{index}:a]"
        filters: list[str] = []
        if row.fade_in_ms:
            filters.append(
                f"afade=t=in:st={_seconds(row.fade_in_start_ms)}:d={_seconds(row.fade_in_ms)}"
            )
        if row.fade_out_ms:
            filters.append(
                f"afade=t=out:st={_seconds(row.fade_out_start_ms)}:d={_seconds(row.fade_out_ms)}"
            )
        if room is not None and row.send_db is not None:
            filters.append("asplit=2")
            chains.append(f"{source}{','.join(filters)}[d{index}][w{index}]")
            labels[row.bus].append(f"[d{index}]")
            if row.send_db:
                chains.append(f"[w{index}]volume={row.send_db:g}dB[x{index}]")
                sends.append(f"[x{index}]")
            else:
                sends.append(f"[w{index}]")
        elif filters:
            label = f"[s{index}]"
            chains.append(f"{source}{','.join(filters)}{label}")
            labels[row.bus].append(label)
        else:
            labels[row.bus].append(source)

    bus_labels: list[str] = []
    for bus in BUSES:
        members = labels[bus]
        if not members:
            continue
        chains.append(
            "".join(members)
            + f"amix=inputs={len(members)}:duration=longest:normalize=0[{bus}]"
        )
        bus_labels.append(f"[{bus}]")
    if room is not None and sends:
        chains.append(
            "".join(sends) + f"amix=inputs={len(sends)}:duration=longest:normalize=0[send]"
        )
        # The IR is the last ffmpeg input, after every stem — `evaluate_mix` appends it in the
        # same order, and the index is the one thing the two sides have to agree on.
        chains.extend(reverb_chains(ir_index=len(inputs), wet=room.wet))
        bus_labels.append("[wet]")
    chains.append(
        "".join(bus_labels)
        + f"amix=inputs={len(bus_labels)}:duration=longest:normalize=0,{LIMITER}[out]"
    )
    return ";".join(chains)


# -- SynthNode ----------------------------------------------------------------


def synth_node(request: SpeechRequest, engine: SpeechGenerator) -> Node:
    """One take from one speech engine.

    The engine's **own** name and revision go into the parameters, never the name the scene's
    cast declared. They are normally the same string; they differ exactly when a render is forced
    onto another engine (`scene render --engine fake`), and that is the case that must not be
    able to write a fake take into the cache slot a Qwen take would be read from.
    """

    return _node(
        "synth",
        {
            "engine": engine.name,
            "engine_revision": engine.revision,
            "request": request.model_dump(mode="json"),
        },
    )


def evaluate_synth(engine: SpeechGenerator, request: SpeechRequest, target: Path) -> AudioAsset:
    target.parent.mkdir(parents=True, exist_ok=True)
    return engine.generate(request, target)


# -- PaceNode -----------------------------------------------------------------


def pace_node(pace: float, source_hash: str) -> Node:
    return _node(
        "pace",
        {
            "pace": pace,
            "rate": WORKING_RATE,
            # Mono: a take stays one channel until a `TrackNode` places it, so that the pan law
            # has exactly one signal to position.
            "channels": 1,
            "codec": WORKING_CODEC,
        },
        [source_hash],
    )


def evaluate_pace(source: Path, target: Path, pace: float) -> None:
    """`adapters.conform` at the working rate. The pace computation itself is not duplicated."""

    conform(source, target, pace, rate=WORKING_RATE, channels=1, codec=WORKING_CODEC)


# -- SoundGenNode -------------------------------------------------------------


NO_SOUND_ENGINE = (
    "no sound engine installed; import the sound or install one "
    "(a SoundSpec is resolved at render time and this render has no generator)"
)


def sound_gen_node(request: SoundRequest, engine: SoundGenerator) -> Node:
    return _node(
        "sound-gen",
        {
            "engine": engine.name,
            "engine_revision": engine.revision,
            "request": request.model_dump(mode="json"),
        },
    )


def evaluate_sound_gen(engine: SoundGenerator, request: SoundRequest, target: Path) -> AudioAsset:
    target.parent.mkdir(parents=True, exist_ok=True)
    return engine.generate(request, target)


# -- ImportNode ---------------------------------------------------------------


def import_node(ref: str, source_start_ms: int, source_duration_ms: int | None) -> Node:
    """One library asset, trimmed to the excerpt the scene chose.

    The trim is this node's parameters and not the track's: `source_start_ms` says which ten
    seconds of a ninety-second room tone the editor picked, which is a fact about the asset. Where
    that excerpt then sits in the scene is `TrackNode`'s business.
    """

    return _node(
        "import",
        {
            "ref": ref,
            "source_start_ms": source_start_ms,
            "source_duration_ms": source_duration_ms,
            "rate": WORKING_RATE,
            "channels": 1,
            "codec": WORKING_CODEC,
        },
    )


def import_filters(source_start_ms: int, source_duration_ms: int | None) -> str:
    trim = f"atrim=start={_seconds(source_start_ms)}"
    if source_duration_ms is not None:
        trim += f":duration={_seconds(source_duration_ms)}"
    return f"{trim},asetpts=PTS-STARTPTS"


def evaluate_import(
    source: Path, target: Path, source_start_ms: int, source_duration_ms: int | None
) -> None:
    """Trim a library asset and bring it to the working rate, **in mono**.

    Downmixing a stereo original loses its native image, and that is a deliberate loss: a scene
    states one `Placement.pan` per sound and has no way to say "keep the source's own stereo
    field", so honouring the model means one law applied to one mono take. Preserving an imported
    image would need a field in the scene model that does not exist, and stays out of scope — the
    acoustic layer beside this one places sounds, it does not inherit their recorded placement.
    """

    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(source),
            "-filter:a", import_filters(source_start_ms, source_duration_ms),
            "-ar", str(WORKING_RATE), "-ac", "1", "-c:a", WORKING_CODEC, "-y", str(target),
        ],
        check=True,
    )


# -- IrNode -------------------------------------------------------------------


def ir_node(room_id: str, room: RoomProfile) -> Node:
    """One room's impulse response. No inputs — a room is described, not derived from audio.

    The room's editorial `version` is a parameter of its own, beside the five numbers the
    generator actually reads. That is deliberate: bumping only the version leaves the generated
    bytes identical, so content addressing alone would hand the render the same asset and the same
    mix. The version in the hash is what lets an editor say "this is a different room now" without
    having to change a number they were happy with.
    """

    return _node(
        "ir",
        {
            "room": room_id,
            "room_version": room.version,
            "ir": room.ir.model_dump(mode="json"),
            "rate": IR_RATE,
            "channels": 1,
            "codec": WORKING_CODEC,
        },
    )


def evaluate_ir(room: RoomProfile, target: Path) -> dict[str, Any]:
    return write_ir(
        target,
        seed=room.ir.seed,
        decay_s=room.ir.decay_s,
        pre_delay_ms=room.ir.pre_delay_ms,
        lowpass_hz=room.ir.lowpass_hz,
        early_reflections=room.ir.early_reflections,
    )


# -- TrackNode ----------------------------------------------------------------


def track_node(
    *,
    pan: float,
    gain_db: float,
    delay_ms: int,
    window_ms: int | None,
    loop: bool,
    source_hash: str,
    fx: str = "",
    acoustics: Mapping[str, Any] | None = None,
) -> Node:
    """One placed stem.

    `fx` and `acoustics` are omitted from the parameters when there is nothing acoustic to say,
    rather than written as `""` and `null`. Two reasons, and the second is the load-bearing one:
    a stem with no device and unit distance computes exactly what it computed before this PR, so
    it must hash to the same node and reuse the asset already in the store; and a parameter that
    is always present but usually empty makes every manifest carry a field that means nothing.

    Both are present together or not at all. `fx` is the filter chain, which is what decides the
    audio; `acoustics` is the profile ids, versions and resolved distance behind it, which is what
    makes the manifest readable — and what carries a device's `version` into the hash when an
    editor bumps it without changing any of its numbers.
    """

    params: dict[str, Any] = {
        "pan": pan,
        "gain_db": gain_db,
        "delay_ms": delay_ms,
        "window_ms": window_ms,
        "loop": loop,
        "rate": WORKING_RATE,
        "channels": WORKING_CHANNELS,
        "codec": WORKING_CODEC,
    }
    if fx:
        params["fx"] = fx
        params["acoustics"] = dict(acoustics or {})
    return _node("track", params, [source_hash])


def evaluate_track(
    source: Path,
    target: Path,
    *,
    pan: float,
    gain_db: float,
    delay_ms: int,
    window_ms: int | None,
    loop: bool,
    fx: str = "",
) -> None:
    """Place one take: loop it to its window if it is a bed, then treat, pan, gain and delay it."""

    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-v", "error",
            # Before `-i`, and only for a bed: the legacy mixer looped every bed unconditionally
            # and trimmed the result, which is also what makes a short room tone cover a long
            # scene without the author having to say so.
            *(["-stream_loop", "-1"] if loop else []),
            "-i", str(source),
            "-filter:a",
            track_filters(
                pan=pan, gain_db=gain_db, delay_ms=delay_ms, window_ms=window_ms, fx=fx
            ),
            "-ar", str(WORKING_RATE), "-ac", str(WORKING_CHANNELS),
            "-c:a", WORKING_CODEC, "-y", str(target),
        ],
        check=True,
    )


# -- MixNode ------------------------------------------------------------------


def mix_node(
    inputs: Sequence[MixInput], stem_hashes: Sequence[str], room: RoomMix | None = None
) -> Node:
    """The mix, keyed by every stem, every fade, and the room if there is one.

    `send_db` enters the parameters only when there is a room to send to, for the reason
    `MixInput` states: with no reverb bus the value cannot reach the audio, so it must not be able
    to move the hash.
    """

    rows: list[dict[str, Any]] = []
    for row in inputs:
        entry: dict[str, Any] = {
            "stem_id": row.stem_id,
            "bus": row.bus,
            "fade_in_ms": row.fade_in_ms,
            "fade_in_start_ms": row.fade_in_start_ms,
            "fade_out_ms": row.fade_out_ms,
            "fade_out_start_ms": row.fade_out_start_ms,
        }
        if room is not None:
            entry["send_db"] = row.send_db
        rows.append(entry)
    params: dict[str, Any] = {
        "inputs": rows,
        "rate": WORKING_RATE,
        "channels": WORKING_CHANNELS,
        "codec": WORKING_CODEC,
    }
    hashes = list(stem_hashes)
    if room is not None:
        params["room"] = {
            "id": room.room_id,
            "version": room.version,
            "wet": room.wet,
            "ir": room.ir_asset,
        }
        hashes.append(room.ir_asset)
    return _node("mix", params, hashes)


def evaluate_mix(
    sources: Sequence[Path],
    inputs: Sequence[MixInput],
    target: Path,
    *,
    room: RoomMix | None = None,
    ir_path: Path | None = None,
) -> None:
    """Sum the stems, and convolve the send bus against the room if the scene named one.

    The IR is appended **after** every stem, because `mix_filtergraph` addresses it as input
    `len(inputs)`. Order is the only contract between the two halves.
    """

    target.parent.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-v", "error"]
    for path in sources:
        command.extend(["-i", str(path)])
    if room is not None:
        if ir_path is None:  # pragma: no cover - the caller resolves the asset it named
            raise ValueError("a room mix needs the impulse response it names")
        command.extend(["-i", str(ir_path)])
    command.extend(
        [
            "-filter_complex", mix_filtergraph(inputs, room),
            "-map", "[out]",
            "-ar", str(WORKING_RATE), "-ac", str(WORKING_CHANNELS),
            "-c:a", WORKING_CODEC, "-y", str(target),
        ]
    )
    subprocess.run(command, check=True)


# -- LoudnormNode -------------------------------------------------------------


def loudnorm_node(source_hash: str) -> Node:
    return _node(
        "loudnorm",
        {
            "filter": LOUDNORM,
            "rate": WORKING_RATE,
            "channels": WORKING_CHANNELS,
            "codec": WORKING_CODEC,
        },
        [source_hash],
    )


def evaluate_loudnorm(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(source), "-af", LOUDNORM,
            "-ar", str(WORKING_RATE), "-ac", str(WORKING_CHANNELS),
            "-c:a", WORKING_CODEC, "-y", str(target),
        ],
        check=True,
    )


# -- EncodeNode ---------------------------------------------------------------

ENCODINGS: dict[str, dict[str, Any]] = {
    "qa": {"rate": QA_RATE, "channels": QA_CHANNELS, "codec": QA_CODEC, "suffix": ".wav"},
    "publish": {
        "rate": PUBLISH_RATE,
        "channels": 2,
        "codec": "libmp3lame",
        "bitrate": PUBLISH_BITRATE,
        "suffix": ".mp3",
    },
}


def encode_node(encoding: str, source_hash: str) -> Node:
    return _node("encode", {"encoding": encoding, **ENCODINGS[encoding]}, [source_hash])


def evaluate_encode(source: Path, target: Path, encoding: str) -> None:
    settings = ENCODINGS[encoding]
    bitrate = settings.get("bitrate")
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(source),
            "-ar", str(settings["rate"]), "-ac", str(settings["channels"]),
            *(["-codec:a", str(settings["codec"])] if bitrate else ["-c:a", str(settings["codec"])]),
            *(["-b:a", str(bitrate)] if bitrate else []),
            "-y", str(target),
        ],
        check=True,
    )


def ffmpeg_version() -> str:
    """The exact ffmpeg the manifest was rendered by, captured at render time.

    Not a pinned dependency and not checked: ffmpeg is the one part of this pipeline that is not
    installed by the lockfile, so the honest thing a manifest can do is state which one ran.
    """

    try:
        result = subprocess.run(
            ["ffmpeg", "-version"], check=True, capture_output=True, text=True
        )
    except (OSError, subprocess.CalledProcessError):  # pragma: no cover - ffmpeg is a test dep
        return "unknown"
    return result.stdout.splitlines()[0].strip()


def derived_provenance(node: Node, extra: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """The sidecar for bytes this pipeline computed rather than a model generated."""

    record: dict[str, Any] = {
        "kind": node.type,
        "node_hash": node.node_hash(),
        "impl_version": node.impl_version,
        "params": node.params,
        "inputs": list(node.inputs),
    }
    if extra:
        record.update(extra)
    return record
