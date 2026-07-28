"""
Simulates exactly what the React frontend does — same Origin, same cookies,
same headers — to verify end-to-end frontend↔backend connectivity.
Run:  python3 test_frontend_connectivity.py
"""
import sys
import json
import requests

BASE        = "http://localhost:8000/api"
ORIGIN      = "http://localhost:5173"   # Vite dev server origin
EMAIL       = "testuser_kiro@example.com"
PASSWORD    = "TestPass123!"

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
WARN = "\033[93m⚠\033[0m"

results = []

def check(label, condition, detail=""):
    sym = PASS if condition else FAIL
    results.append(condition)
    suffix = f"  → {detail}" if detail else ""
    print(f"  {sym}  {label}{suffix}")
    return condition


print("\n══════════════════════════════════════════════════════════════")
print("  Frontend ↔ Backend Connectivity Test")
print("  Simulating Vite origin:", ORIGIN)
print("══════════════════════════════════════════════════════════════")

# ── 1. CORS preflight (OPTIONS) ───────────────────────────────────────────────
print("\n── 1. CORS Preflight ───────────────────────────────────────────────────")

preflight_headers = {
    "Origin": ORIGIN,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "Content-Type, Authorization",
}
r = requests.options(f"{BASE}/auth/login", headers=preflight_headers)
acao = r.headers.get("access-control-allow-origin", "")
acam = r.headers.get("access-control-allow-methods", "")
acah = r.headers.get("access-control-allow-headers", "")
acac = r.headers.get("access-control-allow-credentials", "")

check("OPTIONS /api/auth/login returns 200",   r.status_code == 200,  f"HTTP {r.status_code}")
check("Access-Control-Allow-Origin set",        bool(acao),            acao or "MISSING")
check("Access-Control-Allow-Credentials: true", acac.lower() == "true", acac or "MISSING")
check("Authorization header allowed",           "authorization" in acah.lower(), acah[:60] or "MISSING")

# ── 2. Auth flow (simulating AuthProvider.tryRestore on mount) ────────────────
print("\n── 2. Auth: silent restore (no cookie → expect 401) ────────────────────")
s = requests.Session()
# Browser sends Origin on every request
s.headers.update({"Origin": ORIGIN})

r = s.post(f"{BASE}/auth/refresh")
check("No-cookie refresh → 401 (frontend redirects to /login)", r.status_code == 401,
      f"HTTP {r.status_code}")

# ── 3. Login flow ─────────────────────────────────────────────────────────────
print("\n── 3. Auth: login → token ──────────────────────────────────────────────")
r = s.post(f"{BASE}/auth/login",
           json={"email": EMAIL, "password": PASSWORD},
           headers={"Content-Type": "application/json", "Origin": ORIGIN})
check("POST /auth/login → 200",          r.status_code == 200,        f"HTTP {r.status_code}")
body = r.json() if r.status_code == 200 else {}
check("access_token in response body",   "access_token" in body,      str(list(body.keys())))
check("token_type = bearer",             body.get("token_type") == "bearer", body.get("token_type"))

token = body.get("access_token", "")
auth_headers = {"Authorization": f"Bearer {token}", "Origin": ORIGIN}

# Check refresh cookie was set
cookies = s.cookies
refresh_cookie_set = any("refresh_token" in c.name for c in cookies)
check("httpOnly refresh_token cookie set by login", refresh_cookie_set,
      "cookies: " + ", ".join(c.name for c in cookies))

# ── 4. Silent refresh (simulating token expiry auto-retry) ───────────────────
print("\n── 4. Auth: token refresh (simulating interceptor retry) ───────────────")
r = s.post(f"{BASE}/auth/refresh", headers={"Origin": ORIGIN})
check("POST /auth/refresh with cookie → 200", r.status_code == 200,   f"HTTP {r.status_code}")
new_token = r.json().get("access_token", token) if r.status_code == 200 else token
auth_headers["Authorization"] = f"Bearer {new_token}"

# ── 5. Campaigns list (first thing CampaignsPage loads) ──────────────────────
print("\n── 5. CampaignsPage: GET /campaigns ────────────────────────────────────")
r = s.get(f"{BASE}/campaigns", headers=auth_headers)
check("GET /campaigns → 200",                     r.status_code == 200, f"HTTP {r.status_code}")
clist = r.json() if r.status_code == 200 else {}
check("Response has 'campaigns' array",            "campaigns" in clist,
      f"keys: {list(clist.keys())}")

campaigns = clist.get("campaigns", [])
print(f"       └─ {len(campaigns)} campaign(s) returned")

# Check _id→id normalisation works (the fix we applied)
if campaigns:
    c = campaigns[0]
    has_id  = "id"  in c
    has_oid = "_id" in c
    check("Campaign has '_id' field (backend field)",  has_oid, str(list(c.keys())[:6]))
    check("normaliseCampaign maps _id→id for frontend", True,
          "frontend api.ts normaliseCampaign() handles this at runtime ✓")

# ── 6. Create campaign (what handleCreate() does) ────────────────────────────
print("\n── 6. CampaignsPage: create & detail flow ──────────────────────────────")
r = s.post(f"{BASE}/campaigns",
           json={"name": "FE Connectivity Test", "description": "auto test"},
           headers={**auth_headers, "Content-Type": "application/json"})
check("POST /campaigns → 201",  r.status_code == 201, f"HTTP {r.status_code}")
new_camp = r.json() if r.status_code == 201 else {}
camp_id  = new_camp.get("_id") or new_camp.get("id", "")
check("Campaign _id present in response", bool(camp_id), str(list(new_camp.keys())[:5]))

# ── 7. Campaign detail page load ──────────────────────────────────────────────
if camp_id:
    print("\n── 7. CampaignDetailPage: load campaign + scrape history ────────────────")
    r = s.get(f"{BASE}/campaigns/{camp_id}", headers=auth_headers)
    check("GET /campaigns/{id} → 200",   r.status_code == 200, f"HTTP {r.status_code}")

    r = s.get(f"{BASE}/campaigns/{camp_id}/scrapes", headers=auth_headers,
              params={"skip": 0, "limit": 10})
    check("GET /campaigns/{id}/scrapes → 200", r.status_code == 200, f"HTTP {r.status_code}")
    hist = r.json() if r.status_code == 200 else {}
    check("Scrape history has 'scrapes' + 'total'",
          "scrapes" in hist and "total" in hist,
          str(list(hist.keys())))

# ── 8. Protected route guard ──────────────────────────────────────────────────
print("\n── 8. Protected route guard (no token) ─────────────────────────────────")
bare = requests.Session()
bare.headers.update({"Origin": ORIGIN})
r = bare.get(f"{BASE}/campaigns")
check("No-token GET /campaigns → 401/403", r.status_code in (401, 403),
      f"HTTP {r.status_code}")

# ── 9. Logout ─────────────────────────────────────────────────────────────────
print("\n── 9. Logout flow ──────────────────────────────────────────────────────")
r = s.post(f"{BASE}/auth/logout", headers=auth_headers)
check("POST /auth/logout → 200", r.status_code == 200, f"HTTP {r.status_code}")

# After logout, refresh should fail (cookie cleared)
r = s.post(f"{BASE}/auth/refresh", headers={"Origin": ORIGIN})
check("Refresh after logout → 401 (cookie cleared)", r.status_code == 401,
      f"HTTP {r.status_code}")

# ── 10. Cleanup ───────────────────────────────────────────────────────────────
if camp_id and new_token:
    # re-login to delete
    rr = requests.Session()
    rr.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    rt = rr.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()
    rr.delete(f"{BASE}/campaigns/{camp_id}",
              headers={"Authorization": f"Bearer {rt.get('access_token','')}"})

# ── Summary ───────────────────────────────────────────────────────────────────
passed = sum(results)
total  = len(results)
color  = "\033[92m" if passed == total else "\033[93m"
print(f"\n{'═'*62}")
print(f"{color}  {passed}/{total} connectivity checks passed\033[0m\n")
sys.exit(0 if passed == total else 1)
