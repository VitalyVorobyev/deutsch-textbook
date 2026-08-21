# Qwen3-TTS reliability on this machine

Status: **measured** (2026-08-21). Supersedes the "Qwen is recorded as unreliable on this machine"
line in `tools/listening-studio/README.md` (2026-08-01).

Machine: MacBook Pro M4 Pro, 12 CPU cores, 24 GB unified memory, macOS 26.5, otherwise idle, on
mains power. Runtime as pinned by `requirements-qwen-runtime.txt`: Python 3.12, torch 2.13.0,
torchaudio 2.11.0, transformers 4.57.3, numpy 2.2.6, `qwen-tts` 0.1.1 at the pinned upstream commit
`022e286b`. Models: `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` at `85e237c12c027…` and
`Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` at `0c0e3051f131…`. Speaker `Vivian`, language `German`,
model output 24 kHz.

Every figure below comes from `tools/listening-studio/scripts/tts_reliability_probe.py`, run from
`tools/listening-studio`. A generation **fails** on an exception, on a NaN/inf sample, or on peak
amplitude below `1e-4`; nothing here is a judgement by ear.

## Conclusion

**Qwen3-TTS generates German reliably on this machine, and the 2026-08-01 verdict was a dtype bug,
not a machine limit.** The engine is fit for both the corpus regeneration and the 85-text
narration.

The recommendation is **MPS with an explicitly stated `dtype=torch.float32`**: 74 generations with
no failure, warm real-time factor ≈ 1.0, peak RSS 3.3 GB. `adapters.py` now states device and dtype
rather than inheriting them.

Three findings decided that, and each one is a thing the old note could not have known:

1. **`from_pretrained` with no arguments loads on CPU, not MPS.** Measured: `--device inherit
   --dtype inherit` reports `cpu` / `torch.float32`. The upstream wrapper forwards whatever the
   loader picked, so the device this engine ran on was never a decision — it was an artifact of the
   installed transformers version, and it can change under the project without a line of the
   project changing.
2. **float16 on MPS fails 100% of the time, with the exact error the old note recorded.** Not
   occasionally — 5 of 5 attempted generations, the first one 0.24–0.45 s in. Since the placement
   was never stated, an earlier transformers selecting fp16 on MPS is enough to explain the whole
   2026-08-01 result.
3. **The failure is deterministic, so it was never a reliability problem to live with.** float32
   and bfloat16 on the same device, same driver, same seeds, do not produce a single NaN in 119
   generations. A dtype that fails every time is a line of code, not a machine to give up on.

## Per-config results

The four German smoke lines, one at a time, seed fixed per take:

> Entschuldigung, können wir bitte bestellen?
> Der Zug nach München fährt um halb neun von Gleis drei.
> Ich hätte gern zweihundert Gramm Käse und fünf Brötchen.
> Könnten Sie das bitte langsamer wiederholen? Ich habe Sie nicht verstanden.

| # | Config | Device | dtype | Load | Gen per line (s) | RTF | Peak RSS | Result |
| --- | --- | --- | --- | ---: | --- | ---: | ---: | --- |
| A | upstream defaults | **cpu** | float32 | 1.46 s | 4.39 · 4.85 · 5.03 · 6.17 | 1.21 med | 6.29 GB | **pass** 4/4 |
| B | `device_map="mps"` | mps:0 | float32 | 2.27 s | 3.24 · 4.11 · 4.44 · 4.94 | 0.99 med | 3.32 GB | **pass** 8/8 |
| C1 | mps + bfloat16 | mps:0 | bfloat16 | 2.00 s | 4.88 · 3.67 · 3.36 · 4.49 | 0.87 med | 1.19 GB | **pass** 4/4 |
| C2 | mps + float16 | mps:0 | float16 | 3.07 s | fails at 0.03–0.45 s | — | 2.72 GB | **fail 4/4** |
| D | cpu + float32 | cpu | float32 | 0.85 s | 3.48 · 4.57 · 5.51 · 6.93 | 1.24 med | 6.23 GB | **pass** 4/4 |
| F | 1.7B, mps + float32 | mps:0 | float32 | 4.22 s | 3.76 · 3.96 · 7.54 · 5.20 | 1.17 med | 5.25 GB | **pass** 4/4 |

C2's exact failure, on every line:

```
torch.AcceleratorError: probability tensor contains either `inf`, `nan` or element < 0
  transformers/generation/utils.py:2779 in _sample
```

That is the signature `README.md` recorded on 2026-08-01 as `torch.AcceleratorError` (inf/nan
probabilities). It is the talker's sampling distribution overflowing fp16's range, and it is why the
adapter now pins the dtype instead of accepting one.

**One detail does not line up, and it is inference from here on.** The old note says the line failed
after **53.16 s**; float16 here dies in 0.03–0.45 s. The warm-up measurement below makes a
reconciliation available — a first generation spends a large fixed cost before it ever samples, so a
run that compiled for ~50 s and then hit the overflow would read as one 53 s failure. That is a
plausible story, not a measurement: the 2026-08-01 environment no longer exists here and was not
reconstructed. What is measured is narrower and enough to act on — float16 on MPS produces that
exact error every time, float32 and bfloat16 never do, and the old run never stated which it got.

```sh
uv run python scripts/tts_reliability_probe.py --device inherit --dtype inherit --repeats 1   # A
uv run python scripts/tts_reliability_probe.py --device mps --dtype float32   --repeats 2     # B
uv run python scripts/tts_reliability_probe.py --device mps --dtype bfloat16  --repeats 1     # C1
uv run python scripts/tts_reliability_probe.py --device mps --dtype float16   --repeats 1     # C2
uv run python scripts/tts_reliability_probe.py --device cpu --dtype float32   --repeats 1     # D
uv run python scripts/tts_reliability_probe.py --device mps --dtype float32 --repeats 1 \
  --model Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice --revision 0c0e3051f131929182e2c023b9537f8b1c68adfe
```

## Stability, which is a different question from "it worked"

A clean four-line pass is what the machine produced on 2026-08-01 too, right up until it did not.
The pass criterion above was therefore applied to repeated sweeps:

| Sweep | Generations | Failed | RTF min / median / max |
| --- | ---: | ---: | --- |
| mps float32, 4 lines × 10 seeds | 40 | **0** | 0.985 / **1.003** / 1.059 |
| mps float32, narration (see below) | 21 | **0** | 0.981 / 1.021 / 5.517 |
| cpu float32, narration | 4 | **0** | 1.185 / **1.221** / 1.264 |
| mps bfloat16, 4 lines × 5 seeds | 20 | **0** | 0.839 / **0.852** / 0.937 |
| mps bfloat16, narration | 9 | 1 aborted | 0.849 / 0.878 / 3.783 |
| mps float16, 4 lines | 5 | **5** | — |

Across the whole spike: **86 float32 generations with zero failures** (74 on MPS, 12 on CPU), 33
bfloat16 generations with one abort, 5 float16 generations with five failures, and 4 on the 1.7B
model with none. 128 generations in total.

The narration median of 1.021 is pulled up by six warm-up first-generations inside those 21 takes;
the warm figure is the ~0.98–1.04 those sweeps otherwise sit at. The next section separates them.

The single bfloat16 abort was the **first** long generation of its process, stopped by the probe's
own 300 s alarm. It is the warm-up cost below, not a bfloat16 defect: re-run after a warm-up, the
same text and seed completed in 83.9 s.

## The first long generation costs about 150 s, once

Both dtypes showed a large one-off cost on the first generation of a new sequence length, which is
easy to misread as a bad seed. Four consecutive generations of the same 131-word text in one
process, MPS:

| Order | float32 | bfloat16 |
| --- | ---: | ---: |
| 1st (seed 9) | 182.9 s · RTF 2.94 | 222.1 s · RTF 3.78 |
| 2nd (seed 1) | 56.6 s · RTF 1.02 | 83.9 s · RTF 1.37 |
| 3rd (seed 1 again) | 56.0 s · RTF 1.01 | 53.6 s · RTF 0.88 |
| 4th (seed 4) | 58.2 s · RTF 1.01 | 53.0 s · RTF 0.88 |

Seed 1 costs 3.08 RTF when it runs first and 1.02 when it runs second, so the cost belongs to the
position, not the seed. The short-line sweeps show no such spike (first take 3.14 s, RTF 1.06),
so it is bound to sequence length, not to process start. **Batch the whole corpus in one process
and it is paid once.**

## What the pipeline actually asks the engine to do

`reading_audio` caches and synthesizes **one paragraph at a time**, so the generation unit is a
paragraph, not a text. Measured over the corpus (`load_reading_sources`, `spoken_paragraph`):

| Corpus | Units | Words | Unit size (median / p90 / max) |
| --- | ---: | ---: | --- |
| Narration — 85 readings | 380 paragraphs | 13,624 | 35 / 53 / **90** words |
| Listening — 40 dialogues | 326 lines | 3,434 | — (28.7 min declared) |

The largest real unit is a 90-word paragraph. `--mode paragraph` finds and runs it
(`a2/lena-3-die-bewerbung#5`); warm, it takes 30–35 s for ~33 s of audio. The 131-word whole-text
runs above are **larger than anything the pipeline asks for** and were run as a stress case, not as
a workload. Nothing in the corpus approaches a length where generation degraded.

```sh
uv run python scripts/tts_reliability_probe.py --mode paragraph --repeats 3 --qa --out /tmp/qa
uv run python scripts/tts_reliability_probe.py --mode reading --reading b1/arbeit-bewerbung --repeats 3
```

## Whisper QA

Bonus, not required, and possible only because `mlx-community/whisper-large-v3-turbo` at
`a4aaeec0636…` was already in the Hub cache. `mlx-whisper` 0.4.3 (a declared `mlx` extra) was
installed additively; no ML pin moved. Language `de`, `condition_on_previous_text=False`, WER
against the script after the digit normalisation stated in the probe script.

**31 clips transcribed, 30 of them at 0.00% WER** — 0.6B on MPS and on CPU, 0.6B bfloat16, the 1.7B
model, the 90-word paragraph on three seeds, and two 130-word narrations end to end. Every raw
non-zero WER before normalisation (max 22.22%) was Whisper writing a spoken numeral as a digit:
*drei* → "3", *zweihundert* → "200", *fünf* → "5".

The one exception is a real deviation and not a transcription artefact: on the second seed of the
90-word paragraph the model inserted *Uhr* after *vier*, giving 1.11% WER — one spurious word in
270 narration words across three seeds. It is exactly what the human approval step exists to catch,
and it is a reminder that a clean WER sweep licenses generation, not publication.

**WER is not a naturalness judgement.** It says the audio contains the right words. No clip in this
spike was assessed by ear, and none of it is approved curriculum audio.

**Do not run QA in the generating process.** MLX Whisper loaded beside an MPS-resident Qwen got the
probe SIGKILLed (exit 137) partway through the second take, twice; the identical run without `--qa`
completed. The probe now releases the model and empties the MPS cache before transcribing.

## What this means for the roadmap

Projected from the measured per-unit rates, not from a measured full run. Warm MPS float32 speaks
2.2 words/s on short lines and 2.7 words/s on 90-word paragraphs, at RTF ≈ 1.0:

| Job | Units | Words | Projected audio | Projected generation (mps fp32) | (cpu fp32) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Listening corpus regeneration | 326 lines | 3,434 | ~26 min | ~26 min | ~32 min |
| Narration, 85 texts | 380 paragraphs | 13,624 | ~84 min | ~84 min | ~103 min |
| Both | 706 | 17,058 | ~110 min | **~1 h 50 min** | ~2 h 15 min |

The ~26 min projected for the listening corpus sits against 28.7 min of duration declared in the
YAML, which is the only independent check available on the rate.

So a full regeneration is a **single unattended run of under two hours in one process**, plus one
~150 s warm-up, at 3.3 GB resident. Neither job needs an overnight, a cloud GPU, or a fallback
engine. CPU is a genuine fallback rather than a theoretical one — 22% slower, no failures — but it
costs 6.2 GB against 3.3 GB, so it is the slower *and* heavier option here.

**bfloat16 was rejected despite being faster.** It is ~15% quicker (RTF 0.85) and needs 1.19 GB, and
its QA was clean. It is not the default because the throughput gain buys about 16 minutes on a
110-minute job, and reduced precision in a sampling loop is exactly what the float16 result warns
about. The evidence behind it is also thinner: 33 generations against 86. Revisit it if generation
time ever becomes the constraint; the probe already supports it.

**1.7B is feasible, not chosen.** It loads in 4.22 s, runs at RTF ≈ 1.17, needs 5.25 GB, and its
four lines transcribed at 0.00% WER — so the machine can host it if a quality comparison ever wants
it. It got four generations and no stability sweep, and no one has compared the two by ear. Its
weights are 4.2 GB in `.models/`.

## `line.style` is silently discarded, and the 1.7B model is why it would not be

`QwenTTS.synthesize` passes `instruct=line.style`. Upstream drops it:

```python
if self.model.tts_model_size in "0b6":  # for 0b6 model, instruct is not supported
    instruct = None
```

The 0.6B checkpoint's `tts_model_size` is exactly `"0b6"`, so **every style instruction the Studio
sends today is discarded without a warning** — the field is authored, stored, hashed into the cache
key, and has no effect on the audio. The 1.7B checkpoint reports `"1b7"` and would honour it.

This is a finding, not a fix; it belongs with the adapter restructure rather than with a dtype
change. Note also that the upstream test is a substring check on a string, so it is the identifier
`"0b6"` matching itself rather than a size comparison — a checkpoint named `"0b"` or `"b6"` would
also be silently stripped.

## Not measured

Stated so nothing here is read as covering it:

- **Only torch 2.13.0.** No other torch or transformers version was tried; the matrix's upgrade
  branch was never reached, because MPS float32 passed.
- **`PYTORCH_ENABLE_MPS_FALLBACK=1` was never needed** and so was never run.
- **1.7B**: four lines on one config. No sweep, no long text, no memory ceiling probe.
- **One voice.** Every take used `Vivian`. Other speakers, `pace`, and `pronunciation_overrides`
  are untouched.
- **No sustained-throughput or thermal figure.** The longest continuous run was ~450 s. A
  two-hour job may not hold RTF 1.0, and nothing here shows that it does.
- **The ffmpeg resample/pace step in `write_with_pace` was not timed separately**; the roadmap
  projections cover generation only.
- **Peak RSS is `ru_maxrss` for the probe process** and varies run to run (config A read 4.72 GB in
  one run and 6.29 GB in another). Read it as a magnitude, not a specification. Swap was not
  measured.
- **No audio was judged by ear**, and no take here is approved curriculum audio.

## Reproducing the environment

```sh
cd tools/listening-studio
uv sync --extra test && ./install-qwen.sh     # ends Parler generation; install-parler.sh restores it
uv pip install mlx-whisper==0.4.3             # only for --qa
```

`install-qwen.sh` verifies the pinned checkpoint revision on its last line. `uv run pytest` reports
one pre-existing failure unrelated to this spike:
`test_inventory_is_the_real_fifty_nine_text_corpus` asserts 59 reading sources and the corpus now
holds 85 — the same 85 this document projects narration for. `uv run mypy` reports one pre-existing
`unused-ignore` on the `mlx_lm` import. Both were confirmed present before the adapter change and
are unchanged by it.
