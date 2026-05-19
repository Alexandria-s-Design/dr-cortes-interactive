### 2026-05-08 10:05:00 — Codex (GPT)
**Task**: Disconnect GoDaddy masking and show a Coming Soon page for the Dr. Cortes site.
**Changes**:
- Added a temporary Coming Soon homepage response in `server.js`.
- Connected `carloseliseocortes.com` and `www.carloseliseocortes.com` directly to the Render service.
- Replaced GoDaddy forwarding DNS with Render DNS records.

**Commit**: `Temporarily show Dr. Cortes coming soon page`
**Status**: ✅ Pushed

---

### 2026-05-08 10:18:00 — Codex (GPT)
**Task**: Change the preview bypass password to Carlos1234.
**Changes**:
- Updated the server fallback preview password to `Carlos1234`.
- Set Render `PREVIEW_PASSWORD` to `Carlos1234`.

**Commit**: `Set Dr. Cortes preview password`
**Status**: ✅ Pushed

---

### 2026-05-08 10:10:00 — Codex (GPT)
**Task**: Add a password bypass for the Coming Soon screen.
**Changes**:
- Added a password form to the Coming Soon page.
- Added `/preview-access` to set a preview cookie after a correct password.
- Added `/timeline` to serve the original interactive timeline/chatbot for preview users.

**Commit**: `Gate Dr. Cortes preview behind password`
**Status**: ✅ Pushed

---

### 2026-05-19 10:44:47 — Codex (GPT)
**Task**: Add poetry and Cranky Old Man materials to OpenAI ingestion, switch the chatbot to GPT-5.5 plus the OpenAI vector store, and test it.
**Changes**:
- Uploaded 14 poetry and Cranky Old Man files to the `dr-cortes-interactive-corpus` OpenAI vector store.
- Replaced the active local embedding retrieval path with OpenAI vector-store search and GPT-5.5 Responses API generation.
- Updated smoke and timeline tests to validate the current scrollytelling site and OpenAI-hosted RAG path.

**Commit**: `Use OpenAI vector store for Dr Cortes RAG`
**Status**: ✅ Pushed

---
