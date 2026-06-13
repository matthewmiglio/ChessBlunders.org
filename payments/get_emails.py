"""Get emails of ChessBlunders Stripe subscribers.

Usage:
    poetry run python get_emails.py
    poetry run python get_emails.py --months 2
    poetry run python get_emails.py --days 30
    poetry run python get_emails.py --include-cancelled
"""

import argparse
from datetime import datetime, timedelta, timezone

import stripe

from _common import CHESSBLUNDERS_PRICE_IDS, sget, chess_username_map_for_emails
from _common import stripe as _stripe  # noqa: F401


def get_username_map(emails):
    """{lower_email: chess_username} bridging Stripe email -> profiles."""
    return chess_username_map_for_emails(emails)


def get_emails(since_ts=None, include_cancelled=False):
    emails = []
    starting_after = None

    while True:
        params = {
            'limit': 100,
            'status': 'active',
            'expand': ['data.customer'],
        }
        if starting_after:
            params['starting_after'] = starting_after

        batch = stripe.Subscription.list(**params)

        for sub in batch.data:
            price_id = sub['items']['data'][0]['price']['id'] if sub['items']['data'] else None
            if not price_id or price_id not in CHESSBLUNDERS_PRICE_IDS:
                continue

            cancel = bool(sget(sub, 'cancel_at_period_end', False))
            if not include_cancelled and cancel:
                continue

            period_start_ts = sget(sub, 'current_period_start') or sget(sub, 'created') or 0
            if not period_start_ts:
                items = sub['items']['data']
                if items:
                    period_start_ts = sget(items[0], 'current_period_start') or 0
            if since_ts and period_start_ts < since_ts:
                continue

            customer = sub['customer']
            email = sget(customer, 'email', '') or ''
            if email:
                period_start_str = datetime.fromtimestamp(period_start_ts, tz=timezone.utc).strftime('%Y-%m-%d') if period_start_ts else '???'
                emails.append({
                    'email': email,
                    'period_start': period_start_str,
                    'cancel_at_period_end': cancel,
                })

        if not batch.has_more:
            break
        starting_after = batch.data[-1].id

    return emails


def main():
    parser = argparse.ArgumentParser(description='Get ChessBlunders subscriber emails from Stripe.')
    parser.add_argument('--days', type=int)
    parser.add_argument('--months', type=int)
    parser.add_argument('--include-cancelled', action='store_true')
    args = parser.parse_args()

    since_ts = None
    if args.days:
        since_ts = (datetime.now(tz=timezone.utc) - timedelta(days=args.days)).timestamp()
    elif args.months:
        since_ts = (datetime.now(tz=timezone.utc) - timedelta(days=args.months * 30)).timestamp()

    emails = get_emails(since_ts=since_ts, include_cancelled=args.include_cancelled)
    emails.sort(key=lambda x: x['email'].lower())

    username_map = get_username_map([e['email'] for e in emails])
    for e in emails:
        e['username'] = username_map.get(e['email'].lower())

    label_parts = []
    if args.months:
        label_parts.append(f'paid within last {args.months} month(s)')
    elif args.days:
        label_parts.append(f'paid within last {args.days} day(s)')
    else:
        label_parts.append('all active')
    if args.include_cancelled:
        label_parts.append('including cancel_at_period_end')

    print(f'\nChessBlunders subscriber emails — {", ".join(label_parts)}')
    print(f'Total: {len(emails)}\n')
    for e in emails:
        cancel_note = ' [cancelling]' if e['cancel_at_period_end'] else ''
        username = e.get('username') or '-'
        print(f'  {e["email"]:<45} {username:<25} period_start={e["period_start"]}{cancel_note}')


if __name__ == '__main__':
    main()
