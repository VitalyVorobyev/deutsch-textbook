from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
import subprocess
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import yaml
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas

from .domain import (
    RevisionPayload,
    SingleChoice,
    line_cache_key,
)
from .sources import load_source


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()



# 64 kbps mono is a long-standing speech setting and the assembled master is 16 kHz mono
# anyway, so the encoder is not throwing away bandwidth anyone can hear. It is roughly a
# fifth of the WAV: 41 artifacts at ~700 KB become ~7 MB rather than ~29 MB, in git history
# and in every desktop installer.
MP3_BITRATE = "64k"


def encode_mp3(source: Path, target: Path) -> Path:
    """Encode the approved master as the file that actually ships.

    The WAV stays the editorial master — Whisper QA, the line cache and the human approval all
    run against it — and is never committed. What lands in `content/listening/` is this
    derivative, so the manifest has to carry both hashes: the master the editor approved, and
    the published file a learner downloads. Checking only one of them would leave the other
    unpinned.
    """

    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(source),
            "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, "-ac", "1",
            "-y", str(target),
        ],
        check=True,
    )
    return target


def listening_yaml(
    slug: str, payload: RevisionPayload, provenance: str
) -> dict[str, object]:
    return {
        "id": slug,
        "level": payload.brief.level,
        "title": payload.title.model_dump(exclude_none=True),
        "scenario": payload.brief.scenario,
        "duration_seconds": payload.brief.duration_seconds,
        "speakers": payload.speakers,
        "transcript": [
            {"speaker": line.speaker, "text": line.display_text} for line in payload.lines
        ],
        "provenance": provenance,
    }


def exercise_yaml(slug: str, payload: RevisionPayload) -> dict[str, object]:
    """One `audio-comprehension` item per question.

    `source.turns` is both the script the recording was made from and the browser-TTS fallback
    the web demo speaks; `scripts/validate.ts` holds it equal to the artifact's transcript, so
    the two builds ask the same question in different voices. The item names the recording by
    bare id — the WAV path is derived, never written down.
    """

    turns = [{"speaker": line.speaker, "text": line.display_text} for line in payload.lines]
    items = []
    for question in payload.questions:
        # A legacy shape is readable but not shippable — `audio-comprehension` is single-choice,
        # and there is deliberately no second audio item type. `normalize-questions` rewrites
        # these into single-choice drafts that keep the authored German.
        if not isinstance(question.response, SingleChoice):
            raise ValueError(
                f'question "{question.id}" is a {question.response.kind} question, which no item '
                "type can render. Run `atlas-listening normalize-questions` and finish the "
                "converted options in the editor."
            )
        item: dict[str, object] = {
            "id": question.id,
            "outcomes": payload.brief.outcomes,
            "type": "audio-comprehension",
            "source": {"kind": "tts", "turns": turns},
            "recording": slug,
            "instruction": question.instruction.model_dump(exclude_none=True),
            "question": question.response.prompt,
            "options": question.response.options,
            "correct": question.response.correct,
            "explain": question.explain.model_dump(exclude_none=True),
            "max_replays": payload.max_replays,
        }
        if question.translation:
            item["translation"] = question.translation.model_dump(exclude_none=True)
        if question.focus:
            item["focus"] = question.focus
        items.append(item)
    return {
        "topic": payload.brief.topic,
        "role": "practice",
        "title": payload.title.model_dump(exclude_none=True),
        "items": items,
    }


def manifest(
    slug: str,
    payload: RevisionPayload,
    wav: Path,
    qa: dict[str, object],
    approval: dict[str, object],
    models: dict[str, object],
    *,
    dry_wav: Path | None = None,
    source_root: Path | None = None,
) -> dict[str, object]:
    model_entries = models.get("models", {})
    selected_model: object = {}
    if isinstance(model_entries, dict):
        selected_model = model_entries.get(payload.tts_adapter, {})
    adapter_revision = (
        str(selected_model.get("revision", "unknown"))
        if isinstance(selected_model, dict)
        else "unknown"
    )
    per_line = []
    for line in payload.lines:
        key = line_cache_key(line, adapter_revision)
        cached_wav = wav.parent / "cache" / f"{key}.wav"
        per_line.append(
            {
                "line_id": line.id,
                "display_text_sha256": hashlib.sha256(line.display_text.encode()).hexdigest(),
                "synthesis_text_sha256": hashlib.sha256(line.spoken_text().encode()).hexdigest(),
                "cache_key": key,
                "wav_sha256": sha256(cached_wav) if cached_wav.exists() else None,
            }
        )
    contextual_sources = []
    for context in payload.context_sounds:
        if source_root is None:
            raise ValueError("source_root is required for contextual audio")
        source, _ = load_source(source_root, context.source_sha256)
        contextual_sources.append(
            {
                **source.model_dump(mode="json"),
                "processing": context.model_dump(mode="json"),
            }
        )
    return {
        "version": 1,
        "id": slug,
        "created_at": str(approval.get("reviewed_at", datetime.now(UTC).isoformat())),
        "dependency_lock_sha256": models.get("dependency_lock_sha256"),
        "model_lock_sha256": models.get("model_lock_sha256"),
        "revision_sha256": payload.sha256(),
        "script_sha256": hashlib.sha256(
            "\n".join(line.display_text for line in payload.lines).encode()
        ).hexdigest(),
        # The master the editor approved (WAV, never committed) and the file that ships
        # (MP3, committed). Both are pinned; see encode_mp3.
        "master_audio_sha256": sha256(wav),
        "dry_audio_sha256": sha256(dry_wav or wav),
        "models": model_entries,
        "settings": {
            "adapter": payload.tts_adapter,
            "lines": [line.model_dump(mode="json") for line in payload.lines],
            "assembly": {"format": "wav-pcm-s16le", "silence": "ffmpeg-anullsrc-16000-mono"},
            "context_sounds": [sound.model_dump(mode="json") for sound in payload.context_sounds],
        },
        "contextual_sources": contextual_sources,
        "line_artifacts": per_line,
        "qa": qa,
        "approval": approval,
        "claims": {
            "model_license_is_training_data_provenance": False,
            "voice_cloning_used": False,
            "reference_audio_used": False,
        },
    }


def write_bundle(
    out: Path,
    slug: str,
    payload: RevisionPayload,
    wav: Path,
    qa: dict[str, object],
    approval: dict[str, object],
    models: dict[str, object],
    *,
    dry_wav: Path | None = None,
    source_root: Path | None = None,
) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    review_date = str(approval.get("reviewed_at", ""))[:10]
    brief_name = f"{review_date}-{slug}-listening.md"
    # The brief states what happened, and nothing else.
    #
    # It used to print `draft_prompt(payload)` under the heading "Exact prompt". That call
    # rebuilds a prompt from the payload as it stands *now* — after the editorial revision
    # every draft receives — so the published string was not what any model was given; and a
    # hand-written project, which submits no prompt at all, got one anyway. Provenance that
    # invents a generation history is worse than provenance that has none.
    if payload.authoring == "generated" and payload.generation_prompt:
        brief = (
            f"# Listening generation brief — {slug}\n\n"
            "## Exact prompt, as submitted\n\n"
            f"{payload.generation_prompt}\n\n"
            "The script below was revised editorially after generation; this prompt is the "
            "input that produced the draft, not a description of the final text.\n"
        )
    else:
        brief = (
            f"# Listening generation brief — {slug}\n\n"
            "## Manually authored\n\n"
            "No prompt was submitted to a language model for this script. It was written by "
            "the editor, and the model lock below covers the speech synthesis only.\n"
        )
    (out / "generation-brief.md").write_text(brief)
    shutil.copy2(wav, out / f"{slug}.wav")
    shutil.copy2(dry_wav or wav, out / f"{slug}-dry.wav")
    published = encode_mp3(wav, out / f"{slug}.mp3")
    for context in payload.context_sounds:
        if source_root is None:
            raise ValueError("source_root is required for contextual audio")
        source, original = load_source(source_root, context.source_sha256)
        source_dir = out / "sources" / f"freesound-{source.sound_id}"
        source_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, source_dir / original.name)
        shutil.copy2(source_root / "sources" / source.original_sha256 / "source.json", source_dir / "source.json")
        credit = (
            f'# Freesound {source.sound_id}\n\n'
            f'"{source.title}" by {source.uploader} — {source.page_url} — '
            f'{source.license} ({source.license_url}).\n\n'
            f'Used as low-level contextual audio. Processing: start {context.start_ms} ms, '
            f'duration {context.duration_ms} ms, delay {context.delay_ms} ms, gain {context.gain_db} dB.\n'
        )
        (source_dir / "ATTRIBUTION.md").write_text(credit)
    data = listening_yaml(
        slug,
        payload,
        f"data/audio-provenance/{payload.brief.level.lower()}/{slug}.json",
    )
    (out / "listening.yaml").write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False))
    (out / "exercise.yaml").write_text(
        yaml.safe_dump(exercise_yaml(slug, payload), allow_unicode=True, sort_keys=False)
    )
    (out / "project.json").write_text(
        json.dumps(payload.model_dump(mode="json"), ensure_ascii=False, indent=2)
    )
    transcript = "\n".join(f"{line.speaker}: {line.display_text}" for line in payload.lines)
    (out / "transcript.txt").write_text(transcript + "\n")
    # Every authored or model-produced string is escaped. These files are opened in a browser by
    # the editor, so an unescaped `<` is at best a title that renders wrong and at worst a
    # `<script>` a language model wrote executing on the reviewer's machine.
    student = (
        "<h1>"
        + html.escape(payload.title.en)
        + "</h1><audio controls src='"
        + html.escape(slug, quote=True)
        + ".wav'></audio>"
        + "".join(
            f"<p>{i + 1}. "
            + html.escape(
                getattr(q.response, "prompt", getattr(q.response, "statement", "Diktat"))
            )
            + "</p>"
            for i, q in enumerate(payload.questions)
        )
    )
    teacher = student + "<h2>Transcript</h2><pre>" + html.escape(transcript) + "</pre>"
    (out / "student.html").write_text("<!doctype html><meta charset=utf-8>" + student)
    (out / "teacher.html").write_text("<!doctype html><meta charset=utf-8>" + teacher)
    for name, body in [("student", student), ("teacher", teacher)]:
        canvas = Canvas(str(out / f"{name}.pdf"), pagesize=A4, invariant=1)
        y = 800
        pdf_lines = [
            payload.title.en,
            *(transcript.splitlines() if name == "teacher" else ["Listening exercise"]),
        ]
        for line in pdf_lines:
            canvas.drawString(48, y, line[:100])
            y -= 18
        canvas.save()
    manifest_data = manifest(
        slug,
        payload,
        wav,
        qa,
        approval,
        models,
        dry_wav=dry_wav,
        source_root=source_root,
    )
    manifest_data["published_audio_sha256"] = sha256(published)
    manifest_data["published_audio_bitrate"] = MP3_BITRATE
    manifest_data["generation_brief"] = {
        "path": f"data/prompts/{brief_name}",
        "sha256": sha256(out / "generation-brief.md"),
    }
    manifest_data["exported_files"] = {
        file.relative_to(out).as_posix(): sha256(file)
        for file in sorted(out.rglob("*"))
        if file.is_file() and file.name != "provenance.json"
    }
    (out / "provenance.json").write_text(
        json.dumps(manifest_data, ensure_ascii=False, indent=2, sort_keys=True)
    )
    archive = out.with_suffix(".zip")
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in sorted(out.rglob("*")):
            if not file.is_file():
                continue
            relative_name = file.relative_to(out).as_posix()
            info = zipfile.ZipInfo(relative_name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, file.read_bytes())
    return archive


def register_exercise(repo: Path, level: str, topic: str, set_id: str) -> Path:
    """Append the published set to its topic's `exercises:` frontmatter.

    A set no topic lists is a set no learner reaches: the topic page renders `data.exercises`
    and nothing else, and `scripts/validate.ts` reports the file as an orphan. Publishing a
    recording that never appears on its unit's page is a successful publish of nothing.

    It goes at the **end** of the list. The first `role: practice` set is the topic's
    primaryPractice and advances the Lernpfad, so its item list must not grow later — see
    CLAUDE.md, "Every topic owns at least one `role: practice` set".
    """

    path = repo / "content" / "topics" / level / f"{topic}.mdx"
    if not path.exists():
        raise FileNotFoundError(f"no topic article at {path} to attach {set_id} to")
    text = path.read_text()
    match = re.search(r"^exercises: \[(.*)\]$", text, flags=re.MULTILINE)
    if not match:
        raise ValueError(f"{path} has no inline `exercises: [...]` list to append {set_id} to")
    refs = [ref.strip() for ref in match.group(1).split(",") if ref.strip()]
    if set_id not in refs:
        refs.append(set_id)
        joined = ", ".join(refs)
        path.write_text(f"{text[: match.start()]}exercises: [{joined}]{text[match.end() :]}")
    return path


def publish(repo: Path, slug: str, payload: RevisionPayload, bundle: Path) -> list[Path]:
    level = payload.brief.level.lower()
    provenance_data = json.loads((bundle / "provenance.json").read_text())
    brief_path = repo / provenance_data["generation_brief"]["path"]
    targets = {
        # The MP3 derivative is what enters the repo — beside the artifact record, NOT under
        # public/, because the Pages build must ship no audio at all. The WAV master stays in
        # the studio: it is what the editor approved and what QA ran on, and committing it
        # would put ~29 MB in git history for bytes no learner ever downloads.
        # src/integrations/audio-bundle.ts copies these into the desktop build.
        bundle / f"{slug}.mp3": repo / "content" / "listening" / level / f"{slug}.mp3",
        bundle / "listening.yaml": repo / "content" / "listening" / level / f"{slug}.yaml",
        bundle / "exercise.yaml": repo / "content" / "exercises" / level / f"{slug}-hoeren.yaml",
        bundle / "provenance.json": repo / "data" / "audio-provenance" / level / f"{slug}.json",
        bundle / "generation-brief.md": brief_path,
    }
    for source in sorted((bundle / "sources").glob("freesound-*/*")):
        sound_id = source.parent.name.removeprefix("freesound-")
        targets[source] = repo / "data" / "audio-sources" / "freesound" / sound_id / source.name
    collisions = [str(target) for target in targets.values() if target.exists()]
    if collisions:
        raise FileExistsError("publish would overwrite: " + ", ".join(collisions))
    # Fail before writing anything if the set has nowhere to be referenced from — a half-published
    # recording is easier to finish by hand than an orphan nobody notices.
    topic_path = repo / "content" / "topics" / level / f"{payload.brief.topic}.mdx"
    if not topic_path.exists():
        raise FileNotFoundError(f"no topic article at {topic_path} to attach {slug}-hoeren to")
    for source, target in targets.items():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    written = list(targets.values())
    written.append(register_exercise(repo, level, payload.brief.topic, f"{level}/{slug}-hoeren"))
    return written
