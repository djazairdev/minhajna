# Bundled Android fonts

These are the three interface families in [issue #71](https://github.com/djazairdev/minhajna/issues/71) and the [design system](../../../docs/design/system/brand.md#type). Amiri is for documents and is not part of this issue.

All nine static TrueType files are copied unchanged from the upstream releases below, not a font mirror. Only the filenames change to Android resource names. No subsetting, conversion, rebuilt fonts or install scripts are involved. The hinted Noto files are used for small text on budget phones. Aref Ruqaa is needed only at 700; both Noto families are needed at 400, 500, 600 and 700. No italic face is currently specified.

## Sources and checksums

The machine-readable [manifest](manifest.json) records each archive member, its native alias, and SHA-256. Tests verify the bundled bytes, embedded weight, native registration and coverage of every interface type token. These tests use no network.

### Aref Ruqaa v1.008

- [Upstream release archive](https://github.com/aliftype/aref-ruqaa/releases/download/v1.008/ArefRuqaa-1.008.zip)
- Licence: `ArefRuqaa-1.008/OFL.txt` inside that archive.
- Archive SHA-256: `27e8b0b0d2c2f658fb4e115c959b919bc279ced18d2426e039f0beb21489afe9`.

| Bundled resource (under `android/app/src/main/res/font/`) | Weight | SHA-256 |
|---|---|---|
| `aref_ruqaa_bold.ttf` | 700 | `bf1515aa22cf183c4b880bd07f8f323c4546141dcbfe10758d9f4d826b4bda85` |

### Noto Naskh Arabic 2.021

- [Upstream release archive](https://github.com/notofonts/arabic/releases/download/NotoNaskhArabic-v2.021/NotoNaskhArabic-v2.021.zip)
- Licence: `OFL.txt` inside that archive.
- Archive SHA-256: `6c050ab9bd087d69b733c505a7576e60c528c2f33cd7b91005a5bd7da4514032`.

| Bundled resource (under `android/app/src/main/res/font/`) | Weight | SHA-256 |
|---|---|---|
| `noto_naskh_arabic_regular.ttf` | 400 | `6f0a92031367b2f5a2078fe9d24f3433122b61a0bad57c423aad8f3c39aa2e6e` |
| `noto_naskh_arabic_medium.ttf` | 500 | `ab1b4aa0f0856f0a722d229d5cddd465012c3acd11e22fd9512682098b7a66dc` |
| `noto_naskh_arabic_semibold.ttf` | 600 | `76616e51f5ff1cf4d81a14df6049646911cd4d7e568903a011711c241991624c` |
| `noto_naskh_arabic_bold.ttf` | 700 | `04017b0ccdd1156dcde3bc386734c1b03165261762f16a025c8afc9088ae76e9` |

### Noto Sans 2.015

- [Upstream release archive](https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSans-v2.015/NotoSans-v2.015.zip)
- Licence: [OFL at the release tag](https://github.com/notofonts/latin-greek-cyrillic/blob/NotoSans-v2.015/OFL.txt).
- Archive SHA-256: `0c34df072a3fa7efbb7cbf34950e1f971a4447cffe365d3a359e2d4089b958f5`.

| Bundled resource (under `android/app/src/main/res/font/`) | Weight | SHA-256 |
|---|---|---|
| `noto_sans_regular.ttf` | 400 | `478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823` |
| `noto_sans_medium.ttf` | 500 | `635d93d1131d791f2576de90b3bb0f7cdf61929906e8420a61b5f7f8e76420bb` |
| `noto_sans_semibold.ttf` | 600 | `a4e91fd530ac2b4ef5367240144ff37d7d65d66cf76f2e9a2187b93c676f92d0` |
| `noto_sans_bold.ttf` | 700 | `1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913` |

The first two archive digests match GitHub's published release-asset digests. Noto Sans's asset has no published digest; the archive digest above records the downloaded bytes, not independent upstream verification. Recheck upstream provenance before updating a file.

## Licence and offline use

The licence is [OFL-1.1](../../../LICENSES/OFL-1.1.txt). `REUSE.toml` carries each project's copyright and licence. The APK also includes `assets/licenses/fonts.txt`, with all copyright notices, Aref Ruqaa's reserved font name and the licence text. Copyright and licence metadata remain in the unmodified fonts.

`MainApplication.kt` registers local resources before React Native starts. There is no download path, font-provider request or new dependency. `NETWORK.md` is unchanged and release builds still request no permissions.

The native aliases in `src/design/fonts.ts` select each real font file. Android 8's React Native implementation folds weights 500 and 600 into normal; separate aliases prevent those weights from silently rendering as 400. Base design family names remain in `fontFamilies`; interface components should use `typography` styles, whose families select the exact bundled face.

The welcome screen demonstrates Aref Ruqaa (Arabic name), Noto Naskh Arabic (Arabic tagline) and Noto Sans (Latin name). It scrolls if enlarged text needs more height. The Ruqaa heading uses its font's native line height: the canvas's tight 1.15 line box clips the lower Arabic dots on Android at 200%. Check native font metrics when applying the other display styles to future components, rather than treating the web's line boxes as clipping bounds.

## Verification

1. Build a release APK and sign a disposable test copy with a local, temporary test key; never commit a signing key.
2. On the dedicated Android 8 emulator or a test phone, turn on airplane mode and turn off Wi-Fi and mobile data **before first launch**.
3. Open the app with no development server running. Check the three faces, Arabic joining, and that no text is clipped, then repeat with text at 200%.
4. Check Arabic TalkBack on a suitable device. A rendering screenshot alone does not prove screen-reader support.
5. Build twice from clean copies in different directories, and compare the unsigned APKs byte for byte. Also check that the APK asks for no permissions and contains the font licence and all nine fonts.

### Local result, 15 October 2026

- macOS, Node.js 22.23.2, JDK 17 and the SDK versions in the [Android build check](../../../docs/checks/android-build.md).
- Root type check and 97 core tests passed. Android type check and 12 tests passed. ESLint, source formatting and REUSE passed (776/776 files); the full `npm run lint` also passed in a clean source copy before its native build. The working checkout still has the generated-file formatting issue fixed separately in PR #83.
- Two independent source copies, each with its own locked offline dependency install, passed `clean assembleRelease` in different directories. Their unsigned APKs and the working checkout's APK match byte for byte: SHA-256 `baaa05633cd0d0ade65b30d66a5619d87ec48a4a66cae4bdb0bf8182be52d415`.
- APK inspection found all nine expected font hashes and `assets/licenses/fonts.txt`. The release asks for no permissions.
- Android 8.0 (API 26), AOSP arm64 emulator, 360×800 dp: a disposable signed release opened after clearing only its temporary test-app data, with airplane mode on, Wi-Fi disabled and no active network. All three families rendered on first launch, with no development server.
- Right-to-left Arabic joining, lower dots and both Arabic and Latin text were visually checked at 100% and 200%. The first 200% check exposed Ruqaa dot clipping; the native line-height correction above fixes it. The final screenshots show the complete dots and no clipped text.
- **Still pending:** Arabic TalkBack (not installed in the AOSP emulator), a physical budget phone and the CI rebuild on Linux for #71. No claim is made about those checks or budget-phone startup performance.

A source test alone does not prove native font loading or reproducibility; keep repeating the device and build checks when fonts or layout change.
