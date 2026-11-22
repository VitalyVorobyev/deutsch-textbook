# ADR 0023: A scene has room at the head of its episode

Status: accepted · 2026-11-22

## Context

[ADR 0021](0021-a-scene-of-the-cast-may-open-a-serial-episode.md) let a scene of a cast member
open a serial episode and, to keep the text where it would be without a picture, showed it as a
fixed square beside the title. The scenes exist so that the cast feels alive. At that size, a
thumbnail cut from a 1024 px file, they do not: the picture cannot be looked at, and the file
sent is far larger than the box that shows it.

The owner chose a bigger place and sized files over a smaller file in the same box.

## Decision

1. **The scene is large enough to be looked at.** On a wide window it sits beside the text, which
   flows around it and closes up underneath; on a phone it spans the column above the title.
2. **Its box is reserved before the file arrives**, so the text does not move when it loads.
3. **It is served in two sizes, written by the one import**, and the browser picks the one that
   fits. Clicking it opens the full-size file.
4. **Everything else in ADR 0021 stands**: one scene per episode, extensive readings only,
   nothing shown that a question asks about, no words in the picture, alt text and provenance.
   Only its consequence that a scene beside the title is a fixed square, never above the text,
   is replaced.

## Consequences

- On a phone the text starts below the picture. That cost is accepted: the picture is the
  point of the place.
- The validator requires the small rendition beside every listed scene, so a scene cannot be
  served at one size only. Sizes and ceilings are in
  [`docs/apps/tonwerk.md`](../apps/tonwerk.md#figuren-and-their-images).
- A scene whose picture contradicts or does not fit its episode's text stays unused, exactly
  like one that answers a question; the record's description says why.
- An intensive Lesetext, which is a task, still never gets a scene, and nothing else about
  where cast images appear changes.
