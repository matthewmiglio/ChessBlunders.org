"""Delete a Stripe customer record.

Refuses to delete a customer with any subscriptions, invoices, or charges
unless --force is given. Intended for cleaning up empty duplicate
customers left behind by abandoned checkouts.

Usage:
    poetry run python delete_customer.py cus_XXXX
    poetry run python delete_customer.py cus_XXXX --dry-run
    poetry run python delete_customer.py cus_XXXX --force
"""

import argparse

import stripe

from _common import stripe as _stripe, supabase as sb, sget, PROFILES_TABLE  # noqa: F401


def main() -> None:
    parser = argparse.ArgumentParser(description='Delete a Stripe customer.')
    parser.add_argument('customer_id')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--force', action='store_true',
                        help='delete even if the customer has payment history')
    args = parser.parse_args()

    cust = stripe.Customer.retrieve(args.customer_id)
    print(f'Customer: {args.customer_id} email={sget(cust, "email")} name={sget(cust, "name")}')

    subs = stripe.Subscription.list(customer=args.customer_id, status='all', limit=10).data
    invoices = stripe.Invoice.list(customer=args.customer_id, limit=10).data
    charges = stripe.Charge.list(customer=args.customer_id, limit=10).data
    print(f'History: subscriptions={len(subs)} invoices={len(invoices)} charges={len(charges)}')

    if (subs or invoices or charges) and not args.force:
        raise SystemExit('Customer has payment history — refusing to delete (use --force to override)')

    if sb is not None:
        rows = sb.table(PROFILES_TABLE).select('id,chess_username').eq(
            'stripe_customer_id', args.customer_id
        ).execute()
        if rows.data:
            raise SystemExit(f'ChessBlunders profile(s) still reference this customer: {rows.data} — relink them first')

    if args.dry_run:
        print('(dry run) would delete customer')
        return

    result = stripe.Customer.delete(args.customer_id)
    print(f'Deleted: {sget(result, "id")} deleted={sget(result, "deleted")}')


if __name__ == '__main__':
    main()
