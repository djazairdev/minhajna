# The encrypted history on the phone

The teacher's history is kept on the phone in an SQLite database encrypted with SQLCipher. Its key is made on the phone and kept wrapped by the Android Keystore ([PRD §6.4](../prd/PRD.md#64-security-on-the-device)). This page records how that storage was checked on Android, for ticket FC-03 of the field-check plan ([#19](https://github.com/djazairdev/minhajna/issues/19)). Every record in these checks is made up.

- [The result](#the-result)
- [The core's storage checks](#the-cores-storage-checks)
- [Killing the app during a write](#killing-the-app-during-a-write)
- [Cutting the power during a write](#cutting-the-power-during-a-write)
- [Backup and device transfer](#backup-and-device-transfer)
- [A full year at start-up](#a-full-year-at-start-up)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## The result

| Check | Result |
|---|---|
| The core's history tests against the app's store | **Passed.** All eight shared storage checks pass on Android 8.0 and 15, on SQLCipher and the Keystore ([#121](https://github.com/djazairdev/minhajna/pull/121)) |
| Killing the app during a write | **Passed.** In 30 rounds, the history always opened, verified and held every write the app had confirmed |
| Cutting the power during a write | **Failed, then fixed.** With SQLite's `synchronous = FULL`, each of three power cuts lost the last confirmed write. With `EXTRA`, 12 power cuts lost nothing ([below](#cutting-the-power-during-a-write)) |
| No database in the phone's backup or device transfer | **Passed.** Android refuses the app's cloud backup, and a device transfer stores nothing from it |
| The database cannot be read without its key | **Passed.** The file has no SQLite header, and none of a full year's made-up text appears in it. A wrong key cannot open it |
| A full year reaches Today in under 2 seconds | **Passed on emulators,** in 0.86 s on Android 8.0 and 1.5 s on Android 15, as medians. **Open on a budget phone** ([below](#a-full-year-at-start-up)) |

The emulators ran on an Apple silicon Mac, without Google Play services, with a 360×800 screen: `minhajna-nav89-api26` (Android 8.0) and `minhajna-nav89-api35` (Android 15).

## The core's storage checks

The core's eight shared storage checks ([#76](https://github.com/djazairdev/minhajna/issues/76)) run in debug builds, from React Native's developer menu: **Storage check**. They go through the app's JavaScript adapter, the bridge, the native module's code, SQLCipher and the Keystore, with the phone's own SHA-256 and random bytes. Each check gets a fresh throwaway history, in its own folder and with its own Keystore key, and deletes it afterwards. The teacher's history is never touched.

All eight pass on both versions of Android. A build made to lose each entry's content on loading fails seven of them, so the checks can fail.

## Killing the app during a write

The storage check screen can write made-up notes to a throwaway history without end, logging each one once its write is confirmed. In each round, a script started the writer, killed the app's process with `SIGKILL` at a random moment, started the app again, and asked it to verify the history.

| Android | Rounds | Lost a confirmed write | Largest history |
|---|---:|---:|---:|
| 8.0 | 15 | none | 4,402 entries |
| 15 | 15 | none | 3,949 entries |

In every round, the history opened, verified, and held every confirmed write. Twice it held one more entry than the log showed: that write was committed, but the app was killed before it could log it.

## Cutting the power during a write

A killed app leaves the phone running, and whatever Android has not yet written to the disk survives. A power cut does not. To check that, a script started the writer, then stopped the whole emulator at a random moment, which loses whatever Android had not yet written to its disk. It then started the emulator from cold and asked the app to verify the history.

| Setting | Android | Power cuts | Lost a confirmed write |
|---|---|---:|---|
| `synchronous = FULL` | 8.0 | 3 | **all three,** the last confirmed write each time |
| `synchronous = EXTRA` | 8.0 | 8 | none |
| `synchronous = EXTRA` | 15 | 4 | none |

The history uses a rollback journal (`journal_mode = DELETE`). A commit is final once the journal file is deleted, but `FULL` does not sync the folder after that deletion. After a power cut the journal can reappear, and SQLite then rolls back the last commit, which the app had already confirmed to the teacher. `EXTRA` also syncs the folder after deleting the journal, which is what SQLite provides it for. The app now sets `EXTRA`, and the device tests check it.

The cost is small. On both emulators a confirmed write takes about 4 ms with `EXTRA`, around 260 a second, and a teacher's tap makes one write.

## Backup and device transfer

The database and its wrapped key live in the app's no-backup folder, which Android leaves out of every backup and transfer. The manifest also sets `android:allowBackup="false"`, which Android 8 to 11 read, and `data_extraction_rules.xml` excludes every domain for cloud backup and device transfer, which Android 12 and later read.

Checked with Android's backup tool (`bmgr`) and its local transport, with Android's backup turned on for the test and off again afterwards:

| Android | Backup | The app | A control: the settings provider |
|---|---|---|---|
| 8.0 | Cloud | "Backup is not allowed" | Backed up |
| 15 | Cloud | "Backup is not allowed" | Backed up |
| 15 | Device transfer | Android ran the app's backup agent; the transport refused it (error -1002) and stored nothing | Backed up |

In no case did the transport store any file from the app.

## A full year at start-up

The target is to reach Today in under 2 seconds on a budget phone with a full year of records ([PRD §6.8](../prd/PRD.md#68-non-functional-requirements)).

**What is timed.** At every start, the app opens the history. That means unwrapping the key, opening the database, loading every entry, verifying every entry's hashes and building the state. Until it has done that, it shows only the welcome page. Once the first screen with content is drawn, the app tells Android, which logs a "Fully drawn" line with the time since launch. That line is what was timed, in release builds. Today's own screen is not built yet ([#32](https://github.com/djazairdev/minhajna/issues/32)). Working out Today's view from the opened state took 17 ms for a middle-school year and 23 ms for a primary year, in debug builds.

**The records.** The core's demo year ([#77](https://github.com/djazairdev/minhajna/issues/77)): 45 made-up pupils, every session confirmed and every roll call taken from 21 September 2026 to 8 July 2027, with homework, details and corrections. That is 396 entries for middle school and 554 for primary. A debug build wrote the year into the app's own, empty history. A release build signed with the same key was then installed over it, keeping the data.

Ten cold starts each, with the app stopped and the file cache dropped before each one:

| Android | History | Fully drawn, median | Slowest | First frame, median |
|---|---|---:|---:|---:|
| 8.0 | Empty | 574 ms | 654 ms | 385 ms |
| 8.0 | Middle-school year, 396 entries | 841 ms | 912 ms | 319 ms |
| 8.0 | Primary year, 554 entries | 860 ms | 916 ms | 289 ms |
| 15 | Empty | 1,129 ms | 1,203 ms | 658 ms |
| 15 | Middle-school year, 396 entries | 1,498 ms | 2,619 ms | 720 ms |
| 15 | Primary year, 554 entries | 1,527 ms | 1,581 ms | 673 ms |

Other emulators were running on the same Mac, so these are upper bounds for this computer. A full year adds about 270 ms on Android 8.0 and 370–400 ms on Android 15, nearly all of it to verify the history. Each entry's two hashes are each worked out by a separate call to the native module.

**The gap.** An emulator on a fast computer says little about a budget phone, which may be several times slower. If a budget phone misses the target, the first thing to change is verification. The native module already hashes a whole list of texts in one call, so the history could be verified in a few calls rather than two per entry.

## Repeating the checks

You need a debug build and Metro, as in the [Android build check](android-build.md). Open React Native's developer menu and choose **Storage check**:

- the eight shared checks run as the screen opens;
- **Write until stopped**, **Verify the crash history** and **Delete the crash history** drive the crash and power checks;
- **Fill with a demo year** writes a demo year into the app's own history, but only while it is empty.

Each result also goes to the log, so a script can read it:

```sh
adb logcat -s ReactNativeJS:V | grep storage-check
```

To kill the app during a write, run `adb shell kill -9` on its process. To cut the power on an emulator, run `adb emu kill`. To time a start, see [Timing the start](android-build.md#timing-the-start).

For the backup checks:

```sh
adb shell bmgr enable true
adb shell bmgr list transports
adb shell bmgr backupnow dz.minhajna.preview
adb shell bmgr backupnow com.android.providers.settings
adb shell bmgr enable false
```

On Android 12 and later, `adb shell settings put secure backup_local_transport_parameters is_device_transfer=true` makes the local transport act as a device transfer. Delete that setting afterwards.

## Still open

- **A budget phone.** Time a start with a full year on a budget 360×800 phone with Android 8, as above.
- **Hashing in batches,** if that phone misses the target.
- **The app lock** that releases the key comes with the pilot (choice F2, [#49](https://github.com/djazairdev/minhajna/issues/49)).
