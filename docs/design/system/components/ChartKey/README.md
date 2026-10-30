# ChartKey

The marks every chart uses, and their key: recorded, projected, reference, the exam threshold, held-back figures, bands and tracks.

- **The latest figures:** a solid `board` line. **An earlier snapshot,** such as the end of term 2: a dashed `pencil` line. **An older one,** such as the end of term 1: a dotted `hatch` line.
- **The threshold:** a `threshold` line with its chip, solid once published and dashed until then (PRD [§7.10](https://github.com/djazairdev/minhajna/blob/main/docs/prd/PRD.md#710-exam-thresholds)).
- **Held back:** hatched cells for figures under the minimum group size (PRD [§5.10](https://github.com/djazairdev/minhajna/blob/main/docs/prd/PRD.md#510-the-permission-model)).
- **Bands** for ranges of totals. **Tracks** for progress, always with the figure written.
- **Every chart has a table** of the same figures, and mirrored axes in right-to-left layouts (PRD [§5.2](https://github.com/djazairdev/minhajna/blob/main/docs/prd/PRD.md#52-architecture)).
- **Canvas:** T-Threshold, T-Threshold-after, T-Threshold-totals, D-Threshold, M-Threshold, N-Threshold, N-Published, M-Totals, N-Totals, Obs-Report.
