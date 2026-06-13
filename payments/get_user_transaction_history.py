"""Print a Stripe user's full transaction history.

Usage:
    poetry run python get_user_transaction_history.py user@example.com
    poetry run python get_user_transaction_history.py --customer-id cus_XXXX
"""

import argparse
from datetime import datetime, timezone

import stripe

from _common import stripe as _stripe  # noqa: F401


def fmt_ts(ts):
    if not ts:
        return '???'
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')


def fmt_amount(amount, currency):
    if amount is None:
        return '-'
    return f'{amount / 100:.2f} {currency.upper() if currency else ""}'.strip()


def find_customers_by_email(email):
    out = []
    starting_after = None
    while True:
        params = {'email': email, 'limit': 100}
        if starting_after:
            params['starting_after'] = starting_after
        batch = stripe.Customer.list(**params)
        out.extend(batch.data)
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return out


def list_invoices(customer_id):
    out = []
    starting_after = None
    while True:
        params = {'customer': customer_id, 'limit': 100, 'expand': ['data.lines.data.price']}
        if starting_after:
            params['starting_after'] = starting_after
        batch = stripe.Invoice.list(**params)
        out.extend(batch.data)
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return out


def list_charges(customer_id):
    out = []
    starting_after = None
    while True:
        params = {'customer': customer_id, 'limit': 100}
        if starting_after:
            params['starting_after'] = starting_after
        batch = stripe.Charge.list(**params)
        out.extend(batch.data)
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return out


def print_history(customer):
    print(f'\n=== Customer: {customer.id} ({getattr(customer, "email", None) or "no email"}) ===')
    created = getattr(customer, 'created', None)
    if created:
        print(f'Customer created: {fmt_ts(created)}')

    invoices = list_invoices(customer.id)
    invoices.sort(key=lambda inv: inv.get('created') or 0)

    print(f'\nInvoices ({len(invoices)}):')
    if not invoices:
        print('  (none)')
    paid_count = 0
    last_paid_ts = None
    for inv in invoices:
        status = inv.get('status')
        amount_paid = inv.get('amount_paid')
        currency = inv.get('currency')
        created_ts = inv.get('created')
        period_end = inv.get('period_end')
        paid_at = None
        if inv.get('status_transitions'):
            paid_at = inv['status_transitions'].get('paid_at')

        line_descs = []
        for line in inv.get('lines', {}).get('data', []) or []:
            price = line.get('price') or {}
            price_id = price.get('id') if hasattr(price, 'get') else None
            product_id = price.get('product') if hasattr(price, 'get') else None
            line_descs.append(f'price={price_id} product={product_id}')

        print(f'  - {inv.id}')
        print(f'      status={status} amount_paid={fmt_amount(amount_paid, currency)} amount_due={fmt_amount(inv.get("amount_due"), currency)}')
        print(f'      created={fmt_ts(created_ts)} paid_at={fmt_ts(paid_at)} period_end={fmt_ts(period_end)}')
        for desc in line_descs:
            print(f'      line: {desc}')
        if status == 'paid' and amount_paid:
            paid_count += 1
            ts = paid_at or created_ts
            if ts and (last_paid_ts is None or ts > last_paid_ts):
                last_paid_ts = ts

    charges = list_charges(customer.id)
    charges.sort(key=lambda c: c.get('created') or 0)
    print(f'\nCharges ({len(charges)}):')
    if not charges:
        print('  (none)')
    for ch in charges:
        print(f'  - {ch.id} status={ch.get("status")} paid={ch.get("paid")} amount={fmt_amount(ch.get("amount"), ch.get("currency"))} created={fmt_ts(ch.get("created"))} invoice={ch.get("invoice")}')

    print('\nSummary:')
    print(f'  paid invoices: {paid_count}')
    print(f'  last successful payment: {fmt_ts(last_paid_ts) if last_paid_ts else "(none)"}')


def main():
    parser = argparse.ArgumentParser(description="List a Stripe customer's full transaction history.")
    parser.add_argument('email', nargs='?')
    parser.add_argument('--customer-id')
    args = parser.parse_args()

    if not args.email and not args.customer_id:
        parser.error('provide an email or --customer-id')

    if args.customer_id:
        cust = stripe.Customer.retrieve(args.customer_id)
        print_history(cust)
        return

    customers = find_customers_by_email(args.email)
    if not customers:
        print(f'No Stripe customers found for email: {args.email}')
        return

    print(f'Found {len(customers)} customer(s) for {args.email}')
    for cust in customers:
        print_history(cust)


if __name__ == '__main__':
    main()
