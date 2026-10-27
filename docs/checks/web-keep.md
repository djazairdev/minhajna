# The PC web app keeping its data and installing (#250, part 3, second pull request)

Checks of 27 October 2026 for the second pull request of part 3 of [#250](https://github.com/djazairdev/minhajna/issues/250), from the pull request that adds this record. It follows [the files in and out](web-files.md). Made-up data and passphrases only.

## What changed

- **A new module, Browser** (`apps/android/src/native/NativeMinhajnaBrowser.ts`, `apps/web/src/native/Browser.ts`): what the PC's browser offers. A phone has no such module, so its data counts as kept and the app as installed, and nothing changes there.
- **Keeping the data (answer 511, R-6.6-08):**
  - the app asks the browser to keep the data through the storage manager as the passphrase is sent, on the first run and at the first try of each opening, while the click still counts as the teacher's. Chrome and Edge decide on their own, by how the site is used, and agree for an installed app; Firefox asks the teacher. A browser with no storage manager, or one that fails, counts as not keeping it. The web app reads the answer as it starts, and Today shows neither card until it is read;
  - keeping the data guards only against the browser clearing it for space: clearing this site's data in the browser deletes it either way. The lock page's warning says so, and so does Today's card;
  - while the browser has not agreed, the lock page says, under its title and at every opening, that the browser may clear Minhajna's data from this PC when space runs short, that Today offers a backup once opened, and that the warning stays until the browser agrees. The board's sync row is left out, as sync is not open;
  - once opened, Today says the same in a card with «نسخة احتياطية الآن», the usual backup: under the recovery key through the save dialog, or the recovery sheet first without one. Once a backup is saved that day, the card says so in place of the button. It cannot be put off and shows with the 30-day reminder turned off, which it replaces while it shows.
- **Installing (answer 512, R-6.6-05):**
  - Chrome and Edge offer installing the app once the page loads. `public/offer.js`, a small script that runs before the app's bundle, holds the offer from the page's first moment, in place of the browser's own prompt, and the app takes it over; one follower in the app waits for the browser's changes;
  - on the first run, between the welcome and the passphrase, a page says what installing gives, with «تثبيت «منهاجنا»», which opens the browser's own dialog, «لاحقاً» and «رجوع». Whether it shows is decided once, as the page first shows: only when the browser offers installing then and the app is not installed, so an offer made later never swaps the passphrase page away. Installed, through its button or the browser's menu meanwhile, it says the app opens from the Start menu or the desktop, and «متابعة» goes on here; refused or withdrawn, the passphrase page says it can be installed later from «الأجهزة والنسخ» or the browser's menu;
  - Settings › «الأجهزة والنسخ» offers installing while the browser does;
  - the board's step that adds the PC to the teacher's devices is the welcome's copy or setup (answer 504), so the page names the two steps left.
- **Words:** every new text in Arabic, French and English. Today's 30-day reminder now has its PC wording, "on this PC" for "on this phone".

## Checks

| Check | Result |
|---|---|
| Web tests (`apps/web`, 59, 4 new) | Pass:<br>• **keeping the data:** read and asked through the storage manager; a failing one counts as not kept;<br>• **installing:** no offer at first; the browser's offer held, its prompt prevented; a dismissed dialog spends it; an offer over once the browser says the app was installed; an accepted dialog counts it installed, and a later offer changes nothing; each change reaches whoever waits for one; an offer or an install that `offer.js` kept before the module ran taken over;<br>• every native module of the phone app, 13 now, has its web version. |
| Jest (`apps/android`) | The 12 new tests pass:<br>• the install page before the passphrase, installing through the browser, then the browser asked to keep the data as the passphrase is sent;<br>• a refused install going on to the passphrase with where to install later;<br>• «لاحقاً» going on with no install, and «رجوع» back to the welcome;<br>• no offer giving the passphrase straight, and an offer made later not taking the page;<br>• an offer withdrawn before the press saying it was not installed, and one installed from the browser's menu meanwhile saying it was;<br>• the lock warning while the data is not kept, each opening asking once, and no warning once it is;<br>• Today's card with the reminder turned off, and its line on clearing the site's data, its backup through the recovery sheet or under the key, saved that day and back the next; only the reminder, in the PC's words, once the data is kept;<br>• the devices page offering installing, and not once installed.<br>The full run: 2437 pass. The 4 failures are the two i18next notice tests, as before: the shared checkout's installed i18next is 26.4.5 while the lockfile has 26.5.4. CI installs from the lockfile. |
| Type checks | Pass: the Android app, and the web app with its scripts and tests |
| ESLint, Prettier | Pass |
| Bundle | `app.js` is 3.4 MB minified (913 KB gzipped). `dist/` is 7.4 MB |
| Chrome, headless, from the local server, at 1280 × 800, a fresh profile each run | Pass, in Arabic and English:<br>• Chrome found the app installable with no errors, and made its offer, which reached the app;<br>• **the first run:** «استرجاع» led to the install page, with its three facts; «لاحقاً» led to the passphrase;<br>• **not kept:** headless Chrome did not agree to keep the data after the passphrase or after opening. Today, after a made-up backup was restored, showed the card with «نسخة احتياطية الآن»; the devices page offered installing; after a reload the lock page showed the warning above the passphrase, and the right passphrase opened Today;<br>• **kept:** with the storage permission granted through the debugging protocol, the browser said it keeps the data once the passphrase was set; neither Today nor the lock page warned;<br>• no errors in the console. |

## Left for the next parts

- **Part 3, next pull request:** the handover rule, read-only until the copy comes back (answer 503), on both devices.
- **Part 4:** accepting an update, «مسح هذا الحاسوب», which also deletes the sealed signing pair, and printing through the browser; the PC words of those screens and of Help.
- **Before 0.6.0:** as in [the files record](web-files.md).
- **Still to check by hand:**
  - installing from Chrome's and Edge's dialogs on Windows 10 and 11: whether the tab moves into the app's window or a second copy opens, as a second copy on the first run would start its own; the app opening from the Start menu with no network; and Chrome then keeping the data;
  - Firefox's own question on keeping the data, and its answer reaching the lock page at the next opening.
