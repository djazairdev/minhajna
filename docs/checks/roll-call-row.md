# RollCallRow and Stats (#131)

Checks of 17 October 2026 for [#131](https://github.com/djazairdev/minhajna/issues/131), on `feat/131-roll-row`, taken for the roll call (#38). Made-up pupils only.

## What changed

- **`RollCallRow`**: a 56dp row with the pupil's number, the name, and two 64×48dp toggles, «غياب» and «تأخر».
  - Absent is `board` with `chalk` text. Late is `hi` with a `late-edge` border, bold text and a tick, so its fill is never the only signal, as the design system's accessibility page asks.
  - A marked row is shaded `alt-day`.
  - Each toggle is a checkbox for TalkBack, with its state, and its spoken name includes the pupil's: «غياب: مختلق آية».
  - The row holds no record: the caller owns the states and saves them.
- **`Stats`**: three figures side by side, in Western digits, each read as one, «1 غياب», with a label that says what could surprise: «تأخر، لا يُحسب غياباً».
- **The gallery** shows the three figures, and a class of 45 made-up pupils in a virtualised list of its own height whose figures follow the marks. Marking a pupil absent clears their lateness, and the other way round. The names come from `src/gallery/roll-call-texts.ts`: made-up family names by made-up first names.
- The catalogues gain `roll.absent`, `roll.late` and `roll.spoken`.

## Checks

| Check | Result |
|---|---|
| Android tests | 723 pass. The new ones cover each toggle state, its spoken name and the change it reports; the late toggle's second sign; the marked row's shade; the toggle and row sizes; the 45 rows virtualised and named, with the figures following the marks; and text growing to 200% with no fixed height or line limit, in Arabic, French and English, right to left and left to right |
| Type check, ESLint, Prettier | Pass |

The gallery opens from the developer menu of debug builds only. The roll call's own screen (#38) shows the demo class's 45 pupils in a release build.

## Still to do by a person

- Scrolling the 45 pupils on a budget phone, and TalkBack in Arabic, with the roll call screen (#38).
