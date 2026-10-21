# Special days on Today

Checks of 21 October 2026 for [#224](https://github.com/djazairdev/minhajna/issues/224), from [#331](https://github.com/djazairdev/minhajna/pull/331), [#332](https://github.com/djazairdev/minhajna/pull/332), [#333](https://github.com/djazairdev/minhajna/pull/333) and [#334](https://github.com/djazairdev/minhajna/pull/334), on main `9814b4d`. Made-up content only.

## What changed

- **Seminars, training days and duties** (answer 335, [Today-special](../design/screens/Today-special.png)): a teacher-layer entry takes only the sessions of its part of the day: the whole day, the morning or the afternoon. Those sessions show with its name. Instead of the holiday banner, Today shows «يوم خاص: …» under the date and a card with the kind, the part of the day and the school. The heading counts only the sessions left, and the next session shows when none are. A school or wilaya event gets a card and takes no session.
- **Class councils** (answer 334, [Today-council](../design/screens/Today-council.png)): a calendar kind of its own, «مجلس القسم», for one class, a term and a time on one day, named in each language, taking no session. On its day, the special-day line gives its time and the card its class, with «انعقد المجلس». The journal's seminars page prints a council in grey until it is confirmed, and leaves out one that passed unconfirmed. The «ملف مجلس القسم» link waits for marks ([#244](https://github.com/djazairdev/minhajna/issues/244)).
- **Ramadan** (answers 318 to 320 and 336, [Today-ramadan](../design/screens/Today-ramadan.png)): «أول يوم من رمضان», then «رمضان · اليوم 5 من 29», under the date.
  - From the first day until the teacher hides them, two cards show: each of the teacher's levels' session length with its source, and «الحصة المختصرة تُحسب حصة واحدة» with links to the documents and to Ramadan in the calendar. New lengths or the next Ramadan bring them back.
  - When none of the teacher's levels has a length announced, as for a primary-only teacher until the Ministry announces one (answer 320), the rule card is left out and the notice can be hidden on its own. A level without a length says that its usual length stays.
  - Session times and the texts book already followed Ramadan's bells (R-4.5-09, R-4.5-14).
- **Cover a teacher gives** (answer 332): «حصة» offers «تعويض» at a middle or secondary school.
  - The teacher picks the school and the day, and types the colleague's class and the times.
  - On its day, Today shows its card. «تمّت» writes it in the daily journal, where it prints in grey until then, and «حذف التعويض» removes one after a confirmation.
  - It has no plan, is never counted and never goes in the texts book.
- **Cover received** waits for the school space (answer 333): only the director knows who covered. Until then the teacher marks the session not held, as before.

No permission, network call or file format changes. Councils and covers are new fields of existing records (`calendar.set`, `duty.set`); signed calendar files and received notices refuse a council.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `council.test.ts` and `cover.test.ts`: what a council and a cover need, edits that keep a council's class, a cover listed apart from the exam week, and neither taking a session |
| Android tests | 1708, of them new: `today-special.test.tsx` (7), `calendar-council.test.tsx` (10), `today-council.test.tsx` (5), `today-ramadan.test.tsx` (8), `today-cover.test.tsx` (11), and `today-special-scale.test.tsx` (4: a seminar, a council, a cover and Ramadan on one day, in Arabic and English, at 100% and 200%: Ramadan's line before the seminar's and the council's, the heading stacked at 200%, every control named and every text free to grow and wrap) |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** each card reads as one item, and «انعقد المجلس», «تمّت», «حذف التعويض», the Ramadan links and «إخفاء» are reached on their own.
- **On a phone:** right to left and left to right, with text at 200%. The special-day line, the cards and the cover form wrap without clipping, on Android 8 at 360×800.
- **On paper:** the daily journal's day page with a cover, in grey and then black, and the seminars page with a council.
- **Ramadan 1448** (R-4.11-03): the pilot's live test, about 7 February to 8 March 2027, with the Ministry's announced lengths.
