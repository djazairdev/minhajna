# A class's own list

Checks of 21 October 2026 for [#227](https://github.com/djazairdev/minhajna/issues/227), from [#341](https://github.com/djazairdev/minhajna/pull/341), [#342](https://github.com/djazairdev/minhajna/pull/342) and the pull request that adds this record. Made-up lists and classes only.

## What changed

- **A list instead of a pack** (answers 346 and 348, [Plan-free](../design/screens/Plan-free.png)):
  - A class without a pack can keep its own list for each subject. It holds units, and items with their kind, 1 to 60 sessions and optional stages.
  - The core reads it as a pack of its own, with status `own` and the badge «قائمتي · غير مراجَعة». Today proposes its next item, and the plan, pace and texts book follow it.
  - The class's changes and layers do not apply to it, and neither do changes left from a former pack.
  - Own items carry no term, so the term check and the September check leave the class out.
- **The editor:**
  - The teacher types an item, then selects items to move them a place together, edit one or remove them.
  - Saving records the whole list, with the day it began and the day it was last offered.
  - A removed item keeps its title only when a recorded session, in any version, names it.
  - Leaving with changes or typing not saved asks first.
  - The plan's head, the item page and Settings show the list with no pack details, newer release, class changes, IDs or error report.
- **The offer** (answer 347, [Plan-offer](../design/screens/Plan-offer.png)):
  - What goes: the country, level, grade, subject and school year codes, the source «عملي الخاص», the saved items in order with their IDs, the licence CC BY-SA 4.0, the day of the offer and the credit. The credit is no name, or a name the teacher types. An item's ID is random and ties a published pack back to the list.
  - Nothing from sessions, the class, the school or pupils goes.
  - The file, in a new payload format `minhajna-list-offer`, goes through Android's share sheet to contact@djazair.dev; the app sends nothing itself.
  - Once the share sheet opens, the offer is recorded, and the list's history shows «أُرسلت للمراجعة» above «بدأت القائمة».
  - Choosing between the list and the published pack (Plan-free-published) waits for a follow-up issue.
- **Records:**
  - One new record, `list.set`, in the lesson-record layer, holding the whole list with its days. A backup or a second device keeps the list's history.
  - The history ignores a list that breaks the rules.
  - The native share now takes a file up to 1 MB, the size of a file the app reads, since a long list with stages passes 16 KB.
  - No permission or network call changes.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `free-list.test.ts` (8): the rules a list keeps, the own pack and its units, Today's proposals, the order the teacher gives, removed titles kept or dropped by the recorded sessions, class changes and layers refused, changes from a former pack left out, the offered day and the handover. `free-list-offer.test.ts` (3): what an offer holds and leaves out, fields an item should not carry, the file read back, and every refusal |
| Android tests | `plan-free.test.tsx` (9): the editor in Arabic, French and English, moving, editing and removing, what an item still needs, a class on a pack, the plan, item page and Settings, the leave prompt's state, and a removed title kept. `plan-offer.test.tsx` (7): the offer in three languages with its file read back, one share for a double tap, the credit, a failed share, no list, and the list's history |
| Native | `./gradlew --offline :app:compileDebugKotlin` passes |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:**
  - each list row reads as one checkbox with its number, title, kind, sessions and stages;
  - the leave prompt reads its two choices;
  - the offer's preview reads as one block.
- **On a phone:**
  - Plan-free and Plan-offer right to left and left to right, with text at 200%, on Android 8 at 360×800;
  - a list of 60 items with stages saved, then offered through the share sheet by email, and the file opened on a computer.
