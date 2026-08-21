"""The exercise material that hangs off a scene — deliberately not part of the scene.

A scene is *audio*: a cast, a script, a timeline. What a learner is asked about it afterwards is
a different artifact with a different lifecycle — the questions are revised, translated and
re-tagged long after the audio is approved, and a question edit must not invalidate an approval
that vouched for specific bytes. `RevisionPayload` merged the two (`questions` sat beside
`lines`, inside the hash the approval covered), which is why editing a distractor returned an
approved dialogue to draft and threw its QA away.

A studio scene project is therefore three things: the scene, an optional attachment, and the
review state around them.
"""

from __future__ import annotations

import hashlib
import json

from pydantic import ConfigDict, Field

from ..domain import Question
from .model import Strict


class ExerciseAttachment(Strict):
    model_config = ConfigDict(extra="forbid")

    questions: list[Question] = Field(min_length=1)
    #: How many times the learner may replay the recording. Listening comprehension that can be
    #: replayed without limit is reading comprehension with extra steps.
    max_replays: int = Field(default=3, ge=1, le=10)

    @property
    def question_ids(self) -> list[str]:
        return [question.id for question in self.questions]

    def canonical_json(self) -> str:
        return json.dumps(
            self.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )

    def sha256(self) -> str:
        return hashlib.sha256(self.canonical_json().encode()).hexdigest()
