# Labels that wrapped out of sight (#185)

Checks of 17 October 2026 for [#185](https://github.com/djazairdev/minhajna/issues/185), on `fix/185-chip-wrap`. Made-up content only.

## The cause

React Native and Android disagree on how wide a line of text is:

- **React Native measures** a text with `StaticLayout` and `Layout.getDesiredWidth`, which add up the glyphs' advances (`TextLayoutManager.kt`).
- **Android draws** it with the TextView's own layout. For an app that targets Android 15 or later, on Android 15 or later, TextView breaks lines by the glyphs' ink bounds instead (`useBoundsForWidth`, on by default).

When a label's ink runs past its last advance, the box React Native sized for one line is too narrow for the TextView, so the line breaks and the last word falls below, out of sight. A probe on the Android 15 emulator, Noto Naskh Arabic Medium at 28 px:

| Label | Advances | Ink, left to right | One line with bounds? |
|---|---|---|---|
| «تاريخ آخر» | 99 px | −1 to 99 px | No, two lines |
| «سبب آخر» | 92 px | −1 to 91 px | Yes |
| «يوم آخر» | 79 px | −1 to 78 px | Yes |

Only labels whose ink reaches past the end are hit, which is why «سبب آخر», of the same length, drew in full. `textBreakStrategy` does not change it. React Native 0.87.1 declares a `StaticLayout.Builder.setUseBoundsForWidth` lookup in `TextLayoutManager.kt` but never calls it.

## What changed

- **The app theme** sets `android:useBoundsForWidth` to `false` (`android/app/src/main/res/values/styles.xml`), so every TextView breaks lines by advances, as React Native measures them. It covers chips, buttons and every other label that hugs its text. Android before 15 ignores the attribute.
- **A test** (`__tests__/text-bounds.test.ts`) keeps the attribute in the theme.
- **Gallery:** the Chip sample gains seven short two-word labels, «تاريخ آخر» among them, in Arabic, French and English.

No dependency, permission, network call or stored value changes.

## Checks

| Check | Result |
|---|---|
| Android tests, type check, ESLint, Prettier | Pass |
| Android 15 emulator, before | «تاريخ آخر» drew only «تاريخ» at 100% text |
| Android 15 emulator, after | All seven labels draw in full at 100%, 130% and 200% text |

## Still open

- **Reporting it to React Native.** A report is ready below; filing it on React Native's tracker is the founder's call.

### Report for React Native

> **Android: text wraps out of sight when the app targets SDK 35+**
>
> On Android 15+, with `targetSdkVersion` 35 or later, `TextView` defaults to `useBoundsForWidth = true` and breaks lines by glyph bounds. `TextLayoutManager` measures with `StaticLayout` and `Layout.getDesiredWidth`, by advances. When a text's ink runs past its last advance, the measured one-line box is too narrow for the drawn layout: the line breaks, and the second line is clipped by the measured height.
>
> Seen on 0.87.1 (New Architecture), Android 15 emulator, with `<Text>تاريخ آخر</Text>` in Noto Naskh Arabic Medium at 14 dp, 2.0 density: advances 99 px, ink −1 to 99 px. The same may hit any script or font with overhanging glyphs, such as italics.
>
> Either measure with `setUseBoundsForWidth` matching the TextView's setting, or set `useBoundsForWidth = false` on `ReactTextView`. A workaround is `<item name="android:useBoundsForWidth">false</item>` in the app theme.
