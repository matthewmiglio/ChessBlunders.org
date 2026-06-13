"""List ChessBlunders subscribers who paid in the last N months, split by active vs inactive sub.

Usage:
    poetry run python recent_payers.py
    poetry run python recent_payers.py --months 1
    poetry run python recent_payers.py --days 30
"""

import argparse
from datetime import datetime, timedelta, timezone

import stripe

from _common import CHESSBLUNDERS_PRICE_IDS, sget
from _common import stripe as _stripe  # noqa: F401
from get_emails import get_username_map


def fmt_date(ts):
    if not ts:
        return '???'
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%d')


def list_paid_invoices_since(since_ts):
    out = []
    starting_after = None
    while True:
        params = {
            'limit': 100,
            'status': 'paid',
            'created': {'gte': int(since_ts)},
            'expand': ['data.customer'],
        }
        if starting_after:
            params['starting_after'] = starting_after
        batch = stripe.Invoice.list(**params)
        out.extend(batch.data)
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return out


def has_active_chessblunders_sub(customer_id):
    starting_after = None
    while True:
        params = {'customer': customer_id, 'status': 'active', 'limit': 100}
        if starting_after:
            params['starting_after'] = starting_after
        batch = stripe.Subscription.list(**params)
        for sub in batch.data:
            if sget(sub, 'cancel_at_period_end'):
                continue
            items = (sget(sub, 'items') or {}).get('data', []) or []
            if not items:
                continue
            price_id = items[0]['price']['id']
            if price_id in CHESSBLUNDERS_PRICE_IDS:
                return True
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--months', type=int, default=2)
    parser.add_argument('--days', type=int)
    args = parser.parse_args()

    if args.days:
        delta = timedelta(days=args.days)
        label = f'last {args.days} day(s)'
    else:
        delta = timedelta(days=args.months * 30)
        label = f'last {args.months} month(s)'

    since_ts = (datetime.now(tz=timezone.utc) - delta).timestamp()

    invoices = list_paid_invoices_since(since_ts)

    by_customer = {}
    for inv in invoices:
        lines = (sget(inv, 'lines') or {}).get('data', []) or []
        is_match = False
        for line in lines:
            pricing = sget(line, 'pricing') or {}
            details = sget(pricing, 'price_details') if pricing else None
            price_id = sget(details, 'price') if details else None
            if not price_id:
                price = sget(line, 'price') or {}
                price_id = sget(price, 'id')
            if price_id in CHESSBLUNDERS_PRICE_IDS:
                is_match = True
                break
        if not is_match:
            continue

        customer = sget(inv, 'customer')
        if customer is not None and hasattr(customer, 'id'):
            cust_id = customer.id
            email = sget(customer, 'email')
        else:
            cust_id = customer
            email = sget(inv, 'customer_email')
        if not email:
            continue

        st = sget(inv, 'status_transitions') or {}
        paid_at = sget(st, 'paid_at') or sget(inv, 'created')

        existing = by_customer.get(cust_id)
        if not existing or paid_at > existing['last_paid']:
            by_customer[cust_id] = {
                'customer_id': cust_id,
                'email': email,
                'last_paid': paid_at,
            }

    print(f'\nChecking active sub status for {len(by_customer)} customer(s)...')
    active = []
    inactive = []
    for cust_id, rec in by_customer.items():
        if has_active_chessblunders_sub(cust_id):
            active.append(rec)
        else:
            inactive.append(rec)

    username_map = get_username_map([r['email'] for r in active + inactive])
    for r in active + inactive:
        r['username'] = username_map.get(r['email'].lower())

    active.sort(key=lambda r: r['last_paid'], reverse=True)
    inactive.sort(key=lambda r: r['last_paid'], reverse=True)

    def print_group(title, rows):
        print(f'\n=== {title} ({len(rows)}) ===')
        for r in rows:
            uname = r.get('username') or '-'
            print(f'  {r["email"]:<45} {uname:<25} last_paid={fmt_date(r["last_paid"])}')

    print(f'\nChessBlunders payers in {label}')
    print_group('ACTIVE sub', active)
    print_group('NO ACTIVE sub', inactive)
    print(f'\nTotals: active={len(active)} inactive={len(inactive)} total={len(active) + len(inactive)}')


if __name__ == '__main__':
    main()
