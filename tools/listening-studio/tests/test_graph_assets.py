"""The content-addressed asset store, including the bridge to `sources.py` originals."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from listening_studio.graph.assets import AssetStore, sha256_file
from listening_studio.sources import import_source
from test_sources import make_wav, metadata


def test_a_put_is_idempotent_and_names_the_file_by_its_bytes(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    source = tmp_path / "take.wav"
    make_wav(source)
    first = store.put(source, {"kind": "speech-take", "engine": "fake"})
    second = store.put(source, {"kind": "speech-take", "engine": "fake"})
    assert first == second == sha256_file(source)
    assert store.get(first) == tmp_path / "assets" / f"{first}.wav"
    assert len(list((tmp_path / "assets").glob("*.wav"))) == 1


def test_the_first_provenance_for_a_set_of_bytes_is_kept(tmp_path: Path) -> None:
    """Two productions can legitimately land on the same audio; the sidecar is not rewritten.

    `FakeSpeech` emits silence whose length tracks the text, so two same-length lines *are* one
    file. The record says truthfully where these bytes can come from, not exclusively where they
    came from — and it must not flip on every render.
    """

    store = AssetStore(tmp_path)
    source = tmp_path / "take.wav"
    make_wav(source)
    digest = store.put(source, {"kind": "speech-take", "seed": 101})
    store.put(source, {"kind": "speech-take", "seed": 999})
    assert (store.provenance(digest) or {})["seed"] == 101


def test_a_non_wav_asset_keeps_its_own_extension(tmp_path: Path) -> None:
    """`publish.mp3` is a node output like any other, and storing it as `.wav` would be a lie."""

    store = AssetStore(tmp_path)
    source = tmp_path / "published.mp3"
    source.write_bytes(b"ID3\x04\x00\x00\x00\x00\x00\x00")
    digest = store.put(source, {"kind": "encode", "encoding": "publish"})
    stored = store.get(digest)
    assert stored is not None and stored.suffix == ".mp3"
    assert (store.provenance(digest) or {})["file"] == f"{digest}.mp3"


def test_an_imported_source_is_referenced_rather_than_copied(tmp_path: Path) -> None:
    """A reviewed licence record has exactly one home, and 10 MB of room tone has one copy."""

    original = tmp_path / "room.wav"
    make_wav(original)
    info = tmp_path / "source.json"
    metadata(info)
    work = tmp_path / "store"
    imported = import_source(original, info, work)

    store = AssetStore(work)
    resolved = store.resolve_source(imported.original_sha256)
    assert resolved.parent == work / "sources" / imported.original_sha256
    assert not (work / "assets" / f"{imported.original_sha256}.wav").exists()

    sidecar = json.loads((work / "assets" / f"{imported.original_sha256}.json").read_text())
    assert sidecar["kind"] == "imported-source"
    assert sidecar["license"] == "CC0-1.0"
    assert sidecar["source_record"] == f"sources/{imported.original_sha256}/source.json"
    # The licence text itself is *not* copied out of `source.json`; only the reference is.
    assert "rights_risk_note" not in sidecar


def test_get_resolves_an_imported_source_that_nothing_has_asked_for_yet(
    tmp_path: Path,
) -> None:
    """The normal state the first time a converted scene is rendered on a machine."""

    original = tmp_path / "room.wav"
    make_wav(original)
    info = tmp_path / "source.json"
    metadata(info)
    work = tmp_path / "store"
    imported = import_source(original, info, work)
    assert AssetStore(work).get(imported.original_sha256) is not None


def test_an_unknown_digest_is_a_none_and_require_says_what_to_do(tmp_path: Path) -> None:
    store = AssetStore(tmp_path)
    assert store.get("0" * 64) is None
    with pytest.raises(ValueError, match="import the sound before rendering"):
        store.require("0" * 64)
