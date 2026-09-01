"""Comprehensive authenticated-API regression for the Supabase lockdown.

Captures the REAL logged-in user's Supabase JWT from the persistent browser
session (run tests/auth.py first), then calls every table/RPC the migration
kept for the `authenticated` role DIRECTLY via PostgREST — asserting none are
permission-blocked (HTTP 401 / "permission denied" / 42501). This proves the
retained GRANT/EXECUTE set is intact after the lockdown.

Safe by default — it never mutates real data:
  - reads: RPCs + table SELECTs (expect 200)
  - no-op writes: bulk_insert_games([])=0, update_chess_username(current value),
    a single marked analytics row
  - grant probes: analysis/feedback INSERT with a foreign user_id, which RLS
    rejects (403) *after* the grant check — proving the INSERT grant exists
    while writing nothing
  - genuinely mutating RPCs (start_new_practice_run resets your practice run,
    record_practice_attempt, increment_engine_usage) are SKIPPED unless you set
    RUN_MUTATIONS=1.

Usage:  poetry run python tests/test_authenticated_api.py
        RUN_MUTATIONS=1 poetry run python tests/test_authenticated_api.py   # also hit mutating RPCs
Env: BASE_URL / HEADLESS as usual.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.browser import BASE_URL, launch, shutdown  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENV_PATH = os.path.join(ROOT, "..", "website", ".env.local")
ZERO_UUID = "00000000-0000-0000-0000-000000000000"


def load_env() -> tuple[str, str]:
    url = key = None
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
            elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    if not url or not key:
        print(f"[api] FAIL: missing URL/ANON_KEY in {ENV_PATH}")
        sys.exit(2)
    return url.rstrip("/"), key


def jwt_payload(token: str) -> dict:
    p = token.split(".")[1]
    p += "=" * (-len(p) % 4)
    return json.loads(base64.urlsafe_b64decode(p).decode())


async def capture_jwt() -> tuple[str, str]:
    """Return (access_token, uid) from a live authenticated Supabase request."""
    headless = os.environ.get("HEADLESS", "0") == "1"
    ctx, page = await launch(headless=headless)
    found: dict[str, str] = {}

    def on_request(req) -> None:
        if found:
            return
        if ".supabase.co/rest" not in req.url and ".supabase.co/auth" not in req.url:
            return
        auth = req.headers.get("authorization", "")
        if not auth.lower().startswith("bearer "):
            return
        tok = auth.split(" ", 1)[1]
        try:
            pl = jwt_payload(tok)
        except Exception:
            return
        if pl.get("role") == "authenticated" and pl.get("sub"):
            found["tok"] = tok
            found["uid"] = pl["sub"]

    page.on("request", on_request)
    try:
        await page.goto(f"{BASE_URL}/account", wait_until="domcontentloaded")
        for _ in range(15):
            await page.wait_for_timeout(1000)
            if found:
                break
        if "/auth/signin" in page.url and not found:
            print("[api] FAIL: not signed in (bounced). Run tests/auth.py.")
            sys.exit(1)
    finally:
        await shutdown(ctx)
    if not found:
        print("[api] FAIL: could not capture an authenticated JWT from the session.")
        sys.exit(1)
    return found["tok"], found["uid"]


def make_caller(base: str, anon: str, jwt: str):
    rest = f"{base}/rest/v1"

    def call(method: str, path: str, body=None, extra=None) -> tuple[int, str]:
        data = json.dumps(body).encode() if body is not None else None
        headers = {"apikey": anon, "Authorization": f"Bearer {jwt}",
                   "Content-Type": "application/json"}
        if extra:
            headers.update(extra)
        r = urllib.request.Request(f"{rest}{path}", data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(r, timeout=20) as resp:
                return resp.status, resp.read().decode()[:300]
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()[:300]
        except Exception as e:  # noqa: BLE001
            return -1, str(e)[:300]

    return call


def denied(status: int, body: str) -> bool:
    # A MISSING grant -> HTTP 401 "permission denied for table/function ...".
    # An RLS policy violation also uses SQLSTATE 42501 but returns HTTP 403 with
    # "violates row-level security" — that means the grant IS present and RLS did
    # its job, so it must NOT count as denial. Distinguish by the message.
    return status == 401 or "permission denied for" in body.lower()


async def main() -> None:
    base, anon = load_env()
    jwt, uid = await capture_jwt()
    print(f"[api] captured authenticated session for uid={uid[:8]}...")
    call = make_caller(base, anon, jwt)
    fails: list[str] = []

    def ok(name: str, passed: bool, detail: str) -> None:
        print(f"[api] {'PASS' if passed else 'FAIL'}: {name} — {detail}")
        if not passed:
            fails.append(name)

    # --- READ RPCs (expect 200) ---
    reads = [
        ("get_user_stats", {}),
        ("get_detailed_user_stats", {}),
        ("get_progress_over_time", {"p_interval": "day"}),
        ("get_remaining_requests", {"p_daily_limit": 20}),
        ("check_engine_rate_limit", {"p_daily_limit": 20}),
        ("is_premium", {"user_id": uid}),
        ("get_attempt_history", {"p_progress_id": ZERO_UUID}),
    ]
    for fn, body in reads:
        s, b = call("POST", f"/rpc/{fn}", body=body)
        ok(f"rpc {fn} executable", not denied(s, b), f"HTTP {s}")

    # --- Table SELECTs (RLS-scoped, expect 200) ---
    for tbl in ("profiles", "games", "analysis", "user_progress"):
        s, b = call("GET", f"/{tbl}?select=id&limit=1")
        ok(f"select {tbl}", s == 200, f"HTTP {s}")

    # --- Safe no-op WRITES ---
    s, b = call("POST", "/rpc/bulk_insert_games", body={"p_games": []})
    ok("rpc bulk_insert_games([]) (0 rows)", not denied(s, b) and s == 200, f"HTTP {s} {b}")

    s, b = call("GET", "/profiles?select=chess_username&limit=1")
    cur = None
    try:
        rows = json.loads(b)
        cur = rows[0]["chess_username"] if rows else None
    except Exception:
        pass
    s, b = call("POST", "/rpc/update_chess_username", body={"p_chess_username": cur})
    ok("rpc update_chess_username (no-op) executable", not denied(s, b), f"HTTP {s}")

    s, b = call("POST", "/analytics", body={"path": "/__auth_regression_test__"},
                extra={"Prefer": "return=minimal"})
    ok("authenticated INSERT analytics", s in (200, 201), f"HTTP {s}")

    # --- Grant probes: INSERT grant present, RLS rejects the row (no write) ---
    s, b = call("POST", "/analysis", body={"user_id": ZERO_UUID})
    ok("analysis INSERT grant present (RLS-blocked, not 401)", not denied(s, b), f"HTTP {s} :: {b}")
    s, b = call("POST", "/feedback",
                body={"user_id": ZERO_UUID, "name": "regr", "text": "regr", "stars": 5, "category": "bug"})
    ok("feedback INSERT grant present (RLS-blocked, not 401)", not denied(s, b), f"HTTP {s} :: {b}")

    # --- Mutating RPCs (opt-in) ---
    if os.environ.get("RUN_MUTATIONS") == "1":
        for fn, body in [("increment_engine_usage", {"p_user_id": uid}),
                         ("record_practice_attempt",
                          {"p_analysis_id": ZERO_UUID, "p_blunder_index": 0,
                           "p_solved": False, "p_move_played": "e2e4", "p_move_rank": 1}),
                         ("start_new_practice_run", {})]:
            s, b = call("POST", f"/rpc/{fn}", body=body)
            ok(f"rpc {fn} executable", not denied(s, b), f"HTTP {s}")
    else:
        print("[api] SKIP (mutating; set RUN_MUTATIONS=1): increment_engine_usage, "
              "record_practice_attempt, start_new_practice_run — EXECUTE granted to "
              "authenticated in the migration.")

    print()
    if fails:
        print(f"[api] {len(fails)} FAILED: {', '.join(fails)}")
        sys.exit(1)
    print("[api] PASS: every retained authenticated grant/RPC works after the lockdown.")


if __name__ == "__main__":
    asyncio.run(main())
