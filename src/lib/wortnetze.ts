import type { Wortnetz } from './schemas';

/** Build-time reference checks that need the vocabulary catalog and therefore
    cannot live inside the self-contained Zod schema. */
export function wortnetzCardRefProblems(
  network: Wortnetz,
  decks: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  const problems: string[] = [];
  for (const member of network.members) {
    if (member.kind !== 'card') continue;
    const headwords = decks.get(member.ref.deck);
    if (!headwords) {
      problems.push(`card member "${member.id}" references unknown deck "${member.ref.deck}"`);
    } else if (!headwords.has(member.ref.de)) {
      problems.push(
        `card member "${member.id}" references missing headword "${member.ref.de}" in deck "${member.ref.deck}"`,
      );
    }
  }
  return problems;
}
