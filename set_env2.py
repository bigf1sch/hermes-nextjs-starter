#!/usr/bin/env python3
"""Set VERCEL_API_KEY env var on Vercel project using REST API."""
import subprocess, json, urllib.request, urllib.error

# Extract Vercel token
result = subprocess.run(
    ["bash", "-c", 'grep "^VERCEL_API_KEY=*** ~/.hermes/.env | cut -d= -f2'],
    capture_output=True, text=True
)
token = result.stdout.strip()

project_id = "prj_e4Tan0hKlqy0P4eH4mLbWx8bX08Y"

# Try with teamId in query param (standard Vercel API pattern)
payload = json.dumps({
    "key": "VERCEL_API_KEY",
    "value": token,
    "type": "secret",
    "target": ["production", "preview"]
}).encode()

# Option 1: with teamId as query param
url = f"https://api.vercel.com/v10/projects/{project_id}/env?teamId=bigf1schs-projects"
req = urllib.request.Request(
    url,
    data=payload,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print(f"SUCCESS (with teamId): {json.dumps(data, indent=2)[:300]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"HTTP {e.code} (with teamId): {body[:500]}")
    
    # Option 2: without teamId
    try:
        url2 = f"https://api.vercel.com/v10/projects/{project_id}/env"
        req2 = urllib.request.Request(
            url2,
            data=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req2) as resp2:
            data2 = json.loads(resp2.read())
            print(f"SUCCESS (without teamId): {json.dumps(data2, indent=2)[:300]}")
    except urllib.error.HTTPError as e2:
        body2 = e2.read().decode()
        print(f"HTTP {e2.code} (without teamId): {body2[:500]}")
