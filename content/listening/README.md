# Listening artifacts

Reviewed committed listening stimuli live under `<level>/<id>.yaml`. They are input artifacts;
exercise attempts reference them, while opening or replaying audio creates no evidence.

`data/listening-plan.yaml` specifies the intended artifact for every live Atlas unit. It is an
editorial plan, not runtime content; `bun run listening:inventory` derives availability from this
collection, WAV files, QA manifests and saved briefs.

A record may end with `cue_source` and `cues`: one `{start_ms, end_ms}` per transcript turn, used
after an answer to replay one line and to follow the transcript. A scene publish writes them from
the render (`cue_source: render`). The recordings published before scenes carry
`cue_source: whisper-aligned`, measured on the MP3 by `atlas-listening measure-cues`. Measured cues
tile the recording, and each inner boundary is snapped to the quietest frame near Whisper's guess.
`bun run validate` holds one cue per turn, in order, inside the recording.
