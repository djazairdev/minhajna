# The field-check preview (#48)

Checks of 17 October 2026 for the first pull request of [#48](https://github.com/djazairdev/minhajna/issues/48), on `feat/48-preview`. Made-up pupils only.

## What changed

- **The preview says what it is.** The welcome shows «معاينة» and one line: for trying the app with made-up pupils only. «المساعدة والخصوصية» shows the notice in full, under «عن «منهاجنا»».
- **Its version and checksums.** Help shows the version, `0.1.0 (10099)`, and two SHA-256 checksums: the installed APK's, and the signing certificate's. A native module, `MinhajnaBuild`, reads only the app's own APK, off the UI thread. Checksums show left to right in groups of four, and can be selected and copied.
- **The version** is `0.1.0`, with Android's version code `10099`, worked out as [versioning.md](../contributing/versioning.md#the-apps) says.
- **A guide** for whoever runs a session: [docs/field-check/session-guide.md](../field-check/session-guide.md). It covers installing, checking the checksums, going back to the demo class, removing the app, and making and signing the preview.

## Checks

| Check | Result |
|---|---|
| Android tests | 976 pass, 4 of them new: the welcome's one line before the language choice, Help's version and grouped checksums, a missing certificate, and a refusal. The catalogue check now accepts a label that only joins the texts shown inside it, as a notice's does |
| Type check, ESLint, Prettier | Pass |
| Permissions | The release APK asks for none, the internet included |
| Android 15 emulator, release build signed with a throwaway key | The welcome shows the notice with «لنبدأ» still on screen at 360×800. Help shows `0.1.0 (10099)`. Its APK checksum matched `sha256sum` of the signed APK, and its certificate checksum matched `apksigner verify --print-certs` |

## Still open

- **The project's signing key** and the published checksums. The founder makes and holds the key.
- **The field check's plan packs,** once they are keyed in full ([#23](https://github.com/djazairdev/minhajna/issues/23)).
- **TalkBack in Arabic** on the welcome and Help, on a real phone.
