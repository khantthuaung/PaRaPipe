# Notedly redesign — implementation design brief

## Source and design-stage status

- Source: https://www.figma.com/design/aBLOiQCDrEkIJqL9yGktGY/Notedly
- Reviewed revised frame inventory: Home `2:492`, Library `2:863`, Lecture workspace `2:2`, Materials `2:1234`, Subjects dialog `2:1710`.
- High-fidelity code and reference screenshots successfully retrieved for Home, Lecture workspace, and Materials. These define the shared shell, typography, panels, controls, and original assets used for implementation.
- The Figma Starter MCP tool limit blocked Library/Subjects detail requests, library discovery, and subsequent canvas access. **No Figma canvas edits were made.** This local brief records the adjusted implementation design before development; it is not a claim that the source canvas has been updated.
- Existing frames have no local component instances, variables, or text/effect styles; no Code Connect files or installed UI component library were found. Library discovery is quota-blocked. Reuse the established visual values as CSS tokens and existing app behavior rather than introduce an unrelated design system.

## Product contract

Choose a subject → record with optional typed notes → finish and save once → raw transcript → separate AI study-note draft. Preserve all existing recordings, typed notes, transcripts, stored resources, model setup, and processing APIs.

## Adjusted visual specification

- Retain the Figma purple/lavender palette, 256px desktop sidebar, 64px workspace header, compact white library rows, rounded panels, amber recording action, and three-column lecture workspace.
- Use Inter for body text/headings and readable minimum control/metadata sizes. Do not reproduce tiny serif technical labels or forced line breaks that fragment material statistics.
- Reuse original supplied brand/icon files. Replace the sample person's photograph, name, institution, fabricated metrics, and sample records with actual data or neutral workspace identity.
- Desktop lecture workspace: personal notes, raw transcript, AI study notes, beneath a shared audio player. On narrow screens use accessible tabs, ordered Study notes / Transcript / Your notes. Source quotations remain expandable; timestamps are labels unless seeking is actually implemented.
- Desktop navigation becomes a compact mobile bottom bar with all four destinations, not only a new-recording button.
- Home has distinct idle, permission-requesting, recording, paused, and saving states. Lock subject selection during recording. No fake input meter or microphone hardware claim. Personal notes are a plain-text field, not fabricated note-type tags.
- Library uses compact rows and a separate detail view, never an expanding selected list row. Search, subject filters, sorting, and client pagination operate on the loaded records; disclose the newest-100 server limit.
- Materials has real upload/browse/drop behavior, a separate HTTPS bookmark form, accurate audio/video/PDF/link statuses, downloads and existing transcript/note actions. Omit unsupported subject assignment, file deletion, upload percentages, storage capacity, and cancellation.
- Subjects is a real dedicated page with add/remove actions, counts, empty states, duplicate feedback, and removal confirmation explaining that lectures remain.

## Truthful copy and controls

- Use service readiness and actual queued/running/complete/failed states, not fictional percentages, ETAs, confidence scores, token speeds, GPU memory, or telemetry guarantees.
- Describe local processing and local development storage without promising a future deployed site cannot upload data.
- State that a browser-local backup is attempted on Finish & save; do not promise continuous autosave or automatic cloud synchronization.
- Label generated notes as AI drafts. An exact matching source quote verifies the quote, not the truth of every paraphrase.
- No login/profile/settings links, flashcards, Anki/Obsidian export, note editing, or regeneration controls without implemented behavior.
- While recording, intercept in-app navigation and show a browser leave warning. Keep recording controls reachable. Confirm destructive UI actions and surface server failures instead of silently removing data from the interface.

## State and accessibility requirements

Loading; empty library; no matching search; no subjects; microphone blocked/unavailable; recording paused; saving; backup/save failure; processor unavailable/warming; queued; processing; no speech; failed with retry; notes with evidence; safe deletion confirmation. Every control has a label and visible keyboard focus. Dialogs trap focus, close with Escape when safe, and return focus. Tabs implement keyboard navigation and panel relationships.

## Delivery boundary

This is a local redesign, not public deployment or a new authentication system. Keep the existing server/storage/model configuration. Report the Figma edit blocker, actual test evidence, and remaining limitations in a full Markdown handoff.
