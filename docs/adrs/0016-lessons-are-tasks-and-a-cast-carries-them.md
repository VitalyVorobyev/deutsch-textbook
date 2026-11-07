# ADR 0016: A lesson is a sequence of tasks, each built on one stimulus, and a recurring cast of people carries the stimuli

Status: accepted · 2026-11-07 · its first four names superseded by [0017](0017-the-first-four-are-the-lena-serials-cast.md) · 2026-11-07 · its walk-on voice pool superseded by [0018](0018-the-twelve-roster-voices-are-the-whole-pool.md) · 2026-11-07 · its frozen-identity clause superseded in part by [0019](0019-a-topics-exercises-are-three-steps.md) · 2026-11-07

## Context

A lesson is shaped by files ([ADR 0002](0002-topic-manifests-and-learning-activities.md)). A topic
lists its sets, and the lesson cycle (pretest → model → explanation → scaffold → fade → transfer →
delayed check) is a convention that validators enforce piece by piece. Listening shows the cost.
Of 145 recordings, 81 serve one question and 42 serve two
(`grep -rhE "^ *recording:" content/exercises | sort | uniq -c`). Listening-comprehension questions
score 97% over 64 attempts (`bun run progress:audit --profile vitaly`, snapshot 2026-11-01).
An item at the ceiling measures nothing.

Voices are not yet people. The 12 roster voices play about 160 speaker names
(`grep -h "^- [A-ZÄÖÜ]" content/listening/*/*.yaml | sort -u`). One voice is *Lena* in one scene
and *Anna* in the next, and the Lena of the reading serial is tied to neither. A voice can now stay
the same person: [ADR 0013](0013-designed-voices-and-automatic-publishing.md) pins one synthetic
reference per character. 105 of the 145 recordings already speak through such a reference, and 40
wait for their recast (`grep -rLE '"engine": *"qwen_tts_designed"' data/audio-provenance/*/*.json`).

The owner wants a stable cast to be part of the course, with portraits, and accepts rewriting
material to get one. Genre is meant for the reading serials, never for the lesson texts. All
twelve voices may become people, starting with four. Four forces pull against each other:

- a familiar cast and setting lower cognitive load;
- unfamiliar voices are what make L2 listening generalise;
- a detail that serves no task depresses learning from the material around it;
- once a biography ships, any later text can contradict it, and no gate sees that today.

## Decision

1. **The task is the unit of lesson design.** A task is one communicative job built on one
   stimulus: a recording, a Lesetext or a document. Its 4–6 items climb a fixed ladder: gist,
   then detail, then who said or wrote it, then noticing the target form, then a typed reply or
   reformulation. A converted manifest lists its tasks in cycle order. This replaces the lesson
   shape of ADR 0002. Its manifest and its evidence unit stand: the exercise file still stores
   items and keys evidence. Item ids, set ids and revisions stay frozen, and a conversion adds
   identities, never renames them.
2. **A recording carries a task, not a question.** In a converted topic, every recording serves at
   least four scored items, with four options or a typed answer. Each listening outcome gets a
   delayed probe family.
3. **A person is content, and a voice is casting.** A character record in `content/characters/`
   holds:
   - a name, an age band, a job and a place;
   - relations, with *du* or *Sie* toward each other member;
   - exactly one roster voice, which speaks for nobody else.

   Every named speaker in a listening or reading file is either a cast member or an unnamed role
   (*Durchsage*, *Kundin*, *Beamter*), and the validator holds that.
4. **The cast grows by need.** All twelve roster voices may become people. The first four are
   Lena, Mira, Jonas and one older adult who carries *Sie* and the official domains. A fact about
   a character ships only when a task uses it, and a member enters only when a task first needs
   them.
5. **Unfamiliar voices are a maintained share.** Unnamed roles are spoken by a pool of designed
   walk-on voices outside the cast. At least one third of each level's recorded listening seconds
   stays with walk-on voices. That floor is set before measurement, and it is revised once the
   listening inventory reports the share.
6. **Genre lives in the extensive reading serials.** The Lena serial is everyday drama, and a Krimi
   serial at B1–B2 comes next. Each serial is cast from the characters, and this is how the cast
   grows.
   - Articles, intensive Lesetexte and items have one version each: one item id measures one
     stimulus.
   - Serials keep the extensive-reading contract: no gating, no unlocks, no evidence.
   - Sexual content is outside the course.
7. **A portrait has one job: telling speakers apart.** It answers a "Wer sagt das?" item.
   Portraits are generated, imitate nobody, carry provenance and hold no words a task depends on.
   They are never decoration.

## Consequences

- The evidence model is unchanged ([ADR 0003](0003-the-evidence-model.md)). The cast is judged
  only through scored items: converted recordings should leave the ceiling. Whether serials sustain
  more reading is invisible by construction, and that stays the owner's judgment from use.
- Character proper nouns earn no cards and no Wortliste coverage. No game mechanics are added: no
  relationship meters, no episodes to unlock, no XP.
- Continuity is checked only where it is data: the fields of a character record, and the names of
  speakers. A contradiction in prose, such as a city named differently in a later episode, needs
  a manual read of each episode against the records. That read is part of authoring the episode.
- A rewrite means a new recording, and the cost is stated per batch. The pilot converts one A2 and
  one B1 topic. B2 is authored in this shape from its first unit.
- Unconverted topics stay on the file model of ADR 0002 until they are converted. The two models
  live side by side, and the validator holds only converted topics to the ladder.
- Tonwerk casts from the character records, and the walk-on pool is new roster entries.
- This ADR does not decide how a task looks on the page, which serial episodes exist, or who the
  older adult is. The pilot decides those.
