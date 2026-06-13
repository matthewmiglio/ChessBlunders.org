"""Expire a Stripe customer's open (abandoned) Checkout sessions.

Use after manually linking a subscription: stale open session URLs
could otherwise still be completed and double-subscribe the user.

Usage:
    poetry run python expire_open_sessions.py user@example.com
    poetry run python expire_open_sessions.py --customer-id cus_XXXX
    poetry run python expire_open_sessions.py user@example.com --dry-run
"""

import argparse

import stripe

from _common import stripe as _stripe, sget  # noqa: F401


def expire_for_customer(customer_id: str, dry_run: bool) -> int:
    count = 0
    sessions = stripe.checkout.Session.list(customer=customer_id, status='open', limit=100).data
    for s in sessions:
        if dry_run:
            print(f'{customer_id}: would expire {s.id} '
                  f'(amount_total={sget(s, "amount_total")} created={sget(s, "created")})')
        else:
            expired = stripe.checkout.Session.expire(s.id)
            print(f'{customer_id}: expired {s.id} -> status={sget(expired, "status")}')
        count += 1
    if not sessions:
        print(f'{customer_id}: no open sessions')
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Expire a customer's open Checkout sessions.")
    parser.add_argument('email', nargs='?')
    parser.add_argument('--customer-id')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if not args.email and not args.customer_id:
        parser.error('provide an email or --customer-id')

    if args.customer_id:
        customer_ids = [args.customer_id]
    else:
        customer_ids = [c.id for c in stripe.Customer.list(email=args.email, limit=100).data]
        if not customer_ids:
            print(f'No Stripe customers found for email: {args.email}')
            return

    total = sum(expire_for_customer(cid, args.dry_run) for cid in customer_ids)
    print(f'\n{"Would expire" if args.dry_run else "Expired"} {total} session(s)')


if __name__ == '__main__':
    main()
