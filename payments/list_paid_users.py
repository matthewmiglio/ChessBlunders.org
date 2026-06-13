"""List active ChessBlunders Stripe subscribers.

Usage:
    poetry run python list_paid_users.py
    poetry run python list_paid_users.py --email someone@example.com
"""

import argparse
from datetime import datetime

import stripe

from _common import CHESSBLUNDERS_PRICE_IDS, YEARLY_PRICE_ID, sget
from _common import stripe as _stripe  # noqa: F401


def get_active_stripe_subs():
    results = []
    starting_after = None
    while True:
        params = {'limit': 100, 'status': 'active', 'expand': ['data.customer']}
        if starting_after:
            params['starting_after'] = starting_after
        batch = stripe.Subscription.list(**params)
        for sub in batch.data:
            price_id = sub['items']['data'][0]['price']['id'] if sub['items']['data'] else None
            if price_id not in CHESSBLUNDERS_PRICE_IDS:
                continue
            customer = sub['customer']
            email = sget(customer, 'email', '') or ''
            cust_id = sget(customer, 'id') or sub['customer']
            cpe = sget(sub, 'current_period_end') or sget(sub['items']['data'][0], 'current_period_end')
            results.append({
                'email': email,
                'customer_id': cust_id,
                'subscription_id': sub['id'],
                'price_id': price_id,
                'cancel_at_period_end': bool(sget(sub, 'cancel_at_period_end', False)),
                'period_end': datetime.fromtimestamp(cpe).strftime('%Y-%m-%d') if cpe else '???',
            })
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--email', help='Focus check on this email (case-insensitive)')
    args = parser.parse_args()

    subs = get_active_stripe_subs()

    print('=' * 70)
    print(f'ACTIVE ChessBlunders Stripe subscriptions: {len(subs)}')
    print('=' * 70)
    for s in sorted(subs, key=lambda x: x['email'].lower()):
        cancel = ' [cancelling]' if s['cancel_at_period_end'] else ''
        plan = 'yearly' if s['price_id'] == YEARLY_PRICE_ID else 'monthly'
        print(f'  {s["email"]:<40} {plan:<8} cust={s["customer_id"]}  ends={s["period_end"]}{cancel}')

    if args.email:
        target = args.email.lower()
        print()
        print('=' * 70)
        print(f'FOCUS: {target}')
        print('=' * 70)
        sub_match = [s for s in subs if s['email'].lower() == target]
        print(f'  Active Stripe sub: {bool(sub_match)}')
        for s in sub_match:
            print(f'    {s}')


if __name__ == '__main__':
    main()
