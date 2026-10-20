# Logo

The logo is a teacher's hand on the blackboard: «م», the first letter of منهاجنا, written in chalk in Ruqaa, the script teachers write on the board and in their books. The tile is the board itself (`board`); the letter is `chalk`.

## The files

| File | What it is | Use it |
|---|---|---|
| `minhajna-icon.svg` | The app icon: the chalk «م» on a `board` tile, 512×512, corner radius `radius-app-icon` | Store listings, the website, the README, the web app's tab and install icon |
| `minhajna-icon-foreground.svg` | The letter alone on a 108×108 canvas, inside the 66-unit safe circle | The Android adaptive icon's foreground over a `board` background, and its monochrome layer |
| `minhajna-mark-chalk.svg` | The letter alone in `chalk` | On `board`: above the name on the welcome hero, the lock screen and the web app's unlock screen |
| `minhajna-mark-ink.svg` | The letter alone in `ink` | On paper, and anything printed in black and white |
| `minhajna-wordmark-ink.svg` | The wordmark «منهاجنا», outlined, in `ink` | On paper and light surfaces, wherever the name stands without the icon |
| `minhajna-wordmark-chalk.svg` | The wordmark, outlined, in `chalk` | On `board` surfaces |
| `minhajna-lockup-ar.svg` | The Arabic lockup: the icon on the right, the `ink` wordmark to its left | The website's header, the README and the store's feature graphic |

The letter is drawn, not typed: it follows Ruqaa without copying any font, so it belongs to the project. The wordmark files are outlines of «منهاجنا» set in Aref Ruqaa Bold, shaped as the font sets it. The font is under the SIL Open Font License 1.1, which lets artwork made with it, such as a logo, be used freely; the outlines are artwork, not a font.

## The wordmark and the lockups

- **The wordmark** is «منهاجنا» set in Aref Ruqaa Bold (the `brand` style). In Latin letters it is "Minhajna" in Noto Sans SemiBold, never in a script face.
- **The Arabic lockup** puts the icon on the right and the wordmark to its left, centred on the icon. The wordmark is about three quarters of the icon's height, and the gap is a quarter of the icon's width.
- **The Latin lockup** mirrors it: the icon on the left, "Minhajna" on the right. It is still live text in Noto Sans SemiBold, until that font's file is part of the project too.
- **The welcome hero** sets the wordmark in `chalk` on `board`, with the chalk underline beneath it and the tagline «من المخطط السنوي إلى درس اليوم» under that.
- **On the web sidebar** the wordmark alone is set at 40px in `chalk`.
- **The about rows** in Settings and Help show the icon beside the version.
- **Screens** that set the name as text, such as the welcome hero, use the `brand` style. Files that leave the app, such as the website and the store listing, use the outlined files.

## Space and size

- Leave clear space on every side of at least a quarter of the icon's width.
- The icon works down to 24px. At 16px, as a browser tab icon, use the full tile, never the letter alone.
- Set the wordmark no smaller than 18px.

## Colour

- Use only `board` and `chalk`, or `ink` on paper. In black and white, use `minhajna-mark-ink.svg`.
- Never put the letter in a subject colour, `hi` or any status colour. Never outline it, add a shadow or a gradient, or put it on a photo.
- Never stretch, rotate or redraw the letter. Never set the wordmark in another face.

## The name and who may use it

- **Spelling.** «منهاجنا» in Arabic, written «منهاجنا» in Arabic sentences; "Minhajna" in Latin letters, never "Minhadjna" or "Manhajna". The line under the name is «من المخطط السنوي إلى درس اليوم», in English "From the yearly plan to every lesson" (PRD [§1.9](https://github.com/djazairdev/minhajna/blob/main/docs/prd/PRD.md#19-official-builds-releases-the-name-and-security)).
- **Not the state's.** Nothing in the logo suggests the Ministry or the state. Never place it beside the state's emblem or the Ministry's logo as if they were one, and never call the app official (PRD §1.9, principle 6).
- **The Ministry's deployment** carries the Ministry's own name and icon, set as settings. Only the project's own builds are called Minhajna and carry this logo (PRD [§5.2](https://github.com/djazairdev/minhajna/blob/main/docs/prd/PRD.md#52-architecture)). Screens of the national system show the deployment's name where the canvas now shows «منهاجنا».
- **Forks** may reuse the code, but under another name and another logo, with nothing that looks like this one (`TRADEMARKS.md`). The name and the logo are not registered trademarks.
- **Documents** belong to the teacher and the school. Leave the logo off the texts book, the journal, the roll-call book and every other document a director or an inspector checks.
