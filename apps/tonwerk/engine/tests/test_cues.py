"""Measured turn cues: aligning Whisper's timed words to a transcript the recording is held to."""

from __future__ import annotations

import pytest

from listening_studio.cues import LEAD_MS, Word, align_cues

TURNS = ["Achtung an Gleis drei.", "Der Zug fährt ab.", "Gute Reise!"]


def heard(*rows: tuple[str, int, int]) -> list[Word]:
    return [Word(text, start, end) for text, start, end in rows]


def test_cues_tile_the_recording_from_each_first_word() -> None:
    words = heard(
        ("Achtung", 1000, 1400), ("an", 1400, 1500), ("Gleis", 1500, 1900), ("drei.", 1900, 2200),
        ("Der", 3000, 3200), ("Zug", 3200, 3500), ("fährt", 3500, 3800), ("ab.", 3800, 4000),
        ("Gute", 4700, 4900), ("Reise!", 4900, 5300),
    )
    assert align_cues(TURNS, words, 6000) == [
        (1000 - LEAD_MS, 3000 - LEAD_MS),
        (3000 - LEAD_MS, 4700 - LEAD_MS),
        (4700 - LEAD_MS, 6000),
    ]


def test_a_misheard_word_and_a_numeral_stay_with_their_turn() -> None:
    """What Whisper actually wrote for "Achtung an Gleis drei" on a station announcement."""

    words = heard(
        ("Achtemann", 3340, 4300), ("Gleis", 4300, 4760), ("3", 4760, 5060),
        ("Der", 6540, 6800), ("Zug", 6800, 7000), ("fährt", 7000, 7300), ("ab.", 7300, 7500),
        ("Gute", 8200, 8400), ("Reise!", 8400, 8800),
    )
    cues = align_cues(TURNS, words, 9500)
    # The first turn starts at the misheard word, not at "Gleis", the first word that matched.
    assert cues[0][0] == 3340 - LEAD_MS
    assert cues[1][0] == 6540 - LEAD_MS


def test_a_start_never_reaches_back_into_the_previous_turn() -> None:
    words = heard(("Achtung", 0, 300), ("an", 300, 400), ("Gleis", 400, 600), ("drei.", 600, 950),
                  ("Der", 1000, 1100), ("Zug", 1100, 1200), ("fährt", 1200, 1300), ("ab.", 1300, 1400),
                  ("Gute", 1500, 1600), ("Reise!", 1600, 1700))
    cues = align_cues(TURNS, words, 2000)
    assert cues[1][0] == 950 and cues[0][0] == 0


def test_a_turn_nothing_was_heard_for_is_refused_by_name() -> None:
    words = heard(("Achtung", 0, 300), ("Gleis", 300, 600), ("Gute", 1500, 1600))
    with pytest.raises(ValueError, match="turn\\(s\\) 2 \\('Der Zug fährt ab.'\\)"):
        align_cues(TURNS, words, 2000)


def test_an_inner_boundary_moves_to_the_quietest_frame_near_it() -> None:
    from listening_studio.cues import SNAP_FRAME_MS, snap_to_pauses

    # Speech everywhere except one quiet frame 210 ms before Whisper's boundary at 3000 ms.
    levels = [-20.0] * 200
    levels[(3000 - 210) // SNAP_FRAME_MS] = -70.0
    snapped = snap_to_pauses([(0, 3000), (3000, 6000)], levels)
    assert snapped == [(0, 2790), (2790, 6000)]
    # The first start and the last end are the recording's own and never move.
    assert snapped[0][0] == 0 and snapped[-1][1] == 6000
