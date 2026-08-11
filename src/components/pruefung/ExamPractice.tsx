/**
 * A practice-only module (Sprechen): the real task cards to study and speak against, plus the
 * examiner pages behind a disclosure — and deliberately nothing else. The real Teil is a
 * Gruppenprüfung with two examiners; a solo app cannot grade it, so it does not pretend to:
 * no clock, no answer sheet, no run record, no history. Opening this obligates the learner to
 * nothing (viewing is never evidence).
 */
import type { ExamModuleSpec, ExamSetSpec } from '../../lib/exam-sim';
import { withBase } from '../../lib/url';
import { CARD, MODULE_LABEL, QUIET_BUTTON } from './shared';
import { AnswerPages } from './review';

interface Props {
  set: ExamSetSpec;
  module: ExamModuleSpec;
  onBack: () => void;
}

export default function ExamPractice({ set, module, onBack }: Props) {
  return (
    <section lang="de" className="space-y-4">
      <div className={`${CARD} p-4`}>
        <p className="font-semibold">{set.title}</p>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {MODULE_LABEL[module.module]} · ca. {module.timeLimitMin} Min. in der echten Prüfung
        </p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          Die echte Prüfung ist eine Gruppenprüfung mit zwei Prüfenden — hier sind die
          Aufgabenkarten zum Üben: laut sprechen, buchstabieren, Fragen stellen und beantworten.
          Ohne Bewertung und ohne Verlauf.
        </p>
      </div>

      <div className="space-y-3">
        {module.pages.map((page, index) => (
          <img
            key={page}
            src={withBase(page)}
            loading="lazy"
            alt={`Aufgabenblatt Seite ${index + 1}`}
            className="max-w-full rounded-md border border-stone-200 dark:border-stone-700"
          />
        ))}
      </div>

      <div className={`${CARD} p-4`}>
        <AnswerPages module={module} />
        <button type="button" onClick={onBack} className={`mt-4 ${QUIET_BUTTON}`}>
          Zurück
        </button>
      </div>
    </section>
  );
}
