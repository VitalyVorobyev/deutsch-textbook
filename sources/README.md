# sources/

External-derived source material that has been adapted into `content/` and is kept so an
adaptation can always be diffed against what it was adapted from. Nothing in here is read
by the build, imported by code, or shipped.

- `klassiker/` — the ten didactic retellings of public-domain German classics behind the
  extensive readings `klassiker-1` … `klassiker-10` (ADR 0006). Each file's
  `## Adaptierter Lesetext` section is the text the reading ships (four were trimmed into
  the validator's 250–400-word band — the diff against these files shows exactly what was
  cut). `SOURCES.md` holds the Wikisource links; the per-reading `attribution` fields are
  the learner-facing credit.
