"""List active ChessBlunders MONTHLY subscribers (excludes yearly and cancelling)."""

import stripe
from _common import sget, MONTHLY_PRICE_ID
from _common import stripe as _stripe  # noqa: F401


def main():
    emails = []
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
            if items[0]["price"]["id"] != MONTHLY_PRICE_ID:
                continue
            if sget(sub, "cancel_at_period_end", False):
                continue
            e = sget(sub["customer"], "email", "") or ""
            if e:
                emails.append(e)
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id

    seen = set()
    unique = []
    for e in emails:
        k = e.lower()
        if k in seen:
            continue
        seen.add(k)
        unique.append(e)

    for e in sorted(unique, key=str.lower):
        print(e)
    print(f"---\nTotal active monthly subscribers (not yearly, not cancelling): {len(unique)}")


if __name__ == "__main__":
    main()
