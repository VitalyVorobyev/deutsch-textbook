import { beforeEach, describe, expect, test } from 'bun:test';

import {
  LANG_KEY,
  langKeyFor,
  resolveExplainLang,
  resolveUiLang,
  setExplainLang,
  getUiLang,
} from '../src/lib/prefs';
import { PROFILE_KEY, PROFILES_KEY } from '../src/lib/profile';
import { STRINGS, UI_LANGS, t, type StringKey } from '../src/lib/strings';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.explainLang;
  delete document.documentElement.dataset.uiLang;
});

function registerActiveProfile(id: string) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify([{ id, label: id }]));
  localStorage.setItem(PROFILE_KEY, id);
}

describe('per-profile explanation language (copy-forward migration)', () => {
  test('first read copies the legacy device key forward and leaves it in place', () => {
    localStorage.setItem(LANG_KEY, 'ru');
    expect(resolveExplainLang('vitaly')).toBe('ru');
    expect(localStorage.getItem(langKeyFor('vitaly'))).toBe('ru');
    expect(localStorage.getItem(LANG_KEY)).toBe('ru');
  });

  test('a later choice writes only the profile key, so a second profile still inherits the device default', () => {
    localStorage.setItem(LANG_KEY, 'ru');
    registerActiveProfile('anna');
    resolveExplainLang('anna');
    setExplainLang('en');
    expect(localStorage.getItem(langKeyFor('anna'))).toBe('en');
    expect(localStorage.getItem(LANG_KEY)).toBe('ru');
    expect(resolveExplainLang('boris')).toBe('ru');
  });

  test('no stored preference anywhere resolves to null (the SSR default stands)', () => {
    expect(resolveExplainLang('vitaly')).toBeNull();
    expect(localStorage.getItem(langKeyFor('vitaly'))).toBeNull();
  });
});

describe('chrome language pinned to German', () => {
  test('resolves to de with nothing stored', () => {
    expect(resolveUiLang('vitaly')).toBe('de');
    expect(getUiLang()).toBe('de');
  });

  test('a legacy stored ui-language choice is ignored — the pin wins', () => {
    // The retired per-profile key may survive in learners' localStorage.
    localStorage.setItem('da:uilang:vitaly', 'uk');
    expect(resolveUiLang('vitaly')).toBe('de');
    expect(getUiLang()).toBe('de');
  });
});

describe('chrome strings table', () => {
  test('every entry carries a non-empty string for all four languages', () => {
    for (const key of Object.keys(STRINGS) as StringKey[]) {
      for (const l of UI_LANGS) expect(t(key, l).length).toBeGreaterThan(0);
    }
  });

  test('the de column is the chrome the site ships today', () => {
    expect(t('nav.heute', 'de')).toBe('Heute');
    expect(t('nav.ueben', 'de')).toBe('Üben');
  });

  test('the de column of the lesson-runtime chrome is byte-exact with the strings it replaced', () => {
    // Grade buttons (FlashcardSession).
    expect(t('grade.again', 'de')).toBe('Nochmal');
    expect(t('grade.hard', 'de')).toBe('Schwer');
    expect(t('grade.good', 'de')).toBe('Gut');
    expect(t('grade.easy', 'de')).toBe('Leicht');
    // Verdict chip (shared.tsx).
    expect(t('verdict.correct', 'de')).toBe('Richtig! ✓');
    expect(t('verdict.wrong', 'de')).toBe('Leider falsch ✗');
    expect(t('verdict.why', 'de')).toBe('Warum?');
    // Action buttons.
    expect(t('action.check', 'de')).toBe('Prüfen');
    expect(t('action.next', 'de')).toBe('Weiter →');
    expect(t('action.done', 'de')).toBe('Fertig');
    expect(t('action.doneArrow', 'de')).toBe('Fertig →');
    expect(t('action.again', 'de')).toBe('Nochmal');
    expect(t('action.skip', 'de')).toBe('Überspringen →');
    expect(t('action.play', 'de')).toBe('▶ Anhören');
    expect(t('action.playSlow', 'de')).toBe('🐢 Langsam');
    expect(t('action.cancel', 'de')).toBe('Abbrechen');
    // Session flow.
    expect(t('session.stepProbes', 'de')).toBe('Rückblick');
    expect(t('session.stepReview', 'de')).toBe('Wiederholen');
    expect(t('session.stepTraining', 'de')).toBe('Training');
    expect(t('session.stepLearn', 'de')).toBe('Weiter lernen');
    expect(t('session.doneToday', 'de')).toBe('Heute schon erledigt');
    expect(t('session.repeat', 'de')).toBe('Nochmal üben');
    expect(t('session.toHome', 'de')).toBe('Zur Startseite');
    expect(t('session.noCardsDue', 'de')).toBe('Keine Karten fällig — weiter zum Training …');
    expect(t('session.oneCardDue', 'de')).toBe('Noch 1 Karte fällig — weiter wiederholen');
    expect(t('session.moreCardsDue', 'de')).toBe('Noch {n} Karten fällig — weiter wiederholen');
    expect(t('session.noProbesDue', 'de')).toBe('Keine Rückfragen fällig — weiter …');
    expect(t('session.probesDone', 'de')).toBe('Rückblick abgeschlossen');
    // Training empty states.
    expect(t('training.emptyNext', 'de')).toBe('Noch keine Übungen — weiter zum nächsten Schritt …');
    expect(t('training.emptyTitle', 'de')).toBe('Noch nichts zu üben');
    // Reading section headers.
    expect(t('reading.questions', 'de')).toBe('Fragen zum Text');
    expect(t('reading.gist', 'de')).toBe('Worum geht es?');
    // Flashcard furniture.
    expect(t('flashcards.input', 'de')).toBe('Eingabe:');
    expect(t('flashcards.modeTyped', 'de')).toBe('Tippen');
    expect(t('flashcards.modeReveal', 'de')).toBe('Aufdecken');
    expect(t('flashcards.modeListen', 'de')).toBe('Hören');
    expect(t('flashcards.ttsUnavailable', 'de')).toBe('Audio ist auf diesem Gerät nicht verfügbar');
    expect(t('flashcards.dirListen', 'de')).toBe('🔊 Hören → Schreiben');
    expect(t('flashcards.dirFromDe', 'de')).toBe('Deutsch →');
    expect(t('flashcards.dirToDe', 'de')).toBe('→ Deutsch');
    expect(t('flashcards.typePlaceholder', 'de')).toBe('Auf Deutsch …');
    expect(t('flashcards.typedCorrect', 'de')).toBe('✓ Richtig!');
    expect(t('flashcards.typedWrong', 'de')).toBe('✗ Falsch');
    expect(t('flashcards.yourInput', 'de')).toBe('Deine Eingabe:');
    expect(t('flashcards.due', 'de')).toBe('{n} fällig');
    expect(t('flashcards.new', 'de')).toBe('{n} neu');
    // Exercise widgets, document stimulus, Schreib-Assistent.
    expect(t('exercise.specialChars', 'de')).toBe('Sonderzeichen');
    expect(t('exercise.words', 'de')).toBe('Wörter');
    expect(t('document.everyday', 'de')).toBe('Alltagsdokument');
    expect(t('assist.reenable', 'de')).toBe('Assistent ist aus — einschalten');
    expect(t('assist.request', 'de')).toBe('Hinweise vom lokalen Assistenten');
    expect(t('assist.allDone', 'de')).toBe('Alle Hinweise erledigt.');
    expect(t('assist.disclaimer', 'de')).toBe('Hinweise sind Vorschläge — keine Bewertung.');
  });

  test('the de column of the Themen/Heute/Fortschritt chrome is byte-exact with the strings it replaced', () => {
    // Themen tabs (CurriculumPath).
    expect(t('topics.tabPath', 'de')).toBe('Lernpfad');
    expect(t('topics.tabAtlas', 'de')).toBe('Atlas');
    expect(t('topics.tabOverview', 'de')).toBe('Alle Themen');
    // Filters.
    expect(t('filter.all', 'de')).toBe('Alle');
    expect(t('filter.level', 'de')).toBe('Niveau');
    expect(t('filter.strand', 'de')).toBe('Strang');
    expect(t('filter.status', 'de')).toBe('Status');
    // Strand names.
    expect(t('strand.foundations', 'de')).toBe('Grundlagen');
    expect(t('strand.grammar', 'de')).toBe('Grammatik');
    expect(t('strand.communication', 'de')).toBe('Kommunikation');
    expect(t('strand.vocabulary', 'de')).toBe('Wortschatz');
    // Tier/status labels (OverviewTable status filter).
    expect(t('topics.statusOpen', 'de')).toBe('Offen');
    expect(t('topics.statusNew', 'de')).toBe('Neu');
    expect(t('topics.statusRead', 'de')).toBe('Gelesen');
    expect(t('topics.statusPracticed', 'de')).toBe('Geübt');
    expect(t('topics.statusMastered', 'de')).toBe('Gemeistert');
    // Per-tier action labels (was actionLabel in course.ts).
    expect(t('topics.actionStart', 'de')).toBe('Starten');
    expect(t('topics.actionContinue', 'de')).toBe('Fortsetzen');
    expect(t('topics.actionPractice', 'de')).toBe('Weiter üben');
    expect(t('topics.actionReview', 'de')).toBe('Wiederholen');
    // Lernpfad furniture and count templates.
    expect(t('topics.nextStep', 'de')).toBe('Nächster Schritt');
    expect(t('topics.goal', 'de')).toBe('Ziel');
    expect(t('topics.current', 'de')).toBe('aktuell');
    expect(t('topics.masteredOf', 'de')).toBe('{done}/{total} gemeistert');
    expect(t('topics.masteredCount', 'de')).toBe('{n} gemeistert');
    expect(t('topics.countAll', 'de')).toBe('{n} Themen');
    expect(t('topics.countFiltered', 'de')).toBe('{shown} von {total} Themen');
    expect(t('topics.search', 'de')).toBe('Thema suchen');
    // Card labels (checkpoint card, probe backlog, first steps).
    expect(t('checkpoint.start', 'de')).toBe('Checkpoint starten →');
    expect(t('probe.backlogTitle', 'de')).toBe('Probe-Rückstand');
    expect(t('today.howItWorks', 'de')).toBe("So funktioniert's");
    expect(t('today.stepRead', 'de')).toBe('Lesen');
    expect(t('today.stepPractice', 'de')).toBe('Üben');
    expect(t('today.stepReview', 'de')).toBe('Wiederholen');
    // Vocabulary mastery furniture.
    expect(t('vocab.byArea', 'de')).toBe('Wortschatz nach Bereichen');
    expect(t('vocab.dueChip', 'de')).toBe('fällig');
    expect(t('vocab.deckSummary', 'de')).toBe('{due} Wörter fällig · {strong} sicher');
    expect(t('vocab.cardStats', 'de')).toBe('{reps} Wiederholungen · Intervall {days} T. · {lapses} Fehler');
    // Mastery gate.
    expect(t('mastery.missingHeader', 'de')).toBe('Für „Gemeistert“ fehlt noch:');
    expect(t('mastery.reqDays', 'de')).toBe('an 2 Tagen geübt');
  });
});
