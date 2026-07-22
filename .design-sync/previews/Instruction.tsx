import { Instruction } from 'deutsch-atlas';

// The task instruction shown above an item. It renders nothing when `text` is
// absent, which is why most items simply omit it.

const fillTheGap = {
  en: 'Fill the gap with the correct auxiliary (haben or sein).',
  ru: 'Вставьте правильный вспомогательный глагол (haben или sein).',
  uk: 'Вставте правильне допоміжне дієслово (haben або sein).',
};

/** Under the English explanation language. */
export function English() {
  return (
    <div className="max-w-xl">
      <Instruction text={fillTheGap} lang="en" />
    </div>
  );
}

/** The same instruction under Russian. */
export function Russian() {
  return (
    <div className="max-w-xl">
      <Instruction text={fillTheGap} lang="ru" />
    </div>
  );
}

/** A longer instruction, which is where the line wraps. */
export function Longer() {
  return (
    <div className="max-w-xl">
      <Instruction
        text={{
          en: 'Arrange the words into a correct sentence. Start with the capitalized word and put the participle at the end.',
          ru: 'Составьте правильное предложение. Начните со слова с заглавной буквы и поставьте причастие в конец.',
        }}
        lang="en"
      />
    </div>
  );
}

/** Above the item it belongs to — how it is actually composed. */
export function AboveAPrompt() {
  return (
    <div className="max-w-xl">
      <Instruction text={fillTheGap} lang="en" />
      <p lang="de" className="mb-4 text-lg font-medium">
        Wir ___ am Sonntag nach Berlin gefahren.
      </p>
    </div>
  );
}
