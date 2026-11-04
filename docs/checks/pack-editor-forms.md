# Pack editor: forms, saved drafts and source pages

Work for [#613](https://github.com/djazairdev/minhajna/issues/613), part of [#531](https://github.com/djazairdev/minhajna/issues/531), checked on 2026-11-02. Tests and screenshots use invented sources only.

## Scope and approvals

The maintainer approved a provisional form using existing controls while #515 lacks an item-form board. The curator's Packs page now opens the same editor for manual plans, copied reference releases and saved drafts. Reference releases are immutable; copying requires an unused release identity. A complete draft edit is saved through #612's existing signed, encrypted national demo-world stream. The editor receives no teacher store, journal, pupil record or private note.

The maintainer also approved PDF.js 6.5.438 (Apache-2.0) for local browser processing, outside Android. The browser imports the PDF engine when a curator opens a source. The parser runs in its own local worker. The build caches the engine, CMaps, Foxit fonts and the JavaScript OpenJPEG decoder for offline use and ships their notices. It excludes the scripting and viewer layers, Liberation fonts, unused ICC profiles, WebAssembly and the optional Node canvas package.

This work uses the curator list and signed release lifecycle from the merged #766 and #782. The editor's own commits cover validation, local PDF processing and the workspace.

## Editing and saving

- One item form covers every item kind, source title, unit, term, week, budget, activity, stages, textbook pages, source page, optional items and buffers. Existing item IDs and unit/TD/main-queue groups stay fixed.
- Each structured source number needs an independent second entry. Opening an existing item leaves confirmations blank; changing a first entry clears its confirmation. Arabic and Latin digits and decimal commas work. Zero, exponents, grouping, unsafe magnitudes and mismatches are refused. Textbook-page text is re-entered too. A source page is required and, with an open PDF, cannot exceed its page count.
- Whole-pack validation protects ordering, unit links, stage references, merge references and migration references. Removing or moving an item never silently removes dependent fields. Original reference objects and teacher pins do not change.
- The structure form handles week, budget and hybrid anchors, hour/session budgets, stage templates and weekly activities. Weekly counts are independently entered. An activity used by an item cannot be removed. Other source-language names survive.
- A new plan starts with checked source metadata and a chosen timing model. Its empty local form has no saved placeholder item. Its first complete item creates the saved draft. Existing release identities cannot change through metadata editing.
- A failed history read blocks creation. A damaged stream shows verified releases for viewing only. A draft retains the revision it opened and a competing edit cannot be overwritten. Failed saves retain the typed fields. Published, superseded, withdrawn and other actors' releases are read-only. Editing a curator's reviewed draft returns it to draft through the lifecycle.
- Save and input controls prevent overlapping edits while a write is pending. Leaving a world or role removes the desk. An old response cannot replace the current world's state. A joined curator refreshes the checked world day after it moves and can retry without re-entering a form.

## Local PDF processing

The file picker opens a local PDF, not a source URL. Its bytes, name, metadata and rendered images are never included in a release or sent to a server. The source must be reopened after leaving the draft. Only the curator's entered public source reference and item page travel with the accepted pack, as the existing format already allows.

Page images and extracted plain-text rows appear beside the form on a wide PC, and stack on a narrow screen. The page can be enlarged and scrolled. Text positions suggest rows and titles; a leading number may suggest a week. These are visibly unchecked proposals, not accepted plan data. The curator chooses a row, retypes its title from the image, corrects the proposal and independently re-enters every number. Arabic presentation forms are normalised to ordinary Arabic letters so keyboard input can match the extracted words. No title or numeric confirmation is filled automatically.

A scanned or drawn page without text remains visible for manual entry. There is no OCR, AI call or automatic table interpretation. Complex layouts can yield wrong row boundaries or ordering; the page image remains the authority. Extraction does not establish accuracy or permission to publish.

The parser runs in a separate worker with its general-purpose network, browser-storage and child-worker entry points disabled. It can import the bundled JPEG 2000 decoder from a fixed local path. No PDF-supplied script, action, annotation link or HTML is executed. The main-page asset bridge accepts only fixed local CMap and font names, refuses paths and URLs and omits credentials. The existing CSP is unchanged. `NETWORK.md` records this flow and the reused draft-service calls.

Limits are 32 MB, 1,000 pages, 16 million rendered pixels and 30 seconds per operation. Extracted text and rows are bounded too. A page error leaves the other pages accessible while the worker is healthy. A worker failure or timeout closes the source. Closing, replacing or leaving cancels pending work, revokes images and destroys the document and worker.

## Controls and language

The isolated `editorItem` namespace has Arabic, French and English catalogues and the existing translation configuration. New Arabic stays in catalogues and tests. Test translation calls use a fake API only.

Web checkboxes expose their checked state and handle Space without repeated toggles. Tabs expose selection. A browser textarea resize loop found during long-title review is fixed with a hidden, non-interactive sizing mirror. Native fields retain their existing content-size behaviour.

## Verification

- Review refresh on main `57b3c2ad` passed 1,346 core tests and 67 editor, release and translation tests. Repository, Android and PC types passed. The checks cover a changed world day, read-only recovery after stream damage, oversized drafts and navigation past a failed PDF page.
- A Chrome check used a synthetic four-page file with the existing CSP. The oversized second page failed on its own, then the third page rendered a JPEG 2000 image and the fourth page rendered normally.
- Repository types passed. After the final main refresh, the core suite passed 1,225 tests, sync 24 and web-storage 17. All 57 tooling tests passed after allowing their temporary loopback servers.
- Before the final main refresh, the full app suite passed 415 suites and 3,125 tests, including notices. After rebasing onto main `b5e51dfd`, 42 tests across the editor, workspace, Ministry totals and directorate totals passed. The final editor/forms/translation subset passed 32 tests, including context changes during a pending save and opening a source while preserving an edited item. Android and PC types passed.
- All 136 PC tests passed, including deterministic production builds, checked PDF assets, licence notices, local-only asset rejection, synthetic PDF extraction, metadata exclusion and a PDF with embedded JavaScript that never runs. Host regression tests first reproduced 404 responses for PDF support binaries, then passed against both the production Worker and local server after restricting those file types to their expected asset folders.
- Android native-spec code generation passed. No APK, physical-device or manual spoken screen-reader acceptance is claimed for this change.
- Browser checks under the production CSP covered a made-up Arabic PDF with embedded fonts, normalised Arabic extraction, independent title/number entry, accepted edits, actual page enlargement, a text-free page and cleanup. Form checks covered Arabic/French/English and keyboard states. The final long-title check at 200% on a 320-pixel viewport found a fixed column basis; allowing those columns to shrink fixed it. The resulting content width and viewport client width both measured 305 pixels.
- REUSE 6.2.0 passed for all 3,122 files, using its supported chardet backend. The npm security audit reported no vulnerabilities in the web lockfile. Lint and formatting passed. New source files stay below 300 lines. The generated npm lockfile keeps its required format.

The temporary local preview uses the real components and explicitly keeps its callback's accepted copy in memory only. Signed persistence and reopening are tested separately against the made-up relay. Preview files and screenshots stay outside the repository.

## Remaining work outside #613

Two-person review, durable review evidence, licence clearance, semantic item migrations and publication checks belong to #614 and the later editor issues. This form does not claim those checks are complete. Verified publisher accounts remain outside the agreed demo-world workflow. No official status or publication authority is added here.
