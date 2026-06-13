"""Link an existing Stripe subscription to a ChessBlunders user account.

Use when a user paid through Stripe Checkout with a different email than
their ChessBlunders account, so the webhook's supabase_user_id metadata
was missing/wrong and no profiles row was updated. Writes the same fields
the `checkout.session.completed` webhook handler would have written.

profiles is keyed by the auth user id; the email is resolved via auth.users.

Usage:
    poetry run python link_subscription.py user@example.com --subscription-id sub_XXXX
    poetry run python link_subscription.py user@example.com --subscription-id sub_XXXX --dry-run
"""

import argparse
from datetime import datetime, timezone

import stripe

from _common import (  # noqa: F401
    stripe as _stripe,
    supabase as sb,
    sget,
    CHESSBLUNDERS_PRICE_IDS,
    PROFILES_TABLE,
    user_id_for_email,
)


def _period(sub):
    """(start_iso, end_iso) — Stripe moved these onto items in API 2025-03-31."""
    items = sget(sget(sub, 'items') or {}, 'data') or []
    start = sget(sub, 'current_period_start')
    end = sget(sub, 'current_period_end')
    for item in items:
        start = start or sget(item, 'current_period_start')
        end = end or sget(item, 'current_period_end')
    to_iso = lambda ts: datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None
    if not end:
        raise SystemExit('Could not determine current_period_end on subscription')
    return to_iso(start), to_iso(end)


def main() -> None:
    parser = argparse.ArgumentParser(description='Link a Stripe subscription to a ChessBlunders account.')
    parser.add_argument('email', help='ChessBlunders account email (auth.users email)')
    parser.add_argument('--subscription-id', required=True)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    uid = user_id_for_email(args.email)
    if not uid:
        raise SystemExit(f'No auth user with email {args.email}')

    sub = stripe.Subscription.retrieve(args.subscription_id)
    status = sget(sub, 'status')
    customer_id = sget(sub, 'customer')

    items = sget(sget(sub, 'items') or {}, 'data') or []
    price_ids = {sget(sget(item, 'price') or {}, 'id') for item in items}
    if not price_ids & CHESSBLUNDERS_PRICE_IDS:
        raise SystemExit(f'Subscription prices {price_ids} are not ChessBlunders prices — aborting')
    if status != 'active':
        raise SystemExit(f'Subscription status is "{status}", not active — aborting')

    period_start, period_end = _period(sub)
    price_id = next(iter(price_ids & CHESSBLUNDERS_PRICE_IDS), None) or (next(iter(price_ids), None))

    update = {
        'stripe_customer_id': customer_id,
        'stripe_subscription_id': args.subscription_id,
        'stripe_subscription_status': 'active',
        'stripe_price_id': price_id,
        'subscription_period_start': period_start,
        'subscription_period_end': period_end,
        'cancel_at_period_end': bool(sget(sub, 'cancel_at_period_end', False)),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }

    before = sb.table(PROFILES_TABLE).select(
        'id,chess_username,stripe_subscription_status,subscription_period_end,'
        'stripe_customer_id,stripe_subscription_id'
    ).eq('id', uid).execute()
    if not before.data:
        raise SystemExit(f'No ChessBlunders profile for user id {uid} (email {args.email})')
    print(f'User: {args.email} (id={uid})')
    print('Before:', before.data[0])
    print('Update:', update)

    if args.dry_run:
        print('(dry run, nothing written)')
        return

    result = sb.table(PROFILES_TABLE).update(update).eq('id', uid).execute()
    if not result.data:
        raise SystemExit('Update matched 0 rows — nothing written')
    print('After: ', {k: result.data[0].get(k) for k in update})


if __name__ == '__main__':
    main()
