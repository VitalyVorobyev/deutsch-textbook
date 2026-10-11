# Brief — LiD lesson diagram „Wer wählt wen?“

Date: 2026-10-11
Requested in: Vitaly Vorobyev's Claude Code session, relayed to a drafting subagent
Implementation: Claude Code (Anthropic), SVG written by hand as text
Human review: pending

## Semantic job

Show the section `## Wer wählt wen?` of `content/lid/lessons/verfassungsorgane.mdx` as one
procedure, so that the Bundespräsident's two roles read as the start and the end of choosing a
Chancellor, not as two duplicate rows. The learner had flagged the earlier table as reading like a
duplicate; the section was rewritten as six numbered steps in the same change.

## Content rule

Draw only relationships the section states, each checked against the Grundgesetz:

1. Volk → Bundestag: wählt (Art. 38)
2. Bundespräsident → Kanzler: schlägt vor (Art. 63 Abs. 1)
3. Bundestag → Kanzler: wählt (Art. 63 Abs. 1–2)
4. Bundespräsident → Kanzler: ernennt (Art. 63 Abs. 2)
5. Kanzler → Bundesminister: schlägt vor (Art. 64 Abs. 1)
6. Bundespräsident → Bundesminister: ernennt (Art. 64 Abs. 1)
- Bundesversammlung → Bundespräsident: wählt (Art. 54 Abs. 1), unnumbered — it is not a step of
  the procedure.

The Bundesrat and the Bundesverfassungsgericht are not part of this section and stay out.

## Form

Vertical flow readable at 375 px: a viewBox, plus root width and height equal to it so the figure has an intrinsic size, text at least ~13 px when the figure is ~325 px
wide, German labels, a verb on every arrow and a number badge for every step, so nothing depends
on colour. High contrast on a white ground, system sans-serif, no script, no external reference,
under 20 KB.
