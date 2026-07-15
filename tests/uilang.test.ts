import { beforeEach, describe, expect, test } from 'bun:test';

import {
  LANG_KEY,
  langKeyFor,
  uiLangKeyFor,
  resolveExplainLang,
  resolveUiLang,
  setExplainLang,
  setUiLang,
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

describe('per-profile UI language', () => {
  test('defaults to de with nothing stored', () => {
    expect(resolveUiLang('vitaly')).toBe('de');
    expect(getUiLang()).toBe('de');
  });

  test('setUiLang stamps the root attribute and persists under the active profile only', () => {
    registerActiveProfile('anna');
    setUiLang('uk');
    expect(document.documentElement.dataset.uiLang).toBe('uk');
    expect(getUiLang()).toBe('uk');
    expect(localStorage.getItem(uiLangKeyFor('anna'))).toBe('uk');
    expect(resolveUiLang('boris')).toBe('de');
  });

  test('garbage in storage resolves to de', () => {
    localStorage.setItem(uiLangKeyFor('vitaly'), 'xx');
    expect(resolveUiLang('vitaly')).toBe('de');
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
});
