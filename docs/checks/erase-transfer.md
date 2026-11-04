# Erasing a device after a direct transfer

The erase warning after a direct transfer, [#494](https://github.com/djazairdev/minhajna/issues/494). All records are made up.

## Coverage

The erase warning counts a direct transfer only after the teacher confirms it opened and while the handover is active. Both ways of ending a handover clear its coverage. A valid confirmation or ending is not counted as an unsaved edit.

The warning reuses the exact backup and restore boundaries from #485. It can fall back to a retained backup or restored archive, and counts changes made while the backup file was saving. A received transfer does not prove that the source device still holds a copy. The backup reminder keeps its own date.

On a device that received a copy and has no other, the warning counts the changes made after it arrived, until the copy comes back from another device, which proves no copy. A transfer leaves a restored file named beside it. The log of a printed or saved document, an export, an update, a new recovery key and erasing an old one count as no change; a printed week or re-pacing still does, as the re-pacing reads it. The messages share the backup and restore catalogue. Tests cover both handover endings, the fallback to an earlier file, backup and transfer races, and both app platforms' warning text.
