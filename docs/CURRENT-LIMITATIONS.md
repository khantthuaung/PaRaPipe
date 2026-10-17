# Notedly — Current Limitations

Reviewed: October 16, 2026

## Overall status

Notedly is a functional local prototype, not yet ready for a public business launch. The main gaps are account security, recording recovery, production storage, and independently hosted processing.

## Public-launch blockers

| Area | Current limitation | Impact |
| --- | --- | --- |
| Accounts and privacy | Email/password and Google sign-in are not implemented. App APIs do not enforce per-user ownership of lectures, subjects, or files. | No student-to-student data isolation. Do not expose the current APIs publicly as a multi-user product. |
| Local processing | Whisper Small and Qwen 4B run on the developer's Mac through loopback-only services. | A hosted website cannot use those services as currently configured. Other students would not receive transcription or study notes through this setup. |
| Recording recovery | Audio chunks remain in browser memory until **Finish & save**. There is no continuous audio autosave. | A browser crash, refresh, or closed tab can lose an unfinished recording. Navigation guards reduce accidental loss but do not provide recovery. |
| Background workflow | Submitted processor jobs persist, but the browser polls completion, persists results into app storage, and starts the next stage. | The complete recording-to-study-notes pipeline is not independently orchestrated server-side. Reopening the app may be needed to finish those steps. |
| Production storage | Local development uses D1/R2 emulation and browser backups, not a verified production cloud-storage deployment. | Production persistence, backup restoration, and cross-device access remain unverified. Browser-only recordings have no implemented automatic retry-upload flow. |

## Feature limitations

### Imports

- **PDFs:** upload and download only; no text extraction or scanned-page OCR.
- **Online video links:** bookmarks only; no video download or transcription.
- **Uploaded audio/video:** supported file types and MIME checks restrict what can be imported. The upload limit is 100 MB.
- **Materials management:** there is no material-deletion UI or subject assignment for uploaded resources.

### Recording and transcription

- Transcription happens after saving, not live.
- Unfinished recordings are not continuously backed up.
- Recording depends on browser microphone permissions and supported recording APIs.
- Transcript accuracy depends on microphone quality, background noise, accents, and technical vocabulary.
- Automatic transcription supports recordings up to 100 MB and four hours. These are processor limits, not a guaranteed automatic recording cutoff.
- Each local processor runs one job at a time, limiting throughput.

### Notes and editing

- AI-generated study notes remain drafts that require review.
- Source IDs and verbatim quotations are validated, but this does not establish semantic correctness or completeness.
- Saved personal notes and raw transcripts are read-only in the current workspace.
- There is no lecture-renaming or subject-reassignment interface.
- Notes can be copied, but there is no formatted PDF or Word export.
- There is no trash or restore workflow for deleted lectures.

### Library and reliability

- Lecture and material APIs fetch only the newest 100 server records.
- Search, filters, and pagination operate on loaded records, not the entire database.
- Older records outside that window may not be accessible through the current workspace, even if still stored.
- Some database-read failures return an empty list rather than an explicit error, which can look like missing data.
- Browser backups do not constitute a complete offline-sync or cross-device recovery system.
- Standalone TypeScript checking still reports existing missing Cloudflare type declarations and related diagnostics, despite the production build and regression tests passing during recent verification.

## Recommended priorities

1. **Accounts and ownership protection:** implement the intended sign-in methods, sessions, and server-side ownership checks for every record and file operation.
2. **Continuous recording recovery:** persist audio chunks and typed notes during recording, with recovery after interruption and explicit upload retry.
3. **Hosted background processing:** create an independently orchestrated transcription-to-notes pipeline with durable jobs and reliable result persistence.
4. **Production storage and operational reliability:** verify deployment, backups, restoration, error reporting, and full-library pagination/search.
5. **Complete the study workflow:** add editing, exports, resource management, PDF extraction, and supported online-video ingestion as separately scoped features.

## Code references

- [Recording, browser backup, polling, and upload workflow](../app/use-notedly.ts)
- [Lecture API and latest-100 query](../app/api/lectures/route.ts)
- [Materials API and upload handling](../app/api/materials/route.ts)
- [Recording storage API](../app/api/recordings/route.ts)
- [Local transcription connection](../lib/transcription.ts)
- [Study-note retrieval and persistence](../lib/study-notes.ts)
- [Read-only lecture workspace](../app/components/lecture-workspace.tsx)
- [Local development storage configuration](../vite.config.ts)

This report describes the inspected implementation, not a production security audit or a load-test certification.
