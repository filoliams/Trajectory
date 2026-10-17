"""Quick check of the running Trajectory backend.

Start the server first (in backend/:  uvicorn main:app --reload),
then in a second terminal, from the Trajectory folder:

    python test_api.py            # tests MECH2210
    python test_api.py MATH2010   # or any course code
"""

import json
import sys

import httpx

BASE = "http://127.0.0.1:8000"
code = sys.argv[1].upper() if len(sys.argv) > 1 else "MECH2210"

client = httpx.Client(base_url=BASE, timeout=60)

# 1. Which version is running? List every endpoint it has.
try:
    spec = client.get("/openapi.json").json()
except httpx.ConnectError:
    sys.exit(f"Can't reach {BASE}. Is uvicorn running?")

print("Endpoints on this server:")
for path, methods in spec["paths"].items():
    print(f"  {', '.join(m.upper() for m in methods):<12} {path}")

if "/courses/{code}/preview" not in spec["paths"]:
    sys.exit(
        "\nThis server doesn't have the pull request's /courses/{code}/preview "
        "endpoint, so it's running your local uq_import version. Paste this output to Claude."
    )

# 2. Which semesters have a course profile?
print(f"\nOfferings for {code}:")
resp = client.get(f"/courses/{code}/offerings")
print(f"  HTTP {resp.status_code}")
print(json.dumps(resp.json(), indent=2))

# 3. Read the assessments without saving anything.
print(f"\nAssessments for {code} (preview, nothing saved):")
resp = client.get(f"/courses/{code}/preview")
print(f"  HTTP {resp.status_code}")
data = resp.json()
if resp.status_code != 200:
    print(json.dumps(data, indent=2))
    sys.exit(1)

print(f"  Offering: {data['offering']['label']}  {data['offering']['profile_url']}")
for a in data["assessments"]:
    weight = f"{a['weight']:g}%" if a["weight"] is not None else a["weight_raw"]
    print(f"  - {a['name']:<40} {weight:>8}   due: {a['due_at'] or a['due_raw']}")
print(f"  Total weight: {data['total_weight']}%")
for w in data["warnings"]:
    print(f"  ! {w}")
