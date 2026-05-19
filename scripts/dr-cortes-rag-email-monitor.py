#!/usr/bin/env python3
"""
Monitor Carlos Cortes emails and auto-ingest clearly approved RAG materials.

Designed for the VPS OpenClaw/Slack setup. It scans the Charles and
Alexandria's World Gmail accounts with gogcli, uploads approved attachments
or explicit source links to the existing OpenAI vector store, and posts an
audit summary to the Dr. Cortes RAG Slack channel.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests


ACCOUNTS = ["charlesmartinedd@gmail.com", "alexandriasworld1234@gmail.com"]
GOG = os.environ.get("GOG_BIN", "/usr/local/bin/gog")
OPENCLAW = os.environ.get("OPENCLAW_BIN", "/usr/bin/openclaw")
VECTOR_STORE_ID = os.environ.get("OPENAI_VECTOR_STORE_ID", "vs_6a0bf01988608191ac5580691f00f5ba")
SLACK_CHANNEL_ID = os.environ.get("DR_CORTES_RAG_SLACK_CHANNEL", "C0B4W5NN39Q")
BASE_DIR = Path(os.environ.get("DR_CORTES_RAG_MONITOR_DIR", "/root/dr-cortes-rag-monitor"))
STATE_PATH = BASE_DIR / "state.json"
STAGING_DIR = BASE_DIR / "staging"

APPROVAL_RE = re.compile(
    r"\b(for (the )?avatar|for entry into the rag|part of the corpora|"
    r"corpora of my avatar|corpus of the avatar|kick start the corpora|"
    r"basis for the avatar|for rag|for the rag|rag corpus)\b",
    re.I,
)
URL_RE = re.compile(r"https?://[^\s<>\"]+")
SKIP_URL_HOSTS = {"mailchi.mp", "nature.us17.list-manage.com", "us17.forward-to-friend.com"}


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("HOME", "/root")
    env["HTTP_PROXY"] = ""
    env["HTTPS_PROXY"] = ""
    env["ALL_PROXY"] = ""
    result = subprocess.run(cmd, text=True, capture_output=True, check=False, env=env)
    if check and result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(cmd)}\n{detail}")
    return result


def load_env_key() -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key

    env_path = Path("/root/dr-cortes-interactive/.env")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"')

    raise RuntimeError("OPENAI_API_KEY not found in environment or /root/dr-cortes-interactive/.env")


def load_state() -> dict:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_message_ids": [], "runs": []}


def save_state(state: dict) -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def slack(message: str) -> None:
    result = run([
        OPENCLAW,
        "message",
        "send",
        "--channel",
        "slack",
        "--target",
        SLACK_CHANNEL_ID,
        "--message",
        message,
    ], check=False)
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)


def search_messages(account: str, query: str) -> list[dict]:
    result = run([GOG, "gmail", "search", "-a", account, query, "--max", "50", "--json"])
    payload = json.loads(result.stdout)
    return payload.get("messages") or payload.get("results") or payload.get("threads") or []


def message_plain(account: str, message_id: str) -> str:
    return run([GOG, "gmail", "get", "-a", account, message_id, "--plain"]).stdout


def message_json(account: str, message_id: str) -> dict:
    result = run([
        GOG,
        "gmail",
        "get",
        "-a",
        account,
        message_id,
        "--json",
        "--select=id,headers.subject,headers.date,headers.from,attachments",
    ])
    return json.loads(result.stdout)


def safe_name(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "_", name).strip()[:160] or "source"


def existing_vector_filenames(api_key: str) -> set[str]:
    headers = {"Authorization": f"Bearer {api_key}"}
    names: set[str] = set()
    after = None
    while True:
        url = f"https://api.openai.com/v1/vector_stores/{VECTOR_STORE_ID}/files?limit=100"
        if after:
            url += f"&after={after}"
        data = requests.get(url, headers=headers, timeout=60).json()
        for item in data.get("data", []):
            file_data = requests.get(
                f"https://api.openai.com/v1/files/{item['id']}",
                headers=headers,
                timeout=60,
            ).json()
            filename = file_data.get("filename")
            if filename:
                names.add(filename)
        if not data.get("has_more"):
            return names
        after = data.get("last_id")


def attach_to_vector(api_key: str, path: Path, upload_name: str, account: str, message_id: str) -> str:
    headers = {"Authorization": f"Bearer {api_key}"}
    with path.open("rb") as handle:
        upload = requests.post(
            "https://api.openai.com/v1/files",
            headers=headers,
            data={"purpose": "assistants"},
            files={"file": (upload_name, handle)},
            timeout=120,
        ).json()
    if "id" not in upload:
        raise RuntimeError(f"OpenAI file upload failed for {upload_name}: {upload}")

    body = {
        "file_id": upload["id"],
        "attributes": {
            "project": "dr-cortes-interactive",
            "category": "email_monitor",
            "visibility": "carlos_explicit_rag_or_avatar",
            "source": "gmail_monitor",
            "source_account": account,
            "source_email_id": message_id,
            "ingested_by": "openclaw_dr_cortes_rag_ingest",
            "ingested_date": datetime.now(timezone.utc).date().isoformat(),
        },
    }
    vector = requests.post(
        f"https://api.openai.com/v1/vector_stores/{VECTOR_STORE_ID}/files",
        headers={**headers, "Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=120,
    ).json()
    if "id" not in vector:
        raise RuntimeError(f"Vector attach failed for {upload_name}: {vector}")
    return vector["id"]


def download_attachment(account: str, message_id: str, attachment: dict, upload_name: str) -> Path:
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    out = STAGING_DIR / upload_name
    run([
        GOG,
        "gmail",
        "attachment",
        "-a",
        account,
        message_id,
        attachment["attachmentId"],
        "--out",
        str(out),
        "--name",
        upload_name,
        "--plain",
    ])
    return out


def fetch_url(url: str, upload_name: str) -> Path | None:
    host = urlparse(url).netloc.lower()
    if host in SKIP_URL_HOSTS:
        return None
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    out = STAGING_DIR / upload_name
    response = requests.get(url, timeout=45, headers={"User-Agent": "DrCortesRAGMonitor/1.0"})
    response.raise_for_status()
    out.write_bytes(response.content)
    return out


def process_message(api_key: str, existing: set[str], account: str, message_id: str) -> dict:
    plain = message_plain(account, message_id)
    details = message_json(account, message_id)
    subject = details.get("headers.subject") or "(no subject)"
    approved = bool(APPROVAL_RE.search(plain))
    if not approved:
        return {"message_id": message_id, "subject": subject, "status": "skipped_no_rag_language", "added": []}

    added: list[str] = []
    skipped: list[str] = []
    prefix = f"auto-email__{datetime.now(timezone.utc).strftime('%Y-%m-%d')}__{message_id}"

    for attachment in details.get("attachments") or []:
        upload_name = f"{prefix}__{safe_name(attachment.get('filename') or 'attachment')}"
        if upload_name in existing:
            skipped.append(upload_name)
            continue
        path = download_attachment(account, message_id, attachment, upload_name)
        attach_to_vector(api_key, path, upload_name, account, message_id)
        existing.add(upload_name)
        added.append(upload_name)

    for index, url in enumerate(URL_RE.findall(plain), start=1):
        upload_name = f"{prefix}__link-{index}-{safe_name(urlparse(url).netloc)}.html"
        if upload_name in existing:
            skipped.append(upload_name)
            continue
        path = fetch_url(url, upload_name)
        if path is None:
            skipped.append(f"skipped_url:{url}")
            continue
        attach_to_vector(api_key, path, upload_name, account, message_id)
        existing.add(upload_name)
        added.append(upload_name)

    return {"message_id": message_id, "subject": subject, "status": "ingested", "added": added, "skipped": skipped}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", action="store_true", help="Mark current Carlos messages as processed without ingesting.")
    parser.add_argument("--days", default="30", help="Gmail newer_than window in days.")
    args = parser.parse_args()

    state = load_state()
    processed = set(state.get("processed_message_ids", []))
    query = f"from:carlos.cortes@ucr.edu newer_than:{args.days}d"
    seen_now: list[str] = []

    if args.seed:
        for account in ACCOUNTS:
            for message in search_messages(account, query):
                message_id = message.get("id") or message.get("messageId")
                if message_id:
                    processed.add(message_id)
                    seen_now.append(message_id)
        state["processed_message_ids"] = sorted(processed)
        state.setdefault("runs", []).append({"time": datetime.now(timezone.utc).isoformat(), "mode": "seed", "count": len(seen_now)})
        save_state(state)
        slack(f"Dr. Cortés RAG monitor seeded {len(seen_now)} existing Carlos messages. Future matching emails will be evaluated for auto-ingestion.")
        return 0

    api_key = load_env_key()
    existing = existing_vector_filenames(api_key)
    run_results: list[dict] = []

    for account in ACCOUNTS:
        for message in search_messages(account, query):
            message_id = message.get("id") or message.get("messageId")
            if not message_id or message_id in processed:
                continue
            try:
                result = process_message(api_key, existing, account, message_id)
            except Exception as exc:
                result = {"message_id": message_id, "subject": "(error)", "status": "error", "error": str(exc)}
            run_results.append(result)
            processed.add(message_id)

    state["processed_message_ids"] = sorted(processed)
    state.setdefault("runs", []).append({"time": datetime.now(timezone.utc).isoformat(), "mode": "monitor", "results": run_results})
    state["runs"] = state["runs"][-100:]
    save_state(state)

    ingested = [r for r in run_results if r.get("added")]
    errored = [r for r in run_results if r.get("status") == "error"]
    if ingested or errored:
        lines = ["Dr. Cortés RAG monitor run:"]
        for item in ingested:
            lines.append(f"- Ingested {len(item['added'])}: {item['subject']} ({item['message_id']})")
        for item in errored:
            lines.append(f"- Error: {item['message_id']} {item.get('error')}")
        slack("\n".join(lines))
    return 1 if errored else 0


if __name__ == "__main__":
    raise SystemExit(main())
