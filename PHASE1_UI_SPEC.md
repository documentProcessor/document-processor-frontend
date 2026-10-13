# Document Processor — Phase 1 UI Spec (Tasks 4–7)

**Owner:** Sheena Mary
**Repo:** document-processor-frontend
**Target:** Working demo of Phase 1 screens by October 1, 2026

## How to use this spec

This spec is written as **four milestones**, one per Kanban task. Build and review them **in order, one at a time** — do not start the next milestone until the current one is reviewed and approved.

For each milestone: implement it, then stop and summarize what was built and which files changed, so it can be reviewed before continuing.

## Ground rules (apply to every milestone)

- **Language:** Plain JavaScript. Do not introduce TypeScript, `.ts`/`.tsx` files, or type-checking tooling.
- **Styling:** Plain CSS (or CSS Modules, i.e. `Component.module.css` next to each component). Do not add Tailwind, Material UI, or any other styling/component library.
- **Folder structure:** Use `src/components/`, `src/pages/`, `src/services/` (create if they don't exist yet). Screen-level components go in `pages/`, reusable pieces in `components/`, all mock API logic in `services/`.
- **Backend calls are mocked.** There is no live backend yet. All API calls go through a single mock service layer (`src/services/documentApi.js` — create this) whose function signatures and response shapes match the real API contract below. This means swapping in real HTTP calls later should only require rewriting the inside of these functions, not the components that call them.
- **App shell:** Every screen shares this layout, matching the approved Figma:
  - Header: "Document Processor" title on the left, "Sign In" / "Create Account" links on the right.
  - Left sidebar nav: Home, DashBoard, Profile, History (Home is the active/highlighted item).
  - Footer: "© 2026 Stanly & Hugo Technologies. All rights reserved."
  - **Sign In, Create Account, Profile, and History are visual placeholders only** — style them per the Figma, but they should not navigate anywhere or trigger any behavior. Only "Home" is a real, working page in Phase 1. Add a code comment noting these are deferred to later phases (auth is Phase 6).

## Mock API contract

Create `src/services/documentApi.js` with these functions. Each should simulate realistic network delay (e.g. `setTimeout` wrapped in a Promise, ~800ms–2s) and return data shaped exactly like this (matches the real OpenAPI contract, so it's a drop-in swap later):

**`documentId` must be a real UUID** — use `crypto.randomUUID()` (native, no package needed) — not a homemade string like `doc-${Date.now()}-${random}`.

```js
// uploadDocument(file) -> simulates POST /documents
// Resolves with: { documentId, originalFileName, status: "UPLOADED", uploadedAt }
// documentId = crypto.randomUUID()

// startExtraction(documentId) -> simulates POST /documents/{id}/extract
// Resolves with: { documentId, status: "EXTRACTING" }, then after a delay the mock
// document's extraction record status flips to "EXTRACTED"

// startTranslation(documentId, targetLanguages) -> simulates POST /documents/{id}/translate
// Resolves with: { documentId, status: "TRANSLATING", targetLanguages }
// IMPORTANT: if this document has no extraction record yet (or it's not SUCCESS/EXTRACTED),
// silently run the extraction simulation first, internally, before starting translation —
// same as a real backend auto-triggering a dependent action. Do NOT expose this as a
// separate visible state to the caller; the caller just sees "TRANSLATING" eventually resolve.

// startPiiDetection(documentId) -> simulates POST /documents/{id}/detect-pii
// Resolves with: { documentId, status: "DETECTING_PII" }
// Same auto-extraction-if-missing behavior as startTranslation, above.

// getDocumentView(documentId) -> simulates the aggregated GET view
// Resolves with a DocumentView object: { documentId, originalFileName, originalS3Key,
//   uploadedAt, currentAction, extraction: {...} | null, translations: [...],
//   piiResult: {...} | null } — statuses within each move IN_PROGRESS -> SUCCESS
//   (or occasionally FAILURE, to exercise the UI's failed/error states) after a delay
```

Keep an in-memory store (a JS object/array) inside the service module simulating the DynamoDB records for whatever documents have been "uploaded" this session — no persistence needed across page reloads.

---

## Milestone 1 — Task 4: Upload screen

**Goal:** User can select a file to upload; sees upload progress; sees the result.

Build `src/pages/UploadPage.jsx` (rendered as the Home page) with three visual states matching the Figma exactly:

1. **Idle / empty state:** A dashed-border drop zone reading "Drag & drop a file here, or click to browse" with an upload icon below the text. Clicking anywhere in the zone opens the file picker. Support actual drag-and-drop (`onDragOver`, `onDrop`) as well as click-to-browse.
2. **Uploading state:** Same drop zone area now shows "Uploading... {N}%" with a horizontal progress bar filling left to right. Drive this with the mock `uploadDocument` call — simulate progress ticking up over the course of the simulated delay (doesn't need to reflect real byte progress, just animate convincingly).
3. **Upload complete state:** Shows "Upload complete : {fileName}" with a document icon, and beneath it the action icons — this is the handoff point into Milestone 3, but for this milestone just get the state transition and layout right; the icons can be non-functional placeholders for now. **Which icons show depends on the uploaded file's type:**
   - PNG or JPEG upload: all three icons — Extract, PII mask, Translate — but only Extract is enabled at first; PII mask and Translate start disabled (see Milestone 3 for the enablement rule).
   - PDF, DOC, DOCX, or TXT upload: only two icons — PII mask, Translate, both enabled immediately. No Extract icon (see Milestone 3 for why).

**Acceptance criteria (from the Kanban board):**
- User can click or drag a file into the upload area
- Selected file name is displayed before/after submitting per the states above
- Matches the Figma layout: header, sidebar, drop zone positioning, icon usage

Stop here and report back before continuing to Milestone 2.

---

## Milestone 2 — Task 5: Client-side file validation

**Goal:** Reject unsupported or oversized files immediately, before any upload attempt.

Add validation logic (a `src/services/fileValidation.js` helper is a reasonable place) that runs the moment a file is selected or dropped, before `uploadDocument` is ever called:

- **Allowed types only:** `.pdf`, `.doc`, `.docx`, `.jpeg`/`.jpg`, `.png`, `.txt`. Anything else is rejected.
- **Size limits:** `.jpeg`/`.jpg`/`.png` files max **10MB**. `.pdf`/`.doc`/`.docx`/`.txt` files max **20MB** (pick one value in the 20–25MB range the board allows and note which you picked).
- **Distinct error messages:** a wrong-file-type rejection and a too-large rejection must show visibly different text — don't collapse them into one generic "invalid file" message.
- **Single file only:** no multi-file/multipart selection — if the input or drop handler receives multiple files, only accept the first, or show a message that only one file is supported (your call, but be consistent).
- Errors display in the upload area itself (not a browser `alert()`), and clear when the user selects a new, valid file.

**Acceptance criteria (from the Kanban board):** all five bullets above, verbatim from the task.

Stop here and report back before continuing to Milestone 3.

---

## Milestone 3 — Task 6: Action selection UI

**Goal:** After upload, user picks which processing action(s) to run.

Wire up the action icons shown in the "upload complete" state, matching the Figma:

- **Extract is only shown at all for PNG/JPEG uploads.** Reasoning: extracting text from an image requires OCR (Textract), which is a real, distinguishable processing step worth showing the user as an action. Extracting text from a PDF/DOC/DOCX/TXT file is trivial by comparison and isn't something the user needs to explicitly ask for — so for those file types, there is no Extract icon at all (see Milestone 1's upload-complete state).
- **Extract (PNG/JPEG only):** clicking it calls the mock `startExtraction`, then shows an in-progress indicator, then success/failure per the mock's eventual response. This is a normal, explicit, user-triggered action and counts toward the 5-action cap.
- **PII mask:** calls `startPiiDetection`. Remember this mock function auto-runs extraction internally first if it hasn't happened yet (for PDF/DOC/DOCX/TXT, or for an image where the user clicked PII mask before ever clicking Extract) — that inner extraction step is invisible to the UI and the user; only show the PII detection's own progress/result.
- **Translate:** clicking it opens the modal shown in the Figma — "Translate Document" dialog showing "Detected Source Language" (with a "Change" link, non-functional is fine for now) and a checklist of target languages (Spanish, English, German, Dutch — checkboxes, multi-select) with Cancel / Translate buttons. Clicking Translate in the modal calls the mock `startTranslation` with the selected languages and closes the modal. Same as PII mask — any auto-triggered extraction underneath is invisible; the user just sees "Translating."
- **5-action cap:** track how many actions the user has *explicitly clicked* for the current document (Extract-on-image, PII mask, Translate — translating to 2 languages in one call still counts as tracked by your judgment, but be consistent and note your choice). **Auto-triggered extraction (the silent one inside `startTranslation`/`startPiiDetection`) never counts toward this cap, under any circumstances** — only the user's own clicks count. Once 5 user-triggered actions have been used, disable all visible icons and show why (e.g. a small "action limit reached" note).
- **Availability logic:**
  - **For PNG/JPEG uploads:** only the Extract icon is enabled immediately after upload. PII mask and Translate are disabled (visually, e.g. greyed out) until the user explicitly clicks Extract and it reaches SUCCESS — then both become enabled. This is deliberate: it guarantees extraction for an image is always the user's own explicit action, never silently auto-triggered, closing off a race condition where clicking Translate/PII first could hide the extraction step even after the user later clicked Extract themselves.
  - **For PDF/DOC/DOCX/TXT uploads:** PII mask and Translate are both enabled immediately (no Extract icon exists for these types, so there's nothing to gate behind — extraction happens silently underneath whichever of these the user clicks first).
  - Translate additionally needs a target language chosen, via its modal — this applies regardless of file type, on top of the gating above.

**Acceptance criteria (from the Kanban board, plus the file-type rule above):**
- Actions shown/enabled appropriately (translate requires selecting a target language; Extract only appears for image uploads)
- Actions disabled once the document's 5-action cap is reached (counting only user-triggered actions, never auto-triggered extraction)
- Matches Figma design

Stop here and report back before continuing to Milestone 4.

---

## Milestone 4 — Task 7: Results / status table

**Goal:** User sees the status of every action run on their document.

No Figma exists for this screen, so build it to match the established shell (header/sidebar/footer) and this structure:

- A table (or styled list, your call, but a table is simplest) below the upload/action area on the same Home page, appearing once at least one action has been triggered.
- **Columns:** Record type, Status, and a Download column.
- **Only show rows for actions the user actually triggered themselves.** An auto-triggered/silent extraction (see Milestone 3) never gets its own row — it's fully invisible to the user, even in this table. So: an "Extraction" row only ever appears when the user explicitly clicked Extract on a PNG/JPEG upload. A "Translation" row appears per language once the user clicks Translate (regardless of file type — the silent extraction underneath doesn't surface here). A "PII Detection" row appears once the user clicks PII mask.
- **Status values:** Not Started, In Progress, Success, Failed, Blocked — reflect the mock document's actual current state per record, updating live as the mock's simulated delays resolve (poll `getDocumentView` on an interval, e.g. every 2s, while any record is in progress; stop polling once everything has settled).
- **Download:** when a record's status is Success, show a download link/button in that row. Since there's no real file to download yet, it's fine for this to be a styled but non-functional (or `href="#"`) placeholder — note this in your summary so it's not mistaken for a finished feature.
- Keep visual consistency with the rest of the app (same fonts, spacing, color palette as the other screens).

**Acceptance criteria (from the Kanban board):**
- Table displays each record (extraction, translation, PII) with its type and status
- Status reflects Not Started / In Progress / Success / Failed / Blocked
- Download link/button appears when a record's status is Success

Stop here and report back. This completes the Phase 1 UI build (Tasks 4–7) — Task 1 (repo), Task 2 (scaffold), and Task 3 (Figma) are already done.
