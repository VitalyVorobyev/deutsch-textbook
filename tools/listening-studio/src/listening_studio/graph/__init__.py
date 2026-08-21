"""The render graph: a `Scene` becomes audio here.

Three modules, and the split is the one the concept document argues for. `assets` is the
content-addressed store — bytes named by their own hash, with a provenance sidecar. `nodes` is
what each computation is, what identifies it and how it is run, including every ffmpeg filter
string in this pipeline. `render` builds the graph for one scene, evaluates only what changed,
and writes the manifest that makes the result a reproducible build artifact rather than a WAV
somebody has.

Nothing here touches the legacy `RevisionPayload` pipeline (`adapters.generate_lines`,
`assemble`, `mix_context`), which keeps rendering the 41 published dialogues exactly as it did.
"""

from .assets import AssetStore, sha256_file
from .nodes import (
    BUSES,
    IMPL_VERSIONS,
    LOUDNORM,
    PUBLISH_BITRATE,
    QA_RATE,
    WORKING_CHANNELS,
    WORKING_CODEC,
    WORKING_RATE,
    MixInput,
    Node,
    mix_filtergraph,
    pan_filter,
    track_filters,
)
from .render import (
    Artifact,
    EntryTiming,
    NodeCache,
    NodeRun,
    RenderResult,
    UtteranceTiming,
    render_scene,
)

__all__ = [
    "Artifact",
    "AssetStore",
    "BUSES",
    "EntryTiming",
    "IMPL_VERSIONS",
    "LOUDNORM",
    "MixInput",
    "Node",
    "NodeCache",
    "NodeRun",
    "PUBLISH_BITRATE",
    "QA_RATE",
    "RenderResult",
    "UtteranceTiming",
    "WORKING_CHANNELS",
    "WORKING_CODEC",
    "WORKING_RATE",
    "mix_filtergraph",
    "pan_filter",
    "render_scene",
    "sha256_file",
    "track_filters",
]
