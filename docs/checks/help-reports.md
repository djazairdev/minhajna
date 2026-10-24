# Help and problem reports (#249)

Checks of 24 October 2026 for the first pull request of [#249](https://github.com/djazairdev/minhajna/issues/249), on `feat/249-help`. Made-up records only. Crash reports, off by default, come in the second pull request (answer 483).

## What changed

- **Help** follows the board's order: the demo class (it opens the classes, and says whether the class is there), «توقيتاتي في التجربة» in pilot builds, «الإبلاغ عن مشكلة» and «الإبلاغ عن خطأ في المخطط», the refused-update line, the contact address and the teacher group, then privacy and «عن «منهاجنا»».
- **«الإبلاغ عن مشكلة»** asks what happened and where, then shows exactly what will be shared:
  - the note, with every pupil's name replaced by «تلميذ 1», «تلميذ 2» in the order they first appear, and bidi controls taken out;
  - the part of the app, the version and Android's version;
  - the route names of the last ten screens opened, kept in memory only since the app started.
- **Sharing** opens Android's share sheet with that text. The app keeps no copy, makes no request and logs nothing. Nothing is shared while the note is empty.
- **Names in the note** are replaced as the class lists write them (`packages/core/src/name-replace.ts`):
  - **Spelling:** without vowel marks or tatweel, with any alef, ة typed ه and ى typed ي; Latin without case or accents.
  - **Prefixes:** a name may carry و or ف, then ب, ل or ك, and «لل» reads as «ال». The prefix stays in front of the label.
  - **Compounds:** two or three name words may be typed joined, apart or with a hyphen.
  - **Short words:** a short given name is replaced alone, but a particle such as «بن» or "el" only beside another part of the name. «على» and «إلى» are never read as a name ending in ي.
  - **Registrations:** registration numbers are replaced, also typed in groups.
  - **Limit:** a name spelled another way may remain, which is why the report is read in full before sharing. NETWORK.md and «ما يتصل به التطبيق، ولماذا» say so.

## Checks

| Check | Result |
|---|---|
| Core tests | 777 pass, 10 of them new for the names: parts in any order, spelling folds, one or two prefixes, compounds joined, apart, hyphenated or prefixed, short names and particles, «على», registrations whole and in groups |
| Android tests | 2340 pass, 7 of them new: the note's names replaced before it is shown, the shared text exactly as shown, no steps, the ten steps kept, Help's order and its link to the report, and every text in French and English |
| Type check, ESLint, Prettier | Pass |
| Audit | Clean after four rounds; the findings on spelling, compounds, prefixes, short names, registrations and the wording were fixed before this commit |
| Android 15 emulator, release build | Help showed its rows in the board's order, and the demo row opened the classes. The note "Yacine Bouzid and Nour El Houda, reg 9900 0000 01, …" (demo pupils) was shown as «تلميذ 1 and تلميذ 2, reg تلميذ 1, …». The preview also showed «أين: المناداة», version 0.4.0 with Android 15, and the steps "Today › Classes › Documents › Today". The share sheet received exactly that text. «Abd-Raouf», a spelling the list does not hold for «Abderraouf», left "Abd" in place, as the screen warns |

## Still to do by a person

TalkBack in Arabic on Help and the report, and sharing a report to a real mail app on a phone (see #206).
