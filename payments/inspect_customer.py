"""Inspect a Stripe customer's checkout sessions, payment intents, and subscriptions.

Useful for debugging "I paid but my account wasn't upgraded" reports —
shows abandoned/open sessions and incomplete payments that the invoice
and charge lists miss.

Usage:
    poetry run python inspect_customer.py user@example.com
    poetry run python inspect_customer.py --customer-id cus_XXXX
"""

import argparse
from datetime import datetime, timezone

import stripe

from _common import stripe as _stripe, sget  # noqa: F401


def fmt_ts(ts):
    if not ts:
        return '???'
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')


def inspect_customer(customer_id: str) -> None:
    cust = stripe.Customer.retrieve(customer_id)
    print(f'\n=== Customer: {customer_id} ===')
    print(f'email={sget(cust, "email")} name={sget(cust, "name")} created={fmt_ts(sget(cust, "created"))}')
    print(f'metadata={sget(cust, "metadata")}')

    print('\nCheckout sessions:')
    sessions = stripe.checkout.Session.list(customer=customer_id, limit=20).data
    if not sessions:
        print('  (none)')
    for s in sessions:
        details = sget(s, 'customer_details') or {}
        print(f'  - {s.id}')
        print(f'      status={sget(s, "status")} payment_status={sget(s, "payment_status")} '
              f'amount_total={sget(s, "amount_total")} {sget(s, "currency")} mode={sget(s, "mode")}')
        print(f'      created={fmt_ts(sget(s, "created"))} details_email={sget(details, "email")}')
        print(f'      client_reference_id={sget(s, "client_reference_id")} metadata={sget(s, "metadata")}')

    print('\nPayment intents:')
    pis = stripe.PaymentIntent.list(customer=customer_id, limit=20).data
    if not pis:
        print('  (none)')
    for pi in pis:
        err = sget(pi, 'last_payment_error')
        print(f'  - {pi.id} status={sget(pi, "status")} amount={sget(pi, "amount")} '
              f'created={fmt_ts(sget(pi, "created"))} last_err={sget(err, "message") if err else None}')

    print('\nSubscriptions (all statuses):')
    subs = stripe.Subscription.list(customer=customer_id, status='all', limit=10).data
    if not subs:
        print('  (none)')
    for sub in subs:
        print(f'  - {sub.id} status={sget(sub, "status")} created={fmt_ts(sget(sub, "created"))}')


def find_customer_ids(email: str) -> list:
    out = []
    starting_after = None
    while True:
        params = {'email': email, 'limit': 100}
        if starting_after:
            params['starting_after'] = starting_after
        batch = stripe.Customer.list(**params)
        out.extend(c.id for c in batch.data)
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a Stripe customer's payment activity.")
    parser.add_argument('email', nargs='?')
    parser.add_argument('--customer-id')
    args = parser.parse_args()

    if not args.email and not args.customer_id:
        parser.error('provide an email or --customer-id')

    customer_ids = [args.customer_id] if args.customer_id else find_customer_ids(args.email)
    if not customer_ids:
        print(f'No Stripe customers found for email: {args.email}')
        return

    for cid in customer_ids:
        inspect_customer(cid)


if __name__ == '__main__':
    main()
