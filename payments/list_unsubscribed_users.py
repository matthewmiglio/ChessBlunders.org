"""Export all ChessBlunders users who are NOT on an active Stripe subscription.

Writes a CSV (email, username, status) ready for a marketing pass.

ChessBlunders has no `email_unsubscribes` table and no email column on
profiles, so emails come from auth.users and the unsubscribe filter is
skipped (add one here if such a table is introduced later).

Usage:
    poetry run python list_unsubscribed_users.py
    poetry run python list_unsubscribed_users.py --out ./output/non-subscribers.csv
"""

import argparse
import csv
from pathlib import Path

import stripe

from _common import (
    CHESSBLUNDERS_PRICE_IDS,
    supabase,
    PROFILES_TABLE,
    ADMIN_EMAILS,
    sget,
    list_auth_users,
)
from _common import stripe as _stripe  # noqa: F401


def fetch_active_sub_emails_and_customers():
    """(emails, customer_ids) with any active ChessBlunders sub (incl. cancelling)."""
    emails = set()
    customers = set()
    starting_after = None
    while True:
        params = {"limit": 100, "status": "active", "expand": ["data.customer"]}
        if starting_after:
            params["starting_after"] = starting_after
        batch = stripe.Subscription.list(**params)
        for sub in batch.data:
            items = sub["items"]["data"]
            if not items:
                continue
            if items[0]["price"]["id"] not in CHESSBLUNDERS_PRICE_IDS:
                continue
            cust = sub["customer"]
            cid = sget(cust, "id")
            email = sget(cust, "email", "") or ""
            if cid:
                customers.add(cid)
            if email:
                emails.add(email.lower())
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return emails, customers


def fetch_all_profiles():
    """Page through every row in profiles."""
    out = []
    page = 0
    size = 1000
    while True:
        resp = (supabase.table(PROFILES_TABLE)
                .select("id, chess_username, stripe_customer_id, stripe_subscription_status")
                .range(page * size, page * size + size - 1)
                .execute())
        rows = resp.data or []
        out.extend(rows)
        if len(rows) < size:
            break
        page += 1
    return out


def main():
    parser = argparse.ArgumentParser()
    default_out = Path(__file__).resolve().parent / "output" / "non-subscribers.csv"
    parser.add_argument("--out", default=str(default_out))
    args = parser.parse_args()

    print("Fetching active subscriber emails + customer IDs from Stripe...")
    sub_emails, sub_customers = fetch_active_sub_emails_and_customers()
    print(f"  Active subscribers: {len(sub_emails)} emails / {len(sub_customers)} customers")

    print("Fetching all auth users...")
    auth_users = list_auth_users()
    print(f"  Total auth users: {len(auth_users)}")

    print("Fetching all profiles...")
    profiles = {p["id"]: p for p in fetch_all_profiles()}
    print(f"  Total profiles: {len(profiles)}")

    eligible = []
    seen = set()
    for u in auth_users:
        email = (u.get("email") or "").strip()
        if not email:
            continue
        el = email.lower()
        if el in seen or el in ADMIN_EMAILS or el in sub_emails:
            continue
        prof = profiles.get(u["id"]) or {}
        cid = prof.get("stripe_customer_id")
        if cid and cid in sub_customers:
            continue
        seen.add(el)
        eligible.append({
            "email": email,
            "username": prof.get("chess_username") or "",
            "status": prof.get("stripe_subscription_status") or "none",
        })

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["email", "username", "status"])
        w.writeheader()
        w.writerows(eligible)

    print(f"\nEligible recipients (no active subscription): {len(eligible)}")
    print(f"Written -> {out_path}")


if __name__ == "__main__":
    main()
