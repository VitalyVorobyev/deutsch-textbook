from pathlib import Path

import pytest

from listening_studio.voice_benchmark import (
    BENCHMARK_SLUGS,
    COURSE_REPO,
    FICTIONAL_VOICE_PROMPTS,
    run_benchmark,
)
from test_domain import payload


def test_reference_prompts_make_the_synthetic_non_imitation_boundary_explicit() -> None:
    assert len(FICTIONAL_VOICE_PROMPTS) >= 4
    assert all("fictional" in prompt.lower() for prompt in FICTIONAL_VOICE_PROMPTS)
    assert all("no imitation" in prompt.lower() for prompt in FICTIONAL_VOICE_PROMPTS)


def test_benchmark_refuses_course_repository_output_before_loading_models() -> None:
    projects = [(slug, payload()) for slug in BENCHMARK_SLUGS]
    with pytest.raises(ValueError, match="outside the course repository"):
        run_benchmark(projects, COURSE_REPO / "benchmark-output")


def test_benchmark_requires_exactly_the_six_allowlisted_dialogues(tmp_path: Path) -> None:
    projects = [(slug, payload()) for slug in BENCHMARK_SLUGS[:-1]]
    with pytest.raises(ValueError, match="requires all six"):
        run_benchmark(projects, tmp_path / "benchmark-output")
