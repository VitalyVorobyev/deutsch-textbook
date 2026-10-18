# apps/redaktion — Redaktion

Claude Code loads this file when you work in this directory; the root [`CLAUDE.md`](../../CLAUDE.md) applies too.

## Commands

- `bun run redaktion` — **Redaktion**, the editorial workbench (`apps/redaktion`, :4330); every figure comes from `@da/content`, never recomputed in a view. Saves are explicit, revision-checked and atomic, and only for existing text sources under `content/` and `data/`; `reviewed` goes through the allowlisted splice and the full rollback gate. `bun run redaktion:desktop` launches the Tauri app, whose webview gets one narrow stdio RPC and the folder picker — never general filesystem or shell access. → [`docs/apps/redaktion.md`](../../docs/apps/redaktion.md) · [ADR 0010](../../docs/adrs/0010-editorial-tools-are-separate-apps.md)
- `bun run redaktion:audit` — Redaktion's layout measured in a real browser (boots its own dev server; `bunx playwright install chromium` once): every route resolves, permalinks survive reload, no request leaves the origin, row raggedness ≤ 2× the median. Not in `bun test`. **A shared package can be invisible to Tailwind** — `tests/design-tokens.test.ts` fails if a `@da/ui` `.tsx` falls outside the `@source` globs.
