# Chip and SetupSteps (#134)

Checks of 17 October 2026 for [#134](https://github.com/djazairdev/minhajna/issues/134), on `feat/134-chip`. Made-up content only.

## What changed

- **`ChipGroup`** (`src/components/Chip.tsx`) follows the [Chip design](../design/system/components/Chip/README.md):
  - a label above the chips and an optional hint below them;
  - a wrapping row of 48dp chips (the canvas draws 44), with the chosen ones board with chalk text and the others sheet with the contrast-safe outline;
  - one choice as radios in a labelled radio group, or several as checkboxes. The screen owns the selection; several choices come back in the choices' order.
  - A name in another script, such as «Français» on an Arabic screen, can keep its own font and direction.
- **`SetupSteps`** follows the [SetupSteps design](../design/system/components/SetupSteps/README.md): one 4dp segment per step, board once reached, filling from the reading direction's start. TalkBack skips it, as the screen's title says the step.
- **The welcome's language choice** now uses `ChipGroup`, and looks and behaves as before.
- **Gallery:** one choice, several with a hint and a long label, and the steps bar at steps 1, 3 and 5. Texts are in `src/gallery/chip-texts.ts`, following #138's layout.

No dependency, permission, network call or stored value changes.

## Checks

| Check | Result |
|---|---|
| Tests | 436 Android tests pass, 9 of them new in `__tests__/chip.test.tsx`: radios and checkboxes with their states, 48dp, the group's name, selection order, colours, scripts, uncapped text, and the steps bar in each state, hidden from TalkBack |
| Welcome and language tests | Unchanged and passing on the new chips |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, debug build | The welcome's chips look as before. In the gallery, the level chips are native checkboxes whose checked state follows each tap, and the steps bar fills from the right in Arabic |

## Still to do by a person

TalkBack in Arabic on the gallery's chips, with the rest of #20 (see the BrowserStack note there).
