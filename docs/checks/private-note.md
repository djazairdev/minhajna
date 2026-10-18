# Android PrivateNote (#132)

Local checks on 2026-10-18 for [#132](https://github.com/djazairdev/minhajna/issues/132), on `codex/132-private-note`, based on main `85bfb3a`. These are local results, not remote CI results.

## Behaviour and scope

- A controlled private-note panel uses the distinct `private` ground, a decorative lock, a growing multiline `TextField` and the visible privacy reminder. The caller supplies all translated words, the value, and editing callbacks; the panel neither stores nor sends the note.
- The label and the assurance that the note stays on the teacher's devices form one native associated label, before the input. The lock and its wrapper are hidden from accessibility; the panel does not combine the whole form into a single focus target. Filling the input does not replace its accessible name with its value. Spoken TalkBack acceptance still needs human listening.
- The Arabic assurance is «لا تغادر أجهزتك». The reminder is «يُرجى عدم كتابة تفاصيل صحية أو تأديبية تخص التلاميذ، هنا أو في الدفتر.» Both remain visible and may wrap, without ellipsis, font shrinking or a font-scale cap.
- The existing `TextField` gains an optional decorative label icon. Callers without an icon keep the existing label layout and native association. A filled text area also keeps its intrinsic initial height until the first native content measurement; imposing the 80 dp height before that measurement could leave a long initial note clipped on Android 15 at 200%. A regression test failed before this fix. Later measurements still grow and shrink the field without counting padding twice. The input remains full-width and retains focus feedback, autofill opt-out and disabled autocorrect/spellcheck. These platform hints do not control independently installed keyboards or accessibility services.
- Two editable gallery examples show empty and long invented preparation notes in Arabic, French and English. Their edits stay in independent transient preview state and disappear on unmount. No pupil details are used.

This slice adds no dependency, permission, network call, persistence, encryption, export, school-space access, record or history change. `NETWORK.md` and both lockfiles are unchanged. It does not by itself implement private-layer storage or enforce export boundaries: future screen callers must use the existing core layer checks. PrivateNote is currently used only in the debug gallery. The initial-height fix also benefits existing multiline fields in release screens, so it has an English/Arabic changelog fragment.

## Automated and build checks

| Check | Local result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit --offline` pass |
| Type checks | Root and Android pass |
| Lint and formatting | Pass |
| Core and sync-check tests | 262 core and 13 sync-check tests pass |
| Focused Android checks | 150 tests across nine suites pass, including PrivateNote, TextField, gallery and contrast |
| Full Android suite | Merged with main `70f7d34`, which includes the `joint-class.test.tsx` teardown fix from #202: 1,085 tests in 90 suites pass and the command exits 0 |
| Component | All three languages, both directions and 100%/200% font-scale contracts; associated label order, hidden lock, caller-controlled editing, newlines, growth/shrinkage, ref/focus/blur, optional/error text and editability |
| Gallery | Nine uniquely labelled inputs; empty/long note edits are independent and reset on remount; `accessibilityProblems` is empty in both directions |
| Contrast | Label/reminder/lock on `private` exceed 4.5:1; input outline against `private` exceeds 3:1 |
| Native build | ARM64 debug APK builds using the offline Gradle cache |
| Hygiene | REUSE, Gitleaks, formatting and diff checks pass; every changed/new maintained file is under 300 lines |

An earlier run on main `85bfb3a` exited 1 with imports after the Jest environment had been torn down in `joint-class.test.tsx`. #202 fixed that test on main; the rerun above has no teardown error and no `act` warning.

Toolchain: Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1, React Native 0.87.1 and React 19.3.1. The isolated REUSE invocation uses its cached `chardet` detector because the default detector misidentifies an unchanged Arabic fixture; this does not add an app dependency or alter licence declarations.

## Native observations

The ARM64 debug APK installs and opens on isolated AOSP Android 8/API 26 and Android 15/API 35 instances, each 360×800 dp (720×1600 pixels, density 320). The Android 15 instance is disposable/read-only to avoid disturbing another running device. A temporary local preview-server forward is used only for the debug bundle, not a new release network flow.

- At 100% Arabic text size, the empty and long examples show the lock beside the label/assurance, the distinct private panel, and the full reminder. The long value wraps and the field grows beyond the empty field's 80 dp height.
- At confirmed system text scale 2.0 on both versions, the label/assurance and reminder wrap without horizontal clipping. Fresh-mount checks confirm that the long note expands before any editing. The Android 15 initial-height failure found during this check is the reason for the shared-field fix above; the post-fix result is not inferred from unit tests alone.
- On Android 8 at 200% with the gallery forced to LTR, the lock moves to the left of the wrapped label, the input aligns left, and the Arabic assurance and reminder remain readable. This is a local gallery direction override, not a global app-language change.
- At 200%, adding invented Latin text and a newline to the empty Arabic example on Android 8 grows the field. Editing the long mixed-script example on Android 15 preserves its Arabic content and expands the field; the focused input is fully above the keyboard in both checks. These observations cover the existing gallery keyboard wrapper, not future form screens.
- Native metadata exposes real `android.widget.EditText` controls and the combined label/assurance. Metadata is not proof of what TalkBack speaks.

Only synthetic gallery content is used. Screenshots, APKs, temporary navigation helpers and logs stay outside the repository. Font scales are restored to 1.0 and app languages remain Arabic; this task's temporary forwards, device dumps, preview server and emulator instances are removed or stopped. The other running emulator is untouched.

## Remaining human/device checks

No human TalkBack listening acceptance is claimed. Confirm title → own-devices assurance → native edit box, no lock focus stop, whether the middle dot between the title and the assurance is spoken, and access to the reminder in Arabic, French and English, with empty and filled notes. Native French/English layouts and entry, full Arabic-keyboard composition, selection/cursor behaviour, landscape and physical/budget-phone behaviour are not certified here. Component font-scale contracts do not substitute for native visual checks.

To repeat: run the contributor checks, build/install the debug APK, open developer menu → **Component gallery** and find **PrivateNote** after **TextField**. Try both examples, both directions, all three languages and 200% system text. Changing system text size recreates the preview activity; reopen the gallery afterwards. Enter invented text only and verify that the focused field remains reachable above the keyboard. Restore test settings and remove temporary preview forwards when done.
