# Plan layers

Checks of 21 October 2026 for [#226](https://github.com/djazairdev/minhajna/issues/226), from [#336](https://github.com/djazairdev/minhajna/pull/336), [#338](https://github.com/djazairdev/minhajna/pull/338) and the pull request that adds this record. Made-up layers, keys and classes only.

## What changed

- **Layers between the pack and the class** (answers 337 to 341, [Plan-layers](../design/screens/Plan-layers.png)):
  - A district layer is an inspector's distribution, credited and used with their consent, signed by the curators with a key that may sign packs.
  - A school layer is one class's changes, shared by the subject's coordinator, and its sender is not verified.
  - Each is a list of operations over one pack, whatever its release.
  - The plan applies the district layer, then the school layer, then the class's own changes. Anything that no longer fits is left out, including a layer's split of an item an exam-window answer names.
- **One switch per class:** taking a layer in switches nothing on. Each class has one layer at most at each level, switched on or off on Plan-layers. Switching a layer off brings its items back as they are below it, and recorded sessions never change.
- **The layer card:** «تنويع، ليس رسمياً», who made the layer, «موقّع من: …» or «لم يُتحقق من المرسل», every operation in the words of «تغييراتي», and the terms the operations touch. No layer is ever called official.
- **Import** (answer 343), from «استيراد طبقة» on Plan-layers, by file or QR code:
  - A district layer only comes signed, and a school layer never comes signed.
  - The layer shows as the class would read it, including the items it adds or splits itself.
  - Only a layer of the class's pack is taken in. A copy already taken in, or another layer under the same ID, is not.
  - A layer that comes from another device or a backup is checked again (`addedLayerHolds`).
- **The coordinator's export** (answers 342 and 345): «مشاركة تغييراتي طبقةَ مؤسسة», offered only to a class with changes in force.
  - The teacher types the title and who made the layer, with no default name, and can add a note.
  - The screen shows the layer as colleagues will read it, then hands a file of at most 16 KB and 200 operations to Android's share sheet.
  - Nothing is recorded, and an edit after a share gives a new layer under a new ID.
  - The file holds no pupil, mark, roll call or recorded session.
  - Showing the layer as a QR code waits for a follow-up issue.
- **Records:** two new ones, `layer.added` and `layer.switched`, in the lesson-record layer. A new payload format, `minhajna.plan-layer`, travels plain for a school layer and inside a signed file for a district layer. The only native change is a share of one small file from the app's cache, the way PDFs are shared. No permission or network call changes.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `variant-layers.test.ts` (9): the order of the layers, IDs of what a layer adds or splits, switching per class, one layer per level, titles kept after switching off, left-out operations, records and handover. `variant-read.test.ts` (7): signed and plain files, refused keys and changed files, every field, the size limits, the re-check of a layer from another device, and the export reading back |
| Android tests | `plan-layers.test.tsx` (11): Plan-layers in Arabic, French and English, signer and sender lines, switching, the plan's link, and the import with its refusals. `plan-layer-export.test.tsx` (8): the shared file read back as a school layer with nothing recorded, a new ID after an edit, the needed fields, a failed share, a layer too large, and the export offered only with changes |
| Native | `./gradlew --offline :app:compileDebugKotlin` passes |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** each layer card's head reads as one item, each operation on its own, and each switch names its layer and class.
- **On a phone:** Plan-layers, the import and the export right to left and left to right, with text at 200%, on Android 8 at 360×800. Also: a layer file opened from Files, a QR code scanned, and the export's file sent through the share sheet and opened on a second phone.
