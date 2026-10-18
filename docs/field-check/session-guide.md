# Running a field-check session

The field check puts a preview of Minhajna in the hands of 5 to 10 teachers, a few directors and an inspector ([PRD §10.2](../prd/PRD.md#102-the-field-check)). This guide is for whoever runs a session with them: installing the preview, checking it, going back to the demo class between teachers, and removing it. It follows choices F2 and F9 of the field-check plan ([#49](https://github.com/djazairdev/minhajna/issues/49)).

- [What the preview is](#what-the-preview-is)
- [Before the session](#before-the-session)
- [Installing it](#installing-it)
- [Checking that it is the project's preview](#checking-that-it-is-the-projects-preview)
- [Going back to the demo class](#going-back-to-the-demo-class)
- [Removing it](#removing-it)
- [Making the preview](#making-the-preview)

## What the preview is

- **An APK handed over directly,** signed by the project. It is not on Google Play, which comes at the launch ([PRD §10.1](../prd/PRD.md#101-the-roadmap)).
- **For made-up pupils only.** Teachers use the demo class, with its 45 invented pupils, or names they invent. The app says so on its first page, «نسخة معاينة», and in full in «المساعدة والخصوصية».
- **No permission at all,** the internet included, and no account. Teachers can check in Android's settings that the app asks for nothing, so nothing leaves the phone.
- **What it holds:** the demo class, offered in setup as «إضافة القسم التجريبي», and the 2026/27 school calendar. The field check's plan packs come once they are keyed in full ([#23](https://github.com/djazairdev/minhajna/issues/23)).
- **Android 8 or later.**

## Before the session

- Have the universal APK, `minhajna-<version>.apk`, and its two published checksums, the APK's and the signing certificate's, from the project's release page. The universal APK installs on any Android 8 phone, whatever its processor. The release page also has smaller APKs, one for each processor type, each with its own checksum; hand those over only to someone who knows their phone's processor.
- Charge the phones. The app needs no network, so the session needs none either.
- Remind everyone: no real pupil's name goes into the preview.

## Installing it

1. Copy the APK to the phone, by USB cable or from a memory card.
2. Open it from the phone's file manager. Android asks to allow installing from that app: allow it for this install.
3. Choose **Install**. Google Play Protect may warn that it does not know the app. That is because it is not on Google Play: choose to install anyway.
4. Turn the setting from step 2 off again.

## Checking that it is the project's preview

Open the app, then «المساعدة والخصوصية» from Today. Under «عن «منهاجنا»», it shows:

- the version, such as `0.1.0 (10099)`;
- «بصمة هذا التطبيق»: the SHA-256 checksum of the installed APK;
- «بصمة شهادة توقيعه»: the SHA-256 checksum of the certificate that signed it.

Compare both with the published checksums of the APK that was installed, four characters at a time: each APK has its own checksum, and the certificate's is the same for all. If either differs, the APK is not the project's preview: remove it and install the published one.

## Going back to the demo class

Between two teachers, or when a teacher wants to start again, clear what the app holds:

1. In Android's **Settings**, open **Apps**, then **Minhajna** («منهاجنا»).
2. Open **Storage**, then **Clear storage**, and confirm.
3. Open the app. It starts again at «لنبدأ», with nothing kept.
4. In setup, at «الأقسام والتلاميذ», choose «إضافة القسم التجريبي» and pick the year.

Clearing the storage deletes everything the previous teacher entered, for good. That is what should happen: everything was made up.

## Removing it

Uninstall the app as usual: hold its icon, then **Uninstall**, or from **Settings › Apps › Minhajna**. Android deletes the app's encrypted records and the key that opens them. Nothing stays behind: the app never put anything in the phone's cloud backup, and it has no account anywhere.

## Making the preview

For the maintainer who releases it ([releases.md](../contributing/releases.md#signing)):

1. Build the release APKs from the tagged commit, as in [the Android build check](../checks/android-build.md#repeating-the-build). There are three: the universal APK, for any phone, and one for each processor type, 32-bit and 64-bit ARM, which are smaller. They come out unsigned, so that two builds can be compared, and each has its own version code ([versioning.md](../contributing/versioning.md#the-apps)).
2. Sign each one with the project's key, which never enters the repository. Sign without moving the files inside the APK, so the signature can be checked against any rebuild ([Checking a signed APK](../checks/android-build.md#checking-a-signed-apk)):

   ```sh
   cd app/build/outputs/apk/release
   apksigner sign --ks <project key> --alignment-preserved --v1-signing-enabled false --out minhajna-0.1.0.apk app-universal-release-unsigned.apk
   apksigner sign --ks <project key> --alignment-preserved --v1-signing-enabled false --out minhajna-0.1.0-armeabi-v7a.apk app-armeabi-v7a-release-unsigned.apk
   apksigner sign --ks <project key> --alignment-preserved --v1-signing-enabled false --out minhajna-0.1.0-arm64-v8a.apk app-arm64-v8a-release-unsigned.apk
   ```

3. Publish the three APKs, each with its SHA-256 checksum, and the certificate's checksum, the same for all three:

   ```sh
   sha256sum minhajna-0.1.0*.apk
   apksigner verify --print-certs minhajna-0.1.0.apk
   ```

   Keep the shrinker's mapping, `apps/android/android/app/build/outputs/mapping/release/`, with the release's files, so that a crash report from these APKs can be read. CI keeps its copy for 90 days only.
4. Install the universal APK on a phone, and check that «المساعدة والخصوصية» shows its checksum and the certificate's.
