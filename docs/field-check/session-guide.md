# Running a field-check session

Use this guide to run a session with 5 to 10 teachers, a few directors and an inspector ([PRD §10.2](../prd/PRD.md#102-the-field-check)). It covers installation, verification, resetting and removal, following F2 and F9 of the [field-check plan](https://github.com/djazairdev/minhajna/issues/49).

Give teachers the [Arabic download and testing page](https://djazair.dev/ar/minhajna/) or its [English version](https://djazair.dev/en/minhajna/). Verification, reset, build and signing instructions below are for the organiser.

- [What the preview is](#what-the-preview-is)
- [Before the session](#before-the-session)
- [Installing it](#installing-it)
- [Checking that it is the project's preview](#checking-that-it-is-the-projects-preview)
- [Updating the preview](#updating-the-preview)
- [Going back to the demo class](#going-back-to-the-demo-class)
- [Removing it](#removing-it)
- [Making the preview](#making-the-preview)

## What the preview is

- **The signed preview:** the latest from the project's [releases page](https://github.com/djazairdev/minhajna/releases/latest), or handed over by the organiser.
- **Made-up data only:** use «إضافة القسم التجريبي» in setup, or invented names. Keep using official school records.
- **Offline:** entries stay on the phone. Opening the source link asks before launching the browser; no app record or identifier is attached.
- **Included:** the demo class and the 2026/27 calendar, from 0.2.0 the app lock and the paper books printed from what is recorded, from 0.3.0 the full class plan, the calendar with its signed updates, and notifications, and from 0.4.0 marks, from continuous assessment to the term export and the class-council pack. Complete field-check plan packs are still pending ([#23](https://github.com/djazairdev/minhajna/issues/23)).
- **Compatible Android 8-or-later phones.**

## Before the session

- Have the universal installer, `minhajna-<version>.apk`, and the published file and signing-certificate checksums. Use it for compatible ARM phones; smaller ARM-specific installers are optional for organisers who know the device.
- Charge the phones and download or transfer the installer beforehand. Testing works offline.
- Explain that there is no backup or recovery. Use invented data only, never real school records.
- If no session appears during the first try, check the teacher's timetable and the calendar's holidays.

## Installing it

1. Use the project's download link, or transfer the checked installer by USB or memory card.
2. Open the file. If asked, allow that browser or file manager to install apps, then choose **Install**.
3. Turn that permission off afterwards.

Keep Play Protect on. The preview is not on Google Play, so Play Protect may say that it doesn't recognise the app or its developer: check the file's checksum first ([below](#checksums--البصمات)), then choose to install anyway. If Android says the app is harmful, or blocks it outright, stop: don't install it, and ask the maintainers. [Google's guide](https://developers.google.com/android/play-protect/warning-dev-guidance) explains the messages.

## Checking that it is the project's preview

Open the app, then «المساعدة والخصوصية» from Today. Under «عن «منهاجنا»», it shows:

- the version and build code;
- «بصمة هذا التطبيق»: the SHA-256 checksum of the installed APK;
- «بصمة شهادة توقيعه»: the SHA-256 checksum of the certificate that signed it.

Compare both checksums with those published for the installed file. Each installer has its own checksum; all share the same signing certificate. If either differs, stop using that copy and ask the organiser for help.

من «المساعدة والخصوصية»، قارن «بصمة هذا التطبيق» و«بصمة شهادة توقيعه» بالبصمتين المنشورتين للملف نفسه. إن اختلفت إحداهما، توقّف عن استعمال النسخة واطلب المساعدة.

### Checksums · البصمات

Each release lists the SHA-256 checksum of every file in its `SHA256SUMS.txt`: see the [latest release](https://github.com/djazairdev/minhajna/releases/latest) and [its checksum list](https://github.com/djazairdev/minhajna/releases/latest/download/SHA256SUMS.txt). Use the list of the version you installed.

تجد بصمة كل ملف في قائمة `SHA256SUMS.txt` للإصدار نفسه.

Project signing certificate SHA-256, the same for every release and file / بصمة شهادة توقيع المشروع، وهي نفسها لكل إصدار وملف:

`de2a5a7839bb88733456078bb937179f43ff99004d2408cb965093aa0aed6a5b`

## Updating the preview

Updates are manual, announced on [Facebook](https://www.facebook.com/djazairdev). Use the new download link in the announcement, or the [download page](https://djazair.dev/en/minhajna/).

1. Leave the current app installed. Download the new version and open its installer.
2. Choose **Update**, reopen Minhajna and check the entries are still there. Updating from 0.1.0, the app first asks for a new 4-digit PIN. Updating to 0.3.0, Android asks once whether Minhajna may show notifications; either answer keeps the entries. Turn installation permission off again if you enabled it.

**Never uninstall or clear storage to update: that deletes the entries.** If Android refuses the update, stop, do not install an older version, and [ask for help](https://djazair.dev/en/minhajna/#feedback).

## Going back to the demo class

**Clearing storage permanently deletes all entries.** Use this only to reset made-up data between teachers or start again, never to update.

1. In Android's **Settings**, open **Apps**, then **Minhajna** («منهاجنا»).
2. Open **Storage**, then **Clear storage**, and confirm.
3. Open the app. It starts again at «لنبدأ», with nothing kept.
4. In setup, at «الأقسام والتلاميذ», choose «إضافة القسم التجريبي» and pick the year.

## Removing it

Uninstall through **Settings › Apps › Minhajna**. This deletes the encrypted records and their key, with no recovery; they are excluded from cloud backup. Delete the installer from Downloads separately if no longer needed.

## Making the preview

<details>
<summary>Build, sign and publish</summary>

For the maintainer who releases it ([releases.md](../contributing/releases.md#signing)):

1. Build the release APKs from the tagged commit, as in [the Android build check](../checks/android-build.md#repeating-the-build). There are three: the universal APK, with both supported ARM processor types, and the smaller APKs for 32-bit and 64-bit ARM separately. They come out unsigned, so that two builds can be compared, and each has its own version code ([versioning.md](../contributing/versioning.md#the-apps)).
2. Sign each one with the project's key, which never enters the repository. Sign without moving the files inside the APK, so the signature can be checked against any rebuild ([Checking a signed APK](../checks/android-build.md#checking-a-signed-apk)):

   ```sh
   cd app/build/outputs/apk/release
   apksigner sign --ks <project key> --alignment-preserved --v1-signing-enabled false --v4-signing-enabled false --out minhajna-<version>.apk app-universal-release-unsigned.apk
   apksigner sign --ks <project key> --alignment-preserved --v1-signing-enabled false --v4-signing-enabled false --out minhajna-<version>-armeabi-v7a.apk app-armeabi-v7a-release-unsigned.apk
   apksigner sign --ks <project key> --alignment-preserved --v1-signing-enabled false --v4-signing-enabled false --out minhajna-<version>-arm64-v8a.apk app-arm64-v8a-release-unsigned.apk
   ```

3. Publish the three APKs, each with its SHA-256 checksum, and the certificate's checksum, the same for all three:

   ```sh
   sha256sum minhajna-<version>*.apk
   apksigner verify --print-certs minhajna-<version>.apk
   ```

   Keep the shrinker's mapping, `apps/android/android/app/build/outputs/mapping/release/`, with the release's files, so that a crash report from these APKs can be read. CI keeps its copy for 90 days only.

4. Install the universal APK on a phone, and check that «المساعدة والخصوصية» shows its checksum and the certificate's.

</details>
