"""Reset ChessBlunders user accounts to a free/canceled state in Supabase.

For each given email/username, sets on the profiles row:
    stripe_subscription_status = 'canceled'
    cancel_at_period_end       = False

Does NOT touch Stripe. profiles is keyed by auth user id; emails are
resolved via auth.users.

Usage:
    poetry run python reset_admin_account.py user@example.com
    poetry run python reset_admin_account.py --username someuser
    poetry run python reset_admin_account.py --yes user@example.com
"""

import argparse
import sys

from _common import (
    supabase as sb,
    PROFILES_TABLE,
    user_id_for_email,
    email_for_user_id,
)

_SELECT = 'id,chess_username,stripe_subscription_status,cancel_at_period_end'
_UPDATE = {
    'stripe_subscription_status': 'canceled',
    'cancel_at_period_end': False,
}


def reset_by_id(user_id: str, email_hint: str = None) -> None:
    sb.table(PROFILES_TABLE).update(_UPDATE).eq('id', user_id).execute()
    r = sb.table(PROFILES_TABLE).select(_SELECT).eq('id', user_id).execute()
    if not r.data:
        print(f'id={user_id} -> NOT FOUND')
        return
    for row in r.data:
        email = email_hint or email_for_user_id(row['id'])
        print(
            f'{email or "?"} (username={row.get("chess_username") or "?"}) '
            f'-> status={row.get("stripe_subscription_status")} '
            f'cancel_at_period_end={row.get("cancel_at_period_end")}'
        )


def reset_email(email: str) -> None:
    uid = user_id_for_email(email)
    if not uid:
        print(f'email={email} -> NO auth user')
        return
    reset_by_id(uid, email)


def reset_username(username: str) -> None:
    r = sb.table(PROFILES_TABLE).select('id').eq('chess_username', username).execute()
    if not r.data:
        print(f'username={username} -> NOT FOUND')
        return
    for row in r.data:
        reset_by_id(row['id'])


def main() -> None:
    parser = argparse.ArgumentParser(description='Reset ChessBlunders users to free/canceled.')
    parser.add_argument('emails', nargs='*')
    parser.add_argument('--email', action='append', default=[])
    parser.add_argument('--username', action='append', default=[])
    parser.add_argument('--yes', action='store_true')
    args = parser.parse_args()

    emails = args.emails + args.email
    usernames = args.username
    if not (emails or usernames):
        parser.error('Provide at least one email or --username')

    targets = [('email', e) for e in emails] + [('username', u) for u in usernames]

    if not args.yes:
        print('About to reset to canceled (stripe_subscription_status=canceled):')
        for f, v in targets:
            print(f'  {f}={v}')
        ans = input('Continue? [y/N] ').strip().lower()
        if ans not in ('y', 'yes'):
            print('Aborted.')
            sys.exit(1)

    for e in emails:
        reset_email(e)
    for u in usernames:
        reset_username(u)


if __name__ == '__main__':
    main()
