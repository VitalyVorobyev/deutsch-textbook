# Approved brief — A2 Prüfung practice documents

Date: 2026-10-30
Directed by: Vitaly Vorobyev
Implementation assistance: Claude Code

## Job

Vitaly is preparing for the Goethe-Zertifikat A2 and has used up the official sets. He chose
original practice as course exercise sets (not simulator sets), three complete sets, Lesen,
Hören and Schreiben. The Lesen module needs one document per Teil, twelve in all:

| Teil | Exam task | Document |
| --- | --- | --- |
| 1 | short newspaper article, five a/b/c items | `article`: masthead, date, headline, subline, four paragraphs |
| 2 | directory board, five "where do you go?" items | `notice`: one row per floor, label beside the departments |
| 3 | e-mail, five a/b/c items | `letter`: Von, An, Betreff, then the body |
| 4 | six ads a–f, five situations, one without a match | `listing`: six lettered boxes in two columns |

The documents copy the exam's structure, never its texts (ADR 0009). Every text is original,
every town, firm and person in them is fictional or generic, and no publication, brand or logo
is reproduced; the mastheads are generic ("Nachrichten aus Celle").

## Text

- German at A2: every word is on the A1 or A2 Wortliste, a transparent compound of listed
  words, a name, or a label the exam itself prints on such boards (Standesamt, Untergeschoss).
  No item's key rests on a word outside those lists.
- Exam distractor logic: every wrong option of an item is named in its document and then
  corrected, postponed, refused or applied to someone else.

## Layout

Deterministic SVG, 920 px wide, height following the text, generated from one structured
spec so that every word and grouping stays controllable. Structure is carried by headings,
borders, letter badges and spacing, never by colour alone. Each document's YAML carries the
full German text as its `transcript` and an EN/RU/UK description. They are simulated teaching
documents; viewing one creates no learner evidence.
