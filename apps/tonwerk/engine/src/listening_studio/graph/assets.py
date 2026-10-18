"""The content-addressed asset store every render node reads from and writes to.

One rule holds the whole file together: **the name of a file is the hash of its bytes**, so two
runs that produced identical audio produce one asset, and an asset that is referenced anywhere
can be checked rather than trusted. `AssetRef.ref` in a converted scene is exactly such a name —
the sha256 of a Freesound original that `sources.py` imported — which is why the store has to
answer for two kinds of bytes at once:

* **Bytes this pipeline produced** (speech takes, paced takes, positioned stems, mixes). They are
  copied in as `assets/<sha256>.wav` with a provenance sidecar beside them.
* **Bytes somebody else produced** and this repository merely imported. Those already live under
  `sources/<sha256>/original.*` with a reviewed licence record, and the store does **not** copy
  them: it writes a pointer sidecar naming the source sha and the licence id, and `get` resolves
  through it. Copying the metadata out of `sources.py` would give the licence two homes and one
  of them would go stale; copying the bytes would give a 10 MB room tone two copies and no way to
  say which one the reviewer listened to.

The sidecar is written once per sha and never rewritten. Content addressing means two different
productions can legitimately land on the same bytes — `FakeSpeech` emits silence whose length
tracks the text, so two same-length lines *are* the same file — and in that case the recorded
provenance is the first one seen. It says truthfully where these bytes can come from, not
exclusively where they came from.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path
from typing import Any, Mapping

from ..sources import load_source


def sha256_file(path: Path) -> str:
    """The digest of a file's bytes, read in chunks so a long room tone is not held in memory."""

    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class AssetStore:
    """`assets/<sha256>.wav` plus `assets/<sha256>.json`, under the studio work directory."""

    def __init__(self, root: Path) -> None:
        #: The studio work directory — `Store.root`, i.e. the same platformdirs location the
        #: database and the imported `sources/` live in. Passed rather than derived so a test
        #: gets a throwaway store for free.
        self.root = root
        self.directory = root / "assets"

    # -- naming ---------------------------------------------------------------

    def path_for(self, sha: str, suffix: str = ".wav") -> Path:
        return self.directory / f"{sha}{suffix}"

    def sidecar_for(self, sha: str) -> Path:
        return self.directory / f"{sha}.json"

    # -- writing --------------------------------------------------------------

    def put(self, path: Path, provenance: Mapping[str, Any]) -> str:
        """Copy one audio file in under its own digest and return that digest. Idempotent.

        The copy goes to a per-process temporary name and is then `replace`d into position, so a
        reader never sees a half-written asset and two renders of the same node cannot interleave
        on one file. The extension is carried over from the source and recorded in the sidecar,
        because not every asset is a WAV — `publish.mp3` is a node output like any other, and an
        MP3 stored under a `.wav` name would be a lie every later reader would inherit.
        """

        digest = sha256_file(path)
        suffix = path.suffix.lower() or ".wav"
        target = self.path_for(digest, suffix)
        self.directory.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            staging = target.with_name(f"{digest}.{os.getpid()}.partial")
            shutil.copyfile(path, staging)
            staging.replace(target)
        sidecar = self.sidecar_for(digest)
        if not sidecar.exists():
            sidecar.write_text(
                json.dumps(
                    {"file": target.name, **dict(provenance)},
                    ensure_ascii=False,
                    indent=2,
                    sort_keys=True,
                )
                + "\n"
            )
        return digest

    def resolve_source(self, sha: str) -> Path:
        """Bridge an imported Freesound original into the store without copying it.

        `load_source` is the one place that checks the imported bytes against the sha the
        manifest recorded, so it is what runs here rather than a directory lookup. The sidecar
        this writes carries the *reference* — the source sha and the licence id — and nothing
        else from `source.json`: that file is the reviewed record and stays the only copy.
        """

        source, original = load_source(self.root, sha)
        sidecar = self.sidecar_for(sha)
        if not sidecar.exists():
            self.directory.mkdir(parents=True, exist_ok=True)
            sidecar.write_text(
                json.dumps(
                    {
                        "kind": "imported-source",
                        "source_sha256": sha,
                        "sound_id": source.sound_id,
                        "license": source.license,
                        "source_record": f"sources/{sha}/source.json",
                    },
                    ensure_ascii=False,
                    indent=2,
                    sort_keys=True,
                )
                + "\n"
            )
        return original

    # -- reading --------------------------------------------------------------

    def provenance(self, sha: str) -> dict[str, Any] | None:
        sidecar = self.sidecar_for(sha)
        if not sidecar.exists():
            return None
        loaded: dict[str, Any] = json.loads(sidecar.read_text())
        return loaded

    def get(self, sha: str) -> Path | None:
        """The audio for one digest, or None — a pointer whose source is gone is a None too."""

        record = self.provenance(sha)
        if record is not None:
            name = record.get("file")
            if isinstance(name, str) and (self.directory / name).exists():
                return self.directory / name
        default = self.path_for(sha)
        if default.exists():
            return default
        # Either a pointer sidecar, or no sidecar at all: the digest may name an imported source
        # nothing has asked for yet, which is the normal state the first time a converted scene
        # is rendered on this machine.
        try:
            return self.resolve_source(sha)
        except ValueError:
            return None

    def require(self, sha: str) -> Path:
        found = self.get(sha)
        if found is None:
            raise ValueError(
                f"asset {sha} is not in the store and is not an imported source; "
                "import the sound before rendering a scene that references it"
            )
        return found
