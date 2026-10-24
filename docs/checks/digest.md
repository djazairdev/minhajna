# The weekly digest and notifications

Checks of 22 October 2026 for [#234](https://github.com/djazairdev/minhajna/issues/234), from [#379](https://github.com/djazairdev/minhajna/pull/379) to [#383](https://github.com/djazairdev/minhajna/pull/383), answers 402 to 410. Made-up schools, classes and pupils only.

## What changed

- **The week's facts in the core** (answers 402 and 405):
  - `weekDigest` covers the week before the digest day, Sunday to Thursday, or Saturday to Friday for a teacher who works on Saturdays. Opened midweek, it covers the week so far.
  - It counts the sessions confirmed, those awaiting and earlier weeks' awaiting apart. It also gives the make-ups owed, the sessions lost to a holiday, a closure or a day of the teacher's own calendar, each class's next exam window, and each class behind a parallel one before a common test or exam window.
  - Only this year's classes count; an archived class does not.
  - `notifyPlan` works out the next 14 days' digests and previews, outside the quiet hours.
- **The Digest screen** (answers 402 and 405, [Digest](../design/screens/Digest.png), [Digest-closure](../design/screens/Digest-closure.png), [Digest-primary](../design/screens/Digest-primary.png)):
  - «ملخص الأسبوع» opens from the Classes tab and from the digest notification. It is worked out when it opens and says it reaches the teacher alone.
  - The sessions awaiting confirmation open Today's list. Each make-up due has «جدولتها».
  - Sessions lost to the calendar are counted apart, by day and entry, and for each class, so a closure never reads as slow teaching. In two schools, each loss and each exam window names its school.
  - A class behind a parallel one has «مواءمة», «خيارات الاستدراك» and «تجاهل». A drift dismissed on either class's plan stays dismissed.
  - Each class's card gives its pace as on the Classes tab: in whole plan weeks once a week pack is a week behind beyond its buffers, otherwise in sessions, with the buffers used and left. It also gives this week's losses, the item it is on and TD's own list before the exams. «المخطط» opens the class's plan, and «خيارات الاستدراك» shows while it has used buffers or is behind.
  - A week pack's card, as in primary, also gives the plan week the class is in beside the plan's, «في أسبوع المخطط 5، والمخطط اليوم في أسبوعه 6» (answer 409).
  - With «العدّ بالدقائق» on, the usual minutes go beside the pace's sessions and beside every count of sessions lost: for the week, each day and each class.
  - **Not as drawn on Digest-primary** (answers 409 and 410), so that a class reads the same on the Digest, the Classes tab and its plan:
    - buffers stay a count of sessions, not half-weeks placed in the plan;
    - minutes are a plain count, not hours and minutes, and no banner says that «العدّ بالدقائق» is on;
    - the plan week is set beside the plan's own week today, not the school week;
    - «الموقع: …» gives the item, not the session within it;
    - re-pacing stays the fifth of «خيارات الاستدراك», not a button of its own, and remediation is not mentioned, since it never moves the plan;
    - the title covers all the teacher's classes, not one class.
- **«الإشعارات» in Settings** (answers 402 to 404, [Notif](../design/screens/Notif.png)):
  - The weekly digest is on by default and the daily preview off. «العمل يوم السبت» moves the digest to Saturday morning and shortens the weekend's quiet hours.
  - The quiet hours are listed: 20:00 to 07:00 every day, and Thursday 20:00 to Sunday 07:00, or to Saturday 07:00.
  - No notification shows a pupil's name or a mark. Each choice is kept the moment it changes.
  - When Android does not let the app notify, the screen says so with «السماح بالإشعارات».
- **The notifications** (answers 403 and 405 to 408):
  - While the app is open it hands the next 14 days' notifications, with their words, to its own Kotlin module. The module sets one alarm each and keeps the list on the phone, outside the history. Nothing is worked out when a notification shows.
  - The digest comes on Sunday or Saturday morning. The preview comes at 19:00, or at 07:00 after a quiet evening, as «اليوم». Each may come up to an hour late, never early.
  - After a restart, the alarms not passed yet are set again.
  - A tapped digest opens the Digest and a tapped preview opens Today, also while the app is open. Reopening from Recents opens neither again.
  - Android 13 and later ask for the permission once, after setup.
  - On a lock screen that hides sensitive content, only the notification's title shows.
- **Waiting for their own issues** (answer 404): the year-end prompts (R-5.7-04). The 30-day backup reminder (R-6.5-07) came with #247, in «تذكيرات نادرة»: see [its checks](transfer-backup.md#part-5-the-30-day-backup-reminder).

The app asks for two new permissions, `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED`. Still no network permission, push service or server: NETWORK.md says so. PRIVACY.md is unchanged; #234 asks the founder whether it should get a line on notifications. The history gains no event.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `digest.test.ts` and `notify-times.test.ts`: the week covered for both kinds of teacher, the counts, a closure, a holiday and the teacher's own day counted apart and never an exam, the make-ups, the exam windows, the drifts, past years' and archived classes left out, the quiet hours, the moved morning preview, the year's last week, and the 14-day plan |
| Android tests | `digest.test.tsx`, `notify-prefs.test.ts`, `notify.test.tsx` and `notify-plan.test.tsx`: the week's range and counts, the sessions awaiting, the make-ups, a closure's losses for the week and each class, the exams, the drifts and their buttons, the catch-up button, «المخطط», two schools, Saturday work, a primary class's plan week with minutes beside its losses and no plan week for a secondary pack, the switches kept, the plan handed to the module, the permission asked once, the taps, and the notice when notifications are off. `digest-rules.test.ts`: the plan week beside the plan's, the same when the plan marks none, nothing when the item has no week, and the line that says it. Also `digest-scale.test.tsx`: the Digest with a make-up due, a class behind and a closure, and «الإشعارات» with every switch on and notifications off, in Arabic and English with text at 100% and 200% |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Colour | Checked by reading the code: nothing new relies on colour alone. A class behind and a drift are said in text, with the drift's badge |
| Type check, ESLint, Prettier, Kotlin compile | Pass |
| Android 15 emulator, release build | The APK holds exactly `USE_BIOMETRIC`, `CAMERA`, `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED`. The permission dialog came once, after setup. `dumpsys alarm` showed digest alarms for Sunday 25 October and Sunday 1 November at 07:00, each with a one-hour window. The receiver posted «ملخص الأسبوع» with the app's icon and its fixed text. A tap opened the Digest, from the background and while open. Reopening from Recents stayed on Today, and after a reboot both alarms were set again |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:**
  - the Digest's sections, the make-up strips, the drift card's three buttons and each class's card;
  - «الإشعارات»: the three switches, «تذكير النسخ الاحتياطي» under «تذكيرات نادرة», the quiet hours and «السماح بالإشعارات»;
  - a digest and a preview notification read from the shade.
- **On a phone:**
  - right to left and left to right, with text at 200%, on Android 8 at 360×800; the Digest and «الإشعارات» wrap without clipping, with touch targets of at least 48 dp;
  - a real Sunday morning on a phone left in Doze overnight: the digest comes between 07:00 and 08:00, and nothing during the quiet hours;
  - a preview turned on: it comes between 19:00 and 20:00, and on Sunday morning as «اليوم» between 07:00 and 08:00;
  - the lock screen with sensitive content hidden shows only the title;
  - on a budget phone, the time to open the Digest for a teacher with eight classes, recorded in #206.
- **With teachers:** whether the Sunday digest's facts read as facts, not as a judgement, and whether the preview is worth turning on.
