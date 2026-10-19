# The session absence slip (#217)

Checks of 19 October 2026 for Roll-print, part 3, from [#217](https://github.com/djazairdev/minhajna/issues/217), on `feat/217-roll-slip`. Made-up classes and pupils only.

## What changed

- **«ورقة غياب الحصة»** (R-3.4-31, answers 254 and 264) is a new choice in «طباعة دفتر المناداة», shown only for a class whose roll is called per session, as in CEM and lycée:
  - the day steps through the class's days with a taken roll call, from today or the latest before it, and chips pick the session when the day has more than one, naming its group when two groups share a slot;
  - the slip gives the class, its session's own subject, even when the teacher has two courses with the class, and the school, the day, the session's time, its group when it is not the whole class, and «الأستاذ»;
  - it lists only the absent and late pupils of the roll call's latest version, in list order, with «غائب», «غائب، مبرر» or «متأخر», or says «لا غياب ولا تأخر» when nobody was marked. A pupil who has since moved group is still named;
  - a box for «مستشار التربية أو المشرف التربوي» ends it;
  - it prints once on the top half of an A4 portrait page, with a dashed cut line under it. «داخلي · سري» is at the slip's own head and foot, above the cut line. A long list pushes the cut line down;
  - it has no blank version and no «خانة توقيعي».
- **The Roll screen's print icon** opens that session's slip, «طباعة ورقة غياب هذه الحصة», once a per-session roll call is taken. Before then, or for a class called by half-days, it still opens the blank sheet.
- A class whose roll is called by half-days doesn't offer the slip. A slip asked for there falls back to the monthly spread.
- Roll-print's day and session pickers are now `RollPrintDay.tsx`, and its choice words are in `roll-print-choices.ts`, keeping the screen under 300 lines.

## Checks

| Check | Result |
|---|---|
| Android tests | 1304 pass, 7 of them new. They cover: the slip's rows, states, order, box and cut line; the session chip and a session with nobody marked; no slip without a taken roll call or for a half-day class; the Roll screen's icon opening the slip; a second course's subject; a corrected roll call with a pupil who moved group; and two half groups in one slot. All controls are named and at least 48dp |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, debug build | Roll-print from the Documents tab offered «ورقة غياب الحصة» for 4AM1 on Thursday 15 October, its latest taken day. The saved PDF is one A4 portrait page: the slip with «08:00 – 09:00», the two absent pupils, the counsellor's box, and the cut line in the middle of the page |
| Desktop Chrome, layout only | Eight marked pupils keep the cut line at the page's middle; thirty push it down, still on one page |

Faults found while building and fixed:
- The page's own «داخلي · سري» foot printed below the cut line, so the slip handed in lost it. The slip now carries both marks itself.

The review before committing found more, all fixed:
- A head comment line ran past 80 columns.
- With two courses for the class, the slip had no subject; it now takes its session's own.
- A marked pupil who had since moved group printed with no name.
- Two half groups in one slot had the same chip and the same working name.

## Still to do by a person

- Printing the slip on paper (#44).
- TalkBack in Arabic on the slip's pickers and the Roll screen's icon (see #206).
