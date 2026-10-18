# The app lock

How the app lock was checked for [#210](https://github.com/djazairdev/minhajna/issues/210) (PRD [§6.4](../prd/PRD.md#64-security-on-the-device)): the PIN and the phone's fingerprint or face, the automatic lock, «القفل والأمان», the screen guard and the backup. Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [The result](#the-result)
- [The screen guard](#the-screen-guard)
- [The database on a rooted image](#the-database-on-a-rooted-image)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## The result

| Check | Result |
|---|---|
| A fresh install asks for the PIN twice, then shows the privacy notice | **Passed** |
| Every start asks for the PIN, after the app is killed and after a restart | **Passed** |
| An update from a 0.1.0 history keeps its records under the new PIN | **Passed,** with 397 made-up entries |
| Five wrong PINs bring a wait of 30 s, which counts down and ends | **Passed** |
| The app locks after its delay unused, and comes back to the same screen | **Passed** at 5 minutes behind the home screen and at 1 minute in front |
| The delay is kept: after a restart the lock screen states 1 minute | **Passed** |
| Changing the PIN: the old one stops working, the new one opens | **Passed** |
| Screenshots and the recent-apps preview are blocked on screens with records | **Passed** ([below](#the-screen-guard)) |
| Android's backup refuses the app | **Passed.** `bmgr backupnow` answers "Backup is not allowed" |
| The database cannot be read without the lock | **Passed** on a rooted image ([below](#the-database-on-a-rooted-image)) |
| The fingerprint or face prompt | **Open.** Enrolling a fingerprint on the emulator needs a screen-lock PIN, which the checks do not set |

All 44 device tests pass on the same emulator, `LockTest`, `LockAttemptsTest` and `LockSettingsTest` among them.

## The screen guard

The window is secure from the start, and stays secure on every screen of the record book unless the teacher allows screenshots. The PIN pads stay secure even then, so no recording shows a PIN being typed. Only the screens with no records and no PIN pad are open: the welcome, the notices, Help, the licences, the connections and «القفل والأمان». A screen the app does not name stays secure, and so does the screen while the app locks or opens the history.

| Screen | Window flag | Screenshot |
|---|---|---|
| Welcome | not secure | taken |
| Choosing the first PIN | `SECURE` | black |
| Privacy notice | not secure | taken |
| Setup: classes, with the demo class | `SECURE` | — |
| Today | `SECURE` | — |
| Help, «القفل والأمان» | not secure | taken |
| Changing the PIN | `SECURE` | — |
| Today, screenshots allowed | not secure | taken |
| Changing the PIN, screenshots allowed | `SECURE` | — |
| The lock after a restart, screenshots allowed | `SECURE` | — |
| Recent apps, from Today | — | a black card |

The flag was read with `adb shell dumpsys window`. Read 25 times in a row while the PIN was typed and Today opened, it was `SECURE` every time.

## The database on a rooted image

With the app stopped, so its key was in no memory, `adb root` gave access to the app's files:

- `no_backup/history.db` has no SQLite header. None of 37 made-up pupil names, the school's name or any record kind appears in it.
- `no_backup/history.lock` is 109 bytes: the key, sealed under the PIN and then under the Keystore. No `history.key` remains.
- The lock's settings file holds the delay and the screenshot choice, and nothing else.

## Repeating the checks

- Device tests: `./gradlew :app:connectedDebugAndroidTest` from `apps/android/android`, with one emulator running.
- The flag on the screen in front: `adb shell dumpsys window | grep -A30 MainActivity | grep "fl="`.
- The backup: `adb shell bmgr backupnow dz.minhajna.preview`.

## Still open

- The fingerprint or face prompt on a real phone, on Android 9 and later.
- TalkBack in Arabic and text at 200% on the lock screens and «القفل والأمان», with the screens in [#206](https://github.com/djazairdev/minhajna/issues/206).
- Android 8 on a 360×800 budget phone.
