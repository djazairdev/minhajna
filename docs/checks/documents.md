# The Documents tab

How the Documents tab and a document's output were checked for [#212](https://github.com/djazairdev/minhajna/issues/212) (PRD [§3.8](../prd/PRD.md#38-the-documents), [§5.13](../prd/PRD.md#513-checks-before-the-pilot)): the list of documents, printing through Android's print service, saving a PDF where the teacher picks, the blank version, and «داخلي · سري» on the pages of a document with pupils' data. Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [What the tab does](#what-the-tab-does)
- [The result](#the-result)
- [The confidential band](#the-confidential-band)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## What the tab does

The tab lists the documents the app can lay out today: the daily journal (today's page) and the roll-call book (this month, a page per class). Under each title it says how many classes it covers. Only the classes the teacher teaches count, those with a course, as on the Classes tab. More documents join the list as they are built, starting with the texts book ([#213](https://github.com/djazairdev/minhajna/issues/213)).

A document opens its output screen:

- **The version:** as recorded, or blank with its headings (R-3.1-10). The blank journal keeps the head and the columns; the blank roll-call book keeps the head, the roll-call days and the pupils' names, with no marks and no totals.
- **«داخلي · سري»:** a document with pupils' names or marks says that the mark is printed at the head and foot of every page, in both versions (R-5.9-15).
- **The signature:** the teacher's box stays blank, to sign by hand (R-3.8-42). The drawn signature comes later.
- **Print** hands the pages to Android's print service, whose own screen picks the printer or saves a PDF.
- **Save PDF** makes the file and opens the system's file picker, so the app asks for no storage permission. The file name is the document's title and its day or month, such as «الدفتر اليومي 2026-10-18.pdf» or «دفتر المناداة 2026-10.pdf», and names the blank version too.
- **Nothing to print:** a roll-call book with no class taught says so, and its buttons stay off.

The pages are made from the record book when a button is pressed, so they always hold the latest entries. The WebView that lays them out is the locked-down one described in [Arabic PDFs on the phone](arabic-pdf.md#how-the-app-makes-a-pdf).

A PDF holds pupils' data unencrypted, so it does not stay on the phone longer than needed:

- The copy made for Save PDF leaves the app's cache once it is saved or the picker is cancelled.
- The cache's PDFs are cleared every time the app starts, so none outlives a process killed while the picker was open.
- The WebView that printed a document is let go when Android's print job ends.

A second tap while a document is being made does nothing, and a save waiting for its place refuses another.

A password on the PDF and DOCX are not part of this step.

## The result

| Check | Result |
|---|---|
| The tab lists both documents, with the number of classes and what each covers | **Passed** |
| A class with no course is counted nowhere and gets no roll-call page | **Passed,** in the tests and on the emulator |
| Print opens Android's print screen with the document's pages | **Passed.** The roll-call book showed 2 landscape A4 pages |
| Save PDF opens the file picker with the file name, writes the file and says «حُفظ الملف.» | **Passed.** The journal saved to Downloads as one A4 portrait page, 594 × 841 points |
| A saved or cancelled PDF leaves the app's cache, and a PDF left by an earlier run is gone at the next start, before the lock screen | **Passed** |
| A cancelled save says nothing, and the buttons work again | **Passed** |
| Printing twice, closing the print screen each time | **Passed,** with no error in the log |
| Coming back from the print screen or the picker does not lock the app before its delay | **Passed** |
| «داخلي · سري» at the head and foot of every page of the roll-call book | **Passed** ([below](#the-confidential-band)) |
| The output screens are hidden from screenshots | **Passed.** The window is `SECURE` on the Documents tab and on the output screen. Android's print screen belongs to the system's print service, so the app's guard does not cover its preview ([below](#still-open)) |
| Printed on paper at 100% | **Open** ([below](#still-open)) |

## The confidential band

The first try placed the mark with fixed positions in the page margin. Android's print preview showed it once per page, in the middle of the table. The web engine lays fixed elements out against the WebView, not against each printed page.

The mark now sits in the head and foot of a frame table around each class's page. The web engine repeats a table's head and foot on every printed page. Pages break between frames, never inside a table cell.

The check used the roll-call month of the demo year: 45 pupils, then a second class of 12 added for this check only. It printed 3 landscape pages:

- the first class on pages 1 and 2, with «داخلي · سري» above the title, above the repeated table head and at the foot;
- the second class starting page 3, with the mark at its head and foot.

On a class's last page, the foot follows the last row.

## Repeating the checks

1. Build and install the debug app: `./gradlew :app:installDebug` in `apps/android/android`.
2. On the Documents tab, open the roll-call book and press «طباعة». Android's print screen opens with the pages.
3. Open the daily journal and press «حفظ PDF», then «Save» in the picker. Pull the file from the device's Downloads folder.
4. For the confidential band on a full month, open the storage check from the developer menu and press "Make the journal and roll-call PDFs". Pull `cache/pdf/roll-2026-10.pdf` with `adb exec-out run-as dz.minhajna.preview cat cache/pdf/roll-2026-10.pdf > roll.pdf`, and look at every page.

The Jest tests in `apps/android/__tests__/documents-tab.test.tsx` and `documents.test.ts` cover:

- the list, and a class with no course;
- both versions, and the mark in the HTML;
- the calls to print and save, a double tap, a cancelled save and a failure;
- the file names, and an empty roll-call book.

## Still open

- **Paper.** Printing at 100% on A4, in black and white, on the founder's printer, as in [Arabic PDFs on the phone](arabic-pdf.md#still-open).
- **The print screen's preview** can be captured in a screenshot and shows in recent apps, as it belongs to Android's print service. Saving a PDF shows no records.
- **An old WebView.** The frame's repeated head and foot were checked on Android 15's WebView only. A phone whose WebView is not updated may need its own check.
- **A password on the PDF,** for documents with pupils' data. It needs a PDF library, which is a new dependency.
- **The drawn signature** in the teacher's box.
