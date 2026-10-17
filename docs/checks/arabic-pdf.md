# Arabic PDFs on the phone

Teachers hand in printed journals and roll-call books. Arabic PDFs break easily: letters left unjoined, Arabic and Latin text in the wrong order, pages cut. This page records how the phone's own web engine was checked as the maker of the app's printed documents ([PRD §5.13](../prd/PRD.md#513-checks-before-the-pilot)), for ticket FC-28 of the field-check plan ([#44](https://github.com/djazairdev/minhajna/issues/44)). Every record in these checks is made up.

- [The result](#the-result)
- [How the app makes a PDF](#how-the-app-makes-a-pdf)
- [The documents](#the-documents)
- [Timing](#timing)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## The result

| Check | Result |
|---|---|
| Arabic letters joined, in the bundled fonts | **Passed.** Every Arabic word is shaped in Noto Naskh Arabic, and titles in Aref Ruqaa |
| Mixed directions | **Passed.** Times such as `08:00 – 09:00`, class codes such as `4م2`, dates and pupils' names in Latin letters keep their order inside right-to-left pages |
| A4 pages, nothing cut | **Passed.** The journal has 19 portrait pages of 594.96 × 841.92 points, one a school day. The roll-call month has 2 landscape pages of 841.92 × 594.96 points, and its head repeats on page 2. A4 is 595.28 × 841.89 points; the difference is rounding at 300 dpi |
| Fonts embedded | **Passed.** Both files embed subsets of all five bundled faces: Noto Naskh Arabic regular and bold, Aref Ruqaa bold, Noto Sans regular and bold. No font is looked up on the phone or the network |
| A month of journal pages in under 10 seconds | **Passed on an emulator,** in 1.8 s. **Open on a budget phone** ([below](#timing)) |
| Printed at 100% on A4, in black and white | **Open.** Left to the founder, on paper ([below](#still-open)) |

The emulator was `minhajna-nav89-api35` (Android 15, 360×800, no Google Play services) on an Apple silicon Mac, with a release build.

## How the app makes a PDF

The app builds each document as one HTML page in JavaScript and hands it to a native module, `MinhajnaPdf`. The module loads the page into a WebView that is never shown and prints it with Android's own print adapter, straight to a file in the app's cache. No print dialog opens and nothing leaves the phone.

- **Locked down.** The WebView runs no JavaScript and loads nothing from the network. It cannot read files or content providers. Every request is refused except the page itself and the app's own fonts, which the web engine reads from the APK's resources (`file:///android_res/font/`).
- **Escaped.** Names and lessons come from the teacher and the class list, so all their text is escaped before it goes into the page.
- **A4 at 300 dpi,** portrait or landscape, without the print adapter's margins. The page sets its own: 12 mm, and 18 mm on the binding side.
- **Shared, not stored.** The file stays in the app's cache. The teacher sends it on with Android's share sheet, through a FileProvider limited to the cache's `pdf/` folder.

Android's `PrintDocumentAdapter` callbacks are only reachable from the `android.print` package, so a small class there, `WebViewPdf`, drives the adapter's layout and write steps.

## The documents

The month is October 2026 of the core's demo year ([#77](https://github.com/djazairdev/minhajna/issues/77)), middle school: 45 made-up pupils, every session confirmed and every roll call taken. It is made in memory only; the teacher's history is never touched.

**The daily journal** prints one A4 portrait page a day, as the paper book does. Each page has the school, the day and the year on top. Below them are the day's sessions in three columns: from–to, the class, and the unit, the item and how the session went. Ruled lines fill the rest of the page, and the teacher's signature and the director's visa sit at the foot. A session still awaiting confirmation prints in grey, with «سير الحصة: تنتظر التأكيد». A day without sessions says so.

**The roll-call month** prints one class on A4 landscape. Each row holds the pupil's number, the name in Arabic and in Latin letters, a column per roll call, and the month's absences and lates. A mark is a letter, never a colour alone: «غ» unjustified, «م» justified, «ت» late. The 45 rows run onto a second page, with the head repeated.

Two layout faults were found and fixed while checking:

- **The roll-call table ran off the page.** With 21 roll-call columns, the table grew wider than the page. It now has a fixed layout with set widths for the number, the names and the totals, and the day columns share the rest.
- **Times wrapped** in the journal's first column. The column is now 30 mm wide and its text does not wrap.

## Timing

The target is a month of journal pages in under 10 seconds on a budget phone ([PRD §6.8](../prd/PRD.md#68-non-functional-requirements)).

| Step | Time |
|---|---:|
| Building both documents' HTML from the records | 432 ms |
| The journal, 19 pages, 190 KB | 1,377 ms |
| The roll-call month, 2 pages, 57 KB | 1,090 ms |

The journal's time runs from handing over the HTML to the file being written and its pages counted. It includes making the WebView, loading the fonts and printing. A month of journal pages therefore took about 1.8 s. Other emulators were running on the same Mac, so these are upper bounds for this computer.

## Repeating the checks

You need a debug build and Metro, as in the [Android build check](android-build.md). Open React Native's developer menu and choose **Storage check**. At the bottom of that screen, under **Arabic PDFs, October of the demo year**:

- **Make the journal and roll-call PDFs** makes both files and shows their pages, sizes and times;
- **Share journal-2026-10.pdf** and **Share roll-2026-10.pdf** open Android's share sheet.

Each result also goes to the log:

```sh
adb logcat -d | grep "pdf:"
```

To copy a file to the computer:

```sh
adb exec-out run-as dz.minhajna.preview cat cache/pdf/journal-2026-10.pdf > journal.pdf
```

## Still open

- **A budget phone.** Time the month's journal on a budget 360×800 phone with Android 8, as above.
- **Paper.** Print both files at 100% on A4, in black and white, and compare them with the paper journal and roll-call book: margins, the binding side, ruled lines, and greys that stay readable.
- **The documents themselves.** The texts book ([#42](https://github.com/djazairdev/minhajna/issues/42)) and the final layouts come with their own tickets. These pages check the engine, not the final design.
