"""Audit subscription mismatches between Stripe and Supabase for ChessBlunders.

Usage:
    poetry run python audit_subscriptions.py

1) Find all customers with active Stripe ChessBlunders subscriptions
2) Find all Supabase profiles whose stripe_subscription_status is active/trialing
3) Compare (by stripe_customer_id) and report mismatches
4) Find profiles NOT marked active that still have an active Stripe sub
5) Find customers with multiple active subscriptions

ChessBlunders has no 'tier' column: premium == stripe_subscription_status.
profiles is keyed by auth id; emails come from auth.users.
"""

from datetime import datetime

import stripe

from _common import (
    CHESSBLUNDERS_PRICE_IDS,
    supabase,
    PROFILES_TABLE,
    ADMIN_EMAILS,
    sget,
    plan_for_price,
    email_for_user_id,
)
from _common import stripe as _stripe  # noqa: F401

ACTIVE_DB_STATUSES = {'active', 'trialing'}


def get_stripe_subscribed_users():
    results = []
    has_more = True
    starting_after = None

    while has_more:
        params = {'limit': 100, 'status': 'active', 'expand': ['data.customer']}
        if starting_after:
            params['starting_after'] = starting_after

        batch = stripe.Subscription.list(**params)

        for sub in batch.data:
            price_id = sub['items']['data'][0]['price']['id'] if sub['items']['data'] else None
            if price_id and price_id in CHESSBLUNDERS_PRICE_IDS:
                customer = sub['customer']
                email = sget(customer, 'email', '???') or '???'
                cust_id = sget(customer, 'id') or sub['customer']
                cancel_at_period_end = bool(sget(sub, 'cancel_at_period_end', False))
                current_period_end = sget(sub, 'current_period_end')
                if not current_period_end:
                    items = sub['items']['data']
                    if items:
                        current_period_end = sget(items[0], 'current_period_end')
                period_end_str = datetime.fromtimestamp(current_period_end).strftime('%Y-%m-%d') if current_period_end else '???'

                results.append({
                    'email': email,
                    'customer_id': cust_id,
                    'subscription_id': sub['id'],
                    'price_id': price_id,
                    'plan': plan_for_price(price_id),
                    'cancel_at_period_end': cancel_at_period_end,
                    'period_end': period_end_str,
                    'status': sub['status'],
                })

        has_more = batch.has_more
        if batch.data:
            starting_after = batch.data[-1].id

    return results


def get_db_profiles_with_customer():
    """Every profile that has a stripe_customer_id."""
    resp = supabase.table(PROFILES_TABLE) \
        .select('id, chess_username, stripe_customer_id, stripe_subscription_status, '
                'subscription_period_end, stripe_subscription_id') \
        .not_.is_('stripe_customer_id', 'null') \
        .execute()
    return resp.data or []


def main():
    print('=' * 70)
    print('STEP 1: Customers with active Stripe ChessBlunders subscriptions')
    print('=' * 70)
    stripe_users = get_stripe_subscribed_users()

    active_paying = [u for u in stripe_users if not u['cancel_at_period_end']]
    cancelled_with_access = [u for u in stripe_users if u['cancel_at_period_end']]

    print(f'\nTotal with access: {len(stripe_users)}')
    print(f'  Actively paying: {len(active_paying)}')
    print(f'  Cancelled but still in period: {len(cancelled_with_access)}')

    print(f'\n  {"Email":<40} {"Plan":<8} {"Cancel@End":<11} {"Period End":<12} {"Status"}')
    print(f'  {"-"*40} {"-"*8} {"-"*11} {"-"*12} {"-"*10}')
    for u in sorted(stripe_users, key=lambda x: x['email'].lower()):
        cancel_str = 'YES' if u['cancel_at_period_end'] else 'no'
        print(f'  {u["email"]:<40} {u["plan"]:<8} {cancel_str:<11} {u["period_end"]:<12} {u["status"]}')

    print(f'\n{"=" * 70}')
    print('STEP 2: Supabase profiles with active/trialing subscription status')
    print('=' * 70)
    db_profiles = get_db_profiles_with_customer()
    db_active = [p for p in db_profiles if p.get('stripe_subscription_status') in ACTIVE_DB_STATUSES]

    print(f'\nTotal active/trialing in DB: {len(db_active)}')
    print(f'\n  {"Username":<25} {"Status":<12} {"Ends At":<22} {"Customer"}')
    print(f'  {"-"*25} {"-"*12} {"-"*22} {"-"*20}')
    for p in sorted(db_active, key=lambda x: (x.get('chess_username') or '').lower()):
        print(f'  {(p.get("chess_username") or "???"):<25} '
              f'{(p.get("stripe_subscription_status") or "???"):<12} '
              f'{(p.get("subscription_period_end") or "???"):<22} '
              f'{p.get("stripe_customer_id")}')

    print(f'\n{"=" * 70}')
    print('STEP 3: Mismatches (by stripe_customer_id)')
    print('=' * 70)

    stripe_cust_ids = {u['customer_id'] for u in stripe_users if u['email'].lower() not in ADMIN_EMAILS}
    db_active_cust_ids = {p['stripe_customer_id'] for p in db_active if p.get('stripe_customer_id')}

    in_db_not_stripe = db_active_cust_ids - stripe_cust_ids
    if in_db_not_stripe:
        print(f'\nACTIVE in DB but NO active Stripe sub ({len(in_db_not_stripe)}):')
        for cust_id in in_db_not_stripe:
            p = next((x for x in db_active if x.get('stripe_customer_id') == cust_id), None)
            if p:
                email = email_for_user_id(p['id'])
                print(f'  {(p.get("chess_username") or "???"):<25} {(email or "???"):<35} {cust_id}')
    else:
        print('\nNo DB-active profiles missing from Stripe.')

    in_stripe_not_db = stripe_cust_ids - db_active_cust_ids
    if in_stripe_not_db:
        print(f'\nActive Stripe sub but NOT active in DB ({len(in_stripe_not_db)}):')
        for cust_id in in_stripe_not_db:
            su = next((u for u in stripe_users if u['customer_id'] == cust_id), None)
            if su:
                print(f'  {su["email"]:<40} {cust_id}')
    else:
        print('No active Stripe customers missing from DB.')

    # ── Step 4: profiles that are NOT active but have an active Stripe sub ──
    print(f'\n{"=" * 70}')
    print('STEP 4: Profiles NOT active in DB that have an ACTIVE Stripe sub')
    print('=' * 70)
    db_by_cust = {p.get('stripe_customer_id'): p for p in db_profiles if p.get('stripe_customer_id')}
    not_active = []
    for su in stripe_users:
        if su['email'].lower() in ADMIN_EMAILS:
            continue
        p = db_by_cust.get(su['customer_id'])
        if p and p.get('stripe_subscription_status') not in ACTIVE_DB_STATUSES:
            not_active.append((p, su))

    if not not_active:
        print('\n  No mis-flagged profiles. OK')
    else:
        print(f'\n  [WARN] {len(not_active)} profile(s) paying on Stripe but not active in DB:')
        for p, su in not_active:
            print(f'    *** {su["email"]:<40} username={p.get("chess_username") or "?":<20} '
                  f'db_status={p.get("stripe_subscription_status")} ends={su["period_end"]}')

    # ── Step 5: customers with multiple active subs ──
    print(f'\n{"=" * 70}')
    print('STEP 5: Customers with multiple active subscriptions')
    print('=' * 70)
    by_customer = {}
    for su in stripe_users:
        by_customer.setdefault(su['customer_id'], []).append(su)

    doubles = [(c, subs) for c, subs in by_customer.items() if len(subs) > 1]
    if not doubles:
        print('\n  No customers with multiple active subscriptions. OK')
    else:
        print(f'\n  [WARN] {len(doubles)} customer(s) with multiple active subscriptions:')
        for cust_id, subs in doubles:
            email = subs[0]['email']
            print(f'    *** {email:<40} cust={cust_id} — {len(subs)} active subs:')
            for s in subs:
                cancel = ' [cancelling]' if s['cancel_at_period_end'] else ''
                print(f'        - {s["plan"]:<8} sub={s["subscription_id"]} ends={s["period_end"]}{cancel}')

    print(f'\n{"=" * 70}')
    print('Done.')


if __name__ == '__main__':
    main()
