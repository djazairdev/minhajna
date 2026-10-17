# Welcome and privacy notice (#24)

Checks of 17 October 2026 for [#24](https://github.com/djazairdev/minhajna/issues/24), on `feat/24-welcome`, from main `c26df51`. Made-up content only.

## What changed

- **The welcome** ([Setup-1-Welcome](../design/screens/Setup-1-Welcome.png)) is now the first screen: the chalk «م», the name and tagline on the board (WelcomeHero), the language chips, the three promises (Facts) and «لنبدأ». It also shows while the reference data and the history open, and on a refusal, without «لنبدأ».
- **Left out on purpose.** The restore link «لديّ نسخة من هاتف آخر» stays out of field-check builds (choice F4, #49), and no restore exists yet. The line «الإعداد يستغرق حوالي 10 دقائق» waits for setup (#25–#31).
- **The privacy notice** ([Privacy](../design/screens/Privacy.png)) comes after «لنبدأ», before first use (Law 18-07 Art. 32, PRD §6.2). It keeps the design's six parts, order and wording, except where the design describes what this build lacks: it has no network permission, so the parts on sync, backup, servers and crash reports say what this build does instead. The contact keeps the design's placeholders until counsel names it (R-6.2-02). The founder approves the text in this pull request.
- **Nothing records that the notice was read.** Until setup keeps the teacher's setup, every start shows the welcome and then the notice. «فهمت، لنبدأ» opens the tabs, and Back from the tabs leaves the app.
- **Help** lists the notice (without «فهمت، لنبدأ») and a new page, «ما يتصل به التطبيق، ولماذا», which says what `NETWORK.md` says: this build connects to nothing, and the source link only hands an address to the browser after asking.
- **Icons** are the design's line icons and the mim, as Android vector drawables in `res/drawable`, drawn by React Native's `Image` and tinted. No dependency is added, and `res/raw/keep.xml` keeps them from a future resource shrinker, since only JavaScript names them.
- The language chips follow the design's Chip on paper, with the contrast-safe outline. The tabs' stand-in pages moved to `src/navigation/HomePreview.tsx` and use the hero.

No permission, network call, stored value or record format changes. `NETWORK.md` is unchanged.

## Automated checks

| Check | Result |
|---|---|
| Tests | 381 Android tests pass, 11 of them new in `__tests__/welcome.test.tsx`: the welcome's texts, no restore link, decorative images, the flow to the tabs, Back leaving the app, every part of the notice, Help without the first-use button, the connections page, and every control named and 48 dp in Arabic, French and English, right to left and left to right |
| Gallery | WelcomeHero and Facts have entries; every component still has one |
| Contrast | The hero's line, chalk at 80% on board, reaches 4.5:1 |
| Type check, ESLint, Prettier | Pass |

## On the emulator

Android 15 (API 35), 360×800 dp, in airplane mode, debug build, and the welcome again on Android 8 (API 26):
- On both, the vector drawables draw and tint correctly: the mim, the chalk underline and the line icons.
- The welcome matches its design, apart from the two lines left out above and the darker chip outline. The notice matches its design.
- At 200% text the welcome and the notice wrap without clipping and scroll to «لنبدأ».
- In English the page mirrors, and the connections chevron points right.
- From Help, the notice has no first-use button.
- Text size and the language were restored afterwards.

The law number shows as «07-18» from left to right, as in the design's HTML: after an Arabic word, Unicode's bidi rules make each part an Arabic number, read right to left as 18 then 07.

## Still to do by a person

- The founder approves the notice's text (ar, fr, en). The French and English are drafts for a fluent reviewer.
- TalkBack in Arabic on the welcome and the notice: headings, the order of the six parts, the decorative icons skipped.
- The notice on Android 8, and both screens on a budget phone.
