"""Add any commits not yet in CHANGELOG.md to its "Unreleased" section.

Looks at the latest commits on every branch of the repo through the GitHub API,
skips ones already listed (matched by short SHA) and the bot's own changelog
commits, and writes the rest newest-first under "### Unreleased".

Env: GITHUB_REPOSITORY (owner/name), GITHUB_TOKEN (optional locally),
CHANGELOG (path, default CHANGELOG.md), DRY_RUN=1 to print instead of write.
"""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

REPO = os.environ.get("GITHUB_REPOSITORY", "filoliams/Trajectory")
TOKEN = os.environ.get("GITHUB_TOKEN")
PATH = os.environ.get("CHANGELOG", "CHANGELOG.md")
DRY_RUN = os.environ.get("DRY_RUN") == "1"

BRISBANE = timezone(timedelta(hours=10))  # Queensland has no daylight saving
BOT_MARKER = "docs(changelog):"
UNRELEASED_HEADING = "### Unreleased"
TABLE_HEADER = "| When | Branch | Commit | Change |\n|---|---|---|---|\n"


def api(path):
    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}{path}")
    req.add_header("Accept", "application/vnd.github+json")
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def describe(message):
    """Bold first line, then the first paragraph of the body, kept short."""
    lines = [l for l in message.strip().splitlines()
             if not re.match(r"(Co-Authored-By|Claude-Session|Signed-off-by):", l, re.I)]
    title = lines[0].strip() if lines else "(no message)"
    body = "\n".join(lines[1:]).strip()
    first_para = " ".join(body.split("\n\n")[0].split()) if body else ""
    if len(first_para) > 240:
        first_para = first_para[:237].rsplit(" ", 1)[0] + "..."
    text = f"**{title.rstrip('.')}.**" + (f" {first_para}" if first_para else "")
    return text.replace("|", "\\|")


def collect_new(changelog):
    known = set(re.findall(r"commit/([0-9a-f]{7})", changelog))
    found = {}  # sha -> (date, branches, message)
    for branch in api("/branches?per_page=100"):
        name = branch["name"]
        for c in api(f"/commits?sha={name}&per_page=100"):
            sha = c["sha"]
            msg = c["commit"]["message"]
            if sha[:7] in known or msg.startswith(BOT_MARKER):
                continue
            if sha in found:
                found[sha][1].append(name)
            else:
                found[sha] = (c["commit"]["author"]["date"], [name], msg)
    return found


def render_row(sha, date, branches, msg):
    when = datetime.fromisoformat(date.replace("Z", "+00:00")).astimezone(BRISBANE)
    branch_list = ", ".join(f"`{b}`" for b in sorted(branches))
    link = f"[`{sha[:7]}`](https://github.com/{REPO}/commit/{sha})"
    return f"| {when:%Y-%m-%d %H:%M} | {branch_list} | {link} | {describe(msg)} |\n"


def insert_rows(changelog, rows):
    if UNRELEASED_HEADING not in changelog:
        # New section goes at the top of the change log, above the latest version
        anchor = changelog.index("## Change log\n") + len("## Change log\n")
        section = (f"\n{UNRELEASED_HEADING}\nNew commits are added here automatically. "
                   "When you cut a version, rename this heading to `### vX.Y.Z — date`.\n\n"
                   + TABLE_HEADER)
        changelog = changelog[:anchor] + section + changelog[anchor:]
    start = changelog.index(UNRELEASED_HEADING)
    header_at = changelog.index(TABLE_HEADER, start) + len(TABLE_HEADER)
    return changelog[:header_at] + "".join(rows) + changelog[header_at:]


def main():
    with open(PATH, encoding="utf-8") as f:
        changelog = f.read()
    new = collect_new(changelog)
    if not new:
        print("Changelog is up to date.")
        return
    ordered = sorted(new.items(), key=lambda kv: kv[1][0], reverse=True)
    rows = [render_row(sha, *info) for sha, info in ordered]
    print(f"Adding {len(rows)} commit(s):\n" + "".join(rows))
    if DRY_RUN:
        return
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(insert_rows(changelog, rows))


if __name__ == "__main__":
    sys.exit(main())
