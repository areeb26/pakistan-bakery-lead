"""
End-to-end API test script for the Lead Scraper backend.
Run:  python3 run_tests.py
Requires: requests  (pip install requests)
"""
import sys
import json
import requests

BASE = "http://localhost:8000/api"
EMAIL = "testuser_kiro@example.com"
PASSWORD = "TestPass123!"
session = requests.Session()

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
WARN = "\033[93m⚠\033[0m"

results = []

def check(label, resp, expected_status, key_check=None):
    ok = resp.status_code == expected_status
    body = {}
    try:
        body = resp.json()
    except Exception:
        pass
    key_ok = True
    if key_check and ok:
        for k in key_check:
            if k not in body:
                key_ok = False
    status = PASS if (ok and key_ok) else FAIL
    results.append(ok and key_ok)
    detail = f"HTTP {resp.status_code}"
    if not ok:
        detail += f" (expected {expected_status}) | body: {json.dumps(body)[:120]}"
    elif key_check and not key_ok:
        detail += f" | missing keys {key_check} | body: {json.dumps(body)[:120]}"
    print(f"  {status}  {label:50s}  {detail}")
    return body


# ─────────────────────────────────────────────────────────────────────────────
print("\n── Health ──────────────────────────────────────────────────────────────")
r = session.get(f"{BASE}/health")
check("GET /api/health", r, 200, ["status"])

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Auth: OpenAPI schema present ────────────────────────────────────────")
r = session.get("http://localhost:8000/openapi.json")
check("GET /openapi.json", r, 200, ["paths"])

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Auth: Register ──────────────────────────────────────────────────────")
r = session.post(f"{BASE}/auth/register", json={"email": EMAIL, "password": PASSWORD})
# 201 = created, 409 = already exists (both acceptable for idempotent test run)
if r.status_code == 409:
    print(f"  {WARN}  User already exists — skipping, will reuse              HTTP 409")
    results.append(True)
else:
    check("POST /api/auth/register", r, 201, ["id", "email"])

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Auth: Login ─────────────────────────────────────────────────────────")
r = session.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
login_body = check("POST /api/auth/login (valid)", r, 200, ["access_token"])
token = login_body.get("access_token", "")
auth_headers = {"Authorization": f"Bearer {token}"}

r = session.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": "wrongpass"})
check("POST /api/auth/login (bad password → 401)", r, 401)

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Auth: Token refresh ─────────────────────────────────────────────────")
r = session.post(f"{BASE}/auth/refresh")   # cookie set by login above
check("POST /api/auth/refresh (valid cookie)", r, 200, ["access_token"])

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Campaigns: unauthenticated guard ────────────────────────────────────")
r = session.get(f"{BASE}/campaigns")
check("GET /api/campaigns (no token → 401/403)", r, 401)

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Campaigns: CRUD ─────────────────────────────────────────────────────")
# Create
r = session.post(
    f"{BASE}/campaigns",
    json={"name": "Test Campaign", "query": "bakery karachi", "location": "Karachi"},
    headers=auth_headers,
)
# NOTE: ProjectResponse uses Field(alias="_id"), so FastAPI serialises the id as "_id"
campaign_body = check("POST /api/campaigns (create)", r, 201, ["_id", "name"])
campaign_id = campaign_body.get("_id", "")

# List
r = session.get(f"{BASE}/campaigns", headers=auth_headers)
list_body = check("GET /api/campaigns (list)", r, 200, ["campaigns"])
count = len(list_body.get("campaigns", []))
print(f"       └─ {count} campaign(s) returned")

# Get single
if campaign_id:
    r = session.get(f"{BASE}/campaigns/{campaign_id}", headers=auth_headers)
    check(f"GET /api/campaigns/{{id}} (get one)", r, 200, ["_id", "name"])

    # Update
    r = session.put(
        f"{BASE}/campaigns/{campaign_id}",
        json={"name": "Updated Campaign"},
        headers=auth_headers,
    )
    check("PUT /api/campaigns/{id} (update)", r, 200, ["_id", "name"])

    # Schedule update
    r = session.put(
        f"{BASE}/campaigns/{campaign_id}/schedule",
        json={"cron_expression": "0 9 * * 1", "enabled": False},
        headers=auth_headers,
    )
    check("PUT /api/campaigns/{id}/schedule", r, 200)

    # Get schedule
    r = session.get(f"{BASE}/campaigns/{campaign_id}/schedule", headers=auth_headers)
    check("GET /api/campaigns/{id}/schedule", r, 200)

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Scrapes ─────────────────────────────────────────────────────────────")
# NOTE: There is no bare GET /api/scrapes — scrapes live under campaigns.
# Correct endpoint: GET /api/campaigns/{id}/scrapes
if campaign_id:
    r = session.get(f"{BASE}/campaigns/{campaign_id}/scrapes", headers=auth_headers)
    scrapes_body = check("GET /api/campaigns/{id}/scrapes (history)", r, 200, ["scrapes", "total"])
    print(f"       └─ {scrapes_body.get('total', 0)} scrape(s) in history")

# Verify POST /api/scrapes requires auth
r = session.post(f"{BASE}/scrapes", json={"campaign_id": "x", "query": "test", "limit": 5})
check("POST /api/scrapes (no token → 401)", r, 401)

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Leads: auth guard on scrape endpoint ────────────────────────────────")
r = session.get(f"{BASE}/scrapes/nonexistent_id/leads")
check("GET /api/scrapes/{id}/leads (no token → 401)", r, 401)

# ─────────────────────────────────────────────────────────────────────────────
print("\n── Auth: Logout ────────────────────────────────────────────────────────")
r = session.post(f"{BASE}/auth/logout", headers=auth_headers)
check("POST /api/auth/logout", r, 200)

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup — delete the test campaign (campaign_id is the _id value)
if campaign_id and token:
    session.delete(f"{BASE}/campaigns/{campaign_id}", headers=auth_headers)

# ─────────────────────────────────────────────────────────────────────────────
print("\n── CORS headers ────────────────────────────────────────────────────────")
r = requests.options(
    f"{BASE}/health",
    headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
)
cors_ok = "access-control-allow-origin" in r.headers
print(f"  {'✓' if cors_ok else '✗'}  CORS allow-origin header present: {r.headers.get('access-control-allow-origin','MISSING')}")
results.append(cors_ok)

# ─────────────────────────────────────────────────────────────────────────────
passed = sum(results)
total  = len(results)
color  = "\033[92m" if passed == total else "\033[91m"
print(f"\n{'─'*65}")
print(f"{color}  {passed}/{total} tests passed\033[0m\n")
sys.exit(0 if passed == total else 1)
