"""Resolving a pinned model checkout, against a repository root that is stated rather than guessed."""

from __future__ import annotations

from pathlib import Path

from huggingface_hub import snapshot_download


def _derived_models_root() -> Path:
    """The course repository, derived from this file's position in it.

    A fallback, not the design. It is correct only while the studio lives at
    `<repo>/tools/listening-studio/src/listening_studio/generative/`, and it says nothing when it
    is wrong: a moved package, an installed wheel or a `uv tool` shim resolves to some other
    directory, `.models/` is not there, and `locked_snapshot` reports the checkpoint as missing
    rather than as mislocated. It exists because commands that never take `--repo`
    (`generate-reading`, `qa-reading`) still have to find weights.
    """

    return Path(__file__).resolve().parents[5]


_models_root: Path | None = None


def set_models_root(path: Path | None) -> None:
    """State where `.models/` lives. Called once from the CLI/web `--repo` option.

    `None` restores the derived default, which is what a test needs after overriding it.
    """

    global _models_root
    _models_root = path.resolve() if path is not None else None


def models_root() -> Path:
    return _models_root if _models_root is not None else _derived_models_root()


def local_checkout(model_id: str, revision: str, root: Path | None = None) -> Path | None:
    """A `.models/<repo-name>/` download of exactly `revision`, or None.

    `scripts/download-qwen3-tts.py` fetches with `local_dir=`, which puts the weights in the
    repository and leaves the Hub cache holding little more than a ref pointer — so a
    `snapshot_download(local_files_only=True)` by repo id does not find a 1.8 GB checkpoint
    sitting on disk. The directory is still self-describing: `huggingface_hub` writes the source
    commit as the first line of each `.cache/huggingface/download/<file>.metadata`, and that is
    what is checked here. **Never accept the directory on its name alone** — the manifest
    publishes the pinned revision, and a directory that merely looks right would turn that
    published claim into an assumption.
    """

    base = root if root is not None else models_root()
    directory = base / ".models" / model_id.rsplit("/", 1)[-1]
    metadata = sorted((directory / ".cache" / "huggingface" / "download").glob("*.metadata"))
    if not metadata:
        return None
    commits = {path.read_text().splitlines()[0].strip() for path in metadata if path.read_text()}
    return directory if commits == {revision} else None


def locked_snapshot(
    model_id: str,
    revision: str,
    allow_patterns: list[str] | None = None,
    root: Path | None = None,
) -> str:
    local = local_checkout(model_id, revision, root)
    if local is not None:
        return str(local)
    try:
        return snapshot_download(
            repo_id=model_id,
            revision=revision,
            allow_patterns=allow_patterns,
            local_files_only=True,
        )
    except Exception as exc:
        raise RuntimeError(
            f"{model_id}@{revision} is not installed; run atlas-listening models fetch first"
        ) from exc
