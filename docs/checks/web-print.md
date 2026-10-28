# Printing on a PC (#250, part 4, third pull request)

Checks of 28 October 2026 for the third pull request of part 4 of [#250](https://github.com/djazairdev/minhajna/issues/250), from the pull request that adds this record. It follows [erasing a PC](web-erase.md). Made-up data only.

## What changed

- **Printing through the browser (answer 507):** the web PDF module puts the document into a hidden frame of the page, opens the browser's print dialog on it, and removes the frame once the dialog closes, one print at a time.
  - The page's security policy refuses a style element or a style attribute in that frame. So the document's rules go through the frame's own style sheet, and each style attribute becomes a rule on a numbered data attribute (`print/printable.ts`).
  - Each converted declaration is marked important, so it still wins over the page's rules, as the attribute did.
  - The frame is filled once its first page has loaded. The bundled fonts come from the web app's `fonts` folder, and the dialog opens only once they and the pictures are loaded. The frame goes once the browser says the print is over, whether its print call waits for the dialog or not, or at once when the browser ignored the call, as Chrome does after several cancelled dialogs or where printing is turned off.
  - While the dialog is open, the page's title is the document's, so "Save as PDF" proposes its name.
- **One button (answer 521):** on a PC, each screen's «طباعة» and «حفظ PDF» become one «طباعة أو حفظ PDF» (`PrintSave`), with a line: choose a printer, or "Save as PDF" to keep a file.
  - It prints under the document's file name, and is logged as a print, since the app cannot tell which was chosen.
  - The screens: the documents' own output, the roll-call book, the corrections of the texts book, the September check, the stale-question sheet, the grade book, the mark sheet's print, the marks' justification, a mark's correction, a reader's spot check and merge, the statement, and the week's print.
  - The phone keeps its two buttons and its titles.
- **The week's print:** on a PC it counts no pages, as the dialog shows them, and says so, with no page-count failure. Without the count, a two-sided print gets no blank page between books, so a book can start on the back of the previous one's last sheet; the binding margins still alternate.
- **Protected files (answer 522):** on a PC, the council file and the mark sheet as a PDF print through the dialog, which can also save an unprotected PDF. A line says that a password-protected file is made on the phone. The council file keeps its confidentiality line, in PC words, and the mark sheet its warning about the signature's copy. The mark sheet's CSV keeps its password option and its save.
- **Refused on a PC:** a PDF made without the dialog, one to share or keep, and reading a page's colours to count pages stay the phone's, refused as `E_WEB_PHONE_ONLY`. The helper for steps not yet built is gone, as none is left.
- **Words:** every new text is in Arabic, French and English.

## Checks

| Check | Result |
|---|---|
| Other packages (`npm test` at the root) | Pass |
| Web tests (`apps/web`, 73) | Pass, among them:<br>• **the print frame's document** (`test/printable.test.ts`, new), from pages the phone's own `printDocument` makes: the head read with an escaped title, every rule kept with the page size and margins, the fonts read from the web app's folder, each style attribute turned into an important rule with none left, and anything else refused;<br>• **the phone-only steps** refused (`test/modules.test.ts`). |
| Jest (`apps/android`) | The 6 new tests pass, and the full run's 2469; its 4 failures are the two i18next notice tests, as before, from the shared checkout's installed version. The new tests (`web-print.test.tsx`):<br>• on a PC, one button with its line, printing under the file's name and logged as a print, with no PDF made;<br>• on the phone, both buttons, and the document's title;<br>• the week's print on a PC counts no pages, says the dialog shows them, and has no PDF button;<br>• the council file on a PC prints under its name, with no password, the protected line and its confidentiality line in PC words;<br>• the mark sheet as a PDF on a PC prints with the protected line and the copy warning, and its CSV keeps the password and the save;<br>• every new text in French and English.<br>Every earlier print and save test still passes on the phone. |
| Type checks | Pass: every package, the Android app, and the web app with its scripts and tests |
| ESLint, Prettier | Pass |
| Chrome, headless, from the local server, at 1280 × 800, a fresh profile each run | Pass, in Arabic and English. After a made-up backup was restored, the roll-call book was printed from Documents, with the print dialog stubbed to begin the print, read the frame, and end it. The frame took the file's name, also as the page's title. It held one style sheet with the A4 page rule, the bundled fonts all loaded, and the body in Naskh. A column's 7 mm from a style attribute was laid out as 26.45 px, and the right direction was set. The frame was gone and the page's title back afterwards. No policy violation or error was in the console. |

## Left for the next parts

- **Part 4:** the PC words of Help and the remaining screens.
- **Before 0.6.0:** as in [the files record](web-files.md) and [the updates record](web-update.md).
- **Still to check by hand:** the real print dialog and "Save as PDF" in Chrome, Edge and Firefox on Windows 10 and 11, with a document of several pages, landscape and portrait, and a drawn signature.
