# Reference data

This folder holds the reference data that Minhajna ships with: each country's profile and its school calendars ([PRD §4.8](../docs/prd/PRD.md#48-getting-packs-and-calendars-to-the-app)). The app reads these files as untrusted, through the core's readers. A file that breaks the format is refused, with every problem listed ([PRD §5.9](../docs/prd/PRD.md#59-files-minhajna-reads-and-writes)).

The data lives here until curators join, then moves to its own data repository (choice F6 in [#49](https://github.com/djazairdev/minhajna/issues/49)). It is under [CC BY-SA 4.0](../LICENSES/CC-BY-SA-4.0.txt).

## Files

| File | What it holds |
|---|---|
| `dz/profile.json` | Algeria: the working week, the twelve month names, the three levels and their grades, the subjects each level teaches, the session types and the 69 wilayas |
| `dz/calendar-2026-2027.json` | Algeria's 2026/27 school year: its terms, the school holidays, the exam windows, the public holidays and Ramadan |

## Month names

Profile release `2026.2` adds `months`, ordered from January to December. Each of the twelve entries contains non-empty `ar`, `fr` and `en` strings. These are the same spellings previously held by the core formatter; moving them here changes no written date. The profile keeps `format: 1`: this is an additive field, and older readers can leave it out.

`parseCountryProfile` still accepts older format-1 profiles without `months`, but does not invent missing names. `formatDayWithMonth(day, language, profile)` requires the names for the requested month and language and reports an error if they are absent. It never substitutes a numeric date, a different language, or a platform-locale default. Callers must supply a profile with month data before producing a named date. The fixed numeric date helpers keep their existing formats.

## Wilayas

Profile release `2026.3` adds `zones`: Algeria's 69 wilayas, in the order of their codes, from `01` to `69`. A teacher picks their school's wilaya at setup, and it picks the calendar's zone layer: a zone entry in a calendar names one of these codes, or the calendar is refused. The wilaya never leaves the phone ([PRD §4.5](../docs/prd/PRD.md#45-the-calendar)).

- **Law 26-06 of 4 April 2026** (JORADP n° 25 of 5 April 2026) sets 69 wilayas and 1,541 communes.
- **The codes and names** come from three decrees:
  - Decree 84-79 of 3 April 1984 (JORADP n° 14) for `01` to `48`;
  - Decree 21-117 of 22 March 2021 (JORADP n° 22) for `49` to `58`;
  - Presidential decree 26-206 of 25 May 2026 (JORADP n° 40 of 3 June 2026) for `59` to `69`.
- **The spellings** are those of the recent Journal officiel issues (2019 to 2026), not the older typography of 1984. Code `11` is تامنغست in Arabic and Tamenghasset in French, as JORADP n° 25 of 2026 writes it; its English name is Tamanrasset. English names are the French ones without accents, except Algiers and Tamanrasset.
- **The eleven new wilayas,** `59` to `69`, are in transition until 31 December 2026 at the latest: their mother wilaya's services, its education directorate included, keep running them (Law 26-06, new Art. 54). A closure that covers a new wilaya is keyed with that wilaya's own code, even when the mother wilaya announces it.

## Sources

Every date names its source. Every date but Ramadan's cites an official text.

- **The pupils' first day,** Monday 21 September 2026: the statement of the Services of the Prime Minister of 8 August 2026.
- **The holidays, the exam windows and the teachers' last day,** Thursday 8 July 2027: the Ministry of National Education's [communiqué of 5 October 2026](https://www.education.gov.dz/?p=4519), under Decision 41 of 28 September 2026. The communiqué is posted as an image.
- **The public holidays:** Law 63-278 of 26 July 1963 on legal holidays, as amended. Each Eid is three days. The Mawlid falls in August in both 2026 and 2027, outside the school year.
- **Ramadan:** no text dates it yet. It is keyed from the Umm al-Qura calendar, like the lunar holidays, until the moon is sighted. It shows on its days and changes no session.
- **The subjects:** the timetables in force for 2026/27. For primary school, Decision 16 of 27 July 2026. For middle school, the 2025/26 timetable, back in force by correspondence 1469 of 17 September 2026. For secondary school, Decision 186 of 23 March 2006, as amended.

The texts do not date the terms, so each term runs from one school holiday to the next: 21 September to 17 December, 3 January to 18 March, and 4 April to 8 July.

## Confidence

Each entry carries one of three confidences ([PRD §4.5](../docs/prd/PRD.md#45-the-calendar)):

- **Announced:** an official text gives the date.
- **Expected:** a lunar date, give or take a day. It is keyed from the Umm al-Qura calendar and confirmed when the moon is sighted. In 2026/27: Ramadan, the two Eids, Awal Muharram and Ashura.
- **Projected:** an official text implies the date without giving it. In 2026/27: the term-1 and term-2 exams of 4AM and 3AS. The communiqué gives these two grades only their term-3 exams, so their other exams are keyed on the other grades' dates.

## Changing the data

- **A fix is a new release.** Raise `release` in the file that changes, for example from `2026.1` to `2026.2`, so that the app can tell the update apart ([PRD §4.10](../docs/prd/PRD.md#410-the-rest-of-the-reference-data)).
- **Cite the official text** in the entry's `source`, with a link when there is one. A press article or a forum post can point to a text, but is never the source. When the moon is sighted, the lunar entry becomes announced and cites the announcement.
- **Run the tests.** `npm test` reads both files, checks their sources and exam windows, and runs made-up classes through the whole year.

## Not here yet

- **The pupils' last day.** Their summer holiday starts after the term-3 exams, the make-up exams and their correction, which have no dates yet. Until then, the year runs to 8 July 2027, when teachers' annual leave starts.
- **Ramadan hours.** They come with the Ministry's Ramadan notice, as do the bell times ([#29](https://github.com/djazairdev/minhajna/issues/29)).
- **The BEM and the baccalaureate,** whose dates are not announced yet.
- **Wilaya and school entries,** such as weather closures. They come as calendar fixes, keyed with the wilaya codes above, or the teacher adds them ([PRD §4.5](../docs/prd/PRD.md#45-the-calendar)).
- **Subjects by grade and by stream.** The profile lists the subjects each level teaches, and the teacher picks theirs at setup.
- **Signed releases,** before the pilot (R-4.8-04, R-5.9-10).
