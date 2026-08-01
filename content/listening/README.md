# Listening artifacts

Reviewed committed listening stimuli live under `<level>/<id>.yaml`. They are input artifacts;
exercise attempts reference them, while opening or replaying audio creates no evidence.

`data/listening-plan.yaml` specifies the intended artifact for every live Atlas unit. It is an
editorial plan, not runtime content; `bun run listening:inventory` derives availability from this
collection, WAV files, QA manifests and saved briefs.
