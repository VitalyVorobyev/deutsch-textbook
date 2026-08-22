# The apps in this repository

Three applications live here. They share the repository and almost nothing else — different
audiences, different transports, different data.

| App | What it is for | Start it | Guide |
| --- | --- | --- | --- |
| **Deutsch-Atlas** | the course itself: articles, exercises, flashcards | `bun run dev` → `:4321` | [`../../README.md`](../../README.md) |
| **Redaktion** | read and edit the corpus with the content graph beside it | `bun run redaktion` → `:4330` | [`redaktion.md`](redaktion.md) |
| **Tonwerk** | author, render, check and approve the listening audio | `bun run tonwerk` → `:4340` | [`tonwerk.md`](tonwerk.md) |

Redaktion reads the checked-out repository through `@da/content` and never opens a socket. Tonwerk
opens no files at all — it talks HTTP to a local Python render engine and holds a bearer token. Both
are single-operator tools whose interface language is German, with no switcher.

The desktop build of the learner app and the release process are in
[`../../README.md`](../../README.md); Redaktion has a desktop build of its own, described in its
guide.
