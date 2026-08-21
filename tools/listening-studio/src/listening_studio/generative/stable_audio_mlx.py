"""Stable Audio 3 Small-SFX, behind the gateway, through Stability's own MLX implementation.

**Which weights.** Not `stabilityai/stable-audio-3-small-sfx`: that repository is gated and holds
the PyTorch checkpoint the reference library loads. The MLX path reads pre-converted `.npz`
bundles from `stabilityai/stable-audio-3-optimized`, which is **not** gated — so installing this
engine needs no licence-acceptance click, and the honest reason is that Stability publishes the
same model twice. It is the same Community License either way; `LICENSE.md` ships in both
repositories and is downloaded beside the weights.

**Why a subprocess and not an import.** Upstream ships no library API: `optimized/mlx` is a
project directory whose entry point is `scripts/sa3_mlx.py`, a CLI orchestrator with the whole
generation flow inside `main()`. It inserts its own two directories into `sys.path` on import, so
any interpreter that has `mlx` can run it from any working directory. Calling it as a process
buys two things beyond not forking 900 lines: this package never imports `mlx` at all — no lazy
import to get wrong, and the CI environment stays free of an ML runtime by construction — and the
banner it prints cannot corrupt `scene render --json`, because the default runner captures the
child's real fd 1 and re-emits it on stderr. `redirect_stdout` would not have: it rebinds
`sys.stdout` inside this process and a child writes to the file descriptor. That is P28-1's
failure, seen coming rather than shipped.

**Reproducibility.** Measured on this machine (M4 Pro, MLX 0.32.1, `--dit-dtype fp16`): three runs
of one prompt at seed 4242 produced three **byte-identical** WAVs. Sampling is keyed
(`mx.random.key(seed)`), not drawn from global state, so the seed in the provenance record is a
seed a re-run can be held to. Nothing here depends on that: the asset store names a file by the
hash of its bytes, so a nondeterministic engine would cost cache misses and not correctness.

**Negative prompts are inert at `cfg = 1.0`,** and this engine refuses that combination rather
than dropping it. The upstream sampler runs no unconditional branch when the guidance scale is
exactly 1.0, so the negative prompt reaches nothing — measured, not read: the same prompt at
seed 7 with and without `negative_prompt="speech, voices, music"` produced identical bytes at
`cfg 1.0` and different bytes at `cfg 3.0`. This is `supports_style`'s hazard with one
difference: a discarded style instruction is an editorial note a bigger checkpoint would honour,
while a discarded negative prompt is a scene the author can fix in one field.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from .gateway import AudioAsset, SoundRequest
from .locks import local_checkout, models_root

#: The weights repository and the exact commit this engine is pinned to.
MODEL_ID = "stabilityai/stable-audio-3-optimized"
REVISION = "2204d5086475bd5b7e6e2bd720772dd8e8160513"
#: The adapter code: the upstream repository at the commit `install-stable-audio.sh` unpacks.
ADAPTER_CODE_REVISION = "Stability-AI/stable-audio-3@a0b57f5483c4588f827f3552b7d5c6ca2a9687be"
#: Named on every asset this engine produces, because a licence that lives only in
#: `models.lock.json` is a licence the published render manifest cannot state.
LICENSE = "Stability AI Community License"

#: Where `install-stable-audio.sh` unpacks `optimized/mlx/`, under `<repo>/.models/`.
ADAPTER_DIRNAME = "stable-audio-3-mlx"
#: Written by the installer, holding the code revision it unpacked. The directory is never
#: accepted on its name alone — the same rule `locks.local_checkout` applies to weights.
REVISION_STAMP = "revision.txt"
#: The four `.npz` bundles the sm-sfx path loads, as the upstream project expects to find them.
#: Symlinks into the pinned weights checkout, so one copy sits on disk.
WEIGHT_FILES = (
    "dit_sm-sfx_f16.npz",
    "same_s_decoder_f32.npz",
    "same_s_encoder_f32.npz",
    "t5gemma_f16.npz",
)

INSTALL_HINT = "run tools/listening-studio/install-stable-audio.sh"

#: What this engine writes, which is **not** what the model emits. The model produces 16-bit
#: stereo at 44.1 kHz; the graph's sound path has no conform node between generation and
#: placement, and `graph.nodes.track_filters` documents itself as turning *one mono take* into a
#: positioned stereo stem — its `pan` filter reads channel 0 and would silently discard the right
#: channel. So the take is conformed here, into exactly the format `ImportNode` hands the track
#: node for an imported Freesound original. `graph.nodes` owns these three values; they are
#: restated rather than imported because `generative/` must not depend on `graph/`, and
#: `tests/test_stable_audio.py` fails if the two ever disagree.
OUTPUT_RATE = 48_000
OUTPUT_CHANNELS = 1
OUTPUT_CODEC = "pcm_s24le"

#: Longer than the checkpoint's native `sample_size` (5 292 032 samples = 120.0 s at 44.1 kHz,
#: from `model_config.json`) is extrapolation nobody here has listened to. Course sounds run to
#: tens of seconds, so the ceiling costs nothing and stops a typo asking for an hour of audio.
MAX_DURATION_SECONDS = 120.0

#: Everything MLX- and model-specific, with the upstream defaults. Anything outside this set is
#: refused rather than passed through: `sa3_mlx.py` would reject an unknown flag with a usage
#: dump and a non-zero exit, and an accepted-but-ignored parameter is what the gateway's one
#: opaque `params` dict exists to prevent.
#:
#: * ``steps`` — pingpong sampler steps. 8 is what the distilled denoiser was trained for.
#: * ``cfg`` — classifier-free guidance. 1.0 disables the unconditional branch entirely.
#: * ``apg`` — adaptive projected guidance; only read when ``cfg`` is not 1.0.
#: * ``init_noise_level`` — σmax, the schedule's starting noise level.
#: * ``dit_dtype`` — ``fp16`` (upstream default, ~50–57 dB PSNR against fp32) or ``fp32``.
DEFAULT_PARAMS: Mapping[str, Any] = {
    "steps": 8,
    "cfg": 1.0,
    "apg": 1.0,
    "init_noise_level": 1.0,
    "dit_dtype": "fp16",
}

#: The argv the entry point is called with, minus the interpreter. Injectable so a test can
#: assert what a request turns into without an ML runtime, weights or a Mac.
Runner = Callable[[Sequence[str]], None]


def adapter_root(root: Path | None = None) -> Path:
    return (root if root is not None else models_root()) / ".models" / ADAPTER_DIRNAME


def resolve_params(request: SoundRequest) -> dict[str, Any]:
    """The defaults with the request's overrides applied, or a refusal saying why not.

    Separate from `generate` so every refusal is reachable without an install: these are
    authoring errors, and an authoring error that only surfaces on the one machine with the
    weights on it is an authoring error nobody sees.
    """

    unknown = sorted(set(request.params) - set(DEFAULT_PARAMS))
    if unknown:
        raise ValueError(
            f"{StableAudioSfx.name} does not accept {unknown}; "
            f"engine parameters are {sorted(DEFAULT_PARAMS)}"
        )
    params: dict[str, Any] = {**DEFAULT_PARAMS, **request.params}
    if not 0.0 < request.duration_seconds <= MAX_DURATION_SECONDS:
        raise ValueError(
            f"{StableAudioSfx.name} generates 0 < duration_seconds <= {MAX_DURATION_SECONDS:g}; "
            f"asked for {request.duration_seconds:g}"
        )
    if int(params["steps"]) < 1:
        raise ValueError(f"steps must be at least 1; asked for {params['steps']}")
    if params["dit_dtype"] not in ("fp16", "fp32"):
        raise ValueError(f"dit_dtype is fp16 or fp32; asked for {params['dit_dtype']!r}")
    if request.negative_prompt and float(params["cfg"]) == 1.0:
        raise ValueError(
            "a negative prompt reaches nothing at cfg 1.0 — the sampler runs no unconditional "
            "branch there, and the audio is byte-identical with and without it. Set "
            "params.cfg above 1.0 (3.0 is a usual starting point) or drop the negative prompt"
        )
    return params


def build_argv(script: Path, request: SoundRequest, params: Mapping[str, Any], out: Path) -> list[str]:
    """One request as the upstream CLI's arguments. `--dit`/`--decoder` are this engine's identity.

    Both are stated on every call and never taken from `params`: `sm-sfx` with the SAME-S codec is
    what `stable_audio_sfx` *is*, and an engine whose model could be swapped per request would
    publish one revision for two models.
    """

    argv = [
        str(script),
        "--dit",
        "sm-sfx",
        "--decoder",
        "same-s",
        "--prompt",
        request.prompt,
        "--seconds",
        f"{request.duration_seconds:g}",
        "--seed",
        str(request.seed),
        "--steps",
        str(int(params["steps"])),
        "--cfg",
        f"{float(params['cfg']):g}",
        "--apg",
        f"{float(params['apg']):g}",
        "--init-noise-level",
        f"{float(params['init_noise_level']):g}",
        "--dit-dtype",
        str(params["dit_dtype"]),
        "--out",
        str(out),
    ]
    if request.negative_prompt:
        argv += ["--negative-prompt", request.negative_prompt]
    return argv


def _run(argv: Sequence[str]) -> None:
    """Run the pinned entry point on this interpreter, offline, with its stdout quarantined.

    `HF_HUB_OFFLINE=1` is the enforcement, not the documentation, of "the model is never
    downloaded implicitly": upstream's `weights.ensure_local` falls back to `hf_hub_download`
    against the repository's *main* branch for any file it cannot find, which would quietly
    replace a pinned revision with today's. The preconditions below have already proved every
    file is present at the pinned commit, so offline can only turn a mistake into an error.
    """

    environment = dict(os.environ) | {"HF_HUB_OFFLINE": "1"}
    result = subprocess.run(
        [sys.executable, *argv],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    # Its own progress display is diagnostics, and diagnostics belong on stderr — see the module
    # docstring for why capturing is the only redirection that reaches a child process.
    sys.stderr.write(result.stdout)
    sys.stderr.write(result.stderr)
    if result.returncode != 0:
        tail = (result.stderr or result.stdout).strip().splitlines()[-5:]
        raise RuntimeError(
            f"sa3_mlx exited {result.returncode}: " + " / ".join(tail)
        )


class StableAudioSfx:
    """Stable Audio 3 Small-SFX. `revision` is the pinned weights commit, as the gateway asks."""

    name = "stable_audio_sfx"
    revision = REVISION
    model_id = MODEL_ID
    adapter_code_revision = ADAPTER_CODE_REVISION
    license = LICENSE

    def __init__(self, runner: Runner | None = None) -> None:
        self._runner = runner if runner is not None else _run

    def entry_point(self, root: Path | None = None) -> Path:
        """The installed `scripts/sa3_mlx.py`, after proving code and weights are the pinned ones.

        Both halves are checked, and separately: the adapter code and the weights are two
        downloads from two hosts, and an install that got one of them is the state a single
        "is it installed" check would report as ready.
        """

        directory = adapter_root(root)
        stamp = directory / REVISION_STAMP
        installed = stamp.read_text().strip() if stamp.exists() else ""
        if installed != ADAPTER_CODE_REVISION:
            raise RuntimeError(
                f"{ADAPTER_CODE_REVISION} is not installed at {directory} "
                f"(found {installed or 'nothing'}); {INSTALL_HINT}"
            )
        if local_checkout(MODEL_ID, REVISION, root) is None:
            raise RuntimeError(f"{MODEL_ID}@{REVISION} is not downloaded; {INSTALL_HINT}")
        missing = [name for name in WEIGHT_FILES if not (directory / "models" / "mlx" / name).exists()]
        if missing:
            raise RuntimeError(
                f"the pinned weights are downloaded but {missing} are not linked into "
                f"{directory / 'models' / 'mlx'}; {INSTALL_HINT}"
            )
        return directory / "scripts" / "sa3_mlx.py"

    def generate(self, request: SoundRequest, target: Path) -> AudioAsset:
        params = resolve_params(request)
        script = self.entry_point()
        target.parent.mkdir(parents=True, exist_ok=True)
        # The model writes into a temporary directory and `conform` writes the asset, so a failed
        # run leaves no half-generated WAV at a path the caller is about to hash.
        with tempfile.TemporaryDirectory(prefix="sa3-mlx-") as work:
            raw = Path(work) / "model.wav"
            self._runner(build_argv(script, request, params, raw))
            if not raw.exists():
                raise RuntimeError(f"sa3_mlx reported success but wrote no audio at {raw}")
            # Imported lazily: `adapters` imports this package, so a module-scope import would
            # close the cycle. `conform` is the one pace/format computation in the studio and
            # re-implementing an ffmpeg call beside it is how two behaviours start to diverge.
            from ..adapters import conform

            conform(
                raw,
                target,
                rate=OUTPUT_RATE,
                channels=OUTPUT_CHANNELS,
                codec=OUTPUT_CODEC,
            )
        return AudioAsset.record(
            target,
            OUTPUT_RATE,
            engine=self.name,
            model_id=self.model_id,
            model_revision=self.revision,
            adapter_code_revision=self.adapter_code_revision,
            license=self.license,
            seed=request.seed,
            request_sha256=request.sha256(),
            # The **resolved** parameters, not `request.params`: a manifest saying `{}` where the
            # model was given eight sampler steps at fp16 records the request rather than the run.
            params=params,
        )
