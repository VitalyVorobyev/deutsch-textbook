# Participant giving — semantic-flow redesign

Human-approved visual brief, 2026-07-28:

- Replace the unexplained filled circle, outlined circle and parallelogram glyphs in the
  `ParticipantRoleFigure` giving view.
- Preserve the semantic job: show a giver transferring one key to a recipient while identifying
  Nina as the Nominativ subject, `dem Nachbarn` as the Dativ recipient and `den Schlüssel` as the
  Akkusativ object.
- Use a continuous semantic flow with matching person/avatar tokens, one recognizable key attached
  to the transfer path and explicit `Wer?`, `Wem?` and `Was?` labels.
- Keep Dativ blue and Akkusativ orange, but make every relationship understandable without colour.
- Build the visual as deterministic, human-controllable HTML, CSS and inline SVG. Do not generate
  or add raster artwork.
- Keep the existing German caption and complete EN/RU/UK text equivalent. Design horizontal-first
  for wide screens and stack the same relationship vertically from 320 px upward.

Vitaly Vorobyev selected the semantic-flow direction over a mini scene and a sentence-only diagram.
OpenAI Codex may implement the approved composition without inventing additional visual semantics.
