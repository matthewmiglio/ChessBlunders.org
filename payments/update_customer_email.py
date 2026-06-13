"""Change the email on a Stripe customer record.

Use when a user paid with a different email than their ChessBlunders
account, so future receipts and invoices go to the right address.

Usage:
    poetry run python update_customer_email.py cus_XXXX new@example.com
    poetry run python update_customer_email.py cus_XXXX new@example.com --dry-run
"""

import argparse

import stripe

from _common import stripe as _stripe, sget  # noqa: F401


def main() -> None:
    parser = argparse.ArgumentParser(description="Change a Stripe customer's email.")
    parser.add_argument('customer_id')
    parser.add_argument('new_email')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    cust = stripe.Customer.retrieve(args.customer_id)
    print(f'Before: {args.customer_id} email={sget(cust, "email")} name={sget(cust, "name")}')

    if args.dry_run:
        print(f'(dry run) would set email={args.new_email}')
        return

    updated = stripe.Customer.modify(args.customer_id, email=args.new_email)
    print(f'After:  {args.customer_id} email={sget(updated, "email")}')


if __name__ == '__main__':
    main()
