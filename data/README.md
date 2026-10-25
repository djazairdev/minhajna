# Reference data

This folder holds the reference data that Minhajna ships with: each country's profile, its school calendars, its bell times and its plan packs ([PRD §4.8](../docs/prd/PRD.md#48-getting-packs-and-calendars-to-the-app)). The app reads these files as untrusted, through the core's readers. A file that breaks the format is refused, with every problem listed ([PRD §5.9](../docs/prd/PRD.md#59-files-minhajna-reads-and-writes)).

The data lives here until curators join, then moves to its own data repository (choice F6 in [#49](https://github.com/djazairdev/minhajna/issues/49)). It is under [CC BY-SA 4.0](../LICENSES/CC-BY-SA-4.0.txt).

## Files

| File | What it holds |
|---|---|
| `dz/profile.json` | Algeria: the working week, the twelve month names, the three levels and their grades, the subjects each level teaches, the session types and the 69 wilayas |
| `dz/calendar-2026-2027.json` | Algeria's 2026/27 school year: its terms, the school holidays, the exam windows, the public holidays and Ramadan |
| `dz/bells.json` | Algeria's bell-time templates, by level and shift, and the length of a session in Ramadan |
| `dz/assessment.json` | Each level's continuous-assessment presets: their components, points and ranges, the formulas its averages follow, and the terms whose marks descriptive observations replace |
| `dz/appreciations.json` | The appreciation phrases a teacher chooses from, by band of the term average and conduct, with the banned phrases: Minhajna's interim list while the official one is not found |
| `dz/keys.json` | The public keys signed updates are checked with ([#223](https://github.com/djazairdev/minhajna/issues/223)): for each, its ID, who holds it, its public half (SubjectPublicKeyInfo, DER, base64), the SHA-256 fingerprint of that public half, and `signs`, what it may sign: `calendar`, `packs` or both. Empty until the first key is made, with the [signing tools](../docs/checks/signed-updates.md) |
| `dz/packs/` | Plan packs, one file for each pack release, named `<id>@<release>.json`. For now only made-up examples |
| `hijri-umalqura.json` | The Hijri months from Rajab 1447 to Dhu al-Hijjah 1453 (December 2025 to March 2032): each month's first day, and the twelve names in Arabic, French and English |

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

## Teaching languages

Profile release `2026.4` adds `language`, the language subjects are taught in, `ar`, and gives French, English, German, Spanish and Italian their own: `fr`, `en`, `de`, `es` and `it`. Each subject's pages in the texts book come out in its language, under the book's Arabic heads ([PRD §3.8](../docs/prd/PRD.md#38-the-documents), R-3.1-18). Until the app speaks German, Spanish and Italian, their pages keep the book's words and direction, with the teacher's own text running left to right. Tamazight keeps the profile's language for now: the script its pages are written in varies, and the field check will tell. Older profiles without `language` still open.

## Specialists' subjects

Profile release `2026.5` adds `specialist`, the levels where a specialist teaches a subject and keeps their own journal. French, English and Tamazight have `["primary"]`: in primary school they are taught by specialists, so the class teacher's journal leaves them out, and the specialist keeps a journal of their own, in the subject's language where it has one; Tamazight's keeps the profile's for now, as under Teaching languages ([PRD §3.8](../docs/prd/PRD.md#38-the-documents), R-3.8-11). The levels must be among the subject's own. Older profiles without `specialist` still open, with every subject the class teacher's.

## Bell times

A timetable names slots, never clock times. Each slot's time comes from `dz/bells.json` ([PRD §4.6](../docs/prd/PRD.md#46-how-sessions-are-generated)):

- **Templates,** one for each level and shift. Each lists a half-day's slots in order, each as `["08:00", "09:00"]`. A slot ends after it starts, and the next starts no earlier. A double shift uses its own template when the level has one; otherwise each half-day keeps its times.
- **Middle and secondary schools** run 08:00 to 13:00 and 13:00 to 17:00 in one-hour sessions, a fifth morning slot included. No published text gives these hours, so their `source` says so. Each school sets its own bell, and the teacher matches it slot by slot, on the phone.
- **Primary school** has no template yet. Its periods are not one-hour slots, and they come with the primary timetable.
- **Ramadan's length.** In Ramadan, each session keeps its place and its start time and lasts `minutes`. It still counts as one session. The 45 minutes of middle and secondary schools follow the Ministry's [communiqué of 16 February 2026](https://www.education.gov.dz/wp-content/uploads/2026/02/COM-16.02.2026.jpg), which cut the one-hour session by fifteen minutes. They are `projected` until the year's own notice, which may also give new start times. A signed calendar update brings the notice's lengths in the Ramadan entry's `hours`, with their own confidence, and they then replace these. Primary schools have no Ramadan length yet, so their sessions keep their usual times until one is announced (answer 320).
- **Ramadan's days** come from the calendar. Calendar release `2026.2` gives the Ramadan entry `"times": "ramadan"`, so its days take Ramadan's times. The timetable never changes. Ramadan ends on the eve of Eid al-Fitr as the calendar has it, expected or confirmed (answer 330).

## Continuous assessment

Each level's continuous-assessment presets come from `dz/assessment.json` ([PRD §3.5](../docs/prd/PRD.md#35-continuous-assessment-marks-and-averages), answers 430, 437 and 438). A preset may name the subjects it is for (`subjects`); a level has one preset at most for every other subject, and a class takes the preset naming its subject:

- **Components:** each with its name in Arabic, French and English, how its marks are gathered (`capture`), its points, and the range a teacher may set it in. The points add up to the level's scale, 20, or 10 in primary. One component at most comes from the roll-call book.
- **The points and ranges are the curators'.** No text sets points per component, so every preset's `source` says the figures are not official. The teacher sets their own within the ranges, and adds columns of their own.
- **One circular a year sets the rules for every level.** Until the 2026/27 one is out, every preset keeps 2025/26's, circular 270 of 11 November 2025 (`circular`, `rulesYear`):
  - Middle school: 270 names discipline and attendance, oral and written quizzes, homework and research projects; participation and the notebook are captured in the session (PRD §3.5).
  - Lycée: 270 lists no lycée components, so the lycée takes middle school's until a list is found.
  - Primary: continuous assessment covers languages and mathematics, month by month. 270 left its averaging unchanged, so their components are circular 272's list of 2023/24, the latest that names them.
  - Primary music, visual arts and physical education: 270 assesses them by continuous assessment and observation alone, so they have a preset of their own: participation, practical work, and expressive or motor ability. Primary's other subjects have no continuous assessment and no preset.
- **Formulas:** each level's averages as whole-number weights of their parts (T, F, E, and P and O in the lycée), such as middle school's ((T + F)/2 + 2E)/3 as T 1, F 1, E 4, listed apart from the presets under `formulas`, each with its `level`. A formula may name the subjects it is for, and a level has one formula at most for every other subject. Primary's music, visual arts and physical education have no term exam and no formula yet. The lycée's formulas with practical work or an oral are marked `alternative`: the administration chooses one for a subject in place of the level's, and the teacher records it (answer 463).
- **Observations:** `observations` names the grades, terms and subjects whose marks descriptive observations replace, each with its `source`: 1AP term 1 for every subject, 3AP French and English term 1, and 4AP Tamazight term 1, as the press reported circular 270. The scale, «مكتسب», «في طور الاكتساب» and «غير مكتسب», is the app's (answer 464).

## Appreciations

`dz/appreciations.json` holds the phrases a teacher chooses each pupil's term appreciation from ([PRD §3.6](../docs/prd/PRD.md#36-appreciations), answer 465):

- **Interim.** Circular 244's list of phrases is not found, so the project's editors publish this list, marked `interim`, versioned by its `release`, with its `source`. It is not official.
- **Bands:** the term average out of 20, from 0 to 20 with no gap or overlap; primary's average out of 10 is doubled. Each band has at least one phrase for any conduct.
- **Phrases:** each with its band, its text in Arabic and, for some, `good` or `concern` conduct. `restates` marks a phrase that only restates the mark, which the app warns about.
- **Banned:** phrases no appreciation may contain. A list whose phrases contain one is refused.
- **Concern:** the counts in a term, unjustified absences, lateness and behaviour taps, from which conduct is a concern.

## Hijri months

The roll-call book prints, beside each month, the Hijri months it spans, such as «ربيع الأول – ربيع الثاني 1448» for September 2026 (R-3.4-25). `hijri-umalqura.json` holds them, so nothing is computed on the phone:

- **The months** come from the Umm al-Qura calendar, as ICU 78 computes it (`islamic-umalqura`). They agree with the lunar entries of the 2026/27 calendar: Ramadan 1448 starts on 8 February 2027 and Shawwal on 9 March.
- **Algeria fixes each month by sighting the moon,** so a month may start a day earlier or later. The months a Gregorian month is said to span rarely change with it.
- **The names** follow Algerian usage: «جمادى الثانية» in Arabic, and the Journal officiel's style of spelling in French, such as «Rabie El Aouel» and «Dhou El Hidja».
- **A reader checks** that the months follow one another, each 29 or 30 days long, with the twelve names in the three languages. Beyond the table, nothing is printed rather than guessed: the last day it names a month for is 12 March 2032. A release before then extends it.

## Plan packs

A plan pack holds one plan as data, for one level, grade, subject, stream and edition. Its ID reads `dz.<level>.<grade>.<subject>[.<stream>].<edition>` ([PRD §4.2](../docs/prd/PRD.md#42-plan-packs)). A class pins one release and stays on it until the teacher moves it.

- **The real packs** for the field check are keyed in [#23](https://github.com/djazairdev/minhajna/issues/23). They stay private, and ship only in field-check builds, until counsel answers on the plans' copyright.
- **Until then,** `dz/packs/` holds three made-up examples, so a class can be set up and tried: 1AM maths (budgets in hours), 4AM Arabic (budgets in sessions) and 5AP Arabic (weeks, with a weekly model of reading and writing). The 4AM Arabic example also has a made-up fix, release 2026.2, with a page change, a renamed item and a split one, so a class can be moved to it. Their status is `example`, their titles say «مثال», and their issuer says they are not a plan. They copy no official plan.
- **A week pack may carry its weekly model** in `activities`: each activity type with its code, its name in Arabic, French and English, and its sessions a week, in the order of the week. Its items name their activity by code, and a code outside the model is refused.
- **A new release says how its item IDs came from an earlier one** in `migration`: `from`, that earlier release, and `entries`, each one of
  - `{"kind": "rename", "from": "a", "to": "b"}`: the same item under a new ID;
  - `{"kind": "split", "from": "a", "to": ["b", "c"]}`: one item become two or more, in order;
  - `{"kind": "merge", "from": ["a", "b"], "to": "c"}`: two or more become one;
  - `{"kind": "remove", "item": "a"}`: an item the release no longer has.

  `from` must be an earlier release. A page or title change that keeps its ID needs no entry. An ID is never used again for another item, so the reader refuses an old ID the release still has, a new ID it lacks, an ID in two entries, and an entry that mixes units, TD items and the main queue's items. A release without `migration` must keep every ID of the release before it. Moving a class follows the entries from its release to the new one through every release between them, one release at a time, and checks each against the release it starts from: every earlier item is still there or in an entry, every old ID was an earlier item, no new ID was one, an entry keeps its items' kind, and no ID removed earlier in the chain comes back. When a release in between is not on the phone, or a check fails, the class is not offered the move. Nothing recorded is rewritten ([#322](https://github.com/djazairdev/minhajna/issues/322), `packages/core/src/pack-migration.ts`).
- **A test checks** that every file reads, is named by its ID and release, is an example, and names a grade and subject the profile has, and that each pack's releases chain through their migration entries.

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

Calendar release `2026.4` adds `lunar: true` to Ramadan as well, so the teacher can confirm its first day on the sighting, as for the Eids (answer 319); its session lengths stay those of the bell data until an update announces them with the entry's `hours` (answer 318).

Calendar release `2026.3` adds `lunar: true` to the four expected lunar holidays: the two Eids, Awal Muharram and Ashura. All dates, durations, sources and confidence values stay unchanged. This optional metadata is safe for an older format-1 reader to leave out; it only identifies which entries may offer local sighting confirmation. An expected date alone never qualifies. Ramadan joined them in `2026.4`.

Local confirmations keep the exact original reference entry, as canonical text, alongside the announced dates and the source the teacher entered. They replace the expected entry's effect only while that reference still matches. Cancelling restores the bundled dates; a changed reference makes the old confirmation inactive. No signature or issuer is verified here. Local `half`, `confirmedFrom`, `rotation` and `received` fields, and the `rotating-groups` effect, are not part of the format-1 reference exchange: its reader refuses them rather than silently discarding their meaning.

Single-entry receiving uses its own [bounded closure-notice format](../docs/checks/calendar-notice-format.md), not this reference-release format. Received provenance stays in local history; it is not an issuer-verification claim. Signed calendar updates and plan packs have their own [format and tools](../docs/checks/signed-updates.md).

- **A fix is a new release.** Raise `release` in the file that changes, for example from `2026.1` to `2026.2`, so that the app can tell the update apart ([PRD §4.10](../docs/prd/PRD.md#410-the-rest-of-the-reference-data)).
- **Cite the official text** in the entry's `source`, with a link when there is one. A press article or a forum post can point to a text, but is never the source. When the moon is sighted, the lunar entry becomes announced and cites the announcement.
- **Run the tests.** `npm test` reads every file, checks their sources and exam windows, and runs made-up classes through the whole year.

## Not here yet

- **The pupils' last day.** Their summer holiday starts after the term-3 exams, the make-up exams and their correction, which have no dates yet. Until then, the year runs to 8 July 2027, when teachers' annual leave starts.
- **Ramadan 2027's own hours.** They come with the Ministry's Ramadan notice. Until then, sessions keep their start times and last 45 minutes in middle and secondary schools.
- **The BEM and the baccalaureate,** whose dates are not announced yet.
- **Wilaya and school entries,** such as weather closures. They come as calendar fixes, keyed with the wilaya codes above, or the teacher adds them ([PRD §4.5](../docs/prd/PRD.md#45-the-calendar)).
- **Subjects by grade and by stream.** The profile lists the subjects each level teaches, and the teacher picks theirs at setup.
