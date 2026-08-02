# Listening generation brief — ls-stadt-wege-01

## Exact prompt, as submitted

Return only JSON matching the supplied draft shape. Create natural German at the declared CEFR level, use only the supplied curriculum vocabulary/grammar, retain EN and RU feedback, and make every question answerable from sound and meaning rather than one keyword. Replace every editorial placeholder, including feedback and answer options. Use four to eight short dialogue turns for two or more speakers, or three to five short paragraphs for one speaker. Keep the total spoken length close to the requested duration. Preserve the requested three response kinds and all stable ids. Never add voice cloning, music, effects, or reference audio. Context sounds are selected separately by a human and must not be invented by the text model.
DRAFT SHAPE:
{
  "title": {
    "en": "Listening — stadt-wege",
    "ru": "Аудирование — stadt-wege",
    "uk": null
  },
  "brief": {
    "source_text": "",
    "level": "A1",
    "vocabulary": [
      "geradeaus",
      "links",
      "rechts",
      "Straße",
      "Bahnhof"
    ],
    "grammar_target": "Imperativische Wegangaben und bis/gegenüber",
    "focus": null,
    "scenario": "Nach dem Weg fragen und eine einfache Wegbeschreibung verstehen",
    "duration_seconds": 30,
    "speaker_count": 2,
    "topic": "stadt-wege",
    "outcomes": [
      "stadt-wegbeschreibung-verstehen"
    ]
  },
  "speakers": [
    "Sprecher 1",
    "Sprecher 2"
  ],
  "lines": [
    {
      "id": "line-1",
      "speaker": "Sprecher 1",
      "display_text": "Diesen redaktionellen Platzhalter vollständig ersetzen.",
      "synthesis_text": null,
      "voice": "Nicole",
      "pace": 1.0,
      "pause_after_ms": 350,
      "seed": 0,
      "pronunciation_overrides": []
    }
  ],
  "questions": [
    {
      "id": "q1",
      "instruction": {
        "en": "Listen and answer.",
        "ru": "Прослушайте и ответьте.",
        "uk": null
      },
      "response": {
        "kind": "single-choice",
        "prompt": "Was ist richtig?",
        "options": [
          "A",
          "B"
        ],
        "correct": 0
      },
      "explain": {
        "en": "Replace with explanatory feedback during editing.",
        "ru": "Во время редактирования замените это объясняющей обратной связью.",
        "uk": null
      },
      "translation": null,
      "focus": null
    },
    {
      "id": "q2",
      "instruction": {
        "en": "Listen and answer.",
        "ru": "Прослушайте и ответьте.",
        "uk": null
      },
      "response": {
        "kind": "ordering",
        "prompt": "Bringen Sie die Informationen in die richtige Reihenfolge.",
        "units": [
          "A",
          "B"
        ]
      },
      "explain": {
        "en": "Replace with explanatory feedback during editing.",
        "ru": "Во время редактирования замените это объясняющей обратной связью.",
        "uk": null
      },
      "translation": null,
      "focus": null
    },
    {
      "id": "q3",
      "instruction": {
        "en": "Listen and answer.",
        "ru": "Прослушайте и ответьте.",
        "uk": null
      },
      "response": {
        "kind": "true-false",
        "statement": "Die Aussage stimmt.",
        "correct": true
      },
      "explain": {
        "en": "Replace with explanatory feedback during editing.",
        "ru": "Во время редактирования замените это объясняющей обратной связью.",
        "uk": null
      },
      "translation": null,
      "focus": null
    }
  ],
  "tts_adapter": "parler_tts",
  "context_sounds": [],
  "max_replays": 3
}

The script below was revised editorially after generation; this prompt is the input that produced the draft, not a description of the final text.
