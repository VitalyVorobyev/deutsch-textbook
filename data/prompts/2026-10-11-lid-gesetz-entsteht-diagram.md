# Brief — LiD lesson diagram „Wie ein Gesetz entsteht“

Date: 2026-10-11
Requested in: Vitaly Vorobyev's Claude Code session, relayed to a drafting subagent
Implementation: Claude Code (Anthropic), SVG written by hand as text
Human review: pending

## Semantic job

Show the five numbered steps of the section `## Wie ein Gesetz entsteht` in
`content/lid/lessons/verfassungsorgane.mdx` as a path from top to bottom. The brief made the
figure conditional on the section stating the steps clearly; its table does.

## Content rule

Only what the section's table says, checked against the Grundgesetz:

1. Bundesregierung, Bundestag oder Bundesrat: bringt einen Gesetzentwurf ein (Art. 76 Abs. 1)
2. Bundestag: berät und beschließt das Gesetz (Art. 77 Abs. 1)
3. Bundesrat: stimmt zu oder kann Einspruch einlegen (Art. 77 Abs. 2–4)
4. Bundespräsident: prüft und unterschreibt das Gesetz (Art. 82 Abs. 1)
5. Bundesgesetzblatt: das Gesetz wird veröffentlicht und gilt (Art. 82)

No Vermittlungsausschuss, Gegenzeichnung or date of entry into force: the section does not
teach them.

## Form

Vertical flow readable at 375 px: a viewBox, plus root width and height equal to it so the figure has an intrinsic size, text at least ~13 px when the figure is ~325 px
wide, German labels, the actor in each box and the verb on the arrow below it, a number badge per
step. High contrast on a white ground, system sans-serif, no script, no external reference, under
20 KB.
