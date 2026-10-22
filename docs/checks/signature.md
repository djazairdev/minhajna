# The drawn signature

Checks of 22 October 2026 for [#236](https://github.com/djazairdev/minhajna/issues/236), from [#385](https://github.com/djazairdev/minhajna/pull/385) to the pull request that adds this record, answers 411 to 415. Made-up schools, classes and pupils only.

## What changed

- **Drawing it** (answer 411, [Signature](../design/screens/Signature.png)):
  - «التوقيع المرسوم» opens from the teacher card, in setup and in Settings, and from its Settings row, which says whether it is drawn and on.
  - The pad is three times as wide as it is high. Each stroke is kept as it ends, as an SVG path of whole-number points in a 600 × 200 box: only its shape, never the timing, speed or pressure of the strokes. A tap is kept as a dot. A path longer than 24,000 characters is refused, and the screen says so.
  - The core refuses any other shape, also when a history holds one.
  - The pad is drawn with the app's own touch handling and plain views, with no new library. It stays left to right in every language, so touches and drawing agree.
  - «استعمال التوقيع في المطبوعات وملفات PDF» is off by default, and can only be turned on once something is drawn. «مسح وإعادة الرسم» clears it and turns it off again.
  - The four notes say it stays on this phone, that only its shape is kept, where it goes and where never, and that it is no legal signature.
- **Where it stays** (answer 411): the signature is one of the teacher card's personal fields, in the history's device layer, so like the name it never syncs, backs up or exports. Erasing it appends the card without it.
- **Where it prints** (answers 412 to 414, [Journal-signed](../design/screens/Journal-signed.png), [Print-strip](../design/screens/Print-strip.png)), while it is drawn and on:
  - the signature column of the texts book's and «شريط للّصق»'s confirmed entries;
  - the teacher's box at the foot of a secondary, primary or specialist journal page, only once no session of that day awaits confirmation;
  - the teacher's box of the timetable, the roll-call month spread and the year's summary;
  - «توقيع الأستاذ» on the September check and «سؤال المفتش»;
  - under «إمضاء من أعدّ المسودة» on the re-pace draft.
- **Where it never prints** (answers 412 and 413): the director's, inspector's and supervisor's boxes, any blank version, and the roll call's blank day sheet. The journal's and the primary journal's front pages, the supervised sessions and the homework have no teacher's box, so nothing changes there.
- **How it prints** (answer 413): as the drawn path in black, with a pen's line width at any size. It is sized by height so that no row or box grows: 14 mm at most, 6.5 mm on the texts book's and the strip's 7.3 mm rules, and 6 to 7 mm in the roll-call and primary journal boxes.
- **The choice on the print screens** (answers 412 and 414, [Doc-output](../design/screens/Doc-output.png), [Print](../design/screens/Print.png), [Print-set](../design/screens/Print-set.png), [Roll-print](../design/screens/Roll-print.png), [Sept-check](../design/screens/Sept-check.png), [Plan-stale](../design/screens/Plan-stale.png), [Repace](../design/screens/Repace.png)):
  - While the signature is in use, each screen shows «خانة التوقيع» with «بتوقيعي المرسوم», chosen first, or «فارغة», for that print only, and «إعدادات التوقيع».
  - The note says it goes in the teacher's box alone; for the texts book, the strip and the journals it adds «على ما أُكّد فقط».
  - While it is not in use, nothing is offered and the screen keeps its line about signing by hand.
- **The copy warning** (R-3.8-46, answer 415): while a print will carry the signature, a line under «طباعة» and «حفظ PDF» says «من يستلم ملف PDF يمكنه نسخ التوقيع.». «طباعة الأسبوع», whose one PDF goes to the print shop, adds «ومنهم محل الطباعة». The designs draw it as this line, so there is no notice to answer before each print.
- **Not built:** there is no DOCX output yet; the Signature screen's note already says the signature never goes in one (R-3.8-45). The app has no share sheet for documents yet, so the warning shows where a PDF is made, under «طباعة» and «حفظ PDF», since Android's print screen can save one too.

PRIVACY.md is unchanged; the CHANGELOG's Privacy section says where the signature stays and what is kept of it. The app asks for no new permission.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `drawn-signature.test.ts`: the strokes kept as whole points in the box, without repeats, and a tap as a dot; nothing for no drawing, a box with no size or a path too long; anything but moves and lines refused, also from a history, which keeps only the name, the signature and the switch; the card's other fields kept when one changes; used only while drawn and on; and never leaving the phone |
| Android tests | `drawn-signature.test.tsx`: off and undrawn at first, strokes kept as points only, the switch, «مسح وإعادة الرسم», a stroke before the pad is laid out keeping nothing, the notes in Arabic, French and English, and the rows that open it. `drawn-documents.test.ts`: the mark in each document only while in use, never on a blank version, «فارغة» or turned off; the texts book's and the strip's last column; the teacher's box alone on the timetable, the spread and the year's summary; a journal page signed only once all its sessions are confirmed, never in a visa. `drawn-choice.test.tsx` and `drawn-sheets.test.tsx`: the choice, its note, «إعدادات التوقيع» and the copy warning on the six print screens, in use and not, with «فارغة», a blank version, the front pages and a week's set with no teacher's box; never in the inspector's or the primary director's box |
| Layout | Each document rendered in headless Chrome with the app's fonts, with and without the signature: every row and box kept its height, nothing overflowed, and the mark kept its 3:1 shape. Only the re-pace draft's line, which has no box, grows by the mark |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | A signature drawn with four strokes, the first one vertical, and a tap, then turned on. The demo class with three sessions drawn in the week. The timetable's output showed «خانة التوقيع», the box-only note and the copy warning. The saved PDF had the drawing, with its dot, in «توقيع الأستاذ» alone, in black. «فارغة» brought back the line about signing by hand and took the warning away |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:**
  - the pad's label, hint and whether it is drawn;
  - the switch while it waits for a drawing;
  - «خانة التوقيع», its note and the copy warning on a print screen.
- **On a phone:**
  - drawing with a finger on a small and a large phone, right to left and left to right, with text at 200%. The page must not scroll while drawing, and a first stroke drawn straight down must be kept;
  - a signed texts book, journal and roll-call spread, printed on paper. The mark must sit inside each box, and the strip must still line up with the paper book's rules.
- **With teachers and a school:** whether a drawn signature is accepted on these documents, and whether the copy warning is clear.
