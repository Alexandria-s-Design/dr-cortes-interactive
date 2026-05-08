### 2026-05-08 10:05:00 — Codex (GPT)
**Task**: Disconnect GoDaddy masking and show a Coming Soon page for the Dr. Cortes site.
**Changes**:
- Added a temporary Coming Soon homepage response in `server.js`.
- Connected `carloseliseocortes.com` and `www.carloseliseocortes.com` directly to the Render service.
- Replaced GoDaddy forwarding DNS with Render DNS records.

**Commit**: `Temporarily show Dr. Cortes coming soon page`
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
