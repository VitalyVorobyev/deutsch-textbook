import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { Extern, Quelllink } from '../apps/redaktion/src/components/Zeilentabelle';

afterEach(cleanup);

describe('Redaction link semantics', () => {
  test('a checkout source stays in the app while real provenance opens externally', () => {
    render(
      <>
        <Quelllink href="#/quelle?pfad=content%2Ftopics%2Fa1%2Ferste-schritte.mdx">Artikel öffnen</Quelllink>
        <Extern href="https://example.test/source">Quelle</Extern>
      </>,
    );

    expect(screen.getByRole('link', { name: 'Artikel öffnen' }).getAttribute('target')).toBeNull();
    expect(screen.getByRole('link', { name: 'Quelle' }).getAttribute('target')).toBe('_blank');
  });
});
