#!/usr/bin/env python3
"""
notify_slack.py — Claude Code ↔ Slack bridge
Usage:
  python notify_slack.py <status> <message> [details]
  python notify_slack.py wait [timeout_seconds]

Status types:
  start     - Task has begun
  progress  - Interim update
  blocked   - Needs your input (follow with 'wait' to read the reply)
  done      - Task completed
  error     - Something went wrong

Wait command:
  Polls #jim-claude-code for a reply after a blocked notification.
  Exit codes: 0 = yes/proceed, 2 = no/cancel, 1 = timed out (treated as cancel)
"""

import sys
import json
import time
import urllib.request
import urllib.error
from datetime import datetime

WEBHOOK_URL = "https://hooks.slack.com/services/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"
BOT_TOKEN   = "xoxb-3280497374597-11088671623985-ZsltfatZXNt1omWCy0cVSDOa"
CHANNEL_ID  = "C0B27L912FL"

STATUS_EMOJI = {
    "start":    "🚀",
    "progress": "⚙️",
    "blocked":  "🛑",
    "done":     "✅",
    "error":    "❌",
}

YES_WORDS = {"yes", "y", "go", "proceed", "ok", "okay", "approve", "approved", "do it", "continue", "yep", "yup"}
NO_WORDS  = {"no", "n", "stop", "block", "deny", "denied", "cancel", "dont", "don't", "nope", "abort"}


def send(status: str, message: str, details: str = ""):
    emoji = STATUS_EMOJI.get(status, "💬")
    timestamp = datetime.now().strftime("%H:%M")

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{emoji} *{status.upper()}* `{timestamp}`\n{message}"
            }
        }
    ]

    if details:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"```{details}```"}
        })

    if status == "blocked":
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "👆 _Reply *yes* to proceed or *no* to cancel._"
            }
        })

    payload = json.dumps({"blocks": blocks}).encode("utf-8")
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 200:
                print(f"[Slack] Sent: {status} — {message}")
            else:
                print(f"[Slack] Unexpected response: {resp.status}")
    except urllib.error.URLError as e:
        print(f"[Slack] Failed to send: {e}")


def wait_for_reply(timeout_seconds: int = 300, poll_interval: int = 5) -> str:
    """Poll Slack for a new human message. Returns the message text or '' on timeout."""
    baseline = time.time()
    deadline = baseline + timeout_seconds
    headers  = {"Authorization": f"Bearer {BOT_TOKEN}"}

    print(f"[Slack] Waiting for reply (timeout: {timeout_seconds}s)…")

    while time.time() < deadline:
        time.sleep(poll_interval)

        url = (
            f"https://slack.com/api/conversations.history"
            f"?channel={CHANNEL_ID}&oldest={baseline:.6f}&limit=10&inclusive=false"
        )
        req = urllib.request.Request(url, headers=headers)

        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())

            if not data.get("ok"):
                print(f"[Slack] API error: {data.get('error')}")
                continue

            # Only consider human (non-bot) messages
            human = [
                m for m in data.get("messages", [])
                if m.get("type") == "message" and not m.get("bot_id") and not m.get("subtype")
            ]
            if human:
                text = human[-1].get("text", "").strip()
                print(f"[Slack] Reply received: {text}")
                return text

        except Exception as e:
            print(f"[Slack] Poll error: {e}")

    print("[Slack] Timed out waiting for reply")
    return ""


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "wait":
        timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 300
        reply = wait_for_reply(timeout_seconds=timeout)

        if not reply:
            print("[Slack] No reply — defaulting to cancel")
            sys.exit(1)

        reply_lower = reply.lower().strip()

        if any(w in reply_lower for w in YES_WORDS):
            print("[Slack] Approved — proceeding")
            sys.exit(0)
        elif any(w in reply_lower for w in NO_WORDS):
            print("[Slack] Denied — stopping")
            sys.exit(2)
        else:
            print(f"[Slack] Unclear reply '{reply}' — treating as denied")
            sys.exit(2)

    else:
        if len(sys.argv) < 3:
            print("Usage: python notify_slack.py <status> <message> [details]")
            sys.exit(1)

        status  = sys.argv[1]
        message = sys.argv[2]
        details = sys.argv[3] if len(sys.argv) > 3 else ""
        send(status, message, details)
