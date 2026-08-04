# Lautschrift — the vocab `ipa` field

The transcription contract, lifted out of CLAUDE.md because it is needed only when editing a
vocab entry's `ipa`. Every rule below is enforced by `bun run validate` (`IPA_CHARS` in
`src/lib/schemas.ts`), so this file explains the checks rather than replacing them.

Duden-flavoured IPA of the **headword alone**, generated with `bun run gen:ipa` and then reviewed. Rendered under the word in the Wortschatz table and on the flashcard's back. The character set and these rules are enforced by `bun run validate` (`IPA_CHARS` in `src/lib/schemas.ts`).

| Rule | Yes | No |
| --- | --- | --- |
| Bare — the UI adds the brackets | `ˈapfl̩` | `[ˈapfl̩]`, `/ˈapfl̩/` |
| Headword only, no article | `ˈapfl̩` | `deːɐ̯ ˈapfl̩` |
| Primary stress always marked, incl. monosyllables | `ˈbʁoːt` | `bʁoːt` |
| Secondary stress in compounds and separable verbs, primary on the prefix/first stem | `ˈaʊ̯fˌʃteːən`, `ˈfʁyːˌʃtʏk` | `aʊ̯fˈʃteːən`, two `ˈ` |
| Uvular r; vocalized r is `ɐ̯` (incl. the ver-/er- prefixes) | `ʁ`, `ˈuːɐ̯`, `fɛɐ̯ˈʃteːən` | `r`, `ʀ` |
| ASCII g (U+0067) | `g` | `ɡ` (U+0261 — the Wiktionary copy-paste trap) |
| Affricates as sequences, no tie bars | `ts`, `pf`, `tʃ` | `t͡s`, `p͡f` |
| Diphthong offglides carry ̯ (U+032F) | `aɪ̯ aʊ̯ ɔʏ̯` | `aɪ aʊ ɔʏ` |
| Syllabic consonant after an obstruent — but not after a sonorant | `ˈmaxn̩`, `ˈapfl̩`, `telefoˈniːʁən` | `telefoˈniːʁn̩` |
| Glottal stop before a word-internal stressed vowel; omitted word-initially | `bəˈʔantvɔʁtn̩`, `ˈmɪtaːkˌʔɛsn̩` | `ˈʔapfl̩` |
