# Erasing a device after a direct transfer

Local verification for [#494](https://github.com/djazairdev/minhajna/issues/494), on 2026-11-01. All records are made up.

## Coverage

The erase warning counts a direct transfer only after the teacher confirms it opened and while the handover is active. Both ways of ending a handover clear its coverage. A valid confirmation or ending is not counted as an unsaved edit.

The warning reuses the exact backup and restore boundaries from #485. It can fall back to a retained backup or restored archive, and counts changes made while the backup file was saving. A received transfer does not prove that the source device still holds a copy. The backup reminder keeps its own date.

The messages share the backup and restore catalogue. Tests cover both handover endings, the fallback to an earlier file, backup and transfer races, and both app platforms' warning text.
