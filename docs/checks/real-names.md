# Real class lists (#211)

Checks of 20 October 2026 for [#211](https://github.com/djazairdev/minhajna/issues/211), on `feat/211-real-names`. Made-up classes and records only; the declaration reference in the tests is made up.

## What changed

The founder decided that the prior declaration to the ANPDP is the Ministry's to file, as the body that will run the system. The project builds the software and tests it with made-up data only (answer 274). So real class lists sit behind a build switch:

- **The project's builds** (the preview and the pilot APKs) keep the switch off. They keep asking for made-up names, as 0.1.0 and 0.2.0 do.
- **The build the Ministry runs** sets `REAL_NAMES` in `apps/android/src/privacy/real-names.ts` to its declaration's reference. Then:
  - once the app lock is set, the class list's notice says real names are taken, encrypted on the phone, behind the lock, and never reach the project;
  - the welcome, shown before the PIN is chosen, says real names are taken only once the PIN is set, so nothing asks for them before the lock. Left under the privacy notice after the first PIN, it says they are taken;
  - Help's notice and the privacy notice state the declaration's reference, isolated for right-to-left text;
  - Help asks to compare the checksums with those published with this version, not with the project's preview.
- **The demo class stays,** for screenshots, tutorials and problem reports (R-1.5-09).
- **The preview notice's last line** now says real pupils' records wait for the version the Ministry runs, not the pilot version.
- **`PRIVACY.md`** is left to #289's rewrite, which the 0.2.0 notice draft (#301) covers.

| Check | Result |
|---|---|
| Android tests | 1374 pass, 10 of them new: the switch's rules; the class list, the welcome, Help and the privacy notice with the switch on; every control named in Arabic, French and English, right to left and left to right. With the switch off, the existing tests still see the made-up-names notices |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |

## Still to do

- The Ministry's build sets its declaration's reference, and its notice text, once it exists.
