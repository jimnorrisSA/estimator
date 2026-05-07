#!/usr/bin/env python3
"""
notify_slack.py — Claude Code → Slack notifier
Usage: python notify_slack.py <status> <message> [details]

Status types:
  start     - Task has begun
  progress  - Interim update
  blocked   - Needs your input
  done      - Task completed
  error     - Something went wrong
"""

import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

WEBHOOK_URL = "https://hooks.slack.com/services/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"

STATUS_EMOJI = {
    "start":    "🚀",
    "progress": "⚙️",
    "blocked":  "🛑",
    "done":     "✅",
    "error":    "❌",
}

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
            "text": {
                "type": "mrkdwn",
                "text": f"```{details}```"
            }
        })

    if status == "blocked":
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "👆 _Reply in this thread to give Claude Code its next instruction._"
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

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python notify_slack.py <status> <message> [details]")
        sys.exit(1)

    status  = sys.argv[1]
    message = sys.argv[2]
    details = sys.argv[3] if len(sys.argv) > 3 else ""

    send(status, message, details)
