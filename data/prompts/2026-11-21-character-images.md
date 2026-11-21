# Character images — one portrait per person, and scenes of the same person

Owner's brief, 2026-11-21. Vitaly Vorobyev asked for faces for the course's people, and found one
image per character "very boring": the cast should feel alive across a serial, so each person gets
a portrait and further images of the same person. Claude Code wrote the prompts below; Vitaly
generates the images in ChatGPT, one conversation for the whole set so the style holds, and saves
each as `assets/images/<id>/<id>.png` (the portrait) and `<id>-1.png`, `<id>-2.png`, … (the
scenes or variants, in the order listed here). `bun run characters:import` brings them into the
course; each imported file's record in `data/asset-provenance.yaml` names this file.

This replaces the contact-sheet brief `2026-08-03-listening-character-roster.md`: a 4-by-3 sheet
gives small faces, and its crops were never selected.

A character generated from a prompt other than the one below has that prompt saved here, under its
id, before its images are imported.

## Message 1 — style anchor (sent first)

> I am going to ask for fourteen portraits of fictional characters for a German language course, one
> per message. Keep exactly the same style in all of them: calm editorial illustration,
> ink line with gouache texture, restrained natural palette, warm off-white paper background, soft
> light from the upper left. Head and shoulders, facing slightly left of the viewer, the same scale
> and crop every time, square 1:1 image. Realistic proportions, slightly simplified. Friendly but
> not promotional. No text, letters, logos, flags, uniforms or brand marks anywhere. Each person is
> invented and must not resemble any real person or celebrity. Each must be easy to tell apart from
> the others by age, hair, clothing colour and silhouette. Confirm the style, then wait for the
> first character.

## The portraits (`<id>.png`)

Each message begins "Same style and crop as before. Portrait of …".

- `lena` — a woman of 24 from Poland, new in Bremen; warm, attentive, direct. Shoulder-length
  light-brown hair tied back loosely, a moss-green jacket over a plain top. A bicycle mechanic's
  practical look, open expression.
- `mira` — a woman of 30, lively, friendly, practical; a baker and football player. Short dark
  curly hair, athletic build, a mustard-yellow sweatshirt, broad easy smile.
- `timo` — a man in his late twenties, relaxed and thoughtful; a goalkeeper who works in a
  workshop. Tall, short sandy hair, light stubble, a dark-blue work jacket, calm half-smile.
- `frau-kern` — a woman of 70, an early riser who notices everything; sharp but kind. Short silver
  hair, round glasses, a burgundy cardigan with a small brooch, alert sideways look.
- `anna-keller` — a woman of about 40, calm, precise, approachable; an editorial and professional
  voice. Dark-blonde bob, a slate-grey blazer over a white shirt, composed expression.
- `so-yeon-park` — a woman of about 35 of Korean heritage, patient and encouraging; a teacher.
  Straight black hair to the shoulders, a soft teal cardigan, gentle attentive smile.
- `jonas` — a man of about 25, relaxed and reflective. Wavy dark-brown hair, a rust-orange
  overshirt, slightly tilted head, easy expression.
- `david` — a man of about 40 of West African heritage, grounded and pragmatic. Close-cropped hair,
  short beard, an olive button-down shirt, steady direct look.
- `emil-wagner` — a man of about 65, measured and assured without being stern. Thinning grey hair,
  clean-shaven, a charcoal jacket with a light-blue shirt, calm formal expression.
- `amir` — a man of about 26 of Middle Eastern heritage, curious and energetic. Thick black hair, a
  trimmed beard, a light denim jacket, bright interested look.
- `herr-wu` — a man of about 68 of Chinese heritage, patient with dry humour. Grey side-parted hair,
  thin-rimmed glasses, a beige knitted vest over a shirt, a faint amused smile.
- `klara` — a woman of about 45, focused and decisive. Auburn hair pinned up, a navy blouse, upright
  posture, clear direct gaze.
- `paul` — a man of about 38, open and reassuring. Light-brown hair, a soft grey jumper, warm
  relaxed smile.
- `noa` — an invented schoolchild of about ten, curious and self-possessed, drawn in the same
  illustrated style and not resembling any real child. Chin-length brown hair, a striped
  red-and-white T-shirt, inquisitive look.

## Further images of the same person (`<id>-1.png`, `<id>-2.png`, …)

Each is asked for in the same conversation, right after that person's portrait is accepted, and
begins:

> Same person as the portrait you just made — identical face, hair, age and build, same
> illustration style and palette. Now show them …

If the face drifts, the accepted portrait is attached to the message and the request repeated.

### The four serial characters: three scenes each

Wider frame, half-figure, the setting visible, no text anywhere.

- `lena` — `-1` behind a bakery counter before sunrise, apron on, trays of rolls, warm lamp light;
  `-2` in a small bicycle workshop, sleeves rolled up, adjusting the brake of a green bicycle with
  an old bell on the handlebar; `-3` in a Bremen back courtyard, standing in front of a new bicycle
  shelter with one empty stand, puzzled and worried.
- `mira` — `-1` in a football kit on a local pitch, ball under her arm, laughing; `-2` cycling
  along a city cycle path in the grey early morning, a bakery bag in the basket; `-3` at her summer
  birthday party in a courtyard, paper lanterns, holding a slice of cake.
- `timo` — `-1` in goalkeeper gloves in front of a goal net, relaxed; `-2` on a market square
  beside a tall medieval stone knight statue, pointing up at it as if explaining; `-3` at a kitchen
  table in the evening, leaning towards a laptop, concentrating.
- `frau-kern` — `-1` at her window at dawn with a cup of coffee, watching the courtyard; `-2`
  carrying a tray of coffee cups across the courtyard towards a building site; `-3` standing among
  neighbours in the courtyard, one hand raised, making a proposal.

The scenes were chosen to give away no answer, and the Krimi's resolution is deliberately not
drawn.

### The other roster voices: two variants each

Same square crop. `-1` for all: "…speaking mid-sentence, one hand slightly raised, engaged
expression." `-2` is the role setting, softly indicated behind them:

- `anna-keller` — at a desk with a microphone
- `so-yeon-park` — in front of a blank whiteboard, marker in hand
- `jonas` — at a café table with a bicycle helmet beside him
- `david` — at a service counter with a folder
- `emil-wagner` — at a lectern in a quiet office
- `amir` — on a railway platform with a backpack
- `herr-wu` — in a stairwell doorway holding a watering can
- `klara` — at a reception desk with a headset
- `paul` — in a doctor's waiting room, leaning forward kindly
- `noa` — at a school desk with coloured pencils
