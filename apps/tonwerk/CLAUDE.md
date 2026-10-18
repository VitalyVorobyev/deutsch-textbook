# apps/tonwerk — Tonwerk (UI and engine)

Claude Code loads this file when you work in this directory; the root [`CLAUDE.md`](../../CLAUDE.md) applies too. The UI is `ui/` (React, vitest); the engine is `engine/` (Python, uv: `uv run ruff check .`, `uv run mypy`, `uv run pytest`). Making a scene or a narration has a skill each: `create-listening-scene` and `narrate-reading-text`.

## Commands

- `bun run tonwerk` — **Tonwerk**, the audio studio (`apps/tonwerk/ui`, :4340). It opens no files; everything comes from the local Python engine (`127.0.0.1:8765`) over a per-run bearer token. **QA is automatic, approval is not**, and publishing is the engine's (`scene publish-approved --yes`), never a button. → [`docs/apps/tonwerk.md`](../../docs/apps/tonwerk.md) · [`apps/tonwerk/engine/README.md`](../../apps/tonwerk/engine/README.md)
