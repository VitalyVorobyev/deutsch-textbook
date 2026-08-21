"""Measure whether Qwen3-TTS generates German reliably on this machine.

Every figure in `docs/quality/tts-reliability.md` comes from this script. It exists because the
engine's failure mode is neither a crash nor a bad file: the talker's sampling logits overflow,
`generate()` raises `torch.AcceleratorError`, and the run before it looked perfect. One clean
four-line pass is not evidence of reliability, so the default is a repeated sweep and the pass
criterion is explicit — an exception, a NaN/inf sample, or silence.

The generation unit that matters is the **paragraph**: `reading_audio` caches and synthesizes one
paragraph at a time, so `--mode paragraph` runs the longest real one in the corpus rather than an
invented sentence. `--mode reading` concatenates a whole reading into a single generation, which is
larger than anything the pipeline actually asks for and is a stress case, not a workload.

Examples:

    # the four German smoke lines, ten seeds each, on the recommended config
    uv run python scripts/tts_reliability_probe.py --device mps --dtype float32 --repeats 10

    # the corpus's longest narration paragraph, with Whisper QA
    uv run python scripts/tts_reliability_probe.py --mode paragraph --repeats 3 --qa

    # reproduce the float16 failure
    uv run python scripts/tts_reliability_probe.py --device mps --dtype float16 --repeats 1
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import resource
import signal
import statistics
import sys
import time
import traceback
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

LINES = [
    "Entschuldigung, können wir bitte bestellen?",
    "Der Zug nach München fährt um halb neun von Gleis drei.",
    "Ich hätte gern zweihundert Gramm Käse und fünf Brötchen.",
    "Könnten Sie das bitte langsamer wiederholen? Ich habe Sie nicht verstanden.",
]

# Whisper writes spoken numerals as digits, which the Studio's QA normalises before scoring. Every
# non-zero WER measured in this spike was one of these and nothing else, so the mapping is stated
# here rather than hidden in a regex: a QA number that needs an undocumented normalisation to look
# good is not a QA number.
SPOKEN_DIGITS = {
    "0": "null", "1": "eins", "2": "zwei", "3": "drei", "4": "vier", "5": "fünf",
    "6": "sechs", "7": "sieben", "8": "acht", "9": "neun", "10": "zehn",
    "20": "zwanzig", "100": "hundert", "200": "zweihundert",
}


class GenerationTimeout(Exception):
    pass


def normalise(text: str) -> list[str]:
    text = text.lower().replace("ß", "ss")
    return [SPOKEN_DIGITS.get(w, w) for w in re.sub(r"[^\wäöü\s]", " ", text).split()]


def word_error_rate(ref: list[str], hyp: list[str]) -> float:
    matcher = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False)
    errors = sum(
        max(i2 - i1, j2 - j1)
        for op, i1, i2, j1, j2 in matcher.get_opcodes()
        if op != "equal"
    )
    return errors / max(1, len(ref))


def peak_rss_gb() -> float:
    """Peak resident memory of this process. macOS reports `ru_maxrss` in bytes."""

    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024**3)


def corpus_texts(mode: str, reading_id: str | None) -> list[tuple[str, str]]:
    from listening_studio.reading_audio import load_reading_sources, spoken_paragraph

    sources = load_reading_sources(REPO_ROOT)
    if mode == "paragraph":
        paragraphs = [
            (f"{s.id}#{i}", spoken_paragraph(p))
            for s in sources
            for i, p in enumerate(s.paragraphs)
        ]
        longest = max(paragraphs, key=lambda pair: len(pair[1].split()))
        return [longest]
    match = [s for s in sources if s.id == reading_id]
    if not match:
        raise SystemExit(f"no reading {reading_id!r}; ids look like 'b1/arbeit-bewerbung'")
    return [(match[0].id, " ".join(spoken_paragraph(p) for p in match[0].paragraphs))]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--mode", default="lines", choices=["lines", "paragraph", "reading"])
    ap.add_argument("--reading", help="reading id for --mode reading, e.g. b1/arbeit-bewerbung")
    ap.add_argument("--device", default="mps", choices=["mps", "cpu", "inherit"],
                    help="'inherit' passes no device_map and records what the loader picked")
    ap.add_argument("--dtype", default="float32",
                    choices=["float32", "bfloat16", "float16", "inherit"])
    ap.add_argument("--model", default="Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")
    ap.add_argument("--revision", default="85e237c12c027371202489a0ec509ded67b5e4b5")
    ap.add_argument("--speaker", default="Vivian")
    ap.add_argument("--repeats", type=int, default=10, help="seeds per text")
    ap.add_argument("--timeout", type=int, default=300, help="seconds per generation")
    ap.add_argument("--qa", action="store_true", help="transcribe each take and score WER")
    ap.add_argument("--out", type=Path, help="directory for the WAVs (default: no WAVs kept)")
    args = ap.parse_args()

    import numpy as np
    import soundfile as sf
    import torch
    import transformers

    from listening_studio.adapters import locked_snapshot
    from qwen_tts import Qwen3TTSModel

    texts = (
        [(f"line{i + 1}", t) for i, t in enumerate(LINES)]
        if args.mode == "lines"
        else corpus_texts(args.mode, args.reading)
    )

    load_kwargs: dict = {}
    if args.device != "inherit":
        load_kwargs["device_map"] = args.device
    if args.dtype != "inherit":
        load_kwargs["dtype"] = getattr(torch, args.dtype)

    started = time.perf_counter()
    model = Qwen3TTSModel.from_pretrained(
        locked_snapshot(args.model, args.revision), **load_kwargs
    )
    load_seconds = round(time.perf_counter() - started, 3)
    parameter = next(model.model.parameters())
    # Read off the loaded model, never echoed back from the request: `--device inherit` exists
    # precisely to find out what the loader picks when nobody tells it.
    actual_device, actual_dtype = str(parameter.device), str(parameter.dtype)

    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)

    def on_alarm(signum: int, frame: object) -> None:
        raise GenerationTimeout(f"aborted at {args.timeout} s")

    signal.signal(signal.SIGALRM, on_alarm)

    results: list[dict] = []
    for seed in range(1, args.repeats + 1):
        for name, text in texts:
            entry: dict = {"take": f"{name}-s{seed}", "seed": seed, "words": len(text.split())}
            torch.manual_seed(seed)
            began = time.perf_counter()
            signal.alarm(args.timeout)
            try:
                wavs, rate = model.generate_custom_voice(
                    text=text, language="German", speaker=args.speaker
                )
                signal.alarm(0)
                entry["gen_seconds"] = round(time.perf_counter() - began, 3)
                wav = np.asarray(wavs[0], dtype=np.float64)
                entry["audio_seconds"] = round(len(wav) / float(rate), 3)
                entry["rtf"] = round(entry["gen_seconds"] / entry["audio_seconds"], 3)
                entry["nan_or_inf"] = bool(np.isnan(wav).any() or np.isinf(wav).any())
                finite = wav[np.isfinite(wav)]
                entry["max_abs"] = round(float(np.abs(finite).max()) if finite.size else 0.0, 5)
                entry["pass"] = not entry["nan_or_inf"] and entry["max_abs"] >= 1e-4
                if entry["pass"] and (args.out or args.qa):
                    directory = args.out or Path(".")
                    path = directory / f"{entry['take'].replace('/', '_')}.wav"
                    sf.write(str(path), np.asarray(wavs[0]), int(rate))
                    entry["wav"] = str(path)
            except BaseException as exc:  # noqa: BLE001 — AcceleratorError is not an Exception
                signal.alarm(0)
                entry["gen_seconds"] = round(time.perf_counter() - began, 3)
                entry["error"] = f"{type(exc).__module__}.{type(exc).__name__}: {exc}"[:600]
                entry["traceback"] = traceback.format_exc()[-600:]
                entry["pass"] = False
            entry["reference"] = text
            results.append(entry)
            print(
                f"  {entry['take']}: pass={entry['pass']} gen={entry['gen_seconds']}s "
                f"audio={entry.get('audio_seconds')}s rtf={entry.get('rtf')}"
                + (f" wer={entry['wer']:.2%}" if "wer" in entry else "")
                + (f" {entry['error']}" if "error" in entry else ""),
                file=sys.stderr,
                flush=True,
            )

    # QA runs only once the generator has been released. MLX Whisper and an MPS-resident Qwen in
    # one process got this script SIGKILLed (exit 137) partway through the second take on a 24 GB
    # machine, twice; the same run without `--qa` completed. Transcribing afterwards is not tidier
    # code, it is the difference between a QA pass and a dead process.
    if args.qa:
        del model, parameter
        if hasattr(torch, "mps"):
            torch.mps.empty_cache()
        from listening_studio.adapters import transcribe

        for entry in results:
            if not entry.get("wav"):
                continue
            heard = transcribe(Path(entry["wav"]))
            entry["wer"] = round(
                word_error_rate(normalise(entry["reference"]), normalise(heard)), 4
            )
            entry["heard"] = heard
            print(f"  {entry['take']}: wer={entry['wer']:.2%}", file=sys.stderr, flush=True)

    passed = [r for r in results if r["pass"]]
    rtfs = [r["rtf"] for r in passed]
    wers = [r["wer"] for r in results if "wer" in r]
    summary = {
        "model": args.model,
        "revision": args.revision,
        "mode": args.mode,
        "torch": torch.__version__,
        "transformers": transformers.__version__,
        "requested_device": args.device,
        "requested_dtype": args.dtype,
        "actual_device": actual_device,
        "actual_dtype": actual_dtype,
        "load_seconds": load_seconds,
        "generations": len(results),
        "passed": len(passed),
        "failed": len(results) - len(passed),
        # The first generation of a new sequence length pays a large one-off MPS compile, so the
        # median is the throughput figure and the max is that compile. Read both.
        "rtf_min": round(min(rtfs), 3) if rtfs else None,
        "rtf_median": round(statistics.median(rtfs), 3) if rtfs else None,
        "rtf_max": round(max(rtfs), 3) if rtfs else None,
        "audio_seconds": round(sum(r["audio_seconds"] for r in passed), 2),
        "peak_rss_gb": round(peak_rss_gb(), 3),
        "wer_max": round(max(wers), 4) if wers else None,
        "failures": [r for r in results if not r["pass"]],
    }
    print("SUMMARY " + json.dumps(summary, ensure_ascii=False))
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
