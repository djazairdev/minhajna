# WeekGrid (#133)

Checks of 17 October 2026 for [#133](https://github.com/djazairdev/minhajna/issues/133), on `feat/133-week-grid`. Made-up weeks only.

## What changed

- **`WeekGrid`** (`src/components/WeekGrid.tsx`) follows the [WeekGrid design](../design/system/components/WeekGrid/README.md):
  - the caller's days across, in the reading direction, and slots down, by half-day, never clock times (PRD §4.6);
  - a class on its subject colour, the teacher's own time on a soft ground with an outline, and an empty slot on the sheet, dashed when it can be pressed;
  - with `onPressCell`, every cell is a button of 48dp or more, named by its day, slot and class, or that it is empty. Without it, each cell is still read with the same name;
  - columns grow with the text, so at 200% the grid scrolls sideways rather than clipping or shrinking its text.
- **Gallery:** a middle-school teacher's week of three classes with some time of their own, to read, and a primary French specialist's week whose cells take turns as they are tapped. Texts are in `src/gallery/week-grid-texts.ts`.

No dependency, permission, network call or stored value changes. Drawing the week (#28) uses this grid next.

## Checks

| Check | Result |
|---|---|
| Tests | 509 Android tests pass, 4 of them new in `__tests__/week-grid.test.tsx`: colours and spoken names; pressing a cell in both directions, each a named 48dp button with its hint; and 200% text, where columns grow and text keeps its size with no line limit. The gallery's own test renders the new entry in both directions |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, debug build | In the gallery, both weeks fit the 360dp screen inside its margins, days running from the right in Arabic as the canvas draws them. Tapping a primary cell moved it from «فارغة» to «3إ1» and then «3إ2», with cells of 53 × 48dp. At 200% text the columns grew and the grid scrolled sideways from the right |

## Still to do by a person

TalkBack in Arabic on the gallery's grids, with the rest of #20 (see the BrowserStack note there).
