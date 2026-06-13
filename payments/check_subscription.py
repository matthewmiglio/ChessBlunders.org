"""Print Supabase subscription status for given ChessBlunders users.

ChessBlunders has no 'tier' column — premium access is derived from
stripe_subscription_status (active / trialing, or canceled-but-still-in-period).
profiles has no email column either, so emails are resolved via auth.users.

Usage:
    poetry run python check_subscription.py user@example.com
    poetry run python check_subscription.py --username someuser
    poetry run python check_subscription.py a@x.com b@x.com
"""

import argparse
from datetime import datetime, timezone

from _common import (
    supabase as sb,
    PROFILES_TABLE,
    user_id_for_email,
    email_for_user_id,
)

_FIELDS = (
    'id,chess_username,stripe_subscription_status,stripe_price_id,'
    'subscription_period_end,cancel_at_period_end,stripe_customer_id'
)


def _is_premium(row) -> bool:
    status = row.get('stripe_subscription_status')
    if status in ('active', 'trialing'):
        return True
    if status == 'canceled':
        ends = row.get('subscription_period_end')
        if ends:
            try:
                return datetime.fromisoformat(ends.replace('Z', '+00:00')) > datetime.now(timezone.utc)
            except ValueError:
                return False
    return False


def _print_row(row, email):
    premium = 'PREMIUM' if _is_premium(row) else 'free'
    cancel = ' [cancelling]' if row.get('cancel_at_period_end') else ''
    print(
        f'{(email or "?"):<40} '
        f'username={(row.get("chess_username") or "?"):<20} '
        f'access={premium:<8} '
        f'status={(row.get("stripe_subscription_status") or "-"):<12} '
        f'ends={row.get("subscription_period_end") or "-"}{cancel}'
    )


def lookup_email(email: str) -> None:
    uid = user_id_for_email(email)
    if not uid:
        print(f'email={email} -> NO auth user')
        return
    r = sb.table(PROFILES_TABLE).select(_FIELDS).eq('id', uid).execute()
    if not r.data:
        print(f'email={email} (id={uid}) -> NO profile row')
        return
    for row in r.data:
        _print_row(row, email)


def lookup_username(username: str) -> None:
    r = sb.table(PROFILES_TABLE).select(_FIELDS).eq('chess_username', username).execute()
    if not r.data:
        print(f'username={username} -> NOT FOUND')
        return
    for row in r.data:
        _print_row(row, email_for_user_id(row['id']))


def main() -> None:
    parser = argparse.ArgumentParser(description='Look up ChessBlunders user subscription status.')
    parser.add_argument('emails', nargs='*')
    parser.add_argument('--email', action='append', default=[])
    parser.add_argument('--username', action='append', default=[])
    args = parser.parse_args()

    for e in args.emails + args.email:
        lookup_email(e)
    for u in args.username:
        lookup_username(u)

    if not (args.emails or args.email or args.username):
        parser.error('Provide at least one email or --username')


if __name__ == '__main__':
    main()
