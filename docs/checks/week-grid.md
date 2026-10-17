# WeekGrid (#133)

Checks of 17 October 2026 for [#133](https://github.com/djazairdev/minhajna/issues/133), on `feat/133-week-grid`. Made-up weeks only.

## What changed

- **`WeekGrid`** (`src/components/WeekGrid.tsx`) follows the [WeekGrid design](../design/system/components/WeekGrid/README.md):
  - the caller's days across, in the reading direction, and slots down, by half-day, never clock times (PRD §4.6);
  - a class on its subject colour, the teacher's own time on a soft ground with an outline, and an empty slot on the sheet, dashed when it can be pressed;
  - with `onPressCell`, every cell is a button of 48dp or more, named by its day, slot and class, or that it is empty. Without it, each cell is still read with the same name;
  - it is laid out column by column: each day is as wide as its longest label and at least 48dp, and every row has one height that grows with the text. A long class name, such as «القسم التجريبي», widens its day rather than breaking inside a word, and the grid scrolls sideways when the week is wider than the screen, at 200% text or with long names.
- **Gallery:** a middle-school teacher's week of three classes with some time of their own, to read, and a primary French specialist's week whose cells take turns as they are tapped. Texts are in `src/gallery/week-grid-texts.ts`.

No dependency, permission, network call or stored value changes. Drawing the week (#28) uses this grid next.

## Checks

| Check | Result |
|---|---|
| Tests | 510 Android tests pass, 5 of them new in `__tests__/week-grid.test.tsx`: colours and spoken names; pressing a cell in both directions, each a named 48dp button with its hint; 200% text, where columns and rows grow and text keeps its size with no line limit; and one height for every cell of a row with a long class name. The gallery's own test renders the new entry in both directions |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, debug build | In the gallery, both weeks fit the 360dp screen inside its margins, days running from the right in Arabic as the canvas draws them. Tapping a primary cell moved it from «فارغة» to «3إ1» and then «3إ2», with cells of 53 × 48dp. At 200% text the columns grew and the grid scrolled sideways from the right. In the release build of the next pull request (#28), «القسم التجريبي» stayed whole on one line, its day wider than the others, with every row even |

## Still to do by a person

TalkBack in Arabic on the gallery's grids, with the rest of #20 (see the BrowserStack note there).
