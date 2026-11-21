# ADR 0021: A scene of a cast member may open a serial episode; the portrait keeps its one job

Status: accepted · 2026-11-21

## Context

[ADR 0016](0016-lessons-are-tasks-and-a-cast-carries-them.md) gave a portrait one job, telling
speakers apart, and said it is never decoration. Its seventh decision was written before any image
existed. The first images now exist, and the owner, generating them, found one image per character
"very boring": the cast should feel alive across a serial, and one face per person does not do
that.

So each person gets a portrait and further images of the same person: Lena behind the bakery
counter, in a bicycle workshop, in the courtyard under the new bicycle shelter. A serial is where
those places recur ([ADR 0016](0016-lessons-are-tasks-and-a-cast-carries-them.md) puts genre in
the extensive reading serials), and an episode is read for its story, with no evidence taken from
it. A picture there costs a learner nothing they are measured on, provided it answers nothing they
are asked.

## Decision

1. **A scene image may open a serial episode.** A scene is an image of a cast member in a place of
   the serial. It is listed in that person's character record with a German alt text, and an
   extensive reading names it to open with it.
2. **It shows nothing a question asks about.** Each attachment is decided by reading the episode's
   questions against the picture; an image that shows an answer, or rules options in or out beyond
   what the text has already said, opens no episode. A scene that fits no episode stays unused.
3. **It carries no words, and it has alt text.** Like a portrait, it is generated, imitates nobody
   and carries provenance.
4. **The portrait's job stands.** A portrait tells speakers apart and is shown where a cast member
   is named as a speaker. Only the "never decoration" clause of ADR 0016's seventh decision is
   replaced, and only for scenes at the head of a serial episode. The rest of ADR 0016 stands.

## Consequences

- The validator holds that an episode's scene is listed by a record, that the record's person has
  been read against that episode, that every image file exists, and that a scene opens only an
  extensive reading. Whether a picture gives an answer away is no field and no gate sees it: the
  author reads the questions, and the record's description says what the picture shows.
- Every image is a file under `public/characters/<id>/` with a provenance record, made from the
  owner's originals by one import ([`docs/apps/tonwerk.md`](../apps/tonwerk.md#figuren-and-their-images)).
  The originals stay out of the repository.
- A scene beside the title is a fixed square, so the text starts where it would without one; it is
  never above the text, and an intensive Lesetext, which is a task, never gets one.
- This does not let images into articles, items or intensive texts. A new use of a cast image
  beyond the speaker label and the serial episode is a new decision.
