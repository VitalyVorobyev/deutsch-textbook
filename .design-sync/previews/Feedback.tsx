import { Feedback } from 'deutsch-atlas';

// The Richtig/Falsch verdict itself lives in ActionRow, not here — which is why
// a correct answer with nothing left to say renders nothing at all. This is the
// teaching half: the solution and the explanation.

/** A wrong answer: the correct German, with the explanation below it. */
export function WrongAnswer() {
  return (
    <div className="max-w-xl">
      <Feedback
        correct={false}
        correctAnswer="bin"
        speakText="Ich bin gestern nach Hause gegangen."
        explain={{
          en: "gehen describes movement from A to B, so it forms the Perfekt with sein: ich bin gegangen. 'habe' is the classic learner mistake — English 'I have gone' pulls you toward haben.",
          ru: "gehen обозначает движение из точки А в точку Б, поэтому перфект образуется с sein: ich bin gegangen. 'habe' — типичная ошибка русскоязычных.",
        }}
        lang="en"
      />
    </div>
  );
}

/** The same feedback under the Russian explanation language. */
export function RussianExplanationLanguage() {
  return (
    <div className="max-w-xl">
      <Feedback
        correct={false}
        correctAnswer="bin"
        speakText="Ich bin gestern nach Hause gegangen."
        explain={{
          en: 'gehen describes movement from A to B, so it forms the Perfekt with sein.',
          ru: 'gehen обозначает движение из точки А в точку Б, поэтому перфект образуется с sein: ich bin gegangen.',
        }}
        lang="ru"
      />
    </div>
  );
}

/**
 * A correct answer that still has something worth saying — the `note` slot
 * renders whether or not the answer counted.
 */
export function CorrectWithANote() {
  return (
    <div className="max-w-xl">
      <Feedback
        correct
        note="Achte auf die Großschreibung: Brot, nicht brot."
        lang="en"
      />
    </div>
  );
}

/** Other authored, equally correct renderings, shown after submission. */
export function WithAlternatives() {
  return (
    <div className="max-w-xl">
      <Feedback
        correct
        alternatives={[
          'Ich habe gestern ein Brot gekauft.',
          'Gestern habe ich ein Brot gekauft.',
        ]}
        lang="en"
      />
    </div>
  );
}

/**
 * A minimal correction, using `correctAnswerLabel` to reword the heading.
 * The label is concatenated directly onto the answer, so it must carry its own
 * separator — "Partizip II" alone renders "Partizip IIgegangen".
 */
export function CustomAnswerLabel() {
  return (
    <div className="max-w-xl">
      <Feedback
        correct={false}
        correctAnswer="gegangen"
        correctAnswerLabel="Partizip II: "
        explain={{
          en: 'gehen is a strong verb: ge-…-en with a vowel change.',
          ru: 'gehen — сильный глагол: ge-…-en со сменой гласной.',
        }}
        lang="en"
      />
    </div>
  );
}
