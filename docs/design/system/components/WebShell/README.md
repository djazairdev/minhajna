# WebShell

The web app's frame: a 232px `board` sidebar, the main area, and a detail pane of 340px.

- **The sidebar** holds:
  - the name in `brand` at 40px;
  - who and where, in `chalk-75`;
  - links in `chalk-82`, with the current link on `chalk-14`;
  - the sync line at its foot.
- **The main area** opens with a heading in `web-heading`. The detail pane is `sheet` with a `line` edge.
- **Name.** In the national system the sidebar shows the deployment's own name, set by the Ministry, never «منهاجنا» (PRD [§5.2](https://github.com/djazairdev/minhajna/blob/main/docs/prd/PRD.md#52-architecture), [§1.9](https://github.com/djazairdev/minhajna/blob/main/docs/prd/PRD.md#19-official-builds-releases-the-name-and-security)). The canvas's national boards still show «منهاجنا»: fix them before building.
- **Canvas:** Web-week, Web-unlock, Web-update and 25 national boards (D-, M-, N-, I-, Ops-). PRD [§6.6](https://github.com/djazairdev/minhajna/blob/main/docs/prd/PRD.md#66-the-web-app).
