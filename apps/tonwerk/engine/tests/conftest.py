"""Shared test machinery. Chiefly: **the terminal is an input to any CLI assertion.**

Two PRs in a row went red on CI for the same reason, and neither failure was reproducible on a
laptop. A new test file created a bare `CliRunner()`; on the GitHub Actions runner rich renders
Typer's `BadParameter` box **in color at 80 columns**, so the sentence under test was wrapped
across a `│` border with ANSI escapes inside it, and every `assert "…" in result.output` failed
against text that was, as far as a human reading the log could tell, exactly what it said it was.

So there is one runner and one normaliser, here, and no test file may define its own:

* `runner` / `RUNNER` — width, color and terminal type pinned. Available both as a fixture (for
  a test that takes it as an argument) and as a module-level constant (for the many existing
  tests that call `runner.invoke` at module level). They are the same object; the fixture exists
  so a new test has an obvious thing to reach for rather than an import to copy.
* `flat()` — strips the escapes, the box borders and the hard wrapping, so an assertion is about
  the message and not about the terminal the runner happened to pick.

`test_stable_audio.py` used to import `flat` from `test_graph_cli.py`, which made one test file
depend on another's internals; both now import from here.
"""

from __future__ import annotations

import re

import pytest
from typer.testing import CliRunner

#: `NO_COLOR` and `TERM=dumb` turn rich's styling off; `COLUMNS` stops it hard-wrapping a
#: sentence at whatever width the runner's pty claims. All three are needed: dropping colour
#: alone still wraps, and widening alone still emits escapes.
RUNNER = CliRunner(env={"NO_COLOR": "1", "TERM": "dumb", "COLUMNS": "200"})

ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def flat(output: str) -> str:
    """Typer boxes a `BadParameter` and hard-wraps it, splitting sentences across `│` borders.

    Asserting on a message therefore needs the escape codes, the borders and the wrapping
    removed first, or the test is really asserting on the terminal the runner happened to pick.
    """

    plain = ANSI.sub("", output)
    return " ".join(plain.replace("│", " ").replace("╭", " ").replace("╰", " ").split())


@pytest.fixture
def runner() -> CliRunner:
    """The pinned runner, as a fixture. Same object as `RUNNER`; see the module docstring."""

    return RUNNER
