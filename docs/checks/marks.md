# Continuous-assessment components (#238)

Checks of 23 October 2026 for [#238](https://github.com/djazairdev/minhajna/issues/238), on `feat/238-marks-components` and `feat/238-marks-screens`. Made-up classes and records only.

## Part 1: the presets and the setup (#407)

- **The presets** (`data/dz/assessment.json`, answers 430, 437 and 438):
  - Middle school: six components on 20, from circular 270 and PRD §3.5. Discipline and attendance can come from the roll-call book.
  - Lycée: the same six until a lycée list is found.
  - Primary: languages and mathematics on 10, from circular 272's list. Music, visual arts and PE have a preset of their own on 10. Primary's other subjects have none.
  - Every preset's `source` says the points and ranges are the curators', not official.
- **The formulas:** each level's averages as whole-number weights, listed apart with their level. Primary's music, visual arts and PE have none yet.
- **The reader** checks every field against the profile:
  - points within their range, the range within the scale, the total equal to the scale;
  - one roll-call component at most;
  - at a level, no subject named twice, one entry at most for every other subject, distinct formula ids of the level's own, and one scale.
  - A problem names the entry by its place in the file.
- **The setup** (`assessment.set`, pupil-records layer, answer 434):
  - It applies from its term on; the last one saved for a term counts, whatever the order.
  - It keeps its components' names and the presets' release, so a later preset never changes marks already given.
  - A reshaped class reads the setup of the class it continues until it saves its own.
  - It travels with the pupil records, the last one per term.
  - Its roll-call choice holds only while the attendance component is still there.

| Check | Result |
|---|---|
| Core tests | 8 new:<br>• Algeria's presets, each adding up to its scale, and their formulas;<br>• primary's music, visual arts and PE with their own preset and no formula;<br>• a file refused field by field, clashes named by their place, scales and formula ids tied to their level;<br>• the term a day falls in;<br>• setups applying from their term, read through a reshaped class, and travelling with the pupil records;<br>• what keeps a setup from being saved;<br>• a component the preset no longer has kept as a column, and the roll-call choice following its component. |
| Type check, ESLint, Prettier, Android tests | Pass |

## Part 2: «التقويم والنقاط» and its setup

- **Where it opens** (answer 436): the class page's «التقويم والنقاط» row, with the term holding today and its setup, such as «الفصل الأول · 6 عناصر على 20 · الإعداد الرسمي».
- **The hub** (Marks, answers 435 and 436):
  - the class and subject, with the year in a joint class;
  - chips for the year's terms, open on the term holding today; between terms, the next one;
  - the formula card: the official formula in words, the presets' release and the rules year, «قواعد 2025-2026 حتى صدور منشور السنة»;
  - «التقويم المستمر», with the setup in force for the chosen term, the preset or the teacher's own;
  - «مواعيد الفروض».
  - A subject with no continuous assessment says so, and its row is disabled. A class archived after a reorientation shows its setup but takes no new one. A refused presets file says the setups could not be read.
- **The setup** (Marks-setup, Marks-setup-sum, answers 431 to 434):
  - the preset's card, with its circular and release, and the note that the points and ranges are the curators', not an official text's; a level's subject preset names its subjects;
  - each component with how its marks are gathered and a stepper that stops at its range;
  - «إضافة عمود» opens a sheet for a column of the teacher's own: a name of 40 characters at most and 1 to 10 points. It shows «عمود مضاف» and a remove button;
  - «الانضباط والمواظبة من دفتر المناداة», off by default, only with that component;
  - the total, and what is left or over;
  - «حفظ», off until something changed and the total reaches the scale.
  - Back with a draft asks first. A save goes back to the hub and applies from the chosen term on.
  - Saved points outside today's ranges start at the nearest limit, and the screen says so.

| Check | Result |
|---|---|
| Android tests | 2,097 pass, 25 of them new:<br>• each course's line and formula by level and subject, French's term in lower case, captions, hints in Arabic's plural forms;<br>• the hub on today's term, a chosen term, a subject with no continuous assessment, an archived class, a joint class;<br>• the setup's card and components, a short total made up and saved from its term with the roll-call choice, a column added and removed, saved points brought into range, primary music on 10;<br>• a refused file on the class page and the hub;<br>• the routes: Back with a draft, staying and leaving, and a save back to the hub;<br>• every text found in Arabic, French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, on 23 October: the class page's row read «الفصل الأول · 6 عناصر على 20 · الإعداد الرسمي». The hub opened on term 1 with the middle-school formula and the rules line. In the setup, lowering participation gave «المجموع 19 من 20» and the hint, with «حفظ» off; Back asked «لم يُحفظ الإعداد», and «البقاء» kept the draft. Raising research, ticking the roll-call row (its caption became «من دفتر المناداة»), adding a column of 2 points (22 of 20), then removing it, and saving went back to the hub, which read «إعدادك منذ الفصل الأول». Term 2 showed the same setup and its points. |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the class page's «التقويم والنقاط» row, the hub's term chips and rows, each setup stepper with its range, the roll-call row, and the column sheet.
- **On a phone in French and English:** the hub and the setup. The emulator check was in Arabic.
- **With a teacher:** setting the components for a real class, and saying whether the curators' ranges fit the school's practice.
