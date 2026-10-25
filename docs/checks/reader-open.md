# Reader mode: opening a statement

Checks of 25 October 2026 for [#246](https://github.com/djazairdev/minhajna/issues/246), part 1 (R-Open, answer 489), from the pull request that adds this record. Made-up keys, classes and statements only.

## What changed

- **«البيانات المستلمة»** in Settings, under sharing, shows on every phone, with or without a class. «بيان التقدّم» stays hidden while no class is planned. The page lists every statement kept, newest statement first, each with its class and its teacher, and «فتح بيان» opens a new one.
- **«فتح بيان»** reads a teacher's progress statement from its QR code, its signed file or its PDF, with no account and no network:
  - A PDF gives only its `minhajna-statement:` link (answer 485). Nothing else in the PDF is decoded or kept. A PDF without the whole link, for example one saved again by another app, is refused with «افتح الملف كما أرسله الأستاذ، أو امسح رمز QR الذي فيه».
  - The signature is checked first, with the phone's own verifier. A statement changed after it was issued, a file of another kind, a newer format or a payload that does not follow the format is named as such and never kept.
- **A statement that checks** shows at once and is kept once, as signed, with the day it came and how, on the reader’s own devices and no server. Opening it again, even before it is saved, keeps no second copy. The page shows:
  - «التوقيع سليم»;
  - whether it is the first from that key, or from the teacher who sent the one of a given day;
  - every field, headed by the statement's day, its teacher and its class;
  - whether a newer edition of its plan is in the app;
  - the key's fingerprint;
  - that it holds no pupil data and stays on the reader’s devices.
- **Naming the teacher:** a statement names no teacher, so the reader knows one by the key that signs. «تسمية الأستاذ» gives the key a name and, optionally, a school, each one line of at most 80 characters, kept the same way. The latest name counts. Until then the teacher shows as «أستاذ لم يُسمَّ» with the fingerprint's start.
- **A statement no longer kept**, opened from a stale link, says so.
- **Data:** two events, `statement.received` and `teacher.named`, on the `shared-statement` layer. They go to the reader's own devices and to the export of all files, never into anything shared. A name given on two devices is a conflict on `teacher-named/<key>`.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `statement-received.test.ts` (3): a statement kept once and read back with its key and day, text that is no signed statement or was checked under another key refused; a teacher named per key, the latest name counting, an empty, overlong or two-line name refused; both events on the `shared-statement` layer, kept on own devices and in the export, never in a statement or a school space |
| Sync check | `conflicts.test.ts`: two names for one key are a conflict, two statements received are not |
| Android tests | `reader-open.test.tsx` (7): Settings reaches the page with no class; a signed file checked, kept once and shown in Arabic, French and English with no missing text and no accessibility problem; a PDF link and a QR code kept, the later statement naming the earlier one's day; a changed file and a file of another kind refused as such, a PDF with no link or a broken one refused with its own message, none kept; the teacher named, the list newest first, a kept statement opened from it, and one no longer kept said so |
| Native tests | `StatementFileTest` (3) on the emulator: a signed file reads as its text; a PDF gives only its first whole link with base64 after it, skipping one too long, or the bare scheme when it has none; malformed UTF-8 and a file over 8 MiB refused. `CalendarInputTest` (6) still passes |
| Emulator | Release arm64 APK on Android 15 (API 35), installed over the earlier build with its data. «البيانات المستلمة» → «فتح بيان» → «فتح ملف» opened the Arabic statement PDF the app had saved from «بيان التقدّم»: «التوقيع سليم», «أول بيان يصل بهذا المفتاح»… and «وصل يوم 25/10/2026 · ملف PDF». The fields matched the statement, and the teacher line read «أستاذ لم يُسمَّ» with the fingerprint's start. After naming, the teacher read «Made-up Teacher · Made-up School» on the page and in the list. Opening the same PDF again kept one statement. The mathematics statement from the same phone then read «من الأستاذ نفسه الذي أرسل بيان 25/10/2026.» with the given name, and the list counted «بيانان». The texts book’s PDF was refused with the message for a PDF without its statement and not kept. No error in the log |
| Type check, ESLint, Prettier | Pass |
| Languages | Every new text in Arabic, French and English, with the same placeholders and plural forms |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** each statement in the list reads its class, teacher and day as one item. The checked card reads its badge then the lines under it. The fingerprint reads in groups.
- **On a phone:** the page right to left and left to right, with text at 200%, on Android 8 at 360×800. Also a statement's QR code scanned from a second phone, and a statement PDF received through a messaging app and opened from its download.
