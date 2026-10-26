# The PC web app's lock and history (#250, part 2)

Checks of 26 October 2026 for the second part of [#250](https://github.com/djazairdev/minhajna/issues/250), from the pull request that adds this record. It follows [the shell](web-shell.md). Made-up data and passphrases only.

## What changed

- **The passphrase (answer 502)** stands in for the phone's PIN on a PC:
  - at least 12 characters, typed twice, and compared in one Unicode form, so the same words typed on another keyboard still open it;
  - the screens are `CreatePin.web.tsx`, `Unlock.web.tsx` and `LockPin.web.tsx` beside the phone's PIN screens. They take the same props, now in `lock-props.ts`, and the web build picks them first;
  - they follow the Web-unlock design: the board with the mark, the name and the tagline beside a paper side with the form, or above it in a narrow window;
  - «نسيت عبارة المرور؟» says that nobody can recover the passphrase, and that the PC must then be erased;
  - too short, too long (over 1024 characters), different twice, and not saved each have their own message; only a full disk is blamed on space;
  - the message's live region stays in place, so screen readers announce what comes into it; a wait is announced once as it starts, not every second;
  - password managers get the usual hints: current password on the lock, new password when choosing one.
- **The history on a PC** (`apps/web/src/native/vault/`):
  - **Where:** IndexedDB in this browser. Each step is one transaction and resolves once it is on disk.
  - **The key:** 32 random bytes for AES-GCM, sealed on disk with a key drawn from the passphrase by PBKDF2-HMAC-SHA256, 600,000 rounds, with a random salt. The format, salt and rounds are bound to the seal.
  - **While open,** the page holds the key in memory only, as a key it cannot read back. Locking or closing the tab forgets it.
  - **Rows:** each entry is sealed with its own nonce and bound to its sequence number. The count and the last sequence number are sealed beside them, so a row changed on disk, moved to another place or dropped from the end refuses to open. The pilot's timings are one sealed row.
  - **Erasing content** seals every row again under a new history key, in the same transaction that keeps it, so the old key is gone from what the browser reads. IndexedDB has no secure delete like SQLCipher's on the phone, so the old records may stay in the browser's files until it compacts them, with the old sealed key beside them.
  - **The phone's rules:** an entry already kept at a sequence number is refused, content is erased all at once, and a restore goes only into an empty history, all or none. A new passphrase over rows whose key is gone is refused as `E_KEY_LOST`. The passphrase changes only while the history is open.
  - **Every primitive is the browser's Web Crypto (PRD §6.5).**
- **Wrong passphrases** are counted as the phone counts wrong PINs:
  - four are free, then the wait doubles from 30 seconds up to an hour;
  - a try is counted before the passphrase is checked, in the same transaction that reads the count, so two tabs cannot share a try;
  - a clock moved back starts the wait again in full, and an unreadable count is the longest wait;
  - the wait only slows guessing on the lock page. Someone who copies the browser's files can guess without it, which is why the passphrase is long and slow to try.
- **Starting from scratch (answer 504):** a fresh PC goes from the welcome to the passphrase, then to setup, as a phone does after its first PIN.
- **The automatic lock (answer 505)** uses the phone's choices, 1, 5 or 15 minutes, 5 by default. A click, a key or a wheel turn counts as use.
- **«القفل والأمان» on a PC:**
  - it says the app opens with the passphrase every time;
  - its button changes the passphrase;
  - it has no screenshot switch, as a browser cannot block screenshots;
  - its fixed protections are the PC's own;
  - its subtitle reads «على هذا الحاسوب».
- **Texts:** new keys under `lock.web` and `security.web` in Arabic, French and English, with the Arabic and French plural forms.
- **`fake-indexeddb` 6.2.5** is a new development dependency of the web app, for its tests only, with no dependencies of its own.

## Checks

| Check | Result |
|---|---|
| Web tests (`apps/web`, 33) | Pass. The vault's tests cover:<br>• **the passphrase:** set, opened, locked and opened again, including in another Unicode form; a short one refused; a second one refused;<br>• **nothing readable:** none of the three stores holds the made-up name or the passphrase;<br>• **tampering:** a row moved to another sequence number, a row with one changed bit, the last row dropped, and the sealed end dropped all refuse to open;<br>• **waits:** the fifth wrong passphrase brings 30 seconds; the right one is not tried during the wait; a clock moved back waits again in full;<br>• **changing the passphrase:** refused while locked; a wrong current one is counted, and after the change only the new one opens;<br>• **the history's rules:** content erased under a newly sealed key, with the passphrase still opening it and nothing changed when there is nothing to erase; restore only into an empty history; a repeated sequence number refused, and keeping none of a restore; timings kept as one row and cleared; rows with no key refused;<br>• **a full browser** reads as `E_NO_SPACE`;<br>• **another tab:** once the sealed key on disk is not the one this page opened, an entry, timings and an erase are each refused, and nothing is written; an erase is refused too when another tab's timings came in between its reading and its writing. |
| Jest (`apps/android`) | The 6 new tests pass: a fresh PC's passphrase twice, with too short, too long and different refused, then setup; a wrong passphrase said, and the right one opening; the fifth bringing a wait, announced once, that the right one cannot skip; the change page, which forgets all three fields after a wrong try; a passphrase not saved, said without blaming space; no fingerprint page on a PC.<br>The full run: 2419 pass. The 4 failures are the two i18next notice tests, because the shared checkout's installed i18next is 26.4.5 while the lockfile has 26.5.4. CI installs from the lockfile. |
| Type checks | Pass: the Android app, and the web app with the `.web` screens resolved as the bundle resolves them |
| ESLint, Prettier | Pass |
| Bundle | `app.js` is 3.2 MB minified (831 KB gzipped). `dist/` is 7.1 MB |
| Chrome, headless, from the local server, at 1280 × 800 and 420 × 860 | Pass, in Arabic and English:<br>• «لنبدأ» opens the passphrase page;<br>• a short passphrase gets «تحتاج عبارة المرور إلى 12 حرفاً على الأقل.», and the right one opens the privacy notice;<br>• the browser then keeps the sealed key and no entry;<br>• after a reload the lock page shows, a wrong passphrase gets «عبارة مرور خاطئة.», and the right one opens the app;<br>• the layout follows the design: side by side when wide, the board on top when narrow, right to left in Arabic;<br>• no errors in the console. |

## Left for the next parts

- **Part 3:** files in and out, so «استرجاع نسخة» and a start from the phone's copy (answer 504) work on a PC; QR codes and signatures; the keep-storage request and warning (R-6.6-08); the handover rule (answer 503).
- **Part 4:** «مسح هذا الحاسوب», which a forgotten passphrase needs; until then, clearing the site's data in the browser does it. Also accepting an update, and printing.
- **Two tabs:** each tab opens the history on its own. Each write checks, in its own transaction, that the sealed key is still the one its tab opened, and that the history's end and the timings are still as it read them. An entry, an erase or a restore after another tab's entry, and any write after another tab's erase or new passphrase, is refused, as are a timings write or an erase after another tab's timings, so the history stays whole. After another tab's erase or new passphrase, this tab fails to save until it is locked and opened again. Holding the history in one tab at a time is still to do.
- **A whole older copy** of the browser's database, put back by someone with its files, opens as it was; nothing on the PC records how far the history had gone. The phone's database has the same limit.
- **Texts that still name the phone:** the privacy notice says the records stay "on this phone". Its wording is the founder's, so a PC version needs their review.
- **Still to check by hand:** Edge and Firefox on Windows; the screen reader and keyboard focus on the lock pages; text at 200%.
