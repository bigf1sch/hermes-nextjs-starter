#!/usr/bin/env python3
import subprocess, json, urllib.request

result = subprocess.run(
    ["bash", "-c", 'grep "^VERCEL_API_KEY=*** ~/.hermes/.env | cut -d= -f2'],
    capture_output=True, text=True
)
token = result.stdout.strip()

# Test: list deployments (we know this works from earlier)
req = urllib.request.Request(
    "https://api.vercel.com/v6/deployments?projectId=prj_e4Tan0hKlqy0P4eH4mLbWx8bX08Y&limit=1",
    headers={"Authorization": f"Bearer {token}"}
)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print("Deployments API works:", len(data.get("deployments", [])), "deployment(s)")
except Exception as e:
    print(f"Deployments API failed: {e}")

# Now try env var endpoint with the same token
payload = json.dumps({
    "key": "VERCEL_API_KEY",
    "value": token,
    "type": "secret",
    "target": ["production", "preview"]
}).encode()

req2 = urllib.request.Request(
    "https://api.vercel.com/v10/projects/prj_e4Tan0hKlqy0P4eH4mLbWx8bX08Y/env",
    data=payload,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    method="POST"
)
try:
    with urllib.request.urlopen(req2) as resp:
        data = json.loads(resp.read())
        print("Env var set OK:", json.dumps(data, indent=2)[:300])
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"Env var HTTP {e.code}: {body[:500]}")
except Exception as e:
    print(f"Env var failed: {e}")
