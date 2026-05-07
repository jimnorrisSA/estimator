#!/usr/bin/env python3
"""
slack_listener.py — Slack → Claude Code bridge via Socket Mode
Listens for messages in #jim-claude-code and writes them to
slack_inbox.txt for Claude Code to pick up.

Usage:   python slack_listener.py
Requires: pip install slack-sdk
"""

import json
import time
from datetime import datetime
from pathlib import Path

from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.response import SocketModeResponse
from slack_sdk.socket_mode.request import SocketModeRequest
from slack_sdk.web import WebClient

APP_TOKEN  = "xapp-1-A0B25MDE4B0-11088916359841-33450ae8d42c1be61e19aba5e23ab447ab5ecfac2d019dbbae73d0f78278c4a5"
BOT_TOKEN  = "xoxb-3280497374597-11088671623985-ZsltfatZXNt1omWCy0cVSDOa"
CHANNEL_ID = "C0B27L912FL"
INBOX_FILE = Path(__file__).parent / "slack_inbox.jsonl"


def handle(client: SocketModeClient, req: SocketModeRequest):
    if req.type != "events_api":
        return

    client.send_socket_mode_response(SocketModeResponse(envelope_id=req.envelope_id))

    event = req.payload.get("event", {})

    if (
        event.get("type") == "message"
        and event.get("channel") == CHANNEL_ID
        and not event.get("bot_id")
        and not event.get("subtype")
    ):
        text = event.get("text", "").strip()
        if not text:
            return

        entry = {"ts": datetime.now().isoformat(), "text": text, "read": False}
        with open(INBOX_FILE, "a") as f:
            f.write(json.dumps(entry) + "\n")

        print(f"[Listener] → {text}")


def main():
    print("[Listener] Connecting to Slack via Socket Mode…")
    print(f"[Listener] Inbox: {INBOX_FILE}")

    client = SocketModeClient(
        app_token=APP_TOKEN,
        web_client=WebClient(token=BOT_TOKEN),
    )
    client.socket_mode_request_listeners.append(handle)
    client.connect()
    print("[Listener] Connected. Waiting for messages in #jim-claude-code…\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Listener] Stopped.")
        client.close()


if __name__ == "__main__":
    main()
