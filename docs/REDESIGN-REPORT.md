# Notedly UI redesign — full implementation report

Date: 15 October 2026

Workspace: `/Users/khantthuaung/Documents/dev/NoteTaker`

Local website: [Open Notedly](http://localhost:3000/)

## 1. Delivery summary

The local application has been redesigned around the supplied Figma visual direction. The update retains the lecture-recording → raw-transcript → separate study-notes workflow, introduces a dedicated lecture workspace, improves navigation on phones, and replaces decorative or misleading controls with real application behavior.

**Application implementation and local verification are complete for the scope described below. Updating the source Figma canvas is blocked and has not been completed.** This is not a public deployment or a business-launch certification.

### Figma access limitation

The file had already been revised since the earlier review. The current frame inventory is:

| Figma frame | Node | Inspection outcome |
| --- | --- | --- |
| Record & Home Cockpit (Student Workspace) | `2:492` | Detailed design code, assets, and reference screenshot retrieved |
| Lectures Library & Statuses (Simplified) | `2:863` | Frame inventory available; detailed request blocked by quota |
| Lecture Tripartite Workspace (Honest Edition) | `2:2` | Detailed design code, assets, and reference screenshot retrieved |
| Materials & Subject Management (Student Refined) | `2:1234` | Detailed design code, assets, and reference screenshot retrieved |
| Manage Subjects Dialog | `2:1710` | Frame inventory available; detailed request blocked by quota |

The Figma Starter-plan MCP tool-call limit then blocked library discovery and subsequent canvas access. No Figma layers were edited, no replacement file was created, and no upgrade was purchased. The retrieved Home/Workspace/Materials design data supplied the shared visual foundation; library and subject behavior were adapted using those shared patterns and the existing app.

Before implementation, the necessary adjustments were recorded in [the local design brief](/Users/khantthuaung/Documents/dev/NoteTaker/docs/REDESIGN-DESIGN-BRIEF.md). This distinguishes a completed local design specification from an unperformed canvas update. The result is an adapted implementation, not a pixel-exact certification of all five Figma frames.

Source: [Notedly Figma file](https://www.figma.com/design/aBLOiQCDrEkIJqL9yGktGY/Notedly?node-id=0-1).

## 2. Design adjustments

| Area | Adjustment and reason |
| --- | --- |
| Visual identity | Retained purple/lavender surfaces, the original notebook brand, rounded white cards, amber Finish & save action, and compact library rows. |
| Typography | Used self-hosted Inter with an included open-font license. Replaced tiny serif technical labels and broken material-stat line wrapping with readable layouts. Browser inspection confirms the effective Inter font family. |
| Information hierarchy | Kept recording and student content prominent. Put actual processor readiness in a compact expandable status area instead of a hardware dashboard. |
| Recording states | Distinct ready, permission-requesting, recording, paused, and saving labels. No fake active recording on an idle screen. Subject selection is locked while recording. |
| Honest storage copy | A browser-local backup is attempted on finishing. The UI does not promise continuous autosave, cloud synchronization, or universal offline operation. |
| Processing status | Uses real queued/running/complete/failed states. No fabricated percentages, confidence scores, ETAs, GPU metrics, or telemetry claims. |
| Identity and statistics | Removed the sample person's profile/institution and fabricated storage statistics. Counts and recorded time come from loaded data. |
| Lecture detail | Three clearly separated desktop panels: Your notes, Raw transcript, and AI study notes. The audio player and original-file download remain separate from generated content. |
| Mobile | Four-destination bottom navigation and keyboard-accessible content tabs. Only the selected workspace panel is visible on narrow screens. |
| AI reliability | Draft labeling and expandable matching source quotes remain visible. A quotation match is not presented as a guarantee of semantic accuracy. |
| Missing features | Did not expose non-working flashcards, Anki/Obsidian sync, account/settings controls, regeneration, material subject assignment, or file deletion. |
| Safety | In-app navigation protection while recording/saving, a browser leave warning, confirmation dialogs, and failure-aware subject/lecture actions. |

## 3. Implemented screens and functions

### Home / Record — `/`

- Actual saved-lecture count, active-subject count, and recorded-time total.
- Subject selector and new-subject action.
- Browser microphone recording with a real elapsed timer, pause/resume, and Finish & save.
- A plain-text lecture scratchpad with a word count; AI does not replace this text.
- Accurate microphone/processing/backup information.
- Recent lectures with links to their dedicated workspace.
- Recording continues in the current page's controller; in-app page navigation is intercepted while recording, starting the microphone, or saving.

### Lectures — `/lectures`

- Compact rows that do not grow to contain selected lecture details.
- Search across loaded titles, subjects, personal notes, and transcript text.
- Working subject filters, including subjects retained on older lectures after removal from the active subject list.
- Newest-first, oldest-first, and title sorting.
- Client pagination in groups of ten, with page controls and a clear disclosure that the backend returns the newest 100 records.
- Actual transcription/study-note status badges.
- Dedicated workspace links using `/lectures?lecture=<id>` rather than expanding a library row.

### Lecture workspace

- Desktop three-panel content layout with a shared audio player when audio is attached.
- Native playback controls and original recording download; no claimed forced M4A/FLAC conversion.
- Personal notes displayed as a read-only copy, preserving their text and line breaks.
- Raw transcript displayed in timestamped speech segments, with local text search and copy.
- Separate Qwen study-note sections and expandable source quotations.
- Generation/retry controls based on the actual processing state.
- No-speech, missing-transcript, queued, running, failed, and empty-notes states.
- Mobile tabs ordered Study notes / Transcript / Your notes, including arrow/Home/End keyboard handling and associated panels.
- Lecture deletion confirmation, with Cancel/Escape available before a destructive request.

### Materials — `/materials`

- File picker and single-file drop target using the existing upload endpoint and 100 MB limit.
- Existing audio/video transcription and subsequent study-note behavior retained.
- Separate HTTPS bookmark form, clearly explaining that links are not downloaded or transcribed.
- PDF storage/download clearly distinguished from transcription or text extraction.
- Resource counts derived from the loaded materials, not invented byte usage or device capacity.
- Type filters and filename search.
- Original-file download, bookmark opening, and a separate saved-content workspace for applicable resources.
- No unsupported material subject selector, delete, or cancel-processing button.

### Subjects — `/subjects`

- A dedicated subject-management page rather than a blank page behind an automatically opened dialog.
- Subject creation, blank/length/duplicate checks, alphabetical listing, and saved-lecture counts.
- Working links to the lecture library filtered by subject.
- Removal confirmation explaining that existing lectures are preserved.
- The same management form is available in a dialog from recording/sidebar actions.
- Server failures are surfaced; failed mutations do not silently remove items from the interface.

## 4. Implementation structure

| File | Responsibility |
| --- | --- |
| `app/page.tsx` | Small Home entry point and existing route-compatible export. |
| `app/notedly-app.tsx` | Application shell, Home, library, materials, subject views, and dialog wiring. |
| `app/use-notedly.ts` | Existing recording, local-cache, saving, transcription, and study-job orchestration, separated from rendering. Includes readiness polling and safety guards. |
| `app/components/lecture-workspace.tsx` | Shared lecture/material workspace, transcript search, source evidence, personal notes, and mobile tabs. |
| `app/components/ui.tsx` | Reusable original-asset icon slots, status badges, copy controls, empty states, and native dialogs. |
| `lib/workspace.ts` | Shared types and pure formatting, filtering, transcript-segmentation, processing-status, and copy-text helpers. |
| `app/globals.css` | Shared visual tokens, screen layouts, interaction states, responsive rules, and reduced-motion support. |
| `app/layout.tsx` | Retains application metadata and uses the locally served typography. |
| `public/figma/` | Original downloaded brand/vector assets. No expiring Figma URLs are used at runtime. |
| `public/fonts/` | Self-hosted Inter font subsets and the official OFL license. |
| `tests/rendered-html.test.mjs` | Updated component-loading harness and expanded redesign/controller regression tests. |

No new npm dependencies, new authentication provider, database migration, model download, or external inference service were required for this redesign. Existing API routes and local processor configuration remain in place. The Figma skills guided reference/asset inspection and the explicit design-access limitation; the Sites workflow guided local implementation and preview validation without publication.

### Asset and typography verification

- Original Figma assets were downloaded rather than rebuilt from guessed vector paths.
- Used SVG icon dimensions are checked against their exported root dimensions in automated tests.
- The brand PNG is a local asset; the sample profile photograph is not used.
- Browser checks found no broken visible images on the checked layouts.
- Inter was initially not applied by the development font-variable integration. It was corrected to explicit self-hosted `@font-face` declarations, then checked in the browser.
- The retained Figma asset bundle is approximately 105 KB; the font/license bundle is approximately 223 KB. Not every retained reference icon is currently displayed.

## 5. Data preservation

The redesign did not introduce a new storage schema, clear browser storage, reset the database, or batch-rewrite existing recordings or notes. The storage distinction remains:

1. Original recording/upload file.
2. Raw transcript.
3. Student's typed notes.
4. Separate generated study-note artifact.

Newly finished browser recordings are marked as browser-only until the server save succeeds. Browser-cache records missing from the server library are shown as browser backups rather than falsely implying that they are saved server-side. This is not an automatic recovery-sync implementation.

Two disposable, uniquely identified QA lectures were created for native processor verification. The test scripts removed their own temporary audio/transcript/note/job artifacts after verification. No existing lecture was deleted through the UI; confirmation dialogs were cancelled.

Final server checks returned:

| Records | Count after cleanup |
| --- | ---: |
| Existing lectures | 4 |
| Existing subjects | 4 |
| Existing materials | 5 |
| Temporary notes/Whisper QA lectures remaining | 0 |

Pre-existing uncommitted work was preserved. No commit, push, public deployment, or cloud-storage migration was performed.

## 6. Verification results

### Automated checks

| Check | Result |
| --- | --- |
| `npm test` — production build and regression suite | **Passed: 33 tests, 0 failures** |
| `git diff --check` | Passed |
| Local Whisper health endpoint | Ready |
| Local Qwen health endpoint | Ready |
| Standalone `npx tsc --noEmit` | **Not passing:** pre-existing missing Cloudflare worker/binding declarations and related typing errors remain. No new UI-file diagnostic appeared in the recorded check. This is not a clean-typecheck claim. |

The expanded tests cover rendering/navigation, actual filter/sort helpers, timestamped/untimestamped transcript presentation, processing-state distinctions, separate personal/raw/AI panels, disabled generation states, PDF/bookmark limitations, mutation/navigation guards, original icon geometry, and a synthetic-microphone recording-controller flow.

The controller test verifies pause/resume and that audio plus the exact typed notes are saved before transcription is requested. It does not grant or exercise real browser microphone permission.

### Real local model checks

**Whisper Small:** a saved public speech sample was uploaded through the recording API, transcribed with the native service, and checked for the expected phrase. The raw transcript was saved and typed notes remained unchanged. The sample processing check took approximately **16 seconds**.

**Qwen 4B:** a synthetic lecture produced **six source-linked study points** in approximately **8 seconds**. Checks verified concepts, the end-of-week-3 deadline, the required table format, and the collaboration relevance condition. Every retained quote was present in the source, typed notes and the raw transcript were unchanged, and a subsequent read returned the separately stored draft.

These are small sample checks, not performance guarantees for full-length classes or a guarantee of perfect semantic extraction.

### Browser verification

Tested desktop width: **1280px**. Tested phone width: **390px**.

- Inspected Home, library, materials, subjects, and the generated-note workspace.
- Verified library text search, title sorting, no-results state, and clearing filters.
- Verified transcript search and source-quotation expansion.
- Verified mobile tab selection, keyboard arrow navigation, and exactly one visible tab panel.
- Verified duplicate subject rejection without creating a new subject.
- Opened and cancelled subject/lecture deletion confirmation dialogs.
- Verified Escape closes a dialog and returns focus to its trigger.
- Verified reverse-tab focus wrapping within the import dialog without opening a file picker.
- Verified rejection of an insecure HTTP bookmark before saving.
- Verified material type filtering and its empty result state.
- Checked for horizontal overflow and broken images on the measured layouts; none were found in those checks.

### Verification boundaries

- A real microphone session was not started in the browser during this pass; recording was tested with a synthetic microphone controller and native saved-audio processing.
- The native audio player was retained, but manual listening/playback behavior and browser-specific long-recording endurance were not exhaustively tested.
- Drag/drop/picker wiring was implemented, but no additional personal file was uploaded through the browser during this pass.
- Multi-page pagination is implemented; the existing library only exercised its one-page browser state. Filtering/sorting helpers are covered automatically.
- Clipboard permissions, a full screen-reader audit, every browser, and every device size have not been certified.

## 7. Remaining limitations and next work

### Outstanding from this request

The local adjusted specification and implementation are available, but **the adjustments still need to be applied to the Figma canvas when tool access is available**. The blocked Library/Subjects frames also need a detailed follow-up comparison before claiming full design fidelity across the entire source file.

### Existing product limitations retained

- Local Mac processing only; a public website cannot access this Mac's loopback processors.
- No implemented email/password or Google login, per-user data isolation, subscriptions, or public-launch security review.
- No live captions, continuous recording backup, cloud synchronization, or recovery-upload workflow for browser-only recordings.
- Only the newest 100 server records are loaded; filters and pagination operate on that loaded set.
- PDFs are stored, not OCR'd/extracted. Online videos are bookmarked, not downloaded/transcribed.
- No transcript/typed-note editing after saving, material deletion, flashcards, quiz generation, Anki/Obsidian sync, or document export.
- Transcript timestamps are source labels, not synchronized audio-seek controls.
- AI notes may omit or misinterpret information despite matching quotations.
- Deletion has confirmation but no trash/undo feature. Server-side deletion is not a transaction spanning every storage service.
- Existing API fallback/error behavior and the missing Cloudflare TypeScript declarations require additional hardening before a business launch.

Recommended next sequence: review this UI with real lectures; restore Figma access and synchronize the source designs; resolve the type environment and reliability gaps; then design authentication, ownership, quotas, and a deployable processing architecture before public launch.

## 8. Screenshots

All captures are of the implemented app, not screenshots embedded as application UI. The workspace captures show the disposable synthetic QA lecture, which has since been removed. The other captures show the existing library. Links below are local to this workspace.

### Home — desktop

![Implemented Home screen](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/home-desktop.jpg)

### Lecture library — desktop

![Compact lecture library](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/library-desktop.jpg)

### Lecture workspace — desktop

![Separate personal notes, raw transcript, and study-note panels](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/workspace-desktop.jpg)

### Additional captures

- [Home — mobile](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/home-mobile.jpg)
- [Library — mobile](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/library-mobile.jpg)
- [Workspace — mobile with source evidence](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/workspace-mobile.jpg)
- [Materials — desktop](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/materials-desktop.jpg)
- [Materials — mobile](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/materials-mobile.jpg)
- [Subjects — mobile](/Users/khantthuaung/Documents/dev/NoteTaker/docs/screenshots/subjects-mobile.jpg)

## 9. Running and reviewing

The local development server and configured processors are running at handoff. From the workspace, `npm run dev` starts the website and configured local processors when they are not already running. `npm test` builds and runs the regression suite. The existing `npm run transcription:check` and `npm run notes:check` scripts provide disposable native-processor checks.

Review the implementation at [localhost:3000](http://localhost:3000/), and use the design brief plus this report as the basis for the next Figma synchronization pass.
